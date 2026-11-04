import { defineTeachingNumbers } from '@/features/learning-module/numbers/teachingNumbers'

import { BOARD_NAVIGATOR_ANALYTICS_MODULE_ID } from './release'

/**
 * The numbers register: every clinical number the Navigator teaches, written once with its source.
 * Copy reads a value with `num('…')` rather than typing it, so a guideline update is one edit and a
 * value cannot drift from its source. Rows teach while they wait for the owner's signature
 * (`npm run numbers:signoff`). See `docs/teaching-first-rules.md`.
 */
const CHECK = {
  checkedOn: '2026-11-04',
  checkedBy: 'Claude, against the cited source',
  signedBy: null,
  signedOn: null,
} as const

export const BOARD_NAVIGATOR_NUMBERS = defineTeachingNumbers(BOARD_NAVIGATOR_ANALYTICS_MODULE_ID, {
  'lights-protein-ratio': {
    label: 'Light’s criteria: pleural-to-serum protein ratio for an exudate',
    value: '> 0.5',
    class: 'expert-reference',
    sources: [{ sourceId: 'light-1972', year: 1972, grade: null, locator: 'Results; criteria' }],
    ...CHECK,
  },
  'lights-ldh-ratio': {
    label: 'Light’s criteria: pleural-to-serum LDH ratio for an exudate',
    value: '> 0.6',
    class: 'expert-reference',
    sources: [{ sourceId: 'light-1972', year: 1972, grade: null, locator: 'Results; criteria' }],
    ...CHECK,
  },
  'lights-ldh-absolute': {
    label: 'Light’s criteria: pleural LDH for an exudate',
    value: '> two-thirds of the upper limit of normal for serum LDH',
    class: 'expert-reference',
    sources: [{ sourceId: 'light-1972', year: 1972, grade: null, locator: 'Results; criteria' }],
    note: 'The 1972 paper used an absolute cut-off of 200 IU/L; the two-thirds-of-normal form is the one guidelines carry forward because laboratory ranges differ.',
    ...CHECK,
  },
  'protein-gradient': {
    label:
      'Serum-minus-pleural protein gradient that reclassifies a diuresed heart-failure effusion as a transudate',
    value: '> 3.1 g/dL (31 g/L)',
    appliesTo:
      'An effusion that meets Light’s criteria for an exudate in a patient with heart failure on diuretics',
    class: 'guideline',
    sources: [
      {
        sourceId: 'bts-investigation-2010',
        year: 2010,
        grade: null,
        locator: 'Distinguishing transudates from exudates',
      },
    ],
    ...CHECK,
  },
  'albumin-gradient': {
    label:
      'Serum-minus-pleural albumin gradient that reclassifies a diuresed heart-failure effusion as a transudate',
    value: '> 1.2 g/dL (12 g/L)',
    appliesTo: 'The same situation as the protein gradient',
    class: 'guideline',
    sources: [
      {
        sourceId: 'bts-investigation-2010',
        year: 2010,
        grade: null,
        locator: 'Distinguishing transudates from exudates',
      },
    ],
    ...CHECK,
  },
  'parapneumonic-ph-drain': {
    label: 'Pleural fluid pH below which a parapneumonic effusion is drained',
    value: '< 7.2',
    class: 'guideline',
    sources: [
      {
        sourceId: 'bts-pleural-2023',
        year: 2023,
        grade: null,
        locator: 'Pleural infection: drainage',
      },
    ],
    ...CHECK,
  },
  'mist2-regimen': {
    label: 'MIST2 intrapleural regimen',
    value: 'tPA 10 mg with DNase 5 mg, twice daily for 3 days',
    appliesTo: 'Pleural infection not resolving with a chest tube and antibiotics',
    class: 'consensus',
    sources: [{ sourceId: 'mist2-2011', year: 2011, grade: null, locator: 'Methods; Results' }],
    ...CHECK,
  },
  'pleural-elastance-nel': {
    label: 'Pleural elastance that predicts failed pleurodesis (non-expandable lung)',
    value: '> 14.5 cmH₂O/L',
    class: 'expert-reference',
    sources: [{ sourceId: 'lan-1997', year: 1997, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'systematic-staging-stations': {
    label: 'Minimum stations sampled in a systematic mediastinal staging',
    value: 'stations 4R, 4L and 7',
    appliesTo: 'EBUS or combined EBUS/EUS staging of suspected or proven lung cancer',
    class: 'guideline',
    sources: [
      {
        sourceId: 'ers-esge-ests-ebus-2015',
        year: 2015,
        grade: null,
        locator: 'Recommendations on mediastinal staging',
      },
    ],
    ...CHECK,
  },
  'ct-node-enlarged': {
    label: 'CT short-axis diameter at which a mediastinal node is called enlarged',
    value: '≥ 10 mm',
    class: 'guideline',
    sources: [
      {
        sourceId: 'accp-staging-2013',
        year: 2013,
        grade: null,
        locator: 'Imaging: CT of the chest',
      },
    ],
    ...CHECK,
  },
  'ebus-node-size-feature': {
    label: 'EBUS short-axis diameter counted as a feature associated with malignancy',
    value: '> 10 mm',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'fujiwara-2010',
        year: 2010,
        grade: null,
        locator: 'Methods: sonographic features',
      },
    ],
    ...CHECK,
  },
  'fio2-thermal': {
    label: 'Inspired oxygen fraction during heat-based airway ablation',
    value: '≤ 0.40',
    class: 'guideline',
    sources: [
      {
        sourceId: 'accp-ip-procedures-2003',
        year: 2003,
        grade: null,
        locator: 'Laser and electrocautery: safety',
      },
    ],
    ...CHECK,
  },
  'apc-depth': {
    label: 'Depth of coagulation with argon plasma coagulation',
    value: '2–3 mm',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'ers-ats-ip-statement-2002',
        year: 2002,
        grade: null,
        locator: 'Argon plasma coagulation',
      },
    ],
    ...CHECK,
  },
  'tracheal-diameter-exertion': {
    label: 'Tracheal diameter below which dyspnoea appears on exertion',
    value: 'about 8 mm',
    class: 'expert-reference',
    sources: [
      { sourceId: 'ernst-cao-2004', year: 2004, grade: null, locator: 'Clinical presentation' },
    ],
    ...CHECK,
  },
  'tracheal-diameter-rest': {
    label: 'Tracheal diameter below which dyspnoea appears at rest',
    value: 'about 5 mm',
    class: 'expert-reference',
    sources: [
      { sourceId: 'ernst-cao-2004', year: 2004, grade: null, locator: 'Clinical presentation' },
    ],
    ...CHECK,
  },
  'review-intervals': {
    label: 'Spaced-review intervals after a demonstrated objective',
    value: '3, 7, 14 and 30 days',
    class: 'teaching-convention',
    sources: [],
    note: 'A Leitner-style expanding schedule chosen for the pilot. Not a validated retention model; the owner tunes it on pilot data.',
    ...CHECK,
  },
})

export type BoardNavigatorNumberId = Parameters<typeof BOARD_NAVIGATOR_NUMBERS.get>[0]

/** The words that render for a registered number. */
export function num(id: BoardNavigatorNumberId): string {
  return BOARD_NAVIGATOR_NUMBERS.value(id)
}
