import { createHash } from 'node:crypto'
import { lstat, mkdir, open, readFile, unlink } from 'node:fs/promises'
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path'

import JSZip from 'jszip'

import { parseCsvRows } from '@/features/literature/gold-set/export'

import enrichmentLabelsV2 from '../../config/literature/enrichment-labels.v2.json'
import goldSetLabelsV1 from '../../config/literature/gold-set-labels.v1.json'
import taxonomyV1 from '../../config/literature/taxonomy.v1.json'

import {
  EXTERNAL_QA_TIERS,
  parseExternalQaFindingsCsv,
  parseV2SourceCsv,
  type ExternalQaFinding,
  type V2SourceRow,
} from './data-quality/external-qa'

export const TAXONOMY_V2_AUDIT_VERSION = '2.0.0' as const
export const TAXONOMY_V2_CANONICAL_ROWS = 630
export const TAXONOMY_V2_CANONICAL_SOURCE_SHA256 =
  'd2942507531a4ba55a5a4195a6919c959eff77cd3473a83eeae16074861b1e64'
export const TAXONOMY_V2_CANONICAL_RECEIPT_SHA256 =
  '38a0316ab5a3161bdf502a8e0c8b9c69753386862c858336f4d3e912a6ad21ef'
export const TAXONOMY_V2_PRIOR_ENRICHMENT_SHA256 =
  '0c6762a5532e20e2b94cfdd39f2dfc8141d60e468da297805194c2d70f6420c7'
export const TAXONOMY_V2_QA_FINDINGS_SHA256 =
  '1c7992f29bb7c03afc370f3cb0e7a978a237dc9cbb964966e0dcec0cd07b6edd'
export const TAXONOMY_V2_QA_REVIEW_1_SHA256 =
  '898159d8c7adf1e0296927d41c42fb8398de40d31823b9584866fb0addceba8d'
export const TAXONOMY_V2_QA_REVIEW_2_SHA256 =
  '6f88c2705fb92f84fb43a24d09c9579995ae1fa92f58be0a4cb721feabb43f74'
export const TAXONOMY_V2_PHYSICIAN_FIELD_SHA256 =
  '90b4b198da5803158685a9dd89d3f59578b91bad9bbd14e1cc55ebf5fdc9a01e'

// This is intentionally duplicated from GOLD_ENRICHMENT_SOURCE_COLUMNS instead of importing the
// runtime enrichment-source module, which also imports database execution code. The exact header
// is validated before any row is interpreted, and a focused test guards this PR70 contract.
export const TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS = [
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

export const TAXONOMY_V2_CONTROLLED_FIELDS = [
  'topic_ids',
  'technology_tags',
  'clinical_purposes',
  'disease_tags',
  'study_design',
  'publication_status',
] as const

export const TAXONOMY_V2_NEW_STUDY_DESIGNS = [
  'cross-sectional-survey',
  'economic-evaluation',
  'bench-in-vitro',
  'animal-preclinical',
  'qualitative-study',
  'case-control',
] as const

const PHYSICIAN_HASH_COLUMNS = [
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

type CanonicalColumn = (typeof TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS)[number]
type ControlledField = (typeof TAXONOMY_V2_CONTROLLED_FIELDS)[number]
type NewStudyDesign = (typeof TAXONOMY_V2_NEW_STUDY_DESIGNS)[number]
export type CanonicalRow = Record<CanonicalColumn, string> & { csvRecordNumber: number }

export type TaxonomyProposalDecision =
  | 'adopt'
  | 'defer'
  | 'map_to_existing'
  | 'merge_with_another_proposal'

export interface TaxonomyProposalSource {
  artifact: string
  location: string
  source_term: string
}

export interface TaxonomyV2Proposal {
  proposal_id: string
  sources: TaxonomyProposalSource[]
  field: string
  proposed_id: string
  label: string
  count: number
  example_pmids: string[]
  example_master_row_ids: string[]
  exact_equivalents: string[]
  near_equivalents: string[]
  decision: TaxonomyProposalDecision
  rationale: string
  replacement_ids: string[]
  definition: string
  inclusion_boundary: string
  exclusion_boundary: string
  examples: string[]
}

export interface TaxonomyV2MigrationMapping {
  field: string
  source_id: string
  replacement_ids: string[]
  mapping_type: 'alias' | 'deferred' | 'merge' | 'split'
  automatic: boolean
  rationale: string
}

export interface TaxonomyV2AdoptionConfig {
  report_version: '2.0.0'
  taxonomy_version: '2.0.0'
  label_schema_version: '2.0.0'
  source_artifacts: Array<{ artifact: string; location: string; sha256: string }>
  proposals: TaxonomyV2Proposal[]
  migration_mappings: TaxonomyV2MigrationMapping[]
}

export interface QaVocabularyEvidence {
  artifact: 'QA_review_1' | 'QA_review_2'
  field: string
  sourceTerm: string
  indicativeCount: number
  titleCount: number | null
  exampleMasterRowIds: string[]
}

export interface TaxonomyV2ExpectedProvenance {
  canonicalReceiptSha256: string
  canonicalRows: number
  canonicalSourceSha256: string
  findingsSha256: string
  physicianFieldSha256: string
  priorEnrichmentSha256: string
  qaReview1Sha256: string
  qaReview1ProposalCount: number
  qaReview2Sha256: string
  qaReview2ProposalCount: number
}

export const CANONICAL_TAXONOMY_V2_PROVENANCE: TaxonomyV2ExpectedProvenance = Object.freeze({
  canonicalReceiptSha256: TAXONOMY_V2_CANONICAL_RECEIPT_SHA256,
  canonicalRows: TAXONOMY_V2_CANONICAL_ROWS,
  canonicalSourceSha256: TAXONOMY_V2_CANONICAL_SOURCE_SHA256,
  findingsSha256: TAXONOMY_V2_QA_FINDINGS_SHA256,
  physicianFieldSha256: TAXONOMY_V2_PHYSICIAN_FIELD_SHA256,
  priorEnrichmentSha256: TAXONOMY_V2_PRIOR_ENRICHMENT_SHA256,
  qaReview1Sha256: TAXONOMY_V2_QA_REVIEW_1_SHA256,
  qaReview1ProposalCount: 15,
  qaReview2Sha256: TAXONOMY_V2_QA_REVIEW_2_SHA256,
  qaReview2ProposalCount: 22,
})

export interface BuildTaxonomyV2AuditOptions {
  canonicalReceiptJson: string
  canonicalSourceCsv: string
  expectedProvenance: TaxonomyV2ExpectedProvenance
  findingsCsv: string
  priorEnrichmentCsv: string
  qaReview1Evidence: QaVocabularyEvidence[]
  qaReview1Sha256: string
  qaReview2Evidence: QaVocabularyEvidence[]
  qaReview2Sha256: string
  qaVocabularyJson: string
  sourceMetadata?: Record<string, { path: string | null; size: number }>
}

export interface RunTaxonomyV2AuditOptions {
  canonicalReceiptPath: string
  canonicalSourcePath: string
  outputPath: string
  priorEnrichmentPath: string
  qaFindingsPath: string
  qaReview1Path: string
  qaReview2Path: string
  qaVocabularyPath: string
  upgradePlanOutputPath: string
  workspaceRoot?: string
  expectedProvenance?: TaxonomyV2ExpectedProvenance
}

export interface RunTaxonomyV2AuditResult {
  outputPath: string
  report: TaxonomyV2AuditReport
  upgradePlan: TaxonomyV2UpgradePlan
  upgradePlanOutputPath: string
}

const POSITIVE_DECIMAL = /^[1-9]\d*$/u
const SHA256 = /^[a-f0-9]{64}$/u
const FORBIDDEN_SPLIT_PATH_TOKEN =
  /(?:^|[\\/_. -])(?:test|testing|all|held[ _-]?out|holdout)(?=$|[\\/_. -])/iu
const INCLUDED_LABELS = new Set(['include_core', 'include_adjacent'])
const CHECKSUM_BOUND_LVRS_PMIDS = new Set(['18453348', '41229759'])
const EXPLICITLY_INSUFFICIENT_METADATA = new Set([
  'limited_abstract',
  'no_abstract',
  'conflicting_metadata',
])

const V1_CONTROLLED_VALUE_CATALOG: Record<ControlledField, readonly string[]> = {
  topic_ids: taxonomyV1.topics.map((topic) => topic.id),
  technology_tags: goldSetLabelsV1.technology_tags.map((tag) => tag.id),
  clinical_purposes: taxonomyV1.facets.clinical_purpose,
  disease_tags: taxonomyV1.facets.disease,
  study_design: taxonomyV1.facets.study_design,
  publication_status: taxonomyV1.facets.publication_class,
}

const V2_CONTROLLED_VALUE_CATALOG = Object.fromEntries(
  TAXONOMY_V2_CONTROLLED_FIELDS.map((field) => [
    field,
    new Set(enrichmentLabelsV2.fields[field].map((label) => label.id)),
  ]),
) as Record<ControlledField, Set<string>>

const STUDY_DESIGN_RULES: ReadonlyArray<{
  id: NewStudyDesign
  patterns: readonly RegExp[]
}> = [
  {
    id: 'case-control',
    patterns: [/\bcase[ -]control(?:led)?\b/iu],
  },
  {
    id: 'qualitative-study',
    patterns: [
      /\bqualitative\b/iu,
      /\bthematic analysis\b/iu,
      /\bfocus groups?\b/iu,
      /\bsemi-structured interviews?\b/iu,
    ],
  },
  {
    id: 'economic-evaluation',
    patterns: [
      /\bcost[ -]effectiveness\b/iu,
      /\bcost[ -](?:minimi[sz]ation|utility|benefit)\b/iu,
      /\beconomic evaluation\b/iu,
      /\bdecision[ -]analytic\b/iu,
    ],
  },
  {
    id: 'cross-sectional-survey',
    patterns: [
      /\bcross[ -]sectional\b/iu,
      /\b(?:online |national |international )?survey\b/iu,
      /\bquestionnaire\b/iu,
    ],
  },
  {
    id: 'bench-in-vitro',
    patterns: [
      /\bin[ -]vitro\b/iu,
      /\bex[ -]vivo\b/iu,
      /\bbench(?:-top)?\b/iu,
      /\bphantom\b/iu,
      /\bcadaver(?:ic)?\b/iu,
    ],
  },
  {
    id: 'animal-preclinical',
    patterns: [
      /\banimal (?:experiment|model|study)\b/iu,
      /\b(?:porcine|swine|canine|ovine|murine)\b/iu,
      /\b(?:pigs?|dogs?|sheep|mice|rabbits?) model\b/iu,
      /\bin (?:pigs?|dogs?|sheep|mice|rabbits?)\b/iu,
      /\bin[ -]vivo preclinical\b/iu,
    ],
  },
]

function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function assertTaxonomyV2QaWorkbookHashesBeforeParse(
  qaReview1: Uint8Array,
  qaReview2: Uint8Array,
  expected: Pick<TaxonomyV2ExpectedProvenance, 'qaReview1Sha256' | 'qaReview2Sha256'>,
) {
  const qaReview1Sha256 = sha256(qaReview1)
  const qaReview2Sha256 = sha256(qaReview2)
  if (qaReview1Sha256 !== expected.qaReview1Sha256) {
    throw new Error(
      `qaReview1 checksum mismatch before workbook parsing: expected ${expected.qaReview1Sha256}, received ${qaReview1Sha256}.`,
    )
  }
  if (qaReview2Sha256 !== expected.qaReview2Sha256) {
    throw new Error(
      `qaReview2 checksum mismatch before workbook parsing: expected ${expected.qaReview2Sha256}, received ${qaReview2Sha256}.`,
    )
  }
  return { qaReview1Sha256, qaReview2Sha256 }
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareIdentifiers(left: string, right: string) {
  const leftNumber = Number(left)
  const rightNumber = Number(right)
  if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) {
    return leftNumber - rightNumber
  }
  return compareText(left, right)
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, stableJsonValue(child)]),
    )
  }
  return value
}

