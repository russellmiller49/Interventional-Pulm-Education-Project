import { resolve } from 'node:path'

import {
  defaultCommandRunner,
  inspectRepositoryGuardState,
  type CommandRunner,
  type RepositoryGuardState,
} from './gold-import-compensation-migration-operations'

export const POST_MIGRATION_RECONCILIATION_BRANCH =
  'codex/ip-literature-post-migration-contract-reconciliation-v1' as const

const COMMIT_SHA_PATTERN = /^[a-f0-9]{40}$/u

export interface ReadOnlyReconciliationRepositoryState extends RepositoryGuardState {
  mergeBaseWithOriginMain: string
}

/**
 * This guard is intentionally distinct from the primary-checkout operational
 * guard. It authorizes only the new read-only reconciliation CLIs from their
 * exact reviewed feature branch; it never authorizes migrations, import,
 * compensation, upload, or any other shared-state mutation.
 */
export function assertReadOnlyReconciliationRepositoryGuard(
  state: ReadOnlyReconciliationRepositoryState,
): void {
  if (resolve(state.gitDir) === resolve(state.commonDir)) {
    throw new Error(
      'Read-only reconciliation guard requires the dedicated feature worktree, not the primary checkout.',
    )
  }
  if (state.branch !== POST_MIGRATION_RECONCILIATION_BRANCH) {
    throw new Error(
      `Read-only reconciliation guard requires branch ${POST_MIGRATION_RECONCILIATION_BRANCH}.`,
    )
  }
  if (state.trackedStatus !== '') {
    throw new Error('Read-only reconciliation guard requires a clean tracked worktree.')
  }
  if (
    !COMMIT_SHA_PATTERN.test(state.head) ||
    !COMMIT_SHA_PATTERN.test(state.originMain) ||
    state.mergeBaseWithOriginMain !== state.originMain
  ) {
    throw new Error(
      'Read-only reconciliation guard requires HEAD to descend from the fetched origin/main.',
    )
  }
}

export async function inspectReadOnlyReconciliationRepositoryState(
  cwd: string,
  runCommand: CommandRunner = defaultCommandRunner,
): Promise<ReadOnlyReconciliationRepositoryState> {
  const [repository, mergeBase] = await Promise.all([
    inspectRepositoryGuardState(cwd, runCommand),
    runCommand('git', ['merge-base', 'origin/main', 'HEAD'], { cwd }),
  ])
  return {
    ...repository,
    mergeBaseWithOriginMain: mergeBase.stdout.trim(),
  }
}
