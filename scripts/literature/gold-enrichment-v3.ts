import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { link, lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

import { parseCsvRows } from '@/features/literature/gold-set/export'

import {
  CANONICAL_EXTERNAL_QA_FINDINGS_SHA256,
  EXTERNAL_QA_TIERS,
  parseExternalQaFindingsCsv,
  type ExternalQaFinding,
} from './data-quality/external-qa'

const execFileAsync = promisify(execFile)

export const GOLD_ENRICHMENT_V3_WORKFLOW_ID = 'gold-set-v1-enrichment-v3' as const
export const GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION = '3.0.0' as const
export const GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION = '3.0.0' as const
export const GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION = '3.0.0' as const
export const GOLD_ENRICHMENT_V3_TAXONOMY_VERSION = '2.0.0' as const
export const GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION = '2.0.0' as const
export const GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION = '2.0.0' as const

export const GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256 =
  'd2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64' as const
export const GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256 =
  '38a0316ab5a3161bdf502a8e0c8b9c69753386862c858336f4d3e912a6ad21ef' as const
export const GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256 =
  '90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e' as const
export const GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_SHA256 =
  '87a100917549586af93c46ace872caaf460df27154b9f5e8cd1ed5d2e8cc48ff' as const
export const GOLD_ENRICHMENT_V3_NO_ABSTRACT_RECEIPT_SHA256 =
  '8c7c8fdb58cc516576aa8516741187556ce80661e5824dd00ed5198b5a52cd84' as const
export const GOLD_ENRICHMENT_V3_LIMITED_ABSTRACT_RECEIPT_SHA256 =
  '3cdb2c4fdaea2eb05f9c0288269c8bb3c0693a4e6b367886a7ae3e6e37997521' as const
export const GOLD_ENRICHMENT_V3_TAXONOMY_AUDIT_SHA256 =
  '289fb2d862e55438db5bf51bac57ba44916c28bf919a2c6f316cee8785b76f18' as const
export const GOLD_ENRICHMENT_V3_UPGRADE_PLAN_SHA256 =
  'aa5667614b284f005346d6c79c992235936b4d78e056e7655692d6c95ca9ea28' as const
export const GOLD_ENRICHMENT_V3_QA_REVIEW_1_SHA256 =
  '898159d8c7adf1e0296927d41c42fb8398de40d31823b9584866fb0addceba8d' as const
export const GOLD_ENRICHMENT_V3_QA_REVIEW_2_SHA256 =
  '6f88c2705fb92f84fb43a24d09c9579995ae1fa92f58be0a4cb721feabb43f74' as const

export const GOLD_ENRICHMENT_V3_CONFIG_CONTRACT = Object.freeze({
  'config/literature/enrichment-labels.v2.json':
    '97d33c581b7d72b498ab33b62a2df7d042bf9c8d262d23d87c1c26347d1ec4f9',
  'config/literature/enrichment-taxonomy-adoption.v2.json':
    '7cc3a15f59cbf8f58fc2cc0ce3c7ed1fcd6e2f2d40646b14118ba2648ac53237',
  'config/literature/gold-set-labels.v1.json':
    '554cf8b0b39d5f9be0f89566939c6336e040605dba05b0ddfa0f41c7badd7ac4',
  'config/literature/taxonomy.v1.json':
    '70bcd7aea6d9a135368a05a34bc10643bef1e42ff153a734361eaf94a86eb441',
  'config/literature/taxonomy.v2.json':
    '078e6fca1abcf074846d7acde9a2554d1751039d31608c40a147e5ee88697c7b',
})

// Kept pure and intentionally duplicated from the PR #70 source contract. Importing the
// database-backed exporter would add a database execution path to this file-only workflow.
export const GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS = [
  'batch_id',
  'batch_name',
  'dataset_split',
  'gold_set_item_id',
  'display_order',
  'master_row_id',
  'screening_batch',
  'source_row_id',
  'pmid',
  'title',
  'abstract',
  'authors_json',
  'journal',
  'journal_abbreviation',
  'publication_year',
  'publication_types_json',
  'mesh_terms_json',
  'author_keywords_json',
  'languages_json',
  'no_abstract',
  'protected_procedural_cue',
  'first_pass_label',
  'first_pass_confidence',
  'first_pass_requires_human_review',
  'first_pass_rationale',
  'second_pass_label',
  'second_pass_confidence',
  'second_pass_requires_human_review',
  'second_pass_rationale',
  'two_pass_status',
  'provisional_label',
  'triage_lane',
  'triage_reason',
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
  'enrichment_status',
  'database_import_ready',
] as const

export const GOLD_ENRICHMENT_V3_PHYSICIAN_HASH_COLUMNS = [
  'master_row_id',
  'pmid',
  'physician_final_label',
  'physician_final_confidence',
  'physician_accept_or_modify',
  'physician_notes',
  'physician_reviewed',
  'decision_provenance',
  'is_blinded',
  'relevance_review_complete',
] as const

export const GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS = [
  'master_row_id',
  'pmid',
  'title',
  'physician_final_label',
  'metadata_sufficiency',
  'source_group',
  'full_text_status',
  'full_text_used',
  'full_text_filename',
  'full_text_sha256',
  'partial_text_available',
  'partial_text_filename',
  'partial_text_sha256',
  'partial_text_note',
  'relevance_concern',
  'relevance_concern_note',
  'topic_ids',
  'technology_tags',
  'clinical_purposes',
  'disease_tags',
  'study_design',
  'publication_status',
  'enrichment_confidence',
] as const

export const GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS = [
  'master_row_id',
  'pmid',
  'title',
  'abstract',
  'journal',
  'journal_abbreviation',
  'publication_year',
  'publication_types_json',
  'mesh_terms_json',
  'author_keywords_json',
  'languages_json',
  'no_abstract',
  'physician_final_label',
  'physician_final_confidence',
  'metadata_sufficiency_constraint',
  'full_text_evidence_status',
  'expected_full_text_filename',
  'expected_full_text_sha256',
] as const

export const GOLD_ENRICHMENT_V3_PACKET_COLUMNS = [
  'workflow_id',
  'workflow_schema_version',
  'prompt_template_version',
  'result_schema_version',
  'taxonomy_version',
  'label_schema_version',
  'enrichment_schema_version',
  'packet_id',
  'packet_family',
  'packet_ordinal',
  'expected_output_filename',
  'source_projection_sha256',
  'source_row_sha256',
  ...GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
] as const

export const GOLD_ENRICHMENT_V3_PACKET_FAMILIES = [
  'included_metadata_only',
  'included_full_text',
  'excluded_metadata_sufficiency',
] as const

export type GoldEnrichmentV3PacketFamily = (typeof GOLD_ENRICHMENT_V3_PACKET_FAMILIES)[number]
export type GoldEnrichmentV3CanonicalColumn =
  (typeof GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS)[number]
export type GoldEnrichmentV3CanonicalRow = Record<GoldEnrichmentV3CanonicalColumn, string> & {
  csvRecordNumber: number
}
type FullTextAuditColumn = (typeof GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS)[number]
export type GoldEnrichmentV3FullTextAuditRow = Record<FullTextAuditColumn, string> & {
  csvRecordNumber: number
}

export type GoldEnrichmentV3EvidenceStatus =
  | 'matched_complete'
  | 'preview_only'
  | 'missing'
  | 'ambiguous'
  | 'unreadable'
  | 'mismatch'

export interface GoldEnrichmentV3FullTextRegistryRow {
  master_row_id: string
  pmid: string
  title: string
  physician_final_label: string
  physician_final_confidence: string
  pubmed_abstract_status: 'no_abstract' | 'abstract_present'
  metadata_sufficiency_constraint: string
  expected_filename: string
  actual_filename: string
  file_sha256: string
  file_bytes: number | null
  evidence_status: GoldEnrichmentV3EvidenceStatus
  full_text_used: false
  categorization_from_full_text: false
  source_reconciliation_receipt: string
  full_text_availability_note: string
}

export interface GoldEnrichmentV3PacketRow {
  source: Record<(typeof GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS)[number], string>
  sourceRowSha256: string
}

export interface GoldEnrichmentV3PacketReceipt {
  workflowId: typeof GOLD_ENRICHMENT_V3_WORKFLOW_ID
  workflowSchemaVersion: typeof GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION
  promptTemplateVersion: typeof GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION
  resultSchemaVersion: typeof GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION
  taxonomyVersion: typeof GOLD_ENRICHMENT_V3_TAXONOMY_VERSION
  labelSchemaVersion: typeof GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION
  enrichmentSchemaVersion: typeof GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION
  packetId: string
  packetFamily: GoldEnrichmentV3PacketFamily
  packetOrdinal: number
  rowCount: number
  orderedKeys: Array<{ masterRowId: string; pmid: string; sourceRowSha256: string }>
  sourceProjectionSha256: string
  packetCsv: { path: string; bytes: number; sha256: string }
  promptTemplate: { path: string; bytes: number; sha256: string }
  expectedOutputFilename: string
  expectedResultSchema: { path: string; bytes: number; sha256: string; version: '3.0.0' }
}

export interface GoldEnrichmentV3PreparedPacket {
  csv: string
  csvPath: string
  receipt: GoldEnrichmentV3PacketReceipt
  receiptPath: string
}

export interface GoldEnrichmentV3RepositoryState {
  branch: string
  commit: string
  originMainSha: string
  mergeBaseSha: string
  trackedStatus: string
}

export interface PrepareGoldEnrichmentV3Options {
  sourcePath: string
  sourceReceiptPath: string
  fullTextAuditPath: string
  noAbstractReceiptPath: string
  limitedAbstractReceiptPath: string
  fullTextRoots: string[]
  qaFindingsPath: string
  qaReview1Path: string
  qaReview2Path: string
  taxonomyAuditPath: string
  upgradePlanPath: string
  outputDirectory: string
  workspaceRoot?: string
  repositoryState?: GoldEnrichmentV3RepositoryState
  executionTime?: string
}

export interface GoldEnrichmentV3ArtifactIdentity {
  path: string
  bytes: number
  sha256: string
  publication: 'created' | 'verified_existing'
}

export interface PrepareGoldEnrichmentV3Result {
  outputDirectory: string
  artifacts: GoldEnrichmentV3ArtifactIdentity[]
  canonicalManifest: GoldEnrichmentV3ArtifactIdentity
  executionReceipt: GoldEnrichmentV3ArtifactIdentity
  packets: GoldEnrichmentV3PreparedPacket[]
  runDefinition: GoldEnrichmentV3ArtifactIdentity
  fullTextRegistry: GoldEnrichmentV3ArtifactIdentity
}

const EXPECTED_SOURCE_ROWS = 630
const EXPECTED_RELEVANCE_COUNTS = Object.freeze({
  include_core: 283,
  include_adjacent: 75,
  exclude: 272,
  uncertain: 0,
})
const EXPECTED_FULL_TEXT_COUNTS = Object.freeze({
  matched_complete: 50,
  preview_only: 1,
  missing: 5,
  ambiguous: 0,
  unreadable: 0,
  mismatch: 0,
})
const EXPECTED_PACKET_ROWS = Object.freeze({
  included_metadata_only: 308,
  included_full_text: 50,
  excluded_metadata_sufficiency: 272,
})
const DEFAULT_PACKET_SIZES = Object.freeze({
  included_metadata_only: 50,
  included_full_text: 5,
  excluded_metadata_sufficiency: 100,
})
const POSITIVE_DECIMAL = /^[1-9]\d*$/u
const FORBIDDEN_INPUT_PATH_TOKEN =
  /(?:^|[\\/_. -])(?:test|testing|all|held[ _-]?out|holdout)(?=$|[\\/_. -])/iu
const RELEVANCE_LABELS = new Set(['include_core', 'include_adjacent', 'exclude', 'uncertain'])
const CONFIDENCE_LABELS = new Set(['high', 'moderate', 'low'])
const TRUE_VALUES = new Set(['true', 'True'])
const FALSE_VALUES = new Set(['false', 'False'])

const PROMPT_FILES: Record<GoldEnrichmentV3PacketFamily, string> = {
  included_metadata_only: 'included-metadata-only.md',
  included_full_text: 'included-full-text.md',
  excluded_metadata_sufficiency: 'excluded-metadata-sufficiency.md',
}
const RESULT_SCHEMA_FILES: Record<GoldEnrichmentV3PacketFamily, string> = {
  included_metadata_only: 'included-metadata-only-result.schema.json',
  included_full_text: 'included-full-text-result.schema.json',
  excluded_metadata_sufficiency: 'excluded-metadata-sufficiency-result.schema.json',
}

export function sha256Bytes(bytes: Uint8Array | string): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
        .map(([key, child]) => [key, stableJsonValue(child)]),
    )
  }
  return value
}

