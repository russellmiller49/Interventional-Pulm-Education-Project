import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number Mechanical Ventilation teaches, with its source.
 *
 * Copy and components read a value from here rather than typing it. The rows were checked on
 * 2026-10-08 against the ARDS Network protocol summary card (text extracted from the PDF), the
 * PubMed records of the 2017 guideline and the 2015 driving-pressure analysis, and the supplied
 * copy of Tobin's 3rd edition. None is signed yet: `npm run numbers:signoff -- mechanical-ventilation`.
 */
const CHECK = {
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the source text',
  signedBy: null,
  signedOn: null,
} as const

const card = (locator: string): TeachingNumberCitation => ({
  sourceId: 'ardsnet-arma-2000',
  year: 2000,
  grade: null,
  locator: `Protocol summary card: ${locator}`,
})
const ATS_2017: TeachingNumberCitation = {
  sourceId: 'ats-esicm-sccm-ards-2017',
  year: 2017,
  grade: 'strong recommendation, moderate confidence',
  locator: 'Abstract, Results',
}
const asthma: TeachingNumberCitation = {
  sourceId: 'tobin-3e-severe-asthma',
  year: 2013,
  grade: null,
  locator: 'Table 30-2, p. 731',
}

export const VENTILATION_NUMBERS = defineTeachingNumbers('mechanical-ventilation', {
  'pbw-male': {
    label: 'Predicted body weight, male',
    value: '50 + 2.3 × (height in inches − 60) kg',
    class: 'consensus',
    sources: [card('Part I, step 1')],
    note: 'In centimeters: 50 + 0.91 × (height − 152.4).',
    ...CHECK,
  },
  'pbw-female': {
    label: 'Predicted body weight, female',
    value: '45.5 + 2.3 × (height in inches − 60) kg',
    class: 'consensus',
    sources: [card('Part I, step 1')],
    note: 'In centimeters: 45.5 + 0.91 × (height − 152.4).',
    ...CHECK,
  },
  'vt-ards-goal': {
    label: 'Tidal volume goal in ARDS',
    value: '6 mL/kg PBW',
    class: 'consensus',
    sources: [card('Part I, steps 3 and 4')],
    note: 'The protocol starts at 8 mL/kg and steps down by 1 mL/kg at intervals of 2 hours or less.',
    ...CHECK,
  },
  'vt-ards-range': {
    label: 'Tidal volume range in ARDS',
    value: '4–8 mL/kg PBW',
    class: 'guideline',
    sources: [ATS_2017, card('Plateau pressure goal')],
    ...CHECK,
  },
  'pplat-limit': {
    label: 'Plateau pressure limit',
    value: '≤30 cmH₂O',
    class: 'guideline',
    sources: [card('Plateau pressure goal'), ATS_2017],
    note: 'The ARDS Network card prints ≤30 cmH₂O; the 2017 guideline says below 30 cmH₂O.',
    ...CHECK,
  },
  'pplat-pause': {
    label: 'Inspiratory pause used to read a plateau',
    value: '0.5 seconds',
    class: 'consensus',
    sources: [card('Plateau pressure goal')],
    ...CHECK,
  },
  'driving-pressure-limit': {
    label: 'Driving pressure (plateau − PEEP)',
    value: '≤15 cmH₂O',
    class: 'consensus',
    sources: [
      {
        sourceId: 'amato-driving-pressure-2015',
        year: 2015,
        grade: 'observational',
        locator: 'Abstract; survival curves by driving-pressure stratum',
      },
    ],
    note: 'The analysis shows mortality rising with driving pressure. 15 cmH₂O is the ceiling most units teach from it; no trial has tested it as a target.',
    ...CHECK,
    checkedBy:
      'Claude, against the PubMed abstract only. The 15 cmH₂O figure was not read from the article; owner to confirm.',
  },
  'oxygenation-pao2': {
    label: 'Oxygenation goal, PaO₂',
    value: '55–80 mmHg',
    class: 'consensus',
    sources: [card('Oxygenation goal')],
    ...CHECK,
  },
  'oxygenation-spo2': {
    label: 'Oxygenation goal, SpO₂',
    value: '88–95%',
    class: 'consensus',
    sources: [card('Oxygenation goal')],
    ...CHECK,
  },
  'peep-minimum': {
    label: 'Minimum PEEP',
    value: '5 cmH₂O',
    class: 'consensus',
    sources: [card('Oxygenation goal')],
    ...CHECK,
  },
  'ph-goal': {
    label: 'pH goal',
    value: '7.30–7.45',
    class: 'consensus',
    sources: [card('pH goal')],
    ...CHECK,
  },
  'rate-maximum': {
    label: 'Maximum set respiratory rate',
    value: '35 breaths/min',
    class: 'consensus',
    sources: [card('Part I, step 5; acidosis management')],
    ...CHECK,
  },
  'ph-severe-acidosis': {
    label: 'pH below which tidal volume may be raised',
    value: '7.15',
    class: 'consensus',
    sources: [card('Acidosis management')],
    note: 'Below 7.15 at a rate of 35, tidal volume may rise in 1 mL/kg steps and the plateau goal may be exceeded.',
    ...CHECK,
  },
  'obstruction-vt': {
    label: 'Tidal volume in severe airflow obstruction',
    value: '7–9 mL/kg',
    class: 'expert-reference',
    sources: [asthma],
    ...CHECK,
  },
  'obstruction-rate': {
    label: 'Respiratory rate in severe airflow obstruction',
    value: '10–14 breaths/min',
    class: 'expert-reference',
    sources: [asthma],
    ...CHECK,
  },
  'obstruction-flow': {
    label: 'Inspiratory flow in severe airflow obstruction',
    value: '60–70 L/min',
    class: 'expert-reference',
    sources: [asthma],
    ...CHECK,
  },
  'obstruction-peep': {
    label: 'Set PEEP in severe asthma on controlled ventilation',
    value: '≤5 cmH₂O',
    class: 'expert-reference',
    sources: [asthma],
    ...CHECK,
  },
  'obstruction-pplat': {
    label: 'Plateau pressure goal in dynamic hyperinflation',
    value: '<30 cmH₂O, ideally ≤25',
    class: 'expert-reference',
    sources: [asthma],
    ...CHECK,
  },
  'obstruction-ph': {
    label: 'pH accepted in permissive hypercapnia for obstruction',
    value: '≥7.20',
    class: 'expert-reference',
    sources: [asthma],
    ...CHECK,
  },
})

