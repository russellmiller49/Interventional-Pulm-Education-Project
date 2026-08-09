/** @jest-environment node */

import {
  POST_MIGRATION_RECONCILIATION_BRANCH,
  assertReadOnlyReconciliationRepositoryGuard,
  type ReadOnlyReconciliationRepositoryState,
} from './gold-import-compensation-read-only-guard'

const VALID_STATE: ReadOnlyReconciliationRepositoryState = {
  branch: POST_MIGRATION_RECONCILIATION_BRANCH,
  commonDir: '/repo/.git',
  gitDir: '/repo/.git/worktrees/codex-b',
  head: 'b'.repeat(40),
  mergeBaseWithOriginMain: 'a'.repeat(40),
  originMain: 'a'.repeat(40),
  trackedStatus: '',
}

describe('read-only post-migration reconciliation repository guard', () => {
  it('accepts only the clean dedicated feature worktree descended from origin/main', () => {
    expect(() => assertReadOnlyReconciliationRepositoryGuard(VALID_STATE)).not.toThrow()
  })

  it.each([
    ['primary checkout', { gitDir: '/repo/.git' }],
    ['wrong branch', { branch: 'codex/other' }],
    ['dirty tracked state', { trackedStatus: ' M package.json' }],
    ['unrelated history', { mergeBaseWithOriginMain: 'c'.repeat(40) }],
    ['invalid head', { head: 'not-a-sha' }],
  ])('rejects %s', (_label, override) => {
    expect(() =>
      assertReadOnlyReconciliationRepositoryGuard({ ...VALID_STATE, ...override }),
    ).toThrow()
  })
})