export function serializeGoldEnrichmentV3Json(value: unknown): string {
  return `${JSON.stringify(stableJsonValue(value), null, 2)}\n`
}

function spreadsheetSafe(value: string): string {
  return /^[=+\-@]/u.test(value) ? `'${value}` : value
}

export function goldEnrichmentV3CsvCell(value: unknown): string {
  const normalized = spreadsheetSafe(String(value ?? ''))
  return `"${normalized.replaceAll('"', '""')}"`
}

export function serializeGoldEnrichmentV3Csv<Column extends string>(
  columns: readonly Column[],
  rows: readonly Record<Column, unknown>[],
): string {
  const lines = [columns.map(goldEnrichmentV3CsvCell).join(',')]
  rows.forEach((row) => {
    lines.push(columns.map((column) => goldEnrichmentV3CsvCell(row[column])).join(','))
  })
  return `${lines.join('\r\n')}\r\n`
}

function exactCsvRecords<Column extends string>(
  input: string,
  label: string,
  columns: readonly Column[],
): Array<Record<Column, string> & { csvRecordNumber: number }> {
  const parsed = parseCsvRows(input.startsWith('\uFEFF') ? input.slice(1) : input)
  if (parsed.length === 0) throw new Error(`${label} is empty.`)
  const header = parsed[0]
  if (header.length !== columns.length || header.some((value, index) => value !== columns[index])) {
    throw new Error(`${label} header must exactly match its ${columns.length}-column contract.`)
  }
  return parsed.slice(1).map((values, index) => {
    if (values.length !== columns.length) {
      throw new Error(
        `${label} CSV record ${index + 2} has ${values.length} columns; expected ${columns.length}.`,
      )
    }
    return {
      ...(Object.fromEntries(
        columns.map((column, columnIndex) => [column, values[columnIndex]]),
      ) as Record<Column, string>),
      csvRecordNumber: index + 2,
    }
  })
}

function countValues(values: Iterable<string>): Record<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries(
    [...counts].sort(([left], [right]) => left.localeCompare(right, 'en-US')),
  )
}

function assertExactCounts(
  actual: Record<string, number>,
  expected: Record<string, number>,
  label: string,
) {
  for (const key of new Set([...Object.keys(actual), ...Object.keys(expected)])) {
    if ((actual[key] ?? 0) !== (expected[key] ?? 0)) {
      throw new Error(
        `${label} counts do not match the contract: expected ${serializeGoldEnrichmentV3Json(
          expected,
        ).trim()}, received ${serializeGoldEnrichmentV3Json(actual).trim()}.`,
      )
    }
  }
}

function requirePositiveDecimal(value: string, label: string, recordNumber: number) {
  if (!POSITIVE_DECIMAL.test(value)) {
    throw new Error(`${label} at CSV record ${recordNumber} must be a positive decimal identifier.`)
  }
}

function requireBoolean(value: string, label: string, recordNumber: number): boolean {
  if (TRUE_VALUES.has(value)) return true
  if (FALSE_VALUES.has(value)) return false
  throw new Error(`${label} at CSV record ${recordNumber} must be a strict boolean.`)
}

export function goldEnrichmentV3PhysicianFieldSha256(
  rows: readonly GoldEnrichmentV3CanonicalRow[],
): string {
  const ordered = [...rows].sort(
    (left, right) => Number(left.master_row_id) - Number(right.master_row_id),
  )
  return sha256Bytes(
    `${JSON.stringify({
      columns: GOLD_ENRICHMENT_V3_PHYSICIAN_HASH_COLUMNS,
      rows: ordered.map((row) =>
        GOLD_ENRICHMENT_V3_PHYSICIAN_HASH_COLUMNS.map((column) => row[column]),
      ),
    })}\n`,
  )
}

