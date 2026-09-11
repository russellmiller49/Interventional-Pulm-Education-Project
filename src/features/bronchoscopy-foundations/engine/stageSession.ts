import type { ScopeCommand, ScopeInputMode, ScopeViewSpec } from '../components/scope/types'
import type { BronchStageLesson, BronchStageStep } from '../content/stageLessons'
import type { Plausibility } from '../content/types'
import type { ScopeCase } from './scope/scopeCase'
import { scopeGoalsMet } from './scope/scopeGoalEvaluation'
import { createScopeState, reduceScope } from './scope/scopeReducer'
import type { ScopeRuntimeState } from './scope/scopeRuntime'

/**
 * Everything a learner has committed or done on a section.
 *
 * Nothing here is persisted. A reload starts the section at its first step; the completion record
 * and the first attempts are the only things written, and they are written by the host. The step
 * the learner is on is derived from these commitments every render (`deriveStageProgress`), never
 * stored, so the step list, the Now card and the record cannot disagree.
 *
 * The scope runs through the pane engine's pure reducer, one state per step that shows a scope
 * view (an Act and its Observe have different starts). Every learner action reaches the engine as
 * a command with its input mode, so the record can say how the section was driven (A18).
 */
export interface LedgerCommitment {
  /** Row id → the milligrams the learner entered. */
  readonly entries: Readonly<Record<string, number>>
  /** The first total chosen, kept as made. */
  readonly firstTotalChoiceId: string | null
  /** The last total chosen, for its rationale. */
  readonly lastTotalChoiceId: string | null
  /** The keyed total, once chosen: the step's work is done. */
  readonly heldTotalChoiceId: string | null
}

export interface ReportCommitment {
  /** Field id → the supported option chosen. */
  readonly chosen: Readonly<Record<string, string>>
  /** Field id → the last unsupported option refused (A08). */
  readonly refused: Readonly<Record<string, string>>
}

export interface ScenarioCommitment {
  /** Zero-based frame the scenario is on; equal to the frame count once done. */
  readonly frameIndex: number
  /** Frame id → the first choice made on it, kept as made. */
  readonly firstChoices: Readonly<Record<string, string>>
  /** Frame id → the last choice made on it, for its rationale. */
  readonly lastChoices: Readonly<Record<string, string>>
  readonly done: boolean
}

export interface BronchCommitments {
  /** Step id → the committed choice id, for prediction steps. */
  readonly choices: Readonly<Record<string, string>>
  readonly sorts: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly identifies: Readonly<Record<string, Readonly<Record<string, string>>>>
  readonly sequences: Readonly<Record<string, readonly string[]>>
  readonly ledgers: Readonly<Record<string, LedgerCommitment>>
  readonly reports: Readonly<Record<string, ReportCommitment>>
  readonly scenarios: Readonly<Record<string, ScenarioCommitment>>
  /** The highest step the learner has explicitly moved past. */
  readonly confirmed: number
  /**
   * The steps whose work was done when the learner moved past them. Sticky on purpose: a later
   * command to the scope cannot un-perform an earlier step.
   */
  readonly performedIds: readonly string[]
  readonly finished: boolean
}

export interface BronchStageSession {
  /** Step id → the scope's state on that step, once its case has loaded. */
  readonly scope: Readonly<Record<string, ScopeRuntimeState>>
  readonly commitments: BronchCommitments
}

export type BronchStageAction =
  | {
      readonly type: 'SCOPE_INIT'
      readonly stepId: string
      readonly view: ScopeViewSpec
      readonly scopeCase: ScopeCase | null
    }
  | {
      readonly type: 'SCOPE_RESET'
      readonly stepId: string
      readonly view: ScopeViewSpec
      readonly scopeCase: ScopeCase | null
    }
  | {
      readonly type: 'SCOPE_COMMAND'
      readonly stepId: string
      readonly command: ScopeCommand
      readonly inputMode: ScopeInputMode
      readonly view: ScopeViewSpec
      readonly scopeCase: ScopeCase | null
    }
  | { readonly type: 'COMMIT_CHOICE'; readonly stepId: string; readonly choiceId: string }
  | {
      readonly type: 'COMMIT_SORT'
      readonly stepId: string
      readonly answers: Readonly<Record<string, string>>
    }
  | {
      readonly type: 'COMMIT_IDENTIFY'
      readonly stepId: string
      readonly answers: Readonly<Record<string, string>>
    }
  | { readonly type: 'COMMIT_SEQUENCE'; readonly stepId: string; readonly order: readonly string[] }
  | {
      readonly type: 'LEDGER_ENTRY'
      readonly stepId: string
      readonly rowId: string
      readonly mg: number
    }
  | {
      readonly type: 'LEDGER_TOTAL'
      readonly stepId: string
      readonly choiceId: string
      readonly plausibility: Plausibility
    }
  | {
      readonly type: 'REPORT_OPTION'
      readonly stepId: string
      readonly fieldId: string
      readonly optionId: string
      readonly supported: boolean
    }
  | {
      readonly type: 'SCENARIO_CHOICE'
      readonly stepId: string
      readonly frameId: string
      readonly choiceId: string
      readonly plausibility: Plausibility
      readonly frameCount: number
    }
  | { readonly type: 'CONFIRM_THROUGH'; readonly index: number }
  | { readonly type: 'FINISH' }

