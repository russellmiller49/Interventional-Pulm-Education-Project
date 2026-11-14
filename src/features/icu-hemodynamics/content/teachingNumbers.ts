import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number the ICU Hemodynamics module teaches that was withheld before the
 * teaching-first redo, with its source.
 *
 * Each row was read in the source text on 2026-10-08, and the leg-raise, continuous-output, wedge
 * and tamponade rows on 2026-11-01. Rows citing the pulmonary-artery-catheter reviews use records
 * already in `sources.ts`. The textbook chapters and the leg-raise papers are listed in
 * `HEMODYNAMICS_NUMBER_ONLY_SOURCES` until they are added to the source registry.
 *
 * None is signed: `npm run numbers:signoff -- icu-hemodynamics`.
 */
const CHECK = {
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the source text',
  signedBy: null,
  signedOn: null,
} as const

const CHECK_2026_11_01 = { ...CHECK, checkedOn: '2026-11-01' } as const

/** Sources cited by a number and not yet in `content/sources.ts`. */
export const HEMODYNAMICS_NUMBER_ONLY_SOURCES = [
  {
    id: 'TEXT-AHM-2021-CH6-PATD',
    title:
      'Zitzmann A, Reuter DA, Löser B. Pulmonary artery thermodilution. In: Kirov MY, Kuzkov VV, Saugel B, eds. Advanced Hemodynamic Monitoring: Basics and New Horizons. Springer; 2021:51–58.',
  },
  {
    id: 'TEXT-AHM-2021-CH24-CS',
    title:
      'Grigoryev EV, Efremov SM. Cardiogenic shock. In: Kirov MY, Kuzkov VV, Saugel B, eds. Advanced Hemodynamic Monitoring: Basics and New Horizons. Springer; 2021:235–244.',
  },
  {
    id: 'TEXT-ESICM-HM-2019-CH2-SHOCK',
    title:
      'Shock: definition and recognition. In: Pinsky MR, Teboul JL, Vincent JL, eds. Hemodynamic Monitoring. Lessons from the ICU. Springer; 2019:7–20.',
  },
  {
    id: 'TEXT-RAGOSTA-3E-CO',
    title:
      'Cardiac output and shunts. In: Ragosta M, ed. Textbook of Clinical Hemodynamics. 3rd ed. Elsevier.',
  },
  {
    id: 'TEXT-RAGOSTA-3E-CH10-PERICARDIAL',
    title:
      'Ragosta M. Pericardial and restrictive myocardial diseases. In: Ragosta M, ed. Textbook of Clinical Hemodynamics. 3rd ed. Elsevier; 2025: chapter 10.',
  },
  {
    id: 'TEXT-RAGOSTA-3E-CH8-RIGHT',
    title:
      'Ragosta M. Right-sided heart disorders. In: Ragosta M, ed. Textbook of Clinical Hemodynamics. 3rd ed. Elsevier; 2025: chapter 8.',
  },
  {
    id: 'TEXT-RAGOSTA-3E-CH11-SHOCK',
    title:
      'Taylor AM. Left ventricular hemodynamics, heart failure, shock, and mechanical circulatory support. In: Ragosta M, ed. Textbook of Clinical Hemodynamics. 3rd ed. Elsevier; 2025: chapter 11.',
  },
  {
    id: 'TEXT-ESICM-HM-2019-CH33-SEPSIS',
    title:
      'Martin C, Duclos G, Leone M. Cardiopulmonary monitoring of septic shock. In: Pinsky MR, Teboul JL, Vincent JL, eds. Hemodynamic Monitoring. Lessons from the ICU. Springer; 2019: chapter 33.',
  },
  {
    id: 'TEXT-ESICM-HM-2019-CH24-FLUID',
    title:
      'Monnet X, Teboul JL. Assessment of fluid responsiveness. In: Pinsky MR, Teboul JL, Vincent JL, eds. Hemodynamic Monitoring. Lessons from the ICU. Springer; 2019: chapter 24.',
  },
  {
    id: 'TEXT-AHM-2021-CH17-DYNAMIC',
    title:
      'Monnet X, Teboul JL. Dynamic tests. In: Kirov MY, Kuzkov VV, Saugel B, eds. Advanced Hemodynamic Monitoring: Basics and New Horizons. Springer; 2021: chapter 17.',
  },
  {
    id: 'TEXT-GIRAUD-ICU-2016-CH3',
    title:
      'Giraud R, Bendjelid K. Hemodynamic monitoring techniques. In: Hemodynamic Monitoring in the ICU. Springer; 2016: chapter 3.',
  },
  {
    id: 'LIT-MONNET-2015-PLR-RULES',
    title:
      'Monnet X, Teboul JL. Passive leg raising: five rules, not a drop of fluid! Crit Care. 2015;19:18. doi:10.1186/s13054-014-0708-5.',
  },
  {
    id: 'LIT-MONNET-2016-PLR-META',
    title:
      'Monnet X, Marik P, Teboul JL. Passive leg raising for predicting fluid responsiveness: a systematic review and meta-analysis. Intensive Care Med. 2016;42(12):1935–1947. doi:10.1007/s00134-015-4134-1.',
  },
] as const

