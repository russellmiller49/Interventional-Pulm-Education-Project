import type { ImagingStageLesson, ImagingStageStep } from '../content/stageLessons'
import { emptyLabState, labGoalsMet, labStateAfterChange } from './labGoalEvaluation'
import { labReadouts, type LabReadouts, type LabState, type LabValues } from './labMetrics'

/**
 * Everything a learner has checked, placed or done on a section, and how far they have moved.
 *
 * Nothing here is persisted. A reload starts the section at its first step. The step the learner
 * is on is derived from these commitments every render (`deriveStageProgress`), never stored, so
 * the step list, the Now card and the footer cannot disagree.
 *
 * Self-paced (PI-01): moving on and doing a step's work are separate facts. `confirmed` is how far
 * the learner has moved, by Continue or by skipping. `performedIds` holds only the steps whose work
 * was actually done — an answer checked, a set placed, the lab goals met as the learner continued
 * past the step. Skipping moves `confirmed` and nothing else, so it can never stand in for an
 * answer, a performed control change or a captured image.
 */
export interface StageCommitments {
  /** Step id → the checked choice id, for check steps. */
  readonly choices: Readonly<Record<string, string>>
  /** Step id → row id → origin id, once a sort is checked. */
  readonly sorts: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** Zero-based stop the walk is on, and whether it reached the end. */
  readonly walkStop: number
  readonly walkDone: boolean
  /** The furthest step the learner has moved past, whether they did its work or skipped it. */
  readonly confirmed: number
  /**
   * The steps whose work was done. Sticky on purpose: a later change to the lab cannot un-perform
   * an earlier step, and skipping never adds one.
   */
  readonly performedIds: readonly string[]
  readonly finished: boolean
}

export interface ImagingStageSession {
  readonly lab: LabState | null
  readonly commitments: StageCommitments
  /** Readouts captured at named moments, for the "what changed" table. */
  readonly snapshots: Readonly<Record<string, LabReadouts>>
}

export type ImagingStageAction =
  | { readonly type: 'LAB_CHANGE'; readonly patch: LabValues }
  | { readonly type: 'LAB_RESET' }
  | { readonly type: 'RETRY_CHOICE'; readonly stepId: string }
  | { readonly type: 'COMMIT_CHOICE'; readonly stepId: string; readonly choiceId: string }
  | {
      readonly type: 'COMMIT_SORT'
      readonly stepId: string
      readonly answers: Readonly<Record<string, string>>
    }
  | { readonly type: 'WALK_NEXT'; readonly stopCount: number }
  /** Continue past a step: performs it only if its work is done at that moment. */
  | { readonly type: 'CONTINUE_PAST'; readonly index: number }
  /** Move past a step without its work. Performs, answers and snapshots nothing. */
  | { readonly type: 'SKIP_PAST'; readonly index: number }
  | { readonly type: 'SNAPSHOT'; readonly key: string }
  | { readonly type: 'FINISH' }

export function emptyCommitments(): StageCommitments {
  return {
    choices: {},
    sorts: {},
    walkStop: 0,
    walkDone: false,
    confirmed: -1,
    performedIds: [],
    finished: false,
  }
}

export function emptyImagingStageSession(lesson: ImagingStageLesson): ImagingStageSession {
  const labId = lesson.lesson.lab
  return {
    lab: labId ? emptyLabState(labId, lesson.sectionId) : null,
    commitments: emptyCommitments(),
    snapshots: {},
  }
}

/** Whether a step's own work is done, regardless of whether the learner has moved past it. */
export function stepWorkDone(
  lesson: ImagingStageLesson,
  step: ImagingStageStep,
  index: number,
  session: ImagingStageSession,
): boolean {
  const { commitments, lab } = session
  const interaction = step.interaction
  switch (interaction.kind) {
    case 'read':
    case 'explain':
      return commitments.confirmed >= index
    case 'walk':
      // The walk's work is the stops and the goal; moving past the step is not part of it, or
      // the card could never say the work is done while the step is live.
      return (
        commitments.walkDone &&
        (lab ? labGoalsMet(interaction.goals, lab, interaction.lab, lesson.sectionId) : true)
      )
    case 'prediction':
      return commitments.choices[step.id] !== undefined
    case 'sort':
      return commitments.sorts[step.id] !== undefined
    case 'lab-task':
      return lab ? labGoalsMet(interaction.goals, lab, interaction.lab, lesson.sectionId) : false
    case 'observe':
      // An observation compares a change with where the lab started. Its goals can describe the
      // starting state (projection's is the frontal view again), so once the change step before it
      // can be skipped (PI-01) the goals alone would count an observation nobody made. The lab's
      // own history has to show a change as well.
      return lab
        ? lab.events.length > emptyLabState(interaction.lab, lesson.sectionId).events.length &&
            labGoalsMet(interaction.goals, lab, interaction.lab, lesson.sectionId)
        : false
    default:
      return false
  }
}

