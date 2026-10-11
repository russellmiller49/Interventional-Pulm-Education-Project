'use client'

import { useMemo } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { TEACHING_SIMULATOR_STATEMENT, summaryLines } from '../content/bench-copy'
import { NAMING_KEY, NAMING_USE, SLICE_DIRECTION_NOTE, targetNaming } from '../content/course-guide'
import type { CtNoduleTarget } from '../content/ct-types'
import { BASE_PATH } from '../content/module'
import { routePlan } from '../content/nav-lessons'
import {
  ASSESS_TARGET_IDS,
  TARGET_IDS,
  targetById,
  targetLabel,
  targetsByLobe,
  traceForTarget,
} from '../content/targets'
import { summarize } from '../engine/nav-session'
import { navKey, readNavEntry, writeNavEntry } from '../engine/nav-storage'
import { ModuleFrame } from './ModuleFrame'
import { NavigationBench } from './NavigationBench'
import { useHydrated } from './useHydrated'
import { useTrip } from './useTrip'
import styles from './nav-bench.module.css'

type Mode = 'practice' | 'assess'

/**
 * Whole routes, trachea to lesion. Practice offers every lesion with help on. The closing set
 * (the `assess` address) is three lesions in three lobes with the help off: openings are numbered
 * but not named until chosen, and a missed mark is told what it is in, not which way to move.
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
    if (readNavEntry(key).entry?.session.phase === 'arrived') writeNavEntry(key, null)
    router.push(`${BASE_PATH}/${mode}?lesion=${id}`)
  }
  const ids = groups.flatMap((group) => group.targets.map((target) => target.id))
  return (
    <main className={styles.picker} data-lesion-picker={mode}>
      <h1>{mode === 'assess' ? 'Three lesions, no hints' : 'Pick a lesion'}</h1>
      <p>
        {mode === 'assess'
          ? 'Each route runs from the trachea to the lesion. Openings are numbered but not named until you have chosen, and a missed mark is told what it landed in, not which way to move. The match, identify, choose and drive steps are the same.'
          : 'Each route runs from the trachea to the lesion: match the CT to the scope, identify the openings, choose toward the lesion and drive on, at every fork. The trachea and main bronchus are chosen, not marked.'}
      </p>
      <div className={styles.pickerGroups}>
        {groups.map((group) => (
          <section key={group.lobe} className={styles.pickerGroup}>
            <h2>{group.lobe}</h2>
            <ul>
              {group.targets.map((target) => (
                <li key={target.id}>
                  <button onClick={() => open(target.id)} data-lesion={target.id}>
                    {target.segment.code} · {target.segment.name}
                    <small>
                      by {target.approachCode} · slice {target.slice}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
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
  const plan = useMemo(() => routePlan(trace), [trace])
  const storageKey = navKey(mode, target.id)
  const [session, dispatch] = useTrip(trace, plan, storageKey, 0)
  const forkNames = plan.stations.map(
    (station) => trace.checkpoints[station.checkpointIndex].decision!.parent.airway.code,
  )
  const naming = targetNaming(target)
  return (
    <NavigationBench
      section={mode}
      title={`${mode === 'assess' ? 'Closing set' : 'Practice'} · ${targetLabel(target)}`}
      subtitle="Trachea to the lesion"
      trace={trace}
      plan={plan}
      intro={`${naming.sentence} Start by matching the CT to the scope in the trachea.`}
      independent={mode === 'assess'}
      help={mode === 'practice'}
      session={session}
      dispatch={dispatch}
      closing={{
        heading: 'You have reached the lesion',
        body: [...summaryLines(summarize(session), forkNames), TEACHING_SIMULATOR_STATEMENT],
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
