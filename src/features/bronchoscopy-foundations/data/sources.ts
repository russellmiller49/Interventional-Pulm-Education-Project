import { MANIFEST_SOURCES } from './generated/sources.generated'
import type { ManifestSource } from './manifestTypes'

/**
 * The course's source registry: the manifest's thirty-two sources, each with the one sentence a
 * learner reads about what it does not cover, and the location grammar every citation uses.
 *
 * Three classes of source, three kinds of location. The three uploaded works (S1–S3) are cited by
 * PDF page. An authoring note puts S1's printed clinical page at the PDF page less sixteen; that
 * offset is not checked against the book here, so no printed page is ever derived from it (see
 * `PDF_PAGE_LOCATOR_NOTE`). The targeted external
 * clarifications (U1–U13) are cited by the recommendation or section they were checked for. The
 * sixteen lecture transcripts (T01–T16) are cited by an approximate time span and are always shown
 * with the transcript sentence: narrated lecture content, not a reviewed demonstration.
 */
export type BronchSourceId =
  | 'S1'
  | 'S2'
  | 'S3'
  | `U${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20}`
  | `T${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14' | '15' | '16'}`

/**
 * What a claim is, and therefore how the course may present it (knowledge spec "Evidence and
 * authorship labels"; medical-education-modules `clinical-content.md`).
 */
export type ClaimClass =
  | 'source'
  | 'transcript-source'
  | 'update'
  | 'synthesis'
  | 'design'
  | 'local-policy'
  | 'review-flag'

export const CLAIM_CLASS_WORDS: Readonly<Record<ClaimClass, string>> = {
  source: 'From the course textbooks and manuals',
  'transcript-source': 'From a narrated lecture (transcript)',
  update: 'Targeted clarification from a current external source',
  synthesis: 'Clinical synthesis of the sources',
  design: 'Teaching design, authored for this course',
  'local-policy': 'Depends on your institution’s policy or the device’s instructions',
  'review-flag': 'Qualified after review of a lecture statement',
}

export type SourceLocation =
  | { readonly kind: 'pdf-pages'; readonly from: number; readonly to?: number }
  | { readonly kind: 'time-span'; readonly start: string; readonly end?: string }
  | { readonly kind: 'section'; readonly label: string }

export interface SourceRef {
  readonly sourceId: BronchSourceId
  readonly location: SourceLocation
}

export const TRANSCRIPT_SENTENCE =
  'Lecture transcript — narrated lecture content, not a reviewed demonstration. The recording and slides were not reviewed; times are approximate.'

/** The manifest's transcript record, present on lecture transcripts only. */
export type ManifestTranscript = NonNullable<ManifestSource['transcript']>

/**
 * Which of the two ways a source may be presented. A `transcript` is a narrated lecture and always
 * carries the transcript sentence; a `reference` is a published or uploaded work (textbook,
 * manual, guideline, manufacturer document, trial) and never does.
 *
 * This is the source's publication class only. Whether the course has checked the source, and
 * whether a claim drawn from it is approved for teaching, are separate records (the claim-review
 * queue and the transcript review register), and nothing here reads or implies either.
 */
export type BronchSourceClass = 'transcript' | 'reference'

const TRANSCRIPT_TEXT_FIELDS = [
  'collection',
  'duration',
  'adoptedContribution',
  'publicationPermission',
] as const
const TRANSCRIPT_FLAG_FIELDS = [
  'audioVideoReviewed',
  'slidesAvailable',
  'speakerIdentityVerified',
] as const

function isManifestTranscript(value: unknown): value is ManifestTranscript {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    TRANSCRIPT_TEXT_FIELDS.every(
      (field) => typeof record[field] === 'string' && (record[field] as string).trim() !== '',
    ) &&
    TRANSCRIPT_FLAG_FIELDS.every((field) => typeof record[field] === 'boolean') &&
    typeof record.durationSeconds === 'number' &&
    Number.isFinite(record.durationSeconds) &&
    record.durationSeconds > 0 &&
    Array.isArray(record.moduleIds) &&
    record.moduleIds.every((moduleId) => typeof moduleId === 'string')
  )
}

/**
 * A source's transcript record, read against the manifest schema: the record when it is one,
 * `null` when the source has none. The generated manifest writes `transcript: null` on every
 * non-transcript, and a field that is absent means the same thing. Anything else is a malformed
 * record and throws at import rather than guessing which way to label the source.
 *
 * The section source list used to test `transcript !== undefined`, which is true of `null`, and so
 * labelled every textbook, manual and guideline as an unreviewed lecture (fellow walkthrough A8).
 * Every renderer now reads the class this derives, never the raw field.
 */
