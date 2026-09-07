import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import type { ClinicalLearningItem } from '@/features/learning-module/activity/clinicalLearningItem'
import { pathwaySectionIndex } from '@/features/learning-module/curriculum/types'
import {
  STAGE_PHASES,
  type StageLessonBase,
  type StagePhase,
  type StageStepBase,
} from '@/features/learning-module/stage/stageModel'

import type { McsDeviceKind, McsSimulationState } from '../engine/types'
import { mcsPresentationTitle } from './casePresentation'
import { MCS_CONTROL_PANEL_SORT, type McsControlPanelSort } from './controlPanelSort'
import { mcsIncrementForSection, type McsDeviceIncrement } from './deviceIncrements'
import { mcsLearnControls, type McsLearnControlId } from './learnControls'
import { mcsLessons } from './lessons'
import { mcsLessonTransferByLessonId, type McsLessonTransferDefinition } from './lessonTransfers'
import { mcsMapAnswerTargets } from './mapAnswerTargets'
import { mcsPracticeScenarios } from './scenarios'
import {
  mcsSectionLearningContractById,
  type McsLearnActionMode,
  type McsObservedSignal,
  type McsRecognizeOption,
  type McsSectionLearningContract,
} from './sectionLearningContracts'
import { mcsSectionSpec, type McsSectionSpec } from './sectionSpecs'
import { mcsStoryProblemsFor } from './storyProblems'
import type { McsSpineStopId } from './supportSpine'

/**
 * A section of the pathway, expressed as stage steps.
 *
 * The section contract already authors everything the learner reads — the identification, the
 * prediction, the control and its completion predicate, the six readings to compare, the
 * four-level explanation, the transfer patient. The six phases become six steps in contract
 * order (seven where the section opens with the walk along the loop), the prediction step is
 * the gate, and the transfer's commitment is what records the section as worked. Nothing about
 * the contract changes; this adapter only says which of it each step shows, and where.
 */

/** The surfaces a step can open beside the monitor, which is always present. */
export type McsStageSurfaceId = 'map' | 'controls' | 'anatomy'

export const MCS_STAGE_SURFACES: readonly McsStageSurfaceId[] = ['map', 'controls', 'anatomy']

export const MCS_STAGE_SURFACE_LABELS: Readonly<Record<McsStageSurfaceId, string>> = {
  map: 'Circulation map',
  controls: 'Controls',
  anatomy: 'Three-dimensional view',
}

export type McsStageInteraction =
  /** The walk along the loop: one stop at a time, performed when every stop has been visited. */
  | { readonly kind: 'walk' }
  /** The identification: one committed choice with authored feedback per option. */
  | {
      readonly kind: 'identify'
      readonly prompt: string
      readonly options: readonly McsRecognizeOption[]
      /** Present when the question is answered on the circulation map. */
      readonly onMap: boolean
    }
  /** The commit point. */
  | {
      readonly kind: 'prediction'
      readonly prompt: string
      readonly item: ClinicalLearningItem
      readonly reasoning: string
    }
  /** The control, or the explicit statement that none is expected. */
  | {
      readonly kind: 'action'
      readonly mode: McsLearnActionMode
      readonly instruction: string
      readonly targetControl?: McsLearnControlId
      readonly allowedActions: readonly McsLearnControlId[]
      readonly noActionExplanation?: string
      readonly isSatisfied: (state: McsSimulationState) => boolean
    }
  /** The before-and-after comparison of the readings captured on entry to Act. */
  | {
      readonly kind: 'observe'
      readonly focus: string
      readonly signals: readonly McsObservedSignal[]
      readonly beforeLabels: readonly string[]
      readonly afterLabels: readonly string[]
      readonly unmodeledNote?: string
    }
  /** The explanation; carries the control-panel sort on the section that introduces the panel. */
  | { readonly kind: 'explain'; readonly prompt: string; readonly sort?: McsControlPanelSort }
  /** The transfer patient, loaded on entry, with its item and its required work. */
  | { readonly kind: 'transfer'; readonly transfer: McsLessonTransferDefinition }

