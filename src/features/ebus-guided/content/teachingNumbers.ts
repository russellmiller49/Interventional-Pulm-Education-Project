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

export const EBUS_NUMBERS = defineTeachingNumbers('ebus-guided', {
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