export function manifestTranscript(source: {
  readonly id: string
  readonly transcript?: unknown
}): ManifestTranscript | null {
  const value = source.transcript
  if (value === null || value === undefined) return null
  if (!isManifestTranscript(value))
    throw new Error(`Source ${source.id} carries a malformed transcript record.`)
  return value
}

/**
 * The publication class, checked against the id grammar every citation already relies on: the
 * lecture transcripts are T01–T16 and are cited by time span (`sourceRefErrors`). A transcript
 * record on any other id, or a T id without one, means the manifest and the registry disagree about
 * what the source is, and the import stops rather than choosing.
 */
export function bronchSourceClass(source: {
  readonly id: string
  readonly transcript?: unknown
}): BronchSourceClass {
  const sourceClass: BronchSourceClass = manifestTranscript(source) ? 'transcript' : 'reference'
  if (/^T\d{2}$/.test(source.id) !== (sourceClass === 'transcript'))
    throw new Error(
      `Source ${source.id} is registered as a ${/^T\d{2}$/.test(source.id) ? 'lecture transcript' : 'published source'} but its manifest record ${sourceClass === 'transcript' ? 'carries' : 'has no'} transcript.`,
    )
  return sourceClass
}

export interface BronchSource {
  readonly id: BronchSourceId
  /** Publication class — see `BronchSourceClass`. Renderers read this, not the manifest field. */
  readonly sourceClass: BronchSourceClass
  readonly kindLabel: string
  readonly title: string
  readonly byline: string
  readonly year: number | null
  readonly url: string | null
  /** What the course used it for, from the manifest's reviewed scope. */
  readonly usedFor: string
  /** What it does not establish. */
  readonly limitation: string
  readonly manifest: ManifestSource
}

const LIMITATIONS: Readonly<Record<string, string>> = {
  S1: 'Selected foundational chapters of a 2017 textbook; device examples reflect their era and are not a device specification.',
  S2: 'A 2011 training manual; its fixed sedation, fasting and reversal numbers are not carried forward as current rules.',
  S3: 'A faculty-development manual about teaching and evaluating learners, not a clinical protocol.',
  U1: 'A sedation practice guideline; staffing and drug choices remain institutional decisions.',
  U2: 'A national diagnostic-bronchoscopy guideline used for targeted distinctions only, not as a complete protocol.',
  U3: 'Summary infection-prevention recommendations; the reprocessing sequence comes from the device instructions and the local program.',
  U4: 'An emergency checklist whose drug algorithm this course deliberately does not reproduce.',
  U5: 'Radiation-protection guidance used for staff protection and pregnant staff; no dose limits are taken from it.',
  U6: 'A BAL guideline for interstitial lung disease; its volumes and recovery targets are not a universal adequacy rule.',
  U7: 'A pneumonia guideline used for sampling and culture-interpretation context, not as an antibiotic key.',
  U8: 'Manufacturer documentation for one ventilator family, used to explain how inspiratory time ends a conventional pressure-controlled breath.',
  U9: 'An awake-intubation guideline used for principles of preparation and confirmation.',
  U10: 'A central-airway-obstruction guideline summary; it does not validate any emergency induction plan.',
  U11: 'Manufacturer information for one cryotherapy platform; gas and settings for other devices come from their own instructions.',
  U12: 'Manufacturer information for one blocker; not a complete hemoptysis protocol.',
  U13: 'A randomized trial of inhaled tranexamic acid that excluded massive or unstable bleeding.',
  U14: 'A 2013 national guideline for diagnostic bronchoscopy; most of its recommendations are grade C or D.',
  U15: 'A consensus scale for reporting bleeding severity; it grades the response that was needed and does not direct treatment.',
  U16: 'A 2011 consensus statement on topical anesthesia and sedation; later guidelines revise some of its figures.',
  U17: 'Expert-panel recommendations for inherited and acquired methemoglobinemia; its methylene blue dose differs from the product label.',
  U18: 'The prescribing information for one methylene blue product; its dose and repeat interval differ from the expert-panel recommendations.',
  U19: 'Dimensions of one manufacturer’s current bronchoscopes, taken from device records and product specifications; other scopes differ.',
  U20: 'The prescribing information for flumazenil injection; its effect can wear off before the benzodiazepine does.',
}

/**
 * Sources added by the rewrite's numbers register (`content/numbers.ts`). The manifest import is
 * frozen, so these are registered here, in the manifest's own shape, rather than regenerated.
 */
