'use client'

import type { Route } from 'next'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Circle } from 'lucide-react'

import { criticalCareActivities } from '@/features/critical-care/content/activities'
import { criticalCareReferences } from '@/features/critical-care/content/references'
import {
  ActivityShell,
  type ActivityShellProps,
} from '@/features/learning-module/components/ActivityShell'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import {
  ResumeBanner,
  type ResumeBannerState,
} from '@/features/learning-module/components/ResumeBanner'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import {
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type CriticalCareActivityPhase,
  type CriticalCareResumePointer,
} from '@/features/learning-module/activity'
import { Link, useRouter } from '@/i18n/navigation'

import {
  hemodynamicCaseById,
  hemodynamicsSourceById,
  type PacLearningPathwaySectionId,
} from '../content'
import {
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  thermodilutionAcceptedAverage,
  type HemodynamicAction,
  type HemodynamicSimulationState,
} from '../engine'
import { HemodynamicNativeWorkspace } from './HemodynamicNativeWorkspace'
import { PacLearningPathwayViewport } from './PacLearningPathwayNav'
import { PacSectionCompletionActions } from './PacSectionCompletionActions'

const ACTIVITY_ID = 'hemodynamics:learn:pac-signal-validation'
const PAYLOAD_VERSION = 'pac-signal-validation-v1'
const ACTIVITY_PATHNAME = '/icu-hemodynamics/learn'
const ACTIVITY_QUERY = { activity: 'pac-signal-validation' } as const
const ACTIVITY_SEED = 808

function requireCatalogEntry<T>(value: T | undefined, message: string): T {
  if (!value) throw new Error(message)
  return value
}

const activityDefinition = requireCatalogEntry(
  criticalCareActivities.find((activity) => activity.id === ACTIVITY_ID),
  'PAC signal-validation activity definition is missing.',
)
const caseDefinition = requireCatalogEntry(
  hemodynamicCaseById.get('HD-08'),
  'PAC signal-validation case HD-08 is missing.',
)

const checkpoints = {
  recognize: 'recognize-reviewed',
  predict: 'prediction-ready',
  act: 'action-ready',
  observe: 'corrected-signal-ready',
  explain: 'reassessment-complete',
  transfer: 'debrief-reviewed',
} as const satisfies Readonly<Record<CriticalCareActivityPhase, string>>

const phaseByCheckpoint = new Map<string, CriticalCareActivityPhase>(
  Object.entries(checkpoints).map(([phase, checkpoint]) => [
    checkpoint,
    phase as CriticalCareActivityPhase,
  ]),
)

const phaseCopy: Readonly<
  Record<
    CriticalCareActivityPhase,
    { objective: string; requiredAction: string; targets: readonly string[]; hint: string }
  >
> = {
  recognize: {
    objective: 'Identify why the displayed numbers cannot yet be treated as valid data.',
    requiredAction: 'Inspect the patient context, transducer setup, and live waveform state.',
    targets: ['Signal–patient fit', 'Level and zero status', 'Catheter position'],
    hint: 'Start with the measurement chain whenever the monitor and bedside picture disagree.',
  },
  predict: {
    objective: 'Commit to signal usability before changing the simulated patient.',
    requiredAction: 'Decide whether the current values are safe to use for treatment decisions.',
    targets: ['Usability decision', 'Immediate priority'],
    hint: 'A plausible number is not necessarily a valid measurement.',
  },
  act: {
    objective: 'Validate and repair the complete PAC measurement chain.',
    requiredAction: 'Complete all four checks before advancing.',
    targets: ['Level and zero', 'Dynamic response', 'Catheter position', 'Repeat technique'],
    hint: caseDefinition.guidedPrompt,
  },
  observe: {
    objective: 'Compare the corrected signal with the unchanged bedside perfusion picture.',
    requiredAction: 'Reassess signal validity, pressure, flow, and perfusion together.',
    targets: ['Corrected waveform', 'Validated cardiac output', 'Serial bedside context'],
    hint: 'Reassessment closes the loop; correction alone does not.',
  },
  explain: {
    objective: 'Explain the causal chain from artifact to corrected interpretation.',
    requiredAction: 'Review the debrief and connect each action to its consequence.',
    targets: ['Hydrostatic error', 'False wedge', 'Invalid curve rejection'],
    hint: 'Name why the initial data were misleading, not just which button fixed them.',
  },
  transfer: {
    objective: 'Apply the same sequence to a new dynamic-response abnormality.',
    requiredAction: 'Choose the first action before treating an overdamped waveform.',
    targets: ['Recognize overdamping', 'Revalidate before treatment'],
    hint: 'The fast-flush response helps characterize damping before clinical interpretation.',
  },
}

