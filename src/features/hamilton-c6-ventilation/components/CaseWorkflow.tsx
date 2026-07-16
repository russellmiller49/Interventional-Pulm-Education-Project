'use client'

import { useEffect, useMemo, useState, type Dispatch } from 'react'
import {
  BadgeCheck,
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleAlert,
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
import styles from './hamilton-c6-ventilation.module.css'

const categoryLabels: Record<InterventionCategory, string> = {
  assessment: 'Assessment & reassessment',
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

function DomainScore({ outcome }: { outcome: CaseOutcome }) {
  const rows = [
    ['Safety', outcome.domains.safety, 20],
    ['Mechanism', outcome.domains.mechanism, 20],
    ['Corrective actions', outcome.domains.correctiveActions, 30],
    ['Reassessment', outcome.domains.reassessment, 20],
    ['Communication / comfort', outcome.domains.communicationComfort, 10],
  ] as const
  return (
    <div className={styles.scoreBreakdown}>
      {rows.map(([label, score, maximum]) => (
        <div key={label}>
          <span>{label}</span>
          <span className={styles.scoreTrack} aria-hidden="true">
            <span style={{ width: `${(score / maximum) * 100}%` }} />
          </span>
          <strong>
            {score}/{maximum}
          </strong>
        </div>
      ))}
    </div>
  )
}

export function CaseWorkflow({
  state,
  definition,
  dispatch,
  onResult,
}: {
  state: VentilationSimulationState
  definition: VentilationCaseDefinition
  dispatch: Dispatch<VentilationAction>
  onResult: (outcome: CaseOutcome) => void
}) {
  const [mechanismId, setMechanismId] = useState('')
  const [priorityId, setPriorityId] = useState('')
  const [responseId, setResponseId] = useState('')
  const [resultRecorded, setResultRecorded] = useState(false)
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
  }, [definition.interventions])

  useEffect(() => {
    setMechanismId('')
    setPriorityId('')
    setResponseId('')
    setResultRecorded(false)
  }, [definition.id, state.experience])

  useEffect(() => {
    if (state.phase !== 'debrief' || resultRecorded || state.experience !== 'practice') return
    setResultRecorded(true)
    onResult(outcome)
  }, [onResult, outcome, resultRecorded, state.experience, state.phase])

  const performedIds = new Set(state.interventions.map((record) => record.interventionId))
  const predictionReady = Boolean(mechanismId && priorityId && responseId)
  const hintAvailable =
    state.experience === 'learn' ||
    (state.challengeMode === 'untimed' && state.simulationTime >= 60)

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

      <section className={styles.workflowSection}>
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

      <section
        className={styles.workflowSection}
        data-locked={state.experience === 'practice' && state.prediction.committed}
      >
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
            <BadgeCheck aria-hidden="true" /> Prediction locked. Act on it, then reassess its
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

      <section className={styles.workflowSection} data-locked={!state.prediction.committed}>
        <div className={styles.workflowSectionHeading}>
          <Gauge aria-hidden="true" />
          <div>
            <span>Steps 3–4</span>
            <h3>Intervene, then watch the response</h3>
          </div>
        </div>
        {!state.prediction.committed ? (
          <p className={styles.lockedNotice}>
            Ventilator controls and bedside intervention cards unlock after commitment.
          </p>
        ) : null}
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
                      disabled={
                        !state.prediction.committed ||
                        Boolean(unmet) ||
                        (isPerformed && !intervention.repeatable)
                      }
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
        {state.lastResponse ? (
          <div className={styles.responseCallout} role="status">
            <RotateCcw aria-hidden="true" />
            <span>{state.lastResponse}</span>
          </div>
        ) : null}
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.workflowSectionHeading}>
          <Stethoscope aria-hidden="true" />
          <div>
            <span>Step 5</span>
            <h3>Repeat the discriminating assessment</h3>
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
          disabled={!state.prediction.committed || state.interventions.length === 0}
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
            {state.experience === 'learn' ? 'Show guided hint' : 'Use hint (−5 points)'}
          </button>
          {state.experience === 'practice' && !hintAvailable ? (
            <small>
              {state.challengeMode === 'timed'
                ? 'Hints are hidden in timed challenge.'
                : `Hints unlock after ${Math.max(0, 60 - state.simulationTime).toFixed(0)} simulated seconds.`}
            </small>
          ) : null}
        </div>
      </section>

      <section className={styles.workflowSection}>
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
            disabled={state.experience === 'practice' && !state.reassessment.committed}
            onClick={() => dispatch({ type: 'REVEAL_DEBRIEF' })}
          >
            Reveal case reasoning
          </button>
        ) : (
          <div className={styles.debriefPanel}>
            <div className={styles.outcomeHeader} data-mastery={outcome.mastery}>
              {outcome.mastery ? (
                <BadgeCheck aria-hidden="true" />
              ) : (
                <CircleAlert aria-hidden="true" />
              )}
              <div>
                <span>
                  {state.experience === 'learn'
                    ? 'Guided walkthrough complete'
                    : outcome.mastery
                      ? 'Mastery achieved'
                      : 'Reassessment needed'}
                </span>
                <strong>
                  {state.experience === 'learn' ? 'Teaching case' : `${outcome.score} / 100`}
                </strong>
              </div>
            </div>
            {state.experience === 'practice' ? <DomainScore outcome={outcome} /> : null}
            <p>{definition.debrief}</p>
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
                  <strong>Critical-error rule triggered</strong>
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
                  <dt>Seed / branch</dt>
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
              {definition.c6AdaptationNotes.length ? (
                <ul>
                  {definition.c6AdaptationNotes.map((note) => (
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
