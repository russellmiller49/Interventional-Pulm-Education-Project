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
import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react'

import { baxterCrrtMasteryManifest } from '../content/mastery'
import type { RuntimeCrrtCase } from '../content/schema'
import {
  selectCrrtDebriefProjection,
  selectCrrtLearningOutcome,
  type CrrtLearningOutcome,
} from '../engine/outcomes'
import { selectSecondsUntilNextScheduledEvent } from '../engine/selectors'
import { selectPrismaxPilotCaseOperationsDisplay } from '../engine/deviceAdapters/prismax'
import type {
  CrrtLearningSessionAction,
  CrrtLearningSessionState,
  CrrtPrecommitReasoningPhase,
  CrrtPredictionCommitment,
  CrrtReasoningPhase,
} from '../engine/learningSession'
import { crrtSoluteIds, type CrrtRoleLens } from '../engine/types'
import { PrismaxPilotInterface, type PrismaxPilotCaseContext } from './PrismaxPilotInterface'
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

const simulationTimeAdvanceOptions = [
  { seconds: 60, label: '+1 min' },
  { seconds: 300, label: '+5 min' },
  { seconds: 900, label: '+15 min' },
  { seconds: 1_800, label: '+30 min' },
  { seconds: 3_600, label: '+1 hr' },
  { seconds: 21_600, label: '+6 hr' },
] as const

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

const timelineEventLabels: Readonly<
  Record<CrrtLearningSessionState['timeline'][number]['type'], string>
> = {
  'prediction-committed': 'Prediction committed',
  'intervention-performed': 'Intervention performed',
  'device-action': 'Device action',
  'time-advanced': 'Time advanced',
  'hint-used': 'Hint used',
  'reassessment-committed': 'Reassessment committed',
  'debrief-revealed': 'Debrief revealed',
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
  /** Prefixes every authored DOM ID so multiple workflow instances can coexist. */
  readonly idNamespace?: string
}