export function parseGoldEnrichmentV3CanonicalSource(
  input: string,
): GoldEnrichmentV3CanonicalRow[] {
  const rows = exactCsvRecords(
    input,
    'Canonical PR #70 development source',
    GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_COLUMNS,
  )
  if (rows.length !== EXPECTED_SOURCE_ROWS) {
    throw new Error(`Canonical source must contain exactly ${EXPECTED_SOURCE_ROWS} rows.`)
  }
  const masterRowIds = new Set<string>()
  const pmids = new Set<string>()
  rows.forEach((row) => {
    requirePositiveDecimal(row.master_row_id, 'master_row_id', row.csvRecordNumber)
    requirePositiveDecimal(row.pmid, 'PMID', row.csvRecordNumber)
    if (row.batch_name !== 'gold-set-v1' || row.dataset_split !== 'development') {
      throw new Error(`Canonical source CSV record ${row.csvRecordNumber} is not development-only.`)
    }
    if (masterRowIds.has(row.master_row_id) || pmids.has(row.pmid)) {
      throw new Error(
        `Canonical source contains a duplicate identity at record ${row.csvRecordNumber}.`,
      )
    }
    masterRowIds.add(row.master_row_id)
    pmids.add(row.pmid)
    if (!RELEVANCE_LABELS.has(row.physician_final_label)) {
      throw new Error(
        `Canonical source has an invalid physician label at record ${row.csvRecordNumber}.`,
      )
    }
    if (!CONFIDENCE_LABELS.has(row.physician_final_confidence)) {
      throw new Error(
        `Canonical source has an invalid physician confidence at record ${row.csvRecordNumber}.`,
      )
    }
    if (requireBoolean(row.is_blinded, 'is_blinded', row.csvRecordNumber)) {
      throw new Error(`Canonical development record ${row.csvRecordNumber} is still blinded.`)
    }
    if (
      !requireBoolean(
        row.relevance_review_complete,
        'relevance_review_complete',
        row.csvRecordNumber,
      )
    ) {
      throw new Error(
        `Canonical record ${row.csvRecordNumber} lacks a final physician relevance review.`,
      )
    }
  })
  assertExactCounts(
    countValues(rows.map((row) => row.physician_final_label)),
    EXPECTED_RELEVANCE_COUNTS,
    'Physician relevance',
  )
  const physicianHash = goldEnrichmentV3PhysicianFieldSha256(rows)
  if (physicianHash !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256) {
    throw new Error(
      `Physician-field checksum mismatch: expected ${GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256}, received ${physicianHash}.`,
    )
  }
  return rows
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return value as Record<string, unknown>
}

export function validateGoldEnrichmentV3CanonicalReceipt(input: string, sourceBytes: number) {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('Canonical receipt must be valid JSON.')
  }
  const receipt = requireObject(parsed, 'Canonical receipt')
  const batch = requireObject(receipt.batch, 'Canonical receipt batch')
  const output = requireObject(receipt.output, 'Canonical receipt output')
  const physician = requireObject(
    receipt.physicianFieldIntegrity,
    'Canonical receipt physicianFieldIntegrity',
  )
  const safety = requireObject(receipt.safety, 'Canonical receipt safety')
  if (
    batch.name !== 'gold-set-v1' ||
    batch.datasetSplit !== 'development' ||
    batch.rows !== EXPECTED_SOURCE_ROWS
  ) {
    throw new Error('Canonical receipt does not bind exactly 630 development rows.')
  }
  if (
    output.rows !== EXPECTED_SOURCE_ROWS ||
    output.bytes !== sourceBytes ||
    output.sha256 !== GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256
  ) {
    throw new Error('Canonical receipt output identity does not match the canonical source.')
  }
  if (
    physician.expectedSha256 !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256 ||
    physician.inputSha256 !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256 ||
    physician.outputSha256 !== GOLD_ENRICHMENT_V3_PHYSICIAN_FIELD_SHA256 ||
    physician.unchanged !== true
  ) {
    throw new Error('Canonical receipt does not preserve the physician-field contract.')
  }
  if (
    safety.developmentOnly !== true ||
    safety.heldOutTestAccessed !== false ||
    safety.physicianDecisionsChanged !== false ||
    !Array.isArray(safety.databaseMutationOperations) ||
    safety.databaseMutationOperations.length !== 0 ||
    safety.mutationPlan !== null
  ) {
    throw new Error('Canonical receipt safety assertions are incomplete.')
  }
  return receipt
}

export function parseGoldEnrichmentV3FullTextAudit(
  input: string,
): GoldEnrichmentV3FullTextAuditRow[] {
  const rows = exactCsvRecords(
    input,
    'Full-text evidence audit',
    GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_COLUMNS,
  )
  if (rows.length !== 56) throw new Error('Full-text evidence audit must contain exactly 56 rows.')
  const masterRowIds = new Set<string>()
  const pmids = new Set<string>()
  rows.forEach((row) => {
    requirePositiveDecimal(row.master_row_id, 'Full-text master_row_id', row.csvRecordNumber)
    requirePositiveDecimal(row.pmid, 'Full-text PMID', row.csvRecordNumber)
    if (masterRowIds.has(row.master_row_id) || pmids.has(row.pmid)) {
      throw new Error(
        `Full-text audit contains a duplicate identity at record ${row.csvRecordNumber}.`,
      )
    }
    masterRowIds.add(row.master_row_id)
    pmids.add(row.pmid)
    if (!['matched_complete', 'preview_only', 'missing'].includes(row.full_text_status)) {
      throw new Error(`Unsupported full-text status at record ${row.csvRecordNumber}.`)
    }
    const used = requireBoolean(row.full_text_used, 'full_text_used', row.csvRecordNumber)
    if ((row.full_text_status === 'matched_complete') !== used) {
      throw new Error(`Full-text usage/status mismatch at record ${row.csvRecordNumber}.`)
    }
  })
  assertExactCounts(
    countValues(rows.map((row) => row.full_text_status)),
    { matched_complete: 50, preview_only: 1, missing: 5 },
    'Full-text evidence',
  )
  return rows
}

export function parseGoldEnrichmentV3UpgradePlan(input: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('Taxonomy-v2 upgrade plan must be valid JSON.')
  }
  const root = requireObject(parsed, 'Taxonomy-v2 upgrade plan')
  if (root.planVersion !== '2.0.0' || !Array.isArray(root.rows) || root.rows.length !== 133) {
    throw new Error('Taxonomy-v2 upgrade plan must contain the 133 candidate-only v2 rows.')
  }
  const seen = new Set<string>()
  root.rows.forEach((value, index) => {
    const row = requireObject(value, `Taxonomy-v2 upgrade row ${index + 1}`)
    if (
      typeof row.masterRowId !== 'string' ||
      typeof row.pmid !== 'string' ||
      !POSITIVE_DECIMAL.test(row.masterRowId) ||
      !POSITIVE_DECIMAL.test(row.pmid) ||
      row.physicianAdjudication !== true ||
      row.finalChangeDeterministic !== false
    ) {
      throw new Error(`Taxonomy-v2 upgrade row ${index + 1} is not candidate-only.`)
    }
    const key = `${row.masterRowId}:${row.pmid}`
    if (seen.has(key)) throw new Error(`Taxonomy-v2 upgrade plan duplicates ${key}.`)
    seen.add(key)
  })
  const safety = requireObject(root.safety, 'Taxonomy-v2 upgrade plan safety')
  if (
    safety.developmentOnly !== true ||
    safety.containsFinalChangedValues !== false ||
    safety.relevanceModification !== false ||
    safety.testIdentitiesIncluded !== false ||
    !Array.isArray(safety.databaseOperations) ||
    safety.databaseOperations.length !== 0 ||
    !Array.isArray(safety.importOperations) ||
    safety.importOperations.length !== 0
  ) {
    throw new Error('Taxonomy-v2 upgrade plan safety assertions are incomplete.')
  }
  return root
}

export function assertGoldEnrichmentV3QaContract(findings: readonly ExternalQaFinding[]) {
  if (findings.length !== 166) throw new Error('External QA must contain exactly 166 findings.')
  const byTier = countValues(findings.map((finding) => finding.review_tier))
  assertExactCounts(
    byTier,
    { direct_targeted: 54, rule_based_consistency: 104, global_data_quality: 8 },
    'External-QA tier',
  )
  const directPmids = new Set(
    findings
      .filter((finding) => finding.review_tier === EXTERNAL_QA_TIERS[0])
      .map((finding) => finding.pmid),
  )
  if (directPmids.size !== 44) throw new Error('External QA must target exactly 44 direct PMIDs.')
}

