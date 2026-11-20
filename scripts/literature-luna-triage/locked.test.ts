/** @jest-environment node */
import { LUNA_LOCKED_SANITY_COHORT_SIZE } from './constants'
import { syntheticAbstractPresence, syntheticTruth } from './fixtures'
import {
  LockedCohortError,
  assertGenericCommandNotLocked,
  assertNoLockedMembership,
} from './locked'
import {
  SplitError,
  assertStoredSplitIsCanonical,
  recomputeCanonicalSplit,
  sortedIdentityDigest,
  type StoredSplitArtifacts,
} from './split'
import { censusOf, type TruthAuthority } from './truth'

/**
 * Locked-cohort boundary regressions.
 *
 * Two ways the held-out 200 could be reached are closed here: a stored split file that
 * vouches for its own identities, and a command that never asks whether the record set in
 * front of it is the locked one. In this release the locked cohort has no executable pathway
 * at all, so both refusals are absolute rather than a redirection to a privileged command.
 */

const SYNTHETIC = syntheticTruth()
/** The full truth authority shape, census included, from the synthetic reviewed 630. */
const TRUTH: TruthAuthority = { ...SYNTHETIC, census: censusOf(SYNTHETIC.rows) }
const PRESENCE = syntheticAbstractPresence(TRUTH.rows)
const CANONICAL = recomputeCanonicalSplit(TRUTH, PRESENCE)

function storedSplit(overrides: Partial<StoredSplitArtifacts> = {}): StoredSplitArtifacts {
  return {
    development: [...CANONICAL.split.developmentPmids],
    lockedSanity: [...CANONICAL.split.lockedSanityPmids],
    manifest: { ...CANONICAL.manifest } as unknown as Record<string, unknown>,
    ...overrides,
  }
}

/** A stored split that has been edited *and* had its own declared digests updated to match. */
function selfConsistentForgery(lockedSanity: readonly string[]): StoredSplitArtifacts {
  return storedSplit({
    lockedSanity: [...lockedSanity],
    manifest: {
      ...(CANONICAL.manifest as unknown as Record<string, unknown>),
      lockedSanityIdentitySha256: sortedIdentityDigest(lockedSanity),
    },
  })
}

describe('canonical split authority', () => {
  it('accepts the exact canonical split', () => {
    expect(() => assertStoredSplitIsCanonical(storedSplit(), CANONICAL, TRUTH)).not.toThrow()
    expect(CANONICAL.split.lockedSanityPmids).toHaveLength(LUNA_LOCKED_SANITY_COHORT_SIZE)
    expect(CANONICAL.split.developmentPmids).toHaveLength(430)
    expect(
      new Set([...CANONICAL.split.developmentPmids, ...CANONICAL.split.lockedSanityPmids]).size,
    ).toBe(630)
  })

  it('refuses one replaced locked identity', () => {
    const replaced = [...CANONICAL.split.lockedSanityPmids]
    replaced[0] = CANONICAL.split.developmentPmids[0]
    expect(() =>
      assertStoredSplitIsCanonical(storedSplit({ lockedSanity: replaced }), CANONICAL, TRUTH),
    ).toThrow(SplitError)
  })

  it('refuses all 200 locked identities replaced, even with the declared digest edited to match', () => {
    // The reproduced defect: the stored list and its own digest agreed, so the check passed.
    const fabricated = Array.from({ length: 200 }, (_unused, index) => String(700_000_000 + index))
    expect(() =>
      assertStoredSplitIsCanonical(selfConsistentForgery(fabricated), CANONICAL, TRUTH),
    ).toThrow(SplitError)
    // Even swapping in 200 genuinely reviewed identities is refused: they are not *these* 200.
    const wrongMembers = CANONICAL.split.developmentPmids.slice(0, 200)
    expect(() =>
      assertStoredSplitIsCanonical(selfConsistentForgery(wrongMembers), CANONICAL, TRUTH),
    ).toThrow(SplitError)
  })

  it('refuses an edited manifest hash', () => {
    const stored = storedSplit({
      manifest: {
        ...(CANONICAL.manifest as unknown as Record<string, unknown>),
        manifestSha256: 'f'.repeat(64),
      },
    })
    expect(() => assertStoredSplitIsCanonical(stored, CANONICAL, TRUTH)).toThrow(SplitError)
  })

  it('refuses duplicate, missing, extra, and overlapping identities', () => {
    const locked = CANONICAL.split.lockedSanityPmids
    const duplicated = [...locked.slice(0, 199), locked[0]]
    expect(() =>
      assertStoredSplitIsCanonical(selfConsistentForgery(duplicated), CANONICAL, TRUTH),
    ).toThrow(SplitError)
    expect(() =>
      assertStoredSplitIsCanonical(
        storedSplit({ lockedSanity: locked.slice(0, 199) }),
        CANONICAL,
        TRUTH,
      ),
    ).toThrow(/identities, not 200/u)
    expect(() =>
      assertStoredSplitIsCanonical(
        storedSplit({ lockedSanity: [...locked, CANONICAL.split.developmentPmids[0]] }),
        CANONICAL,
        TRUTH,
      ),
    ).toThrow(/identities, not 200/u)
    // An identity in both cohorts at once.
    const overlapping = storedSplit({
      development: [...CANONICAL.split.developmentPmids.slice(0, 429), locked[0]],
    })
    expect(() => assertStoredSplitIsCanonical(overlapping, CANONICAL, TRUTH)).toThrow(SplitError)
  })
})

describe('the locked cohort has no executable pathway', () => {
  it('refuses the locked cohort on every generic command', () => {
    for (const command of ['packets', 'prepare-requests', 'estimate', 'batch-prepare']) {
      expect(() => assertGenericCommandNotLocked('locked-sanity-200', command)).toThrow(
        LockedCohortError,
      )
    }
    expect(() => assertGenericCommandNotLocked('development-430', 'packets')).not.toThrow()
    expect(() => assertGenericCommandNotLocked('pilot-1000', 'batch-prepare')).not.toThrow()
  })

  it('refuses any packet set that touches a locked identity, whatever it calls itself', () => {
    const locked = new Set(CANONICAL.split.lockedSanityPmids)
    // A single locked member hiding inside an otherwise legitimate development cohort.
    const smuggled = [
      ...CANONICAL.split.developmentPmids.slice(0, 10),
      locked.values().next().value as string,
    ]
    expect(() => assertNoLockedMembership(smuggled, locked, 'packets')).toThrow(LockedCohortError)
    expect(() =>
      assertNoLockedMembership(CANONICAL.split.developmentPmids.slice(0, 10), locked, 'packets'),
    ).not.toThrow()
  })

  it('refuses to check membership against a wrong-sized locked set', () => {
    expect(() => assertNoLockedMembership(['1'], new Set(['1']), 'packets')).toThrow(/not 200/u)
  })
})
