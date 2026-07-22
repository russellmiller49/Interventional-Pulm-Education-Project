'use client'

import type { Dispatch } from 'react'

import { PAC_POSITION_ANATOMY } from '@/features/cardiac-anatomy/content/paths'
import { useReducedMotionPreference } from '@/features/cardiac-anatomy/components/useCardiac3DSupport'

import {
  WEDGE_AUTO_DEFLATION_SECONDS,
  catheterPositionDepth,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

interface PacActionDockProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
}

const positions = ['introducer', 'ra', 'rv', 'pa', 'wedge'] as const
const positionLabels: Record<(typeof positions)[number], string> = {
  introducer: 'INTRO',
  ra: 'RA',
  rv: 'RV',
  pa: 'PA',
  wedge: 'PAWP',
}

export function PacActionDock({ state, dispatch }: PacActionDockProps) {
  const { catheter } = state
  const reducedMotion = useReducedMotionPreference()
  const moving = catheter.targetPosition !== null
  const anatomy = PAC_POSITION_ANATOMY[catheter.position]
  const wedgeElapsed =
    catheter.wedgeStartedAt === null ? 0 : Math.max(0, state.timeSeconds - catheter.wedgeStartedAt)
  const wedgeStatus = catheter.floatBalloonInflated
    ? 'Flow-directed balloon inflated for advancement through the right heart; PAWP capture is unavailable.'
    : catheter.storedWedgeMmHg !== null
      ? catheter.balloonInflated
        ? 'PAWP stored. Deflate now and confirm return of the PA waveform.'
        : catheter.position === 'pa'
          ? 'PAWP stored. Balloon deflated and PA waveform restored.'
          : `PAWP stored. Balloon deflated; current confirmed waveform is ${catheter.position.toUpperCase()}.`
      : catheter.wedgeCursorTime !== null
        ? 'End-expiratory cursor placed. Store PAWP, then deflate.'
        : catheter.wedgeCaptureReady
          ? 'One respiratory cycle sampled. Place the end-expiratory cursor.'
          : catheter.balloonInflated
            ? 'Balloon inflated. Sampling the respiratory cycle.'
            : 'Balloon deflated.'

  return (
    <section className={styles.pacActionDock} aria-labelledby="pac-action-dock-heading">
      <header className={styles.pacDockHeader}>
        <div>
          <span>Live PAC controls</span>
          <h2 id="pac-action-dock-heading">Advance by waveform and route gate</h2>
        </div>
        <output className={styles.pacDockTip} aria-live="polite" aria-atomic="true">
          Tip: {catheter.position.toUpperCase()}
          {catheter.targetPosition ? ` → ${catheter.targetPosition.toUpperCase()}` : ''} ·{' '}
          {catheter.insertionDepthCm}
          {catheter.targetPosition ? `→${catheterPositionDepth(catheter.targetPosition)}` : ''} cm
        </output>
      </header>

      <div className={styles.pacDockBody}>
        <fieldset className={styles.pacDockFieldset}>
          <legend>Catheter advancement</legend>
          <ol className={styles.pacDockPositionTrack} aria-label="PAC position sequence">
            {positions.map((position) => (
              <li
                key={position}
                aria-label={PAC_POSITION_ANATOMY[position].shortLabel}
                aria-current={catheter.position === position ? 'step' : undefined}
                data-target={catheter.targetPosition === position || undefined}
              >
                {positionLabels[position]}
              </li>
            ))}
          </ol>
          <p className={styles.pacDockCue}>{anatomy.waveform}</p>
          <div className={styles.pacDockActionGrid}>
            <button
              type="button"
              disabled={moving || catheter.position === 'introducer' || catheter.balloonInflated}
              onClick={() => dispatch({ type: 'RETRACT_CATHETER', instant: reducedMotion })}
            >
              Retract
            </button>
            <button
              type="button"
              disabled={moving || catheter.position === 'pa' || catheter.position === 'wedge'}
              onClick={() => dispatch({ type: 'ADVANCE_CATHETER', instant: reducedMotion })}
            >
              Advance
            </button>
          </div>
        </fieldset>

        <fieldset className={styles.pacDockFieldset}>
          <legend>Brief end-expiratory PAWP capture</legend>
          <div
            className={styles.pacDockWedgeTimer}
            data-danger={wedgeElapsed >= WEDGE_AUTO_DEFLATION_SECONDS - 2}
          >
            <span aria-live="off" aria-label="Balloon inflation elapsed time">
              {Math.min(WEDGE_AUTO_DEFLATION_SECONDS, wedgeElapsed).toFixed(1)} s
            </span>
            <div aria-hidden="true">
              <i
                style={{
                  width: `${Math.min(100, (wedgeElapsed / WEDGE_AUTO_DEFLATION_SECONDS) * 100)}%`,
                }}
              />
            </div>
            <span role="status" aria-live="polite" aria-atomic="true">
              {wedgeStatus}
            </span>
          </div>
          <div className={styles.pacDockActionGrid}>
            <button
              type="button"
              disabled={moving || catheter.position !== 'pa'}
              onClick={() => dispatch({ type: 'START_WEDGE' })}
            >
              Inflate briefly
            </button>
            <button
              type="button"
              disabled={!catheter.wedgeCaptureReady || catheter.wedgeCursorTime !== null}
              onClick={() => dispatch({ type: 'PLACE_WEDGE_CURSOR' })}
            >
              End-exp cursor
            </button>
            <button
              type="button"
              disabled={catheter.wedgeCursorTime === null || catheter.storedWedgeMmHg !== null}
              onClick={() => dispatch({ type: 'STORE_WEDGE' })}
            >
              Store PAWP
            </button>
            <button
              type="button"
              data-safety-action={catheter.balloonInflated || undefined}
              disabled={!catheter.balloonInflated}
              onClick={() => dispatch({ type: 'DEFLATE_WEDGE' })}
            >
              Deflate now
            </button>
          </div>
        </fieldset>
      </div>

      <p className={styles.pacDockBoundaryNote}>
        Tricuspid and pulmonic gates orient the CT-derived route; their leaflet morphology is not
        segmented. Confirm every transition by its pressure waveform.
      </p>

      {catheter.forcedSafetyRecovery && (
        <p className={styles.criticalFeedback} role="alert">
          Safety recovery: inflation reached the 10-second hard limit, so the balloon was
          auto-deflated and a critical error was recorded.
        </p>
      )}
    </section>
  )
}
