import { assertReadOnlySnapshotSql } from './gold-import-compensation-migration-operations'
import {
  GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_TASK_BRANCH,
  buildGoldImportV2PreapplicationDevelopmentBackup,
  buildGoldImportV2PreapplicationCountSql,
} from './diagnose-gold-import-compensation-v2-preapplication'
import { buildProtectedV2BackupExecutionReceipt } from './protected-gold-import-contract-v2-evidence'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
} from './protected-gold-import-contract-v2'
import type { RawDatabaseSnapshot } from './gold-import-compensation-migration-operations'

describe('gold import contract V2 real-local pre-application diagnostic', () => {
  it('pins the task branch and report schema', () => {
    expect(GOLD_IMPORT_V2_TASK_BRANCH).toBe(
      'codex/ip-literature-import-contract-v2-forward-repair-v1',
    )
    expect(GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-preapplication-report/1.0.0',
    )
    expect(GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-preapplication-execution/2.0.0',
    )
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
      migrationLedger: {
        sha256: '7'.repeat(64),
        v1: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V1, occurrence: 1 as const },
        v2: { ...PROTECTED_GOLD_IMPORT_CONTRACT_V2, occurrence: 0 as const },
      },
      outputDirectory: '/backup-root/one',
      repositoryCommitSha: '8'.repeat(40),
      safety: {
        databaseMutationCount: 0 as const,
        heldOutIdentitiesAccessed: false as const,
        remoteDatabaseAccessed: false as const,
      },
      schemaVersion: GOLD_IMPORT_V2_PREAPPLICATION_RECEIPT_SCHEMA_VERSION,
    }
    const first = buildProtectedV2BackupExecutionReceipt(base)
    const second = buildProtectedV2BackupExecutionReceipt({
      ...base,
      executionNonce: '9'.repeat(64),
      outputDirectory: '/backup-root/two',
    })
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
