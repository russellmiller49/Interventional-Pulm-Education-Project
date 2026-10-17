import type { LunaCohort } from './constants'
import { LUNA_LOCKED_SANITY_COHORT_SIZE } from './constants'

/**
 * The locked-cohort refusal boundary.
 *
 * The locked 200 exist to be seen exactly once, by a future coordinator that this PR does not
 * contain. Until that coordinator is separately built and reviewed, the locked cohort has no
 * executable pathway at all: `split` still constructs the 200 identities deterministically and
 * locally, and every other surface refuses them.
 *
 * Two refusals enforce that, and they are deliberately different in kind.
 *
 * The first refuses the **declared label**: any command handed a locked-sanity operation stops
 * immediately. The second refuses **actual membership**: whatever an operation calls itself,
 * a record set that touches even one locked identity is refused. A cohort label is a claim;
 * membership is the fact, and relabelling the locked 200 as something friendlier changes only
 * the claim.
 */

export const LUNA_LOCKED_SANITY_COHORT: LunaCohort = 'locked-sanity-200'

export class LockedCohortError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockedCohortError'
  }
}

/**
 * Refuse a locked-sanity operation on any pathway. In this PR there is no exception: no
 * command may prepare, price, shard, or otherwise materialize the locked cohort for a model.
 */
export function assertGenericCommandNotLocked(cohort: string, command: string): void {
  if (cohort === LUNA_LOCKED_SANITY_COHORT) {
    throw new LockedCohortError(
      `${command} refuses the ${LUNA_LOCKED_SANITY_COHORT} cohort. The locked cohort has no ` +
        'executable pathway in this release; running it is a separately reviewed coordinator.',
    )
  }
}

/**
 * Refuse any record set that touches a locked identity, whatever the operation calls itself.
 *
 * The membership set must itself be exactly the locked size before it is trusted to answer
 * membership questions: an empty or truncated set would silently answer "no overlap" to
 * everything, which is the one answer this guard must never give by accident.
 */
export function assertNoLockedMembership(
  pmids: readonly string[],
  lockedSanityPmids: ReadonlySet<string>,
  command: string,
): void {
  if (lockedSanityPmids.size !== LUNA_LOCKED_SANITY_COHORT_SIZE) {
    throw new LockedCohortError(
      `The locked-sanity membership set holds ${lockedSanityPmids.size} identities, not ` +
        `${LUNA_LOCKED_SANITY_COHORT_SIZE}; refusing to check membership against it.`,
    )
  }
  let overlap = 0
  for (const pmid of pmids) {
    if (lockedSanityPmids.has(pmid)) overlap += 1
  }
  if (overlap > 0) {
    throw new LockedCohortError(
      `${command} refuses this operation: ${overlap} of its records are locked-sanity ` +
        'members. The locked cohort has no executable pathway in this release.',
    )
  }
}
