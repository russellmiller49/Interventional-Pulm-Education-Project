/** @jest-environment node */

import {
  buildLiteratureGoldV2SchemaNeutralHistoryEvidence,
  type LiteratureGoldV2SchemaNeutralHistoryRows,
} from './literature-gold-v2-schema-neutral-history'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import {
  buildProtectedV2ReceiptRecoveryBundle,
  canonicalProtectedV2ReceiptRecoveryJson,
  type ProtectedV2ReceiptRecoveryAmendment,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import { buildProtectedV2HistoricalCaptureDatabaseEvidence } from './protected-gold-import-contract-v2-receipt-recovery-read-only-adapter'
import {
  PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
  buildProtectedV2DatabaseEvidenceFromSnapshot,
  parseProtectedV2TransitionSnapshot,
} from './protected-gold-import-contract-v2-transition-evidence'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2-source-identities'

const batchId = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY.batchId
const membership = 'a'.repeat(64)
const effective = 'b'.repeat(64)

function fixture() {
  const tables = {
    literature_articles: [{ pmid: '12345678' }],
    literature_gold_set_batches: [{ id: batchId }],
    literature_gold_set_events: [],
    literature_gold_set_items: [
      {
        automated_signals_revealed_at: null,
        batch_id: batchId,
        completed_at: null,
        current_review_id: null,
        dataset_split: 'development',
        display_order: 1,
        id: '10000000-0000-4000-8000-000000000001',
        pmid: '12345678',
        review_status: 'not_started',
        started_at: null,
        supplemental_metadata_revealed_at: null,
      },
    ],
    literature_gold_set_review_drafts: [],
    literature_gold_set_reviews: [],
  }
  const historyRows: LiteratureGoldV2SchemaNeutralHistoryRows = {
    actions: [],
    batchId,
    batches: tables.literature_gold_set_batches,
    datasetSplit: 'development',
    drafts: [],
    events: [],
    items: tables.literature_gold_set_items,
    operations: [],
    reviews: [],
  }
  const history = buildLiteratureGoldV2SchemaNeutralHistoryEvidence({
    phase: 'before_v2',
    rows: historyRows,
  })
  const ledgerEntries = [
    {
      name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
      version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
    },
  ]
  const snapshot = parseProtectedV2TransitionSnapshot(
    {
      actionCount: 0,
      batchId,
      compensationCount: 0,
      developmentMembershipSha256: membership,
      effectiveStateSha256V1: effective,
      effectiveStateSha256V2: null,
      historyRows,
      importCount: 0,
      ledgerEntries,
      operationCount: 0,
      phase: 'before_v2',
      physicalStateSha256V1: history.physicalStateSha256V1,
      physicalStateSha256V2: null,
      readOnlyTransaction: true,
      schemaVersion: PROTECTED_V2_TRANSITION_SNAPSHOT_SCHEMA_VERSION,
    },
    'before_v2',
  )
  const expected = buildProtectedV2DatabaseEvidenceFromSnapshot({
    completeCatalogAudit: null,
    phase: 'before_v2',
    readOnlyBracketMatches: true,
    snapshot,
  })
  const amendment = {
    correctedRecoveryToolBundle: buildProtectedV2ReceiptRecoveryBundle([
      {
        gitMode: '100644',
        path: 'scripts/literature/recovery.ts',
        sha256: 'c'.repeat(64),
      },
    ]),
    pinnedSources: {
      v1MigrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256,
      v2MigrationSha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256,
      v2VerifierSha256: 'd'.repeat(64),
    },
    stateAuthority: {
      batchId,
      post: {},
      pre: {
        developmentMembershipSha256: membership,
        effectiveV1Sha256: effective,
        physicalV1Sha256: expected.physicalStateSha256,
        planningSha256: expected.developmentPlanningStateSha256,
        schemaNeutralHistorySha256: expected.history.schemaNeutralHistorySha256,
      },
    },
  } as unknown as ProtectedV2ReceiptRecoveryAmendment
  const seed = canonicalProtectedV2ReceiptRecoveryJson({
    batchId,
    datasetSplit: 'development',
    heldOutIdentitiesIncluded: false,
    schemaVersion: 'literature-gold-protected-v2-preapplication-development-backup/1.0.0',
    tables,
  })
  const state = canonicalProtectedV2ReceiptRecoveryJson({
    batchId,
    batchName: 'gold-set-v1',
    datasetSplit: 'development',
    developmentMembershipSha256: membership,
    developmentPlanningStateSha256: expected.developmentPlanningStateSha256,
    effectiveStateSha256: effective,
    physicalStateSha256: expected.physicalStateSha256,
    schemaVersion: 'literature-gold-protected-v2-state-backup/1.0.0',
  })
  const ledger = canonicalProtectedV2ReceiptRecoveryJson({
    entries: ledgerEntries,
    protectedV2: {
      classification: 'v2_absent',
      expected: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
      occurrence: 0,
    },
    schemaVersion: 'literature-gold-protected-v2-ledger-backup/1.0.0',
  })
  return {
    amendment,
    capture: {
      declaredDirectory: '/immutable/capture',
      files: {
        'checksum-manifest.sha256': '',
        'development-database-seed.json': seed,
        'execution-receipt.json': '',
        'pre-application-report.json': '',
        'pre-application-report.md': '',
        'protected-migration-ledger.json': ledger,
        'state-hashes.json': state,
      },
    },
    expected,
  }
}

describe('protected V2 recovery read-only adapter', () => {
  it('independently reconstructs exact pre-V2 history evidence from an immutable capture', () => {
    const built = fixture()
    expect(
      buildProtectedV2HistoricalCaptureDatabaseEvidence({
        amendment: built.amendment,
        capture: built.capture,
      }),
    ).toEqual(built.expected)
  })

  it('rejects capture state inventory drift before querying the current database', () => {
    const built = fixture()
    const state = JSON.parse(built.capture.files['state-hashes.json']) as Record<string, unknown>
    state.unexpected = true
    built.capture.files['state-hashes.json'] = canonicalProtectedV2ReceiptRecoveryJson(state)
    expect(() =>
      buildProtectedV2HistoricalCaptureDatabaseEvidence({
        amendment: built.amendment,
        capture: built.capture,
      }),
    ).toThrow('inventory drifted')
  })
})
