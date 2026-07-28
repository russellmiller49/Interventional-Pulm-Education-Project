'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Route } from 'next'
import { ArrowRight, CheckCircle2, Languages, ShieldAlert } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import {
  authoritativeCriticalCareCompetencyEvidence,
  authoritativeCriticalCareStatus,
  readCriticalCareProgress,
  upsertCriticalCareActivityProgress,
  useCriticalCareActivityAnalytics,
  withoutCriticalCareResumePointer,
  writeCriticalCareProgress,
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
  type CriticalCareResumePointer,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'

import {
  getVentilatorDeviceProfile,
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  selectVentilationTransferCaseId,
  ventilationEvidenceById,
  ventilationLessonActionEvidence,
  type VentilationEvidenceReference,
} from '../content'
import {
  MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION,
  clearMechanicalVentilationSession,
  createInitialSimulationState,
  createMechanicalVentilationSession,
  isVentilationReplayAction,
  nextCaseAttempt,
  readMechanicalVentilationSession,
  readProgress,
  recordCaseResult,
  replayMechanicalVentilationSession,
  selectCaseOutcome,
  ventilationSimulationReducer,
  writeMechanicalVentilationSession,
  writeProgress,
  type CaseOutcome,
  type LearningExperience,
  type MechanicalVentilationProgressV2,
  type VentilationAction,
  type VentilationCaseDefinition,
  type VentilationReplayEvent,
  type VentilationSimulationState,
  type VentilatorDeviceId,
} from '../engine'
import { BedsidePanel } from './BedsidePanel'
import { CaseWorkflow } from './CaseWorkflow'
import { MechanicalVentilatorConsole } from './MechanicalVentilatorConsole'
import styles from './mechanical-ventilation-v2.module.css'

const MODULE_ID = 'mechanical-ventilation'
const MAX_REPLAY_EVENTS = 512
const TRANSFER_SAFE_PAYLOAD_VERSION = 'ventilation-transfer-safe-v1'

export type VentilationCaseSection = 'practice' | 'assess'

export interface MechanicalVentilationCaseActivityV2Props {
  readonly locale?: string
  readonly caseId: string
  readonly deviceId: VentilatorDeviceId
  readonly mode: CriticalCareActivityMode
  readonly section: VentilationCaseSection
  readonly seedToken?: string
}

interface CaseBootstrap {
  readonly state: VentilationSimulationState
  readonly progress: MechanicalVentilationProgressV2
  readonly attempt: number
  readonly normalizedAttempt: number
  readonly events: readonly VentilationReplayEvent[]
  readonly activityPhase: CriticalCareActivityPhase
  readonly restored: boolean
  readonly message: string | null
}

interface TransferSession {
  readonly state: VentilationSimulationState
  readonly evidence: readonly string[]
}

type TransferSessionAction =
  | { readonly type: 'DISPATCH'; readonly action: VentilationAction }
  | {
      readonly type: 'LOAD'
      readonly caseId: string
      readonly attempt: number
      readonly masked: boolean
      readonly deviceId: VentilatorDeviceId
    }

function createTransferSession(
  caseId: string,
  attempt: number,
  masked: boolean,
  deviceId: VentilatorDeviceId,
): TransferSession {
  const state = createInitialSimulationState(caseId, 'learn', attempt, deviceId)
  return {
    state: { ...state, showEducatorOverlay: !masked },
    evidence: [],
  }
}

function transferSessionReducer(
  session: TransferSession,
  action: TransferSessionAction,
): TransferSession {
  if (action.type === 'LOAD') {
    return createTransferSession(action.caseId, action.attempt, action.masked, action.deviceId)
  }
  const state = ventilationSimulationReducer(session.state, action.action)
  const evidence = ventilationLessonActionEvidence(action.action, session.state, state)
  return {
    state,
    evidence: evidence ? [...session.evidence, evidence] : session.evidence,
  }
}

const requiredTransferEvidence = [
  'intervention:assess-patient',
  'intervention:review-waveforms',
] as const

function TransferFollowUp({
  definition,
  selectedMechanismId,
  evidence,
  feedback,
  completed,
  onMechanismSelected,
  onAction,
}: {
  readonly definition: VentilationCaseDefinition
  readonly selectedMechanismId: string
  readonly evidence: readonly string[]
  readonly feedback: string | null
  readonly completed: boolean
  readonly onMechanismSelected: (mechanismId: string) => void
  readonly onAction: (action: VentilationAction) => void
}) {
  const bedsideReviewRecorded = evidence.includes('intervention:assess-patient')
  const waveformsReviewed = evidence.includes('intervention:review-waveforms')
  return (
    <TaskPanel
      objective="Localize the mechanism in a contrasting live patient."
      requiredAction="Select one mechanism, record a bedside review, and document multitrace review."
      targets={[
        'Use one interpretation and two performed review actions to make the transfer reasoning visible.',
      ]}
      hint="Use the displayed patient, pressure, flow, volume, effort, and measurements. Do not carry the prior case mechanism forward by default."
      mode="challenge"
      hintVisible={false}
    >
      <div className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold leading-6">
            A different ventilated patient now has the findings and waveforms shown. Which mechanism
            best accounts for this pattern?
          </legend>
          {definition.mechanismOptions.map((option) => (
            <label
              key={option.id}
              className="flex min-h-11 items-start gap-3 rounded-xl border p-3 text-sm"
            >
              <input
                type="radio"
                className="mt-1"
                name="ventilation-transfer-mechanism"
                checked={selectedMechanismId === option.id}
                disabled={completed}
                onChange={() => onMechanismSelected(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2">
          <button
            type="button"
            disabled={bedsideReviewRecorded || completed}
            className={styles.bottomUtility}
            onClick={() =>
              onAction({ type: 'PERFORM_INTERVENTION', interventionId: 'assess-patient' })
            }
          >
            {bedsideReviewRecorded ? 'Bedside review recorded' : 'Record bedside review'}
          </button>
          <button
            type="button"
            disabled={waveformsReviewed || completed}
            className={styles.bottomUtility}
            onClick={() =>
              onAction({ type: 'PERFORM_INTERVENTION', interventionId: 'review-waveforms' })
            }
          >
            {waveformsReviewed ? 'Multitrace review documented' : 'Document multitrace review'}
          </button>
        </div>
        <p className="rounded-xl bg-muted p-3 text-sm" aria-live="polite">
          Transfer inputs:{' '}
          {selectedMechanismId ? 'interpretation recorded' : 'choose an interpretation'}
          {' · '}
          {bedsideReviewRecorded ? 'bedside review recorded' : 'bedside review pending'}
          {' · '}
          {waveformsReviewed ? 'multitrace review recorded' : 'multitrace review pending'}
        </p>
        {feedback ? (
          <p
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
            role="status"
          >
            {feedback}
          </p>
        ) : null}
      </div>
    </TaskPanel>
  )
}

function engineExperience(mode: CriticalCareActivityMode): LearningExperience {
  return mode === 'guided' ? 'learn' : 'practice'
}

function activityId(section: VentilationCaseSection, caseId: string): string {
  return section === 'assess'
    ? 'ventilation:assess:masked-seeded'
    : `ventilation:practice:${caseId}`
}

function activityPathname(section: VentilationCaseSection): string {
  return `/mechanical-ventilation/${section}`
}

function activityQuery({
  section,
  caseId,
  deviceId,
  mode,
  seedToken,
}: MechanicalVentilationCaseActivityV2Props): Readonly<Record<string, string>> {
  return section === 'assess'
    ? {
        case: caseId,
        seed: seedToken ?? 'assessment-v1',
        device: deviceId,
      }
    : { case: caseId, device: deviceId, mode }
}

function pointerIdentityMatches(
  pointer: CriticalCareResumePointer | undefined,
  expectedActivityId: string,
  pathname: string,
  query: Readonly<Record<string, string>>,
  mode: CriticalCareActivityMode,
): boolean {
  return Boolean(
    pointer &&
    pointer.activityId === expectedActivityId &&
    pointer.pathname === pathname &&
    pointer.mode === mode &&
    Object.entries(query).every(([key, value]) => pointer.query?.[key] === value),
  )
}

function pointerMatches(
  pointer: CriticalCareResumePointer | undefined,
  expectedActivityId: string,
  pathname: string,
  query: Readonly<Record<string, string>>,
  mode: CriticalCareActivityMode,
): boolean {
  return Boolean(
    pointerIdentityMatches(pointer, expectedActivityId, pathname, query, mode) &&
    pointer?.payloadVersion === MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION,
  )
}

function bootstrapCase(props: MechanicalVentilationCaseActivityV2Props): CaseBootstrap {
  const progress = readProgress()
  const expectedActivityId = activityId(props.section, props.caseId)
  const pathname = activityPathname(props.section)
  const query = activityQuery(props)
  const envelope = readCriticalCareProgress(window.localStorage)
  const normalized = envelope.activities.find((item) => item.activityId === expectedActivityId)
  const storedSession = readMechanicalVentilationSession(window.localStorage)
  const resumeCompatible = pointerMatches(
    envelope.resume,
    expectedActivityId,
    pathname,
    query,
    props.mode,
  )
  const transferSafeCompatible = Boolean(
    pointerIdentityMatches(envelope.resume, expectedActivityId, pathname, query, props.mode) &&
    envelope.resume?.payloadVersion === TRANSFER_SAFE_PAYLOAD_VERSION &&
    envelope.resume.phase === 'transfer' &&
    envelope.resume.checkpointId === 'transfer-clean-variant',
  )
  const sessionCompatible = Boolean(
    storedSession &&
    storedSession.activityId === expectedActivityId &&
    storedSession.caseId === props.caseId &&
    storedSession.deviceId === props.deviceId &&
    storedSession.activityMode === props.mode &&
    storedSession.experience === engineExperience(props.mode),
  )

  if ((resumeCompatible || transferSafeCompatible) && storedSession && sessionCompatible) {
    const restored = replayMechanicalVentilationSession(storedSession)
    if (restored) {
      return {
        state:
          props.mode === 'challenge'
            ? ventilationSimulationReducer(restored, {
                type: 'SET_CHALLENGE_MODE',
                challengeMode: 'timed',
              })
            : restored,
        progress,
        attempt: storedSession.attempt,
        normalizedAttempt: Math.max(normalized?.attempts ?? 1, 1),
        events: storedSession.events,
        activityPhase: transferSafeCompatible ? 'transfer' : storedSession.activityPhase,
        restored: true,
        message: transferSafeCompatible
          ? 'The primary case was reconstructed exactly. The transfer patient restarted from its authored clean preset because partial transfer responses are not stored.'
          : 'Exact semantic checkpoint restored. High-frequency waveform arrays were regenerated, not stored.',
      }
    }
  }

  const attempt = nextCaseAttempt(progress, props.caseId, props.deviceId)
  let state = createInitialSimulationState(
    props.caseId,
    engineExperience(props.mode),
    attempt,
    props.deviceId,
  )
  if (props.mode === 'challenge') {
    state = ventilationSimulationReducer(state, {
      type: 'SET_CHALLENGE_MODE',
      challengeMode: 'timed',
    })
  }
  return {
    state,
    progress,
    attempt,
    normalizedAttempt: (normalized?.attempts ?? 0) + 1,
    events: [],
    activityPhase: 'recognize',
    restored: false,
    message:
      envelope.resume?.activityId === expectedActivityId
        ? 'The saved replay was incompatible or incomplete, so this attempt restarted from the authored clean case.'
        : null,
  }
}

function appendReplayEvent(
  current: readonly VentilationReplayEvent[],
  event: VentilationReplayEvent,
): readonly VentilationReplayEvent[] | null {
  const previous = current.at(-1)
  if (
    previous?.action.type === 'SET_CONTROL' &&
    event.action.type === 'SET_CONTROL' &&
    previous.action.control === event.action.control
  ) {
    return [...current.slice(0, -1), event]
  }
  if (current.length >= MAX_REPLAY_EVENTS) return null
  return [...current, event]
}

function evidenceEntry(reference: VentilationEvidenceReference) {
  return {
    id: reference.id,
    title: reference.title,
    sourceLabel: reference.citation,
    limitation: reference.limitations,
  }
}

export default function MechanicalVentilationCaseActivityV2(
  props: MechanicalVentilationCaseActivityV2Props,
) {
  const { locale = 'en', caseId, deviceId, mode, section, seedToken } = props
  // Challenge identity, sources, and patient context remain visible; the local seed only varies the
  // case selection.
  const maskedAssessment = false
  const transferCaseId = selectVentilationTransferCaseId(caseId) ?? caseId
  const router = useRouter()
  const [bootstrap] = useState(() => bootstrapCase(props))
  const [state, coreDispatch] = useReducer(
    ventilationSimulationReducer,
    bootstrap.state,
    (initial) => initial,
  )
  const [progress, setProgress] = useState(bootstrap.progress)
  const [events, setEvents] = useState<readonly VentilationReplayEvent[]>(bootstrap.events)
  const [activityPhase, setActivityPhase] = useState<CriticalCareActivityPhase>(
    bootstrap.activityPhase,
  )
  const [outcome, setOutcome] = useState<CaseOutcome | null>(null)
  const [completed, setCompleted] = useState(false)
  const [storageMessage, setStorageMessage] = useState<string | null>(bootstrap.message)
  const [replayOverflow, setReplayOverflow] = useState(false)
  const [resetVersion, setResetVersion] = useState(0)
  const [transferMechanismId, setTransferMechanismId] = useState('')
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null)
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false)
  const [transferSession, dispatchTransferSession] = useReducer(
    transferSessionReducer,
    undefined,
    () => createTransferSession(transferCaseId, bootstrap.attempt + 1, maskedAssessment, deviceId),
  )
  const stateRef = useRef(state)
  const eventsRef = useRef(events)
  const activityPhaseRef = useRef(activityPhase)
  const progressRef = useRef(progress)
  const outcomeRef = useRef(outcome)
  const attemptRef = useRef(bootstrap.attempt)
  const normalizedAttemptRef = useRef(bootstrap.normalizedAttempt)
  const lastAudibleAlarm = useRef<string | null>(null)
  const recordedSafetyEvents = useRef(new Set<string>())
  const transferCompletedRef = useRef(false)
  const persistRef = useRef<() => void>(() => undefined)

  const definition = mechanicalVentilationCaseById.get(caseId) ?? mechanicalVentilationCases[0]
  const transferDefinition =
    mechanicalVentilationCaseById.get(transferCaseId) ?? mechanicalVentilationCases[0]
  const profile = getVentilatorDeviceProfile(deviceId)
  const expectedActivityId = activityId(section, caseId)
  const catalogActivity = criticalCareActivityById.get(expectedActivityId)
  const pathname = activityPathname(section)
  const query = useMemo<Readonly<Record<string, string>>>(() => {
    if (section === 'assess') {
      const assessQuery: Readonly<Record<string, string>> = {
        case: caseId,
        seed: seedToken ?? 'assessment-v1',
        device: deviceId,
      }
      return assessQuery
    }
    const practiceQuery: Readonly<Record<string, string>> = {
      case: caseId,
      device: deviceId,
      mode,
    }
    return practiceQuery
  }, [caseId, deviceId, mode, section, seedToken])
  const {
    recordPredictionSubmitted: recordLifecyclePrediction,
    recordHintUsed: recordLifecycleHint,
    recordSafetyEvent: recordLifecycleSafetyEvent,
    recordGoalMet: recordLifecycleGoalMet,
    recordDebriefViewed: recordLifecycleDebrief,
    recordTransferCompleted: recordLifecycleTransfer,
    recordActivityCompleted: recordLifecycleActivityCompleted,
  } = useCriticalCareActivityAnalytics({
    moduleId: MODULE_ID,
    activityId: expectedActivityId,
    mode,
    phase: activityPhase,
  })
  const evidenceEntries = useMemo(
    () =>
      [...profile.sourceIds, 'supplied-casebook-2026', 'bounded-ventilation-model'].flatMap(
        (id) => {
          const reference = ventilationEvidenceById.get(id)
          return reference ? [evidenceEntry(reference)] : []
        },
      ),
    [profile.sourceIds],
  )

  const referenceEntries = useMemo(
    () =>
      maskedAssessment
        ? []
        : [
            ...definition.visibleFindings.map((finding, index) => ({
              id: `${caseId}-finding-${index}`,
              title: `Visible finding ${index + 1}`,
              summary: finding,
            })),
            {
              id: `${caseId}-run-tip`,
              title: 'Run tip',
              summary: definition.runTips,
            },
          ],
    [caseId, definition.runTips, definition.visibleFindings, maskedAssessment],
  )

  const transferReferenceEntries = useMemo(
    () =>
      maskedAssessment
        ? []
        : [
            ...transferDefinition.visibleFindings.map((finding, index) => ({
              id: `${transferCaseId}-finding-${index}`,
              title: `Transfer finding ${index + 1}`,
              summary: finding,
            })),
            {
              id: `${transferCaseId}-run-tip`,
              title: 'Transfer run tip',
              summary: transferDefinition.runTips,
            },
          ],
    [
      maskedAssessment,
      transferCaseId,
      transferDefinition.runTips,
      transferDefinition.visibleFindings,
    ],
  )

  const buildPointer = useCallback(
    (now: string): CriticalCareResumePointer => ({
      activityId: expectedActivityId,
      pathname,
      query,
      mode,
      phase: activityPhaseRef.current,
      scenarioId: caseId,
      deviceId,
      checkpointId: replayOverflow
        ? 'clean-case'
        : activityPhaseRef.current === 'transfer'
          ? 'transfer-clean-variant'
          : `semantic-${activityPhaseRef.current}`,
      payloadVersion: replayOverflow
        ? 'ventilation-clean-case-v1'
        : activityPhaseRef.current === 'transfer'
          ? TRANSFER_SAFE_PAYLOAD_VERSION
          : MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION,
      updatedAt: now,
    }),
    [caseId, deviceId, expectedActivityId, mode, pathname, query, replayOverflow],
  )

  const persistCurrent = useCallback(() => {
    const now = new Date().toISOString()
    const currentState = stateRef.current
    const envelope = readCriticalCareProgress(window.localStorage)
    const pointer = buildPointer(now)
    const next = upsertCriticalCareActivityProgress(
      envelope,
      {
        activityId: expectedActivityId,
        status: 'in-progress',
        currentPhase: activityPhaseRef.current,
        mode,
        attempts: normalizedAttemptRef.current,
        hintCount: currentState.hintsUsed,
        competencyEvidenceIds: [],
        updatedAt: now,
      },
      pointer,
    )
    const normalizedStored = writeCriticalCareProgress(window.localStorage, next)
    const sessionStored = replayOverflow
      ? false
      : writeMechanicalVentilationSession(
          window.localStorage,
          createMechanicalVentilationSession({
            activityId: expectedActivityId,
            state: currentState,
            activityMode: mode,
            activityPhase: activityPhaseRef.current,
            attempt: attemptRef.current,
            events: eventsRef.current,
            now,
          }),
        )
    return replayOverflow
      ? 'Replay reached its bounded action limit. Resume returns to the clean-case checkpoint.'
      : normalizedStored && sessionStored
        ? activityPhaseRef.current === 'transfer'
          ? 'The primary case was saved for exact reconstruction. Partial transfer answers are not stored; the transfer patient will restart clean.'
          : 'Exact semantic checkpoint saved on this device.'
        : 'Some optional resume data could not be stored. The current session can continue.'
  }, [buildPointer, expectedActivityId, mode, replayOverflow])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    activityPhaseRef.current = activityPhase
  }, [activityPhase])

  useEffect(() => {
    progressRef.current = progress
  }, [progress])

  useEffect(() => {
    outcomeRef.current = outcome
  }, [outcome])

  useEffect(() => {
    if (state.criticalErrors.length === 0) {
      recordedSafetyEvents.current.clear()
      return
    }
    for (const error of state.criticalErrors) {
      if (recordedSafetyEvents.current.has(error)) continue
      recordedSafetyEvents.current.add(error)
      recordLifecycleSafetyEvent()
    }
  }, [recordLifecycleSafetyEvent, state.criticalErrors])

  useEffect(() => {
    persistRef.current = persistCurrent
  }, [persistCurrent])

  useEffect(() => {
    const intervalMs = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 250 : 100
    const timer = window.setInterval(
      () => coreDispatch({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!state.ventilator.alarmAudioEnabled) return
    const alarm = state.alarms.find((item) => item.acknowledgedAt === undefined)
    const paused =
      state.ventilator.audioPausedUntil !== null &&
      state.ventilator.audioPausedUntil > state.simulationTime
    if (!alarm || paused || lastAudibleAlarm.current === alarm.id) return
    lastAudibleAlarm.current = alarm.id
    try {
      const context = new window.AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = alarm.priority === 'high' ? 880 : 620
      gain.gain.setValueAtTime(0.035, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.16)
      oscillator.addEventListener('ended', () => void context.close())
    } catch {
      // Browser audio permission must never interrupt visual alarm handling.
    }
  }, [
    state.alarms,
    state.simulationTime,
    state.ventilator.alarmAudioEnabled,
    state.ventilator.audioPausedUntil,
  ])

  useEffect(() => {
    persistCurrent()
  }, [activityPhase, events, persistCurrent, bootstrap.restored])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistRef.current()
    }
    window.addEventListener('pagehide', onVisibility)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onVisibility)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const dispatch = useCallback(
    (action: VentilationAction) => {
      if (isVentilationReplayAction(action)) {
        const appended = appendReplayEvent(eventsRef.current, {
          atSimulationSeconds: stateRef.current.simulationTime,
          action,
        })
        if (appended) {
          eventsRef.current = appended
          setEvents(appended)
        } else {
          setReplayOverflow(true)
        }
      }

      if (action.type === 'COMMIT_PREDICTION') {
        recordLifecyclePrediction()
        setActivityPhase('act')
      }
      if (
        activityPhaseRef.current === 'recognize' &&
        (action.type === 'STEP_BREATH' || (action.type === 'SET_PAUSED' && action.paused === false))
      ) {
        setActivityPhase('predict')
      }
      if (action.type === 'USE_HINT') {
        const currentState = stateRef.current
        const hintAvailable =
          currentState.experience === 'learn' ||
          (currentState.challengeMode === 'untimed' && currentState.simulationTime >= 60)
        if (hintAvailable) recordLifecycleHint()
      }
      if (action.type === 'COMMIT_REASSESSMENT') setActivityPhase('observe')
      if (action.type === 'REVEAL_DEBRIEF') {
        recordLifecycleDebrief()
        setActivityPhase('explain')
      }
      coreDispatch(action)
    },
    [recordLifecycleDebrief, recordLifecycleHint, recordLifecyclePrediction],
  )

  const dispatchTransfer = useCallback((action: VentilationAction) => {
    dispatchTransferSession({ type: 'DISPATCH', action })
  }, [])

  const handleResult = useCallback(
    (nextOutcome: CaseOutcome) => {
      setOutcome(nextOutcome)
      outcomeRef.current = nextOutcome
      if (mode === 'guided') return
      const nextProgress = recordCaseResult(progressRef.current, {
        caseId,
        deviceId,
        outcome: nextOutcome,
      })
      progressRef.current = nextProgress
      setProgress(nextProgress)
      writeProgress(nextProgress)
      if (nextOutcome.resolved) recordLifecycleGoalMet()
    },
    [caseId, deviceId, mode, recordLifecycleGoalMet],
  )

  function beginTransfer() {
    setTransferMechanismId('')
    setTransferFeedback(null)
    dispatchTransferSession({
      type: 'LOAD',
      caseId: transferCaseId,
      attempt: attemptRef.current + 1,
      masked: maskedAssessment,
      deviceId,
    })
    setActivityPhase('transfer')
  }

  function completeTransfer() {
    if (transferCompletedRef.current) return
    const assessmentComplete = requiredTransferEvidence.every((evidence) =>
      transferSession.evidence.includes(evidence),
    )
    if (!transferMechanismId || !assessmentComplete) {
      setTransferFeedback(
        'Complete the mechanism selection, bedside review, and multitrace review before submitting the follow-up.',
      )
      return
    }
    const frameAligned = transferMechanismId === transferDefinition.correctMechanismId
    setTransferFeedback(
      frameAligned
        ? `The displayed cues support that frame. ${transferDefinition.debrief}`
        : `That mechanism would produce a different multitrace pattern. Compare the effort, pressure, flow, and volume timing with the case debrief: ${transferDefinition.debrief}`,
    )
    const finalOutcome = outcomeRef.current ?? selectCaseOutcome(stateRef.current, definition)
    const activity = criticalCareActivityById.get(expectedActivityId)
    if (!activity) return
    transferCompletedRef.current = true
    const requestedStatus =
      mode === 'guided' ? 'completed' : finalOutcome.mastery ? 'mastered' : 'completed'
    const authoritativeStatus = authoritativeCriticalCareStatus(activity, requestedStatus)
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    let next = upsertCriticalCareActivityProgress(envelope, {
      activityId: expectedActivityId,
      status: authoritativeStatus,
      currentPhase: 'transfer',
      mode,
      ...(mode === 'guided' ? {} : { bestScore: finalOutcome.score }),
      attempts: normalizedAttemptRef.current,
      hintCount: stateRef.current.hintsUsed,
      competencyEvidenceIds: authoritativeCriticalCareCompetencyEvidence(
        activity,
        activity.competencyIds,
      ),
      updatedAt: now,
    })
    next = withoutCriticalCareResumePointer(next, expectedActivityId)
    writeCriticalCareProgress(window.localStorage, next)
    recordLifecycleTransfer()
    recordLifecycleActivityCompleted(mode !== 'guided' && finalOutcome.mastery)
    clearMechanicalVentilationSession(window.localStorage)
    setCompleted(true)
    setStorageMessage(
      mode === 'guided'
        ? `The guided case and transfer variant ${transferDefinition.id} were added to your local history.`
        : `This case and transfer variant ${transferDefinition.id} were added to your local history. Review the causal debrief before another run.`,
    )
  }

  function resetCase() {
    transferCompletedRef.current = false
    const nextAttempt = nextCaseAttempt(progressRef.current, caseId, deviceId)
    attemptRef.current = nextAttempt
    normalizedAttemptRef.current += 1
    let initial = createInitialSimulationState(
      caseId,
      engineExperience(mode),
      nextAttempt,
      deviceId,
    )
    if (mode === 'challenge') {
      initial = ventilationSimulationReducer(initial, {
        type: 'SET_CHALLENGE_MODE',
        challengeMode: 'timed',
      })
    }
    coreDispatch({
      type: 'LOAD_CASE',
      caseId,
      experience: engineExperience(mode),
      attempt: nextAttempt,
      deviceId,
    })
    if (mode === 'challenge') {
      window.setTimeout(
        () => coreDispatch({ type: 'SET_CHALLENGE_MODE', challengeMode: 'timed' }),
        0,
      )
    }
    stateRef.current = initial
    eventsRef.current = []
    setEvents([])
    setReplayOverflow(false)
    setActivityPhase('recognize')
    setOutcome(null)
    setCompleted(false)
    setTransferMechanismId('')
    setTransferFeedback(null)
    setShowChallengeFeedback(false)
    dispatchTransferSession({
      type: 'LOAD',
      caseId: transferCaseId,
      attempt: nextAttempt + 1,
      masked: maskedAssessment,
      deviceId,
    })
    setResetVersion((current) => current + 1)
    clearMechanicalVentilationSession(window.localStorage)
    setStorageMessage('Clean case reset. The selected console remains fixed for this attempt.')
  }

  function showHelp() {
    if (mode === 'challenge') {
      setStorageMessage(
        'Teaching hints are deferred in Challenge mode. Use the patient, waveforms, and alarms.',
      )
      return
    }
    dispatch({ type: 'USE_HINT' })
  }

  function saveAndExit() {
    setStorageMessage(persistCurrent())
    router.push(pathname as Route)
  }

  function selectActivityPhase(phase: CriticalCareActivityPhase) {
    if (phase === 'transfer') {
      if (activityPhase !== 'transfer') beginTransfer()
      return
    }
    if (phase === 'explain') {
      dispatch({ type: 'REVEAL_DEBRIEF' })
    } else {
      setActivityPhase(phase)
    }
    const targetId =
      phase === 'recognize'
        ? 'mv-case-recognize'
        : phase === 'predict'
          ? 'mv-case-predict'
          : phase === 'act'
            ? 'mv-case-act'
            : phase === 'observe'
              ? 'mv-case-observe'
              : 'mv-case-explain'
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.focus({ preventScroll: false })
    })
  }

  const inTransfer = activityPhase === 'transfer'
  const activeState = inTransfer ? transferSession.state : state
  const activeDefinition = inTransfer ? transferDefinition : definition
  const activeResponseVisible =
    mode !== 'challenge' ||
    showChallengeFeedback ||
    activeState.phase === 'debrief' ||
    activeState.criticalErrors.length > 0
  const shellTitle = inTransfer
    ? `Transfer · ${transferDefinition.id} · ${transferDefinition.title}`
    : `${definition.id} · ${definition.title}`

  const bottomAction = completed ? (
    <Link
      href={pathname as Route}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
    >
      Choose the next activity <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  ) : activityPhase === 'explain' ? (
    <button type="button" className={styles.bottomPrimary} onClick={beginTransfer}>
      Load contrasting transfer patient <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  ) : activityPhase === 'transfer' ? (
    <button
      type="button"
      className={styles.bottomPrimary}
      disabled={completed}
      onClick={completeTransfer}
    >
      Submit transfer review
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
    </button>
  ) : null

  return (
    <SimulationLaunchGate
      activityTitle={shellTitle}
      minimumViewport="desktop"
      bandwidthClass="standard"
      estimatedSizeLabel="Lazy-loaded simulator workspace; no 3D asset required"
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
        activityId={expectedActivityId}
        assumedConceptIds={catalogActivity?.assumedConceptIds}
        breadcrumb={
          <span>
            <Link href={'/mechanical-ventilation' as Route}>Mechanical Ventilation</Link> /{' '}
            <Link href={pathname as Route}>{section === 'assess' ? 'Challenge' : 'Practice'}</Link>{' '}
            / {inTransfer ? transferDefinition.id : definition.id}
          </span>
        }
        activityTitle={shellTitle}
        phase={activityPhase}
        mode={mode}
        onPhaseSelect={selectActivityPhase}
        progressLabel={
          completed
            ? 'Worked through'
            : inTransfer
              ? 'Transfer review in progress'
              : `${activityPhase} · ${profile.shortName} fixed`
        }
        patientContext={
          <PatientContextBar
            items={[
              { label: 'Patient', value: activeDefinition.patientDescription },
              { label: 'Console', value: `${profile.displayName} · ${profile.softwareVersion}` },
              { label: 'Mode', value: activeState.ventilator.settings.deviceMode },
              {
                label: 'SpO₂',
                value: `${activeState.patient.gasExchange.spo2Percent.toFixed(0)}%`,
              },
              {
                label: 'MAP',
                value: `${activeState.patient.hemodynamics.mapMmHg.toFixed(0)} mm Hg`,
              },
              {
                label: 'Simulation',
                value: `${activeState.simulationTime.toFixed(0)} simulated seconds`,
              },
            ]}
            immediateGoal={
              inTransfer
                ? 'Interpret this new patient and perform both discriminating review actions.'
                : activityPhase === 'recognize'
                  ? 'Run or step at least one breath while reading the patient and baseline signals.'
                  : activityPhase === 'predict'
                    ? 'Commit the mechanism, safety priority, and expected response before changing therapy.'
                    : activityPhase === 'act'
                      ? 'Perform the mechanism-specific intervention and watch the response.'
                      : activityPhase === 'observe'
                        ? 'Repeat the discriminating review and commit reassessment.'
                        : 'Review the causal debrief before loading the transfer patient.'
            }
            safetyConstraints={[
              'Educational simulation only; do not use synthetic values for patient care.',
              `The ${profile.shortName} console is fixed. Exit to setup to change it; doing so starts a clean case.`,
            ]}
          />
        }
        viewport={
          <div className={styles.caseViewport}>
            <div className={styles.patientSurface}>
              <BedsidePanel state={activeState} definition={activeDefinition} compact />
            </div>
            <div className={styles.consoleSurface}>
              <MechanicalVentilatorConsole
                key={`${deviceId}:${activeState.caseId}:${activeState.ventilator.settings.deviceMode}:${resetVersion}`}
                state={activeState}
                dispatch={inTransfer ? dispatchTransfer : dispatch}
                controlsEnabled
              />
            </div>
          </div>
        }
        currentTask={
          <div className={styles.workflowSurface}>
            {inTransfer ? (
              <TransferFollowUp
                definition={transferDefinition}
                selectedMechanismId={transferMechanismId}
                evidence={transferSession.evidence}
                feedback={transferFeedback}
                completed={completed}
                onMechanismSelected={(mechanismId) => {
                  setTransferMechanismId(mechanismId)
                  setTransferFeedback(null)
                }}
                onAction={dispatchTransfer}
              />
            ) : (
              <CaseWorkflow
                key={`${caseId}:${mode}:${deviceId}:${resetVersion}`}
                state={state}
                definition={definition}
                dispatch={dispatch}
                onResult={handleResult}
                maskedAssessment={maskedAssessment}
                showActionFeedback={mode !== 'challenge' || showChallengeFeedback}
                onShowActionFeedbackChange={
                  mode === 'challenge' ? setShowChallengeFeedback : undefined
                }
              />
            )}
          </div>
        }
        bottomContent={
          <span className={styles.bottomStatus}>
            {storageMessage ??
              (activeResponseVisible ? activeState.lastResponse : null) ??
              `Checkpoint: semantic-${activityPhase}`}
            {replayOverflow ? (
              <span className={styles.replayWarning}>
                <ShieldAlert className="size-3.5" aria-hidden="true" /> Resume will use the
                clean-case checkpoint.
              </span>
            ) : null}
          </span>
        }
        secondaryActions={
          <>
            <ReferenceDrawer
              entries={inTransfer ? transferReferenceEntries : referenceEntries}
              title={`${activeDefinition.id} reference`}
              trigger={
                <button type="button" className={styles.bottomUtility}>
                  Reference
                </button>
              }
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={
                <button type="button" className={styles.bottomUtility}>
                  Evidence
                </button>
              }
            />
            {bottomAction}
          </>
        }
        onSaveAndExit={saveAndExit}
        onHelp={showHelp}
        onReset={resetCase}
        theme="dark"
      />
    </SimulationLaunchGate>
  )
}
