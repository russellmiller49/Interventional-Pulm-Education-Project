import {
  stageStepLocationErrors,
  type StageLessonBase,
  type StagePhase,
  type StageStepBase,
  type StageStepLocation,
} from '@/features/learning-module/stage/stageModel'

import type { ScopeGoal, ScopeMetricId, ScopeViewSpec } from '../components/scope/types'
import { scopeViewErrors } from '../engine/scope/scopeViewErrors'
import { STEPS_LANDMARKS, TEACHING_LANDMARKS } from './landmarks'
import { bronchLearnerCopyErrors } from './learnerCopy'
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

/**
 * The adapter: every section as one ordered list of steps on the lesson stage.
 *
 * Nothing here is authored as a step by a component. A section definition says what it is — its
 * texts, its items, its Act, its workspace — and this file arranges them into the one shape every
 * section shares: Recognize, Predict, Act, [Observe], Explain, then the transfer as a second,
 * shorter round. A section whose Act is a scope lab with an `observe` gets the Observe step; no
 * other Act does. Every step says which pane its work is done in, in the words the pane carries.
 */
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
  /** What the Simulator panel shows while this step is current. */
  readonly workspace: BronchWorkspace
}

export interface BronchStageLesson extends StageLessonBase<BronchStageStep> {
  readonly sectionId: BronchSectionId
  readonly section: BronchSectionDefinition
  readonly transferStepIndex: number
  readonly lifecycleActivityId: string
}

const CONTINUE = 'Continue'
const COMMIT = 'Commit this answer'

/** The words the Now card uses for each Act, so the instruction and the card agree. */
export const ACT_ACTION_LABELS = {
  sort: 'Commit the set',
  identify: 'Commit the names',
  sequence: 'Commit the order',
  ledger: CONTINUE,
  report: CONTINUE,
  scenario: CONTINUE,
  'scope-lab': CONTINUE,
} as const

interface StepInput {
  readonly phase: StagePhase
  readonly title: string
  readonly instruction: string
  readonly lookIn: StageStepLocation
  readonly rationale?: string
  readonly actionLabel: string
  readonly interaction: BronchStageInteraction
  readonly workspace: BronchWorkspace
}

function predictionInstruction(stage: BronchStageItem, section: BronchSectionDefinition): string {
  if (stage.choiceAirways) {
    return 'Read the situation on this card, choose the airway on the airway map in the Simulator panel, then commit on this card.'
  }
  const unlock =
    section.workspace.kind === 'scope' || section.act.kind === 'scope-lab'
      ? ' The scope controls unlock once you have.'
      : ''
  return `Read the situation, choose one answer on this card, then commit it.${unlock}`
}

function predictionLookIn(stage: BronchStageItem): StageStepLocation {
  return stage.choiceAirways
    ? {
        pane: 'simulator',
        landmark: 'the airway map',
        alsoPane: 'steps',
        alsoLandmark: STEPS_LANDMARKS.decision,
      }
    : { pane: 'steps', landmark: STEPS_LANDMARKS.choices }
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
  const items = bronchSectionItems(section.id)
  const base = section.workspace
  const inputs: StepInput[] = []

  inputs.push({
    phase: 'recognize',
    title: section.recognizeTitle,
    instruction: section.steps.recognize.instruction,
    lookIn: section.steps.recognize.lookIn,
    rationale: section.why,
    actionLabel: CONTINUE,
    interaction: { kind: 'read' },
    workspace: base,
  })

  inputs.push({
    phase: 'predict',
    title: 'Decide first',
    instruction: predictionInstruction(items.prediction, section),
    lookIn: predictionLookIn(items.prediction),
    actionLabel: COMMIT,
    interaction: { kind: 'prediction', stage: items.prediction, round: 0 },
    workspace: base,
  })

  inputs.push({
    phase: 'act',
    title: section.steps.act.title,
    instruction: section.steps.act.instruction,
    lookIn: section.steps.act.lookIn,
    actionLabel: ACT_ACTION_LABELS[section.act.kind],
    interaction: actInteraction(section),
    workspace: actWorkspace(section),
  })

  if (section.act.kind === 'scope-lab' && section.act.observe) {
    const observe = section.act.observe
    const texts = section.steps.observe
    if (!texts) throw new Error(`Section ${section.id} observes without a step text.`)
    const view = observe.view ?? section.act.view
    inputs.push({
      phase: 'observe',
      title: texts.title,
      instruction: texts.instruction,
      lookIn: texts.lookIn,
      actionLabel: CONTINUE,
      interaction: {
        kind: 'observe',
        view,
        goals: observe.goals,
        readouts: observe.readouts ?? view.readouts ?? [],
      },
      workspace: { kind: 'scope', view },
    })
  }

  inputs.push({
    phase: 'explain',
    title: section.steps.explain.title,
    instruction: section.steps.explain.instruction,
    lookIn: {
      pane: 'steps',
      landmark: STEPS_LANDMARKS.verdict,
      alsoPane: 'teaching',
      alsoLandmark: TEACHING_LANDMARKS.adds,
    },
    rationale: section.controlStrip.sentence,
    actionLabel: CONTINUE,
    interaction: { kind: 'explain' },
    workspace: section.act.kind === 'scope-lab' ? actWorkspace(section) : base,
  })

  const transfer = items.transfer
  inputs.push({
    phase: 'transfer',
    title: 'Carry it forward',
    instruction: transfer.retrievesFrom
      ? 'The same principle from an earlier section, in a different situation. Choose one answer on this card and commit it.'
      : 'The same principle, in a different situation. Choose one answer on this card and commit it.',
    lookIn: predictionLookIn(transfer),
    rationale: transfer.transferVariant,
    actionLabel: COMMIT,
    interaction: { kind: 'prediction', stage: transfer, round: 1 },
    workspace: section.act.kind === 'scope-lab' ? actWorkspace(section) : base,
  })

  return inputs
}

