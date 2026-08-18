/**
 * The finalized V3 artifact boundary.
 *
 * The artifact is coordinator-only. This module confines it: bytes are hashed against the
 * built-in pin (and, when supplied, the owner's environment pin) before parsing; parsing is
 * delegated to the protected `parseFinalizedGoldImportArtifact`, which re-verifies the digest,
 * authenticates the development split positively on every row via a schema literal, and rejects
 * duplicate identities; and what leaves this module is only the per-PMID relevance class and
 * enrichment provenance plus printable aggregates. Notes, taxonomy content, and every other
 * coordinator-only column stay inside the parse result, which is dropped before return.
 */

import { readFileSync } from 'node:fs'
import { isAbsolute } from 'node:path'

import { parseFinalizedGoldImportArtifact } from '../literature/gold-import-compensation-compatibility'
import {
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_PROVENANCE_VALUES,
  OVERLAY_RELEVANCE_VALUES,
  type OverlayProvenance,
  type OverlayRelevance,
} from './constants'

export interface ArtifactTruthRow {
  pmid: string
  relevance: OverlayRelevance
  provenance: OverlayProvenance
}

export interface ArtifactTruth {
  artifactSha256: string
  rows: ArtifactTruthRow[]
}

/**
 * Load and reduce the finalized artifact.
 *
 * `expectedSha256Pins` carries every digest the caller requires the bytes to match — the
 * built-in constant is always required; the owner's environment pin is added by the engine when
 * present. The pins must agree with each other by construction, so a disagreement between them
 * is refused before the file is read.
 */
export function loadArtifactTruth(
  artifactPath: string,
  expectedSha256Pins: readonly string[] = [],
): ArtifactTruth {
  if (!isAbsolute(artifactPath)) {
    throw new Error('The artifact path must be absolute.')
  }
  for (const pin of expectedSha256Pins) {
    if (pin !== OVERLAY_ARTIFACT_SHA256) {
      throw new Error(
        'An expected-artifact pin does not match the reviewed artifact identity. Refusing to ' +
          'read the file.',
      )
    }
  }

  const parsed = parseFinalizedGoldImportArtifact(readFileSync(artifactPath), {
    expectedArtifactSha256: OVERLAY_ARTIFACT_SHA256,
  })
  return reduceParsedArtifact(parsed)
}

/** The minimal shape of one parsed artifact record this module consumes. */
export interface ParsedArtifactRecordView {
  csvRecordNumber: number
  identity: { pmid: string }
  physicianReviewCohort: string
  projection: { relevanceLabel: string }
}

/**
 * Reduce a checksum-verified parse result to the per-PMID truth. Split from the file boundary
 * so the reduction rules are testable against synthetic parse results without any bytes that
 * could hash to the pinned artifact identity.
 */
export function reduceParsedArtifact(parsed: {
  artifactSha256: string
  rows: readonly ParsedArtifactRecordView[]
}): ArtifactTruth {
  const rows = parsed.rows.map((row): ArtifactTruthRow => {
    const relevance = row.projection.relevanceLabel
    if (!(OVERLAY_RELEVANCE_VALUES as readonly string[]).includes(relevance)) {
      // `uncertain` and anything unknown both land here; the record number is safe to name,
      // the row content is not.
      throw new Error(
        `Finalized artifact CSV record ${row.csvRecordNumber} has a relevance outside the ` +
          'finalized vocabulary.',
      )
    }
    const provenance = row.physicianReviewCohort
    if (!(OVERLAY_PROVENANCE_VALUES as readonly string[]).includes(provenance)) {
      throw new Error(
        `Finalized artifact CSV record ${row.csvRecordNumber} has an enrichment provenance ` +
          'outside the finalized vocabulary.',
      )
    }
    return {
      pmid: row.identity.pmid,
      relevance: relevance as OverlayRelevance,
      provenance: provenance as OverlayProvenance,
    }
  })

  if (rows.length !== OVERLAY_EXPECTED_RECORD_COUNT) {
    throw new Error(
      `The finalized artifact held ${rows.length} records; exactly ` +
        `${OVERLAY_EXPECTED_RECORD_COUNT} are expected.`,
    )
  }
  const unique = new Set(rows.map((row) => row.pmid))
  if (unique.size !== rows.length) {
    throw new Error('The finalized artifact contained duplicate PMIDs.')
  }

  return { artifactSha256: parsed.artifactSha256, rows }
}