type PredictionChoice = 'usable' | 'not-usable'

interface ResumePrompt {
  readonly state: ResumeBannerState
  readonly title: string
  readonly description: string
  readonly pointer?: CriticalCareResumePointer
}

function freshSimulation(): HemodynamicSimulationState {
  return createInitialHemodynamicState(caseDefinition, 'learn', ACTIVITY_SEED)
}

function reduceSimulation(
  state: HemodynamicSimulationState,
  ...actions: readonly HemodynamicAction[]
): HemodynamicSimulationState {
  return actions.reduce(icuHemodynamicsReducer, state)
}

function correctedSimulation(state: HemodynamicSimulationState): HemodynamicSimulationState {
  let corrected = reduceSimulation(
    state,
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
    { type: 'ZERO_TRANSDUCER' },
    { type: 'FAST_FLUSH', lineType: 'systemic-arterial' },
    { type: 'VALIDATE_SIGNAL', check: 'dynamic-response-classified' },
    { type: 'SET_DAMPING', dampingRatio: 0.65 },
    { type: 'SET_ARTIFACT', artifact: 'none' },
    { type: 'VALIDATE_SIGNAL', check: 'dynamic-response-corrected' },
    { type: 'RETRACT_CATHETER', instant: true },
  )
  for (let index = 0; index < 3; index += 1) {
    corrected = icuHemodynamicsReducer(corrected, {
      type: 'GENERATE_THERMODILUTION_TRIAL',
      technique: {
        injectateVolumeMl: caseDefinition.thermodilution.injectateVolumeMl,
        injectateTemperatureC: caseDefinition.thermodilution.injectateTemperatureC,
        injectionDurationSeconds: 2.5,
        respiratoryPhase: 'end-expiration',
        smoothness: 0.95,
      },
    })
    const trial = corrected.thermodilutionTrials.at(-1)
    if (trial) {
      // H4 §7. Acceptance now follows a review of the raw curve, so the authored corrected state
      // performs both steps rather than reaching an accepted series the learner could not reach.
      corrected = icuHemodynamicsReducer(corrected, {
        type: 'REVIEW_THERMODILUTION_CURVE',
        trialId: trial.id,
      })
      corrected = icuHemodynamicsReducer(corrected, {
        type: 'SET_THERMODILUTION_ACCEPTED',
        trialId: trial.id,
        accepted: true,
      })
    }
  }
  return corrected
}

function transferSimulation(): HemodynamicSimulationState {
  return reduceSimulation(
    freshSimulation(),
    { type: 'SET_TRANSDUCER_LEVEL', levelCm: 0 },
    { type: 'ZERO_TRANSDUCER' },
    { type: 'SET_CATHETER_POSITION', position: 'pa' },
    { type: 'SET_DAMPING', dampingRatio: 1.15 },
    { type: 'SET_ARTIFACT', artifact: 'overdamped' },
  )
}

function rebuildAtCheckpoint(checkpointId: string): HemodynamicSimulationState {
  const phase = phaseByCheckpoint.get(checkpointId)
  let state = freshSimulation()
  if (phase === 'observe' || phase === 'explain' || phase === 'transfer') {
    state = correctedSimulation(state)
  }
  if (phase === 'explain' || phase === 'transfer') {
    state = icuHemodynamicsReducer(state, { type: 'REASSESS' })
  }
  if (phase === 'transfer') {
    state = transferSimulation()
  }
  return state
}

