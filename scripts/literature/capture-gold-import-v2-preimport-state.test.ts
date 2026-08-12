/** @jest-environment node */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT,
  validateGoldImportV2PreimportCaptureCliArguments,
} from './capture-gold-import-v2-preimport-state'
import {
  GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
  inspectGoldImportV2PrimaryMainRepository,
  type GoldImportV2GitCommandRunner,
} from './gold-import-v2-package-readiness'
import {
  PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS,
  PROTECTED_V2_RECOVERY_DOCKER_COMMAND,
  PROTECTED_V2_RECOVERY_EVIDENCE_TRANSACTION_BATCHES,
  assertProtectedV2RecoveryEvidenceSqlReadOnly,
} from './protected-gold-import-contract-v2-recovery-evidence-adapter'

const HEAD = '1234567890abcdef1234567890abcdef12345678'

function gitRunner(
  update: {
    branch?: string
    commonDirectory?: string
    gitDirectory?: string
    head?: string
    originMain?: string
    repositoryRoot?: string
    status?: string
  } = {},
): GoldImportV2GitCommandRunner {
  return async (arguments_) => {
    const command = arguments_.join(' ')
    if (command === 'rev-parse --show-toplevel') {
      return update.repositoryRoot ?? GOLD_IMPORT_V2_PRIMARY_CHECKOUT
    }
    if (command === 'symbolic-ref --quiet --short HEAD') return update.branch ?? 'main'
    if (command === 'rev-parse HEAD') return update.head ?? HEAD
    if (command === 'rev-parse refs/remotes/origin/main') return update.originMain ?? HEAD
    if (command === 'rev-parse --path-format=absolute --git-dir') {
      return update.gitDirectory ?? `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/.git`
    }
    if (command === 'rev-parse --path-format=absolute --git-common-dir') {
      return update.commonDirectory ?? `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/.git`
    }
    if (command === 'status --porcelain=v1 --untracked-files=all') return update.status ?? ''
    throw new Error(`Unexpected git command in test: ${command}`)
  }
}

describe('post-V2 pre-import capture production command', () => {
  it('rejects every target, branch, output, split, and identity override before dependencies', async () => {
    for (const argv of [
      ['--target', 'remote'],
      ['--target', 'local'],
      ['--output', '/tmp/capture'],
      ['--branch', 'main'],
      ['--split', 'test'],
      ['--held-out'],
      ['--database-url', 'postgres://example.invalid/db'],
      ['--allow-feature-branch'],
    ]) {
      expect(() => validateGoldImportV2PreimportCaptureCliArguments(argv)).toThrow('Unknown option')
    }
  })

  it('parses only the pure no-target capture command surface', () => {
    expect(validateGoldImportV2PreimportCaptureCliArguments([])).toEqual({ help: false })
    expect(validateGoldImportV2PreimportCaptureCliArguments(['--help'])).toEqual({ help: true })
    expect(() => validateGoldImportV2PreimportCaptureCliArguments(['--help=value'])).toThrow(
      '--help does not accept a value',
    )
  })

  it('accepts only exact clean attached primary main at origin/main', async () => {
    await expect(
      inspectGoldImportV2PrimaryMainRepository({
        cwd: GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
        runGit: gitRunner(),
      }),
    ).resolves.toMatchObject({
      branch: 'main',
      cleanNonIgnoredUntracked: true,
      cleanTracked: true,
      headSha: HEAD,
      originMainSha: HEAD,
      primaryCheckout: true,
    })

    for (const update of [
      { branch: 'codex/feature' },
      { branch: 'HEAD' },
      { status: ' M package.json' },
      { status: '?? unexpected.txt' },
      { originMain: 'f'.repeat(40) },
      { commonDirectory: `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/../.git` },
      { repositoryRoot: `${GOLD_IMPORT_V2_PRIMARY_CHECKOUT}/subdirectory` },
    ]) {
      await expect(
        inspectGoldImportV2PrimaryMainRepository({
          cwd: GOLD_IMPORT_V2_PRIMARY_CHECKOUT,
          runGit: gitRunner(update),
        }),
      ).rejects.toThrow()
    }
  })

  it('contains only the fixed Docker target and bracketed read-only SQL', async () => {
    expect(PROTECTED_V2_RECOVERY_DOCKER_COMMAND).toBe('docker')
    expect(PROTECTED_V2_RECOVERY_DOCKER_ARGUMENTS).toContain('supabase_db_ip-literature-local')
    for (const sql of PROTECTED_V2_RECOVERY_EVIDENCE_TRANSACTION_BATCHES) {
      expect(() => assertProtectedV2RecoveryEvidenceSqlReadOnly(sql)).not.toThrow()
      expect(sql).toContain('repeatable read read only')
      expect(sql).toMatch(/rollback;\s*$/u)
      expect(sql).not.toContain("dataset_split = 'test'")
    }
    const source = await readFile(
      resolve(process.cwd(), 'scripts/literature/capture-gold-import-v2-preimport-state.ts'),
      'utf8',
    )
    expect(source).not.toContain('createClient(')
    expect(source).not.toContain('DATABASE_URL')
    expect(source).not.toContain('--allow-feature-branch')
    expect(source).toContain('realpathSync(fileURLToPath(import.meta.url))')
    expect(source).toContain("'scripts/literature/capture-gold-import-v2-preimport-state.ts'")
    expect(source).toContain('EXECUTING_MODULE_PATH !== EXPECTED_PRODUCTION_MODULE_PATH')
    expect(source).toContain('realpathSync(resolve(process.argv[1])) !== EXECUTING_MODULE_PATH')
    expect(GOLD_IMPORT_V2_PREIMPORT_CAPTURE_ROOT).toContain(
      '/local-data/literature/gold-v2-preimport-captures',
    )
    expect(source).not.toContain('export interface GoldImportV2PreimportCaptureDependencies')
    expect(source).not.toContain('export async function writeGoldImportV2PreimportCapture(')
    expect(source).not.toContain('export async function runGoldImportV2PreimportCaptureCore(')
    expect(source).not.toContain('export async function runGoldImportV2PreimportCapture(')
    const orchestration = source.slice(
      source.indexOf('async function runGoldImportV2PreimportCaptureWithDependencies'),
    )
    expect(orchestration.indexOf('runtime.inspectRepository()')).toBeGreaterThan(-1)
    expect(orchestration.indexOf('runtime.collectDatabaseEvidence()')).toBeGreaterThan(
      orchestration.indexOf('runtime.loadFinalizedReceipt()'),
    )
    expect(orchestration.indexOf('runtime.writeCapture({')).toBeGreaterThan(
      orchestration.indexOf('canonicalJson(currentRuntimeBundle) !== canonicalJson(runtimeBundle)'),
    )
  })
})
