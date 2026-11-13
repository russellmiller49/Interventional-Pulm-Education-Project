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

/** The hyperkalemia and liver-failure rows behind CRRT-03, read from each source's full text. */
const CHECK_CRRT_03 = {
  checkedOn: '2026-10-31',
  checkedBy: 'Claude, against the source text',
  signedBy: null,
  signedOn: null,
} as const

/** Rows read against the full text of the AJKD Core Curriculum 2025 (REVIEW-CKRT-CORE-2025). */
const CHECK_AJKD = {
  checkedOn: '2026-11-09',
  checkedBy: 'Claude, against the full text of the AJKD Core Curriculum 2025',
  signedBy: null,
  signedOn: null,
} as const

const AJKD = 'REVIEW-CKRT-CORE-2025'

const ajkd = (locator: string): TeachingNumberCitation => ({
  sourceId: AJKD,
  year: 2025,
  grade: null,
  locator,
})

const UKKA = 'GUID-UKKA-HYPERKALEMIA-2023'
const KDIGO_ACUTE_K = 'CONSENSUS-KDIGO-ACUTE-HYPERKALEMIA-2020'
const EASL = 'GUID-EASL-ALF-2017'

const manual = (sourceId: string, locator: string): TeachingNumberCitation => ({
  sourceId,
  year: 2019,
  grade: null,
  locator,
})

/** Rows re-checked against their sources in the owner's register review of 2026-11-13. */
const RECHECKED = { checkedOn: '2026-11-13' } as const

/** The UKKA rows were re-read against the July 2026 update of the guideline. */
const UKKA_RECHECK =
  'Claude, against the UKKA guideline updated July 2026 (and the October 2023 version it replaces) and the KDIGO paper’s full text, 2026-11-13'

/**
 * The owner's signature for rows he approved by name in a written decision of 2026-11-13.
 *
 * Russell Miller approved each signed row in writing; Claude checked each against its source and
 * applied the signature to that row alone. `checkedBy` says who read the source; the signature does
 * not claim the owner re-read it. The shared CHECK constants stay unsigned, so no row is signed by
 * inheritance. Rows held for a decision say so in their note and stay unsigned.
 */
