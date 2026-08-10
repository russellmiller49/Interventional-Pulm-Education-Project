import { createHash } from 'node:crypto'

import {
  parseCompensationReceiptV2,
  parseImportReceiptV2,
  type CompensationReceiptV2,
  type ImportReceiptV2,
} from '../../src/features/literature/gold-set/import-compensation-v2'

import { canonicalJson } from './gold-import-compensation-rehearsal-evidence'

export const GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2 =
  'gold-review-import-compensation/2.0.0' as const
export const GOLD_IMPORT_COMPENSATION_MIGRATION_V1 =
  '20260808035633_add_literature_gold_import_compensation_contract' as const
export const GOLD_IMPORT_COMPENSATION_MIGRATION_V2 =
  '20260809231651_add_literature_gold_import_compensation_contract_v2' as const
export const GOLD_IMPORT_COMPENSATION_VERIFICATION_V1 =
  '20260808035633_verify_literature_gold_import_compensation_contract.sql' as const
export const GOLD_IMPORT_COMPENSATION_VERIFICATION_V2 =
  '20260809231651_verify_literature_gold_import_compensation_contract_v2.sql' as const
export const V2_REHEARSAL_EVIDENCE_MARKER = 'V2_REHEARSAL_EVIDENCE_JSON:' as const
export const V2_REHEARSAL_SCHEMA_VERSION =
  'gold-import-compensation-disposable-rehearsal/2.0.0' as const
export const V2_CANONICAL_EVIDENCE_SCHEMA_VERSION =
  'gold-import-compensation-disposable-rehearsal-canonical/2.0.0' as const
export const NOTE_DISPOSITION_AUDIT_SHA256 =
  '89477e3f9f673e4a9d7cad20395ad7f2b6b00c05a993c50969527f985061a915' as const

export const HISTORICAL_LITERATURE_MIGRATIONS = [
  '20260727032621_add_literature_explorer.sql',
  '20260727164510_add_literature_gold_set.sql',
  '20260727190000_add_literature_gold_review_categories.sql',
  '20260727193432_add_literature_full_text_categorization_flag.sql',
  '20260728170939_add_interactive_clinical_case_publication_status.sql',
  '20260728171212_add_immune_inflammatory_disease_tag.sql',
  '20260728174726_add_safety_complication_prevention_clinical_purpose.sql',
  '20260730194025_add_literature_gold_test_unlock.sql',
] as const

export const CONTRACT_MIGRATIONS = [
  `${GOLD_IMPORT_COMPENSATION_MIGRATION_V1}.sql`,
  `${GOLD_IMPORT_COMPENSATION_MIGRATION_V2}.sql`,
] as const

export const REQUIRED_TRANSITION_RPCS_V2 = [
  'apply_literature_gold_import_v2',
  'compensate_literature_gold_import_v2',
  'reconcile_literature_gold_review_operation_v2',
] as const

export const REQUIRED_TRANSITION_RPCS_V1 = [
  'apply_literature_gold_import_v1',
  'compensate_literature_gold_import_v1',
  'reconcile_literature_gold_review_operation_v1',
] as const

export const REQUIRED_V2_SEMANTIC_FUNCTIONS = [
  'apply_literature_gold_import_v2',
  'compensate_literature_gold_import_v2',
  'enforce_literature_gold_operation_contract_v2',
  'enforce_literature_gold_review_contract_v2',
  'literature_gold_review_clinical_projection_v2',
  'literature_gold_effective_state_hash_v2',
  'literature_gold_physical_state_hash_v2',
  'literature_gold_review_operation_receipt_v2',
  'literature_gold_review_operation_result_v2',
  'reconcile_literature_gold_review_operation_v2',
  'validate_literature_gold_import_review_payload_v2',
  'validate_literature_gold_operation_authorization_v2',
  'validate_literature_gold_operation_plan_v2',
] as const

export type V2MigrationPath = 'fresh' | 'upgrade'
export type V2ActionKind = 'import_initial' | 'import_revision' | 'import_noop'

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const SAFE_SEARCH_PATH = 'pg_catalog, public, extensions'
const RPC_ARGUMENTS: Readonly<Record<string, string>> = {
  apply_literature_gold_import_v1:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  apply_literature_gold_import_v2:
    'p_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v1:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  compensate_literature_gold_import_v2:
    'p_operation_id uuid, p_target_import_operation_id uuid, p_idempotency_key text, p_batch_id uuid, p_artifact_sha256 text, p_plan_sha256 text, p_plan jsonb, p_authorization_sha256 text, p_authorization jsonb, p_actor_user_id uuid, p_actor_email text',
  reconcile_literature_gold_review_operation_v1:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
  reconcile_literature_gold_review_operation_v2:
    'p_operation_id uuid, p_recovery_authorization_sha256 text, p_recovery_authorization jsonb',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`)
  return value
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a nonempty string.`)
  }
  return value
}

function sha256(value: unknown, label: string): string {
  const parsed = string(value, label)
  if (!SHA256_PATTERN.test(parsed)) throw new Error(`${label} must be a lowercase SHA-256.`)
  return parsed
}

function integer(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a nonnegative integer.`)
  }
  return value as number
}

function literalTrue(value: unknown, label: string): true {
  if (value !== true) throw new Error(`${label} must be true.`)
  return true
}

function literalFalse(value: unknown, label: string): false {
  if (value !== false) throw new Error(`${label} must be false.`)
  return false
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  return string(value, label)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has unexpected or missing keys.`)
  }
}

