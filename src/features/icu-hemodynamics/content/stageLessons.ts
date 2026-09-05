import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import type {
  StageLessonBase,
  StagePhase,
  StageStepBase,
} from '@/features/learning-module/stage/stageModel'

import { sectionRuntime, type SectionRuntime, type StageGoal } from '../engine/stageRuntime'
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
  | 'tip'
  | 'wedge'
  | 'thermodilution'
  | 'recognition'
  | 'freeze'
  | 'derived'
  | 'capstone'

export type WedgeCommitmentKind = 'plausibility' | 'return'

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
  readonly rationale?: string
  readonly actionLabel: string
  readonly interaction: HemodynamicsStageInteraction
  readonly surface?: StageSurface
  readonly stops?: readonly RouteStopId[]
  readonly entryState?: () => HemodynamicSimulationState
  readonly chamberLabel?: 'shown' | 'withheld'
  readonly flushLine?: FastFlushLineType
  readonly expectedResponse?: readonly string[]
}

function buildSteps(
  sectionId: HemodynamicsSectionId,
  inputs: readonly StepInput[],
  defaultStops: readonly RouteStopId[],
): readonly HemodynamicsStageStep[] {
  const predictionIndex = inputs.findIndex(
    (input) => input.interaction.kind === 'prediction' && input.interaction.round === 0,
  )
  return inputs.map((input, index) => ({
    id: `${sectionId}-${index + 1}-${input.phase}`,
    ordinal: index + 1,
    phase: input.phase,
    title: input.title,
    instruction: input.instruction,
    rationale: input.rationale,
    actionLabel: input.actionLabel,
    interaction: input.interaction,
    gate: predictionIndex >= 0 && index > predictionIndex ? 'after-prediction' : 'open',
    surface: input.surface ?? 'none',
    stops: input.stops ?? defaultStops,
    entryState: input.entryState,
    chamberLabel: input.chamberLabel ?? 'shown',
    flushLine: input.flushLine ?? 'pulmonary-artery',
    expectedResponse: input.expectedResponse,
  }))
}

function prediction(
  item: ClinicalLearningItem,
  round: 0 | 1,
): Extract<HemodynamicsStageInteraction, { kind: 'prediction' }> {
  return { kind: 'prediction', item, round, mapTargets: hemodynamicsMapAnswerTargets(item.id) }
}

