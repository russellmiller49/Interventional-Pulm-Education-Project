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
      ajkd('Dose of Solute Clearance With CKRT, p. 777'),
    ],
    note: 'RENAL compared 25 with 40 mL/kg/h and ATN 20 with 35 mL/kg/h; neither found a benefit from the higher dose.',
    ...CHECK,
    checkedBy:
      'Claude. German–Austrian Rec 5.1 and RENAL from the decision packet; KDIGO 5.8.4 grade as recorded there, not re-read. AJKD 2025 added 2026-11-09 from its full text',
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
      ajkd('Dose of Solute Clearance With CKRT, p. 778'),
    ],
    note: 'Other texts teach 20%; AJKD 2025 gives 20%–25% and says regional citrate is anecdotally reported to tolerate a higher fraction. Above the ceiling the blood leaving the filter is concentrated enough to clot it.',
    ...CHECK,
    checkedBy: 'Claude, against the source text. AJKD 2025 added 2026-11-09 from its full text',
  },
  'filtration-fraction-ceiling-range': {
    label: 'Filtration fraction ceiling, as a range',
    value: '20%–25%',
    class: 'expert-reference',
    sources: [ajkd('Dose of Solute Clearance With CKRT, p. 778')],
    note: 'The second of the two ceilings the module shows side by side (owner decision O03, 2026-11-10): the 2021 review gives 25% for post-dilution CVVH, this source gives a range. The value and its locator are the ones the `filtration-fraction-ceiling` row has carried since 2026-11-09.',
    ...CHECK_AJKD,
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
      ajkd('Anticoagulation, p. 781'),
    ],
    note: 'Differs from the 0.25–0.35 mmol/L target band in Acute Nephrology (2015). Teach both. AJKD 2025 also gives typically below 0.4 mmol/L.',
    ...CHECK,
    checkedBy: 'Claude, against the source text. AJKD 2025 added 2026-11-09 from its full text',
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
  'hyperkalemia-severe': {
    label: 'Severe hyperkalemia',
    value: '≥6.5 mmol/L',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2023, grade: '1C', locator: 'Guideline 14.2' },
      { sourceId: UKKA, year: 2023, grade: '1B', locator: 'Guideline 16.3.1' },
    ],
    note: 'The KDIGO conference paper says no universal severity grading exists and uses an opinion-based risk figure.',
    ...CHECK_CRRT_03,
  },
  'calcium-dose': {
    label: 'IV calcium for ECG changes of hyperkalemia',
    value:
      '30 mL of 10% calcium gluconate over 10 minutes (or 10 mL of 10% calcium chloride over 5)',
    appliesTo: 'Equivalent 6.8 mmol doses. UKKA keeps calcium chloride for arrest or peri-arrest.',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2023, grade: '1C', locator: 'Guidelines 16.2a and 16.2b' },
      { sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Figure 3 footnote' },
    ],
    note: 'UKKA does not recommend calcium with a normal ECG (rationale, p. 77). The KDIGO paper quotes the European Resuscitation Council: chloride over 2–5 minutes.',
    ...CHECK_CRRT_03,
  },
  'calcium-without-ecg': {
    label: 'Potassium at which KDIGO gives calcium when no ECG is available',
    value: 'above 6.5 mmol/L',
    class: 'consensus',
    sources: [
      {
        sourceId: KDIGO_ACUTE_K,
        year: 2020,
        grade: null,
        locator: 'Treatment of hyperkalemia, Cellular membrane stabilization',
      },
    ],
    note: 'UKKA gives calcium only for ECG changes. Both are shown in CRRT-03.',
    ...CHECK_CRRT_03,
  },
  'insulin-glucose': {
    label: 'Insulin-glucose for severe hyperkalemia',
    value: '10 units of soluble insulin with 25 g glucose',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2023, grade: '1B', locator: 'Guideline 16.3.1' }],
    note: 'UKKA states further study is needed before 5 units can be recommended (p. 92). KDIGO’s algorithm uses 5 units: see insulin-low-dose.',
    ...CHECK_CRRT_03,
  },
  'insulin-low-dose': {
    label: 'Insulin dose in the KDIGO hyperkalemia algorithm',
    value: '5 units with 25 g glucose',
    class: 'consensus',
    sources: [{ sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Figure 3 footnote' }],
    note: 'The figure’s thresholds and doses are stated to be opinion based. The same paper’s text also discusses 10 units.',
    ...CHECK_CRRT_03,
  },
  'insulin-peak': {
    label: 'Peak potassium fall after insulin-glucose',
    value: '30–60 minutes',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2023, grade: null, locator: 'Rationale 16.3, p. 82' },
      { sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Reassessment' },
    ],
    ...CHECK_CRRT_03,
  },
  'rebound-window': {
    label: 'When potassium rebounds after shifting drugs',
    value: 'at 2–3 hours',
    class: 'consensus',
    sources: [{ sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Reassessment' }],
    note: 'UKKA: the fall may hold for up to 2 hours, then a gradual rebound (p. 82). Applies when potassium has not been removed from the body.',
    ...CHECK_CRRT_03,
  },
  'insulin-repeat': {
    label: 'Potassium at which UKKA considers a further insulin-glucose dose',
    value: 'still 6.0 mmol/L or higher 2 hours after the infusion',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2023, grade: null, locator: 'Rationale 16.3, p. 92' }],
    ...CHECK_CRRT_03,
  },
  'post-insulin-glucose-trigger': {
    label: 'Pre-treatment glucose that calls for a follow-on infusion',
    value: 'below 7.0 mmol/L (126 mg/dL)',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2023, grade: '2B', locator: 'Guideline 16.3.3' }],
    note: 'mg/dL is converted from the printed mmol/L.',
    ...CHECK_CRRT_03,
  },
  'post-insulin-glucose': {
    label: 'Follow-on glucose after insulin',
    value: '10% glucose at 50 mL/h for 5 hours',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2023, grade: '2B', locator: 'Guideline 16.3.3' }],
    ...CHECK_CRRT_03,
  },
  'salbutamol-dose': {
    label: 'Nebulized salbutamol for severe hyperkalemia',
    value: '10–20 mg of nebulized salbutamol',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2023, grade: '1B', locator: 'Guideline 16.4.1' },
      { sourceId: UKKA, year: 2023, grade: '1A', locator: 'Guideline 16.4.3' },
    ],
    note: 'Adjuvant only, never monotherapy. UKKA advises a lower dose and cardiac monitoring in cardiac disease (p. 96).',
    ...CHECK_CRRT_03,
  },
  'glucose-checks': {
    label: 'Blood glucose checks after insulin-glucose',
    value: 'at 0, 30, 60, 90, 120, 180, 240, 300 and 360 minutes',
    class: 'guideline',
    sources: [{ sourceId: UKKA, year: 2023, grade: '1C', locator: 'Guideline 17.2' }],
    note: 'EASL separately asks for glucose checks every 2 hours in hyperacute liver failure, with or without insulin.',
    ...CHECK_CRRT_03,
  },
  'potassium-recheck': {
    label: 'Potassium checks after treatment',
    value: 'at 1, 2, 4, 6 and 24 hours',
    class: 'guideline',
    sources: [
      { sourceId: UKKA, year: 2023, grade: '2C', locator: 'Guideline 17.1.2' },
      { sourceId: KDIGO_ACUTE_K, year: 2020, grade: null, locator: 'Reassessment' },
    ],
    note: 'KDIGO gives the first recheck at 60 minutes; UKKA gives the full series as a minimum.',
    ...CHECK_CRRT_03,
  },
  'alf-sodium-recommendation': {
    label: 'Serum sodium in acute liver failure: EASL recommendation',
    value: '140–150 mmol/L',
    class: 'guideline',
    sources: [
      {
        sourceId: EASL,
        year: 2017,
        grade: 'Evidence II-2, recommendation 1',
        locator: 'Metabolic management, recommendations, p. 1062',
      },
    ],
    note: 'The same guideline gives 140–145 mmol/L in its text and 135–145 mmol/L in Table 9.',
    ...CHECK_CRRT_03,
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
        locator: 'Therapeutic options for raised intracranial pressure',
      },
    ],
    ...CHECK_CRRT_03,
  },
  'alf-sodium-rate': {
    label: 'Fastest sodium change in acute liver failure',
    value: '10 mmol/L per 24 hours',
    class: 'guideline',
    sources: [
      { sourceId: EASL, year: 2017, grade: null, locator: 'Metabolic management, p. 1061' },
    ],
    ...CHECK_CRRT_03,
  },
  'blood-leak-normalization-floor': {
    label: 'PrisMax blood leak detector: lowest signal that can be normalized',
    value: '85%',
    class: 'device',
    sources: [manual('DEV-PM-008', 'Blood Leak Detector normalization, PDF p. 37')],
    note: 'PDF p. 37 is outside the alarm chapter this record registers; the locator is the real page.',
    ...CHECK,
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
