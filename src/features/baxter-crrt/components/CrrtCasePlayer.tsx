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
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
} from 'react'

import { baxterCrrtMasteryManifest } from '../content/mastery'
import type { RuntimeCrrtCase } from '../content/schema'
import { selectCrrtConsoleControls } from '../engine/consoleControls'
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
import styles from './crrt-case-player.module.css'

const reasoningStages = [
  { id: 'brief', label: 'Brief', detail: 'Read + Define', phases: ['read', 'define'] },
  { id: 'plan', label: 'Plan', detail: 'Select + Predict', phases: ['select', 'predict'] },
  { id: 'run', label: 'Run', detail: 'Act + Observe', phases: ['run'] },
  {
    id: 'debrief',
    label: 'Debrief',
    detail: 'Reassess + Reflect',
    phases: ['reassess', 'reflect'],
  },
] as const satisfies readonly {
  readonly id: string
  readonly label: string
  readonly detail: string
  readonly phases: readonly CrrtReasoningPhase[]
}[]

const roleLabels: Readonly<Record<CrrtRoleLens, string>> = {
  integrated: 'Integrated',
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

export type CrrtMobileSurface = 'case' | 'machine' | 'patient' | 'debrief'

interface CrrtCasePlayerProps {
  readonly session: CrrtLearningSessionState
  readonly dispatch: Dispatch<CrrtLearningSessionAction>
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
  const currentIndex = reasoningStages.findIndex(({ phases }) =>
    phases.some((phase) => phase === current),
  )

  return (
    <nav className={styles.reasoningRibbon} aria-label="CRRT case stages">
      <span>Reasoning loop</span>
      <ol>
        {reasoningStages.map(({ id, label, detail }, index) => (
          <li
            key={id}
            data-status={
              index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'pending'
            }
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <i>{index < currentIndex ? <Check aria-hidden="true" /> : index + 1}</i>
            <span>
              <strong>{label}</strong>
              <small>{detail}</small>
            </span>
            {index < reasoningStages.length - 1 ? <ChevronRight aria-hidden="true" /> : null}
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

const mobileSurfaces: readonly { readonly id: CrrtMobileSurface; readonly label: string }[] = [
  { id: 'case', label: 'Case' },
  { id: 'machine', label: 'Machine + circuit' },
  { id: 'patient', label: 'Patient & trends' },
  { id: 'debrief', label: 'Debrief' },
]

export function CrrtCasePlayer(props: CrrtCasePlayerProps) {
  const { session } = props
  const playerKey = [
    session.caseDefinition.id,
    session.experience,
    session.roleLens,
    session.attempt,
  ].join(':')
  return <CrrtCasePlayerContent key={playerKey} {...props} />
}

function CrrtCasePlayerContent({
  session,
  dispatch,
  onRoleChange,
  onReset,
  onPredictionCommitted,
  onHintUsed,
  onFirstSafeAction,
  onReassessmentCommitted,
  onDebriefRevealed,
  idNamespace,
}: CrrtCasePlayerProps) {
  const definition = session.caseDefinition
  const isMastery = session.experience === 'mastery'
  const scopedId = (id: string) => (idNamespace ? `${idNamespace}-${id}` : id)
  const experienceLabel =
    session.experience === 'practice' ? 'Scored Practice' : 'Capstone assessment'
  const visibleCaseTitle =
    isMastery && !session.debriefRevealed
      ? baxterCrrtMasteryManifest.learnerTitleBeforeDebrief
      : definition.title
  const machineControlsEnabled = session.prediction !== null && !session.debriefRevealed
  const consoleControls = selectCrrtConsoleControls(session)
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
  const [mobileSurface, setMobileSurface] = useState<CrrtMobileSurface>('case')
  const mobileTabRefs = useRef<Partial<Record<CrrtMobileSurface, HTMLButtonElement>>>({})
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

  function moveSurfaceFocus(
    event: KeyboardEvent<HTMLButtonElement>,
    currentSurface: CrrtMobileSurface,
  ) {
    const currentIndex = mobileSurfaces.findIndex(({ id }) => id === currentSurface)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % mobileSurfaces.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + mobileSurfaces.length) % mobileSurfaces.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = mobileSurfaces.length - 1
    }
    if (nextIndex === null) return
    event.preventDefault()
    const nextSurface = mobileSurfaces[nextIndex].id
    setMobileSurface(nextSurface)
    mobileTabRefs.current[nextSurface]?.focus()
  }

  return (
    <div className={styles.learningWorkflow}>
      <CrrtReasoningRibbon session={session} />
      <div className={styles.mobileSurfaceTabs} role="tablist" aria-label="CRRT case surfaces">
        {mobileSurfaces.map((surface) => (
          <button
            key={surface.id}
            id={scopedId(`baxter-crrt-mobile-tab-${surface.id}`)}
            ref={(node) => {
              if (node) mobileTabRefs.current[surface.id] = node
            }}
            type="button"
            role="tab"
            aria-selected={mobileSurface === surface.id}
            aria-controls={scopedId(`baxter-crrt-mobile-panel-${surface.id}`)}
            tabIndex={mobileSurface === surface.id ? 0 : -1}
            onClick={() => setMobileSurface(surface.id)}
            onKeyDown={(event) => moveSurfaceFocus(event, surface.id)}
          >
            {surface.label}
          </button>
        ))}
      </div>
      <div
        id={scopedId('baxter-crrt-mobile-panel-case')}
        className={styles.caseWorkflow}
        role="tabpanel"
        aria-labelledby={scopedId('baxter-crrt-mobile-tab-case')}
        data-mobile-active={mobileSurface === 'case'}
        data-testid="crrt-case-workflow"
      >
        <div className={styles.contextControls}>
          <div className={styles.roleToggle} role="group" aria-label="View case through role lens">
            <span>View as:</span>
            {definition.roleLenses.map((roleLens) => (
              <button
                key={roleLens}
                type="button"
                aria-pressed={session.roleLens === roleLens}
                onClick={() => onRoleChange(roleLens)}
              >
                {roleLabels[roleLens]}
              </button>
            ))}
          </div>
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
              <strong id={scopedId('crrt-mastery-boundary-heading')}>Capstone safeguards.</strong>{' '}
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
            <strong>Simulated clinical case.</strong> Patient values, treatment responses, and
            scoring are for education only—not bedside targets or local protocols.
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
        </section>

        <section
          className={styles.predictionSection}
          aria-labelledby={scopedId('crrt-prediction-heading')}
        >
          <div className={styles.workflowHeading}>
            {session.prediction ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            <div>
              <span>Assess · Plan · Predict</span>
              <h4 id={scopedId('crrt-prediction-heading')}>Plan your approach before acting</h4>
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
                Submit plan and prediction <ArrowRight aria-hidden="true" />
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
              <span>Act</span>
              <h4 id={scopedId('crrt-actions-heading')}>Choose and sequence clinical actions</h4>
            </div>
          </div>

          {!session.prediction ? (
            <p className={styles.lockedCopy}>
              <LockKeyhole aria-hidden="true" /> Submit your plan and prediction before taking
              action.
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
                Observe immediate machine changes and later patient and treatment-delivery trends.
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
                <h4 id={scopedId('crrt-hint-heading')}>Optional, scored support</h4>
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
            <small>Each revealed hint subtracts 5 points, up to the maximum hint penalty.</small>
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
                Compare your prediction with the observed response
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
              <strong>A required safety step was missed.</strong> Review the action sequence in the
              debrief. This exercise feedback is not a clinical threshold or competency decision.
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
        <div className={styles.machineSurfaceHeading}>
          <div>
            <span>Interactive equipment station</span>
            <h4>PrisMax machine and circuit</h4>
          </div>
          <strong data-unlocked={machineControlsEnabled}>
            {machineControlsEnabled
              ? 'Machine actions available'
              : session.debriefRevealed
                ? 'Attempt complete'
                : 'Complete clinical plan'}
          </strong>
        </div>
        <p className={styles.machineSurfaceIntro}>
          Explore the layout and circuit at any time. Submit the five-part plan on the Case tab to
          use setup and Operations controls. Machine, circuit, and patient views update together.
        </p>
        <PrismaxPilotInterface
          state={session.interfaceState}
          dispatch={(action) => dispatch({ type: 'DEVICE_ACTION', action })}
          controlsEnabled={machineControlsEnabled}
          controlLockReason={session.debriefRevealed ? 'debrief' : 'plan'}
          consoleControls={consoleControls}
          operationsDisplay={selectPrismaxPilotCaseOperationsDisplay(
            session.interfaceState,
            session.simulation,
          )}
          caseContext={prismaxCaseContext}
          onPerformCaseAction={performIntervention}
          onRequestClinicalPlan={() => setMobileSurface('case')}
          onReset={onReset}
        />
        <div className={styles.circuitSummary} aria-label="Circuit and fluid state">
          <h5>Circuit and fluid state</h5>
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
        </div>
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
                aria-label={isMastery ? 'Capstone score' : 'Practice score'}
              >
                <div>
                  <span>{isMastery ? 'Capstone score' : 'Practice score'}</span>
                  <strong>{debrief.outcome.score}/100</strong>
                  <small>
                    {isMastery
                      ? 'Educational capstone result · no competency or certification claim'
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
                This attempt cannot be scored because its required assessment configuration is
                unavailable.
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