interface BoundFile {
  bytes: Uint8Array
  size: number
  sha256: string
  text?: string
}

async function readBoundRegularFile(
  inputPath: string,
  label: string,
  utf8: boolean,
): Promise<BoundFile> {
  const metadata = await lstat(inputPath)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink regular file.`)
  }
  assertDevelopmentSafeInputPath(await realpath(inputPath), `${label} resolved path`)
  const bytes = await readFile(inputPath)
  const result: BoundFile = { bytes, size: bytes.byteLength, sha256: sha256Bytes(bytes) }
  if (utf8) {
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error(`${label} is not valid UTF-8.`)
    }
    if (Buffer.compare(Buffer.from(text, 'utf8'), bytes) !== 0) {
      throw new Error(`${label} is not byte-stable UTF-8.`)
    }
    result.text = text
  }
  return result
}

function assertHash(file: BoundFile, expected: string, label: string) {
  if (file.sha256 !== expected) {
    throw new Error(`${label} checksum mismatch: expected ${expected}, received ${file.sha256}.`)
  }
}

function assertDevelopmentSafeInputPath(inputPath: string, label: string) {
  if (!path.isAbsolute(inputPath)) throw new Error(`${label} must be an absolute path.`)
  if (FORBIDDEN_INPUT_PATH_TOKEN.test(inputPath)) {
    throw new Error(`${label} has held-out/test/all semantics and is forbidden.`)
  }
}

async function readJsonReceipt(inputPath: string, label: string, expectedSha256: string) {
  assertDevelopmentSafeInputPath(inputPath, label)
  const file = await readBoundRegularFile(inputPath, label, true)
  assertHash(file, expectedSha256, label)
  try {
    JSON.parse(file.text ?? '')
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }
  return file
}

function portableInputPath(inputPath: string, workspaceRoot: string): string {
  const relative = path.relative(workspaceRoot, inputPath)
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative.split(path.sep).join('/')
    : inputPath
}

async function findEvidenceFile(
  filename: string,
  roots: readonly string[],
): Promise<{ matches: Array<{ path: string; bytes: Uint8Array; sha256: string }> }> {
  const matches: Array<{ path: string; bytes: Uint8Array; sha256: string }> = []
  for (const root of roots) {
    const candidate = path.join(root, filename)
    try {
      const metadata = await lstat(candidate)
      if (!metadata.isFile() || metadata.isSymbolicLink()) continue
      const bytes = await readFile(candidate)
      matches.push({ path: candidate, bytes, sha256: sha256Bytes(bytes) })
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return { matches }
}

export async function buildGoldEnrichmentV3FullTextRegistry(
  sourceRows: readonly GoldEnrichmentV3CanonicalRow[],
  auditRows: readonly GoldEnrichmentV3FullTextAuditRow[],
  fullTextRoots: readonly string[],
): Promise<GoldEnrichmentV3FullTextRegistryRow[]> {
  if (fullTextRoots.length === 0)
    throw new Error('At least one explicit full-text root is required.')
  for (const root of fullTextRoots) {
    assertDevelopmentSafeInputPath(root, 'Full-text root')
    const metadata = await lstat(root)
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
      throw new Error(`Full-text root must be a non-symlink directory: ${root}`)
    }
    assertDevelopmentSafeInputPath(await realpath(root), 'Full-text root resolved path')
  }
  const sourceByKey = new Map(sourceRows.map((row) => [`${row.master_row_id}:${row.pmid}`, row]))
  const registry: GoldEnrichmentV3FullTextRegistryRow[] = []
  for (const audit of auditRows) {
    const source = sourceByKey.get(`${audit.master_row_id}:${audit.pmid}`)
    if (!source)
      throw new Error(`Full-text audit identity ${audit.master_row_id}:${audit.pmid} is absent.`)
    if (
      audit.title !== source.title ||
      audit.physician_final_label !== source.physician_final_label ||
      source.physician_final_label === 'exclude'
    ) {
      throw new Error(`Full-text audit identity/source mismatch for PMID ${audit.pmid}.`)
    }
    const expectedFilename =
      audit.full_text_status === 'preview_only'
        ? audit.partial_text_filename
        : audit.full_text_filename || `${audit.pmid}.pdf`
    const expectedSha256 =
      audit.full_text_status === 'preview_only' ? audit.partial_text_sha256 : audit.full_text_sha256
    let evidenceStatus = audit.full_text_status as GoldEnrichmentV3EvidenceStatus
    let actualFilename = ''
    let actualSha256 = ''
    let fileBytes: number | null = null
    let note = ''
    const evidence = await findEvidenceFile(expectedFilename, fullTextRoots)
    if (audit.full_text_status === 'missing') {
      if (evidence.matches.length > 1) evidenceStatus = 'ambiguous'
      else if (evidence.matches.length === 1) evidenceStatus = 'mismatch'
      note = 'Complete full text is documented unavailable; no file is used as evidence.'
    } else if (evidence.matches.length === 0) {
      evidenceStatus = 'unreadable'
      note = 'The registry-referenced file is unavailable or unreadable.'
    } else if (evidence.matches.length > 1) {
      evidenceStatus = 'ambiguous'
      note = 'Multiple files matched the registry filename.'
    } else {
      const [match] = evidence.matches
      actualFilename = path.basename(match.path)
      actualSha256 = match.sha256
      fileBytes = match.bytes.byteLength
      if (expectedSha256 !== match.sha256) {
        evidenceStatus = 'mismatch'
        note = 'The available file does not match the checksum-bound registry identity.'
      } else if (audit.full_text_status === 'preview_only') {
        note = 'First-page preview only; never accepted or uploaded as complete full text.'
      } else {
        note = 'Verified complete full text; binary remains outside generated artifacts.'
      }
    }
    registry.push({
      master_row_id: source.master_row_id,
      pmid: source.pmid,
      title: source.title,
      physician_final_label: source.physician_final_label,
      physician_final_confidence: source.physician_final_confidence,
      pubmed_abstract_status:
        requireBoolean(source.no_abstract, 'no_abstract', source.csvRecordNumber) ||
        !source.abstract
          ? 'no_abstract'
          : 'abstract_present',
      metadata_sufficiency_constraint: audit.metadata_sufficiency,
      expected_filename: expectedFilename,
      actual_filename: actualFilename,
      file_sha256: actualSha256,
      file_bytes: fileBytes,
      evidence_status: evidenceStatus,
      full_text_used: false,
      categorization_from_full_text: false,
      source_reconciliation_receipt:
        audit.source_group === 'no_abstract'
          ? 'gold-set-v1_full-text-reconciliation_receipt.json'
          : 'gold-set-v1_full-text-reconciliation-v2_receipt.json',
      full_text_availability_note: note,
    })
  }
  const actualCounts = countValues(registry.map((row) => row.evidence_status))
  assertExactCounts(actualCounts, EXPECTED_FULL_TEXT_COUNTS, 'Resolved full-text registry')
  const preview = registry.find((row) => row.pmid === '16043961')
  if (
    !preview ||
    preview.evidence_status !== 'preview_only' ||
    preview.file_sha256 !== 'a777267005cbab7321aacb0e2569f528925068434267c2860d9f9167289e7b2b'
  ) {
    throw new Error('PMID 16043961 must remain the checksum-bound preview-only exception.')
  }
  return registry
}

function packetSourceProjection(
  row: GoldEnrichmentV3CanonicalRow,
  registry: GoldEnrichmentV3FullTextRegistryRow | undefined,
): GoldEnrichmentV3PacketRow['source'] {
  const noAbstract =
    requireBoolean(row.no_abstract, 'no_abstract', row.csvRecordNumber) || !row.abstract
  return {
    master_row_id: row.master_row_id,
    pmid: row.pmid,
    title: row.title,
    abstract: row.abstract,
    journal: row.journal,
    journal_abbreviation: row.journal_abbreviation,
    publication_year: row.publication_year,
    publication_types_json: row.publication_types_json,
    mesh_terms_json: row.mesh_terms_json,
    author_keywords_json: row.author_keywords_json,
    languages_json: row.languages_json,
    no_abstract: noAbstract ? 'true' : 'false',
    physician_final_label: row.physician_final_label,
    physician_final_confidence: row.physician_final_confidence,
    metadata_sufficiency_constraint:
      registry?.metadata_sufficiency_constraint ?? (noAbstract ? 'no_abstract' : ''),
    full_text_evidence_status: registry?.evidence_status ?? 'not_selected',
    expected_full_text_filename: registry?.expected_filename ?? '',
    expected_full_text_sha256:
      registry?.evidence_status === 'matched_complete' ? registry.file_sha256 : '',
  }
}

export function buildGoldEnrichmentV3PacketRows(
  sourceRows: readonly GoldEnrichmentV3CanonicalRow[],
  registryRows: readonly GoldEnrichmentV3FullTextRegistryRow[],
): Record<GoldEnrichmentV3PacketFamily, GoldEnrichmentV3PacketRow[]> {
  const registryByPmid = new Map(registryRows.map((row) => [row.pmid, row]))
  const families: Record<GoldEnrichmentV3PacketFamily, GoldEnrichmentV3PacketRow[]> = {
    included_metadata_only: [],
    included_full_text: [],
    excluded_metadata_sufficiency: [],
  }
  for (const row of sourceRows) {
    const registry = registryByPmid.get(row.pmid)
    let family: GoldEnrichmentV3PacketFamily
    if (row.physician_final_label === 'exclude') family = 'excluded_metadata_sufficiency'
    else if (registry?.evidence_status === 'matched_complete') family = 'included_full_text'
    else family = 'included_metadata_only'
    const source = packetSourceProjection(row, registry)
    families[family].push({
      source,
      sourceRowSha256: sha256Bytes(serializeGoldEnrichmentV3Json(source)),
    })
  }
  for (const family of GOLD_ENRICHMENT_V3_PACKET_FAMILIES) {
    if (families[family].length !== EXPECTED_PACKET_ROWS[family]) {
      throw new Error(
        `${family} must contain exactly ${EXPECTED_PACKET_ROWS[family]} rows; received ${families[family].length}.`,
      )
    }
  }
  return families
}

function chunkRows<T>(rows: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
    rows.slice(index * size, (index + 1) * size),
  )
}

function packetFamilyPath(family: GoldEnrichmentV3PacketFamily): string {
  return family.replaceAll('_', '-')
}

export function buildGoldEnrichmentV3Packets(
  families: Record<GoldEnrichmentV3PacketFamily, GoldEnrichmentV3PacketRow[]>,
  promptArtifacts: Record<
    GoldEnrichmentV3PacketFamily,
    Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>
  >,
  schemaArtifacts: Record<
    GoldEnrichmentV3PacketFamily,
    Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>
  >,
): GoldEnrichmentV3PreparedPacket[] {
  const packets: GoldEnrichmentV3PreparedPacket[] = []
  for (const family of GOLD_ENRICHMENT_V3_PACKET_FAMILIES) {
    const familyPath = packetFamilyPath(family)
    const chunks = chunkRows(families[family], DEFAULT_PACKET_SIZES[family])
    chunks.forEach((rows, index) => {
      const ordinal = index + 1
      const packetId = `${familyPath}-${String(ordinal).padStart(3, '0')}`
      const expectedOutputFilename = `${packetId}.result.csv`
      const sourceProjection = {
        columns: GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
        rows: rows.map((row) =>
          GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS.map((column) => row.source[column]),
        ),
      }
      const sourceProjectionSha256 = sha256Bytes(serializeGoldEnrichmentV3Json(sourceProjection))
      const csvRows = rows.map((row) => ({
        workflow_id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
        workflow_schema_version: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
        prompt_template_version: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
        result_schema_version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
        taxonomy_version: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
        label_schema_version: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
        enrichment_schema_version: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
        packet_id: packetId,
        packet_family: family,
        packet_ordinal: String(ordinal),
        expected_output_filename: expectedOutputFilename,
        source_projection_sha256: sourceProjectionSha256,
        source_row_sha256: row.sourceRowSha256,
        ...row.source,
      }))
      const csv = serializeGoldEnrichmentV3Csv(GOLD_ENRICHMENT_V3_PACKET_COLUMNS, csvRows)
      const csvPath = `packets/${familyPath}/${packetId}.csv`
      const receiptPath = `packets/${familyPath}/${packetId}.receipt.json`
      const receipt: GoldEnrichmentV3PacketReceipt = {
        workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
        workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
        promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
        resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
        taxonomyVersion: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
        labelSchemaVersion: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
        enrichmentSchemaVersion: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
        packetId,
        packetFamily: family,
        packetOrdinal: ordinal,
        rowCount: rows.length,
        orderedKeys: rows.map((row) => ({
          masterRowId: row.source.master_row_id,
          pmid: row.source.pmid,
          sourceRowSha256: row.sourceRowSha256,
        })),
        sourceProjectionSha256,
        packetCsv: { path: csvPath, bytes: Buffer.byteLength(csv), sha256: sha256Bytes(csv) },
        promptTemplate: {
          path: promptArtifacts[family].path,
          bytes: promptArtifacts[family].bytes,
          sha256: promptArtifacts[family].sha256,
        },
        expectedOutputFilename,
        expectedResultSchema: {
          path: schemaArtifacts[family].path,
          bytes: schemaArtifacts[family].bytes,
          sha256: schemaArtifacts[family].sha256,
          version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
        },
      }
      packets.push({ csv, csvPath, receipt, receiptPath })
    })
  }
  return packets
}

export async function getGoldEnrichmentV3RepositoryState(
  workspaceRoot: string,
): Promise<GoldEnrichmentV3RepositoryState> {
  const run = async (arguments_: string[]) =>
    (await execFileAsync('git', arguments_, { cwd: workspaceRoot })).stdout.trim()
  const [branch, commit, originMainSha, trackedStatus] = await Promise.all([
    run(['branch', '--show-current']),
    run(['rev-parse', 'HEAD']),
    run(['rev-parse', 'origin/main']),
    run(['status', '--porcelain=v1', '--untracked-files=no']),
  ])
  const mergeBaseSha = await run(['merge-base', commit, originMainSha])
  if (!branch) throw new Error('Preparation requires a named Git branch.')
  if (trackedStatus) throw new Error('Preparation requires a clean tracked Git state.')
  return { branch, commit, originMainSha, mergeBaseSha, trackedStatus }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export async function assertGoldEnrichmentV3SafeOutputDirectory(
  outputDirectory: string,
  workspaceRoot: string,
) {
  const localDataRoot = path.resolve(workspaceRoot, 'local-data')
  const resolvedOutput = path.resolve(outputDirectory)
  if (resolvedOutput === localDataRoot || !isWithin(localDataRoot, resolvedOutput)) {
    throw new Error('V3 workflow outputs must remain below repository local-data.')
  }
  const relativeParts = path.relative(localDataRoot, resolvedOutput).split(path.sep).filter(Boolean)
  if (relativeParts[0]?.toLocaleLowerCase('en-US') === 'inputs') {
    throw new Error('V3 workflow outputs must not use read-only local-data/inputs.')
  }
  const rootMetadata = await lstat(localDataRoot)
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error('Repository local-data must be a non-symlink directory.')
  }
  if ((await realpath(localDataRoot)) !== localDataRoot) {
    throw new Error('Repository local-data must resolve to itself.')
  }
  let current = localDataRoot
  for (const part of relativeParts) {
    current = path.join(current, part)
    try {
      const metadata = await lstat(current)
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        throw new Error(`Output path traverses a non-directory or symlink: ${current}`)
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') break
      throw error
    }
  }
  return resolvedOutput
}

export interface GoldEnrichmentV3PlannedArtifact {
  path: string
  bytes: Uint8Array
}

async function readIfPresent(candidate: string): Promise<Uint8Array | null> {
  try {
    const metadata = await lstat(candidate)
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error(`Existing artifact path is not a non-symlink regular file: ${candidate}`)
    }
    return await readFile(candidate)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function assertGoldEnrichmentV3ArtifactPath(relativePath: string) {
  if (
    !relativePath ||
    path.isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/u).includes('..')
  ) {
    throw new Error(`Artifact path must be output-relative: ${relativePath}`)
  }
}

export async function preflightGoldEnrichmentV3Artifacts(
  outputDirectory: string,
  artifacts: readonly GoldEnrichmentV3PlannedArtifact[],
) {
  const seen = new Set<string>()
  for (const artifact of artifacts) {
    assertGoldEnrichmentV3ArtifactPath(artifact.path)
    if (seen.has(artifact.path))
      throw new Error(`Duplicate planned artifact path: ${artifact.path}`)
    seen.add(artifact.path)
    const existing = await readIfPresent(path.join(outputDirectory, artifact.path))
    if (existing && Buffer.compare(existing, artifact.bytes) !== 0) {
      throw new Error(`Refusing nonidentical artifact collision at ${artifact.path}.`)
    }
  }
}

export async function publishGoldEnrichmentV3Artifact(
  outputDirectory: string,
  artifact: GoldEnrichmentV3PlannedArtifact,
): Promise<GoldEnrichmentV3ArtifactIdentity> {
  assertGoldEnrichmentV3ArtifactPath(artifact.path)
  const target = path.join(outputDirectory, artifact.path)
  const existing = await readIfPresent(target)
  if (existing) {
    if (Buffer.compare(existing, artifact.bytes) !== 0) {
      throw new Error(`Refusing nonidentical artifact collision at ${artifact.path}.`)
    }
    return {
      path: artifact.path,
      bytes: existing.byteLength,
      sha256: sha256Bytes(existing),
      publication: 'verified_existing',
    }
  }
  await mkdir(path.dirname(target), { recursive: true })
  const token = `${process.pid}-${sha256Bytes(artifact.bytes).slice(0, 16)}`
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${token}.tmp`)
  let handle: Awaited<ReturnType<typeof open>> | undefined
  try {
    handle = await open(temporary, 'wx', 0o600)
    await handle.writeFile(artifact.bytes)
    await handle.sync()
    await handle.close()
    handle = undefined
    const temporaryBytes = await readFile(temporary)
    if (Buffer.compare(temporaryBytes, artifact.bytes) !== 0) {
      throw new Error(`Temporary artifact failed byte verification: ${artifact.path}`)
    }
    try {
      await link(temporary, target)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const raced = await readIfPresent(target)
      if (!raced || Buffer.compare(raced, artifact.bytes) !== 0) {
        throw new Error(`Nonidentical concurrent artifact collision at ${artifact.path}.`)
      }
    }
  } finally {
    if (handle) await handle.close()
    try {
      await unlink(temporary)
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  const published = await readFile(target)
  if (Buffer.compare(published, artifact.bytes) !== 0) {
    throw new Error(`Published artifact failed byte verification: ${artifact.path}`)
  }
  return {
    path: artifact.path,
    bytes: published.byteLength,
    sha256: sha256Bytes(published),
    publication: 'created',
  }
}

export function plannedGoldEnrichmentV3Text(
  relativePath: string,
  text: string,
): GoldEnrichmentV3PlannedArtifact {
  return { path: relativePath, bytes: Buffer.from(text, 'utf8') }
}

function artifactIdentity(relativePath: string, bytes: Uint8Array) {
  return { path: relativePath, bytes: bytes.byteLength, sha256: sha256Bytes(bytes) }
}

function fullTextRegistryCsv(rows: readonly GoldEnrichmentV3FullTextRegistryRow[]): string {
  const columns = [
    'master_row_id',
    'pmid',
    'title',
    'physician_final_label',
    'physician_final_confidence',
    'pubmed_abstract_status',
    'metadata_sufficiency_constraint',
    'expected_filename',
    'actual_filename',
    'file_sha256',
    'file_bytes',
    'evidence_status',
    'full_text_used',
    'categorization_from_full_text',
    'source_reconciliation_receipt',
    'full_text_availability_note',
  ] as const
  return serializeGoldEnrichmentV3Csv(
    columns,
    rows.map((row) => ({
      ...row,
      file_bytes: row.file_bytes === null ? '' : String(row.file_bytes),
      full_text_used: String(row.full_text_used),
      categorization_from_full_text: String(row.categorization_from_full_text),
    })),
  )
}

function canonicalArtifactManifest(artifacts: readonly GoldEnrichmentV3PlannedArtifact[]): {
  manifest: string
  totalBytes: number
} {
  const entries = artifacts
    .map((artifact) => artifactIdentity(artifact.path, artifact.bytes))
    .sort((left, right) => left.path.localeCompare(right.path, 'en-US'))
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0)
  return {
    manifest: serializeGoldEnrichmentV3Json({
      workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
      canonicalArtifacts: entries,
      canonicalFileCount: entries.length,
      canonicalTotalBytes: totalBytes,
      excludes: ['artifact-manifest.json', 'execution-receipts/**'],
    }),
    totalBytes,
  }
}