export type VentilationNumberId = (typeof VENTILATION_NUMBERS.rows)[number]['id']

export interface PeepFio2Step {
  readonly fio2: string
  readonly peep: string
}

/** The ARDS Network card's two tables, in the order printed. */
export const PEEP_FIO2_LOWER_PEEP: readonly PeepFio2Step[] = [
  { fio2: '0.3', peep: '5' },
  { fio2: '0.4', peep: '5' },
  { fio2: '0.4', peep: '8' },
  { fio2: '0.5', peep: '8' },
  { fio2: '0.5', peep: '10' },
  { fio2: '0.6', peep: '10' },
  { fio2: '0.7', peep: '10' },
  { fio2: '0.7', peep: '12' },
  { fio2: '0.7', peep: '14' },
  { fio2: '0.8', peep: '14' },
  { fio2: '0.9', peep: '14' },
  { fio2: '0.9', peep: '16' },
  { fio2: '0.9', peep: '18' },
  { fio2: '1.0', peep: '18–24' },
]

export const PEEP_FIO2_HIGHER_PEEP: readonly PeepFio2Step[] = [
  { fio2: '0.3', peep: '5' },
  { fio2: '0.3', peep: '8' },
  { fio2: '0.3', peep: '10' },
  { fio2: '0.3', peep: '12' },
  { fio2: '0.3', peep: '14' },
  { fio2: '0.4', peep: '14' },
  { fio2: '0.4', peep: '16' },
  { fio2: '0.5', peep: '16' },
  { fio2: '0.5', peep: '18' },
  { fio2: '0.5–0.8', peep: '20' },
  { fio2: '0.8', peep: '22' },
  { fio2: '0.9', peep: '22' },
  { fio2: '1.0', peep: '22' },
  { fio2: '1.0', peep: '24' },
]

export const PEEP_FIO2_TABLE_SOURCES: readonly TeachingNumberCitation[] = [
  card('Oxygenation goal, both tables'),
  {
    sourceId: 'ardsnet-alveoli-2004',
    year: 2004,
    grade: null,
    locator: 'Higher PEEP, lower FiO₂ table',
  },
]
