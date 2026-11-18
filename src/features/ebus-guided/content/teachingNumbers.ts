import {
  defineTeachingNumbers,
  type TeachingNumberCitation,
} from '../../learning-module/numbers/teachingNumbers'

/**
 * Every clinical number EBUS Guided teaches, with its source.
 *
 * The values and locators were first recorded in the EBUS-PRE-REVIEW-05 decision packet
 * (`docs/gap-remediation/fellow-walkthrough/ebus/drafts/`), where each source was retrieved on
 * 2026-09-23. They were held there as "local protocol required" or "hold for source"; the
 * teaching-first rules of 2026-10-08 restore them.
 *
 * The owner reviewed all 26 rows on 2026-11-12: 18 acceptable as written, 7 to correct or clarify,
 * and the solid-food fasting row rejected and replaced. Each source was read again on 2026-11-14,
 * and every `checkedBy` below says what was read then: full text, an abstract, a publisher's
 * extract, or a secondary summary. None is signed yet: `npm run numbers:signoff -- ebus-guided`.
 */
const UNSIGNED = { signedBy: null, signedOn: null } as const
const CHECKED_ON = '2026-11-14'

/** CHEST 2024 (Chest 2025): the full text is behind the publisher's access check. */
const CHEST_2024_CHECKED = {
  ...UNSIGNED,
  checkedOn: CHECKED_ON,
  checkedBy:
    'Recommendation wording read 2026-11-14 on the CHEST guideline page; full text read 2026-09-23 (EBUS-PRE-REVIEW-05 packet) and not read again',
} as const
/**
 * The BF-UC190F's direction of view. It is held in the `scope-view-angle` row's note, not in a
 * row of its own, and the scope lesson prints it from here so the two cannot drift apart.
 */
export const BF_UC190F_VIEW_ANGLE = '20°'
/** The two optics rows, read again on both product pages for the owner ruling of 2026-11-14. */
const OLYMPUS_OPTICS_CHECKED = {
  ...UNSIGNED,
  checkedOn: '2026-11-18',
  checkedBy:
    'Olympus America product pages for the BF-UC180F and the BF-UC190F, Specs, read 2026-11-14 and again 2026-11-18',
} as const
/** The manufacturer's product pages, which print the specifications. */
const OLYMPUS_CHECKED = {
  ...UNSIGNED,
  checkedOn: CHECKED_ON,
  checkedBy: 'Olympus America product page, Specs, read 2026-11-14',
} as const
/** AQuIRE: the full text in PubMed Central, Results and Tables 2 to 4. */
const AQUIRE_CHECKED = {
  ...UNSIGNED,
  checkedOn: CHECKED_ON,
  checkedBy: 'Full text read 2026-11-14 (PMC3616680)',
} as const
const aquire = (locator: string): TeachingNumberCitation => ({
  sourceId: 'aquire2013',
  year: 2013,
  grade: 'registry',
  locator,
})
/** ASA 2017: the full text on the journal's site. The 2023 modular update was read as an abstract. */
const ASA_CHECKED = {
  ...UNSIGNED,
  checkedOn: CHECKED_ON,
  checkedBy:
    'ASA 2017 full text read 2026-11-14 (journal site); the 2023 modular update read as an abstract only',
} as const
const asa = (locator: string): TeachingNumberCitation => ({
  sourceId: 'asa2017',
  year: 2017,
  grade: null,
  locator,
})
/** Who the ASA intervals are written for, in the guideline's own terms. */
const ASA_POPULATION =
  'Healthy patients having an elective procedure under general anesthesia, regional anesthesia or procedural sedation. The guideline says it may not apply, or may need to be modified, for patients with conditions that affect gastric emptying (pregnancy, obesity, diabetes, hiatal hernia, reflux disease, ileus or bowel obstruction, emergency care, enteral tube feeding) and for patients whose airway may be difficult to manage'

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

