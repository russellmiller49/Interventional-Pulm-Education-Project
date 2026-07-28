import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

import type { NbibIssue, ParsedNbibRecord, RawNbibRecord } from '@/features/literature/types'

const NBIB_FIELD_PATTERN = /^([A-Z0-9]{2,4})\s*-\s?(.*)$/u

export interface NbibParserLimits {
  maxLineLength: number
  maxFieldLength: number
  maxFieldsPerRecord: number
  maxRecordLength: number
}

export const defaultNbibParserLimits: NbibParserLimits = {
  maxLineLength: 100_000,
  maxFieldLength: 2_000_000,
  maxFieldsPerRecord: 20_000,
  maxRecordLength: 5_000_000,
}

interface MutableRecord {
  tags: Record<string, string[]>
  issues: NbibIssue[]
  currentTag: string | null
  currentIndex: number
  fieldCount: number
  characterCount: number
}

function newMutableRecord(): MutableRecord {
  return {
    tags: {},
    issues: [],
    currentTag: null,
    currentIndex: -1,
    fieldCount: 0,
    characterCount: 0,
  }
}

function hasFields(record: MutableRecord) {
  return Object.keys(record.tags).length > 0
}

function finaliseRecord(record: MutableRecord, recordNumber: number): ParsedNbibRecord {
  const rawRecord: RawNbibRecord = {
    recordNumber,
    tags: record.tags,
  }
  const issues = [...record.issues]
  const pmid = record.tags.PMID?.[0]?.trim()

  if (!pmid) {
    issues.push({
      code: 'MISSING_PMID',
      message: 'The NBIB record has no PMID and was quarantined.',
      recordNumber,
      tag: 'PMID',
    })
  }

  return {
    issues,
    record: rawRecord,
  }
}

function addField(
  record: MutableRecord,
  tag: string,
  rawValue: string,
  recordNumber: number,
  limits: NbibParserLimits,
) {
  record.fieldCount += 1
  record.characterCount += rawValue.length

  if (record.fieldCount > limits.maxFieldsPerRecord) {
    record.issues.push({
      code: 'TOO_MANY_FIELDS',
      message: `Record exceeded ${limits.maxFieldsPerRecord} field occurrences.`,
      recordNumber,
      tag,
    })
    return
  }

  if (record.characterCount > limits.maxRecordLength) {
    record.issues.push({
      code: 'RECORD_TOO_LARGE',
      message: `Record exceeded ${limits.maxRecordLength} characters.`,
      recordNumber,
      tag,
    })
    return
  }

  const value =
    rawValue.length > limits.maxFieldLength ? rawValue.slice(0, limits.maxFieldLength) : rawValue

  if (value.length !== rawValue.length) {
    record.issues.push({
      code: 'FIELD_TOO_LARGE',
      message: `Field ${tag} exceeded ${limits.maxFieldLength} characters and was truncated.`,
      recordNumber,
      tag,
    })
  }

  const values = record.tags[tag] ?? []
  values.push(value)
  record.tags[tag] = values
  record.currentTag = tag
  record.currentIndex = values.length - 1
}

function appendContinuation(
  record: MutableRecord,
  continuation: string,
  recordNumber: number,
  limits: NbibParserLimits,
) {
  if (!record.currentTag || record.currentIndex < 0) {
    record.issues.push({
      code: 'MALFORMED_LINE',
      message: 'Continuation text appeared before any NBIB field.',
      recordNumber,
    })
    return
  }

  const values = record.tags[record.currentTag]
  const currentValue = values?.[record.currentIndex] ?? ''
  const nextValue = `${currentValue}\n${continuation.trim()}`
  record.characterCount += continuation.length

  if (record.characterCount > limits.maxRecordLength) {
    record.issues.push({
      code: 'RECORD_TOO_LARGE',
      message: `Record exceeded ${limits.maxRecordLength} characters.`,
      recordNumber,
      tag: record.currentTag,
    })
    return
  }

  if (nextValue.length > limits.maxFieldLength) {
    record.issues.push({
      code: 'FIELD_TOO_LARGE',
      message: `Field ${record.currentTag} exceeded ${limits.maxFieldLength} characters and was truncated.`,
      recordNumber,
      tag: record.currentTag,
    })
    values[record.currentIndex] = nextValue.slice(0, limits.maxFieldLength)
    return
  }

  values[record.currentIndex] = nextValue
}

export async function* parseNbibLines(
  lines: AsyncIterable<string> | Iterable<string>,
  limits: NbibParserLimits = defaultNbibParserLimits,
): AsyncGenerator<ParsedNbibRecord> {
  let mutable = newMutableRecord()
  let nextRecordNumber = 1
  let firstLine = true

  for await (const inputLine of lines) {
    const lineWithoutBom = firstLine ? inputLine.replace(/^\uFEFF/u, '') : inputLine
    firstLine = false
    const line =
      lineWithoutBom.length > limits.maxLineLength
        ? lineWithoutBom.slice(0, limits.maxLineLength)
        : lineWithoutBom

    if (line.length !== lineWithoutBom.length) {
      mutable.issues.push({
        code: 'LINE_TOO_LONG',
        message: `Line exceeded ${limits.maxLineLength} characters and was truncated.`,
        recordNumber: nextRecordNumber,
      })
    }

    if (!line.trim()) {
      if (hasFields(mutable)) {
        yield finaliseRecord(mutable, nextRecordNumber)
        nextRecordNumber += 1
        mutable = newMutableRecord()
      }
      continue
    }

    const fieldMatch = line.match(NBIB_FIELD_PATTERN)
    if (fieldMatch) {
      const [, tag, value] = fieldMatch

      if (tag === 'PMID' && hasFields(mutable)) {
        yield finaliseRecord(mutable, nextRecordNumber)
        nextRecordNumber += 1
        mutable = newMutableRecord()
      }

      addField(mutable, tag, value, nextRecordNumber, limits)
      continue
    }

    if (/^\s/u.test(line)) {
      appendContinuation(mutable, line, nextRecordNumber, limits)
      continue
    }

    mutable.issues.push({
      code: 'MALFORMED_LINE',
      message: 'Line did not match an NBIB tag and was not an indented continuation.',
      recordNumber: nextRecordNumber,
    })
  }

  if (hasFields(mutable)) {
    yield finaliseRecord(mutable, nextRecordNumber)
  }
}

export async function* parseNbibFile(
  filePath: string,
  limits: NbibParserLimits = defaultNbibParserLimits,
): AsyncGenerator<ParsedNbibRecord> {
  const stream = createReadStream(filePath, { encoding: 'utf8' })
  const lines = createInterface({
    input: stream,
    crlfDelay: Number.POSITIVE_INFINITY,
  })

  try {
    yield* parseNbibLines(lines, limits)
  } finally {
    lines.close()
    stream.destroy()
  }
}

export async function parseNbibText(
  text: string,
  limits: NbibParserLimits = defaultNbibParserLimits,
) {
  const records: ParsedNbibRecord[] = []

  for await (const record of parseNbibLines(text.split(/\r?\n/u), limits)) {
    records.push(record)
  }

  return records
}
