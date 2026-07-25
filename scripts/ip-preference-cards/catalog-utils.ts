import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import JSZip from 'jszip'
import { SaxesParser } from 'saxes'

export type CatalogRecord = Record<string, unknown>

export interface ImportWarning {
  code: string
  message: string
  row?: number
  sheet?: string
  value?: string
}

export interface SheetReadResult {
  headers: string[]
  records: CatalogRecord[]
  warnings: ImportWarning[]
}

export interface ParsedWorksheet {
  maxColumn: number
  maxRow: number
  rows: Map<number, Map<number, string>>
}

export interface ParsedWorkbook {
  sheets: Map<string, ParsedWorksheet>
}

export const IMPORTED_SHEETS = [
  'Products',
  'Product_Roles',
  'Procedures',
  'Procedure_Slots',
  'Slot_Product_Options',
  'Roles',
  'Compatibility',
  'Manufacturers',
  'Sources',
  'Product_Sources',
  'Hospital_Formulary',
  'Modifier_Catalog',
  'Product_Verification_Backlog',
] as const

export type ImportedSheetName = (typeof IMPORTED_SHEETS)[number]

export const EXPECTED_COUNTS: Partial<Record<ImportedSheetName, number>> = {
  Products: 1221,
  Roles: 98,
  Procedures: 13,
  Procedure_Slots: 174,
  Slot_Product_Options: 2080,
  Compatibility: 179,
}

const IDENTIFIER_COLUMNS = new Set([
  'product_id',
  'manufacturer_id',
  'role_code',
  'procedure_code',
  'slot_id',
  'source_id',
  'rule_id',
  'formulary_id',
  'gtin',
  'catalog_number',
  'alternate_ids',
  'global_part_number',
  'reference_part_number',
  'local_item_number',
  'primary_di',
  'suggested_primary_di',
  'existing_gtin',
  'workbook_catalog_number',
  'product_id',
  'modifier_code',
])

const NUMERIC_COLUMNS = new Set([
  'diameter_mm',
  'length_mm',
  'french_size',
  'gauge',
  'working_length_cm',
  'min_working_channel_mm',
  'delivery_system_od_mm',
  'default_qty',
  'display_order',
  'par_level',
  'priority_score',
  'required_slots',
  'conditional_slots',
  'optional_slots',
])

const BOOLEAN_COLUMNS = new Set([
  'implantable',
  'allow_custom',
  'visible_by_default',
  'hospital_carries',
  'preferred',
  'active',
  'requires_current_ifu',
])

