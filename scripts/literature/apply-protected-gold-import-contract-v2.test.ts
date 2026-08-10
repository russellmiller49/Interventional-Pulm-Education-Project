import { createHash } from 'node:crypto'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

import {
  PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION,
  parseProtectedV2OperatorArguments,
  runProtectedV2Operator,
  verifyProtectedV2PreapplicationBackup,
  type ProtectedV2DatabaseEvidence,
  type ProtectedV2OperatorDependencies,
  type ProtectedV2RepositoryEvidence,
} from './apply-protected-gold-import-contract-v2'
import { GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 } from './gold-import-note-disposition-gate-v2'
import {
  DEFAULT_LOCAL_DATABASE_CONTAINER,
  LOCAL_DATABASE_PORT,
  LOCAL_SUPABASE_PROJECT_ID,
  canonicalJson,
} from './gold-import-compensation-migration-operations'
import {
  PROTECTED_GOLD_IMPORT_CONTRACT_V1,
  PROTECTED_GOLD_IMPORT_CONTRACT_V2,
  PROTECTED_V2_AUTHORIZED_CAPABILITY,
  PROTECTED_V2_CONFIRMATION,
  PROTECTED_V2_FORBIDDEN_CAPABILITIES,
  buildProtectedV2Authorization,
  validateProtectedV2Authorization,
  type ProtectedV2AuthorizationContext,
} from './protected-gold-import-contract-v2'

const HEAD = '1111111111111111111111111111111111111111'
const NOW = new Date('2026-08-09T20:00:00.000Z')

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function repository(head = HEAD): ProtectedV2RepositoryEvidence {
  return {
    branch: 'main',
    head,
    originMain: head,
    statusCleanIncludingUntracked: true,
  }
}

function database(applied = false): ProtectedV2DatabaseEvidence {
  return {
    batchId: '10000000-0000-4000-8000-000000000001',
    ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
    ledgerEntries: [
      {
        name: PROTECTED_GOLD_IMPORT_CONTRACT_V1.migrationName,
        version: PROTECTED_GOLD_IMPORT_CONTRACT_V1.version,
      },
      ...(applied
        ? [
            {
              name: PROTECTED_GOLD_IMPORT_CONTRACT_V2.migrationName,
              version: PROTECTED_GOLD_IMPORT_CONTRACT_V2.version,
            },
          ]
        : []),
    ],
    readOnlyBracketMatches: true,
    v1Occurrence: 1,
    v2Occurrence: applied ? 1 : 0,
  }
}

function backup(directory: string, suffix: string) {
  return {
    canonicalManifestSha256: suffix.repeat(64),
    directory,
    executedAt: NOW.toISOString(),
    executionReceiptSha256: (suffix === 'a' ? 'c' : 'd').repeat(64),
  }
}

function context(): ProtectedV2AuthorizationContext {
  return {
    backups: [backup('/backup/one', 'a'), backup('/backup/two', 'b')],
    database: {
      container: DEFAULT_LOCAL_DATABASE_CONTAINER,
      ...GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2,
      port: LOCAL_DATABASE_PORT,
      projectId: LOCAL_SUPABASE_PROJECT_ID,
      target: 'local',
      v1Occurrence: 1,
      v2Occurrence: 0,
    },
    migration: PROTECTED_GOLD_IMPORT_CONTRACT_V2,
    repository: repository(),
    safety: { heldOutIdentitiesAccessed: false, remoteDatabaseAccessed: false },
  }
}

function operatorDependencies(counters: Record<string, number>): ProtectedV2OperatorDependencies {
  return {
    applyMigration: async () => {
      counters.apply += 1
    },
    inspectDatabase: async (expected) => database(expected === 'v2_applied_exactly_once'),
    inspectRepository: async () => repository(),
    now: () => NOW,
    stageProtectedMigration: async () => {
      counters.stage += 1
    },
    verifyBackup: async ({ directory }) =>
      directory.endsWith('one') ? backup(directory, 'a') : backup(directory, 'b'),
    writeReceipt: async () => {
      counters.receipt += 1
      return { manifestSha256: 'e'.repeat(64), outputDirectory: '/local/receipt' }
    },
  }
}