const cite = (
  sourceId: string,
  year: number,
  locator: string,
  grade: string | null = null,
): TeachingNumberCitation => ({ sourceId, year, grade, locator })

const BOOTSMA_1 = 'pac-waveforms-part-1-2021'
const BOOTSMA_2 = 'pac-derived-part-2-2021'
const WHITENER = 'pac-review-2014'
const EMCRIT = 'emcrit-rhc-supplied-2026'
const MONNET_CHAPTER = 'TEXT-ESICM-HM-2019-CH24-FLUID'
const MONNET_RULES = 'LIT-MONNET-2015-PLR-RULES'

/** The rise in cardiac output that makes a leg raise positive: the `plr-response` row's figure. */
export const PLR_POSITIVE_RISE_PERCENT = 10

export const HEMODYNAMICS_NUMBERS = defineTeachingNumbers('icu-hemodynamics', {
  'balloon-volume': {
    label: 'Balloon inflation volume',
    value: '1.5 mL of air',
    class: 'expert-reference',
    sources: [
      cite(BOOTSMA_1, 2022, 'p. 6 and §2.3.4, p. 8'),
      cite(WHITENER, 2014, 'pp. 325 and 327'),
      cite(EMCRIT, 2024, 'Balloon inflation'),
    ],
    note: 'Air only, never liquid. The volume printed on the catheter in use is the limit.',
    ...CHECK,
  },
  'overwedge-volume': {
    label: 'A wedge tracing with less than the full balloon volume',
    value: 'a wedge at under 1–1.5 mL means the tip is too distal',
    class: 'expert-reference',
    sources: [cite(BOOTSMA_1, 2022, '§2.5.3, pp. 11–12'), cite(EMCRIT, 2024, 'Overwedging')],
    ...CHECK,
  },
  'retract-distance': {
    label: 'Pulmonary-artery tracing does not return after deflation',
    value: 'withdraw the catheter about 2 cm',
    class: 'expert-reference',
    sources: [cite(BOOTSMA_1, 2022, '§2.3.4, p. 8')],
    ...CHECK,
  },
  'flotation-ectopy': {
    label: 'Ventricular ectopy while the tip crosses the right ventricle',
    value: 'premature ventricular beats in up to 70% of insertions',
    class: 'expert-reference',
    sources: [cite(WHITENER, 2014, 'Complications, p. 327')],
    note: 'Usually benign and self-limited. Sustained ectopy: advance promptly into the pulmonary artery, or deflate and withdraw to the right atrium (same review, p. 329).',
    ...CHECK,
  },
  'pa-rupture-mortality': {
    label: 'Mortality of pulmonary-artery rupture',
    value: 'over 50% in one review and 70% in another',
    class: 'expert-reference',
    sources: [
      cite(WHITENER, 2014, 'Complications, p. 327'),
      cite(EMCRIT, 2024, 'Wedge pressure measurement carries risk'),
    ],
    note: 'Whitener 2014 gives 70%; the EMCrit review gives above 50%.',
    ...CHECK,
  },
  'injectate-volume': {
    label: 'Thermodilution injectate',
    value: '10 mL, iced',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH6-PATD', 2021, '§6.4.2, p. 56')],
    note: 'The chapter reports the highest reproducibility with 10-mL iced injectate. The volume must match the monitor’s setting.',
    ...CHECK,
  },
  'thermodilution-spread': {
    label: 'Agreement between thermodilution injections',
    value: 'within 10% of each other; discard an outlier and repeat',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH6-PATD', 2021, '§6.4.3, p. 56')],
    note: 'The same chapter notes that three injections, though usual, may be too few.',
    ...CHECK,
  },
  'bsa-dubois': {
    label: 'Body surface area (DuBois)',
    value: 'BSA (m²) = 0.007184 × weight (kg)^0.425 × height (cm)^0.725',
    class: 'physiology',
    sources: [cite('TEXT-RAGOSTA-3E-CO', 2022, 'Cardiac output and shunts, Fick section')],
    ...CHECK,
    checkedBy:
      'Claude, against the chapter text. The edition year was not confirmed from the chapter itself',
  },
  'cardiac-index-range': {
    label: 'Cardiac index',
    value: '2.5–4.0 L/min/m²',
    class: 'expert-reference',
    sources: [
      cite(BOOTSMA_2, 2022, 'Table 1, p. 18'),
      cite('TEXT-AHM-2021-CH6-PATD', 2021, 'Table 6.1, p. 53'),
    ],
    note: 'Bootsma gives 2.5–4.0; the monitoring textbook gives 2.5–4.5.',
    ...CHECK,
  },
  'svr-range': {
    label: 'Systemic vascular resistance',
    value: '800–1,200 dyn·s·cm⁻⁵',
    class: 'expert-reference',
    sources: [
      cite(BOOTSMA_2, 2022, 'Table 1, p. 18'),
      cite('TEXT-AHM-2021-CH6-PATD', 2021, 'Table 6.1, p. 53'),
    ],
    note: 'Bootsma gives 800–1,200; the monitoring textbook gives 800–1,500.',
    ...CHECK,
  },
  'svri-range': {
    label: 'Systemic vascular resistance index',
    value: '1,600–2,500 dyn·s·cm⁻⁵·m²',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH6-PATD', 2021, 'Table 6.1, p. 53')],
    note: 'SVRI = 80 × (MAP − CVP) ÷ cardiac index. The table’s printed formula puts BSA in the denominator with cardiac output, which does not reproduce its own standard values; the formula here is the standard one.',
    ...CHECK,
  },
  'pvri-range': {
    label: 'Pulmonary vascular resistance index',
    value: '160–270 dyn·s·cm⁻⁵·m²',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH6-PATD', 2021, 'Table 6.1, p. 53')],
    ...CHECK,
  },
  'cardiogenic-shock-ci': {
    label: 'Cardiac index in cardiogenic shock',
    value: 'below 2.2 L/min/m² with systolic pressure below 90 mm Hg',
    class: 'expert-reference',
    sources: [
      cite('TEXT-AHM-2021-CH24-CS', 2021, 'Table 24.2'),
      cite(EMCRIT, 2024, 'Interpretation: cardiac index'),
    ],
    note: 'The EMCrit review gives below 1.8 without support or below 2.2 with support.',
    ...CHECK,
  },
  'fluid-responsiveness': {
    label: 'Fluid responsiveness',
    value:
      'stroke volume or cardiac index up by 15% or more after 250 mL or 3 mL/kg of crystalloid',
    class: 'expert-reference',
    sources: [cite(BOOTSMA_2, 2022, 'Table 2')],
    ...CHECK,
  },
  'plr-position': {
    label: 'Leg-raise maneuver',
    value: 'from 45° semi-recumbent to trunk flat and legs at 45°',
    class: 'expert-reference',
    sources: [
      cite(MONNET_CHAPTER, 2019, '§24.5.1, p. 290, and the five rules, p. 292'),
      cite(MONNET_RULES, 2015, 'Rules 1 and 5'),
    ],
    note: 'Move the bed, not the legs by hand: pain, cough or waking can raise cardiac output on their own.',
    ...CHECK_2026_11_01,
  },
  'plr-response': {
    label: 'Positive leg raise',
    value: `cardiac output up by ${PLR_POSITIVE_RISE_PERCENT}% or more during the raise`,
    class: 'expert-reference',
    sources: [
      cite('LIT-MONNET-2016-PLR-META', 2016, 'Abstract, results'),
      cite(MONNET_CHAPTER, 2019, '§24.5.2, p. 291, and Table 24.1'),
      cite('TEXT-AHM-2021-CH17-DYNAMIC', 2021, '§17.4.2, p. 166'),
    ],
    note: 'Monnet 2016 pools the threshold at 10 ± 2%, with sensitivity 0.85 and specificity 0.91. Read on pulse pressure instead, sensitivity falls to 0.56. The 15% threshold belongs to a fluid bolus, not to a leg raise.',
    ...CHECK_2026_11_01,
    checkedBy: 'Claude, against the Monnet 2016 abstract and the text of both chapters',
  },
  'plr-timing': {
    label: 'When to read a leg raise',
    value: 'the rise comes within the first minute and can fade after it',
    class: 'expert-reference',
    sources: [
      cite(MONNET_CHAPTER, 2019, '§24.5.3, p. 292'),
      cite('TEXT-AHM-2021-CH17-DYNAMIC', 2021, '§17.4.3, pp. 166–167'),
      cite(MONNET_RULES, 2015, 'Rule 3'),
    ],
    note: 'Real-time measures: arterial pulse contour, LVOT VTI by echo or esophageal Doppler. End-tidal CO₂ up by more than 5% can stand in only when ventilation is constant. Monnet and Teboul exclude thermodilution, pulmonary or transpulmonary.',
    ...CHECK_2026_11_01,
  },
  'cco-response-time': {
    label: 'Continuous thermodilution cardiac output',
    value: 'trend CCO averages the last 4–12 min; STAT CCO updates every 30–60 s',
    class: 'expert-reference',
    sources: [cite(BOOTSMA_2, 2022, 'Delayed response in CCO measurement results')],
    note: 'After a pacing change, a significant rise on STAT CCO took at least 270 s, so neither display catches a leg raise.',
    ...CHECK_2026_11_01,
  },
  'wedge-right-versus-left-failure': {
    label: 'Wedge in right-sided and left-sided failure',
    value: 'low or normal with isolated RV failure; 15 mm Hg or more makes LV failure likely',
    class: 'expert-reference',
    sources: [
      cite(BOOTSMA_2, 2022, 'Left heart failure'),
      cite('TEXT-RAGOSTA-3E-CH11-SHOCK', 2025, 'p. 227'),
    ],
    ...CHECK_2026_11_01,
  },
  'tamponade-diastolic-pressures': {
    label: 'Diastolic pressures in tamponade',
    value:
      'equal across the chambers, typically about 20 mm Hg, but 6–12 mm Hg in low-pressure tamponade',
    class: 'expert-reference',
    sources: [
      cite('TEXT-RAGOSTA-3E-CH10-PERICARDIAL', 2025, 'pp. 193–194 and 197'),
      cite(BOOTSMA_2, 2022, 'Restrictive pathophysiology and tamponade'),
    ],
    note: 'Pressures may not equalize with a raised LV diastolic pressure, severe pulmonary hypertension or a loculated effusion (Ragosta, pp. 196–197).',
    ...CHECK_2026_11_01,
  },
  'norepinephrine-dose': {
    label: 'Norepinephrine',
    value: '0.05–0.4 μg/kg/min',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH24-CS', 2021, 'Table 24.1')],
    ...CHECK,
  },
  'vasopressin-dose': {
    label: 'Vasopressin',
    value: '0.02–0.04 U/min',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH24-CS', 2021, 'Table 24.1')],
    ...CHECK,
  },
  'epinephrine-dose': {
    label: 'Epinephrine',
    value: '0.01–0.5 μg/kg/min',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH24-CS', 2021, 'Table 24.1')],
    ...CHECK,
  },
  'dobutamine-dose': {
    label: 'Dobutamine',
    value: '2.5–20 μg/kg/min',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH24-CS', 2021, 'Table 24.1')],
    ...CHECK,
  },
  'milrinone-dose': {
    label: 'Milrinone',
    value: '0.125–0.75 μg/kg/min',
    class: 'expert-reference',
    sources: [cite('TEXT-AHM-2021-CH24-CS', 2021, 'Table 24.1')],
    ...CHECK,
  },
})

