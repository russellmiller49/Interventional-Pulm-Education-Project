import type { SourceReference } from './content/schema'

/**
 * How a registered source reads on a learner surface (CRRT-FELLOW-04, F-19).
 *
 * Source records carry authoring and audit vocabulary that is right for a reviewer and wrong on
 * a learner's main path: a synthetic record's section reads “LAB-PRESCRIPTION reviewer
 * prototype” or “CRRT-17 private learning fixture”, and its version is a build string such as
 * “1.1.0-sme-review.1” — which says which release stage the content was built for, not that a
 * subject-matter expert reviewed it.
 *
 * This keeps both. The main path gets plain words: what kind of source it is, its identity,
 * date or edition, where in it to look, and its review state — never upgraded. The exact record
 * stays one disclosure away (`audit`), with the id, the registered strings verbatim and the
 * implementation location, so nothing a reviewer needs is moved behind an admin view.
 */
export interface CrrtLearnerCitation {
  readonly id: string
  /** What kind of evidence this is, in words a learner reads. */
  readonly kind: string
  readonly title: string
  /** Edition, journal citation or revision as registered; plain words for module-written values. */
  readonly edition: string | null
  /** Page, section or plain location; null when the record states none. */
  readonly locator: string | null
  /** Review state in plain words. Never stronger than the record. */
  readonly review: string
  /** One line for compact surfaces: kind · title · edition · locator. */
  readonly line: string
  readonly audit: CrrtSourceAuditDetail
}

export interface CrrtSourceAuditDetail {
  readonly id: string
  readonly sourceType: SourceReference['sourceType']
  readonly documentVersion: string | null
  readonly pageOrSection: string
  readonly reviewStatus: SourceReference['reviewStatus']
  readonly reviewer: string | null
  readonly implementationLocation: string
  /** Set when the registered version string could be misread as a review. */
  readonly versionNote: string | null
}

const kindWords: Readonly<Record<SourceReference['sourceType'], string>> = Object.freeze({
  'device-manual': 'Manufacturer operator’s manual',
  ifu: 'Manufacturer instructions for use',
  guideline: 'Clinical practice guideline',
  'peer-reviewed': 'Peer-reviewed publication',
  textbook: 'Textbook chapter',
  'professional-standard': 'Professional standard',
  'local-protocol': 'Local protocol',
  'synthetic-calibration': 'Simulated teaching values written for this module',
})

/** Plain names for the module's own tools and fixtures, keyed by the registered section text. */
const syntheticLocatorPatterns: readonly (readonly [
  RegExp,
  (match: RegExpMatchArray) => string,
])[] = [
  [/^LAB-PRESSURE-LOCALIZATION reviewer prototype$/, () => 'Pressure Localization Lab'],
  [/^LAB-PRESCRIPTION reviewer prototype$/, () => 'Staged prescription builder'],
  [/^LAB-PREPOST-DILUTION reviewer prototype$/, () => 'Pre/post-dilution comparison'],
  [
    /^(CRRT-\d+) (?:authored reviewer fixture|authored fixture|private learning fixture)$/,
    (m) => `Case ${m[1]}`,
  ],
  [/^(CRRT-\d+) manifest-only reserved record$/, (m) => `Reserved for a possible case ${m[1]}`],
  [/^DRILL-([A-Z-]+) v1 rapid drill$/, (m) => `${drillNames[m[1]] ?? 'Rapid'} drill`],
]

const drillNames: Readonly<Record<string, string>> = Object.freeze({
  AIR: 'Air detection',
  'BLOOD-LEAK': 'Blood-leak detection',
  'GAIN-LOSS': 'Fluid gain or loss',
  'BAG-SCALE': 'Bag or scale error',
})

function syntheticLocator(pageOrSection: string): string {
  for (const [pattern, name] of syntheticLocatorPatterns) {
    const match = pageOrSection.match(pattern)
    if (match) return name(match)
  }
  return pageOrSection.replace(/\s*·\s*authored schematic boundary$/, '')
}

function looksLikeReview(version: string): boolean {
  return /sme-review|reviewed|review build/i.test(version)
}

function reviewWords(source: SourceReference): string {
  if (source.reviewStatus === 'pending' || source.reviewer === null) {
    return source.sourceType === 'synthetic-calibration'
      ? 'No clinical review recorded'
      : 'Clinical and device review of how this module uses it: none recorded yet'
  }
  return `Review recorded: ${source.reviewStatus}${source.reviewer ? ` · ${source.reviewer}` : ''}`
}

export function crrtLearnerCitation(source: SourceReference): CrrtLearnerCitation {
  const synthetic = source.sourceType === 'synthetic-calibration'
  const version = source.documentVersion ?? null
  const versionNote =
    version && looksLikeReview(version)
      ? `“${version}” names the release stage this content was built for. It does not mean a subject-matter expert has reviewed it.`
      : null
  const title = synthetic ? 'Simulated teaching values' : source.sourceTitle
  const edition = synthetic ? 'Written for this module' : version
  const url = source.pageOrSection.includes('http')
  const locator = synthetic
    ? syntheticLocator(source.pageOrSection)
    : url
      ? source.pageOrSection
          .split(' · ')
          .filter((part) => !part.includes('http'))
          .join(' · ') || null
      : source.pageOrSection
  const kind = kindWords[source.sourceType]
  const line = [synthetic ? kind : title, synthetic ? locator : edition, synthetic ? null : locator]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
  return Object.freeze({
    id: source.id,
    kind,
    title,
    edition,
    locator,
    review: reviewWords(source),
    line,
    audit: Object.freeze({
      id: source.id,
      sourceType: source.sourceType,
      documentVersion: version,
      pageOrSection: source.pageOrSection,
      reviewStatus: source.reviewStatus,
      reviewer: source.reviewer,
      implementationLocation: source.implementationLocation,
      versionNote,
    }),
  })
}
