import type {
  ScopeEventId,
  ScopeGoal,
  ScopeGoalTest,
  ScopeState,
} from '../../components/scope/types'
import { ledgerHas, ledgerStatus } from './inspectionLedger'
import { scopeMetricValue } from './scopeMetrics'
import { benchTargetObservation } from './scopeBenchTarget'

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
    case 'bench-target':
      return (
        state.place === 'bench' &&
        (benchTargetObservation(state, test.point)?.angleDeg ?? Infinity) <= test.toleranceDeg
      )
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

/**
 * What a met goal is a statement about: something that happened, or something that is true now.
 *
 * `history` is anything that stays met once it has been earned, whatever the tip does next — the
 * events of the attempt (`event`, `event-sequence`, `without`) and the inspection record
 * (`ledger`, `ledger-complete`), which keeps every declaration and observation after the scope has
 * left the airway they were made in. `current` is a live reading that stops holding when the state
 * changes: where the tip is (`location`), what a control or the geometry reads (`metric`,
 * `bench-target`). The card says which kind it is showing, so a row of ticks beside a lost view is
 * not read as a statement about the present (A4, A5).
 *
 * The distinction is what the predicate can still establish later, not which syntax it uses: a
 * cumulative record is history even though it is read out of the current state object (BF
 * PR-254 independent review, finding 2).
 *
 * Neither kind is evidence that the image shows an open lumen: this model counts contacts, lost
 * views and positions, and has no measure of what the picture looks like.
 */
export type ScopeGoalClaim = 'history' | 'current' | 'mixed'

export function scopeGoalClaim(test: ScopeGoalTest): ScopeGoalClaim {
  switch (test.type) {
    case 'event':
    case 'event-sequence':
    case 'without':
    case 'ledger':
    case 'ledger-complete':
      return 'history'
    case 'location':
    case 'metric':
    case 'bench-target':
      return 'current'
    case 'all': {
      const claims = new Set(test.tests.map(scopeGoalClaim))
      if (claims.size === 0) return 'history'
      if (claims.size === 1) return [...claims][0]
      return 'mixed'
    }
  }
}

/** The one claim a whole card's goals make together, for the sentence under the list. */
export function scopeGoalsClaim(goals: readonly ScopeGoal[]): ScopeGoalClaim {
  const claims = new Set(goals.map((goal) => scopeGoalClaim(goal.test)))
  if (claims.size === 0) return 'history'
  if (claims.size === 1) return [...claims][0]
  return 'mixed'
}

export function scopeGoalStatuses(
  goals: readonly ScopeGoal[],
  state: ScopeState,
): readonly { readonly goal: ScopeGoal; readonly met: boolean; readonly claim: ScopeGoalClaim }[] {
  return goals.map((goal) => ({
    goal,
    met: scopeGoalTestMet(goal.test, state),
    claim: scopeGoalClaim(goal.test),
  }))
}

export function scopeGoalsMet(goals: readonly ScopeGoal[], state: ScopeState): boolean {
  return goals.length > 0 && goals.every((goal) => scopeGoalTestMet(goal.test, state))
}
