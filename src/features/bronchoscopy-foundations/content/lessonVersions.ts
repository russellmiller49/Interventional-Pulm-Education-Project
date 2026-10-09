/** Content meaning, independent of the backward-compatible storage envelope version. */
export const BRONCH_LEARN_VERSIONS: Readonly<Record<string, number>> = {
  'five-controls': 2,
  'honest-report': 2,
  // Re-authored in the rewrite pilot (2026-10-08).
  'right-side': 2,
  'bleeding-priorities': 2,
  // Re-authored in the rewrite, section 1 (2026-10-08).
  'clinical-question': 2,
  'pre-use-check': 2,
}

export function bronchLearnRecordId(sectionId: string): string {
  const version = BRONCH_LEARN_VERSIONS[sectionId]
  return version ? `${sectionId}-learn-v${version}` : sectionId
}
