import {
  type StageLessonBase,
  type StagePhase,
  type StageStepBase,
  type StageStepLocation,
} from '@/features/learning-module/stage/stageModel'

import type { ScopeGoal, ScopeMetricId, ScopeViewSpec } from '../components/scope/types'
import { scopeViewErrors } from '../engine/scope/scopeViewErrors'
import { bronchLearnerCopyErrors } from './learnerCopy'
import { fiveControlsLearnInputs } from './fiveControlsLearn'
import type { BronchLearnUnit } from './learnUnit'
import { COURSE_FLOWS, activityForChunk, type CourseChunk, type CourseActivity } from './courseFlow'
import { inspectionReport } from '../engine/inspectionReport'
import {
  bronchActivityId,
  bronchSection,
  BRONCH_SECTION_IDS,
  type BronchSectionId,
} from './pathway'
import { bronchSectionItems, type BronchStageItem } from './stageItems'
import type {
  BronchIdentify,
  BronchLedger,
  BronchReport,
  BronchScenario,
  BronchSectionDefinition,
  BronchSequence,
  BronchSort,
  BronchWorkspace,
} from './types'

/** Section-authored sequences adapt existing content and engines to the course host.
 * Presentation, disclosure, response identity and engine phases remain separate. */
export type BronchStageInteraction =
  | { readonly kind: 'read' }
  | { readonly kind: 'prediction'; readonly stage: BronchStageItem; readonly round: 0 | 1 }
  | {
      readonly kind: 'scope-task'
      readonly view: ScopeViewSpec
      readonly goals: readonly ScopeGoal[]
    }
  | {
      readonly kind: 'observe'
      readonly view: ScopeViewSpec
      readonly goals: readonly ScopeGoal[]
      readonly readouts: readonly ScopeMetricId[]
    }
  | { readonly kind: 'sort'; readonly sort: BronchSort }
  | { readonly kind: 'identify'; readonly identify: BronchIdentify }
  | { readonly kind: 'sequence'; readonly sequence: BronchSequence }
  | { readonly kind: 'ledger'; readonly ledger: BronchLedger }
  | { readonly kind: 'report'; readonly report: BronchReport }
  | { readonly kind: 'scenario'; readonly scenario: BronchScenario }
  | { readonly kind: 'explain' }

export interface BronchStageStep extends StageStepBase<BronchStageInteraction> {
  readonly lookIn: StageStepLocation
  /** The existing tool or media needed by the current authored task. */
  readonly workspace: BronchWorkspace
  readonly learn?: BronchLearnUnit
  readonly course?: CourseChunk
  readonly activity?: CourseActivity
}

export interface BronchStageLesson extends StageLessonBase<BronchStageStep> {
  readonly sectionId: BronchSectionId
  readonly section: BronchSectionDefinition
  readonly transferStepIndex: number
  readonly lifecycleActivityId: string
}

const CONTINUE = 'Continue'
const COMMIT = 'Submit this answer'

/** The words the Now card uses for each Act, so the instruction and the card agree. */
export const ACT_ACTION_LABELS = {
  sort: 'Submit the set',
  identify: 'Submit the names',
  sequence: 'Submit the order',
  ledger: CONTINUE,
  report: CONTINUE,
  scenario: CONTINUE,
  'scope-lab': CONTINUE,
} as const

export interface StepInput {
  readonly id?: string
  readonly phase: StagePhase
  readonly title: string
  readonly instruction: string
  readonly lookIn: StageStepLocation
  readonly rationale?: string
  readonly actionLabel: string
  readonly interaction: BronchStageInteraction
  readonly workspace: BronchWorkspace
  readonly learn?: BronchLearnUnit
  readonly course?: CourseChunk
  readonly activity?: CourseActivity
}

function actInteraction(section: BronchSectionDefinition): BronchStageInteraction {
  const act = section.act
  switch (act.kind) {
    case 'scope-lab':
      return { kind: 'scope-task', view: act.view, goals: act.goals }
    case 'sort':
      return { kind: 'sort', sort: act.sort }
    case 'identify':
      return { kind: 'identify', identify: act.identify }
    case 'sequence':
      return { kind: 'sequence', sequence: act.sequence }
    case 'ledger':
      return { kind: 'ledger', ledger: act.ledger }
    case 'report':
      return { kind: 'report', report: act.report }
    case 'scenario':
      return { kind: 'scenario', scenario: act.scenario }
  }
}

function actWorkspace(section: BronchSectionDefinition): BronchWorkspace {
  const act = section.act
  if (act.kind === 'scope-lab') return { kind: 'scope', view: act.view }
  if (act.kind === 'scenario') {
    return {
      kind: 'monitor',
      readings: act.scenario.frames[0]?.readings ?? [],
      caption: act.scenario.boundary,
    }
  }
  return section.workspace
}

