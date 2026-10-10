/** Content meaning, independent of the backward-compatible storage envelope version. */
export const BRONCH_LEARN_VERSIONS: Readonly<Record<string, number>> = {
  // Re-authored in the rewrite, section 4 (2026-10-08).
  'five-controls': 3,
  'honest-report': 2,
  // Re-authored in the rewrite pilot (2026-10-08).
  'right-side': 2,
  'bleeding-priorities': 2,
  // Re-authored in the rewrite, section 1 (2026-10-08).
  'clinical-question': 2,
  'pre-use-check': 2,
  'sedation-and-monitoring': 2,
  'larynx-and-entry': 2,
  // Re-authored in the rewrite, section 7 (2026-10-09).
  'left-side': 2,
  // Re-authored in the rewrite, section 8 (2026-10-09).
  'view-loss': 2,
  // Re-authored in the rewrite, section 9 (2026-10-09).
  'systematic-survey': 2,
}

export function bronchLearnRecordId(sectionId: string): string {
  const version = BRONCH_LEARN_VERSIONS[sectionId]
  return version ? `${sectionId}-learn-v${version}` : sectionId
}
