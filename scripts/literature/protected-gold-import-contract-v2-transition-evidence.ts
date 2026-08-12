import { createHash } from 'node:crypto'

import {
  buildLiteratureGoldV2SchemaNeutralHistoryEvidence,
  literatureGoldV2SchemaNeutralHistoryRowsJsonExpression,
  validateLiteratureGoldV2SchemaNeutralHistoryEvidence,
  type LiteratureGoldV2SchemaNeutralHistoryEvidence,
  type LiteratureGoldV2SchemaNeutralHistoryRows,
  type LiteratureGoldV2SchemaOnlyTransitionPhase,
} from './literature-gold-v2-schema-neutral-history'
import {
  LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY,
  LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
  validateLiteratureGoldV2SchemaOnlyTransition,
  type LiteratureGoldV2SchemaOnlyTransitionProof,
  type LiteratureGoldV2SchemaOnlyTransitionState,
} from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER,
  type ProtectedMigrationLedgerEntry,
} from './protected-gold-import-contract-v2-source-identities'

export const PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION =
  'literature-gold-protected-v2-transition-snapshot/1.0.0' as const
export const PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION =
  'literature-gold-protected-v2-transition-database-evidence/1.0.0' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u
const BATCH_NAME = 'gold-set-v1' as const
const LOCAL_CATALOG_AUTHORITY = {
  auditMethod: 'complete_read_only_catalog_identity',
  auditModel: 'literature-gold-contract-v2-complete-catalog/1.1.0',
  auditModelIdentitySha256: 'b502cf738deafb69c765d97529652561ab2dee5f45c1490b701082fdc4c12764',
  environmentInvariantIdentitySha256:
    '086e88fb63626c83fc64eca2e999558b188de7a79a1174a481693788318402c3',
  fullAuditIdentitySha256: 'd0a5d56bcc88b1cf7fa642d25d16c75031dc4a14b349229959389b0dbf0c5783',
  fullEnvironmentInventoryIdentitySha256:
    '780241e4b3821972827c3fb4a49ab24131b317a689a589fa688074b761ac2ea1',
  fullEnvironmentInventoryRecordCount: 730,
  localPostgresOwnerProfileIdentitySha256:
    'a127394a5d2e488957ea5f23e879cf004da2c2297fd14a722a3eb664dbdb9b23',
  schemaVersion: 'literature-gold-protected-v2-complete-catalog-audit/1.0.0',
  verifierExecuted: false,
} as const

const CATALOG_COMPONENT_NAMES = [
  'columns',
  'constraints',
  'functionsRpcsDependencies',
  'indexes',
  'rlsPolicies',
  'tableAclEffectivePrivileges',
  'triggers',
] as const

export interface ProtectedV2CompleteCatalogAuditIdentity {
  auditMethod: typeof LOCAL_CATALOG_AUTHORITY.auditMethod
  auditModel: typeof LOCAL_CATALOG_AUTHORITY.auditModel
  auditModelIdentitySha256: string
  componentIdentities: Record<(typeof CATALOG_COMPONENT_NAMES)[number], string>
  environmentInvariantIdentitySha256: string
  fullAuditIdentitySha256: string
  fullEnvironmentInventoryIdentitySha256: string
  fullEnvironmentInventoryRecordCount: number
  localPostgresOwnerProfileIdentitySha256: string
  schemaVersion: typeof LOCAL_CATALOG_AUTHORITY.schemaVersion
  verifierExecuted: false
}

type JsonRow = Readonly<Record<string, unknown>>

export interface ProtectedV2DatabaseEvidence {
  actionCount: number
  batchId: string
  compensationCount: number
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity | null
  developmentMembershipSha256: string
  developmentPlanningStateSha256: string
  effectiveStateSha256: string
  effectiveStateSha256V2: string | null
  eventStateSha256: string
  history: LiteratureGoldV2SchemaNeutralHistoryEvidence
  importCount: number
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  operationCount: number
  physicalStateSha256: string
  physicalStateSha256V2: string | null
  pointerStateSha256: string
  readOnlyBracketMatches: true
  revealStateSha256: string
  reviewStateSha256: string
  schemaVersion: typeof PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION
  v1Occurrence: number
  v2Occurrence: number
}

export interface ProtectedV2TransitionSnapshot {
  actionCount: number
  batchId: string
  compensationCount: number
  developmentMembershipSha256: string
  effectiveStateSha256V1: string
  effectiveStateSha256V2: string | null
  historyRows: LiteratureGoldV2SchemaNeutralHistoryRows
  importCount: number
  ledgerEntries: readonly ProtectedMigrationLedgerEntry[]
  operationCount: number
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase
  physicalStateSha256V1: string
  physicalStateSha256V2: string | null
  readOnlyTransaction: true
  schemaVersion: typeof PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION
}

