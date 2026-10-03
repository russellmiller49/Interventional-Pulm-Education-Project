import { mcsSourceById } from './sources'
import { mcsSourceClass } from './sourceClasses'

/**
 * Ten learner-facing statements, each traced to the passage that does or does not support it (F10).
 *
 * The two supplied Word syntheses were standing as the first cited source under clinical
 * statements. They are authoring provenance: they record where wording came from, and they are not
 * a reason to believe it. Replacing their ids with a guideline's would have been the same mistake
 * in better clothes — a citation attached to a sentence nobody had checked it against.
 *
 * This file is the claim-level work instead, capped at ten: the statements that carried clinical
 * consequence, device-specific behaviour or a strong causal claim, and that could be checked
 * against a document actually in hand. For each one the document was opened, the passage located
 * and read, and the record below says what the passage supports, what it does not, and what was
 * done about the difference.
 *
 * What this is not: clinical approval. Every entry was checked by an authoring assistant and is
 * NOT REVIEWED (OD-05). A statement supported by a source is still a draft until a clinician says
 * otherwise, and every other statement that leans on a synthesis remains held under MCS-03-10.
 */

export type McsClaimDisposition =
  /** The opened passage says what the learner wording says. */
  | 'primary-source-supports-current-wording'
  /** A secondary educational text says it; no primary source in hand states it. */
  | 'secondary-source-supports-current-wording'
  /** The wording said more than the passage; it was narrowed to the passage. */
  | 'wording-narrowed-to-source'
  /** The passage supports the direction only; the statement is framed as model or context. */
  | 'source-supports-model-or-context-framing-only'

export interface McsClaimSourceEvidence {
  readonly sourceId: string
  /** Printed page, section, table or figure, as it appears in the document. */
  readonly locator: string
  /** What the passage says, closely paraphrased or quoted in a few words. */
  readonly passage: string
}

export interface McsClaimSourceMapping {
  readonly id: string
  /** The Learn sections and the cases whose sources list this check. */
  readonly sectionIds: readonly string[]
  readonly caseIds: readonly string[]
  /** Where the learner meets it. */
  readonly learnerSurface: string
  /** The exact learner wording after this slice. */
  readonly currentWording: readonly string[]
  /** What the surface cited before this slice. */
  readonly previousSourceIds: readonly string[]
  /** What the supplied synthesis was doing on this claim. */
  readonly synthesisRole: string
  readonly opened: readonly McsClaimSourceEvidence[]
  readonly supports: string
  readonly doesNotSupport: string
  readonly disposition: McsClaimDisposition
  readonly dispositionNote: string
  /** Registered sources on this claim that were not opened, and so are not verified for it. */
  readonly notOpened: readonly string[]
}

const SYNTHESIS_FIRST =
  'First cited source; the only named basis for the sentence beside an unopened record.'