function ActionStatus({
  complete,
  children,
}: {
  readonly complete: boolean
  readonly children: string
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="sr-only">{complete ? 'Completed: ' : 'Not completed: '}</span>
      {complete ? (
        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
      ) : (
        <Circle className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
      {children}
    </span>
  )
}

export function PacSignalValidationActivity({
  locale = 'en',
  onPathwaySectionChange,
}: {
  readonly locale?: string
  readonly onPathwaySectionChange?: (sectionId: PacLearningPathwaySectionId) => void
}) {
  const router = useRouter()
  const [simulation, setSimulation] = useState(freshSimulation)
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [prediction, setPrediction] = useState<PredictionChoice | null>(null)
  const [predictionRestored, setPredictionRestored] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null)
  const [transferInterpretation, setTransferInterpretation] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>({
    state: 'loading',
    title: 'Checking saved work',
    description: 'Validating the saved checkpoint before loading the simulation.',
  })
  const attemptNumber = useRef(1)
  const recordedSafetyEvents = useRef(new Set<string>())
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'icu-hemodynamics',
    activityId: ACTIVITY_ID,
    mode: 'guided',
    phase,
  })

  const apply = (action: HemodynamicAction) => {
    setSimulation((current) => icuHemodynamicsReducer(current, action))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const envelope = readCriticalCareProgress(window.localStorage)
      const existing = envelope.activities.find((activity) => activity.activityId === ACTIVITY_ID)
      attemptNumber.current = (existing?.attempts ?? 0) + 1
      const pointer = envelope.resume
      if (!pointer || pointer.activityId !== ACTIVITY_ID) {
        setResumePrompt(null)
        return
      }
      const expectedPhase = pointer.checkpointId
        ? phaseByCheckpoint.get(pointer.checkpointId)
        : undefined
      const compatible =
        pointer.pathname === ACTIVITY_PATHNAME &&
        pointer.query?.activity === ACTIVITY_QUERY.activity &&
        pointer.mode === 'guided' &&
        pointer.payloadVersion === PAYLOAD_VERSION &&
        expectedPhase === pointer.phase
      if (!compatible) {
        setResumePrompt({
          state: 'incompatible',
          title: 'Saved checkpoint needs a safe restart',
          description:
            'The stored activity version or checkpoint no longer matches this simulation. No clinical state will be guessed.',
        })
        return
      }
      setResumePrompt({
        state: 'ready',
        title: `Resume at ${pointer.phase}`,
        description:
          'Only an authored safe checkpoint was stored. Your prior prediction choice and any free text were intentionally not retained.',
        pointer,
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(() => {
      setSimulation((current) =>
        icuHemodynamicsReducer(current, { type: 'TICK', seconds: intervalMs / 1000 }),
      )
    }, intervalMs)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (simulation.criticalErrors.length === 0) {
      recordedSafetyEvents.current.clear()
      return
    }
    for (const error of simulation.criticalErrors) {
      if (recordedSafetyEvents.current.has(error)) continue
      recordedSafetyEvents.current.add(error)
      lifecycleAnalytics.recordSafetyEvent()
    }
  }, [lifecycleAnalytics, simulation.criticalErrors])

  const referenceEntries = useMemo(
    () =>
      criticalCareReferences
        .filter((reference) =>
          (reference.relatedActivityIds as readonly string[]).includes(ACTIVITY_ID),
        )
        .map((reference) => ({
          id: reference.id,
          title: reference.title,
          summary: reference.summary,
          meta: `Category: ${reference.category.replaceAll('-', ' ')}`,
        })),
    [],
  )

  const evidenceEntries = useMemo(
    () =>
      activityDefinition.evidenceIds.flatMap((sourceId) => {
        const source = hemodynamicsSourceById.get(sourceId)
        return source
          ? [
              {
                id: source.id,
                title: source.title,
                sourceLabel: `${source.citation} · version ${source.version}`,
                limitation:
                  source.limitation ??
                  `Used only for ${source.intendedUse.toLocaleLowerCase()}; this activity remains an educational model.`,
              },
            ]
          : []
      }),
    [],
  )

  function persistCheckpoint(
    nextPhase: CriticalCareActivityPhase,
    checkpointId: string,
    options: { completed?: boolean; addHint?: boolean } = {},
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((activity) => activity.activityId === ACTIVITY_ID)
    const authoritativeStatus = authoritativeCriticalCareStatus(
      activityDefinition,
      options.completed ? 'completed' : 'in-progress',
    )
    const done = authoritativeStatus === 'completed' || authoritativeStatus === 'mastered'
    const pointer: CriticalCareResumePointer = {
      activityId: ACTIVITY_ID,
      pathname: ACTIVITY_PATHNAME,
      query: ACTIVITY_QUERY,
      mode: 'guided',
      phase: nextPhase,
      scenarioId: caseDefinition.id,
      checkpointId,
      payloadVersion: PAYLOAD_VERSION,
      updatedAt: now,
    }
    let updated = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId: ACTIVITY_ID,
        status: authoritativeStatus,
        currentPhase: nextPhase,
        mode: 'guided',
        attempts: Math.max(attemptNumber.current, existing?.attempts ?? 0),
        hintCount: (existing?.hintCount ?? 0) + (options.addHint ? 1 : 0),
        competencyEvidenceIds: authoritativeCriticalCareCompetencyEvidence(
          activityDefinition,
          done ? activityDefinition.competencyIds : [],
        ),
        updatedAt: now,
      },
      done ? undefined : pointer,
    )
    if (done) updated = withoutCriticalCareResumePointer(updated, ACTIVITY_ID)
    const saved = writeCriticalCareProgress(window.localStorage, updated)
    setStorageMessage(
      saved
        ? options.completed && !done
          ? 'Draft review saved as in progress; it does not make a claim about clinical readiness.'
          : options.completed
            ? 'Activity completion saved on this device.'
            : 'Safe checkpoint saved on this device.'
        : 'Progress could not be stored on this device. You can continue this session.',
    )
  }

  function advanceTo(nextPhase: CriticalCareActivityPhase) {
    setPhase(nextPhase)
    setHintVisible(false)
    persistCheckpoint(nextPhase, checkpoints[nextPhase])
  }

  function selectPhase(nextPhase: CriticalCareActivityPhase) {
    setSimulation(rebuildAtCheckpoint(checkpoints[nextPhase]))
    setPhase(nextPhase)
    setHintVisible(false)
    setCompleted(false)
    if (nextPhase === 'predict') setPrediction(null)
    if (nextPhase === 'transfer') {
      setTransferInterpretation(null)
      setTransferFeedback(null)
    }
    persistCheckpoint(nextPhase, checkpoints[nextPhase])
    setStorageMessage(
      `Opened the ${nextPhase} section from the authored safe setup for that phase.`,
    )
  }

  function submitPrediction() {
    if (!prediction) return
    const alternativeMechanism = caseDefinition.mechanismOptions.find(
      (option) => option.id !== caseDefinition.correctMechanismId,
    )
    const alternativePriority = caseDefinition.priorityOptions.find(
      (option) => option.id !== caseDefinition.correctPriorityId,
    )
    apply({
      type: 'SELECT_MECHANISM',
      id:
        prediction === 'not-usable'
          ? caseDefinition.correctMechanismId
          : (alternativeMechanism?.id ?? ''),
    })
    apply({
      type: 'SELECT_PRIORITY',
      id:
        prediction === 'not-usable'
          ? caseDefinition.correctPriorityId
          : (alternativePriority?.id ?? ''),
    })
    apply({ type: 'COMMIT_PREDICTION' })
    lifecycleAnalytics.recordPredictionSubmitted()
    advanceTo('act')
  }

  function reassessCorrectedSignal() {
    apply({ type: 'TICK', seconds: 2 })
    apply({ type: 'REASSESS' })
    lifecycleAnalytics.recordDebriefViewed()
    advanceTo('explain')
  }

  function observeCorrectedSignal() {
    lifecycleAnalytics.recordGoalMet()
    advanceTo('observe')
  }

  function enterTransfer() {
    setSimulation(transferSimulation())
    setTransferInterpretation(null)
    setTransferFeedback(null)
    advanceTo('transfer')
  }

  function answerTransfer(choice: string) {
    setTransferInterpretation(choice)
    if (choice !== 'overdamped-system') {
      setTransferFeedback(
        choice === 'low-stroke-volume'
          ? 'A true stroke-volume change may narrow pulse pressure, but it does not explain the sluggish fast-flush release. Localize the measurement-system behavior first.'
          : 'Respiratory variation changes the pressure baseline across breaths; it does not produce this release response.',
      )
      return
    }
    setTransferFeedback(
      'Best interpretation. The sluggish release with little oscillation indicates an overdamped measurement system. Repair and revalidate that system in the workspace.',
    )
  }

  function completeTransfer() {
    const transferInteractionComplete =
      transferInterpretation !== null &&
      simulation.signalValidationChecks.includes('dynamic-response-classified') &&
      simulation.signalValidationChecks.includes('dynamic-response-corrected') &&
      simulation.measurementSystem.artifact === 'none'
    if (!transferInteractionComplete) {
      setTransferFeedback(
        'Choose an interpretation, then use the pressure-system lab to classify and repair the observed release response.',
      )
      return
    }
    apply({ type: 'COMPLETE_CASE' })
    setCompleted(true)
    persistCheckpoint('transfer', checkpoints.transfer, { completed: true })
    lifecycleAnalytics.recordTransferCompleted()
  }

  function resetActivity() {
    setSimulation(freshSimulation())
    setPhase('recognize')
    setPrediction(null)
    setPredictionRestored(false)
    setHintVisible(false)
    setTransferFeedback(null)
    setTransferInterpretation(null)
    setCompleted(false)
    const envelope = readCriticalCareProgress(window.localStorage)
    writeCriticalCareProgress(
      window.localStorage,
      withoutCriticalCareResumePointer(envelope, ACTIVITY_ID),
    )
    setStorageMessage('Activity reset to the authored safe starting state.')
  }

  function saveAndExit() {
    persistCheckpoint(phase, checkpoints[phase])
    router.push('/icu-hemodynamics/learn' as Route)
  }

  function resumeSavedActivity(pointer: CriticalCareResumePointer) {
    const checkpointId = pointer.checkpointId
    const restoredPhase = checkpointId ? phaseByCheckpoint.get(checkpointId) : undefined
    if (!checkpointId || !restoredPhase) {
      setResumePrompt({
        state: 'incompatible',
        title: 'Saved checkpoint needs a safe restart',
        description: 'The checkpoint is not an authored restoration point.',
      })
      return
    }
    setSimulation(rebuildAtCheckpoint(checkpointId))
    setPhase(restoredPhase)
    setPredictionRestored(restoredPhase !== 'recognize' && restoredPhase !== 'predict')
    setResumePrompt(null)
    setStorageMessage('Safe checkpoint restored. Detailed prior selections were not retained.')
  }

  function startFromSafeCheckpoint() {
    const envelope = readCriticalCareProgress(window.localStorage)
    writeCriticalCareProgress(
      window.localStorage,
      withoutCriticalCareResumePointer(envelope, ACTIVITY_ID),
    )
    setSimulation(freshSimulation())
    setPhase('recognize')
    setResumePrompt(null)
    setStorageMessage('Started from the authored safe checkpoint.')
  }

  function showHint() {
    if (!hintVisible) {
      persistCheckpoint(phase, checkpoints[phase], { addHint: true })
      lifecycleAnalytics.recordHintUsed()
    }
    setHintVisible(true)
  }

  const completedInterventions = new Set(simulation.completedInterventionIds)
  const transducerLeveled = Math.abs(simulation.measurementSystem.transducerLevelCm) <= 1
  const atmosphericZeroed = simulation.measurementSystem.zeroed
  const pressureSystemCorrected = completedInterventions.has('correct-measurement-system')
  const dynamicResponseChecked = simulation.signalValidationChecks.includes('fast-flush')
  const dynamicResponseClassified = simulation.signalValidationChecks.includes(
    'dynamic-response-classified',
  )
  const catheterRepositioned = completedInterventions.has('reposition-catheter')
  const thermodilutionRepeated = completedInterventions.has('repeat-valid-thermodilution')
  const actionsComplete =
    pressureSystemCorrected &&
    dynamicResponseChecked &&
    catheterRepositioned &&
    thermodilutionRepeated

  const task = phaseCopy[phase]
  const clinicalModel = predictionRestored
    ? 'A prediction was submitted in the prior session; its exact choice was intentionally not persisted.'
    : prediction === 'not-usable'
      ? 'The values are not yet usable; artifact and measurement-chain validation take priority.'
      : prediction === 'usable'
        ? 'The initial values were considered usable before the measurement chain was corrected.'
        : 'No prediction has been submitted yet.'

  let taskControls = null
  if (completed) {
    taskControls = (
      <PacSectionCompletionActions
        sectionTitle="PAC signal-validation capstone"
        continueLabel="Continue to hemodynamics practice"
        onRepeat={resetActivity}
        onContinue={() => router.push('/icu-hemodynamics/practice' as Route)}
      />
    )
  } else if (phase === 'recognize') {
    taskControls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={() => advanceTo('predict')}
      >
        I recognize a signal-validation problem
      </button>
    )
  } else if (phase === 'predict') {
    taskControls = (
      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold">Can these values guide treatment now?</legend>
        {[
          ['not-usable', 'No — validate the signal first'],
          ['usable', 'Yes — treat the displayed values'],
        ].map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm"
          >
            <input
              type="radio"
              name="signal-usability"
              value={value}
              checked={prediction === value}
              onChange={() => setPrediction(value as PredictionChoice)}
            />
            {label}
          </label>
        ))}
        <button
          type="button"
          disabled={!prediction}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onClick={submitPrediction}
        >
          Commit prediction
        </button>
      </fieldset>
    )
  } else if (phase === 'act') {
    taskControls = (
      <div className="grid gap-2">
        <div className="rounded-xl border p-3 text-sm">
          <ActionStatus complete={transducerLeveled}>
            Level the transducer at the phlebostatic axis
          </ActionStatus>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <ActionStatus complete={atmosphericZeroed}>
            Open to air and establish atmospheric zero
          </ActionStatus>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <ActionStatus
            complete={
              pressureSystemCorrected && dynamicResponseChecked && dynamicResponseClassified
            }
          >
            Run, classify, and resolve the actual fast-flush release trace
          </ActionStatus>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <ActionStatus complete={catheterRepositioned}>
            Retract from false wedge and confirm return of the PA waveform
          </ActionStatus>
        </div>
        <div className="rounded-xl border p-3 text-sm">
          <ActionStatus complete={thermodilutionRepeated}>
            Generate, inspect, and accept a valid thermodilution series
          </ActionStatus>
        </div>
        <button
          type="button"
          disabled={!actionsComplete}
          className="mt-2 min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          onClick={observeCorrectedSignal}
        >
          Observe the corrected signal
        </button>
      </div>
    )
  } else if (phase === 'observe') {
    taskControls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={reassessCorrectedSignal}
      >
        Reassess pressure, flow, perfusion, and validity
      </button>
    )
  } else if (phase === 'explain') {
    taskControls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={enterTransfer}
      >
        Apply this reasoning to a new waveform
      </button>
    )
  } else {
    const transferReady =
      transferInterpretation !== null &&
      simulation.signalValidationChecks.includes('dynamic-response-classified') &&
      simulation.signalValidationChecks.includes('dynamic-response-corrected') &&
      simulation.measurementSystem.artifact === 'none'
    taskControls = (
      <div className="grid gap-2">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">
            The release trace returns slowly with little oscillation. What best explains it?
          </legend>
          {[
            [
              'overdamped-system',
              'An overdamped measurement system attenuating rapid pressure change',
            ],
            ['low-stroke-volume', 'A true fall in stroke volume causing the narrow pulse pressure'],
            ['respiratory-variation', 'Normal respiratory pressure variation across the breath'],
          ].map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                name="transfer-interpretation"
                checked={transferInterpretation === value}
                onChange={() => answerTransfer(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {transferFeedback ? (
          <p className="rounded-xl bg-muted p-3 text-sm leading-6" role="status">
            {transferFeedback}
          </p>
        ) : null}
        <button
          type="button"
          disabled={completed || !transferReady}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={completeTransfer}
        >
          Complete after choosing, reviewing, and correcting the new trace
        </button>
      </div>
    )
  }

  const stationViewport =
    phase === 'explain' ? (
      <div className="h-full overflow-auto p-4">
        <DebriefPanel
          clinicalModel={clinicalModel}
          actions={[
            'Corrected level, zero, and dynamic response.',
            'Returned the catheter to a confirmed PA position.',
            'Repeated thermodilution using valid technique.',
            'Reassessed the corrected signal with the bedside context.',
          ]}
          consequences={caseDefinition.debrief}
          performanceDomains={[
            { label: 'Signal validity', result: 'Measurement chain corrected before treatment' },
            { label: 'Mechanism', result: 'Artifact separated from patient physiology' },
            {
              label: 'Reassessment',
              result: 'Pressure, flow, perfusion, and validity reviewed together',
            },
          ]}
          remediation={
            prediction === 'usable' ? (
              <p>
                Revisit why internal inconsistency and an unchanged bedside picture should trigger
                signal validation before management.
              </p>
            ) : null
          }
          transfer={<p>Next, the monitor will present an overdamped pressure waveform.</p>}
        />
      </div>
    ) : (
      <HemodynamicNativeWorkspace
        state={simulation}
        dispatch={apply}
        pressureChallengeMode="current-state"
        showDerived={phase !== 'transfer'}
        showThermodilution={phase !== 'transfer'}
      />
    )

  const viewport = onPathwaySectionChange ? (
    <PacLearningPathwayViewport
      activeSectionId="pac-signal-validation"
      onSelect={(sectionId) => {
        persistCheckpoint(phase, checkpoints[phase], { completed })
        onPathwaySectionChange(sectionId)
      }}
    >
      {stationViewport}
    </PacLearningPathwayViewport>
  ) : (
    stationViewport
  )

  const shellProps: ActivityShellProps = {
    activityId: ACTIVITY_ID,
    assumedConceptIds: activityDefinition.assumedConceptIds,
    breadcrumb: (
      <span>
        <Link href={'/icu-hemodynamics' as Route}>ICU Hemodynamics</Link> /{' '}
        <Link href={'/icu-hemodynamics/learn' as Route}>Learn</Link> / PAC signal validation
      </span>
    ),
    activityTitle: 'PAC signal validation',
    phase,
    mode: 'guided',
    progressLabel: completed ? 'Worked through' : `Current phase: ${phase}`,
    patientContext: (
      <PatientContextBar
        items={[
          { label: 'Setting', value: 'Adult ICU · simulated' },
          { label: 'Bedside perfusion', value: 'Unchanged from baseline' },
          {
            label: 'Displayed MAP',
            value: `${simulation.measurements.mapMmHg.toFixed(0)} mmHg`,
          },
          {
            label: 'Displayed CO',
            value:
              thermodilutionAcceptedAverage(simulation.thermodilutionTrials) === null
                ? 'Erratic / not accepted'
                : `${thermodilutionAcceptedAverage(simulation.thermodilutionTrials)?.toFixed(1)} L/min`,
          },
          {
            label: 'Pressure zero',
            value: simulation.measurementSystem.zeroed ? 'Complete' : 'Required',
          },
          {
            label: 'Transducer level',
            value: `${simulation.measurementSystem.transducerLevelCm.toFixed(0)} cm offset`,
          },
          { label: 'PAC position', value: simulation.catheter.position.toUpperCase() },
        ]}
        immediateGoal={`${caseDefinition.presentation} Determine whether the signal is valid before changing management.`}
        safetyConstraints={[
          'Do not act on one displayed number without validating the measurement chain.',
          'This simulation is educational and cannot guide patient care.',
        ]}
      />
    ),
    viewport,
    currentTask: (
      <TaskPanel
        objective={task.objective}
        requiredAction={
          completed
            ? 'Choose whether to repeat the capstone or continue to hemodynamics practice.'
            : task.requiredAction
        }
        targets={completed ? ['Hemodynamics practice cases'] : task.targets}
        hint={task.hint}
        mode="guided"
        hintVisible={hintVisible}
        onHintRequested={showHint}
      >
        {taskControls}
      </TaskPanel>
    ),
    bottomContent:
      storageMessage ?? simulation.responseMessage ?? `Checkpoint: ${checkpoints[phase]}`,
    secondaryActions: (
      <>
        <ReferenceDrawer
          entries={referenceEntries}
          trigger={
            <button type="button" className="min-h-10 rounded-lg border px-3 text-xs font-semibold">
              Reference
            </button>
          }
        />
        <EvidenceDrawer
          entries={evidenceEntries}
          trigger={
            <button type="button" className="min-h-10 rounded-lg border px-3 text-xs font-semibold">
              Evidence
            </button>
          }
        />
      </>
    ),
    onSaveAndExit: saveAndExit,
    onHelp: showHint,
    onReset: resetActivity,
    onPhaseSelect: selectPhase,
    theme: 'dark',
    layout: 'native-workbench',
  }

  if (resumePrompt) {
    return (
      <main className="mx-auto grid min-h-[34rem] w-full max-w-3xl place-items-center px-4 py-10">
        <ResumeBanner
          state={resumePrompt.state}
          title={resumePrompt.title}
          description={resumePrompt.description}
          onResume={
            resumePrompt.pointer ? () => resumeSavedActivity(resumePrompt.pointer!) : undefined
          }
          onStartSafe={startFromSafeCheckpoint}
        />
      </main>
    )
  }

  return (
    <SimulationLaunchGate
      activityTitle="PAC signal validation"
      minimumViewport="tablet"
      bandwidthClass="standard"
      estimatedSizeLabel="Under 2 MB after shared application assets"
      lightweightAlternativeHref="/icu-hemodynamics/learn"
      onSaveForLater={saveAndExit}
      theme="dark"
    >
      {locale !== 'en' ? (
        <p className="sr-only">
          Reviewed English fallback: localized clinical review for this activity is pending.
        </p>
      ) : null}
      <ActivityShell {...shellProps} />
    </SimulationLaunchGate>
  )
}
