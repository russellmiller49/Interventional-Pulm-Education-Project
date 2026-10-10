'use client'

import { useEffect, useMemo, useReducer } from 'react'
import type { CtTrace } from '../content/ct-types'
import { navReducer, startSession, type NavPlan, type NavSession } from '../engine/nav-session'
import { readNavEntry, writeNavEntry } from '../engine/nav-storage'

/** A saved place is used only if it still fits the trip it was saved for. */
function fits(session: NavSession, trace: CtTrace, plan: NavPlan) {
  if (session.traceId !== trace.id || session.station >= plan.stations.length) return false
  const options =
    trace.checkpoints[plan.stations[session.station].checkpointIndex].decision?.options.length ?? 0
  return (
    session.marks.length === options &&
    session.identifyOption < Math.max(1, options) &&
    (session.choice === null || session.choice < options) &&
    session.declined.every((option) => option < options)
  )
}

/**
 * One trip's session, resumed from this device when a place was saved for it. Call only after
 * hydration: the first state is read from browser storage.
 */
export function useTrip(trace: CtTrace, plan: NavPlan, storageKey: string, leg: number) {
  const reducer = useMemo(() => navReducer(trace, plan), [trace, plan])
  const [session, dispatch] = useReducer(reducer, null, () => {
    const saved = readNavEntry(storageKey).entry
    if (saved && saved.leg === leg && fits(saved.session, trace, plan))
      // A reload mid-drive resumes at the fork, ready to drive again.
      return saved.session.phase === 'drive'
        ? { ...saved.session, phase: 'ready' as const }
        : saved.session
    return startSession(trace, plan)
  })
  useEffect(() => {
    writeNavEntry(storageKey, { leg, session })
  }, [storageKey, leg, session])
  return [session, dispatch] as const
}
