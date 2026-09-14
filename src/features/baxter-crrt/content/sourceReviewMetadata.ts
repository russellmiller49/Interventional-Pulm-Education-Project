/**
 * Source type, dates and document checks for the first G01 source-review batch.
 *
 * The CRRT registries keep a publication year, a document revision and the day someone read a
 * source inside one free-text version string. For the records in this batch they are kept apart
 * here, so a learner can tell when a source was published, which revision the module was built
 * from, and when — and how narrowly — someone compared the module with the document.
 *
 * A check is a comparison with the document, never a clinical or device review. No reviewer has
 * decided on these claims; the queue is `docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json`.
 * A value no record states stays null rather than being inferred from an id or a filename.
 *
 * Like `learnerSourceMap.ts`, this module imports nothing, so the CRRT harnesses that run under
 * plain `npx tsx` can still load it.
 */

export type CrrtSourceRole =
  | 'manufacturer-operator-manual'
  | 'clinical-guideline'
  | 'expert-opinion'

export const CRRT_SOURCE_ROLE_WORDS: Readonly<Record<CrrtSourceRole, string>> = {
  'manufacturer-operator-manual': 'Manufacturer operator’s manual',
  'clinical-guideline': 'Clinical practice guideline',
  'expert-opinion': 'Expert opinion, not a guideline recommendation or a trial',
}

export interface CrrtSourceCheck {
  /** ISO date the comparison was made. */
  readonly on: string
  /** Who made it, as recorded; null when no record names anyone. */
  readonly by: string | null
  /** What was compared with the document, and nothing more. */
  readonly scope: string
  /** Where the check is recorded. */
  readonly recordedIn: string
}

export interface CrrtSourceDating {
  readonly role: CrrtSourceRole
  /** As printed or cited; null when no record states it. */
  readonly published: string | null
  readonly publishedBasis: string
  /** Document revision or software version; null when none is recorded. */
  readonly revision: string | null
  readonly checks: readonly CrrtSourceCheck[]
  readonly limitation: string
}

export const CRRT_AUTHORING_ASSISTANT = 'an AI authoring assistant (Claude, G01 source batch)'

const aw8035 = {
  role: 'manufacturer-operator-manual',
  published: 'June 2019',
  publishedBasis: 'Printed in every page footer as “AW8035 Rev B JUN2019”.',
  revision: 'AW8035 Rev B · program version 2.XX',
  limitation:
    'Describes PrisMax program version 2.XX. Later software and manuals were not checked, so this does not show what a current console displays.',
} as const

const aw8035IdentityCheck: CrrtSourceCheck = {
  on: '2026-07-27',
  by: null,
  scope:
    'The supplied file matched the registered copy (SHA-256), and its revision was read from the page footer.',
  recordedIn: 'docs/critical-care/source-manifest.json · PRISMAX-AW8035-RB',
}

function citrateReadCheck(): CrrtSourceCheck {
  return {
    on: '2026-09-13',
    by: null,
    scope:
      'The cited passages were read while the citrate comparison was written. The reader is not recorded.',
    recordedIn: 'src/features/baxter-crrt/content/citrateSources.ts · commit f545f03e',
  }
}

const siaarti = {
  role: 'expert-opinion',
  published: '2023',
  publishedBasis: 'Journal citation: J Anesth Analg Crit Care. 2023;3:7.',
  revision: null,
  checks: [citrateReadCheck()],
  limitation:
    'Classed as expert opinion from its own title (joint-commission expert opinion). It was not re-read for this batch.',
} as const satisfies CrrtSourceDating

const schneider = {
  role: 'expert-opinion',
  published: '2017',
  publishedBasis: 'Journal citation: Critical Care. 2017;21:281.',
  revision: null,
  checks: [citrateReadCheck()],
  limitation:
    'Classed as expert opinion from the article type recorded when it was added (expert viewpoint). It was not re-read for this batch.',
} as const satisfies CrrtSourceDating

export const CRRT_SOURCE_DATING: ReadonlyMap<string, CrrtSourceDating> = new Map<
  string,
  CrrtSourceDating
>([
  [
    'MATH-PM-002',
    {
      ...aw8035,
      checks: [
        aw8035IdentityCheck,
        {
          on: '2026-09-14',
          by: CRRT_AUTHORING_ASSISTANT,
          scope:
            'The local file matched the registered copy (SHA-256), and PDF page 218 prints TMP = [(Pfil + Pret) / 2] − Peff − 18 mmHg, as the module uses. Source location only.',
          recordedIn:
            'docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json · G01-CRRT-01',
        },
      ],
    },
  ],
  [
    'DEV-PM-010',
    {
      ...aw8035,
      checks: [
        aw8035IdentityCheck,
        {
          on: '2026-09-14',
          by: CRRT_AUTHORING_ASSISTANT,
          scope:
            'The local file matched the registered copy (SHA-256). PDF page 203 prints ∆Pfil = Pfil − Pret and says the filter and return readings are corrected for a −25 mmHg sensor-height bias. It prints no −25 mmHg term in the drop itself; the simulation applies one there, which awaits device review.',
          recordedIn:
            'docs/gap-remediation/self-paced/G01-crrt-source-review-queue.json · G01-CRRT-02',
        },
      ],
    },
  ],
  ['CITRATE-SIAARTI-2023-MECHANISM', siaarti],
  ['CITRATE-SIAARTI-2023-SAMPLING', siaarti],
  ['CITRATE-SCHNEIDER-2017-METABOLISM', schneider],
  ['CITRATE-SCHNEIDER-2017-PATTERNS', schneider],
  [
    'CITRATE-ICU-GUIDE-2026-SAFETY',
    {
      role: 'clinical-guideline',
      published: '2026',
      publishedBasis: 'Journal citation: Critical Care. 2026;30:46.',
      revision: null,
      checks: [citrateReadCheck()],
      limitation:
        'Recommendation strength and certainty are not recorded in the module and were not checked for this batch.',
    },
  ],
])

export function crrtSourceDating(sourceId: string): CrrtSourceDating | undefined {
  return CRRT_SOURCE_DATING.get(sourceId)
}
