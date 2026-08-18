/** @jest-environment node */
import { copyFile, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { canonicalJson } from '../literature-production-ingest/canonical'
import { LUNA_LOCKED_SANITY_COHORT_SIZE } from './constants'
import { syntheticAbstractPresence, syntheticTruth } from './fixtures'
import { buildFreezeReceipt, type FreezeReceipt } from './freeze'
import {
  LockedCohortError,
  assertExecutionMatchesFreeze,
  assertGenericCommandNotLocked,
  assertNoLockedMembership,
  frozenExecutionConfiguration,
  lockedRunIdentitySha256,
  lockedRunMarkerFilename,
} from './locked'
import { loadStageAPrompt } from './prompt'
import {
  SplitError,
  assertStoredSplitIsCanonical,
  recomputeCanonicalSplit,
  sortedIdentityDigest,
  type StoredSplitArtifacts,
} from './split'
import { exclusiveWriteFile, resolveStateRoot } from './state'
import { censusOf, type TruthAuthority } from './truth'

/**
 * Locked-sanity authority regressions.
 *
 * Three separate ways the held-out 200 could previously be reached are closed here: a stored
 * split file that vouches for its own identities, a generic command that never asks whether
 * the cohort it is about to send is the locked one, and a once-only marker keyed to a
 * filename rather than to the frozen surface it is supposed to name.
 */

const SYNTHETIC = syntheticTruth()
/** The full truth authority shape, census included, from the synthetic reviewed 630. */
const TRUTH: TruthAuthority = { ...SYNTHETIC, census: censusOf(SYNTHETIC.rows) }
const PRESENCE = syntheticAbstractPresence(TRUTH.rows)
const CANONICAL = recomputeCanonicalSplit(TRUTH, PRESENCE)
const PROMPT = loadStageAPrompt()

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

describe('dedicated locked pathway', () => {
  it('refuses the locked cohort on every generic command', () => {
    for (const command of ['run-sync', 'batch-prepare', 'batch-submit']) {
      expect(() => assertGenericCommandNotLocked('locked-sanity-200', command)).toThrow(
        LockedCohortError,
      )
    }
    expect(() => assertGenericCommandNotLocked('development-430', 'run-sync')).not.toThrow()
    expect(() => assertGenericCommandNotLocked('pilot-1000', 'batch-prepare')).not.toThrow()
  })

  it('refuses any packet set that touches a locked identity, whatever it calls itself', () => {
    const locked = new Set(CANONICAL.split.lockedSanityPmids)
    // A single locked member hiding inside an otherwise legitimate development cohort.
    const smuggled = [
      ...CANONICAL.split.developmentPmids.slice(0, 10),
      locked.values().next().value as string,
    ]
    expect(() => assertNoLockedMembership(smuggled, locked, 'run-sync')).toThrow(LockedCohortError)
    expect(() =>
      assertNoLockedMembership(CANONICAL.split.developmentPmids.slice(0, 10), locked, 'run-sync'),
    ).not.toThrow()
  })

  it('refuses to check membership against a wrong-sized locked set', () => {
    expect(() => assertNoLockedMembership(['1'], new Set(['1']), 'run-sync')).toThrow(/not 200/u)
  })
})

describe('frozen execution configuration', () => {
  const receipt = buildFreezeReceipt(
    {
      calibrationVersion: 'cal-v1',
      model: 'gpt-5.6-luna',
      modelAlias: null,
      reasoningEffort: 'medium',
      promptText: PROMPT.text,
      splitManifestSha256: CANONICAL.manifest.manifestSha256,
    },
    '2026-08-17T00:00:00.000Z',
  )

  it('takes every execution value from the receipt', () => {
    const configuration = frozenExecutionConfiguration(receipt, {})
    expect(configuration.model).toBe('gpt-5.6-luna')
    expect(configuration.reasoningEffort).toBe('medium')
    expect(configuration.promptSha256).toBe(receipt.promptSha256)
    expect(configuration.splitManifestSha256).toBe(CANONICAL.manifest.manifestSha256)
  })

  it('refuses a caller override of the frozen model or reasoning effort', () => {
    expect(() => frozenExecutionConfiguration(receipt, { model: 'gpt-other' })).toThrow(
      LockedCohortError,
    )
    expect(() => frozenExecutionConfiguration(receipt, { reasoningEffort: 'high' })).toThrow(
      LockedCohortError,
    )
  })

  it('refuses execution defaults that differ from the frozen surface', () => {
    const configuration = frozenExecutionConfiguration(receipt, {})
    // The old shape: verification read the receipt while execution fell back to a default.
    expect(() =>
      assertExecutionMatchesFreeze(configuration, {
        model: 'gpt-5.6-luna-default',
        reasoningEffort: 'medium',
        promptSha256: receipt.promptSha256,
      }),
    ).toThrow(/model/u)
    expect(() =>
      assertExecutionMatchesFreeze(configuration, {
        model: 'gpt-5.6-luna',
        reasoningEffort: 'low',
        promptSha256: receipt.promptSha256,
      }),
    ).toThrow(/reasoningEffort/u)
    expect(() =>
      assertExecutionMatchesFreeze(configuration, {
        model: 'gpt-5.6-luna',
        reasoningEffort: 'medium',
        promptSha256: receipt.promptSha256,
      }),
    ).not.toThrow()
  })
})

/**
 * The once-only marker.
 *
 * The reproduced defect was purely positional: the marker path came from the CLI's
 * `--calibration-version`, i.e. from a receipt's *filename*, so `cp receipt.json copy.json`
 * bought a second run of the identical frozen surface. The identity is now derived from the
 * surface itself, and every way of relocating a receipt lands on the same marker.
 */
describe('once-per-freeze marker identity', () => {
  const receipt = buildFreezeReceipt(
    {
      calibrationVersion: 'cal-v1',
      model: 'gpt-5.6-luna',
      modelAlias: null,
      reasoningEffort: 'low',
      promptText: PROMPT.text,
      splitManifestSha256: CANONICAL.manifest.manifestSha256,
    },
    '2026-08-17T00:00:00.000Z',
  )
  const identity = lockedRunIdentitySha256(receipt, CANONICAL.manifest.lockedSanityIdentitySha256)

  it('derives one deterministic identity from the frozen surface', () => {
    expect(identity).toMatch(/^[0-9a-f]{64}$/u)
    expect(lockedRunIdentitySha256(receipt, CANONICAL.manifest.lockedSanityIdentitySha256)).toBe(
      identity,
    )
    expect(lockedRunMarkerFilename(identity)).toBe(`${identity}.marker.json`)
  })

  it('changes when any frozen surface changes', () => {
    const otherModel = buildFreezeReceipt(
      {
        calibrationVersion: 'cal-v1',
        model: 'gpt-other',
        modelAlias: null,
        reasoningEffort: 'low',
        promptText: PROMPT.text,
        splitManifestSha256: CANONICAL.manifest.manifestSha256,
      },
      '2026-08-17T00:00:00.000Z',
    )
    expect(
      lockedRunIdentitySha256(otherModel, CANONICAL.manifest.lockedSanityIdentitySha256),
    ).not.toBe(identity)
    // A different locked cohort is a different locked run, even under the same receipt.
    expect(lockedRunIdentitySha256(receipt, 'a'.repeat(64))).not.toBe(identity)
  })

  it('refuses a second run from a copied, moved, or renamed receipt', async () => {
    const root = await mkdtemp(join(tmpdir(), 'luna-locked-'))
    try {
      const state = await resolveStateRoot(join(root, 'lane'))
      const freezeDir = join(state.root, 'freeze')
      const markerDir = join(freezeDir, 'locked-runs')
      await mkdir(markerDir, { recursive: true, mode: 0o700 })
      const original = join(freezeDir, 'cal-v1.receipt.json')
      await writeFile(original, `${canonicalJson(receipt)}\n`, { mode: 0o600 })

      const claim = async (source: string) => {
        const copied = JSON.parse(await readReceipt(source)) as FreezeReceipt
        const derived = lockedRunIdentitySha256(
          copied,
          CANONICAL.manifest.lockedSanityIdentitySha256,
        )
        await exclusiveWriteFile(
          join(markerDir, lockedRunMarkerFilename(derived)),
          `${canonicalJson({ lockedRunIdentitySha256: derived })}\n`,
        )
      }
      // The first locked run consumes the frozen surface.
      await claim(original)
      expect(await readdir(markerDir)).toHaveLength(1)

      // Copied under a second filename: the same identity, so the marker already exists.
      const copyPath = join(freezeDir, 'cal-v1-copy.receipt.json')
      await copyFile(original, copyPath)
      await expect(claim(copyPath)).rejects.toThrow(/already exists/u)

      // Moved and renamed: still the same frozen surface, still refused.
      const movedDir = join(freezeDir, 'archive')
      await mkdir(movedDir, { recursive: true, mode: 0o700 })
      const movedPath = join(movedDir, 'other-name.receipt.json')
      await rename(copyPath, movedPath)
      await expect(claim(movedPath)).rejects.toThrow(/already exists/u)

      expect(await readdir(markerDir)).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

async function readReceipt(path: string): Promise<string> {
  const { readFile } = await import('node:fs/promises')
  return readFile(path, 'utf8')
}
