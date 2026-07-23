'use client'

import { useMemo, useState, type Dispatch } from 'react'

import {
  dynamicResponseChallenges,
  dynamicResponseDefinitions,
  fastFlushTracePath,
  formatSignedPressure,
  getDynamicResponseChallenge,
  getDynamicResponseDefinition,
  hydrostaticPressureOffsetMmHg,
  levelingPressureTracePath,
  type DynamicResponseChallengeId,
  type DynamicResponseKind,
} from '../content/pressureSystemVisuals'
import {
  deriveHemodynamicMeasurements,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

interface PressureSystemTeachingVisualProps {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
}

function FastFlushTrace({
  response,
  revealLabel,
  compact = false,
}: {
  readonly response: DynamicResponseKind
  readonly revealLabel: boolean
  readonly compact?: boolean
}) {
  const definition = getDynamicResponseDefinition(response)
  const accessibleSummary = revealLabel
    ? `${definition.label}. ${definition.observation} ${definition.pressureEffect}`
    : `Observed fast-flush release response. ${definition.observation} Classification is withheld until the learner submits an interpretation.`

  return (
    <figure className={styles.fastFlushTrace} data-compact={compact || undefined}>
      <figcaption>
        <strong>{revealLabel ? definition.shortLabel : 'Observed response'}</strong>
        <span>{revealLabel ? definition.observation : 'Classification withheld'}</span>
      </figcaption>
      <svg viewBox="0 0 300 112" role="img" aria-label={accessibleSummary}>
        <path
          className={styles.pressureGrid}
          d="M 0 18 H 300 M 0 43 H 300 M 0 68 H 300 M 0 93 H 300"
        />
        <path className={styles.flushTrace} d={fastFlushTracePath(response)} />
        <line className={styles.flushMarker} x1="38" x2="38" y1="7" y2="104" />
        <line className={styles.flushMarker} x1="126" x2="126" y1="7" y2="104" />
        <text x="42" y="12">
          flush
        </text>
        <text x="130" y="12">
          release
        </text>
      </svg>
    </figure>
  )
}

function LevelingVisual({ state }: { readonly state: HemodynamicSimulationState }) {
  const levelCm = state.measurementSystem.transducerLevelCm
  const offsetMmHg = hydrostaticPressureOffsetMmHg(levelCm)
  const referenceMeasurements = useMemo(
    () =>
      deriveHemodynamicMeasurements(state.parameters, {
        ...state.measurementSystem,
        transducerLevelCm: 0,
      }),
    [state.measurementSystem, state.parameters],
  )
  const levelPosition =
    levelCm === 0
      ? 'at the phlebostatic axis'
      : `${Math.abs(levelCm).toFixed(0)} centimeters ${levelCm > 0 ? 'above' : 'below'} the phlebostatic axis`
  const direction =
    offsetMmHg === 0 ? 'no leveling offset' : offsetMmHg > 0 ? 'reads high' : 'reads low'
  const transducerY = Math.max(39, Math.min(181, 110 - levelCm * 4.2))
  const traceShift = Math.max(-22, Math.min(22, -offsetMmHg * 1.8))
  const visualSummary = `The pressure transducer is ${levelPosition}. The modeled leveling contribution is ${formatSignedPressure(offsetMmHg)}, so the displayed pressure ${direction}. Waveform morphology and pulse pressure are unchanged by leveling alone.`

  return (
    <section className={styles.levelingTeachingCard} aria-labelledby="leveling-visual-title">
      <header>
        <div>
          <span>Hydrostatic leveling</span>
          <h4 id="leveling-visual-title">Leveling changes the number, not the waveform</h4>
        </div>
        <strong data-offset={offsetMmHg === 0 ? 'neutral' : offsetMmHg > 0 ? 'high' : 'low'}>
          {formatSignedPressure(offsetMmHg)}
        </strong>
      </header>

      <div className={styles.levelingVisualGrid}>
        <svg
          className={styles.levelingPatientDiagram}
          viewBox="0 0 580 220"
          role="img"
          aria-label={visualSummary}
        >
          <rect className={styles.levelingBed} x="26" y="166" width="370" height="18" rx="9" />
          <path
            className={styles.levelingPatient}
            d="M 75 139 C 100 115, 145 105, 198 108 C 242 110, 279 124, 322 139 L 349 165 L 67 165 Z"
          />
          <circle className={styles.levelingPatient} cx="68" cy="126" r="31" />
          <line className={styles.levelingAxis} x1="28" x2="550" y1="110" y2="110" />
          <circle className={styles.levelingAxisPoint} cx="185" cy="110" r="7" />
          <text className={styles.levelingAxisLabel} x="195" y="100">
            Phlebostatic axis
          </text>
          <line className={styles.levelingMeasure} x1="465" x2="465" y1="110" y2={transducerY} />
          <line className={styles.levelingMeasureCap} x1="450" x2="480" y1="110" y2="110" />
          <line
            className={styles.levelingMeasureCap}
            x1="450"
            x2="480"
            y1={transducerY}
            y2={transducerY}
          />
          <g transform={`translate(480 ${transducerY - 18})`}>
            <rect className={styles.transducerBody} width="72" height="36" rx="8" />
            <circle className={styles.transducerPort} cx="12" cy="18" r="5" />
            <text className={styles.transducerLabel} x="22" y="22">
              transducer
            </text>
          </g>
          <text className={styles.levelingDeltaLabel} x="455" y={transducerY > 110 ? 148 : 72}>
            {levelCm > 0 ? '+' : ''}
            {levelCm.toFixed(0)} cm
          </text>
        </svg>

        <div className={styles.levelingPressureComparison}>
          <div className={styles.levelingLegend} aria-hidden="true">
            <span data-line="reference">Reference level</span>
            <span data-line="current">Current display</span>
          </div>
          <svg
            viewBox="0 0 388 92"
            role="img"
            aria-label={`The same pressure-wave morphology is shown twice. The current display is shifted by ${formatSignedPressure(offsetMmHg)} compared with reference level.`}
          >
            <path className={styles.pressureGrid} d="M 0 18 H 388 M 0 46 H 388 M 0 74 H 388" />
            <path className={styles.levelingReferenceTrace} d={levelingPressureTracePath} />
            <path
              className={styles.levelingCurrentTrace}
              d={levelingPressureTracePath}
              transform={`translate(0 ${traceShift.toFixed(1)})`}
            />
          </svg>
          <dl>
            <div>
              <dt>Same system at reference level</dt>
              <dd>{referenceMeasurements.mapMmHg.toFixed(0)} mmHg MAP</dd>
            </div>
            <div>
              <dt>Current displayed MAP</dt>
              <dd>{state.measurements.mapMmHg.toFixed(0)} mmHg</dd>
            </div>
            <div>
              <dt>Direction</dt>
              <dd>{direction}</dd>
            </div>
          </dl>
        </div>
      </div>

      {!state.measurementSystem.zeroed ? (
        <p className={styles.levelingBoundary} role="note">
          Zero is still required. This comparison isolates the modeled leveling contribution only.
        </p>
      ) : null}
    </section>
  )
}

export function PressureSystemTeachingVisual({
  state,
  dispatch,
}: PressureSystemTeachingVisualProps) {
  const [challengeId, setChallengeId] = useState<DynamicResponseChallengeId>('response-b')
  const [hasRunFlush, setHasRunFlush] = useState(false)
  const [classification, setClassification] = useState<DynamicResponseKind | null>(null)
  const [revealed, setRevealed] = useState(false)
  const challenge = getDynamicResponseChallenge(challengeId)
  const responseDefinition = getDynamicResponseDefinition(challenge.response)
  const classificationCorrect = revealed && classification === challenge.response

  function chooseChallenge(nextChallengeId: DynamicResponseChallengeId) {
    const nextChallenge = getDynamicResponseChallenge(nextChallengeId)
    setChallengeId(nextChallengeId)
    setHasRunFlush(false)
    setClassification(null)
    setRevealed(false)
    dispatch({
      type: 'SET_ARTIFACT',
      artifact: getDynamicResponseDefinition(nextChallenge.response).artifact,
    })
  }

  function runFastFlush() {
    dispatch({ type: 'FAST_FLUSH' })
    setHasRunFlush(true)
    setClassification(null)
    setRevealed(false)
  }

  function checkClassification() {
    if (!classification) return
    setRevealed(true)
    if (classification === challenge.response) {
      dispatch({ type: 'VALIDATE_SIGNAL', check: 'dynamic-response-classified' })
    }
  }

  return (
    <div className={styles.pressureSystemTeaching}>
      <LevelingVisual state={state} />

      <section className={styles.fastFlushTeachingCard} aria-labelledby="fast-flush-visual-title">
        <header>
          <div>
            <span>Dynamic response</span>
            <h4 id="fast-flush-visual-title">Fast-flush release response</h4>
            <p>
              Run the test, inspect the release trace, then classify it before feedback appears.
            </p>
          </div>
          <label>
            Concealed test
            <select
              value={challengeId}
              onChange={(event) =>
                chooseChallenge(event.target.value as DynamicResponseChallengeId)
              }
            >
              {dynamicResponseChallenges.map((candidate) => (
                <option value={candidate.id} key={candidate.id}>
                  {candidate.label}
                </option>
              ))}
            </select>
          </label>
        </header>

        <button type="button" className={styles.fastFlushButton} onClick={runFastFlush}>
          Fast flush test
        </button>

        {hasRunFlush ? (
          <>
            <FastFlushTrace response={challenge.response} revealLabel={revealed} />
            <fieldset className={styles.dynamicResponsePrediction}>
              <legend>Classify the observed release response</legend>
              {dynamicResponseDefinitions.map((definition) => (
                <label key={definition.id}>
                  <input
                    type="radio"
                    name="dynamic-response-classification"
                    value={definition.id}
                    checked={classification === definition.id}
                    onChange={() => {
                      setClassification(definition.id)
                      setRevealed(false)
                    }}
                  />
                  <span>
                    <strong>{definition.shortLabel}</strong>
                    <small>{definition.observation}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              className={styles.checkResponseButton}
              disabled={!classification}
              onClick={checkClassification}
            >
              Check classification
            </button>
          </>
        ) : (
          <div className={styles.fastFlushPlaceholder} role="status">
            The release trace will appear after the fast-flush test.
          </div>
        )}

        {revealed ? (
          <div
            className={styles.dynamicResponseFeedback}
            data-correct={classificationCorrect || undefined}
            role="status"
            aria-label="Dynamic response feedback"
          >
            <strong>{classificationCorrect ? 'Correct.' : 'Compare the response.'}</strong> This is
            an {responseDefinition.label.toLowerCase()}. {responseDefinition.interpretation}{' '}
            {responseDefinition.pressureEffect}
          </div>
        ) : null}

        {revealed ? (
          <div className={styles.dynamicResponseAtlas} aria-labelledby="response-atlas-title">
            <header>
              <span>Comparison atlas</span>
              <h5 id="response-atlas-title">Three qualitative release patterns</h5>
            </header>
            <div>
              {dynamicResponseDefinitions.map((definition) => (
                <article key={definition.id}>
                  <FastFlushTrace response={definition.id} revealLabel compact />
                  <p>{definition.pressureEffect}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <p className={styles.pressureVisualBoundary} role="note">
          Qualitative educational rendering—not a calibrated device trace. Confirm bedside technique
          with current monitor instructions, local policy, and supervised clinical judgment.
        </p>
      </section>
    </div>
  )
}