export const MCS_CLAIM_SOURCE_MAP: readonly McsClaimSourceMapping[] = Object.freeze([
  {
    id: 'MCS-04-C01',
    sectionIds: ['iabp-timing-triggering'],
    caseIds: [],
    learnerSurface: 'Section 3, “A normal assisted beat” (guided introduction)',
    currentWording: [
      'Inflation (I) begins at closure; deflation (D) completes before the next ejection.',
    ],
    previousSourceIds: ['master-hemodynamics-reference', 'getinge-iabp-current'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'getinge-cardiosave-hybrid-operating-instructions',
        locator: 'Printed page xiv, “Brief Description of Intra-Aortic Balloon Therapy”',
        passage:
          'IAB inflation is initiated at the onset of diastole at the dicrotic notch and remains inflated through diastole; the IAB is then deflated at, or just prior to, the onset of systole.',
      },
    ],
    supports:
      'The timing relationship itself: inflation at the dicrotic notch, deflation at or just before the onset of systole.',
    doesNotSupport:
      'Any offset in milliseconds, any timing index, or anything about this simulation’s trace. The document describes one console family and is dated 2015.',
    disposition: 'primary-source-supports-current-wording',
    dispositionNote:
      'Wording unchanged. The operating instructions now stand first on the section.',
    notOpened: ['getinge-iabp-current'],
  },
  {
    id: 'MCS-04-C02',
    sectionIds: ['iabp-timing-triggering'],
    caseIds: ['IABP-01'],
    learnerSurface:
      'Section 3, early-inflation and late-deflation demonstrations; case IABP-01 worked explanation',
    currentWording: [
      'Inflation begins before the valve-closure reference, while ejection is still occurring. This can oppose LV ejection. Deflation remains at its reference; only inflation has changed.',
      'Late deflation can worsen rather than reduce LV afterload.',
    ],
    previousSourceIds: ['master-hemodynamics-reference', 'getinge-iabp-current'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'guide-mcs-vad-clinicians-2022',
        locator: 'Printed page 220 (Mody et al., Temporary Mechanical Circulatory Support)',
        passage:
          'Early balloon inflations can cause an increase in afterload, an increase in myocardial oxygen consumption and a decrease in stroke volume; both early inflations and late deflations can be a very dangerous error due to the acute increase in afterload.',
      },
      {
        sourceId: 'getinge-cardiosave-hybrid-operating-instructions',
        locator: 'Printed page vi (warnings)',
        passage:
          'Deflation is to be completed prior to systole to avoid interfering with systolic ejection; late deflation timing reduces and delays detection of the systolic pulse pressure.',
      },
    ],
    supports:
      'That early inflation and late deflation raise afterload and work against ejection, as a direction.',
    doesNotSupport:
      'Any magnitude, or how either would look on this model’s trace. The operating instructions name interference with ejection and loss of pressure triggering, not afterload in those words; the afterload statement rests on the textbook.',
    disposition: 'secondary-source-supports-current-wording',
    dispositionNote:
      'Wording unchanged. Supported by a secondary educational text; no primary source in hand states the afterload consequence.',
    notOpened: ['getinge-iabp-current'],
  },
  {
    id: 'MCS-04-C03',
    sectionIds: ['iabp-timing-triggering'],
    caseIds: [],
    learnerSurface: 'Section 3, late-inflation and early-deflation demonstrations',
    currentWording: [
      'Inflation begins after the valve-closure reference. The opportunity for diastolic augmentation is shortened. Deflation remains at its reference.',
      'Inflation remains aligned. The balloon band ends earlier in diastole, shortening augmentation. The exact clinical arterial contour is not faithfully reproduced by this model.',
    ],
    previousSourceIds: ['master-hemodynamics-reference', 'getinge-iabp-current'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'guide-mcs-vad-clinicians-2022',
        locator: 'Printed page 220 (Mody et al., Temporary Mechanical Circulatory Support)',
        passage:
          'If the balloon deflates too early there will be minimal or no decrease in the afterload; early deflations and/or late inflations result in less time for diastolic filling of the coronaries, minimizing additional coronary flow.',
      },
    ],
    supports: 'That late inflation and early deflation shorten the time of diastolic augmentation.',
    doesNotSupport:
      'Any magnitude, and nothing about the contour. The section’s own statement that the model does not reproduce the clinical contour stands (F17, OD-01).',
    disposition: 'secondary-source-supports-current-wording',
    dispositionNote: 'Wording unchanged. Supported by a secondary educational text.',
    notOpened: ['getinge-iabp-current'],
  },
  {
    id: 'MCS-04-C04',
    sectionIds: ['impella-unloading-placement'],
    caseIds: [],
    learnerSurface: 'Section 5, “An aligned LV-to-aorta pump” (guided introduction)',
    currentWording: [
      'The inlet receives blood inside the left ventricle (LV); the outlet returns it toward the ascending aorta.',
      'A flow change alone cannot diagnose position. Clinical position requires appropriate imaging and device-specific interpretation.',
    ],
    previousSourceIds: ['master-hemodynamics-reference', 'fda-impella-cp-labeling'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed page 4.11, “Motor Current Waveform”',
        passage:
          'When the catheter is positioned correctly, the inlet area is in the ventricle and the outlet area in the aorta; with both on the same side of the aortic valve the motor current is dampened or flat.',
      },
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed page 7.17, “Suction”, recommended action 3',
        passage: 'Check the catheter for correct positioning using imaging.',
      },
    ],
    supports:
      'Where the inlet and outlet sit when the catheter is correctly placed, and that position is checked with imaging.',
    doesNotSupport:
      'Any insertion, repositioning or depth instruction, which this module does not give. The passage is for the Impella CP with SmartAssist, United States revision V.',
    disposition: 'primary-source-supports-current-wording',
    dispositionNote:
      'Wording unchanged. The supplied instructions for use now stand first on the section.',
    notOpened: ['fda-impella-cp-labeling'],
  },
  {
    id: 'MCS-04-C05',
    sectionIds: ['impella-unloading-placement'],
    caseIds: ['IMP-03'],
    learnerSurface:
      'Section 5 guided introduction; Section 5 transfer; case IMP-03 worked explanation',
    currentWording: [
      'Performance level is a setting. Estimated pump flow depends on configuration, filling, outlet pressure and position.',
      'Higher aortic pressure can reduce microaxial flow at the same setting.',
    ],
    previousSourceIds: ['master-hemodynamics-reference', 'fda-impella-cp-labeling'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed page 5.25, Table 5.3 and its footnote',
        passage:
          'Each P-level has a mean flow range and a motor speed; flow rate can vary due to suction or incorrect positioning.',
      },
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed page 8.5, Table 8.2, “Impella Flow Low”',
        passage:
          'Actions for a low-flow alarm: check for suction; check for high afterload pressure.',
      },
    ],
    supports:
      'That a P-level is a setting with a flow range rather than a flow, that suction and position change the flow, and that high afterload pressure is a named thing to check when flow is low.',
    doesNotSupport:
      'A pressure–flow curve or any size for the effect of afterload. The magnitude this simulation shows is its own.',
    disposition: 'source-supports-model-or-context-framing-only',
    dispositionNote:
      'Wording unchanged: it states a direction (“can reduce”), which the document supports as a check, and the response size stays labelled as modeled.',
    notOpened: ['fda-impella-cp-labeling'],
  },
  {
    id: 'MCS-04-C06',
    sectionIds: ['impella-unloading-placement'],
    caseIds: [],
    learnerSurface: 'Section 5, “An aligned LV-to-aorta pump” (guided introduction)',
    currentWording: [
      'CP and 5.5 use different device models; the same level is not an equivalent clinical dose.',
    ],
    previousSourceIds: [
      'master-hemodynamics-reference',
      'fda-impella-cp-labeling',
      'fda-impella-55-labeling',
    ],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed page 5.25, Table 5.3',
        passage: 'Impella CP mean flow at P-8 is 3.1–3.4 L/min and at P-9 3.3–3.7 L/min.',
      },
      {
        sourceId: 'impella-55-ifu-rev-l-supplied',
        locator: 'Printed page 5.26, Table 5.3',
        passage: 'Impella 5.5 mean flow at P-8 is 4.3–4.9 L/min and at P-9 5.0–5.5 L/min.',
      },
    ],
    supports:
      'That the same P-level corresponds to a different mean flow range and motor speed on the two pumps.',
    doesNotSupport:
      'The word “dose”, which is the module’s, and any conversion between the two pumps. Which CP flow figure is which measurand stays open (MCS-03-01).',
    disposition: 'primary-source-supports-current-wording',
    dispositionNote:
      'Wording unchanged. Both supplied instructions now stand first on the section.',
    notOpened: ['fda-impella-cp-labeling', 'fda-impella-55-labeling'],
  },
  {
    id: 'MCS-04-C07',
    sectionIds: [],
    caseIds: ['IMP-01'],
    learnerSurface: 'Case IMP-01 worked explanation',
    currentWording: [
      'Suction is a cause-finding problem, not simply a low-setting problem.',
      'Suction can itself be an indicator of right heart failure, so right ventricular function is part of the evaluation.',
    ],
    previousSourceIds: ['master-hemodynamics-reference', 'fda-impella-cp-labeling'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed page 7.17, “Suction”',
        passage:
          'Suction may occur if the blood volume available for the catheter is inadequate or restricted; it may also be an indicator of right heart failure. Recommended actions include reducing the P-level, ensuring adequate volume, checking position with imaging and evaluating right ventricular function.',
      },
    ],
    supports:
      'That suction has causes to look for, that it may indicate right heart failure, and that right ventricular function is among the things evaluated.',
    doesNotSupport:
      'A ranking of causes. The earlier wording called right ventricular failure “the first explanation”, which the passage does not say.',
    disposition: 'wording-narrowed-to-source',
    dispositionNote:
      'The second sentence replaced “RV failure can be the first explanation for falling LV-device flow.” The first sentence is unchanged.',
    notOpened: ['fda-impella-cp-labeling'],
  },
  {
    id: 'MCS-04-C08',
    sectionIds: [],
    caseIds: ['IMP-02'],
    learnerSurface: 'Case IMP-02 worked explanation',
    currentWording: ['Malposition can reduce flow and increase hemolysis risk.'],
    previousSourceIds: ['master-hemodynamics-reference', 'fda-impella-cp-labeling'],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'impella-cp-ifu-rev-v-supplied',
        locator: 'Printed pages 7.18–7.19, “Hemolysis” and Table 7.1',
        passage:
          'Catheter position is among the conditions that may play a role in susceptibility to hemolysis; “wrong pump position” is a listed condition, with suction or flow-reduced alarms and lower than expected flows among its indicators.',
      },
    ],
    supports:
      'That catheter position is associated with hemolysis susceptibility and with lower than expected flow.',
    doesNotSupport:
      'A rate or a threshold, or the simulation’s own hemolysis-risk pattern, which is authored.',
    disposition: 'primary-source-supports-current-wording',
    dispositionNote: 'Wording unchanged.',
    notOpened: ['fda-impella-cp-labeling'],
  },
  {
    id: 'MCS-04-C09',
    sectionIds: ['impella-suction-purge-rv'],
    caseIds: [],
    learnerSurface: 'Section 6 identification and its pathway label',
    currentWording: ['Into the pulmonary artery, bypassing the right ventricle'],
    previousSourceIds: [
      'mcs-bedside-reference-supplied',
      'ishlt-hfsa-acute-mcs-2023',
      'fda-impella-rp-labeling',
    ],
    synthesisRole: SYNTHESIS_FIRST,
    opened: [
      {
        sourceId: 'impella-rp-ifu-rev-n-supplied',
        locator: 'Printed page 3.1, “Overview”',
        passage:
          'When properly positioned, the catheter delivers blood from the inlet area, which sits in the inferior vena cava, through the cannula, to the outlet opening in the pulmonary artery.',
      },
    ],
    supports:
      'The inlet and outlet of the Impella RP System: inferior vena cava to pulmonary artery.',
    doesNotSupport:
      'Anything about the Impella RP Flex, and nothing about adding right- and left-sided flows — that is the module’s own reasoning about pumps in series. Product identity stays open (MCS-03-04).',
    disposition: 'primary-source-supports-current-wording',
    dispositionNote:
      'Wording unchanged. The supplied instructions now stand first on the section’s sources.',
    notOpened: ['ishlt-hfsa-acute-mcs-2023', 'fda-impella-rp-labeling'],
  },
  {
    id: 'MCS-04-C10',
    sectionIds: ['lvad-parameters-assessment'],
    caseIds: ['LVAD-01'],
    learnerSurface: 'Case LVAD-01 worked explanation; Section 7',
    currentWording: ['Continuous-flow LVAD output is afterload sensitive.'],
    previousSourceIds: ['ishlt-durable-mcs-2023', 'fda-heartmate3-ifu'],
    synthesisRole:
      'None on the case itself: its two cited records were never opened. The section’s items cite the bedside synthesis first.',
    opened: [
      {
        sourceId: 'guide-mcs-vad-clinicians-2022',
        locator:
          'Printed page 101 (Washenko, Bennett and Hamm, Ventricular Assist Device Complications)',
        passage:
          'Avoiding high blood pressure is important as the increased afterload can reduce flow through the pump.',
      },
    ],
    supports: 'The direction: higher afterload can reduce flow through a durable pump.',
    doesNotSupport:
      'A blood-pressure target, a flow figure, or any named device’s estimator. This simulation is a generic continuous-flow model and its response size is authored (OD-02).',
    disposition: 'secondary-source-supports-current-wording',
    dispositionNote:
      'Wording unchanged. Supported by a secondary educational text; the guideline and the HeartMate 3 instructions cited beside it were not available to open and are not verified for this sentence.',
    notOpened: ['ishlt-durable-mcs-2023', 'fda-heartmate3-ifu'],
  },
])

