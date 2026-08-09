/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from './gold-import-compensation-migration-operations'
import {
  POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
  POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION,
  POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION,
  canonicalReport,
  preserveAuditDirectory,
  preserveChangedTrackedFiles,
  runCreatePostMigrationContractReconciliationBackup,
  strictMergeReadinessReport,
  strictTestBuildReport,
} from './create-post-migration-contract-reconciliation-backup'

const EXECUTION_BLOCKER_CODES = [
  'excluded_status_null_not_representable_by_import_contract_v1',
  'source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1',
  'source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1',
] as const
const TERMINAL_BLOCKERS = [...EXECUTION_BLOCKER_CODES, 'incompatible_existing_head_fields'] as const

const TEST_BUILD_CHECK_IDS = [
  'completeRepositorySuite',
  'eslint',
  'focusedPostMigrationReconciliationTests',
  'gitDiffCheck',
  'importCompensationTests',
  'literatureTests',
  'migrationDatabaseContractTests',
  'operationalToolTests',
  'prettier',
  'productionBuild',
  'registryScopeCheck',
  'typeScript',
] as const

function compatibilityIdentity(index: number) {
  return {
    datasetSplit: 'development',
    itemId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    masterRowId: String(index + 1),
    pmid: String(10_000_000 + index),
  }
}

function terminalCompatibilityDetails() {
  const allIdentities = Array.from({ length: 630 }, (_, index) => compatibilityIdentity(index))
  return {
    actionCounts: {
      incompatible: 630,
      initial: 0,
      inserts: 0,
      noops: 0,
      revisions: 0,
      total: 630,
      unresolved: 0,
    },
    executionCompatibility: {
      blockedRowCount: 630,
      countsByCode: {
        excluded_status_null_not_representable_by_import_contract_v1: 272,
        source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1: 630,
        source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1: 50,
      },
      executableRowCount: 0,
      identitiesByCode: {
        excluded_status_null_not_representable_by_import_contract_v1: allIdentities.slice(0, 272),
        source_is_blinded_conflicts_with_local_automated_signals_reveal_state_v1: allIdentities,
        source_supplemental_metadata_use_conflicts_with_local_reveal_state_v1: allIdentities.slice(
          0,
          50,
        ),
      },
      totalRowCount: 630,
    },
    supplement: {
      acceptedContentSha256: null,
      required: false,
      supplied: false,
      templateContentSha256: null,
    },
    unresolved: { count: 0, pmids: [] },
  }
}

async function temporaryDirectory(): Promise<string> {
  const root = await realpath(tmpdir())
  return mkdtemp(join(root, 'post-migration-reconciliation-backup-'))
}