export interface McsStageStep extends StageStepBase<McsStageInteraction> {
  /** Surfaces opened when the step is entered; the learner may open the rest. */
  readonly surfaces: readonly McsStageSurfaceId[]
  /** The stops lit on the map while this step is current. */
  readonly stopIds: readonly McsSpineStopId[]
}

export interface McsStageLesson extends StageLessonBase<McsStageStep> {
  readonly contract: McsSectionLearningContract
  readonly spec: McsSectionSpec
  readonly transfer: McsLessonTransferDefinition
  readonly startingDevice: McsDeviceKind
  readonly lifecycleActivityId: string
  readonly increment?: McsDeviceIncrement
  readonly practicePairing?: {
    readonly kind: 'mechanism-match' | 'next-in-unit'
    readonly caseId: string
    readonly title: string
  }
}

const PHASE_LABEL: Readonly<Record<StagePhase, string>> = {
  recognize: 'Recognize',
  predict: 'Predict',
  act: 'Act',
  observe: 'Observe',
  explain: 'Explain',
  transfer: 'Transfer',
}

function surfacesFor(
  phase: StagePhase,
  spec: McsSectionSpec,
  contract: McsSectionLearningContract,
  onMap: boolean,
): readonly McsStageSurfaceId[] {
  const mapLed = contract.primarySurface === 'anatomy' || spec.walksTheLoop || onMap
  switch (phase) {
    case 'recognize':
    case 'predict':
      return mapLed ? ['map'] : []
    case 'act': {
      // The controls surface opens only when the work cannot be done from the Now card's own
      // buttons — every allowed action that is a guided button stays in the card.
      const needsControls = contract.allowedActions.some(
        (id) => mcsLearnControls[id].location !== 'guided-actions',
      )
      return needsControls ? ['controls'] : []
    }
    case 'observe':
      return []
    case 'explain':
      return spec.grammarRowIds.length > 0 || spec.walksTheLoop ? ['map'] : []
    case 'transfer':
      return ['controls']
    default:
      return []
  }
}

