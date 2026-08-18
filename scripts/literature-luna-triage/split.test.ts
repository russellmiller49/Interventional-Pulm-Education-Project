/** @jest-environment node */
import { canonicalJson } from '../literature-production-ingest/canonical'
import { syntheticAbstractPresence, syntheticTruth } from './fixtures'
import {
  SplitError,
  apportionLockedSanity,
  buildCalibrationSplit,
  buildSplitManifest,
} from './split'
import { toTruthAuthority } from './truth'

function fixtures() {
  const truth = toTruthAuthority(syntheticTruth())
  const presence = syntheticAbstractPresence(truth.rows)
  return { truth, presence }
}

describe('largest-remainder apportionment', () => {
  it('hits the quota exactly and never exceeds stratum sizes', () => {
    const sizes = [283, 75, 272]
    const allocated = apportionLockedSanity(sizes, 200)
    expect(allocated.reduce((sum, value) => sum + value, 0)).toBe(200)
    allocated.forEach((value, index) => {
      expect(value).toBeLessThanOrEqual(sizes[index])
      expect(value).toBeGreaterThanOrEqual(0)
    })
  })

  it('is deterministic under remainder ties', () => {
    expect(apportionLockedSanity([10, 10, 10], 10)).toEqual(apportionLockedSanity([10, 10, 10], 10))
  })

  it('spills into strata with headroom when others saturate', () => {
    expect(apportionLockedSanity([1, 100], 50).reduce((sum, value) => sum + value, 0)).toBe(50)
  })

  it('refuses a quota above the cohort size', () => {
    expect(() => apportionLockedSanity([2, 3], 6)).toThrow(SplitError)
  })
})

describe('deterministic 430/200 calibration split', () => {
  it('produces exactly 430 development and 200 locked-sanity with all 630 exactly once', () => {
    const { truth, presence } = fixtures()
    const split = buildCalibrationSplit(truth, presence)
    expect(split.developmentPmids).toHaveLength(430)
    expect(split.lockedSanityPmids).toHaveLength(200)
    const seen = new Set([...split.developmentPmids, ...split.lockedSanityPmids])
    expect(seen.size).toBe(630)
    for (const row of truth.rows) expect(seen.has(row.pmid)).toBe(true)
  })

  it('is fully deterministic across invocations', () => {
    const { truth, presence } = fixtures()
    const first = buildCalibrationSplit(truth, presence)
    const second = buildCalibrationSplit(truth, presence)
    expect(second.developmentPmids).toEqual(first.developmentPmids)
    expect(second.lockedSanityPmids).toEqual(first.lockedSanityPmids)
    expect(second.strata).toEqual(first.strata)
  })

  it('stratifies by physician class and abstract presence with consistent totals', () => {
    const { truth, presence } = fixtures()
    const split = buildCalibrationSplit(truth, presence)
    expect(split.strata).toHaveLength(6)
    const totals = { include_core: 0, include_adjacent: 0, exclude: 0 }
    for (const stratum of split.strata) {
      expect(stratum.development + stratum.lockedSanity).toBe(stratum.total)
      totals[stratum.relevance] += stratum.total
    }
    expect(totals).toEqual({ include_core: 283, include_adjacent: 75, exclude: 272 })
    const sanityTotal = split.strata.reduce((sum, stratum) => sum + stratum.lockedSanity, 0)
    expect(sanityTotal).toBe(200)
  })

  it('mirrors class proportions into the locked cohort within one record per stratum', () => {
    const { truth, presence } = fixtures()
    const split = buildCalibrationSplit(truth, presence)
    for (const stratum of split.strata) {
      const exact = (stratum.total * 200) / 630
      expect(Math.abs(stratum.lockedSanity - exact)).toBeLessThanOrEqual(1)
    }
  })

  it('stops when a reviewed record is missing from the corpus presence projection', () => {
    const { truth, presence } = fixtures()
    const incomplete = new Map(presence)
    incomplete.delete(truth.rows[0].pmid)
    expect(() => buildCalibrationSplit(truth, incomplete)).toThrow(SplitError)
  })

  it('changes strata when abstract presence changes: evidence profile is load-bearing', () => {
    const { truth, presence } = fixtures()
    const flipped = new Map(presence)
    const firstPmid = truth.rows[0].pmid
    flipped.set(firstPmid, !(presence.get(firstPmid) ?? false))
    const base = buildCalibrationSplit(truth, presence)
    const other = buildCalibrationSplit(truth, flipped)
    expect(other.strata).not.toEqual(base.strata)
  })
})

describe('split manifest', () => {
  it('carries aggregates and digests, never identities', () => {
    const { truth, presence } = fixtures()
    const split = buildCalibrationSplit(truth, presence)
    const manifest = buildSplitManifest(split)
    expect(manifest.totalRecords).toBe(630)
    expect(manifest.developmentCount).toBe(430)
    expect(manifest.lockedSanityCount).toBe(200)
    expect(manifest.developmentIdentitySha256).toMatch(/^[0-9a-f]{64}$/u)
    expect(manifest.manifestSha256).toMatch(/^[0-9a-f]{64}$/u)
    const serialized = canonicalJson(manifest)
    for (const pmid of split.developmentPmids.slice(0, 5)) {
      expect(serialized).not.toContain(pmid)
    }
  })

  it('has a stable hash for identical splits and a different hash otherwise', () => {
    const { truth, presence } = fixtures()
    const manifest = buildSplitManifest(buildCalibrationSplit(truth, presence))
    const again = buildSplitManifest(buildCalibrationSplit(truth, presence))
    expect(again.manifestSha256).toBe(manifest.manifestSha256)
    const flipped = new Map(presence)
    const firstPmid = truth.rows[0].pmid
    flipped.set(firstPmid, !(presence.get(firstPmid) ?? false))
    const different = buildSplitManifest(buildCalibrationSplit(truth, flipped))
    expect(different.manifestSha256).not.toBe(manifest.manifestSha256)
  })
})