const DATE_COLUMNS = new Set([
  'source_as_of',
  'as_of_date',
  'last_reviewed',
  'revision_date',
  'effective_from',
  'effective_to',
])

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function normalizeBlank(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function normalizeYesNo(value: unknown): boolean | null | unknown {
  if (typeof value !== 'string') return value
  const normalized = value.trim().toLowerCase()
  if (normalized === 'yes') return true
  if (normalized === 'no') return false
  if (normalized.length === 0) return null
  return value.trim()
}

export function normalizeSelectionMode(value: unknown): 'single' | 'multiple' | 'unknown' {
  if (value === 'Single' || value === 'Single select') return 'single'
  if (value === 'Multiple') return 'multiple'
  return 'unknown'
}

export function normalizeRequiredness(
  value: unknown,
): 'required' | 'conditional' | 'optional' | 'unknown' {
  if (value === 'Required') return 'required'
  if (value === 'Conditional') return 'conditional'
  if (value === 'Optional') return 'optional'
  return 'unknown'
}

export function normalizeVisibility(value: unknown): 'prototype_visible' | 'hidden' {
  return value === 'Prototype visible - reverify before production' ? 'prototype_visible' : 'hidden'
}

export function normalizeVerificationGrade(
  value: unknown,
): 'verified_source' | 'candidate' | 'unknown' {
  if (typeof value !== 'string') return 'unknown'
  if (value.startsWith('Verified')) return 'verified_source'
  if (value.startsWith('Candidate')) return 'candidate'
  return 'unknown'
}

export function normalizeReleaseState(value: unknown): 'mvp' | 'phase_1_1' | 'phase_2' | 'unknown' {
  if (value === 'MVP') return 'mvp'
  if (value === 'Phase 1.1') return 'phase_1_1'
  if (value === 'Phase 2') return 'phase_2'
  return 'unknown'
}

export function normalizeGtin(value: unknown): {
  normalized: string | null
  raw: string | null
  warning: string | null
} {
  if (value === null || value === undefined || value === '') {
    return { normalized: null, raw: null, warning: null }
  }

  const raw = String(value).trim()
  const normalized = /^\d{13}$/.test(raw) ? `0${raw}` : raw
  const warning = /^\d{14}$/.test(normalized)
    ? null
    : `GTIN "${raw}" does not normalize to exactly 14 digits.`

  return { normalized, raw, warning }
}

export function normalizeExcelDate(value: unknown): string | null | unknown {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (/^\d{4}$/.test(trimmed)) return trimmed
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (serial >= 20_000 && serial <= 100_000) {
      const milliseconds = Date.UTC(1899, 11, 30) + Math.floor(serial) * 24 * 60 * 60 * 1000
      return new Date(milliseconds).toISOString().slice(0, 10)
    }
  }
  const parsed = Date.parse(trimmed)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : trimmed
}

export function catalogValueAsString(record: CatalogRecord, key: string): string | null {
  const value = record[key]
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function xmlAttributeValue(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'value' in value && typeof value.value === 'string') {
    return value.value
  }
  return null
}

function localXmlName(name: string): string {
  return name.includes(':') ? (name.split(':').at(-1) ?? name) : name
}

function getXmlAttribute(attributes: Record<string, unknown>, ...names: string[]): string | null {
  for (const name of names) {
    const direct = xmlAttributeValue(attributes[name])
    if (direct !== null) return direct
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (names.includes(localXmlName(key))) {
      const normalized = xmlAttributeValue(value)
      if (normalized !== null) return normalized
    }
  }
  return null
}

function columnIndexFromReference(reference: string): number {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase()
  if (!letters) return 0
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0)
}

function parseWorkbookSheets(xml: string): { name: string; relationshipId: string }[] {
  const sheets: { name: string; relationshipId: string }[] = []
  const parser = new SaxesParser({ xmlns: false })
  parser.on('opentag', (node) => {
    if (localXmlName(node.name) !== 'sheet') return
    const attributes = node.attributes as Record<string, unknown>
    const name = getXmlAttribute(attributes, 'name')
    const relationshipId = getXmlAttribute(attributes, 'r:id', 'id')
    if (name && relationshipId) sheets.push({ name, relationshipId })
  })
  parser.write(xml).close()
  return sheets
}

function parseWorkbookRelationships(xml: string): Map<string, string> {
  const relationships = new Map<string, string>()
  const parser = new SaxesParser({ xmlns: false })
  parser.on('opentag', (node) => {
    if (localXmlName(node.name) !== 'Relationship') return
    const attributes = node.attributes as Record<string, unknown>
    const id = getXmlAttribute(attributes, 'Id', 'id')
    const target = getXmlAttribute(attributes, 'Target', 'target')
    if (id && target) relationships.set(id, target)
  })
  parser.write(xml).close()
  return relationships
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = []
  const parser = new SaxesParser({ xmlns: false })
  let inSharedItem = false
  let inText = false
  let current = ''
  parser.on('opentag', (node) => {
    const name = localXmlName(node.name)
    if (name === 'si') {
      inSharedItem = true
      current = ''
    }
    if (name === 't' && inSharedItem) inText = true
  })
  parser.on('text', (text) => {
    if (inText) current += text
  })
  parser.on('closetag', (node) => {
    const name = localXmlName(node.name)
    if (name === 't') inText = false
    if (name === 'si') {
      strings.push(current)
      current = ''
      inSharedItem = false
    }
  })
  parser.write(xml).close()
  return strings
}

