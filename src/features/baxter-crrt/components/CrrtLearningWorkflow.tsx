'use client'

import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Lightbulb,
  LockKeyhole,
  MessageSquareText,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useState, type Dispatch } from 'react'

import type { RuntimeCrrtCase } from '../content'
import {
  selectCrrtDebriefProjection,
  selectCrrtLearningOutcome,
  type CrrtLearningOutcome,
} from '../engine/outcomes'
import type {
  CrrtLearningSessionAction,
  CrrtLearningSessionState,
  CrrtPredictionCommitment,
  CrrtReasoningPhase,
} from '../engine/learningSession'
import type { CrrtRoleLens } from '../engine/types'
import styles from './crrt-learning-workflow.module.css'

const reasoningPhases = [
  ['read', 'Read'],
  ['define', 'Define'],
  ['select', 'Select'],
  ['predict', 'Predict'],
  ['run', 'Run'],
  ['reassess', 'Reassess'],
  ['reflect', 'Reflect'],
] as const satisfies readonly (readonly [CrrtReasoningPhase, string])[]

const roleLabels: Readonly<Record<CrrtRoleLens, string>> = {
  integrated: 'Integrated team',
  operator: 'Operator',
  prescriber: 'Prescriber',
}

const outcomeDomainLabels: Readonly<
  Record<keyof NonNullable<CrrtLearningOutcome['domains']>, string>
> = {
  indicationAndTreatmentGoal: 'Goal',
  modalityAndPrescription: 'Modality / prescription',
  machineAndCircuitOperation: 'Machine / circuit',
  safetyAndTroubleshooting: 'Safety / troubleshooting',
  monitoringAndReassessment: 'Monitoring / reassessment',
  communicationAndCoordination: 'Communication / team',
}

export type CrrtMobileSurface = 'case' | 'machine' | 'circuit' | 'patient' | 'debrief'

interface CrrtLearningWorkflowProps {
  readonly session: CrrtLearningSessionState
  readonly dispatch: Dispatch<CrrtLearningSessionAction>
  readonly availableCases: readonly RuntimeCrrtCase[]
  readonly mobileSurface: CrrtMobileSurface
  readonly onCaseChange: (caseId: string) => void
  readonly onRoleChange: (roleLens: CrrtRoleLens) => void
  readonly onReset: () => void
  readonly onPredictionCommitted?: () => void
  readonly onHintUsed?: () => void
  readonly onFirstSafeAction?: (interventionId: string) => void
  readonly onReassessmentCommitted?: () => void
  readonly onDebriefRevealed?: (outcome: CrrtLearningOutcome) => void
}

function currentRibbonPhase(session: CrrtLearningSessionState): CrrtReasoningPhase {
  if (session.debriefRevealed || session.reassessment.committed) return 'reflect'
  if (session.performedInterventionIds.length > 0) return 'reassess'
  if (session.prediction) return 'run'
  return 'predict'
}