function buildInputs(section: BronchSectionDefinition): readonly StepInput[] {
  if (section.id === 'five-controls') return fiveControlsLearnInputs()
  const flow = COURSE_FLOWS[section.id]
  if (!flow) throw new Error(`Section ${section.id} has no authored course flow.`)
  return flow.map((chunk) => {
    const items = bronchSectionItems(section.id)
    const isCheck = chunk.kind === 'check' || chunk.kind === 'transfer'
    const stage = chunk.kind === 'transfer' ? items.transfer : items.prediction
    const act = section.act
    const observe = act.kind === 'scope-lab' ? act.observe : undefined
    const view = observe?.view ?? (act.kind === 'scope-lab' ? act.view : null)
    const interaction: BronchStageInteraction = isCheck
      ? { kind: 'prediction', stage, round: chunk.kind === 'transfer' ? 1 : 0 }
      : chunk.learnerRecord
        ? { kind: 'report', report: inspectionReport({ inspectionSnapshot: null }) }
        : chunk.kind === 'practice'
          ? actInteraction(section)
          : chunk.kind === 'observe' && view && observe
            ? {
                kind: 'observe',
                view,
                goals: observe.goals,
                readouts: observe.readouts ?? view.readouts ?? [],
              }
            : { kind: chunk.kind === 'debrief' ? 'explain' : 'read' }
    const workspace: BronchWorkspace =
      chunk.kind === 'practice'
        ? actWorkspace(section)
        : chunk.kind === 'observe' && view
          ? { kind: 'scope', view }
          : isCheck && stage.choiceAirways
            ? { kind: 'map', lit: [], caption: 'Choose an airway from the map.' }
            : section.workspace
    return {
      id: chunk.id,
      phase:
        chunk.kind === 'teach'
          ? 'recognize'
          : chunk.kind === 'practice'
            ? 'act'
            : chunk.kind === 'check'
              ? 'predict'
              : chunk.kind === 'debrief'
                ? 'explain'
                : chunk.kind,
      title: chunk.title,
      instruction:
        chunk.instruction ??
        (isCheck
          ? 'Consider the situation and choose an answer. Feedback appears after you submit.'
          : chunk.kind === 'debrief'
            ? 'Review the reasoning and the limits of this exercise before continuing.'
            : 'Read the explanation with its example, then continue when you are ready to apply it.'),
      lookIn: { pane: 'steps', landmark: 'the current lesson activity' },
      actionLabel: isCheck
        ? COMMIT
        : chunk.kind === 'practice'
          ? ACT_ACTION_LABELS[section.act.kind]
          : CONTINUE,
      interaction,
      workspace,
      course: chunk,
      activity: activityForChunk(chunk),
    }
  })
}

function buildSteps(
  sectionId: BronchSectionId,
  inputs: readonly StepInput[],
): readonly BronchStageStep[] {
  return inputs.map((input, index) => ({
    id: input.id
      ? `${sectionId}-flow-v1-${input.id}`
      : input.learn
        ? `${sectionId}-learn-${input.learn.id}`
        : `${sectionId}-${index + 1}-${input.phase}`,
    ordinal: index + 1,
    phase: input.phase,
    title: input.title,
    instruction: input.instruction,
    lookIn: input.lookIn,
    rationale: input.rationale,
    actionLabel: input.actionLabel,
    interaction: input.interaction,
    gate: 'open',
    workspace: input.workspace,
    learn: input.learn,
    course: input.course,
    activity:
      input.activity ??
      (input.learn
        ? input.learn.support === 'check' || input.learn.support === 'transfer'
          ? 'independent-check'
          : input.interaction.kind === 'read'
            ? 'teaching'
            : 'guided-practice'
        : undefined),
  }))
}

const lessonCache = new Map<BronchSectionId, BronchStageLesson>()

export function bronchStageLesson(sectionId: BronchSectionId): BronchStageLesson {
  const cached = lessonCache.get(sectionId)
  if (cached) return cached
  const section = bronchSection(sectionId)
  const steps = buildSteps(sectionId, buildInputs(section))
  const index = BRONCH_SECTION_IDS.indexOf(sectionId)
  const built: BronchStageLesson = {
    sectionId,
    title: section.title,
    minutes: section.minutes,
    index,
    total: BRONCH_SECTION_IDS.length,
    steps,
    predictionStepIndex: steps.findIndex(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 0,
    ),
    transferStepIndex: steps.findIndex((step) => step.phase === 'transfer'),
    section,
    lifecycleActivityId: bronchActivityId(sectionId),
  }
  lessonCache.set(sectionId, built)
  return built
}

export function bronchStageLessons(): readonly BronchStageLesson[] {
  return BRONCH_SECTION_IDS.map((sectionId) => bronchStageLesson(sectionId))
}

/** The scope view a step shows, if any: its own task view, or the section workspace's. */
export function scopeViewOfStep(step: BronchStageStep): ScopeViewSpec | null {
  const { interaction } = step
  if (interaction.kind === 'scope-task' || interaction.kind === 'observe') return interaction.view
  return step.workspace.kind === 'scope' ? step.workspace.view : null
}