export interface ProtectedV2ReadOnlyTransitionEvidenceDependencies {
  collectCompleteCatalogAudit?: () => Promise<unknown>
  queryJson: (sql: string) => Promise<unknown>
}

export interface ProtectedV2SchemaOnlyDatabaseTransitionInput {
  after: ProtectedV2DatabaseEvidence
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  expectedCatalogBindingSha256: string
  sourceAuthorizationSha256: string
}

export interface ProtectedV2CollectedPostTransitionEvidence {
  postEvidence: ProtectedV2DatabaseEvidence
  transitionInput: ProtectedV2SchemaOnlyDatabaseTransitionInput
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`)
  return value
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) {
    throw new Error(`${label} has unexpected or missing keys.`)
  }
}

function requiredSha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256.`)
  }
  return value
}

function requiredCount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`${label} must be a nonnegative safe integer.`)
  }
  return Number(value)
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical evidence rejects non-finite numbers.')
    return value
  }
  if (Array.isArray(value)) return value.map(sortedCanonicalValue)
  if (!isRecord(value)) throw new Error(`Canonical evidence rejects ${typeof value}.`)
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => {
        if (value[key] === undefined)
          throw new Error(`Canonical evidence rejects undefined at ${key}.`)
        return [key, sortedCanonicalValue(value[key])]
      }),
  )
}

function canonicalJson(value: unknown): string {
  return `${JSON.stringify(sortedCanonicalValue(value), null, 2)}\n`
}

function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function sha256ContractCanonical(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortedCanonicalValue(value)))
    .digest('hex')
}

export function validateProtectedV2LocalCompleteCatalogAudit(
  value: unknown,
): ProtectedV2CompleteCatalogAuditIdentity {
  const audit = requiredRecord(value, 'Protected V2 local complete catalog audit')
  exactKeys(
    audit,
    [
      'auditMethod',
      'auditModel',
      'auditModelIdentitySha256',
      'componentIdentities',
      'environmentInvariantIdentitySha256',
      'fullAuditIdentitySha256',
      'fullEnvironmentInventoryIdentitySha256',
      'fullEnvironmentInventoryRecordCount',
      'localPostgresOwnerProfileIdentitySha256',
      'schemaVersion',
      'verifierExecuted',
    ],
    'Protected V2 local complete catalog audit',
  )
  const components = requiredRecord(audit.componentIdentities, 'catalog component identities')
  exactKeys(components, CATALOG_COMPONENT_NAMES, 'catalog component identities')
  for (const [label, hash] of Object.entries({
    auditModelIdentitySha256: audit.auditModelIdentitySha256,
    environmentInvariantIdentitySha256: audit.environmentInvariantIdentitySha256,
    fullAuditIdentitySha256: audit.fullAuditIdentitySha256,
    fullEnvironmentInventoryIdentitySha256: audit.fullEnvironmentInventoryIdentitySha256,
    localPostgresOwnerProfileIdentitySha256: audit.localPostgresOwnerProfileIdentitySha256,
    ...components,
  })) {
    requiredSha256(hash, `catalog ${label}`)
  }
  const { fullAuditIdentitySha256, ...content } = audit
  if (
    audit.auditMethod !== LOCAL_CATALOG_AUTHORITY.auditMethod ||
    audit.auditModel !== LOCAL_CATALOG_AUTHORITY.auditModel ||
    audit.auditModelIdentitySha256 !== LOCAL_CATALOG_AUTHORITY.auditModelIdentitySha256 ||
    audit.environmentInvariantIdentitySha256 !==
      LOCAL_CATALOG_AUTHORITY.environmentInvariantIdentitySha256 ||
    fullAuditIdentitySha256 !== LOCAL_CATALOG_AUTHORITY.fullAuditIdentitySha256 ||
    audit.fullEnvironmentInventoryIdentitySha256 !==
      LOCAL_CATALOG_AUTHORITY.fullEnvironmentInventoryIdentitySha256 ||
    audit.fullEnvironmentInventoryRecordCount !==
      LOCAL_CATALOG_AUTHORITY.fullEnvironmentInventoryRecordCount ||
    audit.localPostgresOwnerProfileIdentitySha256 !==
      LOCAL_CATALOG_AUTHORITY.localPostgresOwnerProfileIdentitySha256 ||
    audit.schemaVersion !== LOCAL_CATALOG_AUTHORITY.schemaVersion ||
    audit.verifierExecuted !== false ||
    sha256ContractCanonical(content) !== fullAuditIdentitySha256
  ) {
    throw new Error('Protected V2 local complete catalog audit drifted from exact authority.')
  }
  return audit as unknown as ProtectedV2CompleteCatalogAuditIdentity
}

function requiredRows(value: unknown, label: string): JsonRow[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((row, index) => requiredRecord(row, `${label}[${index}]`))
}

