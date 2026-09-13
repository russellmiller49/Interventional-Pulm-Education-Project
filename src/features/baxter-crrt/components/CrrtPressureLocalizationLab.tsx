'use client'

import { useEffect, useId, useState, type ChangeEvent } from 'react'

import {
  createSyntheticPressureLocalizationResult,
  isPressureLocalizationCombinationSupported,
  pressureLocalizationFaults,
  pressureLocalizationSignals,
  pressureLocalizationSites,
  type PressureLocalizationFault,
  type PressureLocalizationPrediction,
  type PressureLocalizationSignal,
  type PressureLocalizationSite,
  type QualitativePressureDirection,
} from '../pressureLocalizationLabModel'
import { CrrtPilotCircuit } from './CrrtPilotCircuit'
import type { CrrtCircuitNodeId } from '../content/circuitModel'
import styles from './crrt-pressure-localization-lab.module.css'

type DraftPrediction = Record<PressureLocalizationSignal, QualitativePressureDirection | null>

const qualitativeOptions: readonly {
  id: QualitativePressureDirection
  label: string
}[] = [
  { id: 'lower', label: 'Lower' },
  { id: 'unchanged', label: 'Unchanged' },
  { id: 'higher', label: 'Higher' },
]

function emptyPrediction(): DraftPrediction {
  return {
    access: null,
    filter: null,
    return: null,
    effluent: null,
    tmp: null,
    'filter-drop': null,
  }
}

function hasCompletePrediction(
  prediction: DraftPrediction,
): prediction is PressureLocalizationPrediction {
  return pressureLocalizationSignals.every(({ id }) => prediction[id] !== null)
}

function directionLabel(direction: QualitativePressureDirection): string {
  return qualitativeOptions.find((option) => option.id === direction)?.label ?? direction
}