export function emptyCommitments(): BronchCommitments {
  return {
    choices: {},
    sorts: {},
    identifies: {},
    sequences: {},
    ledgers: {},
    reports: {},
    scenarios: {},
    confirmed: -1,
    performedIds: [],
    finished: false,
  }
}

export function emptyBronchStageSession(): BronchStageSession {
  return { scope: {}, commitments: emptyCommitments() }
}

const EMPTY_LEDGER: LedgerCommitment = {
  entries: {},
  firstTotalChoiceId: null,
  lastTotalChoiceId: null,
  heldTotalChoiceId: null,
}
const EMPTY_REPORT: ReportCommitment = { chosen: {}, refused: {} }
const EMPTY_SCENARIO: ScenarioCommitment = {
  frameIndex: 0,
  firstChoices: {},
  lastChoices: {},
  done: false,
}

export function ledgerCommitment(session: BronchStageSession, stepId: string): LedgerCommitment {
  return session.commitments.ledgers[stepId] ?? EMPTY_LEDGER
}

export function reportCommitment(session: BronchStageSession, stepId: string): ReportCommitment {
  return session.commitments.reports[stepId] ?? EMPTY_REPORT
}

export function scenarioCommitment(
  session: BronchStageSession,
  stepId: string,
): ScenarioCommitment {
  return session.commitments.scenarios[stepId] ?? EMPTY_SCENARIO
}

/** Whether a step's own work is done, regardless of whether the learner has moved past it. */
export function stepWorkDone(
  lesson: BronchStageLesson,
  step: BronchStageStep,
  index: number,
  session: BronchStageSession,
): boolean {
  const { commitments } = session
  const interaction = step.interaction
  switch (interaction.kind) {
    case 'read':
    case 'explain':
      return commitments.confirmed >= index
    case 'prediction':
      return commitments.choices[step.id] !== undefined
    case 'scope-task':
    case 'observe': {
      const state = session.scope[step.id]
      return state ? scopeGoalsMet(interaction.goals, state) : false
    }
    case 'sort':
      return commitments.sorts[step.id] !== undefined
    case 'identify':
      return commitments.identifies[step.id] !== undefined
    case 'sequence':
      return commitments.sequences[step.id] !== undefined
    case 'ledger':
      return ledgerCommitment(session, step.id).heldTotalChoiceId !== null
    case 'report': {
      const report = reportCommitment(session, step.id)
      return interaction.report.fields.every((field) => report.chosen[field.id] !== undefined)
    }
    case 'scenario':
      return scenarioCommitment(session, step.id).done
    default:
      return false
  }
}

function withPerformed(commitments: BronchCommitments, stepId: string): BronchCommitments {
  if (commitments.performedIds.includes(stepId)) return commitments
  return { ...commitments, performedIds: [...commitments.performedIds, stepId] }
}

