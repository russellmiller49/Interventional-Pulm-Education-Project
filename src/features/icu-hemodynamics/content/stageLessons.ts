import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import {
  stageStepLocationErrors,
  type StageLessonBase,
  type StagePhase,
  type StageStepBase,
  type StageStepLocation,
} from '@/features/learning-module/stage/stageModel'

import {
  sectionRuntime,
  pressureDemonstrationState,
  type SectionRuntime,
  type StageGoal,
} from '../engine/stageRuntime'
import type {
  CatheterPosition,
  FastFlushLineType,
  HemodynamicSimulationState,
} from '../engine/types'
import { hemodynamicsLearnerCopyErrors } from './controlPanel'
import { hemodynamicsMapAnswerTargets, type HemodynamicsMapAnswerTarget } from './mapAnswerTargets'
import { hemodynamicsPathwaySections } from './pathwayResolver'
import { HEMODYNAMICS_QUESTION_SORT, type QuestionSort } from './questionSort'
import { heartRouteStopIds, type RouteStopId } from './routeSpine'
import {
  hemodynamicsSectionIds,
  hemodynamicsSectionSpec,
  isHemodynamicsSectionId,
  type HemodynamicsSectionId,
  type HemodynamicsSectionSpec,
} from './sectionSpecs'
import { hemodynamicsSectionItems } from './stageItems'

/**
 * The adapter: every section of the pathway as one ordered list of steps on the lesson stage.
 *
 * Nothing here is authored as a step by a component. The registries say what a section is — its
 * items, its runtime state and goals, its stops, its spec — and this file arranges them into the
 * one shape every section shares: Recognize, Predict, Act, Observe, Explain, then the transfer as
 * a second, shorter round. Sections whose material has no engine goal at a phase omit that phase
 * rather than inventing one.
 */
export type StageSurface =
  | 'none'
  | 'line'
  | 'flush'
  | 'flush-then-tip'
  | 'tip'
  | 'wedge'
  | 'thermodilution'
  | 'recognition'
  | 'level-demo'
  | 'zero-demo'
  | 'scale-demo'
  | 'response-demo'
  | 'component-demo'
  | 'component-identification'
  | 'question-trace'
  | 'freeze'
  | 'derived'
  | 'capstone'

export type WedgeCommitmentKind = 'plausibility' | 'return'

/**
 * An anatomy surface a step shows beneath its docks.
 *
 * `heart` is the 3D heart with the catheter's course, its balloon and the transducer, in step with
 * the engine. The flow rebuild left it off the stage because the catheter map is where answers go;
 * the owner asked for it back on the two sections where the thing the docks change is a thing in
 * the heart — the tip travelling the chambers, and a balloon inflating in a distal branch — which
 * a drawing cannot show and a model can.
 */
export type StageAnatomy = 'none' | 'heart'

export type IntroTeaching =
  | 'orientation'
  | 'sort-example'
  | 'level'
  | 'zero'
  | 'scale'
  | 'response'
  | 'normal-walk'
  | 'rv-pa'
  | 'components'
  | 'abnormal'
  | 'attempt'

export type HemodynamicsStageInteraction =
  | { readonly kind: 'read' }
  | {
      readonly kind: 'walk'
      readonly positions: readonly CatheterPosition[]
      readonly stops: readonly RouteStopId[]
    }
  | {
      readonly kind: 'prediction'
      readonly item: ClinicalLearningItem
      readonly round: 0 | 1
      readonly mapTargets: readonly HemodynamicsMapAnswerTarget[] | null
    }
  | { readonly kind: 'sort'; readonly sort: QuestionSort }
  | { readonly kind: 'simulator-task'; readonly goals: readonly StageGoal[]; readonly round: 0 | 1 }
  | {
      readonly kind: 'observe'
      readonly goals: readonly StageGoal[]
      readonly commitments: readonly WedgeCommitmentKind[]
      readonly provenance: boolean
    }
  | { readonly kind: 'explain'; readonly round: 0 | 1 }
  | { readonly kind: 'provenance-drill' }
  | { readonly kind: 'derived-workbench' }
  | { readonly kind: 'derived-transfer' }
  | { readonly kind: 'disagreement' }
  | { readonly kind: 'component-identification'; readonly mode: 'guided' | 'independent' }

export interface HemodynamicsStageStep extends StageStepBase<HemodynamicsStageInteraction> {
  /** The control surface the simulator pane opens beside the monitor for this step. */
  readonly surface: StageSurface
  /** The stops the catheter map lights while this step is current. */
  readonly stops: readonly RouteStopId[]
  /** A state the step is written against, loaded when it is entered forward. */
  readonly entryState?: () => HemodynamicSimulationState
  /** Whether the monitor may name the chamber while this step is current. */
  readonly chamberLabel: 'shown' | 'withheld'
  /** Which line a flush check on this step runs on. */
  readonly flushLine: FastFlushLineType
  /** The anatomy surface the simulator pane shows beneath the docks for this step. */
  readonly anatomy: StageAnatomy
  readonly teaching?: IntroTeaching
  readonly questionTraceId?: string
}

export interface HemodynamicsStageLesson extends StageLessonBase<HemodynamicsStageStep> {
  readonly sectionId: HemodynamicsSectionId
  readonly spec: HemodynamicsSectionSpec
  readonly runtime: SectionRuntime
  readonly lifecycleActivityId: string
  readonly transferStepIndex: number
}

