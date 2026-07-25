'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import {
  BadgeCheck,
  BookOpenCheck,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Eye,
  FastForward,
  Gauge,
  Lightbulb,
  MessageSquareText,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Stethoscope,
} from 'lucide-react'

import {
  selectCaseOutcome,
  type CaseOutcome,
  type InterventionCategory,
  type VentilationAction,
  type VentilationCaseDefinition,
  type VentilationSimulationState,
} from '../engine'
import styles from './mechanical-ventilation.module.css'

const categoryLabels: Record<InterventionCategory, string> = {
  assessment: 'Bedside review and response check',
  ventilator: 'Ventilator maneuvers',
  'airway-circuit': 'Airway & circuit',
  medication: 'Medication / whole-patient treatment',
  procedure: 'Emergency recognition',
  'comfort-communication': 'Communication & comfort',
}

function workflowStepState(
  state: VentilationSimulationState,
  step: number,
): 'current' | 'complete' | 'upcoming' {
  const complete = [
    state.simulationTime > 0 || state.experience === 'learn',
    state.prediction.committed,
    state.interventions.length > 0,
    state.phase === 'reassess' || state.reassessment.committed || state.phase === 'debrief',
    state.reassessment.committed,
    state.phase === 'debrief',
  ]
  if (complete[step]) return 'complete'
  if (complete.slice(0, step).every(Boolean)) return 'current'
  return 'upcoming'
}