/** Only pending checks are disclosure-restricted. Earlier worked teaching is intentional. */
export function precommitAuthoredSurfaces(
  lesson: BronchStageLesson,
): readonly { readonly where: string; readonly text: string }[] {
  return [
    { where: 'title', text: lesson.title },
    ...lesson.steps
      .filter((step) => step.activity === 'independent-check')
      .flatMap((step) => [
        { where: `${step.id} check title`, text: step.title },
        { where: `${step.id} check instruction`, text: step.instruction },
        { where: `${step.id} check teaching`, text: step.learn?.paragraphs.join(' ') ?? '' },
      ]),
  ]
}

export function validateBronchStageLessons(): readonly string[] {
  const errors: string[] = []
  for (const lesson of bronchStageLessons()) {
    const where = `Lesson ${lesson.sectionId}`
    if (lesson.predictionStepIndex < 0) errors.push(`${where} has no prediction step.`)
    if (lesson.transferStepIndex < 0) errors.push(`${where} has no transfer prediction.`)
    if (lesson.transferStepIndex <= lesson.predictionStepIndex)
      errors.push(`${where} puts the transfer before the prediction.`)
    if (lesson.steps[0]?.activity !== 'teaching')
      errors.push(`${where} must introduce the task before a check.`)
    if (!lesson.steps.some((step) => step.activity === 'guided-practice'))
      errors.push(`${where} has no learner application.`)
    if (new Set(lesson.steps.map((step) => step.id)).size !== lesson.steps.length)
      errors.push(`${where} repeats a step identity.`)
    {
      const assigned = lesson.steps.flatMap((step) => step.course?.blocks ?? [])
      for (const block of lesson.section.blocks)
        if (!assigned.includes(block.id)) errors.push(`${where} drops source block ${block.id}.`)
      for (const id of assigned)
        if (!lesson.section.blocks.some((block) => block.id === id))
          errors.push(`${where} names missing block ${id}.`)
    }
    if (
      lesson.sectionId !== 'five-controls' &&
      lesson.section.act.kind === 'scope-lab' &&
      lesson.section.act.observe &&
      !lesson.steps.some((step) => step.interaction.kind === 'observe')
    )
      errors.push(`${where} drops its authored observation task.`)
    lesson.steps.forEach((step) => {
      const stepWhere = `${where} step ${step.ordinal}`
      errors.push(
        ...bronchLearnerCopyErrors(`${stepWhere} title`, step.title, { allowDigits: false }),
        ...bronchLearnerCopyErrors(`${stepWhere} instruction`, step.instruction),
        ...bronchLearnerCopyErrors(`${stepWhere} action`, step.actionLabel),
      )
      if (step.rationale)
        errors.push(...bronchLearnerCopyErrors(`${stepWhere} rationale`, step.rationale))
      if (!step.course || !step.activity)
        errors.push(`${stepWhere} lacks a presentation or disclosure contract.`)
      if (step.gate !== 'open') errors.push(`${stepWhere} gates teaching behind a guess.`)
      if (
        step.activity === 'independent-check' &&
        (step.course?.blocks.length || step.course?.visual !== 'none')
      )
        errors.push(`${stepWhere} carries worked teaching into a pending check.`)
      if (
        step.interaction.kind === 'prediction' &&
        step.interaction.round === 1 &&
        step.phase !== 'transfer'
      ) {
        errors.push(`${stepWhere} carries the transfer item outside a transfer step.`)
      }
      const view = scopeViewOfStep(step)
      if (view) {
        if (view.sectionId !== lesson.sectionId)
          errors.push(`${stepWhere} shows another section's scope view.`)
        for (const error of scopeViewErrors(view)) errors.push(`${stepWhere}: ${error}`)
      }
      if (step.interaction.kind === 'scope-task' || step.interaction.kind === 'observe') {
        if (step.interaction.goals.length === 0) errors.push(`${stepWhere} waits on no goal.`)
      }
    })
    for (const surface of precommitAuthoredSurfaces(lesson)) {
      if (surface.where.endsWith('stem') || surface.where.endsWith('situation')) continue
      for (const pattern of lesson.section.precommitDenyPatterns) {
        if (pattern.test(surface.text)) {
          errors.push(
            `${where} ${surface.where} names the answer (${pattern.source}): "${surface.text}"`,
          )
        }
      }
    }
    const stem = lesson.steps[lesson.predictionStepIndex]?.interaction
    if (stem && stem.kind === 'prediction') {
      for (const pattern of lesson.section.precommitDenyPatterns) {
        if (pattern.test(stem.stage.item.stem))
          errors.push(`${where} deny pattern ${pattern.source} matches its own prediction stem.`)
      }
    }
  }
  return errors
}

const lessonErrors = validateBronchStageLessons()
if (lessonErrors.length > 0) {
  throw new Error(
    `The Bronchoscopy Foundations stage lessons are invalid:\n${lessonErrors.join('\n')}`,
  )
}
