import path from 'node:path'

import JSZip from 'jszip'
import { SaxesParser } from 'saxes'

const MAX_COMPRESSED_BYTES = 20 * 1024 * 1024
const MAX_UNCOMPRESSED_BYTES = 80 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 200
const MAX_WORKSHEET_BYTES = 32 * 1024 * 1024
const MAX_SHARED_STRING_BYTES = 12 * 1024 * 1024
const MAX_WORKSHEET_ROWS = 5_000
const MAX_WORKSHEET_COLUMNS = 100
const MAX_CELL_CHARACTERS = 32_767
const MAX_RELATIONSHIP_TARGET_CHARACTERS = 4_096

export interface ParsedOoxmlCell {
  value: string
  type: string
  style: string | null
  hasFormula: boolean
}

export interface ParsedOoxmlWorksheet {
  hyperlinks: Map<string, string>
  maxColumn: number
  maxRow: number
  rows: Map<number, Map<number, ParsedOoxmlCell>>
}

export interface ParsedOoxmlWorkbook {
  sheets: Map<string, ParsedOoxmlWorksheet>
  sheetNames: string[]
  archiveEntryNames: string[]
}

interface ZipEntryWithSize {
  dir: boolean
  _data?: {
    uncompressedSize?: number
  }
}

interface OoxmlRelationship {
  target: string
  targetMode: string | null
  type: string | null
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

export function ooxmlColumnIndex(reference: string): number {
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
    if (target && target.length > MAX_RELATIONSHIP_TARGET_CHARACTERS) {
      throw new Error('Workbook relationship target exceeds the accepted length.')
    }
    if (id && target) relationships.set(id, target)
  })
  parser.write(xml).close()
  return relationships
}

function parseRelationships(xml: string): Map<string, OoxmlRelationship> {
  const relationships = new Map<string, OoxmlRelationship>()
  const parser = new SaxesParser({ xmlns: false })
  parser.on('opentag', (node) => {
    if (localXmlName(node.name) !== 'Relationship') return
    const attributes = node.attributes as Record<string, unknown>
    const id = getXmlAttribute(attributes, 'Id', 'id')
    const target = getXmlAttribute(attributes, 'Target', 'target')
    if (!id || !target) return
    if (target.length > MAX_RELATIONSHIP_TARGET_CHARACTERS) {
      throw new Error('Workbook relationship target exceeds the accepted length.')
    }
    if (relationships.has(id)) {
      throw new Error(`Workbook relationship "${id}" is duplicated.`)
    }
    relationships.set(id, {
      target,
      targetMode: getXmlAttribute(attributes, 'TargetMode', 'targetMode'),
      type: getXmlAttribute(attributes, 'Type', 'type'),
    })
  })
  parser.write(xml).close()
  return relationships
}