export function serializeTaxonomyV2Json(value: unknown) {
  return `${JSON.stringify(stableJsonValue(value), null, 2)}\n`
}

function sortedUnique(values: Iterable<string>) {
  return [...new Set(values)].sort(compareText)
}

function countValues(values: Iterable<string>) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Object.fromEntries([...counts].sort(([left], [right]) => compareText(left, right)))
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must not be blank.`)
  return value
}

function requireStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a string array.`)
  }
  return [...value] as string[]
}

function requireBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean.`)
  return value
}

function requireNonnegativeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
  return Number(value)
}

function assertSha256(value: string, label: string) {
  if (!SHA256.test(value)) throw new Error(`${label} must be a lowercase SHA-256.`)
}

function withoutBom(value: string) {
  return value.startsWith('\uFEFF') ? value.slice(1) : value
}

function exactCsvRecords<Column extends string>(
  input: string,
  label: string,
  expectedColumns: readonly Column[],
) {
  const parsed = parseCsvRows(withoutBom(input))
  if (parsed.length === 0) throw new Error(`${label} is empty.`)
  const header = parsed[0]
  if (
    header.length !== expectedColumns.length ||
    header.some((column, index) => column !== expectedColumns[index])
  ) {
    throw new Error(
      `${label} header must exactly match the ${expectedColumns.length}-column schema.`,
    )
  }
  return parsed.slice(1).map((values, index) => {
    if (values.length !== expectedColumns.length) {
      throw new Error(
        `${label} CSV record ${index + 2} has ${values.length} columns; expected ${expectedColumns.length}.`,
      )
    }
    return Object.fromEntries(
      expectedColumns.map((column, columnIndex) => [column, values[columnIndex]]),
    ) as Record<Column, string>
  })
}

function parseCanonicalSourceCsv(input: string, expectedRows: number) {
  const records = exactCsvRecords(
    input,
    'Canonical PR70 enrichment source',
    TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS,
  )
  if (records.length !== expectedRows) {
    throw new Error(
      `Canonical source must contain exactly ${expectedRows} development rows; received ${records.length}.`,
    )
  }
  const rows = records.map((record, index): CanonicalRow => {
    const csvRecordNumber = index + 2
    if (!POSITIVE_DECIMAL.test(record.master_row_id) || !POSITIVE_DECIMAL.test(record.pmid)) {
      throw new Error(`Canonical source identifiers at CSV record ${csvRecordNumber} are invalid.`)
    }
    if (record.batch_name !== 'gold-set-v1' || record.dataset_split !== 'development') {
      throw new Error(
        `Canonical source CSV record ${csvRecordNumber} is not gold-set-v1 development data.`,
      )
    }
    if (!record.physician_final_label || !record.physician_final_confidence) {
      throw new Error(
        `Canonical physician decision at CSV record ${csvRecordNumber} is incomplete.`,
      )
    }
    return { ...record, csvRecordNumber }
  })
  const byPmid = new Map<string, CanonicalRow>()
  const byMasterRowId = new Map<string, CanonicalRow>()
  for (const row of rows) {
    if (byPmid.has(row.pmid)) throw new Error(`Duplicate canonical PMID ${row.pmid}.`)
    if (byMasterRowId.has(row.master_row_id)) {
      throw new Error(`Duplicate canonical master_row_id ${row.master_row_id}.`)
    }
    byPmid.set(row.pmid, row)
    byMasterRowId.set(row.master_row_id, row)
  }
  return { byMasterRowId, byPmid, rows }
}

export function canonicalPhysicianFieldSha256(rows: readonly CanonicalRow[]) {
  const ordered = [...rows].sort((left, right) =>
    compareIdentifiers(left.master_row_id, right.master_row_id),
  )
  return sha256(
    `${JSON.stringify({
      columns: PHYSICIAN_HASH_COLUMNS,
      rows: ordered.map((row) => PHYSICIAN_HASH_COLUMNS.map((column) => row[column])),
    })}\n`,
  )
}

function parseCanonicalReceipt(input: string, expectedRows: number, expectedSourceSha256: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('Canonical receipt must be valid JSON.')
  }
  const receipt = requireObject(parsed, 'Canonical receipt')
  const batch = requireObject(receipt.batch, 'Canonical receipt batch')
  const output = requireObject(receipt.output, 'Canonical receipt output')
  const safety = requireObject(receipt.safety, 'Canonical receipt safety')
  if (
    batch.name !== 'gold-set-v1' ||
    batch.datasetSplit !== 'development' ||
    batch.rows !== expectedRows
  ) {
    throw new Error('Canonical receipt does not describe exactly gold-set-v1 development rows.')
  }
  if (output.rows !== expectedRows || output.sha256 !== expectedSourceSha256) {
    throw new Error('Canonical receipt output does not match the checksum-bound canonical CSV.')
  }
  const columns = requireStringArray(output.columns, 'Canonical receipt output columns')
  if (JSON.stringify(columns) !== JSON.stringify(TAXONOMY_V2_CANONICAL_SOURCE_COLUMNS)) {
    throw new Error(
      'Canonical receipt columns do not exactly match GOLD_ENRICHMENT_SOURCE_COLUMNS.',
    )
  }
  if (
    safety.developmentOnly !== true ||
    safety.heldOutTestAccessed !== false ||
    safety.physicianDecisionsChanged !== false
  ) {
    throw new Error('Canonical receipt does not prove development-only physician-safe export.')
  }
  return receipt
}

export function parseTaxonomyV2AdoptionConfig(input: string): TaxonomyV2AdoptionConfig {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new Error('QA vocabulary adoption config must be valid JSON.')
  }
  const root = requireObject(parsed, 'QA vocabulary adoption config')
  for (const field of ['report_version', 'taxonomy_version', 'label_schema_version'] as const) {
    if (root[field] !== '2.0.0') throw new Error(`QA vocabulary ${field} must equal 2.0.0.`)
  }
  if (!Array.isArray(root.source_artifacts) || !Array.isArray(root.proposals)) {
    throw new Error('QA vocabulary config must contain source_artifacts and proposals arrays.')
  }
  if (!Array.isArray(root.migration_mappings)) {
    throw new Error('QA vocabulary config must contain migration_mappings.')
  }
  const sourceArtifacts = root.source_artifacts.map((value, index) => {
    const item = requireObject(value, `QA vocabulary source_artifacts[${index}]`)
    const sha = requireString(item.sha256, `QA vocabulary source_artifacts[${index}].sha256`)
    assertSha256(sha, `QA vocabulary source_artifacts[${index}].sha256`)
    return {
      artifact: requireString(item.artifact, `QA vocabulary source_artifacts[${index}].artifact`),
      location: requireString(item.location, `QA vocabulary source_artifacts[${index}].location`),
      sha256: sha,
    }
  })
  const proposals = root.proposals.map((value, index): TaxonomyV2Proposal => {
    const item = requireObject(value, `QA vocabulary proposals[${index}]`)
    const decision = requireString(
      item.decision,
      `QA vocabulary proposals[${index}].decision`,
    ) as TaxonomyProposalDecision
    if (!['adopt', 'defer', 'map_to_existing', 'merge_with_another_proposal'].includes(decision)) {
      throw new Error(`QA vocabulary proposals[${index}] has invalid decision ${decision}.`)
    }
    if (!Array.isArray(item.sources)) {
      throw new Error(`QA vocabulary proposals[${index}].sources must be an array.`)
    }
    const sources = item.sources.map((sourceValue, sourceIndex) => {
      const source = requireObject(
        sourceValue,
        `QA vocabulary proposals[${index}].sources[${sourceIndex}]`,
      )
      return {
        artifact: requireString(source.artifact, 'QA vocabulary proposal source artifact'),
        location: requireString(source.location, 'QA vocabulary proposal source location'),
        source_term: requireString(source.source_term, 'QA vocabulary proposal source term'),
      }
    })
    return {
      proposal_id: requireString(item.proposal_id, `QA vocabulary proposals[${index}].proposal_id`),
      sources,
      field: requireString(item.field, `QA vocabulary proposals[${index}].field`),
      proposed_id: requireString(item.proposed_id, `QA vocabulary proposals[${index}].proposed_id`),
      label: requireString(item.label, `QA vocabulary proposals[${index}].label`),
      count: requireNonnegativeInteger(item.count, `QA vocabulary proposals[${index}].count`),
      example_pmids: requireStringArray(item.example_pmids, 'QA vocabulary example_pmids'),
      example_master_row_ids: requireStringArray(
        item.example_master_row_ids,
        'QA vocabulary example_master_row_ids',
      ),
      exact_equivalents: requireStringArray(
        item.exact_equivalents,
        'QA vocabulary exact_equivalents',
      ),
      near_equivalents: requireStringArray(item.near_equivalents, 'QA vocabulary near_equivalents'),
      decision,
      rationale: requireString(item.rationale, 'QA vocabulary proposal rationale'),
      replacement_ids: requireStringArray(item.replacement_ids, 'QA vocabulary replacement_ids'),
      definition: requireString(item.definition, 'QA vocabulary proposal definition'),
      inclusion_boundary: requireString(
        item.inclusion_boundary,
        'QA vocabulary proposal inclusion_boundary',
      ),
      exclusion_boundary: requireString(
        item.exclusion_boundary,
        'QA vocabulary proposal exclusion_boundary',
      ),
      examples: requireStringArray(item.examples, 'QA vocabulary examples'),
    }
  })
  const proposalIds = new Set<string>()
  for (const proposal of proposals) {
    if (proposalIds.has(proposal.proposal_id)) {
      throw new Error(`Duplicate QA vocabulary proposal_id ${proposal.proposal_id}.`)
    }
    proposalIds.add(proposal.proposal_id)
  }
  const migrationMappings = root.migration_mappings.map(
    (value, index): TaxonomyV2MigrationMapping => {
      const item = requireObject(value, `QA vocabulary migration_mappings[${index}]`)
      const mappingType = requireString(
        item.mapping_type,
        `QA vocabulary migration_mappings[${index}].mapping_type`,
      ) as TaxonomyV2MigrationMapping['mapping_type']
      if (!['alias', 'merge', 'split', 'deferred'].includes(mappingType)) {
        throw new Error(`QA vocabulary migration mapping ${index} has invalid mapping_type.`)
      }
      return {
        field: requireString(item.field, 'QA vocabulary migration mapping field'),
        source_id: requireString(item.source_id, 'QA vocabulary migration mapping source_id'),
        replacement_ids: requireStringArray(
          item.replacement_ids,
          'QA vocabulary migration mapping replacement_ids',
        ),
        mapping_type: mappingType,
        automatic: requireBoolean(item.automatic, 'QA vocabulary migration mapping automatic'),
        rationale: requireString(item.rationale, 'QA vocabulary migration mapping rationale'),
      }
    },
  )
  return {
    report_version: '2.0.0',
    taxonomy_version: '2.0.0',
    label_schema_version: '2.0.0',
    source_artifacts: sourceArtifacts.sort((left, right) =>
      compareText(left.artifact, right.artifact),
    ),
    proposals: proposals.sort((left, right) => compareText(left.proposal_id, right.proposal_id)),
    migration_mappings: migrationMappings.sort((left, right) =>
      compareText(`${left.field}\u0000${left.source_id}`, `${right.field}\u0000${right.source_id}`),
    ),
  }
}

function splitControlledValues(value: string) {
  return sortedUnique(
    value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function normalizedBoolean(value: string) {
  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase())
}

function canonicalMetadataText(row: CanonicalRow) {
  return [
    row.title,
    row.abstract,
    row.publication_types_json,
    row.mesh_terms_json,
    row.author_keywords_json,
  ].join('\n')
}

function studyDesignCandidates(row: CanonicalRow) {
  const text = canonicalMetadataText(row)
  return STUDY_DESIGN_RULES.flatMap((rule) => {
    const matches = sortedUnique(
      rule.patterns.flatMap(
        (pattern) => text.match(pattern)?.map((value) => value.toLowerCase()) ?? [],
      ),
    )
    return matches.length > 0 ? [{ design: rule.id, matches }] : []
  })
}

function assertPriorMatchesCanonical(
  canonical: ReturnType<typeof parseCanonicalSourceCsv>,
  prior: ReturnType<typeof parseV2SourceCsv>,
) {
  if (canonical.rows.length !== prior.rows.length) {
    throw new Error('Prior enrichment row count does not match canonical development membership.')
  }
  for (const canonicalRow of canonical.rows) {
    const priorRow = prior.byPmid.get(canonicalRow.pmid)
    if (!priorRow || priorRow.master_row_id !== canonicalRow.master_row_id) {
      throw new Error(`Prior enrichment membership mismatch for PMID ${canonicalRow.pmid}.`)
    }
    if (
      priorRow.physician_final_label !== canonicalRow.physician_final_label ||
      priorRow.physician_final_confidence !== canonicalRow.physician_final_confidence
    ) {
      throw new Error(
        `Prior enrichment changed physician label/confidence for PMID ${canonicalRow.pmid}.`,
      )
    }
  }
}

function assertFindingsMatchDevelopment(
  findings: readonly ExternalQaFinding[],
  canonical: ReturnType<typeof parseCanonicalSourceCsv>,
) {
  for (const finding of findings) {
    if (finding.review_tier === 'global_data_quality') continue
    const canonicalRow = canonical.byPmid.get(finding.pmid)
    if (!canonicalRow || canonicalRow.master_row_id !== finding.master_row_id) {
      throw new Error(
        `External QA finding ${finding.csv_record_number} is not an exact development member.`,
      )
    }
  }
}

function assertProposalExamplesAreDevelopmentOnly(
  config: TaxonomyV2AdoptionConfig,
  evidence: readonly QaVocabularyEvidence[],
  canonical: ReturnType<typeof parseCanonicalSourceCsv>,
) {
  for (const proposal of config.proposals) {
    for (const pmid of proposal.example_pmids) {
      if (!canonical.byPmid.has(pmid)) {
        throw new Error(
          `Proposal ${proposal.proposal_id} example PMID ${pmid} is not a development member.`,
        )
      }
    }
    for (const masterRowId of proposal.example_master_row_ids) {
      if (!canonical.byMasterRowId.has(masterRowId)) {
        throw new Error(
          `Proposal ${proposal.proposal_id} example master_row_id ${masterRowId} is not a development member.`,
        )
      }
    }
    if (
      proposal.example_pmids.length > 0 &&
      proposal.example_pmids.length === proposal.example_master_row_ids.length
    ) {
      proposal.example_pmids.forEach((pmid, index) => {
        if (canonical.byPmid.get(pmid)?.master_row_id !== proposal.example_master_row_ids[index]) {
          throw new Error(
            `Proposal ${proposal.proposal_id} example PMID/master_row_id pair is inconsistent.`,
          )
        }
      })
    }
  }
  for (const item of evidence) {
    for (const masterRowId of item.exampleMasterRowIds) {
      if (!canonical.byMasterRowId.has(masterRowId)) {
        throw new Error(
          `${item.artifact} example master_row_id ${masterRowId} is not a development member.`,
        )
      }
    }
  }
}

function controlledValueCounts(rows: readonly V2SourceRow[]) {
  return Object.fromEntries(
    TAXONOMY_V2_CONTROLLED_FIELDS.map((field) => {
      const catalog = new Set(V1_CONTROLLED_VALUE_CATALOG[field])
      const observed = countValues(rows.flatMap((row) => splitControlledValues(row[field])))
      const unsupported = Object.keys(observed).filter((id) => !catalog.has(id))
      if (unsupported.length > 0) {
        throw new Error(
          `Prior enrichment contains unsupported V1 ${field} values: ${unsupported.join(', ')}.`,
        )
      }
      return [
        field,
        Object.fromEntries([...catalog].sort(compareText).map((id) => [id, observed[id] ?? 0])),
      ]
    }),
  ) as Record<ControlledField, Record<string, number>>
}

function controlledCoverage(rows: readonly V2SourceRow[]) {
  const included = rows.filter((row) => INCLUDED_LABELS.has(row.physician_final_label))
  return Object.fromEntries(
    TAXONOMY_V2_CONTROLLED_FIELDS.map((field) => {
      const tagged = included.filter((row) => splitControlledValues(row[field]).length > 0).length
      return [
        field,
        {
          blankIncludedRows: included.length - tagged,
          includedRows: included.length,
          observedUniqueValues: sortedUnique(
            included.flatMap((row) => splitControlledValues(row[field])),
          ),
          taggedIncludedRows: tagged,
          uniqueValues: sortedUnique(V1_CONTROLLED_VALUE_CATALOG[field]),
        },
      ]
    }),
  ) as Record<
    ControlledField,
    {
      blankIncludedRows: number
      includedRows: number
      observedUniqueValues: string[]
      taggedIncludedRows: number
      uniqueValues: string[]
    }
  >
}

function blankOptionalTagClassification(
  rows: readonly V2SourceRow[],
  field: 'disease_tags' | 'technology_tags',
) {
  const blankRows = rows.filter(
    (row) =>
      INCLUDED_LABELS.has(row.physician_final_label) &&
      splitControlledValues(row[field]).length === 0,
  )
  const notAssessable = blankRows.filter(
    (row) =>
      EXPLICITLY_INSUFFICIENT_METADATA.has(row.metadata_sufficiency.trim().toLowerCase()) &&
      !normalizedBoolean(row.full_text_used),
  )
  return {
    blankIncludedRows: blankRows.length,
    notApplicable: 0,
    notAssessable: notAssessable.length,
    notAssessableByMetadataSufficiency: countValues(
      notAssessable.map((row) => row.metadata_sufficiency.trim().toLowerCase()),
    ),
    unresolved: blankRows.length - notAssessable.length,
  }
}

function projectedVocabulary(
  current: ReturnType<typeof controlledCoverage>,
  config: TaxonomyV2AdoptionConfig,
) {
  return Object.fromEntries(
    TAXONOMY_V2_CONTROLLED_FIELDS.map((field) => {
      const currentValues = new Set(current[field].uniqueValues)
      const additions = new Set<string>()
      for (const proposal of config.proposals.filter((item) => item.field === field)) {
        if (proposal.decision === 'defer' || proposal.decision === 'map_to_existing') continue
        const candidates =
          proposal.replacement_ids.length > 0 ? proposal.replacement_ids : [proposal.proposed_id]
        for (const candidate of candidates)
          if (!currentValues.has(candidate)) additions.add(candidate)
      }
      return [
        field,
        {
          addedValueIds: sortedUnique(additions),
          currentUniqueValueCount: currentValues.size,
          projectedUniqueValueCount: currentValues.size + additions.size,
          taggedIncludedRowsAfterPlanning: current[field].taggedIncludedRows,
          rowChangesApplied: 0,
        },
      ]
    }),
  )
}

function qaSummary(findings: readonly ExternalQaFinding[]) {
  const direct = findings.filter((finding) => finding.review_tier === 'direct_targeted')
  return {
    total: findings.length,
    byField: countValues(findings.map((finding) => finding.field)),
    bySeverity: countValues(findings.map((finding) => finding.severity)),
    byStatus: countValues(findings.map((finding) => finding.status_against_v2)),
    byTier: Object.fromEntries(
      EXTERNAL_QA_TIERS.map((tier) => [
        tier,
        findings.filter((finding) => finding.review_tier === tier).length,
      ]),
    ),
    directTargeted: {
      total: direct.length,
      byField: countValues(direct.map((finding) => finding.field)),
      bySeverity: countValues(direct.map((finding) => finding.severity)),
      byStatus: countValues(direct.map((finding) => finding.status_against_v2)),
    },
  }
}

function exactLvrsFindings(findings: readonly ExternalQaFinding[]) {
  const expectedPmids = ['18453348', '41229759']
  const rows = findings
    .filter(
      (finding) =>
        expectedPmids.includes(finding.pmid) &&
        finding.review_tier === 'direct_targeted' &&
        finding.category === 'Tagging error' &&
        finding.field === 'topic_ids',
    )
    .sort((left, right) => compareIdentifiers(left.pmid, right.pmid))
  if (
    rows.length !== 2 ||
    JSON.stringify(rows.map((row) => row.pmid)) !== JSON.stringify(expectedPmids)
  ) {
    throw new Error('External QA must contain exactly the two checksum-bound LVRS topic findings.')
  }
  return rows.map((finding) => ({
    masterRowId: finding.master_row_id,
    pmid: finding.pmid,
    sourceReview: finding.source_review,
    status: finding.status_against_v2,
    finding: finding.issue,
    handling: 'topic_scope_candidate_only_no_technology_inference',
    candidateV2Topic: 'adjacent-surgical-procedural-analogue',
  }))
}

function proposalSummary(config: TaxonomyV2AdoptionConfig) {
  return config.proposals.map((proposal) => ({
    proposalId: proposal.proposal_id,
    field: proposal.field,
    proposedId: proposal.proposed_id,
    label: proposal.label,
    decision: proposal.decision,
    replacementIds: sortedUnique(proposal.replacement_ids),
    count: proposal.count,
    exampleMasterRowIds: [...proposal.example_master_row_ids].sort(compareIdentifiers),
    examplePmids: [...proposal.example_pmids].sort(compareIdentifiers),
    exactEquivalents: sortedUnique(proposal.exact_equivalents),
    nearEquivalents: sortedUnique(proposal.near_equivalents),
    sources: [...proposal.sources].sort((left, right) =>
      compareText(
        `${left.artifact}\u0000${left.location}\u0000${left.source_term}`,
        `${right.artifact}\u0000${right.location}\u0000${right.source_term}`,
      ),
    ),
    definition: proposal.definition,
    inclusionBoundary: proposal.inclusion_boundary,
    exclusionBoundary: proposal.exclusion_boundary,
    rationale: proposal.rationale,
  }))
}

function normalizeQaArtifact(value: string) {
  const normalized = value.toLowerCase().replaceAll('-', '_').replaceAll(' ', '_')
  if (normalized.includes('qa_review_1')) return 'QA_review_1'
  if (normalized.includes('qa_review_2')) return 'QA_review_2'
  return null
}

function normalizeSourceTerm(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase()
}

function validateQaProposalEvidence(
  config: TaxonomyV2AdoptionConfig,
  evidence: readonly QaVocabularyEvidence[],
  artifact: 'QA_review_1' | 'QA_review_2',
  expectedCount: number,
) {
  if (evidence.length !== expectedCount) {
    throw new Error(
      `${artifact} must contain exactly ${expectedCount} extracted proposals; received ${evidence.length}.`,
    )
  }
  const configuredTerms = new Set(
    config.proposals.flatMap((proposal) =>
      proposal.sources
        .filter((source) => normalizeQaArtifact(source.artifact) === artifact)
        .map(
          (source) =>
            `${proposal.field.trim().toLowerCase()}\u0000${normalizeSourceTerm(source.source_term)}`,
        ),
    ),
  )
  const uncovered = evidence.filter(
    (item) =>
      !configuredTerms.has(
        `${item.field.trim().toLowerCase()}\u0000${normalizeSourceTerm(item.sourceTerm)}`,
      ),
  )
  if (uncovered.length > 0) {
    throw new Error(
      `${artifact} proposal evidence lacks adoption dispositions: ${uncovered
        .map((item) => item.sourceTerm)
        .join(', ')}.`,
    )
  }
}

function validateConfigSourceHashes(
  config: TaxonomyV2AdoptionConfig,
  actual: { findings: string; qaReview1: string; qaReview2: string },
) {
  const configured = {
    findings: config.source_artifacts.filter((source) =>
      source.artifact.toLowerCase().includes('findings'),
    ),
    qaReview1: config.source_artifacts.filter(
      (source) => normalizeQaArtifact(source.artifact) === 'QA_review_1',
    ),
    qaReview2: config.source_artifacts.filter(
      (source) => normalizeQaArtifact(source.artifact) === 'QA_review_2',
    ),
  }
  for (const [label, hash] of Object.entries(actual)) {
    const matches = configured[label as keyof typeof configured]
    if (matches.length !== 1 || matches[0].sha256 !== hash) {
      throw new Error(`QA vocabulary source_artifacts does not bind the ${label} checksum ${hash}.`)
    }
  }
}

function validateMigrationMappings(config: TaxonomyV2AdoptionConfig) {
  for (const proposal of config.proposals) {
    if (!TAXONOMY_V2_CONTROLLED_FIELDS.includes(proposal.field as ControlledField)) {
      throw new Error(`Proposal ${proposal.proposal_id} uses unsupported field ${proposal.field}.`)
    }
    const catalog = V2_CONTROLLED_VALUE_CATALOG[proposal.field as ControlledField]
    if (proposal.decision === 'adopt' && !catalog.has(proposal.proposed_id)) {
      throw new Error(
        `Adopted proposal ${proposal.proposal_id} is absent from the V2 label catalog.`,
      )
    }
    const unsupportedReplacements = proposal.replacement_ids.filter((id) => !catalog.has(id))
    if (unsupportedReplacements.length > 0) {
      throw new Error(
        `Proposal ${proposal.proposal_id} has unsupported V2 replacement IDs: ${unsupportedReplacements.join(', ')}.`,
      )
    }
  }
  for (const mapping of config.migration_mappings) {
    if (!TAXONOMY_V2_CONTROLLED_FIELDS.includes(mapping.field as ControlledField)) {
      throw new Error(
        `Migration mapping ${mapping.source_id} uses unsupported field ${mapping.field}.`,
      )
    }
    if (mapping.automatic) {
      throw new Error(
        `Migration mapping ${mapping.field}/${mapping.source_id} must require adjudication; automatic=true is forbidden.`,
      )
    }
    if (mapping.mapping_type === 'deferred' && mapping.replacement_ids.length > 0) {
      throw new Error(`Deferred mapping ${mapping.source_id} must not name replacement IDs.`)
    }
    if (mapping.mapping_type !== 'deferred' && mapping.replacement_ids.length === 0) {
      throw new Error(`Mapping ${mapping.source_id} must name at least one replacement ID.`)
    }
    const unsupportedReplacements = mapping.replacement_ids.filter(
      (id) => !V2_CONTROLLED_VALUE_CATALOG[mapping.field as ControlledField].has(id),
    )
    if (unsupportedReplacements.length > 0) {
      throw new Error(
        `Mapping ${mapping.source_id} has unsupported V2 replacement IDs: ${unsupportedReplacements.join(', ')}.`,
      )
    }
  }
  const missing = config.proposals.filter((proposal) => {
    if (proposal.decision === 'adopt') return false
    const mapping = config.migration_mappings.find(
      (mapping) => mapping.field === proposal.field && mapping.source_id === proposal.proposed_id,
    )
    if (!mapping) return true
    if (proposal.decision === 'defer') {
      return mapping.mapping_type !== 'deferred' || mapping.replacement_ids.length !== 0
    }
    if (proposal.decision === 'map_to_existing' && mapping.mapping_type !== 'alias') return true
    if (
      proposal.decision === 'merge_with_another_proposal' &&
      mapping.mapping_type !== 'merge' &&
      mapping.mapping_type !== 'split'
    ) {
      return true
    }
    return (
      JSON.stringify(sortedUnique(mapping.replacement_ids)) !==
      JSON.stringify(sortedUnique(proposal.replacement_ids))
    )
  })
  if (missing.length > 0) {
    throw new Error(
      `Non-adopted proposals lack explicit migration mappings: ${missing
        .map((proposal) => proposal.proposal_id)
        .join(', ')}.`,
    )
  }
  return { missingMappings: 0 as const }
}

export function validateTaxonomyV2QaContract(options: {
  config: TaxonomyV2AdoptionConfig
  findingsSha256: string
  qaReview1Evidence: readonly QaVocabularyEvidence[]
  qaReview1ProposalCount: number
  qaReview1Sha256: string
  qaReview2Evidence: readonly QaVocabularyEvidence[]
  qaReview2ProposalCount: number
  qaReview2Sha256: string
}) {
  validateConfigSourceHashes(options.config, {
    findings: options.findingsSha256,
    qaReview1: options.qaReview1Sha256,
    qaReview2: options.qaReview2Sha256,
  })
  validateQaProposalEvidence(
    options.config,
    options.qaReview1Evidence,
    'QA_review_1',
    options.qaReview1ProposalCount,
  )
  validateQaProposalEvidence(
    options.config,
    options.qaReview2Evidence,
    'QA_review_2',
    options.qaReview2ProposalCount,
  )
  return validateMigrationMappings(options.config)
}

function findingCandidateFields(field: string) {
  return sortedUnique(
    field
      .split('/')
      .map((value) => value.trim())
      .filter((value) => TAXONOMY_V2_CONTROLLED_FIELDS.includes(value as ControlledField)),
  )
}

export interface TaxonomyV2UpgradePlanItem {
  masterRowId: string
  pmid: string
  existingV1Values: Record<ControlledField, string[]>
  candidateFields: string[]
  candidateFieldVocabularyAdditions: Array<{
    detection: string
    field: string
    vocabularyId: string
  }>
  sourceFindingReferences: Array<{
    csvRecordNumber: number
    field: string
    reviewTier: string
    sourceReview: string
  }>
  deterministicCandidateDetection: boolean
  finalChangeDeterministic: false
  physicianAdjudication: true
  reason: string
}

export interface TaxonomyV2UpgradePlan {
  planVersion: '2.0.0'
  operation: 'physician_adjudication_candidate_plan'
  rows: TaxonomyV2UpgradePlanItem[]
  safety: {
    containsFinalChangedValues: false
    databaseOperations: readonly []
    developmentOnly: true
    importOperations: readonly []
    relevanceModification: false
    testIdentitiesIncluded: false
  }
}

function buildUpgradePlan(
  canonical: ReturnType<typeof parseCanonicalSourceCsv>,
  prior: ReturnType<typeof parseV2SourceCsv>,
  findings: readonly ExternalQaFinding[],
): TaxonomyV2UpgradePlan {
  const findingsByPmid = new Map<string, ExternalQaFinding[]>()
  for (const finding of findings) {
    if (finding.review_tier === 'global_data_quality') continue
    findingsByPmid.set(finding.pmid, [...(findingsByPmid.get(finding.pmid) ?? []), finding])
  }
  const designCandidatesByPmid = new Map<
    string,
    Array<{ design: NewStudyDesign; matches: string[] }>
  >()
  for (const row of prior.rows) {
    if (row.study_design !== 'not-assessable-from-available-metadata') continue
    const canonicalRow = canonical.byPmid.get(row.pmid)!
    const candidates = studyDesignCandidates(canonicalRow)
    if (candidates.length > 0) designCandidatesByPmid.set(row.pmid, candidates)
  }
  const pmids = sortedUnique([...findingsByPmid.keys(), ...designCandidatesByPmid.keys()])
  const rows = pmids.map((pmid): TaxonomyV2UpgradePlanItem => {
    const priorRow = prior.byPmid.get(pmid)!
    const rowFindings = [...(findingsByPmid.get(pmid) ?? [])].sort(
      (left, right) => left.csv_record_number - right.csv_record_number,
    )
    const designCandidates = designCandidatesByPmid.get(pmid) ?? []
    const candidateFieldVocabularyAdditions = CHECKSUM_BOUND_LVRS_PMIDS.has(pmid)
      ? [
          {
            detection: 'checksum_bound_lvrs_scope_finding',
            field: 'topic_ids',
            vocabularyId: 'adjacent-surgical-procedural-analogue',
          },
        ]
      : [
          ...designCandidates.map((candidate) => ({
            detection: `keyword_rule:${candidate.matches.join('|')}`,
            field: 'study_design',
            vocabularyId: candidate.design,
          })),
        ].sort((left, right) =>
          compareText(
            `${left.field}\u0000${left.vocabularyId}\u0000${left.detection}`,
            `${right.field}\u0000${right.vocabularyId}\u0000${right.detection}`,
          ),
        )
    return {
      masterRowId: priorRow.master_row_id,
      pmid,
      existingV1Values: Object.fromEntries(
        TAXONOMY_V2_CONTROLLED_FIELDS.map((field) => [
          field,
          splitControlledValues(priorRow[field]),
        ]),
      ) as Record<ControlledField, string[]>,
      candidateFields: sortedUnique([
        ...rowFindings.flatMap((finding) => findingCandidateFields(finding.field)),
        ...(designCandidates.length > 0 ? ['study_design'] : []),
      ]),
      candidateFieldVocabularyAdditions,
      sourceFindingReferences: rowFindings.map((finding) => ({
        csvRecordNumber: finding.csv_record_number,
        field: finding.field,
        reviewTier: finding.review_tier,
        sourceReview: finding.source_review,
      })),
      deterministicCandidateDetection: candidateFieldVocabularyAdditions.length > 0,
      finalChangeDeterministic: false,
      physicianAdjudication: true,
      reason:
        rowFindings.length > 0 && designCandidates.length > 0
          ? 'External QA and deterministic schema-gap candidate; no row change is selected.'
          : rowFindings.length > 0
            ? 'External QA development-row finding; no row change is selected.'
            : 'Deterministic schema-gap keyword candidate only; no row change is selected.',
    }
  })
  rows.sort((left, right) => compareIdentifiers(left.masterRowId, right.masterRowId))
  return {
    planVersion: '2.0.0',
    operation: 'physician_adjudication_candidate_plan',
    rows,
    safety: {
      containsFinalChangedValues: false,
      databaseOperations: [],
      developmentOnly: true,
      importOperations: [],
      relevanceModification: false,
      testIdentitiesIncluded: false,
    },
  }
}

export interface TaxonomyV2AuditReport {
  reportVersion: '2.0.0'
  operation: 'read_only_enrichment_taxonomy_v2_audit'
  contracts: {
    existingTaxonomyVersion: '1.1.0'
    proposedEnrichmentSchemaVersion: '2.0.0'
    proposedTaxonomyVersion: '2.0.0'
  }
  sources: Record<
    string,
    {
      path: string | null
      rows?: number
      sha256: string
      sha256AfterReadOnlyAudit: string
      size: number
    }
  >
  canonicalDevelopment: {
    batchName: 'gold-set-v1'
    datasetSplit: 'development'
    rows: number
    uniqueMasterRowIds: number
    uniquePmids: number
  }
  physicianFieldIntegrity: {
    expectedSha256: string
    sha256After: string
    sha256Before: string
    unchanged: true
  }
  v1ControlledValueCounts: Record<ControlledField, Record<string, number>>
  vocabularyProposals: ReturnType<typeof proposalSummary>
  qaWorkbookEvidence: {
    review1: QaVocabularyEvidence[]
    review2: QaVocabularyEvidence[]
  }
  qaFindings: ReturnType<typeof qaSummary>
  lvrsTopicScopeFindings: ReturnType<typeof exactLvrsFindings>
  notAssessableStudyDesign: {
    adequateAbstractCandidateRows: number
    candidateResolvableRows: number
    total: number
    externalQaReportedTotal: number | null
    differenceFromExternalQaReport: number | null
    byMetadataSufficiency: Record<string, number>
    deterministicKeywordCandidates: Record<string, number>
    multipleCandidateRows: number
    unresolvedRows: number
  }
  optionalBlankTags: Record<
    'disease_tags' | 'technology_tags',
    ReturnType<typeof blankOptionalTagClassification>
  >
  vocabularyCoverage: {
    current: ReturnType<typeof controlledCoverage>
    projected: ReturnType<typeof projectedVocabulary>
  }
  deferredProposals: Array<{
    field: string
    proposalId: string
    proposedId: string
    rationale: string
  }>
  migrationCompleteness: {
    adjudicationRequiredMappings: number
    automaticMappings: 0
    configuredMappings: number
    decisions: Record<string, number>
    developmentRowsInUpgradePlan: number
    mappingTypes: Record<string, number>
    missingMappings: 0
    proposals: number
    rowChangesApplied: 0
  }
  safety: {
    databaseAccesses: 0
    databaseMutations: 0
    developmentOnly: true
    heldOutTestAccesses: 0
    importRows: 0
    networkAccesses: 0
    physicianDecisionsChanged: false
    sourceMutations: 0
    taxonomyMutations: 0
  }
}

export function buildTaxonomyV2Audit(options: BuildTaxonomyV2AuditOptions): {
  report: TaxonomyV2AuditReport
  upgradePlan: TaxonomyV2UpgradePlan
} {
  const expected = options.expectedProvenance
  for (const [label, value] of Object.entries(expected)) {
    if (typeof value === 'number') {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error(`Expected ${label} must be a positive integer.`)
      }
      continue
    }
    assertSha256(String(value), `Expected ${label}`)
  }
  const sourceHashes = {
    canonicalReceipt: sha256(options.canonicalReceiptJson),
    canonicalSource: sha256(options.canonicalSourceCsv),
    priorEnrichment: sha256(options.priorEnrichmentCsv),
    qaFindings: sha256(options.findingsCsv),
    qaReview1: options.qaReview1Sha256,
    qaReview2: options.qaReview2Sha256,
    qaVocabulary: sha256(options.qaVocabularyJson),
  }
  const expectedHashes = {
    canonicalReceipt: expected.canonicalReceiptSha256,
    canonicalSource: expected.canonicalSourceSha256,
    priorEnrichment: expected.priorEnrichmentSha256,
    qaFindings: expected.findingsSha256,
    qaReview1: expected.qaReview1Sha256,
    qaReview2: expected.qaReview2Sha256,
  }
  for (const [source, expectedHash] of Object.entries(expectedHashes)) {
    if (sourceHashes[source as keyof typeof sourceHashes] !== expectedHash) {
      throw new Error(
        `${source} checksum mismatch: expected ${expectedHash}, received ${sourceHashes[source as keyof typeof sourceHashes]}.`,
      )
    }
  }
  parseCanonicalReceipt(
    options.canonicalReceiptJson,
    expected.canonicalRows,
    expected.canonicalSourceSha256,
  )
  const canonical = parseCanonicalSourceCsv(options.canonicalSourceCsv, expected.canonicalRows)
  const prior = parseV2SourceCsv(options.priorEnrichmentCsv)
  const findings = parseExternalQaFindingsCsv(options.findingsCsv)
  const config = parseTaxonomyV2AdoptionConfig(options.qaVocabularyJson)
  const mappingCompleteness = validateTaxonomyV2QaContract({
    config,
    findingsSha256: sourceHashes.qaFindings,
    qaReview1Evidence: options.qaReview1Evidence,
    qaReview1ProposalCount: expected.qaReview1ProposalCount,
    qaReview1Sha256: sourceHashes.qaReview1,
    qaReview2Evidence: options.qaReview2Evidence,
    qaReview2ProposalCount: expected.qaReview2ProposalCount,
    qaReview2Sha256: sourceHashes.qaReview2,
  })
  assertPriorMatchesCanonical(canonical, prior)
  assertFindingsMatchDevelopment(findings, canonical)
  assertProposalExamplesAreDevelopmentOnly(
    config,
    [...options.qaReview1Evidence, ...options.qaReview2Evidence],
    canonical,
  )

  const physicianSha256Before = canonicalPhysicianFieldSha256(canonical.rows)
  if (physicianSha256Before !== expected.physicianFieldSha256) {
    throw new Error(
      `Canonical physician-field checksum mismatch: expected ${expected.physicianFieldSha256}, received ${physicianSha256Before}.`,
    )
  }
  const currentCounts = controlledValueCounts(prior.rows)
  const currentCoverage = controlledCoverage(prior.rows)
  const upgradePlan = buildUpgradePlan(canonical, prior, findings)
  const notAssessableRows = prior.rows.filter(
    (row) => row.study_design === 'not-assessable-from-available-metadata',
  )
  const candidateSets = notAssessableRows.map((row) =>
    studyDesignCandidates(canonical.byPmid.get(row.pmid)!),
  )
  const candidateResolvableRows = candidateSets.filter((candidates) => candidates.length > 0).length
  const unresolvedCandidateRows = candidateSets.length - candidateResolvableRows
  if (candidateResolvableRows + unresolvedCandidateRows !== notAssessableRows.length) {
    throw new Error('Study-design candidate resolution counts do not reconcile.')
  }
  const candidateCounts = countValues(
    candidateSets.flatMap((candidates) => candidates.map((item) => item.design)),
  )
  for (const design of TAXONOMY_V2_NEW_STUDY_DESIGNS) candidateCounts[design] ??= 0
  const physicianSha256After = canonicalPhysicianFieldSha256(canonical.rows)
  if (physicianSha256Before !== physicianSha256After) {
    throw new Error('Taxonomy V2 audit mutated canonical physician fields in memory.')
  }
  const proposals = proposalSummary(config)
  const externalQaReportedNotAssessable = findings
    .filter(
      (finding) =>
        finding.review_tier === 'global_data_quality' && finding.field === 'study_design',
    )
    .flatMap((finding) => finding.issue.match(/\b(\d+) included articles\b/iu)?.[1] ?? [])
    .map(Number)
    .at(0)
  const sourceSizes: Record<string, number> = {
    canonicalReceipt: Buffer.byteLength(options.canonicalReceiptJson),
    canonicalSource: Buffer.byteLength(options.canonicalSourceCsv),
    priorEnrichment: Buffer.byteLength(options.priorEnrichmentCsv),
    qaFindings: Buffer.byteLength(options.findingsCsv),
    qaReview1: options.sourceMetadata?.qaReview1?.size ?? 0,
    qaReview2: options.sourceMetadata?.qaReview2?.size ?? 0,
    qaVocabulary: Buffer.byteLength(options.qaVocabularyJson),
  }
  const report: TaxonomyV2AuditReport = {
    reportVersion: '2.0.0',
    operation: 'read_only_enrichment_taxonomy_v2_audit',
    contracts: {
      existingTaxonomyVersion: '1.1.0',
      proposedEnrichmentSchemaVersion: '2.0.0',
      proposedTaxonomyVersion: '2.0.0',
    },
    sources: Object.fromEntries(
      Object.entries(sourceHashes).map(([name, hash]) => [
        name,
        {
          ...(name === 'canonicalSource'
            ? { rows: canonical.rows.length }
            : name === 'priorEnrichment'
              ? { rows: prior.rows.length }
              : name === 'qaFindings'
                ? { rows: findings.length }
                : {}),
          path: options.sourceMetadata?.[name]?.path ?? null,
          sha256: hash,
          sha256AfterReadOnlyAudit: hash,
          size: options.sourceMetadata?.[name]?.size ?? sourceSizes[name] ?? 0,
        },
      ]),
    ),
    canonicalDevelopment: {
      batchName: 'gold-set-v1',
      datasetSplit: 'development',
      rows: canonical.rows.length,
      uniqueMasterRowIds: canonical.byMasterRowId.size,
      uniquePmids: canonical.byPmid.size,
    },
    physicianFieldIntegrity: {
      expectedSha256: expected.physicianFieldSha256,
      sha256After: physicianSha256After,
      sha256Before: physicianSha256Before,
      unchanged: true,
    },
    v1ControlledValueCounts: currentCounts,
    vocabularyProposals: proposals,
    qaWorkbookEvidence: {
      review1: [...options.qaReview1Evidence].sort((left, right) =>
        compareText(
          `${left.field}\u0000${left.sourceTerm}`,
          `${right.field}\u0000${right.sourceTerm}`,
        ),
      ),
      review2: [...options.qaReview2Evidence].sort((left, right) =>
        compareText(
          `${left.field}\u0000${left.sourceTerm}`,
          `${right.field}\u0000${right.sourceTerm}`,
        ),
      ),
    },
    qaFindings: qaSummary(findings),
    lvrsTopicScopeFindings: exactLvrsFindings(findings),
    notAssessableStudyDesign: {
      adequateAbstractCandidateRows: notAssessableRows.filter(
        (row, index) =>
          row.metadata_sufficiency === 'adequate_abstract' && candidateSets[index].length > 0,
      ).length,
      candidateResolvableRows,
      total: notAssessableRows.length,
      externalQaReportedTotal: externalQaReportedNotAssessable ?? null,
      differenceFromExternalQaReport:
        externalQaReportedNotAssessable === undefined
          ? null
          : notAssessableRows.length - externalQaReportedNotAssessable,
      byMetadataSufficiency: countValues(
        notAssessableRows.map((row) => row.metadata_sufficiency.trim().toLowerCase() || '(blank)'),
      ),
      deterministicKeywordCandidates: Object.fromEntries(
        Object.entries(candidateCounts).sort(([left], [right]) => compareText(left, right)),
      ),
      multipleCandidateRows: candidateSets.filter((candidates) => candidates.length > 1).length,
      unresolvedRows: unresolvedCandidateRows,
    },
    optionalBlankTags: {
      disease_tags: blankOptionalTagClassification(prior.rows, 'disease_tags'),
      technology_tags: blankOptionalTagClassification(prior.rows, 'technology_tags'),
    },
    vocabularyCoverage: {
      current: currentCoverage,
      projected: projectedVocabulary(currentCoverage, config),
    },
    deferredProposals: config.proposals
      .filter((proposal) => proposal.decision === 'defer')
      .map((proposal) => ({
        field: proposal.field,
        proposalId: proposal.proposal_id,
        proposedId: proposal.proposed_id,
        rationale: proposal.rationale,
      })),
    migrationCompleteness: {
      adjudicationRequiredMappings: config.migration_mappings.filter(
        (mapping) => !mapping.automatic,
      ).length,
      automaticMappings: 0,
      configuredMappings: config.migration_mappings.length,
      decisions: countValues(config.proposals.map((proposal) => proposal.decision)),
      developmentRowsInUpgradePlan: upgradePlan.rows.length,
      mappingTypes: countValues(config.migration_mappings.map((mapping) => mapping.mapping_type)),
      missingMappings: mappingCompleteness.missingMappings,
      proposals: config.proposals.length,
      rowChangesApplied: 0,
    },
    safety: {
      databaseAccesses: 0,
      databaseMutations: 0,
      developmentOnly: true,
      heldOutTestAccesses: 0,
      importRows: 0,
      networkAccesses: 0,
      physicianDecisionsChanged: false,
      sourceMutations: 0,
      taxonomyMutations: 0,
    },
  }
  return { report, upgradePlan }
}

function decodeXml(value: string) {
  return value.replace(/&#(x?[0-9a-f]+);|&(amp|lt|gt|quot|apos);/giu, (entity, numeric, named) => {
    if (numeric) {
      const radix = String(numeric).toLowerCase().startsWith('x') ? 16 : 10
      const digits = radix === 16 ? String(numeric).slice(1) : String(numeric)
      return String.fromCodePoint(Number.parseInt(digits, radix))
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" } as Record<string, string>)[
      String(named).toLowerCase()
    ]
  })
}

function xmlAttribute(fragment: string, name: string) {
  const match = fragment.match(new RegExp(`\\b${name}="([^"]*)"`, 'u'))
  return match ? decodeXml(match[1]) : null
}

