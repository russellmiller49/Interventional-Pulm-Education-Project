'use client'

import { useId, useState, type ChangeEvent } from 'react'

import {
  createSyntheticPressureLocalizationResult,
  isPressureLocalizationCombinationSupported,
  pressureLocalizationCandidateSourceIds,
  pressureLocalizationFaults,
  pressureLocalizationSignals,
  pressureLocalizationSites,
  type PressureLocalizationFault,
  type PressureLocalizationPrediction,
  type PressureLocalizationSignal,
  type PressureLocalizationSite,
  type QualitativePressureDirection,
} from '../pressureLocalizationLabModel'
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

interface CircuitPlacementDiagramProps {
  readonly idPrefix: string
  readonly fault: PressureLocalizationFault
  readonly site: PressureLocalizationSite
}

const markerCoordinates: Readonly<
  Record<PressureLocalizationSite, Readonly<{ x: number; y: number }>>
> = {
  'access-catheter': { x: 167, y: 106 },
  'access-line': { x: 282, y: 106 },
  filter: { x: 430, y: 106 },
  'return-line': { x: 580, y: 106 },
  'effluent-line': { x: 430, y: 224 },
}

function CircuitPlacementDiagram({ idPrefix, fault, site }: CircuitPlacementDiagramProps) {
  const marker = markerCoordinates[site]
  const faultLabel = pressureLocalizationFaults.find((candidate) => candidate.id === fault)?.label
  const siteLabel = pressureLocalizationSites.find((candidate) => candidate.id === site)?.label
  const summary = `Selected placement: ${faultLabel?.toLowerCase()} at the ${siteLabel?.toLowerCase()}. Access catheter and access line are separate teaching locations.`

  return (
    <div className={styles.diagramPanel}>
      <p className={styles.diagramSummary}>{summary}</p>
      <div
        className={styles.diagramViewport}
        role="img"
        aria-label={`${summary} Simplified circuit path: patient access, access catheter, access line, filter, return line, then patient return; the effluent line leaves the filter.`}
        tabIndex={0}
      >
        <svg viewBox="0 0 760 290" aria-hidden="true" focusable="false">
          <defs>
            <marker
              id={`${idPrefix}-flow-arrow`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className={styles.flowArrow} />
            </marker>
          </defs>

          <rect x="20" y="70" width="105" height="72" rx="28" className={styles.patient} />
          <text x="72" y="99" textAnchor="middle" className={styles.diagramLabel}>
            Patient
          </text>
          <text x="72" y="120" textAnchor="middle" className={styles.diagramNote}>
            access
          </text>

          <path
            d="M 125 106 H 386"
            className={styles.bloodPath}
            markerEnd={`url(#${idPrefix}-flow-arrow)`}
          />
          <rect x="147" y="88" width="40" height="36" rx="8" className={styles.catheter} />
          <text x="167" y="73" textAnchor="middle" className={styles.diagramNote}>
            Catheter
          </text>
          <text x="282" y="73" textAnchor="middle" className={styles.diagramNote}>
            Access line
          </text>

          <rect x="386" y="54" width="88" height="104" rx="12" className={styles.filter} />
          <path d="M 400 75 L 460 137 M 460 75 L 400 137" className={styles.filterFiber} />
          <text x="430" y="39" textAnchor="middle" className={styles.diagramNote}>
            Filter
          </text>

          <path
            d="M 474 106 H 684"
            className={styles.returnPath}
            markerEnd={`url(#${idPrefix}-flow-arrow)`}
          />
          <text x="580" y="73" textAnchor="middle" className={styles.diagramNote}>
            Return line
          </text>
          <rect x="684" y="70" width="56" height="72" rx="25" className={styles.patient} />
          <text x="712" y="99" textAnchor="middle" className={styles.diagramLabel}>
            Patient
          </text>
          <text x="712" y="120" textAnchor="middle" className={styles.diagramNote}>
            return
          </text>

          <path
            d="M 430 158 V 260"
            className={styles.effluentPath}
            markerEnd={`url(#${idPrefix}-flow-arrow)`}
          />
          <text x="449" y="244" className={styles.diagramNote}>
            Effluent line
          </text>

          <g className={styles.placementMarker} transform={`translate(${marker.x} ${marker.y})`}>
            <circle r="19" />
            <text y="5" textAnchor="middle">
              {fault === 'obstruction' ? 'O' : 'D'}
            </text>
          </g>
        </svg>
      </div>
    </div>
  )
}

export function CrrtPressureLocalizationLab() {
  const idPrefix = `crrt-pressure-lab-${useId().replaceAll(':', '')}`
  const [fault, setFault] = useState<PressureLocalizationFault>('obstruction')
  const [site, setSite] = useState<PressureLocalizationSite>('access-catheter')
  const [prediction, setPrediction] = useState<DraftPrediction>(emptyPrediction)
  const [committedPrediction, setCommittedPrediction] =
    useState<PressureLocalizationPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const result = createSyntheticPressureLocalizationResult(fault, site)
  const predictionComplete = hasCompletePrediction(prediction)

  function clearCommit(nextPrediction: DraftPrediction = emptyPrediction()) {
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
  }

  function revisePrediction() {
    setCommittedPrediction(null)
    setRevealed(false)
  }

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
      data-competency="none"
    >
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>Instructional tool · synthetic directional model</span>
          <h3 id={`${idPrefix}-heading`}>Pressure Localization Lab</h3>
        </div>
        <span className={styles.pendingBadge}>Learner tool</span>
      </header>

      <div className={styles.reviewBoundary} role="note" aria-label="Educational boundary">
        <strong>Learner-available synthetic localization exercise</strong>
        <p>
          This lab makes no competency claim. All values are arbitrary synthetic fixtures—not a
          patient model, device operating range, clinical target, or alarm limit. Learner-mode
          progress may record tool use; the final-SME preview writes nothing.
        </p>
      </div>

      <aside className={styles.sourceNote} aria-label="Source and limitation records">
        <strong>Source and limitation records</strong>
        <p>
          {pressureLocalizationCandidateSourceIds.map((sourceId, index) => (
            <span key={sourceId}>
              {index > 0 ? ', ' : null}
              <code>{sourceId}</code>
            </span>
          ))}
        </p>
        <small>
          These records provide pressure and display-math context only. They do not establish a
          clinical normal or validate a disconnection pattern. That unresolved expression remains
          unavailable without blocking the surrounding exercise.
        </small>
      </aside>

      <p className={styles.intro}>
        Place one available authored obstruction, predict the direction of every pressure signal,
        commit the pattern, and then reveal the deterministic synthetic result. Disconnection is
        visible but unavailable because its source/device expression is unresolved. No alarm
        priority, automatic device response, or correction sequence is modeled.
      </p>

      <div className={styles.scenarioGrid}>
        <fieldset className={styles.choiceFieldset} disabled={committedPrediction !== null}>
          <legend>1. Choose a modeled fault</legend>
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
                      Pattern unavailable because the source/device expression is unresolved
                    </small>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>

        <fieldset className={styles.choiceFieldset} disabled={committedPrediction !== null}>
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
                    <small id={unavailableId}>Pending source and device review</small>
                  ) : null}
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>

      <CircuitPlacementDiagram idPrefix={idPrefix} fault={fault} site={site} />

      <fieldset className={styles.predictionFieldset} disabled={committedPrediction !== null}>
        <legend>3. Predict each signal before reveal</legend>
        <p>
          Choose a direction relative to the synthetic baseline. “Higher” and “lower” refer only to
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
              <button type="button" onClick={() => setRevealed(true)}>
                Reveal synthetic pattern
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
          Prediction committed. The synthetic result is still hidden.
        </p>
      ) : null}

      {committedPrediction !== null && revealed ? (
        <section className={styles.resultPanel} aria-labelledby={`${idPrefix}-result-heading`}>
          <header>
            <span>Synthetic result · no score</span>
            <h4 id={`${idPrefix}-result-heading`}>
              {result.faultLabel} at {result.siteLabel}
            </h4>
          </header>

          <p>{result.locationExplanation}</p>
          <p>{result.modelExplanation}</p>

          <div
            className={styles.tableRegion}
            role="region"
            aria-label="Committed prediction and deterministic synthetic result; horizontally scrollable"
            tabIndex={0}
          >
            <table>
              <caption>Pressure directions relative to the arbitrary synthetic baseline</caption>
              <thead>
                <tr>
                  <th scope="col">Signal</th>
                  <th scope="col">Committed prediction</th>
                  <th scope="col">Synthetic result</th>
                  <th scope="col">Synthetic trace</th>
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

          <p className={styles.resultBoundary}>
            The trace demonstrates model directionality only. It provides no clinical normal,
            threshold, device response, troubleshooting instruction, or patient-specific inference.
          </p>
        </section>
      ) : null}
    </section>
  )
}