async function writeAuditDirectory(input: {
  contradictoryCompatibility?: boolean
  extra?: boolean
  kind?: 'compatibility' | 'diagnostic'
  omitIncompatibleReadinessBlocker?: boolean
  packageReady?: boolean
  staleReceipt?: boolean
  terminalState?: string
  upstreamManifestSha256?: string
}) {
  const directory = await temporaryDirectory()
  const kind = input.kind ?? 'diagnostic'
  const upstreamManifestSha256 = input.upstreamManifestSha256 ?? 'd'.repeat(64)
  const terminalState = input.terminalState ?? POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE
  const packageReady = input.packageReady ?? false
  const compatibilityDetails = terminalCompatibilityDetails()
  const readinessDetails = terminalCompatibilityDetails()
  if (input.contradictoryCompatibility) {
    compatibilityDetails.actionCounts.incompatible = 629
    readinessDetails.actionCounts.incompatible = 629
  }
  const artifacts =
    kind === 'diagnostic'
      ? new Map([
          [
            'migration-audit.json',
            canonicalJson({
              database: { repositoryCommitSha: 'a'.repeat(40) },
              migration: { ledgerOccurrences: 1 },
              readinessStatus: 'ready',
              result: 'audit_ready_contract_compatibility_audit_required',
              status: 'ready',
            }),
          ],
          [
            'read-only-state-bracket.json',
            canonicalJson({
              contractStateHashesMatch: true,
              preMigrationBackupManifestSha256: 'f'.repeat(64),
              snapshotsMatch: true,
            }),
          ],
        ])
      : new Map([
          [
            'existing-head-compatibility-audit.json',
            canonicalJson({
              ...compatibilityDetails,
              contractAuditReady: true,
              packageGenerationAllowed: packageReady,
              safety: {
                compensationExecuted: false,
                databaseMutationCount: 0,
                databaseQueriesExecuted: 0,
                heldOutIdentitiesAccessed: false,
                importExecuted: false,
                remoteDatabaseAccessed: false,
              },
              sourceBindings: { postMigrationAuditManifestSha256: upstreamManifestSha256 },
              status: packageReady ? 'ready' : 'blocked',
              terminalState,
            }),
          ],
          [
            'package-readiness.json',
            canonicalJson({
              ...readinessDetails,
              blockers: input.omitIncompatibleReadinessBlocker
                ? EXECUTION_BLOCKER_CODES
                : TERMINAL_BLOCKERS,
              packageGenerationAllowed: packageReady,
              readiness: packageReady ? 'ready' : 'blocked',
              terminalState,
            }),
          ],
        ])
  const manifest = [...artifacts]
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([name, contents]) => `${sha256(contents)}  ${name}\n`)
    .join('')
  const manifestSha256 = sha256(manifest)
  const zeroSafety = {
    compensationExecuted: false,
    databaseMutationCount: 0,
    databaseQueriesExecuted: 0,
    heldOutIdentitiesAccessed: false,
    importExecuted: false,
    remoteDatabaseAccessed: false,
  }
  const receipt =
    kind === 'diagnostic'
      ? {
          canonicalManifestSha256: input.staleReceipt ? '0'.repeat(64) : manifestSha256,
          compensationExecuted: false,
          databaseContainer: 'supabase_db_ip-literature-local',
          databaseMutationCount: 0,
          executedAt: '2026-08-09T15:00:00.000Z',
          heldOutIdentitiesAccessed: false,
          importExecuted: false,
          mode: 'read_only_diagnostic',
          outputDirectory: directory,
          preMigrationBackupDirectory: '/fixture/pre-backup',
          preMigrationBackupManifestSha256: 'f'.repeat(64),
          remoteDatabaseAccessed: false,
          repositoryCommitSha: 'a'.repeat(40),
          repositoryRoot: '/fixture/repository',
          requestedNameDiscrepancies: [
            {
              aliasCreated: false,
              canonicalName: 'reconcile_literature_gold_review_operation_v1',
              classification: 'audit_expectation_defect',
              requestedName: 'reconcile_literature_gold_import_v1',
            },
          ],
          schemaVersion: 'gold-import-compensation-contract-diagnostic-execution/1.0.0',
        }
      : {
          canonicalArtifactCount: artifacts.size,
          canonicalManifestSha256: input.staleReceipt ? '0'.repeat(64) : manifestSha256,
          executedAt: '2026-08-09T15:00:00.000Z',
          kind: 'existing_head_compatibility_file_only_audit',
          mode: 'file_only_read_only',
          outputDirectory: directory,
          packageReady,
          repositoryCommitSha: 'a'.repeat(40),
          safety: {
            ...zeroSafety,
            sourceArtifactBytesPreserved: true,
            sourceArtifactWritten: false,
          },
          schemaVersion: 'gold-import-existing-head-compatibility-audit-execution/1.0.0',
          sources: {
            artifactPath: '/fixture/final.csv',
            auditPath: '/fixture/migration-audit.json',
            compatibilitySupplementContentSha256: null,
            compatibilitySupplementFileSha256: null,
            finalV3ArtifactSha256: '1'.repeat(64),
            postMigrationAuditManifestSha256: upstreamManifestSha256,
          },
          terminalState,
        }
  await Promise.all([
    ...[...artifacts].map(([name, contents]) => writeFile(join(directory, name), contents)),
    writeFile(join(directory, 'checksum-manifest.sha256'), manifest),
    writeFile(join(directory, 'execution-receipt.json'), canonicalJson(receipt)),
    ...(input.extra ? [writeFile(join(directory, 'unmanifested.json'), canonicalJson({}))] : []),
  ])
  return { directory, manifestSha256 }
}

