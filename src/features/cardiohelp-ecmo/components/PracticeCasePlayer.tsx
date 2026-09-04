'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Eye,
  Gauge,
  Lightbulb,
  ListChecks,
  MousePointerClick,
  Play,
  RotateCcw,
  StepForward,
  Target,
} from 'lucide-react'

import { orderChoices } from '../content/choiceOrder'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import {
  cardiohelpScenarioById,
  predictionControls,
  predictionDirections,
  predictionGoals,
  TIP_TO_TIP_CHECK_ID,
} from '../content/scenarios'
import { clinicalPracticeScenarioById, clinicalPracticeScenarios } from '../content/clinicalCases'
import type {
  ClinicalInterventionDefinition,
  EcmoSimulationState,
  FaultId,
  PredictionControl,
  PredictionDirection,
  ReassessmentQuestion,
  ReassessmentSubmission,
  ScenarioDefinition,
  SimulationAction,
  SupportMode,
} from '../engine'
import { getObservationProgress, type EcmoPracticeStage } from './practice/stages'
import styles from './cardiohelp-ecmo.module.css'

/**
 * The stage panels of a Practice case.
 *
 * This file used to be the whole case player: its own stage rail, its own "what to do next"
 * heading, a case picker, the clock controls and an inline debrief, all stacked in one column
 * beside the simulator. The activity host (`practice/EcmoPracticeActivity.tsx`) now owns the
 * progression, the Now card, the surfaces and the header controls, and renders exactly one of
 * the panels below at a time. What stays here is the panel content the tests and the learners
 * know: the three planning fields, the intervention cards and machine-task checklist, the
 * reassessment questions and their commit/reveal buttons.
 */
export interface CasePanelProps {
  state: EcmoSimulationState
  scenario: ScenarioDefinition
  dispatch: (action: SimulationAction) => void
}

export type { EcmoPracticeStage }

const faultLabels: Record<FaultId, string> = {
  'startup-inspection': 'Complete startup diagnostic, circuit, sensor, and backup check',
  'preload-limited': 'Resolve the identified drainage limitation',
  'return-obstruction': 'Remove the identified return-side obstruction',
  'oxygenator-resistance': 'Escalate the identified oxygenator/circuit resistance',
  recirculation: 'Resolve the cannula/recirculation cause',
  'acute-hypercapnia': 'Apply the predicted phase-aware sweep change',
  'compensated-hypercapnia': 'Confirm the compensated state and avoid blind normalization',
  'gas-source-interruption': 'Restore the verified gas source',
  'arterial-bubble': 'Resolve and clear the source of air',
  'ac-power-loss': 'Restore verified AC power and backup readiness',
  'flow-sensor-failure': 'Restore or replace the flow measurement',
  'differential-hypoxemia': 'Verify upper-body oxygenation, assess both circulations, and escalate',
  'lv-loading': 'Recognize LV-loading cues and escalate for expert evaluation',
  'ecmo-not-initiated': 'Complete readiness, configure support, and start ECMO',
  'hemorrhagic-hypovolemia': 'Control hemorrhage and restore effective preload',
  'tension-pneumothorax': 'Relieve the obstructive thoracic cause',
  vasoplegia: 'Treat vascular tone and the underlying shock cause',
  tamponade: 'Relieve cardiac compression',
  'distal-limb-ischemia': 'Restore cannulated-limb perfusion',
}

export function advanceSimulation(dispatch: CasePanelProps['dispatch'], seconds: number) {
  const boundedSeconds = Math.min(60, Math.max(1, Math.ceil(seconds)))
  for (let index = 0; index < boundedSeconds; index += 1) {
    dispatch({ type: 'STEP' })
  }
}

