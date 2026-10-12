import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical and device number the mechanical circulatory support module teaches, with its
 * source.
 *
 * The Impella rows were read from the two instructions for use on 2026-10-08, and the simulator's
 * flow at each P-level is built from the same tables (`IMPELLA_MEAN_FLOW_BY_P_LEVEL_LMIN` in
 * `engine/model.ts`). The durable-pump rows come from three chapters of one textbook, which the
 * module's source registry holds only for a different chapter; they are listed in
 * `MCS_NUMBER_ONLY_SOURCES`. No HeartMate 3 instructions for use or Abbott parameter card was
 * available locally, so no typical flow, power or pulsatility-index range is registered.
 *
 * None is signed: `npm run numbers:signoff -- mechanical-circulatory-support`.
 */
const CHECK = {
  checkedOn: '2026-10-08',
  checkedBy: 'Claude, against the source text',
  signedBy: null,
  signedOn: null,
} as const

/** Sources cited by a number and not in `content/sources.ts` as these chapters. */
export const MCS_NUMBER_ONLY_SOURCES = [
  {
    id: 'TEXT-CASE-BASED-LVAD-INPATIENT-2021',
    title:
      'Steiner J, Tran HA. LVAD inpatient management. In: Birgersdotter-Green U, Adler E, eds. Case-Based Device Therapy for Heart Failure. Springer; 2021:83–92.',
  },
  {
    id: 'TEXT-CASE-BASED-LVAD-OUTPATIENT-2021',
    title:
      'Yousefzai R, Urey M. Outpatient management of LVAD. In: Birgersdotter-Green U, Adler E, eds. Case-Based Device Therapy for Heart Failure. Springer; 2021:93–110.',
  },
  {
    id: 'TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021',
    title:
      'Perna E, Wettersten N. Evaluation and management of LVAD complications. In: Birgersdotter-Green U, Adler E, eds. Case-Based Device Therapy for Heart Failure. Springer; 2021:111–128.',
  },
] as const

const cpManual = (locator: string): TeachingNumberCitation => ({
  sourceId: 'impella-cp-ifu-rev-v-supplied',
  year: 2026,
  grade: null,
  locator,
})

const text = (
  sourceId: (typeof MCS_NUMBER_ONLY_SOURCES)[number]['id'],
  locator: string,
): TeachingNumberCitation => ({ sourceId, year: 2021, grade: null, locator })

export const MCS_NUMBERS = defineTeachingNumbers('mechanical-circulatory-support', {
  'impella-cp-flow-by-level': {
    label: 'Impella CP mean flow by P-level',
    value: 'P-2 1.1–2.1 · P-4 2.0–2.5 · P-6 2.5–2.9 · P-8 3.1–3.4 · P-9 3.3–3.7 L/min',
    class: 'device',
    sources: [cpManual('Table 5.3, p. 5.25')],
    note: 'The manual notes that flow varies with suction and position. The simulator uses the full table, P-0 to P-9.',
    ...CHECK,
  },
  'impella-cp-peak-flow': {
    label: 'Impella CP peak flow in systole at P-9',
    value: 'up to 4.3 L/min',
    class: 'device',
    sources: [cpManual('Table 5.3 footnote, p. 5.25')],
    note: 'A peak, not a mean. The mean at P-9 is 3.3–3.7 L/min.',
    ...CHECK,
  },
  'impella-55-flow-by-level': {
    label: 'Impella 5.5 mean flow by P-level',
    value: 'P-2 0–1.9 · P-4 1.9–3.3 · P-6 3.4–4.1 · P-8 4.3–4.9 · P-9 5.0–5.5 L/min',
    class: 'device',
    sources: [
      {
        sourceId: 'impella-55-ifu-rev-l-supplied',
        year: 2026,
        grade: null,
        locator: 'Table 5.3, p. 5.26',
      },
    ],
    note: 'The table gives mean flow at a 30–60 mm Hg pressure difference across the pump.',
    ...CHECK,
  },
  'heartmate3-speed-typical': {
    label: 'HeartMate 3 speed in use',
    value: '5,000–6,000 rpm; most patients settle between 5,200 and 5,600',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-INPATIENT-2021', 'pp. 83 and 90')],
    ...CHECK,
  },
  'heartmate3-speed-range': {
    label: 'HeartMate 3 speed range',
    value: '3,000–9,000 rpm',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'Table 1, p. 113')],
    note: 'A textbook table, not the instructions for use.',
    ...CHECK,
  },
  'lvad-map-goal': {
    label: 'Mean arterial pressure on a continuous-flow LVAD',
    value: '70–80 mm Hg',
    class: 'expert-reference',
    sources: [
      text('TEXT-CASE-BASED-LVAD-INPATIENT-2021', 'p. 90'),
      text('TEXT-CASE-BASED-LVAD-OUTPATIENT-2021', 'pp. 96 and 99'),
    ],
    note: 'The inpatient chapter gives 70–80. The outpatient chapter gives 60–80 for most patients and quotes the ISHLT guideline as 80. The ISHLT guideline itself was not read.',
    ...CHECK,
  },
  'lvad-map-ceiling': {
    label: 'Mean arterial pressure ceiling on a continuous-flow LVAD',
    value: 'below 90 mm Hg',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'pp. 124 and 126')],
    note: 'Stroke risk rises above 90 mm Hg. The simulator’s afterload alarm uses the same value.',
    ...CHECK,
  },
  'lvad-power-elevation': {
    label: 'Power elevation that suggests pump thrombosis',
    value: '10 W or more, or more than 2 W above baseline for over 24 hours',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'p. 116')],
    ...CHECK,
  },
  'lvad-hemolysis-markers': {
    label: 'Hemolysis markers that suggest pump thrombosis',
    value: 'LDH above 3 times the upper limit of normal, or plasma free hemoglobin above 40 mg/dL',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'p. 116')],
    ...CHECK,
  },
  'lvad-pulsatility-index': {
    label: 'Pulsatility index',
    value: '(maximum flow − minimum flow) ÷ average flow × 10',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'p. 113')],
    note: 'The lower the index, the more of the output the pump is providing.',
    ...CHECK,
  },
})

export type McsNumberId = (typeof MCS_NUMBERS.rows)[number]['id']
