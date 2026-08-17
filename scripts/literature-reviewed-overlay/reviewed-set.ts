/**
 * The canonical reviewed set: the cross-checked merge of the two source authorities.
 *
 * The finalized artifact is authoritative for the values to be imported (relevance class and
 * enrichment provenance); the protected local database is authoritative for cohort membership
 * and persisted review state (the workspace heads, including the two checksum-bound note
 * corrections). This module requires the two authorities to agree exactly where they overlap,
 * requires every owner-expected count to hold exactly, and derives the deterministic projection
 * digest and operation identity from the merged result. Every failure is a stop; no expectation
 * is ever adjusted to match an observation.
 */

import { canonicalJson, sha256 } from '../literature-production-ingest/canonical'
import type { ArtifactTruth } from './artifact'
import {
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_PERSISTED_HEAD_COUNT,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_EXPECTED_RELEVANT_COUNT,
  OVERLAY_NOTE_CORRECTION_AUTHORIZATION_SHA256,
  OVERLAY_NOTE_CORRECTION_RULE_VERSION,
  OVERLAY_NOTE_CORRECTIONS,
  type OverlayProvenance,
  type OverlayRelevance,
} from './constants'
import { overlayEventId, overlayOperationId } from './identity'
import type { CohortItem } from './projection'

export const OVERLAY_PROJECTION_SCHEMA_VERSION =
  'literature-reviewed-overlay-projection/1.0.0' as const

export interface NoteCorrectionLineage {
  authorizationSha256: string
  rationaleSha256: string
  ruleVersion: string
}

export interface ReviewedRecord {
  pmid: string
  reviewedRelevance: OverlayRelevance
  enrichmentProvenance: OverlayProvenance
  /** The persisted local head revision, or null when the item has no persisted review row. */
  persistedHeadRevision: number | null
  /** Checksum-bound correction lineage for the two known corrections; null otherwise. */
  noteCorrection: NoteCorrectionLineage | null
}

export interface ReviewedSetCounts {
  recordCount: number
  classCounts: Record<OverlayRelevance, number>
  relevantCount: number
  provenanceCounts: Record<OverlayProvenance, number>
  persistedHeadCount: number
  correctionCount: number
}

export interface ReviewedSet {
  artifactSha256: string
  /** Records in PMID order under `C` collation — the operator's one canonical order. */
  records: ReviewedRecord[]
  counts: ReviewedSetCounts
  /** SHA-256 over the canonical JSON of the schema version, artifact digest, and records. */
  projectionDigest: string
  /** Deterministic operation identity derived from the projection digest. */
  operationId: string
}

function compareCUnits(left: string, right: string): number {
  // PMIDs are ASCII digit strings, where UTF-16 code-unit order equals `C`-collation byte
  // order; this mirrors the source query's `order by pmid collate "C"`.
  if (left === right) return 0
  return left < right ? -1 : 1
}

function countsOf(records: readonly ReviewedRecord[]): ReviewedSetCounts {
  const classCounts: Record<OverlayRelevance, number> = {
    include_core: 0,
    include_adjacent: 0,
    exclude: 0,
  }
  const provenanceCounts: Record<OverlayProvenance, number> = {
    physician_confirmed: 0,
    physician_modified: 0,
    qc_accepted: 0,
  }
  let persistedHeadCount = 0
  let correctionCount = 0
  for (const record of records) {
    classCounts[record.reviewedRelevance] += 1
    provenanceCounts[record.enrichmentProvenance] += 1
    if (record.persistedHeadRevision !== null) persistedHeadCount += 1
    if (record.noteCorrection !== null) correctionCount += 1
  }
  return {
    recordCount: records.length,
    classCounts,
    relevantCount: classCounts.include_core + classCounts.include_adjacent,
    provenanceCounts,
    persistedHeadCount,
    correctionCount,
  }
}

function assertExactCounts(counts: ReviewedSetCounts): void {
  if (counts.recordCount !== OVERLAY_EXPECTED_RECORD_COUNT) {
    throw new Error(
      `The reviewed set held ${counts.recordCount} records; exactly ` +
        `${OVERLAY_EXPECTED_RECORD_COUNT} are expected.`,
    )
  }
  for (const [label, expected] of Object.entries(OVERLAY_EXPECTED_CLASS_COUNTS)) {
    const observed = counts.classCounts[label as OverlayRelevance]
    if (observed !== expected) {
      throw new Error(
        `The reviewed set held ${observed} ${label} records; exactly ${expected} are expected.`,
      )
    }
  }
  if (counts.relevantCount !== OVERLAY_EXPECTED_RELEVANT_COUNT) {
    throw new Error(
      `The reviewed set held ${counts.relevantCount} relevant records; exactly ` +
        `${OVERLAY_EXPECTED_RELEVANT_COUNT} are expected.`,
    )
  }
  for (const [provenance, expected] of Object.entries(OVERLAY_EXPECTED_PROVENANCE_COUNTS)) {
    const observed = counts.provenanceCounts[provenance as OverlayProvenance]
    if (observed !== expected) {
      throw new Error(
        `The reviewed set held ${observed} ${provenance} records; exactly ${expected} are ` +
          'expected. The owner-expected provenance distribution did not match the ' +
          'authoritative development-only projection; stopping for owner review.',
      )
    }
  }
  if (counts.correctionCount !== OVERLAY_NOTE_CORRECTIONS.length) {
    throw new Error('The reviewed set does not carry exactly the two known corrections.')
  }
  if (counts.persistedHeadCount !== OVERLAY_EXPECTED_PERSISTED_HEAD_COUNT) {
    throw new Error(
      `The reviewed set carried ${counts.persistedHeadCount} persisted heads; exactly ` +
        `${OVERLAY_EXPECTED_PERSISTED_HEAD_COUNT} are expected.`,
    )
  }
}

