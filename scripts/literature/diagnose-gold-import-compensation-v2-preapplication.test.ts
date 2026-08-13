import { createHash } from 'node:crypto'

import { assertReadOnlySnapshotSql } from './gold-import-compensation-migration-operations'
import {
  GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PREAPPLICATION_STATE_BACKUP_SCHEMA_VERSION,
  GOLD_IMPORT_V2_TASK_BRANCH,
  buildGoldImportV2PreapplicationDevelopmentBackup,
  buildGoldImportV2PreapplicationCountSql,
} from './diagnose-gold-import-compensation-v2-preapplication'
import {
  LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
  LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
  type LiteratureGoldV2SchemaNeutralHistoryEvidence,
} from './literature-gold-v2-schema-neutral-history'
import { LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY } from './literature-gold-v2-schema-only-transition'
import { buildProtectedV2BackupExecutionReceipt } from './protected-gold-import-contract-v2-evidence'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2'
import type { RawDatabaseSnapshot } from './gold-import-compensation-migration-operations'
import {
  buildProtectedV2OperatorBundle,
  type ProtectedV2OperatorBundle,
} from './protected-gold-import-contract-v2-recovery-bundle'
import {
  buildProtectedV2ExpectedCatalogBinding,
  buildProtectedV2RuntimeBundleBinding,
  type ProtectedV2RuntimeBundleBinding,
} from './protected-gold-import-contract-v2-bindings'
import {
  PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION,
  validateProtectedV2DatabaseEvidence,
  type ProtectedV2DatabaseEvidence,
} from './protected-gold-import-contract-v2-transition-evidence'

let operatorBundleBinding: ProtectedV2RuntimeBundleBinding
let operatorBundle: ProtectedV2OperatorBundle

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, sorted(record[key])]),
    )
  }
  return value
}

function digest(value: unknown): string {
  return createHash('sha256')
    .update(`${JSON.stringify(sorted(value), null, 2)}\n`)
    .digest('hex')
}

function beforeV2History(): LiteratureGoldV2SchemaNeutralHistoryEvidence {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  const unsigned: Omit<LiteratureGoldV2SchemaNeutralHistoryEvidence, 'bindingSha256'> = {
    batchId: authority.batchId,
    componentIdentities: { ...authority.historyComponentIdentities },
    counts: { ...authority.counts },
    datasetSplit: 'development',
    expectedPostV1PhysicalStateSha256: authority.post.physicalStateSha256V1,
    phase: 'before_v2',
    physicalStateSha256V1: authority.pre.physicalStateSha256V1,
    schemaDerivedFields: {
      operationFields: LITERATURE_GOLD_V2_OPERATION_SCHEMA_ONLY_EXCLUSIONS,
      operationRowCount: authority.counts.operations,
      operationValuesSha256: authority.pre.schemaDerivedOperationValuesSha256,
      reviewFields: LITERATURE_GOLD_V2_REVIEW_SCHEMA_ONLY_EXCLUSIONS,
      reviewRowCount: authority.counts.reviews,
      reviewValuesSha256: authority.pre.schemaDerivedReviewValuesSha256,
    },
    schemaNeutralHistorySha256: authority.post.schemaNeutralHistorySha256,
    schemaVersion: 'literature-gold-schema-neutral-physical-history-evidence/1.0.0',
  }
  return { ...unsigned, bindingSha256: digest(unsigned) }
}

