import {
  imagingLearningActivities,
  validateImagingLearningActivities,
  type ImagingLearningActivity,
} from './learningActivities'

import type { ClinicalLearningItem } from '@/features/learning-module/activity'
import {
  stageStepLocationErrors,
  type StageLessonBase,
  type StagePhase,
  type StageStepBase,
  type StageStepLocation,
} from '@/features/learning-module/stage/stageModel'

import type { SuiteViewSpec } from '../components/suite/types'
import type { LabGoal } from '../engine/labGoalEvaluation'
import type { LabMetricId } from '../engine/labMetrics'
import type { LabId, Lesson } from '../types'
import { type ChainAnswerTarget } from './chainAnswerTargets'
import { type ChainStopId } from './imagingChain'
import { imagingLabGoals } from './labGoals'
import { imagingLearnerCopyErrors } from './learnerCopy'
import {
  imagingActivityId,
  imagingLesson,
  peripheralImagingSectionIds,
  type ImagingSectionId,
} from './pathway'
import { imagingSectionSpec, type ImagingSectionSpec } from './sectionSpecs'
import { imagingSort, type ImagingSort } from './sorts'
import { imagingSectionItems } from './stageItems'
import { transferOrigin, transferReviewInstruction, transferReviewTitle } from './transferOrigins'
import { suiteViewForStep } from './suiteViews'

/**
 * The adapter: every section of the pathway as one ordered list of steps on the lesson stage.
 *
 * learningActivities authors each section's sequence and presentation. This adapter resolves
 * its teaching references, existing questions and real lab predicates into the session reducer's
 * interaction types. Phase names remain internal compatibility fields, not required screen layouts.
 */
export type ImagingStageInteraction =
  | { readonly kind: 'read' }
  | {
      readonly kind: 'walk'
      readonly stops: readonly ChainStopId[]
      readonly lab: LabId
      readonly goals: readonly LabGoal[]
    }
  | {
      readonly kind: 'prediction'
      readonly item: ClinicalLearningItem
      readonly round: 0 | 1
      readonly chainTargets: readonly ChainAnswerTarget[] | null
    }
  | { readonly kind: 'lab-task'; readonly lab: LabId; readonly goals: readonly LabGoal[] }
  | {
      readonly kind: 'observe'
      readonly lab: LabId
      readonly goals: readonly LabGoal[]
      readonly readouts: readonly LabMetricId[]
    }
  | { readonly kind: 'sort'; readonly sort: ImagingSort }
  | { readonly kind: 'explain'; readonly round: 0 | 1 }

export interface ImagingStageStep extends StageStepBase<ImagingStageInteraction> {
  readonly activity: ImagingLearningActivity
  readonly lookIn: StageStepLocation
  /** What the suite shows while this step is current. */
  readonly suite: SuiteViewSpec
  /** The stops the chain map lights while this step is current. */
  readonly stops: readonly ChainStopId[]
}

export interface ImagingStageLesson extends StageLessonBase<ImagingStageStep> {
  readonly sectionId: ImagingSectionId
  readonly spec: ImagingSectionSpec
  readonly lesson: Lesson
  readonly transferStepIndex: number
  readonly lifecycleActivityId: string
}

/** The words the panes carry, so an instruction and a caption use one name for one thing. */
export const IN_STEPS = {
  choices: 'the answer choices below',
  verdict: 'the verdict below',
  verdictAndChange: 'the verdict and the table of what changed below',
  sortRows: 'the rows to place below',
  walkCard: 'the walk card below',
  commit: 'Check your interpretation, on this card',
} as const

export const ON_SUITE = {
  scene: 'Worked demonstration',
  pins: 'the numbered labels on the image-formation map',
  controls: 'The controls, the dock under the scene',
  readouts: 'The readouts, beside the controls',
} as const

export const IN_TEACHING = {
  purpose: 'What this section is for',
  adds: 'What this section adds',
} as const

const CONTINUE = 'Continue'

/** A hands-on step: the text column holds what to do and its checklist. */
const HANDS_ON_INSTRUCTION = 'Do the steps in the checklist, using the controls beside the image.'

