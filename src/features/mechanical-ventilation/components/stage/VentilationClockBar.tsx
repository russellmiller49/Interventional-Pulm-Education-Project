'use client'

import type { Dispatch } from 'react'
import { Pause, Play, SkipForward } from 'lucide-react'

import { CLOCK_ONE_BREATH_ID, CLOCK_RUN_ID } from '../../content/consoleControlIds'
import type { VentilationAction, VentilationSimulationState } from '../../engine/types'
import styles from './task-flow.module.css'

/**
 * The only clock on the page.
 *
 * Run and Pause, one breath, the speed and the model time sit directly above the console they drive.
 * There used to be three: the workbench's playback row, the experiment panel's Run experiment, and a
 * third inside the simulator pane — two Run buttons for one patient read as two patients. A setting
 * change never starts the clock; only Run or One breath moves model time.
 */
export function VentilationClockBar({
  state,
  engine,
  frozenLabel,
  guidedControlId,
}: {
  readonly state: VentilationSimulationState
  readonly engine: Dispatch<VentilationAction>
  /** What the console screen is showing while it is frozen, or null while it is live. */
  readonly frozenLabel: string | null
  readonly guidedControlId?: string | null
}) {
  const guided = (id: string) => (guidedControlId === id ? true : undefined)
  return (
    <div
      className={styles.clockBar}
      role="group"
      aria-label="Ventilator clock"
      data-ventilation-transport
      data-clock-bar
    >
      <button
        type="button"
        id={CLOCK_RUN_ID}
        className={styles.clockButton}
        aria-pressed={!state.paused}
        data-paused={state.paused}
        data-guided-help={guided(CLOCK_RUN_ID)}
        onClick={() => engine({ type: 'SET_PAUSED', paused: !state.paused, origin: 'learner' })}
      >
        {state.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        {state.paused ? 'Run' : 'Pause'}
      </button>
      <button
        type="button"
        id={CLOCK_ONE_BREATH_ID}
        className={styles.clockButton}
        data-guided-help={guided(CLOCK_ONE_BREATH_ID)}
        onClick={() => engine({ type: 'STEP_BREATH' })}
      >
        <SkipForward aria-hidden="true" />
        One breath
      </button>
      <label className={styles.clockSpeed}>
        <span className={styles.srOnly}>Clock speed</span>
        <select
          aria-label="Simulation speed"
          value={state.speed}
          onChange={(event) =>
            engine({ type: 'SET_SPEED', speed: Number(event.target.value) as 1 | 5 })
          }
        >
          <option value={1}>1× time</option>
          <option value={5}>5× time</option>
        </select>
      </label>
      <span className={styles.clockTime} aria-live="off" data-model-time>
        {state.simulationTime.toFixed(1)} s
      </span>
      {frozenLabel ? (
        <span className={styles.clockBadge} data-frozen-badge>
          {frozenLabel}
        </span>
      ) : (
        <span className={styles.clockBadge} data-live-badge data-paused={state.paused}>
          {state.paused ? 'Paused' : 'Live'}
        </span>
      )}
    </div>
  )
}