export const SUPPLEMENTAL_SOURCES: readonly ManifestSource[] = [
  {
    id: 'U14',
    kind: 'primary society guideline',
    title: 'British Thoracic Society guideline for diagnostic flexible bronchoscopy in adults',
    authors: 'Du Rand IA, Blaikley J, Booton R, et al.',
    organization: 'British Thoracic Society',
    year: 2013,
    doi: '10.1136/thoraxjnl-2013-203618',
    url: 'https://thorax.bmj.com/content/68/Suppl_1/i1',
    reviewedScope:
      'Fasting, oxygen supplementation, topical anesthesia, sedation, platelets and antiplatelet agents, biopsy number, imaging after biopsy',
    accessedDate: '2026-10-08',
    transcript: null,
  },
  {
    id: 'U15',
    kind: 'consensus statement',
    title:
      'Standardized Definitions of Bleeding After Transbronchial Lung Biopsy: A Delphi Consensus Statement From the Nashville Working Group',
    authors: 'Folch EE, Mahajan AK, Oberg CL, et al.',
    organization: null,
    year: 2020,
    doi: '10.1016/j.chest.2020.01.036',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7403751/',
    reviewedScope: 'The Nashville Bleeding Scale, grades 1 to 4',
    accessedDate: '2026-10-08',
    transcript: null,
  },
  {
    id: 'U16',
    kind: 'consensus statement',
    title:
      'American College of Chest Physicians consensus statement on the use of topical anesthesia, analgesia, and sedation during flexible bronchoscopy in adult patients',
    authors: 'Wahidi MM, Jain P, Jantz M, et al.',
    organization: 'American College of Chest Physicians',
    year: 2011,
    doi: '10.1378/chest.10-3361',
    url: 'https://pubmed.ncbi.nlm.nih.gov/22045879/',
    reviewedScope: 'Topical anesthesia and sedation, as background to the 2013 and 2019 guidelines',
    accessedDate: '2026-10-08',
    transcript: null,
  },
  {
    id: 'U17',
    kind: 'expert consensus recommendations',
    title: 'Recommendations for diagnosis and treatment of methemoglobinemia',
    authors: 'Iolascon A, Bianchi P, Andolfo I, et al.',
    organization: null,
    year: 2021,
    doi: '10.1002/ajh.26340',
    url: 'https://onlinelibrary.wiley.com/doi/10.1002/ajh.26340',
    reviewedScope:
      'Pulse oximetry and co-oximetry in methemoglobinemia, the level at which to treat, methylene blue dose, repeat and cautions',
    accessedDate: '2026-10-08',
    transcript: null,
  },
  {
    id: 'U18',
    kind: 'manufacturer prescribing information',
    title: 'PROVAYBLUE (methylene blue) injection: prescribing information, revised February 2024',
    authors: null,
    organization: 'American Regent',
    year: 2024,
    doi: null,
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4f6848e5-35ed-4046-b13c-3032b5ba3232',
    reviewedScope:
      'Dose and repeat dose for acquired methemoglobinemia, G6PD contraindication, serotonergic boxed warning',
    accessedDate: '2026-10-08',
    transcript: null,
  },
  {
    id: 'U19',
    kind: 'manufacturer product specifications',
    title:
      'Olympus bronchoscope specifications: EVIS X1 BF-H1100 and BF-1TH1100; EVIS EXERA III BF-P190',
    authors: null,
    organization: 'Olympus',
    year: 2026,
    doi: null,
    url: 'https://medical.olympusamerica.com/products/bronchoscopes',
    reviewedScope:
      'Distal-end outer diameter and instrument-channel diameter, as recorded in the device catalog from the FDA device database, the product pages and the manufacturer flyer',
    accessedDate: '2026-10-08',
    transcript: null,
  },
  {
    id: 'U20',
    kind: 'manufacturer prescribing information',
    title: 'Flumazenil injection, USP: prescribing information',
    authors: null,
    organization: null,
    year: 2026,
    doi: null,
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=56452ba8-521d-1f84-e063-6294a90af6fc',
    reviewedScope: 'Reversal of conscious sedation in adults: dose, repeat dose and resedation',
    accessedDate: '2026-10-08',
    transcript: null,
  },
]

const SOURCE_USE_WORDING: Readonly<Record<string, string>> = {
  S2: 'Curriculum, procedural instruction, safety, learner evaluation, and supervised practice.',
  S3: 'Teaching methods, the four-box approach, procedural instruction, and evaluation of learners.',
  T01: 'Coordination, proximal tracheal landmarks, stable guidance, and review after placement; PEG technique remains outside the introductory course.',
  T08: 'Capability-based history; sequential preparation, simulation, learner evaluation, and apprenticeship.',
}

function kindLabel(source: ManifestSource, sourceClass: BronchSourceClass): string {
  if (sourceClass === 'transcript') return 'Lecture transcript'
  if (source.id === 'S1') return 'Textbook'
  if (source.id === 'S2') return 'Training manual'
  if (source.id === 'S3') return 'Faculty manual'
  if (/trial/i.test(source.kind) || source.id === 'U13') return 'Randomized trial'
  if (
    /manufacturer|product|official web documentation/i.test(source.kind) ||
    ['U8', 'U11', 'U12'].includes(source.id)
  )
    return 'Manufacturer documentation'
  if (/checklist/i.test(source.kind)) return 'Emergency checklist'
  return 'Guideline or official guidance'
}