/**
 * Merge the two authorities into the canonical reviewed set.
 *
 * Both inputs must already be internally validated (`collectCohort`, `loadArtifactTruth`).
 * This function enforces the cross-authority properties: identical PMID sets — missing and
 * extra rows are distinguished and both fatal — persisted-head agreement on relevance, the
 * exact owner-expected distributions, and the two corrections' lineage.
 */
export function buildReviewedSet(
  cohort: readonly CohortItem[],
  artifact: ArtifactTruth,
): ReviewedSet {
  const cohortByPmid = new Map(cohort.map((item) => [item.pmid, item]))
  if (cohortByPmid.size !== cohort.length) {
    throw new Error('The cohort projection contained duplicate PMIDs.')
  }
  const artifactPmids = new Set(artifact.rows.map((row) => row.pmid))
  if (artifactPmids.size !== artifact.rows.length) {
    throw new Error('The finalized artifact contained duplicate PMIDs.')
  }

  const missingFromArtifact = cohort.filter((item) => !artifactPmids.has(item.pmid)).length
  const missingFromCohort = artifact.rows.filter((row) => !cohortByPmid.has(row.pmid)).length
  if (missingFromArtifact > 0 || missingFromCohort > 0) {
    throw new Error(
      `The two authorities disagree on cohort membership: ${missingFromArtifact} database ` +
        `item(s) are absent from the artifact and ${missingFromCohort} artifact record(s) are ` +
        'absent from the database cohort.',
    )
  }

  const correctionsByPmid = new Map<string, (typeof OVERLAY_NOTE_CORRECTIONS)[number]>(
    OVERLAY_NOTE_CORRECTIONS.map((correction) => [correction.pmid, correction]),
  )

  const records = artifact.rows
    .map((row): ReviewedRecord => {
      const item = cohortByPmid.get(row.pmid)
      if (!item) {
        throw new Error('An artifact record lost its cohort item during the merge.')
      }
      if (item.persistedLabel !== null && item.persistedLabel !== row.relevance) {
        throw new Error(
          'A persisted database head disagrees with the finalized artifact on relevance. The ' +
            'two authorities must agree exactly; stopping for owner review.',
        )
      }
      const correction = correctionsByPmid.get(row.pmid)
      if (correction && item.persistedHeadRevision !== correction.expectedHeadRevision) {
        throw new Error(
          'A recorded correction head is not at its checksum-bound revision in the merge.',
        )
      }
      return {
        pmid: row.pmid,
        reviewedRelevance: row.relevance,
        enrichmentProvenance: row.provenance,
        persistedHeadRevision: item.persistedHeadRevision,
        noteCorrection: correction
          ? {
              authorizationSha256: OVERLAY_NOTE_CORRECTION_AUTHORIZATION_SHA256,
              rationaleSha256: correction.rationaleSha256,
              ruleVersion: OVERLAY_NOTE_CORRECTION_RULE_VERSION,
            }
          : null,
      }
    })
    .sort((left, right) => compareCUnits(left.pmid, right.pmid))

  const counts = countsOf(records)
  assertExactCounts(counts)

  const projectionDigest = sha256(
    canonicalJson({
      schemaVersion: OVERLAY_PROJECTION_SCHEMA_VERSION,
      artifactSha256: artifact.artifactSha256,
      records,
    }),
  )

  return {
    artifactSha256: artifact.artifactSha256,
    records,
    counts,
    projectionDigest,
    operationId: overlayOperationId(projectionDigest),
  }
}

/** The event identity for one record of a reviewed set. */
export function reviewedRecordEventId(set: ReviewedSet, record: ReviewedRecord): string {
  return overlayEventId(set.operationId, record.pmid)
}

/** Printable aggregate view of a reviewed set. Counts and digests only — never a PMID. */
export function summarizeReviewedSet(set: ReviewedSet): {
  artifactSha256: string
  projectionDigest: string
  operationId: string
  counts: ReviewedSetCounts
} {
  return {
    artifactSha256: set.artifactSha256,
    projectionDigest: set.projectionDigest,
    operationId: set.operationId,
    counts: set.counts,
  }
}