interface StepInput {
  readonly phase: StagePhase
  readonly title: string
  readonly instruction: string
  /**
   * Which pane the step is worked in, and what to look for there — in the words the pane caption
   * and the landmark carry on screen at that step. Required on every step: the validator below
   * refuses a lesson that omits one, and the Now card prints it under the instruction.
   */
  readonly lookIn: StageStepLocation
  readonly rationale?: string
  readonly actionLabel: string
  readonly interaction: HemodynamicsStageInteraction
  readonly surface?: StageSurface
  readonly stops?: readonly RouteStopId[]
  readonly entryState?: () => HemodynamicSimulationState
  readonly chamberLabel?: 'shown' | 'withheld'
  readonly flushLine?: FastFlushLineType
  readonly anatomy?: StageAnatomy
  readonly expectedResponse?: readonly string[]
  readonly teaching?: IntroTeaching
  readonly questionTraceId?: string
}

function buildSteps(
  sectionId: HemodynamicsSectionId,
  inputs: readonly StepInput[],
  defaultStops: readonly RouteStopId[],
): readonly HemodynamicsStageStep[] {
  // HD-01: every step is open. The prediction is optional, so nothing after it waits for an answer.
  return inputs.map((input, index) => ({
    id: `${sectionId}-${index + 1}-${input.phase}`,
    ordinal: index + 1,
    phase: input.phase,
    title: input.title,
    instruction: input.instruction,
    lookIn: input.lookIn,
    rationale: input.rationale,
    actionLabel: input.actionLabel,
    interaction: input.interaction,
    gate: 'open',
    surface: input.surface ?? 'none',
    stops: input.stops ?? defaultStops,
    entryState: input.entryState,
    chamberLabel: input.chamberLabel ?? 'shown',
    flushLine: input.flushLine ?? 'pulmonary-artery',
    anatomy: input.anatomy ?? 'none',
    expectedResponse: input.expectedResponse,
    teaching: input.teaching,
    questionTraceId: input.questionTraceId,
  }))
}

function prediction(
  item: ClinicalLearningItem,
  round: 0 | 1,
): Extract<HemodynamicsStageInteraction, { kind: 'prediction' }> {
  return { kind: 'prediction', item, round, mapTargets: hemodynamicsMapAnswerTargets(item.id) }
}

const CONTINUE = 'Continue'
const COMMIT = 'Check answer'

/*
 * The landmarks a step points at, in the words the surface carries.
 *
 * A location is authored per step, not derived — a derivation is a guess about content, and it
 * would be wrong on the step that matters. The ones used on more than one step are named once
 * here so a rename on the surface is a rename in one place.
 */
const IN_STEPS = {
  choices: { pane: 'steps', landmark: 'the answer choices below' },
  verdict: { pane: 'steps', landmark: 'the verdict below' },
  verdictAndChange: { pane: 'steps', landmark: 'the verdict and the table of what changed below' },
  walkCard: { pane: 'steps', landmark: 'the walk card below' },
} as const satisfies Record<string, StageStepLocation>

const ON_SIMULATOR = {
  monitor: 'the monitor',
  map: 'The catheter map',
  pins: 'the numbered pins on the catheter map',
  line: 'The line, the dock under the monitor',
  flush: 'The flush check, the dock under the monitor',
  balloon: 'The balloon, the dock under the monitor',
  tracing: 'The tracing, the dock under the monitor',
} as const

const IN_TEACHING = {
  adds: 'What this section adds',
  table: 'Waveform patterns and common causes',
} as const

const commitOnCard = {
  alsoPane: 'steps',
  alsoLandmark: 'Check answer, on this card',
} as const

/* ------------------------------------------------------------------ *
 * The sections
 * ------------------------------------------------------------------ */