function packetIndex(packets: readonly GoldEnrichmentV3PreparedPacket[]) {
  return serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    packetCount: packets.length,
    families: Object.fromEntries(
      GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
        const selected = packets.filter((packet) => packet.receipt.packetFamily === family)
        return [
          family,
          {
            packets: selected.length,
            rows: selected.reduce((sum, packet) => sum + packet.receipt.rowCount, 0),
            packetIds: selected.map((packet) => packet.receipt.packetId),
            packetManifestSha256: sha256Bytes(
              serializeGoldEnrichmentV3Json(
                selected.map((packet) => ({
                  packetId: packet.receipt.packetId,
                  csvSha256: packet.receipt.packetCsv.sha256,
                  receiptSha256: sha256Bytes(serializeGoldEnrichmentV3Json(packet.receipt)),
                  sourceProjectionSha256: packet.receipt.sourceProjectionSha256,
                })),
              ),
            ),
          },
        ]
      }),
    ),
    packets: packets.map((packet) => ({
      packetId: packet.receipt.packetId,
      family: packet.receipt.packetFamily,
      ordinal: packet.receipt.packetOrdinal,
      rows: packet.receipt.rowCount,
      csvPath: packet.csvPath,
      csvSha256: packet.receipt.packetCsv.sha256,
      receiptPath: packet.receiptPath,
      receiptSha256: sha256Bytes(serializeGoldEnrichmentV3Json(packet.receipt)),
      expectedOutputFilename: packet.receipt.expectedOutputFilename,
      sourceProjectionSha256: packet.receipt.sourceProjectionSha256,
    })),
  })
}

