import { ICU_HEMODYNAMICS_CONTENT_VERSION } from './release'
import { hemodynamicsSources, type HemodynamicsSource } from './sources'

/**
 * What kind of document each hemodynamics source is, what is actually known about who issued it and
 * when, and which document checks have been made (HD-03, 2026-09-15).
 *
 * Kept beside the registry rather than in it, so record ids, citations and every claim map stay
 * stable. A document check means someone read the file for its identity or at a locator. It is not
 * clinical review: no review of how this module uses any source is recorded, and the learner copy
 * says so. Unknown authorship and dates stay stated as unknown; a checker who was not written down
 * stays `null` rather than being inferred.
 */

export type HemodynamicsSourceClass = HemodynamicsSource['sourceType']

export const HEMODYNAMICS_SOURCE_CLASS_LABELS: Readonly<Record<HemodynamicsSourceClass, string>> = {
  guideline: 'Clinical guideline',
  review: 'Review article',
  'original-research': 'Primary study',
  'textbook-chapter': 'Textbook chapter',
  'manufacturer-labeling': 'Manufacturer instructions for use',
  'online-commentary': 'Online commentary, single author',
  'supplied-synthesis': 'Supplied synthesis, author not stated',
  'workflow-manual': 'Device manual, monitor workflow',
  'educational-model': 'Teaching model for this simulation',
}

export interface HemodynamicsSourceCheck {
  /** ISO date the document was read. */
  readonly on: string
  /** Who read it; `null` when that was not recorded at the time. */
  readonly by: string | null
  /** What was read, and where in the document. */
  readonly what: string
  /** The repository file that holds the fuller record of the check. */
  readonly recordedIn: string
}

export interface HemodynamicsSourceReviewMetadata {
  /** Who wrote or issued the document, as far as the document or its registered citation shows. */
  readonly identity: string
  /** The date phrase. Begins "Not stated" when the document establishes no date. */
  readonly published: string
  /** Where that date comes from, or why there is none. */
  readonly publishedBasis: string
  /** Edition, document number, release or capture, where the document has one. */
  readonly revision: string | null
  /** What the registry's `version` string encodes on this record. Never shown as a document version. */
  readonly registryVersionMeaning: string
  readonly checks: readonly HemodynamicsSourceCheck[]
}

export const HEMODYNAMICS_CLINICAL_REVIEW_LINE =
  'Clinical review of how this module uses it: none recorded yet.'

const ASSISTANT = 'AI authoring assistant (Claude)'
const HD03_QUEUE = 'docs/gap-remediation/self-paced/HD-03-claim-review-queue.json'
const H5_BOUNDARIES = 'src/features/icu-hemodynamics/content/derivedSourceBoundaries.ts'
const REGISTRY_REVISION =
  'An internal revision of this registry record, not a version of the document.'
const REGISTERED_ONLY =
  'year in the registered citation; the document was not available locally to check'