async function xlsxSheetRows(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  const text = async (path: string) => {
    const entry = zip.file(path)
    if (!entry) throw new Error(`QA workbook is missing ${path}.`)
    return entry.async('string')
  }
  const sharedStringsEntry = zip.file('xl/sharedStrings.xml')
  const sharedStrings = sharedStringsEntry
    ? [...(await sharedStringsEntry.async('string')).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gu)].map(
        (match) =>
          [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)]
            .map((textMatch) => decodeXml(textMatch[1]))
            .join(''),
      )
    : []
  const workbookXml = await text('xl/workbook.xml')
  const relationshipsXml = await text('xl/_rels/workbook.xml.rels')
  const relationships = new Map(
    [...relationshipsXml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gu)].map((match) => [
      xmlAttribute(match[1], 'Id') ?? '',
      xmlAttribute(match[1], 'Target') ?? '',
    ]),
  )
  const sheets = new Map<string, Map<number, Record<string, string>>>()
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?\s*>/gu)) {
    const name = xmlAttribute(match[1], 'name')
    const relationshipId = xmlAttribute(match[1], 'r:id')
    if (!name || !relationshipId) continue
    const target = relationships.get(relationshipId)
    if (!target) throw new Error(`QA workbook sheet ${name} has no relationship target.`)
    const sheetPath = target.startsWith('/')
      ? target.slice(1)
      : target.startsWith('xl/')
        ? target
        : `xl/${target}`
    const sheetXml = await text(sheetPath)
    const rows = new Map<number, Record<string, string>>()
    for (const rowMatch of sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/gu)) {
      const rowNumber = Number(xmlAttribute(rowMatch[1], 'r'))
      const cells: Record<string, string> = {}
      for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gu)) {
        const reference = xmlAttribute(cellMatch[1], 'r')
        if (!reference) continue
        const column = reference.match(/^[A-Z]+/u)?.[0]
        if (!column) continue
        const type = xmlAttribute(cellMatch[1], 't')
        const value = cellMatch[2].match(/<v>([\s\S]*?)<\/v>/u)?.[1] ?? ''
        const inline = [...cellMatch[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)]
          .map((textMatch) => decodeXml(textMatch[1]))
          .join('')
        cells[column] =
          type === 's'
            ? (sharedStrings[Number(value)] ?? '')
            : type === 'inlineStr'
              ? inline
              : decodeXml(value)
      }
      rows.set(rowNumber, cells)
    }
    sheets.set(name, rows)
  }
  return sheets
}