export interface V2SchemaOnlySnapshot {
  actionCount: number
  actionRowsSha256: string
  automatedRevealStateSha256: string
  batchCount: number
  batchRowsSha256: string
  draftCount: number
  draftRowsSha256: string
  effectiveStateSha256V1: string
  eventCount: number
  eventRowsSha256: string
  itemCount: number
  itemRowsSha256: string
  membershipSha256: string
  operationCount: number
  operationRowsSha256: string
  physicalStateSha256V1: string
  planningStateSha256: string
  pointerStateSha256: string
  reviewCount: number
  reviewRowsSha256: string
  supplementalRevealStateSha256: string
}

export function validateV2SchemaOnlySnapshot(
  value: unknown,
  label = 'V2 schema-only snapshot',
): V2SchemaOnlySnapshot {
  const parsed = record(value, label)
  const keys = [
    'actionCount',
    'actionRowsSha256',
    'automatedRevealStateSha256',
    'batchCount',
    'batchRowsSha256',
    'draftCount',
    'draftRowsSha256',
    'effectiveStateSha256V1',
    'eventCount',
    'eventRowsSha256',
    'itemCount',
    'itemRowsSha256',
    'membershipSha256',
    'operationCount',
    'operationRowsSha256',
    'physicalStateSha256V1',
    'planningStateSha256',
    'pointerStateSha256',
    'reviewCount',
    'reviewRowsSha256',
    'supplementalRevealStateSha256',
  ] as const
  exactKeys(parsed, keys, label)
  return {
    actionCount: integer(parsed.actionCount, `${label}.actionCount`),
    actionRowsSha256: sha256(parsed.actionRowsSha256, `${label}.actionRowsSha256`),
    automatedRevealStateSha256: sha256(
      parsed.automatedRevealStateSha256,
      `${label}.automatedRevealStateSha256`,
    ),
    batchCount: integer(parsed.batchCount, `${label}.batchCount`),
    batchRowsSha256: sha256(parsed.batchRowsSha256, `${label}.batchRowsSha256`),
    draftCount: integer(parsed.draftCount, `${label}.draftCount`),
    draftRowsSha256: sha256(parsed.draftRowsSha256, `${label}.draftRowsSha256`),
    effectiveStateSha256V1: sha256(
      parsed.effectiveStateSha256V1,
      `${label}.effectiveStateSha256V1`,
    ),
    eventCount: integer(parsed.eventCount, `${label}.eventCount`),
    eventRowsSha256: sha256(parsed.eventRowsSha256, `${label}.eventRowsSha256`),
    itemCount: integer(parsed.itemCount, `${label}.itemCount`),
    itemRowsSha256: sha256(parsed.itemRowsSha256, `${label}.itemRowsSha256`),
    membershipSha256: sha256(parsed.membershipSha256, `${label}.membershipSha256`),
    operationCount: integer(parsed.operationCount, `${label}.operationCount`),
    operationRowsSha256: sha256(parsed.operationRowsSha256, `${label}.operationRowsSha256`),
    physicalStateSha256V1: sha256(parsed.physicalStateSha256V1, `${label}.physicalStateSha256V1`),
    planningStateSha256: sha256(parsed.planningStateSha256, `${label}.planningStateSha256`),
    pointerStateSha256: sha256(parsed.pointerStateSha256, `${label}.pointerStateSha256`),
    reviewCount: integer(parsed.reviewCount, `${label}.reviewCount`),
    reviewRowsSha256: sha256(parsed.reviewRowsSha256, `${label}.reviewRowsSha256`),
    supplementalRevealStateSha256: sha256(
      parsed.supplementalRevealStateSha256,
      `${label}.supplementalRevealStateSha256`,
    ),
  }
}

export function assertV2SchemaOnlyUpgradePreserved(input: {
  after: unknown
  before: unknown
}): V2SchemaOnlyUpgradeProof {
  const before = validateV2SchemaOnlySnapshot(input.before, 'pre-V2 upgrade snapshot')
  const after = validateV2SchemaOnlySnapshot(input.after, 'post-V2 upgrade snapshot')
  const permittedSchemaDerivedField: keyof V2SchemaOnlySnapshot = 'physicalStateSha256V1'
  const changed = Object.keys(before).filter(
    (key) => before[key as keyof V2SchemaOnlySnapshot] !== after[key as keyof V2SchemaOnlySnapshot],
  ) as Array<keyof V2SchemaOnlySnapshot>
  const prohibitedChanges = changed.filter((key) => key !== permittedSchemaDerivedField)
  if (prohibitedChanges.length > 0) {
    throw new Error(
      `V2 schema-only upgrade mutated protected state: ${prohibitedChanges.join(', ')}.`,
    )
  }
  const schemaAffectedRows = before.reviewCount + before.operationCount
  const physicalHashChanged = changed.includes(permittedSchemaDerivedField)
  if (schemaAffectedRows > 0 && !physicalHashChanged) {
    throw new Error(
      'V2 schema-only upgrade did not expose the required schema-derived V1 physical hash delta.',
    )
  }
  if (schemaAffectedRows === 0 && physicalHashChanged) {
    throw new Error('V1 physical hash changed without any row that receives a V2 column.')
  }
  return {
    after,
    before,
    v1PhysicalStateHashChanged: physicalHashChanged,
    v1PhysicalStateHashRule:
      'V1 physical hash serializes whole review/operation rows; only new nullable V2 columns may change it, while explicit row projections remain identical.',
  }
}

export interface V2SchemaOnlyUpgradeProof {
  after: V2SchemaOnlySnapshot
  before: V2SchemaOnlySnapshot
  v1PhysicalStateHashChanged: boolean
  v1PhysicalStateHashRule: 'V1 physical hash serializes whole review/operation rows; only new nullable V2 columns may change it, while explicit row projections remain identical.'
}

