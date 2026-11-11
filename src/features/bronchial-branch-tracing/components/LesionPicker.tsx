'use client'

import { useMemo } from 'react'
import { useRouter } from '@/i18n/navigation'
import {
  TEACHING_SIMULATOR_STATEMENT,
  divisionsLine,
  lesionStateLine,
  planStepsFirst,
} from '../content/bench-copy'
import type { CtNoduleTarget } from '../content/ct-types'
import { BASE_PATH } from '../content/module'
import {
  ASSESS_TARGET_IDS,
  lobeOf,
  targetById,
  targetsByLobe,
  traceForTarget,
} from '../content/targets'
import { mappedForks } from '../engine/arc-map'
import { navKey, readNavEntry, writeNavEntry } from '../engine/nav-storage'
import { everyStepFirst, readResults, type TripResult } from '../engine/results-storage'
import { TREE_BOX, TREE_BRANCHES, lobarRoute } from '../geometry/airway-tree'
import { CruiseChoice } from './CruiseChoice'
import { tripOver } from './TripBench'
import { useHydrated } from './useHydrated'
import styles from './nav-bench.module.css'

type Mode = 'practice' | 'assess'

/**
 * The airway tree with the way to the lesion's lobe lit: the central airways and the lobar
 * bronchus, and nothing past it. It says which lobe, as the heading above it does.
 */
function LobeThumb({ target }: { target: CtNoduleTarget }) {
  const d = useMemo(() => lobarRoute(traceForTarget(target.id)), [target.id])
  const { x, y, width, height } = TREE_BOX
  return (
    <svg
      className={styles.lesionThumb}
      viewBox={`${x} ${y} ${width} ${height}`}
      aria-hidden
      data-lesion-thumb
    >
      {TREE_BRANCHES.map((branch) => (
        <path
          key={branch.id}
          d={branch.d}
          className={styles.treeBranch}
          strokeWidth={Math.max(1, Math.min(4, branch.radiusMm * 0.6))}
        />
      ))}
      <path d={d} className={styles.treeRoute} data-lesion-thumb-route />
    </svg>
  )
}

const tallyText = (part: { asked: number; firstTry: number }) =>
  part.asked ? `${part.firstTry} of ${part.asked}` : 'none asked'

/** The closing set, lesion by lesion: what landed at its first check on the last run of each. */
function ClosingSetSummary({ results }: { results: Record<string, TripResult> }) {
  const rows = ASSESS_TARGET_IDS.map((id) => ({
    target: targetById(id)!,
    result: results[navKey('assess', id)] ?? null,
  }))
  if (!rows.some((row) => row.result)) return null
  const reached = rows.filter((row) => row.result).length
  return (
    <section className={styles.closingSet} aria-labelledby="closing-set-summary" data-closing-set>
      <h2 id="closing-set-summary">Your closing set</h2>
      <p>
        {reached === rows.length
          ? 'All three lesions reached. What landed at its first check, the last time each was reached:'
          : `${reached} of ${rows.length} lesions reached. What landed at its first check, the last time each was reached:`}
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Lesion</th>
            <th scope="col">Planning steps</th>
            <th scope="col">Divisions drawn</th>
            <th scope="col">Openings chosen</th>
            <th scope="col">Branches that led away</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ target, result }) => (
            <tr key={target.id} data-closing-row={target.id} data-reached={Boolean(result)}>
              <th scope="row">
                {lobeOf(target)}, slice {target.slice}
              </th>
              {result ? (
                <>
                  <td>{result.plan ? tallyText(planStepsFirst(result.plan)) : 'none asked'}</td>
                  <td>{result.plan ? tallyText(result.plan.arcs) : 'none asked'}</td>
                  <td>{result.drive ? tallyText(result.drive.choose) : 'none asked'}</td>
                  <td>
                    {result.drive?.wrongTurns
                      ? `${result.drive.wrongTurns} entered, ${result.drive.backedOut} backed out of`
                      : 'none entered'}
                  </td>
                </>
              ) : (
                <td colSpan={4}>Not yet reached.</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/**
 * The lesions to plan and drive, by lobe. Each says how long its map is and, from this device's
 * own record, whether it has been reached and what did not land at its first check. A lesion is
 * named by its lobe and slice only: its segment is the first thing the learner works out.
 */
export function LesionPicker({ mode }: { mode: Mode }) {
  const router = useRouter()
  const hydrated = useHydrated()
  const results = hydrated ? readResults().results : {}
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
      {mode === 'assess' && <ClosingSetSummary results={results} />}
      <div className={styles.pickerGroups}>
        {groups.map((group) => (
          <section key={group.lobe} className={styles.pickerGroup}>
            <h2>{group.lobe}</h2>
            <ul>
              {group.targets.map((target) => {
                const key = navKey(mode, target.id)
                const result = results[key] ?? null
                const started = hydrated && Boolean(readNavEntry(key).entry)
                const divisions = mappedForks(traceForTarget(target.id), target).length
                const state = result ? (everyStepFirst(result) ? 'first' : 'reached') : 'open'
                return (
                  <li key={target.id}>
                    <button
                      className={styles.lesionCard}
                      onClick={() => open(target.id)}
                      data-lesion={target.id}
                      data-lesion-state={result ? state : started ? 'started' : 'new'}
                    >
                      <LobeThumb target={target} />
                      <span className={styles.lesionCardText}>
                        <strong>Lesion on slice {target.slice}</strong>
                        <small data-lesion-divisions>{divisionsLine(divisions)}</small>
                        <small data-lesion-result>
                          {result && (
                            <span aria-hidden="true" className={styles.lesionCardMark}>
                              {state === 'first' ? '✓ ' : '◐ '}
                            </span>
                          )}
                          {lesionStateLine(result, started)}
                        </small>
                      </span>
                    </button>
                  </li>
                )
              })}
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