export function CaseWorkflow({
  state,
  definition,
  dispatch,
  onResult,
  showActionFeedback = true,
  onShowActionFeedbackChange,
}: {
  state: VentilationSimulationState
  definition: VentilationCaseDefinition
  dispatch: Dispatch<VentilationAction>
  onResult: (outcome: CaseOutcome) => void
  /** Retained for legacy callers; challenge identity is always visible. */
  maskedAssessment?: boolean
  showActionFeedback?: boolean
  onShowActionFeedbackChange?: (show: boolean) => void
}) {
  const [mechanismId, setMechanismId] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [responseId, setResponseId] = useState('')
  const recordedResultKey = useRef<string | null>(null)
  const outcome = useMemo(() => selectCaseOutcome(state, definition), [definition, state])
  const groupedInterventions = useMemo(() => {
    const groups = new Map<InterventionCategory, typeof definition.interventions>()
    for (const intervention of definition.interventions) {
      groups.set(intervention.category, [
        ...(groups.get(intervention.category) ?? []),
        intervention,
      ])
    }
    return groups
  }, [definition])

  useEffect(() => {
    const resultKey = `${state.caseId}:${state.seed}`
    if (
      state.phase !== 'debrief' ||
      recordedResultKey.current === resultKey ||
      state.experience !== 'practice'
    ) {
      return
    }
    recordedResultKey.current = resultKey
    onResult(outcome)
  }, [onResult, outcome, state.caseId, state.experience, state.phase, state.seed])

  const performedIds = new Set(state.interventions.map((record) => record.interventionId))
  const predictionReady = Boolean(mechanismId && priorityId && responseId)
  const hintAvailable =
    state.experience === 'learn' ||
    (state.challengeMode === 'untimed' && state.simulationTime >= 60)
  const latestInterventionId = state.interventions.at(-1)?.interventionId
  const hardInterruptActive = definition.interventions.some(
    (intervention) =>
      intervention.id === latestInterventionId && intervention.unsafe && intervention.critical,
  )

  return (
    <section className={styles.workflowPanel} aria-labelledby="workflow-heading">
      <div className={styles.panelHeading}>
        <div>
          <span>{state.experience === 'learn' ? 'Guided case' : 'Independent attempt'}</span>
          <h2 id="workflow-heading">
            {definition.id} · {definition.title}
          </h2>
        </div>
        <span className={styles.difficultyBadge}>{definition.difficulty}</span>
      </div>

      <ol className={styles.workflowStepper} aria-label="Case workflow">
        {['Observe', 'Commit', 'Intervene', 'Observe response', 'Reassess', 'Debrief'].map(
          (label, index) => {
            const status = workflowStepState(state, index)
            return (
              <li
                key={label}
                data-status={status}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span>{status === 'complete' ? <Check aria-hidden="true" /> : index + 1}</span>
                <small>{label}</small>
              </li>
            )
          },
        )}
      </ol>

      {onShowActionFeedbackChange ? (
        <aside className={styles.challengeFeedbackControl}>
          <p>
            Routine teaching is collected for the debrief. Patient signals, waveforms, and alarms
            continue to respond in real time.
          </p>
          <label>
            <input
              type="checkbox"
              checked={showActionFeedback}
              onChange={(event) => onShowActionFeedbackChange(event.currentTarget.checked)}
            />
            <span>Show teaching notes after each action</span>
          </label>
        </aside>
      ) : null}

      <section id="mv-case-recognize" className={styles.workflowSection} tabIndex={-1}>
        <div className={styles.workflowSectionHeading}>
          <Eye aria-hidden="true" />
          <div>
            <span>Step 1</span>
            <h3>Observe the baseline and event</h3>
          </div>
        </div>
        <p>{definition.patientDescription}</p>
        <div className={styles.simulationTransport}>
          <button
            type="button"
            className={styles.primaryAction}
            onClick={() => dispatch({ type: 'SET_PAUSED', paused: !state.paused })}
          >
            {state.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            {state.paused ? 'Run physiology' : 'Pause'}
          </button>
          <button type="button" onClick={() => dispatch({ type: 'STEP_BREATH' })}>
            <ChevronRight aria-hidden="true" /> One breath
          </button>
          <div className={styles.speedGroup} aria-label="Simulation speed">
            {([1, 5, 30] as const).map((speed) => (
              <button
                type="button"
                key={speed}
                aria-pressed={state.speed === speed}
                onClick={() => dispatch({ type: 'SET_SPEED', speed })}
              >
                {speed === 1 ? <Clock3 aria-hidden="true" /> : <FastForward aria-hidden="true" />}
                {speed}×
              </button>
            ))}
          </div>
          <span className={styles.simulationClock}>
            {state.simulationTime.toFixed(0)} simulated seconds
          </span>
        </div>
        {state.experience === 'learn' ? (
          <div className={styles.learnCallout}>
            <BookOpenCheck aria-hidden="true" />
            <div>
              <strong>What to learn here</strong>
              <ul>
                {definition.learningObjectives.map((objective) => (
                  <li key={objective}>{objective}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section id="mv-case-predict" className={styles.workflowSection} tabIndex={-1}>
        <div className={styles.workflowSectionHeading}>
          <ClipboardCheck aria-hidden="true" />
          <div>
            <span>Step 2</span>
            <h3>Commit before changing therapy</h3>
          </div>
        </div>
        {state.experience === 'learn' ? (
          <div className={styles.guidedPrediction}>
            <p>
              <strong>Mechanism:</strong>{' '}
              {
                definition.mechanismOptions.find(
                  (item) => item.id === definition.correctMechanismId,
                )?.label
              }
            </p>
            <p>
              <strong>Safety priority:</strong>{' '}
              {
                definition.priorityOptions.find((item) => item.id === definition.correctPriorityId)
                  ?.label
              }
            </p>
            <p>
              <strong>Expected response:</strong>{' '}
              {
                definition.responseOptions.find((item) => item.id === definition.correctResponseId)
                  ?.label
              }
            </p>
          </div>
        ) : state.prediction.committed ? (
          <p className={styles.committedNotice}>
            <BadgeCheck aria-hidden="true" /> Initial frame recorded. Act on it, then reassess its
            physiologic effect.
          </p>
        ) : (
          <div className={styles.predictionFields}>
            <label>
              Suspected mechanism
              <select value={mechanismId} onChange={(event) => setMechanismId(event.target.value)}>
                <option value="">Choose one…</option>
                {definition.mechanismOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Immediate safety priority
              <select value={priorityId} onChange={(event) => setPriorityId(event.target.value)}>
                <option value="">Choose one…</option>
                {definition.priorityOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Expected physiologic response
              <select value={responseId} onChange={(event) => setResponseId(event.target.value)}>
                <option value="">Choose one…</option>
                {definition.responseOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className={styles.primaryAction}
              disabled={!predictionReady}
              onClick={() =>
                dispatch({ type: 'COMMIT_PREDICTION', mechanismId, priorityId, responseId })
              }
            >
              <ClipboardCheck aria-hidden="true" /> Commit prediction
            </button>
          </div>
        )}
      </section>

      <section id="mv-case-act" className={styles.workflowSection} tabIndex={-1}>
        <div className={styles.workflowSectionHeading}>
          <Gauge aria-hidden="true" />
          <div>
            <span>Steps 3–4</span>
            <h3>Intervene, then watch the response</h3>
          </div>
        </div>
        <div className={styles.interventionGroups}>
          {[...groupedInterventions.entries()].map(([category, interventions]) => (
            <div key={category}>
              <h4>{categoryLabels[category]}</h4>
              <div className={styles.interventionGrid}>
                {interventions.map((intervention) => {
                  const isPerformed = performedIds.has(intervention.id)
                  const unmet = intervention.prerequisites?.some((id) => !performedIds.has(id))
                  return (
                    <button
                      type="button"
                      key={intervention.id}
                      data-performed={isPerformed}
                      disabled={Boolean(unmet) || (isPerformed && !intervention.repeatable)}
                      onClick={() =>
                        dispatch({ type: 'PERFORM_INTERVENTION', interventionId: intervention.id })
                      }
                    >
                      <span>
                        {isPerformed ? (
                          <Check aria-hidden="true" />
                        ) : intervention.category === 'procedure' ? (
                          <ShieldAlert aria-hidden="true" />
                        ) : (
                          <Stethoscope aria-hidden="true" />
                        )}
                        <strong>{intervention.label}</strong>
                      </span>
                      <small>{intervention.description}</small>
                      {unmet ? <em>Requires a prior inspection or stabilizing action.</em> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {state.lastResponse &&
        (showActionFeedback || state.phase === 'debrief' || hardInterruptActive) ? (
          <div className={styles.responseCallout} role="status">
            <RotateCcw aria-hidden="true" />
            <span>{state.lastResponse}</span>
          </div>
        ) : null}
        {!showActionFeedback && state.lastResponse && !hardInterruptActive ? (
          <p className={styles.deferredResponseNotice}>
            Routine teaching note saved for the debrief. Read the physiologic response on the
            patient and ventilator surfaces.
          </p>
        ) : null}
        {state.criticalErrors.length > 0 && state.phase !== 'debrief' ? (
          <div className={styles.criticalErrorBox} role="alert">
            <ShieldAlert aria-hidden="true" />
            <div>
              <strong>Safety interruption</strong>
              <p>
                Stopping here—these findings represent a potentially catastrophic trajectory in a
                real patient. Stabilize the patient and revisit the action before continuing.
              </p>
              <ul>
                {state.criticalErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </section>

      <section id="mv-case-observe" className={styles.workflowSection} tabIndex={-1}>
        <div className={styles.workflowSectionHeading}>
          <Stethoscope aria-hidden="true" />
          <div>
            <span>Step 5</span>
            <h3>Repeat the discriminating bedside check</h3>
          </div>
        </div>
        <p>
          Repeat the waveform review, hold, bedside examination, ABG, or comfort check that can
          prove or refute your working mechanism.
        </p>
        {state.experience === 'learn' ? (
          <p className={styles.learnPrompt}>
            Guided target:{' '}
            {definition.requiredReassessmentIds
              .map((id) => definition.interventions.find((item) => item.id === id)?.label ?? id)
              .join(' and ')}
            .
          </p>
        ) : null}
        <button
          type="button"
          className={styles.primaryAction}
          onClick={() => dispatch({ type: 'COMMIT_REASSESSMENT' })}
        >
          <ClipboardCheck aria-hidden="true" /> Commit reassessment
        </button>
        <div className={styles.hintRow}>
          <button
            type="button"
            disabled={!hintAvailable}
            onClick={() => dispatch({ type: 'USE_HINT' })}
          >
            <Lightbulb aria-hidden="true" />
            {state.experience === 'learn' ? 'Show guided hint' : 'Show a focused hint'}
          </button>
          {state.experience === 'practice' && !hintAvailable ? (
            <small>
              {state.challengeMode === 'timed'
                ? 'Hints are hidden in timed challenge.'
                : `Focused hints become available after ${Math.max(0, 60 - state.simulationTime).toFixed(0)} simulated seconds.`}
            </small>
          ) : null}
        </div>
      </section>

      <section id="mv-case-explain" className={styles.workflowSection} tabIndex={-1}>
        <div className={styles.workflowSectionHeading}>
          <MessageSquareText aria-hidden="true" />
          <div>
            <span>Step 6</span>
            <h3>Reveal the debrief</h3>
          </div>
        </div>
        {state.phase !== 'debrief' ? (
          <button
            type="button"
            className={styles.revealAction}
            onClick={() => dispatch({ type: 'REVEAL_DEBRIEF' })}
          >
            Reveal case reasoning
          </button>
        ) : (
          <div className={styles.debriefPanel}>
            <div className={styles.outcomeHeader}>
              <MessageSquareText aria-hidden="true" />
              <div>
                <span>
                  {state.experience === 'learn'
                    ? 'Guided walkthrough complete'
                    : 'Case worked through'}
                </span>
                <strong>Causal debrief</strong>
              </div>
            </div>
            <p>{definition.debrief}</p>
            {state.lastResponse ? (
              <div className={styles.responseCallout}>
                <RotateCcw aria-hidden="true" />
                <span>{state.lastResponse}</span>
              </div>
            ) : null}
            <div className={styles.debriefColumns}>
              <div>
                <h4>Expected actions</h4>
                <ul>
                  {definition.expectedActions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Accepted alternatives</h4>
                <ul>
                  {definition.acceptedAlternatives.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            {outcome.criticalErrors.length ? (
              <div className={styles.criticalErrorBox}>
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>Safety stop to revisit</strong>
                  <ul>
                    {outcome.criticalErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}
            <details className={styles.educatorDebrief} open={state.experience === 'learn'}>
              <summary>Educator mechanics and hidden risk record</summary>
              <dl>
                <div>
                  <dt>Case variation / response path</dt>
                  <dd>
                    {state.seed} · {state.branch}
                  </dd>
                </div>
                <div>
                  <dt>Plateau burden</dt>
                  <dd>{state.risk.highPlateau.toFixed(1)} s</dd>
                </div>
                <div>
                  <dt>Stacked-volume burden</dt>
                  <dd>{state.risk.stackedVolume.toFixed(1)} s</dd>
                </div>
                <div>
                  <dt>Hyperinflation burden</dt>
                  <dd>{state.risk.dynamicHyperinflation.toFixed(1)} s</dd>
                </div>
                <div>
                  <dt>Hypoxemia burden</dt>
                  <dd>{state.risk.hypoxemia.toFixed(1)} s</dd>
                </div>
                <div>
                  <dt>Hypotension burden</dt>
                  <dd>{state.risk.hypotension.toFixed(1)} s</dd>
                </div>
                <div>
                  <dt>Sedation burden</dt>
                  <dd>{state.risk.excessiveSedation.toFixed(1)} s</dd>
                </div>
                <div>
                  <dt>Buffer</dt>
                  <dd>{state.waveforms.length} / 600 samples</dd>
                </div>
              </dl>
              {definition.deviceAdaptationNotes.length ? (
                <ul>
                  {definition.deviceAdaptationNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </details>
          </div>
        )}
      </section>
    </section>
  )
}