function parseWorksheet(xml: string, sharedStrings: string[]): ParsedWorksheet {
  const rows = new Map<number, Map<number, string>>()
  const parser = new SaxesParser({ xmlns: false })
  let currentRow = 0
  let currentColumn = 0
  let currentType = ''
  let currentValue = ''
  let captureValue = false
  let hasCellValue = false
  let maxRow = 0
  let maxColumn = 0

  parser.on('opentag', (node) => {
    const name = localXmlName(node.name)
    const attributes = node.attributes as Record<string, unknown>
    if (name === 'row') {
      currentRow = Number(getXmlAttribute(attributes, 'r') ?? 0)
      maxRow = Math.max(maxRow, currentRow)
      return
    }
    if (name === 'c') {
      const reference = getXmlAttribute(attributes, 'r') ?? ''
      currentColumn = columnIndexFromReference(reference)
      currentType = getXmlAttribute(attributes, 't') ?? ''
      currentValue = ''
      hasCellValue = false
      maxColumn = Math.max(maxColumn, currentColumn)
      return
    }
    if (name === 'v' || (name === 't' && currentType === 'inlineStr')) {
      captureValue = true
      hasCellValue = true
    }
  })

  parser.on('text', (text) => {
    if (captureValue) currentValue += text
  })

  parser.on('closetag', (node) => {
    const name = localXmlName(node.name)
    if (name === 'v' || name === 't') {
      captureValue = false
      return
    }
    if (name !== 'c' || !hasCellValue || currentRow < 1 || currentColumn < 1) return

    const value =
      currentType === 's'
        ? (sharedStrings[Number(currentValue)] ?? '')
        : currentType === 'b'
          ? currentValue === '1'
            ? 'Yes'
            : 'No'
          : currentValue
    const row = rows.get(currentRow) ?? new Map<number, string>()
    row.set(currentColumn, value)
    rows.set(currentRow, row)
  })

  parser.write(xml).close()
  return { rows, maxRow, maxColumn }
}

export async function loadOoxmlWorkbook(workbookPath: string): Promise<ParsedWorkbook> {
  const archive = await JSZip.loadAsync(await readFile(workbookPath))
  const workbookXml = await archive.file('xl/workbook.xml')?.async('string')
  const relationshipsXml = await archive.file('xl/_rels/workbook.xml.rels')?.async('string')
  if (!workbookXml || !relationshipsXml) {
    throw new Error('The workbook is missing its OOXML workbook or relationship manifest.')
  }

  const sharedStringsXml = await archive.file('xl/sharedStrings.xml')?.async('string')
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : []
  const relationships = parseWorkbookRelationships(relationshipsXml)
  const sheets = new Map<string, ParsedWorksheet>()

  for (const sheet of parseWorkbookSheets(workbookXml)) {
    const target = relationships.get(sheet.relationshipId)
    if (!target) {
      throw new Error(`Workbook relationship ${sheet.relationshipId} is missing.`)
    }
    const normalizedTarget = target.startsWith('/')
      ? target.slice(1)
      : path.posix.normalize(path.posix.join('xl', target))
    const worksheetXml = await archive.file(normalizedTarget)?.async('string')
    if (!worksheetXml) {
      throw new Error(`Worksheet XML for "${sheet.name}" is missing at ${normalizedTarget}.`)
    }
    sheets.set(sheet.name, parseWorksheet(worksheetXml, sharedStrings))
  }

  return { sheets }
}

