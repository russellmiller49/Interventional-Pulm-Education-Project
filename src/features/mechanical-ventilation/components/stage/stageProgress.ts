import type { VentilationStageLesson, VentilationStageStep } from '../../content/stageLessons'
import { labGoalMet, labReadyToCompare, type LabSession } from '../../engine/learningLab'

/**
 * Where a session stands on the stage, read off the lab session rather than stored beside it.
 *
 * The lab session already records everything that decides the current step — the round, its phase,
 * whether the round's goals have been met, whether the response interval has elapsed, and the
 * commitments taken — and it is what a reload reconstructs. Deriving the step from it means the
 * step list, the Now card and the saved record cannot disagree, and a reload lands the learner on
 * the step they left, with the patient paused where it was.
 */

export interface StageProgress {
  /** The step the session has reached. */
  readonly liveIndex: number
  /** Whether the live step's own work is done, so Continue may be offered. */
  readonly livePerformed: boolean
  readonly performedIds: ReadonlySet<string>
  readonly furthestPerformedIndex: number
  readonly predictionCommitted: boolean
  readonly finished: boolean
}

function indexOf(
  lesson: VentilationStageLesson,
  predicate: (step: VentilationStageStep) => boolean,
): number {
  return lesson.steps.findIndex(predicate)
}

export function goalsMet(
  lesson: VentilationStageLesson,
  session: LabSession,
  round: 0 | 1,
): boolean {
  const step = lesson.steps.find(
    (candidate) =>
      candidate.interaction.kind === 'simulator-task' && candidate.interaction.round === round,
  )
  if (!step || step.interaction.kind !== 'simulator-task') return false
  return step.interaction.goals.every((goal) => labGoalMet(goal, session))
}

export function deriveStageProgress(
  lesson: VentilationStageLesson,
  session: LabSession,
  /**
   * Stage-only state the lab does not hold: whether the walk has visited every stop, and whether
   * the learner has pressed Continue on a first step that only asks to be read.
   */
  stageOnly: { readonly walkComplete: boolean; readonly readConfirmed: boolean },
): StageProgress {
  const recognize = 0
  const predict = lesson.predictionStepIndex
  const act = indexOf(
    lesson,
    (s) => s.interaction.kind === 'simulator-task' && s.interaction.round === 0,
  )
  const observe = indexOf(
    lesson,
    (s) => s.interaction.kind === 'observe' && s.interaction.round === 0,
  )
  const explain = indexOf(
    lesson,
    (s) => s.interaction.kind === 'explain' && s.interaction.round === 0,
  )
  const sort = indexOf(lesson, (s) => s.interaction.kind === 'sort')
  const transferPredict = lesson.transferPredictionStepIndex
  const transferAct = indexOf(
    lesson,
    (s) => s.interaction.kind === 'simulator-task' && s.interaction.round === 1,
  )
  const transferExplain = indexOf(
    lesson,
    (s) => s.interaction.kind === 'explain' && s.interaction.round === 1,
  )
  const last = lesson.steps.length - 1

  const first = session.evidence[0]
  const recognizeStep = lesson.steps[recognize]
  const recognizeDone =
    recognizeStep.interaction.kind === 'read'
      ? stageOnly.readConfirmed
      : recognizeStep.interaction.kind === 'walk'
        ? stageOnly.walkComplete
        : first.location !== undefined

  let liveIndex: number
  let livePerformed: boolean
  if (session.phase === 'complete') {
    liveIndex = last
    livePerformed = true
  } else if (session.round === 0) {
    switch (session.phase) {
      case 'explore':
        liveIndex = recognize
        livePerformed = recognizeDone
        break
      case 'predict':
        liveIndex = predict
        livePerformed = false
        break
      case 'experiment': {
        const met = goalsMet(lesson, session, 0)
        if (!met) {
          liveIndex = act
          livePerformed = false
        } else {
          liveIndex = observe
          livePerformed = labReadyToCompare(session)
        }
        break
      }
      default:
        liveIndex = explain
        livePerformed = true
    }
  } else {
    switch (session.phase) {
      case 'explore':
        if (sort >= 0 && first.sort === undefined) {
          liveIndex = sort
          livePerformed = false
        } else {
          liveIndex = transferPredict
          livePerformed = false
        }
        break
      case 'predict':
        liveIndex = transferPredict
        livePerformed = false
        break
      case 'experiment':
        liveIndex = transferAct
        livePerformed = labReadyToCompare(session)
        break
      default:
        liveIndex = transferExplain
        livePerformed = true
    }
  }

  const performedIds = new Set<string>()
  lesson.steps.forEach((step, index) => {
    if (index < liveIndex || (index === liveIndex && livePerformed)) performedIds.add(step.id)
  })

  return {
    liveIndex,
    livePerformed,
    performedIds,
    furthestPerformedIndex: livePerformed ? liveIndex : liveIndex - 1,
    predictionCommitted: first.prediction !== undefined,
    finished: session.phase === 'complete',
  }
}