interface StepInput {
  readonly activity: ImagingLearningActivity
  readonly phase: StagePhase
  readonly title: string
  readonly instruction: string
  readonly lookIn: StageStepLocation
  readonly rationale?: string
  readonly actionLabel: string
  readonly interaction: ImagingStageInteraction
  readonly suite: SuiteViewSpec
  readonly stops?: readonly ChainStopId[]
  readonly expectedResponse?: readonly string[]
}

function prediction(
  item: ClinicalLearningItem,
  round: 0 | 1,
): Extract<ImagingStageInteraction, { kind: 'prediction' }> {
  return { kind: 'prediction', item, round, chainTargets: null }
}

/**
 * What a check asks the learner to read, decided by what that check actually puts on screen.
 *
 * Transfer rounds carry no visual at all and keep their own wording. A check with no visual reads
 * its scenario, a check beside a dose record reads the record, and every other check keeps the
 * image-based instruction, because its image is the evidence. A check whose question the section's
 * image cannot show is authored as a written scenario (`finish('record', 'case')`), never as an
 * unrelated image with a disclaimer.
 */
function checkInstruction(activity: ImagingLearningActivity): string {
  if (activity.task === 'transfer')
    return 'Use the stated evidence in this different situation. Select an answer, then review the feedback.'
  if (activity.visual === 'case')
    return 'Read the scenario. Choose what the evidence supports and what remains uncertain.'
  if (activity.visual === 'dose')
    return 'Read the procedure record. Choose what it supports and what remains uncertain.'
  return 'Inspect the image and acquisition context. Choose what the evidence supports and what remains uncertain.'
}

