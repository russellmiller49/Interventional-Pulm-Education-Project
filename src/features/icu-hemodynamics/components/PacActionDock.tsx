'use client'

import type { Dispatch } from 'react'

import { PAC_POSITION_ANATOMY } from '@/features/cardiac-anatomy/content/paths'
import { useReducedMotionPreference } from '@/features/cardiac-anatomy/components/useCardiac3DSupport'

import {
  WEDGE_AUTO_DEFLATION_SECONDS,
  catheterPositionDepth,
  type CatheterPosition,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import { WaveformAtlasPanel } from './WaveformAtlasPanel'
import { WedgeValidityPanel } from './WedgeValidityPanel'
import styles from './icu-hemodynamics.module.css'

interface PacActionDockProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
  focus?: 'advancement' | 'wedge'
}

const positions = ['introducer', 'ra', 'rv', 'pa', 'wedge'] as const
const positionLabels: Record<(typeof positions)[number], string> = {
  introducer: 'INTRO',
  ra: 'RA',
  rv: 'RV',
  pa: 'PA',
  wedge: 'PAWP',
}

/** Atlas entry that matches each catheter position, so the reference follows the catheter. */
const atlasEntryForPosition: Record<CatheterPosition, string> = {
  introducer: 'ra-normal',
  ra: 'ra-normal',
  rv: 'rv-normal',
  pa: 'pa-normal',
  wedge: 'wedge-normal',
}

export function PacActionDock({ state, dispatch, focus }: PacActionDockProps) {
  const { catheter } = state
  const reducedMotion = useReducedMotionPreference()
  const moving = catheter.targetPosition !== null
  const anatomy = PAC_POSITION_ANATOMY[catheter.position]
  const currentWaveformConfirmed = state.signalValidationChecks.includes(
    `waveform-confirmed-${catheter.position}`,
  )
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
  const advancementBalloonStatus =
    catheter.position === 'wedge'
      ? 'PAWP capture uses a separate brief occlusion inflation; deflate promptly after the end-expiratory sample.'
      : catheter.floatBalloonInflated
        ? 'Flow-directed balloon INFLATED while the catheter advances through the right heart.'
        : catheter.targetPosition === 'ra'
          ? 'Balloon DEFLATED while the tip clears the introducer and enters the right atrium.'
          : catheter.position === 'introducer'
            ? 'Balloon DEFLATED inside the introducer; the simulator inflates it before RA-to-RV advancement.'
            : catheter.position === 'ra'
              ? 'RA reached with the balloon deflated; the next Advance action inflates it before movement toward RV.'
              : catheter.position === 'pa'
                ? 'PA waveform reached; flow-directed balloon DEFLATED.'
                : 'Confirm the RV waveform; keep the flow-directed balloon inflated for movement toward PA.'

  return (
    <section className={styles.pacActionDock} aria-labelledby="pac-action-dock-heading">
      <header className={styles.pacDockHeader}>
        <div>
          <span>Live PAC controls</span>
          <h2 id="pac-action-dock-heading">Advance by waveform and catheter route</h2>
        </div>
        <output className={styles.pacDockTip} aria-live="polite" aria-atomic="true">
          Tip: {catheter.position.toUpperCase()}
          {catheter.targetPosition ? ` → ${catheter.targetPosition.toUpperCase()}` : ''} ·{' '}
          {catheter.insertionDepthCm}
          {catheter.targetPosition ? `→${catheterPositionDepth(catheter.targetPosition)}` : ''} cm
        </output>
      </header>

      {focus !== 'wedge' ? (
        <aside
          className={styles.pacAdvancementTeaching}
          role="note"
          aria-label="Flow-directed balloon advancement technique"
        >
          <strong>Balloon technique during advancement</strong>
          <p>
            Keep the balloon deflated while the tip is inside the introducer. Once the tip has
            entered the RA, inflate before advancing and keep it inflated while floating through RA
            → RV → PA. Stop advancing and deflate promptly when the PA waveform appears; confirm
            every chamber transition by waveform rather than depth alone.
          </p>
          <output aria-live="polite">{advancementBalloonStatus}</output>
        </aside>
      ) : null}

      <div className={styles.pacDockBody}>
        {focus !== 'wedge' ? (
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
            {catheter.position !== 'introducer' && catheter.position !== 'wedge' ? (
              <button
                type="button"
                className={styles.pacDockConfirmButton}
                aria-pressed={currentWaveformConfirmed}
                disabled={moving}
                onClick={() =>
                  dispatch({
                    type: 'VALIDATE_SIGNAL',
                    check: `waveform-confirmed-${catheter.position}`,
                  })
                }
              >
                {currentWaveformConfirmed
                  ? `${catheter.position.toUpperCase()} waveform confirmed`
                  : `Confirm ${catheter.position.toUpperCase()} waveform`}
              </button>
            ) : null}
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
                disabled={
                  moving ||
                  catheter.position === 'pa' ||
                  catheter.position === 'wedge' ||
                  (catheter.position !== 'introducer' && !currentWaveformConfirmed)
                }
                onClick={() => dispatch({ type: 'ADVANCE_CATHETER', instant: reducedMotion })}
              >
                Advance
              </button>
            </div>
          </fieldset>
        ) : null}

        {focus !== 'advancement' ? (
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
        ) : null}
      </div>

      {focus !== 'wedge' && catheter.position === 'ra' ? (
        <aside
          className={styles.pacCvpTeaching}
          role="note"
          aria-label="RA and CVP end-expiratory measurement"
        >
          <strong>RA = CVP here: read the respiratory trough</strong>
          <p>
            The blue CVP channel and yellow PAC · RA channel sample the same right-atrial pressure,
            so their end-expiratory values must match. In this controlled positive-pressure model,
            the slow CVP and ART envelopes rise together during inspiration; the lowest slow
            envelope is end expiration.
          </p>
          <ol>
            <li>Freeze the trace and identify the end-expiratory trough.</li>
            <li>Read CVP at the base of the c wave inside that trough.</li>
            <li>Do not substitute an inspiratory peak or an arbitrary one-beat average.</li>
          </ol>
          <output aria-live="polite">
            {state.measurementSystem.zeroed
              ? 'Pressure system zeroed: the cyan cursor marks the modeled end-expiratory c-wave base.'
              : 'ZERO REQUIRED: the cursor teaches respiratory timing, but the pressure remains technically invalid until the transducer is leveled and zeroed.'}
          </output>
        </aside>
      ) : null}

      {focus !== 'wedge' ? (
        <WaveformAtlasPanel
          key={`advance-${catheter.position}`}
          initialEntryId={atlasEntryForPosition[catheter.position]}
          onlyCategories={['insertion']}
          heading="What each position looks like"
        />
      ) : null}

      {focus === 'wedge' ? (
        <>
          <WaveformAtlasPanel
            initialEntryId="wedge-normal"
            onlyEntryIds={['wedge-normal', 'wedge-overwedged', 'wedge-hybrid']}
            tablistLabel="True and false wedge patterns"
            heading="True wedge versus false wedge"
          />
          <WedgeValidityPanel />
        </>
      ) : null}

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
