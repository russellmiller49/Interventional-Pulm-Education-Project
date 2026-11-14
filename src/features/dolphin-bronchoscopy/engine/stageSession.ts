import type { DolphinStageLesson, DolphinStageStep } from '../content/stageLessons'
import {
  EMPTY_SCOPE_HISTORY,
  scopeGoalsMet,
  withScopeEntry,
  type BreathCuePhase,
  type ScopeHistory,
} from './scopeGoals'

/**
 * Everything a learner has checked, placed or done on a section, and how far they have moved.
 *
 * Nothing here is persisted; a reload starts the section at its first step. The live step is
 * derived every render from these facts, so the step list, the Now card and the footer agree.
 *
 * Self-paced: moving on and doing a step's work are separate facts. `confirmed` is how far the
 * learner has moved, by Continue or by skipping. `performedIds` holds only the steps whose work was
 * done — an answer checked, a set placed, the scope goals met. Skipping moves `confirmed` and
 * nothing else, so it never stands in for an answer or a drive.
 *
 * The peripheral-imaging reducer's shape, with its lab replaced by a stream of scope locations.
 */
export interface DolphinActWork {
  /** Sort: row id → bin id, once checked. */
  readonly sort?: Readonly<Record<string, string>>
  /** Sequence: the order checked. */
  readonly sequence?: readonly string[]
  /** Identify, anatomy pick, scenario: prompt or frame id → first choice. */
  readonly picks?: Readonly<Record<string, string>>
  /** Calculate, report, drill, read: the act's own completion. */
  readonly done?: boolean
}

export interface DolphinStageCommitments {
  /** Step id → the checked choice id, for the prediction and the transfer. */
  readonly choices: Readonly<Record<string, string>>
  readonly act: DolphinActWork
  readonly confirmed: number
  readonly performedIds: readonly string[]
  readonly finished: boolean
}

export interface DolphinStageSession {
  readonly scope: ScopeHistory
  readonly commitments: DolphinStageCommitments
}

export type DolphinStageAction =
  | {
      readonly type: 'SCOPE_LOCATION'
      readonly abbr: string
      readonly cuePhase: BreathCuePhase | null
    }
  | { readonly type: 'SCOPE_RESET' }
  | { readonly type: 'COMMIT_CHOICE'; readonly stepId: string; readonly choiceId: string }
  | { readonly type: 'RETRY_CHOICE'; readonly stepId: string }
  | { readonly type: 'ACT_SORT'; readonly answers: Readonly<Record<string, string>> }
  | { readonly type: 'ACT_SEQUENCE'; readonly order: readonly string[] }
  | { readonly type: 'ACT_PICK'; readonly promptId: string; readonly choiceId: string }
  | { readonly type: 'ACT_DONE' }
  | { readonly type: 'ACT_RETRY' }
  | { readonly type: 'CONTINUE_PAST'; readonly index: number }
  | { readonly type: 'SKIP_PAST'; readonly index: number }
  | { readonly type: 'FINISH' }

export function emptyDolphinStageSession(): DolphinStageSession {
  return {
    scope: EMPTY_SCOPE_HISTORY,
    commitments: { choices: {}, act: {}, confirmed: -1, performedIds: [], finished: false },
  }
}

/** Whether the act's own work is done. Scope labs read the drive; the rest read what was checked. */
export function actWorkDone(lesson: DolphinStageLesson, session: DolphinStageSession): boolean {
  const act = lesson.section.act
  const work = session.commitments.act
  switch (act.kind) {
    case 'scope-lab':
      return scopeGoalsMet(act.goals, session.scope)
    case 'sort':
      return work.sort !== undefined
    case 'sequence':
      return work.sequence !== undefined
    case 'identify':
      return act.identify.rows.every((row) => work.picks?.[row.id] !== undefined)
    case 'anatomy-pick':
      return act.prompts.every((prompt) => work.picks?.[prompt.id] !== undefined)
    case 'scenario':
      return work.done === true
    case 'instrument-drill':
      return act.instruments.every((instrument) => work.picks?.[instrument] !== undefined)
    default:
      return work.done === true
  }
}

export function stepWorkDone(
  lesson: DolphinStageLesson,
  step: DolphinStageStep,
  index: number,
  session: DolphinStageSession,
): boolean {
  switch (step.interaction.kind) {
    case 'read':
    case 'explain':
      return session.commitments.confirmed >= index
    case 'prediction':
    case 'transfer':
      return session.commitments.choices[step.id] !== undefined
    case 'act':
      return actWorkDone(lesson, session)
  }
}