export function PredictionPanel({
  state,
  dispatch,
  onCommitted,
  stageNumber,
}: Pick<CasePanelProps, 'state' | 'dispatch'> & {
  onCommitted: () => void
  stageNumber: number
}) {
  const [goalId, setGoalId] = useState(state.scenario.prediction.goalId ?? '')
  const [control, setControl] = useState<PredictionControl | ''>(
    state.scenario.prediction.control ?? '',
  )
  const [direction, setDirection] = useState<PredictionDirection | ''>(
    state.scenario.prediction.direction ?? '',
  )

  const complete = Boolean(goalId && control && direction)
  const committed = state.scenario.prediction.committed
  const availableGoals = predictionGoals.filter((goal) =>
    (goal.supportModes as readonly SupportMode[]).includes(state.supportMode),
  )
  const availableControls = predictionControls.filter((item) =>
    item.supportModes.includes(state.supportMode),
  )

  return (
    <section
      id="practice-plan"
      className={styles.predictionPanel}
      data-committed={committed}
      aria-labelledby="prediction-heading"
      tabIndex={-1}
    >
      <div className={styles.workflowHeading}>
        <span>{stageNumber}</span>
        <div>
          <h3 id="prediction-heading">Commit your initial clinical plan</h3>
          <p>Name the goal, first move, and expected physiologic effect for later comparison.</p>
        </div>
      </div>
      <div className={styles.predictionGrid}>
        <label>
          Goal
          <select
            value={goalId}
            disabled={committed}
            onChange={(event) => setGoalId(event.target.value)}
          >
            <option value="">Choose the endpoint…</option>
            {availableGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          First priority
          <select
            value={control}
            disabled={committed}
            onChange={(event) => setControl(event.target.value as PredictionControl)}
          >
            <option value="">Choose one…</option>
            {availableControls.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expected immediate effect
          <select
            value={direction}
            disabled={committed}
            onChange={(event) => setDirection(event.target.value as PredictionDirection)}
          >
            <option value="">Choose one…</option>
            {predictionDirections.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="button"
        className={styles.primaryAction}
        disabled={!complete || committed}
        onClick={() => {
          if (control && direction) {
            dispatch({ type: 'COMMIT_PREDICTION', goalId, control, direction })
            window.requestAnimationFrame(onCommitted)
          }
        }}
      >
        {committed ? <CheckCircle2 aria-hidden="true" /> : <Target aria-hidden="true" />}
        {committed ? 'Prediction committed' : 'Commit before action'}
      </button>
    </section>
  )
}

export function ClinicalCaseBrief({ state, scenario }: Pick<CasePanelProps, 'state' | 'scenario'>) {
  const clinicalCase = scenario.clinicalCase
  const clinical = state.scenario.clinical
  if (!clinicalCase || !clinical) return null

  return (
    <section className={styles.clinicalCaseBrief} aria-labelledby="clinical-case-heading">
      <div className={styles.clinicalCaseMeta}>
        <span>
          {clinicalCase.kind === 'initiation'
            ? 'ECMO initiation'
            : clinicalCase.kind === 'deterioration'
              ? 'Patient deterioration'
              : 'ECMO complication'}
        </span>
        <span data-status={clinical.supportStatus}>
          {clinical.supportStatus.replaceAll('-', ' ')}
        </span>
        <span data-trajectory={clinical.trajectory}>
          {clinical.trajectory.replaceAll('-', ' ')}
        </span>
      </div>
      <span className={styles.kicker}>{clinicalCase.setting}</span>
      <h3 id="clinical-case-heading">{clinicalCase.patientLabel}</h3>
      <p>{clinicalCase.openingNarrative}</p>
      <dl className={styles.clinicalDataGrid}>
        {clinicalCase.data.map((item) => (
          <div key={item.label} data-trend={item.trend ?? 'stable'}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {clinical.revealedFindings.length ? (
        <div className={styles.revealedFindings} role="status" aria-live="polite">
          <strong>New findings</strong>
          <ul>
            {clinical.revealedFindings.map((finding) => (
              <li key={finding}>{finding}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function simulatorActionCurrentValue(
  state: EcmoSimulationState,
  intervention: ClinicalInterventionDefinition,
) {
  const action = intervention.simulatorAction
  if (!action) return ''
  if (action.control === 'rpm') return `${state.device.rpmSetpoint} RPM`
  if (action.control === 'sweep') return `${state.gas.sweepLpm.toFixed(1)} L/min`
  if (action.control === 'gas-fio2') return `${Math.round(state.gas.fio2 * 100)}%`
  if (action.control === 'restore-gas') {
    return state.gas.sourceConnected ? 'Gas source connected' : 'Gas source disconnected'
  }
  if (action.control === 'resume-after-bubble') {
    return `Support: ${state.device.pumpRunning ? 'RUNNING' : 'STOPPED'}`
  }
  if (action.control === 'clamp-drainage' || action.control === 'unclamp-drainage') {
    return `Drainage clamp: ${state.circuit.drainageClampClosed ? 'CLOSED' : 'OPEN'}`
  }
  if (action.control === 'clamp-return' || action.control === 'unclamp-return') {
    return `Return clamp: ${state.circuit.returnClampClosed ? 'CLOSED' : 'OPEN'}`
  }
  return state.device.powerSource === 'ac' ? 'AC connected' : 'Battery power'
}

function ClinicalActionPanel({
  state,
  scenario,
  dispatch,
  stageNumber,
  showTeachingFeedback,
  onFocusControl,
}: CasePanelProps & {
  stageNumber: number
  showTeachingFeedback: boolean
  onFocusControl: (controlId: string) => void
}) {
  const clinicalCase = scenario.clinicalCase
  const clinical = state.scenario.clinical
  if (!clinicalCase || !clinical) return null
  const enabled = true
  const appliedIds = new Set(clinical.appliedInterventions.map((record) => record.interventionId))
  const simulatorTasks = clinicalCase.interventions.filter(
    (item) => item.simulatorAction?.visibility === 'prompted',
  )
  const interventionCards = clinicalCase.interventions.filter((item) => !item.simulatorAction)
  const targets = clinicalCase.initiationTargets
  const initiationControlItems = targets
    ? [
        {
          id: 'rpm',
          label: 'CARDIOHELP RPM',
          ordered: `${targets.rpm} RPM`,
          current: `${state.device.rpmSetpoint} RPM`,
          location: 'console',
          controlId: 'cardiohelp-rpm-control' as const,
          matched: Math.abs(state.device.rpmSetpoint - targets.rpm) <= (targets.rpmTolerance ?? 50),
        },
        {
          id: 'sweep',
          label: 'Sweep flow',
          ordered: `${targets.sweepLpm.toFixed(1)} L/min`,
          current: `${state.gas.sweepLpm.toFixed(1)} L/min`,
          location: 'gas blender',
          controlId: 'cardiohelp-sweep-control' as const,
          matched:
            Math.abs(state.gas.sweepLpm - targets.sweepLpm) <= (targets.sweepTolerance ?? 0.1),
        },
        {
          id: 'fio2',
          label: 'Sweep-gas FiO₂',
          ordered: `${Math.round(targets.fio2 * 100)}%`,
          current: `${Math.round(state.gas.fio2 * 100)}%`,
          location: 'gas blender',
          controlId: 'cardiohelp-fio2-control' as const,
          matched: Math.abs(state.gas.fio2 - targets.fio2) <= (targets.fio2Tolerance ?? 0.01),
        },
      ]
    : []
  const initiationSettingsMatched =
    initiationControlItems.length > 0 && initiationControlItems.every((item) => item.matched)
  const latestIntervention = clinical.appliedInterventions.at(-1)
  const latestDefinition = latestIntervention
    ? clinicalCase.interventions.find(
        (intervention) => intervention.id === latestIntervention.interventionId,
      )
    : undefined
  const hardInterruptActive = Boolean(latestDefinition?.penalty?.critical)

  return (
    <section
      id="practice-treatment"
      className={styles.actionPanel}
      aria-labelledby="action-heading"
      tabIndex={-1}
    >
      <div className={styles.workflowHeading}>
        <span>{stageNumber}</span>
        <div>
          <h3 id="action-heading">Intervene and watch the patient respond</h3>
          <p>
            Use the simulated machine, circuit, gas panel, and case interventions. Helpful,
            temporary, and harmful actions produce different responses.
          </p>
        </div>
      </div>

      <div className={styles.interactionInstructions} role="note">
        <MousePointerClick aria-hidden="true" />
        <div>
          <strong>How to use this step</strong>
          <span>
            Apply bedside interventions from the cards. Machine-setting tasks send you to the actual
            console or gas control and complete automatically there. Unsafe console choices and
            ineffective interventions still shape the modeled response and debrief.
          </span>
        </div>
      </div>

      {targets ? (
        <div className={styles.initiationSettings}>
          <div>
            <span className={styles.kicker}>Simulated initiation orders</span>
            <strong>Configure on the simulator before starting support</strong>
            <p>
              Set RPM on the CARDIOHELP console. Set sweep and sweep-gas FiO₂ on the separate gas
              blender. These case orders are not universal clinical targets.
            </p>
          </div>
          <ul className={styles.initiationSettingsGrid} aria-label="Initiation setting checklist">
            {initiationControlItems.map((item) => (
              <li key={item.id} data-matched={item.matched}>
                <div>
                  <span>{item.label}</span>
                  <strong>Order · {item.ordered}</strong>
                  <small>Current · {item.current}</small>
                </div>
                <button
                  type="button"
                  disabled={!enabled}
                  aria-label={`Go to ${item.label} control`}
                  onClick={() => onFocusControl(item.controlId)}
                >
                  {item.matched ? (
                    <CheckCircle2 aria-hidden="true" />
                  ) : (
                    <ArrowRight aria-hidden="true" />
                  )}
                  {item.matched ? 'Review control' : `Adjust on ${item.location}`}
                </button>
              </li>
            ))}
          </ul>
          <p className={styles.initiationSettingsStatus} role="status" aria-live="polite">
            {initiationSettingsMatched
              ? 'All three case orders match. Complete readiness and connection, then start support.'
              : 'Use the adjustment buttons to move to each simulator control. Current values update here automatically.'}
          </p>
        </div>
      ) : null}

      {simulatorTasks.length ? (
        <div className={styles.simulatorActionTasks}>
          <div>
            <span className={styles.kicker}>Complete on the simulator</span>
            <strong>Machine changes cannot be applied from this side panel</strong>
            <p>
              Open the indicated console or gas control and make the change there. This checklist
              updates automatically when the simulated control reaches the required state.
            </p>
          </div>
          <ul aria-label="Required simulator actions">
            {simulatorTasks.map((item) => {
              const completed = appliedIds.has(item.id)
              const simulatorAction = item.simulatorAction!
              return (
                <li key={item.id} data-completed={completed}>
                  <span aria-hidden="true">{completed ? '✓' : '○'}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{simulatorAction.instruction}</small>
                    <em>Current · {simulatorActionCurrentValue(state, item)}</em>
                  </div>
                  <button
                    type="button"
                    disabled={!enabled}
                    onClick={() => onFocusControl(simulatorAction.controlId)}
                  >
                    {completed ? (
                      <CheckCircle2 aria-hidden="true" />
                    ) : (
                      <ArrowRight aria-hidden="true" />
                    )}
                    {completed ? 'Review simulator control' : 'Go to simulator control'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className={styles.clinicalInterventionGrid}>
        {interventionCards.map((item) => {
          const completed = appliedIds.has(item.id)
          return (
            <button
              type="button"
              key={item.id}
              data-category={item.category}
              data-completed={completed}
              disabled={!enabled || (completed && !item.repeatable)}
              onClick={() =>
                dispatch({ type: 'APPLY_CLINICAL_INTERVENTION', interventionId: item.id })
              }
            >
              <span>{item.category}</span>
              <strong>
                {completed ? 'Completed · ' : ''}
                {item.label}
              </strong>
              <small>{item.description}</small>
              <em>{completed ? 'Applied' : 'Click to apply'}</em>
            </button>
          )
        })}
      </div>

      {targets ? (
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!enabled || clinical.supportStatus === 'on-ecmo'}
          onClick={() => dispatch({ type: 'START_ECMO' })}
        >
          <Play aria-hidden="true" />
          {clinical.supportStatus === 'ready-to-start'
            ? 'Start ECMO after correcting settings'
            : 'Start ECMO with current settings'}
        </button>
      ) : null}

      <div
        className={styles.clinicalResponsePanel}
        data-trajectory={clinical.trajectory}
        role="status"
        aria-live="polite"
      >
        <Activity aria-hidden="true" />
        <div>
          <strong>Patient trajectory · {clinical.trajectory.replaceAll('-', ' ')}</strong>
          <span>
            {showTeachingFeedback || hardInterruptActive
              ? (clinical.lastResponse ?? clinicalCase.deteriorationResponse)
              : 'Routine teaching note saved for the debrief. Read the trajectory and live patient, circuit, gas, and console signals.'}
          </span>
        </div>
      </div>

      {clinical.appliedInterventions.length ? (
        <div className={styles.interventionTimeline}>
          <div className={styles.interventionTimelineHeading}>
            <ListChecks aria-hidden="true" />
            <strong>Intervention timeline</strong>
          </div>
          <ol>
            {clinical.appliedInterventions.map((record) => (
              <li key={record.id} data-effect={record.effect}>
                <time>{record.time}s</time>
                <span>
                  <strong>{record.label}</strong>
                  {showTeachingFeedback ||
                  clinicalCase.interventions.some(
                    (intervention) =>
                      intervention.id === record.interventionId && intervention.penalty?.critical,
                  ) ? (
                    <small>{record.response}</small>
                  ) : (
                    <small>Response explanation deferred to the debrief.</small>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  )
}

export function ActionPanel({
  state,
  scenario,
  dispatch,
  stageNumber,
  showTeachingFeedback,
  onFocusControl,
}: CasePanelProps & {
  stageNumber: number
  showTeachingFeedback: boolean
  onFocusControl: (controlId: string) => void
}) {
  if (scenario.clinicalCase) {
    return (
      <ClinicalActionPanel
        state={state}
        scenario={scenario}
        dispatch={dispatch}
        stageNumber={stageNumber}
        showTeachingFeedback={showTeachingFeedback}
        onFocusControl={onFocusControl}
      />
    )
  }
  const enabled = true
  const correctiveFault = scenario.expectation.correctiveFault
  const corrected = state.scenario.correctedFaults.includes(correctiveFault)

  return (
    <section
      id="practice-treatment"
      className={styles.actionPanel}
      aria-labelledby="action-heading"
      tabIndex={-1}
    >
      <div className={styles.workflowHeading}>
        <span>{stageNumber}</span>
        <div>
          <h3 id="action-heading">Act, advance time, and inspect the response</h3>
          <p>
            Controls remain available for deliberate alternate paths; safety-critical shortcuts
            trigger a safety record for the debrief.
          </p>
        </div>
      </div>

      <div className={styles.actionButtons}>
        {correctiveFault === 'startup-inspection' ? (
          <button
            type="button"
            disabled={!enabled || corrected}
            onClick={() => dispatch({ type: 'PERFORM_CHECK', checkId: TIP_TO_TIP_CHECK_ID })}
          >
            <Eye aria-hidden="true" /> Complete startup + tip-to-tip check
          </button>
        ) : null}
        {correctiveFault === 'preload-limited' ? (
          <>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => dispatch({ type: 'SET_RPM', rpm: state.device.rpmSetpoint - 300 })}
            >
              <Gauge aria-hidden="true" /> Reduce RPM 300
            </button>
            <button
              type="button"
              className={styles.unsafeAction}
              disabled={!enabled}
              onClick={() => dispatch({ type: 'SET_RPM', rpm: state.device.rpmSetpoint + 300 })}
            >
              <AlertOctagon aria-hidden="true" /> Increase RPM 300
            </button>
          </>
        ) : null}
        {scenario.id === 'compensated-hypercapnia' ? (
          <button
            type="button"
            disabled={!enabled || corrected}
            onClick={() => dispatch({ type: 'SET_SWEEP', sweep: state.gas.sweepLpm })}
          >
            <CheckCircle2 aria-hidden="true" /> Hold sweep and reassess the compensated state
          </button>
        ) : null}
        {[
          'startup-inspection',
          'acute-hypercapnia',
          'compensated-hypercapnia',
          'gas-source-interruption',
          'ac-power-loss',
        ].includes(correctiveFault) ? null : (
          <button
            type="button"
            disabled={!enabled || corrected}
            onClick={() => dispatch({ type: 'CORRECT_FAULT', fault: correctiveFault })}
          >
            <CheckCircle2 aria-hidden="true" /> {faultLabels[correctiveFault]}
          </button>
        )}
        {correctiveFault === 'gas-source-interruption' ? (
          <button
            type="button"
            disabled={!enabled || state.gas.sourceConnected}
            onClick={() => dispatch({ type: 'RESTORE_GAS_SOURCE' })}
          >
            <CheckCircle2 aria-hidden="true" /> Restore verified gas source
          </button>
        ) : null}
        {correctiveFault === 'ac-power-loss' ? (
          <button
            type="button"
            disabled={!enabled || state.device.powerSource === 'ac'}
            onClick={() => dispatch({ type: 'RESTORE_AC_POWER' })}
          >
            <CheckCircle2 aria-hidden="true" /> Restore AC power + verify backup
          </button>
        ) : null}
        {scenario.id === 'vv-off-sweep-capstone' ? (
          <button
            type="button"
            disabled={!enabled || corrected}
            onClick={() => dispatch({ type: 'SET_SWEEP', sweep: 0 })}
          >
            <CheckCircle2 aria-hidden="true" /> Set sweep to zero; maintain circuit blood flow
          </button>
        ) : null}
        {correctiveFault === 'arterial-bubble' ? (
          <button
            type="button"
            disabled={!enabled || !corrected}
            onClick={() => dispatch({ type: 'RESET_BUBBLE' })}
          >
            <RotateCcw aria-hidden="true" /> Reset after circuit is clear
          </button>
        ) : null}
        {state.alarms[0] ? (
          <button
            type="button"
            disabled={!enabled}
            onClick={() => dispatch({ type: 'ACK_ALARM', alarmId: state.alarms[0]?.id })}
          >
            Pause alarm audio; cause remains active
          </button>
        ) : null}
      </div>

      <div className={styles.actionCue} role="status" aria-live="polite">
        <Lightbulb aria-hidden="true" />
        <span>
          {enabled
            ? 'Use the console, circuit check, gas panel, and independent patient data. Then advance time before reassessment.'
            : 'Use the available controls to explore the response.'}
        </span>
      </div>
    </section>
  )
}

function ReassessmentQuestionField({
  domain,
  question,
  orderKey,
  value,
  disabled,
  revealed,
  onChange,
}: {
  domain: 'device' | 'circuit' | 'patient'
  question: ReassessmentQuestion
  /** Rotates the authored option order deterministically, so the best answer is not always first. */
  orderKey: string
  value: string
  disabled: boolean
  revealed: boolean
  onChange: (optionId: string) => void
}) {
  const selectedIsCorrect = value === question.correctOptionId
  const correctOption = question.options.find((item) => item.id === question.correctOptionId)
  const legend =
    domain === 'device'
      ? 'Device / console response'
      : domain === 'circuit'
        ? 'Circuit / gas response'
        : 'Patient response'

  return (
    <fieldset className={styles.reassessmentQuestion} data-domain={domain}>
      <legend>{legend}</legend>
      <p>{question.prompt}</p>
      <div>
        {orderChoices(`${orderKey}-${domain}`, question.options).map((item) => {
          const selected = value === item.id
          const showCorrect = revealed && item.id === question.correctOptionId
          const showIncorrect = revealed && selected && !showCorrect
          return (
            <label
              key={item.id}
              data-selected={selected}
              data-result={showCorrect ? 'correct' : showIncorrect ? 'incorrect' : 'unscored'}
            >
              <input
                type="radio"
                name={`reassessment-${domain}`}
                value={item.id}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(item.id)}
              />
              <span>{item.label}</span>
            </label>
          )
        })}
      </div>
      {revealed && !selectedIsCorrect ? (
        <small className={styles.expectedReassessmentAnswer}>
          Expected response: {correctOption?.label}
        </small>
      ) : null}
    </fieldset>
  )
}

export function ReassessmentPanel({
  state,
  scenario,
  dispatch,
  onReveal,
  stageNumber,
  onShowStage,
}: CasePanelProps & {
  onReveal: () => void
  stageNumber: number
  onShowStage: (stage: EcmoPracticeStage) => void
}) {
  const reassessment = useMemo(() => resolveScenarioReassessment(scenario), [scenario])
  const [answers, setAnswers] = useState<ReassessmentSubmission>(
    state.scenario.reassessment ?? {
      deviceOptionId: '',
      circuitOptionId: '',
      patientOptionId: '',
    },
  )
  const revealButtonRef = useRef<HTMLButtonElement>(null)
  const submitted = state.scenario.reassessment !== null
  const revealed = state.scenario.phase === 'complete'
  const minimumObservationSeconds = scenario.assessmentPolicy?.minimumObservationSeconds ?? 1
  const reassessmentGuidance = scenario.assessmentPolicy?.reassessmentGuidance
  const correctedAt = state.scenario.causeCorrectedAt
  const acknowledgedAt = state.alarms.reduce<number | null>(
    (latest, alarm) =>
      alarm.acknowledgedAt === undefined
        ? latest
        : Math.max(latest ?? alarm.acknowledgedAt, alarm.acknowledgedAt),
    null,
  )
  const acknowledgementOnly = correctedAt === null && acknowledgedAt !== null
  const observation = getObservationProgress(state, scenario)
  const deviceObservationComplete = Boolean(answers.deviceOptionId)
  const circuitObservationComplete = Boolean(answers.circuitOptionId)
  const patientObservationComplete = Boolean(answers.patientOptionId)
  const domainsComplete =
    deviceObservationComplete && circuitObservationComplete && patientObservationComplete
  const commitReady = domainsComplete && !submitted
  const commitLabel = submitted
    ? 'Reassessment submitted'
    : !domainsComplete
      ? 'Commit reassessment · select all three responses'
      : 'Commit reassessment'

  useEffect(() => {
    if (submitted && !revealed) revealButtonRef.current?.focus()
  }, [submitted, revealed])

  return (
    <section
      id="practice-reassessment"
      className={styles.reassessmentPanel}
      aria-labelledby="reassessment-heading"
      tabIndex={-1}
    >
      <div className={styles.workflowHeading}>
        <span>{stageNumber}</span>
        <div>
          <h3 id="reassessment-heading">Reassess before reveal</h3>
          <p>
            Choose the observed device, circuit/gas, and patient responses. The debrief compares all
            three with scenario-specific evidence.
          </p>
        </div>
      </div>
      <div
        id="reassessment-context-checklist"
        className={styles.reassessmentChecklist}
        aria-label="Reassessment context"
      >
        <strong>Context captured so far</strong>
        <ul>
          <li data-complete={state.scenario.prediction.committed}>
            <span aria-hidden="true">{state.scenario.prediction.committed ? '✓' : '○'}</span>
            Initial clinical plan committed
          </li>
          <li data-complete={observation.anchor !== null}>
            <span aria-hidden="true">{observation.anchor !== null ? '✓' : '○'}</span>
            At least one intervention or corrective action completed
          </li>
          <li data-complete={observation.responseObserved}>
            <span aria-hidden="true">{observation.responseObserved ? '✓' : '○'}</span>
            Response observed for {Math.min(observation.elapsedSeconds, minimumObservationSeconds)}/
            {minimumObservationSeconds} seconds
          </li>
          <li data-complete={deviceObservationComplete}>
            <span aria-hidden="true">{deviceObservationComplete ? '✓' : '○'}</span>
            Device/console response selected
          </li>
          <li data-complete={circuitObservationComplete}>
            <span aria-hidden="true">{circuitObservationComplete ? '✓' : '○'}</span>
            Circuit/gas response selected
          </li>
          <li data-complete={patientObservationComplete}>
            <span aria-hidden="true">{patientObservationComplete ? '✓' : '○'}</span>
            Patient response selected
          </li>
        </ul>
      </div>
      {reassessmentGuidance ? (
        <div className={styles.assessmentGuidance} role="note">
          <strong>Required review domains</strong>
          <span>
            <b>Device:</b> {reassessmentGuidance.device}
          </span>
          <span>
            <b>Circuit/gas:</b> {reassessmentGuidance.circuit}
          </span>
          <span>
            <b>Patient:</b> {reassessmentGuidance.patient}
          </span>
        </div>
      ) : null}
      <p className={styles.reassessmentInstruction}>{reassessment.instruction}</p>
      <div className={styles.reassessmentGrid}>
        <ReassessmentQuestionField
          domain="device"
          question={reassessment.device}
          orderKey={scenario.id}
          value={answers.deviceOptionId}
          disabled={submitted}
          revealed={revealed}
          onChange={(deviceOptionId) => setAnswers((current) => ({ ...current, deviceOptionId }))}
        />
        <ReassessmentQuestionField
          domain="circuit"
          question={reassessment.circuit}
          orderKey={scenario.id}
          value={answers.circuitOptionId}
          disabled={submitted}
          revealed={revealed}
          onChange={(circuitOptionId) => setAnswers((current) => ({ ...current, circuitOptionId }))}
        />
        <ReassessmentQuestionField
          domain="patient"
          question={reassessment.patient}
          orderKey={scenario.id}
          value={answers.patientOptionId}
          disabled={submitted}
          revealed={revealed}
          onChange={(patientOptionId) => setAnswers((current) => ({ ...current, patientOptionId }))}
        />
      </div>
      {!observation.responseObserved ? (
        <div className={styles.observationGate}>
          <span role="status">
            {observation.anchor === null
              ? 'Take an intervention or corrective action before reassessing.'
              : `Advance ${observation.remainingSeconds} more simulated second${observation.remainingSeconds === 1 ? '' : 's'} to observe the response.`}
          </span>
          {observation.anchor !== null ? (
            <button
              type="button"
              onClick={() => advanceSimulation(dispatch, observation.remainingSeconds)}
            >
              <StepForward aria-hidden="true" />
              Advance {observation.remainingSeconds}s now
            </button>
          ) : (
            <button type="button" onClick={() => onShowStage('manage')}>
              <ArrowRight aria-hidden="true" /> Return to the manage stage
            </button>
          )}
        </div>
      ) : null}
      {acknowledgementOnly ? (
        <p className={styles.observationGate} role="alert">
          Acknowledgement paused the alarm sound but did not resolve the cause. Completing the case
          now records a critical acknowledgement-without-correction error.
        </p>
      ) : null}
      <div className={styles.reassessmentActions}>
        <button
          type="button"
          className={styles.primaryAction}
          disabled={!commitReady}
          aria-describedby="reassessment-context-checklist"
          onClick={() =>
            dispatch({
              type: 'COMMIT_REASSESSMENT',
              answers,
            })
          }
        >
          <CheckCircle2 aria-hidden="true" /> {commitLabel}
        </button>
        <button ref={revealButtonRef} type="button" disabled={revealed} onClick={onReveal}>
          <ArrowRight aria-hidden="true" /> Reveal causal debrief
        </button>
      </div>

      {submitted && !revealed ? (
        <p className={styles.acceptedCue} role="status">
          Reassessment submitted. Select “Reveal causal debrief” to continue.
        </p>
      ) : null}
    </section>
  )
}

export function resolveScenarioDefinition(scenarioId: string): ScenarioDefinition {
  return (
    clinicalPracticeScenarioById.get(scenarioId) ??
    cardiohelpScenarioById.get(scenarioId) ??
    clinicalPracticeScenarios[0]
  )
}
