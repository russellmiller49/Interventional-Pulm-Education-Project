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
export const GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION = '3.0.1' as const
export const GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION = '3.0.1' as const
export const GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION = '3.0.1' as const
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
export const GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256 =
  'd0bfc858145b2ee09e976946da1491069c5de26e2c32e600462d1cad323d8e10' as const

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
] as const

export const GOLD_ENRICHMENT_V3_FULL_TEXT_PACKET_SOURCE_COLUMNS = [
  ...GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
  'expected_full_text_filename',
  'expected_full_text_sha256',
] as const

export const GOLD_ENRICHMENT_V3_PACKET_BINDING_COLUMNS = [
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
] as const

export const GOLD_ENRICHMENT_V3_PACKET_COLUMNS = [
  ...GOLD_ENRICHMENT_V3_PACKET_BINDING_COLUMNS,
  ...GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS,
] as const

export const GOLD_ENRICHMENT_V3_FULL_TEXT_PACKET_COLUMNS = [
  ...GOLD_ENRICHMENT_V3_PACKET_BINDING_COLUMNS,
  ...GOLD_ENRICHMENT_V3_FULL_TEXT_PACKET_SOURCE_COLUMNS,
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

export interface GoldEnrichmentV3FullTextAttachment {
  masterRowId: string
  pmid: string
  title: string
  filename: string
  bytes: number
  sha256: string
}

export interface GoldEnrichmentV3PacketRow {
  source: Record<string, string>
  sourceRowSha256: string
  fullTextAttachment?: GoldEnrichmentV3FullTextAttachment
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
  modelFacingPrompt: { path: string; bytes: number; sha256: string }
  expectedOutputFilename: string
  expectedResultSchema: {
    path: string
    bytes: number
    sha256: string
    version: typeof GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION
  }
  modelFacingFullTextManifest?: { path: string; bytes: number; sha256: string }
}

export interface GoldEnrichmentV3PreparedPacket {
  csv: string
  csvPath: string
  renderedPrompt: { text: string; path: string }
  receipt: GoldEnrichmentV3PacketReceipt
  receiptPath: string
  modelFacingFullTextManifest?: { text: string; path: string }
  fullTextAttachments?: readonly GoldEnrichmentV3FullTextAttachment[]
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
  modelFacingInventory: GoldEnrichmentV3ArtifactIdentity
  modelInputIndependenceAudit: GoldEnrichmentV3ArtifactIdentity
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

export const GOLD_ENRICHMENT_V3_SUPERSEDED_PROMPT_SHA256 = Object.freeze({
  included_metadata_only: '0ebd1906e275b5bbf9017e5c48f5c7de50ab5cc8a4afb836ea7c2e904a531ec7',
  included_full_text: '1d44482548b63533e35f9d78a1602df9d90f5f5a28aad5d25db97c56af62a0e3',
  excluded_metadata_sufficiency: '17ed3fe1f5a8d00450ceacefa43071434be23736a3a9c4d8575de9ace8164d9f',
})

export type GoldEnrichmentV3ArtifactCategory = 'model_facing' | 'operator_only' | 'coordinator_only'

export interface GoldEnrichmentV3CategorizedArtifact {
  path: string
  category: GoldEnrichmentV3ArtifactCategory
  bytes?: number
  sha256?: string
  identityBoundBy?: 'artifact-manifest.json' | 'execution-receipts/**'
  packetId?: string
  packetFamily?: GoldEnrichmentV3PacketFamily
  external?: boolean
  generated?: boolean
  sourceFilename?: string
  purpose: string
}

export function goldEnrichmentV3PacketSourceColumns(
  family: GoldEnrichmentV3PacketFamily,
): readonly string[] {
  return family === 'included_full_text'
    ? GOLD_ENRICHMENT_V3_FULL_TEXT_PACKET_SOURCE_COLUMNS
    : GOLD_ENRICHMENT_V3_PACKET_SOURCE_COLUMNS
}

export function goldEnrichmentV3PacketColumns(
  family: GoldEnrichmentV3PacketFamily,
): readonly string[] {
  return family === 'included_full_text'
    ? GOLD_ENRICHMENT_V3_FULL_TEXT_PACKET_COLUMNS
    : GOLD_ENRICHMENT_V3_PACKET_COLUMNS
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
  family: GoldEnrichmentV3PacketFamily,
): GoldEnrichmentV3PacketRow['source'] {
  const noAbstract =
    requireBoolean(row.no_abstract, 'no_abstract', row.csvRecordNumber) || !row.abstract
  const common = {
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
  }
  if (family !== 'included_full_text') return common
  if (
    registry?.evidence_status !== 'matched_complete' ||
    !registry.expected_filename ||
    !registry.file_sha256
  ) {
    throw new Error(`Complete-full-text packet row lacks a verified file identity.`)
  }
  return {
    ...common,
    expected_full_text_filename: registry.expected_filename,
    expected_full_text_sha256: registry.file_sha256,
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
    const source = packetSourceProjection(row, registry, family)
    families[family].push({
      source,
      sourceRowSha256: sha256Bytes(serializeGoldEnrichmentV3Json(source)),
      fullTextAttachment:
        family === 'included_full_text' && registry && registry.file_bytes !== null
          ? {
              masterRowId: row.master_row_id,
              pmid: row.pmid,
              title: row.title,
              filename: registry.actual_filename,
              bytes: registry.file_bytes,
              sha256: registry.file_sha256,
            }
          : undefined,
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

export function goldEnrichmentV3ExternalFullTextInventoryPath(
  packetId: string,
  filename: string,
): string {
  if (
    !filename ||
    /[\\/]/u.test(filename) ||
    path.basename(filename) !== filename ||
    filename.includes('..')
  ) {
    throw new Error(`External complete-full-text identity must use a safe basename.`)
  }
  return `external-complete-full-text/${packetId}/${filename}`
}

const GOLD_ENRICHMENT_V3_PROMPT_PLACEHOLDERS = [
  '{{PACKET_ID}}',
  '{{SOURCE_PROJECTION_SHA256}}',
  '{{EXPECTED_OUTPUT_FILENAME}}',
] as const

export function renderGoldEnrichmentV3PacketPrompt(
  template: string,
  substitutions: {
    packetId: string
    sourceProjectionSha256: string
    expectedOutputFilename: string
  },
): string {
  const discovered = [...template.matchAll(/\{\{[A-Z0-9_]+\}\}/gu)].map((match) => match[0])
  const unique = [...new Set(discovered)].sort((left, right) => left.localeCompare(right, 'en-US'))
  const expected = [...GOLD_ENRICHMENT_V3_PROMPT_PLACEHOLDERS].sort((left, right) =>
    left.localeCompare(right, 'en-US'),
  )
  if (JSON.stringify(unique) !== JSON.stringify(expected)) {
    throw new Error(
      `Classification prompt placeholders must be exactly ${expected.join(', ')}; received ${unique.join(', ')}.`,
    )
  }
  if (
    GOLD_ENRICHMENT_V3_PROMPT_PLACEHOLDERS.some((placeholder) => !template.includes(placeholder))
  ) {
    throw new Error('Each classification prompt placeholder must appear at least once.')
  }
  const rendered = template
    .replaceAll('{{PACKET_ID}}', substitutions.packetId)
    .replaceAll('{{SOURCE_PROJECTION_SHA256}}', substitutions.sourceProjectionSha256)
    .replaceAll('{{EXPECTED_OUTPUT_FILENAME}}', substitutions.expectedOutputFilename)
  if (/\{\{[A-Z0-9_]+\}\}/u.test(rendered)) {
    throw new Error(`Rendered packet prompt still contains an unresolved placeholder.`)
  }
  return rendered
}

export function buildGoldEnrichmentV3Packets(
  families: Record<GoldEnrichmentV3PacketFamily, GoldEnrichmentV3PacketRow[]>,
  promptArtifacts: Record<
    GoldEnrichmentV3PacketFamily,
    Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'> & { text: string }
  >,
  schemaArtifacts: Record<
    GoldEnrichmentV3PacketFamily,
    Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'>
  >,
): GoldEnrichmentV3PreparedPacket[] {
  const packets: GoldEnrichmentV3PreparedPacket[] = []
  for (const family of GOLD_ENRICHMENT_V3_PACKET_FAMILIES) {
    const familyPath = packetFamilyPath(family)
    const sourceColumns = goldEnrichmentV3PacketSourceColumns(family)
    const packetColumns = goldEnrichmentV3PacketColumns(family)
    const chunks = chunkRows(families[family], DEFAULT_PACKET_SIZES[family])
    chunks.forEach((rows, index) => {
      const ordinal = index + 1
      const packetId = `${familyPath}-${String(ordinal).padStart(3, '0')}`
      const expectedOutputFilename = `${packetId}.result.csv`
      const sourceProjection = {
        columns: sourceColumns,
        rows: rows.map((row) => sourceColumns.map((column) => row.source[column])),
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
      const csv = serializeGoldEnrichmentV3Csv(packetColumns, csvRows)
      const csvPath = `packets/${familyPath}/${packetId}.csv`
      const renderedPromptPath = `packets/${familyPath}/${packetId}.prompt.md`
      const renderedPrompt = renderGoldEnrichmentV3PacketPrompt(promptArtifacts[family].text, {
        packetId,
        sourceProjectionSha256,
        expectedOutputFilename,
      })
      const receiptPath = `packets/${familyPath}/${packetId}.receipt.json`
      let modelFacingFullTextManifest: GoldEnrichmentV3PreparedPacket['modelFacingFullTextManifest']
      let fullTextAttachments: readonly GoldEnrichmentV3FullTextAttachment[] | undefined
      if (family === 'included_full_text') {
        const attachments = rows.map((row) => {
          if (!row.fullTextAttachment) {
            throw new Error(`${packetId} is missing a complete-full-text attachment identity.`)
          }
          return row.fullTextAttachment
        })
        fullTextAttachments = attachments
        const manifestPath = `packets/${familyPath}/${packetId}.full-text-manifest.json`
        modelFacingFullTextManifest = {
          path: manifestPath,
          text: serializeGoldEnrichmentV3Json({
            workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
            workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
            promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
            resultSchemaVersion: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
            packetId,
            packetFamily: family,
            sourceProjectionSha256,
            attachments,
          }),
        }
      }
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
        modelFacingPrompt: {
          path: renderedPromptPath,
          bytes: Buffer.byteLength(renderedPrompt),
          sha256: sha256Bytes(renderedPrompt),
        },
        expectedOutputFilename,
        expectedResultSchema: {
          path: schemaArtifacts[family].path,
          bytes: schemaArtifacts[family].bytes,
          sha256: schemaArtifacts[family].sha256,
          version: GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
        },
        modelFacingFullTextManifest: modelFacingFullTextManifest
          ? {
              path: modelFacingFullTextManifest.path,
              bytes: Buffer.byteLength(modelFacingFullTextManifest.text),
              sha256: sha256Bytes(modelFacingFullTextManifest.text),
            }
          : undefined,
      }
      packets.push({
        csv,
        csvPath,
        renderedPrompt: { text: renderedPrompt, path: renderedPromptPath },
        receipt,
        receiptPath,
        modelFacingFullTextManifest,
        fullTextAttachments,
      })
    })
  }
  return packets
}

export function goldEnrichmentV3PacketMembershipOrderProjection(
  packets: readonly GoldEnrichmentV3PreparedPacket[],
): string {
  const projection = packets.map((packet) => ({
    packetId: packet.receipt.packetId,
    family: packet.receipt.packetFamily,
    ordinal: packet.receipt.packetOrdinal,
    orderedKeys: packet.receipt.orderedKeys.map(({ masterRowId, pmid }) => ({
      masterRowId,
      pmid,
    })),
  }))
  // This intentionally preserves the historical compact JSON property order. It is a continuity
  // identity, not the pretty/stably-key-sorted JSON encoding used for generated artifacts.
  return `${JSON.stringify(projection)}\n`
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
  if (artifacts.length !== 85 || new Set(artifacts.map((artifact) => artifact.path)).size !== 85) {
    throw new Error('Canonical preparation must contain exactly 85 unique pre-manifest artifacts.')
  }
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
                  promptSha256: packet.receipt.modelFacingPrompt.sha256,
                  fullTextManifestSha256:
                    packet.receipt.modelFacingFullTextManifest?.sha256 ?? null,
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
      modelFacingPromptPath: packet.renderedPrompt.path,
      modelFacingPromptSha256: packet.receipt.modelFacingPrompt.sha256,
      modelFacingFullTextManifestPath: packet.receipt.modelFacingFullTextManifest?.path ?? null,
      modelFacingFullTextManifestSha256: packet.receipt.modelFacingFullTextManifest?.sha256 ?? null,
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

export function goldEnrichmentV3ControlledValueCatalog(labelsJson: string) {
  const parsed = JSON.parse(labelsJson) as Record<string, unknown>
  if (
    parsed.taxonomy_version !== GOLD_ENRICHMENT_V3_TAXONOMY_VERSION ||
    parsed.label_schema_version !== GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION ||
    !parsed.fields ||
    typeof parsed.fields !== 'object' ||
    Array.isArray(parsed.fields) ||
    !Array.isArray(parsed.optional_tag_statuses)
  ) {
    throw new Error('Enrichment-label configuration does not match the V2 catalog contract.')
  }
  const catalog: Record<string, string[]> = {}
  for (const [field, rawValues] of Object.entries(parsed.fields as Record<string, unknown>)) {
    if (!Array.isArray(rawValues)) throw new Error(`Controlled field ${field} must be an array.`)
    const values = rawValues.map((rawValue) => {
      if (
        !rawValue ||
        typeof rawValue !== 'object' ||
        Array.isArray(rawValue) ||
        typeof (rawValue as Record<string, unknown>).id !== 'string'
      ) {
        throw new Error(`Controlled field ${field} contains an invalid ID.`)
      }
      return (rawValue as Record<string, string>).id
    })
    if (values.length === 0 || new Set(values).size !== values.length) {
      throw new Error(`Controlled field ${field} has an empty or duplicate ID catalog.`)
    }
    catalog[field] = values
  }
  const optionalStatuses = (parsed.optional_tag_statuses as unknown[]).map((rawValue) => {
    if (
      !rawValue ||
      typeof rawValue !== 'object' ||
      Array.isArray(rawValue) ||
      typeof (rawValue as Record<string, unknown>).id !== 'string'
    ) {
      throw new Error('Optional-tag status catalog contains an invalid ID.')
    }
    return (rawValue as Record<string, string>).id
  })
  if (optionalStatuses.length === 0 || new Set(optionalStatuses).size !== optionalStatuses.length) {
    throw new Error('Optional-tag status catalog is empty or contains duplicates.')
  }
  catalog.optional_tag_statuses = optionalStatuses
  return catalog
}

function artifactCategory(relativePath: string): GoldEnrichmentV3ArtifactCategory {
  if (/^packets\/.+\.(?:csv|prompt\.md|full-text-manifest\.json)$/u.test(relativePath)) {
    return 'model_facing'
  }
  if (
    relativePath === 'run-definition.json' ||
    relativePath === 'full-text-registry-v3.csv' ||
    relativePath === 'full-text-registry-v3.receipt.json' ||
    relativePath === 'schemas/merged-v3.schema.json'
  ) {
    return 'coordinator_only'
  }
  if (
    relativePath.startsWith('prompts/') ||
    relativePath.startsWith('schemas/') ||
    relativePath.endsWith('.receipt.json') ||
    relativePath === 'packet-index.json' ||
    relativePath === 'model-facing-inventory.json' ||
    relativePath === 'model-input-independence-audit.json' ||
    relativePath === 'artifact-manifest.json'
  ) {
    return 'operator_only'
  }
  throw new Error(`Generated artifact lacks an explicit visibility category: ${relativePath}`)
}

function artifactPurpose(relativePath: string, category: GoldEnrichmentV3ArtifactCategory): string {
  if (relativePath.endsWith('.prompt.md')) return 'Rendered classification instructions.'
  if (relativePath.endsWith('.full-text-manifest.json'))
    return 'Exact complete-full-text attachment identities for one packet.'
  if (relativePath.endsWith('.csv') && relativePath.startsWith('packets/'))
    return 'Classification packet rows.'
  if (relativePath.startsWith('prompts/'))
    return 'Operator source or handoff documentation; never upload to classification.'
  if (relativePath.endsWith('.receipt.json'))
    return category === 'coordinator_only'
      ? 'Coordinator provenance and evidence reconciliation.'
      : 'Operator provenance; never upload to classification.'
  if (relativePath.startsWith('schemas/'))
    return category === 'coordinator_only'
      ? 'Coordinator merged-output contract.'
      : 'Operator raw-result validation contract; never upload to classification.'
  if (category === 'coordinator_only') return 'Coordinator evidence and post-result logic.'
  return 'Operator control and integrity artifact; never upload to classification.'
}

export function buildGoldEnrichmentV3ModelFacingInventory(
  artifacts: readonly GoldEnrichmentV3PlannedArtifact[],
  packets: readonly GoldEnrichmentV3PreparedPacket[],
) {
  const packetByArtifactPath = new Map<string, GoldEnrichmentV3PreparedPacket>()
  for (const packet of packets) {
    packetByArtifactPath.set(packet.csvPath, packet)
    packetByArtifactPath.set(packet.renderedPrompt.path, packet)
    if (packet.modelFacingFullTextManifest) {
      packetByArtifactPath.set(packet.modelFacingFullTextManifest.path, packet)
    }
  }
  const prospectiveManifestBoundPaths = [
    'model-facing-inventory.json',
    'model-input-independence-audit.json',
    'artifact-manifest.json',
  ]
  const externalFullTextEntries: GoldEnrichmentV3CategorizedArtifact[] = packets.flatMap((packet) =>
    (packet.fullTextAttachments ?? []).map((attachment) => ({
      path: goldEnrichmentV3ExternalFullTextInventoryPath(
        packet.receipt.packetId,
        attachment.filename,
      ),
      category: 'model_facing' as const,
      bytes: attachment.bytes,
      sha256: attachment.sha256,
      packetId: packet.receipt.packetId,
      packetFamily: packet.receipt.packetFamily,
      external: true,
      generated: false,
      sourceFilename: attachment.filename,
      purpose: 'Checksum-bound complete-full-text file supplied with exactly one packet.',
    })),
  )
  if (externalFullTextEntries.length !== 50) {
    throw new Error(`Model-facing inventory requires exactly 50 external complete-full-text files.`)
  }
  const entries: GoldEnrichmentV3CategorizedArtifact[] = [
    ...artifacts.map((artifact) => {
      const category = artifactCategory(artifact.path)
      const packet = packetByArtifactPath.get(artifact.path)
      return {
        ...artifactIdentity(artifact.path, artifact.bytes),
        category,
        packetId: packet?.receipt.packetId,
        packetFamily: packet?.receipt.packetFamily,
        external: false,
        generated: true,
        purpose: artifactPurpose(artifact.path, category),
      }
    }),
    ...externalFullTextEntries,
    ...prospectiveManifestBoundPaths.map((relativePath) => ({
      path: relativePath,
      category: artifactCategory(relativePath),
      identityBoundBy:
        relativePath === 'artifact-manifest.json'
          ? ('execution-receipts/**' as const)
          : ('artifact-manifest.json' as const),
      external: false,
      generated: true,
      purpose: artifactPurpose(relativePath, artifactCategory(relativePath)),
    })),
  ].sort((left, right) => left.path.localeCompare(right.path, 'en-US'))
  const duplicatePaths = entries.filter(
    (entry, index) => entries.findIndex((candidate) => candidate.path === entry.path) !== index,
  )
  if (duplicatePaths.length > 0) {
    throw new Error(
      `Inventory contains duplicate paths: ${duplicatePaths.map((row) => row.path).join(', ')}`,
    )
  }
  const categories = Object.fromEntries(
    (['model_facing', 'operator_only', 'coordinator_only'] as const).map((category) => [
      category,
      entries.filter((entry) => entry.category === category),
    ]),
  ) as Record<GoldEnrichmentV3ArtifactCategory, GoldEnrichmentV3CategorizedArtifact[]>
  const generatedEntries = entries.filter(
    (entry) => entry.generated === true && entry.external === false,
  )
  const externalEntries = entries.filter(
    (entry) => entry.generated === false && entry.external === true,
  )
  if (
    entries.length !== 136 ||
    categories.model_facing.length !== 100 ||
    categories.operator_only.length !== 32 ||
    categories.coordinator_only.length !== 4 ||
    generatedEntries.length !== 86 ||
    externalEntries.length !== 50 ||
    entries.some(
      (entry) =>
        !(
          (entry.generated === true && entry.external === false) ||
          (entry.generated === false && entry.external === true)
        ),
    )
  ) {
    throw new Error('Model-facing inventory does not match the exact 136-entry category contract.')
  }
  return {
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
    inventorySchemaVersion: '1.0.0',
    classificationConversationRule:
      'Upload or paste only the files listed in the packet upload bundle and marked model_facing.',
    categories,
    modelFacingFileCount: categories.model_facing.length,
    operatorOnlyFileCount: categories.operator_only.length,
    coordinatorOnlyFileCount: categories.coordinator_only.length,
    packetUploadBundles: packets.map((packet) => ({
      packetId: packet.receipt.packetId,
      packetFamily: packet.receipt.packetFamily,
      files: [
        packet.renderedPrompt.path,
        packet.csvPath,
        ...(packet.modelFacingFullTextManifest ? [packet.modelFacingFullTextManifest.path] : []),
      ],
      externalCompleteFullTextAttachments:
        packet.receipt.packetFamily === 'included_full_text'
          ? (packet.fullTextAttachments ?? []).map((attachment) => ({
              ...attachment,
              inventoryPath: goldEnrichmentV3ExternalFullTextInventoryPath(
                packet.receipt.packetId,
                attachment.filename,
              ),
            }))
          : [],
    })),
    noncanonicalPatterns: [
      {
        path: 'execution-receipts/**',
        category: 'operator_only' as const,
        purpose: 'Execution-time publication receipt; never upload to classification.',
      },
    ],
  }
}

const MODEL_FACING_FORBIDDEN_PACKET_COLUMNS = [
  'metadata_sufficiency_constraint',
  'full_text_evidence_status',
  'required_review',
  'required_review_reasons',
  'coordinator_requires_physician_enrichment_review',
  'coordinator_review_reasons',
  'external_qa',
  'external_qa_severity',
  'upgrade_candidate',
  'relevance_concern',
  'sampling_stratum',
  'sampling_rationale',
  'screening_score',
  'prior_ai_enrichment',
  'first_pass_label',
  'second_pass_label',
] as const

const MODEL_FACING_FORBIDDEN_PROMPT_PATTERNS: ReadonlyArray<{
  label: string
  pattern: RegExp
}> = [
  { label: 'Required Review', pattern: /\brequired[_ -]review\b/iu },
  {
    label: 'protocol coordinator rule',
    pattern: /\bprotocol[_ -](?:designated|acceptance|candidate|cohort)\b/iu,
  },
  { label: 'relevance concern', pattern: /\brelevance[_ -]concern\b/iu },
  { label: 'external QA', pattern: /\bexternal[_ -]?qa\b|\bqa[_ -]target\b/iu },
  { label: 'QC cohort', pattern: /\bqc[_ -](?:cohort|sample|review)\b/iu },
  {
    label: 'upgrade candidate',
    pattern: /\b(?:taxonomy[_ -])?upgrade[_ -](?:candidate|plan|target|status)\b/iu,
  },
  { label: 'hard case', pattern: /\bhard[_ -]case\b/iu },
  { label: 'coordinator rule', pattern: /\bcoordinator(?:[_ -](?:rule|review|decision))?\b/iu },
  { label: 'review reasons', pattern: /\breview[_ -]reasons?\b/iu },
  {
    label: 'sampling or screening signal',
    pattern: /\bsampling[_ -](?:stratum|rationale)\b|\bscreening[_ -]score\b/iu,
  },
  { label: 'prior enrichment', pattern: /\bprior[_ -](?:ai[_ -])?enrichment\b/iu },
  {
    label: 'superseded raw review field',
    pattern: /(?<!model_)\brequires_physician_enrichment_review\b/iu,
  },
  {
    label: 'fixed relevance value used as signal',
    pattern: /\binclude_(?:core|adjacent)\b/iu,
  },
  {
    label: 'coordinator registry status',
    pattern: /\bfull_text_evidence_status\b|\bmetadata_sufficiency_constraint\b|\bpreview_only\b/iu,
  },
  {
    label: 'include_adjacent mandatory review mapping',
    pattern:
      /(?:include_adjacent.{0,100}(?:mandatory|required|must).{0,30}review|(?:mandatory|required|must).{0,30}review.{0,100}include_adjacent)/isu,
  },
  {
    label: 'physician-confidence mandatory review mapping',
    pattern:
      /(?:physician.{0,30}confidence.{0,100}(?:mandatory|required|must).{0,30}review|(?:mandatory|required|must).{0,30}review.{0,100}physician.{0,30}confidence)/isu,
  },
  {
    label: 'full-text-membership mandatory review mapping',
    pattern:
      /(?:full[_ -]text.{0,50}(?:manifest|cohort|membership).{0,100}(?:mandatory|required|must).{0,30}review|(?:mandatory|required|must).{0,30}review.{0,100}full[_ -]text.{0,50}(?:manifest|cohort|membership))/isu,
  },
]

export function goldEnrichmentV3ForbiddenPromptPhraseLabels(text: string): string[] {
  return MODEL_FACING_FORBIDDEN_PROMPT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ label }) => label,
  )
}

function exactObjectKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((left, right) => left.localeCompare(right, 'en-US'))
}

export function buildGoldEnrichmentV3ModelInputIndependenceAudit(input: {
  sourceRows: readonly GoldEnrichmentV3CanonicalRow[]
  fullTextRegistryRows: readonly GoldEnrichmentV3FullTextRegistryRow[]
  packets: readonly GoldEnrichmentV3PreparedPacket[]
  promptTemplates: Record<GoldEnrichmentV3PacketFamily, { path: string; text: string }>
  inventory: ReturnType<typeof buildGoldEnrichmentV3ModelFacingInventory>
  inventoryText: string
  generatedArtifacts: readonly GoldEnrichmentV3PlannedArtifact[]
  controlledValueCatalog: Record<string, readonly string[]>
}) {
  const failures: string[] = []
  const canonicalSourceByKey = new Map<string, GoldEnrichmentV3CanonicalRow>(
    input.sourceRows.map((row) => [`${row.master_row_id}:${row.pmid}`, row] as const),
  )
  const completeFullTextByKey = new Map<string, GoldEnrichmentV3FullTextAttachment>(
    input.fullTextRegistryRows
      .filter(
        (row): row is GoldEnrichmentV3FullTextRegistryRow & { file_bytes: number } =>
          row.evidence_status === 'matched_complete' && row.file_bytes !== null,
      )
      .map(
        (row) =>
          [
            `${row.master_row_id}:${row.pmid}`,
            {
              masterRowId: row.master_row_id,
              pmid: row.pmid,
              title: row.title,
              filename: row.actual_filename,
              bytes: row.file_bytes,
              sha256: row.file_sha256,
            } satisfies GoldEnrichmentV3FullTextAttachment,
          ] as const,
      ),
  )
  if (completeFullTextByKey.size !== 50) {
    failures.push('Full-text registry does not expose exactly 50 complete attachment identities.')
  }
  const auditedPacketKeys: string[] = []
  const membershipOrderProjection = goldEnrichmentV3PacketMembershipOrderProjection(input.packets)
  const membershipOrderIdentity = {
    serialization: 'compact JSON.stringify preserving packet/property order plus one LF',
    bytes: Buffer.byteLength(membershipOrderProjection),
    sha256: sha256Bytes(membershipOrderProjection),
    expectedSha256: GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
    pass:
      Buffer.byteLength(membershipOrderProjection) === 27_137 &&
      sha256Bytes(membershipOrderProjection) === GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
  }
  if (!membershipOrderIdentity.pass) {
    failures.push('Packet membership/order projection changed from the approved cohort.')
  }
  const packetColumnAudit = input.packets.map((packet) => {
    let actualColumns: string[] = []
    let parsedRows: string[][] = []
    try {
      const parsed = parseCsvRows(packet.csv)
      actualColumns = [...(parsed[0] ?? [])]
      parsedRows = parsed.slice(1)
    } catch (error: unknown) {
      failures.push(`${packet.receipt.packetId}: packet CSV could not be parsed: ${String(error)}`)
    }
    const expectedColumns = [...goldEnrichmentV3PacketColumns(packet.receipt.packetFamily)]
    const exactMatch = JSON.stringify(actualColumns) === JSON.stringify(expectedColumns)
    const forbiddenColumns = actualColumns.filter((column) =>
      MODEL_FACING_FORBIDDEN_PACKET_COLUMNS.includes(
        column as (typeof MODEL_FACING_FORBIDDEN_PACKET_COLUMNS)[number],
      ),
    )
    if (!exactMatch)
      failures.push(`${packet.receipt.packetId}: packet columns do not match allowlist.`)
    if (forbiddenColumns.length > 0) {
      failures.push(
        `${packet.receipt.packetId}: forbidden packet columns: ${forbiddenColumns.join(', ')}.`,
      )
    }
    const rowWidthsPass = parsedRows.every((row) => row.length === expectedColumns.length)
    let canonicalValuesPass = parsedRows.length === packet.receipt.rowCount
    const sourceColumns = goldEnrichmentV3PacketSourceColumns(packet.receipt.packetFamily)
    const projectedSourceRows: string[][] = []
    parsedRows.forEach((values, index) => {
      const row = Object.fromEntries(
        actualColumns.map((column, columnIndex) => [column, values[columnIndex]]),
      )
      const key = `${row.master_row_id}:${row.pmid}`
      auditedPacketKeys.push(key)
      const canonical = canonicalSourceByKey.get(key)
      const completeFullText = completeFullTextByKey.get(key)
      const orderedKey = packet.receipt.orderedKeys[index]
      if (!canonical || !orderedKey) {
        canonicalValuesPass = false
        return
      }
      const noAbstract =
        requireBoolean(canonical.no_abstract, 'no_abstract', canonical.csvRecordNumber) ||
        !canonical.abstract
      const expectedSource: Record<string, string> = {
        master_row_id: canonical.master_row_id,
        pmid: canonical.pmid,
        title: canonical.title,
        abstract: canonical.abstract,
        journal: canonical.journal,
        journal_abbreviation: canonical.journal_abbreviation,
        publication_year: canonical.publication_year,
        publication_types_json: canonical.publication_types_json,
        mesh_terms_json: canonical.mesh_terms_json,
        author_keywords_json: canonical.author_keywords_json,
        languages_json: canonical.languages_json,
        no_abstract: noAbstract ? 'true' : 'false',
        physician_final_label: canonical.physician_final_label,
        physician_final_confidence: canonical.physician_final_confidence,
      }
      if (packet.receipt.packetFamily === 'included_full_text') {
        if (!completeFullText) {
          canonicalValuesPass = false
          return
        }
        expectedSource.expected_full_text_filename = completeFullText.filename
        expectedSource.expected_full_text_sha256 = completeFullText.sha256
      }
      const expectedFamily: GoldEnrichmentV3PacketFamily =
        canonical.physician_final_label === 'exclude'
          ? 'excluded_metadata_sufficiency'
          : completeFullText
            ? 'included_full_text'
            : 'included_metadata_only'
      const expectedSourceRowSha256 = sha256Bytes(serializeGoldEnrichmentV3Json(expectedSource))
      const bindingPass =
        row.workflow_id === GOLD_ENRICHMENT_V3_WORKFLOW_ID &&
        row.workflow_schema_version === GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION &&
        row.prompt_template_version === GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION &&
        row.result_schema_version === GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION &&
        row.taxonomy_version === GOLD_ENRICHMENT_V3_TAXONOMY_VERSION &&
        row.label_schema_version === GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION &&
        row.enrichment_schema_version === GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION &&
        row.packet_id === packet.receipt.packetId &&
        row.packet_family === packet.receipt.packetFamily &&
        packet.receipt.packetFamily === expectedFamily &&
        row.packet_ordinal === String(packet.receipt.packetOrdinal) &&
        row.expected_output_filename === packet.receipt.expectedOutputFilename &&
        row.source_projection_sha256 === packet.receipt.sourceProjectionSha256 &&
        row.source_row_sha256 === expectedSourceRowSha256 &&
        orderedKey.masterRowId === canonical.master_row_id &&
        orderedKey.pmid === canonical.pmid &&
        orderedKey.sourceRowSha256 === expectedSourceRowSha256
      const sourcePass = sourceColumns.every((column) => row[column] === expectedSource[column])
      if (!bindingPass || !sourcePass) canonicalValuesPass = false
      projectedSourceRows.push(sourceColumns.map((column) => row[column]))
    })
    const projectionPass =
      sha256Bytes(
        serializeGoldEnrichmentV3Json({ columns: sourceColumns, rows: projectedSourceRows }),
      ) === packet.receipt.sourceProjectionSha256
    if (!rowWidthsPass) failures.push(`${packet.receipt.packetId}: packet row width mismatch.`)
    if (!canonicalValuesPass || !projectionPass) {
      failures.push(`${packet.receipt.packetId}: packet values drifted from canonical source.`)
    }
    return {
      packetId: packet.receipt.packetId,
      family: packet.receipt.packetFamily,
      expectedColumnCount: expectedColumns.length,
      actualColumnCount: actualColumns.length,
      expectedColumns,
      actualColumns,
      forbiddenColumns,
      rowCount: parsedRows.length,
      rowWidthsPass,
      canonicalValuesPass,
      projectionPass,
      pass:
        exactMatch &&
        forbiddenColumns.length === 0 &&
        rowWidthsPass &&
        canonicalValuesPass &&
        projectionPass,
    }
  })
  const packetCoveragePass =
    auditedPacketKeys.length === 630 &&
    new Set(auditedPacketKeys).size === 630 &&
    auditedPacketKeys.every((key) => canonicalSourceByKey.has(key))
  if (!packetCoveragePass) failures.push('Packet CSVs do not cover 630 unique canonical rows.')

  const developmentPmids = [...new Set(input.sourceRows.map((row) => row.pmid))]
  const promptFiles = [
    ...Object.values(input.promptTemplates).map((prompt) => ({
      path: prompt.path,
      text: prompt.text,
      kind: 'operator_source_template' as const,
    })),
    ...input.packets.map((packet) => ({
      path: packet.renderedPrompt.path,
      text: packet.renderedPrompt.text,
      kind: 'model_facing_rendered_prompt' as const,
    })),
  ]
  const promptPlaceholderAudit = promptFiles.map((file) => {
    const placeholders = [
      ...new Set([...file.text.matchAll(/\{\{[A-Z0-9_]+\}\}/gu)].map((match) => match[0])),
    ].sort((left, right) => left.localeCompare(right, 'en-US'))
    const expected =
      file.kind === 'operator_source_template'
        ? [...GOLD_ENRICHMENT_V3_PROMPT_PLACEHOLDERS].sort((left, right) =>
            left.localeCompare(right, 'en-US'),
          )
        : []
    const pass = JSON.stringify(placeholders) === JSON.stringify(expected)
    if (!pass) failures.push(`${file.path}: prompt placeholder allowlist mismatch.`)
    return { path: file.path, kind: file.kind, expected, actual: placeholders, pass }
  })
  const promptContractAudit = GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => {
    const prompt = input.promptTemplates[family]
    const requiredVersionLines = [
      `Workflow schema version: \`${GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION}\``,
      `Prompt template version: \`${GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION}\``,
      `Result schema version: \`${GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION}\``,
      `Taxonomy version: \`${GOLD_ENRICHMENT_V3_TAXONOMY_VERSION}\``,
      `Enrichment label schema version: \`${GOLD_ENRICHMENT_V3_LABEL_SCHEMA_VERSION}\``,
      `Enrichment artifact schema version: \`${GOLD_ENRICHMENT_V3_ENRICHMENT_SCHEMA_VERSION}\``,
      `Packet family: \`${family}\``,
    ]
    const missingVersionLines = requiredVersionLines.filter((line) => !prompt.text.includes(line))
    const missingControlledValues =
      family === 'excluded_metadata_sufficiency'
        ? []
        : Object.entries(input.controlledValueCatalog).flatMap(([field, values]) =>
            values
              .filter((value) => {
                const escaped = value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
                return !new RegExp(`(?<![A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_.-])`, 'u').test(
                  prompt.text,
                )
              })
              .map((value) => `${field}:${value}`),
          )
    const pass = missingVersionLines.length === 0 && missingControlledValues.length === 0
    if (!pass) failures.push(`${prompt.path}: prompt contract or controlled-value catalog drifted.`)
    return {
      family,
      path: prompt.path,
      requiredVersionLines,
      missingVersionLines,
      controlledValueCount:
        family === 'excluded_metadata_sufficiency'
          ? 0
          : Object.values(input.controlledValueCatalog).reduce(
              (sum, values) => sum + values.length,
              0,
            ),
      missingControlledValues,
      pass,
    }
  })
  const promptScan = promptFiles.map((file) => {
    const pmidMatches = developmentPmids.filter((pmid) =>
      new RegExp(`(?<![0-9A-Za-z])${pmid}(?![0-9A-Za-z])`, 'u').test(file.text),
    )
    const genericArticleIdentifierMatches = [
      ...new Set(
        [...file.text.matchAll(/(?<![0-9A-Za-z])\d{7,9}(?![0-9A-Za-z])/gu)].map(
          (match) => match[0],
        ),
      ),
    ]
    const phraseMatches = goldEnrichmentV3ForbiddenPromptPhraseLabels(file.text)
    if (pmidMatches.length > 0) {
      failures.push(`${file.path}: development PMID identifiers found: ${pmidMatches.join(', ')}.`)
    }
    if (genericArticleIdentifierMatches.length > 0) {
      failures.push(
        `${file.path}: standalone article-like identifiers found: ${genericArticleIdentifierMatches.join(', ')}.`,
      )
    }
    if (phraseMatches.length > 0) {
      failures.push(
        `${file.path}: forbidden review-trigger phrases found: ${phraseMatches.join(', ')}.`,
      )
    }
    return {
      path: file.path,
      kind: file.kind,
      bytes: Buffer.byteLength(file.text),
      sha256: sha256Bytes(file.text),
      developmentPmidMatches: pmidMatches,
      genericArticleIdentifierMatches,
      forbiddenPhraseMatches: phraseMatches,
      pass:
        pmidMatches.length === 0 &&
        genericArticleIdentifierMatches.length === 0 &&
        phraseMatches.length === 0,
    }
  })

  const promptSubstitutionAudit = input.packets.map((packet) => {
    const source = input.promptTemplates[packet.receipt.packetFamily]
    const normalized = packet.renderedPrompt.text
      .replaceAll(packet.receipt.expectedOutputFilename, '{{EXPECTED_OUTPUT_FILENAME}}')
      .replaceAll(packet.receipt.sourceProjectionSha256, '{{SOURCE_PROJECTION_SHA256}}')
      .replaceAll(packet.receipt.packetId, '{{PACKET_ID}}')
    const pass = normalized === source.text
    if (!pass)
      failures.push(`${packet.receipt.packetId}: rendered prompt has a non-allowed difference.`)
    return {
      packetId: packet.receipt.packetId,
      family: packet.receipt.packetFamily,
      renderedPromptSha256: packet.receipt.modelFacingPrompt.sha256,
      normalizedPromptSha256: sha256Bytes(normalized),
      sourceTemplateSha256: sha256Bytes(source.text),
      pass,
    }
  })

  const expectedManifestRootKeys = [
    'attachments',
    'packetFamily',
    'packetId',
    'promptTemplateVersion',
    'resultSchemaVersion',
    'sourceProjectionSha256',
    'workflowId',
    'workflowSchemaVersion',
  ]
  const expectedAttachmentKeys = ['bytes', 'filename', 'masterRowId', 'pmid', 'sha256', 'title']
  const fullTextManifestAudit = input.packets
    .filter((packet) => packet.receipt.packetFamily === 'included_full_text')
    .map((packet) => {
      let rootKeys: string[] = []
      let attachmentKeys: string[][] = []
      let identitiesMatchPacket = false
      try {
        const parsed = JSON.parse(packet.modelFacingFullTextManifest?.text ?? '{}') as Record<
          string,
          unknown
        >
        rootKeys = exactObjectKeys(parsed)
        const attachments = Array.isArray(parsed.attachments)
          ? (parsed.attachments as Array<Record<string, unknown>>)
          : []
        attachmentKeys = attachments.map(exactObjectKeys)
        const expectedAttachments = packet.receipt.orderedKeys
          .map((key) => completeFullTextByKey.get(`${key.masterRowId}:${key.pmid}`))
          .filter((attachment): attachment is GoldEnrichmentV3FullTextAttachment =>
            Boolean(attachment),
          )
        const packetCsv = parseCsvRows(packet.csv)
        const packetHeader = packetCsv[0] ?? []
        const filenameIndex = packetHeader.indexOf('expected_full_text_filename')
        const sha256Index = packetHeader.indexOf('expected_full_text_sha256')
        identitiesMatchPacket =
          parsed.packetId === packet.receipt.packetId &&
          parsed.packetFamily === packet.receipt.packetFamily &&
          parsed.workflowId === GOLD_ENRICHMENT_V3_WORKFLOW_ID &&
          parsed.workflowSchemaVersion === GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION &&
          parsed.promptTemplateVersion === GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION &&
          parsed.resultSchemaVersion === GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION &&
          parsed.sourceProjectionSha256 === packet.receipt.sourceProjectionSha256 &&
          attachments.length === expectedAttachments.length &&
          expectedAttachments.length === packet.receipt.rowCount &&
          attachments.every(
            (attachment, index) =>
              serializeGoldEnrichmentV3Json(attachment) ===
                serializeGoldEnrichmentV3Json(expectedAttachments[index]) &&
              attachment.masterRowId === packet.receipt.orderedKeys[index]?.masterRowId &&
              attachment.pmid === packet.receipt.orderedKeys[index]?.pmid &&
              attachment.title === packetCsv[index + 1]?.[packetHeader.indexOf('title')] &&
              attachment.filename === packetCsv[index + 1]?.[filenameIndex] &&
              attachment.sha256 === packetCsv[index + 1]?.[sha256Index] &&
              Number.isSafeInteger(attachment.bytes) &&
              Number(attachment.bytes) > 0 &&
              /^[a-f0-9]{64}$/u.test(String(attachment.sha256)),
          )
      } catch {
        identitiesMatchPacket = false
      }
      const keysPass =
        JSON.stringify(rootKeys) === JSON.stringify(expectedManifestRootKeys) &&
        attachmentKeys.every(
          (keys) => JSON.stringify(keys) === JSON.stringify(expectedAttachmentKeys),
        ) &&
        new Set(
          packet.receipt.orderedKeys
            .map((key) => completeFullTextByKey.get(`${key.masterRowId}:${key.pmid}`)?.filename)
            .filter((filename): filename is string => Boolean(filename)),
        ).size === packet.receipt.rowCount &&
        packet.receipt.orderedKeys
          .map((key) => completeFullTextByKey.get(`${key.masterRowId}:${key.pmid}`))
          .every(
            (attachment) =>
              Boolean(attachment) &&
              attachment !== undefined &&
              attachment.filename === path.basename(attachment.filename) &&
              !/[\\/]/u.test(attachment.filename),
          )
      const pass = keysPass && identitiesMatchPacket
      if (!pass)
        failures.push(`${packet.receipt.packetId}: full-text manifest exceeds its allowlist.`)
      return {
        packetId: packet.receipt.packetId,
        path: packet.modelFacingFullTextManifest?.path,
        sha256: packet.receipt.modelFacingFullTextManifest?.sha256,
        rootKeys,
        attachmentKeys,
        identitiesMatchPacket,
        pass,
      }
    })

  const artifactByPath = new Map(
    input.generatedArtifacts.map((artifact) => [artifact.path, artifact] as const),
  )
  const listedModelFacing = input.inventory.categories.model_facing
  const expectedGeneratedModelFacingPaths = input.packets.flatMap((packet) => [
    packet.renderedPrompt.path,
    packet.csvPath,
    ...(packet.modelFacingFullTextManifest ? [packet.modelFacingFullTextManifest.path] : []),
  ])
  const expectedExternalEntries = input.packets.flatMap((packet) =>
    packet.receipt.orderedKeys.flatMap((key) => {
      const attachment = completeFullTextByKey.get(`${key.masterRowId}:${key.pmid}`)
      return attachment
        ? [
            {
              ...attachment,
              inventoryPath: goldEnrichmentV3ExternalFullTextInventoryPath(
                packet.receipt.packetId,
                attachment.filename,
              ),
              packetId: packet.receipt.packetId,
              packetFamily: packet.receipt.packetFamily,
            },
          ]
        : []
    }),
  )
  const expectedExternalByPath = new Map(
    expectedExternalEntries.map((entry) => [entry.inventoryPath, entry] as const),
  )
  const expectedModelFacingPaths = [
    ...expectedGeneratedModelFacingPaths,
    ...expectedExternalByPath.keys(),
  ]
  const listedPaths = listedModelFacing.map((entry) => entry.path)
  const categorySets = Object.values(input.inventory.categories).map(
    (entries) => new Set(entries.map((entry) => entry.path)),
  )
  const categoryOverlap = [...new Set(categorySets.flatMap((set) => [...set]))].filter(
    (relativePath) => categorySets.filter((set) => set.has(relativePath)).length > 1,
  )
  const modelFacingFileAudit = listedModelFacing.map((entry) => {
    const artifact = artifactByPath.get(entry.path)
    const external = expectedExternalByPath.get(entry.path)
    const pass = external
      ? entry.external === true &&
        entry.generated === false &&
        entry.packetId === external.packetId &&
        entry.packetFamily === external.packetFamily &&
        entry.sourceFilename === external.filename &&
        entry.bytes === external.bytes &&
        entry.sha256 === external.sha256
      : Boolean(artifact) &&
        entry.external === false &&
        entry.generated === true &&
        entry.bytes === artifact?.bytes.byteLength &&
        entry.sha256 === sha256Bytes(artifact?.bytes ?? new Uint8Array())
    if (!pass) failures.push(`${entry.path}: inventory identity does not match its bound bytes.`)
    return {
      path: entry.path,
      bytes: entry.bytes,
      sha256: entry.sha256,
      external: Boolean(external),
      identitySource: external
        ? 'full-text-registry-and-packet-manifest'
        : 'generated-artifact-bytes',
      pass,
    }
  })
  const prospectiveGeneratedPaths = [
    'model-facing-inventory.json',
    'model-input-independence-audit.json',
    'artifact-manifest.json',
  ]
  const expectedGeneratedInventoryPaths = [
    ...input.generatedArtifacts.map((artifact) => artifact.path),
    ...prospectiveGeneratedPaths,
  ].sort((left, right) => left.localeCompare(right, 'en-US'))
  const actualGeneratedInventoryEntries = Object.values(input.inventory.categories)
    .flat()
    .filter((entry) => entry.generated === true && entry.external === false)
  const actualGeneratedInventoryPaths = actualGeneratedInventoryEntries
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right, 'en-US'))
  const generatedCategoryPass = actualGeneratedInventoryEntries.every((entry) => {
    try {
      return entry.category === artifactCategory(entry.path)
    } catch {
      return false
    }
  })
  const generatedInventoryCoveragePass =
    JSON.stringify(actualGeneratedInventoryPaths) ===
      JSON.stringify(expectedGeneratedInventoryPaths) && generatedCategoryPass
  if (!generatedInventoryCoveragePass) {
    failures.push('Generated canonical artifacts are missing or miscategorized in the inventory.')
  }

  const packetUploadBundleAudit = input.packets.map((packet) => {
    const bundle = input.inventory.packetUploadBundles.find(
      (candidate) => candidate.packetId === packet.receipt.packetId,
    )
    const expectedFiles = [
      packet.renderedPrompt.path,
      packet.csvPath,
      ...(packet.modelFacingFullTextManifest ? [packet.modelFacingFullTextManifest.path] : []),
    ]
    const expectedExternal = packet.receipt.orderedKeys.flatMap((key) => {
      const attachment = completeFullTextByKey.get(`${key.masterRowId}:${key.pmid}`)
      return attachment
        ? [
            {
              ...attachment,
              inventoryPath: goldEnrichmentV3ExternalFullTextInventoryPath(
                packet.receipt.packetId,
                attachment.filename,
              ),
            },
          ]
        : []
    })
    const allBundlePaths = [
      ...expectedFiles,
      ...expectedExternal.map((attachment) => attachment.inventoryPath),
    ]
    const pass =
      Boolean(bundle) &&
      bundle?.packetFamily === packet.receipt.packetFamily &&
      serializeGoldEnrichmentV3Json(bundle?.files) ===
        serializeGoldEnrichmentV3Json(expectedFiles) &&
      serializeGoldEnrichmentV3Json(bundle?.externalCompleteFullTextAttachments) ===
        serializeGoldEnrichmentV3Json(expectedExternal) &&
      allBundlePaths.every((relativePath) =>
        listedModelFacing.some((entry) => entry.path === relativePath),
      )
    if (!pass) failures.push(`${packet.receipt.packetId}: upload bundle is not model-facing-only.`)
    return {
      packetId: packet.receipt.packetId,
      family: packet.receipt.packetFamily,
      generatedFiles: expectedFiles,
      externalFiles: expectedExternal.map((attachment) => attachment.inventoryPath),
      pass,
    }
  })
  const inventoryPathsPass =
    JSON.stringify([...listedPaths].sort()) ===
      JSON.stringify([...expectedModelFacingPaths].sort()) &&
    categoryOverlap.length === 0 &&
    generatedInventoryCoveragePass &&
    packetUploadBundleAudit.every((row) => row.pass)
  if (!inventoryPathsPass)
    failures.push('Model-facing inventory contains an omission or category leak.')

  const currentPromptHashes = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => [
      family,
      sha256Bytes(input.promptTemplates[family].text),
    ]),
  ) as Record<GoldEnrichmentV3PacketFamily, string>
  const supersededPromptIdentitiesRejected = GOLD_ENRICHMENT_V3_PACKET_FAMILIES.every(
    (family) => currentPromptHashes[family] !== GOLD_ENRICHMENT_V3_SUPERSEDED_PROMPT_SHA256[family],
  )
  if (!supersededPromptIdentitiesRejected) {
    failures.push('At least one classification prompt still has its superseded 3.0.0 identity.')
  }

  const determinismProbe = {
    sourceRows: input.sourceRows.map((row) => [row.master_row_id, row.pmid]),
    completeFullText: [...completeFullTextByKey.values()],
    packets: input.packets.map((packet) => ({
      packetId: packet.receipt.packetId,
      csvSha256: packet.receipt.packetCsv.sha256,
      promptSha256: packet.receipt.modelFacingPrompt.sha256,
      fullTextManifestSha256: packet.receipt.modelFacingFullTextManifest?.sha256 ?? null,
      sourceProjectionSha256: packet.receipt.sourceProjectionSha256,
    })),
    generatedArtifacts: input.generatedArtifacts.map((artifact) =>
      artifactIdentity(artifact.path, artifact.bytes),
    ),
    inventorySha256: sha256Bytes(input.inventoryText),
    controlledValueCatalog: input.controlledValueCatalog,
  }
  const determinismProbeFirst = serializeGoldEnrichmentV3Json(determinismProbe)
  const determinismProbeSecond = serializeGoldEnrichmentV3Json(JSON.parse(determinismProbeFirst))
  const deterministicSerializationPass =
    determinismProbeFirst === determinismProbeSecond &&
    serializeGoldEnrichmentV3Json(JSON.parse(input.inventoryText)) === input.inventoryText &&
    modelFacingFileAudit.every((row) => row.pass)
  if (!deterministicSerializationPass) {
    failures.push('Model-input audit inputs do not reproduce canonical deterministic bytes.')
  }

  return {
    workflowId: GOLD_ENRICHMENT_V3_WORKFLOW_ID,
    workflowSchemaVersion: GOLD_ENRICHMENT_V3_WORKFLOW_SCHEMA_VERSION,
    promptTemplateVersion: GOLD_ENRICHMENT_V3_PROMPT_TEMPLATE_VERSION,
    auditSchemaVersion: '1.0.0',
    pass: failures.length === 0,
    failures,
    allowedModelFacingContent: [
      'packet constants and hashes',
      'canonical article metadata and immutable identifiers',
      'immutable physician relevance label and confidence as copy-only audit fields',
      'taxonomy-v2 controlled values and result-format validation rules',
      'exact matching complete-full-text filename, byte size, and SHA-256',
    ],
    allowedPromptSubstitutions: [
      'packet_id',
      'source_projection_sha256',
      'expected_output_filename',
      'prompt_and_schema_version_constants',
    ],
    inventory: {
      path: 'model-facing-inventory.json',
      bytes: Buffer.byteLength(input.inventoryText),
      sha256: sha256Bytes(input.inventoryText),
      categoryCounts: {
        model_facing: input.inventory.categories.model_facing.length,
        operator_only: input.inventory.categories.operator_only.length,
        coordinator_only: input.inventory.categories.coordinator_only.length,
      },
    },
    fileInventory: input.inventory.categories,
    currentPromptHashes,
    supersededPromptHashes: GOLD_ENRICHMENT_V3_SUPERSEDED_PROMPT_SHA256,
    supersededPromptIdentitiesRejected,
    packetMembershipOrderIdentity: membershipOrderIdentity,
    checks: {
      packetColumnAudit,
      canonicalPacketCoverage: {
        rows: auditedPacketKeys.length,
        uniqueRows: new Set(auditedPacketKeys).size,
        pass: packetCoveragePass,
      },
      forbiddenColumnScan: {
        forbiddenColumns: MODEL_FACING_FORBIDDEN_PACKET_COLUMNS,
        pass: packetColumnAudit.every((row) => row.forbiddenColumns.length === 0),
      },
      articleSpecificIdentifierScan: {
        developmentPmidCount: developmentPmids.length,
        promptFiles: promptScan,
        pass: promptScan.every(
          (row) =>
            row.developmentPmidMatches.length === 0 &&
            row.genericArticleIdentifierMatches.length === 0,
        ),
      },
      reviewTriggerPhraseScan: {
        patterns: MODEL_FACING_FORBIDDEN_PROMPT_PATTERNS.map(({ label }) => label),
        promptFiles: promptScan,
        pass: promptScan.every((row) => row.forbiddenPhraseMatches.length === 0),
      },
      promptSubstitutionAudit,
      promptPlaceholderAudit,
      promptContractAudit,
      fullTextManifestAudit,
      packetUploadBundleAudit,
      inventoryCategorySeparation: {
        expectedModelFacingPaths: [...expectedModelFacingPaths].sort(),
        listedModelFacingPaths: [...listedPaths].sort(),
        expectedGeneratedInventoryPaths,
        listedGeneratedInventoryPaths: actualGeneratedInventoryPaths,
        generatedCategoryPass,
        categoryOverlap,
        pass: inventoryPathsPass,
      },
      modelFacingFileIdentities: modelFacingFileAudit,
      deterministicSerialization: {
        format: 'stable recursively key-sorted JSON with one trailing LF',
        allInspectedInputsBoundBySha256: modelFacingFileAudit.every((row) => row.pass),
        firstPassBytes: Buffer.byteLength(determinismProbeFirst),
        firstPassSha256: sha256Bytes(determinismProbeFirst),
        repeatPassSha256: sha256Bytes(determinismProbeSecond),
        repeatSerializationMatches: determinismProbeFirst === determinismProbeSecond,
        pass: deterministicSerializationPass,
      },
    },
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
        {
          ...artifactIdentity(
            `prompts/${filename}`,
            promptFiles.get(filename)?.bytes ?? new Uint8Array(),
          ),
          text: promptFiles.get(filename)?.text ?? '',
        },
      ]
    }),
  ) as unknown as Record<
    GoldEnrichmentV3PacketFamily,
    Omit<GoldEnrichmentV3ArtifactIdentity, 'publication'> & { text: string }
  >
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
  const packetMembershipOrderProjection = goldEnrichmentV3PacketMembershipOrderProjection(packets)
  const packetMembershipOrderSha256 = sha256Bytes(packetMembershipOrderProjection)
  if (
    Buffer.byteLength(packetMembershipOrderProjection) !== 27_137 ||
    packetMembershipOrderSha256 !== GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256
  ) {
    throw new Error('Packet membership or ordering changed from the approved development cohort.')
  }

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
              modelFacingPromptSha256: packet.receipt.modelFacingPrompt.sha256,
              modelFacingFullTextManifestSha256:
                packet.receipt.modelFacingFullTextManifest?.sha256 ?? null,
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
      mergedSchemaVersion: GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION,
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
      membershipOrderProjection: {
        serialization: 'compact JSON.stringify preserving packet/property order plus one LF',
        bytes: Buffer.byteLength(packetMembershipOrderProjection),
        sha256: packetMembershipOrderSha256,
        approvedSha256: GOLD_ENRICHMENT_V3_PACKET_MEMBERSHIP_ORDER_SHA256,
      },
    },
    modelInputIndependence: {
      status: 'preparation-blocked-unless-audit-passes',
      modelFacingInventoryPath: 'model-facing-inventory.json',
      auditPath: 'model-input-independence-audit.json',
      staticPromptTemplatesAreOperatorOnly: true,
      packetReceiptsAreOperatorOnly: true,
      resultSchemasAreOperatorOnly: true,
      coordinatorOnlyEvidenceExcluded: true,
      fixedPhysicianFieldsAreCopyOnlyAndNonpredictive: true,
    },
    supersededPromptPack: {
      promptTemplateVersion: '3.0.0',
      promptSha256: GOLD_ENRICHMENT_V3_SUPERSEDED_PROMPT_SHA256,
      executionAllowed: false,
      priorPreparationDirectoriesAreSuperseded: true,
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
        {
          bytes: file.size,
          sha256: file.sha256,
          version:
            filename === 'merged-v3.schema.json'
              ? GOLD_ENRICHMENT_V3_MERGED_SCHEMA_VERSION
              : GOLD_ENRICHMENT_V3_RESULT_SCHEMA_VERSION,
        },
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

  const baseCanonicalArtifacts: GoldEnrichmentV3PlannedArtifact[] = [
    ...copiedArtifacts,
    plannedGoldEnrichmentV3Text('full-text-registry-v3.csv', registryCsv),
    plannedGoldEnrichmentV3Text('full-text-registry-v3.receipt.json', registryReceipt),
    plannedGoldEnrichmentV3Text('run-definition.json', runDefinition),
    plannedGoldEnrichmentV3Text('packet-index.json', packetIndex(packets)),
    ...packets.flatMap((packet) => {
      const packetArtifacts = [
        plannedGoldEnrichmentV3Text(packet.csvPath, packet.csv),
        plannedGoldEnrichmentV3Text(packet.renderedPrompt.path, packet.renderedPrompt.text),
      ]
      if (packet.modelFacingFullTextManifest) {
        packetArtifacts.push(
          plannedGoldEnrichmentV3Text(
            packet.modelFacingFullTextManifest.path,
            packet.modelFacingFullTextManifest.text,
          ),
        )
      }
      packetArtifacts.push(
        plannedGoldEnrichmentV3Text(
          packet.receiptPath,
          serializeGoldEnrichmentV3Json(packet.receipt),
        ),
      )
      return packetArtifacts
    }),
  ]
  const modelFacingInventory = buildGoldEnrichmentV3ModelFacingInventory(
    baseCanonicalArtifacts,
    packets,
  )
  const modelFacingInventoryText = serializeGoldEnrichmentV3Json(modelFacingInventory)
  const modelFacingInventoryArtifact = plannedGoldEnrichmentV3Text(
    'model-facing-inventory.json',
    modelFacingInventoryText,
  )
  const promptTemplates = Object.fromEntries(
    GOLD_ENRICHMENT_V3_PACKET_FAMILIES.map((family) => [
      family,
      {
        path: promptArtifacts[family].path,
        text: promptArtifacts[family].text,
      },
    ]),
  ) as Record<GoldEnrichmentV3PacketFamily, { path: string; text: string }>
  const modelInputIndependenceAudit = buildGoldEnrichmentV3ModelInputIndependenceAudit({
    sourceRows,
    fullTextRegistryRows: registryRows,
    packets,
    promptTemplates,
    inventory: modelFacingInventory,
    inventoryText: modelFacingInventoryText,
    generatedArtifacts: baseCanonicalArtifacts,
    controlledValueCatalog: goldEnrichmentV3ControlledValueCatalog(
      configInputs['config/literature/enrichment-labels.v2.json']?.text ?? '',
    ),
  })
  if (!modelInputIndependenceAudit.pass) {
    throw new Error(
      `Model-input independence audit failed:\n${modelInputIndependenceAudit.failures.join('\n')}`,
    )
  }
  const modelInputIndependenceAuditText = serializeGoldEnrichmentV3Json(modelInputIndependenceAudit)
  if (
    serializeGoldEnrichmentV3Json(JSON.parse(modelInputIndependenceAuditText)) !==
    modelInputIndependenceAuditText
  ) {
    throw new Error('Model-input independence audit did not reproduce deterministic bytes.')
  }
  const modelInputIndependenceAuditArtifact = plannedGoldEnrichmentV3Text(
    'model-input-independence-audit.json',
    modelInputIndependenceAuditText,
  )
  const canonicalArtifacts: GoldEnrichmentV3PlannedArtifact[] = [
    ...baseCanonicalArtifacts,
    modelFacingInventoryArtifact,
    modelInputIndependenceAuditArtifact,
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
    canonicalManifest: artifactIdentity(manifestArtifact.path, manifestArtifact.bytes),
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
    modelFacingInventory: required('model-facing-inventory.json'),
    modelInputIndependenceAudit: required('model-input-independence-audit.json'),
  }
}