function preV2StateHashCapture() {
  const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
  const databaseEvidence: ProtectedV2DatabaseEvidence = {
    actionCount: authority.counts.actions,
    batchId: authority.batchId,
    compensationCount: 0,
    completeCatalogAudit: null,
    developmentMembershipSha256: authority.post.developmentMembershipSha256,
    developmentPlanningStateSha256: authority.post.planningStateSha256,
    effectiveStateSha256: authority.post.effectiveStateSha256V1,
    effectiveStateSha256V2: null,
    eventStateSha256: authority.post.eventStateSha256,
    history: beforeV2History(),
    importCount: 0,
    ledgerEntries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
    ],
    operationCount: authority.counts.operations,
    physicalStateSha256: authority.pre.physicalStateSha256V1,
    physicalStateSha256V2: null,
    pointerStateSha256: authority.post.pointerStateSha256,
    readOnlyBracketMatches: true,
    revealStateSha256: authority.post.revealStateSha256,
    reviewStateSha256: authority.post.reviewStateSha256,
    schemaVersion: PROTECTED_V2_TRANSITION_DATABASE_EVIDENCE_SCHEMA_VERSION,
    v1Occurrence: 1,
    v2Occurrence: 0,
  }
  return {
    batchId: authority.batchId,
    batchName: 'gold-set-v1' as const,
    databaseEvidence,
    datasetSplit: 'development' as const,
    developmentMembershipSha256: databaseEvidence.developmentMembershipSha256,
    developmentPlanningStateSha256: databaseEvidence.developmentPlanningStateSha256,
    effectiveStateSha256: databaseEvidence.effectiveStateSha256,
    physicalStateSha256: databaseEvidence.physicalStateSha256,
    schemaVersion: GOLD_IMPORT_V2_PREAPPLICATION_STATE_BACKUP_SCHEMA_VERSION,
  }
}

