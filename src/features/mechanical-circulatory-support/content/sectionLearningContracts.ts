/**
 * What each Learn section asks the learner to do, and why — authored once, per section.
 *
 * The defect this file exists to fix is not that the sections were empty. They had titles,
 * instructions, and rationales. What they did not have was a statement of the task a learner could
 * act on without inferring it from the simulator: which patient problem is on the screen, which
 * pathway is present, what to notice, whether anything should be changed, which control if so, what
 * to predict first, what changed afterwards, why, what that establishes, and — the sentence the
 * module turns on — what it does not establish.
 *
 * Every section carries all of that, and none of it is generated from a title. The validator below
 * refuses a missing field, refuses the placeholder phrases the roadmap named, refuses an instruction
 * that does not begin with a verb, refuses an adjustment that points at no real control, refuses an
 * inspect-only section that does not say no adjustment is expected, and refuses two neighbouring
 * sections that would render the same context, target, task and explanation.
 *
 * `isActionSatisfied` is a state predicate rather than a list of action ids on purpose. A section
 * whose authored starting state is created with the same control the learner is then asked to move
 * would otherwise begin already satisfied.
 */

import {
  clinicalLearningItemSchema,
  type ClinicalLearningItem,
} from '@/features/learning-module/activity'

import { MCS_NUMBERS } from './teachingNumbers'
import type {
  McsAction,
  McsDerivedMetrics,
  McsDeviceKind,
  McsSimulationState,
} from '../engine/types'
import { mcsLessons } from './lessons'
import { mcsLessonTransferByLessonId } from './lessonTransfers'
import { mcsLearnControls, type McsLearnControlId } from './learnControls'
import {
  mcsPrimarySurfaceBySectionId,
  mcsSurfaceTarget,
  type McsPrimarySurface,
  type McsPrimaryTargetId,
} from './primarySurfaces'

/** The six instructional states a Learn section moves through, in order. */
export const MCS_LEARN_PHASES = [
  'recognize',
  'predict',
  'act',
  'observe',
  'explain',
  'transfer',
] as const

export type McsLearnPhase = (typeof MCS_LEARN_PHASES)[number]

/**
 * What kind of thing the learner is being asked to do in the act phase.
 *
 * Typed rather than free text, because "explore the device" is what a section says when nobody has
 * decided which of these it is.
 */
export type McsLearnActionMode =
  | 'inspect-only'
  | 'identify'
  | 'compare'
  | 'select'
  | 'adjust'
  | 'sequence'

export interface McsRecognizeOption {
  readonly id: string
  readonly label: string
  readonly correct: boolean
  /** Shown after the learner commits, whichever option they chose. */
  readonly feedback: string
}

/** One live value carried into the before-and-after comparison. */
export interface McsObservedSignal {
  readonly key: keyof McsDerivedMetrics
  readonly label: string
  readonly unit: string
  readonly digits: number
  /**
   * Which level of the causal ladder this reading answers at.
   *
   * `device-display` means a quantity a real console reports, modeled here. `model-index` means a
   * number that exists only in this simulation and has no console equivalent — the timing synchrony
   * figure is the one such reading the module shows, and labelling it `device-display` invited the
   * reading that a console reports it (F04).
   */
  readonly level:
    | 'pressure'
    | 'flow'
    | 'oxygen-balance'
    | 'device-display'
    | 'model-index'
    | 'volume'
    | 'pressure-flow'
}

export interface McsSectionTeachingPanel {
  /** What is on the primary pane right now, in one sentence. */
  readonly whatYouAreSeeing: string
  /** What the highlighted signal or anatomical relationship actually represents. */
  readonly whatTheTargetRepresents: string
  /** How the requested action moves the modeled system. */
  readonly howTheActionAffectsTheModel: string
  /** The native / displayed-device / effective-systemic distinction as it applies here. */
  readonly flowAccountNote: string
}

interface AuthoredSectionContract {
  readonly sectionId: string
  readonly lessonTitle: string
  readonly lessonSequenceLabel: string
  readonly clinicalQuestion: string
  readonly startingContext: string
  readonly patientProblem: string
  readonly supportPathway: string
  readonly deviceOrMechanism: string
  readonly learningObjective: string

  /** The topology the section opens on, and any authored starting state on top of it. */
  readonly startingDevice: McsDeviceKind
  readonly startingActions: readonly McsAction[]

  readonly recognizePrompt: string
  readonly recognizeOptions: readonly McsRecognizeOption[]

  readonly predictionPrompt: string
  readonly predictionItem: ClinicalLearningItem
  readonly predictionReasoning: string

  readonly actionMode: McsLearnActionMode
  readonly actionInstruction: string
  readonly targetControl?: McsLearnControlId
  readonly allowedActions: readonly McsLearnControlId[]
  readonly noActionExplanation?: string
  readonly isActionSatisfied: (state: McsSimulationState) => boolean

  readonly observationFocus: string
  readonly observedSignals: readonly McsObservedSignal[]
  readonly beforeStateLabels: readonly string[]
  readonly afterStateLabels: readonly string[]
  /** Said out loud where the model does not represent something a learner might expect. */
  readonly unmodeledNote?: string

  readonly explanation: string
  readonly pressureLevelExplanation: string
  readonly flowLevelExplanation: string
  readonly oxygenDeliveryExplanation: string
  readonly organResponseExplanation: string
  readonly whatThisEstablishes: string
  readonly whatThisDoesNotEstablish: string
  readonly commonMisinterpretation: string
  readonly reassessmentPrompt: string

  readonly transferContext: string
  readonly transferPrompt: string
  readonly completionCondition: string

  readonly teaching: McsSectionTeachingPanel
}

export interface McsSectionLearningContract extends AuthoredSectionContract {
  readonly primarySurface: McsPrimarySurface
  readonly primaryTarget: McsPrimaryTargetId
  readonly primaryTargetLabel: string
  readonly primarySurfaceRationale: string
  readonly whyThisView: string
}

function item(input: unknown): ClinicalLearningItem {
  return clinicalLearningItemSchema.parse(input)
}

const bedside = ['mcs-bedside-reference-supplied', 'ishlt-hfsa-acute-mcs-2023']
const mapGoal = MCS_NUMBERS.value('lvad-map-goal')
const mapCeiling = MCS_NUMBERS.value('lvad-map-ceiling')
const powerElevation = MCS_NUMBERS.value('lvad-power-elevation')
const iabpEvidence = [...bedside, 'getinge-iabp-current']
const impellaEvidence = [...bedside, 'fda-impella-cp-labeling']
const rightImpellaEvidence = [...bedside, 'fda-impella-rp-labeling']
const lvadEvidence = [
  'mcs-bedside-reference-supplied',
  'ishlt-durable-mcs-2023',
  'fda-heartmate3-ifu',
  // F28: the card that names which way the power/flow dependency runs on the device this model
  // resembles. Cited wherever the module shows a parameter pattern, so the boundary has a source.
  'abbott-heartmate3-pump-parameters-card',
]

function signal(
  key: keyof McsDerivedMetrics,
  label: string,
  unit: string,
  digits: number,
  level: McsObservedSignal['level'],
): McsObservedSignal {
  return { key, label, unit, digits, level }
}

/*
 * The keyed option is authored first in every identification and prediction below, and in every
 * transfer beside them. That is an authoring convention, not what the learner sees: the stage
 * rotates every choice list through `orderChoices` before it renders, so "pick the first" scores
 * at chance, and `stage-registries.test.ts` holds it there. Read the order here as "key, then the
 * distractors", never as the order on screen.
 *
 * Every prediction offers one option graded `unsafe`. Since the September 2026 learner-review
 * round each of those is itself a forecast — what the learner expects the circulation to do — and
 * not a move: a prediction item whose fourth option was "raise the level instead" was asking two
 * questions, and a learner could pick the option out by its shape alone. The unsafe grade says
 * that acting on that expectation is the harm; the rationale beside it says why.
 */