function gitBlobOid(bytes: Buffer): string {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')
}

function repositoryRunner(input: {
  cwd: string
  trackedBytes: Buffer
  branch?: string
  changeHeadAfterFirstInspection?: boolean
}) {
  const head = 'a'.repeat(40)
  const changedHead = 'c'.repeat(40)
  const originMain = 'b'.repeat(40)
  let headReads = 0
  return async (_command: string, arguments_: string[]) => {
    const command = arguments_.join(' ')
    if (command === 'rev-parse --absolute-git-dir') {
      return { stderr: '', stdout: `${input.cwd}/common.git/worktrees/codex-b\n` }
    }
    if (command === 'rev-parse --path-format=absolute --git-common-dir') {
      return { stderr: '', stdout: `${input.cwd}/common.git\n` }
    }
    if (command === 'branch --show-current') {
      return {
        stderr: '',
        stdout: `${input.branch ?? 'codex/ip-literature-post-migration-contract-reconciliation-v1'}\n`,
      }
    }
    if (command === 'status --porcelain=v1 --untracked-files=no') {
      return { stderr: '', stdout: '' }
    }
    if (command === 'rev-parse HEAD') {
      headReads += 1
      return {
        stderr: '',
        stdout: `${input.changeHeadAfterFirstInspection && headReads > 1 ? changedHead : head}\n`,
      }
    }
    if (command === 'rev-parse origin/main' || command === 'merge-base origin/main HEAD') {
      return { stderr: '', stdout: `${originMain}\n` }
    }
    if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=AM')) {
      return { stderr: '', stdout: 'tracked.txt\n' }
    }
    if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=DR')) {
      return { stderr: '', stdout: '' }
    }
    if (arguments_[0] === 'ls-tree') {
      return {
        stderr: '',
        stdout: `100644 blob ${gitBlobOid(input.trackedBytes)}\ttracked.txt\n`,
      }
    }
    throw new Error(`Unexpected test command: ${command}`)
  }
}

function reportBindings(input: {
  compatibilityAuditManifestSha256: string
  contractDiagnosticManifestSha256: string
  repositoryCommitSha?: string
}) {
  return {
    compatibilityAuditManifestSha256: input.compatibilityAuditManifestSha256,
    contractDiagnosticManifestSha256: input.contractDiagnosticManifestSha256,
    repositoryCommitSha: input.repositoryCommitSha ?? 'a'.repeat(40),
  }
}

function zeroMutationSafety() {
  return {
    compensationExecuted: false,
    databaseMutationCount: 0,
    heldOutIdentitiesAccessed: false,
    importExecuted: false,
    remoteDatabaseAccessed: false,
  }
}

function testBuildReport(bindings: ReturnType<typeof reportBindings>) {
  return {
    bindings,
    checks: TEST_BUILD_CHECK_IDS.map((id) => ({
      command: `validation-command-for-${id}`,
      exitCode: 0,
      id,
      result: 'passed',
    })),
    safety: zeroMutationSafety(),
    schemaVersion: POST_MIGRATION_RECONCILIATION_TEST_BUILD_REPORT_SCHEMA_VERSION,
    status: 'passed',
    terminalState: POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
  }
}

function mergeReadinessReport(bindings: ReturnType<typeof reportBindings>) {
  return {
    bindings,
    blockers: TERMINAL_BLOCKERS,
    codeReview: {
      mergeAuthorized: false,
      originMainIsAncestor: true,
      pullRequestDraft: true,
      readiness: 'ready_for_draft_review',
      trackedWorktreeClean: true,
    },
    importExecution: {
      compensationExecuted: false,
      importExecuted: false,
      packageGenerated: false,
      packageGenerationAllowed: false,
      readiness: 'blocked_unresolved_contract',
    },
    safety: zeroMutationSafety(),
    schemaVersion: POST_MIGRATION_RECONCILIATION_MERGE_READINESS_REPORT_SCHEMA_VERSION,
    terminalState: POST_MIGRATION_RECONCILIATION_BLOCKED_TERMINAL_STATE,
  }
}