function parseWorksheetHyperlinks(xml: string): Map<string, string> {
  const hyperlinks = new Map<string, string>()
  const parser = new SaxesParser({ xmlns: false })
  parser.on('opentag', (node) => {
    if (localXmlName(node.name) !== 'hyperlink') return
    const attributes = node.attributes as Record<string, unknown>
    const reference = getXmlAttribute(attributes, 'ref')
    const relationshipId = getXmlAttribute(attributes, 'r:id', 'id')
    if (!reference || !relationshipId) return
    if (hyperlinks.has(reference)) {
      throw new Error(`Workbook hyperlink "${reference}" is duplicated.`)
    }
    hyperlinks.set(reference, relationshipId)
  })
  parser.write(xml).close()
  return hyperlinks
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = []
  const parser = new SaxesParser({ xmlns: false })
  let inSharedItem = false
  let inText = false
  let current = ''
  const appendText = (text: string) => {
    current += text
    if (current.length > MAX_CELL_CHARACTERS) {
      throw new Error('Workbook cell text exceeds Excel’s accepted length.')
    }
  }
  parser.on('opentag', (node) => {
    const name = localXmlName(node.name)
    if (name === 'si') {
      inSharedItem = true
      current = ''
    }
    if (name === 't' && inSharedItem) inText = true
  })
  parser.on('text', (text) => {
    if (inText) appendText(text)
  })
  parser.on('cdata', (text) => {
    if (inText) appendText(text)
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

function parseWorksheet(xml: string, sharedStrings: string[]): ParsedOoxmlWorksheet {
  const rows = new Map<number, Map<number, ParsedOoxmlCell>>()
  const parser = new SaxesParser({ xmlns: false })
  let currentRow = 0
  let currentColumn = 0
  let currentType = ''
  let currentStyle: string | null = null
  let currentValue = ''
  let captureValue = false
  let hasCellValue = false
  let hasFormula = false
  let maxRow = 0
  let maxColumn = 0
  const appendValue = (text: string) => {
    currentValue += text
    if (currentValue.length > MAX_CELL_CHARACTERS) {
      throw new Error('Workbook cell text exceeds Excel’s accepted length.')
    }
  }

  parser.on('opentag', (node) => {
    const name = localXmlName(node.name)
    const attributes = node.attributes as Record<string, unknown>
    if (name === 'row') {
      currentRow = Number(getXmlAttribute(attributes, 'r') ?? 0)
      if (!Number.isSafeInteger(currentRow) || currentRow < 0 || currentRow > MAX_WORKSHEET_ROWS) {
        throw new Error(`Workbook row limit exceeded at row ${String(currentRow)}.`)
      }
      maxRow = Math.max(maxRow, currentRow)
      return
    }
    if (name === 'c') {
      const reference = getXmlAttribute(attributes, 'r') ?? ''
      currentColumn = ooxmlColumnIndex(reference)
      if (currentColumn > MAX_WORKSHEET_COLUMNS) {
        throw new Error(`Workbook column limit exceeded at ${reference}.`)
      }
      currentType = getXmlAttribute(attributes, 't') ?? 'n'
      currentStyle = getXmlAttribute(attributes, 's')
      currentValue = ''
      hasCellValue = false
      hasFormula = false
      maxColumn = Math.max(maxColumn, currentColumn)
      return
    }
    if (name === 'f' && currentRow > 0 && currentColumn > 0) {
      hasFormula = true
      return
    }
    if (name === 'v' || (name === 't' && currentType === 'inlineStr')) {
      captureValue = true
      hasCellValue = true
    }
  })

  parser.on('text', (text) => {
    if (captureValue) appendValue(text)
  })
  parser.on('cdata', (text) => {
    if (captureValue) appendValue(text)
  })

  parser.on('closetag', (node) => {
    const name = localXmlName(node.name)
    if (name === 'v' || name === 't') {
      captureValue = false
      return
    }
    if (name !== 'c' || currentRow < 1 || currentColumn < 1) return

    const value = hasCellValue
      ? currentType === 's'
        ? (sharedStrings[Number(currentValue)] ?? '')
        : currentType === 'b'
          ? currentValue === '1'
            ? 'Yes'
            : 'No'
          : currentValue
      : ''
    const row = rows.get(currentRow) ?? new Map<number, ParsedOoxmlCell>()
    row.set(currentColumn, {
      value,
      type: currentType,
      style: currentStyle,
      hasFormula,
    })
    rows.set(currentRow, row)
  })

  parser.write(xml).close()
  return { hyperlinks: new Map(), rows, maxRow, maxColumn }
}

function validateArchiveEntryNames(entryNames: string[]) {
  const normalized = entryNames.map((entry) => entry.toLocaleLowerCase())
  if (
    normalized.some(
      (entry) =>
        entry.includes('vbaproject') ||
        entry.startsWith('xl/externallinks/') ||
        entry.endsWith('.bin') ||
        entry.endsWith('.exe'),
    )
  ) {
    throw new Error('Macro-enabled or externally linked workbooks are not accepted.')
  }
  if (
    entryNames.some(
      (entry) =>
        entry.startsWith('/') ||
        entry.startsWith('\\') ||
        /^[a-z]:[\\/]/i.test(entry) ||
        /[\u0000-\u001f\u007f]/.test(entry) ||
        entry.split(/[\\/]/).some((segment) => segment === '..'),
    )
  ) {
    throw new Error('The workbook archive contains an unsafe entry path.')
  }
}

function findZipEndOfCentralDirectory(input: Uint8Array, view: DataView): number {
  const minimumOffset = Math.max(0, input.byteLength - 22 - 65_535)
  for (let offset = input.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue
    const commentLength = view.getUint16(offset + 20, true)
    if (offset + 22 + commentLength === input.byteLength) return offset
  }
  throw new Error('Workbook ZIP central directory is missing or malformed.')
}

function decodeZipEntryName(bytes: Uint8Array, utf8: boolean): string {
  return new TextDecoder(utf8 ? 'utf-8' : 'iso-8859-1', { fatal: true }).decode(bytes)
}

function preflightZipArchive(input: Uint8Array): string[] {
  if (input.byteLength < 22) {
    throw new Error('Workbook ZIP central directory is missing or malformed.')
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength)
  const endOffset = findZipEndOfCentralDirectory(input, view)
  const diskNumber = view.getUint16(endOffset + 4, true)
  const centralDirectoryDisk = view.getUint16(endOffset + 6, true)
  const entriesOnDisk = view.getUint16(endOffset + 8, true)
  const entryCount = view.getUint16(endOffset + 10, true)
  const centralDirectorySize = view.getUint32(endOffset + 12, true)
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true)

  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error('Multi-disk and ZIP64 workbooks are not accepted.')
  }
  if (entryCount > MAX_ARCHIVE_ENTRIES) {
    throw new Error(`Workbook archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`)
  }
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize
  if (
    centralDirectoryOffset > endOffset ||
    centralDirectoryEnd !== endOffset ||
    centralDirectoryEnd < centralDirectoryOffset
  ) {
    throw new Error('Workbook ZIP central directory is malformed.')
  }

  const entryNames: string[] = []
  const seenEntryNames = new Set<string>()
  let cursor = centralDirectoryOffset
  let totalUncompressed = 0

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralDirectoryEnd || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('Workbook ZIP central directory is malformed.')
    }
    const flags = view.getUint16(cursor + 8, true)
    const compressionMethod = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const uncompressedSize = view.getUint32(cursor + 24, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraFieldLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localHeaderOffset = view.getUint32(cursor + 42, true)
    const entryEnd = cursor + 46 + fileNameLength + extraFieldLength + commentLength

    if (
      entryEnd > centralDirectoryEnd ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new Error('ZIP64 workbooks are not accepted.')
    }
    if ((flags & 0x0001) !== 0) {
      throw new Error('Encrypted workbooks are not accepted.')
    }
    if (![0, 8].includes(compressionMethod)) {
      throw new Error('The workbook uses an unsupported ZIP compression method.')
    }

    const fileNameBytes = input.subarray(cursor + 46, cursor + 46 + fileNameLength)
    const entryName = decodeZipEntryName(fileNameBytes, (flags & 0x0800) !== 0)
    if (!entryName || seenEntryNames.has(entryName)) {
      throw new Error('Workbook ZIP entries must have unique nonempty names.')
    }
    seenEntryNames.add(entryName)
    entryNames.push(entryName)
    totalUncompressed += uncompressedSize
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      throw new Error('Workbook expands beyond the accepted size limit.')
    }

    if (
      localHeaderOffset + 30 > centralDirectoryOffset ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    ) {
      throw new Error('Workbook ZIP local header is malformed.')
    }
    const localFlags = view.getUint16(localHeaderOffset + 6, true)
    const localFileNameLength = view.getUint16(localHeaderOffset + 26, true)
    const localExtraFieldLength = view.getUint16(localHeaderOffset + 28, true)
    const localHeaderEnd = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength
    if (
      localHeaderEnd > centralDirectoryOffset ||
      localHeaderEnd + compressedSize > centralDirectoryOffset
    ) {
      throw new Error('Workbook ZIP local header is malformed.')
    }
    const localEntryName = decodeZipEntryName(
      input.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localFileNameLength),
      (localFlags & 0x0800) !== 0,
    )
    if (localEntryName !== entryName) {
      throw new Error('Workbook ZIP entry names are inconsistent.')
    }

    cursor = entryEnd
  }

  if (cursor !== centralDirectoryEnd) {
    throw new Error('Workbook ZIP central directory is malformed.')
  }
  validateArchiveEntryNames(entryNames)
  return entryNames
}

