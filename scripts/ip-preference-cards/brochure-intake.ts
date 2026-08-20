import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export const BROCHURE_DISPOSITIONS = [
  'existing_exact',
  'existing_alias_or_format_variant',
  'existing_family_or_package_variant',
  'new_product_added',
  'relevant_but_insufficient_identity',
  'relevant_family_level_only',
  'duplicate_source_row',
  'irrelevant_to_current_scope',
  'source_document_missing',
  'source_evidence_conflicted',
  'needs_owner_review',
] as const

export type BrochureDisposition = (typeof BROCHURE_DISPOSITIONS)[number]

export const NOT_STATED_IDENTIFIER = 'Not stated in source'

const EXPECTED_HEADER = ['Product ID', 'Product Name', 'Manufacturer', 'Source File'] as const

export interface BrochureInputRow {
  /** One-based position among product rows. An observed CSV header is not a product row. */
  inputRowNumber: number
  /** One-based physical CSV line, retained to make the unexpected-header discrepancy auditable. */
  sourceLineNumber: number
  extractedIdentifier: string
  extractedProductName: string
  extractedManufacturer: string
  sourceValue: string
  sourceFilenames: string[]
}

export interface ParsedBrochureCsv {
  rows: BrochureInputRow[]
  detectedHeader: boolean
  warnings: string[]
}

export interface BrochureInputSummary {
  total_rows: number
  rows_with_exact_identifier: number
  rows_with_not_stated_identifier: number
  unique_manufacturers: number
  unique_source_filenames: number
  unresolved_source_filenames: string[]
  exact_duplicate_rows: {
    first_input_row_number: number
    duplicate_input_row_numbers: number[]
  }[]
  repeated_identifiers: {
    identifier: string
    input_row_numbers: number[]
  }[]
}

export interface BrochureReconciliationRow {
  input_row_number: number
  extracted_identifier: string
  extracted_product_name: string
  extracted_manufacturer: string
  source_filename: string
  matched_source_page: string
  disposition: BrochureDisposition
  canonical_product_id: string
  canonical_catalog_number: string
  match_basis: string
  evidence_strength: string
  reason_code: string
  owner_review_note: string
}

/**
 * Minimal RFC-4180 reader used for the frozen intake file and fixtures.
 *
 * It intentionally returns strings only: identifiers such as `02841S`, digit-only SKUs, and
 * decimal-looking catalog numbers must never pass through numeric coercion.
 */
export function parseCsvRecords(contents: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false

  const finishField = () => {
    record.push(field)
    field = ''
  }
  const finishRecord = () => {
    finishField()
    records.push(record)
    record = []
  }

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index]
    if (quoted) {
      if (character === '"') {
        if (contents[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += character
      }
      continue
    }

    if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      finishField()
    } else if (character === '\n') {
      finishRecord()
    } else if (character === '\r') {
      if (contents[index + 1] === '\n') index += 1
      finishRecord()
    } else {
      field += character
    }
  }

  if (quoted) throw new Error('CSV ended inside a quoted field.')
  if (field.length > 0 || record.length > 0) finishRecord()
  return records
}

function decodeHtmlEntity(entity: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&apos;': "'",
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
  }
  if (named[entity]) return named[entity]
  const decimal = entity.match(/^&#(\d+);$/)
  if (decimal) return String.fromCodePoint(Number(decimal[1]))
  const hexadecimal = entity.match(/^&#x([\da-f]+);$/i)
  if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal[1], 16))
  return entity
}