export function buildMcsStageLesson(sectionId: string): McsStageLesson {
  const contract = mcsSectionLearningContractById.get(sectionId)
  if (!contract) throw new Error(`No section contract for ${sectionId}`)
  const spec = mcsSectionSpec(sectionId)
  const transfer = mcsLessonTransferByLessonId.get(sectionId)
  if (!transfer) throw new Error(`No transfer for ${sectionId}`)
  const lesson = mcsLessons.find((candidate) => candidate.id === sectionId)
  if (!lesson) throw new Error(`No lesson for ${sectionId}`)
  const pathway = criticalCareLearningPathway('mechanical-circulatory-support')
  const index = pathwaySectionIndex(pathway, sectionId)
  const section = pathway.sections[index]
  const onMap = mcsMapAnswerTargets(sectionId) !== null

  const steps: McsStageStep[] = []
  let ordinal = 0
  const push = (
    phase: StagePhase,
    idSuffix: string,
    title: string,
    instruction: string,
    actionLabel: string,
    interaction: McsStageInteraction,
    rationale?: string,
  ) => {
    ordinal += 1
    steps.push({
      id: `${sectionId}-${idSuffix}`,
      ordinal,
      phase,
      title,
      instruction,
      rationale,
      actionLabel,
      interaction,
      gate: phase === 'recognize' || phase === 'predict' ? 'open' : 'after-prediction',
      surfaces: surfacesFor(phase, spec, contract, onMap),
      stopIds: spec.stopIds,
    })
  }

  if (spec.walksTheLoop) {
    push(
      'recognize',
      'walk',
      'Walk the loop',
      'Follow the circulation one stop at a time. Each stop lights on the map, names what a device does there, and gives you the few things to check at that place.',
      'Next stop',
      { kind: 'walk' },
      'Every device in this module is read on the same loop, and every later section stands at one of these stops. Walking it once is what makes a later "where" question answerable.',
    )
  }

  push(
    'recognize',
    'recognize',
    spec.stepTitles.recognize,
    contract.recognizePrompt,
    'Commit this answer',
    {
      kind: 'identify',
      prompt: contract.recognizePrompt,
      options: contract.recognizeOptions,
      onMap,
    },
    contract.teaching.whatTheTargetRepresents,
  )

  push(
    'predict',
    'predict',
    spec.stepTitles.predict,
    contract.predictionPrompt,
    'Commit this prediction',
    {
      kind: 'prediction',
      prompt: contract.predictionPrompt,
      item: contract.predictionItem,
      reasoning: contract.predictionReasoning,
    },
  )

  push(
    'act',
    'act',
    spec.stepTitles.act,
    contract.actionInstruction,
    'Continue',
    {
      kind: 'action',
      mode: contract.actionMode,
      instruction: contract.actionInstruction,
      targetControl: contract.targetControl,
      allowedActions: contract.allowedActions,
      noActionExplanation: contract.noActionExplanation,
      isSatisfied: contract.isActionSatisfied,
    },
    contract.teaching.howTheActionAffectsTheModel,
  )

  push('observe', 'observe', spec.stepTitles.observe, contract.observationFocus, 'Continue', {
    kind: 'observe',
    focus: contract.observationFocus,
    signals: contract.observedSignals,
    beforeLabels: contract.beforeStateLabels,
    afterLabels: contract.afterStateLabels,
    unmodeledNote: contract.unmodeledNote,
  })

  push('explain', 'explain', spec.stepTitles.explain, contract.reassessmentPrompt, 'Continue', {
    kind: 'explain',
    prompt: contract.reassessmentPrompt,
    ...(spec.walksTheLoop ? { sort: MCS_CONTROL_PANEL_SORT } : {}),
  })

  push(
    'transfer',
    'transfer',
    spec.stepTitles.transfer,
    contract.transferPrompt,
    'Commit this answer',
    { kind: 'transfer', transfer },
    contract.completionCondition,
  )

  const pairedCase = spec.practicePairing
    ? mcsPracticeScenarios.find((scenario) => scenario.id === spec.practicePairing?.caseId)
    : undefined

  return {
    sectionId,
    title: section?.title ?? lesson.title,
    minutes: section?.minutes ?? 12,
    index,
    total: pathway.sections.length,
    steps,
    predictionStepIndex: steps.findIndex((step) => step.interaction.kind === 'prediction'),
    contract,
    spec,
    transfer,
    startingDevice: contract.startingDevice,
    lifecycleActivityId: `mcs:learn:${sectionId}`,
    increment: mcsIncrementForSection(sectionId),
    ...(pairedCase && spec.practicePairing
      ? {
          practicePairing: {
            kind: spec.practicePairing.kind,
            caseId: pairedCase.id,
            title: mcsPresentationTitle(pairedCase),
          },
        }
      : {}),
  }
}

export const mcsStageLessonIds: readonly string[] = mcsLessons.map((lesson) => lesson.id)

/** Every section as a stage lesson, in pathway order. */
export function mcsStageLessons(): readonly McsStageLesson[] {
  return mcsStageLessonIds.map((id) => buildMcsStageLesson(id))
}

export function mcsStagePhaseLabel(phase: StagePhase): string {
  return PHASE_LABEL[phase]
}

/**
 * Where a lesson mounts when the URL names a phase.
 *
 * Only `recognize` and `predict` are honoured. Commitment is never persisted, so a URL into a
 * later phase cannot know whether the prediction was ever taken; the closed failure is to open at
 * the prediction and say which phase is waiting.
 */
export function mcsMountStepIndex(
  lesson: Pick<McsStageLesson, 'steps' | 'predictionStepIndex'>,
  requestedPhase: StagePhase,
): { readonly index: number; readonly clamped: boolean } {
  if (requestedPhase === 'recognize') return { index: 0, clamped: false }
  if (requestedPhase === 'predict') {
    return { index: Math.max(0, lesson.predictionStepIndex), clamped: false }
  }
  return { index: Math.max(0, lesson.predictionStepIndex), clamped: true }
}

/** The story problems a section carries on its Observe and Explain steps. */
export function mcsStageStories(sectionId: string) {
  return mcsStoryProblemsFor(sectionId)
}

export { STAGE_PHASES }