export type HemodynamicsNumberId = (typeof HEMODYNAMICS_NUMBERS.rows)[number]['id']

/**
 * The four shock profiles, as the pulmonary-artery catheter shows them.
 *
 * From Table 2.1 of the ESICM monitoring textbook (2019), with cardiac output taken from the
 * table's own grouping into low-output and high-output states. That table prints one "High" for
 * obstructive filling pressure, and the chapter's text (§2.3.1.3) means central venous pressure,
 * so the row names the RAP and `HEMODYNAMICS_OBSTRUCTIVE_PATTERNS` separates the wedge by cause.
 * Its "High" for cardiogenic is also the central venous pressure (§2.3.1.2), and the wedge is
 * normal or low when the right ventricle is the one that failed, so that row names the side and
 * `HEMODYNAMICS_CARDIOGENIC_PATTERNS` reads each one.
 */
export const HEMODYNAMICS_SHOCK_PROFILES = Object.freeze([
  {
    id: 'hypovolemic',
    label: 'Hypovolemic',
    cardiacOutput: 'Low',
    fillingPressures: 'Low',
    systemicVascularResistance: 'High',
    mixedVenousSaturation: 'Low',
    firstMove: 'Volume, and stop the loss.',
  },
  {
    id: 'cardiogenic',
    label: 'Cardiogenic',
    cardiacOutput: 'Low',
    fillingPressures: 'High on the failing side: wedge in LV failure, RAP in RV failure (below)',
    systemicVascularResistance: 'High',
    mixedVenousSaturation: 'Low',
    firstMove: 'Inotrope, a vasopressor to hold pressure, and treat the cause.',
  },
  {
    id: 'obstructive',
    label: 'Obstructive',
    cardiacOutput: 'Low',
    fillingPressures: 'RAP high; wedge depends on the cause (below)',
    systemicVascularResistance: 'High',
    mixedVenousSaturation: 'Low',
    firstMove:
      'Relieve the obstruction: drain the tamponade, decompress the chest, treat the embolus.',
  },
  {
    id: 'distributive',
    label: 'Distributive',
    cardiacOutput: 'High',
    fillingPressures: 'Low or normal',
    systemicVascularResistance: 'Low',
    mixedVenousSaturation: 'High',
    firstMove: 'Vasopressor and volume, and treat the source.',
  },
] as const)

