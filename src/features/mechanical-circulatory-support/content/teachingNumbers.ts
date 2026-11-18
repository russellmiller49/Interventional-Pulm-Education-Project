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
 * `engine/model.ts`). The four echo-position rows were read from chapters 5 and 7 of the same two
 * manuals on 2026-11-03; neither manual names an apical view, so none is taught. The five rows for
 * telling an adequate circulation from arrest on an LVAD were read on 2026-11-03 from four sources:
 * the 2024 British societies guideline (full text and recommendation tables in PubMed Central), and
 * the supplied ERC 2025, AHA 2025 and AHA 2017 PDFs. Where they differ the row prints both values,
 * each with its own citation and grade. The durable-pump
 * rows come from three chapters of one textbook, which the
 * module's source registry holds only for a different chapter; they are listed in
 * `MCS_NUMBER_ONLY_SOURCES`. No HeartMate 3 instructions for use or Abbott parameter card was
 * available locally, so no typical flow or power range is registered. The pulsatility-index row
 * and the manufacturer's speed range rest on Abbott's two-page clinician card, read on 2026-11-18.
 *
 * Fourteen rows are signed, by the owner's written ruling of 2026-11-12 (see
 * `SIGNED_BY_OWNER_DECISION_2026_11_12`); the five he asked to have corrected are not. Unsigned
 * rows: `npm run numbers:signoff -- mechanical-circulatory-support`.
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

const ECHO_CHECK = { ...CHECK, checkedOn: '2026-11-03' } as const

const cpManual = (locator: string): TeachingNumberCitation => ({
  sourceId: 'impella-cp-ifu-rev-v-supplied',
  year: 2026,
  grade: null,
  locator,
})

const manual55 = (locator: string): TeachingNumberCitation => ({
  sourceId: 'impella-55-ifu-rev-l-supplied',
  year: 2026,
  grade: null,
  locator,
})

const text = (
  sourceId: (typeof MCS_NUMBER_ONLY_SOURCES)[number]['id'],
  locator: string,
): TeachingNumberCitation => ({ sourceId, year: 2021, grade: null, locator })

const PERFUSION_CHECK = { ...CHECK, checkedOn: '2026-11-03' } as const

/** Rows re-read against their sources for the owner's register ruling of 2026-11-12. */
const MCS_RECHECK = { checkedOn: '2026-11-18' } as const

/**
 * The owner's signature for the 14 rows he named in his written ruling of 2026-11-12
 * (`mcs-register-signoff`): the seven Impella device rows, the two HeartMate 3 speed rows and the
 * five LVAD resuscitation rows, "provided the original source citations remain verified". Each was
 * re-read against its source on 2026-11-18 and all verified; he confirmed on 2026-11-18 that the
 * rows that verify are to carry his signature. Claude applied it row by row. `checkedBy` says who
 * read the source; the signature does not claim he re-read it. The five rows he asked to have
 * corrected are not signed, and no shared CHECK object is.
 */
const SIGNED_BY_OWNER_DECISION_2026_11_12 = {
  signedBy: 'Russell Miller, written decision of 2026-11-12 (sources checked by Claude)',
  signedOn: '2026-11-12',
} as const

const IMPELLA_RECHECK = {
  ...MCS_RECHECK,
  checkedBy:
    'Claude, against the two manuals (Impella CP with SmartAssist, document 0048-9007 rV, and Impella 5.5 with SmartAssist, document 10003049 rL, both February 2026): first read on 2026-10-08 or 2026-11-03, re-verified page by page on 2026-11-18',
} as const

const PERFUSION_RECHECK = {
  ...MCS_RECHECK,
  checkedBy:
    'Claude, against the British guideline (full text and recommendation tables, PMC11018667), ERC 2025, AHA 2025 and AHA 2017 (text and the algorithm figures): first read on 2026-11-03, re-verified on 2026-11-18',
} as const

