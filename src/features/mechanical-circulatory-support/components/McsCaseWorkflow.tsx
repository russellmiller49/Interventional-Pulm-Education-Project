'use client'

import { useState, type Dispatch, type ReactNode } from 'react'
import { Eye, RotateCcw, ShieldAlert } from 'lucide-react'
import type { McsAction, McsSimulationState } from '../engine'
import { mcsPresentationTitle } from '../content/casePresentation'
import styles from './mechanical-circulatory-support.module.css'

export function McsCaseWorkflow({
  state,
  dispatch,
  observations,
  controls,
}: {
  state: McsSimulationState
  dispatch: Dispatch<McsAction>
  observations?: ReactNode
  controls?: ReactNode
}) {
  const [hintVisible, setHintVisible] = useState(false)
  const scenario = state.scenario
  if (!scenario)
    return (
      <section className={styles.workflowCard} aria-label="Mechanism Studio instructions">
        <span className={styles.kicker}>OPEN EXPLORATION</span>
        <h2>Mechanism Studio</h2>
        <p>
          Start with one device and reference physiology. Change a setting or simulated condition,
          then compare native flow, device flow, effective flow, ventricular loading, pressure, and
          alarms.
        </p>
        <p>
          Reset restores the reference patient and device configuration and clears current actions.
          Display playback changes model time; it does not turn off device support.
        </p>
        <div className={styles.studioWorkspace}>
          {observations}
          {controls}
        </div>
      </section>
    )
  return (
    <section
      className={styles.workflowCard}
      data-case-workflow
      aria-labelledby="case-workflow-heading"
    >
      <header>
        <div>
          <span className={styles.kicker}>
            {scenario.kind === 'capstone' ? 'OPTIONAL INTEGRATED WALKTHROUGH' : 'GUIDED CASE'} ·{' '}
            {scenario.id}
          </span>
          <h2 id="case-workflow-heading">{mcsPresentationTitle(scenario)}</h2>
        </div>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => {
            setHintVisible(false)
            dispatch({ type: 'RESET' })
          }}
        >
          <RotateCcw aria-hidden="true" /> Reset
        </button>
      </header>
      <dl className={styles.caseIdentity} data-case-identity>
        <div>
          <dt>Patient problem</dt>
          <dd>{scenario.presentation}</dd>
        </div>
        <div>
          <dt>Support pathway</dt>
          <dd>
            {scenario.device === 'iabp'
              ? 'IABP counterpulsation'
              : scenario.device === 'impella'
                ? 'Microaxial support'
                : 'Durable continuous-flow LVAD'}
          </dd>
        </div>
        <div>
          <dt>Your role</dt>
          <dd>
            Explore the simulated conditions, compare observations, and open the explanation
            whenever useful. Predictions and actions are optional.
          </dd>
        </div>
        <div>
          <dt>Topic</dt>
          <dd>{scenario.learningObjectives[0]}</dd>
        </div>
      </dl>
      {/*
       * Jump links to the parts of this case. They were four bare lower-case words in a grid styled
       * for buttons, so they rendered as plain text that looked like a row of broken tabs (F31).
       * They are links, so they now look like links, under a label that says what they are.
       */}
      <nav className={styles.caseJumpLinks} aria-label="Parts of this case" data-case-jump-links>
        <span aria-hidden="true">Jump to</span>
        <ul>
          {(
            [
              ['inspect', 'Inspect the readings'],
              ['predict', 'Optional prediction'],
              ['response', 'Model response'],
              ['actions', 'Explanation and next steps'],
            ] as const
          ).map(([part, label]) => (
            <li key={part}>
              <a href={`#mcs-case-${part}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.caseObservation} data-case-observations>
        {observations}
      </div>
      <section id="mcs-case-inspect" className={styles.workflowStep} tabIndex={-1}>
        <h3>Inspect the current readings</h3>
        <p>These buttons read the simulated signals. Inspection does not change the patient.</p>
        <div className={styles.inspectButtons}>
          {(['arterial', 'preload', 'device'] as const).map((id, index) => (
            <button
              key={id}
              type="button"
              data-complete={state.inspectedIds.includes(`inspect:${id}`)}
              onClick={() => dispatch({ type: 'INSPECT', id })}
            >
              <Eye aria-hidden="true" />
              {['Arterial waveform', 'Filling & RV', 'Device display'][index]}
            </button>
          ))}
        </div>
      </section>
      <fieldset id="mcs-case-predict" className={styles.predictionFieldset} tabIndex={-1}>
        <legend>Optional prediction: {scenario.predictionPrompt}</legend>
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
        <div className={styles.caseActions}>
          <button
            type="button"
            disabled={!state.selectedPredictionId}
            onClick={() => dispatch({ type: 'COMMIT_PREDICTION' })}
          >
            Compare prediction
          </button>
          <button type="button" onClick={() => setHintVisible(true)}>
            Hint
          </button>
          <button type="button" onClick={() => dispatch({ type: 'COMPLETE' })}>
            Show explanation
          </button>
          <button type="button" onClick={() => dispatch({ type: 'SELECT_PREDICTION', id: null })}>
            Try prediction again
          </button>
        </div>
      </fieldset>
      {hintVisible || state.predictionCommitted ? (
        <aside className={styles.guidedPrompt}>
          <strong>{state.predictionCommitted ? 'Prediction explanation' : 'Hint'}</strong>
          <p>{scenario.guidedPrompt || scenario.debrief[0]}</p>
          {state.predictionCommitted ? (
            <p>
              {
                scenario.predictionOptions.find(
                  (option) => option.id === scenario.correctPredictionId,
                )?.label
              }
            </p>
          ) : null}
        </aside>
      ) : null}
      <section className={styles.casePermittedActions}>
        <h3>Explore the supported controls</h3>
        <p>
          Change one variable at a time, then inspect the response. Reset restores this case’s
          initial patient and device configuration and clears current actions and answers.
        </p>
        {controls}
      </section>
      <div id="mcs-case-response" className={styles.responseStatus} role="status" tabIndex={-1}>
        <strong>Current model response</strong>
        <span>{state.responseMessage}</span>
        <span>{state.causalExplanation}</span>
      </div>
      <div id="mcs-case-actions" className={styles.caseActions} tabIndex={-1}>
        <button
          type="button"
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
          Open worked explanation
        </button>
      </div>
      {state.criticalErrors.length ? (
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
      {state.completed ? (
        <section className={styles.debriefCard} data-worked-explanation>
          {/*
           * One column of blocks that share the card's width. This card was a two-column grid
           * whose first 105 px column held a score ring; the ring went, the grid stayed, and the
           * whole explanation fell into that 105 px column beside an empty one (F33). The three
           * blocks — what the case teaches, the conditions and what they are, and this run — now
           * sit side by side where there is room and stack where there is not, at a readable size.
           */}
          <header className={styles.debriefHeader}>
            <h3>Worked case explanation</h3>
            <p>
              Authored teaching for this case. Viewing it does not perform an action or establish a
              successful outcome in your run.
            </p>
          </header>
          <div className={styles.debriefColumns}>
            <div data-debrief-teaching>
              <ul>
                {scenario.debrief.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div data-debrief-conditions>
              <h4>Signals to reconcile</h4>
              {/*
               * Where each number comes from, beside the number.
               *
               * This list used to read "Timing quality ≥80%, MAP ≥58 mm Hg" and nothing else, in
               * twelve cases, with no source and no note — so "MAP ≥50" in the integrated IABP case
               * read as a bedside target against the 65 a fellow has been taught (F33). None of the
               * twenty-one conditions has a clinical source behind it; they are tests this module
               * wrote so its own cases have an end. Two of them are quarantined outright.
               */}
              <p data-condition-contract>
                Each condition below is a test on this simulation, not a treatment target and not a
                sign that the support is clinically adequate. Meeting one says the model reached a
                number this module chose; it does not say a device was correctly operated.
              </p>
              <ul data-condition-list>
                {scenario.successCriteria.map((item) => (
                  <li
                    key={item.label}
                    data-condition-class={item.classification.kind}
                    data-condition-held={item.classification.held ? 'true' : undefined}
                  >
                    <strong>{item.label}</strong>
                    <small>
                      {item.classification.kind === 'source-supported-clinical'
                        ? `Clinical criterion from ${item.classification.sourceId}${
                            item.classification.scope ? ` · ${item.classification.scope}` : ''
                          }`
                        : item.classification.kind === 'device-reported-quantity'
                          ? 'A quantity a console reports, at a value authored for this simulation'
                          : 'Authored for this simulation'}{' '}
                      · {item.classification.quantity}
                    </small>
                    {item.classification.held ? (
                      <em data-condition-hold>
                        Held, and not treated as an outcome: {item.classification.held.reason}.
                        Whether this run reached it is not shown and is not a result. Open item{' '}
                        {item.classification.held.openItemId}, still NOT REVIEWED.
                      </em>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div data-debrief-run>
              <h4>Actions performed in this run</h4>
              {state.actionIds.length ? (
                <ul>
                  {state.actionIds.map((id) => (
                    <li key={id}>{id}</li>
                  ))}
                </ul>
              ) : (
                <p>No actions performed.</p>
              )}
              <p>
                {state.selectedPredictionId
                  ? `Your prediction: ${scenario.predictionOptions.find((option) => option.id === state.selectedPredictionId)?.label}`
                  : 'No prediction submitted.'}
              </p>
              <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
                Try again from the case baseline
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  )
}
