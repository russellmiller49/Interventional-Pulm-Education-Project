import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number the ICU Hemodynamics module teaches that was withheld before the
 * teaching-first redo, with its source.
 *
 * Each row was read in the source text on 2026-10-08. Rows citing the pulmonary-artery-catheter
 * reviews use records already in `sources.ts`. The textbook chapters are listed in
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
 * table's own grouping into low-output and high-output states.
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
    fillingPressures: 'High',
    systemicVascularResistance: 'High',
    mixedVenousSaturation: 'Low',
    firstMove: 'Inotrope, a vasopressor to hold pressure, and treat the cause.',
  },
  {
    id: 'obstructive',
    label: 'Obstructive',
    cardiacOutput: 'Low',
    fillingPressures: 'High',
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
