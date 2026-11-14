'use client'

import { LocateFixed, SkipForward } from 'lucide-react'

import { branchMapByAbbr } from '../../content/branchMap'
import { currentDrillTarget, type DrillAction, type DrillState } from '../../engine/branchDrill'
import styles from '../stage/dolphin-stage.module.css'

/**
 * The drill's target card: the name to find, its branch-map line, "Show me where" (the beacon in
 * the 3D tree), "Skip this one", and the hint after a turn off the passage. No clock, no score.
 */
export function BranchDrillOverlay({
  state,
  dispatch,
}: {
  readonly state: DrillState
  readonly dispatch: (action: DrillAction) => void
}) {
  const target = currentDrillTarget(state)
  if (!target) {
    return (
      <section
        className={styles.drillOverlay}
        aria-label="Target"
        data-landmark="Target"
        data-drill-done
      >
        <p className={styles.stem}>Every target in this set is done.</p>
        <p className={styles.rowFeedback}>
          Reached by driving: {state.arrived.length > 0 ? state.arrived.join(', ') : 'none'}.
          Nothing was timed or stored.
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => dispatch({ type: 'RESET' })}
          >
            Run the set again
          </button>
        </div>
      </section>
    )
  }
  const entry = branchMapByAbbr.get(target)
  return (
    <section
      className={styles.drillOverlay}
      aria-label="Target"
      data-landmark="Target"
      data-drill-target={target}
    >
      <p className={styles.kicker}>
        Target {state.index + 1} of {state.targets.length}
      </p>
      <p className={styles.stem}>
        Find {entry?.guideName ?? target} ({target})
      </p>
      {entry?.variation ? <p className={styles.rowFeedback}>{entry.variation.note}</p> : null}
      {state.hint ? (
        <p className={styles.note} data-tone="hint" role="status" data-drill-hint>
          {state.hint}
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={state.showBeacon}
          onClick={() => dispatch({ type: 'SHOW_ME' })}
        >
          <LocateFixed aria-hidden="true" size={16} /> Show me where
        </button>
        <button type="button" className={styles.button} onClick={() => dispatch({ type: 'SKIP' })}>
          <SkipForward aria-hidden="true" size={16} /> Skip this one
        </button>
      </div>
    </section>
  )
}