export const SOURCES: readonly BronchSource[] = [...MANIFEST_SOURCES, ...SUPPLEMENTAL_SOURCES].map(
  (source) => {
    const id = source.id as BronchSourceId
    const sourceClass = bronchSourceClass(source)
    const transcript = manifestTranscript(source)
    return {
      id,
      sourceClass,
      kindLabel: kindLabel(source, sourceClass),
      title: source.title,
      byline:
        source.authors ??
        source.organization ??
        (transcript ? `${transcript.collection} lecture collection` : ''),
      year: source.year,
      url: source.doi ? `https://doi.org/${source.doi}` : source.url,
      usedFor:
        SOURCE_USE_WORDING[id] ??
        (transcript ? transcript.adoptedContribution : (source.reviewedScope ?? '')),
      limitation: transcript ? TRANSCRIPT_SENTENCE : (LIMITATIONS[source.id] ?? ''),
      manifest: source,
    }
  },
)

export const SOURCE_BY_ID: ReadonlyMap<string, BronchSource> = new Map(
  SOURCES.map((source) => [source.id, source] as const),
)

export function isBronchSourceId(value: unknown): value is BronchSourceId {
  return typeof value === 'string' && SOURCE_BY_ID.has(value)
}

const TIME = /^\d{2}:\d{2}:\d{2}$/

function seconds(value: string): number {
  const [h, m, s] = value.split(':').map(Number)
  return h * 3600 + m * 60 + s
}

/** What is wrong with a citation, for the registries' import-time validation. */
export function sourceRefErrors(where: string, ref: SourceRef): readonly string[] {
  const errors: string[] = []
  const source = SOURCE_BY_ID.get(ref.sourceId)
  if (!source) return [`${where} cites an unregistered source ${ref.sourceId}.`]
  const { location } = ref
  const isBook = /^S[123]$/.test(ref.sourceId)
  const isTranscript = /^T\d{2}$/.test(ref.sourceId)
  if (isBook && location.kind !== 'pdf-pages')
    errors.push(`${where} cites ${ref.sourceId} without PDF pages.`)
  if (isTranscript && location.kind !== 'time-span')
    errors.push(`${where} cites ${ref.sourceId} without a time span.`)
  if (!isBook && !isTranscript && location.kind !== 'section')
    errors.push(`${where} cites ${ref.sourceId} without the section it was checked for.`)
  if (location.kind === 'pdf-pages') {
    if (!Number.isInteger(location.from) || location.from < 1)
      errors.push(`${where} has an invalid page.`)
    if (location.to !== undefined && location.to < location.from)
      errors.push(`${where} has a reversed page range.`)
  }
  if (location.kind === 'time-span') {
    const duration = source.manifest.transcript?.durationSeconds ?? Infinity
    for (const value of [location.start, location.end].filter(
      (v): v is string => v !== undefined,
    )) {
      if (!TIME.test(value)) errors.push(`${where} has a time "${value}" not written hh:mm:ss.`)
      else if (seconds(value) > duration + 5)
        errors.push(`${where} cites ${value}, past the end of ${ref.sourceId}.`)
    }
    if (
      location.end &&
      TIME.test(location.start) &&
      TIME.test(location.end) &&
      seconds(location.end) < seconds(location.start)
    )
      errors.push(`${where} has a reversed time span.`)
  }
  if (location.kind === 'section' && location.label.trim().length === 0)
    errors.push(`${where} names no section.`)
  return errors
}

/**
 * What a PDF-page location is, said once wherever one is listed. The uploaded works are cited by
 * their PDF page, which is the only locator the registry holds. A printed book's page numbers can
 * differ from the file's (fellow walkthrough SUP-02), and nothing in the registry records them, so
 * they are not stated or inferred — no offset is applied.
 */
export const PDF_PAGE_LOCATOR_NOTE =
  'Pages are PDF page numbers in the uploaded file. They may not match the page numbers printed in the book, which are not listed here.'

/** "S1, PDF pages 61–70" · "T11, 00:23:09–00:25:15" · "U1, monitoring recommendations". */
export function formatSourceRef(ref: SourceRef): string {
  const { location } = ref
  switch (location.kind) {
    case 'pdf-pages':
      return location.to && location.to !== location.from
        ? `${ref.sourceId}, PDF pages ${location.from}–${location.to}`
        : `${ref.sourceId}, PDF page ${location.from}`
    case 'time-span':
      return `${ref.sourceId}, ${location.start}${location.end ? `–${location.end}` : ''}`
    case 'section':
      return `${ref.sourceId}, ${location.label}`
  }
}
