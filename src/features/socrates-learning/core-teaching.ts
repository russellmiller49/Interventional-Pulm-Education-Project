import type { SocratesSlideDocument } from '@/features/socrates-builder/types'
import { getInvenioPair } from '@/features/socrates-builder/invenio-source'

/** Derived teaching order from Socrates Case Order.xlsx, Case Order!A2:D26 (2026-10-06).
 * Case + series is the identity; neither the former position nor a diagnosis is an identity.
 * Original workbook provenance, author content, assignments and releases remain authoritative.
 */
export const coreTeachingSections = [
  {
    id: 'normal-benign',
    title: 'Normal/benign lung tissue',
    cases: [
      [272, 2],
      [142, 3],
      [443, 1],
      [55, 2],
      [440, 2],
      [6, 4],
      [435, 2],
    ],
  },
  {
    id: 'non-diagnostic',
    title: 'Non-diagnostic specimens',
    cases: [
      [171, 1],
      [88, 4],
      [422, 2],
      [229, 1],
    ],
  },
  {
    id: 'diagnostic-non-cancer',
    title: 'Diagnostic/Adequate non-cancer: granulomas',
    cases: [
      [327, 2],
      [23, 3],
      [26, 1],
    ],
  },
  {
    id: 'diagnostic-cancer',
    title: 'Diagnostic/Adequate cancer',
    cases: [
      [41, 4],
      [216, 4],
      [320, 2],
      [281, 2],
      [233, 2],
      [341, 1],
      [240, 4],
      [393, 1],
      [258, 3],
      [192, 2],
      [430, 2],
    ],
  },
] as const

export type CoreTeachingSequence = {
  position: number
  section: (typeof coreTeachingSections)[number]['id']
}
export const coreTeachingCases = coreTeachingSections.flatMap((section) =>
  section.cases.map(([caseNumber, series]) => ({
    key: `case-${caseNumber}-series-${series}`,
    section: section.id,
  })),
)

export function coreTeachingSequence(document: SocratesSlideDocument): CoreTeachingSequence | null {
  // Released teaching images use opaque relays. The server derives only these two public
  // display fields before removing the source identity; testing never receives them.
  if (/^\/api\/socrates\/images\/library\//.test(document.slide.descriptorUrl))
    return document.caseContent?.coreTeachingSequence ?? null
  const image = getInvenioPair(document.slide.descriptorUrl)?.id.match(/^nio-(\d+)-series-(\d+)-/)
  const source = document.authorContent?.curriculumSource?.sourceValues['Full Case Name'].match(
    /^Case (\d+) · Series (\d+) · /,
  )
  const key = (match: RegExpMatchArray) => `case-${Number(match[1])}-series-${Number(match[2])}`
  // A mismatched source name must not assign the wrong image to a teaching section.
  if (!image || (source && key(image) !== key(source))) return null
  const index = coreTeachingCases.findIndex((entry) => entry.key === key(image))
  return index < 0 ? null : { position: index + 1, section: coreTeachingCases[index].section }
}

export function teachingSectionTitle(sequence: CoreTeachingSequence) {
  return coreTeachingSections.find((section) => section.id === sequence.section)!.title
}

export function compareTeachingDocuments(a: SocratesSlideDocument, b: SocratesSlideDocument) {
  const first = coreTeachingSequence(a)
  const second = coreTeachingSequence(b)
  if (first || second)
    return (
      (first?.position ?? Infinity) - (second?.position ?? Infinity) ||
      (a.recordId ?? a.slug).localeCompare(b.recordId ?? b.slug)
    )
  const order = (doc: SocratesSlideDocument) =>
    doc.authorContent?.curriculumSource?.sourceValues['Overall Order'] ??
    doc.caseContent?.sortOrder ??
    0
  return order(a) - order(b) || a.slug.localeCompare(b.slug)
}
