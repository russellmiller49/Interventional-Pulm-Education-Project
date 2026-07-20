'use client'

import { useRef, useState, type Dispatch, type KeyboardEvent, type PointerEvent } from 'react'

import {
  thermodilutionAcceptedAverage,
  type HemodynamicAction,
  type HemodynamicSimulationState,
  type ThermodilutionTechnique,
  type ThermodilutionTrial,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

interface PacSkillsLabProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
}

function curvePoints(trial: ThermodilutionTrial): string {
  if (trial.curve.length === 0) return ''
  const values = trial.curve.map((point) => point.temperatureChangeC)
  const minimum = Math.min(...values, -0.01)
  return trial.curve
    .map((point) => {
      const x = (point.timeSeconds / 8) * 500
      const y = 18 + (Math.abs(point.temperatureChangeC) / Math.abs(minimum)) * 72
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export function PacSkillsLab({ state, dispatch }: PacSkillsLabProps) {
  const configuration = state.caseDefinition.thermodilution
  const [volumeMl, setVolumeMl] = useState(configuration.injectateVolumeMl)
  const [temperatureC, setTemperatureC] = useState(configuration.injectateTemperatureC)
  const [durationSeconds, setDurationSeconds] = useState(2.5)
  const [smoothness, setSmoothness] = useState(0.95)
  const [respiratoryPhase, setRespiratoryPhase] =
    useState<ThermodilutionTechnique['respiratoryPhase']>('end-expiration')
  const injectionStart = useRef<number | null>(null)
  const ignoreClick = useRef(false)
  const latestTrial = state.thermodilutionTrials.at(-1)
  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  const wedgeElapsed =
    state.catheter.wedgeStartedAt === null
      ? 0
      : Math.max(0, state.timeSeconds - state.catheter.wedgeStartedAt)

  function generate(injectionDurationSeconds = durationSeconds) {
    dispatch({
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        injectateVolumeMl: volumeMl,
        injectateTemperatureC: temperatureC,
        injectionDurationSeconds: Math.max(0.2, Math.min(8, injectionDurationSeconds)),
        respiratoryPhase,
        smoothness,
      },
    })
  }

  function startTimedInjection() {
    injectionStart.current = performance.now()
  }

  function finishTimedInjection() {
    if (injectionStart.current === null) return
    const elapsed = (performance.now() - injectionStart.current) / 1000
    injectionStart.current = null
    ignoreClick.current = true
    generate(elapsed)
  }

  function onInjectionKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.code === 'Space' && !event.repeat) {
      event.preventDefault()
      startTimedInjection()
    }
  }

  function onInjectionKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.code === 'Space') {
      event.preventDefault()
      finishTimedInjection()
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || event.button === 0) startTimedInjection()
  }

  function onPointerUp() {
    finishTimedInjection()
  }

  return (
    <section className={styles.skillsLab} aria-labelledby="skills-heading">
      <header className={styles.sectionHeader}>
        <div>
          <span>Reusable skills station</span>
          <h2 id="skills-heading">PAC setup, advancement, wedge, and cardiac output</h2>
        </div>
        <span className={styles.stationChip}>
          Tip: {state.catheter.position.toUpperCase()} · {state.catheter.insertionDepthCm} cm
        </span>
      </header>

      <ol className={styles.skillSequence} aria-label="PAC skills sequence">
        <li data-complete={state.measurementSystem.zeroed}>
          1 <span>Level + zero</span>
        </li>
        <li data-complete={state.signalValidationChecks.includes('fast-flush')}>
          2 <span>Dynamic response</span>
        </li>
        <li data-complete={state.catheter.position === 'pa' || state.catheter.position === 'wedge'}>
          3 <span>Advance by waveform</span>
        </li>
        <li data-complete={state.catheter.storedWedgeMmHg !== null}>
          4 <span>Capture PAWP</span>
        </li>
        <li data-complete={average !== null}>
          5 <span>Thermodilution series</span>
        </li>
      </ol>

      <div className={styles.skillsGrid}>
        <article className={styles.skillCard}>
          <div className={styles.cardHeading}>
            <span>01</span>
            <div>
              <h3>Pressure system</h3>
              <p>Level, zero, select scale, and test dynamic response before interpretation.</p>
            </div>
          </div>
          <label className={styles.rangeControl}>
            Transducer relative to phlebostatic axis:{' '}
            <strong>
              {state.measurementSystem.transducerLevelCm > 0 ? '+' : ''}
              {state.measurementSystem.transducerLevelCm.toFixed(0)} cm
            </strong>
            <input
              type="range"
              min="-15"
              max="15"
              step="1"
              value={state.measurementSystem.transducerLevelCm}
              onChange={(event) =>
                dispatch({ type: 'SET_TRANSDUCER_LEVEL', levelCm: Number(event.target.value) })
              }
            />
            <span>
              <small>Below → pressure reads high</small>
              <small>Above → pressure reads low</small>
            </span>
          </label>
          <div className={styles.buttonRow}>
            <button type="button" onClick={() => dispatch({ type: 'ZERO_TRANSDUCER' })}>
              Open to air + zero
            </button>
            <button type="button" onClick={() => dispatch({ type: 'FAST_FLUSH' })}>
              Fast flush test
            </button>
          </div>
          {state.measurementSystem.lastFastFlushFinding && (
            <p className={styles.feedback}>{state.measurementSystem.lastFastFlushFinding}</p>
          )}
          <label>
            Measurement artifact
            <select
              value={state.measurementSystem.artifact}
              onChange={(event) =>
                dispatch({
                  type: 'SET_ARTIFACT',
                  artifact: event.target.value as typeof state.measurementSystem.artifact,
                })
              }
            >
              <option value="none">None / corrected</option>
              <option value="overdamped">Overdamped</option>
              <option value="underdamped">Underdamped</option>
              <option value="catheter-whip">Catheter whip</option>
              <option value="wall-contact">Wall contact</option>
              <option value="false-wedge">False wedge</option>
            </select>
          </label>
        </article>

        <article className={styles.skillCard}>
          <div className={styles.cardHeading}>
            <span>02</span>
            <div>
              <h3>Advance by morphology</h3>
              <p>
                Confirm the waveform at every transition; depth is a contextual cue, not the
                endpoint.
              </p>
            </div>
          </div>
          <div className={styles.positionTrack} aria-label="PAC position sequence">
            {(['introducer', 'ra', 'rv', 'pa', 'wedge'] as const).map((position) => (
              <span key={position} data-active={state.catheter.position === position}>
                {position.toUpperCase()}
              </span>
            ))}
          </div>
          <div className={styles.buttonRow}>
            <button type="button" onClick={() => dispatch({ type: 'RETRACT_CATHETER' })}>
              Retract
            </button>
            <button
              type="button"
              disabled={state.catheter.position === 'pa' || state.catheter.position === 'wedge'}
              onClick={() => dispatch({ type: 'ADVANCE_CATHETER' })}
            >
              Advance
            </button>
          </div>
          <dl className={styles.compactFacts}>
            <div>
              <dt>RA</dt>
              <dd>a/c/v waves; low pressure</dd>
            </div>
            <div>
              <dt>RV</dt>
              <dd>sharp systolic rise; low diastolic pressure</dd>
            </div>
            <div>
              <dt>PA</dt>
              <dd>diastolic step-up + pulmonic closure notch</dd>
            </div>
            <div>
              <dt>PAWP</dt>
              <dd>atrial morphology; obtain only with brief balloon inflation</dd>
            </div>
          </dl>
        </article>

        <article className={styles.skillCard}>
          <div className={styles.cardHeading}>
            <span>03</span>
            <div>
              <h3>12-second wedge capture</h3>
              <p>Capture, place an end-expiratory cursor, store, then deflate promptly.</p>
            </div>
          </div>
          <div className={styles.wedgeTimer} data-danger={wedgeElapsed >= 12}>
            <span>{Math.min(15, wedgeElapsed).toFixed(1)} s</span>
            <div>
              <i style={{ width: `${Math.min(100, (wedgeElapsed / 15) * 100)}%` }} />
            </div>
            <small>
              {state.catheter.wedgeCaptureReady
                ? 'Capture complete · place cursor and store'
                : state.catheter.balloonInflated
                  ? 'Capturing…'
                  : 'Balloon deflated'}
            </small>
          </div>
          <div className={styles.buttonRow}>
            <button
              type="button"
              disabled={state.catheter.position !== 'pa'}
              onClick={() => dispatch({ type: 'START_WEDGE' })}
            >
              Inflate + capture
            </button>
            <button
              type="button"
              disabled={!state.catheter.wedgeCaptureReady}
              onClick={() => dispatch({ type: 'PLACE_WEDGE_CURSOR' })}
            >
              End-exp cursor
            </button>
            <button
              type="button"
              disabled={
                state.catheter.wedgeCursorTime === null || state.catheter.storedWedgeMmHg !== null
              }
              onClick={() => dispatch({ type: 'STORE_WEDGE' })}
            >
              Store PAWP
            </button>
            <button
              type="button"
              disabled={!state.catheter.balloonInflated}
              onClick={() => dispatch({ type: 'DEFLATE_WEDGE' })}
            >
              Deflate now
            </button>
          </div>
          {state.catheter.forcedSafetyRecovery && (
            <p className={styles.criticalFeedback} role="alert">
              Safety recovery: prolonged inflation was auto-terminated and recorded as a critical
              error.
            </p>
          )}
        </article>

        <article
          className={`${styles.skillCard} ${styles.thermodilutionCard}`}
          id="cardiac-output-lab"
        >
          <div className={styles.cardHeading}>
            <span>04</span>
            <div>
              <h3>Thermodilution series</h3>
              <p>
                Standardize injectate and timing. Reject technically poor curves; average at least
                three valid accepted trials.
              </p>
            </div>
          </div>
          <div className={styles.injectionSetup}>
            <label>
              Volume
              <select
                value={volumeMl}
                onChange={(event) => setVolumeMl(Number(event.target.value))}
              >
                <option value="5">5 mL</option>
                <option value="10">10 mL</option>
                <option value="15">15 mL</option>
              </select>
            </label>
            <label>
              Temperature
              <select
                value={temperatureC}
                onChange={(event) => setTemperatureC(Number(event.target.value))}
              >
                <option value="4">4 °C</option>
                <option value="5">5 °C</option>
                <option value="20">20 °C</option>
              </select>
            </label>
            <label>
              Respiratory phase
              <select
                value={respiratoryPhase}
                onChange={(event) =>
                  setRespiratoryPhase(
                    event.target.value as ThermodilutionTechnique['respiratoryPhase'],
                  )
                }
              >
                <option value="end-expiration">End expiration</option>
                <option value="inspiration">Inspiration</option>
                <option value="variable">Variable</option>
              </select>
            </label>
            <label>
              Modeled duration <strong>{durationSeconds.toFixed(1)} s</strong>
              <input
                type="range"
                min="0.4"
                max="7"
                step="0.1"
                value={durationSeconds}
                onChange={(event) => setDurationSeconds(Number(event.target.value))}
              />
            </label>
            <label>
              Smoothness <strong>{Math.round(smoothness * 100)}%</strong>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={smoothness}
                onChange={(event) => setSmoothness(Number(event.target.value))}
              />
            </label>
          </div>
          <button
            type="button"
            className={styles.injectButton}
            disabled={state.thermodilutionTrials.length >= configuration.maximumTrials}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onKeyDown={onInjectionKeyDown}
            onKeyUp={onInjectionKeyUp}
            onClick={() => {
              if (ignoreClick.current) {
                ignoreClick.current = false
                return
              }
              generate()
            }}
          >
            Hold to inject · Space is timed · Enter uses {durationSeconds.toFixed(1)} s
          </button>
          <p className={styles.configurationNote}>
            Configured computation constant: {configuration.injectateVolumeMl} mL at{' '}
            {configuration.injectateTemperatureC} °C.
          </p>

          <div className={styles.thermoCurve}>
            <svg
              viewBox="0 0 500 110"
              role="img"
              aria-label={
                latestTrial
                  ? `Thermodilution trial ${latestTrial.sequence}, ${latestTrial.quality}, estimated cardiac output ${latestTrial.estimatedCardiacOutputLMin} liters per minute.`
                  : 'No thermodilution curve generated yet.'
              }
            >
              <path d="M0 18 H500 M0 54 H500 M0 90 H500" stroke="rgba(255,255,255,.1)" />
              {latestTrial && (
                <polyline
                  points={curvePoints(latestTrial)}
                  fill="none"
                  stroke="#72d7c8"
                  strokeWidth="2.5"
                />
              )}
            </svg>
            {latestTrial ? (
              <div>
                <strong>{latestTrial.estimatedCardiacOutputLMin.toFixed(1)} L/min</strong>
                <span data-quality={latestTrial.quality}>{latestTrial.quality}</span>
              </div>
            ) : (
              <p>Generate a trial to display the temperature-time curve.</p>
            )}
          </div>

          <div className={styles.trialList} aria-label="Thermodilution trials">
            {state.thermodilutionTrials.map((trial) => (
              <div key={trial.id}>
                <span>#{trial.sequence}</span>
                <strong>{trial.estimatedCardiacOutputLMin.toFixed(1)}</strong>
                <small>{trial.quality}</small>
                <button
                  type="button"
                  aria-pressed={trial.accepted === true}
                  onClick={() =>
                    dispatch({
                      type: 'SET_THERMODILUTION_ACCEPTED',
                      trialId: trial.id,
                      accepted: true,
                    })
                  }
                >
                  Accept
                </button>
                <button
                  type="button"
                  aria-pressed={trial.accepted === false}
                  onClick={() =>
                    dispatch({
                      type: 'SET_THERMODILUTION_ACCEPTED',
                      trialId: trial.id,
                      accepted: false,
                    })
                  }
                >
                  Reject
                </button>
              </div>
            ))}
          </div>
          <div className={styles.averageReadout}>
            <span>Accepted valid average</span>
            <strong>
              {average === null ? 'Need ≥3 valid trials' : `${average.toFixed(1)} L/min`}
            </strong>
          </div>
          {latestTrial && latestTrial.alerts.length > 0 && (
            <ul className={styles.curveAlerts}>
              {latestTrial.alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  )
}
