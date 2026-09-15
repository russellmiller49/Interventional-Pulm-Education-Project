import { cardiohelpEvidence } from './evidence'

/**
 * What is actually known about when each ECMO source was issued, which revision it is, and which
 * document checks have been made (ECMO-03, 2026-09-15).
 *
 * Kept beside the registry rather than in it, so record ids, claims and the shared critical-care
 * projection stay stable. A document check means someone opened the file for its identity or at a
 * locator. It is not clinical or device review of how this module uses the source, and no such
 * review is recorded anywhere in this repository, so the learner copy says so. A date that a
 * document does not print stays "Not stated"; a checker who was not written down stays `null`.
 */

export interface EcmoSourceCheck {
  /** ISO date the document was opened. */
  readonly on: string
  /** Who opened it; `null` when that was not recorded at the time. */
  readonly by: string | null
  /** What was read, and where in the document. */
  readonly what: string
  /** The repository file that holds the fuller record of the check. */
  readonly recordedIn: string
}

export interface EcmoSourceReviewMetadata {
  /** Who issued or wrote the document, as far as the document or its registered citation shows. */
  readonly identity: string
  /** The learner-facing date phrase. Begins "Not stated" when the document establishes no date. */
  readonly published: string
  /** Where that date comes from, or why there is none. */
  readonly publishedBasis: string
  /** Revision, edition or software applicability, where the document has one. */
  readonly revision: string | null
  readonly checks: readonly EcmoSourceCheck[]
}

/** Shown beside every source. Deliberately not derived from the module's publication flag. */
export const ECMO_SOURCE_REVIEW_LINE =
  'Clinical and device review of how this module uses it: none recorded yet.'

/** The module-level statement on the hub. No attributable clinical or device review exists. */
export const ECMO_MODULE_REVIEW_LINE = 'Clinical and device review: none recorded'

const ASSISTANT = 'AI authoring assistant (Claude)'
const ECMO03_QUEUE = 'docs/gap-remediation/self-paced/ECMO-03-claim-review-queue.json'
const REGISTERED_ONLY =
  'year in the registered citation; the document was not available locally to check'

const IFU_IDENTITY =
  'Maquet Cardiopulmonary GmbH, as printed in the supplied U.S. English CARDIOHELP System instructions for use (contact addresses at getinge.com). The registered link opens the product web page, not this document.'
const IFU_PUBLISHED = 'Issue date 2025-01'
const IFU_PUBLISHED_BASIS = 'printed on page 2 of the supplied document'
const IFU_REVISION = 'Revision 2.3, for CARDIOHELP-i software release 03.04.10.00 or higher'

const ECMO_BOOK_IDENTITY =
  'A chapter of The ECMO Book, supplied as an Elsevier ClinicalKey chapter file. The file prints no editor, edition, ISBN or publication year.'
const ECMO_BOOK_PUBLISHED = 'Not stated in the supplied chapter file'
const ECMO_BOOK_PUBLISHED_BASIS =
  'no publication year is printed; the creation date in the file metadata is not a publication date'

function bookCheck(pages: string): EcmoSourceCheck {
  return {
    on: '2026-09-15',
    by: ASSISTANT,
    what: `Supplied chapter file: ${pages} Whether each supported statement is on those pages was not re-read.`,
    recordedIn: ECMO03_QUEUE,
  }
}

