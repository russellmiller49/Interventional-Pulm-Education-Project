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
  'ebus-node-sampling-threshold': {
    label: 'Short-axis size at which a node seen on EBUS is sampled during staging',
    value: '≥ 5 mm',
    appliesTo:
      'Systematic EBUS staging of suspected lung cancer; separate from the CT size at which a node is called enlarged',
    class: 'guideline',
    sources: [
      {
        sourceId: 'accp-staging-2013',
        year: 2013,
        grade: null,
        locator: 'Invasive staging: EBUS-TBNA recommendations',
      },
    ],
    ...CHECK,
  },
  'ebus-passes-plateau': {
    label:
      'Passes per station after which EBUS diagnostic yield plateaus without on-site evaluation',
    value: '3',
    class: 'expert-reference',
    sources: [{ sourceId: 'lee-passes-2008', year: 2008, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'ebus-passes-molecular': {
    label: 'Passes per target recommended when molecular testing is planned',
    value: 'at least 4',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'yarmus-molecular-passes-2013',
        year: 2013,
        grade: null,
        locator: 'Results; Discussion',
      },
    ],
    ...CHECK,
  },
  'ebus-molecular-adequacy': {
    label: 'Proportion of EBUS-TBNA samples adequate for EGFR and ALK testing',
    value: '≈ 94 %',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'labarca-molecular-adequacy-2018',
        year: 2018,
        grade: null,
        locator: 'Pooled estimates',
      },
    ],
    ...CHECK,
  },
  'ctbna-vs-ebus': {
    label: 'Conventional TBNA compared with EBUS-TBNA by station',
    value: 'EBUS-TBNA higher yield at every station except the subcarinal station (7)',
    class: 'expert-reference',
    sources: [{ sourceId: 'herth-ctbna-ebus-2004', year: 2004, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'rose-effect': {
    label: 'What rapid on-site evaluation changes during EBUS-TBNA',
    value:
      'no change in diagnostic yield or procedure time; about one fewer needle pass per target and fewer additional procedures',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'sehgal-rose-meta-2018',
        year: 2018,
        grade: null,
        locator: 'Pooled risk difference; secondary outcomes',
      },
    ],
    ...CHECK,
  },
  'needle-gauge-effect': {
    label: '21-gauge compared with 22-gauge EBUS needles',
    value: 'no difference in diagnostic yield or sample adequacy',
    class: 'expert-reference',
    sources: [
      { sourceId: 'yarmus-needle-gauge-2013', year: 2013, grade: null, locator: 'Results' },
    ],
    ...CHECK,
  },
  'suction-effect': {
    label: 'Suction compared with capillary sampling during EBUS-TBNA',
    value: 'no difference in adequacy, diagnosis or sample quality',
    class: 'expert-reference',
    sources: [{ sourceId: 'casal-suction-2012', year: 2012, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'sarcoid-ebus-yield': {
    label: 'Granuloma detection by EBUS-TBNA in sarcoidosis, alone and with transbronchial biopsy',
    value:
      'about 75 % alone; the addition of transbronchial lung biopsy raises the combined yield to about 90 %',
    class: 'expert-reference',
    sources: [{ sourceId: 'gupta-sarcoid-ebus-2014', year: 2014, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'cytology-sensitivity': {
    label: 'Sensitivity of pleural fluid cytology for malignancy',
    value:
      'about 60 % on a first sample; a second sample adds about a quarter of the remaining cases; a third adds little',
    class: 'guideline',
    sources: [
      {
        sourceId: 'bts-investigation-2010',
        year: 2010,
        grade: null,
        locator: 'Pleural fluid cytology',
      },
    ],
    ...CHECK,
  },
  'thoracoscopy-sensitivity': {
    label: 'Sensitivity of thoracoscopic pleural biopsy for malignancy',
    value: 'about 93 %',
    class: 'guideline',
    sources: [
      { sourceId: 'bts-investigation-2010', year: 2010, grade: null, locator: 'Thoracoscopy' },
    ],
    ...CHECK,
  },
  'mist1-streptokinase': {
    label: 'Effect of intrapleural streptokinase on death or surgery in pleural infection',
    value: 'none: no reduction in death or surgical referral at 3 months',
    class: 'consensus',
    sources: [{ sourceId: 'mist1-2005', year: 2005, grade: null, locator: 'Primary outcome' }],
    ...CHECK,
  },
  'empyema-tube-size': {
    label: 'Chest tube size and outcome in pleural infection',
    value:
      'no difference in death or surgery between tubes under and over 20F; less pain with the smaller tube',
    class: 'expert-reference',
    sources: [{ sourceId: 'mist1-tube-size-2010', year: 2010, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'mist2-completion': {
    label: 'Proportion of MIST2 participants who received all six doses',
    value: 'about two-thirds (67 %)',
    appliesTo:
      'The reason the consensus statement individualises the number of doses to clinical and radiographic response',
    class: 'consensus',
    sources: [
      { sourceId: 'mist2-2011', year: 2011, grade: null, locator: 'Results: treatment received' },
      {
        sourceId: 'chaddha-consensus-2021',
        year: 2021,
        grade: null,
        locator: 'Recommendation on duration and number of doses',
      },
    ],
    ...CHECK,
  },
  'time1-findings': {
    label: 'TIME1: analgesia and chest tube size for talc pleurodesis',
    value:
      'NSAIDs non-inferior to opiates for pleurodesis at 3 months; 12F tubes gave slightly less pain but did not meet non-inferiority against 24F',
    class: 'consensus',
    sources: [{ sourceId: 'time1-2015', year: 2015, grade: null, locator: 'Primary outcomes' }],
    ...CHECK,
  },
  'ipc-hospital-days': {
    label: 'Hospital time with an indwelling catheter compared with talc pleurodesis',
    value:
      'median initial stay 0 vs 4 days (TIME2); median 10 vs 12 hospital days over a year (AMPLE); breathlessness relief the same',
    class: 'consensus',
    sources: [
      { sourceId: 'time2-2012', year: 2012, grade: null, locator: 'Secondary outcomes' },
      { sourceId: 'ample-2017', year: 2017, grade: null, locator: 'Primary outcome' },
    ],
    ...CHECK,
  },
  'tapps-failure': {
    label: 'TAPPS: pleurodesis failure at 90 days, poudrage vs slurry',
    value: '22 % vs 24 %, no difference; costs equal',
    class: 'consensus',
    sources: [{ sourceId: 'tapps-2020', year: 2020, grade: null, locator: 'Primary outcome' }],
    ...CHECK,
  },
  'mpe-cost-by-survival': {
    label: 'Most cost-effective definitive treatment of malignant effusion by expected survival',
    value:
      'indwelling catheter when survival is short (about 3 months or less); bedside pleurodesis when survival exceeds about 12 months',
    class: 'expert-reference',
    sources: [{ sourceId: 'puri-cost-2012', year: 2012, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'ipc-infection-rate': {
    label: 'Pleural infection with an indwelling catheter for malignant effusion',
    value:
      'about 5 % (4.9 % in the multicentre series; 0–12 % across reports); most treated with the catheter left in',
    class: 'expert-reference',
    sources: [{ sourceId: 'fysh-ipc-infection-2013', year: 2013, grade: null, locator: 'Results' }],
    ...CHECK,
  },
  'hepatic-hydrothorax-ipc-infection': {
    label: 'Pleural infection with an indwelling catheter for hepatic hydrothorax',
    value:
      '10 %, about double the rate in malignant effusion; mortality from catheter infection about 2.5 %',
    class: 'expert-reference',
    sources: [
      { sourceId: 'shojaee-hepatic-hydrothorax-2019', year: 2019, grade: null, locator: 'Results' },
    ],
    ...CHECK,
  },
  'lent-score': {
    label: 'LENT score components and risk bands for survival in malignant effusion',
    value:
      'pleural LDH, ECOG, serum neutrophil-to-lymphocyte ratio, tumour type; low 0–1, moderate 2–4, high 5–7',
    class: 'expert-reference',
    sources: [{ sourceId: 'lent-2014', year: 2014, grade: null, locator: 'Score derivation' }],
    ...CHECK,
  },
  'rapid-score': {
    label: 'RAPID score components and risk bands for mortality in pleural infection',
    value:
      'renal (urea), age, purulence, infection source, dietary (albumin); low 0–2, medium 3–4, high 5–7',
    class: 'expert-reference',
    sources: [{ sourceId: 'rapid-2014', year: 2014, grade: null, locator: 'Score derivation' }],
    ...CHECK,
  },
  'thoracentesis-coagulopathy': {
    label: 'Bleeding after ultrasound-guided thoracentesis without correcting INR or platelets',
    value:
      'no haemorrhagic complication requiring transfusion in 1,009 procedures, including INR > 1.5 and platelets < 50 × 10⁹/L',
    class: 'expert-reference',
    sources: [
      { sourceId: 'hibbert-thrombocytopenia-2013', year: 2013, grade: null, locator: 'Results' },
    ],
    ...CHECK,
  },
  'psp-recurrence': {
    label: 'Recurrence after a first primary spontaneous pneumothorax',
    value: '16–52 % across series, most within the first year',
    class: 'consensus',
    sources: [
      {
        sourceId: 'accp-pneumothorax-2001',
        year: 2001,
        grade: null,
        locator: 'Background: recurrence',
      },
    ],
    ...CHECK,
  },
  'tnm8-t3-separate-nodule': {
    label: 'T descriptor for a separate tumour nodule in the same lobe as the primary',
    value: 'T3 (same lobe); T4 for a different ipsilateral lobe; M1a for the contralateral lung',
    class: 'consensus',
    sources: [
      { sourceId: 'tnm8-detterbeck-2017', year: 2017, grade: null, locator: 'T descriptors' },
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
