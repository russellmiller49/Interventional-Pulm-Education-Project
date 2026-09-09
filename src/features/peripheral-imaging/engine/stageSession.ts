import type { ImagingStageLesson, ImagingStageStep } from '../content/stageLessons'
import { emptyLabState, labGoalsMet, labStateAfterChange } from './labGoalEvaluation'
import { labReadouts, type LabReadouts, type LabState, type LabValues } from './labMetrics'

/**
 * Everything a learner has committed or done on a section.
 *
 * Nothing here is persisted. A reload starts the section at its first step; the completion
 * record and the first attempts are the only things written, and they are written by the host.
 * The step the learner is on is derived from these commitments every render (`deriveStageProgress`),
 * never stored, so the step list, the Now card and the record cannot disagree.
 */
export interface StageCommitments {
  /** Step id → the committed choice id, for prediction steps. */
  readonly choices: Readonly<Record<string, string>>
  /** Step id → row id → origin id, once a sort is committed. */
  readonly sorts: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** Zero-based stop the walk is on, and whether it reached the end. */
  readonly walkStop: number
  readonly walkDone: boolean
  /** The highest step the learner has explicitly moved past. */
  readonly confirmed: number
  /**
   * The steps whose work was done when the learner moved past them. Sticky on purpose: a later
   * change to the lab cannot un-perform an earlier step.
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
  | { readonly type: 'COMMIT_CHOICE'; readonly stepId: string; readonly choiceId: string }
  | {
      readonly type: 'COMMIT_SORT'
      readonly stepId: string
      readonly answers: Readonly<Record<string, string>>
    }
  | { readonly type: 'WALK_NEXT'; readonly stopCount: number }
  | { readonly type: 'CONFIRM_THROUGH'; readonly index: number }
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
      return (
        commitments.walkDone &&
        (lab ? labGoalsMet(interaction.goals, lab, interaction.lab, lesson.sectionId) : true) &&
        commitments.confirmed >= index
      )
    case 'prediction':
      return commitments.choices[step.id] !== undefined
    case 'sort':
      return commitments.sorts[step.id] !== undefined
    case 'lab-task':
    case 'observe':
      return lab ? labGoalsMet(interaction.goals, lab, interaction.lab, lesson.sectionId) : false
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
      case 'CONFIRM_THROUGH': {
        let commitments: StageCommitments = {
          ...session.commitments,
          confirmed: Math.max(session.commitments.confirmed, action.index),
        }
        const probe: ImagingStageSession = { ...session, commitments }
        for (let index = 0; index <= action.index && index < lesson.steps.length; index += 1) {
          const step = lesson.steps[index]
          if (stepWorkDone(lesson, step, index, probe))
            commitments = withPerformed(commitments, step.id)
        }
        return { ...session, commitments }
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
  readonly furthestPerformedIndex: number
  readonly performedIds: ReadonlySet<string>
  /** The step the learner should be on: the first not yet performed, held back by Continue. */
  readonly liveIndex: number
  readonly predictionCommitted: boolean
  readonly transferCommitted: boolean
}

/**
 * Where the learner is, from the commitments. A step counts as performed once its work was done
 * and the learner pressed Continue on it (or committed, for a prediction); the reducer records
 * that moment, so a later change to the lab cannot un-perform it. The live step is the first not
 * yet performed. The prediction gate is a property of the commitments, not of the index.
 */
export function deriveStageProgress(
  lesson: ImagingStageLesson,
  session: ImagingStageSession,
): StageProgress {
  const performedIds = new Set<string>()
  let furthest = -1
  for (let index = 0; index < lesson.steps.length; index += 1) {
    const step = lesson.steps[index]
    if (!session.commitments.performedIds.includes(step.id)) break
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
      ? session.commitments.choices[predictionStep.id] !== undefined
      : false,
    transferCommitted: transferStep
      ? session.commitments.choices[transferStep.id] !== undefined
      : false,
  }
}
