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

/**
 * Canonical split authority: the split recomputed from the immutable truth authority and the
 * fixed corpus, never read from a stored artifact.
 */
export interface CanonicalSplitAuthority {
  readonly split: CalibrationSplit
  readonly manifest: SplitManifest
}

export function recomputeCanonicalSplit(
  truth: TruthAuthority,
  abstractPresence: ReadonlyMap<string, boolean>,
): CanonicalSplitAuthority {
  const split = buildCalibrationSplit(truth, abstractPresence)
  return { split, manifest: buildSplitManifest(split) }
}

/** What a state directory happens to hold. A cache of the split — never its authority. */
export interface StoredSplitArtifacts {
  readonly development: readonly string[]
  readonly lockedSanity: readonly string[]
  readonly manifest: Record<string, unknown>
}

/**
 * Prove that stored split artifacts are exactly the canonical split.
 *
 * Every digest compared here is **recomputed from the stored artifacts' actual contents** and
 * checked against the **recomputed canonical** value; the manifest's own declared hashes are
 * never treated as authority over the identities beside them. That is the whole point: a
 * stored file that replaces one identity — or all two hundred — and then edits its own
 * `lockedSanityIdentitySha256` and `manifestSha256` to match is internally consistent and
 * still wrong, and only a comparison against a freshly recomputed canonical split can say so.
 */
export function assertStoredSplitIsCanonical(
  stored: StoredSplitArtifacts,
  canonical: CanonicalSplitAuthority,
  truth: TruthAuthority,
): void {
  if (!Array.isArray(stored.development) || !Array.isArray(stored.lockedSanity)) {
    throw new SplitError('The stored split artifacts are not identity lists.')
  }
  for (const value of [...stored.development, ...stored.lockedSanity]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new SplitError('A stored split identity is not a string.')
    }
  }
  if (stored.development.length !== LUNA_DEVELOPMENT_COHORT_SIZE) {
    throw new SplitError(
      `The stored development cohort holds ${stored.development.length} identities, not ` +
        `${LUNA_DEVELOPMENT_COHORT_SIZE}.`,
    )
  }
  if (stored.lockedSanity.length !== LUNA_LOCKED_SANITY_COHORT_SIZE) {
    throw new SplitError(
      `The stored locked-sanity cohort holds ${stored.lockedSanity.length} identities, not ` +
        `${LUNA_LOCKED_SANITY_COHORT_SIZE}.`,
    )
  }
  const developmentSet = new Set(stored.development)
  const lockedSet = new Set(stored.lockedSanity)
  if (
    developmentSet.size !== stored.development.length ||
    lockedSet.size !== stored.lockedSanity.length
  ) {
    throw new SplitError('The stored split contains a duplicate identity.')
  }
  for (const pmid of lockedSet) {
    if (developmentSet.has(pmid)) {
      throw new SplitError('An identity appears in both stored cohorts; the split overlaps.')
    }
  }
  const union = new Set([...developmentSet, ...lockedSet])
  if (union.size !== OVERLAY_EXPECTED_RECORD_COUNT) {
    throw new SplitError(
      `The stored split covers ${union.size} identities, not the reviewed ` +
        `${OVERLAY_EXPECTED_RECORD_COUNT}.`,
    )
  }
  // Exact equality with the immutable truth-authorized 630, member by member.
  const truthPmids = new Set(truth.rows.map((row) => row.pmid))
  if (truthPmids.size !== OVERLAY_EXPECTED_RECORD_COUNT) {
    throw new SplitError('The truth authority does not hold the reviewed record count.')
  }
  for (const pmid of union) {
    if (!truthPmids.has(pmid)) {
      throw new SplitError('The stored split names an identity outside the physician-reviewed set.')
    }
  }
  for (const pmid of truthPmids) {
    if (!union.has(pmid)) {
      throw new SplitError('The stored split omits a physician-reviewed identity.')
    }
  }
  // Digests recomputed from the stored contents, compared to the recomputed canonical split.
  if (sortedIdentityDigest(stored.lockedSanity) !== canonical.manifest.lockedSanityIdentitySha256) {
    throw new SplitError(
      'The stored locked-sanity identities are not the canonical locked-sanity 200. A ' +
        'self-declared digest cannot authorize its own identity list.',
    )
  }
  if (sortedIdentityDigest(stored.development) !== canonical.manifest.developmentIdentitySha256) {
    throw new SplitError('The stored development identities are not the canonical 430.')
  }
  const declaredManifestSha256 = stored.manifest?.manifestSha256
  if (declaredManifestSha256 !== canonical.manifest.manifestSha256) {
    throw new SplitError(
      'The stored split manifest is not the canonical manifest for this truth authority.',
    )
  }
  if (
    stored.manifest?.version !== canonical.manifest.version ||
    stored.manifest?.seed !== canonical.manifest.seed
  ) {
    throw new SplitError('The stored split manifest names another split version or seed.')
  }
}