function numericCell(value: string, label: string) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} must be a count.`)
  return number
}

export function parseQaExampleMasterRowIds(value: string) {
  if (/^\s*\d+\s+articles\s*$/iu.test(value)) return []
  return sortedUnique(
    value
      .split(/[^0-9]+/u)
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

export async function parseQaVocabularyWorkbook(
  bytes: Uint8Array,
  artifact: 'QA_review_1' | 'QA_review_2',
) {
  const sheets = await xlsxSheetRows(bytes)
  if (artifact === 'QA_review_1') {
    const rows = sheets.get('Vocabulary Gaps')
    if (!rows) throw new Error('QA review 1 is missing Vocabulary Gaps.')
    return [...rows.entries()].flatMap(([rowNumber, row]) =>
      rowNumber >= 2 && rowNumber <= 16 && row.A && row.B
        ? [
            {
              artifact,
              field: row.B,
              sourceTerm: row.A,
              indicativeCount: numericCell(row.C, `QA review 1 row ${rowNumber} count`),
              titleCount: numericCell(row.D, `QA review 1 row ${rowNumber} title count`),
              exampleMasterRowIds: [],
            } satisfies QaVocabularyEvidence,
          ]
        : [],
    )
  }
  const rows = sheets.get('Vocabulary_Gaps')
  if (!rows) throw new Error('QA review 2 is missing Vocabulary_Gaps.')
  return [...rows.entries()].flatMap(([rowNumber, row]) =>
    rowNumber >= 5 && rowNumber <= 26 && row.A && row.B
      ? [
          {
            artifact,
            field: row.A,
            sourceTerm: row.B,
            indicativeCount: numericCell(row.C, `QA review 2 row ${rowNumber} count`),
            titleCount: null,
            exampleMasterRowIds: parseQaExampleMasterRowIds(row.E ?? ''),
          } satisfies QaVocabularyEvidence,
        ]
      : [],
  )
}

export function assertTaxonomyV2DevelopmentOnlyInputPath(
  inputPath: string,
  optionName: string,
  extensions: readonly string[],
) {
  const absolutePath = resolve(inputPath)
  if (FORBIDDEN_SPLIT_PATH_TOKEN.test(absolutePath)) {
    throw new Error(
      `Refusing to access ${optionName}: path has held-out, test, or all-split semantics.`,
    )
  }
  if (!extensions.includes(extname(absolutePath).toLowerCase())) {
    throw new Error(`${optionName} must use one of: ${extensions.join(', ')}.`)
  }
  return absolutePath
}

async function lstatIfPresent(path: string) {
  try {
    return await lstat(path)
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function requireRegularInput(path: string, optionName: string) {
  const metadata = await lstatIfPresent(path)
  if (!metadata?.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`${optionName} must be an existing, non-symlink regular file.`)
  }
}

function isWithinDirectory(root: string, candidate: string) {
  const fromRoot = relative(root, candidate)
  return (
    fromRoot === '' ||
    (!isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`))
  )
}

