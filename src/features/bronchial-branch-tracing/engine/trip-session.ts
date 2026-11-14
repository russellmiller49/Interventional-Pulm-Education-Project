import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import {
  navReducer,
  startSession,
  type NavAction,
  type NavPlan,
  type NavSession,
} from './nav-session'
import {
  planReducer,
  startPlan,
  type PlanAction,
  type PlanSession,
  type PlanSpec,
} from './plan-session'

/**
 * One trip: planning on the CT (`plan-session`), then the scope's drive (`nav-session`). A trip
 * can be either part alone: a lesson about the ostium circle plans and stops; the first lessons
 * drive and never plan.
 */
export type TripStage = 'plan' | 'navigate' | 'done'

export interface TripPlan {
  plan: PlanSpec | null
  nav: NavPlan | null
}
export interface TripSession {
  version: 2
  stage: TripStage
  plan: PlanSession | null
  nav: NavSession | null
}
export type TripAction =
  | { type: 'plan'; action: PlanAction }
  | { type: 'nav'; action: NavAction }
  | { type: 'restart' }

const afterPlan = (trip: TripPlan): TripStage => (trip.nav ? 'navigate' : 'done')

export function startTrip(
  trace: CtTrace,
  target: CtNoduleTarget | null,
  trip: TripPlan,
): TripSession {
  if (!trip.plan && !trip.nav) throw new Error('A trip plans, drives, or both')
  if (trip.plan && !target) throw new Error(`Planning ${trace.id} needs its lesion`)
  const plan = trip.plan && target ? startPlan(trace, target, trip.plan) : null
  return {
    version: 2,
    stage: plan && plan.stage !== 'done' ? 'plan' : afterPlan(trip),
    plan,
    nav: trip.nav ? startSession(trace, trip.nav) : null,
  }
}

export function tripReducer(trace: CtTrace, target: CtNoduleTarget | null, trip: TripPlan) {
  const plans = trip.plan && target ? planReducer(trace, target, trip.plan) : null
  const drives = trip.nav ? navReducer(trace, trip.nav) : null
  return function reduce(state: TripSession, action: TripAction): TripSession {
    switch (action.type) {
      case 'restart':
        return startTrip(trace, target, trip)
      case 'plan': {
        if (state.stage !== 'plan' || !plans || !state.plan) return state
        const plan = plans(state.plan, action.action)
        if (plan === state.plan) return state
        return { ...state, plan, stage: plan.stage === 'done' ? afterPlan(trip) : 'plan' }
      }
      case 'nav': {
        if (state.stage !== 'navigate' || !drives || !state.nav) return state
        const nav = drives(state.nav, action.action)
        return nav === state.nav ? state : { ...state, nav }
      }
    }
  }
}
