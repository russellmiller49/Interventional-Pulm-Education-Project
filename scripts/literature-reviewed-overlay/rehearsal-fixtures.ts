/**
 * Deterministic synthetic fixtures for the disposable rehearsal and the unit suites.
 *
 * Every PMID here is synthetic (the 100000xxx range) except the two known correction PMIDs,
 * which are pinned constants of the operator itself and are already public throughout this
 * repository's docs and protected code. No fixture value is derived from real cohort data:
 * titles, labels, and provenance are assigned positionally to synthetic identities.
 */

import type { ArtifactTruth } from './artifact'
import {
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_NOTE_CORRECTIONS,
  type OverlayProvenance,
  type OverlayRelevance,
} from './constants'

/** The synthetic corpus PMID range: 100000001 … 100132348, plus the two correction PMIDs. */
export const FIXTURE_CORPUS_FIRST_PMID = 100_000_001
export const FIXTURE_CORPUS_SYNTHETIC_COUNT = OVERLAY_EXPECTED_CORPUS_ARTICLE_COUNT - 2

/** The synthetic reviewed cohort: the first 628 synthetic PMIDs plus the two corrections. */
export function fixtureCohortPmids(): string[] {
  const synthetic = Array.from({ length: OVERLAY_EXPECTED_RECORD_COUNT - 2 }, (_, index) =>
    String(FIXTURE_CORPUS_FIRST_PMID + index),
  )
  const pmids = [...synthetic, ...OVERLAY_NOTE_CORRECTIONS.map((correction) => correction.pmid)]
  return pmids.sort((left, right) => (left === right ? 0 : left < right ? -1 : 1))
}

function positionalLabel(position: number): OverlayRelevance {
  if (position < OVERLAY_EXPECTED_CLASS_COUNTS.include_core) return 'include_core'
  if (
    position <
    OVERLAY_EXPECTED_CLASS_COUNTS.include_core + OVERLAY_EXPECTED_CLASS_COUNTS.include_adjacent
  ) {
    return 'include_adjacent'
  }
  return 'exclude'
}

function positionalProvenance(position: number): OverlayProvenance {
  if (position < OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_confirmed) {
    return 'physician_confirmed'
  }
  if (
    position <
    OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_confirmed +
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_modified
  ) {
    return 'physician_modified'
  }
  return 'qc_accepted'
}

export interface FixtureTruth {
  artifact: ArtifactTruth
  cohortPayloads: Array<Record<string, unknown>>
}

/**
 * Build the paired fixture authorities: an artifact truth with the exact expected
 * distributions, and cohort payloads shaped exactly as the guarded boundary yields them —
 * the two corrections completed at revision 2, seven synthetic persisted heads at revision 1
 * (labels agreeing with the artifact), and everything else pending.
 */
export function buildFixtureTruth(): FixtureTruth {
  const pmids = fixtureCohortPmids()
  const correctionPmids = new Set<string>(
    OVERLAY_NOTE_CORRECTIONS.map((correction) => correction.pmid),
  )

  const artifactRows = pmids.map((pmid, position) => ({
    pmid,
    relevance: positionalLabel(position),
    provenance: positionalProvenance(position),
  }))
  const labelByPmid = new Map(artifactRows.map((row) => [row.pmid, row.relevance]))

  const syntheticHeadPmids = pmids.filter((pmid) => !correctionPmids.has(pmid)).slice(0, 7)
  const syntheticHeads = new Set(syntheticHeadPmids)

  const cohortPayloads = pmids.map((pmid): Record<string, unknown> => {
    if (correctionPmids.has(pmid)) {
      return {
        pmid,
        reviewStatus: 'completed',
        hasHead: true,
        relevanceLabel: labelByPmid.get(pmid),
        headRevision: 2,
        revisionKind: 'standard',
        lifecycleState: 'effective',
      }
    }
    if (syntheticHeads.has(pmid)) {
      return {
        pmid,
        reviewStatus: 'completed',
        hasHead: true,
        relevanceLabel: labelByPmid.get(pmid),
        headRevision: 1,
        revisionKind: 'standard',
        lifecycleState: 'effective',
      }
    }
    return {
      pmid,
      reviewStatus: 'pending',
      hasHead: false,
      relevanceLabel: null,
      headRevision: null,
      revisionKind: 'standard',
      lifecycleState: 'effective',
    }
  })

  return {
    artifact: {
      // The rehearsal pins the reviewed artifact identity; fixture *content* is synthetic.
      artifactSha256: '961c19f4ea1c6a82e061369fd33d927e804360f10781729f8049073a4b6d0f59',
      rows: artifactRows,
    },
    cohortPayloads,
  }
}

/** SQL that seeds the disposable corpus: exactly the expected total, all draft/unreviewed. */
export function buildCorpusSeedSql(): string {
  const corrections = OVERLAY_NOTE_CORRECTIONS.map(
    (correction) =>
      `('${correction.pmid}', 'Rehearsal correction article ${correction.pmid}', ` +
      `md5('${correction.pmid}') || md5('m${correction.pmid}'), ` +
      `'rehearsal correction article ${correction.pmid}', ` +
      `md5('n${correction.pmid}') || md5('h${correction.pmid}'))`,
  ).join(',\n  ')

  return `insert into public.literature_articles (
  pmid, title, metadata_hash, normalized_title, normalized_title_hash
)
select
  p::text,
  'Rehearsal article ' || p,
  md5(p::text) || md5('m' || p::text),
  'rehearsal article ' || p,
  md5('n' || p::text) || md5('h' || p::text)
from generate_series(${FIXTURE_CORPUS_FIRST_PMID}, ${
    FIXTURE_CORPUS_FIRST_PMID + FIXTURE_CORPUS_SYNTHETIC_COUNT - 1
  }) as p;
insert into public.literature_articles (
  pmid, title, metadata_hash, normalized_title, normalized_title_hash
)
values
  ${corrections};`
}
