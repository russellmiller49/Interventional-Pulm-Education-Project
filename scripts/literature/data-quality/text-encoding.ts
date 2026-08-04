import { createHash } from 'node:crypto'

export const TEXT_ENCODING_REPAIR_SCHEMA_VERSION = '1.0.0'
export const TEXT_ENCODING_REPAIR_AUDIT_SHA256 =
  '838dbff4cb4c73ff12863c4a6e74b7308af9cb6112e5fe0553ffdff7b7b8bac1'
export const TEXT_ENCODING_CORRUPTION_PASSES = 3

const NON_ASCII_SPAN_PATTERN = /[^\x00-\x7F]+/gu
const MAC_ROMAN_DECODER = new TextDecoder('macintosh')
const FATAL_UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })
const UTF8_ENCODER = new TextEncoder()

interface MacRomanEncodingIndex {
  ambiguousCharacters: Set<string>
  byteByCharacter: Map<string, number>
}

function buildMacRomanEncodingIndex(): MacRomanEncodingIndex {
  const byteByCharacter = new Map<string, number>()
  const ambiguousCharacters = new Set<string>()

  for (let byte = 0; byte <= 0xff; byte += 1) {
    const character = MAC_ROMAN_DECODER.decode(Uint8Array.of(byte))
    const existing = byteByCharacter.get(character)
    if (existing !== undefined && existing !== byte) {
      ambiguousCharacters.add(character)
      continue
    }
    byteByCharacter.set(character, byte)
  }

  return { ambiguousCharacters, byteByCharacter }
}

const MAC_ROMAN_ENCODING = buildMacRomanEncodingIndex()
const MAX_MAC_ROMAN_CHARACTER_UTF8_BYTES = Math.max(
  ...Array.from(
    MAC_ROMAN_ENCODING.byteByCharacter.keys(),
    (character) => UTF8_ENCODER.encode(character).length,
  ),
)
// UTF-8 uses at most four bytes for one Unicode scalar. The first corruption pass therefore
// produces at most four MacRoman characters, and each later pass expands each such character by
// at most MAX_MAC_ROMAN_CHARACTER_UTF8_BYTES. Searching only this many code points is sufficient
// to find the three-pass image of any one source scalar, while keeping hidden-subspan detection
// linear in the containing span rather than quadratic.
const MAX_HIDDEN_REPAIR_SUBSPAN_CODE_POINTS =
  4 * MAX_MAC_ROMAN_CHARACTER_UTF8_BYTES ** (TEXT_ENCODING_CORRUPTION_PASSES - 1)

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, child]) => [key, stableJsonValue(child)]),
    )
  }
  return value
}

export function stableTextEncodingJson(value: unknown) {
  return JSON.stringify(stableJsonValue(value))
}

export function sha256TextEncodingValue(value: string | Uint8Array) {
  return sha256(value)
}

export interface TextCodePoint {
  character: string
  codePoint: string
}

