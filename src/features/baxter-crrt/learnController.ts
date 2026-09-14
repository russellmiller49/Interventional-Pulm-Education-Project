import { crrtLearnTasks, crrtLearnTaskVersion } from './content/learnTasks'
import {
  createCrrtOperationalRun,
  crrtOperationalRunReducer,
  crrtOperationalTaskComplete,
  crrtRecordedFluidChart,
  crrtValidBalanceResponse,
  type CrrtOperationalRun,
  type CrrtOperationalAction,
} from './operationalModel'
import type { BaxterCrrtLearnLessonId } from './content/learnerRegistry'
import {
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
  readonly run?: CrrtOperationalRun
}
export function createCrrtLearnAttempt(
  lessonId: BaxterCrrtLearnLessonId,
  attemptId: string,
): CrrtLearnAttempt {
  const firstRun = crrtLearnTasks[lessonId]?.[0].run
  return {
    lessonId,
    attemptId,
    taskIndex: 0,
    completedTaskIds: [],
    evidence: [],
    finished: false,
    ...(firstRun ? { run: createCrrtOperationalRun(firstRun) } : {}),
  }
}
export function crrtCurrentTaskIdentity(state: CrrtLearnAttempt): CrrtLearnIdentity {
  const task = crrtLearnTasks[state.lessonId]![state.taskIndex]
  return {
    lessonId: state.lessonId,
    attemptId: state.attemptId,
    taskId: task.id,
    exampleId: task.exampleId,
    contentVersion: crrtLearnTaskVersion(state.lessonId),
  }
}
export type CrrtLearnAction =
  | { type: 'continue'; identity: CrrtLearnIdentity }
  | { type: 'retry'; identity: CrrtLearnIdentity }
  | { type: 'navigate'; taskIndex: number }
  | { type: 'evidence'; evidence: CrrtLearnEvidence }
  | { type: 'complete'; identity: CrrtLearnIdentity; evidence?: CrrtLearnEvidence }
  | { type: 'operation'; identity: CrrtLearnIdentity; action: CrrtOperationalAction }
export function crrtLearnAttemptReducer(
  state: CrrtLearnAttempt,
  action: CrrtLearnAction,
): CrrtLearnAttempt {
  const tasks = crrtLearnTasks[state.lessonId]!
  if (action.type === 'navigate') {
    if (!Number.isInteger(action.taskIndex) || !tasks[action.taskIndex]) return state
    const task = tasks[action.taskIndex]
    return {
      ...state,
      taskIndex: action.taskIndex,
      finished: false,
      run: task.run
        ? task.run === state.run?.id
          ? state.run
          : createCrrtOperationalRun(task.run)
        : undefined,
    }
  }
  const identity = crrtCurrentTaskIdentity(state)
  if (
    state.finished ||
    !sameCrrtLearnIdentity(identity, action.type === 'evidence' ? action.evidence : action.identity)
  )
    return state
  const task = tasks[state.taskIndex]
  if (action.type === 'retry') {
    return {
      ...state,
      evidence: state.evidence.filter((item) => !sameCrrtLearnIdentity(identity, item)),
    }
  }
  if (action.type === 'continue') {
    const next = tasks[state.taskIndex + 1]
    return {
      ...state,
      taskIndex: next ? state.taskIndex + 1 : state.taskIndex,
      finished: !next,
      run: next?.run
        ? next.run === state.run?.id
          ? state.run
          : createCrrtOperationalRun(next.run)
        : undefined,
    }
  }
  if (action.type === 'operation') {
    if (!state.run || state.run.id !== task.run) return state
    const run = crrtOperationalRunReducer(state.run, task.operation, action.action)
    return run === state.run ? state : { ...state, run }
  }
  if (!crrtOperationalTaskComplete(state.run, task.operation)) return state
  if (task.kind === 'question') {
    const evidence = action.evidence
    const selected = task.choices?.find((choice) => choice.id === evidence?.response)
    const first = state.evidence.find((item) => sameCrrtLearnIdentity(identity, item))
    if (
      !evidence ||
      !selected ||
      selected.correct !== evidence.correct ||
      (first && (first.response !== evidence.response || first.correct !== evidence.correct))
    )
      return state
  }
  if (task.kind === 'numeric') {
    const evidence = action.evidence
    const answer = evidence?.inputs?.answerMl
    const expected = state.run ? crrtRecordedFluidChart(state.run.session).balanceMl : null
    if (
      !evidence ||
      typeof answer !== 'number' ||
      crrtValidBalanceResponse(String(answer)) === null ||
      expected === null ||
      evidence.response !== `balance:${answer}` ||
      evidence.inputs?.expectedBalanceMl !== expected ||
      evidence.correct !== Math.abs(answer - expected) < 0.5
    )
      return state
  }
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
    run: tasks[state.taskIndex + 1]?.run
      ? tasks[state.taskIndex + 1].run === state.run?.id
        ? state.run
        : createCrrtOperationalRun(tasks[state.taskIndex + 1].run!)
      : undefined,
  }
}
