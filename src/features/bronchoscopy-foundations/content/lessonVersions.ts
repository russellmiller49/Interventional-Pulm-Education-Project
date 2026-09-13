/** Content meaning, independent of the backward-compatible storage envelope version. */
export const BRONCH_LEARN_VERSIONS: Readonly<Record<string, number>> = { 'five-controls': 2 }

export function bronchLearnRecordId(sectionId: string): string {
  const version = BRONCH_LEARN_VERSIONS[sectionId]
  return version ? `${sectionId}-learn-v${version}` : sectionId
}
