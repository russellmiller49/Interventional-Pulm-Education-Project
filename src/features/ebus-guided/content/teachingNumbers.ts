import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number EBUS Guided teaches, with its source.
 *
 * The values and locators are the ones recorded in the EBUS-PRE-REVIEW-05 decision packet
 * (`docs/gap-remediation/fellow-walkthrough/ebus/drafts/`), where each source was retrieved on
 * 2026-09-23. They were held there as "local protocol required" or "hold for source"; the
 * teaching-first rules of 2026-10-08 restore them. None is signed yet:
 * `npm run numbers:signoff -- ebus-guided`.
 */
const PACKET = {
  checkedOn: '2026-09-23',
  checkedBy: 'EBUS-PRE-REVIEW-05 packet, full text read',
  signedBy: null,
  signedOn: null,
} as const
const ABSTRACT_ONLY = {
  ...PACKET,
  checkedBy: 'EBUS-PRE-REVIEW-05 packet, abstract only; full text not read',
} as const

const chest2024 = (locator: string, grade: string): TeachingNumberCitation => ({
  sourceId: 'chest2024',
  year: 2025,
  grade,
  locator,
})
const ics = (locator: string, grade: string | null): TeachingNumberCitation => ({
  sourceId: 'ics2023',
  year: 2023,
  grade,
  locator,
})

/** Lesson 16's sonographic-feature numbers, read 2026-11-05 (none signed yet). */
const FEATURES_CHECKED = {
  checkedOn: '2026-11-05',
  checkedBy:
    'ICS/IAB 2023 full text (PMC10401980), Table 5 and the sonographic-characteristics text',
  signedBy: null,
  signedOn: null,
} as const
const FUJIWARA_ABSTRACT = {
  ...FEATURES_CHECKED,
  checkedBy: 'Fujiwara 2010, PubMed abstract (PMID 20382710); full text not read',
} as const
const fujiwara = (locator: string): TeachingNumberCitation => ({
  sourceId: 'fujiwara2010',
  year: 2010,
  grade: 'retrospective cohort',
  locator,
})

