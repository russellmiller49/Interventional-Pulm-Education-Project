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
}

export function bronchLearnRecordId(sectionId: string): string {
  const version = BRONCH_LEARN_VERSIONS[sectionId]
  return version ? `${sectionId}-learn-v${version}` : sectionId
}
