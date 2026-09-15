import type { HemodynamicsStageLesson, HemodynamicsStageStep } from '../../content/stageLessons'
import { goalsMet } from '../../engine/stageRuntime'
import type { HemodynamicSimulationState } from '../../engine/types'
import type { ComponentSelection } from '../../content/introductoryTeaching'

/**
 * Everything a learner has answered or done on a section, apart from the engine's own state.
 *
 * Nothing here is persisted. A reload starts the section at its first step; the only thing written
 * is the self-paced record (sections opened and marked reviewed).
 *
 * Self-paced (HD-01) separates two things the stage used to fuse. How far the learner has *moved*
 * (`confirmed`) is theirs to choose: any step can be left without its question answered or its
 * actions done. What the learner has *performed* (`performedIds`) is only ever simulation work the
 * engine can show — goals met by the learner's own actions on the step, a walk walked to its end —
 * recorded at the moment they moved past it. Skipping a step never adds it, and answers are never
 * counted as performance.
 */
export interface StageCommitments {
  /** Step id (or `stepId:key` for the wedge questions) → the choice the learner checked. */
  readonly choices: Readonly<Record<string, string>>
  /** Question keys whose explanation the learner opened without answering. Records no answer. */
  readonly explanationsShown: readonly string[]
  /** Row id → origin id, once the learner checked their placements. */
  readonly sort: Readonly<Record<string, string>> | null
  /** Whether the learner opened the worked sort without placing rows. */
  readonly sortShown: boolean
  readonly walkDone: boolean
  /** The highest step the learner has moved past — with or without doing it. */
  readonly confirmed: number
  /** Steps whose simulation work the learner performed before moving past them. Exact, not a prefix. */
  readonly performedIds: readonly string[]
  /** Whether the provenance question was answered or its explanation opened (unlocks the method model). */
  readonly provenanceResolved: boolean
  readonly finished: boolean
  /** `stepId:numbering` → the regions checked in this visit, one list per numbering (HD-02). */
  readonly componentSelections: Readonly<Record<string, readonly ComponentSelection[]>>
}

export function emptyCommitments(): StageCommitments {
  return {
    choices: {},
    explanationsShown: [],
    sort: null,
    sortShown: false,
    walkDone: false,
    confirmed: -1,
    performedIds: [],
    provenanceResolved: false,
    finished: false,
    componentSelections: {},
  }
}

export const WEDGE_PLAUSIBILITY_KEY = 'wedge-plausibility'
export const WEDGE_RETURN_KEY = 'wedge-return'

/**
 * Whether the learner's own simulation work on this step is done, right now.
 *
 * Only steps that ask for work on the simulator can be performed: a Recognize or Explain read, a
 * question, a sort, a drill or a worked comparison cannot, whatever was answered. A step's goals
 * count only when the learner met them — a goal the step's opening state already satisfied is not
 * work (a learner who jumps to a task whose authored state happens to meet it has done nothing), so
 * `baseline` is the state the step opened on.
 */
export function simulationWorkPerformed(
  step: HemodynamicsStageStep,
  state: HemodynamicSimulationState,
  commitments: StageCommitments,
  baseline: HemodynamicSimulationState | undefined,
): boolean {
  const interaction = step.interaction
  switch (interaction.kind) {
    case 'walk':
      return commitments.walkDone
    case 'simulator-task':
    case 'observe': {
      if (interaction.goals.length === 0) return false
      if (!goalsMet(interaction.goals, state)) return false
      return !(baseline && goalsMet(interaction.goals, baseline))
    }
    default:
      return false
  }
}

/** Whether the step has a question or sort the learner checked in this session. */
export function stepAnswered(step: HemodynamicsStageStep, commitments: StageCommitments): boolean {
  switch (step.interaction.kind) {
    case 'prediction':
      return commitments.choices[step.id] !== undefined
    case 'sort':
      return commitments.sort !== null
    default:
      return false
  }
}

export interface StageProgress {
  readonly performedIds: ReadonlySet<string>
  /** The step the learner is on: the one after the furthest step they moved past. */
  readonly liveIndex: number
  readonly predictionAnswered: boolean
  readonly transferAnswered: boolean
}

/** Where the learner is, from the commitments. Nothing here depends on an answer being right. */
export function deriveStageProgress(
  lesson: HemodynamicsStageLesson,
  commitments: StageCommitments,
): StageProgress {
  const predictionStep = lesson.steps[lesson.predictionStepIndex]
  const transferStep = lesson.steps[lesson.transferStepIndex]
  return {
    performedIds: new Set(commitments.performedIds),
    liveIndex: Math.max(0, Math.min(commitments.confirmed + 1, lesson.steps.length - 1)),
    predictionAnswered: predictionStep
      ? commitments.choices[predictionStep.id] !== undefined
      : false,
    transferAnswered: transferStep ? commitments.choices[transferStep.id] !== undefined : false,
  }
}

/**
 * The state a step should open on when the learner arrives at it by anything other than one Continue.
 *
 * Walking forward one step loads only that step's own entry state. Jumping from step `from` to a later
 * `target` loads the last entry state among the steps jumped into, exactly what walking forward
 * without acting would have loaded. Re-entering an earlier step loads the nearest entry state at or
 * before it, or the section's opening state. Nothing is performed on the way.
 */
export function entryStateFor(
  lesson: HemodynamicsStageLesson,
  target: number,
  from: number,
): HemodynamicSimulationState | null {
  const lowest = target > from ? from + 1 : 0
  for (let index = target; index >= lowest; index -= 1) {
    const entry = lesson.steps[index]?.entryState
    if (entry) return entry()
  }
  return target > from ? null : lesson.runtime.initial()
}