const SIGNED_BY_OWNER_DECISION = {
  signedBy: 'Russell Miller, written decision of 2026-11-13 (sources checked by Claude)',
  signedOn: '2026-11-13',
} as const

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
      {
        sourceId: 'GUID-KDIGO-AKI-2012',
        year: 2012,
        grade: '1A',
        locator: 'Recommendation 5.8.4, p. 113',
      },
      {
        sourceId: 'GUID-RRT-ICU-2026',
        year: 2026,
        grade: 'Grade A (strong), moderate certainty',
        locator: 'Recommendation 5.1',
      },
      { sourceId: 'RENAL-2009', year: 2009, grade: 'randomized trial', locator: 'Primary outcome' },
      ajkd('Dose of Solute Clearance With CKRT, p. 777'),
    ],
    note: 'RENAL compared 25 with 40 mL/kg/h and ATN 20 with 35 mL/kg/h; neither found a benefit from the higher dose. German–Austrian Recommendation 5.1 says the dose is to be administered; its text calls 20–25 mL/kg/h the target dose to achieve.',
    ...CHECK,
    ...RECHECKED,
    checkedBy:
      'Claude. KDIGO 5.8.4 (p. 113), German–Austrian 5.1 and the RENAL and ATN abstracts re-read 2026-11-13; AJKD 2025 read 2026-11-09 from its full text',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'dose-prescribed': {
    label: 'Prescribed effluent dose commonly used to help reach the delivered target',
    value: '25–30 mL/kg/h',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'GUID-KDIGO-AKI-2012',
        year: 2012,
        grade: 'Not graded',
        locator: 'Recommendation 5.8.4 and its rationale, pp. 113–114',
      },
      {
        sourceId: 'GUID-RRT-ICU-2026',
        year: 2026,
        grade: null,
        locator: 'Section 5, Dose in CRRT (text)',
      },
      {
        sourceId: 'TEXT-BRENNER-RECTOR-12E-CH64',
        year: 2026,
        grade: null,
        locator: 'Dose of kidney replacement therapy, p. 1894',
      },
      {
        sourceId: 'TEXT-ACUTE-NEPHROLOGY-2015',
        year: 2015,
        grade: null,
        locator: 'Chapter 13, p. 169',
      },
    ],
    note: 'A prescription above the delivered target allows for interruptions and, in pre-dilution, for the diluted blood the filter sees. It does not guarantee the delivered dose, which is measured from the effluent actually produced. KDIGO’s statement that delivery usually needs a higher prescription is not graded; Acute Nephrology gives this range for pre-dilution.',
    ...CHECK,
    ...RECHECKED,
    checkedBy:
      'Claude, against KDIGO 2012 (pp. 113–114), the German–Austrian guideline text, Brenner chapter 64 (p. 1894) and Acute Nephrology (p. 169), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
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
      ajkd('Dose of Solute Clearance With CKRT, p. 778'),
    ],
    note: 'Other texts teach 20%; AJKD 2025 gives 20%–25% and says regional citrate is anecdotally reported to tolerate a higher fraction. Above the ceiling the blood leaving the filter is concentrated enough to clot it.',
    ...CHECK,
    checkedBy: 'Claude, against the source text. AJKD 2025 added 2026-11-09 from its full text',
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
    note: 'The textbook’s target band when the citrate dose is titrated to the post-filter value; the same paragraph says many protocols use a fixed citrate-to-blood-flow proportion instead. It lies inside the below 0.4 mmol/L bound in postfilter-ica-ceiling.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the textbook (section 15.4.3, p. 195), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'calcium-ratio': {
    label: 'Total-to-ionized calcium ratio that raises concern for citrate accumulation',
    value: 'above 2.5',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'TEXT-ACUTE-NEPHROLOGY-2015',
        year: 2015,
        grade: null,
        locator: 'Chapter 15, section 15.4.8, p. 196, and key messages, p. 197',
      },
      {
        sourceId: 'CITRATE-SCHNEIDER-2017-PATTERNS',
        year: 2017,
        grade: null,
        locator: 'Citrate accumulation, and Table 1',
      },
      ajkd('Complications of CKRT, p. 783, and Figure 2, p. 784'),
    ],
    note: 'A concern, not a diagnosis by itself: read it with the trend in the ratio, a falling systemic ionized calcium, a rising calcium requirement and an anion-gap metabolic acidosis. Total and ionized calcium must be in the same molar units (mmol/L) from the same systemic sample; AJKD notes laboratories often report them in different units. Acute Nephrology gives a rise above 2.25–2.5, AJKD a ratio of 2.5 or more from a normal of about 2, and Schneider calls 2.5 the usual cut-off and counts a trend toward it.',
    ...CHECK,
    ...RECHECKED,
    checkedBy:
      'Claude, against the textbook, the Schneider 2017 full text (PMC5694623) and AJKD 2025, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'tmp-alarm': {
    label: 'PrisMax TMP alarm',
    value: 'above +300 mmHg',
    class: 'device',
    sources: [manual('MATH-PM-005', 'PDF p. 219')],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. Alarm when TMP is higher than +300 mmHg; a fixed limit that only an authorized service technician can set.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'clotting-advisory': {
    label: 'PrisMax filter clotting advisory',
    value: '100 mmHg above the starting pressure drop or TMP',
    class: 'device',
    sources: [
      manual('DEV-PM-014', 'Specifications, PDF p. 319'),
      manual('MATH-PM-005', 'PDF p. 219'),
    ],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. A rise over the initial value, not an absolute pressure: the advisory comes when the filter pressure drop is 100 mmHg above the initial drop, or TMP is 100 mmHg above the initial TMP, or both. The initial TMP is reset after each self test and each change in blood flow, PFR or replacement rate (PDF p. 219).',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'access-low-limit': {
    label: 'PrisMax Access Extremely Negative',
    value: 'below −250 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF pp. 240 and 318')],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. Pressure in the access pod more negative than −250 mmHg: the low access pressure warning limit, listed as Access Extremely Negative among the CRRT default extreme limits.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'return-high-limit': {
    label: 'PrisMax Return Extremely Positive',
    value: 'above +350 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF pp. 240 and 318')],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. Pressure in the return deaeration chamber greater than +350 mmHg. The specification is on PDF p. 318; the earlier locator gave p. 319.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'return-disconnect-limit': {
    label: 'PrisMax Return Disconnection: the initial (default) limit',
    value: 'below +10 mmHg',
    class: 'device',
    sources: [
      manual('DEV-PM-009', 'PDF pp. 205 and 240'),
      manual('DEV-PM-014', 'Specifications, PDF p. 319'),
    ],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. The return disconnect limit is initially +10 mmHg and can change when the return pressure’s operating point changes, to a minimum of −20 mmHg (PDF p. 205). Separately, a drop below the operating point by 50 mmHg (blood flow up to 200 mL/min) or 70 mmHg (above 200 mL/min) is detected, and that drop can be set as low as 5 mmHg (PDF p. 319). Not every disconnection is caught by a fixed +10 mmHg.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'filter-high-limit': {
    label: 'PrisMax High Filter Pressure',
    value: 'above +450 mmHg',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF pp. 240 and 319')],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. Pressure in the filter pod, immediately before the filter, greater than +450 mmHg.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'set-life': {
    label: 'PrisMax CRRT set life: maximum',
    value: '72 hours',
    class: 'device',
    sources: [manual('DEV-PM-014', 'Specifications, PDF p. 338')],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. The maximum and default life of a CRRT set. Separately, the manual recommends changing the set every 24 hours of use for filter performance, and requires the change after 72 hours.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
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
      ajkd('Anticoagulation, p. 781'),
    ],
    note: 'An upper bound for effective circuit anticoagulation: Brenner gives optimal anticoagulation when the hemofilter ionized calcium is below 0.4 mmol/L, and AJKD 2025 a target typically below 0.4. The narrower 0.25–0.35 mmol/L band in Acute Nephrology (postfilter-ica) lies inside it, so the two do not conflict. Teach both.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against Brenner chapter 64 (p. 1894) and AJKD 2025, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
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
    note: 'One handbook’s example protocol, in its table of what to write in CRRT orders: the calcium gluconate infusion is raised below 1.0 and lowered above 1.1 mmol/L. Not a general target. Held for the owner (2026-11-13): the learner copy states it as the band, without saying it is one protocol’s.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the handbook (Table 12.8, p. 163), 2026-11-13',
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
    note: 'The handbook pairs this schedule with its own citrate protocol (ACD-A at 150% of the blood flow) and does not say which sample the ionized calcium is drawn from. Other sources differ: Acute Nephrology, systemic ionized and total calcium and a blood gas every 6–8 hours, every 2 hours at first in patients at risk (pp. 196–197); Schneider 2017, post-filter, systemic and total calcium every 6 hours after the start; AJKD 2025, total calcium at least daily. Held for the owner (2026-11-13).',
    ...CHECK,
    ...RECHECKED,
    checkedBy:
      'Claude, against the handbook (Table 12.8, p. 163), Acute Nephrology, Schneider 2017 and AJKD 2025, 2026-11-13',
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
    note: 'The blood pump rate in the handbook’s table of what to write in CRRT orders. The table gives no basis for the average of 180. AJKD 2025 gives 120–150 mL/min on regional citrate (citrate-blood-flow) and little filter-life gain above about 250 (blood-flow-plateau). Held for the owner (2026-11-13).',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the handbook (Table 12.8, p. 163), 2026-11-13',
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
    note: 'The chapter reports a better than 80% probability of sustained weaning above these volumes, from the BEST Kidney study. The primary analysis (Uchino et al., Crit Care Med 2009;37:2576–2582) defines success as no kidney replacement therapy for at least 7 days; its abstract names urine output as the strongest predictor, weaker with diuretics, and gives no cutoffs. Its full text was not read. Held for the owner (2026-11-13).',
    ...CHECK,
    ...RECHECKED,
    checkedBy:
      'Claude, against the textbook (p. 162) and the primary paper’s abstract (PubMed 19623048), 2026-11-13',
  },
  'gain-loss-window': {
    label: 'PrisMax unintended fluid gain or loss: the sliding window',
    value: '3 hours',
    class: 'device',
    sources: [
      manual('DEV-PM-012', 'Protecting from fluid imbalance, PDF p. 217'),
      manual('DEV-PM-008', 'CRRT Gain/Loss Limit Reached, PDF p. 112'),
    ],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. The accumulated unintended fluid-balance error is counted over a sliding 3-hour window (the alarm reads the last 180 minutes). The limit itself is set per patient and confirmed at setup. Reaching it ends the current treatment: the fluid pumps will not restart and the set is discarded.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'hyperkalemia-severe': {
    label: 'Severe hyperkalemia',
    value: '≥6.5 mmol/L',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: null, locator: 'Introduction, p. 10' },
      { sourceId: UKKA, year: 2026, grade: '1C', locator: 'Guideline 14.2, pp. 13 and 64' },
      { sourceId: UKKA, year: 2026, grade: '1B', locator: 'Guideline 16.3.1, pp. 14 and 86' },
    ],
    note: 'UKKA grades mild 5.5–5.9, moderate 6.0–6.4 and severe 6.5 mmol/L or more. The KDIGO conference paper says no common, standardized severity grading exists, and its figure is an expert-opinion risk classification.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'calcium-dose': {
    label: 'IV calcium for ECG changes of hyperkalemia',
    value:
      '30 mL of 10% calcium gluconate over 10 minutes (or 10 mL of 10% calcium chloride over 5)',
    appliesTo: 'Equivalent 6.8 mmol doses. UKKA keeps calcium chloride for arrest or peri-arrest.',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '2C', locator: 'Guideline 16.2a, pp. 14 and 76' },
      { sourceId: UKKA, year: 2026, grade: '1C', locator: 'Guideline 16.2b, pp. 14 and 76' },
      { sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Figure 3 footnote' },
    ],
    note: 'The July 2026 update changed 16.2a (dose and rate) from a recommendation graded 1C to a suggestion graded 2C; 16.2b (chloride in arrest or peri-arrest, gluconate otherwise) stays a 1C recommendation. UKKA does not give calcium for a normal ECG (rationale, pp. 80–81). The rates and the 6.8 mmol equivalence are UKKA’s; the KDIGO footnote gives the 30 mL of gluconate as 6.9 mmol and the chloride as 6.8 mmol, with no rates, and quotes the European Resuscitation Council: chloride over 2–5 minutes.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'calcium-without-ecg': {
    label: 'Potassium at which KDIGO gives calcium when no ECG is available',
    value: 'above 6.5 mmol/L',
    appliesTo:
      'Only when the potassium is known and an ECG or a cardiac monitor is not immediately possible (KDIGO conference, emergency department).',
    class: 'consensus',
    sources: [
      {
        sourceId: KDIGO_ACUTE_K,
        year: 2020,
        grade: null,
        locator: 'Treatment of hyperkalemia, Cellular membrane stabilization',
      },
    ],
    note: 'KDIGO suggests it, ungraded. UKKA gives calcium only for ECG changes. Both are shown in CRRT-03.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: 'Claude, against the KDIGO conference paper’s full text (PMC7448835), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'insulin-glucose': {
    label: 'Insulin-glucose for severe hyperkalemia',
    value: '10 units of soluble insulin with 25 g glucose',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '1B', locator: 'Guideline 16.3.1, pp. 14 and 86' },
    ],
    note: 'UKKA states further study is needed before 5 units can be recommended (p. 97). KDIGO’s algorithm uses 5 units: see insulin-low-dose. The two regimens are kept as separate rows.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'insulin-low-dose': {
    label: 'Insulin dose in the KDIGO hyperkalemia algorithm',
    value: '5 units with 25 g glucose',
    class: 'consensus',
    sources: [{ sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Figure 3 footnote' }],
    note: 'The figure says its action thresholds are opinion based; its doses are cited to a 2010 systematic review and an observational study. The paper’s text also discusses 10 units. UKKA’s 10 units is a separate row (insulin-glucose).',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: 'Claude, against the KDIGO conference paper’s full text (PMC7448835), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'insulin-peak': {
    label: 'Peak potassium fall after insulin-glucose',
    value: '30–60 minutes',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2026, grade: null, locator: 'Rationale 16.3, p. 87' }],
    note: 'UKKA gives the peak fall at 30–60 minutes. The KDIGO paper gives 30–60 minutes as the onset of action, so it is not cited for the peak.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'rebound-window': {
    label: 'When potassium may rebound after shifting therapy',
    value: 'around 2–3 hours',
    class: 'consensus',
    sources: [
      { sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Reassessment' },
      { sourceId: UKKA, year: 2026, grade: null, locator: 'Rationale 16.3, p. 87' },
    ],
    note: 'May, not will, and not at an exact time: KDIGO says rebound may occur at 2–3 hours if potassium has not been eliminated from the body. UKKA says the fall may hold for up to 2 hours, usually followed by a gradual rebound.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'insulin-repeat': {
    label: 'Potassium at which UKKA says to consider a further insulin-glucose infusion',
    value: 'still 6.0 mmol/L or higher 2 hours after the infusion',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2026, grade: null, locator: 'Rationale 16.3, p. 98' }],
    note: 'Considered after reassessing potassium, not repeated automatically. The same paragraph says repeated doses raise the risk of hypoglycemia, and to seek specialist advice if potassium stays uncontrolled. Rationale text, ungraded. In the October 2023 version the paragraph is on p. 93; the earlier locator gave p. 92.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'post-insulin-glucose-trigger': {
    label: 'Pre-treatment glucose that calls for a follow-on infusion',
    value: 'below 7.0 mmol/L (126 mg/dL)',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '2B', locator: 'Guideline 16.3.3, pp. 14 and 86' },
    ],
    note: 'mg/dL is converted from the printed mmol/L.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'post-insulin-glucose': {
    label: 'Follow-on glucose after insulin',
    value: '10% glucose at 50 mL/h for 5 hours',
    appliesTo:
      'Only when the pre-treatment blood glucose is below 7.0 mmol/L (post-insulin-glucose-trigger).',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '2B', locator: 'Guideline 16.3.3, pp. 14 and 86' },
    ],
    note: 'UKKA prints this as a recommendation with a grade of 2B.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'salbutamol-dose': {
    label: 'Nebulized salbutamol for severe hyperkalemia',
    value: '10–20 mg of nebulized salbutamol',
    appliesTo:
      'An adjunct to insulin-glucose for severe hyperkalemia (6.5 mmol/L or more); never monotherapy. Salbutamol is albuterol.',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '1B', locator: 'Guideline 16.4.1, pp. 14 and 101' },
      { sourceId: UKKA, year: 2026, grade: '1A', locator: 'Guideline 16.4.3, pp. 15 and 101' },
    ],
    note: '16.4.1 gives the dose as adjuvant therapy for severe hyperkalemia; 16.4.3 says it is not used as monotherapy. UKKA advises a lower dose and cardiac monitoring in cardiac disease (p. 101).',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'glucose-checks': {
    label: 'Blood glucose checks after insulin-glucose',
    value: 'at 0, 30, 60, 90, 120, 180, 240, 300 and 360 minutes',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '1C', locator: 'Guideline 17.2, pp. 15 and 114' },
    ],
    note: 'EASL separately asks for glucose checks every 2 hours in hyperacute liver failure, with or without insulin.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'potassium-recheck': {
    label: 'Potassium checks after treatment',
    value: 'at 1, 2, 4, 6 and 24 hours',
    appliesTo:
      'At least these times, after moderate or severe hyperkalemia is identified and treated.',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2026, grade: '2C', locator: 'Guideline 17.1.2, pp. 15 and 113' },
      { sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Reassessment' },
    ],
    note: 'KDIGO says potassium can be rechecked at 60 minutes; UKKA gives the full series as a minimum.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy: UKKA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION,
  },
  'alf-sodium-recommendation': {
    label: 'Serum sodium in acute liver failure: EASL recommendation',
    value: '140–150 mmol/L',
    class: 'guideline',
    sources: [
      {
        sourceId: EASL,
        year: 2017,
        grade: 'Evidence II-2, grade 1 (strong)',
        locator: 'Metabolic management, recommendations, p. 1062',
      },
    ],
    note: 'The same guideline gives other values, each in its own context: 140–145 mmol/L in the metabolic-management text (p. 1062); 135–145 mmol/L in Table 9, standard care at admission (p. 1056); and 140–145 mmol/L as a general measure for raised intracranial pressure (alf-sodium-icp). They are shown as separate statements.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy:
      'Claude, against the EASL guideline full text (J Hepatol 2017;66:1047–1081), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'alf-sodium-icp': {
    label: 'Serum sodium in raised intracranial pressure: EASL general measures',
    value: '140–145 mmol/L',
    class: 'guideline',
    sources: [
      {
        sourceId: EASL,
        year: 2017,
        grade: null,
        locator: 'Therapeutic options for raised intracranial pressure, p. 1066',
      },
    ],
    note: 'Text, ungraded: one of the general measures for raised intracranial pressure.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy:
      'Claude, against the EASL guideline full text (J Hepatol 2017;66:1047–1081), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'alf-sodium-rate': {
    label: 'Limit on the rate of sodium correction in acute liver failure (EASL)',
    value: '10 mmol/L per 24 hours',
    appliesTo:
      'A ceiling on the rate of change when correcting sodium: not a target rate, and not a rate shown to be safe for every patient.',
    class: 'guideline',
    sources: [
      { sourceId: EASL, year: 2017, grade: null, locator: 'Metabolic management, p. 1062' },
    ],
    note: 'Ungraded text: rapid change in sodium should be avoided, and correction should not exceed this. The guideline does not separate acute from chronic hyponatremia. The earlier locator gave p. 1061.',
    ...CHECK_CRRT_03,
    ...RECHECKED,
    checkedBy:
      'Claude, against the EASL guideline full text (J Hepatol 2017;66:1047–1081), 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'blood-leak-normalization-floor': {
    label: 'PrisMax blood leak detector: lowest signal that can be normalized',
    value: '85%',
    class: 'device',
    sources: [manual('DEV-PM-008', 'Blood Leak Detector normalization, PDF pp. 37–38')],
    note: 'PrisMax operator’s manual AW8035 Rev B (June 2019), program version 2.XX; locators are PDF pages, one ahead of the printed page numbers. The minimum signal for re-normalizing, not the alarm threshold: once normalized, the alarm sounds below 60.1% at rates under 5,000 mL/h, and up to 73.4% at higher rates. Before normalizing, an effluent sample goes to the laboratory for red cells; if blood is present the treatment is ended and the set changed. The 85% step is on PDF p. 38; the earlier locator gave p. 37 alone.',
    ...CHECK,
    ...RECHECKED,
    checkedBy: 'Claude, against the operator’s manual, 2026-11-13',
    ...SIGNED_BY_OWNER_DECISION,
  },
  'oliguria-start': {
    label: 'Oliguria after which starting CRRT is likely reasonable',
    value: '48–72 hours or more',
    appliesTo: 'A patient with AKI who is a candidate for escalation of care.',
    class: 'expert-reference',
    sources: [ajkd('Timing of CKRT Initiation and Discontinuation, pp. 776–777')],
    note: 'Starting earlier gave no benefit in AKIKI, IDEAL-ICU and STARRT-AKI; the single-center ELAIN trial is the exception.',
    ...CHECK_AJKD,
  },
  'krt-aki-mortality': {
    label: 'Mortality of critically ill patients with AKI who need kidney replacement therapy',
    value: 'about 50%',
    class: 'expert-reference',
    sources: [ajkd('Timing of CKRT Initiation and Discontinuation, p. 777')],
    ...CHECK_AJKD,
  },
  'dose-trial-high': {
    label: 'Higher effluent dose that gave no benefit in the ATN and RENAL trials',
    value: '35–40 mL/kg/h',
    class: 'expert-reference',
    sources: [ajkd('Dose of Solute Clearance With CKRT, p. 777')],
    note: 'ATN compared 35 with 20 mL/kg/h and RENAL 40 with 25. The higher doses brought more hypophosphatemia and hypotension.',
    ...CHECK_AJKD,
  },
  'dose-high-lysis': {
    label: 'Effluent dose that may be needed in rhabdomyolysis or tumor lysis syndrome',
    value: '40 mL/kg/h or more',
    class: 'expert-reference',
    sources: [ajkd('Dose of Solute Clearance With CKRT, p. 778')],
    note: 'The review advises stepping back toward the standard range once metabolic control is achieved and the underlying process has improved.',
    ...CHECK_AJKD,
  },
  'lactate-endogenous-clearance': {
    label: 'Endogenous lactate clearance in critical illness (estimate)',
    value: '750–2,000 mL/min',
    class: 'physiology',
    sources: [ajkd('Dose of Solute Clearance With CKRT, p. 778')],
    note: 'The review’s example of very high-dose CRRT clearance is 50 mL/min, a small fraction of this.',
    ...CHECK_AJKD,
  },
  'kpi-delivered-dose': {
    label: 'Proposed CRRT quality benchmark: delivered dose as a share of prescribed',
    value: 'above 80%',
    class: 'expert-reference',
    sources: [ajkd('Monitoring CKRT Performance, Figure 3, p. 785')],
    note: 'Proposed benchmarks; the review says they need prospective validation and adaptation to local practice.',
    ...CHECK_AJKD,
  },
  'kpi-downtime': {
    label: 'Proposed CRRT quality benchmark: downtime',
    value: 'below 15% of the prescribed time',
    class: 'expert-reference',
    sources: [ajkd('Monitoring CKRT Performance, Figure 3, p. 785')],
    note: 'Proposed benchmarks; the review says they need prospective validation and adaptation to local practice.',
    ...CHECK_AJKD,
  },
  'kpi-filter-life': {
    label: 'Proposed CRRT quality benchmark: filter life',
    value: 'more than 60% of filters lasting over 60 hours',
    class: 'expert-reference',
    sources: [ajkd('Monitoring CKRT Performance, Figure 3, p. 785')],
    note: 'Proposed benchmarks; the review says they need prospective validation and adaptation to local practice.',
    ...CHECK_AJKD,
  },
  'rich-filter-life': {
    label: 'Filter life gained with regional citrate over systemic heparin in the RICH trial',
    value: '15 hours longer',
    class: 'expert-reference',
    sources: [ajkd('Anticoagulation, p. 781')],
    note: 'RICH randomized nearly 600 patients; citrate also gave fewer bleeding events, with no significant difference in mortality. The primary paper was not read.',
    ...CHECK_AJKD,
  },
  'no-anticoagulation-centers': {
    label: 'Share of centers that start CRRT without anticoagulation',
    value: 'about 33%–50%',
    class: 'expert-reference',
    sources: [ajkd('Anticoagulation, p. 781')],
    note: 'Anticoagulation is added if filters clot early.',
    ...CHECK_AJKD,
  },
  'citrate-lactate-risk': {
    label: 'Serum lactate and the risk of citrate accumulation',
    value: 'below 4 mmol/L, low risk; 4–8 mmol/L, intermediate; above 8 mmol/L, high',
    class: 'expert-reference',
    sources: [ajkd('Anticoagulation, p. 781')],
    note: 'Given as a rough guide. Lactate, like citrate, is metabolized mainly by the liver.',
    ...CHECK_AJKD,
  },
  'citrate-blood-flow': {
    label: 'Blood flow on regional citrate',
    value: '120–150 mL/min',
    class: 'expert-reference',
    sources: [ajkd('Blood Flow, p. 779')],
    note: 'Lower than the general CRRT range in blood-flow-range: less citrate is needed, which lowers the metabolic load.',
    ...CHECK_AJKD,
  },
  'blood-flow-plateau': {
    label: 'Blood flow above which filter life gains little',
    value: 'about 250 mL/min',
    class: 'expert-reference',
    sources: [ajkd('Blood Flow, p. 779')],
    note: 'One trial of 100 patients randomized to 150 or 250 mL/min found no difference in filter life.',
    ...CHECK_AJKD,
  },
  'calcium-ratio-normal': {
    label: 'Normal total-to-ionized calcium ratio',
    value: 'about 2',
    class: 'physiology',
    sources: [ajkd('Complications of CKRT, p. 783, and Figure 2, p. 784')],
    note: 'About half of circulating calcium is ionized.',
    ...CHECK_AJKD,
  },
  'hypophosphatemia-onset': {
    label: 'When hypophosphatemia appears on phosphate-free CRRT solutions',
    value: 'within about 48 hours',
    class: 'expert-reference',
    sources: [ajkd('Complications of CKRT, p. 783')],
    ...CHECK_AJKD,
  },
  'amino-acid-loss': {
    label: 'Amino acids lost to the CRRT effluent',
    value: '10–20 g a day',
    class: 'expert-reference',
    sources: [ajkd('Nutrition and Physical Rehabilitation, p. 785')],
    ...CHECK_AJKD,
  },
  'nutrition-energy': {
    label: 'Daily energy target on CRRT',
    value: '25–35 kcal/kg',
    class: 'expert-reference',
    sources: [ajkd('Nutrition and Physical Rehabilitation, p. 785')],
    ...CHECK_AJKD,
  },
  'nutrition-protein': {
    label: 'Daily protein target on CRRT',
    value: '1.5–2.5 g/kg',
    class: 'expert-reference',
    sources: [ajkd('Nutrition and Physical Rehabilitation, p. 785')],
    ...CHECK_AJKD,
  },
})

export type CrrtNumberId = (typeof CRRT_NUMBERS.rows)[number]['id']