async function backupFixture() {
  const cwd = await temporaryDirectory()
  const backupRoot = join(cwd, 'backups')
  await mkdir(backupRoot)
  const trackedBytes = Buffer.from('tracked commit bytes\n', 'utf8')
  await writeFile(join(cwd, 'tracked.txt'), trackedBytes)
  const diagnostic = await writeAuditDirectory({})
  const compatibility = await writeAuditDirectory({
    kind: 'compatibility',
    upstreamManifestSha256: diagnostic.manifestSha256,
  })
  const testBuildReportPath = join(cwd, 'test-build.json')
  const mergeReadinessReportPath = join(cwd, 'merge-readiness.json')
  const bindings = reportBindings({
    compatibilityAuditManifestSha256: compatibility.manifestSha256,
    contractDiagnosticManifestSha256: diagnostic.manifestSha256,
  })
  await Promise.all([
    writeFile(testBuildReportPath, canonicalJson(testBuildReport(bindings))),
    writeFile(mergeReadinessReportPath, canonicalJson(mergeReadinessReport(bindings))),
  ])
  const output = join(backupRoot, `post-migration-contract-reconciliation-v1-${'a'.repeat(40)}`)
  const argv = [
    '--contract-diagnostic',
    diagnostic.directory,
    '--contract-diagnostic-manifest-sha256',
    diagnostic.manifestSha256,
    '--compatibility-audit',
    compatibility.directory,
    '--compatibility-audit-manifest-sha256',
    compatibility.manifestSha256,
    '--test-build-report',
    testBuildReportPath,
    '--merge-readiness-report',
    mergeReadinessReportPath,
    '--backup-root',
    backupRoot,
    '--output',
    output,
  ]
  return {
    argv,
    backupRoot,
    compatibility,
    cwd,
    diagnostic,
    mergeReadinessReportPath,
    output,
    testBuildReportPath,
    trackedBytes,
  }
}

