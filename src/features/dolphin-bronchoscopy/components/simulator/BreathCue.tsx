'use client'

import { useEffect, useState } from 'react'

import { BREATH_CUE_LIMIT } from '../../content/boundary'
import type { BreathCuePhase } from '../../engine/scopeGoals'
import styles from '../stage/dolphin-stage.module.css'

/** The cue's teaching rhythm, in milliseconds: a long breath-hold, then a short open window. */
export const BREATH_CUE_TIMING = { closedMs: 6500, openMs: 1600 } as const

/**
 * The apneustic breathing pattern as a cue over the view: a long end-inspiratory hold with the
 * glottis closed, then a breath that opens it briefly. The open window is held longer than the
 * animal's so it can be seen; one line under the cue says so.
 */
export function BreathCue({ onPhase }: { readonly onPhase: (phase: BreathCuePhase) => void }) {
  const [phase, setPhase] = useState<BreathCuePhase>('closed')
  useEffect(() => {
    onPhase(phase)
  }, [onPhase, phase])
  useEffect(() => {
    const delay = phase === 'closed' ? BREATH_CUE_TIMING.closedMs : BREATH_CUE_TIMING.openMs
    const handle = window.setTimeout(() => setPhase(phase === 'closed' ? 'open' : 'closed'), delay)
    return () => window.clearTimeout(handle)
  }, [phase])
  return (
    <div className={styles.breathCue} data-breath-phase={phase} role="status" aria-live="polite">
      <span className={styles.breathLamp} aria-hidden="true" />
      <span>
        <strong>
          {phase === 'open' ? 'Breath: the glottis opens' : 'Breath-hold: glottis closed'}
        </strong>
        <small>{BREATH_CUE_LIMIT}</small>
      </span>
    </div>
  )
}