function formatSyntheticPressure(value: number): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} mmHg`
}

const nodeForSite: Record<PressureLocalizationSite, CrrtCircuitNodeId> = {
  'access-catheter': 'access-lumen',
  'access-line': 'access-pressure',
  filter: 'filter',
  'return-line': 'return-pressure',
  'effluent-line': 'effluent-pressure',
}

export interface CrrtPressureLocalizationLabProps {
  readonly onPhaseChange?: (phase: 'predict' | 'act' | 'observe' | 'explain') => void
  readonly onPredictionCommitted?: (prediction: PressureLocalizationPrediction) => void
  readonly onFeedbackDisplayed?: (prediction: PressureLocalizationPrediction) => void
  readonly onCompletionEvidence?: (prediction: PressureLocalizationPrediction) => void
  readonly initialSite?: PressureLocalizationSite
  readonly lockedPlacement?: boolean
}

export function CrrtPressureLocalizationLab({
  onPhaseChange,
  onPredictionCommitted,
  onFeedbackDisplayed,
  onCompletionEvidence,
  initialSite = 'access-catheter',
  lockedPlacement = false,
}: CrrtPressureLocalizationLabProps = {}) {
  const idPrefix = `crrt-pressure-lab-${useId().replaceAll(':', '')}`
  const [completionReported, setCompletionReported] = useState(false)
  const [fault, setFault] = useState<PressureLocalizationFault>('obstruction')
  const [site, setSite] = useState<PressureLocalizationSite>(initialSite)
  const [prediction, setPrediction] = useState<DraftPrediction>(emptyPrediction)
  const [committedPrediction, setCommittedPrediction] =
    useState<PressureLocalizationPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const result = createSyntheticPressureLocalizationResult(fault, site)
  const displayedSnapshot = revealed ? result.revealed : result.baseline
  const predictionComplete = hasCompletePrediction(prediction)

  function clearCommit(nextPrediction: DraftPrediction = emptyPrediction()) {
    setCompletionReported(false)
    setPrediction(nextPrediction)
    setCommittedPrediction(null)
    setRevealed(false)
  }

  function changeFault(event: ChangeEvent<HTMLInputElement>) {
    const nextFault = event.currentTarget.value as PressureLocalizationFault
    const nextSite = isPressureLocalizationCombinationSupported(nextFault, site)
      ? site
      : pressureLocalizationSites.find((candidate) =>
          isPressureLocalizationCombinationSupported(nextFault, candidate.id),
        )?.id
    if (nextSite === undefined) return
    setFault(nextFault)
    setSite(nextSite)
    clearCommit()
  }

  function changeSite(event: ChangeEvent<HTMLInputElement>) {
    setSite(event.currentTarget.value as PressureLocalizationSite)
    clearCommit()
  }

  function changePrediction(
    signal: PressureLocalizationSignal,
    direction: QualitativePressureDirection,
  ) {
    setPrediction((current) => ({ ...current, [signal]: direction }))
  }

  function commitPrediction() {
    if (!hasCompletePrediction(prediction)) return
    setCommittedPrediction({ ...prediction })
    setRevealed(false)
    onPredictionCommitted?.({ ...prediction })
    onPhaseChange?.('act')
  }

  function revealResult() {
    setRevealed(true)
    onPhaseChange?.('observe')
  }

  function revisePrediction() {
    setCompletionReported(false)
    setCommittedPrediction(null)
    setRevealed(false)
  }

  useEffect(() => {
    if (revealed && committedPrediction) onFeedbackDisplayed?.(committedPrediction)
  }, [revealed, committedPrediction, onFeedbackDisplayed])

  return (
    <section
      className={styles.lab}
      aria-labelledby={`${idPrefix}-heading`}
      data-reviewer-only="false"
      data-review-metadata="informational"
      data-analytics="allowlisted"
      data-scoring="tool-specific"
      data-progress-write="learner-mode-only"
      data-persistence="learner-mode-only"
      onFocusCapture={() => onPhaseChange?.('predict')}
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Instructional tool · pressure-pattern reasoning</span>
          <h3 id={`${idPrefix}-heading`}>Pressure Localization Lab</h3>
        </div>
        <span className={styles.pendingBadge}>Practice tool</span>
      </header>

      <div className={styles.reviewBoundary} role="note" aria-label="Educational boundary">
        <strong>Known fault → predict and explain the pressure response</strong>
        <p>
          The values are simplified for education. They are not a patient model, device operating
          range, clinical target, or alarm limit.
        </p>
      </div>

      <div className={styles.sourceNote} aria-label="Lab scope" role="note">
        <strong>Scope of this lab</strong>
        <small>
          The exercise uses manufacturer-referenced pressure relationships to teach direction and
          localization. It does not establish a clinical normal or validate a disconnection pattern.
        </small>
      </div>

      <p className={styles.intro}>
        {lockedPlacement
          ? 'For the known return-line obstruction, predict each pressure change, then reveal the pattern.'
          : 'Choose an obstruction site, predict how each pressure will change, then reveal the pressure pattern.'}{' '}
        Disconnection is unavailable because a supported disconnection pattern is not included in
        this exercise. Alarm priority, automatic device response, and troubleshooting steps are
        outside this lab.
      </p>

      {!lockedPlacement ? (
        <div className={styles.scenarioGrid}>
          <fieldset
            className={styles.choiceFieldset}
            disabled={committedPrediction !== null || lockedPlacement}
          >
            <legend>1. Choose a circuit problem</legend>
            <div className={styles.segmentedChoices}>
              {pressureLocalizationFaults.map((candidate) => {
                const supported = pressureLocalizationSites.some((candidateSite) =>
                  isPressureLocalizationCombinationSupported(candidate.id, candidateSite.id),
                )
                const unavailableId = `${idPrefix}-${candidate.id}-unavailable`
                return (
                  <label key={candidate.id} data-supported={supported}>
                    <input
                      type="radio"
                      name={`${idPrefix}-fault`}
                      value={candidate.id}
                      checked={fault === candidate.id}
                      disabled={!supported}
                      aria-label={candidate.label}
                      aria-describedby={!supported ? unavailableId : undefined}
                      onChange={changeFault}
                    />
                    <span>{candidate.label}</span>
                    {!supported ? (
                      <small id={unavailableId}>
                        Pattern unavailable in this version of the lab
                      </small>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <fieldset
            className={styles.choiceFieldset}
            disabled={committedPrediction !== null || lockedPlacement}
          >
            <legend>2. Place it on the circuit</legend>
            <div className={styles.siteChoices}>
              {pressureLocalizationSites.map((candidate) => {
                const supported = isPressureLocalizationCombinationSupported(fault, candidate.id)
                const unavailableId = `${idPrefix}-${candidate.id}-unavailable`
                return (
                  <label key={candidate.id} data-supported={supported}>
                    <input
                      type="radio"
                      name={`${idPrefix}-site`}
                      value={candidate.id}
                      checked={site === candidate.id}
                      disabled={!supported}
                      aria-label={candidate.label}
                      aria-describedby={!supported ? unavailableId : undefined}
                      onChange={changeSite}
                    />
                    <span>{candidate.label}</span>
                    {!supported ? (
                      <small id={unavailableId}>Unavailable in this version of the lab</small>
                    ) : null}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </div>
      ) : null}

      <p className={styles.diagramSummary}>
        Selected placement: {result.faultLabel} at the {result.siteLabel.toLowerCase()}. Access
        catheter and access line are separate teaching locations, but these pressures alone cannot
        distinguish them.
      </p>
      {lockedPlacement ? <p>Return-line obstruction is fixed for this guided comparison.</p> : null}
      {site === 'effluent-line' ? (
        <p role="note">
          This fixture imposes an illustrative effluent-pressure change. It does not specify
          obstruction position relative to the sensor and pump or model pump regulation, so it
          cannot establish a universal obstruction direction.
        </p>
      ) : null}
      <CrrtPilotCircuit
        presentation="focused"
        overlayId="pressure-profile"
        running={false}
        setReady
        fluidsReady
        bloodFlowMlMin={100}
        dialysateFlowMlHour={null}
        patientFluidRemovalMlHour={null}
        highlightedNodeId={nodeForSite[site]}
        pressure={{
          access: displayedSnapshot.accessPressureMmHg,
          filter: displayedSnapshot.filterPressureMmHg,
          return: displayedSnapshot.returnPressureMmHg,
          effluent: displayedSnapshot.effluentPressureMmHg,
          TMP: displayedSnapshot.tmpMmHg,
          filterDrop: displayedSnapshot.filterPressureDropMmHg,
        }}
      />

      <fieldset className={styles.predictionFieldset} disabled={committedPrediction !== null}>
        <legend>3. Predict each signal before reveal</legend>
        <p>
          Choose a direction relative to the starting values. “Higher” and “lower” refer only to
          numeric direction, including for negative values.
        </p>
        <div className={styles.predictionGrid}>
          {pressureLocalizationSignals.map((signal) => (
            <fieldset key={signal.id} className={styles.signalPrediction}>
              <legend>{signal.label}</legend>
              <div>
                {qualitativeOptions.map((option) => (
                  <label key={option.id}>
                    <input
                      type="radio"
                      name={`${idPrefix}-${signal.id}-prediction`}
                      value={option.id}
                      checked={prediction[signal.id] === option.id}
                      onChange={() => changePrediction(signal.id, option.id)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        {committedPrediction === null ? (
          <button type="button" disabled={!predictionComplete} onClick={commitPrediction}>
            Commit prediction
          </button>
        ) : (
          <>
            {!revealed ? (
              <button type="button" onClick={revealResult}>
                Reveal pressure pattern
              </button>
            ) : null}
            <button type="button" className={styles.secondaryButton} onClick={revisePrediction}>
              Revise prediction
            </button>
          </>
        )}
      </div>

      {committedPrediction !== null && !revealed ? (
        <p className={styles.commitStatus} role="status">
          Prediction submitted. The pressure result is still hidden.
        </p>
      ) : null}

      {committedPrediction !== null && revealed ? (
        <section className={styles.resultPanel} aria-labelledby={`${idPrefix}-result-heading`}>
          <header>
            <span>Modeled pressure result</span>
            <h4 id={`${idPrefix}-result-heading`}>
              {result.faultLabel} at {result.siteLabel}
            </h4>
          </header>

          <p>{result.locationExplanation}</p>
          <p>{result.modelExplanation}</p>

          <div
            className={styles.tableRegion}
            role="region"
            aria-label="Submitted prediction and pressure result; horizontally scrollable"
            tabIndex={0}
          >
            <table>
              <caption>Pressure directions relative to the starting values</caption>
              <thead>
                <tr>
                  <th scope="col">Signal</th>
                  <th scope="col">Submitted prediction</th>
                  <th scope="col">Observed direction</th>
                  <th scope="col">Pressure trace</th>
                </tr>
              </thead>
              <tbody>
                {result.signals.map((signal) => (
                  <tr key={signal.id}>
                    <th scope="row">{signal.label}</th>
                    <td>{directionLabel(committedPrediction[signal.id])}</td>
                    <td>{directionLabel(signal.direction)}</td>
                    <td>
                      {formatSyntheticPressure(signal.baselineMmHg)} →{' '}
                      {formatSyntheticPressure(signal.revealedMmHg)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={completionReported}
            onClick={() => {
              if (!committedPrediction || !revealed || completionReported) return
              setCompletionReported(true)
              onPhaseChange?.('explain')
              onCompletionEvidence?.(committedPrediction)
            }}
          >
            Review pressure comparison and continue
          </button>
          <p className={styles.resultBoundary}>
            This trace demonstrates pressure direction only. It does not provide a clinical normal,
            alarm limit, automatic device response, troubleshooting sequence, or patient-specific
            conclusion.
          </p>
        </section>
      ) : null}
    </section>
  )
}
