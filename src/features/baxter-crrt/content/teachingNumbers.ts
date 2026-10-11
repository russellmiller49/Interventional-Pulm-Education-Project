import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical and device number the CRRT module teaches, with its source.
 *
 * Guideline rows cite records already in the module's source map. Device rows were read from
 * the PrisMax Operator's Manual (AW8035 Rev B, program 2.XX) on 2026-10-08; locators are PDF
 * pages. Rows that cite a textbook the source map does not hold yet name it in
 * `CRRT_NUMBER_ONLY_SOURCES`. None is signed: `npm run numbers:signoff -- baxter-crrt`.
 */
const CHECK = {
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the source text',
  signedBy: null,
  signedOn: null,
} as const

const manual = (sourceId: string, locator: string): TeachingNumberCitation => ({
  sourceId,
  year: 2019,
  grade: null,
  locator,
})

/** Sources cited by a number and not yet in `learnerSourceMap`. */
export const CRRT_NUMBER_ONLY_SOURCES = [
  {
    id: 'TEXT-ACUTE-NEPHROLOGY-2015',
    title:
      'Oudemans-van Straaten HM, Forni LG, Groeneveld ABJ, Bagshaw SM, Joannidis M, eds. Acute Nephrology for the Critical Care Physician. Springer; 2015.',
  },
  {
    id: 'TEXT-CLINICAL-HANDBOOK-NEPHROLOGY-2024',
    title:
      'Williams ME, Goldfarb-Rumyantzev A, Brown RS. Kidney replacement therapy: dialysis. In: Clinical Handbook of Nephrology. Elsevier; 2024:152–229.',
  },
  {
    id: 'TEXT-BRENNER-RECTOR-12E-CH64',
    title:
      'Neyra JA, Teixeira JP, Tolwani AJ. Critical care nephrology. In: Brenner & Rector’s The Kidney. 12th ed. Elsevier; 2026:1881–1898.',
  },
] as const