describe('protected V2 migration operator boundary', () => {
  const cleanupDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      cleanupDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
    )
  })

  it('parses a dry-run by default and rejects any remote target', () => {
    expect(
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator@example.test',
        '--backup',
        '/backup/one',
        '--backup',
        '/backup/two',
      ]),
    ).toEqual({
      backups: ['/backup/one', '/backup/two'],
      commit: false,
      confirmation: undefined,
      operator: 'operator@example.test',
      output: undefined,
      target: 'local',
    })
    expect(() =>
      parseProtectedV2OperatorArguments([
        '--target',
        'remote',
        '--operator',
        'operator',
        '--backup',
        '/one',
        '--backup',
        '/two',
      ]),
    ).toThrow('target must be exactly local')
  })

  it('requires explicit commit confirmation and a local-only receipt output', () => {
    expect(() =>
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--backup',
        '/one',
        '--backup',
        '/two',
        '--commit',
      ]),
    ).toThrow('--commit requires --confirmation')
    expect(
      parseProtectedV2OperatorArguments([
        '--target',
        'local',
        '--operator',
        'operator',
        '--backup',
        '/one',
        '--backup',
        '/two',
        '--confirmation',
        PROTECTED_V2_CONFIRMATION,
        '--output',
        '/local-data/receipt',
        '--commit',
      ]).commit,
    ).toBe(true)
  })

  it('performs no staging, migration application, or receipt write in dry-run mode', async () => {
    const counters = { apply: 0, receipt: 0, stage: 0 }
    const result = await runProtectedV2Operator(
      {
        backups: ['/backup/one', '/backup/two'],
        commit: false,
        operator: 'operator',
        target: 'local',
      },
      operatorDependencies(counters),
    )
    expect(result).toMatchObject({
      databaseMutationCount: 0,
      mode: 'dry_run_read_only',
      protectedState: 'v2_absent_unarmed',
    })
    expect(counters).toEqual({ apply: 0, receipt: 0, stage: 0 })
  })

  it('enters the explicit armed state only in commit mode, then applies exactly once', async () => {
    const counters = { apply: 0, receipt: 0, stage: 0 }
    const result = await runProtectedV2Operator(
      {
        backups: ['/backup/one', '/backup/two'],
        commit: true,
        confirmation: PROTECTED_V2_CONFIRMATION,
        operator: 'operator',
        output: '/local/receipt',
        target: 'local',
      },
      operatorDependencies(counters),
    )
    expect(result).toMatchObject({
      databaseMutationCount: 1,
      mode: 'committed_protected_v2_migration',
      protectedState: 'v2_applied_exactly_once',
    })
    expect(counters).toEqual({ apply: 1, receipt: 1, stage: 1 })
  })

  it.each(['repository', 'state', 'backup'] as const)(
    'invalidates authorization after %s drift',
    (drift) => {
      const original = context()
      const authorization = buildProtectedV2Authorization({
        confirmation: PROTECTED_V2_CONFIRMATION,
        context: original,
        operator: 'operator',
        requestedAt: NOW.toISOString(),
      })
      const current = JSON.parse(JSON.stringify(original)) as ProtectedV2AuthorizationContext
      if (drift === 'repository') {
        current.repository.head = '2222222222222222222222222222222222222222'
        current.repository.originMain = current.repository.head
      } else if (drift === 'state') {
        current.database.effectiveStateSha256 = '3'.repeat(64)
      } else {
        current.backups[0].canonicalManifestSha256 = '4'.repeat(64)
      }
      expect(() => validateProtectedV2Authorization(authorization, current)).toThrow('stale')
    },
  )

  it('pins migration-only scope and expressly cannot authorize import or compensation', () => {
    const authorization = buildProtectedV2Authorization({
      confirmation: PROTECTED_V2_CONFIRMATION,
      context: context(),
      operator: 'operator',
      requestedAt: NOW.toISOString(),
    })
    expect(authorization.authorizedCapability).toBe(PROTECTED_V2_AUTHORIZED_CAPABILITY)
    expect(authorization.forbiddenCapabilities).toEqual(PROTECTED_V2_FORBIDDEN_CAPABILITIES)
    expect(authorization.context.safety).toEqual({
      heldOutIdentitiesAccessed: false,
      remoteDatabaseAccessed: false,
    })
    expect(PROTECTED_V2_APPLICATION_REPORT_SCHEMA_VERSION).toBe(
      'literature-gold-protected-v2-migration-application/1.0.0',
    )
  })

  it('authenticates a fresh checksum-sealed development-only pre-application backup', async () => {
    const directory = await mkdtemp(resolve(tmpdir(), 'protected-v2-backup-'))
    cleanupDirectories.push(directory)
    const currentDatabase = database()
    const files = new Map<string, string>([
      [
        'development-database-seed.json',
        canonicalJson({ datasetSplit: 'development', heldOutIdentitiesIncluded: false }),
      ],
      [
        'pre-application-report.json',
        canonicalJson({
          schemaVersion: 'gold-import-contract-v2-preapplication-report/1.0.0',
          repository: repository(),
          migration: {
            v1: { occurrence: 1, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V1.sha256 },
            v2: { occurrence: 0, sha256: PROTECTED_GOLD_IMPORT_CONTRACT_V2.sha256 },
          },
          database: { current: GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2 },
          ordinaryLocalStartPlan: {
            firstStartProtectedV2Visible: false,
            migrationUpProtectedV2Visible: false,
            protectedMigrationApplicationPlanned: false,
            protectedMigrationState: 'v2_absent_unarmed',
            protectedV2AuthorizationPresent: false,
          },
          safety: {
            heldOutIdentitiesAccessed: false,
            realLocalDatabaseMutationCount: 0,
            remoteDatabaseAccessed: false,
          },
        }),
      ],
      ['pre-application-report.md', '# Read-only pre-application backup\n'],
      [
        'protected-migration-ledger.json',
        canonicalJson({
          protectedV2: { classification: 'v2_absent', occurrence: 0 },
        }),
      ],
      ['state-hashes.json', canonicalJson(GOLD_IMPORT_CURRENT_STATE_IDENTITIES_V2)],
    ])
    const manifest = [...files]
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([name, bytes]) => `${sha256(bytes)}  ${name}\n`)
      .join('')
    await Promise.all([
      ...[...files].map(([name, bytes]) => writeFile(resolve(directory, name), bytes, 'utf8')),
      writeFile(resolve(directory, 'checksum-manifest.sha256'), manifest, 'utf8'),
      writeFile(
        resolve(directory, 'execution-receipt.json'),
        canonicalJson({
          schemaVersion: 'gold-import-contract-v2-preapplication-execution/1.0.0',
          executedAt: NOW.toISOString(),
          canonicalManifestSha256: sha256(manifest),
          repositoryCommitSha: HEAD,
          databaseMutationCount: 0,
          heldOutIdentitiesAccessed: false,
          remoteDatabaseAccessed: false,
        }),
        'utf8',
      ),
    ])
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: currentDatabase,
        directory,
        now: NOW,
        repository: repository(),
      }),
    ).resolves.toMatchObject({
      canonicalManifestSha256: sha256(manifest),
      directory: await realpath(directory),
      executedAt: NOW.toISOString(),
    })
    await expect(
      verifyProtectedV2PreapplicationBackup({
        database: currentDatabase,
        directory,
        now: new Date(NOW.getTime() + 3 * 60 * 60 * 1000),
        repository: repository(),
      }),
    ).rejects.toThrow('stale or unsafe')
  })
})