/**
 * Kept separate from the V1 physical hash because that historical function
 * intentionally uses to_jsonb(review/operation) and therefore observes the
 * addition of nullable V2 columns even when PostgreSQL updates no row.
 */
export function v2SchemaOnlyMutationProjection(value: V2SchemaOnlySnapshot) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'physicalStateSha256V1'),
  )
}

export interface V2RpcMetadata {
  authenticatedExecute: boolean
  identityArguments: string
  name: string
  owner: 'postgres' | 'supabase_admin'
  publicExecute: boolean
  resultType: string
  searchPath: string
  securityDefiner: boolean
  serviceRoleExecute: boolean
  volatility: string
  anonExecute: boolean
}

export function validateV2RpcMetadata(
  value: unknown,
  ownerProfile: 'postgres' | 'supabase_admin',
): V2RpcMetadata[] {
  const rows = array(record(value, 'V2 RPC metadata').functions, 'V2 RPC metadata.functions')
  const requiredNames = [...REQUIRED_TRANSITION_RPCS_V1, ...REQUIRED_TRANSITION_RPCS_V2].sort()
  const parsed = rows.map((entry, index): V2RpcMetadata => {
    const row = record(entry, `V2 RPC metadata.functions[${index}]`)
    const name = string(row.name, `V2 RPC metadata.functions[${index}].name`)
    const owner = string(row.owner, `V2 RPC metadata.functions[${index}].owner`)
    if (owner !== ownerProfile) throw new Error(`Unexpected owner for ${name}: ${owner}.`)
    return {
      anonExecute: row.anonExecute === true,
      authenticatedExecute: row.authenticatedExecute === true,
      identityArguments: string(row.identityArguments, `${name}.identityArguments`),
      name,
      owner,
      publicExecute: row.publicExecute === true,
      resultType: string(row.resultType, `${name}.resultType`),
      searchPath: string(row.searchPath, `${name}.searchPath`),
      securityDefiner: row.securityDefiner === true,
      serviceRoleExecute: row.serviceRoleExecute === true,
      volatility: string(row.volatility, `${name}.volatility`),
    }
  })
  const actualNames = parsed.map(({ name }) => name).sort()
  if (JSON.stringify(actualNames) !== JSON.stringify(requiredNames)) {
    throw new Error('V1/V2 transition RPC overload set changed unexpectedly.')
  }
  for (const row of parsed) {
    const expectedArguments = RPC_ARGUMENTS[row.name]
    const expectedVolatility = row.name.startsWith('reconcile_') ? 's' : 'v'
    if (
      !expectedArguments ||
      row.identityArguments !== expectedArguments ||
      row.resultType !== 'jsonb' ||
      row.volatility !== expectedVolatility ||
      row.searchPath !== SAFE_SEARCH_PATH ||
      row.securityDefiner !== true ||
      row.publicExecute ||
      row.anonExecute ||
      row.authenticatedExecute ||
      !row.serviceRoleExecute
    ) {
      throw new Error(`Unsafe or changed transition RPC contract for ${row.name}.`)
    }
  }
  return parsed.sort((left, right) => left.name.localeCompare(right.name, 'en'))
}

export interface V2CohortRowEvidence {
  action: V2ActionKind
  actionIdentitySha256: string
  automatedSignalsRevealedAtAfter: string | null
  automatedSignalsRevealedAtBefore: string | null
  categorizationFromFullText: boolean
  clinicalPurposeCount: number
  diseaseStatus: string | null
  diseaseTagCount: number
  fullTextUsed: boolean
  importedReviewPersisted: boolean
  isBlinded: false
  noteDisposition: 'amended_authorized_rationale' | 'finalized_v3'
  noteSha256: string
  relevanceLabel: 'exclude' | 'include_adjacent' | 'include_core' | 'uncertain'
  requiredNoteSha256: string
  studyDesign: string | null
  publicationStatus: string | null
  supplementalMetadataRevealedAtAfter: string | null
  supplementalMetadataRevealedAtBefore: string | null
  technologyStatus: string | null
  technologyTagCount: number
  topicCount: number
  usedSupplementalMetadataAfter: boolean
  usedSupplementalMetadataBefore: boolean | null
}

