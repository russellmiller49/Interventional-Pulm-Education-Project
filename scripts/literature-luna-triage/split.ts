import { deterministicPmidOrder } from '../../src/features/literature/ultra-screening/core'
import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { OverlayRelevance } from '../literature-reviewed-overlay/constants'
import { OVERLAY_RELEVANCE_VALUES } from '../literature-reviewed-overlay/constants'
import {
  LUNA_DEVELOPMENT_COHORT_SIZE,
  LUNA_LOCKED_SANITY_COHORT_SIZE,
  LUNA_SPLIT_SEED,
  LUNA_SPLIT_VERSION,
  OVERLAY_EXPECTED_RECORD_COUNT,
} from './constants'
import type { TruthAuthority } from './truth'

/**
 * Deterministic 430/200 calibration split over the exact reviewed 630.
 *
 * Stratified by physician class × abstract presence (six strata). Within each stratum the
 * order is the lane's versioned-seed SHA-256 rank (the repository's NUL-joined seed
 * convention via `deterministicPmidOrder`), and the locked-sanity quota per stratum comes
 * from largest-remainder apportionment of 200/630, so both cohorts mirror the strata as
 * closely as integer counts allow. Identities stay local; the manifest carries aggregate
 * stratum counts and digests only.
 */

export class SplitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SplitError'
  }
}

export interface SplitStratumSummary {
  readonly relevance: OverlayRelevance
  readonly abstractPresent: boolean
  readonly total: number
  readonly development: number
  readonly lockedSanity: number
}

export interface CalibrationSplit {
  readonly version: string
  readonly seed: string
  readonly developmentPmids: readonly string[]
  readonly lockedSanityPmids: readonly string[]
  readonly strata: readonly SplitStratumSummary[]
}

export interface SplitManifest {
  readonly version: string
  readonly seed: string
  readonly totalRecords: number
  readonly developmentCount: number
  readonly lockedSanityCount: number
  readonly strata: readonly SplitStratumSummary[]
  /** Digests of the C-collation-sorted identity lists; aggregates, never identities. */
  readonly developmentIdentitySha256: string
  readonly lockedSanityIdentitySha256: string
  readonly manifestSha256: string
}

interface StratumKey {
  readonly relevance: OverlayRelevance
  readonly abstractPresent: boolean
}

const STRATUM_ORDER: readonly StratumKey[] = OVERLAY_RELEVANCE_VALUES.flatMap((relevance) => [
  { relevance, abstractPresent: true },
  { relevance, abstractPresent: false },
])

function stratumLabel(key: StratumKey): string {
  return `${key.relevance}|${key.abstractPresent ? 'with_abstract' : 'without_abstract'}`
}

/** Digest of a C-collation-sorted identity list. The one identity-digest formula in the lane. */
export function sortedIdentityDigest(pmids: readonly string[]): string {
  const sorted = [...pmids].sort()
  return sha256(sorted.join('\n'))
}

/**
 * Largest-remainder apportionment of the locked-sanity quota across strata. Deterministic:
 * remainders tie-break by stratum order.
 */
export function apportionLockedSanity(sizes: readonly number[], quota: number): number[] {
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (total === 0) throw new SplitError('Cannot apportion a split over zero records.')
  const exact = sizes.map((size) => (size * quota) / total)
  const base = exact.map((value) => Math.floor(value))
  let remaining = quota - base.reduce((sum, value) => sum + value, 0)
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)
  const allocated = [...base]
  for (const entry of order) {
    if (remaining <= 0) break
    if (allocated[entry.index] < sizes[entry.index]) {
      allocated[entry.index] += 1
      remaining -= 1
    }
  }
  if (remaining > 0) {
    // Some strata were saturated; distribute to any stratum with headroom, in order.
    for (let index = 0; index < allocated.length && remaining > 0; index += 1) {
      const headroom = sizes[index] - allocated[index]
      const take = Math.min(headroom, remaining)
      allocated[index] += take
      remaining -= take
    }
  }
  if (remaining > 0) throw new SplitError('The locked-sanity quota exceeds the cohort size.')
  return allocated
}

/**
 * Build the deterministic split. `abstractPresence` must cover every truth PMID and comes
 * from the fixed corpus, so calibration evidence profiles match production behavior.
 */
export function buildCalibrationSplit(
  truth: TruthAuthority,
  abstractPresence: ReadonlyMap<string, boolean>,
): CalibrationSplit {
  const strata = new Map<string, string[]>()
  for (const key of STRATUM_ORDER) strata.set(stratumLabel(key), [])
  for (const row of truth.rows) {
    const present = abstractPresence.get(row.pmid)
    if (present === undefined) {
      throw new SplitError(
        'A reviewed record is missing from the corpus abstract-presence projection; the ' +
          'truth and corpus authorities disagree. Stopping.',
      )
    }
    const label = stratumLabel({ relevance: row.relevance, abstractPresent: present })
    const bucket = strata.get(label)
    if (!bucket) throw new SplitError(`Unknown stratum ${label}.`)
    bucket.push(row.pmid)
  }
  const sizes = STRATUM_ORDER.map((key) => strata.get(stratumLabel(key))?.length ?? 0)
  const quotas = apportionLockedSanity(sizes, LUNA_LOCKED_SANITY_COHORT_SIZE)

  const development: string[] = []
  const lockedSanity: string[] = []
  const summaries: SplitStratumSummary[] = []
  STRATUM_ORDER.forEach((key, index) => {
    const members = strata.get(stratumLabel(key)) ?? []
    const ordered = deterministicPmidOrder(members, LUNA_SPLIT_SEED)
    const quota = quotas[index]
    const sanitySlice = ordered.slice(0, quota)
    const developmentSlice = ordered.slice(quota)
    lockedSanity.push(...sanitySlice)
    development.push(...developmentSlice)
    summaries.push({
      relevance: key.relevance,
      abstractPresent: key.abstractPresent,
      total: members.length,
      development: developmentSlice.length,
      lockedSanity: sanitySlice.length,
    })
  })

  const seen = new Set([...development, ...lockedSanity])
  if (
    development.length !== LUNA_DEVELOPMENT_COHORT_SIZE ||
    lockedSanity.length !== LUNA_LOCKED_SANITY_COHORT_SIZE ||
    seen.size !== OVERLAY_EXPECTED_RECORD_COUNT
  ) {
    throw new SplitError(
      `Split accounting failed: development ${development.length}, locked sanity ` +
        `${lockedSanity.length}, distinct ${seen.size}. Every reviewed record must appear ` +
        'exactly once and the cohorts must be exactly 430/200.',
    )
  }
  return {
    version: LUNA_SPLIT_VERSION,
    seed: LUNA_SPLIT_SEED,
    developmentPmids: development.sort(),
    lockedSanityPmids: lockedSanity.sort(),
    strata: summaries,
  }
}

/** The committable manifest: versions, aggregate strata, and digests. Never identities. */
export function buildSplitManifest(split: CalibrationSplit): SplitManifest {
  const body = {
    version: split.version,
    seed: split.seed,
    totalRecords: split.developmentPmids.length + split.lockedSanityPmids.length,
    developmentCount: split.developmentPmids.length,
    lockedSanityCount: split.lockedSanityPmids.length,
    strata: split.strata,
    developmentIdentitySha256: sortedIdentityDigest(split.developmentPmids),
    lockedSanityIdentitySha256: sortedIdentityDigest(split.lockedSanityPmids),
  }
  return { ...body, manifestSha256: sha256(canonicalJson(body)) }
}
