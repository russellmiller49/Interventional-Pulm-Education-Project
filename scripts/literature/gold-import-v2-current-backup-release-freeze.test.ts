/** @jest-environment node */

import {
  GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
  GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
  GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL,
  buildGoldImportV2CurrentBackupReleaseFreeze,
  inspectGoldImportV2CurrentBackupRepository,
  validateGoldImportV2CurrentBackupReleaseFreeze,
  type GoldImportV2CurrentBackupGitCommandRunner,
} from './create-gold-import-v2-postmigration-backup'

const FROZEN_HEAD = '1234567890abcdef1234567890abcdef12345678'
const LATER_HEAD = '2234567890abcdef1234567890abcdef12345678'
const EARLIER_HEAD = '0234567890abcdef1234567890abcdef12345678'
const CHANGED_PATHS = [
  { path: 'docs/ip-literature/release-boundary.md', status: 'M' as const },
  { path: 'scripts/literature/release-boundary.test.ts', status: 'A' as const },
]

function freeze() {
  return buildGoldImportV2CurrentBackupReleaseFreeze({
    branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
    changedPaths: CHANGED_PATHS,
    createdAt: '2026-08-12T20:00:00.000Z',
    frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
    frozenHead: FROZEN_HEAD,
    repository: GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
  })
}

function gitRunner(
  overrides: {
    changedPaths?: string
    head?: string
    status?: string
    upstreamHead?: string
  } = {},
): GoldImportV2CurrentBackupGitCommandRunner {
  return async (arguments_) => {
    const command = arguments_.join(' ')
    if (command === 'branch --show-current') return GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH
    if (command === 'rev-parse HEAD') return overrides.head ?? FROZEN_HEAD
    if (command === 'rev-parse origin/main') return GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE
    if (command === 'remote get-url origin') return GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY_URL
    if (command === 'rev-parse --abbrev-ref --symbolic-full-name @{upstream}') {
      return `origin/${GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH}`
    }
    if (command === 'rev-parse @{upstream}') return overrides.upstreamHead ?? FROZEN_HEAD
    if (command === 'status --porcelain=v1 --untracked-files=all') return overrides.status ?? ''
    if (command.startsWith('merge-base --is-ancestor ')) return ''
    if (command.startsWith('diff --name-only -z ')) {
      return `${CHANGED_PATHS.map(({ path }) => path).join('\0')}\0`
    }
    if (command.startsWith('diff --name-status -z --find-renames ')) {
      return (
        overrides.changedPaths ??
        CHANGED_PATHS.map(({ path, status }) => `${status}\0${path}\0`).join('')
      )
    }
    throw new Error(`Unexpected Git command: ${command}`)
  }
}

describe('current PR #97 external release freeze', () => {
  it('binds the exact ordered status/path inventory and its own identity', () => {
    const exact = freeze()
    expect(validateGoldImportV2CurrentBackupReleaseFreeze(exact)).toEqual(exact)
    expect(exact).toMatchObject({
      changedPathCount: 2,
      changedPaths: CHANGED_PATHS,
      frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
      frozenHead: FROZEN_HEAD,
    })
    expect(exact.changedPathInventorySha256).toMatch(/^[a-f0-9]{64}$/u)
    expect(exact.releaseFreezeIdentitySha256).toMatch(/^[a-f0-9]{64}$/u)
  })

  it('rejects duplicate, unsorted, and noncanonical repository paths', () => {
    for (const changedPaths of [
      [CHANGED_PATHS[0], CHANGED_PATHS[0]],
      [...CHANGED_PATHS].reverse(),
      [{ path: '../outside.ts', status: 'M' as const }],
      [{ path: '/absolute.ts', status: 'M' as const }],
    ]) {
      expect(() =>
        buildGoldImportV2CurrentBackupReleaseFreeze({
          branch: GOLD_IMPORT_V2_CURRENT_BACKUP_BRANCH,
          changedPaths,
          createdAt: '2026-08-12T20:00:00.000Z',
          frozenBase: GOLD_IMPORT_V2_CURRENT_BACKUP_FROZEN_BASE,
          frozenHead: FROZEN_HEAD,
          repository: GOLD_IMPORT_V2_CURRENT_BACKUP_REPOSITORY,
        }),
      ).toThrow()
    }
  })

  it('accepts only the exact clean frozen local and upstream state', async () => {
    await expect(
      inspectGoldImportV2CurrentBackupRepository({
        cwd: '/repository',
        gitCommandRunner: gitRunner(),
        releaseFreeze: freeze(),
      }),
    ).resolves.toMatchObject({
      changedPaths: CHANGED_PATHS.map(({ path }) => path),
      repository: { head: FROZEN_HEAD, upstreamHead: FROZEN_HEAD },
    })
  })

  it('rejects local/upstream drift plus clean later and earlier commits', async () => {
    for (const overrides of [
      { upstreamHead: LATER_HEAD },
      { head: LATER_HEAD, upstreamHead: LATER_HEAD },
      { head: EARLIER_HEAD, upstreamHead: EARLIER_HEAD },
    ]) {
      await expect(
        inspectGoldImportV2CurrentBackupRepository({
          cwd: '/repository',
          gitCommandRunner: gitRunner(overrides),
          releaseFreeze: freeze(),
        }),
      ).rejects.toThrow('exact clean externally frozen')
    }
  })

  it('rejects renamed, added, and dirty inventory mismatches', async () => {
    for (const overrides of [
      {
        changedPaths: `R100\0${CHANGED_PATHS[0].path}\0docs/ip-literature/renamed.md\0A\0${CHANGED_PATHS[1].path}\0`,
      },
      {
        changedPaths: `${CHANGED_PATHS.map(({ path, status }) => `${status}\0${path}\0`).join('')}A\0scripts/literature/unexpected.ts\0`,
      },
      { status: '?? unexpected.ts' },
    ]) {
      await expect(
        inspectGoldImportV2CurrentBackupRepository({
          cwd: '/repository',
          gitCommandRunner: gitRunner(overrides),
          releaseFreeze: freeze(),
        }),
      ).rejects.toThrow()
    }
  })
})