export const MCS_CLAIM_SOURCE_MAP_LIMIT = 10

export const MCS_CLAIM_DISPOSITION_LABELS: Readonly<Record<McsClaimDisposition, string>> = {
  'primary-source-supports-current-wording': 'A primary source supports the wording as it stands',
  'secondary-source-supports-current-wording':
    'A secondary educational source supports the wording; no primary source in hand states it',
  'wording-narrowed-to-source': 'The wording was narrowed to what the source says',
  'source-supports-model-or-context-framing-only':
    'The source supports the direction only; the size of the effect is this model’s',
}

export function mcsClaimChecksForSection(sectionId: string): readonly McsClaimSourceMapping[] {
  return MCS_CLAIM_SOURCE_MAP.filter((claim) => claim.sectionIds.includes(sectionId))
}

export function mcsClaimChecksForCase(caseId: string): readonly McsClaimSourceMapping[] {
  return MCS_CLAIM_SOURCE_MAP.filter((claim) => claim.caseIds.includes(caseId))
}

export const MCS_CLAIM_SOURCE_STATUS = Object.freeze({
  reviewStatus: 'NOT REVIEWED',
  checkedBy: 'AI authoring assistant (Claude)',
  checkedOn: '2026-10-03',
  ownerDecision: 'OD-05',
  /** Every other statement leaning on a synthesis stays under this hold. */
  remainingHoldId: 'MCS-03-10',
})