export function textCodePoints(value: string): TextCodePoint[] {
  return Array.from(value, (character) => ({
    character,
    codePoint: `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
  }))
}

type ReversePassResult =
  | { ok: true; value: string }
  | {
      ok: false
      reason: 'ambiguous_macroman_character' | 'invalid_utf8_bytes' | 'unmapped_macroman_character'
    }

function reverseMacRomanUtf8Pass(value: string): ReversePassResult {
  const bytes: number[] = []
  for (const character of value) {
    if (MAC_ROMAN_ENCODING.ambiguousCharacters.has(character)) {
      return { ok: false, reason: 'ambiguous_macroman_character' }
    }
    const byte = MAC_ROMAN_ENCODING.byteByCharacter.get(character)
    if (byte === undefined) {
      return { ok: false, reason: 'unmapped_macroman_character' }
    }
    bytes.push(byte)
  }

  try {
    return { ok: true, value: FATAL_UTF8_DECODER.decode(Uint8Array.from(bytes)) }
  } catch {
    return { ok: false, reason: 'invalid_utf8_bytes' }
  }
}

export function corruptUtf8AsMacRoman(value: string, passes = TEXT_ENCODING_CORRUPTION_PASSES) {
  if (!Number.isSafeInteger(passes) || passes < 0) {
    throw new Error('MacRoman corruption pass count must be a non-negative integer.')
  }

  let result = value
  for (let pass = 0; pass < passes; pass += 1) {
    result = MAC_ROMAN_DECODER.decode(UTF8_ENCODER.encode(result))
  }
  return result
}

export type TextEncodingRefusalReason =
  | 'ambiguous_macroman_mapping'
  | 'contains_three_pass_repairable_subspan'
  | 'failed_three_pass_roundtrip'
  | 'more_than_three_reverse_passes'
  | 'partial_one_pass_corruption'
  | 'partial_two_pass_corruption'

export type TextEncodingSpanClassification =
  | {
      kind: 'clean'
      reversePasses: 0
      span: string
    }
  | {
      clean: string
      kind: 'repairable'
      reversePasses: 3
      span: string
    }
  | {
      kind: 'refused'
      reason: TextEncodingRefusalReason
      reversePasses: number
      span: string
    }

function classifyWholeTextEncodingSpan(span: string): TextEncodingSpanClassification {
  let current = span
  let threePassCandidate: string | null = null

  for (let pass = 1; pass <= TEXT_ENCODING_CORRUPTION_PASSES + 1; pass += 1) {
    const reversed = reverseMacRomanUtf8Pass(current)
    if (!reversed.ok) {
      if (reversed.reason === 'ambiguous_macroman_character') {
        return {
          kind: 'refused',
          reason: 'ambiguous_macroman_mapping',
          reversePasses: pass - 1,
          span,
        }
      }
      if (pass === 1) return { kind: 'clean', reversePasses: 0, span }
      if (pass === 2) {
        return {
          kind: 'refused',
          reason: 'partial_one_pass_corruption',
          reversePasses: 1,
          span,
        }
      }
      if (pass === 3) {
        return {
          kind: 'refused',
          reason: 'partial_two_pass_corruption',
          reversePasses: 2,
          span,
        }
      }

      if (
        threePassCandidate === null ||
        corruptUtf8AsMacRoman(threePassCandidate, TEXT_ENCODING_CORRUPTION_PASSES) !== span
      ) {
        return {
          kind: 'refused',
          reason: 'failed_three_pass_roundtrip',
          reversePasses: TEXT_ENCODING_CORRUPTION_PASSES,
          span,
        }
      }
      return {
        clean: threePassCandidate,
        kind: 'repairable',
        reversePasses: TEXT_ENCODING_CORRUPTION_PASSES,
        span,
      }
    }

    current = reversed.value
    if (pass === TEXT_ENCODING_CORRUPTION_PASSES) {
      threePassCandidate = current
      if (corruptUtf8AsMacRoman(current, TEXT_ENCODING_CORRUPTION_PASSES) !== span) {
        return {
          kind: 'refused',
          reason: 'failed_three_pass_roundtrip',
          reversePasses: TEXT_ENCODING_CORRUPTION_PASSES,
          span,
        }
      }
    }
  }

  return {
    kind: 'refused',
    reason: 'more_than_three_reverse_passes',
    reversePasses: TEXT_ENCODING_CORRUPTION_PASSES + 1,
    span,
  }
}

function containsProperThreePassRepairableSubspan(span: string) {
  const boundaries = [0]
  for (const character of span) boundaries.push(boundaries.at(-1)! + character.length)
  const codePointCount = boundaries.length - 1

  for (let start = 0; start < codePointCount; start += 1) {
    const maximumEnd = Math.min(codePointCount, start + MAX_HIDDEN_REPAIR_SUBSPAN_CODE_POINTS)
    for (let end = start + 1; end <= maximumEnd; end += 1) {
      if (start === 0 && end === codePointCount) continue
      const candidate = span.slice(boundaries[start], boundaries[end])
      if (classifyWholeTextEncodingSpan(candidate).kind === 'repairable') return true
    }
  }
  return false
}

export function classifyTextEncodingSpan(span: string): TextEncodingSpanClassification {
  if (!span || /[\x00-\x7F]/u.test(span)) {
    throw new Error('Text encoding classification requires one non-empty, non-ASCII span.')
  }

  const classification = classifyWholeTextEncodingSpan(span)
  if (classification.kind === 'clean' && containsProperThreePassRepairableSubspan(span)) {
    return {
      kind: 'refused',
      reason: 'contains_three_pass_repairable_subspan',
      reversePasses: 0,
      span,
    }
  }
  return classification
}

export interface TextEncodingReplacement {
  afterCodePoints: TextCodePoint[]
  beforeCodePoints: TextCodePoint[]
  clean: string
  corrupt: string
  end: number
  start: number
}

export interface TextEncodingRefusal {
  codePoints: TextCodePoint[]
  end: number
  reason: TextEncodingRefusalReason
  reversePasses: number
  span: string
  start: number
}

export interface TextEncodingScanResult {
  candidateText: string
  refusals: TextEncodingRefusal[]
  repairedText: string | null
  replacements: TextEncodingReplacement[]
  status: 'clean' | 'refused' | 'repairable'
}

export function scanTextEncoding(value: string): TextEncodingScanResult {
  const replacements: TextEncodingReplacement[] = []
  const refusals: TextEncodingRefusal[] = []
  const pieces: string[] = []
  let cursor = 0

  for (const match of value.matchAll(NON_ASCII_SPAN_PATTERN)) {
    const start = match.index
    const corrupt = match[0]
    const end = start + corrupt.length
    const classification = classifyTextEncodingSpan(corrupt)
    pieces.push(value.slice(cursor, start))

    if (classification.kind === 'repairable') {
      pieces.push(classification.clean)
      replacements.push({
        afterCodePoints: textCodePoints(classification.clean),
        beforeCodePoints: textCodePoints(corrupt),
        clean: classification.clean,
        corrupt,
        end,
        start,
      })
    } else {
      pieces.push(corrupt)
      if (classification.kind === 'refused') {
        refusals.push({
          codePoints: textCodePoints(corrupt),
          end,
          reason: classification.reason,
          reversePasses: classification.reversePasses,
          span: corrupt,
          start,
        })
      }
    }

    cursor = end
  }
  pieces.push(value.slice(cursor))
  const candidateText = pieces.join('')

  if (refusals.length > 0) {
    return {
      candidateText,
      refusals,
      repairedText: null,
      replacements,
      status: 'refused',
    }
  }
  if (replacements.length > 0) {
    return {
      candidateText,
      refusals,
      repairedText: candidateText,
      replacements,
      status: 'repairable',
    }
  }
  return { candidateText: value, refusals, repairedText: value, replacements, status: 'clean' }
}

export type TextEncodingCandidateField = 'abstract' | 'title'

export interface TextEncodingArticleRow {
  abstract: string | null
  pmid: string
  title: string
  updated_at: string
}

export interface GoldSetDevelopmentTextEncodingScope {
  batchId: string
  batchName: 'gold-set-v1'
  datasetSplit: 'development'
  pmids: string[]
}

export interface TextEncodingAuditCell {
  afterExcerpt: string | null
  afterSha256: string | null
  beforeExcerpt: string
  beforeSha256: string
  field: TextEncodingCandidateField
  pmid: string
  refusalCount: number
  refusals: TextEncodingRefusal[]
  replacementCount: number
  replacements: TextEncodingReplacement[]
  updatedAt: string
}

export interface TextEncodingAuditReport {
  candidateSha256: string
  cells: TextEncodingAuditCell[]
  counts: {
    candidateCells: number
    candidateRows: number
    cellsScanned: number
    refusedCells: number
    refusedSpans: number
    replacementSpans: number
    rowsScanned: number
  }
  provenance: {
    repairAuditSha256: string
  }
  schemaVersion: string
  scope: {
    batchId: string
    batchName: 'gold-set-v1'
    datasetSplit: 'development'
    pmidCount: number
    pmidsSha256: string
  }
  sourceSha256: string
}

export interface TextEncodingRepairFieldPlan {
  after: string
  afterSha256: string
  before: string
  beforeSha256: string
  field: TextEncodingCandidateField
  replacementCount: number
}

export interface TextEncodingRepairRowPlan {
  expectedUpdatedAt: string
  fields: TextEncodingRepairFieldPlan[]
  pmid: string
}

function comparePmids(left: string, right: string) {
  const leftPmid = BigInt(left)
  const rightPmid = BigInt(right)
  return leftPmid < rightPmid ? -1 : leftPmid > rightPmid ? 1 : 0
}

function excerptAround(value: string, index: number, maximumLength = 320) {
  if (value.length <= maximumLength) return value
  const half = Math.floor(maximumLength / 2)
  let start = Math.max(0, index - half)
  let end = Math.min(value.length, start + maximumLength)
  start = Math.max(0, end - maximumLength)

  if (start > 0 && /[\uDC00-\uDFFF]/u.test(value[start])) start += 1
  if (end < value.length && /[\uD800-\uDBFF]/u.test(value[end - 1])) end -= 1
  return `${start > 0 ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`
}

function sortedUniquePmids(pmids: readonly string[], label: string) {
  if (pmids.some((pmid) => !/^\d{1,12}$/u.test(pmid))) {
    throw new Error(`${label} contains an invalid PMID.`)
  }
  const unique = new Set(pmids)
  if (unique.size !== pmids.length) throw new Error(`${label} contains duplicate PMIDs.`)
  return [...unique].sort(comparePmids)
}

function validateAndSortScopedRows(
  rows: readonly TextEncodingArticleRow[],
  scope: GoldSetDevelopmentTextEncodingScope,
) {
  if (scope.batchName !== 'gold-set-v1' || scope.datasetSplit !== 'development') {
    throw new Error('Text encoding audits are restricted to the gold-set-v1 development split.')
  }
  const expectedPmids = sortedUniquePmids(scope.pmids, 'The development scope')
  const rowPmids = sortedUniquePmids(
    rows.map((row) => row.pmid),
    'The article query',
  )
  if (
    expectedPmids.length !== rowPmids.length ||
    expectedPmids.some((pmid, index) => pmid !== rowPmids[index])
  ) {
    throw new Error('The article query does not exactly match the gold-set-v1 development scope.')
  }
  return [...rows].sort((left, right) => comparePmids(left.pmid, right.pmid))
}

function scanArticleFields(row: TextEncodingArticleRow) {
  const fields: Array<{ field: TextEncodingCandidateField; value: string }> = [
    { field: 'title', value: row.title },
  ]
  if (row.abstract !== null) fields.push({ field: 'abstract', value: row.abstract })
  return fields.map(({ field, value }) => ({ field, scan: scanTextEncoding(value), value }))
}

export function buildTextEncodingAudit(
  rows: readonly TextEncodingArticleRow[],
  scope: GoldSetDevelopmentTextEncodingScope,
): TextEncodingAuditReport {
  const sortedRows = validateAndSortScopedRows(rows, scope)
  const cells: TextEncodingAuditCell[] = []
  let cellsScanned = 0

  for (const row of sortedRows) {
    for (const { field, scan, value } of scanArticleFields(row)) {
      cellsScanned += 1
      if (scan.replacements.length === 0 && scan.refusals.length === 0) continue
      const firstIndex = scan.replacements[0]?.start ?? scan.refusals[0]?.start ?? 0
      cells.push({
        afterExcerpt:
          scan.repairedText === null ? null : excerptAround(scan.repairedText, firstIndex),
        afterSha256: scan.repairedText === null ? null : sha256(scan.repairedText),
        beforeExcerpt: excerptAround(value, firstIndex),
        beforeSha256: sha256(value),
        field,
        pmid: row.pmid,
        refusalCount: scan.refusals.length,
        refusals: scan.refusals,
        replacementCount: scan.replacements.length,
        replacements: scan.replacements,
        updatedAt: row.updated_at,
      })
    }
  }

  const sourcePayload = {
    articles: sortedRows.map((row) => ({
      abstract: row.abstract,
      pmid: row.pmid,
      title: row.title,
    })),
    scope: {
      batchId: scope.batchId,
      batchName: scope.batchName,
      datasetSplit: scope.datasetSplit,
      pmids: sortedUniquePmids(scope.pmids, 'The development scope'),
    },
  }
  const candidatePayload = cells.map((cell) => ({
    afterSha256: cell.afterSha256,
    beforeSha256: cell.beforeSha256,
    field: cell.field,
    pmid: cell.pmid,
    refusals: cell.refusals,
    replacements: cell.replacements,
    updatedAt: cell.updatedAt,
  }))
  const candidateRows = new Set(
    cells.filter((cell) => cell.replacementCount > 0).map((cell) => cell.pmid),
  )

  return {
    candidateSha256: sha256(stableTextEncodingJson(candidatePayload)),
    cells,
    counts: {
      candidateCells: cells.filter((cell) => cell.replacementCount > 0).length,
      candidateRows: candidateRows.size,
      cellsScanned,
      refusedCells: cells.filter((cell) => cell.refusalCount > 0).length,
      refusedSpans: cells.reduce((sum, cell) => sum + cell.refusalCount, 0),
      replacementSpans: cells.reduce((sum, cell) => sum + cell.replacementCount, 0),
      rowsScanned: sortedRows.length,
    },
    provenance: { repairAuditSha256: TEXT_ENCODING_REPAIR_AUDIT_SHA256 },
    schemaVersion: TEXT_ENCODING_REPAIR_SCHEMA_VERSION,
    scope: {
      batchId: scope.batchId,
      batchName: scope.batchName,
      datasetSplit: scope.datasetSplit,
      pmidCount: scope.pmids.length,
      pmidsSha256: sha256(
        `${sortedUniquePmids(scope.pmids, 'The development scope').join('\n')}\n`,
      ),
    },
    sourceSha256: sha256(stableTextEncodingJson(sourcePayload)),
  }
}

export function buildTextEncodingRepairPlans(
  rows: readonly TextEncodingArticleRow[],
  scope: GoldSetDevelopmentTextEncodingScope,
): TextEncodingRepairRowPlan[] {
  const sortedRows = validateAndSortScopedRows(rows, scope)
  const plans: TextEncodingRepairRowPlan[] = []

  for (const row of sortedRows) {
    const fields: TextEncodingRepairFieldPlan[] = []
    for (const { field, scan, value } of scanArticleFields(row)) {
      if (scan.refusals.length > 0) {
        throw new Error(
          `Refusing text repair for PMID ${row.pmid} ${field}: ${scan.refusals
            .map((refusal) => refusal.reason)
            .join(', ')}.`,
        )
      }
      if (scan.replacements.length === 0 || scan.repairedText === null) continue
      fields.push({
        after: scan.repairedText,
        afterSha256: sha256(scan.repairedText),
        before: value,
        beforeSha256: sha256(value),
        field,
        replacementCount: scan.replacements.length,
      })
    }
    if (fields.length > 0) {
      plans.push({ expectedUpdatedAt: row.updated_at, fields, pmid: row.pmid })
    }
  }

  return plans
}