function parseCohortRow(value: unknown, index: number): V2CohortRowEvidence {
  const label = `productionCohort.rows[${index}]`
  const row = record(value, label)
  exactKeys(
    row,
    [
      'action',
      'actionIdentitySha256',
      'automatedSignalsRevealedAtAfter',
      'automatedSignalsRevealedAtBefore',
      'categorizationFromFullText',
      'clinicalPurposeCount',
      'diseaseStatus',
      'diseaseTagCount',
      'fullTextUsed',
      'importedReviewPersisted',
      'isBlinded',
      'noteDisposition',
      'noteSha256',
      'publicationStatus',
      'relevanceLabel',
      'requiredNoteSha256',
      'studyDesign',
      'supplementalMetadataRevealedAtAfter',
      'supplementalMetadataRevealedAtBefore',
      'technologyStatus',
      'technologyTagCount',
      'topicCount',
      'usedSupplementalMetadataAfter',
      'usedSupplementalMetadataBefore',
    ],
    label,
  )
  if (!['import_initial', 'import_revision', 'import_noop'].includes(String(row.action))) {
    throw new Error(`${label}.action is invalid.`)
  }
  if (typeof row.fullTextUsed !== 'boolean') throw new Error(`${label}.fullTextUsed is invalid.`)
  if (typeof row.categorizationFromFullText !== 'boolean') {
    throw new Error(`${label}.categorizationFromFullText is invalid.`)
  }
  if (typeof row.usedSupplementalMetadataAfter !== 'boolean') {
    throw new Error(`${label}.usedSupplementalMetadataAfter is invalid.`)
  }
  if (
    row.usedSupplementalMetadataBefore !== null &&
    typeof row.usedSupplementalMetadataBefore !== 'boolean'
  ) {
    throw new Error(`${label}.usedSupplementalMetadataBefore is invalid.`)
  }
  const noteDisposition = String(row.noteDisposition)
  if (!['amended_authorized_rationale', 'finalized_v3'].includes(noteDisposition)) {
    throw new Error(`${label}.noteDisposition is invalid.`)
  }
  const relevanceLabel = String(row.relevanceLabel)
  if (!['exclude', 'include_adjacent', 'include_core', 'uncertain'].includes(relevanceLabel)) {
    throw new Error(`${label}.relevanceLabel is invalid.`)
  }
  return {
    action: row.action as V2ActionKind,
    actionIdentitySha256: sha256(row.actionIdentitySha256, `${label}.actionIdentitySha256`),
    automatedSignalsRevealedAtAfter: nullableString(
      row.automatedSignalsRevealedAtAfter,
      `${label}.automatedSignalsRevealedAtAfter`,
    ),
    automatedSignalsRevealedAtBefore: nullableString(
      row.automatedSignalsRevealedAtBefore,
      `${label}.automatedSignalsRevealedAtBefore`,
    ),
    categorizationFromFullText: row.categorizationFromFullText,
    clinicalPurposeCount: integer(row.clinicalPurposeCount, `${label}.clinicalPurposeCount`),
    diseaseStatus: nullableString(row.diseaseStatus, `${label}.diseaseStatus`),
    diseaseTagCount: integer(row.diseaseTagCount, `${label}.diseaseTagCount`),
    fullTextUsed: row.fullTextUsed,
    importedReviewPersisted:
      typeof row.importedReviewPersisted === 'boolean'
        ? row.importedReviewPersisted
        : (() => {
            throw new Error(`${label}.importedReviewPersisted must be boolean.`)
          })(),
    isBlinded: literalFalse(row.isBlinded, `${label}.isBlinded`),
    noteDisposition: noteDisposition as V2CohortRowEvidence['noteDisposition'],
    noteSha256: sha256(row.noteSha256, `${label}.noteSha256`),
    publicationStatus: nullableString(row.publicationStatus, `${label}.publicationStatus`),
    relevanceLabel: relevanceLabel as V2CohortRowEvidence['relevanceLabel'],
    requiredNoteSha256: sha256(row.requiredNoteSha256, `${label}.requiredNoteSha256`),
    studyDesign: nullableString(row.studyDesign, `${label}.studyDesign`),
    supplementalMetadataRevealedAtAfter: nullableString(
      row.supplementalMetadataRevealedAtAfter,
      `${label}.supplementalMetadataRevealedAtAfter`,
    ),
    supplementalMetadataRevealedAtBefore: nullableString(
      row.supplementalMetadataRevealedAtBefore,
      `${label}.supplementalMetadataRevealedAtBefore`,
    ),
    technologyStatus: nullableString(row.technologyStatus, `${label}.technologyStatus`),
    technologyTagCount: integer(row.technologyTagCount, `${label}.technologyTagCount`),
    topicCount: integer(row.topicCount, `${label}.topicCount`),
    usedSupplementalMetadataAfter: row.usedSupplementalMetadataAfter,
    usedSupplementalMetadataBefore: row.usedSupplementalMetadataBefore,
  }
}

export interface V2DynamicActionCounts {
  initial: number
  inserts: number
  noops: number
  revisions: number
  total: number
}

export function deriveV2DynamicActionCounts(
  rows: readonly Pick<V2CohortRowEvidence, 'action'>[],
): V2DynamicActionCounts {
  const initial = rows.filter(({ action }) => action === 'import_initial').length
  const revisions = rows.filter(({ action }) => action === 'import_revision').length
  const noops = rows.filter(({ action }) => action === 'import_noop').length
  return { initial, inserts: initial + revisions, noops, revisions, total: rows.length }
}

export interface ValidatedV2ProductionCohort {
  actionCounts: V2DynamicActionCounts
  amendedNoteCount: 2
  falseFullTextCount: 580
  falseIsBlindedCount: 630
  nullDiseaseStatusCount: 272
  nullTechnologyStatusCount: 272
  noteDispositionAuditSha256: typeof NOTE_DISPOSITION_AUDIT_SHA256
  rows: V2CohortRowEvidence[]
  trueFullTextCount: 50
}

