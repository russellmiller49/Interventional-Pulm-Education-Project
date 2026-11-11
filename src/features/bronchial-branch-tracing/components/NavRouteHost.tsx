'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { TripPlan } from '../engine/trip-session'
import { Link } from '@/i18n/navigation'
import { TEACHING_SIMULATOR_STATEMENT, summaryLines } from '../content/bench-copy'
import { NAMING_KEY, NAMING_USE, SLICE_DIRECTION_NOTE, targetNaming } from '../content/course-guide'
import type { CtNoduleTarget } from '../content/ct-types'
import { BASE_PATH } from '../content/module'
import { routePlan } from '../content/nav-lessons'
import {
  ASSESS_TARGET_IDS,
  TARGET_IDS,
  lobeOf,
  targetById,
  targetLabel,
  traceForTarget,
} from '../content/targets'
import { planSummaryLines } from '../content/plan-copy'
import { summarize } from '../engine/nav-session'
import { navKey } from '../engine/nav-storage'
import { ROUTE_PLAN_PARTS, summarizePlan } from '../engine/plan-session'
import { readPrefs } from '../engine/prefs-storage'
import { recordResult, resultOf } from '../engine/results-storage'
import { LesionPicker } from './LesionPicker'
import { ModuleFrame } from './ModuleFrame'
import { TripBench, tripOver } from './TripBench'
import { useHydrated } from './useHydrated'
import { useTrip } from './useTrip'
import styles from './nav-bench.module.css'

type Mode = 'practice' | 'assess'

/**
 * Whole lesions: plan from the lesion back, draw the map, then drive from the trachea. Practice
 * offers every lesion with help on. The closing set (the `assess` address) is three lesions in
 * three lobes with the help off: openings are numbered but not named until chosen, a miss is told
 * that it missed, not which way to move, and a turn into a branch that leads away is counted.
 */
export function NavRouteHost({ mode, requestedTarget }: { mode: Mode; requestedTarget?: string }) {
  const hydrated = useHydrated()
  const allowed = mode === 'assess' ? ASSESS_TARGET_IDS : TARGET_IDS
  const target =
    requestedTarget && allowed.includes(requestedTarget) ? targetById(requestedTarget) : undefined
  if (!target)
    return (
      <ModuleFrame section={mode}>
        <LesionPicker mode={mode} />
      </ModuleFrame>
    )
  return (
    <ModuleFrame section={mode} activity>
      {hydrated ? (
        <RouteRun key={target.id} mode={mode} target={target} />
      ) : (
        <section aria-busy="true">
          <p role="status" style={{ padding: '1rem' }}>
            Loading the route…
          </p>
        </section>
      )}
    </ModuleFrame>
  )
}

function RouteRun({ mode, target }: { mode: Mode; target: CtNoduleTarget }) {
  const trace = useMemo(() => traceForTarget(target.id), [target.id])
  const trip: TripPlan = useMemo(
    () => ({
      plan: { traceId: trace.id, targetId: target.id, parts: ROUTE_PLAN_PARTS },
      // A whole lesion is driven with its map: no fork waits for the CT to be turned.
      nav: routePlan(trace, { matchOptional: true, cruise: !readPrefs().everyFork }),
    }),
    [trace, target.id],
  )
  const storageKey = navKey(mode, target.id)
  const [session, dispatch] = useTrip(trace, target, trip, storageKey, 0)
  // Reaching the lesion is recorded once, when it happens: a trip opened already at its end (a
  // reload on the closing screen) was recorded when it got there.
  const over = tripOver(session)
  const wasOver = useRef(over)
  useEffect(() => {
    if (over && !wasOver.current)
      recordResult(
        storageKey,
        resultOf(
          session.plan ? summarizePlan(trip.plan!, session.plan) : null,
          session.nav ? summarize(session.nav) : null,
        ),
      )
    wasOver.current = over
    // The summaries are read at the moment the trip ends; nothing changes them afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, storageKey])
  const forkNames = trip.nav!.stations.map(
    (station) => trace.checkpoints[station.checkpointIndex].decision!.parent.airway.code,
  )
  const naming = targetNaming(target)
  return (
    <TripBench
      section={mode}
      title={`${mode === 'assess' ? 'Closing set' : 'Practice'} · A lesion in the ${lobeOf(target).toLowerCase()}, slice ${target.slice}`}
      subtitle="From the lesion back, then the trachea to the lesion"
      trace={trace}
      target={target}
      trip={trip}
      intro="Plan it from the lesion back, draw the map, then drive."
      independent={mode === 'assess'}
      help={mode === 'practice'}
      session={session}
      dispatch={dispatch}
      closing={{
        heading: 'You have reached the lesion',
        body: [
          `${targetLabel(target)}. ${naming.sentence}`,
          ...(session.plan ? planSummaryLines(summarizePlan(trip.plan!, session.plan)) : []),
          ...(session.nav ? summaryLines(summarize(session.nav), forkNames) : []),
          TEACHING_SIMULATOR_STATEMENT,
        ],
        next: { label: 'Choose another lesion', href: `${BASE_PATH}/${mode}` },
      }}
      exit={<Link href={`${BASE_PATH}/${mode}`}>All lesions</Link>}
      notes={
        <details className={styles.notes} data-lesson-notes>
          <summary>Names and slices</summary>
          <p>
            {NAMING_KEY} {NAMING_USE}
          </p>
          <p>{SLICE_DIRECTION_NOTE}</p>
        </details>
      }
    />
  )
}