function isWithinDirectoryCaseInsensitive(root: string, candidate: string) {
  return isWithinDirectory(
    resolve(root).normalize('NFC').toLowerCase(),
    resolve(candidate).normalize('NFC').toLowerCase(),
  )
}

export async function assertTaxonomyV2AuditOutputPath(
  path: string,
  workspaceRoot: string,
  inputPaths: readonly string[],
  optionName: string,
) {
  const outputPath = resolve(path)
  const localDataRoot = resolve(workspaceRoot, 'local-data')
  if (!isWithinDirectory(localDataRoot, outputPath)) {
    throw new Error(`${optionName} must remain under the repository local-data tree.`)
  }
  if (isWithinDirectoryCaseInsensitive(resolve(localDataRoot, 'inputs'), outputPath)) {
    throw new Error(`${optionName} must not be written under read-only local-data/inputs.`)
  }
  if (extname(outputPath).toLowerCase() !== '.json') {
    throw new Error(`${optionName} must use the .json extension.`)
  }
  if (inputPaths.includes(outputPath))
    throw new Error(`${optionName} must not collide with an input.`)
  const rootMetadata = await lstatIfPresent(localDataRoot)
  if (!rootMetadata?.isDirectory() || rootMetadata.isSymbolicLink()) {
    throw new Error('Repository local-data must exist as a non-symlink directory.')
  }
  let current = localDataRoot
  for (const segment of relative(localDataRoot, dirname(outputPath)).split(sep).filter(Boolean)) {
    current = resolve(current, segment)
    const metadata = await lstatIfPresent(current)
    if (!metadata) break
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw new Error(`${optionName} must not traverse a symlink or non-directory component.`)
    }
  }
  return outputPath
}

