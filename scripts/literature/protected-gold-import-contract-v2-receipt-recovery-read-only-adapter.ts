import {
  assertDevelopmentSeedScope,
  developmentDatabaseSeedScopeSchema,
} from './gold-import-compensation-development-seed'
import {
  PROTECTED_V2_RECOVERY_EVIDENCE_SQL,
  collectProtectedV2FixedLocalRecoveryEvidence,
} from './protected-gold-import-contract-v2-recovery-evidence-adapter'
import {
  canonicalProtectedV2ReceiptRecoveryJson,
  type ProtectedV2ReceiptRecoveryAmendment,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import type { ProtectedV2ReceiptRecoveryCapturePackage } from './protected-gold-import-contract-v2-receipt-recovery-core'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_TARGET,
  type ProtectedV2ReceiptRecoveryCollectedEvidence,
  type ProtectedV2ReceiptRecoveryReadOnlyEvidenceRequest,
} from './protected-gold-import-contract-v2-receipt-recovery-runtime'
import {
  PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
  buildProtectedV2DatabaseEvidenceFromSnapshot,
  parseProtectedV2TransitionSnapshot,
  type ProtectedV2DatabaseEvidence,
} from './protected-gold-import-contract-v2-transition-evidence'
import { PROTECTED_GOLD_IMPORT_CONTRACT_V2 } from './protected-gold-import-contract-v2-source-identities'

const HISTORICAL_DEVELOPMENT_SEED_SCHEMA_VERSION =
  'literature-gold-protected-v2-preapplication-development-backup/1.0.0' as const
const HISTORICAL_STATE_HASHES_SCHEMA_VERSION =
  'literature-gold-protected-v2-state-backup/1.0.0' as const
const HISTORICAL_MIGRATION_LEDGER_SCHEMA_VERSION =
  'literature-gold-protected-v2-ledger-backup/1.0.0' as const
const SHA256_PATTERN = /^[a-f0-9]{64}$/u

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string) {
  if (
    canonicalProtectedV2ReceiptRecoveryJson(Object.keys(value).sort()) !==
    canonicalProtectedV2ReceiptRecoveryJson([...expected].sort())
  ) {
    throw new Error(`${label} inventory drifted.`)
  }
}

function parseCanonicalRecord(bytes: string, label: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes) as unknown
  } catch {
    throw new Error(`${label} is invalid JSON.`)
  }
  if (canonicalProtectedV2ReceiptRecoveryJson(parsed) !== bytes) {
    throw new Error(`${label} is not canonical JSON.`)
  }
  return record(parsed, label)
}

