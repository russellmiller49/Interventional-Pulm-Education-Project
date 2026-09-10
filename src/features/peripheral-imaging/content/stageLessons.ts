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
import { imagingChainAnswerTargets, type ChainAnswerTarget } from './chainAnswerTargets'
import { chainStop, type ChainStopId } from './imagingChain'
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
import { suiteViewForStep } from './suiteViews'
import { precommitBlocks } from './teachingBlocks'

/**
 * The adapter: every section of the pathway as one ordered list of steps on the lesson stage.
 *
 * Nothing here is authored as a step by a component. The registries say what a section is — its
 * lesson, its items, its goals, its sort, its spec — and this file arranges them into the one
 * shape every section shares: Recognize, Predict, Act, Observe, Explain, then the transfer as a
 * second, shorter round. A section whose Act is a sort has no Observe; a walk carries its own
 * goal. Every step says which pane its work is done in, in the words the pane caption carries.
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
  commit: 'Commit this answer, on this card',
} as const

export const ON_SUITE = {
  scene: 'the image-formation map and its highlighted component',
  pins: 'the numbered labels on the image-formation map',
  controls: 'The controls, the dock under the scene',
  readouts: 'The readouts, beside the controls',
} as const

export const IN_TEACHING = {
  purpose: 'What this section is for',
  adds: 'What this section adds',
} as const

const CONTINUE = 'Continue'
const COMMIT = 'Commit this answer'

interface StepInput {
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
  return { kind: 'prediction', item, round, chainTargets: imagingChainAnswerTargets(item.id) }
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]*[.!?]/)
  return (match ? match[0] : text).trim()
}

function buildInputs(sectionId: ImagingSectionId): readonly StepInput[] {
  const lesson = imagingLesson(sectionId)
  const spec = imagingSectionSpec(sectionId)
  const items = imagingSectionItems(sectionId)
  const goals = imagingLabGoals(sectionId)
  const base = suiteViewForStep(sectionId)
  const inputs: StepInput[] = []

  inputs.push({
    phase: 'recognize',
    title: spec.recognizeTitle,
    instruction: `Read “${IN_TEACHING.purpose}” in the Teaching panel, then find the highlighted component on the image-formation map in the Simulator panel. ${lesson.recall.prompt}`,
    lookIn: {
      pane: 'teaching',
      landmark: IN_TEACHING.purpose,
      alsoPane: 'simulator',
      alsoLandmark: ON_SUITE.scene,
    },
    rationale: lesson.why,
    actionLabel: CONTINUE,
    interaction: { kind: 'read' },
    suite: base,
  })

  const predictionInteraction = prediction(items.prediction, 0)
  const chainAnswered = predictionInteraction.chainTargets !== null
  inputs.push({
    phase: 'predict',
    title: 'Decide before the suite shows it',
    instruction: chainAnswered
      ? 'Choose the component on the image-formation map beneath the scene in the Simulator panel, then commit on this card. The controls unlock once you have.'
      : 'Choose one answer below, then commit it. The controls unlock once you have.',
    lookIn: chainAnswered
      ? {
          pane: 'simulator',
          landmark: ON_SUITE.pins,
          alsoPane: 'steps',
          alsoLandmark: IN_STEPS.commit,
        }
      : { pane: 'steps', landmark: IN_STEPS.choices },
    actionLabel: COMMIT,
    interaction: predictionInteraction,
    suite: suiteViewForStep(sectionId, { chainAnswer: chainAnswered }),
  })

  if (spec.act.kind === 'walk') {
    if (!lesson.lab || !goals)
      throw new Error(`Section ${sectionId} walks without a lab or a goal.`)
    inputs.push({
      phase: 'act',
      title: 'Walk through image formation',
      instruction:
        'Step through the components of image formation on this card. At beam geometry, change the C-arm obliquity once in the Simulator panel and watch the X-ray path, the beam and the image move together.',
      lookIn: {
        pane: 'steps',
        landmark: IN_STEPS.walkCard,
        alsoPane: 'simulator',
        alsoLandmark: ON_SUITE.controls,
      },
      actionLabel: CONTINUE,
      interaction: { kind: 'walk', stops: spec.chainStops, lab: lesson.lab, goals: goals.act },
      suite: suiteViewForStep(sectionId, { litStop: spec.chainStops[0] }),
    })
  } else if (spec.act.kind === 'sort') {
    const sort = imagingSort(spec.act.sortId)
    inputs.push({
      phase: 'act',
      title: 'Place each one',
      instruction: sort.prompt,
      lookIn: { pane: 'steps', landmark: IN_STEPS.sortRows },
      actionLabel: 'Commit the set',
      interaction: { kind: 'sort', sort },
      suite: base,
    })
  } else {
    if (!lesson.lab || !goals) throw new Error(`Section ${sectionId} acts on a lab without goals.`)
    inputs.push({
      phase: 'act',
      title: 'Do it on the suite',
      instruction: `${lesson.labTask ? firstSentence(lesson.labTask) : 'Work the controls under the scene.'} This step is done when every item on this card is met.`,
      lookIn: { pane: 'simulator', landmark: ON_SUITE.controls },
      actionLabel: CONTINUE,
      interaction: { kind: 'lab-task', lab: lesson.lab, goals: goals.act },
      suite: base,
    })
    if (goals.observe.length > 0) {
      inputs.push({
        phase: 'observe',
        title: 'Read what changed',
        instruction:
          'Do the next thing this card lists, and read the readouts beside the controls as you do.',
        lookIn: { pane: 'simulator', landmark: ON_SUITE.readouts },
        actionLabel: CONTINUE,
        interaction: {
          kind: 'observe',
          lab: lesson.lab,
          goals: goals.observe,
          readouts: goals.watch,
        },
        suite: base,
      })
    }
  }

  inputs.push({
    phase: 'explain',
    title: 'Why it holds',
    instruction: `Read the verdict and the table of what changed on this card, then “${IN_TEACHING.adds}” in the Teaching panel.`,
    lookIn: {
      pane: 'steps',
      landmark: IN_STEPS.verdictAndChange,
      alsoPane: 'teaching',
      alsoLandmark: IN_TEACHING.adds,
    },
    rationale: spec.controlStrip.sentence,
    actionLabel: CONTINUE,
    interaction: { kind: 'explain', round: 0 },
    suite: base,
  })

  const transferInteraction = prediction(items.transfer, 1)
  const transferOnChain = transferInteraction.chainTargets !== null
  inputs.push({
    phase: 'transfer',
    title: 'Carry it forward',
    instruction: transferOnChain
      ? 'The same principle from an earlier section, in a different situation. Choose the component on the image-formation map beneath the scene, then commit on this card.'
      : 'The same principle from an earlier section, in a different situation. Choose one answer below and commit it.',
    lookIn: transferOnChain
      ? {
          pane: 'simulator',
          landmark: ON_SUITE.pins,
          alsoPane: 'steps',
          alsoLandmark: IN_STEPS.commit,
        }
      : { pane: 'steps', landmark: IN_STEPS.choices },
    actionLabel: COMMIT,
    interaction: transferInteraction,
    suite: suiteViewForStep(sectionId, { chainAnswer: transferOnChain }),
  })

  return inputs
}

function buildSteps(
  sectionId: ImagingSectionId,
  inputs: readonly StepInput[],
  defaultStops: readonly ChainStopId[],
): readonly ImagingStageStep[] {
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

/** The pre-commit surfaces of a lesson, as authored text: everything at or before the prediction. */
export function precommitAuthoredSurfaces(
  lesson: ImagingStageLesson,
): readonly { readonly where: string; readonly text: string }[] {
  const surfaces: { where: string; text: string }[] = [
    { where: 'title', text: lesson.title },
    { where: 'objective', text: lesson.spec.objective },
    { where: 'new concept', text: lesson.spec.newConcept },
    { where: 'increment', text: lesson.spec.incrementSentence },
    { where: 'why', text: lesson.lesson.why },
    { where: 'recall prompt', text: lesson.lesson.recall.prompt },
  ]
  for (const block of precommitBlocks(lesson.lesson)) {
    surfaces.push({ where: `block "${block.title}" title`, text: block.title })
    surfaces.push({ where: `block "${block.title}" body`, text: block.body })
    for (const point of block.points ?? [])
      surfaces.push({ where: `block "${block.title}" point`, text: point })
  }
  for (const stopId of lesson.spec.stopCardsBeforeCommit === false ? [] : lesson.spec.chainStops) {
    const stop = chainStop(stopId)
    surfaces.push(
      { where: `stop ${stop.id} analogy`, text: stop.analogy },
      { where: `stop ${stop.id} precise`, text: stop.precise },
      ...stop.checklist.map((item) => ({ where: `stop ${stop.id} checklist`, text: item })),
    )
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
      surfaces.push({ where: `step ${step.ordinal} stem`, text: step.interaction.item.stem })
    }
  })
  return surfaces
}

export function validateImagingStageLessons(): readonly string[] {
  const errors: string[] = []
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
    lesson.steps.forEach((step, index) => {
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
      const expectedGate = index > lesson.predictionStepIndex ? 'after-prediction' : 'open'
      if (step.gate !== expectedGate) errors.push(`${stepWhere} has the wrong gate.`)
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
