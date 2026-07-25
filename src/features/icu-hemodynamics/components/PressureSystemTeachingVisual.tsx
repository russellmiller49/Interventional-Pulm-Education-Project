'use client'

import { useMemo, useState, type Dispatch } from 'react'

import {
  dynamicResponseChallenges,
  dynamicResponseDefinitions,
  FAST_FLUSH_RELEASE_SECONDS,
  FAST_FLUSH_START_SECONDS,
  fastFlushLineDefinitions,
  formatSignedPressure,
  generateFastFlushWaveform,
  getDynamicResponseChallenge,
  getDynamicResponseDefinition,
  hydrostaticPressureOffsetMmHg,
  levelingPressureTracePath,
  classifyDynamicResponse,
  type DynamicResponseChallengeId,
  type DynamicResponseKind,
  type FastFlushLineType,
} from '../content/pressureSystemVisuals'
import {
  DYNAMIC_RESPONSE_REFERENCE,
  deriveHemodynamicMeasurements,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

interface PressureSystemTeachingVisualProps {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
  /**
   * Uses the actual case measurement system instead of a selectable teaching
   * specimen. This is required in scored or contextual signal-validation work.
   */
  readonly challengeMode?: 'selectable' | 'current-state'
}

function FastFlushTrace({
  response,
  lineType,
  revealLabel,
  compact = false,
}: {
  readonly response: DynamicResponseKind
  readonly lineType: FastFlushLineType
  readonly revealLabel: boolean
  readonly compact?: boolean
}) {
  const definition = getDynamicResponseDefinition(response)
  const waveform = useMemo(
    () => generateFastFlushWaveform(lineType, response),
    [lineType, response],
  )
  const width = 720
  const height = 248
  const plot = { left: 48, right: 14, top: 28, bottom: 34 } as const
  const xForTime = (timeSeconds: number) =>
    plot.left + (timeSeconds / waveform.durationSeconds) * (width - plot.left - plot.right)
  const yForPressure = (pressureMmHg: number) => {
    const bounded = Math.max(
      waveform.line.scaleMinimumMmHg,
      Math.min(waveform.line.scaleMaximumMmHg, pressureMmHg),
    )
    const fraction =
      (bounded - waveform.line.scaleMinimumMmHg) /
      (waveform.line.scaleMaximumMmHg - waveform.line.scaleMinimumMmHg)
    return plot.top + (1 - fraction) * (height - plot.top - plot.bottom)
  }
  const path = waveform.samples
    .map(
      (sample, index) =>
        `${index === 0 ? 'M' : 'L'} ${xForTime(sample.timeSeconds).toFixed(2)} ${yForPressure(sample.pressureMmHg).toFixed(2)}`,
    )
    .join(' ')
  const yTicks =
    lineType === 'pulmonary-artery' ? ([0, 10, 20, 30, 40] as const) : ([40, 80, 120, 160] as const)
  const accessibleSummary = revealLabel
    ? `${waveform.line.label}. ${definition.label}. A pulsatile baseline precedes a 300 mmHg off-scale flush plateau. The valve releases between beats, independently of cardiac phase. ${definition.observation} The tracing then resumes the ${waveform.line.shortLabel} waveform at its continuously advancing cardiac phase. ${definition.pressureEffect}`
    : `${waveform.line.label} observed fast-flush release response. A pulsatile baseline precedes an off-scale flush plateau. The valve releases between beats, independently of cardiac phase, and the tracing resumes the same continuously advancing pressure-wave family. ${definition.observation} Classification is withheld until the learner submits an interpretation.`

  return (
    <figure
      className={styles.fastFlushTrace}
      data-compact={compact || undefined}
      data-line-type={lineType}
    >
      <figcaption>
        <strong>
          {waveform.line.shortLabel} · {revealLabel ? definition.shortLabel : 'Observed response'}
        </strong>
        <span>
          {revealLabel
            ? `${waveform.line.systolicMmHg}/${waveform.line.diastolicMmHg} mmHg baseline · ${definition.observation}`
            : 'Classification withheld'}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={accessibleSummary}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect
          className={styles.fastFlushPlotBackground}
          x={plot.left}
          y={plot.top}
          width={width - plot.left - plot.right}
          height={height - plot.top - plot.bottom}
        />
        {yTicks.map((tick) => {
          const y = yForPressure(tick)
          return (
            <g className={styles.fastFlushAxis} key={tick}>
              <line x1={plot.left} x2={width - plot.right} y1={y} y2={y} />
              <text x={plot.left - 8} y={y + 3} textAnchor="end">
                {tick}
              </text>
            </g>
          )
        })}
        <text
          className={styles.fastFlushAxisTitle}
          transform={`translate(13 ${height / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          pressure (mmHg)
        </text>
        {Array.from({ length: 6 }, (_, second) => {
          const x = xForTime(second)
          return (
            <g className={styles.fastFlushTimeMarker} key={second}>
              <line x1={x} x2={x} y1={plot.top} y2={height - plot.bottom} />
              <text x={x} y={height - 10} textAnchor="middle">
                {second} s
              </text>
            </g>
          )
        })}
        <path className={styles.flushTrace} d={path} />
        <line
          className={styles.flushMarker}
          x1={xForTime(FAST_FLUSH_START_SECONDS)}
          x2={xForTime(FAST_FLUSH_START_SECONDS)}
          y1={plot.top}
          y2={height - plot.bottom}
        />
        <line
          className={styles.flushMarker}
          x1={xForTime(FAST_FLUSH_RELEASE_SECONDS)}
          x2={xForTime(FAST_FLUSH_RELEASE_SECONDS)}
          y1={plot.top}
          y2={height - plot.bottom}
        />
        <text x={xForTime(FAST_FLUSH_START_SECONDS) + 5} y={height - plot.bottom + 14}>
          flush
        </text>
        <text x={xForTime(FAST_FLUSH_RELEASE_SECONDS) + 5} y={height - plot.bottom + 14}>
          release
        </text>
        <text
          className={styles.flushOffScaleLabel}
          x={(xForTime(FAST_FLUSH_START_SECONDS) + xForTime(FAST_FLUSH_RELEASE_SECONDS)) / 2}
          y={plot.top + 12}
          textAnchor="middle"
        >
          flush pressure off scale ≈300 mmHg
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
  const directionSentence = offsetMmHg === 0 ? 'has no leveling offset' : direction
  const transducerY = Math.max(39, Math.min(181, 110 - levelCm * 4.2))
  const traceShift = Math.max(-22, Math.min(22, -offsetMmHg * 1.8))
  const visualSummary = `The pressure transducer is ${levelPosition}. The modeled leveling contribution is ${formatSignedPressure(offsetMmHg)}, so the displayed pressure ${directionSentence}. Waveform morphology and pulse pressure are unchanged by leveling alone.`

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
  challengeMode = 'selectable',
}: PressureSystemTeachingVisualProps) {
  const [challengeId, setChallengeId] = useState<DynamicResponseChallengeId>('response-b')
  const [hasRunFlush, setHasRunFlush] = useState(false)
  const [observedResponse, setObservedResponse] = useState<DynamicResponseKind | null>(null)
  const [classification, setClassification] = useState<DynamicResponseKind | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [lineType, setLineType] = useState<FastFlushLineType>(() =>
    state.catheter.position === 'wedge' || state.catheter.balloonInflated
      ? 'systemic-arterial'
      : 'pulmonary-artery',
  )
  const selectableChallenge = getDynamicResponseChallenge(challengeId)
  const currentResponse = classifyDynamicResponse(state.measurementSystem)
  const response =
    observedResponse ??
    (challengeMode === 'current-state' ? currentResponse : selectableChallenge.response)
  const responseDefinition = getDynamicResponseDefinition(response)
  const classificationCorrect = revealed && classification === response
  const correctionComplete =
    state.signalValidationChecks.includes('dynamic-response-corrected') ||
    (state.measurementSystem.artifact === 'none' &&
      state.measurementSystem.dampingRatio >= DYNAMIC_RESPONSE_REFERENCE.underdampedBelow &&
      state.measurementSystem.dampingRatio <= DYNAMIC_RESPONSE_REFERENCE.overdampedAbove)
  const paFlushUnsafe =
    lineType === 'pulmonary-artery' &&
    (state.catheter.position === 'wedge' || state.catheter.balloonInflated)

  function chooseChallenge(nextChallengeId: DynamicResponseChallengeId) {
    const nextChallenge = getDynamicResponseChallenge(nextChallengeId)
    setChallengeId(nextChallengeId)
    setHasRunFlush(false)
    setObservedResponse(null)
    setClassification(null)
    setRevealed(false)
    dispatch({
      type: 'SET_ARTIFACT',
      artifact: getDynamicResponseDefinition(nextChallenge.response).artifact,
    })
  }

  function runFastFlush() {
    if (paFlushUnsafe) return
    dispatch({ type: 'FAST_FLUSH', lineType })
    setObservedResponse(
      challengeMode === 'current-state'
        ? classifyDynamicResponse(state.measurementSystem)
        : selectableChallenge.response,
    )
    setHasRunFlush(true)
    setClassification(null)
    setRevealed(false)
  }

  function chooseLineType(nextLineType: FastFlushLineType) {
    setLineType(nextLineType)
    setHasRunFlush(false)
    setObservedResponse(null)
    setClassification(null)
    setRevealed(false)
  }

  function checkClassification() {
    if (!classification) return
    setRevealed(true)
    if (classification === response) {
      dispatch({ type: 'VALIDATE_SIGNAL', check: 'dynamic-response-classified' })
    }
  }

  function correctDynamicResponse() {
    dispatch({ type: 'SET_DAMPING', dampingRatio: 0.65 })
    dispatch({ type: 'SET_ARTIFACT', artifact: 'none' })
    dispatch({ type: 'VALIDATE_SIGNAL', check: 'dynamic-response-corrected' })
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
              The valve releases between beats: ringing begins immediately while the underlying
              cardiac cycle continues. Run the selected line, inspect the release trace, then
              classify it before feedback appears.
            </p>
          </div>
          {challengeMode === 'selectable' ? (
            <label>
              Concealed line
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
          ) : (
            <span className={styles.currentSignalBadge}>Current patient signal</span>
          )}
        </header>

        <fieldset className={styles.fastFlushLineToggle}>
          <legend>Line type</legend>
          {(
            Object.values(
              fastFlushLineDefinitions,
            ) as readonly (typeof fastFlushLineDefinitions)[FastFlushLineType][]
          ).map((line) => (
            <label key={line.id}>
              <input
                type="radio"
                name="fast-flush-line-type"
                value={line.id}
                checked={lineType === line.id}
                onChange={() => chooseLineType(line.id)}
              />
              <span>
                <strong>{line.label}</strong>
                <small>
                  {line.systolicMmHg}/{line.diastolicMmHg} mmHg · fixed {line.scaleMinimumMmHg}–
                  {line.scaleMaximumMmHg} mmHg scale
                </small>
              </span>
            </label>
          ))}
        </fieldset>

        {lineType === 'pulmonary-artery' ? (
          <p className={styles.paFlushSafetyBanner} role={paFlushUnsafe ? 'alert' : 'note'}>
            <strong>PA safety.</strong> Confirm a pulmonary-artery waveform and a fully deflated
            balloon before performing a fast-flush response check. Never fast-flush a wedged or
            spontaneously wedged catheter.
            {paFlushUnsafe
              ? ' The current simulated catheter state does not meet this prerequisite.'
              : ''}
          </p>
        ) : null}

        <button
          type="button"
          className={styles.fastFlushButton}
          disabled={paFlushUnsafe}
          onClick={runFastFlush}
        >
          Run {lineType === 'pulmonary-artery' ? 'PA-catheter' : 'arterial-line'} fast-flush
          response check
        </button>

        {hasRunFlush ? (
          <>
            <FastFlushTrace response={response} lineType={lineType} revealLabel={revealed} />
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
                    {revealed && definition.id === response ? (
                      <em className={styles.optionStateText}>Reference pattern</em>
                    ) : revealed && classification === definition.id ? (
                      <em className={styles.optionStateText}>Selected response</em>
                    ) : null}
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
            The selected line&apos;s release trace will appear after the fast-flush response check.
            Other pressure channels will continue normally.
          </div>
        )}

        {revealed ? (
          <div
            className={styles.dynamicResponseFeedback}
            data-correct={classificationCorrect || undefined}
            role="status"
            aria-label="Dynamic response feedback"
          >
            <strong>{classificationCorrect ? 'Pattern aligned.' : 'Compare the response.'}</strong>{' '}
            This is an {responseDefinition.label.toLowerCase()}. {responseDefinition.interpretation}{' '}
            {responseDefinition.pressureEffect}
          </div>
        ) : null}

        {challengeMode === 'current-state' && classificationCorrect && response !== 'acceptable' ? (
          <button
            type="button"
            className={styles.checkResponseButton}
            disabled={correctionComplete}
            onClick={correctDynamicResponse}
          >
            {correctionComplete
              ? 'Dynamic response corrected'
              : 'Resolve the pressure-system response'}
          </button>
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
                  <FastFlushTrace
                    response={definition.id}
                    lineType={lineType}
                    revealLabel
                    compact
                  />
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
