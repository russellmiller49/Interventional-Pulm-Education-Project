'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertOctagon,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CirclePause,
  CirclePlay,
  Clock3,
  Eye,
  Gauge,
  GraduationCap,
  Lightbulb,
  ListChecks,
  MousePointerClick,
  Play,
  RotateCcw,
  StepForward,
  Target,
} from 'lucide-react'

import { Link } from '@/i18n/navigation'
import type { CriticalCareActivityPhase } from '@/features/learning-module/activity'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { cardiohelpScenarioById, predictionGoals, TIP_TO_TIP_CHECK_ID } from '../content/scenarios'
import { clinicalPracticeScenarioById, clinicalPracticeScenarios } from '../content/clinicalCases'
import {
  cardiohelpCurriculum,
  curriculumUnitById,
  nextRecommendedActivity,
  pairedLessonIdsForCase,
  unitIdByCaseScenarioId,
} from '../content/curriculum'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import type {
  ClinicalInterventionDefinition,
  EcmoSimulationState,
  FaultId,
  PredictionControl,
  PredictionDirection,
  ProgressV2,
  ReassessmentQuestion,
  ReassessmentSubmission,
  ScenarioDefinition,
  ScenarioOutcome,
  SimulationAction,
  SupportMode,
} from '../engine'
import styles from './cardiohelp-ecmo.module.css'

interface PracticeCasePlayerProps {
  state: EcmoSimulationState
  scenario: ScenarioDefinition
  progress: ProgressV2
  outcome: ScenarioOutcome
  dispatch: (action: SimulationAction) => void
  onLoadScenario: (scenarioId: string, mode?: EcmoSimulationState['simulationMode']) => void
  onReveal: () => void
  /** 'assess' renders a capstone: no case picker, capstone context line. */
  section?: 'practice' | 'assess'
  phaseRequest?: {
    readonly stage: EcmoPracticeStage
    readonly requestId: number
  } | null
  onPhaseChange?: (phase: CriticalCareActivityPhase) => void
  onActiveStageChange?: (stage: EcmoPracticeStage) => void
}

const predictionControls: readonly {
  value: PredictionControl
  label: string
  supportModes: readonly SupportMode[]
}[] = [
  { value: 'inspect-circuit', label: 'Inspect circuit / sensors', supportModes: ['vv', 'va'] },
  {
    value: 'assess-upper-body',
    label: 'Review right-arm oxygenation and mixed circulation',
    supportModes: ['va'],
  },
  {
    value: 'assess-lv-loading',
    label: 'Review pulsatility, aortic valve, LV, and lungs',
    supportModes: ['va'],
  },
  { value: 'rpm', label: 'Pump RPM', supportModes: ['vv', 'va'] },
  { value: 'sweep', label: 'External sweep flow', supportModes: ['vv', 'va'] },
  { value: 'gas-fio2', label: 'External sweep-gas FiO₂', supportModes: ['vv', 'va'] },
  { value: 'restore-gas', label: 'Restore gas source', supportModes: ['vv', 'va'] },
  { value: 'correct-cause', label: 'Resolve cause before reset', supportModes: ['vv', 'va'] },
  { value: 'restore-power', label: 'Restore verified AC power', supportModes: ['vv', 'va'] },
  { value: 'off-sweep-trial', label: 'VV off-sweep trial', supportModes: ['vv'] },
  {
    value: 'initiate-support',
    label: 'Initiate ECMO with verified settings',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'resuscitate-preload',
    label: 'Restore preload while finding the cause',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'transfuse-and-control',
    label: 'Transfuse and control hemorrhage',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'decompress-chest',
    label: 'Relieve obstructive thoracic/cardiac pressure',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'reposition-cannula',
    label: 'Review and restore cannula position',
    supportModes: ['vv'],
  },
  {
    value: 'exchange-oxygenator',
    label: 'Prepare and exchange the failing component',
    supportModes: ['vv', 'va'],
  },
  {
    value: 'vasopressor',
    label: 'Treat vascular tone and reassess perfusion',
    supportModes: ['va'],
  },
  {
    value: 'restore-distal-perfusion',
    label: 'Restore cannulated-limb perfusion',
    supportModes: ['va'],
  },
  {
    value: 'isolate-circuit',
    label: 'Clamp to isolate the circuit and come off support',
    supportModes: ['vv', 'va'],
  },
]

