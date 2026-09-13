import { crrtFoundationTasks } from './content/foundationLessons'
import type { BaxterCrrtLearnLessonId } from './content/learnerRegistry'
import {
  CRRT_FOUNDATION_VERSION,
  mergeCrrtLearnEvidence,
  sameCrrtLearnIdentity,
  type CrrtLearnEvidence,
  type CrrtLearnIdentity,
} from './learnEvidence'

export interface CrrtLearnAttempt {
  readonly lessonId: BaxterCrrtLearnLessonId
  readonly attemptId: string
  readonly taskIndex: number
  readonly completedTaskIds: readonly string[]
  readonly evidence: readonly CrrtLearnEvidence[]
  readonly finished: boolean
}
export function createCrrtLearnAttempt(
  lessonId: BaxterCrrtLearnLessonId,
  attemptId: string,
): CrrtLearnAttempt {
  return { lessonId, attemptId, taskIndex: 0, completedTaskIds: [], evidence: [], finished: false }
}
export function crrtCurrentTaskIdentity(state: CrrtLearnAttempt): CrrtLearnIdentity {
  const task = crrtFoundationTasks[state.lessonId]![state.taskIndex]
  return {
    lessonId: state.lessonId,
    attemptId: state.attemptId,
    taskId: task.id,
    exampleId: task.exampleId,
    contentVersion: CRRT_FOUNDATION_VERSION,
  }
}
export type CrrtLearnAction =
  | { type: 'evidence'; evidence: CrrtLearnEvidence }
  | { type: 'complete'; identity: CrrtLearnIdentity; evidence?: CrrtLearnEvidence }
export function crrtLearnAttemptReducer(
  state: CrrtLearnAttempt,
  action: CrrtLearnAction,
): CrrtLearnAttempt {
  const identity = crrtCurrentTaskIdentity(state)
  if (
    state.finished ||
    !sameCrrtLearnIdentity(identity, action.type === 'evidence' ? action.evidence : action.identity)
  )
    return state
  const tasks = crrtFoundationTasks[state.lessonId]!
  const task = tasks[state.taskIndex]
  if (action.type === 'evidence')
    return { ...state, evidence: mergeCrrtLearnEvidence(state.evidence, action.evidence) }
  if (
    task.kind !== 'read' &&
    (!action.evidence ||
      !sameCrrtLearnIdentity(identity, action.evidence) ||
      !action.evidence.reviewed ||
      !action.evidence.feedbackDisplayed)
  )
    return state
  return {
    ...state,
    evidence: action.evidence
      ? mergeCrrtLearnEvidence(state.evidence, action.evidence)
      : state.evidence,
    completedTaskIds: [...state.completedTaskIds, task.id],
    taskIndex: Math.min(state.taskIndex + 1, tasks.length - 1),
    finished: state.taskIndex === tasks.length - 1,
  }
}
