'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from 'react'
import type { Route } from 'next'
import { CheckCircle2, Circle, Languages } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import {
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  criticalCareActivityPhases,
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type ClinicalLearningItem,
  type CriticalCareActivityPhase,
  type CriticalCareResumePointer,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { ChoiceReasoningFeedback } from '@/features/learning-module/components/ChoiceReasoningFeedback'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import {
  PathwayNav,
  PathwaySectionCompletion,
  ResizableTeachingWorkspace,
  nextPathwaySection,
} from '@/features/learning-module/curriculum'

import {
  getVentilatorDeviceProfile,
  hasVentilationLessonEvidence,
  mechanicalVentilationCaseById,
  mechanicalVentilationLessonItems,
  ventilationEvidenceById,
  ventilationLessonActionEvidence,
  ventilationLessonObservationActions,
  ventilationLessonObservationEvidence,
  ventilationLessonRecognitionActions,
  ventilationLessonRecognitionEvidence,
  ventilationLessonRuntimeById,
  type MechanicalVentilationLessonId,
  type VentilationLessonDefinition,
  type VentilationLessonGuidedAction,
  type VentilationLessonRuntimeDefinition,
  type VentilationLessonVariant,
} from '../content'
import {
  createInitialSimulationState,
  ventilationSimulationReducer,
  type VentilationAction,
  type VentilationSimulationState,
} from '../engine'
import { BedsidePanel } from './BedsidePanel'
import teachingStyles from './mechanical-ventilation-teaching.module.css'
import {
  MechanicalVentilationTeachingPanel,
  VentilationRunControl,
  VentilationSectionOverview,
  hasVentilationTeachingPanel,
} from './MechanicalVentilationTeachingPanel'
import { MechanicalVentilatorConsole } from './MechanicalVentilatorConsole'

const PATHNAME = '/mechanical-ventilation/learn'
const PAYLOAD_VERSION = 'ventilation-lesson-v2'

interface ResumePrompt {
  readonly state: 'loading' | 'ready' | 'incompatible'
  readonly title: string
  readonly description: string
  readonly pointer?: CriticalCareResumePointer
}

interface LessonSimulationSession {
  readonly simulation: VentilationSimulationState
  readonly evidence: readonly string[]
  readonly variant: VentilationLessonVariant
}

type LessonSimulationSessionAction =
  | { readonly type: 'DISPATCH'; readonly action: VentilationAction }
  | {
      readonly type: 'LOAD_VARIANT'
      readonly runtime: VentilationLessonRuntimeDefinition
      readonly variant: VentilationLessonVariant
      readonly attempt: number
    }
  | { readonly type: 'CLEAR_EVIDENCE' }

function lessonActivityId(lessonId: string): string {
  return `ventilation:learn:${lessonId}`
}

function lessonCheckpoint(phase: CriticalCareActivityPhase): string {
  return `lesson-${phase}`
}

function phaseFromCheckpoint(checkpointId: string | undefined): CriticalCareActivityPhase | null {
  if (!checkpointId?.startsWith('lesson-')) return null
  const phase = checkpointId.slice('lesson-'.length)
  return criticalCareActivityPhases.includes(phase as CriticalCareActivityPhase)
    ? (phase as CriticalCareActivityPhase)
    : null
}

function runtimeForLesson(lessonId: string): VentilationLessonRuntimeDefinition {
  const runtime = ventilationLessonRuntimeById.get(lessonId)
  if (!runtime) throw new Error(`Missing mechanical-ventilation lesson runtime: ${lessonId}`)
  return runtime
}

function itemsForLesson(lessonId: string): {
  prediction: ClinicalLearningItem
  transfer: ClinicalLearningItem
} {
  const items = mechanicalVentilationLessonItems[lessonId as MechanicalVentilationLessonId]
  if (!items) throw new Error(`Missing mechanical-ventilation learning items: ${lessonId}`)
  return items
}

function createLessonSession(
  runtime: VentilationLessonRuntimeDefinition,
  variant: VentilationLessonVariant,
  attempt: number,
): LessonSimulationSession {
  const definition = runtime[variant]
  const initial = createInitialSimulationState(definition.caseId, 'learn', attempt, 'hamilton-c6')
  return {
    // Open on a running ventilator. The shared initializer pauses after priming four seconds of
    // waveform, which froze every lesson at 0 s — and a maneuver such as an inspiratory hold only
    // teaches its point when it interrupts a vent that is actually cycling.
    simulation: { ...initial, paused: false },
    evidence: [],
    variant,
  }
}

function lessonSessionReducer(
  session: LessonSimulationSession,
  action: LessonSimulationSessionAction,
): LessonSimulationSession {
  if (action.type === 'LOAD_VARIANT') {
    return createLessonSession(action.runtime, action.variant, action.attempt)
  }
  if (action.type === 'CLEAR_EVIDENCE') {
    return { ...session, evidence: [] }
  }
  const simulation = ventilationSimulationReducer(session.simulation, action.action)
  const evidence = ventilationLessonActionEvidence(action.action, session.simulation, simulation)
  return {
    ...session,
    simulation,
    evidence: evidence ? [...session.evidence, evidence] : session.evidence,
  }
}

function evidenceLabel(evidence: string): string {
  const labels: Readonly<Record<string, string>> = {
    'intervention:assess-patient': 'Bedside evaluation recorded',
    'intervention:review-waveforms': 'Pressure, flow, volume, and effort reviewed',
    'intervention:inspect-circuit': 'Airway and circuit inspected',
    'intervention:disconnect-bag': 'Trapped gas release and supported ventilation performed',
    'intervention:communication-board': 'Communication method established',
    'intervention:treat-pain': 'Reversible pain addressed',
    'intervention:communicate-plan': 'Plan and reassessment closed loop',
    'hold:inspiratory': 'Inspiratory hold completed',
    'hold:expiratory': 'Expiratory hold completed',
    'mode:confirmed': 'Comparison mode confirmed',
    'waveforms:frozen': 'Multitrace display frozen',
    'control:triggerThreshold': 'Trigger threshold changed',
    'control:etsPercent': 'Cycling threshold changed',
    'control:ratePerMin': 'Mandatory breath timing changed',
    'control:pRampMs': 'Pressurization rise time changed',
    'control:peepCmH2O': 'PEEP changed',
    'breath:stepped': 'Post-action breath generated',
  }
  return labels[evidence] ?? 'Required case action completed'
}

function LearningItemChoices({
  item,
  selected,
  disabled,
  name,
  onSelect,
}: {
  readonly item: ClinicalLearningItem
  readonly selected: string | null
  readonly disabled?: boolean
  readonly name: string
  readonly onSelect: (choiceId: string) => void
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-semibold leading-6">{item.stem}</legend>
      {item.choices.map((choice) => (
        <label
          key={choice.id}
          className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm leading-5"
        >
          <input
            type="radio"
            className="mt-1"
            name={name}
            checked={selected === choice.id}
            disabled={disabled}
            onChange={() => onSelect(choice.id)}
          />
          <span>{choice.label}</span>
        </label>
      ))}
    </fieldset>
  )
}

function GuidedActions({
  actions,
  state,
  evidence,
  requirements,
  disabled,
  onAction,
}: {
  readonly actions: readonly VentilationLessonGuidedAction[]
  readonly state: VentilationSimulationState
  readonly evidence: readonly string[]
  readonly requirements: readonly string[]
  readonly disabled?: boolean
  readonly onAction: (action: VentilationLessonGuidedAction) => void
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            className="min-h-11 rounded-xl border bg-background px-3 py-2.5 text-left text-sm font-semibold disabled:opacity-50"
            onClick={() => onAction(action)}
          >
            <span className="block">{action.label}</span>
            <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
              {action.description}
            </span>
          </button>
        ))}
      </div>
      <ul className="grid gap-1.5" aria-label="Required interaction evidence">
        {requirements.map((requirement) => {
          const met = evidence.includes(requirement)
          return (
            <li
              key={requirement}
              className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
            >
              {met ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              )}
              {evidenceLabel(requirement)}
            </li>
          )
        })}
      </ul>
      <p className="sr-only" aria-live="polite">
        {requirements.filter((requirement) => evidence.includes(requirement)).length} of{' '}
        {requirements.length} required interactions complete for case {state.caseId}.
      </p>
    </div>
  )
}