export function validateV2ProductionCohort(value: unknown): ValidatedV2ProductionCohort {
  const cohort = record(value, 'productionCohort')
  exactKeys(cohort, ['noteDispositionAuditSha256', 'rows'], 'productionCohort')
  if (cohort.noteDispositionAuditSha256 !== NOTE_DISPOSITION_AUDIT_SHA256) {
    throw new Error('Production cohort is not bound to the exact note-disposition audit.')
  }
  const rows = array(cohort.rows, 'productionCohort.rows').map(parseCohortRow)
  const actionIdentities = new Set(rows.map(({ actionIdentitySha256 }) => actionIdentitySha256))
  if (rows.length !== 630 || actionIdentities.size !== rows.length) {
    throw new Error(
      'Production cohort must contain exactly 630 unique dynamically derived actions.',
    )
  }
  const actionCounts = deriveV2DynamicActionCounts(rows)
  if (actionCounts.initial + actionCounts.revisions + actionCounts.noops !== actionCounts.total) {
    throw new Error('Dynamic action partition does not cover the production cohort.')
  }
  if (
    rows.some(
      ({ action, importedReviewPersisted }) =>
        importedReviewPersisted !== (action !== 'import_noop'),
    )
  ) {
    throw new Error('V2 production action persistence does not match its dynamic disposition.')
  }
  const trueFullTextCount = rows.filter(({ fullTextUsed }) => fullTextUsed).length
  const falseFullTextCount = rows.filter(({ fullTextUsed }) => !fullTextUsed).length
  if (trueFullTextCount !== 50 || falseFullTextCount !== 580) {
    throw new Error('V2 full-text persistence cohort is not exactly 50 true / 580 false.')
  }
  const nullTechnologyRows = rows.filter(({ technologyStatus }) => technologyStatus === null)
  const nullDiseaseRows = rows.filter(({ diseaseStatus }) => diseaseStatus === null)
  if (nullTechnologyRows.length !== 272 || nullDiseaseRows.length !== 272) {
    throw new Error('V2 source-null tag status cohort is not exactly 272 / 272.')
  }
  for (const [index, row] of rows.entries()) {
    const label = `productionCohort.rows[${index}]`
    const excluded = row.technologyStatus === null || row.diseaseStatus === null
    if (excluded) {
      if (
        row.technologyStatus !== null ||
        row.diseaseStatus !== null ||
        row.topicCount !== 0 ||
        row.technologyTagCount !== 0 ||
        row.clinicalPurposeCount !== 0 ||
        row.diseaseTagCount !== 0 ||
        row.studyDesign !== null ||
        row.publicationStatus !== null ||
        !['exclude', 'uncertain'].includes(row.relevanceLabel) ||
        row.categorizationFromFullText
      ) {
        throw new Error(`${label} is not the exact formal excluded/uncertain null-status shape.`)
      }
    } else if (
      row.topicCount === 0 ||
      row.clinicalPurposeCount === 0 ||
      row.studyDesign === null ||
      row.publicationStatus === null ||
      !['include_core', 'include_adjacent'].includes(row.relevanceLabel)
    ) {
      throw new Error(`${label} is an included row with incomplete required categorization.`)
    }
    if (!excluded) {
      const statusMatchesTags = (status: string | null, count: number) =>
        (status === 'tagged' && count > 0) ||
        (['not_applicable', 'not_assessable'].includes(status ?? '') && count === 0)
      if (
        !statusMatchesTags(row.technologyStatus, row.technologyTagCount) ||
        !statusMatchesTags(row.diseaseStatus, row.diseaseTagCount)
      ) {
        throw new Error(`${label} violates included tag-status cardinality.`)
      }
    }
    if (
      row.automatedSignalsRevealedAtBefore !== row.automatedSignalsRevealedAtAfter ||
      row.supplementalMetadataRevealedAtBefore !== row.supplementalMetadataRevealedAtAfter
    ) {
      throw new Error(`${label} fabricated or changed an item reveal timestamp.`)
    }
    if (
      (row.action === 'import_initial' &&
        (row.usedSupplementalMetadataBefore !== null ||
          row.usedSupplementalMetadataAfter !== false)) ||
      (row.action !== 'import_initial' &&
        row.usedSupplementalMetadataBefore !== row.usedSupplementalMetadataAfter)
    ) {
      throw new Error(`${label} did not preserve independent supplemental-metadata provenance.`)
    }
    if (row.usedSupplementalMetadataAfter && row.supplementalMetadataRevealedAtAfter === null) {
      throw new Error(`${label} populated supplemental use without its own reveal provenance.`)
    }
    if (row.noteSha256 !== row.requiredNoteSha256) {
      throw new Error(`${label} did not preserve its exact authorized target note.`)
    }
  }
  const amendedNoteCount = rows.filter(
    ({ noteDisposition }) => noteDisposition === 'amended_authorized_rationale',
  ).length
  if (amendedNoteCount !== 2) {
    throw new Error('V2 production cohort must contain exactly two authorized rationale overlays.')
  }
  if (rows.some(({ isBlinded }) => isBlinded !== false)) {
    throw new Error('All 630 finalized V3 reviews must retain semantic is_blinded=false.')
  }
  return {
    actionCounts,
    amendedNoteCount: 2,
    falseFullTextCount: 580,
    falseIsBlindedCount: 630,
    noteDispositionAuditSha256: NOTE_DISPOSITION_AUDIT_SHA256,
    nullDiseaseStatusCount: 272,
    nullTechnologyStatusCount: 272,
    rows,
    trueFullTextCount: 50,
  }
}

interface AtomicityEvidence {
  actionMutationCount: number
  eventMutationCount: number
  failedJournalSealed: boolean
  pointerMutationCount: number
  revealTimestampMutationCount: number
  reviewMutationCount: number
}

function validateAtomicity(
  value: unknown,
  label: string,
  expectedFailedJournalSealed: boolean,
): AtomicityEvidence {
  const evidence = record(value, label)
  exactKeys(
    evidence,
    [
      'actionMutationCount',
      'eventMutationCount',
      'failedJournalSealed',
      'pointerMutationCount',
      'revealTimestampMutationCount',
      'reviewMutationCount',
    ],
    label,
  )
  if (typeof evidence.failedJournalSealed !== 'boolean') {
    throw new Error(`${label}.failedJournalSealed must be boolean.`)
  }
  const parsed = {
    actionMutationCount: integer(evidence.actionMutationCount, `${label}.actionMutationCount`),
    eventMutationCount: integer(evidence.eventMutationCount, `${label}.eventMutationCount`),
    failedJournalSealed: evidence.failedJournalSealed === true,
    pointerMutationCount: integer(evidence.pointerMutationCount, `${label}.pointerMutationCount`),
    revealTimestampMutationCount: integer(
      evidence.revealTimestampMutationCount,
      `${label}.revealTimestampMutationCount`,
    ),
    reviewMutationCount: integer(evidence.reviewMutationCount, `${label}.reviewMutationCount`),
  }
  if (
    parsed.actionMutationCount !== 0 ||
    parsed.eventMutationCount !== 0 ||
    parsed.pointerMutationCount !== 0 ||
    parsed.revealTimestampMutationCount !== 0 ||
    parsed.reviewMutationCount !== 0
  ) {
    throw new Error(`${label} left a partial action mutation.`)
  }
  if (parsed.failedJournalSealed !== expectedFailedJournalSealed) {
    throw new Error(`${label} has the wrong fail-closed journal disposition.`)
  }
  return parsed
}