describe('post-migration contract reconciliation backup CLI', () => {
  test('documents a file-only additive backup with no database access', async () => {
    const result = await runCreatePostMigrationContractReconciliationBackup(['--help'])
    expect(result).toEqual(
      expect.objectContaining({
        help: expect.stringContaining('file-only'),
      }),
    )
    if (!('help' in result)) throw new Error('Expected help result.')
    expect(result.help).toContain('never contacts a database')
    expect(result.help).toContain('post-migration-contract-reconciliation-v1-CURRENT_HEAD')
  })

  test('has no commit or database-write mode', async () => {
    await expect(runCreatePostMigrationContractReconciliationBackup(['--commit'])).rejects.toThrow(
      'has no commit or database-write mode',
    )
  })

  test('accepts only an exact source inventory whose canonical receipt binds the manifest', async () => {
    const valid = await writeAuditDirectory({})
    await expect(
      preserveAuditDirectory({
        directory: valid.directory,
        expectedManifestSha256: valid.manifestSha256,
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'contract-diagnostic',
      }),
    ).resolves.toHaveLength(4)

    const extra = await writeAuditDirectory({ extra: true })
    await expect(
      preserveAuditDirectory({
        directory: extra.directory,
        expectedManifestSha256: extra.manifestSha256,
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'contract-diagnostic',
      }),
    ).rejects.toThrow(/unmanifested, missing, or unexpected/u)

    const stale = await writeAuditDirectory({ kind: 'compatibility', staleReceipt: true })
    await expect(
      preserveAuditDirectory({
        directory: stale.directory,
        expectedManifestSha256: stale.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/does not bind the reviewed manifest/u)

    const mismatchedUpstream = await writeAuditDirectory({
      kind: 'compatibility',
      upstreamManifestSha256: 'e'.repeat(64),
    })
    await expect(
      preserveAuditDirectory({
        directory: mismatchedUpstream.directory,
        expectedManifestSha256: mismatchedUpstream.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact diagnostic manifest/u)

    const wrongTerminal = await writeAuditDirectory({
      kind: 'compatibility',
      terminalState: 'AUDIT READY — PHYSICIAN COMPATIBILITY SUPPLEMENT REQUIRED',
    })
    await expect(
      preserveAuditDirectory({
        directory: wrongTerminal.directory,
        expectedManifestSha256: wrongTerminal.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/zero-mutation safety contract/u)

    const contradictory = await writeAuditDirectory({
      contradictoryCompatibility: true,
      kind: 'compatibility',
    })
    await expect(
      preserveAuditDirectory({
        directory: contradictory.directory,
        expectedManifestSha256: contradictory.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact terminal-4 action counts/u)

    const missingFourthReadinessBlocker = await writeAuditDirectory({
      kind: 'compatibility',
      omitIncompatibleReadinessBlocker: true,
    })
    await expect(
      preserveAuditDirectory({
        directory: missingFourthReadinessBlocker.directory,
        expectedManifestSha256: missingFourthReadinessBlocker.manifestSha256,
        expectedPostMigrationAuditManifestSha256: 'd'.repeat(64),
        expectedRepositoryCommitSha: 'a'.repeat(40),
        prefix: 'compatibility-audit',
      }),
    ).rejects.toThrow(/exact four terminal-4 blockers/u)
  })

  test('strictly binds passing validation and split code/import readiness reports', async () => {
    const directory = await temporaryDirectory()
    const bindings = reportBindings({
      compatibilityAuditManifestSha256: 'c'.repeat(64),
      contractDiagnosticManifestSha256: 'd'.repeat(64),
    })
    const testBuildPath = join(directory, 'test-build.json')
    const mergeReadinessPath = join(directory, 'merge-readiness.json')
    await Promise.all([
      writeFile(testBuildPath, canonicalJson(testBuildReport(bindings))),
      writeFile(mergeReadinessPath, canonicalJson(mergeReadinessReport(bindings))),
    ])
    await expect(strictTestBuildReport(testBuildPath, bindings)).resolves.toMatchObject({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })
    await expect(strictMergeReadinessReport(mergeReadinessPath, bindings)).resolves.toMatchObject({
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
    })

    const failedTestBuild = testBuildReport(bindings)
    failedTestBuild.checks[0] = { ...failedTestBuild.checks[0], exitCode: 1, result: 'failed' }
    await writeFile(testBuildPath, canonicalJson(failedTestBuild))
    await expect(strictTestBuildReport(testBuildPath, bindings)).rejects.toThrow(
      /exact command and passing result/u,
    )

    const unsafeMergeReadiness = mergeReadinessReport(bindings)
    unsafeMergeReadiness.importExecution.packageGenerationAllowed = true
    await writeFile(mergeReadinessPath, canonicalJson(unsafeMergeReadiness))
    await expect(strictMergeReadinessReport(mergeReadinessPath, bindings)).rejects.toThrow(
      /ready draft code review from blocked import execution/u,
    )

    const missingFourthMergeBlocker = {
      ...mergeReadinessReport(bindings),
      blockers: EXECUTION_BLOCKER_CODES,
    }
    await writeFile(mergeReadinessPath, canonicalJson(missingFourthMergeBlocker))
    await expect(strictMergeReadinessReport(mergeReadinessPath, bindings)).rejects.toThrow(
      /exact terminal-4 blockers/u,
    )
  })

  test('rejects final reports rebound to another HEAD or reviewed manifest', async () => {
    const directory = await temporaryDirectory()
    const expected = reportBindings({
      compatibilityAuditManifestSha256: 'c'.repeat(64),
      contractDiagnosticManifestSha256: 'd'.repeat(64),
    })
    const rebound = reportBindings({
      compatibilityAuditManifestSha256: 'e'.repeat(64),
      contractDiagnosticManifestSha256: 'd'.repeat(64),
      repositoryCommitSha: 'b'.repeat(40),
    })
    const testBuildPath = join(directory, 'test-build.json')
    const mergeReadinessPath = join(directory, 'merge-readiness.json')
    await Promise.all([
      writeFile(testBuildPath, canonicalJson(testBuildReport(rebound))),
      writeFile(mergeReadinessPath, canonicalJson(mergeReadinessReport(rebound))),
    ])
    await expect(strictTestBuildReport(testBuildPath, expected)).rejects.toThrow(
      /exact HEAD and reviewed audit manifests/u,
    )
    await expect(strictMergeReadinessReport(mergeReadinessPath, expected)).rejects.toThrow(
      /exact HEAD and reviewed audit manifests/u,
    )
  })

  test('rejects report reserialization and working-tree bytes that do not equal HEAD', async () => {
    const directory = await temporaryDirectory()
    const reportPath = join(directory, 'report.json')
    await writeFile(reportPath, '{"b":2,"a":1}\n')
    await expect(canonicalReport(reportPath, 'report')).rejects.toThrow(
      /canonical JSON byte representation/u,
    )

    const trackedPath = join(directory, 'tracked.txt')
    const committed = Buffer.from('committed\n', 'utf8')
    await writeFile(trackedPath, 'changed\n')
    const committedBlobOid = createHash('sha1')
      .update(`blob ${committed.length}\0`)
      .update(committed)
      .digest('hex')
    await expect(
      preserveChangedTrackedFiles({
        cwd: directory,
        head: 'a'.repeat(40),
        originMain: 'b'.repeat(40),
        runCommand: async (_command, arguments_) => {
          if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=AM')) {
            return { stderr: '', stdout: 'tracked.txt\n' }
          }
          if (arguments_[0] === 'diff' && arguments_.includes('--diff-filter=DR')) {
            return { stderr: '', stdout: '' }
          }
          if (arguments_[0] === 'ls-tree') {
            return {
              stderr: '',
              stdout: `100644 blob ${committedBlobOid}\ttracked.txt\n`,
            }
          }
          throw new Error(`Unexpected test command: ${arguments_.join(' ')}`)
        },
      }),
    ).rejects.toThrow(/does not match exact commit/u)
  })

  test('creates a private exact-HEAD additive backup and rejects repository drift', async () => {
    const fixture = await backupFixture()
    const result = await runCreatePostMigrationContractReconciliationBackup(fixture.argv, {
      cwd: fixture.cwd,
      now: () => new Date('2026-08-09T15:00:00.000Z'),
      runCommand: repositoryRunner(fixture),
    })
    if ('help' in result) throw new Error('unexpected help result')
    expect(result).toMatchObject({
      outputDirectory: fixture.output,
      repositoryCommitSha: 'a'.repeat(40),
    })
    expect(result.manifestSha256).toMatch(/^[a-f0-9]{64}$/u)
    expect((await stat(fixture.output)).mode & 0o777).toBe(0o700)
    expect((await stat(join(fixture.output, 'backup-index.json'))).mode & 0o777).toBe(0o600)
    expect(await readdir(fixture.output)).toEqual(
      expect.arrayContaining([
        'backup-index.json',
        'checksum-manifest.sha256',
        'execution-receipt.json',
        'merge-readiness-report.json',
        'test-build-report.json',
      ]),
    )
    expect(await readFile(join(fixture.output, 'checksum-manifest.sha256'), 'utf8')).toContain(
      'backup-index.json',
    )

    const drift = await backupFixture()
    await expect(
      runCreatePostMigrationContractReconciliationBackup(drift.argv, {
        cwd: drift.cwd,
        runCommand: repositoryRunner({ ...drift, changeHeadAfterFirstInspection: true }),
      }),
    ).rejects.toThrow(/repository identity changed/iu)
  })

  test('enforces the exact feature branch and output basename before reading sources', async () => {
    const wrongBranch = await backupFixture()
    await expect(
      runCreatePostMigrationContractReconciliationBackup(wrongBranch.argv, {
        cwd: wrongBranch.cwd,
        runCommand: repositoryRunner({ ...wrongBranch, branch: 'main' }),
      }),
    ).rejects.toThrow(/requires branch/u)

    const wrongOutput = await backupFixture()
    const outputIndex = wrongOutput.argv.indexOf('--output') + 1
    wrongOutput.argv[outputIndex] = join(wrongOutput.backupRoot, 'wrong-name')
    await expect(
      runCreatePostMigrationContractReconciliationBackup(wrongOutput.argv, {
        cwd: wrongOutput.cwd,
        runCommand: repositoryRunner(wrongOutput),
      }),
    ).rejects.toThrow(/exact current 40-character HEAD/u)
  })
})
