import { defineTeachingNumbers } from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number the EUS-B guided course teaches, with its source.
 *
 * Each value was read from the article's PubMed abstract on 2026-11-12; no full text was read.
 * None is signed yet: `npm run numbers:signoff -- eus-b-guided`.
 */
const ABSTRACT = {
  checkedOn: '2026-11-12',
  signedBy: null,
  signedOn: null,
} as const

export const EUSB_NUMBERS = defineTeachingNumbers('eus-b-guided', {
  'added-sensitivity-eus': {
    label: 'Gain in sensitivity for N2/N3 disease from adding the esophageal route to EBUS',
    value: '0.12 (95% CI 0.08 to 0.18)',
    appliesTo: 'Mediastinal nodal staging of lung cancer; pooled across studies',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'korevaar2016',
        year: 2016,
        grade: 'systematic review and meta-analysis',
        locator: 'Abstract, Findings',
      },
    ],
    ...ABSTRACT,
    checkedBy: 'PubMed abstract (PMID 27773666); full text not read',
    note: 'The 2024 randomised trial below found a smaller difference that was not statistically significant; the lesson shows both.',
  },
  'trial-sensitivity-ebus-alone': {
    label: 'Sensitivity for N2/N3 disease with EBUS alone in the randomised trial',
    value: '75.0%',
    appliesTo: 'Known or suspected, potentially operable non-small cell lung cancer',
    class: 'expert-reference',
    sources: [
      { sourceId: 'oki2024', year: 2024, grade: 'randomised trial', locator: 'Abstract, Results' },
    ],
    ...ABSTRACT,
    checkedBy: 'PubMed abstract (PMID 39624385); full text not read',
  },
  'trial-sensitivity-combined': {
    label: 'Sensitivity for N2/N3 disease with EBUS plus EUS-B in the randomised trial',
    value: '79.3%',
    appliesTo: 'Known or suspected, potentially operable non-small cell lung cancer',
    class: 'expert-reference',
    sources: [
      { sourceId: 'oki2024', year: 2024, grade: 'randomised trial', locator: 'Abstract, Results' },
    ],
    ...ABSTRACT,
    checkedBy: 'PubMed abstract (PMID 39624385); full text not read',
    note: 'The difference from EBUS alone was not statistically significant (p = 0.698).',
  },
  'adrenal-seen-eus-b': {
    label: 'Share of patients in whom the left adrenal gland was seen with the EBUS scope',
    value: '84%',
    appliesTo: 'Patients with known or suspected lung cancer; pooled across studies',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'moretti2023',
        year: 2023,
        grade: 'systematic review and meta-analysis',
        locator: 'Abstract, Results (0.84; 95% CI 0.70 to 0.92)',
      },
    ],
    ...ABSTRACT,
    checkedBy: 'PubMed abstract (PMID 37827042); full text not read',
  },
  'adrenal-seen-eus': {
    label:
      'Share of patients in whom the left adrenal gland was seen with a gastrointestinal echoendoscope',
    value: '99%',
    appliesTo: 'Patients with known or suspected lung cancer; pooled across studies',
    class: 'expert-reference',
    sources: [
      {
        sourceId: 'moretti2023',
        year: 2023,
        grade: 'systematic review and meta-analysis',
        locator: 'Abstract, Results (0.99; 95% CI 0.90 to 1.00)',
      },
    ],
    ...ABSTRACT,
    checkedBy: 'PubMed abstract (PMID 37827042); full text not read',
  },
})

/** The words that render for a registered number. */
export const n = EUSB_NUMBERS.value