function withPerformed(commitments: StageCommitments, stepId: string): StageCommitments {
  if (commitments.performedIds.includes(stepId)) return commitments
  return { ...commitments, performedIds: [...commitments.performedIds, stepId] }
}

export function imagingStageReducer(lesson: ImagingStageLesson) {
  return (session: ImagingStageSession, action: ImagingStageAction): ImagingStageSession => {
    const labId = lesson.lesson.lab
    switch (action.type) {
      case 'LAB_CHANGE': {
        if (!session.lab || !labId) return session
        const lab = labStateAfterChange(labId, session.lab, action.patch, lesson.sectionId)
        return lab === session.lab ? session : { ...session, lab }
      }
      case 'LAB_RESET':
        return labId ? { ...session, lab: emptyLabState(labId, lesson.sectionId) } : session
      case 'RETRY_CHOICE': {
        const index = lesson.steps.findIndex((step) => step.id === action.stepId)
        if (index < 0 || session.commitments.finished || session.commitments.confirmed >= index)
          return session
        const choices = { ...session.commitments.choices }
        delete choices[action.stepId]
        return {
          ...session,
          commitments: {
            ...session.commitments,
            choices,
            performedIds: session.commitments.performedIds.filter((id) => id !== action.stepId),
          },
        }
      }
      case 'COMMIT_CHOICE': {
        if (session.commitments.choices[action.stepId] !== undefined) return session
        const commitments = withPerformed(
          {
            ...session.commitments,
            choices: { ...session.commitments.choices, [action.stepId]: action.choiceId },
          },
          action.stepId,
        )
        return { ...session, commitments }
      }
      case 'COMMIT_SORT': {
        if (session.commitments.sorts[action.stepId] !== undefined) return session
        const commitments = withPerformed(
          {
            ...session.commitments,
            sorts: { ...session.commitments.sorts, [action.stepId]: action.answers },
          },
          action.stepId,
        )
        return { ...session, commitments }
      }
      case 'WALK_NEXT': {
        const next = session.commitments.walkStop + 1
        if (next >= action.stopCount) {
          return {
            ...session,
            commitments: { ...session.commitments, walkStop: action.stopCount - 1, walkDone: true },
          }
        }
        return { ...session, commitments: { ...session.commitments, walkStop: next } }
      }
      case 'CONTINUE_PAST': {
        const step = lesson.steps[action.index]
        if (!step) return session
        let commitments: StageCommitments = {
          ...session.commitments,
          confirmed: Math.max(session.commitments.confirmed, action.index),
        }
        // Only the step being continued past can become performed, and only if its work is done
        // now. An earlier step the learner skipped stays unperformed.
        if (stepWorkDone(lesson, step, action.index, { ...session, commitments }))
          commitments = withPerformed(commitments, step.id)
        return { ...session, commitments }
      }
      case 'SKIP_PAST': {
        if (!lesson.steps[action.index] || session.commitments.confirmed >= action.index)
          return session
        return { ...session, commitments: { ...session.commitments, confirmed: action.index } }
      }
      case 'SNAPSHOT': {
        if (!session.lab || !labId) return session
        return {
          ...session,
          snapshots: {
            ...session.snapshots,
            [action.key]: labReadouts(labId, session.lab.values, lesson.sectionId),
          },
        }
      }
      case 'FINISH':
        return { ...session, commitments: { ...session.commitments, finished: true } }
      default:
        return session
    }
  }
}

export interface StageProgress {
  /** The last step, in lesson order, whose work was done; -1 when none has been. */
  readonly furthestPerformedIndex: number
  readonly performedIds: ReadonlySet<string>
  /** The step the learner is on: the one after the furthest step they have moved past. */
  readonly liveIndex: number
  readonly predictionCommitted: boolean
  readonly transferCommitted: boolean
}

/**
 * Where the learner is, from the commitments.
 *
 * The live step follows how far the learner has moved — by Continue or by skipping — never whether
 * they answered or completed anything, so no step can hold the section back (PI-01). Performed
 * steps are reported separately and exactly: a skipped step is simply absent from them.
 */
export function deriveStageProgress(
  lesson: ImagingStageLesson,
  session: ImagingStageSession,
): StageProgress {
  const performedIds = new Set<string>()
  let furthest = -1
  lesson.steps.forEach((step, index) => {
    if (!session.commitments.performedIds.includes(step.id)) return
    performedIds.add(step.id)
    furthest = index
  })
  const predictionStep = lesson.steps[lesson.predictionStepIndex]
  const transferStep = lesson.steps[lesson.transferStepIndex]
  return {
    furthestPerformedIndex: furthest,
    performedIds,
    liveIndex: Math.max(0, Math.min(session.commitments.confirmed + 1, lesson.steps.length - 1)),
    predictionCommitted: predictionStep
      ? session.commitments.choices[predictionStep.id] !== undefined
      : false,
    transferCommitted: transferStep
      ? session.commitments.choices[transferStep.id] !== undefined
      : false,
  }
}