export const CRRT_NUMBERS = defineTeachingNumbers('baxter-crrt', {
  'dose-delivered': {
    label: 'Delivered effluent dose',
    value: '20–25 mL/kg/h',
    class: 'guideline',
    sources: [
      { sourceId: 'GUID-KDIGO-AKI-2012', year: 2012, grade: '1A', locator: 'Recommendation 5.8.4' },
      {
        sourceId: 'GUID-RRT-ICU-2026',
        year: 2026,
        grade: 'Grade A',
        locator: 'Recommendation 5.1',
      },
      { sourceId: 'RENAL-2009', year: 2009, grade: 'randomized trial', locator: 'Primary outcome' },
    ],
    note: 'RENAL compared 25 with 40 mL/kg/h and ATN 20 with 35 mL/kg/h; neither found a benefit from the higher dose.',
    ...CHECK,
    checkedBy:
      'Claude. German–Austrian Rec 5.1 and RENAL from the decision packet; KDIGO 5.8.4 grade as recorded there, not re-read',
  },
  'dose-prescribed': {
    label: 'Prescribed effluent dose that delivers the target',
    value: '25–30 mL/kg/h',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-ACUTE-NEPHROLOGY-2015',
        year: 2015,
        grade: null,
        locator: 'Chapter 13, p. 169',
      },
    ],
    note: 'The chapter gives this for pre-dilution, where the effluent is partly replacement fluid. Downtime has the same effect: what is prescribed is not what is delivered.',
    ...CHECK,
  },
  'filtration-fraction-ceiling': {
    label: 'Filtration fraction ceiling',
    value: '25%',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'REVIEW-CRRT-PRINCIPLES-2021',
        year: 2021,
        grade: null,
        locator: 'Section 3.4.2, Filtration fraction',
      },
    ],
    note: 'Other texts teach 20%. Above the ceiling the blood leaving the filter is concentrated enough to clot it.',
    ...CHECK,
  },
  'postfilter-ica': {
    label: 'Post-filter ionized calcium on regional citrate',
    value: '0.25–0.35 mmol/L',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-ACUTE-NEPHROLOGY-2015',
        year: 2015,
        grade: null,
        locator: 'Chapter 15, section 15.4.3, p. 195',
      },
    ],
    ...CHECK,
  },
  'calcium-ratio': {
    label: 'Total-to-ionized calcium ratio that signals citrate accumulation',
    value: 'above 2.5',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-ACUTE-NEPHROLOGY-2015',
        year: 2015,
        grade: null,
        locator: 'Chapter 15, key messages, p. 197',
      },
      {
        sourceId: 'CITRATE-SCHNEIDER-2017-PATTERNS',
        year: 2017,
        grade: null,
        locator: 'Citrate accumulation',
      },
    ],
    note: 'Both total and ionized calcium must be in mmol/L from the same systemic sample.',
    ...CHECK,
    checkedBy:
      'Claude, against the textbook; the Schneider figure is as cited in the packet, not re-read',
  },
  'tmp-alarm': {
    label: 'PrisMax TMP alarm',
    value: 'above +300 mmHg',
    class: 'device',
    sources: [manual('MATH-PM-005', 'PDF p. 219')],
    ...CHECK,
  },
  'clotting-advisory': {
    label: 'PrisMax filter clotting advisory',
    value: '100 mmHg above the starting pressure drop or TMP',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF p. 319')],
    ...CHECK,
  },
  'access-low-limit': {
    label: 'PrisMax Access Extremely Negative',
    value: 'below −250 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF pp. 240 and 318')],
    ...CHECK,
  },
  'return-high-limit': {
    label: 'PrisMax Return Extremely Positive',
    value: 'above +350 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF pp. 240 and 319')],
    ...CHECK,
  },
  'return-disconnect-limit': {
    label: 'PrisMax Return Disconnection',
    value: 'below +10 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-009', 'PDF pp. 205 and 240')],
    ...CHECK,
  },
  'filter-high-limit': {
    label: 'PrisMax High Filter Pressure',
    value: 'above +450 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF pp. 240 and 319')],
    ...CHECK,
  },
  'set-life': {
    label: 'PrisMax CRRT set life',
    value: '72 hours',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF p. 338')],
    note: 'The manual recommends changing the set every 24 hours and requires it by 72.',
    ...CHECK,
  },
  'postfilter-ica-ceiling': {
    label: 'Post-filter ionized calcium for effective anticoagulation (second source)',
    value: 'below 0.4 mmol/L',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-BRENNER-RECTOR-12E-CH64',
        year: 2026,
        grade: null,
        locator: 'Anticoagulation, p. 1894',
      },
    ],
    note: 'Differs from the 0.25–0.35 mmol/L target band in Acute Nephrology (2015). Teach both.',
    ...CHECK,
  },
  'systemic-ica': {
    label: 'Systemic ionized calcium on citrate: the band the calcium infusion is titrated to',
    value: '1.0–1.1 mmol/L',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-CLINICAL-HANDBOOK-NEPHROLOGY-2024',
        year: 2024,
        grade: null,
        locator: 'Table 12.8, p. 163',
      },
    ],
    note: 'The table raises the calcium infusion below 1.0 and lowers it above 1.1 mmol/L. Unit protocols often accept up to the laboratory’s upper normal.',
    ...CHECK,
  },
  'citrate-monitoring': {
    label: 'Calcium monitoring on citrate',
    value: 'ionized calcium every 4 hours until stable, then every 6; total calcium every 12',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-CLINICAL-HANDBOOK-NEPHROLOGY-2024',
        year: 2024,
        grade: null,
        locator: 'Table 12.8, p. 163',
      },
    ],
    ...CHECK,
  },
  'blood-flow-range': {
    label: 'CRRT blood flow',
    value: '120–250 mL/min, average 180',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-CLINICAL-HANDBOOK-NEPHROLOGY-2024',
        year: 2024,
        grade: null,
        locator: 'Table 12.8, p. 163',
      },
    ],
    ...CHECK,
  },
  'liberation-urine-output': {
    label: 'Urine output that predicts coming off CRRT',
    value: 'more than 400–450 mL/day without diuretics, or more than 2,300 mL/day with them',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-ACUTE-NEPHROLOGY-2015',
        year: 2015,
        grade: 'observational (BEST Kidney)',
        locator: 'Chapter 12, p. 162',
      },
    ],
    note: 'The chapter reports a better than 80% probability of sustained weaning above these volumes, from the BEST Kidney study. The primary paper was not read.',
    ...CHECK,
  },
  'gain-loss-window': {
    label: 'PrisMax unintended fluid gain or loss window',
    value: '3 hours',
    class: 'device',
    sources: [
      manual('DEV-PM-012', 'Protecting from fluid imbalance, PDF p. 217'),
      manual('DEV-PM-008', 'CRRT Gain/Loss Limit Reached, PDF p. 112'),
    ],
    note: 'The limit itself is set per patient at setup. Reaching it suspends treatment permanently.',
    ...CHECK,
  },
  'blood-leak-normalization-floor': {
    label: 'PrisMax blood leak detector: lowest signal that can be normalized',
    value: '85%',
    class: 'device',
    sources: [manual('DEV-PM-008', 'Blood Leak Detector normalization, PDF p. 37')],
    note: 'PDF p. 37 is outside the alarm chapter this record registers; the locator is the real page.',
    ...CHECK,
  },
})

export type CrrtNumberId = (typeof CRRT_NUMBERS.rows)[number]['id']
