import type { ClinicalLearningItem } from '@/features/learning-module/activity/clinicalLearningItem'
import type {
  StageLessonBase,
  StagePhase,
  StageStepBase,
} from '@/features/learning-module/stage/stageModel'

import { breathStopIds, type BreathStopId } from './breathSpine'
import {
  ventilationLearningUnits,
  ventilationUnitById,
  type VentilationLearningUnit,
} from './learningCurriculum'
import {
  ventilationExperimentByUnit,
  type LabGoal,
  type LabMetric,
  type LabRound,
} from './learningExperiments'
import { ventilationSectionSpec, type VentilationSectionSpec } from './sectionSpecs'
import {
  ventilationLocationItemByUnit,
  ventilationRoundItem,
  ventilationSettingSort,
  type VentilationSettingSort,
} from './stageItems'
import { labMetricLabels } from '../engine/learningLab'

/**
 * Each unit as a lesson on the stage.
 *
 * Eight steps, the first five from experiment round 1 and the last three from round 2, which was
 * authored as the transfer: Recognize → Predict → Act → Observe → Explain → Transfer (predict) →
 * Transfer (do it and watch) → Transfer (what changed). The control-panel section carries one more
 * step, the settings sort, between Explain and the transfer. Nothing here is authored: the steps are
 * built from the curriculum, the experiments, the section specs and the items.
 *
 * Titles visible before the prediction name the presentation, never the response: an experiment
 * round's own title ("Give expiration time back") is used only on its Explain step.
 */

export type VentilationRoundIndex = 0 | 1

export type VentilationStageInteraction =
  /** Nothing to perform: the learner reads, then continues. */
  | { readonly kind: 'read' }
  /** Stand at each stop on the breath map in turn; performed when every stop has been visited. */
  | { readonly kind: 'walk'; readonly stops: readonly BreathStopId[] }
  /** Choose the stop on the breath map where the patient's problem lives, then commit. */
  | {
      readonly kind: 'locate'
      readonly item: ClinicalLearningItem
      readonly targets: Readonly<Record<string, BreathStopId>>
    }
  /** The commit point of a round: the prediction, before the change is made. */
  | {
      readonly kind: 'prediction'
      readonly round: VentilationRoundIndex
      readonly item: ClinicalLearningItem
    }
  /** Make the round's change on the running patient; performed when the engine reaches it. */
  | {
      readonly kind: 'simulator-task'
      readonly round: VentilationRoundIndex
      readonly goals: readonly LabGoal[]
      /** Whether the step also waits out the observation interval (the transfer round does). */
      readonly withObservation: boolean
    }
  /** Let the response interval elapse while watching the named readings. */
  | {
      readonly kind: 'observe'
      readonly round: VentilationRoundIndex
      readonly watch: readonly LabMetric[]
    }
  /** The reveal: verdict, before-and-after, explanation. */
  | { readonly kind: 'explain'; readonly round: VentilationRoundIndex }
  /** Sort screen values into what you set and what is reported, committed as a set. */
  | { readonly kind: 'sort'; readonly sort: VentilationSettingSort }

export interface VentilationStageStep extends StageStepBase<VentilationStageInteraction> {
  /** The stops lit on the breath map while this step is current; empty lights the whole breath. */
  readonly stops: readonly BreathStopId[]
  /** Which teaching blocks are this step's focus. */
  readonly teaching: 'framing' | 'stop' | 'task' | 'reveal' | 'transfer'
}

export interface VentilationStageLesson extends StageLessonBase<VentilationStageStep> {
  readonly unit: VentilationLearningUnit
  readonly spec: VentilationSectionSpec
  readonly panelId: string
  readonly lifecycleActivityId: string
  /** The step that commits round 2's prediction. */
  readonly transferPredictionStepIndex: number
}