function normalizeCellValue(textValue: string | undefined, header: string): unknown {
  const text = (textValue ?? '').trim()
  if (text.length === 0) return null

  if (IDENTIFIER_COLUMNS.has(header)) return text

  if (BOOLEAN_COLUMNS.has(header)) {
    return normalizeYesNo(text)
  }

  if (NUMERIC_COLUMNS.has(header)) {
    const numeric = Number(text.replace(/,/g, ''))
    return Number.isFinite(numeric) ? numeric : text
  }

  if (DATE_COLUMNS.has(header)) {
    return normalizeExcelDate(text)
  }

  return normalizeBlank(text)
}

export function readTabularSheet(
  workbook: ParsedWorkbook,
  sheetName: ImportedSheetName,
): SheetReadResult {
  const worksheet = workbook.sheets.get(sheetName)
  if (!worksheet) {
    throw new Error(`Required workbook sheet "${sheetName}" is missing.`)
  }

  const warnings: ImportWarning[] = []
  const headerRow = worksheet.rows.get(4) ?? new Map<number, string>()
  const headers: string[] = []
  for (let column = 1; column <= worksheet.maxColumn; column += 1) {
    const rawHeader = (headerRow.get(column) ?? '').trim()
    headers.push(normalizeHeader(rawHeader))
  }

  const duplicateHeaders = headers.filter(
    (header, index) => header.length > 0 && headers.indexOf(header) !== index,
  )
  if (duplicateHeaders.length > 0) {
    throw new Error(
      `Sheet "${sheetName}" contains duplicate normalized headers: ${[
        ...new Set(duplicateHeaders),
      ].join(', ')}`,
    )
  }

  const records: CatalogRecord[] = []
  for (let rowNumber = 5; rowNumber <= worksheet.maxRow; rowNumber += 1) {
    const row = worksheet.rows.get(rowNumber) ?? new Map<number, string>()
    const record: CatalogRecord = {}
    let hasValue = false

    headers.forEach((header, index) => {
      if (!header) return
      const value = normalizeCellValue(row.get(index + 1), header)
      if (value !== null) hasValue = true
      record[header] = value
    })

    if (!hasValue) continue
    record._source_row = rowNumber
    records.push(record)
  }

  if (headers.length === 0 || headers.every((header) => header.length === 0)) {
    warnings.push({
      sheet: sheetName,
      code: 'missing_headers',
      message: 'No normalized headers were found on Excel row 4.',
    })
  }

  return { headers, records, warnings }
}

export async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex')
}

export function findDuplicateValues(
  records: CatalogRecord[],
  key: string,
): { value: string; rows: number[] }[] {
  const rowsByValue = new Map<string, number[]>()
  for (const record of records) {
    const value = catalogValueAsString(record, key)
    if (!value) continue
    const sourceRow = Number(record._source_row)
    rowsByValue.set(value, [...(rowsByValue.get(value) ?? []), sourceRow])
  }

  return [...rowsByValue.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([value, rows]) => ({ value, rows }))
}

export function getStringSet(records: CatalogRecord[], key: string): Set<string> {
  return new Set(
    records.flatMap((record) => {
      const value = catalogValueAsString(record, key)
      return value ? [value] : []
    }),
  )
}

export function collectBrokenReferences(
  records: CatalogRecord[],
  key: string,
  targets: Set<string>,
): { row: number; value: string }[] {
  return records.flatMap((record) => {
    const value = catalogValueAsString(record, key)
    if (!value || targets.has(value)) return []
    return [{ row: Number(record._source_row), value }]
  })
}

export function withoutSourceRow(record: CatalogRecord): CatalogRecord {
  const { _source_row: sourceRow, ...rest } = record
  void sourceRow
  return rest
}

export function isSubstantialCountDifference(actual: number, expected: number): boolean {
  return Math.abs(actual - expected) > Math.max(10, Math.ceil(expected * 0.1))
}

export function stableSortRecords(records: CatalogRecord[], key: string): CatalogRecord[] {
  return [...records].sort((left, right) =>
    (catalogValueAsString(left, key) ?? '').localeCompare(catalogValueAsString(right, key) ?? ''),
  )
}