const predictionDirections: readonly { value: PredictionDirection; label: string }[] = [
  { value: 'increase', label: 'Increase' },
  { value: 'decrease', label: 'Decrease' },
  { value: 'hold', label: 'Hold / do not chase the number' },
  { value: 'inspect', label: 'Inspect and localize first' },
  { value: 'restore', label: 'Restore source' },
  { value: 'off', label: 'Turn off while maintaining blood flow' },
  { value: 'gas-exchange', label: 'Improve oxygenation / CO₂ clearance' },
  { value: 'perfusion', label: 'Improve systemic perfusion' },
  { value: 'drainage', label: 'Restore effective venous drainage' },
  { value: 'temporary', label: 'Temporize while the cause remains' },
  { value: 'definitive', label: 'Definitively resolve the cause' },
]

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

type WorkflowSectionId =
  | 'practice-brief'
  | 'practice-plan'
  | 'practice-treatment'
  | 'practice-reassessment'
  | 'practice-round-selector'

interface ObservationProgress {
  anchor: number | null
  elapsedSeconds: number
  minimumSeconds: number
  remainingSeconds: number
  responseObserved: boolean
}

function getObservationProgress(
  state: EcmoSimulationState,
  scenario: ScenarioDefinition,
): ObservationProgress {
  const correctedAt = state.scenario.causeCorrectedAt
  const lastClinicalActionAt = state.scenario.clinical?.appliedInterventions.at(-1)?.time ?? null
  const acknowledgedAt = state.alarms.reduce<number | null>(
    (latest, alarm) =>
      alarm.acknowledgedAt === undefined
        ? latest
        : Math.max(latest ?? alarm.acknowledgedAt, alarm.acknowledgedAt),
    null,
  )
  const anchor = correctedAt ?? lastClinicalActionAt ?? acknowledgedAt
  const minimumSeconds = scenario.assessmentPolicy?.minimumObservationSeconds ?? 1
  const elapsedSeconds = anchor === null ? 0 : Math.max(0, state.simulationTime - anchor)
  const remainingSeconds = Math.max(0, minimumSeconds - elapsedSeconds)
  return {
    anchor,
    elapsedSeconds,
    minimumSeconds,
    remainingSeconds,
    responseObserved: anchor !== null && remainingSeconds === 0,
  }
}

function navigateToWorkflowSection(sectionId: WorkflowSectionId) {
  const section = document.getElementById(sectionId)
  if (!section) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  section.focus({ preventScroll: true })
  section.scrollIntoView?.({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  })
}

function navigateToSimulatorControl(controlId: string) {
  const control = document.getElementById(controlId)
  if (!control) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  control.focus({ preventScroll: true })
  control.scrollIntoView?.({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'center',
  })
}

function advanceSimulation(dispatch: PracticeCasePlayerProps['dispatch'], seconds: number) {
  const boundedSeconds = Math.min(60, Math.max(1, Math.ceil(seconds)))
  for (let index = 0; index < boundedSeconds; index += 1) {
    dispatch({ type: 'STEP' })
  }
}

export type EcmoPracticeStage = 'brief' | 'plan' | 'manage' | 'reassess' | 'debrief'
type CaseStage = EcmoPracticeStage

const semanticPhaseByCaseStage: Readonly<
  Record<Exclude<CaseStage, 'debrief'>, CriticalCareActivityPhase>
> = {
  brief: 'recognize',
  plan: 'predict',
  manage: 'act',
  reassess: 'observe',
}

const stagePanelIds: Record<CaseStage, string> = {
  brief: 'practice-brief',
  plan: 'practice-plan',
  manage: 'practice-treatment',
  reassess: 'practice-reassessment',
  debrief: 'practice-reassessment',
}

interface StageDescriptor {
  id: CaseStage
  number: number
  label: string
  complete: boolean
  summary?: string
}