const ventilationLearningPathway = criticalCareLearningPathway('mechanical-ventilation')

export function MechanicalVentilationLessonActivity({
  lesson,
  locale = 'en',
}: {
  readonly lesson: VentilationLessonDefinition
  readonly locale?: string
}) {
  const router = useRouter()
  const runtime = runtimeForLesson(lesson.id)
  const learningItems = itemsForLesson(lesson.id)
  const activityId = lessonActivityId(lesson.id)
  const catalogActivity = criticalCareActivityById.get(activityId)
  const query = useMemo(() => ({ activity: lesson.id }), [lesson.id])
  const [phase, setPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [predictionChoice, setPredictionChoice] = useState<string | null>(null)
  const [predictionCommitted, setPredictionCommitted] = useState(false)
  const [transferChoice, setTransferChoice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [hintVisible, setHintVisible] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [storageMessage, setStorageMessage] = useState<string | null>(null)
  const [resumePrompt, setResumePrompt] = useState<ResumePrompt | null>({
    state: 'loading',
    title: 'Checking saved work',
    description: 'Validating the saved lesson checkpoint.',
  })
  const attemptNumber = useRef(1)
  const [session, dispatchSession] = useReducer(lessonSessionReducer, undefined, () =>
    createLessonSession(runtime, 'primary', 1),
  )
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-ventilation',
    activityId,
    mode: 'guided',
    phase,
  })

  const dispatchSimulation = useCallback<Dispatch<VentilationAction>>(
    (action) => dispatchSession({ type: 'DISPATCH', action }),
    [],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const envelope = readCriticalCareProgress(window.localStorage)
      const existing = envelope.activities.find((activity) => activity.activityId === activityId)
      attemptNumber.current = (existing?.attempts ?? 0) + 1
      const pointer = envelope.resume
      if (!pointer || pointer.activityId !== activityId) {
        setResumePrompt(null)
        return
      }
      const restoredPhase = phaseFromCheckpoint(pointer.checkpointId)
      const compatible =
        pointer.pathname === PATHNAME &&
        pointer.query?.activity === lesson.id &&
        pointer.mode === 'guided' &&
        pointer.payloadVersion === PAYLOAD_VERSION &&
        restoredPhase === pointer.phase
      setResumePrompt(
        compatible
          ? {
              state: 'ready',
              title: `Resume ${lesson.title} at ${pointer.phase}`,
              description:
                'The authored phase is compatible. The patient starts from that phase’s clean preset; prior answers and case actions were not stored.',
              pointer,
            }
          : {
              state: 'incompatible',
              title: 'Saved lesson needs a safe restart',
              description:
                'The saved version or checkpoint no longer matches this lesson. No answer or clinical state will be guessed.',
            },
      )
    }, 0)
    return () => window.clearTimeout(timer)
  }, [activityId, lesson.id, lesson.title])

  const evidenceEntries = useMemo(() => {
    const ids = new Set([
      ...lesson.evidenceIds,
      ...learningItems.prediction.evidenceIds,
      ...learningItems.transfer.evidenceIds,
    ])
    return [...ids].flatMap((id) => {
      const evidence = ventilationEvidenceById.get(id)
      return evidence
        ? [
            {
              id: evidence.id,
              title: evidence.title,
              sourceLabel: evidence.citation,
              limitation: evidence.limitations,
            },
          ]
        : []
    })
  }, [learningItems.prediction.evidenceIds, learningItems.transfer.evidenceIds, lesson.evidenceIds])

  const simulation = session.simulation
  const definition = mechanicalVentilationCaseById.get(simulation.caseId)
  if (!definition) throw new Error(`Missing lesson case definition: ${simulation.caseId}`)
  const profile = getVentilatorDeviceProfile(simulation.deviceId)
  const activeRuntime = runtime[session.variant]

  function persistCheckpoint(
    nextPhase: CriticalCareActivityPhase,
    options: { completed?: boolean; addHint?: boolean } = {},
  ) {
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    const existing = envelope.activities.find((activity) => activity.activityId === activityId)
    const activityDefinition = criticalCareActivityById.get(activityId)
    if (!activityDefinition) return
    const requestedStatus = options.completed ? 'completed' : 'in-progress'
    const authoritativeStatus = authoritativeCriticalCareStatus(activityDefinition, requestedStatus)
    const pointer: CriticalCareResumePointer = {
      activityId,
      pathname: PATHNAME,
      query,
      mode: 'guided',
      phase: nextPhase,
      checkpointId: lessonCheckpoint(nextPhase),
      payloadVersion: PAYLOAD_VERSION,
      updatedAt: now,
    }
    let next = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId,
        status: authoritativeStatus,
        currentPhase: nextPhase,
        mode: 'guided',
        attempts: Math.max(attemptNumber.current, existing?.attempts ?? 0),
        hintCount: (existing?.hintCount ?? 0) + (options.addHint ? 1 : 0),
        competencyEvidenceIds: authoritativeCriticalCareCompetencyEvidence(
          activityDefinition,
          options.completed ? activityDefinition.competencyIds : [],
        ),
        updatedAt: now,
      },
      authoritativeStatus === 'completed' || authoritativeStatus === 'mastered'
        ? undefined
        : pointer,
    )
    if (authoritativeStatus === 'completed' || authoritativeStatus === 'mastered') {
      next = withoutCriticalCareResumePointer(next, activityId)
    }
    const stored = writeCriticalCareProgress(window.localStorage, next)
    setStorageMessage(
      stored
        ? options.completed && authoritativeStatus === 'in-progress'
          ? 'Draft review saved as in progress. It does not make a claim about clinical readiness.'
          : options.completed
            ? 'Lesson completion saved on this device.'
            : 'Lesson checkpoint saved on this device.'
        : 'Progress could not be stored on this device. You can continue this session.',
    )
  }

  function advance(nextPhase: CriticalCareActivityPhase) {
    setPhase(nextPhase)
    setHintVisible(false)
    setFeedback(null)
    persistCheckpoint(nextPhase)
  }

  function resetLesson() {
    setPhase('recognize')
    setPredictionChoice(null)
    setPredictionCommitted(false)
    setTransferChoice(null)
    setFeedback(null)
    setHintVisible(false)
    setCompleted(false)
    dispatchSession({
      type: 'LOAD_VARIANT',
      runtime,
      variant: 'primary',
      attempt: attemptNumber.current,
    })
    const envelope = readCriticalCareProgress(window.localStorage)
    writeCriticalCareProgress(
      window.localStorage,
      withoutCriticalCareResumePointer(envelope, activityId),
    )
    setStorageMessage('Lesson reset to the clean primary patient preset.')
  }

  function saveAndExit() {
    persistCheckpoint(phase)
    router.push('/mechanical-ventilation/learn' as Route)
  }

  function restore(pointer: CriticalCareResumePointer) {
    const restoredPhase = phaseFromCheckpoint(pointer.checkpointId)
    if (!restoredPhase) return
    const variant = restoredPhase === 'transfer' ? 'transfer' : 'primary'
    dispatchSession({
      type: 'LOAD_VARIANT',
      runtime,
      variant,
      attempt: attemptNumber.current,
    })
    setPhase(restoredPhase)
    setPredictionCommitted(restoredPhase !== 'recognize' && restoredPhase !== 'predict')
    setResumePrompt(null)
    setStorageMessage(
      'Authored phase restored with a clean patient preset. Prior choices and actions were not retained.',
    )
  }

  function startSafe() {
    const envelope = readCriticalCareProgress(window.localStorage)
    writeCriticalCareProgress(
      window.localStorage,
      withoutCriticalCareResumePointer(envelope, activityId),
    )
    dispatchSession({
      type: 'LOAD_VARIANT',
      runtime,
      variant: 'primary',
      attempt: attemptNumber.current,
    })
    setPhase('recognize')
    setResumePrompt(null)
  }

  function showHint() {
    if (!hintVisible) {
      persistCheckpoint(phase, { addHint: true })
      lifecycleAnalytics.recordHintUsed()
    }
    setHintVisible(true)
  }

  function performGuidedAction(action: VentilationLessonGuidedAction) {
    dispatchSimulation(action.resolve(simulation))
  }

  function toggleRunning() {
    dispatchSimulation({ type: 'SET_PAUSED', paused: !simulation.paused })
  }

  function runResponse(seconds: number) {
    // Fast-forward the modeled response, then restore whatever run state the learner had chosen
    // rather than always leaving the ventilator stopped.
    const wasPaused = simulation.paused
    dispatchSimulation({ type: 'SET_PAUSED', paused: false })
    dispatchSimulation({ type: 'TICK', seconds })
    if (wasPaused) dispatchSimulation({ type: 'SET_PAUSED', paused: true })
  }

  function commitPrediction() {
    if (!predictionChoice) return
    setPredictionCommitted(true)
    lifecycleAnalytics.recordPredictionSubmitted()
    dispatchSession({ type: 'CLEAR_EVIDENCE' })
    advance('act')
    setFeedback('Initial frame recorded. Compare it with the multitrace response below.')
  }

  function finishPrimaryAction() {
    if (!hasVentilationLessonEvidence(session.evidence, runtime.primary.requiredEvidence)) {
      return
    }
    runResponse(runtime.primary.responseSeconds)
    dispatchSession({ type: 'CLEAR_EVIDENCE' })
    lifecycleAnalytics.recordGoalMet()
    advance('observe')
  }

  function openDebrief() {
    if (!hasVentilationLessonEvidence(session.evidence, ventilationLessonObservationEvidence)) {
      return
    }
    lifecycleAnalytics.recordDebriefViewed()
    advance('explain')
  }

  function beginTransfer() {
    dispatchSession({
      type: 'LOAD_VARIANT',
      runtime,
      variant: 'transfer',
      attempt: attemptNumber.current + 1,
    })
    setTransferChoice(null)
    advance('transfer')
  }

  function completeTransfer() {
    if (!transferChoice) return
    const actionsComplete = hasVentilationLessonEvidence(
      session.evidence,
      runtime.transfer.requiredEvidence,
    )
    if (!actionsComplete) {
      setFeedback(
        'The reasoning feedback is available now. Complete the paired bedside actions when you are ready to compare the modeled response.',
      )
      return
    }
    runResponse(runtime.transfer.responseSeconds)
    setFeedback('The interpretation and paired bedside actions are now in your local history.')
    setCompleted(true)
    persistCheckpoint('transfer', { completed: true })
    lifecycleAnalytics.recordTransferCompleted()
  }

  const recognitionComplete = hasVentilationLessonEvidence(
    session.evidence,
    ventilationLessonRecognitionEvidence,
  )
  const primaryActionComplete = hasVentilationLessonEvidence(
    session.evidence,
    runtime.primary.requiredEvidence,
  )
  const observationComplete = hasVentilationLessonEvidence(
    session.evidence,
    ventilationLessonObservationEvidence,
  )
  const transferActionsComplete = hasVentilationLessonEvidence(
    session.evidence,
    runtime.transfer.requiredEvidence,
  )
  const transferInterpretationCorrect = Boolean(
    transferChoice && learningItems.transfer.correctChoiceIds.includes(transferChoice),
  )
  const feedbackItem = phase === 'transfer' ? learningItems.transfer : learningItems.prediction
  const feedbackChoiceId = phase === 'transfer' ? transferChoice : predictionChoice
  const feedbackChoice = feedbackItem.choices.find((choice) => choice.id === feedbackChoiceId)

  function selectPhase(nextPhase: CriticalCareActivityPhase) {
    if (nextPhase === 'transfer' && session.variant !== 'transfer') {
      dispatchSession({
        type: 'LOAD_VARIANT',
        runtime,
        variant: 'transfer',
        attempt: attemptNumber.current + 1,
      })
      setTransferChoice(null)
    } else if (nextPhase !== 'transfer' && session.variant !== 'primary') {
      dispatchSession({
        type: 'LOAD_VARIANT',
        runtime,
        variant: 'primary',
        attempt: attemptNumber.current,
      })
    }
    advance(nextPhase)
  }
  // Learn previously advanced the clock only in bursts when an action completed, so the console
  // sat frozen at zero and read as a broken screen. Run it continuously while unpaused, matching
  // the Practice case activity.
  useEffect(() => {
    if (simulation.paused) return undefined
    const intervalMs = 100
    const timer = window.setInterval(
      () => dispatchSimulation({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [simulation.paused, dispatchSimulation])

  let controls = null
  if (phase === 'recognize') {
    controls = (
      <div className="grid gap-3">
        <GuidedActions
          actions={ventilationLessonRecognitionActions}
          state={simulation}
          evidence={session.evidence}
          requirements={ventilationLessonRecognitionEvidence}
          onAction={performGuidedAction}
        />
        <button
          type="button"
          disabled={!recognitionComplete}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={() => {
            dispatchSession({ type: 'CLEAR_EVIDENCE' })
            advance('predict')
          }}
        >
          Continue to prediction
        </button>
      </div>
    )
  } else if (phase === 'predict') {
    controls = (
      <div className="grid gap-3">
        <LearningItemChoices
          item={learningItems.prediction}
          selected={predictionChoice}
          name={`${lesson.id}-prediction`}
          onSelect={setPredictionChoice}
        />
        <button
          type="button"
          disabled={!predictionChoice}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={commitPrediction}
        >
          Commit prediction
        </button>
      </div>
    )
  } else if (phase === 'act') {
    controls = (
      <div className="grid gap-3">
        <GuidedActions
          actions={runtime.primary.actions}
          state={simulation}
          evidence={session.evidence}
          requirements={runtime.primary.requiredEvidence}
          onAction={performGuidedAction}
        />
        <button
          type="button"
          disabled={!primaryActionComplete}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={finishPrimaryAction}
        >
          Run the response and reassess
        </button>
      </div>
    )
  } else if (phase === 'observe') {
    controls = (
      <div className="grid gap-3">
        <GuidedActions
          actions={ventilationLessonObservationActions}
          state={simulation}
          evidence={session.evidence}
          requirements={ventilationLessonObservationEvidence}
          onAction={performGuidedAction}
        />
        <button
          type="button"
          disabled={!observationComplete}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={openDebrief}
        >
          Open the causal debrief
        </button>
      </div>
    )
  } else if (phase === 'explain') {
    controls = (
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        onClick={beginTransfer}
      >
        Load the transfer patient
      </button>
    )
  } else {
    controls = (
      <div className="grid gap-4">
        <LearningItemChoices
          item={learningItems.transfer}
          selected={transferChoice}
          disabled={completed}
          name={`${lesson.id}-transfer`}
          onSelect={setTransferChoice}
        />
        <GuidedActions
          actions={runtime.transfer.actions}
          state={simulation}
          evidence={session.evidence}
          requirements={runtime.transfer.requiredEvidence}
          disabled={completed}
          onAction={performGuidedAction}
        />
        <p className="rounded-xl bg-muted p-3 text-sm" aria-live="polite">
          {!transferChoice
            ? 'Choose an interpretation, then examine the transfer patient.'
            : transferInterpretationCorrect && transferActionsComplete
              ? 'The interpretation and bedside actions are ready to compare.'
              : transferInterpretationCorrect
                ? 'The interpretation fits the mechanism; complete the bedside actions before comparing the response.'
                : transferActionsComplete
                  ? 'The bedside actions are documented; revisit the mechanism before comparing the response.'
                  : 'Use the interpretation and bedside actions together before comparing the response.'}
        </p>
        <button
          type="button"
          disabled={!transferChoice || completed}
          className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          onClick={completeTransfer}
        >
          Review draft transfer
        </button>
      </div>
    )
  }

  if (resumePrompt) {
    return (
      <main className="mx-auto grid min-h-[34rem] w-full max-w-3xl place-items-center px-4 py-10">
        <ResumeBanner
          state={resumePrompt.state}
          title={resumePrompt.title}
          description={resumePrompt.description}
          onResume={resumePrompt.pointer ? () => restore(resumePrompt.pointer!) : undefined}
          onStartSafe={startSafe}
        />
      </main>
    )
  }

  const phaseCopy = lesson.phases[phase]
  const nextSection = nextPathwaySection(ventilationLearningPathway, lesson.id)
  // Every section gets a middle pane. Sections without a bespoke figure show their own authored
  // objectives rather than an empty pane, which read as an unbuilt module.
  const teachingPanel = hasVentilationTeachingPanel(lesson.id) ? (
    <MechanicalVentilationTeachingPanel lessonId={lesson.id} state={simulation} />
  ) : (
    <VentilationSectionOverview
      title={lesson.title}
      summary={lesson.summary}
      phaseCopy={criticalCareActivityPhases.map((lessonPhase) => ({
        phase: lessonPhase,
        objective: lesson.phases[lessonPhase].objective,
      }))}
      references={lesson.references}
    />
  )

  const viewport = (
    <div className="grid h-full min-h-0 content-start gap-3 overflow-auto bg-background p-3">
      <PathwayNav
        pathway={ventilationLearningPathway}
        label="Ventilation learning pathway"
        activeSectionId={lesson.id}
        onSelect={(sectionId) =>
          router.push(`/mechanical-ventilation/learn?activity=${sectionId}` as Route)
        }
      />
      <section
        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-card p-3"
        aria-label="Active lesson patient"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
            {session.variant === 'primary' ? 'Primary patient' : 'Transfer patient'} ·{' '}
            {definition.id}
          </p>
          <h2 className="mt-1 text-base font-semibold">{definition.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {definition.patientDescription}
          </p>
        </div>
        <p className="max-w-md rounded-lg bg-muted px-3 py-2 text-xs leading-5">
          <strong>Immediate goal:</strong> {activeRuntime.goal}
        </p>
      </section>

      {/*
       * Sections with an authored teaching panel get the three-pane workspace: live bedside, the
       * teaching panel that explains what is being taught, and the console the learner acts
       * through. Sections without one keep the two-pane layout rather than showing an empty pane.
       */}
      {/*
       * Pane order mirrors the hemodynamics workspace: the live device, then the teaching panel,
       * then the surface the learner acts through. The activity surface previously lived only in
       * the collapsible task panel, so at common viewports a learner saw a frozen console and
       * nothing to do.
       */}
      <div className="min-h-[40rem] overflow-hidden rounded-xl border">
        <ResizableTeachingWorkspace
          workspaceLabel="Resizable ventilator, teaching, and activity workspace"
          paneLabels={{ primary: 'Ventilator', secondary: 'Teaching', tertiary: 'Your turn' }}
          primary={
            <div className="min-w-0 p-2 [&>*]:m-0">
              <MechanicalVentilatorConsole
                key={`${simulation.caseId}:${simulation.ventilator.settings.deviceMode}`}
                state={simulation}
                dispatch={dispatchSimulation}
                controlsEnabled
              />
            </div>
          }
          secondary={teachingPanel}
          tertiary={
            // The workspace is a light surface; without re-rooting the theme here the Tailwind
            // tokens resolve from the shell's dark root and the enabled action buttons read as
            // greyed out.
            <div className={`${teachingStyles.activityPane} grid min-w-0 gap-3 p-2 [&>*]:m-0`}>
              <VentilationRunControl
                paused={simulation.paused}
                simulationTime={simulation.simulationTime}
                onToggle={toggleRunning}
                onStepBreath={() => dispatchSimulation({ type: 'STEP_BREATH' })}
              />
              <section className="grid gap-2 rounded-xl border bg-card p-3" aria-label="Your turn">
                <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-primary">
                  Your turn · {phase}
                </p>
                <p className="text-sm font-semibold leading-5">{phaseCopy.objective}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {phaseCopy.requiredAction}
                </p>
                {controls}
              </section>
              <BedsidePanel state={simulation} definition={definition} compact />
            </div>
          }
        />
      </div>

      <dl
        className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 text-sm sm:grid-cols-4 xl:grid-cols-7"
        aria-label="Current lesson measurements"
      >
        {[
          ['Ppeak', `${simulation.measurements.peakPressureCmH2O.toFixed(0)} cmH₂O`],
          ['Pplat', `${simulation.measurements.plateauPressureCmH2O.toFixed(0)} cmH₂O`],
          ['VTE', `${simulation.measurements.exhaledVtMl.toFixed(0)} mL`],
          ['Intrinsic PEEP', `${simulation.measurements.intrinsicPeepCmH2O.toFixed(1)} cmH₂O`],
          ['SpO₂', `${simulation.patient.gasExchange.spo2Percent.toFixed(0)}%`],
          ['PaCO₂', `${simulation.patient.gasExchange.paCO2MmHg.toFixed(0)} mm Hg`],
          ['MAP', `${simulation.patient.hemodynamics.mapMmHg.toFixed(0)} mm Hg`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {phase === 'explain' ? (
        <DebriefPanel
          clinicalModel={
            predictionCommitted
              ? learningItems.prediction.explanation
              : 'The prediction checkpoint was restored without retaining the prior answer.'
          }
          actions={[runtime.primary.goal]}
          consequences={[
            simulation.lastResponse ??
              'Compare the post-action patient and multitrace measurements with baseline.',
          ]}
          performanceDomains={[
            { label: 'Recognition', result: lesson.phases.recognize.teachingPoint },
            { label: 'Mechanism', result: learningItems.prediction.explanation },
            { label: 'Reassessment', result: lesson.phases.observe.requiredAction },
          ]}
          transfer={<p>{learningItems.transfer.stem}</p>}
        />
      ) : null}
    </div>
  )

  return (
    <SimulationLaunchGate
      activityTitle={lesson.title}
      minimumViewport="tablet"
      bandwidthClass="standard"
      estimatedSizeLabel="Interactive patient, ventilator console, and synchronized waveforms"
      lightweightAlternativeHref="/mechanical-ventilation/learn"
      onSaveForLater={saveAndExit}
      theme="dark"
    >
      {locale !== 'en' ? (
        <div className="sr-only" role="status">
          <Languages aria-hidden="true" /> Reviewed-English fallback: localized clinical review is
          pending.
        </div>
      ) : null}
      <ActivityShell
        layout="native-workbench"
        activityId={activityId}
        assumedConceptIds={catalogActivity?.assumedConceptIds}
        breadcrumb={
          <span>
            <Link href={'/mechanical-ventilation' as Route}>Mechanical Ventilation</Link> /{' '}
            <Link href={'/mechanical-ventilation/learn' as Route}>Learn</Link> / {lesson.domain}
          </span>
        }
        activityTitle={lesson.title}
        phase={phase}
        mode="guided"
        onPhaseSelect={selectPhase}
        progressLabel={completed ? 'Draft reviewed · non-credit' : `Current phase: ${phase}`}
        patientContext={
          <PatientContextBar
            title={`${session.variant === 'primary' ? 'Primary' : 'Transfer'} clinical context`}
            items={[
              { label: 'Patient', value: definition.patientDescription },
              { label: 'Console', value: profile.displayName },
              { label: 'Mode', value: simulation.ventilator.settings.deviceMode },
              { label: 'Case', value: definition.id },
              { label: 'Review status', value: 'SME review · non-credit' },
            ]}
            immediateGoal={activeRuntime.goal}
            safetyConstraints={[
              'Reason from the patient and synchronized signals before changing support.',
              'Synthetic responses are educational approximations and cannot guide care.',
            ]}
          />
        }
        viewport={viewport}
        currentTask={
          <TaskPanel
            objective={phaseCopy.objective}
            requiredAction={phaseCopy.requiredAction}
            targets={[phaseCopy.teachingPoint]}
            hint={phaseCopy.teachingPoint}
            mode="guided"
            hintVisible={hintVisible}
            onHintRequested={showHint}
          >
            {/* Actions live in the workspace "Your turn" pane; the task panel keeps the framing. */}
            {feedback ? (
              <div className="mt-3 grid gap-3">
                <p className="rounded-xl bg-muted p-3 text-sm leading-6" role="status">
                  {feedback}
                </p>
                {feedbackChoice ? (
                  <ChoiceReasoningFeedback
                    choice={feedbackChoice}
                    explanation={feedbackItem.explanation}
                    evidenceIds={feedbackItem.evidenceIds}
                    conceptIds={catalogActivity?.teachesConceptIds}
                  />
                ) : null}
              </div>
            ) : null}
            {completed ? (
              <div className="mt-3">
                <PathwaySectionCompletion
                  sectionTitle={lesson.title}
                  {...(nextSection ? { nextTitle: nextSection.title } : {})}
                  endOfPathwayLabel="Continue to ventilation practice cases"
                  onRepeat={resetLesson}
                  onContinue={() =>
                    router.push(
                      (nextSection
                        ? `/mechanical-ventilation/learn?activity=${nextSection.id}`
                        : '/mechanical-ventilation/practice') as Route,
                    )
                  }
                />
              </div>
            ) : null}
          </TaskPanel>
        }
        bottomContent={
          storageMessage ??
          simulation.lastResponse ??
          `Checkpoint: ${lessonCheckpoint(phase)} · ${definition.id}`
        }
        secondaryActions={
          <>
            <ReferenceDrawer
              title={`${lesson.domain} reference`}
              entries={lesson.references.map((entry, index) => ({
                id: `${lesson.id}-${index}`,
                ...entry,
              }))}
              trigger={
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Reference
                </button>
              }
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={
                <button
                  type="button"
                  className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                >
                  Evidence
                </button>
              }
            />
          </>
        }
        onSaveAndExit={saveAndExit}
        onHelp={showHint}
        onReset={resetLesson}
        theme="dark"
      />
    </SimulationLaunchGate>
  )
}
