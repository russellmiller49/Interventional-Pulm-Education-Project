import { MANIFEST_SOURCES } from './generated/sources.generated'
import type { ManifestSource } from './manifestTypes'

/**
 * The course's source registry: the manifest's thirty-two sources, each with the one sentence a
 * learner reads about what it does not cover, and the location grammar every citation uses.
 *
 * Three classes of source, three kinds of location. The three uploaded works (S1–S3) are cited by
 * PDF page — in S1 the printed clinical page is the PDF page less sixteen. The targeted external
 * clarifications (U1–U13) are cited by the recommendation or section they were checked for. The
 * sixteen lecture transcripts (T01–T16) are cited by an approximate time span and are always shown
 * with the transcript sentence: narrated lecture content, not a reviewed demonstration.
 */
export type BronchSourceId =
  | 'S1'
  | 'S2'
  | 'S3'
  | `U${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13}`
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

export interface BronchSource {
  readonly id: BronchSourceId
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
}

const SOURCE_USE_WORDING: Readonly<Record<string, string>> = {
  S2: 'Curriculum, procedural instruction, safety, learner evaluation, and supervised practice.',
  S3: 'Teaching methods, the four-box approach, procedural instruction, and evaluation of learners.',
  T01: 'Coordination, proximal tracheal landmarks, stable guidance, and review after placement; PEG technique remains outside the introductory course.',
  T08: 'Capability-based history; sequential preparation, simulation, learner evaluation, and apprenticeship.',
}

function kindLabel(source: ManifestSource): string {
  if (source.transcript) return 'Lecture transcript'
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

export const SOURCES: readonly BronchSource[] = MANIFEST_SOURCES.map((source) => {
  const id = source.id as BronchSourceId
  const transcript = source.transcript
  return {
    id,
    kindLabel: kindLabel(source),
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
})

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

/** "S1, PDF 61–70" · "T11, 00:23:09–00:25:15" · "U1, monitoring recommendations". */
export function formatSourceRef(ref: SourceRef): string {
  const { location } = ref
  switch (location.kind) {
    case 'pdf-pages':
      return `${ref.sourceId}, PDF ${location.from}${location.to && location.to !== location.from ? `–${location.to}` : ''}`
    case 'time-span':
      return `${ref.sourceId}, ${location.start}${location.end ? `–${location.end}` : ''}`
    case 'section':
      return `${ref.sourceId}, ${location.label}`
  }
}