export function CrrtReasoningRibbon({ session }: { session: CrrtLearningSessionState }) {
  const current = currentRibbonPhase(session)
  const currentIndex = reasoningPhases.findIndex(([id]) => id === current)

  return (
    <nav className={styles.reasoningRibbon} aria-label="CRRT reasoning sequence">
      <span>Reasoning loop</span>
      <ol>
        {reasoningPhases.map(([id, label], index) => (
          <li
            key={id}
            data-status={
              index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'pending'
            }
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <i>{index < currentIndex ? <Check aria-hidden="true" /> : index + 1}</i>
            <strong>{label}</strong>
            {index < reasoningPhases.length - 1 ? <ChevronRight aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  )
}

function selectedLabel(
  options: readonly { readonly id: string; readonly label: string }[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.label ?? id
}

function toggleId(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
}

export function CrrtLearningWorkflow({
  session,
  dispatch,
  availableCases,
  mobileSurface,
  onCaseChange,
  onRoleChange,
  onReset,
  onPredictionCommitted,
  onHintUsed,
  onFirstSafeAction,
  onReassessmentCommitted,
  onDebriefRevealed,
}: CrrtLearningWorkflowProps) {
  const definition = session.caseDefinition
  const [goalOptionId, setGoalOptionId] = useState('')
  const [mechanismOptionId, setMechanismOptionId] = useState('')
  const [controlOptionIds, setControlOptionIds] = useState<readonly string[]>([])
  const [responseOptionId, setResponseOptionId] = useState('')
  const [plannedReassessmentIds, setPlannedReassessmentIds] = useState<readonly string[]>([])
  const [actualReassessmentIds, setActualReassessmentIds] = useState<readonly string[]>([])
  const outcome = selectCrrtLearningOutcome(session)
  const debrief = session.debriefRevealed ? selectCrrtDebriefProjection(session) : null
  const usedHintSet = new Set(session.usedHintIds)
  const performedSet = new Set(session.performedInterventionIds)
  const unsafeActionIds = new Set(definition.unsafeActions.map((unsafe) => unsafe.actionId))
  const nextHint = definition.hintLadder
    .slice()
    .sort((left, right) => left.sequence - right.sequence)
    .find((hint) => !usedHintSet.has(hint.id))
  const completePrediction =
    goalOptionId !== '' &&
    mechanismOptionId !== '' &&
    controlOptionIds.length > 0 &&
    responseOptionId !== '' &&
    plannedReassessmentIds.length > 0

  function commitPrediction() {
    if (!completePrediction || session.prediction) return
    const prediction: CrrtPredictionCommitment = {
      goalOptionId,
      mechanismOptionId,
      controlOptionIds,
      responseOptionId,
      reassessmentOptionIds: plannedReassessmentIds,
    }
    dispatch({ type: 'COMMIT_PREDICTION', prediction })
    onPredictionCommitted?.()
  }

  function performIntervention(interventionId: string) {
    const firstSafeAction =
      session.performedInterventionIds.length === 0 && !unsafeActionIds.has(interventionId)
    dispatch({ type: 'PERFORM_INTERVENTION', interventionId })
    if (firstSafeAction) onFirstSafeAction?.(interventionId)
  }

  function commitReassessment() {
    if (actualReassessmentIds.length === 0 || session.reassessment.committed) return
    dispatch({ type: 'COMMIT_REASSESSMENT', optionIds: actualReassessmentIds })
    onReassessmentCommitted?.()
  }

  function revealDebrief() {
    if (!session.reassessment.committed || session.debriefRevealed) return
    dispatch({ type: 'REVEAL_DEBRIEF' })
    onDebriefRevealed?.(outcome)
  }

  return (
    <div className={styles.learningWorkflow}>
      <div
        className={styles.caseWorkflow}
        data-mobile-active={mobileSurface === 'case'}
        data-testid="crrt-case-workflow"
      >
        <div className={styles.contextControls}>
          <label>
            <span>Pilot case</span>
            <select value={definition.id} onChange={(event) => onCaseChange(event.target.value)}>
              {availableCases.map((caseDefinition) => (
                <option key={caseDefinition.id} value={caseDefinition.id}>
                  {caseDefinition.id} · {caseDefinition.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Role lens</span>
            <select
              value={session.roleLens}
              onChange={(event) => onRoleChange(event.target.value as CrrtRoleLens)}
            >
              {definition.roleLenses.map((roleLens) => (
                <option key={roleLens} value={roleLens}>
                  {roleLabels[roleLens]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.resetButton} onClick={onReset}>
            <RefreshCcw aria-hidden="true" /> Clean attempt
          </button>
        </div>

        <header className={styles.caseHeader}>
          <div>
            <span>
              {definition.id} ·{' '}
              {session.experience === 'learn' ? 'Guided Learn' : 'Scored Practice'}
            </span>
            <h3>{definition.title}</h3>
          </div>
          <strong>Attempt {session.attempt}</strong>
        </header>

        <div className={styles.syntheticNotice} role="note">
          <ShieldAlert aria-hidden="true" />
          <p>
            <strong>Synthetic case · review pending.</strong> Exact values, thresholds, scoring, and
            critical-error rules are educational calibration—not clinical targets.
          </p>
        </div>

        <section className={styles.findingsSection} aria-labelledby="crrt-case-findings">
          <div className={styles.workflowHeading}>
            <BrainCircuit aria-hidden="true" />
            <div>
              <span>Read</span>
              <h4 id="crrt-case-findings">Patient, access, circuit, and delivered treatment</h4>
            </div>
          </div>
          <p>{definition.patientDescription}</p>
          <ul>
            {definition.visibleFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
          {session.experience === 'learn' ? (
            <aside className={styles.guidedCallout}>
              <Sparkles aria-hidden="true" />
              <p>
                <strong>Guided focus:</strong> define one patient-centered goal, connect it to a
                mechanism and control, then predict both the immediate device response and the
                delayed reassessment signal.
              </p>
            </aside>
          ) : null}
        </section>

        <section className={styles.predictionSection} aria-labelledby="crrt-prediction-heading">
          <div className={styles.workflowHeading}>
            {session.prediction ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            <div>
              <span>Define · Select · Predict</span>
              <h4 id="crrt-prediction-heading">Commit before controls unlock</h4>
            </div>
          </div>

          {session.prediction ? (
            <dl className={styles.predictionSummary}>
              <div>
                <dt>Goal</dt>
                <dd>{selectedLabel(definition.goalOptions, session.prediction.goalOptionId)}</dd>
              </div>
              <div>
                <dt>Mechanism</dt>
                <dd>
                  {selectedLabel(definition.mechanismOptions, session.prediction.mechanismOptionId)}
                </dd>
              </div>
              <div>
                <dt>Planned control</dt>
                <dd>
                  {session.prediction.controlOptionIds
                    .map((id) => selectedLabel(definition.controlOptions, id))
                    .join('; ')}
                </dd>
              </div>
              <div>
                <dt>Expected response</dt>
                <dd>
                  {selectedLabel(definition.responseOptions, session.prediction.responseOptionId)}
                </dd>
              </div>
              <div>
                <dt>Reassessment plan</dt>
                <dd>
                  {session.prediction.reassessmentOptionIds
                    .map((id) => selectedLabel(definition.reassessmentOptions, id))
                    .join('; ')}
                </dd>
              </div>
            </dl>
          ) : (
            <div className={styles.predictionForm}>
              <label>
                <span>1 · Goal</span>
                <select
                  value={goalOptionId}
                  onChange={(event) => setGoalOptionId(event.target.value)}
                >
                  <option value="">Choose the exact goal…</option>
                  {definition.goalOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>2 · Mechanism</span>
                <select
                  value={mechanismOptionId}
                  onChange={(event) => setMechanismOptionId(event.target.value)}
                >
                  <option value="">Choose the mechanism…</option>
                  {definition.mechanismOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>3 · Planned control</legend>
                {definition.controlOptions.map((option) => (
                  <label key={option.id}>
                    <input
                      checked={controlOptionIds.includes(option.id)}
                      type="checkbox"
                      onChange={() => setControlOptionIds(toggleId(controlOptionIds, option.id))}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                <span>4 · Expected response</span>
                <select
                  value={responseOptionId}
                  onChange={(event) => setResponseOptionId(event.target.value)}
                >
                  <option value="">Choose immediate and delayed response…</option>
                  {definition.responseOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>5 · Reassessment plan</legend>
                {definition.reassessmentOptions.map((option) => (
                  <label key={option.id}>
                    <input
                      checked={plannedReassessmentIds.includes(option.id)}
                      type="checkbox"
                      onChange={() =>
                        setPlannedReassessmentIds(toggleId(plannedReassessmentIds, option.id))
                      }
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <button
                type="button"
                className={styles.commitButton}
                disabled={!completePrediction}
                onClick={commitPrediction}
              >
                Commit prediction <ArrowRight aria-hidden="true" />
              </button>
            </div>
          )}
        </section>

        <section className={styles.actionSection} aria-labelledby="crrt-actions-heading">
          <div className={styles.workflowHeading}>
            <ArrowRight aria-hidden="true" />
            <div>
              <span>Run</span>
              <h4 id="crrt-actions-heading">Intervene through the case and machine</h4>
            </div>
          </div>

          {!session.prediction ? (
            <p className={styles.lockedCopy}>
              <LockKeyhole aria-hidden="true" /> Controls remain locked until prediction is
              committed.
            </p>
          ) : (
            <div className={styles.actionList}>
              {definition.interventions.map((intervention) => {
                const performed = performedSet.has(intervention.id)
                const missingPrerequisite = intervention.prerequisites.find(
                  (id) => !performedSet.has(id),
                )
                const disabled =
                  session.debriefRevealed ||
                  Boolean(missingPrerequisite) ||
                  (performed && !intervention.repeatable)
                return (
                  <article key={intervention.id} data-performed={performed}>
                    <div>
                      <span>{intervention.category}</span>
                      <strong>{intervention.label}</strong>
                      <p>{intervention.description}</p>
                      {missingPrerequisite ? (
                        <small>
                          Requires{' '}
                          {definition.interventions.find((item) => item.id === missingPrerequisite)
                            ?.label ?? missingPrerequisite}
                          .
                        </small>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => performIntervention(intervention.id)}
                    >
                      {performed ? <Check aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
                      {performed ? 'Completed' : 'Perform'}
                    </button>
                    {performed ? (
                      <p className={styles.actionResponse}>{intervention.response}</p>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}

          <div className={styles.timeControls}>
            <div>
              <Clock3 aria-hidden="true" />
              <span>
                <strong>{Math.round(session.simulation.simulationTimeSeconds / 60)} min</strong>
                Separate immediate device response from delayed simulated response.
              </span>
            </div>
            {[5, 30, 60].map((minutes) => (
              <button
                key={minutes}
                type="button"
                disabled={!session.prediction || session.debriefRevealed}
                onClick={() => dispatch({ type: 'ADVANCE_TIME', seconds: minutes * 60 })}
              >
                +{minutes} min
              </button>
            ))}
          </div>
        </section>

        <section className={styles.hintSection} aria-labelledby="crrt-hint-heading">
          <div className={styles.workflowHeading}>
            <Lightbulb aria-hidden="true" />
            <div>
              <span>Hint ladder</span>
              <h4 id="crrt-hint-heading">
                {session.experience === 'learn'
                  ? 'Reveal guidance one step at a time'
                  : 'Optional, scored support'}
              </h4>
            </div>
          </div>
          {session.usedHintIds.length > 0 ? (
            <ol className={styles.usedHints}>
              {definition.hintLadder
                .filter((hint) => usedHintSet.has(hint.id))
                .sort((left, right) => left.sequence - right.sequence)
                .map((hint) => (
                  <li key={hint.id}>{hint.text}</li>
                ))}
            </ol>
          ) : (
            <p>No hints revealed.</p>
          )}
          <button
            type="button"
            disabled={!nextHint || session.debriefRevealed}
            onClick={() => {
              dispatch({ type: 'USE_HINT' })
              onHintUsed?.()
            }}
          >
            <Lightbulb aria-hidden="true" />
            {nextHint ? `Reveal hint ${nextHint.sequence}` : 'All hints used'}
          </button>
          {session.experience === 'practice' ? (
            <small>Each revealed hint subtracts 5 points, capped by the scoring engine.</small>
          ) : null}
        </section>

        <section className={styles.reassessmentSection} aria-labelledby="crrt-reassess-heading">
          <div className={styles.workflowHeading}>
            <MessageSquareText aria-hidden="true" />
            <div>
              <span>Reassess</span>
              <h4 id="crrt-reassess-heading">Compare prediction with actual response</h4>
            </div>
          </div>
          {session.reassessment.committed ? (
            <p className={styles.completedNotice}>
              <Check aria-hidden="true" /> Reassessment committed. Continue to causal debrief.
            </p>
          ) : (
            <fieldset disabled={session.performedInterventionIds.length === 0}>
              <legend>Select every reassessment you actually completed</legend>
              {definition.reassessmentOptions.map((option) => (
                <label key={option.id}>
                  <input
                    checked={actualReassessmentIds.includes(option.id)}
                    type="checkbox"
                    onChange={() =>
                      setActualReassessmentIds(toggleId(actualReassessmentIds, option.id))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
              <button
                type="button"
                disabled={actualReassessmentIds.length === 0}
                onClick={commitReassessment}
              >
                Commit reassessment
              </button>
            </fieldset>
          )}
          {session.performedInterventionIds.length === 0 ? (
            <small>Perform at least one intervention before reassessment.</small>
          ) : null}
        </section>

        {outcome.criticalErrorIds.length > 0 ? (
          <div className={styles.criticalBanner} role="alert">
            <ShieldAlert aria-hidden="true" />
            <p>
              <strong>Draft critical-error candidate triggered</strong>
              {outcome.criticalErrorIds.join(', ')}. This rule remains pending independent review.
            </p>
          </div>
        ) : null}
      </div>

      <section
        className={styles.debriefSection}
        data-mobile-active={mobileSurface === 'debrief'}
        aria-labelledby="crrt-debrief-heading"
      >
        <div className={styles.workflowHeading}>
          <Sparkles aria-hidden="true" />
          <div>
            <span>Reflect</span>
            <h4 id="crrt-debrief-heading">Causal debrief</h4>
          </div>
        </div>

        {!session.reassessment.committed ? (
          <p className={styles.lockedCopy}>
            <LockKeyhole aria-hidden="true" /> Commit prediction, act, and reassess to unlock the
            causal debrief.
          </p>
        ) : !session.debriefRevealed ? (
          <button type="button" className={styles.commitButton} onClick={revealDebrief}>
            Reveal causal debrief <ArrowRight aria-hidden="true" />
          </button>
        ) : debrief ? (
          <div className={styles.debriefBody}>
            <p className={styles.debriefSummary}>{debrief.summary}</p>
            {debrief.outcome.scored && debrief.outcome.score !== null ? (
              <section className={styles.scoreCard} aria-label="Practice score">
                <div>
                  <span>Practice score</span>
                  <strong>{debrief.outcome.score}/100</strong>
                  <small>
                    Draft educational score · {debrief.outcome.hintPenalty} hint-penalty points
                  </small>
                </div>
                {debrief.outcome.domains ? (
                  <dl>
                    {Object.entries(debrief.outcome.domains).map(([domain, score]) => (
                      <div key={domain}>
                        <dt>{outcomeDomainLabels[domain as keyof typeof outcomeDomainLabels]}</dt>
                        <dd>{score}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>
            ) : (
              <p className={styles.learnOutcome}>
                Guided Learn is intentionally unscored. No mastery or competency decision is made.
              </p>
            )}

            <dl className={styles.debriefGrid}>
              <div>
                <dt>Stated goal</dt>
                <dd>{debrief.statedGoalReview}</dd>
              </div>
              <div>
                <dt>Prediction</dt>
                <dd>{debrief.predictionReview}</dd>
              </div>
              <div>
                <dt>Action timeline</dt>
                <dd>{debrief.actionTimelineReview}</dd>
              </div>
              <div>
                <dt>Trends</dt>
                <dd>{debrief.trendReview}</dd>
              </div>
              <div>
                <dt>Required actions</dt>
                <dd>{debrief.requiredActionsReview}</dd>
              </div>
              <div>
                <dt>Critical errors</dt>
                <dd>{debrief.criticalErrorsReview}</dd>
              </div>
              <div>
                <dt>Accepted alternatives</dt>
                <dd>{debrief.acceptedAlternativesReview}</dd>
              </div>
              <div>
                <dt>Machine-navigation point</dt>
                <dd>{debrief.machineNavigationPoint}</dd>
              </div>
            </dl>

            <ol className={styles.causalChain}>
              {debrief.causalChain.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <blockquote>{debrief.transferQuestion}</blockquote>
          </div>
        ) : null}
      </section>
    </div>
  )
}