/** The 2023 ISHLT durable-support guideline, read in the society's own PDF on 2026-11-18. */
const ishlt = (grade: string | null, locator: string): TeachingNumberCitation => ({
  sourceId: 'ishlt-durable-mcs-2023',
  year: 2023,
  grade,
  locator,
})

/** Abbott's two-page HeartMate 3 pump-parameter card (MAT-2007803 v3.0), page 1. */
const abbottCard = (locator: string): TeachingNumberCitation => ({
  sourceId: 'abbott-heartmate3-pump-parameters-card',
  year: 2025,
  grade: null,
  locator,
})

const lvadEmergencyGuideline = (locator: string, grade: string): TeachingNumberCitation => ({
  sourceId: 'bsg-lvad-emergencies-2024',
  year: 2024,
  grade,
  locator,
})

/** The four signs of an adequate circulation sit in one paragraph, under one recommendation. */
const adequacyParagraph = lvadEmergencyGuideline(
  '“Determination of adequacy of circulation”, and the recommendation table that closes that section: adequacy is judged on several physiological parameters, not pulse alone',
  'Class I, Level C',
)

/** ERC 2025 prints no strength for its LVAD statements; the supplied PDF's printed pages. */
const ercLvad = (locator: string): TeachingNumberCitation => ({
  sourceId: 'erc-2025-special-circumstances',
  year: 2025,
  grade: null,
  locator,
})
const ercFigure18 = ercLvad(
  'Fig. 18, Left ventricular assist device ALS algorithm, p. 40: the signs of circulatory failure',
)

/** AHA 2025 Part 10, “Left Ventricular Assist Devices”: its synopsis and Figure 4. */
const aha2025Lvad = (locator: string, grade: string): TeachingNumberCitation => ({
  sourceId: 'aha-2025-special-circumstances',
  year: 2025,
  grade,
  locator,
})
const aha2025Adequacy = aha2025Lvad(
  'Synopsis, p. S618, perfusion adequate if any one sign is present; Figure 4, p. S619, the algorithm of recommendation 3',
  'COR 2b, LOE C-EO',
)

/** The 2017 AHA scientific statement prints consensus guidance without a class or level. */
const aha2017Algorithm: TeachingNumberCitation = {
  sourceId: 'aha-cpr-mcs-statement-2017',
  year: 2017,
  grade: null,
  locator:
    'Consensus-derived guidance for EMS, pp. e1123–e1124, and Figure 6, p. e1124; end-tidal CO₂ as a perfusion marker, p. e1122',
}