describe('gold import contract V2 real-local pre-application diagnostic', () => {
  beforeAll(async () => {
    operatorBundle = await buildProtectedV2OperatorBundle({ cwd: process.cwd() })
    operatorBundleBinding = buildProtectedV2RuntimeBundleBinding(operatorBundle)
  })

  it('pins the task branch and report schema', () => {
    expect(GOLD_IMPORT_V2_TASK_BRANCH).toBe(
      'codex/ip-literature-import-contract-v2-forward-repair-v1',
    )
    expect(GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-preapplication-report/2.0.0',
    )
    expect(GOLD_IMPORT_V2_PREAPPLICATION_STATE_BACKUP_SCHEMA_VERSION).toBe(
      'literature-gold-protected-v2-state-backup/2.0.0',
    )
    expect(GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-preapplication-execution/2.0.0',
    )
  })

  it('embeds two independent, complete pre-V2 database-history captures', () => {
    const authority = LITERATURE_GOLD_V2_INCIDENT_TRANSITION_AUTHORITY
    const captures = [preV2StateHashCapture(), preV2StateHashCapture()] as const

    expect(captures[1]).toEqual(captures[0])
    expect(captures[1]).not.toBe(captures[0])
    expect(captures[1].databaseEvidence).not.toBe(captures[0].databaseEvidence)
    expect(captures[1].databaseEvidence.history).not.toBe(captures[0].databaseEvidence.history)
    expect(captures[1].databaseEvidence.ledgerEntries).not.toBe(
      captures[0].databaseEvidence.ledgerEntries,
    )

    for (const capture of captures) {
      const evidence = validateProtectedV2DatabaseEvidence(capture.databaseEvidence, 'before_v2')
      expect(capture).toMatchObject({
        schemaVersion: 'literature-gold-protected-v2-state-backup/2.0.0',
        batchId: authority.batchId,
        batchName: 'gold-set-v1',
        datasetSplit: 'development',
        developmentMembershipSha256: evidence.developmentMembershipSha256,
        developmentPlanningStateSha256: evidence.developmentPlanningStateSha256,
        effectiveStateSha256: evidence.effectiveStateSha256,
        physicalStateSha256: evidence.physicalStateSha256,
      })
      expect(evidence).toMatchObject({
        actionCount: 0,
        compensationCount: 0,
        completeCatalogAudit: null,
        effectiveStateSha256V2: null,
        importCount: 0,
        operationCount: 0,
        physicalStateSha256V2: null,
        readOnlyBracketMatches: true,
        schemaVersion: 'literature-gold-protected-v2-transition-database-evidence/1.0.0',
        v1Occurrence: 1,
        v2Occurrence: 0,
      })
      expect(evidence.history).toMatchObject({
        batchId: authority.batchId,
        componentIdentities: authority.historyComponentIdentities,
        counts: authority.counts,
        datasetSplit: 'development',
        phase: 'before_v2',
        physicalStateSha256V1: authority.pre.physicalStateSha256V1,
        schemaNeutralHistorySha256: authority.post.schemaNeutralHistorySha256,
      })
      expect(evidence.ledgerEntries).toEqual([
        {
          name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
          version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
        },
      ])
    }

    captures[0].databaseEvidence.history.counts.events = 0
    expect(captures[1].databaseEvidence.history.counts.events).toBe(authority.counts.events)
    expect(() =>
      validateProtectedV2DatabaseEvidence(captures[0].databaseEvidence, 'before_v2'),
    ).toThrow('binding is invalid')
    expect(() =>
      validateProtectedV2DatabaseEvidence(captures[1].databaseEvidence, 'before_v2'),
    ).not.toThrow()
  })

  it('retains its historical boundary by rejecting an already-applied V2 ledger', () => {
    const historical = preV2StateHashCapture().databaseEvidence
    const postV2Ledger = {
      ...historical,
      ledgerEntries: [
        ...historical.ledgerEntries,
        {
          name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
          version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
        },
      ],
      v2Occurrence: 1,
    }
    expect(() => validateProtectedV2DatabaseEvidence(postV2Ledger, 'before_v2')).toThrow()
  })

  it('derives a path-, state-, ledger-, nonce-, and manifest-bound backup instance identity', () => {
    const base = {
      backupRoot: '/backup-root',
      canonicalManifestSha256: '1'.repeat(64),
      database: {
        batchId: '10000000-0000-4000-8000-000000000001',
        datasetSplit: 'development' as const,
        developmentMembershipSha256: '2'.repeat(64),
        developmentPlanningStateSha256: '3'.repeat(64),
        effectiveStateSha256: '4'.repeat(64),
        physicalStateSha256: '5'.repeat(64),
      },
      executedAt: '2026-08-09T20:00:00.000Z',
      executionNonce: '6'.repeat(64),
      expectedCatalog: buildProtectedV2ExpectedCatalogBinding(
        'local_supabase_postgres_owner_v1',
        'local',
      ),
      migrationLedger: {
        sha256: '7'.repeat(64),
        v1: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V1, occurrence: 1 as const },
        v2: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V2, occurrence: 0 as const },
      },
      outputDirectory: '/backup-root/one',
      operatorBundleBinding,
      repositoryCommitSha: '8'.repeat(40),
      safety: {
        databaseMutationCount: 0 as const,
        heldOutIdentitiesAccessed: false as const,
        remoteDatabaseAccessed: false as const,
      },
      schemaVersion: GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION,
    }
    const first = buildProtectedV2BackupExecutionReceipt(base, { operatorBundle })
    const second = buildProtectedV2BackupExecutionReceipt(
      {
        ...base,
        executionNonce: '9'.repeat(64),
        outputDirectory: '/backup-root/two',
      },
      { operatorBundle },
    )
    expect(first.backupInstanceId).toMatch(/^[a-f0-9]{64}$/u)
    expect(first.contentSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(first.backupInstanceId).not.toBe(second.backupInstanceId)
  })

  it('uses only an explicit repeatable-read/read-only aggregate query', () => {
    const sql = buildGoldImportV2PreapplicationCountSql()
    expect(() => assertReadOnlySnapshotSql(sql)).not.toThrow()
    expect(sql).toContain('transaction isolation level repeatable read read only')
    expect(sql).toContain("batch.name = 'gold-set-v1'")
    expect(sql).not.toContain("dataset_split = 'test'")
  })

  it('seals the already development-scoped current-schema snapshot without held-out identities', () => {
    const batchId = '10000000-0000-4000-8000-000000000001'
    const snapshot = {
      developmentSeed: {
        batches: [{ id: batchId }],
        drafts: [],
        events: [{ id: 'event', operation_id: null }],
        items: [],
        literatureArticles: [],
        reviews: [
          { id: 'review', operation_contract_version: 'gold-review-import-compensation/1.0.0' },
        ],
      },
    } as unknown as RawDatabaseSnapshot
    expect(buildGoldImportV2PreapplicationDevelopmentBackup(snapshot, batchId)).toEqual({
      schemaVersion: 'literature-gold-protected-v2-preapplication-development-backup/1.0.0',
      batchId,
      datasetSplit: 'development',
      heldOutIdentitiesIncluded: false,
      tables: {
        literature_articles: [],
        literature_gold_set_batches: [{ id: batchId }],
        literature_gold_set_events: [{ id: 'event', operation_id: null }],
        literature_gold_set_items: [],
        literature_gold_set_review_drafts: [],
        literature_gold_set_reviews: [
          {
            id: 'review',
            operation_contract_version: 'gold-review-import-compensation/1.0.0',
          },
        ],
      },
    })
  })
})
