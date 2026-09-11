import type {
  ScopeEventId,
  ScopeGoal,
  ScopeGoalTest,
  ScopeState,
} from '../../components/scope/types'
import { ledgerHas, ledgerStatus } from './inspectionLedger'
import { scopeMetricValue } from './scopeMetrics'

/**
 * Goals are live predicates over the step's state and its history of events.
 *
 * A step starts from a fresh state, so "since the step began" is the whole history, and a reset
 * starts it again. A goal can stop holding — an unsafe move after it was met un-meets any goal
 * that says "without" it — which is why the Now card shows every goal's current state and the
 * step completes only when all of them hold at once.
 */

/** The events happened in this order; others may come between them. */
export function hasEventSequence(
  events: readonly ScopeEventId[],
  sequence: readonly ScopeEventId[],
): boolean {
  let next = 0
  for (const event of events) {
    if (next < sequence.length && event === sequence[next]) next += 1
  }
  return next === sequence.length
}

export function scopeGoalTestMet(test: ScopeGoalTest, state: ScopeState): boolean {
  switch (test.type) {
    case 'event':
      return state.events.includes(test.event)
    case 'event-sequence':
      return hasEventSequence(state.events, test.events)
    case 'location':
      return state.place === 'airway' && state.location.label === test.airway
    case 'ledger':
      return ledgerHas(state.ledger[test.airway], test.status)
    case 'ledger-complete':
      return test.airways.every((airway) => {
        const record = state.ledger[airway]
        return record !== undefined && ledgerStatus(record) !== 'not-observed'
      })
    case 'metric': {
      const value = scopeMetricValue(test.metric, state)
      if (value === null) return false
      switch (test.op) {
        case '>=':
          return value >= test.value
        case '<=':
          return value <= test.value
        case 'abs>=':
          return Math.abs(value) >= test.value
      }
      return false
    }
    case 'without':
      return !state.events.includes(test.event)
    case 'all':
      return test.tests.every((inner) => scopeGoalTestMet(inner, state))
  }
}

export function scopeGoalStatuses(
  goals: readonly ScopeGoal[],
  state: ScopeState,
): readonly { readonly goal: ScopeGoal; readonly met: boolean }[] {
  return goals.map((goal) => ({ goal, met: scopeGoalTestMet(goal.test, state) }))
}

export function scopeGoalsMet(goals: readonly ScopeGoal[], state: ScopeState): boolean {
  return goals.length > 0 && goals.every((goal) => scopeGoalTestMet(goal.test, state))
}