function buildInputs(sectionId: ImagingSectionId): readonly StepInput[] {
  const lesson = imagingLesson(sectionId)
  const spec = imagingSectionSpec(sectionId)
  const items = imagingSectionItems(sectionId)
  const goals = imagingLabGoals(sectionId)
  return imagingLearningActivities(sectionId).map((activity): StepInput => {
    const base: StepInput = {
      activity,
      phase: 'recognize',
      title: activity.title,
      instruction:
        'Read the explanation alongside the image. Compare the labeled examples, then continue when ready.',
      actionLabel: CONTINUE,
      interaction: { kind: 'read' },
      lookIn: { pane: 'simulator', landmark: 'the image and its explanation in this task' },
      suite: {
        ...suiteViewForStep(sectionId),
        ...(activity.controls ? { controls: activity.controls } : {}),
      },
    }
    switch (activity.task) {
      case 'read':
        return base
      case 'check':
      case 'transfer': {
        // Report CW1 (fellow walkthrough, PDF p.6): a closing question that reuses an earlier
        // section's item is labelled as the optional review it is, and says which section it
        // reviews. The item, its id and its identity in the record are untouched; the two closing
        // questions that are new to the learner keep their own heading.
        const origin = activity.task === 'transfer' ? transferOrigin(sectionId) : null
        return {
          ...base,
          phase: activity.task === 'transfer' ? 'transfer' : 'predict',
          title: origin ? transferReviewTitle(origin) : activity.title,
          // Report 1.2 (fellow walkthrough, PDF p.10): the check told the learner to inspect an
          // image on screens that render none, so they scrolled looking for one. A check that
          // carries no visual is a written scenario and says so. Nothing here converts an
          // image-reading objective into a reading one: each of these stems already states its
          // findings in words. Items that genuinely depend on an image are batch 04's evidence
          // matrix (PR1/IC3), not a reworded prompt.
          //
          // A check that does carry a visual says which of the two it is, by the identity of this
          // exact question and round: an image the answer can be read off, or the section's
          // authored equipment model beside a written scenario it does not represent. Only the
          // second is relabelled, and only for the three declared identities.
          instruction: origin ? transferReviewInstruction(origin) : checkInstruction(activity),
          actionLabel: 'Check my interpretation',
          interaction: prediction(
            activity.task === 'transfer' ? items.transfer : items.prediction,
            activity.task === 'transfer' ? 1 : 0,
          ),
          lookIn: { pane: 'steps', landmark: IN_STEPS.choices },
        }
      }
      case 'act': {
        if (spec.act.kind === 'sort')
          return {
            ...base,
            phase: 'act',
            instruction: imagingSort(spec.act.sortId).prompt,
            actionLabel: 'Check the evidence matches',
            interaction: { kind: 'sort', sort: imagingSort(spec.act.sortId) },
            lookIn: { pane: 'steps', landmark: IN_STEPS.sortRows },
          }
        if (!lesson.lab || !goals) throw new Error(`${activity.id} has no supported lab task`)
        return {
          ...base,
          phase: 'act',
          // Owner feedback, 2026-10-11: an instruction names only what its own step shows. The
          // section's `labTask` spans every hands-on step, so quoting it here asked for controls
          // the step did not have; what to move and what to watch is the task lead in the text
          // column (`taskLeads.ts`), beside the step's checklist.
          instruction:
            spec.act.kind === 'walk'
              ? 'Follow the image through its six components, one at a time. Each is highlighted in the 3D view as you reach it.'
              : HANDS_ON_INSTRUCTION,
          interaction:
            spec.act.kind === 'walk'
              ? { kind: 'walk', stops: spec.chainStops, lab: lesson.lab, goals: goals.act }
              : { kind: 'lab-task', lab: lesson.lab, goals: goals.act },
        }
      }
      case 'observe': {
        if (!lesson.lab || !goals?.observe.length)
          throw new Error(`${activity.id} has no supported comparison`)
        return {
          ...base,
          phase: 'observe',
          instruction: HANDS_ON_INSTRUCTION,
          interaction: {
            kind: 'observe',
            lab: lesson.lab,
            goals: goals.observe,
            readouts: goals.watch,
          },
        }
      }
      case 'debrief':
        return {
          ...base,
          phase: 'explain',
          // Same truthfulness rule (report 1.2): a section whose hands-on step is an attribution
          // sort has no image work to review.
          instruction:
            spec.act.kind === 'sort'
              ? 'Review the explanation and the evidence in this section. Then apply the principle to another situation.'
              : 'Review the explanation and the evidence from the image work. Then apply the principle to another situation.',
          interaction: { kind: 'explain', round: 0 },
          lookIn: { pane: 'steps', landmark: IN_STEPS.verdictAndChange },
        }
    }
  })
}

function buildSteps(
  sectionId: ImagingSectionId,
  inputs: readonly StepInput[],
  defaultStops: readonly ChainStopId[],
): readonly ImagingStageStep[] {
  return inputs.map((input, index) => ({
    id: input.activity.id,
    activity: input.activity,
    ordinal: index + 1,
    phase: input.phase,
    title: input.title,
    instruction: input.instruction,
    lookIn: input.lookIn,
    rationale: input.rationale,
    actionLabel: input.actionLabel,
    interaction: input.interaction,
    // Self-paced (PI-01): no step waits on an answer. A learner can move past any step, so the
    // shared stage's `after-prediction` gate is never set here.
    gate: 'open',
    suite: input.suite,
    stops: input.stops ?? defaultStops,
    expectedResponse: input.expectedResponse,
  }))
}

const lessonCache = new Map<ImagingSectionId, ImagingStageLesson>()

export function imagingStageLesson(sectionId: ImagingSectionId): ImagingStageLesson {
  const cached = lessonCache.get(sectionId)
  if (cached) return cached
  const lesson = imagingLesson(sectionId)
  const spec = imagingSectionSpec(sectionId)
  const steps = buildSteps(sectionId, buildInputs(sectionId), spec.chainStops)
  const index = peripheralImagingSectionIds.indexOf(sectionId)
  const built: ImagingStageLesson = {
    sectionId,
    title: lesson.title,
    minutes: lesson.minutes,
    index,
    total: peripheralImagingSectionIds.length,
    steps,
    predictionStepIndex: steps.findIndex(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
    ),
    transferStepIndex: steps.findIndex(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 1,
    ),
    spec,
    lesson,
    lifecycleActivityId: imagingActivityId(sectionId),
  }
  lessonCache.set(sectionId, built)
  return built
}

