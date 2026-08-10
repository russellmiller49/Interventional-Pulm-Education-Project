import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import {
  assertExactGeneratedPackageReferenceV2,
  assertMigrationEquivalentPostV2SeedIdentity,
} from './execute-exact-gold-import-compensation-package-v2'
import {
  V2_REHEARSAL_TASK_BRANCH,
  authenticateV2RehearsalRepositoryHead,
  assertV2RehearsalRepositoryUnchanged,
  executeCompleteV2Rehearsal,
  runExactPackageRehearsalV2Cli,
} from './rehearse-exact-gold-import-compensation-package-v2'
import type { V2DisposablePathResult } from './rehearse-gold-import-compensation-db-v2'
import type { DisposableContainerCleanupOutcome } from './rehearse-exact-gold-import-compensation-package-v1'

function cleanup(): DisposableContainerCleanupOutcome {
  return {
    absenceChecks: [
      { identifier: 'owned', kind: 'exact_name', present: false },
      { identifier: 'a'.repeat(64), kind: 'container_id', present: false },
    ],
    absenceVerification: 'verified_absent',
    attempted: true,
    containerId: 'a'.repeat(64),
    containerName: 'owned',
    errors: [],
    outcome: 'removed_and_verified_absent',
    removalCommandSucceeded: true,
  }
}

function result(path: 'fresh' | 'upgrade'): V2DisposablePathResult {
  const evidence = Buffer.from(`${path}-canonical-evidence\n`)
  return {
    canonicalArtifacts: new Map([
      ['canonical-manifest.sha256', Buffer.from(`${'a'.repeat(64)}  evidence\n`)],
      ['v2-rehearsal-evidence.json', evidence],
    ]),
    cleanup: cleanup(),
    migrationPath: path,
    migrationSha256: 'b'.repeat(64),
    rawReceipt: {},
  }
}