async function writeExclusiveOutputs(outputs: Array<{ path: string; value: string }>) {
  const handles: Array<{ handle: Awaited<ReturnType<typeof open>>; path: string }> = []
  try {
    for (const output of outputs) {
      await mkdir(dirname(output.path), { recursive: true })
      handles.push({ handle: await open(output.path, 'wx'), path: output.path })
    }
    await Promise.all(
      handles.map(({ handle }, index) =>
        handle.writeFile(outputs[index].value, { encoding: 'utf8' }),
      ),
    )
  } catch (error: unknown) {
    await Promise.allSettled(handles.map(({ handle }) => handle.close()))
    await Promise.allSettled(handles.map(({ path }) => unlink(path)))
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('Refusing to overwrite an existing taxonomy V2 audit output.')
    }
    throw error
  }
  await Promise.all(handles.map(({ handle }) => handle.close()))
}

export async function runTaxonomyV2Audit(
  options: RunTaxonomyV2AuditOptions,
): Promise<RunTaxonomyV2AuditResult> {
  const paths = {
    canonicalReceipt: assertTaxonomyV2DevelopmentOnlyInputPath(
      options.canonicalReceiptPath,
      '--canonical-receipt',
      ['.json'],
    ),
    canonicalSource: assertTaxonomyV2DevelopmentOnlyInputPath(
      options.canonicalSourcePath,
      '--canonical-source',
      ['.csv'],
    ),
    priorEnrichment: assertTaxonomyV2DevelopmentOnlyInputPath(
      options.priorEnrichmentPath,
      '--prior-enrichment',
      ['.csv'],
    ),
    qaFindings: assertTaxonomyV2DevelopmentOnlyInputPath(options.qaFindingsPath, '--qa-findings', [
      '.csv',
    ]),
    qaReview1: assertTaxonomyV2DevelopmentOnlyInputPath(options.qaReview1Path, '--qa-review-1', [
      '.xlsx',
    ]),
    qaReview2: assertTaxonomyV2DevelopmentOnlyInputPath(options.qaReview2Path, '--qa-review-2', [
      '.xlsx',
    ]),
    qaVocabulary: assertTaxonomyV2DevelopmentOnlyInputPath(
      options.qaVocabularyPath,
      '--qa-vocabulary',
      ['.json'],
    ),
  }
  const inputPaths = Object.values(paths)
  if (new Set(inputPaths).size !== inputPaths.length) {
    throw new Error('Every taxonomy V2 audit input must be a distinct file.')
  }
  await Promise.all(
    Object.entries(paths).map(([name, path]) => requireRegularInput(path, `--${name}`)),
  )
  const [
    canonicalReceiptJson,
    canonicalSourceCsv,
    priorEnrichmentCsv,
    findingsCsv,
    qa1,
    qa2,
    qaVocabularyJson,
  ] = await Promise.all([
    readFile(paths.canonicalReceipt, 'utf8'),
    readFile(paths.canonicalSource, 'utf8'),
    readFile(paths.priorEnrichment, 'utf8'),
    readFile(paths.qaFindings, 'utf8'),
    readFile(paths.qaReview1),
    readFile(paths.qaReview2),
    readFile(paths.qaVocabulary, 'utf8'),
  ])
  const expectedProvenance = options.expectedProvenance ?? CANONICAL_TAXONOMY_V2_PROVENANCE
  const qaWorkbookHashes = assertTaxonomyV2QaWorkbookHashesBeforeParse(qa1, qa2, expectedProvenance)
  const [qaReview1Evidence, qaReview2Evidence] = await Promise.all([
    parseQaVocabularyWorkbook(qa1, 'QA_review_1'),
    parseQaVocabularyWorkbook(qa2, 'QA_review_2'),
  ])
  const result = buildTaxonomyV2Audit({
    canonicalReceiptJson,
    canonicalSourceCsv,
    expectedProvenance,
    findingsCsv,
    priorEnrichmentCsv,
    qaReview1Evidence,
    qaReview1Sha256: qaWorkbookHashes.qaReview1Sha256,
    qaReview2Evidence,
    qaReview2Sha256: qaWorkbookHashes.qaReview2Sha256,
    qaVocabularyJson,
    sourceMetadata: {
      canonicalReceipt: {
        path: paths.canonicalReceipt,
        size: Buffer.byteLength(canonicalReceiptJson),
      },
      canonicalSource: { path: paths.canonicalSource, size: Buffer.byteLength(canonicalSourceCsv) },
      priorEnrichment: { path: paths.priorEnrichment, size: Buffer.byteLength(priorEnrichmentCsv) },
      qaFindings: { path: paths.qaFindings, size: Buffer.byteLength(findingsCsv) },
      qaReview1: { path: paths.qaReview1, size: qa1.byteLength },
      qaReview2: { path: paths.qaReview2, size: qa2.byteLength },
      qaVocabulary: { path: paths.qaVocabulary, size: Buffer.byteLength(qaVocabularyJson) },
    },
  })
  const reread = await Promise.all(inputPaths.map((path) => readFile(path)))
  const beforeHashes = [
    sha256(canonicalReceiptJson),
    sha256(canonicalSourceCsv),
    sha256(priorEnrichmentCsv),
    sha256(findingsCsv),
    sha256(qa1),
    sha256(qa2),
    sha256(qaVocabularyJson),
  ]
  if (reread.some((bytes, index) => sha256(bytes) !== beforeHashes[index])) {
    throw new Error('An input changed during the read-only taxonomy V2 audit; no output written.')
  }
  const workspaceRoot = resolve(options.workspaceRoot ?? process.cwd())
  const [outputPath, upgradePlanOutputPath] = await Promise.all([
    assertTaxonomyV2AuditOutputPath(options.outputPath, workspaceRoot, inputPaths, '--output'),
    assertTaxonomyV2AuditOutputPath(
      options.upgradePlanOutputPath,
      workspaceRoot,
      inputPaths,
      '--upgrade-plan-output',
    ),
  ])
  if (outputPath === upgradePlanOutputPath)
    throw new Error('Audit and upgrade-plan outputs must differ.')
  await writeExclusiveOutputs([
    { path: outputPath, value: serializeTaxonomyV2Json(result.report) },
    { path: upgradePlanOutputPath, value: serializeTaxonomyV2Json(result.upgradePlan) },
  ])
  return { outputPath, upgradePlanOutputPath, ...result }
}