function withPerformed(
  commitments: DolphinStageCommitments,
  stepId: string,
): DolphinStageCommitments {
  if (commitments.performedIds.includes(stepId)) return commitments
  return { ...commitments, performedIds: [...commitments.performedIds, stepId] }
}

function liveBefore(
  lesson: DolphinStageLesson,
  session: DolphinStageSession,
  index: number,
): boolean {
  return index >= 0 && !session.commitments.finished && session.commitments.confirmed < index
}

export function dolphinStageReducer(lesson: DolphinStageLesson) {
  const actStepId = lesson.steps[lesson.actStepIndex]?.id
  return (session: DolphinStageSession, action: DolphinStageAction): DolphinStageSession => {
    const { commitments } = session
    switch (action.type) {
      case 'SCOPE_LOCATION': {
        const scope = withScopeEntry(session.scope, action.abbr, action.cuePhase)
        return scope === session.scope ? session : { ...session, scope }
      }
      case 'SCOPE_RESET':
        return { ...session, scope: EMPTY_SCOPE_HISTORY }
      case 'COMMIT_CHOICE':
        if (commitments.choices[action.stepId] !== undefined) return session
        return {
          ...session,
          commitments: withPerformed(
            {
              ...commitments,
              choices: { ...commitments.choices, [action.stepId]: action.choiceId },
            },
            action.stepId,
          ),
        }
      case 'RETRY_CHOICE': {
        const index = lesson.steps.findIndex((step) => step.id === action.stepId)
        if (!liveBefore(lesson, session, index)) return session
        const choices = { ...commitments.choices }
        delete choices[action.stepId]
        return {
          ...session,
          commitments: {
            ...commitments,
            choices,
            performedIds: commitments.performedIds.filter((id) => id !== action.stepId),
          },
        }
      }
      case 'ACT_SORT':
        if (commitments.act.sort) return session
        return {
          ...session,
          commitments: { ...commitments, act: { ...commitments.act, sort: action.answers } },
        }
      case 'ACT_SEQUENCE':
        if (commitments.act.sequence) return session
        return {
          ...session,
          commitments: { ...commitments, act: { ...commitments.act, sequence: action.order } },
        }
      case 'ACT_PICK': {
        if (commitments.act.picks?.[action.promptId] !== undefined) return session
        return {
          ...session,
          commitments: {
            ...commitments,
            act: {
              ...commitments.act,
              picks: { ...commitments.act.picks, [action.promptId]: action.choiceId },
            },
          },
        }
      }
      case 'ACT_DONE':
        return commitments.act.done
          ? session
          : { ...session, commitments: { ...commitments, act: { ...commitments.act, done: true } } }
      case 'ACT_RETRY': {
        if (!liveBefore(lesson, session, lesson.actStepIndex)) return session
        return {
          ...session,
          commitments: {
            ...commitments,
            act: {},
            performedIds: commitments.performedIds.filter((id) => id !== actStepId),
          },
        }
      }
      case 'CONTINUE_PAST': {
        const step = lesson.steps[action.index]
        if (!step) return session
        let next: DolphinStageCommitments = {
          ...commitments,
          confirmed: Math.max(commitments.confirmed, action.index),
        }
        if (stepWorkDone(lesson, step, action.index, { ...session, commitments: next })) {
          next = withPerformed(next, step.id)
        }
        return { ...session, commitments: next }
      }
      case 'SKIP_PAST':
        if (!lesson.steps[action.index] || commitments.confirmed >= action.index) return session
        return { ...session, commitments: { ...commitments, confirmed: action.index } }
      case 'FINISH':
        return { ...session, commitments: { ...commitments, finished: true } }
      default:
        return session
    }
  }
}

export interface DolphinStageProgress {
  readonly furthestPerformedIndex: number
  readonly performedIds: ReadonlySet<string>
  /** The step the learner is on: the one after the furthest step they have moved past. */
  readonly liveIndex: number
  readonly predictionCommitted: boolean
}

export function deriveDolphinStageProgress(
  lesson: DolphinStageLesson,
  session: DolphinStageSession,
): DolphinStageProgress {
  const performedIds = new Set<string>()
  let furthest = -1
  lesson.steps.forEach((step, index) => {
    if (!session.commitments.performedIds.includes(step.id)) return
    performedIds.add(step.id)
    furthest = index
  })
  const predictionStep = lesson.steps[lesson.predictionStepIndex]
  return {
    furthestPerformedIndex: furthest,
    performedIds,
    liveIndex: Math.max(0, Math.min(session.commitments.confirmed + 1, lesson.steps.length - 1)),
    predictionCommitted: predictionStep
      ? session.commitments.choices[predictionStep.id] !== undefined
      : false,
  }
}