export interface ValidatedV2OperationScenarios {
  atomicity: {
    beforeAction1: AtomicityEvidence
    finalAction: AtomicityEvidence
    midOperation: AtomicityEvidence
  }
  compensation: {
    actionMappingCount: number
    appendOnly: true
    effectiveStateRestored: true
    exactPayloadCopy: true
    physicalHistoryExtended: true
  }
  idempotency: { mutationCount: 0; sameReceipt: true }
  lostAcknowledgement: { mutationCount: 0; readOnlyReconcile: true; sameReceipt: true }
  receiptsAndState: ValidatedV2ReceiptsAndState
}

export interface V2ObservedStateHashes {
  effectiveStateSha256: string
  physicalStateSha256: string
}

export interface ValidatedV2ReceiptsAndState {
  receipts: {
    compensationApplied: CompensationReceiptV2
    compensationReplayed: CompensationReceiptV2
    importApplied: ImportReceiptV2
    importReconciled: ImportReceiptV2
    importReplayed: ImportReceiptV2
  }
  state: {
    postCompensation: V2ObservedStateHashes
    postCompensationReplay: V2ObservedStateHashes
    postImport: V2ObservedStateHashes
    postImportReplay: V2ObservedStateHashes
    postLostAcknowledgementReconcile: V2ObservedStateHashes
    preImport: V2ObservedStateHashes
  }
}

function validateObservedStateHashes(value: unknown, label: string): V2ObservedStateHashes {
  const state = record(value, label)
  exactKeys(state, ['effectiveStateSha256', 'physicalStateSha256'], label)
  return {
    effectiveStateSha256: sha256(state.effectiveStateSha256, `${label}.effectiveStateSha256`),
    physicalStateSha256: sha256(state.physicalStateSha256, `${label}.physicalStateSha256`),
  }
}

function receiptIdentityWithoutResponse(receipt: { response: string }): unknown {
  return Object.fromEntries(Object.entries(receipt).filter(([key]) => key !== 'response'))
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right)
}

function assertReceiptMatchesState(
  receipt: {
    afterEffectiveStateSha256: string
    afterPhysicalStateSha256: string
    beforeEffectiveStateSha256: string
    beforePhysicalStateSha256: string
  },
  before: V2ObservedStateHashes,
  after: V2ObservedStateHashes,
  label: string,
): void {
  if (
    receipt.beforeEffectiveStateSha256 !== before.effectiveStateSha256 ||
    receipt.beforePhysicalStateSha256 !== before.physicalStateSha256 ||
    receipt.afterEffectiveStateSha256 !== after.effectiveStateSha256 ||
    receipt.afterPhysicalStateSha256 !== after.physicalStateSha256
  ) {
    throw new Error(`${label} receipt hashes do not match the directly observed V2 states.`)
  }
}