const metadata: Readonly<Record<string, EcmoSourceReviewMetadata>> = {
  'ifu-us-2025-scope': {
    identity: IFU_IDENTITY,
    published: IFU_PUBLISHED,
    publishedBasis: IFU_PUBLISHED_BASIS,
    revision: IFU_REVISION,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Supplied PDF, 212 pages: revision and issue date on page 2; indications for use on page 13; the Cardiopulmonary Support thApp restriction on pages 29 and 90. Printed page numbers match PDF page numbers. Whether a later revision exists was not checked.',
        recordedIn: ECMO03_QUEUE,
      },
    ],
  },
  'ifu-console-workflow': {
    identity: IFU_IDENTITY,
    published: IFU_PUBLISHED,
    publishedBasis: IFU_PUBLISHED_BASIS,
    revision: IFU_REVISION,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'The same supplied PDF: the registered page ranges fall inside the document. The paraphrased console behavior was not compared with those pages one by one.',
        recordedIn: ECMO03_QUEUE,
      },
    ],
  },
  'ifu-anomaly-boundary': {
    identity: IFU_IDENTITY,
    published: IFU_PUBLISHED,
    publishedBasis: IFU_PUBLISHED_BASIS,
    revision: IFU_REVISION,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'The same supplied PDF at pages 20 and 199 (bubble size for an intervention), and at pages 136 and 165 (pressure-drop alarm priority; page 165 lies in the medium-priority message list that begins on page 163, and the message appears nowhere else in pages 150–212).',
        recordedIn: ECMO03_QUEUE,
      },
    ],
  },
  'ecmo-book-ch9': {
    identity: ECMO_BOOK_IDENTITY,
    published: ECMO_BOOK_PUBLISHED,
    publishedBasis: ECMO_BOOK_PUBLISHED_BASIS,
    revision: null,
    checks: [
      bookCheck('11 pages beginning at printed page 92; the registered range 92–101 is inside it.'),
    ],
  },
  'ecmo-book-ch16': {
    identity: ECMO_BOOK_IDENTITY,
    published: ECMO_BOOK_PUBLISHED,
    publishedBasis: ECMO_BOOK_PUBLISHED_BASIS,
    revision: null,
    checks: [bookCheck('3 pages, printed pages 170–172, matching the registered range.')],
  },
  'ecmo-book-ch17': {
    identity: ECMO_BOOK_IDENTITY,
    published: ECMO_BOOK_PUBLISHED,
    publishedBasis: ECMO_BOOK_PUBLISHED_BASIS,
    revision: null,
    checks: [
      bookCheck(
        '9 pages beginning at printed page 173; the registered range 173–180 is inside it.',
      ),
    ],
  },
  'ecmo-book-ch18': {
    identity: ECMO_BOOK_IDENTITY,
    published: ECMO_BOOK_PUBLISHED,
    publishedBasis: ECMO_BOOK_PUBLISHED_BASIS,
    revision: null,
    checks: [bookCheck('9 pages, printed pages 182–189, matching the registered range.')],
  },
  'elso-adult-vv-2021': {
    identity: 'Tonna JE, et al., as registered.',
    published: '2021',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    checks: [],
  },
  'elso-adult-va-2021': {
    identity: 'Lorusso R, et al., as registered.',
    published: '2021',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    checks: [],
  },
  'elso-dual-circulation-2024': {
    identity:
      'Badulak J, Abrams D, Luks AM, et al., as registered, with a registered published correction. The endorsement named in the title was not checked.',
    published: '2024',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    checks: [],
  },
  'elso-maastricht-nomenclature-2019': {
    identity: 'Broman LM, Taccone FS, Lorusso R, et al., as registered.',
    published: '2019',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    checks: [],
  },
  'elso-neuro-monitoring-2024': {
    identity: 'Cho S-M, et al., as registered.',
    published: '2024',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    checks: [],
  },
  'elso-circuit-2022': {
    identity: 'Gajkowski EF, et al., as registered.',
    published: '2022',
    publishedBasis: REGISTERED_ONLY,
    revision: null,
    checks: [],
  },
  'attached-ecmo-case-curriculum': {
    identity:
      'An unpublished Word document supplied by the course author; its document properties name the course author as creator.',
    published: 'Not published',
    publishedBasis:
      'an unpublished draft; its document properties record creation and last change on 2026-07-16',
    revision: null,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Document properties only: 45 pages, 11,499 words, created and last changed 2026-07-16. The cases were not read or counted. No review record is attached to the curriculum.',
        recordedIn: ECMO03_QUEUE,
      },
    ],
  },
  'bounded-educational-model': {
    identity: 'Authored for this module: the simulation model in this repository.',
    published: 'Not applicable: an authored simulation, not a publication',
    publishedBasis: 'the model changes with the repository, and its behavior is pinned by tests',
    revision: null,
    checks: [
      {
        on: '2026-09-15',
        by: ASSISTANT,
        what: 'Model runs across pump speed, sweep and sweep-gas oxygen fraction on the VV and VA reference circuits and the VV recirculation and acute hypercapnia drills.',
        recordedIn: ECMO03_QUEUE,
      },
    ],
  },
}

export function ecmoSourceReviewMetadata(id: string): EcmoSourceReviewMetadata | undefined {
  return Object.hasOwn(metadata, id) ? metadata[id] : undefined
}

/** Import-time checks: one record per registered source, and dated checks in ISO form. */
export function validateEcmoSourceReviewMetadata(): string[] {
  const errors: string[] = []
  const registered = new Set(cardiohelpEvidence.map((reference) => reference.id))
  for (const id of registered) {
    if (!Object.hasOwn(metadata, id)) errors.push(`${id}: no source dating record`)
  }
  for (const [id, entry] of Object.entries(metadata)) {
    if (!registered.has(id)) errors.push(`${id}: dating record for an unregistered source`)
    if (!entry.identity.trim() || !entry.published.trim() || !entry.publishedBasis.trim()) {
      errors.push(`${id}: identity, date and date basis are all required`)
    }
    for (const check of entry.checks) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(check.on)) errors.push(`${id}: check date must be ISO`)
      if (!check.what.trim() || !check.recordedIn.trim()) {
        errors.push(`${id}: a check says what was read and where it is recorded`)
      }
    }
  }
  return errors
}

const metadataErrors = validateEcmoSourceReviewMetadata()
if (metadataErrors.length > 0) {
  throw new Error(`ECMO source dating records invalid:\n${metadataErrors.join('\n')}`)
}