const CONTINUE = 'Continue'
const COMMIT = 'Commit this answer'

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
        'Look at the running monitor and the catheter map beneath it. A catheter has been threaded through the right heart so that pressures can be read from inside the circulation; read what that buys, and what it does not.',
      rationale:
        'Every later section makes one of these numbers trustworthy. Knowing what a number can and cannot say is what makes the effort worth it.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
    },
    {
      phase: 'predict',
      title: 'What does a trustworthy number establish?',
      instruction: 'Read the situation and commit to one answer before the reasoning is shown.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
    },
    {
      phase: 'act',
      title: 'Where does each answer come from?',
      instruction:
        'Seven bedside questions. Attribute each to the catheter measuring it, a calculation over what it measures, or something the catheter cannot say on its own — then commit the set.',
      actionLabel: 'Commit the set',
      interaction: { kind: 'sort', sort: HEMODYNAMICS_QUESTION_SORT },
    },
    {
      phase: 'explain',
      title: 'Read, measured, calculated, inferred',
      instruction:
        'The catheter map now shows where each measured value comes from. Read the reasoning, then carry one sentence forward: a pressure is a force, not a flow, and not a cause.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
    },
    {
      phase: 'transfer',
      title: 'The same question, on the catheter',
      instruction:
        'A different situation: the catheter is in and its tracings are trustworthy. Commit to what it measures rather than calculates or infers.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
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
        'The line is level, zeroed, on a scale that fits, and it settles crisply after a flush. Walk the four things on the strip below the monitor and try the level control: the whole tracing moves, and nothing changes shape.',
      rationale:
        'Every fault in this section is a departure from this state. Seeing it first is what makes the departures readable.',
      actionLabel: CONTINUE,
      interaction: { kind: 'walk', positions: ['pa'], stops: ['line'] },
      surface: 'line',
    },
    {
      phase: 'predict',
      title: 'What is this number carrying?',
      instruction:
        'The line has changed. Read the situation and commit to the interpretation that best accounts for it before touching anything.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      entryState: runtime.predictionEntry,
      surface: 'line',
    },
    {
      phase: 'act',
      title: 'Set the reference',
      instruction:
        'Bring the transducer to the reference height, then open it to air and zero it. Watch the numbers as you do: they move together, and no wave changes its shape.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'line',
    },
    {
      phase: 'observe',
      title: 'Read the response',
      instruction:
        'Now the other axis. Run a fast flush on the pulmonary-artery line, read how it settles, say what it is, and repair the line until it settles acceptably.',
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
      title: 'Two axes, two repairs',
      instruction:
        'Read what changed and why. Then try the two stories: a colleague reaches for the tempting axis, you predict what happens, and the simulation shows you.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'line',
    },
    {
      phase: 'transfer',
      title: 'A different patient, a different fault',
      instruction:
        'A new line after a position change. Read the situation and commit before you touch it.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      surface: 'line',
    },
    {
      phase: 'transfer',
      title: 'Repair both',
      instruction:
        'Do it: set the reference, then run the flush, read it, and repair the response.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'flush',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed on the second patient. The two axes are the thing to carry forward: the reference moves the number, the response changes the shape.',
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
        'Follow the tip along the catheter map. At each stop the monitor shows the tracing that place writes; read the shape, the checklist, and the one thing to try.',
      rationale: 'A shape learned at its place survives; a shape learned from a table does not.',
      actionLabel: 'Next stop',
      interaction: {
        kind: 'walk',
        positions:
          runtime.walkPositions ?? heartRouteStopIds.map((stop) => stop as CatheterPosition),
        stops: heartRouteStopIds,
      },
      stops: [],
    },
    {
      phase: 'predict',
      title: 'Where is the tip?',
      instruction:
        'The tracing is on the monitor with its chamber label covered. Choose the place on the catheter map, then commit.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      entryState: runtime.predictionEntry,
      stops: [],
      chamberLabel: 'withheld',
    },
    {
      phase: 'act',
      title: 'Name five in a row',
      instruction:
        'A run of tracings from the reference, in a set order. Name each from its shape; the step is done when five are named in a row.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'recognition',
    },
    {
      phase: 'explain',
      title: 'The shape names the place',
      instruction:
        'Read the three rows of the table this section fills in, and the one distinction that trips most people: the ventricle and the artery share a peak and differ in their floor.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
    },
    {
      phase: 'transfer',
      title: 'A tracing described, not shown',
      instruction:
        'No picture this time — a tracing described by its timing against the ECG. Choose the place on the catheter map and commit.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      stops: [],
      chamberLabel: 'withheld',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. What carries forward is the habit: name the place from the shape before any number from it is believed.',
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
    },
  ]
}