export function decodeComparisonEntities(value: string): string {
  return value.replace(/&(?:[a-z][a-z\d]+|#\d+|#x[\da-f]+);/gi, decodeHtmlEntity)
}

/** Split list delimiters without treating the semicolon that terminates `&quot;` as a delimiter. */
export function splitSourceFilenames(value: string): string[] {
  const filenames: string[] = []
  let current = ''

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '&') {
      const remainder = value.slice(index)
      const entity = remainder.match(/^&(?:[a-z][a-z\d]+|#\d+|#x[\da-f]+);/i)?.[0]
      if (entity) {
        current += decodeHtmlEntity(entity)
        index += entity.length - 1
        continue
      }
    }
    if (value[index] === ';') {
      const filename = current.trim()
      if (filename) filenames.push(filename)
      current = ''
    } else {
      current += value[index]
    }
  }

  const filename = current.trim()
  if (filename) filenames.push(filename)
  return filenames
}

function isExpectedHeader(record: string[]): boolean {
  return (
    record.length === EXPECTED_HEADER.length &&
    EXPECTED_HEADER.every((value, index) => record[index] === value)
  )
}

export function parseBrochureCsv(contents: string): ParsedBrochureCsv {
  const records = parseCsvRecords(contents)
  const detectedHeader = records.length > 0 && isExpectedHeader(records[0])
  const warnings = detectedHeader
    ? [
        'The supplied CSV contains a header even though the intake brief describes it as headerless; the exact observed header was excluded from product-row accounting.',
      ]
    : []
  const dataRecords = detectedHeader ? records.slice(1) : records

  const rows = dataRecords.map((record, index): BrochureInputRow => {
    if (record.length !== 4) {
      throw new Error(
        `Input row ${index + 1} has ${record.length} columns; expected exactly four positional fields.`,
      )
    }
    const [identifier, productName, manufacturer, sourceValue] = record
    return {
      inputRowNumber: index + 1,
      sourceLineNumber: index + (detectedHeader ? 2 : 1),
      extractedIdentifier: identifier,
      extractedProductName: productName,
      extractedManufacturer: manufacturer,
      sourceValue,
      sourceFilenames: splitSourceFilenames(sourceValue),
    }
  })

  return { rows, detectedHeader, warnings }
}

export function normalizeComparisonText(value: string): string {
  return decodeComparisonEntities(value).normalize('NFKC').replace(/\s+/g, ' ').trim()
}

export function normalizeIdentifier(value: string): string {
  return normalizeComparisonText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function rowIdentity(row: BrochureInputRow): string {
  return JSON.stringify([
    row.extractedIdentifier,
    row.extractedProductName,
    row.extractedManufacturer,
    row.sourceValue,
  ])
}

export function summarizeBrochureInput(
  rows: BrochureInputRow[],
  localSourceFilenames: Iterable<string>,
): BrochureInputSummary {
  const localSources = new Set(
    [...localSourceFilenames].map((filename) => normalizeComparisonText(filename)),
  )
  const uniqueSources = new Set(rows.flatMap((row) => row.sourceFilenames))
  const rowsByExactIdentity = new Map<string, number[]>()
  const rowsByIdentifier = new Map<string, { original: string; rows: number[] }>()

  for (const row of rows) {
    const exactIdentity = rowIdentity(row)
    rowsByExactIdentity.set(exactIdentity, [
      ...(rowsByExactIdentity.get(exactIdentity) ?? []),
      row.inputRowNumber,
    ])
    if (row.extractedIdentifier !== NOT_STATED_IDENTIFIER) {
      const normalized = normalizeIdentifier(row.extractedIdentifier)
      const current = rowsByIdentifier.get(normalized) ?? {
        original: row.extractedIdentifier,
        rows: [],
      }
      current.rows.push(row.inputRowNumber)
      rowsByIdentifier.set(normalized, current)
    }
  }

  return {
    total_rows: rows.length,
    rows_with_exact_identifier: rows.filter(
      (row) => row.extractedIdentifier !== NOT_STATED_IDENTIFIER,
    ).length,
    rows_with_not_stated_identifier: rows.filter(
      (row) => row.extractedIdentifier === NOT_STATED_IDENTIFIER,
    ).length,
    unique_manufacturers: new Set(rows.map((row) => row.extractedManufacturer)).size,
    unique_source_filenames: uniqueSources.size,
    unresolved_source_filenames: [...uniqueSources]
      .filter((filename) => !localSources.has(normalizeComparisonText(filename)))
      .sort(),
    exact_duplicate_rows: [...rowsByExactIdentity.values()]
      .filter((inputRows) => inputRows.length > 1)
      .map((inputRows) => ({
        first_input_row_number: inputRows[0],
        duplicate_input_row_numbers: inputRows.slice(1),
      })),
    repeated_identifiers: [...rowsByIdentifier.values()]
      .filter((value) => value.rows.length > 1)
      .map((value) => ({ identifier: value.original, input_row_numbers: value.rows }))
      .sort((left, right) => left.identifier.localeCompare(right.identifier)),
  }
}

export function validateReconciliationRows(
  inputRows: BrochureInputRow[],
  reconciliationRows: BrochureReconciliationRow[],
): void {
  const allowed = new Set<string>(BROCHURE_DISPOSITIONS)
  const expected = new Map(inputRows.map((row) => [row.inputRowNumber, row]))
  const observed = new Set<number>()

  for (const row of reconciliationRows) {
    const input = expected.get(row.input_row_number)
    if (!input)
      throw new Error(`Reconciliation references unknown input row ${row.input_row_number}.`)
    if (observed.has(row.input_row_number)) {
      throw new Error(`Reconciliation contains input row ${row.input_row_number} more than once.`)
    }
    observed.add(row.input_row_number)
    if (!allowed.has(row.disposition)) {
      throw new Error(
        `Input row ${row.input_row_number} has unsupported disposition ${String(row.disposition)}.`,
      )
    }
    if (
      row.extracted_identifier !== input.extractedIdentifier ||
      row.extracted_product_name !== input.extractedProductName ||
      row.extracted_manufacturer !== input.extractedManufacturer ||
      row.source_filename !== input.sourceValue
    ) {
      throw new Error(
        `Reconciliation altered extracted values for input row ${row.input_row_number}.`,
      )
    }
    if (row.disposition === 'new_product_added' && !row.canonical_product_id) {
      throw new Error(`Added input row ${row.input_row_number} has no canonical product ID.`)
    }
  }

  const missing = [...expected.keys()].filter((inputRow) => !observed.has(inputRow))
  if (missing.length > 0) {
    throw new Error(
      `Reconciliation is missing ${missing.length} input row(s): ${missing.join(', ')}.`,
    )
  }
}

export function sha256Bytes(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function sha256File(filePath: string): Promise<string> {
  return sha256Bytes(await readFile(filePath))
}
