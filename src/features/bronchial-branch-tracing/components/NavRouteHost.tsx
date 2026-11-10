'use client'

import { useMemo } from 'react'
import type { TripPlan } from '../engine/trip-session'
import { Link, useRouter } from '@/i18n/navigation'
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
  targetsByLobe,
  traceForTarget,
} from '../content/targets'
import { planSummaryLines } from '../content/plan-copy'
import { summarize } from '../engine/nav-session'
import { navKey, readNavEntry, writeNavEntry } from '../engine/nav-storage'
import { ROUTE_PLAN_PARTS, summarizePlan } from '../engine/plan-session'
import { readPrefs } from '../engine/prefs-storage'
import { CruiseChoice } from './CruiseChoice'
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

function LesionPicker({ mode }: { mode: Mode }) {
  const router = useRouter()
  const groups = targetsByLobe()
    .map((group) => ({
      ...group,
      targets:
        mode === 'assess'
          ? group.targets.filter((target) => ASSESS_TARGET_IDS.includes(target.id))
          : group.targets,
    }))
    .filter((group) => group.targets.length)
  const open = (id: string) => {
    // A route already driven to its lesion starts again from the trachea.
    const key = navKey(mode, id)
    const saved = readNavEntry(key).entry
    if (saved && tripOver(saved.trip)) writeNavEntry(key, null)
    router.push(`${BASE_PATH}/${mode}?lesion=${id}`)
  }
  const ids = groups.flatMap((group) => group.targets.map((target) => target.id))
  return (
    <main className={styles.picker} data-lesion-picker={mode}>
      <h1>{mode === 'assess' ? 'Three lesions, no hints' : 'Pick a lesion'}</h1>
      <p>
        {mode === 'assess'
          ? 'Plan each lesion from the lesion back, draw its map, then drive: the scope flies through the central airways and the choices begin where the segment’s bronchus leaves. There are no hints: openings are numbered but not named until you have chosen, and a check tells you only whether it fits. A turn into a branch that leads away is counted, and so is backing out of it.'
          : 'Plan each lesion from the lesion back: find the airway into it, name its segment, draw the ostium circle and the arcs to the lesion. Then drive: the scope flies through the central airways, and from the fork where the segment’s bronchus leaves the choices are yours, with your map past the segmental ostium.'}
      </p>
      <div className={styles.pickerGroups}>
        {groups.map((group) => (
          <section key={group.lobe} className={styles.pickerGroup}>
            <h2>{group.lobe}</h2>
            <ul>
              {group.targets.map((target) => (
                <li key={target.id}>
                  <button onClick={() => open(target.id)} data-lesion={target.id}>
                    Lesion on slice {target.slice}
                    <small>{group.lobe}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <CruiseChoice />
      {mode === 'practice' && (
        <div className={styles.pickerActions}>
          <button
            onClick={() => open(ids[Math.floor(Math.random() * ids.length)])}
            data-lesion-surprise
          >
            Surprise me
          </button>
        </div>
      )}
      <p className={styles.boundary}>{TEACHING_SIMULATOR_STATEMENT}</p>
    </main>
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