describe('exact V2 package rehearsal entrypoint', () => {
  test('authenticates exact branch, clean tracked/untracked state, and origin/main ancestry', async () => {
    const repositoryGit = (overrides?: {
      branch?: string
      dirty?: boolean
      noAncestry?: boolean
    }) => ({
      run: jest.fn(async (arguments_: readonly string[]) => {
        const command = arguments_.join(' ')
        if (command === 'symbolic-ref --short HEAD') {
          return { stdout: `${overrides?.branch ?? V2_REHEARSAL_TASK_BRANCH}\n` }
        }
        if (command === 'status --porcelain=v1 --untracked-files=all') {
          return { stdout: overrides?.dirty ? '?? untracked-evidence.json\n' : '' }
        }
        if (command === 'merge-base --is-ancestor origin/main HEAD') {
          if (overrides?.noAncestry) throw new Error('not an ancestor')
          return { stdout: '' }
        }
        if (command === 'rev-parse HEAD') return { stdout: `${'1'.repeat(40)}\n` }
        throw new Error(`Unexpected git command: ${command}`)
      }),
    })

    const clean = repositoryGit()
    await expect(authenticateV2RehearsalRepositoryHead(clean)).resolves.toBe('1'.repeat(40))
    expect(clean.run).toHaveBeenCalledWith(['status', '--porcelain=v1', '--untracked-files=all'])
    await expect(
      authenticateV2RehearsalRepositoryHead(repositoryGit({ branch: 'codex/wrong' })),
    ).rejects.toThrow('exact task branch')
    await expect(
      authenticateV2RehearsalRepositoryHead(repositoryGit({ dirty: true })),
    ).rejects.toThrow('clean tracked and untracked')
    await expect(
      authenticateV2RehearsalRepositoryHead(repositoryGit({ noAncestry: true })),
    ).rejects.toThrow('origin/main')
  })

  test('re-authenticates the same clean repository HEAD after all four runs', async () => {
    await expect(
      assertV2RehearsalRepositoryUnchanged('1'.repeat(40), async () => '1'.repeat(40)),
    ).resolves.toBeUndefined()
    await expect(
      assertV2RehearsalRepositoryUnchanged('1'.repeat(40), async () => '2'.repeat(40)),
    ).rejects.toThrow('HEAD changed')
  })

  test('bootstraps upgrade first, then runs upgrade and fresh twice sequentially', async () => {
    const paths: string[] = []
    const complete = await executeCompleteV2Rehearsal({
      dependencies: {
        executePath: async ({ migrationPath }) => {
          paths.push(migrationPath)
          return result(migrationPath)
        },
      },
      exactPackageExecutor: { execute: async () => ({}) as never },
      seed: {} as never,
    })
    expect(paths).toEqual(['upgrade', 'upgrade', 'fresh', 'fresh'])
    expect(complete.bootstrapUpgrade.migrationPath).toBe('upgrade')
    expect(complete.upgrade).toHaveLength(2)
    expect(complete.fresh).toHaveLength(2)
  })

  test('rejects any caller database/host/SQL target before loading a backup', async () => {
    const loadPreMigrationBackup = jest.fn()
    await expect(
      runExactPackageRehearsalV2Cli(['--database-url', 'postgresql://forbidden'], {
        loadPreMigrationBackup,
        readRepositoryHead: async () => '1'.repeat(40),
      }),
    ).rejects.toThrow('Unknown option')
    expect(loadPreMigrationBackup).not.toHaveBeenCalled()
  })

  test('rejects a rebound but byte-different action plan against the bootstrap reference', () => {
    const referencePlan = Buffer.from('{"actions":[{"action":"import_initial","sequence":1}]}\n')
    const reboundPlan = Buffer.from('{"actions":[{"action":"import_revision","sequence":1}]}\n')
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
    expect(() =>
      assertExactGeneratedPackageReferenceV2(
        {
          files: new Map([['immutable-atomic-import-plan-v2.json', referencePlan]]),
          manifestSha256: digest(referencePlan),
        },
        {
          files: new Map([['immutable-atomic-import-plan-v2.json', reboundPlan]]),
          manifestSha256: digest(reboundPlan),
        },
      ),
    ).toThrow('different exact V2 packages')
  })

  test('requires fresh projected seed schema/clinical identity to equal upgraded V1 after V2', () => {
    const upgrade = {
      clinicalAndSchemaSnapshot: { reviewRowsSha256: '1'.repeat(64) },
      v2StateAndIntegrity: {
        effectiveStateSha256: '2'.repeat(64),
        physicalStateSha256: '3'.repeat(64),
      },
    }
    expect(() =>
      assertMigrationEquivalentPostV2SeedIdentity(upgrade, {
        v2StateAndIntegrity: upgrade.v2StateAndIntegrity,
        clinicalAndSchemaSnapshot: upgrade.clinicalAndSchemaSnapshot,
      }),
    ).not.toThrow()
    expect(() =>
      assertMigrationEquivalentPostV2SeedIdentity(upgrade, {
        ...upgrade,
        v2StateAndIntegrity: {
          ...upgrade.v2StateAndIntegrity,
          physicalStateSha256: '4'.repeat(64),
        },
      }),
    ).toThrow('not schema/clinical-state identical')
  })

  test('contains no caller-selectable database, remote, SQL, or held-out argument', async () => {
    const source = await readFile(
      'scripts/literature/rehearse-exact-gold-import-compensation-package-v2.ts',
      'utf8',
    )
    for (const forbidden of [
      "'database-url'",
      "'db-url'",
      "'docker-host'",
      "'held-out'",
      "'remote'",
      "'sql'",
      "'target'",
    ]) {
      expect(source).not.toContain(forbidden)
    }
    expect(source).toContain('executeCompleteV2Rehearsal')
    expect(source).toContain("const bootstrapUpgrade = await run('upgrade')")
  })
})
