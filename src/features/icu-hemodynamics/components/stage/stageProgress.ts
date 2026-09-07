import type { HemodynamicsStageLesson, HemodynamicsStageStep } from '../../content/stageLessons'
import { goalsMet } from '../../engine/stageRuntime'
import type { HemodynamicSimulationState } from '../../engine/types'

/**
 * Everything a learner has committed or done on a section, apart from the engine's own state.
 *
 * Nothing here is persisted. A reload starts the section at its first step; the completion
 * record is the only thing written.
 */
export interface StageCommitments {
  /** Step id → the committed choice id, for prediction steps and the wedge commitments. */
  readonly choices: Readonly<Record<string, string>>
  /** Row id → origin id, once the sort is committed. */
  readonly sort: Readonly<Record<string, string>> | null
  readonly walkDone: boolean
  /** The highest step the learner has explicitly moved past. */
  readonly confirmed: number
  /**
   * The steps whose work was done when the learner moved past them. Sticky on purpose: a later
   * step may load a new state on the engine (a transfer patient), and a step performed on the old
   * one stays performed.
   */
  readonly performedIds: readonly string[]
  readonly provenanceResolved: boolean
  readonly disagreementResolved: boolean
  readonly derivedSeparated: boolean
  readonly derivedDisagreementPreserved: boolean
  readonly derivedThresholdResolved: boolean
  readonly derivedTransferDone: boolean
  readonly finished: boolean
}

export function emptyCommitments(): StageCommitments {
  return {
    choices: {},
    sort: null,
    walkDone: false,
    confirmed: -1,
    performedIds: [],
    provenanceResolved: false,
    disagreementResolved: false,
    derivedSeparated: false,
    derivedDisagreementPreserved: false,
    derivedThresholdResolved: false,
    derivedTransferDone: false,
    finished: false,
  }
}

export const WEDGE_PLAUSIBILITY_KEY = 'wedge-plausibility'
export const WEDGE_RETURN_KEY = 'wedge-return'

/** Whether a step's own work is done, regardless of whether the learner has moved past it. */
export function stepWorkDone(
  step: HemodynamicsStageStep,
  index: number,
  state: HemodynamicSimulationState,
  commitments: StageCommitments,
): boolean {
  const interaction = step.interaction
  switch (interaction.kind) {
    case 'read':
    case 'explain':
      return commitments.confirmed >= index
    case 'walk':
      return commitments.walkDone && commitments.confirmed >= index
    case 'prediction':
      return commitments.choices[step.id] !== undefined
    case 'sort':
      return commitments.sort !== null
    case 'simulator-task':
      return goalsMet(interaction.goals, state)
    case 'observe': {
      const goals = goalsMet(interaction.goals, state)
      const commitmentsDone = interaction.commitments.every((kind) =>
        kind === 'plausibility'
          ? commitments.choices[`${step.id}:${WEDGE_PLAUSIBILITY_KEY}`] !== undefined
          : commitments.choices[`${step.id}:${WEDGE_RETURN_KEY}`] !== undefined,
      )
      const provenance = !interaction.provenance || commitments.provenanceResolved
      return goals && commitmentsDone && provenance
    }
    case 'provenance-drill':
      return commitments.derivedSeparated
    case 'derived-workbench':
      return (
        goalsMet(
          [
            { type: 'check', id: 'derived-dependency-chain-validated' },
            { type: 'check', id: 'derived-withheld-for-input-validity' },
            { type: 'check', id: 'derived-selective-invalidation-preserved' },
            { type: 'check', id: 'derived-flow-method-traced' },
          ],
          state,
        ) &&
        commitments.derivedDisagreementPreserved &&
        commitments.derivedThresholdResolved
      )
    case 'derived-transfer':
      return commitments.derivedTransferDone
    case 'disagreement':
      return commitments.disagreementResolved
    default:
      return false
  }
}

export interface StageProgress {
  /** The furthest step whose work is done and that the learner has moved past. */
  readonly furthestPerformedIndex: number
  readonly performedIds: ReadonlySet<string>
  /** The step the learner should be on: the first whose work is not done, held back by Continue. */
  readonly liveIndex: number
  readonly predictionCommitted: boolean
  readonly transferCommitted: boolean
}

/**
 * Where the learner is, from the commitments.
 *
 * A step counts as performed once its work was done and the learner pressed Continue on it (or
 * committed, for a prediction); the host records that moment, so a later change to the engine's
 * state cannot un-perform it. The live step is the first not yet performed. The prediction gate
 * is a property of the commitments, not of the index.
 */
export function deriveStageProgress(
  lesson: HemodynamicsStageLesson,
  state: HemodynamicSimulationState,
  commitments: StageCommitments,
): StageProgress {
  void state
  const performedIds = new Set<string>()
  let furthest = -1
  for (let index = 0; index < lesson.steps.length; index += 1) {
    const step = lesson.steps[index]
    if (!commitments.performedIds.includes(step.id)) break
    performedIds.add(step.id)
    furthest = index
  }
  const predictionStep = lesson.steps[lesson.predictionStepIndex]
  const transferStep = lesson.steps[lesson.transferStepIndex]
  return {
    furthestPerformedIndex: furthest,
    performedIds,
    liveIndex: Math.min(furthest + 1, lesson.steps.length - 1),
    predictionCommitted: predictionStep
      ? commitments.choices[predictionStep.id] !== undefined
      : false,
    transferCommitted: transferStep ? commitments.choices[transferStep.id] !== undefined : false,
  }
}
