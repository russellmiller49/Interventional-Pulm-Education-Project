/** @jest-environment node */

import {
  GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
  GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256,
  GOLD_IMPORT_NOTE_CURRENT_HEADS,
  GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION,
  GOLD_IMPORT_NOTE_PMIDS,
} from '../literature/gold-import-note-disposition'
import {
  APPROVED_PROJECT_REF,
  OVERLAY_ARTIFACT_SHA256,
  OVERLAY_BATCH_KIND,
  OVERLAY_BATCH_NAME,
  OVERLAY_COARSE_RELEVANCE,
  OVERLAY_EXPECTED_CLASS_COUNTS,
  OVERLAY_EXPECTED_PROVENANCE_COUNTS,
  OVERLAY_EXPECTED_RECORD_COUNT,
  OVERLAY_EXPECTED_RELEVANT_COUNT,
  OVERLAY_NOTE_CORRECTION_AUTHORIZATION_SHA256,
  OVERLAY_NOTE_CORRECTION_RULE_VERSION,
  OVERLAY_NOTE_CORRECTIONS,
  PROHIBITED_ENDOREELS_REF,
} from './constants'

describe('reviewed-overlay pinned expectations', () => {
  it('partitions the cohort exactly by class and by provenance', () => {
    const classTotal =
      OVERLAY_EXPECTED_CLASS_COUNTS.include_core +
      OVERLAY_EXPECTED_CLASS_COUNTS.include_adjacent +
      OVERLAY_EXPECTED_CLASS_COUNTS.exclude
    expect(classTotal).toBe(OVERLAY_EXPECTED_RECORD_COUNT)
    const provenanceTotal =
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_confirmed +
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.physician_modified +
      OVERLAY_EXPECTED_PROVENANCE_COUNTS.qc_accepted
    expect(provenanceTotal).toBe(OVERLAY_EXPECTED_RECORD_COUNT)
    expect(
      OVERLAY_EXPECTED_CLASS_COUNTS.include_core + OVERLAY_EXPECTED_CLASS_COUNTS.include_adjacent,
    ).toBe(OVERLAY_EXPECTED_RELEVANT_COUNT)
  })

  it('maps both include classes to included and exclude to excluded', () => {
    expect(OVERLAY_COARSE_RELEVANCE.include_core).toBe('included')
    expect(OVERLAY_COARSE_RELEVANCE.include_adjacent).toBe('included')
    expect(OVERLAY_COARSE_RELEVANCE.exclude).toBe('excluded')
    // The two include classes must remain distinguishable at the fine level even though they
    // share a coarse projection.
    expect(new Set(Object.keys(OVERLAY_COARSE_RELEVANCE)).size).toBe(3)
  })

  it('separates the approved and prohibited project identities', () => {
    expect(APPROVED_PROJECT_REF).toBe('itcttmkxdxvwmwcmzmey')
    expect(PROHIBITED_ENDOREELS_REF).toBe('tqnhxlwvkkswuckszlee')
    expect(APPROVED_PROJECT_REF).not.toBe(PROHIBITED_ENDOREELS_REF)
  })

  it('binds the artifact identity to the protected note-disposition pin', () => {
    expect(OVERLAY_ARTIFACT_SHA256).toBe(GOLD_IMPORT_FINAL_V3_ARTIFACT_SHA256)
  })

  it('binds the two corrections to the protected checksum-bound lineage', () => {
    expect(OVERLAY_NOTE_CORRECTIONS.map((correction) => correction.pmid)).toEqual([
      ...GOLD_IMPORT_NOTE_PMIDS,
    ])
    expect(OVERLAY_NOTE_CORRECTION_AUTHORIZATION_SHA256).toBe(
      GOLD_IMPORT_AMENDED_AUTHORIZATION_SHA256,
    )
    expect(OVERLAY_NOTE_CORRECTION_RULE_VERSION).toBe(GOLD_IMPORT_NOTE_DISPOSITION_RULE_VERSION)
    for (const correction of OVERLAY_NOTE_CORRECTIONS) {
      const head = GOLD_IMPORT_NOTE_CURRENT_HEADS.find((entry) => entry.pmid === correction.pmid)
      expect(head?.currentRevision).toBe(correction.expectedHeadRevision)
    }
  })

  it('names the cohort batch identity exactly', () => {
    expect(OVERLAY_BATCH_NAME).toBe('gold-set-v1')
    expect(OVERLAY_BATCH_KIND).toBe('gold_standard')
  })
})
