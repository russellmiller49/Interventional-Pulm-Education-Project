import {
  defineTeachingNumbers,
  teachingNumberErrors,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'
import { SOURCES } from '../data/sources'

/**
 * Every clinical number the Peripheral Imaging module teaches that was withheld before the
 * teaching-first redo, with its source.
 *
 * Each row was checked on 2026-10-08; `checkedBy` says how much of the source was read, because
 * three of the studies were read as abstracts only. The ICRP dose limits come from Publications 103
 * and 118, which are not in `data/sources.ts` (its `icrp` record is Publication 139, which was not
 * read), so they are listed in `PI_NUMBER_ONLY_SOURCES`, with the radial EBUS yield series.
 *
 * AAPM MPPG 12.a prints no kerma–area-product action level. Do not add one under its name.
 *
 * None is signed: `npm run numbers:signoff -- peripheral-imaging`.
 */
const CHECKED = { checkedOn: '2026-10-08', signedBy: null, signedOn: null } as const

const FULL_TEXT = 'Claude, against the full text on PubMed Central'
const ABSTRACT_ONLY = 'Claude, against the PubMed abstract only; the full text was not read'
const ICRPAEDIA =
  'Claude, against the ICRPaedia "Dose limits" page, which reproduces the limits of Publications 103 and 118; the publications themselves were not read'

/** Sources cited by a number and not in `data/sources.ts`. */
export const PI_NUMBER_ONLY_SOURCES = [
  {
    id: 'icrp103',
    shortName: 'ICRP Publication 103',
    title:
      'International Commission on Radiological Protection. The 2007 Recommendations of the International Commission on Radiological Protection. ICRP Publication 103. Ann ICRP. 37(2–4).',
  },
  {
    id: 'icrp118',
    shortName: 'ICRP Publication 118',
    title:
      'International Commission on Radiological Protection. ICRP Statement on Tissue Reactions / Early and Late Effects of Radiation in Normal Tissues and Organs. ICRP Publication 118. Ann ICRP. 41(1–2).',
  },
  {
    id: 'chen2014',
    shortName: 'Chen, Ann Am Thorac Soc',
    title:
      'Chen A, Chenna P, Loiselle A, Massoni J, Mayse M, Misselhorn D. Radial probe endobronchial ultrasound for peripheral pulmonary lesions. A 5-year institutional experience. Ann Am Thorac Soc. 2014;11(4):578–582. doi:10.1513/AnnalsATS.201311-384OC',
  },
] as const

const cite = (
  sourceId: string,
  year: number,
  locator: string,
  grade: string | null = null,
): TeachingNumberCitation => ({ sourceId, year, grade, locator })

export const PI_NUMBERS = defineTeachingNumbers('peripheral-imaging', {
  'aapm-first-notification': {
    label: 'Dose notifications during a procedure',
    value: 'first at 3 Gy Kₐ,r, then every 1 Gy',
    appliesTo: 'Cumulative reference air kerma, announced to the operator during the procedure',
    class: 'guideline',
    sources: [cite('aapm12', 2022, '§5.3')],
    note: 'A notification prompts a decision about the rest of the procedure. It is not a limit.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'aapm-substantial-dose': {
    label: 'Substantial radiation dose level',
    value: '5 Gy Kₐ,r or 3 Gy peak skin dose',
    appliesTo: 'The suggested level that triggers follow-up for possible skin injury',
    class: 'guideline',
    sources: [cite('aapm12', 2022, '§5.4')],
    note: 'The guideline gives no kerma–area-product level.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'icrp-effective-limit': {
    label: 'Occupational effective dose limit',
    value: '20 mSv per year averaged over 5 years, with no single year above 50 mSv',
    class: 'guideline',
    sources: [cite('icrp103', 2007, 'Table 6, as reproduced on the ICRPaedia “Dose limits” page')],
    checkedBy: ICRPAEDIA,
    ...CHECKED,
  },
  'icrp-lens-limit': {
    label: 'Occupational limit for the lens of the eye',
    value: '20 mSv per year averaged over 5 years, with no single year above 50 mSv',
    class: 'guideline',
    sources: [
      cite(
        'icrp118',
        2012,
        'Statement on Tissue Reactions, as quoted on the ICRPaedia “Dose limits” page',
      ),
    ],
    checkedBy: ICRPAEDIA,
    ...CHECKED,
  },
  'icrp-skin-extremity-limit': {
    label: 'Occupational limit for the skin, hands and feet',
    value: '500 mSv per year',
    class: 'guideline',
    sources: [cite('icrp103', 2007, 'Table 6, as reproduced on the ICRPaedia “Dose limits” page')],
    note: 'The skin limit is averaged over 1 cm² of the most exposed skin.',
    checkedBy: ICRPAEDIA,
    ...CHECKED,
  },
  'mobile-cbct-total-dap': {
    label: 'Total dose–area product, mobile CBCT bronchoscopy',
    value: '41.92 Gy·cm² (mean)',
    appliesTo: 'A retrospective single-centre series; range 9.10 to 113.08 Gy·cm²',
    class: 'expert-reference',
    sources: [cite('mobile', 2023, 'Table 4')],
    note: 'Standard deviation 26.19 Gy·cm². Median fluoroscopy time 11.2 minutes; a median of one spin (range 1 to 5).',
    checkedBy: `${FULL_TEXT}; the abstract prints 11.35 as the standard deviation of the total, which Table 4 gives as the mean from the spins`,
    ...CHECKED,
  },
  'mobile-cbct-spin-dap': {
    label: 'Dose–area product from the CBCT spins in the same series',
    value: '11.35 Gy·cm² (mean), about a third of the total',
    class: 'expert-reference',
    sources: [cite('mobile', 2023, 'Table 4 and Discussion')],
    note: 'Fluoroscopy contributed about two thirds.',
    checkedBy: FULL_TEXT,
    ...CHECKED,
  },
  'confirm-dap': {
    label: 'Dose–area product, robotic bronchoscopy with mobile CBCT',
    value: '25.7 Gy·cm² (median; interquartile range 11.0 to 46.7)',
    appliesTo: 'The prospective multicentre CONFIRM study',
    class: 'expert-reference',
    sources: [cite('confirm', 2026, 'Abstract, Results')],
    note: 'A median of two spins per procedure (interquartile range 1 to 3).',
    checkedBy: ABSTRACT_ONLY,
    ...CHECKED,
  },
  'verhoeven-fluoroscopy-dap': {
    label: 'Fluoroscopy dose–area product over a learning curve',
    value: 'from 19.0 to 2.2 Gy·cm² per procedure',
    appliesTo:
      'Average of the first and of the last period in a 100-procedure series of CBCT-guided navigation bronchoscopy on one vendor’s fixed system',
    class: 'expert-reference',
    sources: [cite('verhoeven', 2021, 'Results, text')],
    note: 'Low-dose fluoroscopy protocols and operator experience changed together.',
    checkedBy: `${FULL_TEXT}; Table 2 is an image and was not read`,
    ...CHECKED,
  },
  'verhoeven-total-dap': {
    label: 'Total procedural dose–area product over the same learning curve',
    value: 'from 47.5 to 25.4 Gy·cm² per procedure',
    appliesTo: 'Fluoroscopy and CBCT together, first period against last',
    class: 'expert-reference',
    sources: [cite('verhoeven', 2021, 'Results, text')],
    checkedBy: `${FULL_TEXT}; Table 2 is an image and was not read`,
    ...CHECKED,
  },
  'rebus-yield-by-position': {
    label: 'Diagnostic yield by radial EBUS probe position',
    value: '84% with the probe within the lesion and 48% with the probe adjacent to it',
    appliesTo:
      'A retrospective single-centre series of 467 peripheral lesions sampled with radial EBUS guidance',
    class: 'expert-reference',
    sources: [cite('chen2014', 2014, 'Abstract, Results')],
    note: 'Overall yield 69%; the probe identified 96% of the lesions.',
    checkedBy: ABSTRACT_ONLY,
    ...CHECKED,
  },
  'vespa-atelectasis': {
    label: 'Any atelectasis on chest CT 20 to 30 minutes after airway placement',
    value: '84.2% with a laryngeal mask, 100% oxygen and no PEEP, and 28.9% with the VESPA bundle',
    appliesTo: 'Bronchoscopy under general anesthesia, multicentre randomized trial',
    class: 'consensus',
    sources: [cite('vespa', 2022, 'Abstract, Results')],
    note: 'The bundle was tested whole. The trial does not say which part did the work.',
    checkedBy: ABSTRACT_ONLY,
    ...CHECKED,
  },
  'vespa-peep': {
    label: 'PEEP in the VESPA bundle',
    value: '8 to 10 cm H₂O',
    appliesTo:
      'With an endotracheal tube, a recruitment maneuver after intubation and an inspired oxygen fraction titrated below 1.0',
    class: 'consensus',
    sources: [cite('vespa', 2022, 'Abstract, Methods')],
    note: 'The abstract gives no tidal volume and no recruitment pressure.',
    checkedBy: ABSTRACT_ONLY,
    ...CHECKED,
  },
})

export type PiNumberId = (typeof PI_NUMBERS.rows)[number]['id']

/** The short name printed in a citation under a number. */
const SOURCE_SHORT_NAMES: Readonly<Record<string, string>> = {
  aapm12: 'AAPM MPPG 12.a',
  mobile: 'Salahuddin, Diagnostics',
  confirm: 'Husta, Thorax',
  verhoeven: 'Verhoeven, J Bronchol Intervent Pulmonol',
  vespa: 'Salahuddin, Chest',
  ...Object.fromEntries(PI_NUMBER_ONLY_SOURCES.map((source) => [source.id, source.shortName])),
}

/** "AAPM MPPG 12.a 2022, §5.3". */
export function piNumberCitation(id: PiNumberId): string {
  return PI_NUMBERS.get(id)
    .sources.map(
      (source) =>
        `${SOURCE_SHORT_NAMES[source.sourceId] ?? source.sourceId} ${source.year}, ${source.locator}`,
    )
    .join('; ')
}

const registeredSourceIds = new Set<string>([
  ...SOURCES.map((source) => source.id),
  ...PI_NUMBER_ONLY_SOURCES.map((source) => source.id),
])

const piNumberErrors = teachingNumberErrors(PI_NUMBERS, registeredSourceIds)
if (piNumberErrors.length > 0) {
  throw new Error(`The imaging numbers register is invalid:\n${piNumberErrors.join('\n')}`)
}