export const EBUS_NUMBERS = defineTeachingNumbers('ebus-guided', {
  'node-short-axis': {
    label: 'Node short axis that favors malignancy on EBUS',
    value: 'more than 1 cm',
    class: 'guideline',
    sources: [
      ics('Table 6 and sonographic nodal characteristics', null),
      fujiwara('Abstract: size category'),
    ],
    note: 'Size was not an independent predictor in Fujiwara’s multivariate analysis.',
    ...FEATURES_CHECKED,
  },
  'node-round-ratio': {
    label: 'Long axis ÷ short axis below which a node is round',
    value: '1.5',
    class: 'guideline',
    sources: [ics('Table 5, Shape', null)],
    ...FEATURES_CHECKED,
  },
  'node-distinct-margin': {
    label: 'Share of the border sharply seen for a distinct margin',
    value: 'more than half',
    class: 'guideline',
    sources: [ics('Table 5, Margins', null)],
    ...FEATURES_CHECKED,
  },
  'fujiwara-nodes': {
    label: 'Nodes in the Fujiwara EBUS image classification study',
    value: '1,061',
    appliesTo: '487 patients with lung cancer',
    class: 'consensus',
    sources: [fujiwara('Abstract')],
    ...FUJIWARA_ABSTRACT,
  },
  'fujiwara-none-of-four': {
    label: 'Nodes not metastatic when none of the four predictive features was present',
    value: '96%',
    appliesTo: '381 of 397 nodes',
    class: 'consensus',
    sources: [fujiwara('Abstract')],
    ...FUJIWARA_ABSTRACT,
  },
  'fujiwara-any-of-four': {
    label: 'Nodes metastatic when at least one of the four predictive features was present',
    value: '43%',
    appliesTo: '285 of 664 nodes',
    class: 'consensus',
    sources: [fujiwara('Abstract')],
    ...FUJIWARA_ABSTRACT,
  },
  'chs-absent-sensitivity': {
    label: 'Sensitivity of an absent central hilar structure for malignancy',
    value: '91%',
    class: 'guideline',
    sources: [ics('Sonographic nodal characteristics: Agrawal meta-analysis', null)],
    note: 'Pooled across 29 studies (8,204 nodes), as reported by ICS/IAB 2023.',
    ...FEATURES_CHECKED,
  },
  'cns-specificity': {
    label: 'Specificity of a coagulation necrosis sign for malignancy',
    value: '93%',
    class: 'guideline',
    sources: [ics('Sonographic nodal characteristics: Agrawal meta-analysis', null)],
    ...FEATURES_CHECKED,
  },
  'heterogeneous-specificity': {
    label: 'Specificity of heterogeneous echogenicity for malignancy',
    value: '82%',
    class: 'guideline',
    sources: [ics('Sonographic nodal characteristics: Agrawal meta-analysis', null)],
    ...FEATURES_CHECKED,
  },
  'passes-per-station': {
    label: 'Needle passes per station, suspected malignancy',
    value: 'at least 4',
    class: 'guideline',
    sources: [chest2024('Recommendation 5', 'strong recommendation, very low certainty')],
    note: 'The 2016 CHEST guideline suggested at least 3 passes when ROSE is unavailable. The 2024 recommendation does not depend on ROSE.',
    ...PACKET,
  },
  'needle-gauge': {
    label: 'Needle gauge, suspected malignancy',
    value: '21G or 22G rather than 19G',
    class: 'guideline',
    sources: [chest2024('Recommendation 4', 'conditional, very low certainty')],
    ...PACKET,
  },
  'agitations-per-pass': {
    label: 'Needle movements within the node on one pass',
    value: '5 to 15',
    class: 'guideline',
    sources: [
      {
        sourceId: 'chest2016',
        year: 2016,
        grade: 'expert panel report',
        locator: 'Technical aspects: definition of a pass',
      },
      ics('Sampling technique', 'expert opinion'),
    ],
    note: 'CHEST 2016 describes a pass as one entry and exit, typically 5 to 15 agitations. ICS/IAB 2023 suggests at least 10.',
    ...PACKET,
  },
  'aspirin-continue': {
    label: 'Aspirin before EBUS-TBNA',
    value: 'may continue',
    class: 'guideline',
    sources: [ics('Antiplatelet agents', '3A')],
    ...PACKET,
  },
  'clopidogrel-accp': {
    label: 'Clopidogrel before a procedure (ACCP)',
    value: 'stop 5 days before',
    class: 'guideline',
    sources: [
      {
        sourceId: 'accp2022',
        year: 2022,
        grade: 'conditional recommendation',
        locator: 'Antiplatelet recommendations (22 to 26)',
      },
    ],
    note: 'Sources differ. ACCP 2022 writes this for elective surgery and procedures. BTS 2013 says 7 days before biopsy, in a statement that did not cover EBUS. ICS/IAB 2023 allows continuing clopidogrel for EBUS-TBNA when the thrombotic risk outweighs the bleeding risk (3A).',
    ...PACKET,
  },
  'clopidogrel-bts': {
    label: 'Clopidogrel before bronchoscopic biopsy (BTS)',
    value: 'stop 7 days before',
    class: 'guideline',
    sources: [
      { sourceId: 'bts2013', year: 2013, grade: null, locator: 'Antiplatelet recommendations' },
    ],
    ...PACKET,
    checkedBy: 'EBUS-PRE-REVIEW-05 packet, partial read; the statement excludes EBUS',
  },
  'scope-tip-diameter': {
    label: 'Convex EBUS scope, distal end',
    value: '6.6 mm',
    appliesTo: 'Olympus BF-UC190F',
    class: 'device',
    sources: [
      {
        sourceId: 'olympus-uc190f',
        year: 2021,
        grade: null,
        locator: 'Brochure OAIRES0121BRO38644, p. 4 specification table',
      },
    ],
    note: 'From the product brochure, not the instructions for use. The BF-UC180F is 6.9 mm at the tip.',
    ...PACKET,
  },
  'scope-insertion-tube': {
    label: 'Convex EBUS scope, insertion tube',
    value: '6.3 mm',
    appliesTo: 'Olympus BF-UC190F',
    class: 'device',
    sources: [
      {
        sourceId: 'olympus-uc190f',
        year: 2021,
        grade: null,
        locator: 'Brochure OAIRES0121BRO38644, p. 4 specification table',
      },
    ],
    ...PACKET,
  },
  'scope-channel': {
    label: 'Convex EBUS scope, working channel',
    value: '2.2 mm',
    appliesTo: 'Olympus BF-UC190F',
    class: 'device',
    sources: [
      { sourceId: 'olympus-uc190f', year: 2021, grade: null, locator: 'Product page, channel' },
    ],
    ...PACKET,
  },
  'complication-rate': {
    label: 'Complications of EBUS-TBNA',
    value: '1.44%',
    appliesTo: '1,317 patients at 6 hospitals',
    class: 'consensus',
    sources: [{ sourceId: 'aquire2013', year: 2013, grade: 'registry', locator: 'Abstract' }],
    note: 'Transbronchial lung biopsy in the same procedure was the only risk factor for a complication.',
    ...ABSTRACT_ONLY,
  },
  'pneumothorax-rate': {
    label: 'Pneumothorax after EBUS-TBNA',
    value: '0.53%',
    appliesTo: '1,317 patients at 6 hospitals',
    class: 'consensus',
    sources: [{ sourceId: 'aquire2013', year: 2013, grade: 'registry', locator: 'Abstract' }],
    ...ABSTRACT_ONLY,
  },
  'fasting-solids': {
    label: 'Fasting before bronchoscopy: food',
    value: '4 hours',
    class: 'guideline',
    sources: [{ sourceId: 'bts2013', year: 2013, grade: 'D', locator: 'Fasting recommendation' }],
    note: 'Not in the EBUS packet. Taken from the Bronchoscopy Foundations register (rewrite plan, row 1). An anesthesia service may require longer for solids.',
    checkedOn: '2026-10-08',
    checkedBy: 'Bronchoscopy Foundations rewrite plan register; not re-read for EBUS',
    signedBy: null,
    signedOn: null,
  },
  'fasting-clear-fluids': {
    label: 'Fasting before bronchoscopy: clear fluids',
    value: '2 hours',
    class: 'guideline',
    sources: [{ sourceId: 'bts2013', year: 2013, grade: 'D', locator: 'Fasting recommendation' }],
    checkedOn: '2026-10-08',
    checkedBy: 'Bronchoscopy Foundations rewrite plan register; not re-read for EBUS',
    signedBy: null,
    signedOn: null,
  },
})

export type EbusNumberId = (typeof EBUS_NUMBERS.rows)[number]['id']