function StageRail({
  state,
  scenario,
  dispatch,
  onReveal,
  outcome,
  stages,
  currentStage,
  activeStage,
  onShowStage,
  onBeginCase,
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario' | 'dispatch' | 'onReveal' | 'outcome'> & {
  stages: readonly StageDescriptor[]
  currentStage: CaseStage
  activeStage: CaseStage
  onShowStage: (stage: CaseStage) => void
  onBeginCase: () => void
}) {
  const observation = getObservationProgress(state, scenario)
  const planComplete = state.scenario.prediction.committed
  const treatmentAttempted = observation.anchor !== null
  const causeCorrected = state.scenario.correctedFaults.includes(
    scenario.expectation.correctiveFault,
  )
  const reassessmentSubmitted = state.scenario.reassessment !== null
  const debriefRevealed = state.scenario.phase === 'complete'

  let nextTitle = 'Choose and apply an intervention'
  let nextDescription = treatmentAttempted
    ? 'Continue treating if another action is needed. When this is your final decision, observe the response and reassess.'
    : 'Use the intervention cards, ECMO console, circuit, or gas controls. Practice leaves the causal comparison for the response and debrief.'
  let primaryLabel = 'Go to management choices'
  let primaryAction = () => onShowStage('manage')

  if (currentStage === 'brief') {
    nextTitle = 'Review the case and its objectives'
    nextDescription =
      'Read the presentation, data, and learning objectives. You can begin with the plan or open any later step to inspect what it contains.'
    primaryLabel = 'Begin case'
    primaryAction = onBeginCase
  } else if (!planComplete) {
    nextTitle = 'Complete the three planning fields'
    nextDescription =
      'Choose a goal, first priority, and expected physiologic effect, then click Commit before action.'
    primaryLabel = 'Go to clinical plan'
    primaryAction = () => onShowStage('plan')
  } else if (reassessmentSubmitted && !debriefRevealed) {
    nextTitle = 'Your reassessment is submitted'
    nextDescription =
      'Select reveal to see the diagnosis, teaching explanation, and an expert response comparison.'
    primaryLabel = 'Reveal causal debrief'
    primaryAction = onReveal
  } else if (debriefRevealed) {
    nextTitle = 'Case worked through'
    nextDescription =
      'Review the debrief below: the causal chain, an authored workflow, and the next recommended step.'
    primaryLabel = 'Choose another case'
    primaryAction = () => navigateToWorkflowSection('practice-round-selector')
  } else if (causeCorrected && !observation.responseObserved) {
    nextTitle = `Observe the response for ${observation.remainingSeconds} more second${observation.remainingSeconds === 1 ? '' : 's'}`
    nextDescription =
      'The cause is corrected. Advance the simulation so the circuit and patient can visibly respond before documenting reassessment.'
    primaryLabel = `Advance ${observation.remainingSeconds} second${observation.remainingSeconds === 1 ? '' : 's'} now`
    primaryAction = () => advanceSimulation(dispatch, observation.remainingSeconds)
  } else if (causeCorrected && observation.responseObserved) {
    nextTitle = 'Select the observed response in all three domains'
    nextDescription =
      'Choose one device/console response, one circuit/gas response, and one patient response.'
    primaryLabel = 'Go to reassessment'
    primaryAction = () => onShowStage('reassess')
  }

  const currentIndex = stages.findIndex((stage) => stage.id === currentStage)

  return (
    <section
      id="practice-stage-rail"
      className={styles.workflowGuide}
      aria-labelledby="workflow-guide-heading"
      data-current-step={currentStage}
    >
      <div className={styles.workflowGuideHeading}>
        <span>What to do next</span>
        <h3 id="workflow-guide-heading">{nextTitle}</h3>
        <p>{nextDescription}</p>
      </div>
      <nav
        className={styles.workflowStepNav}
        aria-label="Practice workflow steps"
        data-stages={stages.length}
      >
        {stages.map((stage, index) => {
          const stateLabel = stage.complete
            ? 'complete'
            : stage.id === currentStage
              ? 'current'
              : index <= currentIndex
                ? 'started'
                : 'pending'
          return (
            <button
              type="button"
              key={stage.id}
              data-state={stateLabel}
              data-expanded={stage.id === activeStage}
              aria-current={stage.id === currentStage ? 'step' : undefined}
              onClick={() => onShowStage(stage.id)}
            >
              <span>{stage.complete ? '✓' : stage.number}</span>
              <strong>{stage.label}</strong>
              <small>{stage.summary ?? stateLabel}</small>
            </button>
          )
        })}
      </nav>
      <div className={styles.workflowGuideActions}>
        <button type="button" className={styles.workflowNextAction} onClick={primaryAction}>
          <ArrowRight aria-hidden="true" /> {primaryLabel}
        </button>
        {planComplete && !causeCorrected && treatmentAttempted ? (
          <button
            type="button"
            onClick={() =>
              observation.responseObserved
                ? onShowStage('reassess')
                : advanceSimulation(dispatch, observation.remainingSeconds)
            }
          >
            <StepForward aria-hidden="true" />
            {observation.responseObserved
              ? 'Reassess current response'
              : `Observe current response (${observation.remainingSeconds}s)`}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function PredictionPanel({
  state,
  dispatch,
  onCommitted,
  stageNumber,
}: Pick<PracticeCasePlayerProps, 'state' | 'dispatch'> & {
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

function ClinicalCaseBrief({
  state,
  scenario,
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario'>) {
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
      <div className={styles.clinicalDecisionPrompt}>
        <Activity aria-hidden="true" />
        <div>
          <strong>Your task</strong>
          <span>{clinicalCase.decisionPrompt}</span>
        </div>
      </div>
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

function HintPanel({
  state,
  scenario,
  dispatch,
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario' | 'dispatch'>) {
  const hints = scenario.hints ?? []
  if (!hints.length) return null
  const usedHints = hints.filter((hint) => state.scenario.usedHintIds.includes(hint.id))
  const nextHint = hints.find((hint) => !state.scenario.usedHintIds.includes(hint.id))
  return (
    <section className={styles.hintPanel} aria-labelledby="practice-hint-heading">
      <div>
        <Lightbulb aria-hidden="true" />
        <span>
          <strong id="practice-hint-heading">Stuck?</strong>
          <small>Clues are optional and stay visible in the final reasoning trace.</small>
        </span>
        <em>Use only as much help as you need</em>
      </div>
      {usedHints.length ? (
        <ol aria-live="polite">
          {usedHints.map((hint) => (
            <li key={hint.id}>
              <strong>{hint.title}</strong>
              <span>{hint.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {nextHint ? (
        <button
          type="button"
          disabled={state.scenario.phase === 'complete'}
          onClick={() => {
            dispatch({ type: 'REQUEST_HINT', hintId: nextHint.id })
            if (nextHint.focusId) {
              window.requestAnimationFrame(() => navigateToSimulatorControl(nextHint.focusId!))
            }
          }}
        >
          <Lightbulb aria-hidden="true" />
          {usedHints.length ? 'Show a stronger clue' : 'Give me a clue'}
        </button>
      ) : (
        <p>All available clues have been shown.</p>
      )}
    </section>
  )
}

function SimulationControls({
  state,
  scenario,
  dispatch,
  onLoadScenario,
  section,
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario' | 'dispatch' | 'onLoadScenario'> & {
  section: 'practice' | 'assess'
}) {
  return (
    <section className={styles.simulationControls} aria-label="Simulation clock and mode">
      <div>
        <Clock3 aria-hidden="true" />
        <span>
          <strong>{state.simulationTime}s</strong> deterministic clock
          <small>{state.paused ? 'Paused · use Run clock or Step' : 'Running automatically'}</small>
        </span>
      </div>
      {section === 'practice' ? (
        <div className={styles.segmentedButtons}>
          <button
            type="button"
            data-active={state.simulationMode === 'guided'}
            onClick={() => onLoadScenario(scenario.id, 'guided')}
          >
            Standard practice
          </button>
          <button
            type="button"
            data-active={state.simulationMode === 'challenge'}
            onClick={() => onLoadScenario(scenario.id, 'challenge')}
          >
            Less coaching (harder)
          </button>
        </div>
      ) : (
        <p role="note">Challenge mode collects teaching feedback for the debrief.</p>
      )}
      <button type="button" onClick={() => dispatch({ type: 'SET_PAUSED', paused: !state.paused })}>
        {state.paused ? <CirclePlay aria-hidden="true" /> : <CirclePause aria-hidden="true" />}
        {state.paused ? 'Run clock' : 'Pause clock'}
      </button>
      <button type="button" onClick={() => dispatch({ type: 'STEP' })}>
        <StepForward aria-hidden="true" /> Step 1 second
      </button>
      <button
        type="button"
        onClick={() =>
          onLoadScenario(scenario.id, section === 'assess' ? 'challenge' : state.simulationMode)
        }
      >
        <RotateCcw aria-hidden="true" /> Reset case
      </button>
      <small className={styles.simulationResetNote}>
        {section === 'practice'
          ? 'Changing the coaching mode or resetting starts this case over.'
          : 'Resetting starts a new challenge run; patient context and references remain visible.'}
      </small>
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
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario' | 'dispatch'> & {
  stageNumber: number
  showTeachingFeedback: boolean
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
                  onClick={() => navigateToSimulatorControl(item.controlId)}
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
                    onClick={() => navigateToSimulatorControl(simulatorAction.controlId)}
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

function ActionPanel({
  state,
  scenario,
  dispatch,
  stageNumber,
  showTeachingFeedback,
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario' | 'dispatch'> & {
  stageNumber: number
  showTeachingFeedback: boolean
}) {
  if (scenario.clinicalCase) {
    return (
      <ClinicalActionPanel
        state={state}
        scenario={scenario}
        dispatch={dispatch}
        stageNumber={stageNumber}
        showTeachingFeedback={showTeachingFeedback}
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
  value,
  disabled,
  revealed,
  onChange,
}: {
  domain: 'device' | 'circuit' | 'patient'
  question: ReassessmentQuestion
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
        {question.options.map((item) => {
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

function ReassessmentPanel({
  state,
  scenario,
  dispatch,
  onReveal,
  outcome,
  stageNumber,
  debriefExtras,
}: Pick<PracticeCasePlayerProps, 'state' | 'scenario' | 'dispatch' | 'onReveal' | 'outcome'> & {
  stageNumber: number
  debriefExtras?: ReactNode
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
          value={answers.deviceOptionId}
          disabled={submitted}
          revealed={revealed}
          onChange={(deviceOptionId) => setAnswers((current) => ({ ...current, deviceOptionId }))}
        />
        <ReassessmentQuestionField
          domain="circuit"
          question={reassessment.circuit}
          value={answers.circuitOptionId}
          disabled={submitted}
          revealed={revealed}
          onChange={(circuitOptionId) => setAnswers((current) => ({ ...current, circuitOptionId }))}
        />
        <ReassessmentQuestionField
          domain="patient"
          question={reassessment.patient}
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
            <button type="button" onClick={() => navigateToWorkflowSection('practice-treatment')}>
              <ArrowRight aria-hidden="true" /> Return to treatment step
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

      {revealed ? (
        <div className={styles.debriefPanel}>
          <div className={styles.debriefScore}>
            <span>Causal debrief</span>
            <strong>Case worked through</strong>
            <em>Compare the response, cues, and authored workflow</em>
          </div>
          <div
            className={styles.reassessmentScoreCue}
            role="note"
            aria-label="Reassessment comparison"
          >
            <strong>Response comparison</strong>
            <span>
              {state.scenario.credit.reassessment
                ? 'All three selected responses align with the scenario-specific device, circuit or gas, and patient evidence.'
                : 'At least one selected response differs from the authored post-intervention evidence, or the underlying cause remains. Review the marked choices and workflow below, then try another path.'}
            </span>
          </div>
          <div>
            <span className={styles.kicker}>Diagnosis</span>
            <h4>{scenario.debrief.diagnosis}</h4>
            <ol>
              {scenario.debrief.causalChain.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          {scenario.clinicalCase && state.scenario.clinical ? (
            <div className={styles.clinicalDebriefTimeline}>
              <span className={styles.kicker}>Your clinical course</span>
              <p>
                {state.scenario.correctedFaults.includes(scenario.expectation.correctiveFault)
                  ? scenario.clinicalCase.completionResponse
                  : (state.scenario.clinical.lastResponse ??
                    scenario.clinicalCase.deteriorationResponse)}
              </p>
              <ol>
                {state.scenario.clinical.appliedInterventions.map((record) => (
                  <li key={record.id} data-effect={record.effect}>
                    <strong>
                      {record.time}s · {record.label}
                    </strong>
                    <span>{record.response}</span>
                  </li>
                ))}
              </ol>
              <small>Curriculum source: {scenario.clinicalCase.sourceCase}</small>
            </div>
          ) : null}
          <div>
            <span className={styles.kicker}>
              {scenario.clinicalCase
                ? 'What should have been done—and why'
                : 'Cause-before-reset workflow'}
            </span>
            <ol>
              {scenario.debrief.correctWorkflow.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
          <div className={styles.safetyDebrief}>
            <strong>Safety notes</strong>
            <ul>
              {scenario.debrief.safetyNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {outcome.criticalErrors.length ? (
            <div className={styles.criticalErrors} role="alert">
              <AlertOctagon aria-hidden="true" />
              <div>
                <strong>Safety event to revisit</strong>
                <span>{outcome.criticalErrors.join(', ')}</span>
              </div>
            </div>
          ) : null}
          {debriefExtras}
        </div>
      ) : null}
    </section>
  )
}

export function PracticeCasePlayer(props: PracticeCasePlayerProps) {
  const {
    state,
    scenario,
    progress,
    outcome,
    dispatch,
    onLoadScenario,
    onReveal,
    phaseRequest,
    onPhaseChange,
    onActiveStageChange,
    section = 'practice',
  } = props
  const challengePromptHidden = false
  const supportMode = scenario.supportMode
  const trackUnits = cardiohelpCurriculum[supportMode]
  const caseUnits = useMemo(
    () => trackUnits.filter((unit) => unit.caseScenarioIds.length > 0),
    [trackUnits],
  )
  const trackCaseIds = useMemo(() => caseUnits.flatMap((unit) => unit.caseScenarioIds), [caseUnits])
  const unitId = unitIdByCaseScenarioId.get(scenario.id)
  const unit = unitId ? curriculumUnitById.get(unitId) : undefined
  const unitNumber = unit ? trackUnits.findIndex((item) => item.id === unit.id) + 1 : null
  const unitContextLabel =
    section === 'assess'
      ? 'Challenge'
      : unit && unitNumber
        ? challengePromptHidden
          ? `Unit ${unitNumber}`
          : `Unit ${unitNumber} · ${unit.title}`
        : null

  const hasBrief = Boolean(scenario.clinicalCase)
  // Keyed derived state instead of reset effects: a new attempt (scenario or
  // mode change) invalidates the acknowledgement and any manual expansion, and
  // a stage advance invalidates the expansion, without setState-in-effect.
  const attemptKey = `${scenario.id}:${state.simulationMode}:${state.scenario.attempts}`
  const [briefAcknowledgedFor, setBriefAcknowledgedFor] = useState<string | null>(null)
  const [challengeFeedbackFor, setChallengeFeedbackFor] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<{
    attemptKey: string
    whenCurrent: CaseStage
    stage: CaseStage
  } | null>(null)
  const briefAcknowledged = briefAcknowledgedFor === attemptKey

  const planComplete = state.scenario.prediction.committed
  const causeCorrected = state.scenario.correctedFaults.includes(
    scenario.expectation.correctiveFault,
  )
  const reassessmentSubmitted = state.scenario.reassessment !== null
  const debriefRevealed = state.scenario.phase === 'complete'
  const challengeActive = section === 'assess' || state.simulationMode === 'challenge'
  const showTeachingFeedback =
    !challengeActive || challengeFeedbackFor === attemptKey || debriefRevealed
  const workflowStage: CaseStage = !planComplete
    ? 'plan'
    : reassessmentSubmitted
      ? 'debrief'
      : causeCorrected
        ? 'reassess'
        : 'manage'
  const currentStage: CaseStage =
    hasBrief && !briefAcknowledged && !planComplete ? 'brief' : workflowStage

  useEffect(() => {
    onPhaseChange?.(currentStage === 'debrief' ? 'explain' : semanticPhaseByCaseStage[currentStage])
    onActiveStageChange?.(currentStage)
  }, [currentStage, onActiveStageChange, onPhaseChange])

  const activeStage: CaseStage =
    expanded && expanded.attemptKey === attemptKey && expanded.whenCurrent === currentStage
      ? expanded.stage
      : currentStage
  const workflowReady = true

  const appliedCount = state.scenario.clinical?.appliedInterventions.length ?? 0
  const trajectory = state.scenario.clinical?.trajectory
  const committedGoalLabel = predictionGoals.find(
    (goal) => goal.id === state.scenario.prediction.goalId,
  )?.label

  const stages: StageDescriptor[] = []
  if (hasBrief) {
    stages.push({
      id: 'brief',
      number: stages.length + 1,
      label: 'Brief',
      complete: briefAcknowledged || planComplete,
      summary: briefAcknowledged || planComplete ? 'Reviewed' : undefined,
    })
  }
  stages.push({
    id: 'plan',
    number: stages.length + 1,
    label: 'Plan',
    complete: planComplete,
    summary: planComplete ? (committedGoalLabel ?? 'Committed') : undefined,
  })
  stages.push({
    id: 'manage',
    number: stages.length + 1,
    label: 'Manage',
    complete: causeCorrected,
    summary: appliedCount
      ? `${appliedCount} action${appliedCount === 1 ? '' : 's'}${trajectory ? ` · ${trajectory.replaceAll('-', ' ')}` : ''}`
      : undefined,
  })
  stages.push({
    id: 'reassess',
    number: stages.length + 1,
    label: 'Reassess',
    complete: reassessmentSubmitted,
    summary: reassessmentSubmitted ? 'Submitted' : undefined,
  })
  stages.push({
    id: 'debrief',
    number: stages.length + 1,
    label: 'Debrief',
    complete: debriefRevealed,
    summary: debriefRevealed ? 'Reviewed' : undefined,
  })
  const stageNumberById = new Map(stages.map((stage) => [stage.id, stage.number]))

  function showStage(stage: CaseStage) {
    setExpanded({ attemptKey, whenCurrent: currentStage, stage })
    window.requestAnimationFrame(() =>
      navigateToWorkflowSection(stagePanelIds[stage] as WorkflowSectionId),
    )
  }

  function beginCase() {
    setBriefAcknowledgedFor(attemptKey)
    setExpanded(null)
    window.requestAnimationFrame(() => navigateToWorkflowSection('practice-plan'))
  }

  useEffect(() => {
    if (!phaseRequest) return
    setExpanded({
      attemptKey,
      whenCurrent: currentStage,
      stage: phaseRequest.stage,
    })
    window.requestAnimationFrame(() =>
      navigateToWorkflowSection(stagePanelIds[phaseRequest.stage] as WorkflowSectionId),
    )
  }, [attemptKey, currentStage, phaseRequest])

  const pairedLessonId = pairedLessonIdsForCase(scenario.id)[0]
  const pairedLesson = pairedLessonId
    ? cardiohelpLearnLessonByScenarioId.get(pairedLessonId)
    : undefined
  const recommendedNext = debriefRevealed
    ? nextRecommendedActivity(
        {
          completedLabs: [...new Set([...progress.completedLabs, scenario.id])],
          completedLearnLessonIds: progress.completedLearnLessonIds,
        },
        supportMode,
      )
    : null
  const recommendedNextLink = recommendedNext
    ? recommendedNext.kind === 'lesson'
      ? {
          pathname: `${cardiohelpEcmoNavBase}/learn`,
          query: { lesson: recommendedNext.scenarioId, track: supportMode },
          label: `Lesson: ${cardiohelpLearnLessonByScenarioId.get(recommendedNext.scenarioId)?.title ?? recommendedNext.scenarioId}`,
        }
      : recommendedNext.kind === 'case'
        ? {
            pathname: `${cardiohelpEcmoNavBase}/practice`,
            query: { case: recommendedNext.scenarioId, track: supportMode },
            label: `Case: ${clinicalPracticeScenarioById.get(recommendedNext.scenarioId)?.title ?? recommendedNext.scenarioId}`,
          }
        : {
            pathname: `${cardiohelpEcmoNavBase}/assess`,
            query: { track: supportMode },
            label: `${supportMode.toUpperCase()} challenge`,
          }
    : null

  const debriefExtras = debriefRevealed ? (
    <div className={styles.debriefNextSteps}>
      {scenario.clinicalCase ? (
        <div>
          <span className={styles.kicker}>Learning objectives</span>
          <ul className={styles.caseObjectives}>
            {scenario.clinicalCase.learningObjectives.map((objective) => (
              <li key={objective}>
                <Target aria-hidden="true" />
                {objective}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.debriefLinks}>
        {pairedLesson ? (
          <Link
            href={{
              pathname: `${cardiohelpEcmoNavBase}/learn`,
              query: { lesson: pairedLesson.scenarioId, track: supportMode },
            }}
          >
            <GraduationCap aria-hidden="true" /> Review the paired lesson: {pairedLesson.title}
          </Link>
        ) : null}
        {recommendedNextLink ? (
          <Link
            href={{
              pathname: recommendedNextLink.pathname,
              query: recommendedNextLink.query,
            }}
          >
            <BookOpenCheck aria-hidden="true" /> Next recommended · {recommendedNextLink.label}
          </Link>
        ) : null}
      </div>
    </div>
  ) : undefined

  return (
    <aside className={styles.learningColumn} aria-label="Scenario learning workflow">
      <section id="practice-round-selector" className={styles.scenarioHeader} tabIndex={-1}>
        <div className={styles.scenarioMeta}>
          {unitContextLabel ? <span>{unitContextLabel}</span> : null}
          <span>{scenario.clinicalPhase}</span>
          <span>Adult {supportMode.toUpperCase()}</span>
        </div>
        <h2>
          {challengePromptHidden
            ? (scenario.clinicalCase?.patientLabel ?? 'Challenge: interpret the observable pattern')
            : scenario.title}
        </h2>
        <p>
          {challengePromptHidden
            ? (scenario.clinicalCase?.openingNarrative ??
              'Diagnosis and corrective cues remain hidden. Use all available data to commit your plan.')
            : scenario.summary}
        </p>
        {section === 'practice' ? (
          <label>
            Case
            <select value={scenario.id} onChange={(event) => onLoadScenario(event.target.value)}>
              {caseUnits.map((unitItem) => {
                const groupNumber = trackUnits.findIndex((item) => item.id === unitItem.id) + 1
                return (
                  <optgroup
                    key={unitItem.id}
                    label={
                      challengePromptHidden
                        ? `Unit ${groupNumber}`
                        : `Unit ${groupNumber} · ${unitItem.title}`
                    }
                  >
                    {unitItem.caseScenarioIds.map((caseId) => {
                      const caseDefinition = clinicalPracticeScenarioById.get(caseId)
                      if (!caseDefinition) return null
                      return (
                        <option key={caseId} value={caseId}>
                          {challengePromptHidden
                            ? `Clinical challenge ${trackCaseIds.indexOf(caseId) + 1}`
                            : caseDefinition.title}
                          {progress.completedLabs.includes(caseId) ? ' · worked through' : ''}
                        </option>
                      )
                    })}
                  </optgroup>
                )
              })}
            </select>
          </label>
        ) : null}
      </section>

      <StageRail
        state={state}
        scenario={scenario}
        dispatch={dispatch}
        onReveal={onReveal}
        outcome={outcome}
        stages={stages}
        currentStage={currentStage}
        activeStage={activeStage}
        onShowStage={showStage}
        onBeginCase={beginCase}
      />

      {challengeActive && !debriefRevealed ? (
        <aside className={styles.challengeFeedbackControl}>
          <p>
            Routine teaching is collected for the debrief. Patient, circuit, gas, console, and alarm
            responses remain live.
          </p>
          <label>
            <input
              type="checkbox"
              checked={showTeachingFeedback}
              onChange={(event) =>
                setChallengeFeedbackFor(event.currentTarget.checked ? attemptKey : null)
              }
            />
            <span>Show teaching notes after each action</span>
          </label>
        </aside>
      ) : null}

      {state.scenario.criticalErrors.length > 0 && !debriefRevealed ? (
        <div className={styles.criticalErrors} role="alert">
          <AlertOctagon aria-hidden="true" />
          <div>
            <strong>Safety interruption</strong>
            <span>
              Stopping here—in a real patient this path could cause catastrophic harm.{' '}
              {state.scenario.clinical?.lastResponse}
            </span>
            <span>
              {/*
                The authored label, not the identifier. De-hyphenating the id produced "rpm during
                recirculation" where the content says "Increased speed against established
                recirculation" — the learner was being shown a key instead of the sentence written
                for them.
              */}
              {state.scenario.criticalErrors
                .map(
                  (error) =>
                    scenario.unsafeActionPenalties.find((penalty) => penalty.id === error)?.label ??
                    error.replaceAll('-', ' '),
                )
                .join(', ')}
            </span>
            <button type="button" onClick={() => onLoadScenario(scenario.id, state.simulationMode)}>
              Restart from the clean case
            </button>
          </div>
        </div>
      ) : null}

      <ClinicalCaseBrief state={state} scenario={scenario} />

      {activeStage === 'brief' && scenario.clinicalCase ? (
        <section
          id="practice-brief"
          className={styles.caseBriefStage}
          aria-labelledby="case-objectives-heading"
          tabIndex={-1}
        >
          <div className={styles.workflowHeading}>
            <span>{stageNumberById.get('brief')}</span>
            <div>
              <h3 id="case-objectives-heading">Learning objectives</h3>
              <p>
                What this case is designed to teach. Begin when ready, or open any workflow step
                directly.
              </p>
            </div>
          </div>
          {challengePromptHidden ? (
            <p className={styles.caseObjectivesHidden}>
              Objectives are hidden while diagnosis cues are off; they appear in the debrief.
            </p>
          ) : (
            <ul className={styles.caseObjectives}>
              {scenario.clinicalCase.learningObjectives.map((objective) => (
                <li key={objective}>
                  <Target aria-hidden="true" /> {objective}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {workflowReady ? (
        <>
          <div hidden={activeStage !== 'plan'}>
            <PredictionPanel
              key={`prediction-${scenario.id}`}
              state={state}
              dispatch={dispatch}
              stageNumber={stageNumberById.get('plan') ?? 1}
              onCommitted={() => navigateToWorkflowSection('practice-treatment')}
            />
          </div>
          {section === 'practice' ? (
            <div hidden={activeStage !== 'manage' && activeStage !== 'reassess'}>
              <HintPanel state={state} scenario={scenario} dispatch={dispatch} />
            </div>
          ) : null}
          <div hidden={activeStage !== 'manage'}>
            <ActionPanel
              state={state}
              scenario={scenario}
              dispatch={dispatch}
              stageNumber={stageNumberById.get('manage') ?? 2}
              showTeachingFeedback={showTeachingFeedback}
            />
          </div>
          <div hidden={activeStage !== 'reassess' && activeStage !== 'debrief'}>
            <ReassessmentPanel
              key={`reassessment-${scenario.id}`}
              state={state}
              scenario={scenario}
              dispatch={dispatch}
              onReveal={onReveal}
              outcome={outcome}
              stageNumber={stageNumberById.get('reassess') ?? 3}
              debriefExtras={debriefExtras}
            />
          </div>
        </>
      ) : null}

      <SimulationControls
        state={state}
        scenario={scenario}
        dispatch={dispatch}
        onLoadScenario={onLoadScenario}
        section={section}
      />
    </aside>
  )
}

export function resolveScenarioDefinition(scenarioId: string): ScenarioDefinition {
  return (
    clinicalPracticeScenarioById.get(scenarioId) ??
    cardiohelpScenarioById.get(scenarioId) ??
    clinicalPracticeScenarios[0]
  )
}