export function imagingStageLessons(): readonly ImagingStageLesson[] {
  return peripheralImagingSectionIds.map((sectionId) => imagingStageLesson(sectionId))
}

/** Pending independent surfaces only. Foundational teaching and labeled demonstrations are not answer keys. */
export function precommitAuthoredSurfaces(
  lesson: ImagingStageLesson,
): readonly { readonly where: string; readonly text: string }[] {
  return lesson.steps
    .filter((step) => step.interaction.kind === 'prediction')
    .flatMap((step) => [
      { where: `step ${step.ordinal} title`, text: step.title },
      { where: `step ${step.ordinal} instruction`, text: step.instruction },
    ])
}

export function validateImagingStageLessons(): readonly string[] {
  const errors: string[] = [...validateImagingLearningActivities()]
  for (const lesson of imagingStageLessons()) {
    const where = `Lesson ${lesson.sectionId}`
    if (lesson.predictionStepIndex < 0) errors.push(`${where} has no prediction step.`)
    if (lesson.transferStepIndex < 0) errors.push(`${where} has no transfer prediction.`)
    if (lesson.transferStepIndex <= lesson.predictionStepIndex)
      errors.push(`${where} puts the transfer before the prediction.`)
    const phases = lesson.steps.map((step) => step.phase)
    if (phases[0] !== 'recognize') errors.push(`${where} does not open on Recognize.`)
    if (phases.at(-1) !== 'transfer') errors.push(`${where} does not end on a transfer step.`)
    if (!phases.includes('act')) errors.push(`${where} has nothing to do.`)
    if (!phases.includes('explain')) errors.push(`${where} never explains.`)
    lesson.steps.forEach((step) => {
      const stepWhere = `${where} step ${step.ordinal}`
      errors.push(
        ...imagingLearnerCopyErrors(`${stepWhere} title`, step.title, { allowDigits: false }),
        ...imagingLearnerCopyErrors(`${stepWhere} instruction`, step.instruction),
        ...imagingLearnerCopyErrors(`${stepWhere} action`, step.actionLabel),
      )
      if (step.rationale)
        errors.push(...imagingLearnerCopyErrors(`${stepWhere} rationale`, step.rationale))
      errors.push(...stageStepLocationErrors(stepWhere, step.lookIn))
      errors.push(...imagingLearnerCopyErrors(`${stepWhere} look-in`, step.lookIn.landmark))
      if (step.lookIn.alsoLandmark)
        errors.push(...imagingLearnerCopyErrors(`${stepWhere} look-in`, step.lookIn.alsoLandmark))
      if (step.gate !== 'open') errors.push(`${stepWhere} waits on an answer.`)
      if (
        step.interaction.kind === 'prediction' &&
        step.interaction.round === 1 &&
        step.phase !== 'transfer'
      ) {
        errors.push(`${stepWhere} carries the transfer item outside a transfer step.`)
      }
      if (
        step.interaction.kind === 'prediction' &&
        step.interaction.chainTargets !== null &&
        step.suite.litStop !== null
      ) {
        errors.push(`${stepWhere} lights a stop while the pins are the answer.`)
      }
      if (step.suite.sectionId !== lesson.sectionId)
        errors.push(`${stepWhere} shows another section's suite.`)
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
    const stem = lesson.steps[lesson.predictionStepIndex]?.interaction
    if (stem && stem.kind === 'prediction') {
      for (const pattern of lesson.spec.precommitDenyPatterns) {
        if (pattern.test(stem.item.stem))
          errors.push(`${where} deny pattern ${pattern.source} matches its own prediction stem.`)
      }
    }
  }
  return errors
}

const lessonErrors = validateImagingStageLessons()
if (lessonErrors.length > 0) {
  throw new Error(`The imaging stage lessons are invalid:\n${lessonErrors.join('\n')}`)
}