function sha256(value: unknown, label: string): string {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256.`)
  }
  return value
}

export function buildProtectedV2HistoricalCaptureDatabaseEvidence(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  capture: ProtectedV2ReceiptRecoveryCapturePackage
}): ProtectedV2DatabaseEvidence {
  const seedRecord = parseCanonicalRecord(
    input.capture.files['development-database-seed.json'],
    'Historical development seed',
  )
  const seed = developmentDatabaseSeedScopeSchema.parse(seedRecord)
  assertDevelopmentSeedScope(seed)
  if (seed.schemaVersion !== HISTORICAL_DEVELOPMENT_SEED_SCHEMA_VERSION) {
    throw new Error('Historical development seed schema changed.')
  }

  const state = parseCanonicalRecord(
    input.capture.files['state-hashes.json'],
    'Historical state hashes',
  )
  exactKeys(
    state,
    [
      'batchId',
      'batchName',
      'datasetSplit',
      'developmentMembershipSha256',
      'developmentPlanningStateSha256',
      'effectiveStateSha256',
      'physicalStateSha256',
      'schemaVersion',
    ],
    'Historical state hashes',
  )
  if (
    state.schemaVersion !== HISTORICAL_STATE_HASHES_SCHEMA_VERSION ||
    state.batchId !== seed.batchId ||
    state.batchName !== 'gold-set-v1' ||
    state.datasetSplit !== 'development'
  ) {
    throw new Error('Historical state hashes scope changed.')
  }

  const ledger = parseCanonicalRecord(
    input.capture.files['protected-migration-ledger.json'],
    'Historical migration ledger',
  )
  exactKeys(ledger, ['entries', 'protectedV2', 'schemaVersion'], 'Historical migration ledger')
  const protectedV2 = record(ledger.protectedV2, 'Historical protected V2 ledger state')
  exactKeys(
    protectedV2,
    ['classification', 'expected', 'occurrence'],
    'Historical protected V2 ledger state',
  )
  const expectedV2 = record(protectedV2.expected, 'Historical protected V2 expected migration')
  exactKeys(
    expectedV2,
    ['filename', 'id', 'migrationName', 'sha256', 'version'],
    'Historical protected V2 expected migration',
  )
  if (
    ledger.schemaVersion !== HISTORICAL_MIGRATION_LEDGER_SCHEMA_VERSION ||
    protectedV2.classification !== 'v2_absent' ||
    protectedV2.occurrence !== 0 ||
    canonicalProtectedV2ReceiptRecoveryJson(expectedV2) !==
      canonicalProtectedV2ReceiptRecoveryJson(PROTECTED_GOLD_IMPORT_CONTRACT_V2) ||
    expectedV2.sha256 !== input.amendment.pinnedSources.v2MigrationSha256
  ) {
    throw new Error('Historical migration ledger no longer proves V2 absent.')
  }

  const snapshot = parseProtectedV2TransitionSnapshot(
    {
      actionCount: 0,
      batchId: seed.batchId,
      compensationCount: 0,
      developmentMembershipSha256: sha256(
        state.developmentMembershipSha256,
        'Historical development membership',
      ),
      effectiveStateSha256V1: sha256(state.effectiveStateSha256, 'Historical effective V1 state'),
      effectiveStateSha256V2: null,
      historyRows: {
        actions: [],
        batchId: seed.batchId,
        batches: seed.tables.literature_gold_set_batches,
        datasetSplit: 'development',
        drafts: seed.tables.literature_gold_set_review_drafts,
        events: seed.tables.literature_gold_set_events,
        items: seed.tables.literature_gold_set_items,
        operations: [],
        reviews: seed.tables.literature_gold_set_reviews,
      },
      importCount: 0,
      ledgerEntries: ledger.entries,
      operationCount: 0,
      phase: 'before_v2',
      physicalStateSha256V1: sha256(state.physicalStateSha256, 'Historical physical V1 state'),
      physicalStateSha256V2: null,
      readOnlyTransaction: true,
      schemaVersion: PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
    },
    'before_v2',
  )
  const evidence = buildProtectedV2DatabaseEvidenceFromSnapshot({
    completeCatalogAudit: null,
    phase: 'before_v2',
    readOnlyBracketMatches: true,
    snapshot,
  })
  const expected = input.amendment.stateAuthority.pre
  if (
    evidence.batchId !== input.amendment.stateAuthority.batchId ||
    evidence.developmentMembershipSha256 !== expected.developmentMembershipSha256 ||
    evidence.effectiveStateSha256 !== expected.effectiveV1Sha256 ||
    evidence.physicalStateSha256 !== expected.physicalV1Sha256 ||
    evidence.developmentPlanningStateSha256 !== expected.planningSha256 ||
    evidence.history.schemaNeutralHistorySha256 !== expected.schemaNeutralHistorySha256 ||
    state.developmentPlanningStateSha256 !== expected.planningSha256
  ) {
    throw new Error('Historical capture does not reconstruct the exact amendment pre-state.')
  }
  return evidence
}

function postEvidence(input: {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  collected: ProtectedV2DatabaseEvidence
  finalizedPresent: boolean
}): ProtectedV2ReceiptRecoveryCollectedEvidence['postEvidence'] {
  const { amendment, collected } = input
  const catalog = collected.completeCatalogAudit
  if (!catalog || !collected.effectiveStateSha256V2 || !collected.physicalStateSha256V2) {
    throw new Error('Current recovery evidence is missing the complete post-V2 state.')
  }
  return {
    catalog: {
      auditIdentitySha256: catalog.fullAuditIdentitySha256,
      bindingSha256: amendment.expectedCatalog.bindingSha256,
      fullAuditIdentitySha256: catalog.fullAuditIdentitySha256,
    },
    ledger: {
      v1MigrationSha256: amendment.pinnedSources.v1MigrationSha256,
      v1Occurrence: collected.v1Occurrence,
      v2MigrationSha256: amendment.pinnedSources.v2MigrationSha256,
      v2Occurrence: collected.v2Occurrence,
      v2VerifierSha256: amendment.pinnedSources.v2VerifierSha256,
    },
    mutationEvidence: {
      actionMutationCount: 0,
      compensationCallCount: 0,
      compensationMutationCount: 0,
      importCallCount: 0,
      importMutationCount: 0,
      operationMutationCount: 0,
      pointerMutationCount: 0,
      reviewMutationCount: 0,
      revealMutationCount: 0,
    },
    safety: {
      contradictoryPartialFinalization: false,
      finalizedAbsentAtEvidenceCollection: !input.finalizedPresent,
      heldOutIdentitiesAccessed: false,
      originalCapturesModified: false,
      originalIntentModified: false,
      readOnly: true,
      remoteDatabaseAccessed: false,
      repeatableRead: true,
    },
    state: {
      developmentMembershipSha256: collected.developmentMembershipSha256,
      effectiveV1Sha256: collected.effectiveStateSha256,
      effectiveV2Sha256: collected.effectiveStateSha256V2,
      eventStateSha256: collected.eventStateSha256,
      physicalV1Sha256: collected.physicalStateSha256,
      physicalV2Sha256: collected.physicalStateSha256V2,
      planningSha256: collected.developmentPlanningStateSha256,
      pointerStateSha256: collected.pointerStateSha256,
      revealStateSha256: collected.revealStateSha256,
      reviewStateSha256: collected.reviewStateSha256,
      schemaNeutralHistorySha256: collected.history.schemaNeutralHistorySha256,
    },
  }
}

/**
 * The production recovery boundary has one capability-free collector and no injectable executor.
 * Historical V1 evidence is independently reconstructed from both immutable capture seeds.
 */
export async function collectProtectedV2ReceiptRecoveryReadOnlyEvidence(
  request: ProtectedV2ReceiptRecoveryReadOnlyEvidenceRequest,
): Promise<ProtectedV2ReceiptRecoveryCollectedEvidence> {
  if (
    canonicalProtectedV2ReceiptRecoveryJson(request.target) !==
      canonicalProtectedV2ReceiptRecoveryJson(PROTECTED_V2_RECEIPT_RECOVERY_TARGET) ||
    request.applicationOutputDirectory !==
      request.amendment.historicalIncident.intentOutputDirectory
  ) {
    throw new Error('Protected V2 recovery evidence target changed.')
  }
  const beforeCaptures = request.captures.map((capture) =>
    buildProtectedV2HistoricalCaptureDatabaseEvidence({
      amendment: request.amendment,
      capture,
    }),
  ) as unknown as readonly [ProtectedV2DatabaseEvidence, ProtectedV2DatabaseEvidence]
  const collected = await collectProtectedV2FixedLocalRecoveryEvidence({
    beforeCaptures,
    expectedCatalogBindingSha256: request.amendment.expectedCatalog.bindingSha256,
    sourceAuthorizationSha256: request.amendment.historicalIncident.authorizationContentSha256,
  })
  return {
    capabilityCallCounts: {
      compensation: 0,
      import: 0,
      migrationApplication: 0,
      migrationStaging: 0,
    },
    postEvidence: postEvidence({
      amendment: request.amendment,
      collected: collected.postEvidence,
      finalizedPresent: request.finalizedPresent,
    }),
    queryAudit: {
      databaseMutationCount: 0,
      heldOutIdentitiesAccessed: false,
      localDockerEndpoint: true,
      remoteDatabaseAccessed: false,
      transactionBatches: [
        PROTECTED_V2_RECOVERY_EVIDENCE_SQL.transitionAfterV2,
        PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogDiagnostics,
        PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogSecurity,
        PROTECTED_V2_RECOVERY_EVIDENCE_SQL.catalogDetails,
        PROTECTED_V2_RECOVERY_EVIDENCE_SQL.transitionAfterV2,
      ],
    },
    transitionInput: collected.transitionInput,
  }
}
