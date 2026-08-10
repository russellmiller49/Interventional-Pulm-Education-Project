import { assertReadOnlySnapshotSql } from './gold-import-compensation-migration-operations'
import {
  GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION,
  GOLD_IMPORT_V2_TASK_BRANCH,
  buildGoldImportV2PreapplicationCountSql,
} from './diagnose-gold-import-compensation-v2-preapplication'

describe('gold import contract V2 real-local pre-application diagnostic', () => {
  it('pins the task branch and report schema', () => {
    expect(GOLD_IMPORT_V2_TASK_BRANCH).toBe(
      'codex/ip-literature-import-contract-v2-forward-repair-v1',
    )
    expect(GOLD_IMPORT_V2_PREAPPLICATION_REPORT_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-preapplication-report/1.0.0',
    )
  })

  it('uses only an explicit repeatable-read/read-only aggregate query', () => {
    const sql = buildGoldImportV2PreapplicationCountSql()
    expect(() => assertReadOnlySnapshotSql(sql)).not.toThrow()
    expect(sql).toContain('transaction isolation level repeatable read read only')
    expect(sql).toContain("batch.name = 'gold-set-v1'")
    expect(sql).not.toContain("dataset_split = 'test'")
  })
})
