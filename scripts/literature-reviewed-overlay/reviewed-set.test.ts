/** @jest-environment node */

import { reduceParsedArtifact } from './artifact'
import { OVERLAY_EXPECTED_RELEVANT_COUNT, OVERLAY_NOTE_CORRECTIONS } from './constants'
import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet, reviewedRecordEventId, summarizeReviewedSet } from './reviewed-set'

function freshInputs() {
  const truth = buildFixtureTruth()
  return { cohort: collectCohort(truth.cohortPayloads), artifact: truth.artifact }
}

describe('buildReviewedSet', () => {
  it('accepts the exact fixture truth and derives deterministic identity', () => {
    const { cohort, artifact } = freshInputs()
    const first = buildReviewedSet(cohort, artifact)
    const second = buildReviewedSet(cohort, artifact)
    expect(first.projectionDigest).toBe(second.projectionDigest)
    expect(first.operationId).toBe(second.operationId)
    expect(first.counts.recordCount).toBe(630)
    expect(first.counts.classCounts).toEqual({
      include_core: 283,
      include_adjacent: 75,
      exclude: 272,
    })
    expect(first.counts.relevantCount).toBe(OVERLAY_EXPECTED_RELEVANT_COUNT)
    expect(first.counts.provenanceCounts).toEqual({
      physician_confirmed: 192,
      physician_modified: 133,
      qc_accepted: 305,
    })
    expect(first.counts.correctionCount).toBe(2)
    expect(first.counts.persistedHeadCount).toBe(9)
    // Records are in PMID order under C collation.
    const pmids = first.records.map((record) => record.pmid)
    expect([...pmids].sort((a, b) => (a === b ? 0 : a < b ? -1 : 1))).toEqual(pmids)
  })

  it('derives distinct event ids per record and stable ids per rerun', () => {
    const { cohort, artifact } = freshInputs()
    const set = buildReviewedSet(cohort, artifact)
    const ids = new Set(set.records.map((record) => reviewedRecordEventId(set, record)))
    expect(ids.size).toBe(set.records.length)
    const again = buildReviewedSet(cohort, artifact)
    expect(reviewedRecordEventId(again, again.records[0]!)).toBe(
      reviewedRecordEventId(set, set.records[0]!),
    )
  })

  it('carries the correction lineage on exactly the two known records', () => {
    const { cohort, artifact } = freshInputs()
    const set = buildReviewedSet(cohort, artifact)
    const corrected = set.records.filter((record) => record.noteCorrection !== null)
    expect(corrected.map((record) => record.pmid).sort()).toEqual(
      OVERLAY_NOTE_CORRECTIONS.map((correction) => correction.pmid).sort(),
    )
    for (const record of corrected) {
      expect(record.persistedHeadRevision).toBe(2)
      expect(record.noteCorrection?.authorizationSha256).toMatch(/^[a-f0-9]{64}$/u)
      expect(record.noteCorrection?.rationaleSha256).toMatch(/^[a-f0-9]{64}$/u)
      expect(record.noteCorrection?.ruleVersion).toBe(
        'amended-two-row-physician-rationale-exception/1.0.0',
      )
    }
  })

  it('refuses a class-count drift', () => {
    const { cohort, artifact } = freshInputs()
    const persisted = new Set(
      cohort.filter((item) => item.persistedLabel !== null).map((item) => item.pmid),
    )
    // Drift a record with no persisted head, so the count gate itself is what refuses.
    const victim = artifact.rows.find(
      (row) => row.relevance === 'include_core' && !persisted.has(row.pmid),
    )
    ;(victim as { relevance: string }).relevance = 'include_adjacent'
    expect(() => buildReviewedSet(cohort, artifact)).toThrow(/include_core records; exactly 283/u)
  })

  it('refuses a provenance-count drift and names the owner-review stop', () => {
    const { cohort, artifact } = freshInputs()
    const victim = artifact.rows.find((row) => row.provenance === 'qc_accepted')
    ;(victim as { provenance: string }).provenance = 'physician_confirmed'
    expect(() => buildReviewedSet(cohort, artifact)).toThrow(/stopping for owner review/iu)
  })

  it('distinguishes missing and extra rows and refuses both', () => {
    const base = freshInputs()
    const shrunkArtifact = {
      artifactSha256: base.artifact.artifactSha256,
      rows: base.artifact.rows.slice(0, 629),
    }
    expect(() => buildReviewedSet(base.cohort, shrunkArtifact)).toThrow(
      /1 database item\(s\) are absent from the artifact/u,
    )

    const swapped = freshInputs()
    const foreignRow = { ...swapped.artifact.rows[0]!, pmid: '999999998' }
    swapped.artifact.rows[0] = foreignRow
    expect(() => buildReviewedSet(swapped.cohort, swapped.artifact)).toThrow(
      /1 database item\(s\) are absent from the artifact and 1 artifact record\(s\) are absent/u,
    )
  })

  it('refuses a persisted head that disagrees with the artifact', () => {
    const { cohort, artifact } = freshInputs()
    const persisted = cohort.find((item) => item.persistedLabel !== null)
    const row = artifact.rows.find((entry) => entry.pmid === persisted?.pmid)
    ;(row as { relevance: string }).relevance =
      row?.relevance === 'exclude' ? 'include_core' : 'exclude'
    expect(() => buildReviewedSet(cohort, artifact)).toThrow(
      /persisted database head disagrees|held \d+ /u,
    )
  })

  it('summarizes without exposing PMIDs', () => {
    const { cohort, artifact } = freshInputs()
    const summary = summarizeReviewedSet(buildReviewedSet(cohort, artifact))
    expect(JSON.stringify(summary)).not.toMatch(/"pmid"/iu)
  })
})

describe('reduceParsedArtifact', () => {
  function parsedFixture(rowCount = 630): {
    artifactSha256: string
    rows: Array<{
      csvRecordNumber: number
      identity: { pmid: string }
      physicianReviewCohort: string
      projection: { relevanceLabel: string }
    }>
  } {
    const truth = buildFixtureTruth()
    return {
      artifactSha256: truth.artifact.artifactSha256,
      rows: truth.artifact.rows.slice(0, rowCount).map((row, index) => ({
        csvRecordNumber: index + 2,
        identity: { pmid: row.pmid },
        physicianReviewCohort: row.provenance,
        projection: { relevanceLabel: row.relevance },
      })),
    }
  }

  it('accepts exactly 630 valid records', () => {
    expect(reduceParsedArtifact(parsedFixture()).rows).toHaveLength(630)
  })

  it('refuses 629 and duplicate identities', () => {
    expect(() => reduceParsedArtifact(parsedFixture(629))).toThrow(/exactly 630/u)
    const parsed = parsedFixture()
    parsed.rows[1] = { ...parsed.rows[0]!, csvRecordNumber: 3 }
    expect(() => reduceParsedArtifact(parsed)).toThrow(/duplicate PMIDs/u)
  })

  it('refuses uncertain and malformed vocabulary by record number, not content', () => {
    const uncertain = parsedFixture()
    uncertain.rows[5]!.projection.relevanceLabel = 'uncertain'
    expect(() => reduceParsedArtifact(uncertain)).toThrow(
      /record 7 has a relevance outside the finalized vocabulary/u,
    )

    const malformed = parsedFixture()
    malformed.rows[6]!.physicianReviewCohort = 'unresolved_enrichment'
    expect(() => reduceParsedArtifact(malformed)).toThrow(
      /record 8 has an enrichment provenance outside the finalized vocabulary/u,
    )
  })
})
