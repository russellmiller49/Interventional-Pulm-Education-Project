/** @jest-environment node */

import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson, sha256 } from './gold-import-compensation-migration-operations'
import {
  canonicalReport,
  preserveAuditDirectory,
  preserveChangedTrackedFiles,
  runCreatePostMigrationContractReconciliationBackup,
} from './create-post-migration-contract-reconciliation-backup'

async function temporaryDirectory(): Promise<string> {
  const root = await realpath(tmpdir())
  return mkdtemp(join(root, 'post-migration-reconciliation-backup-'))
}

async function writeAuditDirectory(input: {
  extra?: boolean
  kind?: 'compatibility' | 'diagnostic'
  staleReceipt?: boolean
  upstreamManifestSha256?: string
}) {
  const directory = await temporaryDirectory()
  const kind = input.kind ?? 'diagnostic'
  const upstreamManifestSha256 = input.upstreamManifestSha256 ?? 'd'.repeat(64)
  const artifactName =
    kind === 'diagnostic' ? 'migration-audit.json' : 'existing-head-compatibility-audit.json'
  const artifact =
    kind === 'diagnostic'
      ? canonicalJson({ database: { repositoryCommitSha: 'a'.repeat(40) }, ready: true })
      : canonicalJson({
          contractAuditReady: true,
          safety: {
            compensationExecuted: false,
            databaseMutationCount: 0,
            databaseQueriesExecuted: 0,
            heldOutIdentitiesAccessed: false,
            importExecuted: false,
            remoteDatabaseAccessed: false,
          },
          sourceBindings: { postMigrationAuditManifestSha256: upstreamManifestSha256 },
        })
  const manifest = `${sha256(artifact)}  ${artifactName}\n`
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
          requestedNameDiscrepancies: [],
          schemaVersion: 'gold-import-compensation-contract-diagnostic-execution/1.0.0',
        }
      : {
          canonicalArtifactCount: 1,
          canonicalManifestSha256: input.staleReceipt ? '0'.repeat(64) : manifestSha256,
          executedAt: '2026-08-09T15:00:00.000Z',
          kind: 'existing_head_compatibility_file_only_audit',
          mode: 'file_only_read_only',
          outputDirectory: directory,
          packageReady: false,
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
          terminalState: 'AUDIT READY — PHYSICIAN COMPATIBILITY SUPPLEMENT REQUIRED',
        }
  await Promise.all([
    writeFile(join(directory, artifactName), artifact),
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
  const testBuildReport = join(cwd, 'test-build.json')
  const mergeReadinessReport = join(cwd, 'merge-readiness.json')
  await Promise.all([
    writeFile(testBuildReport, canonicalJson({ passed: true })),
    writeFile(mergeReadinessReport, canonicalJson({ draft: true })),
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
    testBuildReport,
    '--merge-readiness-report',
    mergeReadinessReport,
    '--backup-root',
    backupRoot,
    '--output',
    output,
  ]
  return { argv, backupRoot, cwd, output, trackedBytes }
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
    ).resolves.toHaveLength(3)

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
