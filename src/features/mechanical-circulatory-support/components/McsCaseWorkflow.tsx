'use client'

import type { Dispatch } from 'react'
import { Check, Eye, LockKeyhole, RotateCcw, ShieldAlert } from 'lucide-react'

import type { McsAction, McsSimulationState } from '../engine'
import { hasMcsMastery, isMcsActionIdPermitted } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

const phases = ['inspect', 'predict', 'adjust', 'observe', 'reassess', 'debrief'] as const

export function McsCaseWorkflow({
  state,
  dispatch,
}: {
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
}) {
  const scenario = state.scenario
  if (!scenario) {
    return (
      <section className={styles.workflowCard} aria-label="Mechanism Studio instructions">
        <span className={styles.kicker}>OPEN LAB</span>
        <h2>Mechanism Studio</h2>
        <p>
          There is no hidden diagnosis or score. Start with one device and baseline physiology,
          change one setting or loading condition, and compare native flow, device flow, effective
          flow, ventricular loading, pressure, and alarms.
        </p>
        <ol className={styles.studioPrompts}>
          <li>
            <strong>Predict</strong>
            <span>Which signal should move first?</span>
          </li>
          <li>
            <strong>Change</strong>
            <span>Move one bounded control.</span>
          </li>
          <li>
            <strong>Reconcile</strong>
            <span>Explain every pressure and flow change—not only the desired one.</span>
          </li>
        </ol>
      </section>
    )
  }

  const currentPhaseIndex = phases.indexOf(state.scenarioPhase)
  const mastery = state.completed && hasMcsMastery(state)
  const assessmentMasked = state.section === 'assess' && !state.completed
  return (
    <section className={styles.workflowCard} aria-labelledby="case-workflow-heading">
      <header>
        <div>
          <span className={styles.kicker}>
            {state.section.toUpperCase()} · {assessmentMasked ? 'MASKED CAPSTONE' : scenario.id}
          </span>
          <h2 id="case-workflow-heading">
            {assessmentMasked ? 'Masked MCS capstone' : scenario.title}
          </h2>
        </div>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => dispatch({ type: 'RESET' })}
        >
          <RotateCcw aria-hidden="true" /> Reset
        </button>
      </header>
      <p className={styles.casePresentation}>{scenario.presentation}</p>
      <ol className={styles.phaseRail} aria-label="Case reasoning sequence">
        {phases.map((phase, index) => (
          <li
            key={phase}
            data-current={phase === state.scenarioPhase}
            data-complete={currentPhaseIndex > index || state.completed}
          >
            <span>{index + 1}</span>
            <strong>{phase}</strong>
          </li>
        ))}
      </ol>

      <div className={styles.workflowStep}>
        <div>
          <span>01</span>
          <div>
            <h3>Inspect before you diagnose</h3>
            <p>Open at least one signal set. Complete inspections earn case credit.</p>
          </div>
        </div>
        <div className={styles.inspectButtons}>
          <button
            type="button"
            disabled={!isMcsActionIdPermitted(state, 'inspect:arterial')}
            data-complete={state.inspectedIds.includes('inspect:arterial')}
            onClick={() => dispatch({ type: 'INSPECT', id: 'arterial' })}
          >
            <Eye aria-hidden="true" /> Arterial waveform
          </button>
          <button
            type="button"
            disabled={!isMcsActionIdPermitted(state, 'inspect:preload')}
            data-complete={state.inspectedIds.includes('inspect:preload')}
            onClick={() => dispatch({ type: 'INSPECT', id: 'preload' })}
          >
            <Eye aria-hidden="true" /> Filling & RV
          </button>
          <button
            type="button"
            disabled={!isMcsActionIdPermitted(state, 'inspect:device')}
            data-complete={state.inspectedIds.includes('inspect:device')}
            onClick={() => dispatch({ type: 'INSPECT', id: 'device' })}
          >
            <Eye aria-hidden="true" /> Device display
          </button>
        </div>
      </div>

      <fieldset className={styles.predictionFieldset} disabled={state.predictionCommitted}>
        <legend>
          <span>02</span>
          <strong>{scenario.predictionPrompt}</strong>
        </legend>
        {scenario.predictionOptions.map((option) => (
          <label key={option.id}>
            <input
              type="radio"
              name={`prediction-${scenario.id}`}
              checked={state.selectedPredictionId === option.id}
              onChange={() => dispatch({ type: 'SELECT_PREDICTION', id: option.id })}
            />
            <span>{option.label}</span>
          </label>
        ))}
        <button
          type="button"
          disabled={
            state.predictionCommitted ||
            state.inspectedIds.length === 0 ||
            !state.selectedPredictionId
          }
          onClick={() => dispatch({ type: 'COMMIT_PREDICTION' })}
        >
          {state.predictionCommitted ? (
            <>
              <Check aria-hidden="true" /> Prediction committed
            </>
          ) : (
            <>
              <LockKeyhole aria-hidden="true" /> Commit prediction
            </>
          )}
        </button>
      </fieldset>

      {state.section === 'practice' && !state.completed ? (
        <aside className={styles.guidedPrompt}>
          <strong>Practice cue</strong>
          <span>{scenario.guidedPrompt}</span>
        </aside>
      ) : null}
      {state.section === 'assess' && !state.completed ? (
        <aside className={styles.assessPrompt}>
          <LockKeyhole aria-hidden="true" />
          <span>Hints, success thresholds, and causal coaching are withheld until debrief.</span>
        </aside>
      ) : null}

      <div className={styles.responseStatus} role="status" aria-live="polite">
        <strong>Simulation response</strong>
        <span>{state.responseMessage}</span>
      </div>
      <div className={styles.caseActions}>
        <button
          type="button"
          disabled={!state.predictionCommitted || !isMcsActionIdPermitted(state, 'team:escalate')}
          onClick={() => dispatch({ type: 'ESCALATE' })}
          data-complete={state.escalated}
        >
          Escalate to shock/MCS team
        </button>
        <button
          type="button"
          disabled={!state.predictionCommitted || state.scenarioPhase === 'adjust'}
          onClick={() => dispatch({ type: 'REASSESS' })}
          data-complete={state.reassessed}
        >
          Reassess response
        </button>
        <button
          type="button"
          disabled={!state.reassessed}
          onClick={() => dispatch({ type: 'COMPLETE' })}
        >
          Open debrief & score
        </button>
      </div>

      {state.criticalErrors.length > 0 ? (
        <div className={styles.criticalErrors} role="alert">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Critical safety error recorded</strong>
            {state.criticalErrors.map((error) => (
              <span key={error}>{error.replaceAll('-', ' ')}</span>
            ))}
          </div>
        </div>
      ) : null}

      {state.completed && state.score ? (
        <section className={styles.debriefCard} data-mastery={mastery}>
          <div className={styles.scoreRing}>
            <strong>{state.score.total}%</strong>
            <span>{mastery ? 'MASTERED' : 'RETRY NEEDED'}</span>
          </div>
          <div>
            <h3>
              {mastery
                ? 'Mechanism and safety threshold met'
                : 'Review the causal chain, then retry'}
            </h3>
            <p>
              Inspection {state.score.inspection}/20 · prediction {state.score.prediction}/20 ·
              management {state.score.management}/35 · response {state.score.response}/20 ·
              reassessment {state.score.reassessment}/5.
            </p>
            <ul>
              {scenario.debrief.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Success criteria</h4>
            <ul>
              {scenario.successCriteria.map((criterion) => (
                <li key={criterion.label}>{criterion.label}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </section>
  )
}
