'use client'

import type { Dispatch } from 'react'

import {
  hasHemodynamicMastery,
  measurementMeetsCriterion,
  thermodilutionAcceptedAverage,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import styles from './icu-hemodynamics.module.css'

interface CaseWorkflowProps {
  state: HemodynamicSimulationState
  dispatch: Dispatch<HemodynamicAction>
}

const workflow = [
  ['observe', 'Observe'],
  ['commit', 'Commit'],
  ['measure', 'Validate'],
  ['intervene', 'Intervene'],
  ['response', 'Response'],
  ['reassess', 'Reassess'],
  ['debrief', 'Debrief'],
] as const

function currentMetric(state: HemodynamicSimulationState, metric: keyof typeof state.measurements) {
  const value = state.measurements[metric]
  return typeof value === 'number' ? value.toFixed(metric.includes('cardiac') ? 1 : 0) : '—'
}

export function CaseWorkflow({ state, dispatch }: CaseWorkflowProps) {
  const definition = state.caseDefinition
  const average = thermodilutionAcceptedAverage(state.thermodilutionTrials)
  const controlsUnlocked = state.mode === 'learn' || state.predictionCommitted
  const activePhaseIndex = workflow.findIndex(([id]) => id === state.phase)

  return (
    <section className={styles.caseWorkflow} aria-labelledby="case-workflow-heading">
      <header className={styles.caseHeading}>
        <div>
          <span>
            {definition.id} · v{definition.version}
          </span>
          <h2 id="case-workflow-heading">{definition.title}</h2>
        </div>
        <span className={styles.modeChip}>
          {state.mode === 'learn' ? 'Guided Learn' : 'Scored Practice'}
        </span>
      </header>
      <p className={styles.presentation}>{definition.presentation}</p>

      <ol className={styles.workflowTrack} aria-label="Case workflow">
        {workflow.map(([id, label], index) => (
          <li
            key={id}
            data-active={index === activePhaseIndex}
            data-complete={index < activePhaseIndex}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {state.mode === 'learn' ? (
        <div className={styles.guidedCallout}>
          <span>Guided mechanism</span>
          <strong>
            {
              definition.mechanismOptions.find(
                (option) => option.id === definition.correctMechanismId,
              )?.label
            }
          </strong>
          <p>{definition.guidedPrompt}</p>
        </div>
      ) : (
        <fieldset className={styles.predictionPanel} disabled={state.predictionCommitted}>
          <legend>Commit before intervention</legend>
          <label>
            Suspected hemodynamic mechanism
            <select
              aria-label="Suspected hemodynamic mechanism"
              value={state.selectedMechanismId}
              onChange={(event) => dispatch({ type: 'SELECT_MECHANISM', id: event.target.value })}
            >
              <option value="">Choose a mechanism…</option>
              {definition.mechanismOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Immediate management priority
            <select
              aria-label="Immediate management priority"
              value={state.selectedPriorityId}
              onChange={(event) => dispatch({ type: 'SELECT_PRIORITY', id: event.target.value })}
            >
              <option value="">Choose a priority…</option>
              {definition.priorityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={
              !state.selectedMechanismId || !state.selectedPriorityId || state.predictionCommitted
            }
            onClick={() => dispatch({ type: 'COMMIT_PREDICTION' })}
          >
            {state.predictionCommitted ? 'Prediction locked' : 'Commit phenotype + priority'}
          </button>
        </fieldset>
      )}

      <div className={styles.caseColumns}>
        <article>
          <h3>Obtain and validate</h3>
          <p>Do not make a precise calculation from an imprecise signal.</p>
          <div className={styles.validationChecklist}>
            <button
              type="button"
              data-complete={state.measurementSystem.zeroed}
              onClick={() => dispatch({ type: 'ZERO_TRANSDUCER' })}
            >
              <span>{state.measurementSystem.zeroed ? '✓' : '1'}</span>Level + zero
            </button>
            <button
              type="button"
              data-complete={state.signalValidationChecks.includes('fast-flush')}
              onClick={() => dispatch({ type: 'FAST_FLUSH' })}
            >
              <span>{state.signalValidationChecks.includes('fast-flush') ? '✓' : '2'}</span>
              Fast-flush test
            </button>
            <button
              type="button"
              data-complete={state.signalValidationChecks.includes('waveform-valid')}
              onClick={() => dispatch({ type: 'VALIDATE_SIGNAL', check: 'waveform-valid' })}
            >
              <span>{state.signalValidationChecks.includes('waveform-valid') ? '✓' : '3'}</span>
              Waveform + position
            </button>
            <button
              type="button"
              data-complete={average !== null}
              onClick={() =>
                document
                  .getElementById('cardiac-output-lab')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              <span>{average !== null ? '✓' : '4'}</span>CO series (
              {average === null ? 'pending' : `${average.toFixed(1)} L/min`})
            </button>
          </div>
        </article>

        <article>
          <h3>Intervene in bounded tiers</h3>
          {!controlsUnlocked && (
            <p className={styles.lockMessage}>
              Commit a mechanism and priority to unlock interventions.
            </p>
          )}
          <div className={styles.interventionGrid}>
            {definition.interventions.map((item) => {
              const complete = state.completedInterventionIds.includes(item.id)
              return (
                <button
                  type="button"
                  key={item.id}
                  disabled={!controlsUnlocked || (complete && !item.repeatable)}
                  data-complete={complete}
                  onClick={() => dispatch({ type: 'APPLY_INTERVENTION', intervention: item })}
                >
                  <span>{item.shortLabel}</span>
                  <small>{item.description}</small>
                  {state.mode === 'learn' && item.unsafe && <em>Unsafe in this case</em>}
                </button>
              )
            })}
          </div>
        </article>
      </div>

      <div className={styles.responsePanel} aria-live="polite">
        <div>
          <span>Modeled response</span>
          <strong>
            {state.responseMessage ??
              'Observe the baseline signals, numerics, and patient mechanism.'}
          </strong>
        </div>
        <button type="button" onClick={() => dispatch({ type: 'TICK', seconds: 15 })}>
          Observe next 15 model seconds
        </button>
      </div>

      <div className={styles.criteriaPanel}>
        <div>
          <h3>Reassessment targets</h3>
          <ul>
            {definition.successCriteria.map((criterion) => {
              const met = measurementMeetsCriterion(state.measurements, criterion)
              return (
                <li key={criterion.label} data-met={met}>
                  <span>{met ? '✓' : '○'}</span>
                  {criterion.label}
                  <strong>now {currentMetric(state, criterion.metric)}</strong>
                </li>
              )
            })}
          </ul>
        </div>
        <div className={styles.reassessActions}>
          <button type="button" onClick={() => dispatch({ type: 'REASSESS' })}>
            Reassess perfusion + safety
          </button>
          <button
            type="button"
            disabled={!state.reassessed}
            onClick={() => dispatch({ type: 'COMPLETE_CASE' })}
          >
            Commit final reassessment
          </button>
        </div>
      </div>

      {state.completed && state.score && (
        <div className={styles.debriefPanel} role="region" aria-label="Case score and debrief">
          <div className={styles.scoreRing} data-mastered={hasHemodynamicMastery(state)}>
            <strong>{state.score.total}</strong>
            <span>/100</span>
          </div>
          <div>
            <span>
              {hasHemodynamicMastery(state)
                ? 'Mastery demonstrated'
                : state.criticalErrors.length > 0
                  ? 'Critical safety error: mastery withheld'
                  : 'Continue practice'}
            </span>
            <h3>Case debrief</h3>
            <ul>
              {definition.debrief.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className={styles.scoreBreakdown}>
              <span>Signal {state.score.signalValidity}/20</span>
              <span>Mechanism {state.score.mechanism}/20</span>
              <span>Management {state.score.management}/25</span>
              <span>TD + derived {state.score.thermodilutionAndDerived}/15</span>
              <span>Reassess + safety {state.score.reassessmentAndSafety}/20</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