function watchLabels(metrics: readonly LabMetric[]): string {
  const labels = metrics.map((metric) => labMetricLabels[metric].label.toLowerCase())
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`
}

function intervalSentence(round: LabRound): string {
  if (round.seconds <= 0) return ''
  return ` Then let the patient run for ${round.seconds} simulated seconds while you watch ${watchLabels(round.watch)}.`
}

function stepId(unitId: string, phase: StagePhase, ordinal: number): string {
  return `${unitId}:${ordinal}-${phase}`
}

export function buildVentilationStageLesson(unitId: string): VentilationStageLesson {
  const unit = ventilationUnitById.get(unitId)
  const experiment = ventilationExperimentByUnit.get(unitId)
  if (!unit || !experiment) throw new Error(`Unknown ventilation unit ${unitId}`)
  const spec = ventilationSectionSpec(unitId)
  const [first, second] = experiment.rounds
  const index = ventilationLearningUnits.findIndex((entry) => entry.id === unitId)
  const location = ventilationLocationItemByUnit.get(unitId)
  const stops = spec.stops

  const recognizeInteraction: VentilationStageInteraction =
    unitId === 'waveform-anatomy'
      ? { kind: 'walk', stops: breathStopIds }
      : location
        ? { kind: 'locate', item: location.item, targets: location.targets }
        : { kind: 'read' }

  const steps: Omit<VentilationStageStep, 'ordinal' | 'id'>[] = [
    {
      phase: 'recognize',
      title: spec.recognizeTitle,
      instruction: spec.recognizeInstruction,
      rationale: unit.increment,
      actionLabel:
        recognizeInteraction.kind === 'walk'
          ? 'Next stop'
          : recognizeInteraction.kind === 'locate'
            ? 'Commit my answer'
            : 'Continue',
      interaction: recognizeInteraction,
      gate: 'open',
      stops: recognizeInteraction.kind === 'walk' ? [] : stops,
      teaching: 'framing',
    },
    {
      phase: 'predict',
      title: 'Predict the response',
      instruction: `${first.introduction} ${first.look}`,
      rationale:
        'Committing to an answer before the change is made is what turns watching into learning: the response then confirms or corrects something you actually thought.',
      actionLabel: 'Commit my prediction',
      interaction: { kind: 'prediction', round: 0, item: ventilationRoundItem(unitId, 0) },
      gate: 'open',
      stops,
      teaching: 'framing',
    },
    {
      phase: 'act',
      title: 'Make the change',
      instruction: first.task,
      rationale:
        'The change is yours to make, on the console or with the quick controls beneath it. The step is done once the patient is receiving it.',
      actionLabel: 'Continue',
      interaction: { kind: 'simulator-task', round: 0, goals: first.goals, withObservation: false },
      gate: 'after-prediction',
      stops,
      teaching: 'task',
    },
    {
      phase: 'observe',
      title: 'Watch the response',
      instruction:
        first.seconds > 0
          ? `Let the patient run for ${first.seconds} simulated seconds and watch ${watchLabels(first.watch)}. Use the faster clock if you like; the comparison unlocks when the interval has elapsed.`
          : `Look at ${watchLabels(first.watch)} now that the change has been made.`,
      actionLabel: 'Compare before and after',
      interaction: { kind: 'observe', round: 0, watch: first.watch },
      gate: 'after-prediction',
      stops,
      teaching: 'task',
    },
    {
      phase: 'explain',
      title: first.title,
      instruction:
        'Read the verdict on your prediction and what actually changed, then the explanation on the right.',
      actionLabel: 'Continue to a new setup',
      interaction: { kind: 'explain', round: 0 },
      gate: 'after-prediction',
      stops,
      teaching: 'reveal',
      expectedResponse: [first.explanation],
    },
  ]

  if (unitId === ventilationSettingSort.unitId) {
    steps.push({
      phase: 'act',
      title: 'Sort what you set from what you check',
      instruction: ventilationSettingSort.prompt,
      rationale:
        'Two of these pairs look alike on purpose. Separating a request from a result is the whole of this section.',
      actionLabel: 'Commit the six',
      interaction: { kind: 'sort', sort: ventilationSettingSort },
      gate: 'after-prediction',
      stops,
      teaching: 'reveal',
    })
  }

  steps.push(
    {
      phase: 'transfer',
      title: 'A new setup: predict again',
      instruction: `${second.introduction} ${second.look}`,
      rationale:
        'The same principle in a different situation. If the first answer was memorised rather than understood, this is where it shows.',
      actionLabel: 'Commit my prediction',
      interaction: { kind: 'prediction', round: 1, item: ventilationRoundItem(unitId, 1) },
      gate: 'after-prediction',
      stops,
      teaching: 'transfer',
    },
    {
      phase: 'transfer',
      title: 'Make the change and watch',
      instruction: `${second.task}${intervalSentence(second)}`,
      actionLabel: 'Compare before and after',
      interaction: { kind: 'simulator-task', round: 1, goals: second.goals, withObservation: true },
      gate: 'after-prediction',
      stops,
      teaching: 'task',
    },
    {
      phase: 'transfer',
      title: second.title,
      instruction: 'Read the verdict and the before-and-after, then finish the section.',
      actionLabel: 'Finish this section',
      interaction: { kind: 'explain', round: 1 },
      gate: 'after-prediction',
      stops,
      teaching: 'reveal',
      expectedResponse: [second.explanation],
    },
  )

  const built: VentilationStageStep[] = steps.map((step, position) => ({
    ...step,
    ordinal: position + 1,
    id: stepId(unitId, step.phase, position + 1),
  }))

  const predictionStepIndex = built.findIndex(
    (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
  )
  const transferPredictionStepIndex = built.findIndex(
    (step) => step.interaction.kind === 'prediction' && step.interaction.round === 1,
  )

  return {
    sectionId: unitId,
    unit,
    spec,
    panelId: experiment.panelId,
    title: unit.title,
    minutes: unit.minutes,
    index,
    total: ventilationLearningUnits.length,
    steps: built,
    predictionStepIndex,
    transferPredictionStepIndex,
    lifecycleActivityId: `ventilation:learn:${unitId}`,
  }
}

const lessons = new Map<string, VentilationStageLesson>()
export function ventilationStageLesson(unitId: string): VentilationStageLesson {
  let lesson = lessons.get(unitId)
  if (!lesson) {
    lesson = buildVentilationStageLesson(unitId)
    lessons.set(unitId, lesson)
  }
  return lesson
}

export const ventilationStageLessons: readonly VentilationStageLesson[] =
  ventilationLearningUnits.map((unit) => ventilationStageLesson(unit.id))