function waveformComponentsSteps(runtime: SectionRuntime): readonly StepInput[] {
  const items = hemodynamicsSectionItems('waveform-components')
  return [
    {
      phase: 'recognize',
      title: 'The waves inside a named place',
      instruction:
        'The tip is in the right atrium on a trusted line. Read the increment, then look at the tracing: three waves and two descents, each timed against the ECG.',
      rationale:
        'A wave can only be read once its place and its line are certain; that is the order this section keeps.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'freeze',
    },
    {
      phase: 'predict',
      title: 'What made this wave?',
      instruction:
        'An abnormal wave in a confirmed tracing. Commit to the mechanism before the reasoning is shown.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'freeze',
    },
    {
      phase: 'act',
      title: 'Freeze and find the five',
      instruction:
        'Freeze the live tracing and find each component against the ECG: the a wave after the P wave, the c wave after the QRS, the v wave at the end of the T wave, and the two descents between them.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'freeze',
    },
    {
      phase: 'explain',
      title: 'What each wave can say',
      instruction:
        'Read the patterns the reference draws, one mechanism at a time. Each pattern supports a mechanism; the bedside and the echo decide it.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'freeze',
    },
    {
      phase: 'transfer',
      title: 'A different wave, a different patient',
      instruction: 'Another confirmed tracing with one component changed. Commit to the mechanism.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      surface: 'freeze',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. The habit to carry forward: which wave, in which chamber, against which part of the ECG — and only then which mechanism.',
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'freeze',
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
        'The catheter waits in the introducer. Read the increment and the short list of things that are not the tracing — the rhythm, the patient, the resistance, the balloon, the depth — because each of them can say stop.',
      rationale:
        'The shape confirms a position. Nothing about the shape licenses the next move on its own.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'tip',
    },
    {
      phase: 'predict',
      title: 'A confirmed atrium. What next?',
      instruction:
        'The tip has reached the right atrium and its tracing is confirmed. Read the observables and commit.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      entryState: runtime.predictionEntry,
      surface: 'tip',
    },
    {
      phase: 'act',
      title: 'Advance by the tracing',
      instruction:
        'Advance one stop at a time. After each move, wait for the tracing to settle, then confirm the place on the catheter map. The step is done at a confirmed pulmonary artery.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'tip',
    },
    {
      phase: 'observe',
      title: 'The step-up',
      instruction:
        'Compare the ventricle you moved through with the artery you are in: the same peak, a different floor, and a notch that was not there before.',
      actionLabel: 'Compare the two',
      interaction: { kind: 'observe', goals: [], commitments: [], provenance: false },
      surface: 'tip',
    },
    {
      phase: 'explain',
      title: 'Position from the shape, permission from the list',
      instruction:
        'Read the rows this section fills in, and the stop conditions the simulation cannot show you — resistance, ectopy, a patient who changes while the tracing does not.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'tip',
    },
    {
      phase: 'transfer',
      title: 'The signal stops being trustworthy',
      instruction:
        'A confirmed atrium on a line that has started to ring. Read the observables and commit.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      surface: 'flush',
    },
    {
      phase: 'transfer',
      title: 'Repair, then move',
      instruction:
        'Do it: run the flush, read it, repair the line — and only then advance to the ventricle and confirm it.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'tip',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed. The habit to carry forward: a tracing you cannot trust cannot confirm a position, so the line is repaired before the tip is moved.',
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'tip',
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
        'The tip is in a confirmed pulmonary artery. Read the increment and the wedge stop on the catheter map: what the balloon does, what the tracing becomes, and what has to be true when it is over.',
      rationale:
        'A wedge is the one measurement here that changes the patient while it is being taken. The way back matters as much as the number.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      surface: 'wedge',
      stops: ['pa', 'wedge'],
    },
    {
      phase: 'predict',
      title: 'Which sequence?',
      instruction: 'Read the situation and commit to the sequence before the balloon goes up.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'wedge',
    },
    {
      phase: 'act',
      title: 'Occlude, read, release',
      instruction:
        'Inflate from the confirmed artery, let the tracing settle for about a breath, place the cursor at end expiration, store the value, and deflate. The simulation releases the balloon on its own after a set interval — a rail of this model, not a clinical limit.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'wedge',
    },
    {
      phase: 'observe',
      title: 'Is it plausible, and is it over?',
      instruction:
        'Two questions about what you stored: does the value sit where a wedge must sit, and has the pulmonary-artery tracing come back? Commit to each.',
      actionLabel: CONTINUE,
      interaction: {
        kind: 'observe',
        goals: runtime.observeGoals,
        commitments: ['plausibility', 'return'],
        provenance: false,
      },
      surface: 'wedge',
    },
    {
      phase: 'explain',
      title: 'Brief, plausible, and over',
      instruction:
        'Read the rows this section fills in and the control strip, then try the story: a colleague adds balloon volume to a wedge that does not look right, and the simulation shows what it does with that.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'wedge',
    },
    {
      phase: 'transfer',
      title: 'Under more positive pressure',
      instruction:
        'The same patient, ventilated harder and breathing faster, so the tracing swings more with each breath. Commit to the sample and the next action.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      entryState: runtime.transferEntry ?? undefined,
      surface: 'wedge',
    },
    {
      phase: 'transfer',
      title: 'Take it again',
      instruction:
        'Do it on this patient: occlude, wait a breath, place the cursor at the trough of the swing, store, deflate, and say whether the artery came back.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.transferGoals, round: 1 },
      surface: 'wedge',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read what changed. The habit to carry forward: end expiration is where the reading lives, and the tracing coming back is the end of the measurement, not the number.',
      actionLabel: 'Finish the section',
      interaction: { kind: 'explain', round: 1 },
      surface: 'wedge',
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
        'Cold injectate goes in at the atrium and a thermistor at the tip watches the temperature fall and recover. The catheter map marks both. Read the increment: flow is measured, and every measurement has a technique that shows in what it produces.',
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
        'Three curves are already on the record. Read the situation and commit before you open any of them.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'thermodilution',
    },
    {
      phase: 'act',
      title: 'Read each curve, decide each curve',
      instruction:
        'Open every curve before its number. Accept the ones whose acquisition holds, exclude the one whose curve shows a technical reason, and inject again with the standard technique until a series of usable curves exists.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'thermodilution',
    },
    {
      phase: 'observe',
      title: 'Which result was measured?',
      instruction:
        'Two Fick results are on record for the same hour. Read how each was obtained and commit to which of them can be called direct.',
      actionLabel: CONTINUE,
      interaction: { kind: 'observe', goals: [], commitments: [], provenance: true },
      surface: 'thermodilution',
    },
    {
      phase: 'explain',
      title: 'The technique is in the curve',
      instruction:
        'Read the row this section fills in and the three ways a flow number can be produced — thermodilution, direct Fick, and Fick with a substituted uptake — and what each can and cannot say.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'thermodilution',
    },
    {
      phase: 'transfer',
      title: 'A low-flow patient, a poor third curve',
      instruction: 'A different patient and a different series. Commit to the next step.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      surface: 'thermodilution',
    },
    {
      phase: 'transfer',
      title: 'When the two methods disagree',
      instruction:
        'The series and a Fick result on the same patient do not agree. Read both acquisitions and say which result can be defended — which may be neither — without averaging them.',
      actionLabel: CONTINUE,
      interaction: { kind: 'disagreement' },
      surface: 'thermodilution',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. The habit to carry forward: a curve is judged on its own acquisition, and two measurement systems are never averaged into one number.',
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
        'Six quantities from one flowsheet, printed alike. Say how each one reached the record — measured, sampled, entered, assumed, or calculated — and commit the set.',
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
        'A calculated value on a line whose reference is not yet set. Read the situation and commit.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'derived',
    },
    {
      phase: 'act',
      title: 'Work the episodes',
      instruction:
        'Measurement episodes with their inputs and provenance. Name what one calculation depends on, withhold what an invalid input makes unreadable while keeping what it does not touch, trace a flow-dependent value to its method, and keep a two-method disagreement without averaging it.',
      actionLabel: CONTINUE,
      interaction: { kind: 'derived-workbench' },
      surface: 'derived',
    },
    {
      phase: 'explain',
      title: 'An equation over measurements',
      instruction:
        'Read the row this section fills in and the records behind every calculated value on the screen: the formula, its inputs, its units, and the boundary on what it can say.',
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'derived',
    },
    {
      phase: 'transfer',
      title: 'A number the monitor can show',
      instruction:
        'A different patient and a different calculated value. Commit to whether the result is interpretable.',
      actionLabel: COMMIT,
      interaction: prediction(items.transfer, 1),
      surface: 'derived',
    },
    {
      phase: 'transfer',
      title: 'Plausible, or coherent?',
      instruction:
        'Two result sets: one that looks right with no record of where its inputs came from, and one that looks surprising from an episode that hangs together. Choose without selecting by expectation.',
      actionLabel: CONTINUE,
      interaction: { kind: 'derived-transfer' },
      surface: 'derived',
    },
    {
      phase: 'transfer',
      title: 'What carried over',
      instruction:
        'Read the outcome. The habit to carry forward: trace every calculated value to its inputs before it is read, and withhold only what an invalid input actually touches.',
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
        'One patient, one hour on. Read the bedside picture in the strip, look at the monitor, and read the increment: nothing new is taught here. Every row you need is already in the table.',
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
        'Read the situation and commit to the first move before anything on the screen is touched.',
      actionLabel: COMMIT,
      interaction: prediction(items.prediction, 0),
      surface: 'capstone',
    },
    {
      phase: 'act',
      title: 'Restore the screen, in order',
      instruction:
        'The line first: level, zero, flush, read, repair. Then the tip: the balloon down and the tracing back to a confirmed artery. Then the series: reviewed curves, a technical reason for every exclusion.',
      actionLabel: CONTINUE,
      interaction: { kind: 'simulator-task', goals: runtime.actGoals, round: 0 },
      surface: 'capstone',
    },
    {
      phase: 'observe',
      title: 'Reassess against the patient',
      instruction:
        'With the screen restored, reassess: read the corrected pressures, the series and the bedside together, and compare them with what the screen showed an hour ago.',
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
      actionLabel: CONTINUE,
      interaction: { kind: 'explain', round: 0 },
      surface: 'capstone',
    },
    {
      phase: 'transfer',
      title: 'A different line, a different patient',
      instruction:
        'A systemic arterial line whose tracing has changed shape while its mean has not. A colleague reaches for a drug. Commit to what comes first.',
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

/** The pre-commit surfaces of a lesson, as authored text: everything at or before the prediction. */
export function precommitAuthoredSurfaces(
  lesson: HemodynamicsStageLesson,
): readonly { readonly where: string; readonly text: string }[] {
  const surfaces: { where: string; text: string }[] = [
    { where: 'title', text: lesson.title },
    { where: 'objective', text: lesson.spec.objective },
    { where: 'new concept', text: lesson.spec.newConcept },
    { where: 'increment', text: lesson.spec.incrementSentence },
  ]
  lesson.steps.forEach((step, index) => {
    if (index > lesson.predictionStepIndex && lesson.predictionStepIndex >= 0) return
    surfaces.push(
      { where: `step ${step.ordinal} title`, text: step.title },
      { where: `step ${step.ordinal} instruction`, text: step.instruction },
      { where: `step ${step.ordinal} action`, text: step.actionLabel },
    )
    if (step.rationale)
      surfaces.push({ where: `step ${step.ordinal} rationale`, text: step.rationale })
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
    lesson.steps.forEach((step, index) => {
      const stepWhere = `${where} step ${step.ordinal}`
      errors.push(
        ...hemodynamicsLearnerCopyErrors(`${stepWhere} title`, step.title),
        ...hemodynamicsLearnerCopyErrors(`${stepWhere} instruction`, step.instruction),
        ...hemodynamicsLearnerCopyErrors(`${stepWhere} action`, step.actionLabel),
      )
      if (step.rationale) {
        errors.push(...hemodynamicsLearnerCopyErrors(`${stepWhere} rationale`, step.rationale))
      }
      const expectedGate = index > lesson.predictionStepIndex ? 'after-prediction' : 'open'
      if (step.gate !== expectedGate) errors.push(`${stepWhere} has the wrong gate.`)
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