function validateClaimSourceMap(): readonly string[] {
  const errors: string[] = []
  if (MCS_CLAIM_SOURCE_MAP.length > MCS_CLAIM_SOURCE_MAP_LIMIT)
    errors.push(`at most ${MCS_CLAIM_SOURCE_MAP_LIMIT} claim mappings in this slice`)
  const ids = new Set<string>()
  for (const claim of MCS_CLAIM_SOURCE_MAP) {
    if (ids.has(claim.id)) errors.push(`duplicate claim id ${claim.id}`)
    ids.add(claim.id)
    if (claim.opened.length === 0) errors.push(`${claim.id}: no opened source`)
    for (const evidence of claim.opened) {
      if (!mcsSourceById.has(evidence.sourceId))
        errors.push(`${claim.id}: unregistered source ${evidence.sourceId}`)
      else if (mcsSourceClass(evidence.sourceId) === 'authoring-provenance')
        errors.push(`${claim.id}: a synthesis cannot be the opened support for a claim`)
      if (!evidence.locator.trim() || !evidence.passage.trim())
        errors.push(`${claim.id}: an opened source needs a locator and a passage`)
    }
    for (const id of [...claim.previousSourceIds, ...claim.notOpened]) {
      if (!mcsSourceById.has(id)) errors.push(`${claim.id}: unregistered source ${id}`)
    }
    if (!claim.doesNotSupport.trim())
      errors.push(`${claim.id}: say what the source does not support`)
    // A statement resting only on a secondary text may not be recorded as primary-supported.
    const hasPrimary = claim.opened.some(
      (evidence) =>
        mcsSourceById.has(evidence.sourceId) &&
        mcsSourceClass(evidence.sourceId) === 'primary-clinical-device',
    )
    if (claim.disposition === 'primary-source-supports-current-wording' && !hasPrimary)
      errors.push(`${claim.id}: recorded as primary-supported with no primary source opened`)
  }
  return errors
}

const claimMapErrors = validateClaimSourceMap()
if (claimMapErrors.length > 0) {
  throw new Error(`Invalid MCS claim/source map:\n- ${claimMapErrors.join('\n- ')}`)
}
