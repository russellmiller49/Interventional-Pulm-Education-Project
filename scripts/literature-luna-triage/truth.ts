import type { ArtifactTruth, ArtifactTruthRow } from '../literature-reviewed-overlay/artifact'
import { loadArtifactTruth } from '../literature-reviewed-overlay/artifact'
import type { OverlayProvenance, OverlayRelevance } from '../literature-reviewed-overlay/constants'
import {
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_EXPECTED_RELEVANT_COUNT,
  OVERLAY_PROVENANCE_VALUES,
  OVERLAY_RELEVANCE_VALUES,
} from '../literature-reviewed-overlay/constants'

/**
 * Physician-truth authority for the Luna triage lane.
 *
 * The only entrance is the reviewed-overlay package's checksum-bound loader over the finalized
 * 630-row artifact — the artifact path is always operator-supplied, never a constant. On top
 * of the overlay's own checks (SHA-256 pin, exactly 630 rows, closed vocabularies, no
 * duplicate PMIDs) this module asserts the full published census: 283/75/272 by class,
 * 358 reviewed-relevant, and 192/133/305 by provenance. Any drift stops the lane.
 */

export class TruthAuthorityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TruthAuthorityError'
  }
}

export interface TruthCensus {
  readonly total: number
  readonly byClass: Readonly<Record<OverlayRelevance, number>>
  readonly reviewedRelevant: number
  readonly byProvenance: Readonly<Record<OverlayProvenance, number>>
}

export interface TruthAuthority {
  readonly artifactSha256: string
  readonly rows: readonly ArtifactTruthRow[]
  readonly census: TruthCensus
}

export function censusOf(rows: readonly ArtifactTruthRow[]): TruthCensus {
  const byClass = Object.fromEntries(OVERLAY_RELEVANCE_VALUES.map((value) => [value, 0])) as Record<
    OverlayRelevance,
    number
  >
  const byProvenance = Object.fromEntries(
    OVERLAY_PROVENANCE_VALUES.map((value) => [value, 0]),
  ) as Record<OverlayProvenance, number>
  for (const row of rows) {
    byClass[row.relevance] += 1
    byProvenance[row.provenance] += 1
  }
  return {
    total: rows.length,
    byClass,
    reviewedRelevant: byClass.include_core + byClass.include_adjacent,
    byProvenance,
  }
}

/** Assert the census matches the published authority exactly. Aggregate numbers only. */
export function assertTruthCensus(census: TruthCensus): void {
  const failures: string[] = []
  if (census.total !== OVERLAY_EXPECTED_RECORD_COUNT) {
    failures.push(`total ${census.total} != ${OVERLAY_EXPECTED_RECORD_COUNT}`)
  }
  for (const value of OVERLAY_RELEVANCE_VALUES) {
    if (census.byClass[value] !== OVERLAY_EXPECTED_CLASS_COUNTS[value]) {
      failures.push(`${value} ${census.byClass[value]} != ${OVERLAY_EXPECTED_CLASS_COUNTS[value]}`)
    }
  }
  if (census.reviewedRelevant !== OVERLAY_EXPECTED_RELEVANT_COUNT) {
    failures.push(
      `reviewed-relevant ${census.reviewedRelevant} != ${OVERLAY_EXPECTED_RELEVANT_COUNT}`,
    )
  }
  for (const value of OVERLAY_PROVENANCE_VALUES) {
    if (census.byProvenance[value] !== OVERLAY_EXPECTED_PROVENANCE_COUNTS[value]) {
      failures.push(
        `${value} ${census.byProvenance[value]} != ${OVERLAY_EXPECTED_PROVENANCE_COUNTS[value]}`,
      )
    }
  }
  if (failures.length > 0) {
    throw new TruthAuthorityError(
      `Physician-truth census drift detected; stopping. Aggregate mismatches: ${failures.join(
        '; ',
      )}.`,
    )
  }
}

/** Wrap an already-parsed artifact truth in the lane's full-census authority checks. */
export function toTruthAuthority(artifact: ArtifactTruth): TruthAuthority {
  const census = censusOf(artifact.rows)
  assertTruthCensus(census)
  return { artifactSha256: artifact.artifactSha256, rows: artifact.rows, census }
}

/**
 * Load the physician truth from the operator-supplied finalized artifact path. The overlay
 * loader enforces the SHA-256 pin before anything else reads the bytes.
 */
export function loadTruthAuthority(artifactPath: string): TruthAuthority {
  return toTruthAuthority(loadArtifactTruth(artifactPath))
}