export const MCS_NUMBERS = defineTeachingNumbers('mechanical-circulatory-support', {
  'impella-cp-flow-by-level': {
    label: 'Impella CP mean flow by P-level',
    value: 'P-2 1.1–2.1 · P-4 2.0–2.5 · P-6 2.5–2.9 · P-8 3.1–3.4 · P-9 3.3–3.7 L/min',
    class: 'device',
    sources: [cpManual('Table 5.3, p. 5.25')],
    note: 'The manual notes that flow varies with suction and position. The simulator uses the full table, P-0 to P-9.',
    ...CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'impella-cp-peak-flow': {
    label: 'Impella CP peak flow in systole at P-9',
    value: 'up to 4.3 L/min',
    class: 'device',
    sources: [cpManual('Table 5.3 footnote, p. 5.25')],
    note: 'A peak, not a mean. The mean at P-9 is 3.3–3.7 L/min.',
    ...CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'impella-55-flow-by-level': {
    label: 'Impella 5.5 mean flow by P-level',
    value: 'P-2 0–1.9 · P-4 1.9–3.3 · P-6 3.4–4.1 · P-8 4.3–4.9 · P-9 5.0–5.5 L/min',
    class: 'device',
    sources: [manual55('Table 5.3, p. 5.26')],
    note: 'The table gives mean flow at a 30–60 mm Hg pressure difference across the pump.',
    ...CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'impella-cp-inlet-depth': {
    label: 'Impella CP, aligned',
    value: 'inlet 3.5 cm below the aortic valve annulus; 3 cm in a small ventricle',
    appliesTo: 'A long-axis echo view: parasternal long axis on TTE, long axis on TEE',
    class: 'device',
    sources: [
      cpManual(
        'p. 7.5, “Correct Impella Catheter Position”; p. 7.10, post-insertion positioning checklist, step 3; p. 5.16, “Positioning in Small Hearts”',
      ),
    ],
    note: 'Both values are the manual’s own: 3.5 cm is the target, and the insertion chapter allows 3 cm rather than 3.5 cm when the ventricular cavity is small.',
    ...ECHO_CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'impella-cp-inlet-too-deep': {
    label: 'Impella CP, too deep',
    value: 'inlet more than 4 cm below the aortic valve',
    appliesTo: 'A long-axis echo view, with the outlet across or near the aortic valve',
    class: 'device',
    sources: [
      cpManual(
        'p. 7.5, “Impella Catheter Too Far into the Left Ventricle”; Figures 7.2b and 7.3b, pp. 7.7–7.8',
      ),
    ],
    ...ECHO_CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'impella-55-inlet-depth': {
    label: 'Impella 5.5, aligned',
    value: 'cannula bend at the aortic valve annulus, inlet about 5 cm into the ventricle',
    appliesTo: 'A long-axis echo view: parasternal long axis on TTE, long axis on TEE',
    class: 'device',
    sources: [
      manual55(
        'p. 7.6, “Correct Impella Catheter Position”; p. 7.11, post-insertion positioning checklist, step 3',
      ),
    ],
    note: 'The echo section says approximately 5 cm; the checklist says 5.0 cm below the aortic valve. The manual gives no centimetre figure for too deep: it reads too deep as a cannula bend past the annulus.',
    ...ECHO_CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'impella-reposition-p-level': {
    label: 'Performance level while the position is corrected',
    value: 'P-2',
    class: 'device',
    sources: [
      cpManual(
        'p. 7.12, catheter fully in ventricle, action 1; p. 7.13, repositioning guide, step 1; p. 7.16, catheter in aorta, action 1; Table 7.1, p. 7.19, hemolysis with the pump out of position',
      ),
      manual55(
        'p. 7.13, catheter fully in ventricle, action 1, and repositioning guide, step 1; p. 7.16, catheter in aorta, action 1',
      ),
    ],
    note: 'Both manuals bring the level to P-2 before the catheter is moved, move it under imaging, and return to the working level afterwards. The CP hemolysis table gives P-2 while repositioning is delayed.',
    ...ECHO_CHECK,
    ...IMPELLA_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'heartmate3-speed-typical': {
    label: 'HeartMate 3 typical operating speed',
    value: '5,000–6,000 rpm; most patients settle between 5,200 and 5,600',
    class: 'expert-reference',
    sources: [text('TEXT-CASE-BASED-LVAD-INPATIENT-2021', 'pp. 83 and 90')],
    note: 'Typical speeds in use, from a textbook chapter. The range the manufacturer allows is the row heartmate3-speed-range.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the textbook (p. 83, typical speeds 5000–6000 rpm; p. 90, 5,200–5,600 rpm), 2026-11-18',
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'heartmate3-speed-range': {
    label: 'HeartMate 3 speed: the manufacturer’s adjustable range',
    value: '3,000–9,000 rpm',
    class: 'expert-reference',
    sources: [
      abbottCard('Pump Parameter Overview, Speed: fixed speed range'),
      text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'Table 1, p. 113'),
    ],
    note: 'The manufacturer’s clinician card (which calls it the fixed speed range) and the textbook table agree. The card was added as a source on 2026-11-18 so that the range is the manufacturer’s; it is not the instructions for use. The speeds patients run at are the row heartmate3-speed-typical.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the Abbott card (page 1, read on the manufacturer’s site) and the textbook table (p. 113), 2026-11-18',
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'lvad-map-goal': {
    label: 'Mean arterial pressure goal on a continuous-flow LVAD',
    value: '75–90 mm Hg',
    appliesTo:
      'A treatment goal for a patient supported on a continuous-flow LVAD. Not the line for an adequate circulation in an emergency, which is the row lvad-adequate-map.',
    class: 'guideline',
    sources: [
      ishlt(
        'Class IIa, Level B',
        'Recommendations for hypertension management with durable support, p. e141: a mean arterial pressure goal of 75 to 90 mm Hg on a continuous-flow LVAD. Also the early postoperative recommendation, Class I, Level C, p. e64, and the text on pp. e83 and e99',
      ),
    ],
    note: 'Corrected on the owner’s ruling of 2026-11-12: the 2023 ISHLT guideline gives 75 to 90 mm Hg. It read 70–80 mm Hg before, which is one textbook chapter’s narrower target (Steiner and Tran, inpatient chapter, p. 90); the outpatient chapter gives 60–80 for most patients (pp. 96 and 99). Those chapters are no longer cited for the value, because they do not print it. ISHLT notes more stroke and pump thrombosis above 90 mm Hg and more deaths and renal failure below 75 mm Hg on second-generation pumps (p. e82). Returned unsigned for his review.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the 2023 ISHLT guideline (pp. e64, e82, e83, e99 and e141; the society’s own PDF) and the textbook (p. 90), 2026-11-18',
  },
  'lvad-map-ceiling': {
    label: 'Mean arterial pressure generally avoided on a continuous-flow LVAD',
    value: 'sustained above 90 mm Hg',
    appliesTo:
      'A level to avoid over time, weighed with the patient in front of you. Not a requirement that every reading be under 90 mm Hg.',
    class: 'expert-reference',
    sources: [
      ishlt(
        null,
        'Hypotension in the postoperative period outside the ICU, p. e82 (text): more stroke and pump thrombosis on second-generation LVADs with a MAP above 90 mm Hg',
      ),
      text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'pp. 124 and 126'),
    ],
    note: 'Corrected on the owner’s ruling of 2026-11-12; it read "below 90 mm Hg" before. The simulator’s afterload alarm fires above the same 90 mm Hg. Returned unsigned for his review.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the 2023 ISHLT guideline (p. e82), 2026-11-18; the textbook pages were not re-read',
  },
  'lvad-power-elevation': {
    label: 'Power changes that raise suspicion of pump thrombosis',
    value: '10 W or more, or more than 2 W above baseline for over 24 hours',
    appliesTo:
      'Warning signs, not diagnostic criteria. Read against this patient’s own baseline and this pump, with the clinical picture, the hemolysis markers and the pump’s log.',
    class: 'expert-reference',
    sources: [
      text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'p. 116'),
      abbottCard(
        'Pump Parameter Overview, Power: rising power may signal thrombus or aortic insufficiency; report power of 10.0 W or more',
      ),
    ],
    note: 'Qualified on the owner’s ruling of 2026-11-12; the thresholds are unchanged. The textbook gives both figures as "asymptomatic sustained power elevations". The Abbott card asks for power of 10.0 W or more to be reported and adds that a gradual fall in power may mean obstruction to flow. ISHLT gives no power threshold; for suspected thrombosis it recommends device interrogation with log-file analysis, laboratory tests and echocardiography in the first evaluation (Class I, Level B, pp. e95–e96), so it is not cited for the figures. Returned unsigned for his review.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the textbook (p. 116), the Abbott card (page 1) and the 2023 ISHLT guideline (pp. e94–e96), 2026-11-18',
  },
  'lvad-hemolysis-markers': {
    label: 'Hemolysis markers that raise suspicion of pump thrombosis',
    value:
      'an LDH rising above the usual baseline for that pump (about 2.5 times the upper limit of normal is taken as significant on a HeartMate II, less on a centrifugal pump), or plasma free hemoglobin above 40 mg/dL',
    appliesTo:
      'Markers that support the suspicion. Neither is required for the diagnosis, and neither makes it alone.',
    class: 'expert-reference',
    sources: [
      ishlt(
        null,
        'Diagnosis of device thrombosis, p. e95 (text): LDH baselines differ by pump; 2.5 times the upper limit of normal for the HeartMate II, lower thresholds for centrifugal pumps',
      ),
      text('TEXT-CASE-BASED-LVAD-COMPLICATIONS-2021', 'p. 116'),
    ],
    note: 'Corrected on the owner’s ruling of 2026-11-12; it read "LDH above 3 times the upper limit of normal, or plasma free hemoglobin above 40 mg/dL" before, the textbook’s figures. ISHLT ties the 2.5 times figure to the HeartMate II and says lower thresholds apply to centrifugal pumps, the HeartMate 3 among them; it gives no number for those and none for plasma free hemoglobin, which stays on the textbook. No screen prints this row yet. Returned unsigned for his review.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the 2023 ISHLT guideline (pp. e95–e96) and the textbook (p. 116), 2026-11-18',
  },
  'lvad-pulsatility-index': {
    label: 'Pulsatility index on a HeartMate 3',
    value:
      'the size of the pulses in the pump’s flow estimate with each heartbeat, averaged over 15-second intervals; observed clinical range 1–10',
    appliesTo:
      'The HeartMate 3. Patient-specific: read it against the patient’s own baseline and with speed, power and flow.',
    class: 'expert-reference',
    sources: [
      abbottCard(
        'Pump Parameter Overview, Pulsatility Index: flow pulses measured and averaged over 15-second intervals; observed clinical range 1–10. Flow: an estimate calculated from speed, power and hematocrit',
      ),
    ],
    note: 'Corrected on the owner’s ruling of 2026-11-12; it read "(maximum flow − minimum flow) ÷ average flow × 10" before, the textbook’s formula (p. 113), which is no longer given as the HeartMate 3 calculation or cited. The Abbott card says the flow pulses “are measured” and averaged over 15-second intervals, and the same card says the flow is an estimate calculated from speed, power and hematocrit; “flow estimate” in the value joins those two statements and is this register’s wording, not the card’s. ISHLT 2023 also calls pulsatility the size of the flow pulse (p. e89). The owner describes the index as normalized fluctuations in pump power over about 15 seconds; no document read here says power or normalized, and the instructions for use, which would settle it, were not available. The range 1–10 is the card’s observed clinical range, which he asked for in his model-constants ruling; the simulator can display values below 1. A clinician card, not the instructions for use. Returned unsigned for his review.',
    ...CHECK,
    ...MCS_RECHECK,
    checkedBy:
      'Claude, against the Abbott card (page 1, read on the manufacturer’s site), the 2023 ISHLT guideline (p. e89) and the textbook (p. 113), 2026-11-18',
  },
  'lvad-adequate-capillary-refill': {
    label: 'Capillary refill in an adequate circulation',
    value: 'under 3 seconds',
    appliesTo:
      'An adult with a continuous-flow LVAD, read with the other signs of an adequate circulation',
    class: 'guideline',
    sources: [adequacyParagraph, ercFigure18],
    note: 'ERC 2025 lists a capillary refill over 3 seconds among the signs of circulatory failure. AHA 2017 and AHA 2025 ask for a normal capillary refill and give no figure.',
    ...PERFUSION_CHECK,
    ...PERFUSION_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'lvad-adequate-map': {
    label: 'Mean arterial pressure in an adequate circulation',
    value: 'above 60 mm Hg (British, ERC) · above 50 mm Hg (AHA)',
    appliesTo: 'Doppler or arterial-line MAP in an adult with a continuous-flow LVAD',
    class: 'guideline',
    sources: [
      adequacyParagraph,
      ercLvad(
        'Circulatory support devices: Left ventricular assist devices, p. 41; Fig. 18, p. 40: a Doppler MAP below 60 mm Hg among the signs of circulatory failure',
      ),
      aha2017Algorithm,
      aha2025Adequacy,
    ],
    note: 'The sources differ. The British guideline and ERC 2025 use above 60 mm Hg; AHA 2017 and AHA 2025 use above 50 mm Hg. These are lines for an adequate circulation, not treatment goals: the British low-flow section keeps MAP in the 60–80 mm Hg range, and the goal row in this register, 75–90 mm Hg, is the 2023 ISHLT treatment goal.',
    ...PERFUSION_CHECK,
    ...PERFUSION_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'lvad-adequate-etco2': {
    label: 'End-tidal CO₂ in an adequate circulation',
    value: 'above 2 kPa (15 mm Hg), intubated (British, ERC) · above 20 mm Hg (AHA)',
    appliesTo: 'An intubated adult with a continuous-flow LVAD',
    class: 'guideline',
    sources: [adequacyParagraph, ercFigure18, aha2017Algorithm, aha2025Adequacy],
    note: 'The sources differ. The British guideline gives 2 kPa; ERC 2025 prints 15 mm Hg (2 kPa). AHA 2025 uses above 20 mm Hg. AHA 2017 uses 20 mm Hg (≥20 in its text, >20 in Figure 6), only through an endotracheal tube or tracheostomy, because a supraglottic airway gives a falsely elevated reading. The British guideline warns that end-tidal CO₂ may not be failsafe through a loose-fitting facemask or a laryngeal mask airway.',
    ...PERFUSION_CHECK,
    ...PERFUSION_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'lvad-adequate-controller-flow': {
    label: 'Controller flow in an adequate circulation',
    value: 'typically above 3 L/min in an adult',
    appliesTo: 'A normal controller display with no active audible or visual alarm',
    class: 'guideline',
    sources: [adequacyParagraph, ercFigure18],
    note: 'ERC 2025 lists a flow below 3.0 L/min among the signs of circulatory failure. The controller estimates flow; it does not measure it: from power consumption and blood viscosity at a given speed in the British guideline, from speed, power and hematocrit on Abbott’s HeartMate 3 card. Both guidelines read it with the display and the alarms.',
    ...PERFUSION_CHECK,
    ...PERFUSION_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
  'lvad-cpr-deferral-limit': {
    label: 'Delay to compressions while the pump is restored',
    value:
      'at most 2 minutes (British; ERC, a lone rescuer) · none, the device worked alongside (AHA 2025; ERC, two or more rescuers)',
    appliesTo: 'An unresponsive LVAD recipient with an inadequate circulation',
    class: 'guideline',
    sources: [
      lvadEmergencyGuideline(
        '“Initial response”, and its recommendation that CPR may be deferred for a maximum of 2 min while immediate interventions restore device function',
        'Class IIa, Level C',
      ),
      ercLvad(
        'Summary, “Left ventricular assist device (LVAD) patients”, p. 13; section text, p. 41; Fig. 18, p. 40: CPR at once with a team, a delay of at most 2 minutes for a single rescuer',
      ),
      aha2025Lvad(
        '“Left Ventricular Assist Devices”, recommendation 2, p. S618: start compressions immediately while assessing for device-related causes; supportive text, p. S620, which names the British 2-minute delay and runs the device work in parallel',
        'COR 2b, LOE C-EO',
      ),
    ],
    note: 'The sources differ. The British guideline allows the delay whoever is present; ERC 2025 keeps it for a single rescuer; AHA 2025 has none, and recommends compressions in unresponsive patients with impaired perfusion (recommendation 1, COR 1, LOE C-EO). The 2017 AHA algorithm attempts a restart before compressions and sets no time. The British guideline also recommends, Class IIa, Level C, that CPR can be performed safely in LVAD recipients with an inadequate circulation.',
    ...PERFUSION_CHECK,
    ...PERFUSION_RECHECK,
    ...SIGNED_BY_OWNER_DECISION_2026_11_12,
  },
})

export type McsNumberId = (typeof MCS_NUMBERS.rows)[number]['id']