const metadata: Readonly<Record<string, HemodynamicsSourceReviewMetadata>> = {
  'esc-ers-ph-2022': {
    identity:
      'Humbert M, et al., for the European Society of Cardiology and the European Respiratory Society, as registered. The registered link opens the ESC “Essential messages” summary, not the full guideline.',
    published: '2022',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'esicm-shock-2025': {
    identity: 'Cecconi M, et al., European Society of Intensive Care Medicine, as registered.',
    published: '2025',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'ssc-sepsis-2026': {
    identity:
      'Prescott HC, Antonelli M, Alhazzani W, et al., Surviving Sepsis Campaign, as registered.',
    published: '2026',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: 'A date (2026-03-23) whose meaning was not recorded.',
    checks: [],
  },
  'pac-waveforms-part-1-2021': {
    identity: 'Bootsma IT, et al., as printed on the article.',
    published: 'journal issue 2022 (volume 36, pages 5–15); online 10 February 2021',
    publishedBasis: 'printed on the article’s first page',
    revision: null,
    registryVersionMeaning: `${REGISTRY_REVISION} The record id carries the online year.`,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Citation and online date read on page 5. Zeroing and leveling (§2.1–2.2, p. 7), wedge position and deflation (§2.3.4, p. 8), catheter position and respiratory timing (§2.4, p. 10), and damping and overwedging (§2.5, pp. 11–12) read against the HD-03 claims.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'pac-derived-part-2-2021': {
    identity: 'Bootsma IT, et al., as printed on the article.',
    published: 'journal issue 2022 (volume 36, pages 17–31); online 1 March 2021',
    publishedBasis: 'printed on the article’s first page',
    revision: null,
    registryVersionMeaning: `${REGISTRY_REVISION} The record id carries the online year.`,
    checks: [
      {
        on: '2026-08-10',
        by: null,
        what: 'Formulas, resistance units and adult reference figures (Table 1, p. 18), Fick and thermodilution (§3.1, p. 19), thermodilution limits (§4.2–4.3) and the pulmonary hypertension definition (§7.6, pp. 25–26) read at locators during the H5 rebuild.',
        recordedIn: H5_BOUNDARIES,
      },
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Citation and online date read on page 17. Cardiac-index figures of 2.2 and 1.8 L/min/m² and a PVR boundary in Wood units were looked for throughout; the article states neither.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'pac-review-2014': {
    identity: 'Whitener S, Konoske R, Mark JB.',
    published: '2014 (volume 28, pages 323–335)',
    publishedBasis:
      'printed on the article’s first page; the issue number comes from the registered citation',
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Citation read on page 323. Balloon inflation and complications (pp. 325–328) and end-expiratory reading, wave timing and the a wave (pp. 329–330) read against the HD-03 claims.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'cvp-measurement-2017': {
    identity: 'Roger C, Muller L, Riou B, et al., as registered.',
    published: '2017',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'papi-rvmi-2012': {
    identity: 'Korabathina R, Heffernan KS, Paruchuri V, et al., as registered.',
    published: '2012',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'papi-lvad-rvf-2016': {
    identity: 'Morine KJ, Kiernan MS, Pham DT, et al., as registered.',
    published: '2016',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'cpo-acute-cardiac-2007': {
    identity: 'Mendoza DD, Cooper HA, Panza JA, as registered.',
    published: '2007',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'ppv-sepsis-2000': {
    identity: 'Michard F, Boussat S, Chemla D, et al., as registered.',
    published: '2000',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'pa-compliance-outcomes-2026': {
    identity: 'Mounsey LA, Nemeth SM, Kosyakovsky LB, et al., as registered.',
    published: '2026',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'emcrit-rhc-supplied-2026': {
    identity:
      'Josh Farkas, Internet Book of Critical Care (EMCrit Project). The site says it presents its authors’ opinions.',
    published: 'byline dated 26 August 2024',
    publishedBasis: 'shown beside the author on the captured page, which shows no update history',
    revision: 'Browser PDF capture made 23 July 2026, 41 pages',
    registryVersionMeaning: 'The date the supplied capture was made, not a version of the chapter.',
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Author, byline date, capture date and site statement read on pages 1 and 41. Normal values (p. 3), zeroing (p. 10), damping (pp. 16–17) and wedge measurement and safety (pp. 23–27) read against the HD-03 claims.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'clinical-hemodynamics-waveforms': {
    identity:
      'Ragosta M, Kennedy JLW; chapter 2 of Textbook of Clinical Hemodynamics, edited by Ragosta M (Elsevier).',
    published: '2025',
    publishedBasis:
      'edition year in the registered citation; the supplied chapter file carries only a July 2026 download stamp',
    revision: 'Third edition, chapter 2, pages 15–49',
    registryVersionMeaning: 'Edition, chapter and year.',
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Authors read on the chapter’s first page. Zeroing and damping (pp. 15–16), end-expiratory reading (p. 21), the wedge waveform, West zones and oximetry confirmation (pp. 24–26) and artifacts (pp. 33–35) read against the HD-03 claims.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'arterial-pressure-five-step-2020': {
    identity: 'Saugel B, et al., as registered.',
    published: '2020',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    registryVersionMeaning: REGISTRY_REVISION,
    checks: [],
  },
  'edwards-swan-ganz-ifu-2023': {
    identity: 'Edwards Lifesciences, as registered.',
    published: '2023',
    publishedBasis: REGISTERED_ONLY,
    revision: 'Document DOC-0222632A, as registered',
    registryVersionMeaning: 'The manufacturer’s document number.',
    checks: [],
  },
  'master-hemodynamics-reference': {
    identity:
      'Not stated. The document names no author or publisher, and its file properties list “OpenAI” as the creator.',
    published: 'Not stated',
    publishedBasis:
      'no date appears in the document; its file-property dates (23 December 2013) do not show when it was written, and it was supplied in July 2026',
    revision: null,
    registryVersionMeaning: 'The month the file was supplied.',
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Document text and file properties read: no author, publisher, date or reference list. Its pulmonary hypertension classification uses a PVR boundary of 3 WU.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'monitor-workflow-supplied': {
    identity: 'Philips Medizin Systeme Boeblingen GmbH (Koninklijke Philips N.V.).',
    published: 'instructions for use July 2019; configuration guide October 2010',
    publishedBasis: 'printed in each document',
    revision:
      'Instructions for use: release N, part number 453564861711, addendum 453564885151. Configuration guide: release H.0, part number 4535 642 29201, settings only.',
    registryVersionMeaning: 'An internal label for the workflow-only use of these files.',
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Titles, part numbers and dates read (instructions for use pp. 1 and 560–561; configuration guide p. 2). Zeroing and wedge pressure (instructions pp. 245–258) and cardiac-output trials (pp. 259–273) located; the configuration guide lists settings, not procedures.',
        recordedIn: HD03_QUEUE,
      },
    ],
  },
  'icu-hemodynamics-model-v1': {
    identity: 'This module’s own deterministic teaching model.',
    published: `Part of this module, content version ${ICU_HEMODYNAMICS_CONTENT_VERSION}`,
    publishedBasis: 'not an external publication',
    revision: null,
    registryVersionMeaning: 'This module’s content version.',
    checks: [],
  },
}

export function hemodynamicsSourceClassLabel(
  source: Pick<HemodynamicsSource, 'sourceType'>,
): string {
  return HEMODYNAMICS_SOURCE_CLASS_LABELS[source.sourceType]
}

export function hemodynamicsSourceReviewMetadata(
  sourceId: string,
): HemodynamicsSourceReviewMetadata {
  const record = metadata[sourceId]
  if (!record) throw new Error(`Hemodynamics source ${sourceId} has no review metadata.`)
  return record
}

/** One line a learner reads for when the document dates from, and on what basis. */
export function hemodynamicsSourceDateLine(source: HemodynamicsSource): string {
  const record = hemodynamicsSourceReviewMetadata(source.id)
  if (record.published.startsWith('Not stated'))
    return `Date: not stated (${record.publishedBasis})`
  if (source.sourceType === 'educational-model')
    return `${record.published} (${record.publishedBasis})`
  return `Published: ${record.published} (${record.publishedBasis})`
}

export function hemodynamicsSourceCheckLine(check: HemodynamicsSourceCheck): string {
  return `Checked ${check.on} by ${check.by ?? 'a checker who was not recorded'}: ${check.what}`
}

/** Class, citation and date in one sentence, for surfaces that show a source on a single line. */
export function hemodynamicsSourceSummary(source: HemodynamicsSource): string {
  return `${hemodynamicsSourceClassLabel(source)}. ${source.citation} ${hemodynamicsSourceDateLine(source)}.`
}

const SUPPLIED_OR_ONLINE: ReadonlySet<HemodynamicsSourceClass> = new Set([
  'online-commentary',
  'supplied-synthesis',
  'workflow-manual',
])

export function validateHemodynamicsSourceReviewMetadata(): void {
  const registered = new Set(hemodynamicsSources.map((source) => source.id))
  for (const id of Object.keys(metadata)) {
    if (!registered.has(id)) throw new Error(`Review metadata names an unregistered source: ${id}`)
  }
  for (const source of hemodynamicsSources) {
    const record = hemodynamicsSourceReviewMetadata(source.id)
    if (record.publishedBasis.trim().length < 10) {
      throw new Error(`${source.id} does not say where its date comes from.`)
    }
    if (source.year === null) {
      if (!record.published.startsWith('Not stated')) {
        throw new Error(`${source.id} has no year, so its date must be stated as not stated.`)
      }
    } else if (
      source.sourceType !== 'educational-model' &&
      !record.published.includes(String(source.year))
    ) {
      throw new Error(`${source.id}: registry year ${source.year} is not in its date line.`)
    }
    for (const check of record.checks) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(check.on)) {
        throw new Error(`${source.id} has a document check without an ISO date.`)
      }
      if (check.by !== null && check.by.trim().length === 0) {
        throw new Error(`${source.id} has a document check with a blank checker.`)
      }
      if (/approv|clinically reviewed|signed off/i.test(check.what)) {
        throw new Error(`${source.id}: a document check must not be worded as clinical approval.`)
      }
    }
    if (SUPPLIED_OR_ONLINE.has(source.sourceType) && record.checks.length === 0) {
      throw new Error(`${source.id}: a supplied or online source needs a recorded identity check.`)
    }
  }
}

validateHemodynamicsSourceReviewMetadata()