function requiredString(row: JsonRow, key: string, label: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label}.${key} must be a nonempty string.`)
  }
  return value
}

function requiredInteger(row: JsonRow, key: string, label: string): number {
  const value = row[key]
  if (!Number.isSafeInteger(value)) throw new Error(`${label}.${key} must be an integer.`)
  return Number(value)
}

function sortedStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).sort(compareCodeUnits) : []
}

function reviewPayloadProjection(review: JsonRow) {
  return {
    categorizationFromFullText: review.categorization_from_full_text ?? false,
    clinicalPurposes: sortedStringArray(review.clinical_purposes),
    completedAt: review.completed_at ?? null,
    createdAt: review.created_at ?? null,
    diseaseTagStatus: review.disease_tag_status ?? null,
    diseaseTags: sortedStringArray(review.disease_tags),
    enrichmentProvenance: review.enrichment_provenance ?? null,
    enrichmentSchemaVersion: review.enrichment_schema_version ?? null,
    isBlinded: review.is_blinded ?? null,
    labelSchemaVersion: review.label_schema_version ?? null,
    metadataSufficiency: review.metadata_sufficiency ?? null,
    notes: review.notes ?? '',
    publicationStatus: review.publication_status ?? null,
    relevanceLabel: review.relevance_label ?? null,
    reviewSeconds: review.review_seconds ?? 0,
    reviewerConfidence: review.reviewer_confidence ?? null,
    reviewerEmail: review.reviewer_email ?? null,
    reviewerUserId: review.reviewer_user_id ?? null,
    startedAt: review.started_at ?? null,
    studyDesign: review.study_design ?? null,
    taxonomyVersion: review.taxonomy_version ?? null,
    technologyTagStatus: review.technology_tag_status ?? null,
    technologyTags: sortedStringArray(review.technology_tags),
    topicIds: sortedStringArray(review.topic_ids),
    usedSupplementalMetadata: review.used_supplemental_metadata ?? false,
  }
}

function resolveEffectiveReview(reviews: readonly JsonRow[]): JsonRow | null {
  const ordered = [...reviews].sort(
    (left, right) =>
      requiredInteger(left, 'revision', 'review') - requiredInteger(right, 'revision', 'review') ||
      compareCodeUnits(requiredString(left, 'id', 'review'), requiredString(right, 'id', 'review')),
  )
  const head = ordered.at(-1)
  if (!head) return null
  const lifecycle = head.lifecycle_state ?? 'effective'
  if (lifecycle === 'withdrawn') return null
  if (lifecycle !== 'effective') {
    throw new Error(`Unsupported review lifecycle: ${String(lifecycle)}.`)
  }
  const sourceId = head.effective_source_review_id
  if (sourceId === null || sourceId === undefined) return head
  const source = ordered.find((review) => review.id === sourceId)
  if (!source) throw new Error('Effective source review is absent from the review history.')
  return source
}

export function protectedV2DevelopmentPlanningStateSha256(
  rows: LiteratureGoldV2SchemaNeutralHistoryRows,
): string {
  const reviewsByItem = new Map<string, JsonRow[]>()
  rows.reviews.forEach((review) => {
    const itemId = requiredString(review, 'item_id', 'review')
    reviewsByItem.set(itemId, [...(reviewsByItem.get(itemId) ?? []), review])
  })
  const items = [...rows.items].sort(
    (left, right) =>
      requiredInteger(left, 'display_order', 'item') -
        requiredInteger(right, 'display_order', 'item') ||
      compareCodeUnits(requiredString(left, 'id', 'item'), requiredString(right, 'id', 'item')),
  )
  const planning = {
    datasetSplit: 'development',
    rows: items.map((item, index) => {
      const itemId = requiredString(item, 'id', 'item')
      const reviews = [...(reviewsByItem.get(itemId) ?? [])].sort(
        (left, right) =>
          requiredInteger(left, 'revision', 'review') -
            requiredInteger(right, 'revision', 'review') ||
          compareCodeUnits(
            requiredString(left, 'id', 'review'),
            requiredString(right, 'id', 'review'),
          ),
      )
      const head = reviews.at(-1) ?? null
      const effective = resolveEffectiveReview(reviews)
      return {
        currentEffectiveReview: effective ? reviewPayloadProjection(effective) : null,
        currentReviewId: item.current_review_id ?? null,
        currentRevision: head?.revision ?? null,
        datasetSplit: 'development',
        displayOrder: item.display_order,
        effectiveReviewId: effective?.id ?? null,
        itemId,
        itemState: {
          automatedSignalsRevealedAt: item.automated_signals_revealed_at ?? null,
          completedAt: item.completed_at ?? null,
          reviewStatus: item.review_status,
          startedAt: item.started_at ?? null,
          supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at ?? null,
        },
        pmid: item.pmid,
        sequence: index + 1,
      }
    }),
    schemaVersion: 'gold-import-compensation-development-planning-state/1.0.0',
  }
  return sha256ContractCanonical(planning)
}

function parseLedgerEntries(value: unknown): ProtectedMigrationLedgerEntry[] {
  if (!Array.isArray(value)) throw new Error('Transition snapshot ledgerEntries must be an array.')
  return value.map((entry, index) => {
    const row = requiredRecord(entry, `ledgerEntries[${index}]`)
    exactKeys(row, ['name', 'version'], `ledgerEntries[${index}]`)
    if (typeof row.name !== 'string' || typeof row.version !== 'string') {
      throw new Error(`ledgerEntries[${index}] identity is malformed.`)
    }
    return { name: row.name, version: row.version }
  })
}

function parseHistoryRows(value: unknown): LiteratureGoldV2SchemaNeutralHistoryRows {
  const rows = requiredRecord(value, 'transition snapshot historyRows')
  exactKeys(
    rows,
    [
      'actions',
      'batchId',
      'batches',
      'datasetSplit',
      'drafts',
      'events',
      'items',
      'operations',
      'reviews',
    ],
    'transition snapshot historyRows',
  )
  if (
    rows.batchId !== LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId ||
    rows.datasetSplit !== 'development'
  ) {
    throw new Error('Transition snapshot history scope drifted.')
  }
  return {
    actions: requiredRows(rows.actions, 'historyRows.actions'),
    batchId: rows.batchId,
    batches: requiredRows(rows.batches, 'historyRows.batches'),
    datasetSplit: 'development',
    drafts: requiredRows(rows.drafts, 'historyRows.drafts'),
    events: requiredRows(rows.events, 'historyRows.events'),
    items: requiredRows(rows.items, 'historyRows.items'),
    operations: requiredRows(rows.operations, 'historyRows.operations'),
    reviews: requiredRows(rows.reviews, 'historyRows.reviews'),
  }
}

export function parseProtectedV2TransitionSnapshot(
  value: unknown,
  expectedPhase: LiteratureGoldV2SchemaOnlyTransitionPhase,
): ProtectedV2TransitionSnapshot {
  const snapshot = requiredRecord(value, 'Protected V2 transition snapshot')
  exactKeys(
    snapshot,
    [
      'actionCount',
      'batchId',
      'compensationCount',
      'developmentMembershipSha256',
      'effectiveStateSha256V1',
      'effectiveStateSha256V2',
      'historyRows',
      'importCount',
      'ledgerEntries',
      'operationCount',
      'phase',
      'physicalStateSha256V1',
      'physicalStateSha256V2',
      'readOnlyTransaction',
      'schemaVersion',
    ],
    'Protected V2 transition snapshot',
  )
  if (
    snapshot.schemaVersion !== PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION ||
    snapshot.phase !== expectedPhase ||
    snapshot.readOnlyTransaction !== true ||
    snapshot.batchId !== LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId
  ) {
    throw new Error('Protected V2 transition snapshot header is invalid.')
  }
  const effectiveStateSha256V2 =
    snapshot.effectiveStateSha256V2 === null
      ? null
      : requiredSha256(snapshot.effectiveStateSha256V2, 'effectiveStateSha256V2')
  const physicalStateSha256V2 =
    snapshot.physicalStateSha256V2 === null
      ? null
      : requiredSha256(snapshot.physicalStateSha256V2, 'physicalStateSha256V2')
  if (
    (expectedPhase === 'before_v2' &&
      (effectiveStateSha256V2 !== null || physicalStateSha256V2 !== null)) ||
    (expectedPhase === 'after_v2' &&
      (effectiveStateSha256V2 === null || physicalStateSha256V2 === null))
  ) {
    throw new Error('Protected V2 transition snapshot V2 identities disagree with its phase.')
  }
  return {
    actionCount: requiredCount(snapshot.actionCount, 'snapshot.actionCount'),
    batchId: snapshot.batchId,
    compensationCount: requiredCount(snapshot.compensationCount, 'snapshot.compensationCount'),
    developmentMembershipSha256: requiredSha256(
      snapshot.developmentMembershipSha256,
      'snapshot.developmentMembershipSha256',
    ),
    effectiveStateSha256V1: requiredSha256(
      snapshot.effectiveStateSha256V1,
      'snapshot.effectiveStateSha256V1',
    ),
    effectiveStateSha256V2,
    historyRows: parseHistoryRows(snapshot.historyRows),
    importCount: requiredCount(snapshot.importCount, 'snapshot.importCount'),
    ledgerEntries: parseLedgerEntries(snapshot.ledgerEntries),
    operationCount: requiredCount(snapshot.operationCount, 'snapshot.operationCount'),
    phase: expectedPhase,
    physicalStateSha256V1: requiredSha256(
      snapshot.physicalStateSha256V1,
      'snapshot.physicalStateSha256V1',
    ),
    physicalStateSha256V2,
    readOnlyTransaction: true,
    schemaVersion: PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
  }
}

function occurrence(
  entries: readonly ProtectedMigrationLedgerEntry[],
  version: string,
  name: string,
) {
  return entries.filter((entry) => entry.version === version && entry.name === name).length
}

function assertExactProtectedLedger(
  entries: readonly ProtectedMigrationLedgerEntry[],
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase,
): { v1Occurrence: 1; v2Occurrence: 0 | 1 } {
  const v1Occurrence = occurrence(
    entries,
    PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
    PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
  )
  const v2Occurrence = occurrence(
    entries,
    PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
    PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
  )
  const v1Relevant = entries.filter(
    (entry) =>
      entry.version === PROTECTED_GOLD_IMPORT_CONTRACT_V1.version ||
      entry.name === PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
  )
  const v2Relevant = entries.filter(
    (entry) =>
      entry.version === PROTECTED_GOLD_IMPORT_CONTRACT_V2.version ||
      entry.name === PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
  )
  const expectedV2 = phase === 'before_v2' ? 0 : 1
  if (
    v1Occurrence !== 1 ||
    v1Relevant.length !== 1 ||
    v2Occurrence !== expectedV2 ||
    v2Relevant.length !== expectedV2
  ) {
    throw new Error('Protected V2 transition snapshot ledger is duplicated, drifted, or ambiguous.')
  }
  return { v1Occurrence: 1, v2Occurrence: expectedV2 }
}

function stateRowIdentities(rows: LiteratureGoldV2SchemaNeutralHistoryRows) {
  const sortedItems = [...rows.items].sort(
    (left, right) =>
      requiredInteger(left, 'display_order', 'item') -
        requiredInteger(right, 'display_order', 'item') ||
      compareCodeUnits(requiredString(left, 'id', 'item'), requiredString(right, 'id', 'item')),
  )
  return {
    pointerStateSha256: sha256Canonical(
      sortedItems.map((item) => ({
        currentReviewId: item.current_review_id ?? null,
        id: item.id,
      })),
    ),
    revealStateSha256: sha256Canonical(
      sortedItems.map((item) => ({
        automatedSignalsRevealedAt: item.automated_signals_revealed_at ?? null,
        id: item.id,
        supplementalMetadataRevealedAt: item.supplemental_metadata_revealed_at ?? null,
      })),
    ),
  }
}

export function buildProtectedV2DatabaseEvidenceFromSnapshot(input: {
  completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity | null
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase
  readOnlyBracketMatches: true
  snapshot: ProtectedV2TransitionSnapshot
}): ProtectedV2DatabaseEvidence {
  const { snapshot } = input
  if (snapshot.phase !== input.phase) throw new Error('Transition snapshot phase changed.')
  const history = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
    phase: input.phase,
    rows: snapshot.historyRows,
  })
  const ledger = assertExactProtectedLedger(snapshot.ledgerEntries, input.phase)
  const operationKinds = snapshot.historyRows.operations.map(
    (operation) => operation.operation_kind,
  )
  const importCount = operationKinds.filter((kind) => kind === 'import').length
  const compensationCount = operationKinds.filter((kind) => kind === 'compensation').length
  if (
    snapshot.physicalStateSha256V1 !== history.physicalStateSha256V1 ||
    snapshot.operationCount !== history.counts.operations ||
    snapshot.actionCount !== history.counts.actions ||
    snapshot.importCount !== importCount ||
    snapshot.compensationCount !== compensationCount
  ) {
    throw new Error(
      'Transition snapshot state functions disagree with the full-history projection.',
    )
  }
  const rowIdentities = stateRowIdentities(snapshot.historyRows)
  return validateProtectedV2DatabaseEvidence(
    {
      actionCount: snapshot.actionCount,
      batchId: snapshot.batchId,
      compensationCount: snapshot.compensationCount,
      completeCatalogAudit: input.completeCatalogAudit,
      developmentMembershipSha256: snapshot.developmentMembershipSha256,
      developmentPlanningStateSha256: protectedV2DevelopmentPlanningStateSha256(
        snapshot.historyRows,
      ),
      effectiveStateSha256: snapshot.effectiveStateSha256V1,
      effectiveStateSha256V2: snapshot.effectiveStateSha256V2,
      eventStateSha256: history.componentIdentities.eventRowsSha256,
      history,
      importCount: snapshot.importCount,
      ledgerEntries: snapshot.ledgerEntries,
      operationCount: snapshot.operationCount,
      physicalStateSha256: snapshot.physicalStateSha256V1,
      physicalStateSha256V2: snapshot.physicalStateSha256V2,
      pointerStateSha256: rowIdentities.pointerStateSha256,
      readOnlyBracketMatches: input.readOnlyBracketMatches,
      revealStateSha256: rowIdentities.revealStateSha256,
      reviewStateSha256: history.componentIdentities.reviewRowsSha256,
      schemaVersion: PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION,
      ...ledger,
    },
    input.phase,
  )
}

export function validateProtectedV2DatabaseEvidence(
  value: unknown,
  expectedPhase: LiteratureGoldV2SchemaOnlyTransitionPhase,
): ProtectedV2DatabaseEvidence {
  const evidence = requiredRecord(value, 'Protected V2 database evidence')
  exactKeys(
    evidence,
    [
      'actionCount',
      'batchId',
      'compensationCount',
      'completeCatalogAudit',
      'developmentMembershipSha256',
      'developmentPlanningStateSha256',
      'effectiveStateSha256',
      'effectiveStateSha256V2',
      'eventStateSha256',
      'history',
      'importCount',
      'ledgerEntries',
      'operationCount',
      'physicalStateSha256',
      'physicalStateSha256V2',
      'pointerStateSha256',
      'readOnlyBracketMatches',
      'revealStateSha256',
      'reviewStateSha256',
      'schemaVersion',
      'v1Occurrence',
      'v2Occurrence',
    ],
    'Protected V2 database evidence',
  )
  const history = validateLiteratureGoldV2SchemaNeutralHistoryEvidence(
    evidence.history,
    expectedPhase,
  )
  const ledgerEntries = parseLedgerEntries(evidence.ledgerEntries)
  const ledger = assertExactProtectedLedger(ledgerEntries, expectedPhase)
  const completeCatalogAudit =
    evidence.completeCatalogAudit === null
      ? null
      : validateProtectedV2LocalCompleteCatalogAudit(evidence.completeCatalogAudit)
  if (
    evidence.schemaVersion !== PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION ||
    evidence.batchId !== LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId ||
    evidence.readOnlyBracketMatches !== true ||
    evidence.v1Occurrence !== ledger.v1Occurrence ||
    evidence.v2Occurrence !== ledger.v2Occurrence ||
    evidence.operationCount !== history.counts.operations ||
    evidence.actionCount !== history.counts.actions ||
    evidence.physicalStateSha256 !== history.physicalStateSha256V1 ||
    evidence.eventStateSha256 !== history.componentIdentities.eventRowsSha256 ||
    evidence.reviewStateSha256 !== history.componentIdentities.reviewRowsSha256 ||
    (expectedPhase === 'before_v2' && completeCatalogAudit !== null) ||
    (expectedPhase === 'after_v2' && completeCatalogAudit === null)
  ) {
    throw new Error('Protected V2 database evidence is internally inconsistent.')
  }
  for (const [label, hash] of Object.entries({
    developmentMembershipSha256: evidence.developmentMembershipSha256,
    developmentPlanningStateSha256: evidence.developmentPlanningStateSha256,
    effectiveStateSha256: evidence.effectiveStateSha256,
    eventStateSha256: evidence.eventStateSha256,
    physicalStateSha256: evidence.physicalStateSha256,
    pointerStateSha256: evidence.pointerStateSha256,
    revealStateSha256: evidence.revealStateSha256,
    reviewStateSha256: evidence.reviewStateSha256,
  })) {
    requiredSha256(hash, `database evidence ${label}`)
  }
  const effectiveStateSha256V2 =
    evidence.effectiveStateSha256V2 === null
      ? null
      : requiredSha256(evidence.effectiveStateSha256V2, 'database evidence effective V2')
  const physicalStateSha256V2 =
    evidence.physicalStateSha256V2 === null
      ? null
      : requiredSha256(evidence.physicalStateSha256V2, 'database evidence physical V2')
  if (
    (expectedPhase === 'before_v2' &&
      (effectiveStateSha256V2 !== null || physicalStateSha256V2 !== null)) ||
    (expectedPhase === 'after_v2' &&
      (effectiveStateSha256V2 === null || physicalStateSha256V2 === null))
  ) {
    throw new Error('Protected V2 database evidence phase identities are invalid.')
  }
  requiredCount(evidence.operationCount, 'database evidence operationCount')
  requiredCount(evidence.actionCount, 'database evidence actionCount')
  requiredCount(evidence.importCount, 'database evidence importCount')
  requiredCount(evidence.compensationCount, 'database evidence compensationCount')
  return {
    ...(evidence as unknown as ProtectedV2DatabaseEvidence),
    completeCatalogAudit,
    effectiveStateSha256V2,
    history,
    ledgerEntries,
    physicalStateSha256V2,
  }
}

function stripSqlCommentsAndLiterals(sql: string): string {
  return sql
    .replace(/--[^\n]*/gu, ' ')
    .replace(/\/\*[\s\S]*?\*\//gu, ' ')
    .replace(/'(?:''|[^'])*'/gu, "''")
}

export function assertProtectedV2TransitionEvidenceSqlReadOnly(sql: string): void {
  const inspected = stripSqlCommentsAndLiterals(sql)
  if (
    !/^\s*begin transaction isolation level repeatable read read only;/iu.test(inspected) ||
    !/rollback;\s*$/iu.test(inspected)
  ) {
    throw new Error('Protected V2 transition evidence SQL requires an exact read-only bracket.')
  }
  if (
    /\b(insert|update|delete|truncate|alter|create|drop|grant|revoke|call|do|copy|commit)\b/iu.test(
      inspected,
    )
  ) {
    throw new Error('Protected V2 transition evidence SQL contains a mutation capability.')
  }
}

export function buildProtectedV2TransitionSnapshotSql(
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase,
): string {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  const batchId = authority.batchId
  const v2Effective =
    phase === 'after_v2'
      ? "public.literature_gold_effective_state_hash_v2(batch.id, 'development')"
      : 'null::text'
  const v2Physical =
    phase === 'after_v2'
      ? "public.literature_gold_physical_state_hash_v2(batch.id, 'development')"
      : 'null::text'
  const sql = String.raw`begin transaction isolation level repeatable read read only;