export function CrrtReasoningRibbon({ session }: { session: CrrtLearningSessionState }) {
  const current = session.reasoningPhase
  const currentIndex = reasoningPhases.findIndex(([id]) => id === current)

  return (
    <nav
      className={styles.reasoningRibbon}
      aria-label={
        session.audience === 'reviewer'
          ? 'CRRT reviewer reasoning sequence'
          : 'CRRT reasoning sequence'
      }
    >
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

function formatSimulationTime(seconds: number): string {
  if (seconds === 0) return '0 min'
  if (seconds % 3_600 === 0) return `${seconds / 3_600} hr`
  if (seconds % 60 === 0) return `${seconds / 60} min`
  return `${seconds} sec`
}

function formatTrendValue(value: number | null | undefined, unit: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Unavailable'
  const rounded = Math.round(value * 100) / 100
  return `${rounded} ${unit}`
}

function timelineReferenceLabel(
  definition: RuntimeCrrtCase,
  entry: CrrtLearningSessionState['timeline'][number],
): string | null {
  const referenceId = entry.referenceId
  if (referenceId === null) return null
  if (entry.type === 'time-advanced') {
    const seconds = Number(referenceId)
    return Number.isFinite(seconds) ? `+${formatSimulationTime(seconds)}` : referenceId
  }
  const intervention = definition.interventions.find(({ id }) => id === referenceId)
  if (intervention) return intervention.label
  const hint = definition.hintLadder.find(({ id }) => id === referenceId)
  if (hint) return `Hint ${hint.sequence}`
  return referenceId.replaceAll('-', ' ')
}

function toggleId(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
}

type CrrtPredictionFieldId = 'goal' | 'mechanism' | 'control' | 'response' | 'reassessment'

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
  idNamespace,
}: CrrtLearningWorkflowProps) {
  const definition = session.caseDefinition
  const isMastery = session.experience === 'mastery'
  const isReviewer = session.audience === 'reviewer'
  const scopedId = (id: string) => (idNamespace ? `${idNamespace}-${id}` : id)
  const experienceLabel =
    session.experience === 'learn'
      ? 'Guided Learn'
      : session.experience === 'practice'
        ? isReviewer
          ? 'Reviewer score preview'
          : 'Scored Practice'
        : 'Mastery attempt'
  const visibleCaseTitle =
    isMastery && !session.debriefRevealed
      ? baxterCrrtMasteryManifest.learnerTitleBeforeDebrief
      : definition.title
  const machineControlsEnabled = session.prediction !== null && !session.debriefRevealed
  const prismaxCaseContext: PrismaxPilotCaseContext =
    isMastery && !session.debriefRevealed
      ? {
          identityMasked: true,
          learnerLabel: baxterCrrtMasteryManifest.learnerTitleBeforeDebrief,
          pathway: 'mastery',
        }
      : {
          caseId: definition.id,
          title: visibleCaseTitle,
          pathway: session.experience,
        }
  const [goalOptionId, setGoalOptionId] = useState('')
  const [mechanismOptionId, setMechanismOptionId] = useState('')
  const [controlOptionIds, setControlOptionIds] = useState<readonly string[]>([])
  const [responseOptionId, setResponseOptionId] = useState('')
  const [plannedReassessmentIds, setPlannedReassessmentIds] = useState<readonly string[]>([])
  const [actualReassessmentIds, setActualReassessmentIds] = useState<readonly string[]>([])
  const [predictionSubmitAttempt, setPredictionSubmitAttempt] = useState(0)
  const predictionValidationSummaryRef = useRef<HTMLDivElement>(null)
  const goalSelectRef = useRef<HTMLSelectElement>(null)
  const mechanismSelectRef = useRef<HTMLSelectElement>(null)
  const controlCheckboxRef = useRef<HTMLInputElement>(null)
  const responseSelectRef = useRef<HTMLSelectElement>(null)
  const reassessmentCheckboxRef = useRef<HTMLInputElement>(null)
  const outcome = selectCrrtLearningOutcome(session)
  const debrief = session.debriefRevealed ? selectCrrtDebriefProjection(session) : null
  const usedHintSet = new Set(session.usedHintIds)
  const performedSet = new Set(session.performedInterventionIds)
  const completedRequiredActions = definition.requiredActionIds.filter((id) => performedSet.has(id))
  const missedRequiredActions = definition.requiredActionIds.filter((id) => !performedSet.has(id))
  const matchedAcceptedPaths = definition.acceptedAlternativePaths.filter((path) =>
    outcome.matchedAcceptedPathIds.includes(path.id),
  )
  const firstTrend = session.simulation.trends[0]
  const latestTrend = session.simulation.trends.at(-1)
  const trendEvidenceRows =
    firstTrend && latestTrend
      ? [
          {
            label: 'Prescribed effluent dose',
            first: formatTrendValue(firstTrend.prescribedEffluentDoseMlKgHour, 'mL/kg/h'),
            latest: formatTrendValue(latestTrend.prescribedEffluentDoseMlKgHour, 'mL/kg/h'),
          },
          {
            label: 'Delivered dose',
            first: formatTrendValue(firstTrend.deliveredDoseMlKgHour, 'mL/kg/h'),
            latest: formatTrendValue(latestTrend.deliveredDoseMlKgHour, 'mL/kg/h'),
          },
          {
            label: 'Whole-patient balance',
            first: formatTrendValue(firstTrend.cumulativeWholePatientBalanceMl, 'mL'),
            latest: formatTrendValue(latestTrend.cumulativeWholePatientBalanceMl, 'mL'),
          },
          {
            label: 'Access pressure',
            first: formatTrendValue(firstTrend.accessPressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.accessPressureMmHg, 'mmHg'),
          },
          {
            label: 'Filter pressure',
            first: formatTrendValue(firstTrend.filterPressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.filterPressureMmHg, 'mmHg'),
          },
          {
            label: 'Return pressure',
            first: formatTrendValue(firstTrend.returnPressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.returnPressureMmHg, 'mmHg'),
          },
          {
            label: 'Transmembrane pressure',
            first: formatTrendValue(firstTrend.transmembranePressureMmHg, 'mmHg'),
            latest: formatTrendValue(latestTrend.transmembranePressureMmHg, 'mmHg'),
          },
          ...crrtSoluteIds.flatMap((id) => {
            const first = firstTrend.soluteConcentrationsPerLiter[id]
            const latest = latestTrend.soluteConcentrationsPerLiter[id]
            if (first === undefined && latest === undefined) return []
            const pool =
              session.simulation.patient.status === 'configured'
                ? session.simulation.patient.solutes[id]
                : undefined
            const unit = pool?.concentrationUnit ?? 'per L'
            return [
              {
                label: id.replaceAll('-', ' '),
                first: formatTrendValue(first, unit),
                latest: formatTrendValue(latest, unit),
              },
            ]
          }),
        ]
      : []
  const unsafeActionIds = new Set(definition.unsafeActions.map((unsafe) => unsafe.actionId))
  const nextHint = isMastery
    ? undefined
    : definition.hintLadder
        .slice()
        .sort((left, right) => left.sequence - right.sequence)
        .find((hint) => !usedHintSet.has(hint.id))
  const definedGoal = goalOptionId !== ''
  const selectedMechanismAndControl =
    definedGoal && mechanismOptionId !== '' && controlOptionIds.length > 0
  const completePrediction =
    selectedMechanismAndControl && responseOptionId !== '' && plannedReassessmentIds.length > 0
  const hasPerformedIntervention = session.performedInterventionIds.length > 0
  const canReassess = hasPerformedIntervention && session.reasoningPhase === 'reassess'
  const timeControlsLocked = !session.prediction || session.debriefRevealed
  const secondsUntilNextScheduledEvent = selectSecondsUntilNextScheduledEvent(session.simulation)
  const predictionValidationAttempted = predictionSubmitAttempt > 0
  const missingPredictionFields: readonly {
    readonly id: CrrtPredictionFieldId
    readonly label: string
  }[] = [
    ...(goalOptionId === '' ? [{ id: 'goal' as const, label: '1 · Goal' }] : []),
    ...(mechanismOptionId === '' ? [{ id: 'mechanism' as const, label: '2 · Mechanism' }] : []),
    ...(controlOptionIds.length === 0
      ? [{ id: 'control' as const, label: '3 · Planned control' }]
      : []),
    ...(responseOptionId === ''
      ? [{ id: 'response' as const, label: '4 · Expected response' }]
      : []),
    ...(plannedReassessmentIds.length === 0
      ? [{ id: 'reassessment' as const, label: '5 · Reassessment plan' }]
      : []),
  ]
  const goalInvalid = predictionValidationAttempted && goalOptionId === ''
  const mechanismInvalid = predictionValidationAttempted && mechanismOptionId === ''
  const controlInvalid = predictionValidationAttempted && controlOptionIds.length === 0
  const responseInvalid = predictionValidationAttempted && responseOptionId === ''
  const reassessmentInvalid = predictionValidationAttempted && plannedReassessmentIds.length === 0

  useEffect(() => {
    if (predictionSubmitAttempt > 0) predictionValidationSummaryRef.current?.focus()
  }, [predictionSubmitAttempt])

  function focusPredictionField(fieldId: CrrtPredictionFieldId) {
    const fieldRefs = {
      goal: goalSelectRef,
      mechanism: mechanismSelectRef,
      control: controlCheckboxRef,
      response: responseSelectRef,
      reassessment: reassessmentCheckboxRef,
    } as const
    fieldRefs[fieldId].current?.focus()
  }

  function enterPrecommitReasoningPhase(phase: CrrtPrecommitReasoningPhase) {
    dispatch({ type: 'ENTER_PRECOMMIT_REASONING_PHASE', phase })
  }

  function commitPrediction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (session.prediction) return
    if (!completePrediction) {
      setPredictionSubmitAttempt((attempt) => attempt + 1)
      return
    }
    if (session.reasoningPhase !== 'predict') return
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
    if (actualReassessmentIds.length === 0 || session.reassessment.committed || !canReassess) {
      return
    }
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
        id={scopedId('baxter-crrt-mobile-panel-case')}
        className={styles.caseWorkflow}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-case')}
        data-mobile-active={mobileSurface === 'case'}
        data-testid="crrt-case-workflow"
      >
        <div className={styles.contextControls}>
          <label>
            <span>
              {isMastery ? 'Mastery capstone' : isReviewer ? 'SME preview case' : 'Learning case'}
            </span>
            <select
              disabled={isMastery}
              value={isMastery ? 'mastery-masked' : definition.id}
              aria-describedby={isMastery ? scopedId('crrt-mastery-boundary') : undefined}
              onChange={(event) => onCaseChange(event.target.value)}
            >
              {isMastery ? (
                <option value="mastery-masked">
                  {baxterCrrtMasteryManifest.learnerTitleBeforeDebrief}
                </option>
              ) : (
                availableCases.map((caseDefinition) => (
                  <option key={caseDefinition.id} value={caseDefinition.id}>
                    {caseDefinition.id} · {caseDefinition.title}
                  </option>
                ))
              )}
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

        {isMastery ? (
          <div
            id={scopedId('crrt-mastery-boundary')}
            className={styles.masteryBoundary}
            role="note"
            aria-labelledby={scopedId('crrt-mastery-boundary-heading')}
          >
            <LockKeyhole aria-hidden="true" />
            <p>
              <strong id={scopedId('crrt-mastery-boundary-heading')}>Mastery safeguards.</strong>{' '}
              Case identity remains masked until causal debrief. Guided assistance is unavailable,
              and Clean attempt starts a new, unassisted attempt. Passing requires a score of at
              least {baxterCrrtMasteryManifest.minimumScore}, no critical error, and completed
              reassessment.
            </p>
          </div>
        ) : null}

        <header className={styles.caseHeader}>
          <div>
            <span>
              {isMastery ? 'Masked case' : definition.id} · {experienceLabel}
            </span>
            <h3>{visibleCaseTitle}</h3>
          </div>
          <strong>Attempt {session.attempt}</strong>
        </header>

        <div className={styles.syntheticNotice} role="note">
          <ShieldAlert aria-hidden="true" />
          <p>
            <strong>Synthetic educational case.</strong> Exact values, thresholds, scoring, and
            critical-error rules are educational calibration—not clinical targets.
            {isReviewer
              ? ' This final-SME preview produces no analytics, progress writes, persistence, or competency record.'
              : null}
          </p>
        </div>

        <section
          className={styles.findingsSection}
          aria-labelledby={scopedId('crrt-case-findings')}
        >
          <div className={styles.workflowHeading}>
            <BrainCircuit aria-hidden="true" />
            <div>
              <span>Read</span>
              <h4 id={scopedId('crrt-case-findings')}>
                Patient, access, circuit, and delivered treatment
              </h4>
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

        <section
          className={styles.predictionSection}
          aria-labelledby={scopedId('crrt-prediction-heading')}
        >
          <div className={styles.workflowHeading}>
            {session.prediction ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            <div>
              <span>Define · Select · Predict</span>
              <h4 id={scopedId('crrt-prediction-heading')}>Commit before controls unlock</h4>
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
            <form className={styles.predictionForm} noValidate onSubmit={commitPrediction}>
              {predictionValidationAttempted && missingPredictionFields.length > 0 ? (
                <div
                  ref={predictionValidationSummaryRef}
                  className={styles.predictionValidationSummary}
                  role="alert"
                  tabIndex={-1}
                  aria-labelledby={scopedId('crrt-prediction-validation-heading')}
                >
                  <strong id={scopedId('crrt-prediction-validation-heading')}>
                    Prediction not committed
                  </strong>
                  <p>Complete every required field, then commit the prediction again.</p>
                  <ul>
                    {missingPredictionFields.map((field) => (
                      <li key={field.id}>{field.label}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => focusPredictionField(missingPredictionFields[0].id)}
                  >
                    Go to first missing field: {missingPredictionFields[0].label}
                  </button>
                </div>
              ) : null}
              <label>
                <span id={scopedId('crrt-prediction-goal-label')}>1 · Goal</span>
                <small
                  id={scopedId('crrt-prediction-goal-instructions')}
                  className={styles.predictionInstruction}
                >
                  Required. Choose one goal.
                </small>
                {goalInvalid ? (
                  <small
                    id={scopedId('crrt-prediction-goal-error')}
                    className={styles.predictionFieldError}
                  >
                    Choose a goal before committing.
                  </small>
                ) : null}
                <select
                  ref={goalSelectRef}
                  required
                  value={goalOptionId}
                  aria-labelledby={scopedId('crrt-prediction-goal-label')}
                  aria-describedby={`${scopedId('crrt-prediction-goal-instructions')}${
                    goalInvalid ? ` ${scopedId('crrt-prediction-goal-error')}` : ''
                  }`}
                  aria-invalid={goalInvalid ? 'true' : undefined}
                  onFocus={() => enterPrecommitReasoningPhase('define')}
                  onChange={(event) => {
                    setGoalOptionId(event.target.value)
                    setMechanismOptionId('')
                    setControlOptionIds([])
                    setResponseOptionId('')
                    setPlannedReassessmentIds([])
                    enterPrecommitReasoningPhase('define')
                  }}
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
                <span id={scopedId('crrt-prediction-mechanism-label')}>2 · Mechanism</span>
                <small
                  id={scopedId('crrt-prediction-mechanism-instructions')}
                  className={styles.predictionInstruction}
                >
                  Required. After defining a goal, choose one mechanism.
                </small>
                {mechanismInvalid ? (
                  <small
                    id={scopedId('crrt-prediction-mechanism-error')}
                    className={styles.predictionFieldError}
                  >
                    Choose a mechanism before committing.
                  </small>
                ) : null}
                <select
                  ref={mechanismSelectRef}
                  required
                  disabled={!definedGoal}
                  value={mechanismOptionId}
                  aria-labelledby={scopedId('crrt-prediction-mechanism-label')}
                  aria-describedby={`${scopedId('crrt-prediction-mechanism-instructions')}${
                    mechanismInvalid ? ` ${scopedId('crrt-prediction-mechanism-error')}` : ''
                  }`}
                  aria-invalid={mechanismInvalid ? 'true' : undefined}
                  onFocus={() => enterPrecommitReasoningPhase('select')}
                  onChange={(event) => {
                    setMechanismOptionId(event.target.value)
                    setResponseOptionId('')
                    setPlannedReassessmentIds([])
                    enterPrecommitReasoningPhase('select')
                  }}
                >
                  <option value="">Choose the mechanism…</option>
                  {definition.mechanismOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset
                disabled={!definedGoal}
                data-invalid={controlInvalid || undefined}
                aria-describedby={`${scopedId('crrt-prediction-control-instructions')}${
                  controlInvalid ? ` ${scopedId('crrt-prediction-control-error')}` : ''
                }`}
              >
                <legend>3 · Planned control</legend>
                <p
                  id={scopedId('crrt-prediction-control-instructions')}
                  className={styles.predictionInstruction}
                >
                  Required. After defining a goal, select at least one planned control.
                </p>
                {controlInvalid ? (
                  <p
                    id={scopedId('crrt-prediction-control-error')}
                    className={styles.predictionFieldError}
                  >
                    Select a planned control before committing.
                  </p>
                ) : null}
                {definition.controlOptions.map((option, index) => (
                  <label key={option.id}>
                    <input
                      ref={index === 0 ? controlCheckboxRef : undefined}
                      checked={controlOptionIds.includes(option.id)}
                      type="checkbox"
                      aria-describedby={`${scopedId('crrt-prediction-control-instructions')}${
                        controlInvalid ? ` ${scopedId('crrt-prediction-control-error')}` : ''
                      }`}
                      aria-invalid={controlInvalid ? 'true' : undefined}
                      onFocus={() => enterPrecommitReasoningPhase('select')}
                      onChange={() => {
                        setControlOptionIds(toggleId(controlOptionIds, option.id))
                        setResponseOptionId('')
                        setPlannedReassessmentIds([])
                        enterPrecommitReasoningPhase('select')
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <label>
                <span id={scopedId('crrt-prediction-response-label')}>4 · Expected response</span>
                <small
                  id={scopedId('crrt-prediction-response-instructions')}
                  className={styles.predictionInstruction}
                >
                  Required. After choosing a mechanism and planned control, choose one expected
                  response.
                </small>
                {responseInvalid ? (
                  <small
                    id={scopedId('crrt-prediction-response-error')}
                    className={styles.predictionFieldError}
                  >
                    Choose an expected response before committing.
                  </small>
                ) : null}
                <select
                  ref={responseSelectRef}
                  required
                  disabled={!selectedMechanismAndControl}
                  value={responseOptionId}
                  aria-labelledby={scopedId('crrt-prediction-response-label')}
                  aria-describedby={`${scopedId('crrt-prediction-response-instructions')}${
                    responseInvalid ? ` ${scopedId('crrt-prediction-response-error')}` : ''
                  }`}
                  aria-invalid={responseInvalid ? 'true' : undefined}
                  onFocus={() => enterPrecommitReasoningPhase('predict')}
                  onChange={(event) => {
                    setResponseOptionId(event.target.value)
                    enterPrecommitReasoningPhase('predict')
                  }}
                >
                  <option value="">Choose immediate and delayed response…</option>
                  {definition.responseOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset
                disabled={!selectedMechanismAndControl}
                data-invalid={reassessmentInvalid || undefined}
                aria-describedby={`${scopedId('crrt-prediction-reassessment-instructions')}${
                  reassessmentInvalid ? ` ${scopedId('crrt-prediction-reassessment-error')}` : ''
                }`}
              >
                <legend>5 · Reassessment plan</legend>
                <p
                  id={scopedId('crrt-prediction-reassessment-instructions')}
                  className={styles.predictionInstruction}
                >
                  Required. After choosing a mechanism and planned control, select at least one
                  reassessment.
                </p>
                {reassessmentInvalid ? (
                  <p
                    id={scopedId('crrt-prediction-reassessment-error')}
                    className={styles.predictionFieldError}
                  >
                    Select a reassessment before committing.
                  </p>
                ) : null}
                {definition.reassessmentOptions.map((option, index) => (
                  <label key={option.id}>
                    <input
                      ref={index === 0 ? reassessmentCheckboxRef : undefined}
                      checked={plannedReassessmentIds.includes(option.id)}
                      type="checkbox"
                      aria-describedby={`${scopedId('crrt-prediction-reassessment-instructions')}${
                        reassessmentInvalid
                          ? ` ${scopedId('crrt-prediction-reassessment-error')}`
                          : ''
                      }`}
                      aria-invalid={reassessmentInvalid ? 'true' : undefined}
                      onFocus={() => enterPrecommitReasoningPhase('predict')}
                      onChange={() => {
                        setPlannedReassessmentIds(toggleId(plannedReassessmentIds, option.id))
                        enterPrecommitReasoningPhase('predict')
                      }}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <button type="submit" className={styles.commitButton}>
                Commit prediction <ArrowRight aria-hidden="true" />
              </button>
            </form>
          )}
        </section>

        <section
          className={styles.actionSection}
          aria-labelledby={scopedId('crrt-actions-heading')}
        >
          <div className={styles.workflowHeading}>
            <ArrowRight aria-hidden="true" />
            <div>
              <span>Run</span>
              <h4 id={scopedId('crrt-actions-heading')}>
                {session.audience === 'reviewer'
                  ? 'Intervene through the authored case actions'
                  : 'Intervene through the case and machine'}
              </h4>
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

          <div className={styles.timeControls} role="group" aria-label="Advance simulated time">
            <div>
              <Clock3 aria-hidden="true" />
              <span>
                <strong>{Math.round(session.simulation.simulationTimeSeconds / 60)} min</strong>
                Separate immediate device response from delayed simulated response.
              </span>
            </div>
            {simulationTimeAdvanceOptions.map((option) => (
              <button
                key={option.seconds}
                type="button"
                disabled={timeControlsLocked}
                onClick={() => dispatch({ type: 'ADVANCE_TIME', seconds: option.seconds })}
              >
                {option.label}
              </button>
            ))}
            {secondsUntilNextScheduledEvent !== null ? (
              <button
                type="button"
                className={styles.nextEventButton}
                disabled={timeControlsLocked}
                onClick={() =>
                  dispatch({ type: 'ADVANCE_TIME', seconds: secondsUntilNextScheduledEvent })
                }
              >
                Advance to next scheduled event
              </button>
            ) : null}
          </div>
        </section>

        {!isMastery ? (
          <section className={styles.hintSection} aria-labelledby={scopedId('crrt-hint-heading')}>
            <div className={styles.workflowHeading}>
              <Lightbulb aria-hidden="true" />
              <div>
                <span>Hint ladder</span>
                <h4 id={scopedId('crrt-hint-heading')}>
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
              <small>
                {isReviewer
                  ? 'Each revealed hint subtracts 5 preview points; this result is not saved.'
                  : 'Each revealed hint subtracts 5 points, capped by the scoring engine.'}
              </small>
            ) : null}
          </section>
        ) : null}

        <section
          className={styles.reassessmentSection}
          aria-labelledby={scopedId('crrt-reassess-heading')}
        >
          <div className={styles.workflowHeading}>
            <MessageSquareText aria-hidden="true" />
            <div>
              <span>Reassess</span>
              <h4 id={scopedId('crrt-reassess-heading')}>
                Compare prediction with actual response
              </h4>
            </div>
          </div>
          {session.reassessment.committed ? (
            <p className={styles.completedNotice}>
              <Check aria-hidden="true" /> Reassessment committed. Continue to causal debrief.
            </p>
          ) : (
            <fieldset
              disabled={!canReassess}
              aria-describedby={canReassess ? undefined : scopedId('crrt-reassess-prerequisite')}
            >
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
          {!canReassess ? (
            <small id={scopedId('crrt-reassess-prerequisite')}>
              {hasPerformedIntervention
                ? 'Advance simulated time by a positive interval before reassessment.'
                : 'Perform at least one intervention, then advance simulated time by a positive interval before reassessment.'}
            </small>
          ) : null}
        </section>

        {outcome.criticalErrorIds.length > 0 ? (
          <div className={styles.criticalBanner} role="alert">
            <ShieldAlert aria-hidden="true" />
            <p>
              <strong>Educational critical-error rule triggered</strong>{' '}
              {outcome.criticalErrorIds.join(', ')}. This synthetic scoring rule is not a clinical
              threshold or competency decision.
            </p>
          </div>
        ) : null}
      </div>

      <section
        id={scopedId('baxter-crrt-mobile-panel-machine')}
        className={`${styles.surfaceSummary} ${styles.machineSurface}`}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-machine')}
        data-mobile-active={mobileSurface === 'machine'}
      >
        {session.simulation.deviceId === 'prismax-aw8035-2xx' ? (
          <>
            <div className={styles.machineSurfaceHeading}>
              <div>
                <span>Interactive equipment station</span>
                <h4>PrisMax machine simulator</h4>
              </div>
              <strong data-unlocked={machineControlsEnabled}>
                {machineControlsEnabled ? 'Machine actions unlocked' : 'Prediction gate locked'}
              </strong>
            </div>
            <p className={styles.machineSurfaceIntro}>
              Explore the generated hardware map at any time. Commit the five-part prediction on the
              Case surface to unlock setup and Operations controls; synthetic case state stays
              synchronized with the shared CRRT engine.
            </p>
            <PrismaxPilotInterface
              state={session.interfaceState}
              dispatch={(action) => dispatch({ type: 'DEVICE_ACTION', action })}
              controlsEnabled={machineControlsEnabled}
              operationsDisplay={selectPrismaxPilotCaseOperationsDisplay(
                session.interfaceState,
                session.simulation,
              )}
              caseContext={prismaxCaseContext}
              onReset={onReset}
            />
          </>
        ) : (
          <>
            <h4>Prismaflex machine state</h4>
            <dl>
              <div>
                <dt>Device</dt>
                <dd>{session.simulation.deviceId}</dd>
              </div>
              <div>
                <dt>Delivery</dt>
                <dd>{session.simulation.device.deliveryState}</dd>
              </div>
              <div>
                <dt>Simulation time</dt>
                <dd>{formatSimulationTime(session.simulation.simulationTimeSeconds)}</dd>
              </div>
              <div>
                <dt>Active alarms</dt>
                <dd>{session.simulation.alarms.length}</dd>
              </div>
            </dl>
            <p>
              The generated physical-machine simulator is scoped to the PrisMax reference profile.
              Return to Case for Prismaflex-authored interventions and its active device controls.
            </p>
          </>
        )}
      </section>

      <section
        id={scopedId('baxter-crrt-mobile-panel-circuit')}
        className={styles.surfaceSummary}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-circuit')}
        data-mobile-active={mobileSurface === 'circuit'}
      >
        <h4>Circuit and fluid state</h4>
        <dl>
          <div>
            <dt>Modality</dt>
            <dd>{session.simulation.circuit.modality ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt>Connected bags</dt>
            <dd>{session.simulation.circuit.bags.length}</dd>
          </div>
          <div>
            <dt>Access pressure</dt>
            <dd>{formatTrendValue(latestTrend?.accessPressureMmHg, 'mmHg')}</dd>
          </div>
          <div>
            <dt>Filter pressure</dt>
            <dd>{formatTrendValue(latestTrend?.filterPressureMmHg, 'mmHg')}</dd>
          </div>
        </dl>
      </section>

      <section
        id={scopedId('baxter-crrt-mobile-panel-patient')}
        className={styles.surfaceSummary}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-patient')}
        data-mobile-active={mobileSurface === 'patient'}
      >
        <h4>Patient and delivered-therapy state</h4>
        <dl>
          <div>
            <dt>Delivered dose</dt>
            <dd>{formatTrendValue(latestTrend?.deliveredDoseMlKgHour, 'mL/kg/h')}</dd>
          </div>
          <div>
            <dt>Whole-patient balance</dt>
            <dd>{formatTrendValue(latestTrend?.cumulativeWholePatientBalanceMl, 'mL')}</dd>
          </div>
          <div>
            <dt>Downtime</dt>
            <dd>
              {formatSimulationTime(session.simulation.deliveredTherapy.cumulativeDowntimeSeconds)}
            </dd>
          </div>
          <div>
            <dt>Reassessment</dt>
            <dd>{session.reassessment.committed ? 'Completed' : 'Required'}</dd>
          </div>
        </dl>
      </section>

      <section
        id={scopedId('baxter-crrt-mobile-panel-debrief')}
        className={styles.debriefSection}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-debrief')}
        data-mobile-active={mobileSurface === 'debrief'}
      >
        <div className={styles.workflowHeading}>
          <Sparkles aria-hidden="true" />
          <div>
            <span>Reflect</span>
            <h4 id={scopedId('crrt-debrief-heading')}>Causal debrief</h4>
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
              <section
                className={styles.scoreCard}
                aria-label={
                  isMastery ? 'Mastery score' : isReviewer ? 'SME score preview' : 'Practice score'
                }
              >
                <div>
                  <span>
                    {isMastery
                      ? 'Mastery score'
                      : isReviewer
                        ? 'SME score preview'
                        : 'Practice score'}
                  </span>
                  <strong>{debrief.outcome.score}/100</strong>
                  <small>
                    {isMastery
                      ? 'Educational Mastery result · no competency or certification claim'
                      : isReviewer
                        ? `Final-SME preview rubric · ${debrief.outcome.hintPenalty} hint-penalty points · not saved or competency-bearing`
                        : `Educational score · ${debrief.outcome.hintPenalty} hint-penalty points`}
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

            <section
              className={styles.attemptEvidence}
              aria-labelledby={scopedId('crrt-actual-attempt-evidence')}
            >
              <h5 id={scopedId('crrt-actual-attempt-evidence')}>Actual attempt evidence</h5>
              <dl className={styles.attemptEvidenceGrid}>
                <div>
                  <dt>Committed control plan</dt>
                  <dd>
                    {debrief.prediction
                      ? debrief.prediction.controlOptionIds
                          .map((id) => selectedLabel(definition.controlOptions, id))
                          .join('; ')
                      : 'No prediction recorded'}
                  </dd>
                </div>
                <div>
                  <dt>Performed interventions</dt>
                  <dd>
                    {session.performedInterventionIds.length > 0
                      ? session.performedInterventionIds
                          .map((id) => selectedLabel(definition.interventions, id))
                          .join('; ')
                      : 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Completed required actions</dt>
                  <dd>
                    {completedRequiredActions.length > 0
                      ? completedRequiredActions
                          .map((id) => selectedLabel(definition.interventions, id))
                          .join('; ')
                      : 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Missed required actions</dt>
                  <dd>
                    {missedRequiredActions.length > 0
                      ? missedRequiredActions
                          .map((id) => selectedLabel(definition.interventions, id))
                          .join('; ')
                      : 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Actual reassessment</dt>
                  <dd>
                    {session.reassessment.optionIds.length > 0
                      ? session.reassessment.optionIds
                          .map((id) => selectedLabel(definition.reassessmentOptions, id))
                          .join('; ')
                      : 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Matched accepted path</dt>
                  <dd>
                    {matchedAcceptedPaths.length > 0
                      ? matchedAcceptedPaths.map(({ label }) => label).join('; ')
                      : outcome.matchedRequiredPath
                        ? 'Required path'
                        : 'None'}
                  </dd>
                </div>
                <div>
                  <dt>Triggered educational critical errors</dt>
                  <dd>
                    {outcome.criticalErrorIds.length > 0
                      ? outcome.criticalErrorIds
                          .map((id) => selectedLabel(definition.criticalErrors, id))
                          .join('; ')
                      : 'None'}
                  </dd>
                </div>
              </dl>

              <h6>Recorded action timeline</h6>
              <ol className={styles.attemptTimeline}>
                {debrief.timeline.map((entry) => {
                  const referenceLabel = timelineReferenceLabel(definition, entry)
                  return (
                    <li key={entry.sequence}>
                      <time>{formatSimulationTime(entry.atSeconds)}</time>
                      <span>{timelineEventLabels[entry.type]}</span>
                      {referenceLabel ? <small>{referenceLabel}</small> : null}
                    </li>
                  )
                })}
              </ol>

              <h6>Sampled pressure, dose, fluid, and laboratory evidence</h6>
              {firstTrend && latestTrend ? (
                <div
                  className={styles.trendEvidenceRegion}
                  role="region"
                  aria-label="Actual attempt sampled trend evidence; horizontally scrollable"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Signal</th>
                        <th scope="col">First · {formatSimulationTime(firstTrend.timeSeconds)}</th>
                        <th scope="col">
                          Latest · {formatSimulationTime(latestTrend.timeSeconds)}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendEvidenceRows.map((row) => (
                        <tr key={row.label}>
                          <th scope="row">{row.label}</th>
                          <td>{row.first}</td>
                          <td>{row.latest}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p>No five-minute trend sample was recorded before debrief.</p>
              )}

              {isReviewer ? (
                <details className={styles.replayIdentity}>
                  <summary>Deterministic replay identity</summary>
                  <dl>
                    <div>
                      <dt>Seed</dt>
                      <dd>{debrief.outcome.resultIdentity.seed}</dd>
                    </div>
                    <div>
                      <dt>Engine</dt>
                      <dd>{debrief.outcome.resultIdentity.engineVersion}</dd>
                    </div>
                    <div>
                      <dt>Engine schema</dt>
                      <dd>{debrief.outcome.resultIdentity.engineSchemaVersion}</dd>
                    </div>
                    <div>
                      <dt>Simulation content</dt>
                      <dd>{debrief.outcome.resultIdentity.simulationContentVersion}</dd>
                    </div>
                    <div>
                      <dt>Case content</dt>
                      <dd>{debrief.outcome.resultIdentity.caseContentVersion}</dd>
                    </div>
                  </dl>
                </details>
              ) : null}
            </section>

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
