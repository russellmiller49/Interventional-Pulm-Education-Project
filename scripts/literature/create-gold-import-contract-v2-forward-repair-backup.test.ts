import {
  GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256,
  GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION,
  GOLD_IMPORT_CONTRACT_V2_BRANCH,
  REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES,
  parseGoldImportContractV2BackupArguments,
} from './create-gold-import-contract-v2-forward-repair-backup'

const REQUIRED_EVIDENCE_ARGUMENTS = REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.flatMap(
  (name) => ['--evidence', `${name}=/tmp/${name}`],
)

describe('gold import contract V2 forward-repair backup', () => {
  it('parses an explicit additive output and uniquely named evidence inputs', () => {
    expect(
      parseGoldImportContractV2BackupArguments([
        '--output-root',
        '/backup-root',
        '--output',
        '/backup-root/gold-import-contract-v2-forward-repair-v1-deadbeef',
        ...REQUIRED_EVIDENCE_ARGUMENTS,
      ]),
    ).toEqual({
      evidence: REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES.map((name) => ({
        name,
        source: `/tmp/${name}`,
      })),
      output: '/backup-root/gold-import-contract-v2-forward-repair-v1-deadbeef',
      outputRoot: '/backup-root',
    })
  })

  it.each([
    ['missing evidence', ['--output-root', '/root', '--output', '/root/result']],
    [
      'duplicate evidence names',
      [
        '--output-root',
        '/root',
        '--output',
        '/root/result',
        '--evidence',
        'report=/tmp/a',
        '--evidence',
        'report=/tmp/b',
      ],
    ],
    [
      'unsafe evidence name',
      ['--output-root', '/root', '--output', '/root/result', '--evidence', '../escape=/tmp/a'],
    ],
    [
      'unknown option',
      [
        '--output-root',
        '/root',
        '--output',
        '/root/result',
        '--evidence',
        'report=/tmp/a',
        '--database-url',
        'postgresql://forbidden',
      ],
    ],
  ])('rejects %s', (_label, argv) => {
    expect(() => parseGoldImportContractV2BackupArguments(argv)).toThrow()
  })

  it('pins the task branch, backup schema, and historical V1 byte identity', () => {
    expect(GOLD_IMPORT_CONTRACT_V2_BRANCH).toBe(
      'codex/ip-literature-import-contract-v2-forward-repair-v1',
    )
    expect(GOLD_IMPORT_CONTRACT_V2_BACKUP_SCHEMA_VERSION).toBe(
      'gold-import-contract-v2-forward-repair-backup/1.0.0',
    )
    expect(GOLD_IMPORT_CONTRACT_V1_MIGRATION_SHA256).toBe(
      'e846ef70a7b484460682a7ff61d579d3d6fdae3400805fa5395adc0464244528',
    )
    expect(REQUIRED_GOLD_IMPORT_CONTRACT_V2_BACKUP_EVIDENCE_NAMES).toEqual([
      'exact-package-report',
      'fresh-rehearsal-evidence',
      'historical-v1-identity',
      'merge-readiness-report',
      'note-disposition-audit',
      'real-local-preapplication-report',
      'schema-security-audit',
      'source-lineage-repair',
      'test-build-report',
      'upgrade-rehearsal-evidence',
    ])
  })
})
