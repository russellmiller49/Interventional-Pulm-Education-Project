'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Route } from 'next'
import { ArrowRight, CheckCircle2, Languages, ShieldAlert } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import {
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

import {
  getVentilatorDeviceProfile,
  mechanicalVentilationCaseById,
  mechanicalVentilationCases,
  ventilationEvidenceById,
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
const COMPETENCY_IDS = [
  'ventilator-setup',
  'ventilator-mechanics',
  'ventilator-waveform-interpretation',
  'ventilator-troubleshooting',
  'ventilator-safety',
] as const

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
        case: 'masked-seeded',
        seed: seedToken ?? 'assessment-v1',
        device: deviceId,
      }
    : { case: caseId, device: deviceId, mode }
}

function pointerMatches(
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
    pointer.payloadVersion === MECHANICAL_VENTILATION_REPLAY_PAYLOAD_VERSION &&
    Object.entries(query).every(([key, value]) => pointer.query?.[key] === value),
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
  const sessionCompatible = Boolean(
    storedSession &&
    storedSession.activityId === expectedActivityId &&
    storedSession.caseId === props.caseId &&
    storedSession.deviceId === props.deviceId &&
    storedSession.activityMode === props.mode &&
    storedSession.experience === engineExperience(props.mode),
  )

  if (resumeCompatible && storedSession && sessionCompatible) {
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
        activityPhase: storedSession.activityPhase,
        restored: true,
        message:
          'Exact semantic checkpoint restored. High-frequency waveform arrays were regenerated, not stored.',
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
  const profile = getVentilatorDeviceProfile(deviceId)
  const expectedActivityId = activityId(section, caseId)
  const pathname = activityPathname(section)
  const query = useMemo<Readonly<Record<string, string>>>(() => {
    if (section === 'assess') {
      const assessQuery: Readonly<Record<string, string>> = {
        case: 'masked-seeded',
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
  const controlsEnabled = state.experience === 'learn' || state.prediction.committed
  const maskedAssessment = section === 'assess'

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

  const buildPointer = useCallback(
    (now: string): CriticalCareResumePointer => ({
      activityId: expectedActivityId,
      pathname,
      query,
      mode,
      phase: activityPhaseRef.current,
      scenarioId: caseId,
      deviceId,
      checkpointId: replayOverflow ? 'clean-case' : `semantic-${activityPhaseRef.current}`,
      payloadVersion: replayOverflow
        ? 'ventilation-clean-case-v1'
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
      ? 'Replay reached its bounded action limit. Progress points to the clean-case checkpoint.'
      : normalizedStored && sessionStored
        ? 'Exact semantic checkpoint saved on this device.'
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

  function reviewBaseline() {
    setActivityPhase(mode === 'guided' ? 'act' : 'predict')
  }

  function beginTransfer() {
    setActivityPhase('transfer')
  }

  function completeTransfer() {
    if (transferCompletedRef.current) return
    transferCompletedRef.current = true
    const finalOutcome = outcomeRef.current ?? selectCaseOutcome(stateRef.current, definition)
    const now = new Date().toISOString()
    const envelope = readCriticalCareProgress(window.localStorage)
    let next = upsertCriticalCareActivityProgress(envelope, {
      activityId: expectedActivityId,
      status: mode === 'guided' ? 'completed' : finalOutcome.mastery ? 'mastered' : 'completed',
      currentPhase: 'transfer',
      mode,
      ...(mode === 'guided' ? {} : { bestScore: finalOutcome.score }),
      attempts: normalizedAttemptRef.current,
      hintCount: stateRef.current.hintsUsed,
      competencyEvidenceIds: COMPETENCY_IDS,
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
        ? 'Guided case and transfer check completed.'
        : finalOutcome.mastery
          ? `Mastery saved: ${finalOutcome.score}/100 with no critical error.`
          : `Completion saved: ${finalOutcome.score}/100. Review remediation before another attempt.`,
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
    setResetVersion((current) => current + 1)
    clearMechanicalVentilationSession(window.localStorage)
    setStorageMessage('Clean case reset. The selected console remains fixed for this attempt.')
  }

  function showHelp() {
    if (mode === 'challenge') {
      setStorageMessage(
        'Hints remain masked in Challenge mode. Use the patient, waveforms, and alarms.',
      )
      return
    }
    dispatch({ type: 'USE_HINT' })
  }

  function saveAndExit() {
    setStorageMessage(persistCurrent())
    router.push(pathname as Route)
  }

  const shellTitle = maskedAssessment
    ? state.phase === 'debrief'
      ? `${definition.id} · ${definition.title}`
      : 'Masked ventilation challenge'
    : `${definition.id} · ${definition.title}`

  const bottomAction = completed ? (
    <Link
      href={pathname as Route}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground"
    >
      Choose the next activity <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  ) : activityPhase === 'recognize' ? (
    <button type="button" className={styles.bottomPrimary} onClick={reviewBaseline}>
      Baseline reviewed <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  ) : activityPhase === 'explain' ? (
    <button type="button" className={styles.bottomPrimary} onClick={beginTransfer}>
      Begin transfer check <ArrowRight className="size-3.5" aria-hidden="true" />
    </button>
  ) : activityPhase === 'transfer' ? (
    <button type="button" className={styles.bottomPrimary} onClick={completeTransfer}>
      I named the signal and bedside finding I would recheck
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
        breadcrumb={
          <span>
            <Link href={'/mechanical-ventilation' as Route}>Mechanical Ventilation</Link> /{' '}
            <Link href={pathname as Route}>{section === 'assess' ? 'Assess' : 'Practice'}</Link> /{' '}
            {maskedAssessment && state.phase !== 'debrief' ? 'Masked case' : definition.id}
          </span>
        }
        activityTitle={shellTitle}
        phase={activityPhase}
        mode={mode}
        progressLabel={completed ? 'Completed' : `${activityPhase} · ${profile.shortName} fixed`}
        patientContext={
          <PatientContextBar
            items={[
              { label: 'Patient', value: definition.patientDescription },
              { label: 'Console', value: `${profile.displayName} · ${profile.softwareVersion}` },
              { label: 'Mode', value: state.ventilator.settings.deviceMode },
              { label: 'SpO₂', value: `${state.patient.gasExchange.spo2Percent.toFixed(0)}%` },
              { label: 'MAP', value: `${state.patient.hemodynamics.mapMmHg.toFixed(0)} mm Hg` },
              {
                label: 'Simulation',
                value: `${state.simulationTime.toFixed(0)} s · seed ${state.seed}`,
              },
            ]}
            immediateGoal={
              activityPhase === 'recognize'
                ? 'Read the patient and baseline signals before committing to a mechanism.'
                : activityPhase === 'transfer'
                  ? 'Name the discriminating patient and signal reassessment you would carry into a variant.'
                  : 'Complete the preserved case workflow and prove the response with reassessment.'
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
              <BedsidePanel state={state} definition={definition} compact />
            </div>
            <div className={styles.consoleSurface}>
              <MechanicalVentilatorConsole
                key={`${deviceId}:${state.ventilator.settings.deviceMode}:${resetVersion}`}
                state={state}
                dispatch={dispatch}
                controlsEnabled={controlsEnabled}
              />
            </div>
          </div>
        }
        currentTask={
          <div className={styles.workflowSurface}>
            <CaseWorkflow
              key={`${caseId}:${mode}:${deviceId}:${resetVersion}`}
              state={state}
              definition={definition}
              dispatch={dispatch}
              onResult={handleResult}
              maskedAssessment={maskedAssessment}
            />
          </div>
        }
        bottomContent={
          <span className={styles.bottomStatus}>
            {storageMessage ?? state.lastResponse ?? `Checkpoint: semantic-${activityPhase}`}
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
            {!maskedAssessment ? (
              <ReferenceDrawer
                entries={referenceEntries}
                title={`${definition.id} reference`}
                trigger={
                  <button type="button" className={styles.bottomUtility}>
                    Reference
                  </button>
                }
              />
            ) : null}
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
        maskedAssessment={maskedAssessment}
      />
    </SimulationLaunchGate>
  )
}
