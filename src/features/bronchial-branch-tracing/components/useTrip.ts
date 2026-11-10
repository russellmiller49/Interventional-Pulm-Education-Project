'use client'

import { useEffect, useMemo, useReducer } from 'react'
import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import { mappedForks } from '../engine/arc-map'
import { flyingThrough, type NavPlan, type NavSession } from '../engine/nav-session'
import { readNavEntry, writeNavEntry } from '../engine/nav-storage'
import { settlePlan, type PlanSession } from '../engine/plan-session'
import { startTrip, tripReducer, type TripPlan, type TripSession } from '../engine/trip-session'

/** A saved drive is used only if it still fits the plan it was saved for. */
function navFits(session: NavSession, trace: CtTrace, plan: NavPlan) {
  if (session.traceId !== trace.id || session.station >= plan.stations.length) return false
  const options =
    trace.checkpoints[plan.stations[session.station].checkpointIndex].decision?.options.length ?? 0
  return (
    session.marks.length === options &&
    session.identifyOption < Math.max(1, options) &&
    (session.choice === null || session.choice < options) &&
    (session.astray === null || session.astray < options) &&
    session.declined.every((option) => option < options)
  )
}
/** A saved plan is used only if it is for the same lesion and the same divisions. */
function planFits(plan: PlanSession, trace: CtTrace, target: CtNoduleTarget) {
  const forks = mappedForks(trace, target)
  return (
    plan.traceId === trace.id &&
    plan.targetId === target.id &&
    plan.arcs.length === forks.length &&
    plan.division < Math.max(1, forks.length) &&
    plan.arcs.every((arcs, i) => {
      const options = trace.checkpoints[forks[i]].decision?.options.length ?? 0
      return arcs.placed.length <= options && (arcs.leadsOn === null || arcs.leadsOn < options)
    })
  )
}
function fits(saved: TripSession, trace: CtTrace, target: CtNoduleTarget | null, trip: TripPlan) {
  if (Boolean(saved.plan) !== Boolean(trip.plan) || Boolean(saved.nav) !== Boolean(trip.nav))
    return false
  if (saved.plan && (!target || !planFits(saved.plan, trace, target))) return false
  if (saved.nav && trip.nav && !navFits(saved.nav, trace, trip.nav)) return false
  return true
}

/**
 * A reload while the scope was moving resumes where it was going, and a place saved on a planning
 * step the trip no longer has resumes on the next one.
 */
function settle(saved: TripSession, plan: TripPlan): TripSession {
  const trip =
    saved.stage === 'plan' && saved.plan && plan.plan
      ? { ...saved, plan: settlePlan(plan.plan, saved.plan) }
      : saved
  const nav = trip.nav
  if (!nav) return trip
  // A fly-through simply goes on from the fork it had reached.
  if (plan.nav && flyingThrough(plan.nav, nav)) return trip
  if (nav.phase === 'drive') return { ...trip, nav: { ...nav, phase: 'ready' } }
  if (nav.phase === 'astray-in' || nav.phase === 'astray-out')
    return { ...trip, nav: { ...nav, phase: 'astray' } }
  return trip
}

/**
 * One trip's session, resumed from this device when a place was saved for it. Call only after
 * hydration: the first state is read from browser storage.
 */
export function useTrip(
  trace: CtTrace,
  target: CtNoduleTarget | null,
  trip: TripPlan,
  storageKey: string,
  leg: number,
) {
  const reducer = useMemo(() => tripReducer(trace, target, trip), [trace, target, trip])
  const [session, dispatch] = useReducer(reducer, null, () => {
    const saved = readNavEntry(storageKey).entry
    if (saved && saved.leg === leg && fits(saved.trip, trace, target, trip))
      return settle(saved.trip, trip)
    return startTrip(trace, target, trip)
  })
  useEffect(() => {
    writeNavEntry(storageKey, { leg, trip: session })
  }, [storageKey, leg, session])
  return [session, dispatch] as const
}