function buildSteps(
  sectionId: BronchSectionId,
  inputs: readonly StepInput[],
): readonly BronchStageStep[] {
  const predictionIndex = inputs.findIndex(
    (input) => input.interaction.kind === 'prediction' && input.interaction.round === 0,
  )
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
    gate: predictionIndex >= 0 && index > predictionIndex ? 'after-prediction' : 'open',
    workspace: input.workspace,
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
    transferStepIndex: steps.findIndex(
      (step) => step.interaction.kind === 'prediction' && step.interaction.round === 1,
    ),
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

/** The pre-commit surfaces of a lesson, as authored text: everything at or before the prediction. */
export function precommitAuthoredSurfaces(
  lesson: BronchStageLesson,
): readonly { readonly where: string; readonly text: string }[] {
  const { section } = lesson
  const surfaces: { where: string; text: string }[] = [
    { where: 'title', text: section.title },
    { where: 'short title', text: section.shortTitle },
    { where: 'objective', text: section.objective },
    { where: 'why', text: section.why },
    { where: 'clinical question', text: section.clinicalQuestion },
  ]
  for (const block of section.blocks) {
    if (block.kind === 'after-commitment' || block.kind === 'boundary') continue
    surfaces.push({ where: `block "${block.heading}" heading`, text: block.heading })
    surfaces.push({ where: `block "${block.heading}" body`, text: block.body })
    for (const point of block.points ?? [])
      surfaces.push({ where: `block "${block.heading}" point`, text: point })
    if (block.pointsLabel)
      surfaces.push({ where: `block "${block.heading}" points label`, text: block.pointsLabel })
  }
  if (section.workspace.kind !== 'scope')
    surfaces.push({ where: 'workspace caption', text: section.workspace.caption })
  if (section.workspace.kind === 'monitor') {
    for (const reading of section.workspace.readings)
      surfaces.push({ where: `monitor ${reading.channel}`, text: reading.words })
  }
  lesson.steps.forEach((step, index) => {
    if (index > lesson.predictionStepIndex && lesson.predictionStepIndex >= 0) return
    surfaces.push(
      { where: `step ${step.ordinal} title`, text: step.title },
      { where: `step ${step.ordinal} instruction`, text: step.instruction },
      { where: `step ${step.ordinal} action`, text: step.actionLabel },
      { where: `step ${step.ordinal} look-in`, text: step.lookIn.landmark },
    )
    if (step.rationale)
      surfaces.push({ where: `step ${step.ordinal} rationale`, text: step.rationale })
    if (step.lookIn.alsoLandmark)
      surfaces.push({ where: `step ${step.ordinal} look-in`, text: step.lookIn.alsoLandmark })
    if (step.interaction.kind === 'prediction') {
      surfaces.push({ where: `step ${step.ordinal} stem`, text: step.interaction.stage.item.stem })
      if (step.interaction.stage.situation)
        surfaces.push({
          where: `step ${step.ordinal} situation`,
          text: step.interaction.stage.situation,
        })
    }
  })
  return surfaces
}

export function validateBronchStageLessons(): readonly string[] {
  const errors: string[] = []
  for (const lesson of bronchStageLessons()) {
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
    if (
      phases.includes('observe') !==
      (lesson.section.act.kind === 'scope-lab' && !!lesson.section.act.observe)
    )
      errors.push(`${where} observes without a scope lab that asks it to, or the reverse.`)
    lesson.steps.forEach((step, index) => {
      const stepWhere = `${where} step ${step.ordinal}`
      errors.push(
        ...bronchLearnerCopyErrors(`${stepWhere} title`, step.title, { allowDigits: false }),
        ...bronchLearnerCopyErrors(`${stepWhere} instruction`, step.instruction),
        ...bronchLearnerCopyErrors(`${stepWhere} action`, step.actionLabel),
      )
      if (step.rationale)
        errors.push(...bronchLearnerCopyErrors(`${stepWhere} rationale`, step.rationale))
      errors.push(...stageStepLocationErrors(stepWhere, step.lookIn))
      const expectedGate = index > lesson.predictionStepIndex ? 'after-prediction' : 'open'
      if (step.gate !== expectedGate) errors.push(`${stepWhere} has the wrong gate.`)
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