set local statement_timeout = '120s';
select pg_catalog.jsonb_build_object(
  'schemaVersion', '${PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION}',
  'phase', '${phase}',
  'readOnlyTransaction', current_setting('transaction_read_only')::boolean,
  'batchId', batch.id,
  'ledgerEntries', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'version', pg_catalog.to_jsonb(migration) ->> 'version',
    'name', pg_catalog.to_jsonb(migration) ->> 'name'
  ) order by pg_catalog.to_jsonb(migration) ->> 'version', pg_catalog.to_jsonb(migration) ->> 'name')
    from supabase_migrations.schema_migrations migration), '[]'::jsonb),
  'developmentMembershipSha256', public.literature_gold_development_membership_hash_v1(batch.id),
  'effectiveStateSha256V1', public.literature_gold_effective_state_hash_v1(batch.id, 'development'),
  'physicalStateSha256V1', public.literature_gold_physical_state_hash_v1(batch.id, 'development'),
  'effectiveStateSha256V2', ${v2Effective},
  'physicalStateSha256V2', ${v2Physical},
  'operationCount', (select count(*)::integer from public.literature_gold_review_operations operation
    where operation.batch_id = batch.id and operation.dataset_split = 'development'),
  'importCount', (select count(*)::integer from public.literature_gold_review_operations operation
    where operation.batch_id = batch.id and operation.dataset_split = 'development'
      and operation.operation_kind = 'import'),
  'compensationCount', (select count(*)::integer from public.literature_gold_review_operations operation
    where operation.batch_id = batch.id and operation.dataset_split = 'development'
      and operation.operation_kind = 'compensation'),
  'actionCount', (select count(*)::integer
    from public.literature_gold_review_operation_actions action
    join public.literature_gold_review_operations operation on operation.id = action.operation_id
    where operation.batch_id = batch.id and operation.dataset_split = 'development'),
  'historyRows', ${literatureGoldV2SchemaNeutralHistoryRowsJsonExpression(batchId)}
)
from public.literature_gold_set_batches batch
where batch.id = '${batchId}'::uuid and batch.name = '${BATCH_NAME}';
rollback;`
  assertProtectedV2TransitionEvidenceSqlReadOnly(sql)
  return sql
}

export async function collectProtectedV2ReadOnlyTransitionEvidence(input: {
  dependencies: ProtectedV2ReadOnlyTransitionEvidenceDependencies
  phase: LiteratureGoldV2SchemaOnlyTransitionPhase
}): Promise<ProtectedV2DatabaseEvidence> {
  const sql = buildProtectedV2TransitionSnapshotSql(input.phase)
  const first = parseProtectedV2TransitionSnapshot(
    await input.dependencies.queryJson(sql),
    input.phase,
  )
  let completeCatalogAudit: ProtectedV2CompleteCatalogAuditIdentity | null = null
  if (input.phase === 'after_v2') {
    if (!input.dependencies.collectCompleteCatalogAudit) {
      throw new Error('Post-V2 transition evidence requires the complete local catalog audit.')
    }
    completeCatalogAudit = validateProtectedV2LocalCompleteCatalogAudit(
      await input.dependencies.collectCompleteCatalogAudit(),
    )
  } else if (input.dependencies.collectCompleteCatalogAudit) {
    throw new Error('Pre-V2 transition evidence forbids a post-V2 catalog collector.')
  }
  const second = parseProtectedV2TransitionSnapshot(
    await input.dependencies.queryJson(sql),
    input.phase,
  )
  if (canonicalJson(first) !== canonicalJson(second)) {
    throw new Error('Protected V2 transition evidence changed across its read-only bracket.')
  }
  return buildProtectedV2DatabaseEvidenceFromSnapshot({
    completeCatalogAudit,
    phase: input.phase,
    readOnlyBracketMatches: true,
    snapshot: second,
  })
}

export function buildProtectedV2SchemaOnlyDatabaseTransitionInput(
  input: ProtectedV2SchemaOnlyDatabaseTransitionInput,
): ProtectedV2SchemaOnlyDatabaseTransitionInput {
  requiredSha256(input.expectedCatalogBindingSha256, 'expected catalog binding')
  requiredSha256(input.sourceAuthorizationSha256, 'source authorization')
  return {
    after: validateProtectedV2DatabaseEvidence(input.after, 'after_v2'),
    beforeCaptures: [
      validateProtectedV2DatabaseEvidence(input.beforeCaptures[0], 'before_v2'),
      validateProtectedV2DatabaseEvidence(input.beforeCaptures[1], 'before_v2'),
    ],
    expectedCatalogBindingSha256: input.expectedCatalogBindingSha256,
    sourceAuthorizationSha256: input.sourceAuthorizationSha256,
  }
}

/**
 * Recovery-facing adapter: combines immutable pre-V2 capture evidence with one
 * current read-only post-V2 collection without importing application or migration capabilities.
 */
export async function collectProtectedV2PostTransitionEvidence(input: {
  beforeCaptures: readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  dependencies: ProtectedV2ReadOnlyTransitionEvidenceDependencies
  expectedCatalogBindingSha256: string
  sourceAuthorizationSha256: string
}): Promise<ProtectedV2CollectedPostTransitionEvidence> {
  const postEvidence = await collectProtectedV2ReadOnlyTransitionEvidence({
    dependencies: input.dependencies,
    phase: 'after_v2',
  })
  return {
    postEvidence,
    transitionInput: buildProtectedV2SchemaOnlyDatabaseTransitionInput({
      after: postEvidence,
      beforeCaptures: input.beforeCaptures,
      expectedCatalogBindingSha256: input.expectedCatalogBindingSha256,
      sourceAuthorizationSha256: input.sourceAuthorizationSha256,
    }),
  }
}

function transitionState(
  evidence: ProtectedV2DatabaseEvidence,
  sourceAuthorizationSha256: string,
): LiteratureGoldV2SchemaOnlyTransitionState {
  return {
    compensationCount: evidence.compensationCount,
    developmentMembershipSha256: evidence.developmentMembershipSha256,
    effectiveStateSha256V1: evidence.effectiveStateSha256,
    effectiveStateSha256V2: evidence.effectiveStateSha256V2,
    eventStateSha256: evidence.eventStateSha256,
    history: evidence.history,
    importCount: evidence.importCount,
    physicalStateSha256V2: evidence.physicalStateSha256V2,
    planningStateSha256: evidence.developmentPlanningStateSha256,
    pointerStateSha256: evidence.pointerStateSha256,
    readOnlyBracketMatches: evidence.readOnlyBracketMatches,
    revealStateSha256: evidence.revealStateSha256,
    reviewStateSha256: evidence.reviewStateSha256,
    sourceAuthorizationSha256,
    v1Occurrence: evidence.v1Occurrence,
    v2Occurrence: evidence.v2Occurrence,
  }
}

function changed(left: unknown, right: unknown): number {
  return canonicalJson(left) === canonicalJson(right) ? 0 : 1
}

export function validateProtectedV2SchemaOnlyDatabaseTransition(
  value: ProtectedV2SchemaOnlyDatabaseTransitionInput,
): LiteratureGoldV2SchemaOnlyTransitionProof {
  const input = buildProtectedV2SchemaOnlyDatabaseTransitionInput(value)
  const [before1, before2] = input.beforeCaptures
  const { after } = input
  const catalog = after.completeCatalogAudit!
  return validateLiteratureGoldV2SchemaOnlyTransition({
    after: transitionState(after, input.sourceAuthorizationSha256),
    beforeCaptures: [
      transitionState(before1, input.sourceAuthorizationSha256),
      transitionState(before2, input.sourceAuthorizationSha256),
    ],
    catalogAudit: {
      auditIdentitySha256: catalog.fullAuditIdentitySha256,
      completeExactMatch: true,
      expectedCatalogBindingSha256: input.expectedCatalogBindingSha256,
      fullAuditIdentitySha256: catalog.fullAuditIdentitySha256,
      profileId: 'local_supabase_postgres_owner_v1',
    },
    mutationCounts: {
      actions: changed(
        before1.history.componentIdentities.actionRowsSha256,
        after.history.componentIdentities.actionRowsSha256,
      ),
      events: changed(before1.eventStateSha256, after.eventStateSha256),
      pointers: changed(before1.pointerStateSha256, after.pointerStateSha256),
      reveals: changed(before1.revealStateSha256, after.revealStateSha256),
      reviews: changed(before1.reviewStateSha256, after.reviewStateSha256),
    },
    reasonCode: LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_REASON_CODE,
    sourceIdentities: {
      v1MigrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256,
      v2MigrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
      v2VerifierSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2_VERIFIER.sha256,
    },
  })
}