export function bronchStageReducer(lesson: BronchStageLesson) {
  return (session: BronchStageSession, action: BronchStageAction): BronchStageSession => {
    const { commitments } = session
    switch (action.type) {
      case 'SCOPE_INIT': {
        if (session.scope[action.stepId]) return session
        const state = createScopeState(action.view, action.scopeCase)
        return { ...session, scope: { ...session.scope, [action.stepId]: state } }
      }
      case 'SCOPE_RESET': {
        const state = createScopeState(action.view, action.scopeCase)
        return { ...session, scope: { ...session.scope, [action.stepId]: state } }
      }
      case 'SCOPE_COMMAND': {
        const current = session.scope[action.stepId]
        if (!current) return session
        const next = reduceScope(current, action.command, action.inputMode, {
          view: action.view,
          scopeCase: action.scopeCase,
        })
        return { ...session, scope: { ...session.scope, [action.stepId]: next } }
      }
      case 'COMMIT_CHOICE': {
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
      }
      case 'COMMIT_SORT': {
        if (commitments.sorts[action.stepId] !== undefined) return session
        return {
          ...session,
          commitments: withPerformed(
            { ...commitments, sorts: { ...commitments.sorts, [action.stepId]: action.answers } },
            action.stepId,
          ),
        }
      }
      case 'COMMIT_IDENTIFY': {
        if (commitments.identifies[action.stepId] !== undefined) return session
        return {
          ...session,
          commitments: withPerformed(
            {
              ...commitments,
              identifies: { ...commitments.identifies, [action.stepId]: action.answers },
            },
            action.stepId,
          ),
        }
      }
      case 'COMMIT_SEQUENCE': {
        if (commitments.sequences[action.stepId] !== undefined) return session
        return {
          ...session,
          commitments: withPerformed(
            {
              ...commitments,
              sequences: { ...commitments.sequences, [action.stepId]: [...action.order] },
            },
            action.stepId,
          ),
        }
      }
      case 'LEDGER_ENTRY': {
        const ledger = ledgerCommitment(session, action.stepId)
        if (ledger.heldTotalChoiceId !== null) return session
        return {
          ...session,
          commitments: {
            ...commitments,
            ledgers: {
              ...commitments.ledgers,
              [action.stepId]: {
                ...ledger,
                entries: { ...ledger.entries, [action.rowId]: action.mg },
              },
            },
          },
        }
      }
      case 'LEDGER_TOTAL': {
        const ledger = ledgerCommitment(session, action.stepId)
        if (ledger.heldTotalChoiceId !== null) return session
        const next: LedgerCommitment = {
          ...ledger,
          firstTotalChoiceId: ledger.firstTotalChoiceId ?? action.choiceId,
          lastTotalChoiceId: action.choiceId,
          heldTotalChoiceId: action.plausibility === 'best' ? action.choiceId : null,
        }
        const updated = {
          ...commitments,
          ledgers: { ...commitments.ledgers, [action.stepId]: next },
        }
        return {
          ...session,
          commitments: next.heldTotalChoiceId ? withPerformed(updated, action.stepId) : updated,
        }
      }
      case 'REPORT_OPTION': {
        const report = reportCommitment(session, action.stepId)
        const next: ReportCommitment = action.supported
          ? {
              chosen: { ...report.chosen, [action.fieldId]: action.optionId },
              refused: Object.fromEntries(
                Object.entries(report.refused).filter(([fieldId]) => fieldId !== action.fieldId),
              ),
            }
          : { ...report, refused: { ...report.refused, [action.fieldId]: action.optionId } }
        return {
          ...session,
          commitments: {
            ...commitments,
            reports: { ...commitments.reports, [action.stepId]: next },
          },
        }
      }
      case 'SCENARIO_CHOICE': {
        const scenario = scenarioCommitment(session, action.stepId)
        if (scenario.done) return session
        const advanced = action.plausibility === 'best'
        const frameIndex = advanced ? scenario.frameIndex + 1 : scenario.frameIndex
        const next: ScenarioCommitment = {
          frameIndex,
          firstChoices: {
            ...scenario.firstChoices,
            [action.frameId]: scenario.firstChoices[action.frameId] ?? action.choiceId,
          },
          lastChoices: { ...scenario.lastChoices, [action.frameId]: action.choiceId },
          done: frameIndex >= action.frameCount,
        }
        const updated = {
          ...commitments,
          scenarios: { ...commitments.scenarios, [action.stepId]: next },
        }
        return {
          ...session,
          commitments: next.done ? withPerformed(updated, action.stepId) : updated,
        }
      }
      case 'CONFIRM_THROUGH': {
        let next: BronchCommitments = {
          ...commitments,
          confirmed: Math.max(commitments.confirmed, action.index),
        }
        const probe: BronchStageSession = { ...session, commitments: next }
        for (let index = 0; index <= action.index && index < lesson.steps.length; index += 1) {
          const step = lesson.steps[index]
          if (stepWorkDone(lesson, step, index, probe)) next = withPerformed(next, step.id)
        }
        return { ...session, commitments: next }
      }
      case 'FINISH':
        return { ...session, commitments: { ...commitments, finished: true } }
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
 * that moment, so a later command cannot un-perform it. The live step is the first not yet
 * performed. The prediction gate is a property of the commitments, not of the index.
 */
export function deriveStageProgress(
  lesson: BronchStageLesson,
  session: BronchStageSession,
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
