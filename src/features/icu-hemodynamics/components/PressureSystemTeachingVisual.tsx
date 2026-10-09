'use client'

import { useState, type Dispatch } from 'react'

import {
  dynamicResponseChallenges,
  dynamicResponseDefinitions,
  fastFlushLineDefinitions,
  getDynamicResponseChallenge,
  getDynamicResponseDefinition,
  classifyDynamicResponse,
  type DynamicResponseChallengeId,
  type DynamicResponseKind,
  type FastFlushLineType,
} from '../content/pressureSystemVisuals'
import {
  DYNAMIC_RESPONSE_REFERENCE,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import { DynamicResponseComparison, FastFlushTrace } from './FastFlushTrace'
import { LevelingVisual } from './LevelingVisual'
import styles from './icu-hemodynamics.module.css'

export { FastFlushTrace } from './FastFlushTrace'
export { LevelingVisual } from './LevelingVisual'

interface PressureSystemTeachingVisualProps {
  readonly state: HemodynamicSimulationState
  readonly dispatch: Dispatch<HemodynamicAction>
  /**
   * Uses the actual case measurement system instead of a selectable teaching
   * specimen. This is required in scored or contextual signal-validation work.
   */
  readonly challengeMode?: 'selectable' | 'current-state'
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

        {revealed ? <DynamicResponseComparison lineType={lineType} headingLevel="h5" /> : null}

        <p className={styles.pressureVisualBoundary} role="note">
          Drawn by the simulator, not recorded from a device.
        </p>
      </section>
    </div>
  )
}