function validateV2ReceiptsAndState(value: unknown): ValidatedV2ReceiptsAndState {
  const evidence = record(value, 'operationScenarios.receiptsAndState')
  exactKeys(evidence, ['receipts', 'state'], 'operationScenarios.receiptsAndState')
  const rawReceipts = record(evidence.receipts, 'operationScenarios.receiptsAndState.receipts')
  exactKeys(
    rawReceipts,
    [
      'compensationApplied',
      'compensationReplayed',
      'importApplied',
      'importReconciled',
      'importReplayed',
    ],
    'operationScenarios.receiptsAndState.receipts',
  )
  const receipts = {
    compensationApplied: parseCompensationReceiptV2(rawReceipts.compensationApplied),
    compensationReplayed: parseCompensationReceiptV2(rawReceipts.compensationReplayed),
    importApplied: parseImportReceiptV2(rawReceipts.importApplied),
    importReconciled: parseImportReceiptV2(rawReceipts.importReconciled),
    importReplayed: parseImportReceiptV2(rawReceipts.importReplayed),
  }
  const rawState = record(evidence.state, 'operationScenarios.receiptsAndState.state')
  exactKeys(
    rawState,
    [
      'postCompensation',
      'postCompensationReplay',
      'postImport',
      'postImportReplay',
      'postLostAcknowledgementReconcile',
      'preImport',
    ],
    'operationScenarios.receiptsAndState.state',
  )
  const state = {
    postCompensation: validateObservedStateHashes(
      rawState.postCompensation,
      'operationScenarios.receiptsAndState.state.postCompensation',
    ),
    postCompensationReplay: validateObservedStateHashes(
      rawState.postCompensationReplay,
      'operationScenarios.receiptsAndState.state.postCompensationReplay',
    ),
    postImport: validateObservedStateHashes(
      rawState.postImport,
      'operationScenarios.receiptsAndState.state.postImport',
    ),
    postImportReplay: validateObservedStateHashes(
      rawState.postImportReplay,
      'operationScenarios.receiptsAndState.state.postImportReplay',
    ),
    postLostAcknowledgementReconcile: validateObservedStateHashes(
      rawState.postLostAcknowledgementReconcile,
      'operationScenarios.receiptsAndState.state.postLostAcknowledgementReconcile',
    ),
    preImport: validateObservedStateHashes(
      rawState.preImport,
      'operationScenarios.receiptsAndState.state.preImport',
    ),
  }

  if (
    receipts.importApplied.outcome !== 'committed' ||
    receipts.importApplied.response !== 'applied' ||
    receipts.importReconciled.response !== 'idempotent_replay' ||
    receipts.importReplayed.response !== 'idempotent_replay' ||
    receipts.compensationApplied.outcome !== 'committed' ||
    receipts.compensationApplied.response !== 'applied' ||
    receipts.compensationReplayed.response !== 'idempotent_replay'
  ) {
    throw new Error(
      'Observed V2 receipts do not have the required applied/reconciled/replay responses.',
    )
  }
  const importActionCounts = receipts.importApplied.actionCounts
  if (
    canonicalJson(receipts.compensationApplied.actionCounts) !==
      canonicalJson({
        noops: importActionCounts.noops,
        restored: importActionCounts.revisions,
        total: importActionCounts.total,
        voided: importActionCounts.initial,
      }) ||
    receipts.compensationApplied.targetImportOperationId !== receipts.importApplied.operationId ||
    receipts.compensationApplied.batchId !== receipts.importApplied.batchId ||
    receipts.compensationApplied.sourceAuthorizationSetSha256 !==
      receipts.importApplied.sourceAuthorizationSetSha256 ||
    receipts.compensationApplied.noteDispositionAuditSha256 !==
      receipts.importApplied.noteDispositionAuditSha256 ||
    receipts.compensationApplied.booleanNormalizationLedgerSha256 !==
      receipts.importApplied.booleanNormalizationLedgerSha256 ||
    receipts.compensationApplied.orderedSetNormalizationLedgerSha256 !==
      receipts.importApplied.orderedSetNormalizationLedgerSha256
  ) {
    throw new Error(
      'Observed V2 receipts do not seal the exact dynamically derived import/compensation map.',
    )
  }
  if (
    !sameCanonicalValue(
      receiptIdentityWithoutResponse(receipts.importApplied),
      receiptIdentityWithoutResponse(receipts.importReconciled),
    ) ||
    !sameCanonicalValue(
      receiptIdentityWithoutResponse(receipts.importApplied),
      receiptIdentityWithoutResponse(receipts.importReplayed),
    ) ||
    !sameCanonicalValue(
      receiptIdentityWithoutResponse(receipts.compensationApplied),
      receiptIdentityWithoutResponse(receipts.compensationReplayed),
    )
  ) {
    throw new Error('V2 reconcile/replay did not return the exact sealed receipt identity.')
  }
  if (
    !sameCanonicalValue(state.postImport, state.postLostAcknowledgementReconcile) ||
    !sameCanonicalValue(state.postImport, state.postImportReplay) ||
    !sameCanonicalValue(state.postCompensation, state.postCompensationReplay)
  ) {
    throw new Error('V2 reconcile/replay changed an observed effective or physical state hash.')
  }

  assertReceiptMatchesState(receipts.importApplied, state.preImport, state.postImport, 'Import')
  assertReceiptMatchesState(
    receipts.importReconciled,
    state.preImport,
    state.postLostAcknowledgementReconcile,
    'Reconciled import',
  )
  assertReceiptMatchesState(
    receipts.importReplayed,
    state.preImport,
    state.postImportReplay,
    'Replayed import',
  )
  assertReceiptMatchesState(
    receipts.compensationApplied,
    state.postImport,
    state.postCompensation,
    'Compensation',
  )
  assertReceiptMatchesState(
    receipts.compensationReplayed,
    state.postImport,
    state.postCompensationReplay,
    'Replayed compensation',
  )
  if (
    state.postCompensation.effectiveStateSha256 !== state.preImport.effectiveStateSha256 ||
    state.postCompensation.physicalStateSha256 === state.preImport.physicalStateSha256 ||
    state.postCompensation.physicalStateSha256 === state.postImport.physicalStateSha256
  ) {
    throw new Error('Observed V2 hashes do not prove append-only effective-state restoration.')
  }
  return { receipts, state }
}