const authoredContracts: readonly AuthoredSectionContract[] = [
  // ── 1 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'mcs-foundations-signals',
    lessonTitle: 'A pressure that looks fine',
    lessonSequenceLabel: 'Section 1 of 9 · Foundations',
    clinicalQuestion:
      'The mean pressure on this monitor reads as acceptable. Is enough blood actually moving?',
    startingContext:
      'Counterpulsation is already running at a one-to-one ratio with aligned timing. Nothing about the balloon or the patient is changed in this section.',
    patientProblem:
      'Low-output shock with a plausible-looking mean pressure, a wedge pressure around 20 mm Hg, and a mixed venous saturation in the high fifties to low sixties.',
    supportPathway:
      'A balloon inside the descending thoracic aorta. No blood enters it and none returns from it.',
    deviceOrMechanism:
      'Intra-aortic balloon pump — a mechanism that changes the timing and shape of pressure, not a chamber-to-artery pump.',
    learningObjective:
      'Distinguish pressure, blood flow, oxygen delivery and clinical perfusion findings; explain why an IABP has no pump-flow stream of its own.',
    startingDevice: 'iabp',
    startingActions: [],
    recognizePrompt:
      'Read the highlighted arterial pressure and identify which question it answers on its own.',
    recognizeOptions: [
      {
        id: 'driving-pressure',
        label: 'That a driving pressure exists where it is measured, and the shape of the pulse',
        correct: true,
        feedback:
          'That is the whole claim. A preserved or even augmented pressure can sit on top of a very small forward stroke volume, so how much blood is moving is still unknown — the flow account addresses a separate question.',
      },
      {
        id: 'blood-moving',
        label: 'How much blood is moving forward, and by which of the available routes',
        correct: false,
        feedback:
          'Pressure is the first level of the model and it answers only its own question. Flow is the second level, and nothing about a mean pressure reports it.',
      },
      {
        id: 'organs-perfused',
        label: 'Whether the organs are being perfused, judged from the pressure they are receiving',
        correct: false,
        feedback:
          'Organ response is the top of the ladder — mentation, urine output, skin, the lactate trajectory — and nothing on a pressure trace answers there.',
      },
    ],
    predictionPrompt:
      'Apply the flow distinction to another patient receiving counterpulsation. Which components would belong in that patient’s flow account?',
    predictionItem: item({
      id: 'mcs-foundations-signals-predict-1',
      activityId: 'mcs:learn:mcs-foundations-signals',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-foundations-counterpulsation-baseline',
      visualAssetIds: ['mcs-monitor'],
      stem: 'A separate handover describes an IABP patient whose native output improved after support began. Which account correctly assigns the forward flow during support?',
      choices: [
        {
          id: 'native-only',
          label:
            'Native forward flow, an effective flow equal to it, and no separate pump-flow stream',
          rationale:
            'An IABP has no pump-flow stream of its own. Effective systemic flow equals native forward flow, which already includes what counterpulsation does to loading.',
          plausibility: 'best',
        },
        {
          id: 'device-tracks-pressure',
          label:
            'A device contribution roughly matching the rise in mean pressure the balloon produces',
          rationale:
            'Augmented pressure is a change in the shape of a pressure wave, not a volume the balloon moved. No console reports a flow for this pathway.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'effective-exceeds-native',
          label:
            'An effective systemic delivery larger than the native contribution, because the balloon adds to it',
          rationale:
            'Anything gained here is native output responding to changed loading, and it belongs on the native line. Putting it on a second line counts the same blood twice.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'sum-the-lines',
          label:
            'A device contribution that can be added to the native contribution to give cardiac output',
          rationale:
            'An IABP has no separate pump-flow stream. Native output during support already includes its loading effect; adding that effect again counts it twice.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['native-only'],
      explanation:
        'The three lines are separated by what they describe, not by how large they are. Native is what the patient ejects. The device line is what a pump reports moving along its own pathway. Effective systemic delivery is what reaches the circulation once competition, regurgitation and topology have been accounted for. Counterpulsation has no pathway of its own, so its device line is empty and its effect appears on the native line.',
      evidenceIds: iabpEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'Apply the pathway to a separate IABP handover. This records your interpretation, not a treatment response.',
    actionMode: 'inspect-only',
    actionInstruction:
      'Do not change any control in this section. Open all three readings in turn — arterial pressure, filling pressures, then device and effective flow — and read each one as an answer to its own question.',
    allowedActions: [
      'control:inspect-arterial',
      'control:inspect-preload',
      'control:inspect-device',
    ],
    noActionExplanation:
      'No adjustment is expected. The skill being built is reading, and a setting change would hand you a new state before you had finished interpreting this one.',
    isActionSatisfied: (state) =>
      ['inspect:arterial', 'inspect:preload', 'inspect:device'].every((id) =>
        state.actionIds.includes(id),
      ),
    observationFocus:
      'Hold the mean pressure beside the effective systemic delivery and the mixed venous saturation, and notice that they are not telling you the same thing.',
    observedSignals: [
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
      signal('pcwpMmHg', 'Wedge pressure', 'mm Hg', 0, 'pressure'),
      signal('nativeFlowLMin', 'Native contribution', 'L/min', 1, 'flow'),
      signal('deviceFlowLMin', 'Displayed device contribution', 'L/min', 1, 'device-display'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('svo2Percent', 'Simulated mixed venous saturation', '%', 0, 'oxygen-balance'),
    ],
    beforeStateLabels: [
      'One undifferentiated impression: "the pressure looks acceptable"',
      'A device line you have not yet checked',
      'An effective systemic delivery you have not yet separated from the device line',
    ],
    afterStateLabels: [
      'Nothing was changed, so the two columns should match',
      'IABP: no separate pump-flow stream',
      'An effective systemic delivery equal to the native contribution, with a mixed venous saturation that disagrees with the pressure',
    ],

    explanation:
      'Three readings, three different questions, three different answers. The pressure answers where a driving pressure exists. The flow lines answer how much blood is moving and by which path. Venous saturation informs the balance of oxygen delivery and consumption; it does not independently measure either. Nothing forced them to agree, and here they do not.',
    pressureLevelExplanation:
      'Mean arterial pressure is preserved and the wedge pressure is high. A driving pressure exists at the radial artery; that is the entire claim.',
    flowLevelExplanation:
      'Effective systemic delivery equals the native contribution, because the device line is empty. Whatever counterpulsation is achieving, it is achieving through the beat the patient is still generating.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation falls when delivery falls short of consumption. It also depends on hemoglobin, arterial saturation and oxygen consumption.',
    organResponseExplanation:
      'Mentation, urine output, skin perfusion and the lactate trend answer at the organ level. Go to the bedside for them.',
    whatThisEstablishes:
      'That a preserved mean pressure and a marginal oxygen delivery can sit on the same monitor at the same moment, and that the flow account has three lines rather than one number.',
    whatThisDoesNotEstablish:
      'Before you call a circulation adequate, read all four rungs: pressure, flow, venous saturation, and the organs at the bedside.',
    commonMisinterpretation:
      'Reading the mean pressure as though it had answered the flow question — carrying a finding from the first level of the model and reporting it at the second.',
    reassessmentPrompt:
      'Which bedside finding, not on this screen, would you go and look for before deciding whether this circulation is adequate?',
    transferContext:
      'The same patient returns from imaging. The mean pressure still reads as acceptable, but the trace is damped, the extremities are cool, and urine output has fallen.',
    transferPrompt:
      'Rebuild the three readings in the transfer patient, then commit to what you would do first.',
    completionCondition:
      'Recorded once all three readings have been opened, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'A simulated arterial trace and separately labeled flow quantities in a patient receiving counterpulsation. The guided introduction explains their sources before you apply the distinction.',
      whatTheTargetRepresents:
        'A pressure, measured at one site, with a shape that says when the balloon is inflating. It is the first level of the model, and it answers only its own question.',
      howTheActionAffectsTheModel:
        'The readings do not act on the model at all. They report the current state back in words, which is the point: this section separates looking from doing.',
      flowAccountNote:
        'For counterpulsation the device line is empty by construction. Any improvement in forward flow belongs on the native line, because it is the patient’s own ejection responding to a changed load.',
    },
  },

  // ── 2 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'mcs-foundations-mechanisms',
    lessonTitle: 'Three devices called support',
    lessonSequenceLabel: 'Section 2 of 9 · Foundations',
    clinicalQuestion:
      'Three devices are described as "support". Which of them actually moves blood, and from where to where?',
    startingContext:
      'The same baseline circulation as the previous section, opened on counterpulsation. Selecting a different mechanism returns the patient to that shared baseline so the three are compared at one starting point.',
    patientProblem:
      'One low-output circulation, held constant, so that the difference between the mechanisms is the mechanism rather than the patient.',
    supportPathway:
      'Three pathways in turn: a balloon inside the aorta, a pump across the aortic valve, and an implanted pump from the ventricular apex to the ascending aorta.',
    deviceOrMechanism:
      'Counterpulsation, a temporary transvalvular pump, and a durable continuous-flow pump.',
    learningObjective:
      'Name the source compartment, the active component, and the destination compartment for each mechanism, and say which of the three reports no flow at all.',
    startingDevice: 'iabp',
    startingActions: [],
    recognizePrompt:
      'Trace the pathway drawn on the Circulation map and identify where blood enters and where it returns for the mechanism currently selected.',
    recognizeOptions: [
      {
        id: 'nothing-enters',
        label:
          'Nothing enters and nothing returns; the balloon displaces blood already in the aorta',
        correct: true,
        feedback:
          'That is what makes this mechanism different in kind. It has no source compartment and no destination compartment, so the flow account has only one line that carries blood.',
      },
      {
        id: 'lv-to-aorta',
        label:
          'Blood enters from the left ventricle and returns to the aorta, so the balloon is a pump',
        correct: false,
        feedback:
          'That is the transvalvular pump’s pathway, and you will build it next. The balloon has no inlet and no outlet.',
      },
      {
        id: 'vein-to-artery',
        label:
          'Blood is drained from a central vein and returned to an artery through an outside circuit',
        correct: false,
        feedback:
          'That is venoarterial ECMO, an extracorporeal pathway. It is compared on the pathway cards below.',
      },
    ],
    predictionPrompt:
      'Predict what will happen to the displayed device contribution as you move from counterpulsation to the transvalvular pump and then to the durable pump.',
    predictionItem: item({
      id: 'mcs-foundations-mechanisms-predict-1',
      activityId: 'mcs:learn:mcs-foundations-mechanisms',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-foundations-mechanism-comparison',
      visualAssetIds: ['mcs-anatomy', 'mcs-monitor'],
      stem: 'You are about to hold one unchanged circulation against three mechanisms. What do you expect to happen to the displayed device contribution and to arterial pulsatility as you move from the balloon to the transvalvular pump to the durable pump?',
      choices: [
        {
          id: 'flow-appears-pulsatility-falls',
          label:
            'The device line stays empty for the balloon, appears for both pumps, and pulsatility falls',
          rationale:
            'Only the two pumps have a pathway of their own to report a flow along. As pump flow rises, less volume leaves through the native outflow tract, so the pulse narrows — here that narrowing is a sign of unloading, not of deterioration.',
          plausibility: 'best',
        },
        {
          id: 'all-three-report-flow',
          label:
            'All three report a device flow, the balloon simply reporting the smallest of the three',
          rationale:
            'The balloon has no source and no destination compartment. There is no stream for it to report, so its device line is empty rather than small.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'pulsatility-rises',
          label:
            'Pulsatility rises with each pump, because more blood is being moved with every beat',
          rationale:
            'More total flow through a continuous pump means less pulsatile flow through the aortic valve. Total delivery and pulse width move in opposite directions here.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'more-is-better',
          label:
            'The mechanism reporting the largest device flow will also deliver the most to this patient',
          rationale:
            'Ranking mechanisms by the size of the number on their display is the selection error. The mechanism follows the limiting problem, not the largest figure.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['flow-appears-pulsatility-falls'],
      explanation:
        'Source, active component, destination. The balloon has no source and no destination, so it changes pressure without moving blood along a path. Both left pumps draw from the left ventricle and return to the aorta, and native ejection falls as the pump takes over.',
      evidenceIds: [...bedside, 'ishlt-durable-mcs-2023'],
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'The prediction is about the shape of the change, not its size. If you expect a device line to appear for two of the three and the pulse to narrow rather than widen, you are reading the pathway rather than the display.',
    actionMode: 'compare',
    actionInstruction:
      'Select all three mechanisms in any order. Each selection resets the reference patient and retains the result after eight simulated seconds. Compare the three named records below.',
    targetControl: 'control:select-impella',
    allowedActions: ['control:select-iabp', 'control:select-impella', 'control:select-lvad'],
    isActionSatisfied: (state) =>
      ['device:select:iabp', 'device:select:impella', 'device:select:lvad'].every((id) =>
        state.actionIds.includes(id),
      ),
    observationFocus:
      'Compare the device line and the pulse pressure across the three mechanisms, then check the arithmetic under the table: effective systemic delivery rises by less than the pump number, because native flow falls as the pump takes over.',
    observedSignals: [
      signal('nativeFlowLMin', 'Native contribution', 'L/min', 1, 'flow'),
      signal('deviceFlowLMin', 'Displayed device contribution', 'L/min', 1, 'device-display'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('pulsePressureMmHg', 'Pulse pressure', 'mm Hg', 0, 'pressure'),
      signal('lvedvMl', 'Modeled LV end-diastolic volume', 'mL', 0, 'volume'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
    ],
    beforeStateLabels: [
      'Counterpulsation: an empty device line',
      'A wide native pulse pressure',
      'A distended left ventricle',
    ],
    afterStateLabels: [
      'A pump: a device line with a number on it, labelled an estimate',
      'A narrower pulse pressure, because less volume leaves through the aortic valve',
      'A smaller left ventricular end-diastolic volume — the chamber that is being relieved',
    ],
    explanation:
      'The device line appeared only when a pathway appeared with it. The pulse narrowed as volume was redirected away from the native outflow tract, and the ventricle got smaller because a pump was taking blood out of it. A pump may reduce concurrent native ejection. That changes the improvement from baseline, not the arithmetic for the concurrent forward routes. Use the retained records for the changes observed in this run.',
    pressureLevelExplanation:
      'Compare captured mean and pulse pressures for each named configuration. Neither pressure is a direct blood-flow measurement; unchanged results must remain visible.',
    flowLevelExplanation:
      'Native contribution falls as device flow rises: the two are not independent, because the pump is removing the volume the ventricle would otherwise have ejected. Within the model’s clamps, effective systemic flow equals concurrent native forward flow plus left-pump flow minus represented regurgitant recirculation. With no recirculation, those parallel forward components add.',
    oxygenDeliveryExplanation:
      'The model links its SvO2 surrogate to effective flow. Actual oxygen delivery also depends on arterial oxygen content, and SvO2 additionally depends on oxygen consumption.',
    organResponseExplanation:
      'None of these three changes tells you an organ has recovered. Each mechanism buys time; the bedside tells you whether it worked.',
    whatThisEstablishes:
      'That "support" names a category and not a quantity, and that only two of these three mechanisms move blood along a pathway of their own.',
    whatThisDoesNotEstablish:
      'Choose the mechanism by what is failing: name the limiting problem first, then match the pathway to it.',
    commonMisinterpretation:
      'Adding the native output from before support to a later pump flow, or summing right-sided and left-sided pump flows that are in series.',
    reassessmentPrompt:
      'If a pump raised the device line but the native contribution fell by the same amount, what would have changed for the patient?',
    transferContext:
      'A patient stays congested despite well-timed counterpulsation: the wedge pressure is high and the ventricle is distended.',
    transferPrompt:
      'Choose the comparison that tests a different mechanism against that problem, then select that mechanism with the button under the answer.',
    completionCondition:
      'Recorded once all three mechanism results have been retained and interpreted, the prediction and its verdict have been worked through, the comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The Circulation map shows the selected mechanism. The annotated pathway comparison is available during the introduction; 3D is optional.',
      whatTheTargetRepresents:
        'Source, active component, destination — the three facts that answer most troubleshooting questions before any alarm has been read.',
      howTheActionAffectsTheModel:
        'Selecting a mechanism rebuilds the same baseline circulation around a different pathway, so the comparison is between mechanisms rather than between patients.',
      flowAccountNote:
        'Watch the device line appear and disappear as you move between mechanisms. A pathway with no source and no destination has nothing to report, and an empty line is a fact about the mechanism rather than a missing measurement.',
    },
  },

  // ── 3 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'iabp-timing-triggering',
    lessonTitle: 'Is the balloon inflating at the right moment?',
    lessonSequenceLabel: 'Section 3 of 9 · Counterpulsation',
    clinicalQuestion:
      'The balloon is running and the console reports no fault. Is it inflating at the right moment?',
    startingContext:
      'Begin with an aligned beat at 1:2. Each demonstration moves one timing event, and the live strip and its five-pressure readout show what that does to the trace.',
    patientProblem:
      'The same low-output circulation, now receiving counterpulsation that is technically running but mistimed.',
    supportPathway:
      'A balloon inside the descending thoracic aorta, inflating in diastole and deflating before the next ejection.',
    deviceOrMechanism:
      'Intra-aortic balloon pump — inflation timed to aortic-valve closure, deflation timed to the next upstroke.',
    learningObjective:
      'Recognize early inflation on the arterial trace and restore inflation to the dicrotic notch.',
    startingDevice: 'iabp',
    startingActions: [{ type: 'SET_IABP_CONTROL', control: 'inflationOffsetMs', value: -120 }],
    recognizePrompt:
      'Read the live strip at 1:2 and its five-pressure readout. Which timing relationship is present?',
    recognizeOptions: [
      {
        id: 'raises-impedance',
        label: 'Early inflation: balloon inflation begins before the valve-closure reference',
        correct: true,
        feedback:
          'Early inflation puts the balloon in the way of an ejection that is still happening. The mechanism that is supposed to reduce the load is adding to it.',
      },
      {
        id: 'loses-augmentation',
        label: 'Late inflation: balloon inflation begins after the valve-closure reference',
        correct: false,
        feedback:
          'That is late inflation, the mirror error. Here inflation is arriving too soon, so the problem is added impedance rather than a missed window.',
      },
      {
        id: 'no-effect',
        label:
          'Aligned timing: inflation begins at closure and deflation precedes the next ejection',
        correct: false,
        feedback:
          'Not here. With aligned timing the augmented peak stands above unassisted systole and the assisted end-diastolic pressure sits below the unassisted one.',
      },
    ],
    predictionPrompt:
      'Predict what moving inflation back to the notch will do to the arterial trace and to effective systemic delivery.',
    predictionItem: item({
      id: 'mcs-iabp-timing-predict-1',
      activityId: 'mcs:learn:iabp-timing-triggering',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-iabp-early-inflation',
      visualAssetIds: ['mcs-arterial-waveform'],
      stem: 'In this changed timing example, what does correcting inflation establish about native flow and adequacy of support?',
      choices: [
        {
          id: 'synchrony-and-modest-flow',
          label:
            'Synchrony returns and mean pressure rises by several mm Hg; delivery improves only slightly',
          rationale:
            'Removing added impedance lets the native ventricle eject more freely, so both pressure and flow improve — but the gain is bounded by what that ventricle can generate, because the balloon still moves no blood of its own.',
          plausibility: 'best',
        },
        {
          id: 'large-flow-gain',
          label:
            'Effective systemic delivery rises by one to two litres per minute once the timing is right',
          rationale:
            'Counterpulsation changes loading and moves no blood of its own. The gain in output is a fraction of a litre per minute.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'device-line-appears',
          label:
            'A device flow appears on the display once the timing is aligned, and adds to the native flow',
          rationale:
            'Aligned timing does not give this pathway a source and a destination. The device line stays empty however well the balloon is timed.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'raise-ratio-instead',
          label:
            'Nothing useful will change, because the assist ratio rather than the timing decides what the balloon offers',
          rationale:
            'Assisting more beats without fixing the timing reproduces the same error more often. Mistiming is corrected before frequency is increased.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['synchrony-and-modest-flow'],
      explanation:
        'Timing determines how much of this mechanism is available, and correcting it recovers what was being lost. It does not change the kind of thing the mechanism is: a bounded improvement in loading around a beat the patient is still generating.',
      evidenceIds: iabpEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'Recognizing a mistimed beat, correcting it, and showing that perfusion is adequate are three separate steps.',
    actionMode: 'adjust',
    actionInstruction:
      'Align inflation with the dicrotic notch using Inflation vs notch, watching the live strip at 1:2 as you adjust. Keep support running and deflation aligned.',
    targetControl: 'control:iabp-inflation',
    allowedActions: ['control:iabp-inflation'],
    isActionSatisfied: (state) =>
      state.device.kind === 'iabp' &&
      state.device.running &&
      Math.abs(state.device.inflationOffsetMs) <= 20 &&
      Math.abs(state.device.deflationOffsetMs) <= 20 &&
      state.actionIds.includes('iabp:set-inflation'),
    observationFocus:
      'Watch the early-inflation alarm clear and timing synchrony recover, then read how much effective systemic delivery actually moved.',
    observedSignals: [
      signal('timingQualityPercent', 'Modeled timing synchrony', '%', 0, 'model-index'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
      signal('pulsePressureMmHg', 'Pulse pressure', 'mm Hg', 0, 'pressure'),
      signal('nativeFlowLMin', 'Native contribution', 'L/min', 1, 'flow'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('cardiacPowerOutputW', 'Calculated cardiac power output', 'W', 2, 'pressure-flow'),
    ],
    beforeStateLabels: [
      'Early-inflation alarm active',
      'Timing synchrony well below its aligned value',
      'A mean pressure and a forward flow both held down by added impedance',
    ],
    afterStateLabels: [
      'No active timing alarm',
      'Timing synchrony restored',
      'A higher augmented peak, and a small rise in pressure and native flow',
    ],
    explanation:
      'Correcting the timing removed a load the ventricle was ejecting against, so the ventricle ejected more. Every litre of that gain is native output: the balloon still has no pathway of its own, and the device line is still empty. The pressure moved further than the flow, which is what this mechanism does.',
    pressureLevelExplanation:
      'Mean pressure rose as soon as the balloon stopped inflating into an open aortic valve, and the assisted beat recovered its shape on the trace.',
    flowLevelExplanation:
      'Effective systemic delivery rose by a fraction of a litre per minute — real, and entirely native. The device line did not move, because there is nothing there to move.',
    oxygenDeliveryExplanation:
      'Cardiac power rose because it is a pressure–flow product and the pressure term moved most. That makes it a useful summary and a poor substitute for the flow line.',
    organResponseExplanation:
      'Correct timing is a precondition, not an outcome. Whether this patient is better shows in mentation, urine output, skin perfusion and lactate over the next hours.',
    whatThisEstablishes:
      'That inflation timing changes how much of this mechanism is available, and that a visible improvement on the arterial trace can accompany a small change in forward flow.',
    whatThisDoesNotEstablish:
      'Check timing at 1:2. Fix late deflation first, then move inflation to the dicrotic notch. Then ask whether a well-timed balloon is enough: effective flow, filling pressures and the organs.',
    commonMisinterpretation:
      'Reading a taller diastolic peak as evidence of improved organ perfusion — an augmentation finding at the pressure level, reported at the organ level.',
    reassessmentPrompt:
      'Timing is now aligned. What would you check next before concluding that this level of support is adequate?',
    transferContext:
      'The rhythm becomes atrial fibrillation with variable cycle lengths, and some assisted beats land in the wrong place.',
    transferPrompt:
      'Decide how to evaluate a trigger change with an irregular rhythm, then change the trigger source in the Controls under the monitor.',
    completionCondition:
      'Recorded once inflation has been returned to within 20 ms of the notch, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The live arterial trace for a patient on counterpulsation whose inflation has been set early. Each assisted beat is banded on the trace, with the notch and the next upstroke marked.',
      whatTheTargetRepresents:
        'The shape and timing of the pressure wave. Inflation belongs at the dicrotic notch; deflation belongs immediately before the next upstroke.',
      howTheActionAffectsTheModel:
        'The inflation control moves the balloon’s inflation relative to valve closure. Aligning it removes an impedance the ventricle was ejecting against, so native output rises.',
      flowAccountNote:
        'Nothing you do to the timing puts a number on the device line. Every change you see in forward flow belongs to the native contribution, which is why this mechanism is bounded by the beat the patient still has.',
    },
  },

  // ── 4 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'iabp-efficacy-limits',
    lessonTitle: 'Timed correctly, still not perfusing',
    lessonSequenceLabel: 'Section 4 of 9 · Counterpulsation',
    clinicalQuestion:
      'The balloon is timed correctly and the patient is still not perfusing. Is that a timing problem?',
    startingContext:
      'Counterpulsation at a one-to-one ratio with aligned timing and no active timing alarm. Right ventricular contractility starts in its normal range; you are about to take it away.',
    patientProblem:
      'A circulation that is about to become limited upstream of the left heart, while the device below it goes on working perfectly.',
    supportPathway:
      'A balloon inside the descending thoracic aorta, acting on a beat that depends on volume the right ventricle has already delivered through the lungs.',
    deviceOrMechanism:
      'Intra-aortic balloon pump — a mechanism with a ceiling set by the ventricle it is timed to.',
    learningObjective:
      'Recognize a support-mechanism ceiling: technically correct counterpulsation failing because the limiting problem is somewhere else.',
    startingDevice: 'iabp',
    startingActions: [],
    recognizePrompt:
      'Read the highlighted trend. Identify which measurement would tell you first that the limitation has moved upstream of the left heart.',
    recognizeOptions: [
      {
        id: 'rap-rising',
        label: 'Right atrial pressure rising while the pulmonary pulsatility ratio falls',
        correct: true,
        feedback:
          'A right ventricle that cannot deliver backs up behind itself. The right atrial pressure rises and the pulmonary pulse narrows, while left-sided filling stops being the constraint.',
      },
      {
        id: 'timing-quality',
        label: 'The timing synchrony value falling as the balloon loses the beat',
        correct: false,
        feedback:
          'Timing synchrony reports the device against the cardiac cycle. It will sit at its aligned value throughout this section, which is exactly what makes the point.',
      },
      {
        id: 'wedge-rising',
        label: 'The wedge pressure rising as the left ventricle backs up',
        correct: false,
        feedback:
          'In this reference comparison, reducing modeled RV contractility from 0.85 to 0.20 leaves the rounded displayed wedge at 20 mm Hg at matched times, while right atrial pressure doubles and the pulmonary pulse narrows. The displayed wedge has a small indirect response through the LV compartment contribution, but it rounds away here. This does not show that wedge pressure cannot change with RV failure. Read the large right-sided pressure and flow changes in this example; these endpoints do not establish which response happened first.',
      },
    ],
    predictionPrompt:
      'Predict what happens to timing synchrony and to effective systemic delivery when right ventricular contractility falls.',
    predictionItem: item({
      id: 'mcs-iabp-limits-predict-1',
      activityId: 'mcs:learn:iabp-efficacy-limits',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-iabp-rv-limited-ceiling',
      visualAssetIds: ['mcs-monitor'],
      stem: 'Counterpulsation is aligned and stays aligned. You are about to reduce right ventricular contractility sharply. What do you expect to see?',
      choices: [
        {
          id: 'timing-holds-flow-falls',
          label:
            'Synchrony holds while effective delivery, mean pressure and venous saturation all fall',
          rationale:
            'The device is doing exactly what it did before. What changed is the volume arriving at the left heart, and counterpulsation cannot replace delivery it never provided.',
          plausibility: 'best',
        },
        {
          id: 'timing-degrades',
          label:
            'Timing synchrony degrades, because the device is no longer effective for this patient',
          rationale:
            'Synchrony measures the device against the cardiac cycle, not against the adequacy of the circulation. It will not tell you the mechanism has reached its ceiling.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'balloon-compensates',
          label:
            'Effective systemic delivery holds, because the balloon compensates for the failing ventricle',
          rationale:
            'A balloon can only work on a beat that exists. Compensation would require a stream of its own, and this pathway has none.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'retime-again',
          label:
            'Perfusion will recover once inflation and deflation are re-timed, since the balloon is the device in place',
          rationale:
            'Retiming a device that is already aligned delays recognition of a mechanism mismatch, and delay is the harm in this phenotype.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['timing-holds-flow-falls'],
      explanation:
        'Every left-sided device inherits the right ventricle. When the limitation moves upstream, a technically perfect device below it goes on reporting that it is technically perfect while the patient deteriorates — which is why the device display is a poor place to look for a mechanism mismatch.',
      evidenceIds: iabpEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'The valuable half of this prediction is the part about timing synchrony. If you expect it to stay where it is, you already understand that a device can report success and mismatch at the same time.',
    actionMode: 'adjust',
    actionInstruction:
      'Lower the highlighted right ventricular contractility control toward the bottom of its range, and watch the trend rather than the device.',
    targetControl: 'control:patient-rv-contractility',
    allowedActions: ['control:patient-rv-contractility'],
    isActionSatisfied: (state) => state.patient.rightVentricularContractility <= 0.45,
    observationFocus:
      'Watch mean pressure and effective systemic delivery separate on the trend while timing synchrony does not move at all.',
    observedSignals: [
      signal('timingQualityPercent', 'Modeled timing synchrony', '%', 0, 'model-index'),
      signal('rapMmHg', 'Right atrial pressure', 'mm Hg', 0, 'pressure'),
      signal('papi', 'Pulmonary pulsatility ratio', 'ratio', 1, 'pressure'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
      signal('svo2Percent', 'Simulated mixed venous saturation', '%', 0, 'oxygen-balance'),
    ],
    beforeStateLabels: [
      'Aligned timing, no active alarm',
      'A right atrial pressure in the low teens',
      'Effective systemic delivery around four and a half litres per minute',
    ],
    afterStateLabels: [
      'The same aligned timing and still no timing alarm',
      'A right atrial pressure that has roughly doubled',
      'Effective systemic delivery, mean pressure and mixed venous saturation all lower',
    ],
    explanation:
      'The device did not change and its display did not change. The circulation upstream of it did. Counterpulsation scales with the beat it is timed to, so when the volume reaching the left heart falls, a perfectly timed balloon produces less — and reports nothing about why.',
    pressureLevelExplanation:
      'Mean pressure fell modestly while right atrial pressure rose sharply. The pressure that rose is the one behind the failing chamber, which is the signature worth learning.',
    flowLevelExplanation:
      'Effective systemic delivery fell by more than a litre per minute, and every litre of that loss is native, because there is no device line here to absorb it.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation fell with the flow. Delivery followed the flow term rather than the pressure term, which is the relationship the causal ladder predicts.',
    organResponseExplanation:
      'The organ level is where this ends up, and it is not on this screen. The point of recognizing the ceiling now is that the reassessment happens before the organ answer arrives.',
    whatThisEstablishes:
      'That a device can be technically correct and clinically insufficient at the same moment, and that its own display will not tell you which.',
    whatThisDoesNotEstablish:
      'Stop adjusting a balloon that is already timed. When right atrial pressure is rising and output is falling, the right heart is the limit: get an echo, treat the right ventricle (an inotrope, a pulmonary vasodilator, right-sided support), and call the shock team with that assessment.',
    commonMisinterpretation:
      'Treating persistent low output as evidence of a timing fault and continuing to adjust a device that is already aligned.',
    reassessmentPrompt:
      'The balloon is aligned and the patient is worse. What do you check first, and what do you say when you call the shock team?',
    transferContext:
      'A patient with high right atrial pressure, a low pulmonary pulsatility ratio and limited left-heart filling remains poorly perfused despite acceptable timing.',
    transferPrompt:
      'Decide the best next step for that patient, then record the escalation with the button under the answer.',
    completionCondition:
      'Recorded once right ventricular contractility has been lowered into its limited range, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The response trend for a patient on well-timed counterpulsation, with mean arterial pressure and effective systemic flow drawn on the same time axis.',
      whatTheTargetRepresents:
        'Two levels of the causal ladder plotted together. When they move apart, the pressure line is no longer telling you anything about the flow line.',
      howTheActionAffectsTheModel:
        'Reducing right ventricular contractility reduces the volume crossing the lungs to the left heart. The balloon is untouched; what it has to work with is not.',
      flowAccountNote:
        'The device line stays empty throughout. Everything that falls here falls on the native line, which is the whole reason this mechanism has a ceiling.',
    },
  },

  // ── 5 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'impella-unloading-placement',
    lessonTitle: 'Where is the inlet sitting?',
    lessonSequenceLabel: 'Section 5 of 9 · Transvalvular pump',
    clinicalQuestion:
      'The pump setting has not changed and the flow has fallen. Where is the inlet sitting?',
    startingContext:
      'A left-sided transvalvular pump at performance level five with the inlet in the ventricle and the outlet in the aorta. No alarm is active.',
    patientProblem:
      'Left-dominant low output being supported by a pump whose usefulness depends on an anatomical relationship rather than on a setting.',
    supportPathway: 'Left ventricle in, ascending aorta out, across the aortic valve.',
    deviceOrMechanism:
      'Temporary microaxial pump — a direct blood pump whose displayed flow is an estimate, not a probe reading.',
    learningObjective:
      'Relate the inlet-and-outlet relationship to delivered flow, chamber unloading, and blood-trauma risk.',
    startingDevice: 'impella',
    startingActions: [],
    recognizePrompt:
      'Read the pump’s path on the Circulation map — from the left ventricle, across the valve, into the aorta — and identify which chamber this pump is relieving, and which structure inherits the returned flow.',
    recognizeOptions: [
      {
        id: 'lv-relieved-aorta-loaded',
        label:
          'The left ventricle is relieved directly; the returned flow enters the aorta above the valve',
        correct: true,
        feedback:
          'Both halves matter. Volume is taken out of the ventricle, and it is put into a vessel whose pressure the pump then has to work against.',
      },
      {
        id: 'rv-relieved',
        label:
          'The right ventricle is relieved, because less blood returns to it through the venous side',
        correct: false,
        feedback:
          'The right ventricle inherits the whole requirement instead: a left-sided pump can only move blood the right heart has already delivered through the lungs.',
      },
      {
        id: 'aorta-unloaded',
        label: 'The aorta is unloaded, because the pump takes pressure out of it on every beat',
        correct: false,
        feedback:
          'The aorta is the destination, not the source. Returning blood into it raises the pressure the pump ejects against rather than lowering it.',
      },
    ],
    predictionPrompt:
      'Predict what happens to displayed pump flow, left ventricular volume and wedge pressure if the inlet loses its relationship with the valve.',
    predictionItem: item({
      id: 'mcs-impella-placement-predict-1',
      activityId: 'mcs:learn:impella-unloading-placement',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-impella-placement-baseline',
      visualAssetIds: ['mcs-anatomy'],
      stem: 'The pump is at an unchanged performance level. You are about to move it out of its aligned position. What do you expect?',
      choices: [
        {
          id: 'flow-falls-chamber-refills',
          label: 'Estimated flow falls and a placement alarm appears; loading must be reassessed',
          rationale:
            'Support and unloading are both lost together, because both depended on the inlet drawing from inside the chamber. The blood-trauma risk rises because blood is being accelerated through a poorly aligned inlet.',
          plausibility: 'best',
        },
        {
          id: 'flow-holds',
          label: 'Displayed pump flow holds, because the performance level has not been changed',
          rationale:
            'The performance level is a setting. What the pump delivers depends on where its inlet and outlet are sitting and on the pressures at both ends.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'unloading-continues',
          label:
            'Flow falls but unloading continues, because the pump is still inside the left heart somewhere',
          rationale:
            'Unloading is the removal of volume. If the pump is moving less blood out of the chamber, the chamber is being relieved less — the two cannot come apart.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'escalate-level',
          label:
            'Flow falls, and the displayed number comes back once the performance level is raised',
          rationale:
            'Raising support against a malpositioned inlet increases blood trauma without restoring the relationship that was lost. Position is diagnosed before support is escalated.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['flow-falls-chamber-refills'],
      explanation:
        'The aligned inlet-to-outlet relationship supports LV-to-aorta flow. The simulated placement fault reduces flow and unloading. A low estimated flow alone does not diagnose position: assess loading, device function and imaging.',
      evidenceIds: impellaEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'Predicting the direction of the wedge pressure is what separates a guess from a mechanism. If flow falls because the pump stopped removing volume, the chamber behind it has to refill.',
    actionMode: 'adjust',
    actionInstruction:
      'Set the placement condition to Too deep, then compare the captured pump flow and left ventricular volume.',
    targetControl: 'control:impella-left-position',
    allowedActions: ['control:impella-left-position'],
    isActionSatisfied: (state) =>
      state.device.kind === 'impella' &&
      state.device.left.enabled &&
      state.device.left.running &&
      state.device.left.position === 'too-deep' &&
      state.actionIds.includes('impella:left:set-position'),
    observationFocus:
      'Compare displayed pump flow with effective systemic delivery, and read the ventricular volume and wedge pressure as the unloading claim being checked.',
    observedSignals: [
      signal('leftDeviceFlowLMin', 'Displayed pump flow', 'L/min', 1, 'device-display'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('nativeFlowLMin', 'Native contribution', 'L/min', 1, 'flow'),
      signal('lvedvMl', 'Modeled LV end-diastolic volume', 'mL', 0, 'volume'),
      signal('pcwpMmHg', 'Wedge pressure', 'mm Hg', 0, 'pressure'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
    ],
    beforeStateLabels: [
      'Aligned inlet and outlet, no active alarm',
      'A pump flow around two and a half litres per minute',
      'A ventricle held small by the volume being removed from it',
    ],
    afterStateLabels: [
      'A placement alarm with a low-flow and a blood-trauma warning beside it',
      'A captured pump-flow estimate at an unchanged performance level; use its actual change',
      'A larger ventricle and a higher wedge pressure — the unloading given back',
    ],
    explanation:
      'Displaced inlet, lost support. The pump was drawing from inside the ventricle and returning above the valve; once that relationship goes, so does the flow, and the volume the pump was removing goes back into the chamber. The setting never moved.',
    pressureLevelExplanation:
      'Wedge pressure rose and mean arterial pressure fell together. The first is the chamber refilling; the second is the lost forward stream.',
    flowLevelExplanation:
      'A malpositioned pump moves less blood. Native flow changes too, so pump flow and effective delivery do not fall by the same amount, and effective delivery is the one the patient experiences.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation follows the effective line down, not the displayed one. Delivery is a product of what actually reaches the circulation, not of what the console reports moving.',
    organResponseExplanation:
      'Nothing here shows an organ responding. What this state does show is a rising risk of blood trauma, which is an organ-level harm that accumulates while the numbers still look survivable.',
    whatThisEstablishes:
      'That a fall in displayed flow at an unchanged setting is a statement about the pathway — position, filling, or the pressure at the outlet — rather than a request for more support.',
    whatThisDoesNotEstablish:
      'When flow falls at an unchanged P-level, check position with echo and the placement signal before you touch the P-level. Reposition under imaging.',
    commonMisinterpretation:
      'Raising the performance level because the displayed flow fell — escalating against a problem that escalation makes worse.',
    reassessmentPrompt:
      'Before touching any setting, what three things would you check to explain a fallen flow: in the patient, in the position, and in the device?',
    transferContext:
      'The position is acceptable and the level is unchanged, but systemic resistance and aortic pressure rise, and the displayed flow falls anyway.',
    transferPrompt:
      'Interpret that fall, then read the device and effective flow in the transfer patient.',
    completionCondition:
      'Recorded once the specifically requested too-deep condition has been reached and its captured results interpreted, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The heart with a transvalvular pump in place: inlet below the aortic valve inside the left ventricle, outlet above it in the ascending aorta.',
      whatTheTargetRepresents:
        'An anatomical relationship, not a depth measurement. The pump works because it spans two compartments; the direction blood travels through it is fixed and is not the direction the catheter was advanced.',
      howTheActionAffectsTheModel:
        'The placement state moves the inlet relative to the aortic valve. Too deep or too shallow reduces what the pump can draw and raises the hemolysis warning.',
      flowAccountNote:
        'Displayed pump flow is an estimate produced from pump behaviour and assumed loading — not a probe in the bloodstream. Compare its observed change with concurrent native flow and effective systemic flow; do not infer a fixed proportion.',
    },
  },

  // ── 6 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'impella-suction-purge-rv',
    lessonTitle: 'A suction alarm at high support',
    lessonSequenceLabel: 'Section 6 of 9 · Transvalvular pump',
    clinicalQuestion:
      'A left-sided pump at high support is in suction. Is the answer more support, or more delivery to the left heart?',
    startingContext:
      'A left-sided pump at performance level seven in a patient whose right ventricle is failing. Suction, low-flow and blood-trauma alarms are already active, and the pump is delivering about a litre per minute.',
    patientProblem:
      'Right ventricular failure presenting as a left-sided device problem: a high right atrial pressure, an underfilled left ventricle, and a pump with nothing to draw.',
    supportPathway:
      'Two pathways in series. The right-sided pump draws from the inferior vena cava and returns to the pulmonary artery; the left-sided pump draws from the left ventricle and returns to the aorta.',
    deviceOrMechanism:
      'Temporary microaxial support on both sides — right-sided delivery into the lung, left-sided delivery into the systemic circulation.',
    learningObjective:
      'Reconcile right-sided pulmonary delivery with left-sided pump flow, and say why the two are never added together.',
    startingDevice: 'impella',
    startingActions: [
      { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.36 },
      { type: 'SET_IMPELLA_CONTROL', side: 'left', control: 'performanceLevel', value: 7 },
    ],
    recognizePrompt:
      'Identify on the Circulation map where a right-sided pump returns the blood it draws; the candidates are pinned on it.',
    recognizeOptions: [
      {
        id: 'returns-to-pa',
        label: 'Into the pulmonary artery, bypassing the right ventricle',
        correct: true,
        feedback:
          'Its destination is the lung. That blood still has to cross the pulmonary circulation and be moved out of the left heart before any of it reaches an organ.',
      },
      {
        id: 'returns-to-aorta',
        label: 'Into the aorta, adding directly to systemic flow',
        correct: false,
        feedback:
          'That is a left-sided or an arterial-return pathway. A right-sided pump ends in the pulmonary artery, which is why its number is not a second systemic flow.',
      },
      {
        id: 'returns-to-ra',
        label: 'Into the right atrium, recirculating within the right heart',
        correct: false,
        feedback:
          'Returning to the compartment it drew from would be recirculation. This pump crosses the right ventricle to reach the pulmonary artery.',
      },
    ],
    predictionPrompt:
      'Predict what starting right-sided support will do to the left-sided pump flow, and whether the two flows can be added.',
    predictionItem: item({
      id: 'mcs-impella-bipella-predict-1',
      activityId: 'mcs:learn:impella-suction-purge-rv',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-impella-rv-limited-suction',
      visualAssetIds: ['mcs-anatomy', 'mcs-monitor'],
      stem: 'A left-sided pump is in suction at a high performance level because the right ventricle is not delivering. You are about to start a right-sided pump from the vena cava into the pulmonary artery. What do you expect?',
      choices: [
        {
          id: 'left-flow-rises-not-additive',
          label:
            'Suction clears, left-sided flow rises, and delivery rises by less than the two pump numbers added',
          rationale:
            'The right-sided pump fills the left heart, so the left-sided pump finally has something to draw. The two pumps handle the same blood one after the other, so adding their displayed flows counts that blood twice.',
          plausibility: 'best',
        },
        {
          id: 'flows-add',
          label:
            'Effective systemic delivery becomes the left-sided flow plus the right-sided flow, as one total',
          rationale:
            'These pathways are in series, not in parallel. One stream measured at two places along its journey is still one stream.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'no-left-change',
          label:
            'Left-sided pump flow is unchanged, because nothing was done to the left-sided pump itself',
          rationale:
            'The left-sided pump was limited by filling, not by its setting. Restoring delivery to the left heart changes what it has available to move.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'raise-left-instead',
          label:
            'Left-sided flow will rise more if its own level is raised, since that is the low number on the screen',
          rationale:
            'Escalating a pump that is already in suction worsens underfilling and blood trauma. The limitation is upstream, and it is where the intervention belongs.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['left-flow-rises-not-additive'],
      explanation:
        'Serial pathways handle the same blood in sequence. The right-sided pump is a delivery to the lung; the left-sided pump is a delivery to the body; and the systemic flow signal on the display carries the left-sided pump only, on purpose.',
      evidenceIds: rightImpellaEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'The arithmetic half of this prediction is the part that transfers. A learner who adds a right-sided pump flow to a left-sided one will also add an extracorporeal flow to a native cardiac output.',
    actionMode: 'select',
    actionInstruction:
      'Switch the highlighted right-sided support control on, then trace the second pathway that appears on the Circulation map before you look at any number.',
    targetControl: 'control:impella-right-enable',
    allowedActions: ['control:impella-right-enable'],
    isActionSatisfied: (state) => state.device.kind === 'impella' && state.device.right.enabled,
    observationFocus:
      'Add the two displayed pump flows together yourself, then compare that sum with the effective systemic delivery the model reports.',
    observedSignals: [
      signal(
        'rightDeviceFlowLMin',
        'Right-sided pump flow, into the lung',
        'L/min',
        1,
        'device-display',
      ),
      signal(
        'leftDeviceFlowLMin',
        'Left-sided pump flow, into the aorta',
        'L/min',
        1,
        'device-display',
      ),
      signal('deviceFlowLMin', 'Systemic device flow signal', 'L/min', 1, 'device-display'),
      signal('nativeFlowLMin', 'Native contribution', 'L/min', 1, 'flow'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('rapMmHg', 'Right atrial pressure', 'mm Hg', 0, 'pressure'),
    ],
    beforeStateLabels: [
      'Suction, low-flow and blood-trauma alarms active on the left-sided pump',
      'A left-sided pump delivering about a litre per minute at a high setting',
      'A right atrial pressure around twenty mm Hg',
    ],
    afterStateLabels: [
      'No active alarm: the suction cleared without touching the left-sided setting',
      'A right-sided flow into the lung and a left-sided flow into the aorta, reported separately',
      'An effective systemic delivery well below the sum of the two pump numbers',
    ],
    explanation:
      'The left-sided pump was never short of setting; it was short of blood. Restoring delivery through the lung filled the left ventricle, and the pump that had been sucking against an empty chamber started moving blood. The two pump numbers describe one stream at two stages of its journey, which is why the display keeps them apart and why the systemic device signal carries only the left-sided one.',
    pressureLevelExplanation:
      'Right atrial pressure fell as blood was taken forward out of the right-sided circulation, and mean arterial pressure rose as the left-sided pump began delivering.',
    flowLevelExplanation:
      'Left-sided pump flow more than doubled with no change to its own setting. Effective systemic delivery rose by roughly a litre and a half — far less than the two displayed pump flows added together, because the pathways are in series.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation rose with effective delivery. It did not rise by the size of the combined pump numbers, which is the arithmetic error made visible.',
    organResponseExplanation:
      'Suction clearing is a device-level improvement. Whether the organs recover shows over hours at the bedside.',
    whatThisEstablishes:
      'That a left-sided device problem can be an upstream delivery problem, and that serial pump flows describe one stream measured twice.',
    whatThisDoesNotEstablish:
      'For a suction alarm: reduce the P-level by one or two levels, give volume if the patient is underfilled, check position with echo, assess the right ventricle, then return to the previous level. When the right ventricle is the cause, treat it; do not raise the left pump further.',
    commonMisinterpretation:
      'Adding the right-sided and left-sided displayed flows and reporting the total as cardiac output.',
    reassessmentPrompt:
      'Which findings, other than the two pump displays, would you use to decide whether right-sided support is achieving anything?',
    transferContext:
      'A left-sided pump is running at a high level when preload falls abruptly and a suction pattern appears with a lower effective flow.',
    transferPrompt:
      'Choose the safest immediate response, then make that change to the performance level in the Controls under the monitor.',
    completionCondition:
      'Recorded once right-sided support has been started, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The heart with a left-sided pump across the aortic valve and, once you start it, a right-sided pump running from the inferior vena cava into the pulmonary artery.',
      whatTheTargetRepresents:
        'A second pathway whose destination is the lung. The cannula was advanced from a peripheral vein, but blood travels caval-to-pulmonary — direction of advancement and direction of flow are different things.',
      howTheActionAffectsTheModel:
        'Starting right-sided support raises delivery through the pulmonary circulation, which fills the left ventricle and lets the left-sided pump move blood it previously did not have.',
      flowAccountNote:
        'The systemic device-flow signal reports the left-sided pump only, and never carries the right-sided pump. That is not a display quirk: it is the difference between a delivery into the lung and a delivery into the body. Both pump numbers are estimates produced from pump behaviour and assumed loading, and the effective systemic line beneath them is reasoned rather than read.',
    },
  },

  // ── 7 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'lvad-parameters-assessment',
    lessonTitle: 'Speed unchanged, resistance rising',
    lessonSequenceLabel: 'Section 7 of 9 · Durable support',
    clinicalQuestion:
      'The speed has not changed and the displayed flow has fallen. What does that number actually measure?',
    startingContext: `A durable continuous-flow pump at an unchanged speed. Power, pulsatility index and displayed flow are steady, mean arterial pressure is in the goal range of ${mapGoal}, and no alarm is active.`,
    patientProblem:
      'A patient on durable support whose systemic vascular resistance is about to rise sharply while nothing about the pump changes.',
    supportPathway:
      'Left ventricular apex in, ascending aorta out, through an implanted pump and an outflow graft.',
    deviceOrMechanism:
      'Durable continuous-flow pump — a different decision in kind from temporary support, with candidacy, implantation and an exit strategy settled beforehand.',
    learningObjective:
      'Read displayed flow, power and pulsatility index as one interdependent set, and explain why the displayed flow is an estimate.',
    startingDevice: 'lvad',
    startingActions: [],
    recognizePrompt: 'Identify how the flow on a durable pump’s controller is produced.',
    recognizeOptions: [
      {
        id: 'from-power-and-speed',
        label: 'The controller calculates it from pump power at the set speed',
        correct: true,
        feedback:
          'Power is the measured value: the watts the motor draws. The controller calculates flow from power at the set speed and the hematocrit entered. Anything that raises power raises the displayed flow, whether or not more blood is moving.',
      },
      {
        id: 'from-a-probe',
        label: 'It is measured directly by a flow probe on the outflow graft',
        correct: false,
        feedback:
          'No durable pump has a flow probe. A measured flow and a calculated flow look the same on a display and are not the same kind of number.',
      },
      {
        id: 'from-cardiac-output',
        label: 'It is the patient’s total cardiac output, native and pump together',
        correct: false,
        feedback:
          'It describes what the pump is moving along its own pathway. Whatever the native ventricle still ejects is a separate line, and the reconciled total is a third.',
      },
    ],
    predictionPrompt:
      'Predict what happens to displayed flow, mean pressure and cardiac power when systemic vascular resistance rises at an unchanged speed.',
    predictionItem: item({
      id: 'mcs-lvad-afterload-predict-1',
      activityId: 'mcs:learn:lvad-parameters-assessment',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-lvad-rising-afterload',
      visualAssetIds: ['mcs-monitor'],
      stem: 'The pump speed will not change. Systemic vascular resistance is about to rise substantially. What do you expect the controller and the hemodynamics to show?',
      choices: [
        {
          id: 'flow-falls-pressure-rises',
          label:
            'Displayed flow and delivery both fall while mean pressure rises sharply, and cardiac power rises',
          rationale:
            'A continuous-flow pump works across a pressure gradient, so a higher outflow pressure lowers delivered flow at the same speed. Cardiac power is a pressure–flow product, and here the pressure term is moving far more than the flow term.',
          plausibility: 'best',
        },
        {
          id: 'flow-holds',
          label: 'Displayed flow holds, because speed sets flow and the speed has not changed',
          rationale:
            'Speed sets how fast the impeller turns, not how much blood crosses it. What crosses depends on the pressures at both ends.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'power-surges',
          label:
            'Power surges, because the pump is working harder against the higher pressure it faces',
          rationale:
            'Power follows flow. Against a higher pressure the pump moves less blood at the same speed, so power falls a little. Power that rises at an unchanged speed is a different pattern: thrombus.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'raise-speed',
          label:
            'The displayed flow will come back to where it was once the speed is raised to chase it',
          rationale:
            'Raising speed against a high blood pressure invites suction, septal shift and right ventricular failure. Lower the pressure and the flow comes back.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['flow-falls-pressure-rises'],
      explanation:
        'A pressure improvement that is not a perfusion improvement: mean pressure rises by tens of mm Hg, pump flow falls by nearly a litre per minute, and cardiac power, which multiplies the two, goes up.',
      evidenceIds: lvadEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'The line worth arguing about is power. On a continuous-flow pump power follows flow: less blood crossing the pump at the same speed draws less power.',
    actionMode: 'adjust',
    actionInstruction:
      'Raise the highlighted systemic vascular resistance control toward the top of its range without touching the pump, then read the controller block.',
    targetControl: 'control:patient-svr',
    allowedActions: ['control:patient-svr'],
    isActionSatisfied: (state) => state.patient.systemicVascularResistanceDynSecCm5 >= 1_700,
    observationFocus:
      'Read the mean pressure and the effective systemic delivery in the same glance, then check what cardiac power did.',
    observedSignals: [
      signal('pumpPowerW', 'Pump power', 'W', 1, 'device-display'),
      signal('pulsatilityIndex', 'Pulsatility index', 'index', 1, 'device-display'),
      signal('estimatedPumpFlowLMin', 'Displayed pump flow', 'L/min', 1, 'device-display'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
      signal('cardiacPowerOutputW', 'Calculated cardiac power output', 'W', 2, 'pressure-flow'),
    ],
    beforeStateLabels: [
      'An unchanged speed with power and pulsatility index at this patient’s baseline',
      'A displayed pump flow near four litres per minute',
      'A mean pressure in the goal range',
    ],
    afterStateLabels: [
      'The same speed, with power a little lower and the pulsatility index a little higher',
      'A displayed pump flow and an effective systemic delivery both lower',
      'A markedly higher mean pressure, the high-afterload alarm, and a cardiac power that rose while flow fell',
    ],
    explanation:
      'Nothing was done to the pump. A continuous-flow pump is afterload-sensitive: raising the pressure it ejects against lowered the flow crossing it, so displayed flow and delivery both fell. Power fell with the flow and the pulsatility index rose a little. The one value that rose is cardiac power, a pressure multiplied by a flow.',
    pressureLevelExplanation: `Mean arterial pressure rose by tens of mm Hg. Read alone, that looks like an improving patient. On a continuous-flow pump the mean pressure is kept ${mapCeiling}.`,
    flowLevelExplanation:
      'Displayed flow and effective systemic delivery both fell. The display followed the real flow here because power followed it.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation fell with the flow while cardiac power rose. A summary number built from two rungs of the ladder can move against both.',
    organResponseExplanation:
      'Hypertension on a continuous-flow pump lowers pump flow and raises the risk of stroke. Check the organs at the bedside, and treat the blood pressure.',
    whatThisEstablishes:
      'The displayed flow is an estimate that moves with loading, and a rising pressure can go with a falling delivery.',
    whatThisDoesNotEstablish: `Lower mean arterial pressure to the goal of ${mapGoal} with afterload reduction. Pump flow rises as the pressure falls. Do not raise the speed against a high pressure.`,
    commonMisinterpretation:
      'Treating the displayed flow as a measured cardiac output, or treating a rising cardiac power as proof that perfusion improved.',
    reassessmentPrompt:
      'Displayed flow is low. Which other values do you read with it, and what do you do first if the blood pressure is the cause?',
    transferContext:
      'The same rise in resistance happens overnight: mean pressure and resistance are up, the displayed flow is down, and no controller fault is present.',
    transferPrompt:
      'Choose the best interpretation, then read the controller together with the pressures in the transfer patient.',
    completionCondition:
      'Recorded once systemic vascular resistance has been raised into its high range, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The controller block of a durable continuous-flow pump: pump power and pulsatility index beside the flow the controller displays.',
      whatTheTargetRepresents:
        'The speed you set, the power the controller measures, the flow it calculates from that power, and the pulsatility index.',
      howTheActionAffectsTheModel:
        'Raising systemic vascular resistance raises the pressure at the outlet, which lowers the volume crossing the pump at an unchanged speed.',
      flowAccountNote:
        'The displayed line is the controller’s estimate. Effective systemic delivery adds what the native ventricle still ejects alongside the pump.',
    },
  },

  // ── 8 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'lvad-alarms-emergencies',
    lessonTitle: 'An alarm at an unchanged speed',
    lessonSequenceLabel: 'Section 8 of 9 · Durable support',
    clinicalQuestion:
      'Pump power has climbed at an unchanged speed. Can you still believe the flow the controller displays?',
    startingContext:
      'The same durable pump and the same patient as Section 7: mean arterial pressure in the goal range, no alarm, and power at this patient’s baseline.',
    patientProblem:
      'A patient on durable support who is about to develop thrombus on the pump rotor.',
    supportPathway:
      'Left ventricular apex in, ascending aorta out, through an implanted pump and an outflow graft.',
    deviceOrMechanism:
      'Durable continuous-flow pump with a high-power pattern: suspected pump thrombosis.',
    learningObjective:
      'Read power, displayed flow and pulsatility index together, recognize suspected pump thrombosis, and name the first moves.',
    startingDevice: 'lvad',
    startingActions: [],
    recognizePrompt:
      'Read the highlighted alarm band and identify what an alarm on this pathway is reporting.',
    recognizeOptions: [
      {
        id: 'a-modeled-state',
        label: 'A pattern in the controller’s values, with its interpretation printed beneath it',
        correct: true,
        feedback:
          'Each alarm names a pattern and says what produced it. You still have to work out why the pattern is there.',
      },
      {
        id: 'a-threshold-breach',
        label: 'Proof that the pump itself has failed',
        correct: false,
        feedback:
          'Most LVAD alarms come from the patient: filling, blood pressure, the right heart. The pump is one cause among several.',
      },
      {
        id: 'a-diagnosis',
        label: 'A diagnosis the controller has made',
        correct: false,
        feedback:
          'A controller reports a pattern. The diagnosis comes from the patient, the trend, the laboratory tests and an echo.',
      },
    ],
    predictionPrompt:
      'Predict what a high-power pattern will do to pump power, the displayed flow and the pulsatility index.',
    predictionItem: item({
      id: 'mcs-lvad-high-power-predict-1',
      activityId: 'mcs:learn:lvad-alarms-emergencies',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-lvad-high-power-pattern',
      visualAssetIds: ['mcs-monitor'],
      stem: 'You are about to switch on the high-power pattern at an unchanged speed and unchanged loading. What do you expect the controller to show?',
      choices: [
        {
          id: 'power-rises-flow-rises',
          label:
            'Power rises and the displayed flow rises with it, while the pulsatility index falls',
          rationale:
            'The controller measures power and calculates the displayed flow from it. Thrombus on the rotor adds drag, so power rises and the displayed flow rises with it. Less blood is really crossing the pump, so the pulsatility index and the patient fall.',
          plausibility: 'best',
        },
        {
          id: 'power-rises-flow-static',
          label: 'Power rises substantially while the displayed flow does not move',
          rationale:
            'The displayed flow is calculated from power at the set speed. It cannot stay still when power rises.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'flow-falls-with-power',
          label:
            'Power rises and the displayed flow falls in proportion, as it does against a stiff circulation',
          rationale:
            'The real flow falls. The displayed flow does not: it is calculated from power, so it rises. Against a stiff circulation power and displayed flow fall together.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'power-falls',
          label: 'Power falls, because an obstruction means less blood is crossing the pump',
          rationale:
            'Power falls when the pump moves less blood against a higher pressure. Thrombus on the rotor adds drag, and the motor draws more power to hold its speed.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'disconnect-to-check',
          label:
            'The alarm will clear by itself if the power source is disconnected briefly and reconnected',
          rationale:
            'Stopping a continuous-flow pump can cause immediate collapse and backflow through the pump. Keep power connected.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['power-rises-flow-rises'],
      explanation:
        'The displayed flow is an estimate from power. Thrombus raises power, so the display reads high while the real flow falls. Read power, displayed flow and pulsatility index together, and believe the patient over the display.',
      evidenceIds: lvadEvidence,
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'Commit to what the displayed flow will do. A number that goes up while the patient gets worse is the finding.',
    actionMode: 'select',
    actionInstruction:
      'Switch on the highlighted high-power pattern, then read power, displayed flow and pulsatility index together.',
    targetControl: 'control:lvad-thrombosis',
    allowedActions: ['control:lvad-thrombosis'],
    isActionSatisfied: (state) =>
      state.device.kind === 'lvad' && state.device.suspectedPumpThrombosis,
    observationFocus:
      'Compare power and displayed flow with the pulsatility index, mean pressure and effective delivery, and read the alarm interpretation beneath the band.',
    observedSignals: [
      signal('pumpPowerW', 'Pump power', 'W', 1, 'device-display'),
      signal('estimatedPumpFlowLMin', 'Displayed pump flow', 'L/min', 1, 'device-display'),
      signal('deviceFlowLMin', 'Real pump flow', 'L/min', 1, 'flow'),
      signal('pulsatilityIndex', 'Pulsatility index', 'index', 1, 'device-display'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
      signal('svo2Percent', 'Simulated mixed venous saturation', '%', 0, 'oxygen-balance'),
    ],
    beforeStateLabels: [
      'No active alarm, power at this patient’s baseline',
      'A displayed flow near four litres per minute',
      'Pressures and mixed venous saturation at their baseline',
    ],
    afterStateLabels: [
      'A high-power alarm with its interpretation beneath the band',
      'Power up by about two watts, and the displayed flow up with it',
      'A lower pulsatility index, mean pressure, effective delivery and mixed venous saturation',
    ],

    explanation: `Power is measured; the displayed flow is calculated from it. Thrombus on the rotor adds drag, so the motor draws more power to hold its speed and the controller reports more flow. The pump is really moving less blood: the pulsatility index, the mean pressure and effective delivery all fell. Power elevation that suggests pump thrombosis is ${powerElevation}.`,
    pressureLevelExplanation:
      'Mean arterial pressure fell a few mm Hg while the displayed flow rose. A pump that was really moving more blood would raise the pressure.',
    flowLevelExplanation:
      'The displayed flow rose and the real pump flow fell. Effective systemic delivery fell less, because the native ventricle is ejecting more through the aortic valve.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation fell with delivery. The display says more flow; the oxygen balance says less.',
    organResponseExplanation:
      'Do not wait for the organs to tell you. Hemolysis comes first: dark urine, a rising LDH and plasma free hemoglobin. Then heart failure returns.',
    whatThisEstablishes:
      'The displayed flow is an estimate from power, so pump thrombosis makes it read falsely high. Power up, displayed flow up, pulsatility index down and a worse patient is the pattern.',
    whatThisDoesNotEstablish:
      'Keep power connected. Send LDH and plasma free hemoglobin, check the anticoagulation, get an echo, and call the LVAD team and surgeon.',
    commonMisinterpretation:
      'Reading the higher displayed flow as better support, or disconnecting a power source to see whether an alarm clears.',
    reassessmentPrompt:
      'Power is up, the displayed flow is up and the patient is worse. What do you do first, in order?',
    transferContext:
      'Power rises at an unchanged speed, the displayed flow rises with it, and the patient is worse.',
    transferPrompt:
      'Choose the first moves, then record the call to the LVAD team with the button under the answer.',
    completionCondition:
      'Recorded once the high-power pattern has been switched on, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The alarm band of the bedside monitor, with the interpretation of each active alarm printed beneath it.',
      whatTheTargetRepresents:
        'A pattern in the controller’s values and its explanation. Read each alarm as a statement about the circulation.',
      howTheActionAffectsTheModel:
        'The high-power pattern adds drag on the rotor: the pump draws more power at an unchanged speed, the calculated flow on the display rises, and the real flow falls.',
      flowAccountNote:
        'Displayed pump flow is the controller’s estimate from power. When the estimate and the real flow separate, the flow account prints both. Only a simulator can show you the real one.',
    },
  },

  // ── 9 ──────────────────────────────────────────────────────────────────────
  {
    sectionId: 'mcs-device-selection-integration',
    lessonTitle: 'Low output on left-sided support',
    lessonSequenceLabel: 'Section 9 of 9 · Choosing between mechanisms',
    clinicalQuestion:
      'Output is low on left-sided support. Is the limiting problem the left ventricle, or what is reaching it?',
    startingContext:
      'A left-sided pump at performance level five in a patient whose right atrial pressure and wedge pressure are both elevated and sitting at about the same number, with a low pulmonary pulsatility ratio. Suction and low-flow alarms are already active. The congestion panel further down this screen reads both pressures against the consensus description and calls the pattern biventricular; that is a separate question from which side is limiting the pump, and this section is about the second one.',
    patientProblem:
      'Low output whose limitation sits upstream of the left heart, presenting as a left-sided device that is not delivering.',
    supportPathway:
      'Left ventricle in, ascending aorta out — a pathway that can only move what the right heart has already delivered through the lungs.',
    deviceOrMechanism:
      'A temporary transvalvular pump, held against the question of whether more of it is the answer.',
    learningObjective:
      'Name the limiting problem from the relationship between right-sided and left-sided filling pressures, before naming any device.',
    startingDevice: 'impella',
    startingActions: [
      { type: 'SET_PATIENT_CONTROL', control: 'rightVentricularContractility', value: 0.34 },
      { type: 'SET_PATIENT_CONTROL', control: 'preloadPercent', value: 88 },
    ],
    recognizePrompt:
      'Read the highlighted filling pressures and identify which side of the heart this profile says is limiting delivery; the two sides are pinned on the Circulation map.',
    recognizeOptions: [
      {
        id: 'right-sided',
        label:
          'The right side: a right atrial pressure that has risen to meet the wedge pressure, with the pump in suction and gaining almost nothing from more level',
        correct: true,
        feedback:
          'Both filling pressures are elevated here, and the congestion panel says so. What makes the right side the limit is not the wedge pressure being low — it is not — but the relationship and what the pump does: right atrial pressure has risen to about the wedge pressure, the pulmonary pulsatility ratio is 0.5, and the left pump is in suction. Three extra levels buy about a quarter of a litre and leave the suction in place. A left pump cannot move what the right heart does not deliver.',
      },
      {
        id: 'left-sided',
        label:
          'The left side: an elevated wedge pressure, so the left ventricle is congested and needs unloading',
        correct: false,
        feedback:
          'Half right, and worth separating. The wedge pressure is elevated — the congestion panel on this screen calls the pattern biventricular, and it is correct. But a filling pressure says where pressure is high, not what is limiting the pump. In a left-limited profile the wedge pressure dominates the right atrial pressure and unloading the left ventricle relieves it; here the two are about equal, the pump is in suction, and more of it buys almost nothing.',
      },
      {
        id: 'afterload',
        label:
          'Neither: the limitation is the pressure the pump ejects against, downstream of the outlet',
        correct: false,
        feedback:
          'An afterload limitation shows as a falling flow with a rising arterial pressure. Here the arterial pressure is low and the pump is in suction, which is an inflow story.',
      },
    ],
    predictionPrompt:
      'Predict how much effective systemic delivery will gain if you raise the left-sided pump from level five to level eight in this patient.',
    predictionItem: item({
      id: 'mcs-integration-predict-1',
      activityId: 'mcs:learn:mcs-device-selection-integration',
      phase: 'predict',
      itemType: 'response-prediction',
      contextRequirement: 'patient',
      clinicalContextId: 'mcs-integration-rv-limited-escalation',
      visualAssetIds: ['mcs-monitor', 'mcs-anatomy'],
      stem: 'Right atrial pressure and wedge pressure are both elevated and about equal, and the left-sided pump is in suction at level five. You raise it to level eight. What do you expect?',
      choices: [
        {
          id: 'small-gain-suction-persists',
          label: 'A small gain of a few tenths of a litre, with the suction alarm still active',
          rationale:
            'The pump can only move blood that has reached the left ventricle. Raising the setting against an underfilled chamber buys very little and leaves the suction, and therefore the blood-trauma risk, in place.',
          plausibility: 'best',
        },
        {
          id: 'proportional-gain',
          label: 'A gain of about a litre per minute, in proportion to the three levels added',
          rationale:
            'That is what this same change produces in a patient whose right ventricle is delivering. The difference between the two is the whole point of naming the limiting problem first.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'rap-falls',
          label:
            'Right atrial pressure falls, because the left-sided pump decompresses the circulation',
          rationale:
            'A left-sided pump draws from the left ventricle. It does not relieve the chamber that is failing to deliver into the lungs.',
          plausibility: 'incorrect-mechanism',
        },
        {
          id: 'keep-escalating',
          label:
            'The displayed flow will read as adequate once the level has been raised far enough',
          rationale:
            'Escalating through active suction worsens underfilling and blood trauma, and drives a display upward while the patient does not improve.',
          plausibility: 'unsafe',
        },
      ],
      correctChoiceIds: ['small-gain-suction-persists'],
      explanation:
        'Device selection is a statement about which part of the circulation is failing. Adding left-sided support to a right-limited circulation raises the displayed number more than it raises effective systemic delivery, and leaves the limitation exactly where it was.',
      evidenceIds: [...bedside, 'ishlt-durable-mcs-2023'],
      reviewStatus: 'draft',
    }),
    predictionReasoning:
      'Naming the expected size in advance is what makes the result usable. A gain of a couple of tenths and a gain of a litre lead to different decisions, and only one of them was predictable from the filling pressures.',
    actionMode: 'adjust',
    actionInstruction:
      'You have two devices to choose between. First raise the left-sided pump from P-5 to P-8 and read the filling pressures and the effective systemic delivery. Then make the other choice: switch on right-sided support (Impella RP) and read them again.',
    targetControl: 'control:impella-left-level',
    allowedActions: ['control:impella-left-level', 'control:impella-right-enable'],
    isActionSatisfied: (state) =>
      state.device.kind === 'impella' && state.device.left.performanceLevel >= 8,
    observationFocus:
      'Read how much the displayed pump flow moved, how much the effective systemic delivery moved, and whether the right atrial pressure moved at all.',
    observedSignals: [
      signal('rapMmHg', 'Right atrial pressure', 'mm Hg', 0, 'pressure'),
      signal('pcwpMmHg', 'Wedge pressure', 'mm Hg', 0, 'pressure'),
      signal('leftDeviceFlowLMin', 'Displayed pump flow', 'L/min', 1, 'device-display'),
      signal('effectiveSystemicFlowLMin', 'Effective systemic delivery', 'L/min', 1, 'flow'),
      signal('mapMmHg', 'Mean arterial pressure', 'mm Hg', 0, 'pressure'),
      signal('svo2Percent', 'Simulated mixed venous saturation', '%', 0, 'oxygen-balance'),
    ],
    beforeStateLabels: [
      'A right atrial pressure and a wedge pressure both elevated and about equal',
      'A left-sided pump in suction at level five, delivering about half a litre per minute',
      'A low mean pressure and a low mixed venous saturation',
    ],
    afterStateLabels: [
      'A right atrial pressure that has not moved',
      'A displayed pump flow and an effective systemic delivery each higher by a few tenths',
      'The same suction and low-flow alarms still active',
    ],
    explanation:
      'Three levels of extra support bought a fraction of what the same change buys in a delivering circulation, and it bought it while the pump stayed in suction. The limitation was never the setting, and the profile said so before the change was made: a right atrial pressure that has risen to meet the wedge pressure, a low pulmonary pulsatility ratio, and a pump already in suction are a delivery problem upstream of the left ventricle. Both pressures being high is a congestion pattern; which side is limiting the pump is a different reading of the same two numbers.',
    pressureLevelExplanation:
      'Mean pressure moved a few mm Hg and right atrial pressure did not move at all. The pressure behind the failing chamber is unchanged because nothing was done for that chamber.',
    flowLevelExplanation:
      'The displayed pump flow and the effective systemic delivery both rose by a few tenths of a litre per minute. In a patient whose right ventricle is delivering, the same change produces several times that.',
    oxygenDeliveryExplanation:
      'Mixed venous saturation barely moved, because delivery follows effective flow and effective flow barely moved.',
    organResponseExplanation:
      'Raising the left pump changed nothing for the organs, and persistent suction causes hemolysis. Supporting the right heart is what moves this patient: with right-sided support on, effective systemic delivery rises by close to a litre a minute and mean pressure by about ten mm Hg, where three more levels on the left pump bought about a tenth of a litre.',
    whatThisEstablishes:
      'That the limiting problem can be named from the filling pressures before any device is named, and that support added to the wrong side raises a display more than it raises delivery.',
    whatThisDoesNotEstablish:
      'Name the limiting side before you name a device. Here it is the right heart: reduce the P-level out of suction, get an echo, and treat the right ventricle (an inotrope, a pulmonary vasodilator, right-sided support) instead of raising the left pump.',
    commonMisinterpretation:
      'Reading a rising displayed pump flow as evidence that escalation worked, when effective systemic delivery moved a fraction as far and the suction never cleared.',
    reassessmentPrompt:
      'What would have to appear on reassessment to change the interpretation of the limiting problem?',
    transferContext:
      'The same low output, with a rising right atrial pressure and a falling pulmonary pulsatility ratio, and left-sided support under consideration.',
    transferPrompt:
      'Choose the reasoning that selects the next mechanism, then read the right-sided filling and the device-versus-effective flow relationship in the transfer patient.',
    completionCondition:
      'Recorded once the left-sided performance level has been raised to at least eight, the prediction and its verdict have been worked through, the before-and-after comparison has been seen, and a transfer answer has been committed.',
    teaching: {
      whatYouAreSeeing:
        'The filling pressures for a patient on left-sided support: right atrial pressure and wedge pressure side by side, with the pulmonary trace above them.',
      whatTheTargetRepresents:
        'The relationship between the two sides of the heart. Which of these two pressures dominates is what decides whether the problem is delivery to the left heart or the left heart itself.',
      howTheActionAffectsTheModel:
        'Raising the left-sided performance level asks the pump to move more blood out of a chamber that is not being filled, so most of the requested support is not available.',
      flowAccountNote:
        'Watch the displayed pump flow and the effective systemic delivery rise by different amounts. The displayed line is an estimate computed from pump behaviour and assumed loading; the effective line is reasoned from the whole circulation. The native ventricle gives up part of its contribution as the pump takes over, which is why the two never move together.',
    },
  },
]

const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^explore the device\.?$/i,
  /^review the case\.?$/i,
  /^optimi[sz]e support\.?$/i,
  /^assess the patient\.?$/i,
  /^continue when ready\.?$/i,
  /^observe the response\.?$/i,
  /^explore\b/i,
  /^review\b.{0,20}$/i,
]

/**
 * Terms this module refuses in section copy.
 *
 * Deliberately narrower than the shared learner-copy list, which also bans "correct", "test" and
 * "%" — words a section about aligned placement, a mixed venous saturation, or a synchrony reading
 * cannot do without. What is banned here is the grading and software vocabulary, which has no
 * clinical use at all. The authored prediction items go through the full shared schema instead.
 */
const FORBIDDEN_CONTRACT_TERMS = [
  'grade',
  'graded',
  'score',
  'scored',
  'mastery',
  'mastered',
  'exam',
  'quiz',
  'competency',
  'competent',
  'certification',
  'certified',
  'localstorage',
  'reducer',
] as const

const DIRECT_VERB_PATTERN = /^(?:Do not|Don’t|[A-Z][a-z]+)\b/

function contractText(contract: AuthoredSectionContract): readonly string[] {
  return [
    contract.clinicalQuestion,
    contract.startingContext,
    contract.patientProblem,
    contract.supportPathway,
    contract.deviceOrMechanism,
    contract.learningObjective,
    contract.recognizePrompt,
    contract.predictionPrompt,
    contract.predictionReasoning,
    contract.actionInstruction,
    contract.noActionExplanation ?? '',
    contract.observationFocus,
    contract.unmodeledNote ?? '',
    contract.explanation,
    contract.pressureLevelExplanation,
    contract.flowLevelExplanation,
    contract.oxygenDeliveryExplanation,
    contract.organResponseExplanation,
    contract.whatThisEstablishes,
    contract.whatThisDoesNotEstablish,
    contract.commonMisinterpretation,
    contract.reassessmentPrompt,
    contract.transferContext,
    contract.transferPrompt,
    contract.completionCondition,
    contract.teaching.whatYouAreSeeing,
    contract.teaching.whatTheTargetRepresents,
    contract.teaching.howTheActionAffectsTheModel,
    contract.teaching.flowAccountNote,
    ...contract.beforeStateLabels,
    ...contract.afterStateLabels,
    ...contract.recognizeOptions.flatMap((option) => [option.label, option.feedback]),
  ]
}

const REQUIRED_TEXT_FIELDS = [
  'lessonTitle',
  'lessonSequenceLabel',
  'clinicalQuestion',
  'startingContext',
  'patientProblem',
  'supportPathway',
  'deviceOrMechanism',
  'learningObjective',
  'recognizePrompt',
  'predictionPrompt',
  'predictionReasoning',
  'actionInstruction',
  'observationFocus',
  'explanation',
  'pressureLevelExplanation',
  'flowLevelExplanation',
  'oxygenDeliveryExplanation',
  'organResponseExplanation',
  'whatThisEstablishes',
  'whatThisDoesNotEstablish',
  'commonMisinterpretation',
  'reassessmentPrompt',
  'transferContext',
  'transferPrompt',
  'completionCondition',
] as const satisfies readonly (keyof AuthoredSectionContract)[]

function validateContracts(): readonly string[] {
  const errors: string[] = []
  const authored = authoredContracts.map((contract) => contract.sectionId)
  const known = mcsLessons.map((lesson) => lesson.id)

  for (const id of known) {
    if (!authored.includes(id)) errors.push(`no learning contract authored for section ${id}`)
  }
  for (const id of authored) {
    if (!known.includes(id)) errors.push(`learning contract authored for unknown section ${id}`)
  }
  if (authored.join(',') !== known.join(',')) {
    errors.push('learning contracts must be authored in pathway order, one per section')
  }

  for (const contract of authoredContracts) {
    const where = contract.sectionId
    const lesson = mcsLessons.find((candidate) => candidate.id === contract.sectionId)
    if (lesson && lesson.title !== contract.lessonTitle) {
      errors.push(`${where}: lesson title disagrees with the lesson catalog`)
    }
    if (!mcsLessonTransferByLessonId.has(contract.sectionId)) {
      errors.push(`${where}: no authored transfer to close the section with`)
    }

    for (const field of REQUIRED_TEXT_FIELDS) {
      if (!String(contract[field] ?? '').trim()) errors.push(`${where}: ${field} is empty`)
    }
    for (const list of [
      contract.beforeStateLabels,
      contract.afterStateLabels,
      contract.observedSignals,
      contract.recognizeOptions,
      contract.allowedActions,
    ]) {
      if (list.length === 0) errors.push(`${where}: a required list is empty`)
    }
    if (contract.recognizeOptions.filter((option) => option.correct).length !== 1) {
      errors.push(`${where}: the recognize task must have exactly one right identification`)
    }
    for (const option of contract.recognizeOptions) {
      if (!option.feedback.trim())
        errors.push(`${where}: recognize option ${option.id} has no feedback`)
    }
    if (contract.predictionItem.activityId !== `mcs:learn:${contract.sectionId}`) {
      errors.push(`${where}: the prediction item belongs to a different section`)
    }
    if (contract.predictionItem.phase !== 'predict') {
      errors.push(`${where}: the prediction item is not authored as a prediction`)
    }
    if (!contract.predictionItem.choices.some((choice) => choice.plausibility === 'unsafe')) {
      errors.push(`${where}: the prediction offers no unsafe branch to name`)
    }

    if (!DIRECT_VERB_PATTERN.test(contract.actionInstruction)) {
      errors.push(`${where}: the action instruction does not begin with a direct verb`)
    }
    for (const [label, copy] of [
      ['recognizePrompt', contract.recognizePrompt],
      ['predictionPrompt', contract.predictionPrompt],
      ['actionInstruction', contract.actionInstruction],
      ['observationFocus', contract.observationFocus],
      ['transferPrompt', contract.transferPrompt],
    ] as const) {
      if (!DIRECT_VERB_PATTERN.test(copy))
        errors.push(`${where}: ${label} does not open with a verb`)
      if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(copy.trim()))) {
        errors.push(`${where}: ${label} is placeholder copy`)
      }
    }
    for (const copy of contractText(contract)) {
      if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(copy.trim()))) {
        errors.push(`${where}: placeholder copy — "${copy}"`)
      }
      const flagged = FORBIDDEN_CONTRACT_TERMS.filter((term) =>
        new RegExp(`(^|[^A-Za-z0-9])${term}(?=$|[^A-Za-z0-9])`, 'i').test(copy),
      )
      if (flagged.length > 0) errors.push(`${where}: copy carries ${flagged.join(', ')}`)
    }

    if (contract.actionMode === 'inspect-only') {
      if (contract.targetControl) {
        errors.push(`${where}: an inspect-only section must not point at a control to move`)
      }
      if (!contract.noActionExplanation?.trim()) {
        errors.push(`${where}: an inspect-only section must say that no adjustment is expected`)
      }
    } else if (!contract.targetControl) {
      errors.push(`${where}: a ${contract.actionMode} section must name the control it means`)
    }
    for (const controlId of contract.allowedActions) {
      if (!mcsLearnControls[controlId]) errors.push(`${where}: unknown control ${controlId}`)
    }
    if (contract.targetControl && !contract.allowedActions.includes(contract.targetControl)) {
      errors.push(`${where}: the target control is not among the allowed actions`)
    }
    const targetControl = contract.targetControl
      ? mcsLearnControls[contract.targetControl]
      : undefined
    if (
      targetControl &&
      targetControl.deviceKind !== null &&
      targetControl.deviceKind !== contract.startingDevice
    ) {
      errors.push(
        `${where}: the target control does not render on the ${contract.startingDevice} pathway`,
      )
    }

    const surface = mcsPrimarySurfaceBySectionId.get(contract.sectionId)
    if (!surface) {
      errors.push(`${where}: no primary surface authored`)
      continue
    }
    const target = mcsSurfaceTarget(surface.primarySurface, surface.primaryTarget)
    if (
      target &&
      target.renderedForDevices.length > 0 &&
      !target.renderedForDevices.includes(contract.startingDevice)
    ) {
      errors.push(
        `${where}: primary target ${surface.primaryTarget} does not render on the ${contract.startingDevice} pathway this section opens`,
      )
    }
  }

  // Neighbouring sections must not read as the same lesson in a different order.
  for (let index = 1; index < authoredContracts.length; index += 1) {
    const previous = authoredContracts[index - 1]
    const current = authoredContracts[index]
    const previousSurface = mcsPrimarySurfaceBySectionId.get(previous.sectionId)
    const currentSurface = mcsPrimarySurfaceBySectionId.get(current.sectionId)
    if (
      previousSurface?.primaryTarget === currentSurface?.primaryTarget &&
      previous.actionMode === current.actionMode &&
      previous.patientProblem === current.patientProblem
    ) {
      errors.push(
        `${current.sectionId}: renders the same target, task and patient as ${previous.sectionId}`,
      )
    }
    for (const [label, a, b] of [
      ['clinical question', previous.clinicalQuestion, current.clinicalQuestion],
      ['action instruction', previous.actionInstruction, current.actionInstruction],
      ['explanation', previous.explanation, current.explanation],
      ['starting context', previous.startingContext, current.startingContext],
    ] as const) {
      if (a === b) errors.push(`${current.sectionId}: identical ${label} to ${previous.sectionId}`)
    }
  }

  return errors
}

const contractErrors = validateContracts()
if (contractErrors.length > 0) {
  throw new Error(`Invalid MCS section learning contracts:\n- ${contractErrors.join('\n- ')}`)
}

export const mcsSectionLearningContracts: readonly McsSectionLearningContract[] = Object.freeze(
  authoredContracts.map((contract) => {
    const surface = mcsPrimarySurfaceBySectionId.get(contract.sectionId)
    if (!surface) throw new Error(`Missing MCS primary surface for ${contract.sectionId}`)
    return {
      ...contract,
      primarySurface: surface.primarySurface,
      primaryTarget: surface.primaryTarget,
      primaryTargetLabel: surface.primaryTargetLabel,
      primarySurfaceRationale: surface.primarySurfaceRationale,
      whyThisView: surface.whyThisView,
    }
  }),
)

export const mcsSectionLearningContractById: ReadonlyMap<string, McsSectionLearningContract> =
  new Map(mcsSectionLearningContracts.map((contract) => [contract.sectionId, contract]))

export function mcsSectionLearningContract(sectionId: string): McsSectionLearningContract {
  const contract = mcsSectionLearningContractById.get(sectionId)
  if (!contract) throw new Error(`No MCS learning contract for section ${sectionId}`)
  return contract
}