/** ICS/IAB 2023, read in full on 2026-11-05 and again on 2026-11-14 (none signed yet). */
const ICS_CHECKED = {
  ...UNSIGNED,
  checkedOn: CHECKED_ON,
  checkedBy: 'ICS/IAB 2023 full text read 2026-11-14 (PMC10401980)',
} as const
const FUJIWARA_ABSTRACT = {
  ...UNSIGNED,
  checkedOn: CHECKED_ON,
  checkedBy:
    'Fujiwara 2010, PubMed abstract read 2026-11-14 (PMID 20382710); full text not read (publisher access check)',
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
    note: 'A sonographic feature associated with malignancy, not a size below which a node is left unsampled: ICS/IAB 2023 Table 6 gives size above 1 cm a sensitivity of 63 to 100% and a specificity of 5 to 81%, and states that nodal characteristics do not preclude aspiration (3A). Size was not an independent predictor in Fujiwara’s multivariate analysis.',
    ...ICS_CHECKED,
    checkedBy:
      'ICS/IAB 2023 full text read 2026-11-14 (PMC10401980); Fujiwara 2010 from its PubMed abstract only',
  },
  'node-round-ratio': {
    label: 'Long axis ÷ short axis below which a node is round',
    value: '1.5',
    class: 'guideline',
    sources: [ics('Table 5, Shape', null)],
    ...ICS_CHECKED,
  },
  'node-distinct-margin': {
    label: 'Share of the border sharply seen for a distinct margin',
    value: 'more than half',
    class: 'guideline',
    sources: [ics('Table 5, Margins', null)],
    ...ICS_CHECKED,
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
    ...ICS_CHECKED,
  },
  'cns-specificity': {
    label: 'Specificity of a coagulation necrosis sign for malignancy',
    value: '93%',
    class: 'guideline',
    sources: [ics('Sonographic nodal characteristics: Agrawal meta-analysis', null)],
    ...ICS_CHECKED,
  },
  'heterogeneous-specificity': {
    label: 'Specificity of heterogeneous echogenicity for malignancy',
    value: '82%',
    class: 'guideline',
    sources: [ics('Sonographic nodal characteristics: Agrawal meta-analysis', null)],
    ...ICS_CHECKED,
  },
  'passes-per-station': {
    label: 'Needle passes per sampling site, suspected malignancy',
    value: 'at least 4',
    class: 'guideline',
    sources: [chest2024('Recommendation 5', 'strong recommendation, very low certainty')],
    note: 'CHEST 2024 recommends four or more needle passes over three or fewer in suspected malignant disease, and the recommendation does not depend on ROSE. Taught beside AABIP 2025 Table 6, whose minimum standard for systematic staging is at least 3 passes or ROSE per nodal station (footnote: in practice at least 3, and frequently 4 or more). CHEST 2016 suggested at least 3 passes when ROSE is unavailable, an ungraded consensus statement that is now historical. ICS/IAB 2023 advises at least 3 passes per station for staging and at least 4 for diagnosis with molecular profiling (2A). A count that secures the diagnosis may not supply molecular or other ancillary testing.',
    ...CHEST_2024_CHECKED,
    checkedBy:
      'CHEST 2024 recommendation wording read 2026-11-14 on the CHEST guideline page (full text read 2026-09-23, not read again); AABIP 2025 Table 6 and its footnote read in the published PDF; ICS/IAB 2023 full text; CHEST 2016 from a secondary summary only',
  },
  'needle-gauge': {
    label: 'Needle gauge, suspected malignancy',
    value: '21G or 22G rather than 19G',
    class: 'guideline',
    sources: [chest2024('Recommendation 4', 'conditional, very low certainty')],
    ...CHEST_2024_CHECKED,
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
      ics('Number of needle agitations', 'UPP (usual practice point)'),
    ],
    note: 'CHEST 2016 describes a pass as one entry and exit of the needle, typically with 5 to 15 agitations: a description, not a recommendation. ICS/IAB 2023 recommends at least 10 agitations per pass as a usual practice point, on one trial in sarcoidosis that found no difference between 10 and 20. The lesson teaches the ICS/IAB recommendation as technique, not as proof of specimen adequacy, which depends on the material obtained and the purpose of sampling. The needle lab asks for the low end of the range as the minimum of that exercise only.',
    ...ICS_CHECKED,
    checkedBy:
      'ICS/IAB 2023 full text read 2026-11-14 (PMC10401980); CHEST 2016 full text read 2026-09-23 (EBUS-PRE-REVIEW-05 packet), on 2026-11-14 only a secondary summary',
  },
  'aspirin-continue': {
    label: 'Aspirin before EBUS-TBNA',
    value: 'may continue',
    class: 'guideline',
    sources: [ics('Antiplatelet agents', '3A')],
    ...ICS_CHECKED,
  },
  'clopidogrel-accp': {
    label: 'Clopidogrel before elective noncardiac surgery (ACCP)',
    value: 'stop 5 days before',
    appliesTo: 'Elective noncardiac surgery. The guideline makes no recommendation about EBUS-TBNA',
    class: 'guideline',
    sources: [
      {
        sourceId: 'accp2022',
        year: 2022,
        grade: 'conditional recommendation',
        locator: 'Antiplatelet recommendations (22 to 26)',
      },
    ],
    note: 'Not an interval for EBUS-TBNA. ICS/IAB 2023, which is written for EBUS-TBNA, allows continuing clopidogrel when the thrombotic risk outweighs the bleeding risk (3A). The decision depends on the planned procedure, any biopsy added to it, and the patient’s bleeding and thrombotic risk.',
    ...UNSIGNED,
    checkedOn: CHECKED_ON,
    checkedBy:
      'ACCP 2022 full text read 2026-09-23 (EBUS-PRE-REVIEW-05 packet); on 2026-11-14 the abstract and a secondary summary of its tables only. ICS/IAB 2023 full text read 2026-11-14',
  },
  'clopidogrel-bts': {
    label: 'Clopidogrel before endobronchial or transbronchial lung biopsy (BTS)',
    value: 'stop 7 days before',
    appliesTo:
      'Endobronchial biopsy and transbronchial lung biopsy at diagnostic flexible bronchoscopy. Not a requirement for EBUS-TBNA',
    class: 'guideline',
    sources: [
      {
        sourceId: 'bts2013',
        year: 2013,
        grade: 'C',
        locator: 'Summary of recommendations: antiplatelet agents',
      },
    ],
    note: 'Becomes relevant to an EBUS procedure when an endobronchial or transbronchial lung biopsy is planned in the same session. The same recommendation continues low-dose aspirin alone.',
    ...UNSIGNED,
    checkedOn: CHECKED_ON,
    checkedBy:
      'Publisher’s extract of the summary of recommendations read 2026-11-14 (clopidogrel stopped 7 days before endobronchial or transbronchial lung biopsy is considered, low-dose aspirin continued, Grade C); full text not read',
  },
  /*
   * Optics of the convex EBUS scope, added 2026-11-10 with the scope lesson (not signed). They are
   * the values the project records for this scope in `BF_UC180F_NOMINAL`
   * (src/lib/bronchoscopy-core/devices.ts), which the simulated lens uses, and they match the
   * manufacturer's product page as read on 2026-11-14.
   */
  'scope-view-angle': {
    label: 'Convex EBUS scope, direction of view',
    value: '35°',
    appliesTo: 'Olympus BF-UC180F; forward-oblique, from the long axis of the scope',
    class: 'device',
    sources: [
      {
        sourceId: 'olympus-uc180f',
        year: 2010,
        grade: null,
        locator: 'Product page, Specs: Direction of View',
      },
      {
        sourceId: 'olympus-uc190f',
        year: 2021,
        grade: null,
        locator: 'Product page, Specs: Direction of View (the BF-UC190F figure in the note)',
      },
    ],
    note: `The angle differs between scope models: the BF-UC190F looks ${BF_UC190F_VIEW_ANGLE} forward-oblique, with the same 80° field. The lesson names both models with their own figures (owner ruling of 2026-11-14) and teaches the consequence, which is larger at the steeper angle. The simulated lens uses the BF-UC180F figures.`,
    ...OLYMPUS_OPTICS_CHECKED,
  },
  'scope-field-of-view': {
    label: 'Convex EBUS scope, field of view',
    value: '80°',
    appliesTo: 'Olympus BF-UC180F',
    class: 'device',
    sources: [
      {
        sourceId: 'olympus-uc180f',
        year: 2010,
        grade: null,
        locator: 'Product page, Specs: Field of View',
      },
      {
        sourceId: 'olympus-uc190f',
        year: 2021,
        grade: null,
        locator: 'Product page, Specs: Field of View (the BF-UC190F figure in the note)',
      },
    ],
    note: 'The BF-UC190F has the same 80° field.',
    ...OLYMPUS_OPTICS_CHECKED,
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
        locator:
          'Product page, Specs: Outer Diameter; brochure OAIRES0121BRO38644, p. 4 specification table',
      },
    ],
    note: 'From the product page and brochure, not the instructions for use. The BF-UC180F is 6.9 mm at the tip.',
    ...OLYMPUS_CHECKED,
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
        locator:
          'Product page, Specs: Outer Diameter Insertion Tube; brochure OAIRES0121BRO38644, p. 4 specification table',
      },
    ],
    ...OLYMPUS_CHECKED,
  },
  'scope-channel': {
    label: 'Convex EBUS scope, working channel',
    value: '2.2 mm',
    appliesTo: 'Olympus BF-UC190F',
    class: 'device',
    sources: [
      {
        sourceId: 'olympus-uc190f',
        year: 2021,
        grade: null,
        locator: 'Product page, Specs: Channel Width',
      },
    ],
    ...OLYMPUS_CHECKED,
  },
  'complication-rate': {
    label: 'Complications within 24 hours of an EBUS-TBNA procedure (AQuIRE registry)',
    value: '1.44%',
    appliesTo:
      '19 of 1,317 patients at 6 hospitals. 474 of them had another procedure in the same session, and 187 a transbronchial lung biopsy',
    class: 'consensus',
    sources: [aquire('Results, Any Complication; Tables 2 and 3')],
    note: 'The rate of the whole procedure, not the isolated risk of needle aspiration (95% CI 0.87 to 2.24). Transbronchial lung biopsy in the same procedure was the only risk factor: 3.21% with it and 1.15% without (OR 2.85, 95% CI 1.07 to 7.59). With TBNA alone, 10 of 843 patients (1.2%).',
    ...AQUIRE_CHECKED,
  },
  /*
   * Restaging after induction therapy, added 2026-11-10 with the consolidation (not signed: the
   * owner reviews these two rows separately). The 10 studies and 558 patients are the whole
   * review, across EBUS-TBNA, EUS-FNA or both; the two values are its EBUS-TBNA-specific estimates.
   */
  'restaging-sensitivity': {
    label: 'Sensitivity of EBUS-TBNA for mediastinal restaging after induction therapy',
    value: '65%',
    appliesTo:
      'EBUS-TBNA-specific pooled estimate. The review pooled 10 studies and 558 patients restaged by EBUS-TBNA, EUS-FNA or both; negative results were confirmed surgically',
    class: 'consensus',
    sources: [
      { sourceId: 'jiang2020', year: 2020, grade: 'meta-analysis', locator: 'Abstract, Results' },
    ],
    note: '95% CI 52 to 76, for EBUS-TBNA alone (the same review gives EUS-FNA 73%). The denominator is patients with persistent nodal disease, so about one in three of them is missed; this is not a negative predictive value. The abstract does not say how many of the 558 patients had EBUS-TBNA. The 2026 ERS/ESGE/ESTS guideline pools a sensitivity of 0.64 (95% CI 0.54 to 0.73) for endosonography in restaging, which agrees, and suggests endosonography over mediastinoscopy for restaging after induction therapy (conditional recommendation, very low certainty).',
    ...UNSIGNED,
    checkedOn: CHECKED_ON,
    checkedBy:
      'PubMed abstract read 2026-11-14 (PMID 31590952); full text not read. ERS/ESGE/ESTS 2026, PICO question 5, read in full on the publisher’s site for context',
  },
  'restaging-specificity': {
    label: 'Specificity of EBUS-TBNA for mediastinal restaging after induction therapy',
    value: '99%',
    appliesTo:
      'EBUS-TBNA-specific pooled estimate. The review pooled 10 studies and 558 patients restaged by EBUS-TBNA, EUS-FNA or both; negative results were confirmed surgically',
    class: 'consensus',
    sources: [
      { sourceId: 'jiang2020', year: 2020, grade: 'meta-analysis', locator: 'Abstract, Results' },
    ],
    note: '95% CI 78 to 100, for EBUS-TBNA alone (the same review gives EUS-FNA 99%, 95% CI 90 to 100).',
    ...UNSIGNED,
    checkedOn: CHECKED_ON,
    checkedBy:
      'PubMed abstract read 2026-11-14 (PMID 31590952); full text not read. ERS/ESGE/ESTS 2026, PICO question 5, read in full on the publisher’s site for context',
  },
  'pneumothorax-rate': {
    label: 'Pneumothorax within 24 hours of an EBUS-TBNA procedure (AQuIRE registry)',
    value: '0.53%',
    appliesTo:
      '7 of 1,317 patients at 6 hospitals. 5 of the 7 had a transbronchial lung biopsy in the same session',
    class: 'consensus',
    sources: [aquire('Results, Pneumothorax; Tables 2 and 4')],
    note: 'Not the risk of EBUS-TBNA alone (95% CI 0.21 to 1.09). Pneumothorax followed 2.7% of procedures with a transbronchial lung biopsy (5 of 187) and 0.2% of those without (2 of 1,130; OR 15.49, 95% CI 2.98 to 80.46). Four of the seven needed a chest tube.',
    ...AQUIRE_CHECKED,
  },
  /*
   * Fasting. The owner rejected BTS 2013's 4 hours for food as the default for EBUS under
   * anesthesia (2026-11-12) and asked for current elective anesthesia guidance in its place. The
   * row keeps its id; its value, source and scope are new. The two solid-food intervals share one
   * row because the guideline states them in one recommendation.
   */
  'fasting-solids': {
    label: 'Fasting before elective anesthesia or procedural sedation: solid food',
    value:
      'at least 6 hours after a light meal, and typically 8 hours or more after fried or fatty food or meat',
    appliesTo: ASA_POPULATION,
    class: 'guideline',
    sources: [asa('Recommendations for Solids and Nonhuman Milk; Table 1')],
    note: 'ASA 2017: a light meal may be taken up to 6 hours before; additional fasting time, for example 8 or more hours, may be needed after fried foods, fatty foods or meat. BTS 2013 gave 4 hours for food before diagnostic flexible bronchoscopy; that is earlier bronchoscopy guidance and is not this course’s default for EBUS under anesthesia. The 2023 ASA update covers carbohydrate-containing clear liquids, chewing gum and pediatric fasting, which the 2017 guideline did not address.',
    ...ASA_CHECKED,
  },
  'fasting-clear-fluids': {
    label: 'Fasting before elective anesthesia or procedural sedation: clear liquids',
    value: '2 hours',
    appliesTo: ASA_POPULATION,
    class: 'guideline',
    sources: [
      asa('Recommendations for Clear Liquids; Table 1'),
      { sourceId: 'bts2013', year: 2013, grade: 'D', locator: 'Fasting recommendation' },
    ],
    ...ASA_CHECKED,
    checkedBy:
      'ASA 2017 full text read 2026-11-14 (journal site). The BTS 2013 fasting recommendation was not read: it is carried from the Bronchoscopy Foundations register',
  },
})

export type EbusNumberId = (typeof EBUS_NUMBERS.rows)[number]['id']
