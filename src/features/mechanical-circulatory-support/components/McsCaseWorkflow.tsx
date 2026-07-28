'use client'

import type { Dispatch } from 'react'
import { Check, Eye, RotateCcw, ShieldAlert } from 'lucide-react'

import type { McsAction, McsSimulationState } from '../engine'
import { isMcsActionIdPermitted } from '../engine'
import styles from './mechanical-circulatory-support.module.css'

const phases = ['inspect', 'predict', 'adjust', 'observe', 'reassess', 'debrief'] as const
const phaseTargetIds: Readonly<Record<(typeof phases)[number], string>> = {
  inspect: 'mcs-case-inspect',
  predict: 'mcs-case-predict',
  adjust: 'mcs-case-actions',
  observe: 'mcs-case-response',
  reassess: 'mcs-case-actions',
  debrief: 'mcs-case-actions',
}

function jumpToPhase(phase: (typeof phases)[number]) {
  document.getElementById(phaseTargetIds[phase])?.focus({ preventScroll: false })
}

export function McsCaseWorkflow({
  state,
  dispatch,
  showChallengeFeedback,
  onShowChallengeFeedbackChange,
}: {
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
  showChallengeFeedback: boolean
  onShowChallengeFeedbackChange: (show: boolean) => void
}) {
  const scenario = state.scenario
  if (!scenario) {
    return (
      <section className={styles.workflowCard} aria-label="Mechanism Studio instructions">
        <span className={styles.kicker}>OPEN LAB</span>
        <h2>Mechanism Studio</h2>
        <p>
          Start with one device and baseline physiology, change one setting or loading condition,
          and compare native flow, device flow, effective flow, ventricular loading, pressure, and
          alarms.
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
  return (
    <section className={styles.workflowCard} aria-labelledby="case-workflow-heading">
      <header>
        <div>
          <span className={styles.kicker}>
            {state.section === 'assess' ? 'CHALLENGE' : state.section.toUpperCase()} · {scenario.id}
          </span>
          <h2 id="case-workflow-heading">{scenario.title}</h2>
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
            <button type="button" onClick={() => jumpToPhase(phase)}>
              <span>{index + 1}</span>
              <strong>{phase}</strong>
            </button>
          </li>
        ))}
      </ol>

      <div id="mcs-case-inspect" className={styles.workflowStep} tabIndex={-1}>
        <div>
          <span>01</span>
          <div>
            <h3>Inspect before you diagnose</h3>
            <p>Open at least one signal set so the later actions have an observable anchor.</p>
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

      <fieldset
        id="mcs-case-predict"
        className={styles.predictionFieldset}
        disabled={state.predictionCommitted}
        tabIndex={-1}
      >
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
          disabled={state.predictionCommitted || !state.selectedPredictionId}
          onClick={() => dispatch({ type: 'COMMIT_PREDICTION' })}
        >
          {state.predictionCommitted ? (
            <>
              <Check aria-hidden="true" /> Prediction committed
            </>
          ) : (
            <>
              <Check aria-hidden="true" /> Record initial frame
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
          <span>Work from the visible cues; routine teaching is collected for the debrief.</span>
          <label>
            <input
              type="checkbox"
              checked={showChallengeFeedback}
              onChange={(event) => onShowChallengeFeedbackChange(event.currentTarget.checked)}
            />
            <span>Show teaching notes after each action</span>
          </label>
        </aside>
      ) : null}

      {state.section !== 'assess' || showChallengeFeedback || state.completed ? (
        <div
          id="mcs-case-response"
          className={styles.responseStatus}
          role="status"
          aria-live="polite"
          tabIndex={-1}
        >
          <strong>Simulation response</strong>
          <span>{state.responseMessage}</span>
        </div>
      ) : (
        <div id="mcs-case-response" className={styles.responseStatus} tabIndex={-1}>
          <strong>Routine teaching deferred</strong>
          <span>
            The patient, device, waveforms, and alarms still change in real time. Safety
            interruptions remain immediate.
          </span>
        </div>
      )}
      <div id="mcs-case-actions" className={styles.caseActions} tabIndex={-1}>
        <button
          type="button"
          disabled={!isMcsActionIdPermitted(state, 'team:escalate')}
          onClick={() => dispatch({ type: 'ESCALATE' })}
          data-complete={state.escalated}
        >
          Escalate to shock/MCS team
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'REASSESS' })}
          data-complete={state.reassessed}
        >
          Reassess response
        </button>
        <button type="button" onClick={() => dispatch({ type: 'COMPLETE' })}>
          Open causal debrief
        </button>
      </div>

      {state.criticalErrors.length > 0 ? (
        <div className={styles.criticalErrors} role="alert">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>Safety event to revisit</strong>
            {state.criticalErrors.map((error) => (
              <span key={error}>{error.replaceAll('-', ' ')}</span>
            ))}
          </div>
        </div>
      ) : null}

      {state.completed && state.score ? (
        <section className={styles.debriefCard}>
          <div>
            <h3>Review the causal chain and the cues that changed</h3>
            <ul>
              {scenario.debrief.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Signals to reconcile</h4>
            <ul>
              {scenario.successCriteria.map((criterion) => (
                <li key={criterion.label}>{criterion.label}</li>
              ))}
            </ul>
            <h4>Deferred simulation response</h4>
            <p>{state.responseMessage}</p>
          </div>
        </section>
      ) : null}
    </section>
  )
}