export function validateV2OperationScenarios(value: unknown): ValidatedV2OperationScenarios {
  const scenarios = record(value, 'operationScenarios')
  exactKeys(
    scenarios,
    ['atomicity', 'compensation', 'idempotency', 'lostAcknowledgement', 'receiptsAndState'],
    'operationScenarios',
  )
  const atomicity = record(scenarios.atomicity, 'operationScenarios.atomicity')
  exactKeys(
    atomicity,
    ['beforeAction1', 'finalAction', 'midOperation'],
    'operationScenarios.atomicity',
  )
  const idempotency = record(scenarios.idempotency, 'operationScenarios.idempotency')
  exactKeys(idempotency, ['mutationCount', 'sameReceipt'], 'operationScenarios.idempotency')
  if (
    integer(idempotency.mutationCount, 'operationScenarios.idempotency.mutationCount') !== 0 ||
    literalTrue(idempotency.sameReceipt, 'operationScenarios.idempotency.sameReceipt') !== true
  ) {
    throw new Error('V2 import replay was not exactly idempotent.')
  }
  const lost = record(scenarios.lostAcknowledgement, 'operationScenarios.lostAcknowledgement')
  exactKeys(
    lost,
    ['mutationCount', 'readOnlyReconcile', 'sameReceipt'],
    'operationScenarios.lostAcknowledgement',
  )
  if (
    integer(lost.mutationCount, 'operationScenarios.lostAcknowledgement.mutationCount') !== 0 ||
    literalTrue(
      lost.readOnlyReconcile,
      'operationScenarios.lostAcknowledgement.readOnlyReconcile',
    ) !== true ||
    literalTrue(lost.sameReceipt, 'operationScenarios.lostAcknowledgement.sameReceipt') !== true
  ) {
    throw new Error('V2 lost-ack reconciliation was mutating or did not return the sealed receipt.')
  }
  const compensation = record(scenarios.compensation, 'operationScenarios.compensation')
  exactKeys(
    compensation,
    [
      'actionMappingCount',
      'appendOnly',
      'effectiveStateRestored',
      'exactPayloadCopy',
      'physicalHistoryExtended',
    ],
    'operationScenarios.compensation',
  )
  const actionMappingCount = integer(
    compensation.actionMappingCount,
    'operationScenarios.compensation.actionMappingCount',
  )
  if (
    actionMappingCount === 0 ||
    compensation.appendOnly !== true ||
    compensation.effectiveStateRestored !== true ||
    compensation.exactPayloadCopy !== true ||
    compensation.physicalHistoryExtended !== true
  ) {
    throw new Error(
      'V2 compensation did not cover every action append-only with exact restoration.',
    )
  }
  return {
    atomicity: {
      beforeAction1: validateAtomicity(
        atomicity.beforeAction1,
        'operationScenarios.atomicity.beforeAction1',
        false,
      ),
      finalAction: validateAtomicity(
        atomicity.finalAction,
        'operationScenarios.atomicity.finalAction',
        true,
      ),
      midOperation: validateAtomicity(
        atomicity.midOperation,
        'operationScenarios.atomicity.midOperation',
        true,
      ),
    },
    compensation: {
      actionMappingCount,
      appendOnly: true,
      effectiveStateRestored: true,
      exactPayloadCopy: true,
      physicalHistoryExtended: true,
    },
    idempotency: { mutationCount: 0, sameReceipt: true },
    lostAcknowledgement: { mutationCount: 0, readOnlyReconcile: true, sameReceipt: true },
    receiptsAndState: validateV2ReceiptsAndState(scenarios.receiptsAndState),
  }
}

export function extractV2VerifierEvidence(output: string): unknown {
  const matches = output
    .split(/\r?\n/u)
    .map((line) => line.indexOf(V2_REHEARSAL_EVIDENCE_MARKER))
    .map((index, lineNumber) => ({ index, line: output.split(/\r?\n/u)[lineNumber] ?? '' }))
    .filter(({ index }) => index >= 0)
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${V2_REHEARSAL_EVIDENCE_MARKER} marker.`)
  }
  const [{ index, line }] = matches
  const json = line.slice(index + V2_REHEARSAL_EVIDENCE_MARKER.length).trim()
  try {
    return JSON.parse(json) as unknown
  } catch (error) {
    throw new Error(
      `V2 verifier evidence marker was not JSON: ${error instanceof Error ? error.message : String(error)}.`,
    )
  }
}

export function sha256CanonicalV2(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

export function buildCanonicalV2RehearsalArtifacts(input: {
  migrationPath: V2MigrationPath
  migrationSha256: string
  operationScenarios: unknown
  productionCohort: unknown
  schemaOnlyUpgrade: { after: unknown; before: unknown } | null
  verifierEvidence: unknown
}): ReadonlyMap<string, Buffer> {
  const cohort = validateV2ProductionCohort(input.productionCohort)
  const scenarios = validateV2OperationScenarios(input.operationScenarios)
  if (
    canonicalJson(scenarios.receiptsAndState.receipts.importApplied.actionCounts) !==
      canonicalJson(cohort.actionCounts) ||
    scenarios.compensation.actionMappingCount !== cohort.actionCounts.total
  ) {
    throw new Error(
      'Observed receipt and compensation action counts do not match the dynamically derived cohort partition.',
    )
  }
  const schemaOnlyUpgrade =
    input.migrationPath === 'upgrade'
      ? assertV2SchemaOnlyUpgradePreserved(
          input.schemaOnlyUpgrade ?? {
            after: null,
            before: null,
          },
        )
      : null
  const normalized = {
    actionCounts: cohort.actionCounts,
    contractVersion: GOLD_REVIEW_IMPORT_COMPENSATION_CONTRACT_VERSION_V2,
    migration: {
      id: GOLD_IMPORT_COMPENSATION_MIGRATION_V2,
      path: input.migrationPath,
      sha256: sha256(input.migrationSha256, 'V2 migration SHA-256'),
    },
    operationScenarios: scenarios,
    productionCohort: {
      amendedNoteCount: cohort.amendedNoteCount,
      falseFullTextCount: cohort.falseFullTextCount,
      falseIsBlindedCount: cohort.falseIsBlindedCount,
      noteDispositionAuditSha256: cohort.noteDispositionAuditSha256,
      nullDiseaseStatusCount: cohort.nullDiseaseStatusCount,
      nullTechnologyStatusCount: cohort.nullTechnologyStatusCount,
      rowsSha256: sha256CanonicalV2(
        [...cohort.rows].sort((left, right) =>
          left.actionIdentitySha256.localeCompare(right.actionIdentitySha256, 'en'),
        ),
      ),
      trueFullTextCount: cohort.trueFullTextCount,
    },
    schemaOnlyUpgrade,
    schemaVersion: V2_CANONICAL_EVIDENCE_SCHEMA_VERSION,
    verifierEvidence: input.verifierEvidence,
  }
  const evidenceBytes = Buffer.from(`${canonicalJson(normalized)}\n`, 'utf8')
  const evidenceSha256 = createHash('sha256').update(evidenceBytes).digest('hex')
  const manifestBytes = Buffer.from(`${evidenceSha256}  v2-rehearsal-evidence.json\n`, 'utf8')
  return new Map([
    ['canonical-manifest.sha256', manifestBytes],
    ['v2-rehearsal-evidence.json', evidenceBytes],
  ])
}
