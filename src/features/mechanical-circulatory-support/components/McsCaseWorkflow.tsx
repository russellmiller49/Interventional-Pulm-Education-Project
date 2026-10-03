'use client'

import { useState, type Dispatch, type ReactNode } from 'react'
import { Eye, RotateCcw, ShieldAlert } from 'lucide-react'
import type { McsAction, McsSimulationState } from '../engine'
import { mcsActionDisplayList } from '../content/actionDisplayNames'
import { mcsClaimChecksForCase } from '../content/claimSourceMap'
import {
  mcsCasePredictionReasoning,
  mcsCaseReasoningHeading,
} from '../content/casePredictionReasoning'
import { mcsPresentationTitle } from '../content/casePresentation'
import { mcsNameWithMechanism } from '../content/deviceNaming'
import { McsClaimSourceChecks } from './McsClaimSourceChecks'
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
  const selectedOption = scenario?.predictionOptions.find(
    (option) => option.id === state.selectedPredictionId,
  )
  const selectedFits = selectedOption?.id === scenario?.correctPredictionId
  if (!scenario)
    return (
      <section
        className={styles.workflowCard}
        aria-label="Mechanism Studio instructions"
        data-mechanism-studio
      >
        {/*
         * Said for what it is (F36). The hub called the Studio a place with "no patient and no
         * debrief", and the page then opened on a patient context row, a mode chip and a six-stage
         * stepper, so a learner went looking for the assignment. There is a patient — the module's
         * reference patient, which is what makes a change readable — and there is no assignment:
         * no case, no question, no worked explanation to reach, and nothing recorded.
         */}
        <span className={styles.kicker}>OPEN SANDBOX · REFERENCE PATIENT</span>
        <h2>Mechanism Studio</h2>
        <p data-studio-identity>
          An open sandbox on this module’s reference patient. There is no case to solve, no question
          to answer and no debrief to reach: nothing here is a task, and nothing you do here is
          recorded or counted.
        </p>
        <p>
          The patient context above is the reference patient the sandbox starts from, shown so a
          change has something to be read against. Change one setting or simulated condition, then
          compare native flow, device flow, effective flow, ventricular loading, pressure, and
          alarms. Every control and every safety interlock works as it does in a case.
        </p>
        <p>
          Reset restores the reference patient and device configuration and clears current actions.
          Display playback changes model time; it does not turn off device support. For a patient
          with a problem to work through and a worked explanation, open a case instead.
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
            {scenario.device === 'impella'
              ? 'Impella (microaxial pump) · the pump in use is named in the Support row above'
              : mcsNameWithMechanism(scenario.device)}
          </dd>
        </div>
        <div>
          <dt>Your role</dt>
          <dd>
            Explore the simulated conditions, compare observations, and open the explanation
            whenever useful. Predictions and actions are optional.
          </dd>
        </div>
        {/*
         * What kind of case this is, said plainly (F31). The title, the topic and the alarm name
         * the problem before the prediction is asked, and they are meant to: this is a teaching
         * case to work through and come back to, not a blind diagnostic exercise. Hiding a real
         * alarm or neutralizing the title to manufacture difficulty would take information away
         * from a learner for no gain, so the case says what it is instead.
         */}
        <div data-case-kind>
          <dt>Kind of case</dt>
          <dd>
            A worked teaching case. Its title, topic and alarms name the problem on purpose, so the
            optional prediction is a self-check on the reasoning rather than a blind diagnosis.
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
          {/* Offered once a prediction has been compared: before that there is nothing to retry. */}
          {state.predictionCommitted ? (
            <button
              type="button"
              data-try-prediction-again
              onClick={() => dispatch({ type: 'SELECT_PREDICTION', id: null })}
            >
              Try prediction again
            </button>
          ) : null}
        </div>
      </fieldset>
      {hintVisible && !state.predictionCommitted ? (
        <aside className={styles.guidedPrompt} data-case-hint>
          <strong>Hint</strong>
          <p>{scenario.guidedPrompt || scenario.debrief[0]}</p>
        </aside>
      ) : null}
      {/*
       * The reasoning for the option the learner compared, then for every other option (F32).
       *
       * This block used to show the case's one-line hint and the keyed label, and nothing about
       * the option actually chosen. Each option now has its own reasoning about the modeled state
       * the case is built in. It names a fit to the model rather than a result for the learner:
       * nothing is totalled, no attempt is kept, and the same reasoning is on the worked
       * explanation for anyone who never answers.
       */}
      {state.predictionCommitted && selectedOption ? (
        <aside className={styles.guidedPrompt} data-prediction-reasoning-list role="status">
          <strong>Your prediction: {selectedOption.label}</strong>
          <p data-prediction-reasoning={selectedOption.id} data-fits={selectedFits}>
            <em>{mcsCaseReasoningHeading(selectedFits)}.</em>{' '}
            {mcsCasePredictionReasoning(scenario.id, selectedOption.id)}
          </p>
          <p>
            <strong>The other options, against the same modeled state</strong>
          </p>
          <ul>
            {scenario.predictionOptions
              .filter((option) => option.id !== selectedOption.id)
              .map((option) => {
                const fits = option.id === scenario.correctPredictionId
                return (
                  <li key={option.id} data-prediction-reasoning={option.id} data-fits={fits}>
                    <span>{option.label}.</span> <em>{mcsCaseReasoningHeading(fits)}.</em>{' '}
                    {mcsCasePredictionReasoning(scenario.id, option.id)}
                  </li>
                )
              })}
          </ul>
          <p>
            <em>Where to look:</em> {scenario.guidedPrompt || scenario.debrief[0]}
          </p>
          <p data-prediction-reasoning-boundary>
            This compares each option with the state this case is built in. It is draft teaching
            copy, not a clinical rule, and it is not kept: no answer is counted or stored.
          </p>
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
              <McsClaimSourceChecks
                claims={mcsClaimChecksForCase(scenario.id)}
                context="this case"
              />
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
              {/*
               * The learner's own actions, by name (F33). This list printed the reducer's ids —
               * `inspect:arterial`, `iabp:set-deflation` — which are the stored contract and were
               * never meant to be read. The ids are unchanged and stay on each row as a data
               * attribute for anyone tracing a run; what is read is the control's name.
               */}
              {state.actionIds.length ? (
                <ul data-run-actions>
                  {mcsActionDisplayList(state.actionIds).map((action) => (
                    <li key={action.id} data-action-id={action.id}>
                      {action.name}
                    </li>
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
              <details data-all-option-reasoning>
                <summary>Reasoning for every prediction option</summary>
                <ul>
                  {scenario.predictionOptions.map((option) => {
                    const fits = option.id === scenario.correctPredictionId
                    return (
                      <li key={option.id} data-option-reasoning={option.id} data-fits={fits}>
                        <span>{option.label}.</span> <em>{mcsCaseReasoningHeading(fits)}.</em>{' '}
                        {mcsCasePredictionReasoning(scenario.id, option.id)}
                      </li>
                    )
                  })}
                </ul>
              </details>
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
