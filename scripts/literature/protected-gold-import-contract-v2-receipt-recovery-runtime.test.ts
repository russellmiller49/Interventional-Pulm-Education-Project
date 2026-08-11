/** @jest-environment node */

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'

import { LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256 } from './literature-gold-v2-schema-only-transition'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH,
  buildProtectedV2ReceiptRecoveryAmendmentFromAuthority,
  parseProtectedV2ReceiptRecoveryCommittedAmendment,
} from './protected-gold-import-contract-v2-receipt-recovery-authority'
import {
  buildProtectedV2ReceiptRecoveryBundle,
  canonicalProtectedV2ReceiptRecoveryJson,
  protectedV2ReceiptRecoverySha256,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'
import {
  PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_COMMAND,
  PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_SCRIPT,
  assertProtectedV2ReceiptRecoveryToolBundleStaticClosure,
  buildCurrentProtectedV2ReceiptRecoveryToolBundle,
} from './protected-gold-import-contract-v2-receipt-recovery-tool-bundle'
import {
  assertProtectedV2ReceiptRecoveryReadOnlyQueryAudit,
  parseProtectedV2ReceiptRecoveryArguments,
  runProtectedV2ReceiptRecoveryCommand,
} from './protected-gold-import-contract-v2-receipt-recovery-runtime'

const execFileAsync = promisify(execFile)

async function writeFixtureFile(cwd: string, path: string, bytes: string): Promise<void> {
  await mkdir(dirname(resolve(cwd, path)), { recursive: true })
  await writeFile(resolve(cwd, path), bytes)
}

async function createBundleFixture(): Promise<string> {
  const cwd = await realpath(await mkdtemp(resolve(tmpdir(), 'protected-v2-recovery-bundle-')))
  await Promise.all([
    writeFixtureFile(cwd, 'package-lock.json', '{"lockfileVersion":3,"name":"fixture"}\n'),
    writeFixtureFile(
      cwd,
      'package.json',
      `${JSON.stringify(
        {
          devDependencies: { typescript: '1.0.0' },
          scripts: {
            [PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_SCRIPT]:
              PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_COMMAND,
          },
        },
        null,
        2,
      )}\n`,
    ),
    writeFixtureFile(cwd, 'scripts/require-primary-checkout.mjs', 'export {}\n'),
    writeFixtureFile(
      cwd,
      'scripts/literature/finalize-protected-v2-receipt-recovery-amendment.ts',
      "import './runtime'\n",
    ),
    writeFixtureFile(
      cwd,
      'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
      "import './runtime'\n",
    ),
    writeFixtureFile(
      cwd,
      'scripts/literature/runtime.ts',
      "export { helper } from './support/helper'\nimport type { Shape } from './support/type'\n",
    ),
    writeFixtureFile(
      cwd,
      'scripts/literature/support/helper.ts',
      "import ts from 'typescript'\nexport const helper = ts.version\n",
    ),
    writeFixtureFile(cwd, 'scripts/literature/support/type.ts', 'export interface Shape {}\n'),
    writeFixtureFile(cwd, 'tsconfig.json', '{"compilerOptions":{}}\n'),
  ])
  await execFileAsync('git', ['init', '--quiet'], { cwd })
  await execFileAsync('git', ['add', '--all'], { cwd })
  return cwd
}

describe('protected V2 receipt recovery integration boundary', () => {
  const cleanup: string[] = []

  afterEach(async () => {
    await Promise.all(cleanup.splice(0).map((path) => rm(path, { force: true, recursive: true })))
  })

  it('requires the one exact external amendment confirmation argument', () => {
    const identity = 'a'.repeat(64)
    expect(
      parseProtectedV2ReceiptRecoveryArguments(['--expected-amendment-sha256', identity]),
    ).toEqual({ expectedAmendmentIdentitySha256: identity })
    expect(parseProtectedV2ReceiptRecoveryArguments(['--help'])).toEqual({ help: true })
    for (const arguments_ of [
      [],
      ['--expected-amendment-sha256'],
      ['--expected-amendment-sha256', 'A'.repeat(64)],
      ['--target', 'elsewhere'],
      ['--help', '--expected-amendment-sha256', identity],
    ]) {
      expect(() => parseProtectedV2ReceiptRecoveryArguments(arguments_)).toThrow('requires exactly')
    }
  })

  it('rejects any checkout other than the fixed primary path before evidence collection', async () => {
    const cwd = await realpath(await mkdtemp(resolve(tmpdir(), 'protected-v2-recovery-path-')))
    cleanup.push(cwd)
    const collectReadOnlyEvidence = jest.fn()
    await expect(
      runProtectedV2ReceiptRecoveryCommand(
        ['--expected-amendment-sha256', 'a'.repeat(64)],
        { collectReadOnlyEvidence },
        { cwd },
      ),
    ).rejects.toThrow('exact primary checkout')
    expect(collectReadOnlyEvidence).not.toHaveBeenCalled()
  })

  it('rejects extra runtime dependencies before any path or database access', async () => {
    await expect(
      runProtectedV2ReceiptRecoveryCommand(['--expected-amendment-sha256', 'a'.repeat(64)], {
        collectReadOnlyEvidence: jest.fn(),
        stageMigration: jest.fn(),
      } as never),
    ).rejects.toThrow('may expose only collectReadOnlyEvidence')
  })

  it('accepts only repeatable-read/read-only SQL and rejects mutation or remote evidence', () => {
    const safe = {
      databaseMutationCount: 0 as const,
      heldOutIdentitiesAccessed: false as const,
      localDockerEndpoint: true as const,
      remoteDatabaseAccessed: false as const,
      transactionBatches: [
        "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL statement_timeout = '120s'; SELECT 1; WITH exact AS (SELECT 2) SELECT * FROM exact; ROLLBACK;",
      ],
    }
    expect(() => assertProtectedV2ReceiptRecoveryReadOnlyQueryAudit(safe)).not.toThrow()
    for (const transactionBatches of [
      ['BEGIN; SELECT 1; ROLLBACK;'],
      [
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; UPDATE exact SET changed = true; ROLLBACK;',
      ],
      [
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; WITH changed AS (DELETE FROM exact RETURNING *) SELECT * FROM changed; ROLLBACK;',
      ],
      [
        'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SELECT * FROM exact FOR UPDATE; ROLLBACK;',
      ],
    ]) {
      expect(() =>
        assertProtectedV2ReceiptRecoveryReadOnlyQueryAudit({ ...safe, transactionBatches }),
      ).toThrow()
    }
    expect(() =>
      assertProtectedV2ReceiptRecoveryReadOnlyQueryAudit({
        ...safe,
        localDockerEndpoint: false,
        remoteDatabaseAccessed: true,
      } as never),
    ).toThrow('exact local read-only evidence')
  })

  it('builds the committed one-incident authority into a complete canonical amendment', async () => {
    const authorityBytes = await readFile(
      resolve(process.cwd(), PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH),
      'utf8',
    )
    const bundle = buildProtectedV2ReceiptRecoveryBundle([
      {
        gitMode: '100644',
        path: 'scripts/literature/recovery.ts',
        sha256: protectedV2ReceiptRecoverySha256('reviewed recovery bytes'),
      },
    ])
    const { amendment } = buildProtectedV2ReceiptRecoveryAmendmentFromAuthority({
      authorityBytes,
      correctedRecoveryToolBundle: bundle,
      correctedTransitionPolicyIdentitySha256:
        LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
    })
    const amendmentBytes = canonicalProtectedV2ReceiptRecoveryJson(amendment)
    expect(
      parseProtectedV2ReceiptRecoveryCommittedAmendment({
        amendmentBytes,
        authorityBytes,
        correctedRecoveryToolBundle: bundle,
        correctedTransitionPolicyIdentitySha256:
          LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
      }),
    ).toEqual(amendment)
    expect(amendment.correctedRecoveryToolBundle).toEqual(bundle)
    expect(amendment.historicalIncident.intentSha256).toBe(
      'deeedb1e93921d0e0e8a01009a6a1ed5c67114f53f94ea5cac277d99f113d8f4',
    )

    const authority = JSON.parse(authorityBytes) as Record<string, unknown>
    authority.unexpected = true
    expect(() =>
      buildProtectedV2ReceiptRecoveryAmendmentFromAuthority({
        authorityBytes: canonicalProtectedV2ReceiptRecoveryJson(authority),
        correctedRecoveryToolBundle: bundle,
        correctedTransitionPolicyIdentitySha256:
          LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
      }),
    ).toThrow('one-incident scope')

    const changedBundle = buildProtectedV2ReceiptRecoveryBundle([
      {
        gitMode: '100644',
        path: 'scripts/literature/recovery.ts',
        sha256: protectedV2ReceiptRecoverySha256('changed recovery bytes'),
      },
    ])
    expect(() =>
      parseProtectedV2ReceiptRecoveryCommittedAmendment({
        amendmentBytes,
        authorityBytes,
        correctedRecoveryToolBundle: changedBundle,
        correctedTransitionPolicyIdentitySha256:
          LITERATURE_GOLD_V2_SCHEMA_ONLY_TRANSITION_POLICY_IDENTITY_SHA256,
      }),
    ).toThrow('exact current policy and recovery-tool bundle')
  })

  it('seals package controls plus the complete sorted transitive executable closure', async () => {
    const cwd = await createBundleFixture()
    cleanup.push(cwd)
    const first = await buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd })
    const repeated = await buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd })
    expect(repeated).toEqual(first)
    expect(first.files.map(({ path }) => path)).toEqual([
      'package-lock.json',
      'package.json',
      'scripts/literature/finalize-protected-v2-receipt-recovery-amendment.ts',
      'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
      'scripts/literature/runtime.ts',
      'scripts/literature/support/helper.ts',
      'scripts/literature/support/type.ts',
      'scripts/require-primary-checkout.mjs',
      'tsconfig.json',
    ])

    const omitted = buildProtectedV2ReceiptRecoveryBundle(
      first.files.filter(({ path }) => path !== 'scripts/literature/support/helper.ts'),
    )
    await expect(
      assertProtectedV2ReceiptRecoveryToolBundleStaticClosure({ bundle: omitted, cwd }),
    ).rejects.toThrow('omits or changes')

    await writeFixtureFile(
      cwd,
      'scripts/literature/support/helper.ts',
      "import ts from 'typescript'\nexport const helper = `${ts.version}-changed`\n",
    )
    expect(
      (await buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd })).aggregateSha256,
    ).not.toBe(first.aggregateSha256)
  })

  it('fails closed for untracked transitive code and package-script drift', async () => {
    const untracked = await createBundleFixture()
    cleanup.push(untracked)
    await writeFixtureFile(
      untracked,
      'scripts/literature/runtime.ts',
      "import './untracked-shadow'\n",
    )
    await writeFixtureFile(
      untracked,
      'scripts/literature/untracked-shadow.ts',
      'export const shadow = true\n',
    )
    await expect(
      buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd: untracked }),
    ).rejects.toThrow('exactly one tracked file')

    const drifted = await createBundleFixture()
    cleanup.push(drifted)
    const packageJson = JSON.parse(await readFile(resolve(drifted, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    packageJson.scripts[PROTECTED_V2_RECEIPT_RECOVERY_PACKAGE_SCRIPT] = 'tsx unsafe.ts'
    await writeFile(resolve(drifted, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)
    await expect(
      buildCurrentProtectedV2ReceiptRecoveryToolBundle({ cwd: drifted }),
    ).rejects.toThrow('package script')
  })

  it('has no migration, import, compensation, or local-Supabase capability import', async () => {
    const paths = [
      'scripts/literature/recover-protected-gold-import-contract-v2-receipt.ts',
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-runtime.ts',
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-read-only-adapter.ts',
      'scripts/literature/protected-gold-import-contract-v2-receipt-recovery-core.ts',
    ]
    const source = (
      await Promise.all(paths.map((path) => readFile(resolve(process.cwd(), path), 'utf8')))
    ).join('\n')
    expect(source).not.toMatch(/from ['"].*apply-protected-gold-import-contract-v2/iu)
    expect(source).not.toMatch(/from ['"].*gold-import-compensation-cli/iu)
    expect(source).not.toMatch(/from ['"].*execute-exact-gold-import-compensation/iu)
    expect(source).not.toMatch(/from ['"].*local-supabase/iu)
    expect(source).not.toMatch(/from ['"].*stage-authorized/iu)
  })
})
