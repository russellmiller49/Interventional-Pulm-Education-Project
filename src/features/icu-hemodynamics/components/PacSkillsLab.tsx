'use client'

import {
  useId,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import { requireCardiacOutputParameter } from '../content/cardiacOutputSourceBoundaries'
import {
  thermodilutionAcceptedAverage,
  type HemodynamicAction,
  type HemodynamicSimulationState,
  type ThermodilutionTechnique,
} from '../engine'
import { PressureSystemTeachingVisual } from './PressureSystemTeachingVisual'
import { ThermodilutionSeriesReadout, ThermodilutionTrialCard } from './ThermodilutionTrialReview'
import { TroubleshootingPanel } from './TroubleshootingPanel'
import styles from './icu-hemodynamics.module.css'

interface PacSkillsLabProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
  focus?: 'pressure-system' | 'thermodilution'
  pressureChallengeMode?: 'selectable' | 'current-state'
}

/**
 * H4 §5. The injectate constants belong to a device and a protocol, not to a general rule, so the
 * qualifier travels with them onto the panel rather than being written a second time here.
 */
const INJECTATE_VOLUME_QUALIFIER =
  requireCardiacOutputParameter('injectate-volume').learnerFacingQualifier
const DURATION_WINDOW_QUALIFIER = requireCardiacOutputParameter(
  'injection-duration-window',
).learnerFacingQualifier
const RESPIRATORY_PHASE_QUALIFIER = requireCardiacOutputParameter(
  'respiratory-phase-requirement',
).learnerFacingQualifier

export function PacSkillsLab({
  state,
  dispatch,
  focus,
  pressureChallengeMode = 'selectable',
}: PacSkillsLabProps) {
  const configuration = state.caseDefinition.thermodilution
  const skillsHeadingId = useId()
  const [volumeMl, setVolumeMl] = useState(configuration.injectateVolumeMl)
  const [temperatureC, setTemperatureC] = useState(configuration.injectateTemperatureC)
  const [durationSeconds, setDurationSeconds] = useState(2.5)
  const [smoothness, setSmoothness] = useState(0.95)
  const [respiratoryPhase, setRespiratoryPhase] =
    useState<ThermodilutionTechnique['respiratoryPhase']>('end-expiration')
  const injectionStart = useRef<number | null>(null)
  const ignoreClick = useRef(false)
  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)

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
    <section className={styles.skillsLab} aria-labelledby={skillsHeadingId}>
      <header className={styles.sectionHeader}>
        <div>
          <span>Reusable skills station</span>
          <h2 id={skillsHeadingId}>
            {focus === 'pressure-system'
              ? 'Pressure-system validation lab'
              : focus === 'thermodilution'
                ? 'Thermodilution measurement lab'
                : 'PAC setup, advancement, wedge, and cardiac output'}
          </h2>
        </div>
      </header>

      {!focus ? (
        <ol className={styles.skillSequence} aria-label="PAC skills sequence">
          <li data-complete={Math.abs(state.measurementSystem.transducerLevelCm) <= 1}>
            1 <span>Level transducer</span>
          </li>
          <li data-complete={state.measurementSystem.zeroed}>
            2 <span>Atmospheric zero</span>
          </li>
          <li data-complete={state.signalValidationChecks.includes('dynamic-response-classified')}>
            3 <span>Dynamic response</span>
          </li>
          <li
            data-complete={state.catheter.position === 'pa' || state.catheter.position === 'wedge'}
          >
            4 <span>Advance by waveform</span>
          </li>
          <li data-complete={state.catheter.storedWedgeMmHg !== null}>
            5 <span>Capture PAWP</span>
          </li>
          <li data-complete={average !== null}>
            6 <span>Thermodilution series</span>
          </li>
        </ol>
      ) : null}

      <div className={styles.skillsGrid}>
        {focus !== 'thermodilution' ? (
          <article className={`${styles.skillCard} ${styles.pressureSystemCard}`}>
            <div className={styles.cardHeading}>
              <span>01</span>
              <div>
                <h3>Pressure system</h3>
                <p>
                  Level, zero, read the displayed scale and channel, and classify the dynamic
                  response before interpretation.
                </p>
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
              {focus !== 'pressure-system' ? (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'FAST_FLUSH', lineType: 'pulmonary-artery' })}
                >
                  PA-catheter fast-flush response check
                </button>
              ) : null}
            </div>
            {focus === 'pressure-system' ? (
              <>
                <PressureSystemTeachingVisual
                  state={state}
                  dispatch={dispatch}
                  challengeMode={pressureChallengeMode}
                />
                <TroubleshootingPanel state={state} dispatch={dispatch} />
              </>
            ) : (
              <>
                {state.measurementSystem.lastFastFlushFinding ? (
                  <p className={styles.feedback}>{state.measurementSystem.lastFastFlushFinding}</p>
                ) : null}
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
              </>
            )}
          </article>
        ) : null}

        {focus !== 'pressure-system' ? (
          <article
            className={`${styles.skillCard} ${styles.thermodilutionCard}`}
            id="cardiac-output-lab"
          >
            <div className={styles.cardHeading}>
              <span>{focus === 'thermodilution' ? '05' : '04'}</span>
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
              {configuration.injectateTemperatureC} °C. {INJECTATE_VOLUME_QUALIFIER}{' '}
              {DURATION_WINDOW_QUALIFIER} {RESPIRATORY_PHASE_QUALIFIER}
            </p>

            <div className={styles.trialStack} aria-label="Thermodilution trials">
              {state.thermodilutionTrials.length === 0 ? (
                <p className={styles.thermoTrialWithheld}>
                  No acquisition yet. Say what an acceptable curve should look like for this patient
                  before you generate one.
                </p>
              ) : (
                state.thermodilutionTrials.map((trial) => (
                  <ThermodilutionTrialCard
                    key={trial.id}
                    trial={trial}
                    onReview={() =>
                      dispatch({ type: 'REVIEW_THERMODILUTION_CURVE', trialId: trial.id })
                    }
                    onAccept={() =>
                      dispatch({
                        type: 'SET_THERMODILUTION_ACCEPTED',
                        trialId: trial.id,
                        accepted: true,
                      })
                    }
                    onExclude={(exclusionReasonId) =>
                      dispatch({
                        type: 'SET_THERMODILUTION_ACCEPTED',
                        trialId: trial.id,
                        accepted: false,
                        exclusionReasonId,
                      })
                    }
                  />
                ))
              )}
            </div>

            <ThermodilutionSeriesReadout trials={state.thermodilutionTrials} />
          </article>
        ) : null}
      </div>
    </section>
  )
}