export const HEMODYNAMICS_SHOCK_PROFILE_SOURCE = cite(
  'TEXT-ESICM-HM-2019-CH2-SHOCK',
  2019,
  'Table 2.1',
)

/**
 * Cardiogenic shock read one side of the heart at a time.
 *
 * The filling pressure that rises is the one behind the ventricle that failed. Shock from
 * right-sided failure shows a normal to low wedge (Ragosta, p. 227), so a cardiogenic case does
 * not need a high wedge.
 */
export const HEMODYNAMICS_CARDIOGENIC_PATTERNS = Object.freeze([
  {
    id: 'left-ventricular',
    label: 'Left ventricular failure',
    reading: 'Wedge high.',
    why: 'The LV empties poorly, its end-diastolic pressure rises, and the lungs congest.',
    sources: [cite('TEXT-RAGOSTA-3E-CH11-SHOCK', 2025, 'pp. 225 and 227')],
  },
  {
    id: 'right-ventricular',
    label: 'Right ventricular failure',
    reading: 'RAP high; wedge low or normal.',
    why: 'The RV passes little blood across the lungs, so the left heart is underfilled. Severe pulmonary hypertension and RV infarction are causes.',
    sources: [
      cite('TEXT-RAGOSTA-3E-CH11-SHOCK', 2025, 'p. 227'),
      cite('TEXT-RAGOSTA-3E-CH8-RIGHT', 2025, 'pp. 161 and 164'),
    ],
  },
  {
    id: 'biventricular',
    label: 'Both ventricles',
    reading: 'RAP and wedge both high.',
    why: 'Pressure rises behind each ventricle. Left heart failure is the most common cause of right heart failure.',
    sources: [
      cite('TEXT-RAGOSTA-3E-CH11-SHOCK', 2025, 'p. 225'),
      cite('TEXT-RAGOSTA-3E-CH8-RIGHT', 2025, 'p. 161'),
    ],
  },
] as const)