function whyMeasureSteps(): readonly StepInput[] {
  const items = hemodynamicsSectionItems('why-measure')
  return [
    {
      phase: 'recognize',
      title: 'Why put a line in at all?',
      instruction:
        'Read where the arterial and PAC signals originate, then follow the worked pressure-versus-flow example. This pathway focuses on invasive pressure and PAC measurements in their clinical context.',
      lookIn: {
        pane: 'teaching',
        landmark: 'Measurements and their origins',
      },
      rationale:
        'Every later section makes one of these numbers trustworthy. Knowing what a number can and cannot say is what makes the effort worth it.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      teaching: 'orientation',
    },
    {
      phase: 'predict',
      title: 'What does a trustworthy number establish?',
      instruction: 'Read the text vignette and choose what the arterial pressure establishes.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      teaching: 'attempt',
    },
    {
      phase: 'act',
      title: 'How to use the measurement categories',
      instruction:
        'Read the category definitions and the worked example before sorting the independent set. The worked row is not counted.',
      lookIn: { pane: 'teaching', landmark: 'A worked measurement classification' },
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      teaching: 'sort-example',
    },
    {
      phase: 'act',
      title: 'Where does each answer come from?',
      instruction:
        'Classify seven independent questions as clinical measurements, calculated variables, or questions requiring additional clinical context. Measured cardiac output describes a measurement method, not a directly sensed flow signal.',
      lookIn: { pane: 'steps', landmark: 'the seven questions below' },
      actionLabel: 'Check the set',
      interaction: { kind: 'sort', sort: HEMODYNAMICS_QUESTION_SORT },
      teaching: 'attempt',
    },
    {
      phase: 'explain',
      title: 'Read, measured, calculated, inferred',
      instruction:
        'Review your reasoning. Pressure is force per unit area; flow is volume per unit time. A valid pressure alone does not establish cardiac output or the cause of hypotension.',
      lookIn: {
        pane: 'steps',
        landmark: 'the verdict below',
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.map,
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
    },
    {
      phase: 'transfer',
      title: 'The same question, on the catheter',
      instruction:
        'A different situation: the catheter is in and its tracings are trustworthy. Decide what it measures rather than calculates or infers, then check your answer or open the explanation.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      teaching: 'attempt',
    },
  ]
}

function pressureSystemSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('pressure-system')
  return [
    {
      phase: 'recognize',
      title: 'A line that can be trusted',
      instruction:
        'The line is level, zeroed, on a scale that fits, and it settles crisply after a flush. Follow the measurement chain below. The next demonstrations change one setting at a time against this clean reference.',
      lookIn: {
        ...IN_STEPS.walkCard,
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.line,
      },
      rationale:
        'Every fault in this section is a departure from this state. Seeing it first is what makes the departures readable.',
      actionLabel: CONTINUE,
      interaction: { kind: 'walk', positions: ['pa'], stops: ['line'] },
      surface: 'line',
    },
    ...(['level', 'zero', 'scale', 'response'] as const).map(
      (topic): StepInput => ({
        phase: 'recognize',
        title: {
          level: 'Leveling: a height reference',
          zero: 'Zeroing: an atmospheric reference',
          scale: 'Arterial display scale',
          response: 'Three dynamic responses',
        }[topic],
        instruction: {
          level:
            'A clean baseline is loaded. Use the transducer-height control and compare the actual readout with the hydrostatic illustration. Only height changes in this demonstration.',
          zero: 'The line is at reference height with normal damping; its atmospheric zero is unset. Use the simplified zero control and observe the reference change. Zeroing does not move the transducer.',
          scale:
            'A clean baseline is loaded again. Change the arterial display scale and compare the drawing with the arterial pressure readout. The measured pressure is unchanged.',
          response:
            'Compare the labeled acceptable, overdamped, and underdamped release examples on the same PAC pressure scale. These are reference demonstrations, not your classification attempt.',
        }[topic],
        lookIn: {
          pane: 'simulator',
          landmark: topic === 'response' ? 'Reference flush responses' : 'The line',
          alsoPane: 'teaching',
          alsoLandmark: {
            level: 'Leveling',
            zero: 'Zeroing',
            scale: 'Display scale',
            response: 'Dynamic response',
          }[topic],
        },
        actionLabel: CONTINUE,
        interaction: { kind: 'read' },
        surface: `${topic}-demo` as StageSurface,
        entryState: () => pressureDemonstrationState(topic),
        teaching: topic,
      }),
    ),
    {
      phase: 'predict',
      title: 'What is this number carrying?',
      instruction:
        'The line has changed. Read the situation and decide which interpretation best accounts for it, then check your answer or open the explanation.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      entryState: runtime.predictionEntry,
      teaching: 'attempt',
      surface: 'line',
    },
    {
      phase: 'act',
      title: 'Set the reference',
      instruction:
        'Bring the transducer to the reference height, then open it to air and zero it. Watch the numbers as you do: they move together, and no wave changes its shape.',
      lookIn: { pane: 'simulator', landmark: ON_SIMULATOR.line },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'line',
    },
    {
      phase: 'observe',
      title: 'Read the response',
      instruction:
        'Confirm a safe catheter position with the balloon down. Flush the PAC pressure channel, classify the response, apply the simulated correction, then flush again and classify the new response.',
      lookIn: { pane: 'simulator', landmark: ON_SIMULATOR.flush },
      actionLabel: CONTINUE,
      interaction: {
        kind: 'observe',
        goals: runtime.observeGoals,
        commitments: [],
        provenance: false,
      },
      surface: 'flush',
    },
    {
      phase: 'explain',
      title: 'Reference errors versus dynamic-response errors',
      instruction:
        'Read the reasoning and what changed, then the rows this section fills in. Then try the two stories: a colleague reaches for the tempting axis, you predict what happens, and the simulation shows you.',
      lookIn: {
        pane: 'steps',
        landmark: 'the verdict, the table of what changed, and the two stories below',
        alsoPane: 'teaching',
        alsoLandmark: IN_TEACHING.table,
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'line',
    },
    {
      phase: 'transfer',
      title: 'A different patient, a different fault',
      instruction:
        'A new line after a position change. Read the situation and decide what needs correcting before you touch it.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      teaching: 'attempt',
      surface: 'line',
    },
    {
      phase: 'transfer',
      title: 'Repair both',
      instruction:
        'Set the reference, flush and classify the response, apply the simulated correction, then repeat the flush to check the current line.',
      lookIn: {
        pane: 'simulator',
        landmark: 'The line and The flush check, the docks under the monitor',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'flush',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed on the second patient. The two axes are the thing to carry forward: the reference moves the number, the response changes the shape.',
      lookIn: IN_STEPS.verdictAndChange,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'line',
    },
  ]
}

function waveformInterpretationSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('waveform-interpretation')
  return [
    {
      phase: 'recognize',
      title: 'Walk the four places',
      instruction:
        'Follow the tip along the catheter map. At each stop the monitor shows the tracing that place writes: compare the live shape with the normal reference for the same chamber. The reference axis is shared across positions.',
      lookIn: {
        ...IN_STEPS.walkCard,
        alsoPane: 'simulator',
        alsoLandmark: 'the monitor and the catheter map',
      },
      rationale: 'A shape learned at its place survives; a shape learned from a table does not.',
      actionLabel: 'Next stop',
      interaction: {
        kind: 'walk',
        positions:
          runtime.walkPositions ?? heartRouteStopIds.map((stop) => stop as CatheterPosition),
        stops: heartRouteStopIds,
      },
      stops: [],
      teaching: 'normal-walk',
    },
    {
      phase: 'recognize',
      title: 'RV and PA: compare diastole',
      instruction:
        'Compare the reference examples at one pressure scale. Similar systolic peaks do not identify the chamber: inspect diastolic pressure and the valve-closure notch.',
      lookIn: { pane: 'teaching', landmark: 'Right ventricle versus pulmonary artery' },
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      teaching: 'rv-pa',
    },
    {
      phase: 'predict',
      title: 'Where is the tip?',
      instruction:
        'The tracing is on the monitor with its chamber label covered. Choose the place on the catheter map, then check your answer.',
      lookIn: { pane: 'simulator', landmark: ON_SIMULATOR.pins, ...commitOnCard },
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      entryState: runtime.predictionEntry,
      stops: [],
      chamberLabel: 'withheld',
      teaching: 'attempt',
    },
    {
      phase: 'act',
      title: 'Name tracings from their shape',
      instruction:
        'Name the question tracing from its shape. Check an answer, show the labels, or move to another tracing for as long as the practice is useful. Repeated examples are labeled as repeated practice.',
      lookIn: { pane: 'simulator', landmark: 'Name the tracing' },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'recognition',
    },
    {
      phase: 'explain',
      title: 'The shape names the place',
      instruction:
        'Read the three rows of the table this section fills in, and the one distinction that trips most people: the ventricle and the artery can share a systolic peak but differ in diastolic pressure and the notch.',
      lookIn: {
        pane: 'teaching',
        landmark:
          'Right ventricle versus pulmonary artery, then Waveform patterns and common causes',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      teaching: 'rv-pa',
    },
    {
      phase: 'transfer',
      title: 'New visual application',
      instruction:
        'A new model example has faster breathing and higher positive-pressure support. Inspect the PAC tracing and its ECG timing, then select its origin on the map. The chamber name remains withheld until you answer.',
      lookIn: { pane: 'simulator', landmark: ON_SIMULATOR.pins, ...commitOnCard },
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      stops: [],
      chamberLabel: 'withheld',
      teaching: 'attempt',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. What carries forward is the habit: name the place from the shape before any number from it is believed.',
      lookIn: IN_STEPS.verdict,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
    },
  ]
}

function waveformComponentsSteps(): readonly StepInput[] {
  const items = hemodynamicsSectionItems('waveform-components')
  return [
    {
      phase: 'recognize',
      title: 'Atrial waves and descents',
      instruction:
        'Study the frozen normal right-atrial reference with its ECG. Select each component to read its timing and mechanism. This is a labeled demonstration; viewing it does not count as identifying a component.',
      lookIn: { pane: 'simulator', landmark: 'Normal atrial components' },
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'component-demo',
      teaching: 'components',
    },
    {
      phase: 'act',
      title: 'Guided component identification',
      instruction:
        'For each named component, select the numbered region on the frozen tracing. The region choices also describe timing against the ECG. Check a region, show the component, or move to another component, in any order.',
      lookIn: { pane: 'simulator', landmark: 'Identify the atrial component' },
      actionLabel: CONTINUE,
      interaction: { kind: 'component-identification', mode: 'guided' },
      surface: 'component-identification',
      teaching: 'attempt',
    },
    {
      phase: 'act',
      title: 'Practice with renumbered components',
      instruction:
        'Repeat identification with a changed mean pressure and renumbered regions, using the same normal atrial morphology. This is additional practice, not an independent transfer specimen. Work through as many components as are useful.',
      lookIn: { pane: 'simulator', landmark: 'Identify the atrial component' },
      actionLabel: CONTINUE,
      interaction: { kind: 'component-identification', mode: 'independent' },
      surface: 'component-identification',
      teaching: 'attempt',
    },
    {
      phase: 'recognize',
      title: 'When the atrial contour changes',
      instruction:
        'Compare the existing abnormal reference patterns in a known chamber. Use the ECG and the affected wave or descent to distinguish mechanisms. A pattern supports a mechanism in context; it does not establish a diagnosis alone.',
      lookIn: { pane: 'teaching', landmark: 'Contrasting abnormal atrial patterns' },
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      teaching: 'abnormal',
    },
    {
      phase: 'predict',
      title: 'What made this wave?',
      instruction:
        'Use the right-atrial question trace and the patient vignette to select a mechanism. This is an authored waveform example; the live reference patient is not being altered to produce it.',
      lookIn: { pane: 'steps', landmark: 'the question trace and answer choices below' },
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'question-trace',
      questionTraceId: 'ra-tricuspid-regurgitation',
      teaching: 'attempt',
    },
    {
      phase: 'explain',
      title: 'Interpret the component in context',
      instruction:
        'Review the explanation and the revealed landmarks. Decide which wave changed before inferring a mechanism.',
      lookIn: IN_STEPS.verdict,
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'question-trace',
      questionTraceId: 'ra-tricuspid-regurgitation',
    },
    {
      phase: 'transfer',
      title: 'A different wave, a different patient',
      instruction:
        'Read the new vignette and right-atrial question trace. Select the mechanism that fits the changed descent and the clinical context.',
      lookIn: { pane: 'steps', landmark: 'the question trace and answer choices below' },
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      surface: 'question-trace',
      questionTraceId: 'ra-tamponade',
      teaching: 'attempt',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Review the explanation. Identify the chamber, the component, and its ECG timing before interpreting the mechanism.',
      lookIn: IN_STEPS.verdict,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'question-trace',
      questionTraceId: 'ra-tamponade',
    },
  ]
}

function catheterAdvancementSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('catheter-advancement')
  return [
    {
      phase: 'recognize',
      title: 'The tracing says where; the list says whether',
      instruction:
        'The catheter waits in the introducer. Read what this section adds, and keep the short list of things that are not the tracing in mind — the rhythm, the patient, the resistance, the balloon, the depth — because each of them can say stop.',
      lookIn: { pane: 'teaching', landmark: IN_TEACHING.adds },
      rationale:
        'The shape confirms a position. Nothing about the shape licenses the next move on its own.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'tip',
      anatomy: 'heart',
    },
    {
      phase: 'predict',
      title: 'A confirmed atrium. What next?',
      instruction:
        'The tip has reached the right atrium and its tracing is confirmed. Read the observables and decide what comes next.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      entryState: runtime.predictionEntry,
      surface: 'tip',
      anatomy: 'heart',
    },
    {
      phase: 'act',
      title: 'Advance by the tracing',
      instruction:
        'Advance one stop at a time. After each move, wait for the tracing to settle, then confirm the place on the catheter map. The step is done at a confirmed pulmonary artery.',
      lookIn: {
        pane: 'simulator',
        landmark: 'The tip, the dock under the monitor, and the catheter map beneath it',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'tip',
      anatomy: 'heart',
    },
    {
      phase: 'observe',
      title: 'The step-up',
      instruction:
        'Compare the ventricle you moved through with the artery you are in: the same peak, a different floor, and a notch that was not there before.',
      lookIn: {
        pane: 'steps',
        landmark: 'the ventricle and the artery, side by side',
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.monitor,
      },
      actionLabel: 'Compare the two',
      interaction: { kind: 'observe', goals: [], commitments: [], provenance: false },
      surface: 'tip',
      anatomy: 'heart',
    },
    {
      phase: 'explain',
      title: 'Position from the shape, permission from the list',
      instruction:
        'Read the rows this section fills in, then When to stop: the conditions the simulation cannot show you — resistance, ectopy, a patient who changes while the tracing does not.',
      lookIn: {
        pane: 'teaching',
        landmark: 'Waveform patterns and common causes, then When to stop',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'tip',
      anatomy: 'heart',
    },
    {
      phase: 'transfer',
      title: 'The signal stops being trustworthy',
      instruction:
        'A confirmed atrium on a line that has started to ring. Read the observables and decide what comes next.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      surface: 'flush',
      anatomy: 'heart',
    },
    {
      phase: 'transfer',
      title: 'Repair, then move',
      instruction:
        'Do it: run the flush, read it, repair the line — and only then advance to the ventricle and confirm it.',
      lookIn: {
        pane: 'simulator',
        landmark: 'The flush check and The tip, the docks under the monitor',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'flush-then-tip',
      anatomy: 'heart',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed. The habit to carry forward: a tracing you cannot trust cannot confirm a position, so the line is repaired before the tip is moved.',
      lookIn: IN_STEPS.verdictAndChange,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'tip',
      anatomy: 'heart',
    },
  ]
}

function pawpCaptureSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('pawp-capture')
  return [
    {
      phase: 'recognize',
      title: 'Listening past the tip',
      instruction:
        'The tip is in a confirmed pulmonary artery. Read the purpose and acquisition sequence below: what the balloon does, what the tracing becomes, and what has to be true when it is over.',
      lookIn: {
        pane: 'teaching',
        landmark: 'What this section adds, then the wedge stop card',
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.map,
      },
      rationale:
        'A wedge is the one measurement here that changes the patient while it is being taken. The way back matters as much as the number.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'wedge',
      anatomy: 'heart',
      stops: ['pa', 'wedge'],
    },
    {
      phase: 'predict',
      title: 'Which sequence?',
      instruction: 'Read the situation and decide on the sequence before the balloon goes up.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'wedge',
      anatomy: 'heart',
    },
    {
      phase: 'act',
      title: 'Occlude, read, release',
      instruction:
        'Inflate from the confirmed artery, let the tracing settle for about a breath, place the cursor at end expiration, store the value, and deflate. The simulation releases the balloon on its own after a set interval — a rail of this model, not a clinical limit.',
      lookIn: { pane: 'simulator', landmark: ON_SIMULATOR.balloon },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'wedge',
      anatomy: 'heart',
    },
    {
      phase: 'observe',
      title: 'Is it plausible, and is it over?',
      instruction:
        'Two questions about what you stored: does the value sit where a wedge must sit, and has the pulmonary-artery tracing come back? Answer either question, open its explanation, or move on.',
      lookIn: {
        pane: 'steps',
        landmark: 'the two questions below',
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.monitor,
      },
      actionLabel: CONTINUE,
      interaction: {
        kind: 'observe',
        goals: runtime.observeGoals,
        commitments: ['plausibility', 'return'],
        provenance: false,
      },
      surface: 'wedge',
      anatomy: 'heart',
    },
    {
      phase: 'explain',
      title: 'Brief, plausible, and over',
      instruction:
        'Read the rows this section fills in and Which control, if any. Then try the story: a colleague adds balloon volume to a wedge that does not look right, and the simulation shows what it does with that.',
      lookIn: {
        pane: 'teaching',
        landmark: 'Waveform patterns and common causes, then Which control, if any',
        alsoPane: 'steps',
        alsoLandmark: 'the story below',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'wedge',
      anatomy: 'heart',
    },
    {
      phase: 'transfer',
      title: 'Under more positive pressure',
      instruction:
        'The same patient, ventilated harder and breathing faster, so the tracing swings more with each breath. Decide on the sample and the next action.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      surface: 'wedge',
      anatomy: 'heart',
    },
    {
      phase: 'transfer',
      title: 'Take it again',
      instruction:
        'Do it on this patient: occlude, wait a breath, place the cursor at the trough of the swing, store, deflate, and say whether the artery came back.',
      lookIn: {
        pane: 'simulator',
        landmark: ON_SIMULATOR.balloon,
        alsoPane: 'steps',
        alsoLandmark: 'the question below: has the pulmonary-artery tracing come back?',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'wedge',
      anatomy: 'heart',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed. The habit to carry forward: end expiration is where the reading lives, and the tracing coming back is the end of the measurement, not the number.',
      lookIn: IN_STEPS.verdictAndChange,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'wedge',
      anatomy: 'heart',
    },
  ]
}

function thermodilutionSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('thermodilution-series')
  return [
    {
      phase: 'recognize',
      title: 'A curve, then a number',
      instruction:
        'Cold injectate goes in at the atrium and a thermistor at the tip watches the temperature fall and recover. The acquisition account identifies both locations: flow is measured, and every measurement has a technique that shows in what it produces.',
      lookIn: {
        pane: 'teaching',
        landmark: IN_TEACHING.adds,
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.map,
      },
      rationale:
        'A number appears whether or not the curve behind it was any good. Reading the curve first is the whole skill.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'thermodilution',
      stops: ['ra', 'pa'],
    },
    {
      phase: 'predict',
      title: 'Which curves belong in the series?',
      instruction:
        'Three curves are already on the record. Read the situation and decide which belong in the series before you open any of them.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'thermodilution',
    },
    {
      phase: 'act',
      title: 'Read each curve, decide each curve',
      instruction:
        'Open every curve before its number. Accept the ones whose acquisition holds, exclude the one whose curve shows a technical reason, and inject again with the standard technique until a series of usable curves exists.',
      lookIn: {
        pane: 'simulator',
        landmark: 'The injection, the dock under the monitor, and its trial cards',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'thermodilution',
    },
    {
      phase: 'observe',
      title: 'Which result was measured?',
      instruction:
        'Two Fick results are on record for the same hour. Read how each was obtained and decide which of them can be called direct.',
      lookIn: { pane: 'steps', landmark: 'the question below: which result was measured?' },
      actionLabel: CONTINUE,
      interaction: { kind: 'observe', goals: [], commitments: [], provenance: true },
      surface: 'thermodilution',
    },
    {
      phase: 'explain',
      title: 'The technique is in the curve',
      instruction:
        'Read the row this section fills in and the three ways to a flow number — thermodilution, direct Fick, and Fick with a substituted uptake — and what each can and cannot say.',
      lookIn: {
        pane: 'teaching',
        landmark: 'Waveform patterns and common causes, then The three ways to a flow number',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'thermodilution',
    },
    {
      phase: 'transfer',
      title: 'A low-flow patient, a poor third curve',
      instruction: 'A different patient and a different series. Decide on the next step.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      surface: 'thermodilution',
    },
    {
      phase: 'transfer',
      title: 'When the two methods disagree',
      instruction:
        'The series and a Fick result on the same patient do not agree. Read both acquisitions and say which result can be defended — which may be neither — without averaging them.',
      lookIn: {
        pane: 'simulator',
        landmark: 'When the two methods disagree, under the monitor',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'disagreement' },
      surface: 'thermodilution',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. The habit to carry forward: a curve is judged on its own acquisition, and two measurement systems are never averaged into one number.',
      lookIn: IN_STEPS.verdict,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'thermodilution',
    },
  ]
}

function derivedSteps(): readonly StepInput[] {
  const items = hemodynamicsSectionItems('derived-hemodynamics')
  return [
    {
      phase: 'recognize',
      title: 'Which of these is a measurement?',
      instruction:
        'Six quantities from one flowsheet, printed alike. Say how each one reached the record — measured, sampled, entered, assumed, or calculated — then check the set or show the classifications.',
      lookIn: {
        pane: 'simulator',
        landmark: 'Which of these is actually a measurement?, under the monitor',
      },
      rationale:
        'A calculated value inherits every doubt about its inputs. Telling the two apart is the first move of this section.',
      actionLabel: CONTINUE,
      interaction: { kind: 'provenance-drill' },
      surface: 'derived',
    },
    {
      phase: 'predict',
      title: 'Can this resistance be read?',
      instruction:
        'A calculated value on a line whose reference is not yet set. Read the situation and decide how the value can be read.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'derived',
    },
    {
      phase: 'act',
      title: 'Work the episodes',
      instruction:
        'Measurement episodes with their inputs and provenance. Name what one calculation depends on, withhold what an invalid input makes unreadable while keeping what it does not touch, trace a flow-dependent value to its method, and keep a two-method disagreement without averaging it.',
      lookIn: {
        pane: 'simulator',
        landmark: 'Measurement episodes, under the monitor',
        alsoPane: 'steps',
        alsoLandmark: 'the list of what to do below',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'derived-workbench' },
      surface: 'derived',
    },
    {
      phase: 'explain',
      title: 'An equation over measurements',
      instruction:
        'Read the row this section fills in and the records behind every calculated value on the screen: the formula, its inputs, its units, and the boundary on what it can say.',
      lookIn: {
        pane: 'teaching',
        landmark:
          'Waveform patterns and common causes, then The records behind every calculated value',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'derived',
    },
    {
      phase: 'transfer',
      title: 'A number the monitor can show',
      instruction:
        'A different patient and a different calculated value. Decide whether the result is interpretable.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      surface: 'derived',
    },
    {
      phase: 'transfer',
      title: 'Plausible, or coherent?',
      instruction:
        'Two result sets: one that looks right with no record of where its inputs came from, and one that looks surprising from an episode that hangs together. Choose without selecting by expectation.',
      lookIn: {
        pane: 'simulator',
        landmark: 'Two apparently complete episodes, under the monitor',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'derived-transfer' },
      surface: 'derived',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. The habit to carry forward: trace every calculated value to its inputs before it is read, and withhold only what an invalid input actually touches.',
      lookIn: IN_STEPS.verdict,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'derived',
    },
  ]
}

function capstoneSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('pac-signal-validation')
  return [
    {
      phase: 'recognize',
      title: 'The screen changed. The patient did not.',
      instruction:
        'One patient, one hour on. The patient looks the same as an hour ago; the screen does not. Read the patient brief and the displayed signals: nothing new is taught here. Every row you need is already in the table.',
      lookIn: {
        pane: 'simulator',
        landmark: ON_SIMULATOR.monitor,
        alsoPane: 'teaching',
        alsoLandmark: IN_TEACHING.adds,
      },
      rationale:
        'The capstone is a discipline, not a discovery: the rows run in an order, and the order is the lesson.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'capstone',
    },
    {
      phase: 'predict',
      title: 'What comes first?',
      instruction:
        'Read the situation and decide on the first move before anything on the screen is touched.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'capstone',
    },
    {
      phase: 'act',
      title: 'Restore the screen, in order',
      instruction:
        'The line first: level, zero, flush, read, repair. Then the tip: the balloon down and the tracing back to a confirmed artery. Then the series: reviewed curves, a technical reason for every exclusion.',
      lookIn: {
        pane: 'simulator',
        landmark:
          'the docks under the monitor, in this order: The line, The flush check, The balloon, The tip, The injection',
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'capstone',
    },
    {
      phase: 'observe',
      title: 'Reassess against the patient',
      instruction:
        'With the screen restored, reassess: read the corrected pressures and the series against a patient who has not changed, and compare them with what the screen showed an hour ago.',
      lookIn: {
        pane: 'steps',
        landmark: 'Reassess, below',
        alsoPane: 'simulator',
        alsoLandmark: ON_SIMULATOR.monitor,
      },
      actionLabel: 'Compare before and after',
      interaction: {
        kind: 'observe',
        goals: runtime.observeGoals,
        commitments: [],
        provenance: false,
      },
      surface: 'capstone',
    },
    {
      phase: 'explain',
      title: 'Every row, in order',
      instruction:
        'Read what changed and the rows of the table this case ran through. The order is the thing to keep: the line, the tip, the series, and only then the numbers made of numbers.',
      lookIn: {
        pane: 'steps',
        landmark: 'the verdict and the table of what changed below',
        alsoPane: 'teaching',
        alsoLandmark: IN_TEACHING.table,
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'capstone',
    },
    {
      phase: 'transfer',
      title: 'A different line, a different patient',
      instruction:
        'A systemic arterial line whose tracing has changed shape while its mean has not. A colleague reaches for a drug. Decide what comes first.',
      lookIn: IN_STEPS.choices,
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      surface: 'flush',
      flushLine: 'systemic-arterial',
    },
    {
      phase: 'transfer',
      title: 'Read the line before the number',
      instruction:
        'Do it: run the flush on the arterial line, read how it settles, and repair the line before any pressure from it is believed.',
      lookIn: { pane: 'simulator', landmark: ON_SIMULATOR.flush },
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'flush',
      flushLine: 'systemic-arterial',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed. This is the whole module in one sentence: read the signal before treating the number.',
      lookIn: IN_STEPS.verdictAndChange,
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'capstone',
    },
  ]
}

const builders: Readonly<
  Record<HemodynamicsSectionId, (runtime: SectionRuntime) => readonly StepInput[]>
> = {
  'why-measure': () => whyMeasureSteps(),
  'pressure-system': pressureSystemSteps,
  'waveform-interpretation': waveformInterpretationSteps,
  'waveform-components': waveformComponentsSteps,
  'catheter-advancement': catheterAdvancementSteps,
  'pawp-capture': pawpCaptureSteps,
  'thermodilution-series': thermodilutionSteps,
  'derived-hemodynamics': () => derivedSteps(),
  'pac-signal-validation': capstoneSteps,
}

const lessonCache = new Map<HemodynamicsSectionId, HemodynamicsStageLesson>()

export function hemodynamicsStageLesson(sectionId: string): HemodynamicsStageLesson {
  if (!isHemodynamicsSectionId(sectionId)) {
    throw new Error(`Unknown hemodynamics section: ${sectionId}`)
  }
  const cached = lessonCache.get(sectionId)
  if (cached) return cached
  const spec = hemodynamicsSectionSpec(sectionId)
  const runtime = sectionRuntime(sectionId)
  const section = hemodynamicsPathwaySections.find((candidate) => candidate.id === sectionId)
  if (!section) throw new Error(`Section ${sectionId} is not on the pathway.`)
  const index = hemodynamicsPathwaySections.indexOf(section)
  const steps = buildSteps(sectionId, builders[sectionId](runtime), spec.spineStops)
  const lesson: HemodynamicsStageLesson = {
    sectionId,
    spec,
    runtime,
    title: section.title,
    minutes: section.minutes,
    index,
    total: hemodynamicsPathwaySections.length,
    steps,
    predictionStepIndex: steps.findIndex(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
    ),
    transferStepIndex: steps.findIndex(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 1,
    ),
    lifecycleActivityId: section.activityId,
  }
  lessonCache.set(sectionId, lesson)
  return lesson
}

export function hemodynamicsStageLessons(): readonly HemodynamicsStageLesson[] {
  return hemodynamicsSectionIds.map((sectionId) => hemodynamicsStageLesson(sectionId))
}

/** Prerequisite teaching is allowed in the four introductory lessons; the active item is not disclosed. */
export function precommitAuthoredSurfaces(
  lesson: HemodynamicsStageLesson,
): readonly { readonly where: string; readonly text: string }[] {
  const surfaces: { where: string; text: string }[] = [
    { where: 'title', text: lesson.title },
    { where: 'objective', text: lesson.spec.objective },
    { where: 'new concept', text: lesson.spec.newConcept },
    { where: 'increment', text: lesson.spec.incrementSentence },
  ]
  const teachingFirst = [
    'why-measure',
    'pressure-system',
    'waveform-interpretation',
    'waveform-components',
  ].includes(lesson.spec.id)
  lesson.steps.forEach((step, index) => {
    if (teachingFirst ? index !== lesson.predictionStepIndex : index > lesson.predictionStepIndex)
      return
    surfaces.push(
      { where: `step ${step.ordinal} title`, text: step.title },
      { where: `step ${step.ordinal} instruction`, text: step.instruction },
      { where: `step ${step.ordinal} action`, text: step.actionLabel },
    )
    if (step.rationale)
      surfaces.push({ where: `step ${step.ordinal} rationale`, text: step.rationale })
    if (step.lookIn) {
      surfaces.push({ where: `step ${step.ordinal} look-in`, text: step.lookIn.landmark })
      if (step.lookIn.alsoLandmark) {
        surfaces.push({ where: `step ${step.ordinal} look-in`, text: step.lookIn.alsoLandmark })
      }
    }
    if (step.interaction.kind === 'prediction') {
      surfaces.push({ where: `step ${step.ordinal} stem`, text: step.interaction.item.stem })
    }
  })
  return surfaces
}

export function validateHemodynamicsStageLessons(): readonly string[] {
  const errors: string[] = []
  for (const lesson of hemodynamicsStageLessons()) {
    const where = `Lesson ${lesson.sectionId}`
    if (lesson.predictionStepIndex < 0) errors.push(`${where} has no prediction step.`)
    if (lesson.transferStepIndex < 0) errors.push(`${where} has no transfer prediction.`)
    if (lesson.transferStepIndex <= lesson.predictionStepIndex) {
      errors.push(`${where} puts the transfer before the prediction.`)
    }
    const phases = lesson.steps.map((step) => step.phase)
    if (phases[0] !== 'recognize') errors.push(`${where} does not open on Recognize.`)
    if (phases.at(-1) !== 'transfer') errors.push(`${where} does not end on a transfer step.`)
    lesson.steps.forEach((step) => {
      const stepWhere = `${where} step ${step.ordinal}`
      errors.push(
        ...hemodynamicsLearnerCopyErrors(`${stepWhere} title`, step.title),
        ...hemodynamicsLearnerCopyErrors(`${stepWhere} instruction`, step.instruction),
        ...hemodynamicsLearnerCopyErrors(`${stepWhere} action`, step.actionLabel),
      )
      if (step.rationale) {
        errors.push(...hemodynamicsLearnerCopyErrors(`${stepWhere} rationale`, step.rationale))
      }
      /*
       * Every step says where its work is done, and says it in learner copy: the same gate the
       * instruction passes, plus the shared location rules — a pane's own name is not a landmark.
       */
      errors.push(...stageStepLocationErrors(stepWhere, step.lookIn))
      if (step.lookIn) {
        errors.push(...hemodynamicsLearnerCopyErrors(`${stepWhere} look-in`, step.lookIn.landmark))
        if (step.lookIn.alsoLandmark) {
          errors.push(
            ...hemodynamicsLearnerCopyErrors(`${stepWhere} look-in`, step.lookIn.alsoLandmark),
          )
        }
      }
      // HD-01: no step waits for the prediction; a gated step would be a quiz lock.
      if (step.gate !== 'open') errors.push(`${stepWhere} is gated on the prediction.`)
      if (
        step.interaction.kind === 'prediction' &&
        step.interaction.round === 1 &&
        step.phase !== 'transfer'
      ) {
        errors.push(`${stepWhere} carries the transfer item outside a transfer step.`)
      }
    })
    for (const surface of precommitAuthoredSurfaces(lesson)) {
      if (surface.where.endsWith('stem')) continue
      for (const pattern of lesson.spec.precommitDenyPatterns) {
        if (pattern.test(surface.text)) {
          errors.push(
            `${where} ${surface.where} names the answer (${pattern.source}): "${surface.text}"`,
          )
        }
      }
    }
    for (const pattern of lesson.spec.precommitDenyPatterns) {
      const stem = lesson.steps[lesson.predictionStepIndex].interaction
      if (stem.kind === 'prediction' && pattern.test(stem.item.stem)) {
        errors.push(`${where} deny pattern ${pattern.source} matches its own prediction stem.`)
      }
    }
  }
  return errors
}

const lessonErrors = validateHemodynamicsStageLessons()
if (lessonErrors.length > 0) {
  throw new Error(`Hemodynamics stage lessons are invalid:\n${lessonErrors.join('\n')}`)
}