function validateArchiveSize(archive: JSZip) {
  const entries = Object.values(archive.files) as unknown as ZipEntryWithSize[]
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error(`Workbook archive contains more than ${MAX_ARCHIVE_ENTRIES} entries.`)
  }
  let totalUncompressed = 0
  for (const entry of entries) {
    if (entry.dir) continue
    const size = entry._data?.uncompressedSize
    if (typeof size === 'number' && Number.isFinite(size)) {
      totalUncompressed += size
    }
  }
  if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
    throw new Error('Workbook expands beyond the accepted size limit.')
  }
}

async function requiredXml(
  archive: JSZip,
  archivePath: string,
  maximumBytes: number,
): Promise<string> {
  const entry = archive.file(archivePath)
  if (!entry) throw new Error(`Workbook entry "${archivePath}" is missing.`)
  const data = await entry.async('uint8array')
  if (data.byteLength > maximumBytes) {
    throw new Error(`Workbook entry "${archivePath}" exceeds the accepted size limit.`)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(data)
}

export async function parseOoxmlWorkbookBytes(input: Uint8Array): Promise<ParsedOoxmlWorkbook> {
  if (input.byteLength === 0 || input.byteLength > MAX_COMPRESSED_BYTES) {
    throw new Error('Workbook file size must be between 1 byte and 20 MB.')
  }
  if (input[0] !== 0x50 || input[1] !== 0x4b) {
    throw new Error('The uploaded file is not an OOXML ZIP workbook.')
  }

  const rawArchiveEntryNames = preflightZipArchive(input)
  const archive = await JSZip.loadAsync(input, {
    checkCRC32: true,
    createFolders: false,
  })
  const archiveEntryNames = Object.keys(archive.files)
  validateArchiveEntryNames(archiveEntryNames)
  validateArchiveSize(archive)

  const contentTypesXml = await requiredXml(archive, '[Content_Types].xml', MAX_SHARED_STRING_BYTES)
  if (
    /macroEnabled|vbaProject|externalLink/i.test(contentTypesXml) ||
    !/spreadsheetml\.sheet\.main\+xml/i.test(contentTypesXml)
  ) {
    throw new Error('The uploaded file is not a supported macro-free .xlsx workbook.')
  }

  const workbookXml = await requiredXml(archive, 'xl/workbook.xml', MAX_SHARED_STRING_BYTES)
  const relationshipsXml = await requiredXml(
    archive,
    'xl/_rels/workbook.xml.rels',
    MAX_SHARED_STRING_BYTES,
  )
  const sharedStringsEntry = archive.file('xl/sharedStrings.xml')
  const sharedStringsXml = sharedStringsEntry
    ? await requiredXml(archive, 'xl/sharedStrings.xml', MAX_SHARED_STRING_BYTES)
    : null
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : []
  const relationships = parseWorkbookRelationships(relationshipsXml)
  const workbookSheets = parseWorkbookSheets(workbookXml)
  const sheets = new Map<string, ParsedOoxmlWorksheet>()

  if (new Set(workbookSheets.map((sheet) => sheet.name)).size !== workbookSheets.length) {
    throw new Error('Workbook contains duplicate worksheet names.')
  }

  for (const sheet of workbookSheets) {
    const target = relationships.get(sheet.relationshipId)
    if (!target) {
      throw new Error(`Workbook relationship ${sheet.relationshipId} is missing.`)
    }
    const normalizedTarget = target.startsWith('/')
      ? target.slice(1)
      : path.posix.normalize(path.posix.join('xl', target))
    if (!normalizedTarget.startsWith('xl/worksheets/')) {
      throw new Error(`Worksheet "${sheet.name}" has an invalid relationship target.`)
    }
    const worksheetXml = await requiredXml(archive, normalizedTarget, MAX_WORKSHEET_BYTES)
    const worksheet = parseWorksheet(worksheetXml, sharedStrings)
    const hyperlinkIds = parseWorksheetHyperlinks(worksheetXml)
    if (hyperlinkIds.size > 0) {
      const relationshipPath = `${path.posix.dirname(normalizedTarget)}/_rels/${path.posix.basename(
        normalizedTarget,
      )}.rels`
      const relationshipXml = await requiredXml(archive, relationshipPath, MAX_SHARED_STRING_BYTES)
      const sheetRelationships = parseRelationships(relationshipXml)
      for (const [reference, relationshipId] of hyperlinkIds) {
        const relationship = sheetRelationships.get(relationshipId)
        if (!relationship || !relationship.type?.endsWith('/hyperlink')) {
          throw new Error(`Workbook hyperlink "${reference}" is missing its relationship.`)
        }
        worksheet.hyperlinks.set(
          reference,
          relationship.targetMode?.toLocaleLowerCase() === 'external'
            ? relationship.target
            : `[non-external hyperlink] ${relationship.target}`,
        )
      }
    }
    sheets.set(sheet.name, worksheet)
  }

  return {
    sheets,
    sheetNames: workbookSheets.map((sheet) => sheet.name),
    archiveEntryNames: rawArchiveEntryNames,
  }
}