function expectedPacketCounts() {
  return {
    included_metadata_only: { rows: 308, packets: 7, maximumPacketSize: 50 },
    included_full_text: { rows: 50, packets: 10, maximumPacketSize: 5 },
    excluded_metadata_sufficiency: { rows: 272, packets: 3, maximumPacketSize: 100 },
  }
}

export async function prepareGoldEnrichmentV3(
  options: PrepareGoldEnrichmentV3Options,
): Promise<PrepareGoldEnrichmentV3Result> {
  const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd())
  const outputDirectory = await assertGoldEnrichmentV3SafeOutputDirectory(
    options.outputDirectory,
    workspaceRoot,
  )
  const requiredInputs: Array<[string, string]> = [
    [options.sourcePath, 'Canonical source'],
    [options.sourceReceiptPath, 'Canonical source receipt'],
    [options.fullTextAuditPath, 'Full-text audit'],
    [options.noAbstractReceiptPath, 'No-abstract full-text receipt'],
    [options.limitedAbstractReceiptPath, 'Limited-abstract full-text receipt'],
    [options.qaFindingsPath, 'External-QA findings'],
    [options.qaReview1Path, 'External-QA workbook 1'],
    [options.qaReview2Path, 'External-QA workbook 2'],
    [options.taxonomyAuditPath, 'Taxonomy-v2 audit'],
    [options.upgradePlanPath, 'Taxonomy-v2 upgrade plan'],
  ]
  requiredInputs.forEach(([inputPath, label]) => assertDevelopmentSafeInputPath(inputPath, label))

  const repositoryState =
    options.repositoryState ?? (await getGoldEnrichmentV3RepositoryState(workspaceRoot))
  if (repositoryState.trackedStatus) throw new Error('Preparation requires clean tracked state.')

  const [
    source,
    sourceReceipt,
    fullTextAudit,
    qaFindings,
    qaReview1,
    qaReview2,
    taxonomyAudit,
    upgradePlan,
  ] = await Promise.all([
    readBoundRegularFile(options.sourcePath, 'Canonical source', true),
    readBoundRegularFile(options.sourceReceiptPath, 'Canonical source receipt', true),
    readBoundRegularFile(options.fullTextAuditPath, 'Full-text evidence audit', true),
    readBoundRegularFile(options.qaFindingsPath, 'External-QA findings', true),
    readBoundRegularFile(options.qaReview1Path, 'External-QA workbook 1', false),
    readBoundRegularFile(options.qaReview2Path, 'External-QA workbook 2', false),
    readBoundRegularFile(options.taxonomyAuditPath, 'Taxonomy-v2 audit', true),
    readBoundRegularFile(options.upgradePlanPath, 'Taxonomy-v2 upgrade plan', true),
  ])
  const [noAbstractReceipt, limitedAbstractReceipt] = await Promise.all([
    readJsonReceipt(
      options.noAbstractReceiptPath,
      'No-abstract full-text receipt',
      GOLD_ENRICHMENT_V3_NO_ABSTRACT_RECEIPT_SHA256,
    ),
    readJsonReceipt(
      options.limitedAbstractReceiptPath,
      'Limited-abstract full-text receipt',
      GOLD_ENRICHMENT_V3_LIMITED_ABSTRACT_RECEIPT_SHA256,
    ),
  ])
  assertHash(source, GOLD_ENRICHMENT_V3_CANONICAL_SOURCE_SHA256, 'Canonical source')
  assertHash(sourceReceipt, GOLD_ENRICHMENT_V3_CANONICAL_RECEIPT_SHA256, 'Canonical receipt')
  assertHash(fullTextAudit, GOLD_ENRICHMENT_V3_FULL_TEXT_AUDIT_SHA256, 'Full-text audit')
  assertHash(qaFindings, CANONICAL_EXTERNAL_QA_FINDINGS_SHA256, 'External-QA findings')
  assertHash(qaReview1, GOLD_ENRICHMENT_V3_QA_REVIEW_1_SHA256, 'External-QA workbook 1')
  assertHash(qaReview2, GOLD_ENRICHMENT_V3_QA_REVIEW_2_SHA256, 'External-QA workbook 2')
  assertHash(taxonomyAudit, GOLD_ENRICHMENT_V3_TAXONOMY_AUDIT_SHA256, 'Taxonomy-v2 audit')
  assertHash(upgradePlan, GOLD_ENRICHMENT_V3_UPGRADE_PLAN_SHA256, 'Taxonomy-v2 upgrade plan')

  const sourceRows = parseGoldEnrichmentV3CanonicalSource(source.text ?? '')
  validateGoldEnrichmentV3CanonicalReceipt(sourceReceipt.text ?? '', source.size)
  const fullTextAuditRows = parseGoldEnrichmentV3FullTextAudit(fullTextAudit.text ?? '')
  const registryRows = await buildGoldEnrichmentV3FullTextRegistry(
    sourceRows,
    fullTextAuditRows,
    options.fullTextRoots,
  )
  const findings = parseExternalQaFindingsCsv(qaFindings.text ?? '')
  assertGoldEnrichmentV3QaContract(findings)
  parseGoldEnrichmentV3UpgradePlan(upgradePlan.text ?? '')
  try {
    JSON.parse(taxonomyAudit.text ?? '')
  } catch {
    throw new Error('Taxonomy-v2 audit must be valid JSON.')
  }

  const configInputs: Record<string, BoundFile> = {}
  for (const [relativePath, expectedHash] of Object.entries(GOLD_ENRICHMENT_V3_CONFIG_CONTRACT)) {
    const file = await readBoundRegularFile(
      path.join(workspaceRoot, relativePath),
      relativePath,
      true,
    )
    assertHash(file, expectedHash, relativePath)
    configInputs[relativePath] = file
  }

  const promptSourceRoot = path.join(workspaceRoot, 'docs/ip-literature/gold-enrichment-v3-prompts')
  const schemaSourceRoot = path.join(workspaceRoot, 'config/literature/gold-enrichment-v3')
  const promptSourceFiles = [
    'included-metadata-only.md',
    'included-full-text.md',
    'excluded-metadata-sufficiency.md',
    'result-merge-prompt.md',
    'README.md',
  ]
  const schemaSourceFiles = [
    'included-metadata-only-result.schema.json',
    'included-full-text-result.schema.json',
    'excluded-metadata-sufficiency-result.schema.json',
    'merged-v3.schema.json',
  ]
  const promptFiles = new Map<string, BoundFile>()
  for (const filename of promptSourceFiles) {
    promptFiles.set(
      filename,
      await readBoundRegularFile(path.join(promptSourceRoot, filename), `Prompt ${filename}`, true),
    )
  }
  const schemaFiles = new Map<string, BoundFile>()
  for (const filename of schemaSourceFiles) {
    const file = await readBoundRegularFile(
      path.join(schemaSourceRoot, filename),
      `Result schema ${filename}`,
      true,
    )
    try {
      JSON.parse(file.text ?? '')
    } catch {
      throw new Error(`Result schema ${filename} must be valid JSON.`)
    }
    schemaFiles.set(filename, file)
  }

  const copiedArtifacts: GoldEnrichmentV3PlannedArtifact[] = [
    ...promptSourceFiles.map((filename) => ({
      path: `prompts/${filename}`,
      bytes: promptFiles.get(filename)?.bytes ?? new Uint8Array(),
    })),
    ...schemaSourceFiles.map((filename) => ({
      path: `schemas/${filename}`,
      bytes: schemaFiles.get(filename)?.bytes ?? new Uint8Array(),
    })),
  ]
  const promptArtifacts = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
      const filename = PROMPT_FILES[family]
      return [
        family,
        artifactIdentity(
          `prompts/${filename}`,
          promptFiles.get(filename)?.bytes ?? new Uint8Array(),
        ),
      ]
    }),
  ) as Record<GoldEnrichmentV3PacketFamily, Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>>
  const schemaArtifacts = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
      const filename = RESULT_SCHEMA_FILES[family]
      return [
        family,
        artifactIdentity(
          `schemas/${filename}`,
          schemaFiles.get(filename)?.bytes ?? new Uint8Array(),
        ),
      ]
    }),
  ) as Record<GoldEnrichmentV3PacketFamily, Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>>

  const families = buildGoldEnrichmentV3PacketRows(sourceRows, registryRows)
  const packets = buildGoldEnrichmentV3Packets(families, promptArtifacts, schemaArtifacts)
  if (packets.length !== 20) throw new Error(`Preparation must create exactly 20 packets.`)

  const registryCsv = fullTextRegistryCsv(registryRows)
  const registryIdentity = artifactIdentity('full-text-registry-v3.csv', Buffer.from(registryCsv))
  const binaryRows = registryRows
    .filter((row) => row.file_sha256)
    .map((row) => ({
      filename: row.actual_filename,
      bytes: row.file_bytes,
      sha256: row.file_sha256,
      status: row.evidence_status,
    }))
  const registryReceipt = serializeGoldEnrichmentV3Json({
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    sourceAudit: {
      path: portableInputPath(options.fullTextAuditPath, workspaceRoot),
      bytes: fullTextAudit.size,
      sha256: fullTextAudit.sha256,
    },
    reconciliationReceipts: [
      {
        path: portableInputPath(options.noAbstractReceiptPath, workspaceRoot),
        bytes: noAbstractReceipt.size,
        sha256: noAbstractReceipt.sha256,
      },
      {
        path: portableInputPath(options.limitedAbstractReceiptPath, workspaceRoot),
        bytes: limitedAbstractReceipt.size,
        sha256: limitedAbstractReceipt.sha256,
      },
    ],
    registry: registryIdentity,
    counts: EXPECTED_FULL_TEXT_COUNTS,
    availableBinaryCount: binaryRows.length,
    availableBinaryBytes: binaryRows.reduce((sum, row) => sum + Number(row.bytes ?? 0), 0),
    availableBinaryInventorySha256: sha256Bytes(serializeGoldEnrichmentV3Json(binaryRows)),
    binariesCopiedIntoWorkflow: false,
  })

  const packetManifestHashes = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
      const selected = packets.filter((packet) => packet.receipt.packetFamily === family)
      return [
        family,
        sha256Bytes(
          serializeGoldEnrichmentV3Json(
            selected.map((packet) => ({
              packetId: packet.receipt.packetId,
              packetCsvSha256: packet.receipt.packetCsv.sha256,
              packetReceiptSha256: sha256Bytes(serializeGoldEnrichmentV3Json(packet.receipt)),
            })),
          ),
        ),
      ]
    }),
  )
  const runDefinition = serializeGoldEnrichmentV3Json({
    workflow: {
      id: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
      workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
      promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
      resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
      taxonomyVersion: GOLD_ENRICHMENT_V3_TAXONOMY_VERSION,
      labelSchemaVersion: GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION,
      enrichmentSchemaVersion: GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION,
    },
    repository: {
      branch: repositoryState.branch,
      commit: repositoryState.commit,
      originMainSha: repositoryState.originMainSha,
      mergeBaseSha: repositoryState.mergeBaseSha,
      cleanTrackedState: repositoryState.trackedStatus === '',
    },
    canonicalSource: {
      path: portableInputPath(options.sourcePath, workspaceRoot),
      bytes: source.size,
      sha256: source.sha256,
      rows: sourceRows.length,
      physicianFieldSha256: goldEnrichmentV3PhysicianFieldSha256(sourceRows),
    },
    canonicalReceipt: {
      path: portableInputPath(options.sourceReceiptPath, workspaceRoot),
      bytes: sourceReceipt.size,
      sha256: sourceReceipt.sha256,
    },
    developmentScope: {
      rows: 630,
      included: 358,
      includeCore: 283,
      includeAdjacent: 75,
      excluded: 272,
      uncertain: 0,
      heldOutTestRows: 0,
      testIdentitiesAccessed: 0,
    },
    configuration: Object.fromEntries(
      Object.entries(configInputs).map(([relativePath, file]) => [
        relativePath,
        { bytes: file.size, sha256: file.sha256 },
      ]),
    ),
    fullText: {
      audit: {
        path: portableInputPath(options.fullTextAuditPath, workspaceRoot),
        bytes: fullTextAudit.size,
        sha256: fullTextAudit.sha256,
      },
      noAbstractReceipt: {
        path: portableInputPath(options.noAbstractReceiptPath, workspaceRoot),
        bytes: noAbstractReceipt.size,
        sha256: noAbstractReceipt.sha256,
      },
      limitedAbstractReceipt: {
        path: portableInputPath(options.limitedAbstractReceiptPath, workspaceRoot),
        bytes: limitedAbstractReceipt.size,
        sha256: limitedAbstractReceipt.sha256,
      },
      registryPath: registryIdentity.path,
      registrySha256: registryIdentity.sha256,
      counts: EXPECTED_FULL_TEXT_COUNTS,
      availableBinaryInventorySha256: sha256Bytes(serializeGoldEnrichmentV3Json(binaryRows)),
    },
    coordinatorOnlyEvidence: {
      externalQaFindings: {
        path: portableInputPath(options.qaFindingsPath, workspaceRoot),
        bytes: qaFindings.size,
        sha256: qaFindings.sha256,
        findings: findings.length,
        directTargeted: 54,
        directTargetPmids: 44,
        ruleBasedConsistency: 104,
        global: 8,
      },
      externalQaWorkbooks: [
        {
          path: portableInputPath(options.qaReview1Path, workspaceRoot),
          bytes: qaReview1.size,
          sha256: qaReview1.sha256,
        },
        {
          path: portableInputPath(options.qaReview2Path, workspaceRoot),
          bytes: qaReview2.size,
          sha256: qaReview2.sha256,
        },
      ],
      taxonomyV2Audit: {
        path: portableInputPath(options.taxonomyAuditPath, workspaceRoot),
        bytes: taxonomyAudit.size,
        sha256: taxonomyAudit.sha256,
      },
      taxonomyV2UpgradePlan: {
        path: portableInputPath(options.upgradePlanPath, workspaceRoot),
        bytes: upgradePlan.size,
        sha256: upgradePlan.sha256,
        candidateRows: 133,
        appliedCorrections: 0,
      },
      valuesIncludedInModelPackets: false,
    },
    packetization: {
      ordering: 'canonical-source-order',
      families: expectedPacketCounts(),
      packetCount: packets.length,
      packetManifestHashes,
    },
    promptTemplates: Object.fromEntries(
      [...promptFiles].map(([filename, file]) => [
        `prompts/${filename}`,
        { bytes: file.size, sha256: file.sha256 },
      ]),
    ),
    outputSchemas: Object.fromEntries(
      [...schemaFiles].map(([filename, file]) => [
        `schemas/${filename}`,
        { bytes: file.size, sha256: file.sha256, version: '3.0.0' },
      ]),
    ),
    prohibitedOperations: [
      'model_or_api_call',
      'network_request',
      'worker_or_ultra_dispatch',
      'article_classification_by_workflow',
      'database_read_or_write',
      'review_or_enrichment_import',
      'active_batch_version_update',
      'physician_relevance_change',
      'membership_split_stratum_or_display_order_change',
      'held_out_test_access',
      'automatic_qa_or_upgrade_application',
      'database_import_row_creation',
      'preview_as_complete_full_text',
    ],
    safety: {
      databaseMutationPlan: null,
      importRowsCreated: 0,
      modelCalls: 0,
      networkRequests: 0,
      workerRuns: 0,
      heldOutTestAccessed: false,
      physicianRelevanceChanged: false,
    },
  })

  const canonicalArtifacts: GoldEnrichmentV3PlannedArtifact[] = [
    ...copiedArtifacts,
    plannedGoldEnrichmentV3Text('full-text-registry-v3.csv', registryCsv),
    plannedGoldEnrichmentV3Text('full-text-registry-v3.receipt.json', registryReceipt),
    plannedGoldEnrichmentV3Text('run-definition.json', runDefinition),
    plannedGoldEnrichmentV3Text('packet-index.json', packetIndex(packets)),
    ...packets.flatMap((packet) => [
      plannedGoldEnrichmentV3Text(packet.csvPath, packet.csv),
      plannedGoldEnrichmentV3Text(
        packet.receiptPath,
        serializeGoldEnrichmentV3Json(packet.receipt),
      ),
    ]),
  ]
  const manifestBuild = canonicalArtifactManifest(canonicalArtifacts)
  const manifestArtifact = plannedGoldEnrichmentV3Text(
    'artifact-manifest.json',
    manifestBuild.manifest,
  )
  const publishPlan = [...canonicalArtifacts, manifestArtifact]
  await preflightGoldEnrichmentV3Artifacts(outputDirectory, publishPlan)
  const artifacts: GoldEnrichmentV3ArtifactIdentity[] = []
  for (const artifact of publishPlan) {
    artifacts.push(await publishGoldEnrichmentV3Artifact(outputDirectory, artifact))
  }

  const executionTime = options.executionTime ?? new Date().toISOString()
  const executionReceiptText = serializeGoldEnrichmentV3Json({
    canonical: false,
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    executedAt: executionTime,
    outputDirectory,
    repositoryCommit: repositoryState.commit,
    canonicalFileCount: canonicalArtifacts.length + 1,
    canonicalTotalBytes: manifestBuild.totalBytes + manifestArtifact.bytes.byteLength,
    publicationCounts: countValues(artifacts.map((artifact) => artifact.publication)),
    modelCalls: 0,
    networkRequests: 0,
    databaseWrites: 0,
    importRowsCreated: 0,
    testIdentitiesAccessed: 0,
  })
  const executionName = executionTime.replace(/[:.]/gu, '-').replace(/[^0-9TZ-]/gu, '_')
  const executionArtifact = plannedGoldEnrichmentV3Text(
    `execution-receipts/execution-${executionName}.json`,
    executionReceiptText,
  )
  await preflightGoldEnrichmentV3Artifacts(outputDirectory, [executionArtifact])
  const executionReceipt = await publishGoldEnrichmentV3Artifact(outputDirectory, executionArtifact)

  const identityByPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]))
  const required = (relativePath: string) => {
    const artifact = identityByPath.get(relativePath)
    if (!artifact) throw new Error(`Prepared artifact identity is missing for ${relativePath}.`)
    return artifact
  }
  return {
    outputDirectory,
    artifacts,
    canonicalManifest: required('artifact-manifest.json'),
    executionReceipt,
    packets,
    runDefinition: required('run-definition.json'),
    fullTextRegistry: required('full-text-registry-v3.csv'),
  }
}