/**
 * Obstructive shock read one side of the heart at a time.
 *
 * The RAP is high in all three for different reasons, and the wedge differs by cause. Each reading
 * is the pressure a pulmonary-artery catheter shows; `why` is the mechanism behind it. Tension
 * pneumothorax carries no wedge because none of the sources read gives one.
 */
export const HEMODYNAMICS_OBSTRUCTIVE_PATTERNS = Object.freeze([
  {
    id: 'pulmonary-embolism',
    label: 'Massive pulmonary embolism',
    reading: `RAP and PA pressures high, RAP above the wedge. Wedge: ${HEMODYNAMICS_NUMBERS.value('wedge-right-versus-left-failure')}.`,
    why: 'The obstruction sits upstream of the left heart: little blood crosses the lungs, and the dilated RV compresses a small LV.',
    sources: [
      cite(BOOTSMA_2, 2022, 'Left heart failure'),
      cite('TEXT-RAGOSTA-3E-CH11-SHOCK', 2025, 'p. 227'),
      cite('TEXT-GIRAUD-ICU-2016-CH3', 2016, '§3.1.4, p. 47'),
      cite('TEXT-ESICM-HM-2019-CH2-SHOCK', 2019, 'Table 2.1'),
    ],
  },
  {
    id: 'tamponade',
    label: 'Cardiac tamponade',
    reading: `RAP and wedge rise together and are ${HEMODYNAMICS_NUMBERS.value('tamponade-diastolic-pressures')}. A low RAP does not exclude it.`,
    why: 'The pericardium compresses both sides of the heart through diastole, so the two sides reach the same pressure.',
    sources: [
      cite('TEXT-RAGOSTA-3E-CH10-PERICARDIAL', 2025, 'pp. 193–194 and 197'),
      cite(BOOTSMA_2, 2022, 'Restrictive pathophysiology and tamponade'),
    ],
  },
  {
    id: 'tension-pneumothorax',
    label: 'Tension pneumothorax',
    reading: 'RAP high.',
    why: 'Pleural pressure lifts the RAP and compresses both ventricles, so the transmural pressure that fills the heart is low.',
    sources: [
      cite('TEXT-ESICM-HM-2019-CH2-SHOCK', 2019, 'Table 2.1 and §2.3.1.3'),
      cite('TEXT-ESICM-HM-2019-CH33-SEPSIS', 2019, 'Table 33.1'),
    ],
  },
] as const)
