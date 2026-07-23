'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react'
import dynamic from 'next/dynamic'
import type { Route } from 'next'
import type { LucideIcon } from 'lucide-react'
import {
  BookOpenCheck,
  Boxes,
  ChevronRight,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  MonitorDot,
  Pause,
  Play,
  RotateCcw,
  Stethoscope,
} from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import { recordSiteModuleEvent } from '@/lib/analytics'
import { recordCriticalCareIcuOutcome } from '@/features/critical-care/progress/integrated'
import {
  useCriticalCareActivityAnalytics,
  type CriticalCareActivityMode,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { ActivityChrome } from '@/features/learning-module/components/ActivityChrome'
import { ClinicalContextStrip } from '@/features/learning-module/components/ClinicalContextStrip'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import {
  ICU_SIMULATION_ANALYTICS_MODULE_ID,
  expectedIcuSimulationAnalyticsEventType,
  icuSimulationElapsedBand,
  icuSimulationScoreBand,
  validateIcuSimulationAnalyticsEventPayload,
  type IcuSimulationAnalyticsEventPayload,
} from '@/lib/icu-simulation-analytics'

import {
  ICU_EDUCATIONAL_BOUNDARIES,
  ICU_EVIDENCE_BY_ID,
  ICU_SIMULATION_RELEASE,
  getIcuScenario,
  icuScenarios,
} from '../content'
import {
  applyIcuCommand,
  clearIcuSyntheticSession,
  createDefaultIcuProgress,
  createIcuSimulation,
  createIcuWorkerClient,
  ICU_SIMULATION_SESSION_STORAGE_KEY,
  readIcuProgress,
  readIcuSyntheticSession,
  recordIcuScenarioResult,
  resumeIcuSyntheticSession,
  writeIcuProgress,
  writeIcuSyntheticSession,
  type IcuCommand,
  type IcuScenarioDefinition,
  type IcuSimulationProgressV1,
  type IcuSimulationMode,
  type IcuSimulationState,
  type IcuSyntheticSessionV1,
  type IcuWorkerClient,
} from '../engine'
import {
  IcuAlarmCenter,
  IcuCarePanel,
  IcuCaseGuide,
  IcuDiagnosticsPanel,
  IcuSandboxControls,
  IcuSourceNotes,
  IcuTimelinePanel,
} from './IcuClinicalPanels'
import { IcuDevicePanels } from './IcuDevicePanels'
import { IcuPatientMonitor } from './IcuPatientMonitor'
import { IcuSimulatorModuleNav } from './IcuSimulatorModuleNav'
import styles from './icu-simulation.module.css'

const IcuBedsideScene = dynamic(
  () => import('./IcuBedsideScene').then((module) => module.IcuBedsideScene),
  {
    ssr: false,
    loading: () => (
      <div className={styles.sceneLoading} role="status">
        Loading optional 3D bedside…
      </div>
    ),
  },
)

export interface IcuSimulatorLabProps {
  mode: IcuSimulationMode
  locale?: string
  initialScenarioId?: string
  /** Optional catalog-only allowlist used by the Assess preparation gate. */
  availableScenarioIds?: readonly string[]
  /** Keeps the shell inside a parent route-level gate instead of fixing it to the viewport. */
  embedded?: boolean
}

type MobileSurface = 'monitor' | 'clinical' | 'devices' | 'course'
type SimulationSpeed = 1 | 5 | 30

const modeCopy: Readonly<
  Record<
    IcuSimulationMode,
    {
      eyebrow: string
      title: string
      description: string
      status: string
      Icon: LucideIcon
    }
  >
> = {
  learn: {
    eyebrow: 'Guided integrated learning',
    title: 'See how the systems connect',
    description:
      'Causal coaching stays visible while you assess the patient, start support, advance time, and close the reassessment loop.',
    status: 'Guidance visible · unscored orientation',
    Icon: BookOpenCheck,
  },
  practice: {
    eyebrow: 'Coached longitudinal cases',
    title: 'Run the full ICU course',
    description:
      'Work through evolving shock, organ support, and device problems. Checkpoints reward mechanism, prioritization, and reassessment.',
    status: 'Hints available · scored practice',
    Icon: Stethoscope,
  },
  assess: {
    eyebrow: 'Seeded assessment variants',
    title: 'Demonstrate safe clinical reasoning',
    description:
      'Coaching is withheld until the causal debrief. Mastery requires at least 80% and no critical safety error.',
    status: 'Coaching withheld · scored assessment',
    Icon: ClipboardCheck,
  },
  sandbox: {
    eyebrow: 'Bounded physiology exploration',
    title: 'Explore support interactions',
    description:
      'Begin from a reviewed synthetic preset and explore available interventions without a mastery score or exact action sequence.',
    status: 'No score · reviewed device combinations',
    Icon: FlaskConical,
  },
}

const surfaceCopy: Readonly<
  Record<MobileSurface, { label: string; detail: string; Icon: LucideIcon }>
> = {
  monitor: { label: 'Patient', detail: 'Monitor & bedside', Icon: MonitorDot },
  clinical: { label: 'Clinical', detail: 'Orders & actions', Icon: Stethoscope },
  devices: { label: 'Devices', detail: 'Support controls', Icon: Gauge },
  course: { label: 'Course', detail: 'Guide & trends', Icon: Boxes },
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safe / 3_600)
  const minutes = Math.floor((safe % 3_600) / 60)
  const remainingSeconds = safe % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function maskedOrderValue(id: string, seed: number): number {
  let value = seed >>> 0
  for (const character of id) value = Math.imul(value ^ character.charCodeAt(0), 16_777_619)
  return value >>> 0
}

function chooseInitialScenario(
  mode: IcuSimulationMode,
  initialScenarioId?: string,
): IcuScenarioDefinition {
  let requested: IcuScenarioDefinition | undefined
  if (initialScenarioId) {
    try {
      requested = getIcuScenario(initialScenarioId)
    } catch {
      requested = undefined
    }
  }
  if (requested?.allowedModes.includes(mode)) return requested
  return icuScenarios.find((scenario) => scenario.allowedModes.includes(mode)) ?? icuScenarios[0]
}

function createSession(scenario: IcuScenarioDefinition, mode: IcuSimulationMode, seed = 41_701) {
  return createIcuSimulation(scenario, { mode, seed })
}

function modeHref(mode: IcuSimulationMode): Route {
  return `/icu-simulation/${mode}` as Route
}

function recordBoundedAnalytics(payload: IcuSimulationAnalyticsEventPayload) {
  const parsed = validateIcuSimulationAnalyticsEventPayload(payload)
  if (!parsed.success) return
  recordSiteModuleEvent({
    eventType: expectedIcuSimulationAnalyticsEventType(parsed.data.interaction),
    moduleId: ICU_SIMULATION_ANALYTICS_MODULE_ID,
    eventPayload: parsed.data,
  })
}

export function IcuSimulatorLab({
  mode,
  locale = 'en',
  initialScenarioId,
  availableScenarioIds,
  embedded = false,
}: IcuSimulatorLabProps) {
  const router = useRouter()
  const availableScenarioKey = availableScenarioIds?.join('|')
  const eligibleScenarioIds = useMemo(
    () =>
      availableScenarioKey === undefined
        ? undefined
        : new Set(availableScenarioKey ? availableScenarioKey.split('|') : []),
    [availableScenarioKey],
  )
  const availableScenarios = useMemo(
    () =>
      icuScenarios.filter(
        (scenario) =>
          scenario.allowedModes.includes(mode) &&
          (!eligibleScenarioIds || eligibleScenarioIds.has(scenario.id)),
      ),
    [eligibleScenarioIds, mode],
  )
  const initialScenario = useMemo(() => {
    const requested = chooseInitialScenario(mode, initialScenarioId)
    if (!eligibleScenarioIds || eligibleScenarioIds.has(requested.id)) return requested
    return availableScenarios[0] ?? requested
  }, [availableScenarios, eligibleScenarioIds, initialScenarioId, mode])
  const [state, setState] = useState<IcuSimulationState>(() => createSession(initialScenario, mode))
  const [assessmentCatalogSeed] = useState(() => state.seed)
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('monitor')
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState<SimulationSpeed>(1)
  const [progress, setProgress] = useState<IcuSimulationProgressV1>(createDefaultIcuProgress)
  const [savedSession, setSavedSession] = useState<IcuSyntheticSessionV1 | null>(null)
  const [storageReady, setStorageReady] = useState(false)
  const [workerActive, setWorkerActive] = useState(false)
  const [restoringSession, setRestoringSession] = useState(false)
  const [engineNotice, setEngineNotice] = useState<string | null>(null)
  const [helpVisible, setHelpVisible] = useState(false)
  const openedSection = useRef<IcuSimulationMode | null>(null)
  const openedScenario = useRef<string | null>(null)
  const predictionRecorded = useRef<string | null>(null)
  const reassessmentRecorded = useRef<string | null>(null)
  const completionRecorded = useRef<string | null>(null)
  const progressRecorded = useRef<string | null>(null)
  const moduleCompletionRecorded = useRef(false)
  const previousModuleMastery = useRef<boolean | null>(null)
  const lifecycleSafetyEvents = useRef<{ key: string; ids: Set<string> }>({
    key: '',
    ids: new Set(),
  })
  const lifecycleGoalEvents = useRef<{ key: string; ids: Set<string> }>({
    key: '',
    ids: new Set(),
  })
  const workerClient = useRef<IcuWorkerClient | null>(null)
  const workerInstance = useRef<Worker | null>(null)
  const latestWorkerRequest = useRef<string | null>(null)
  const restoreWorkerRequest = useRef<string | null>(null)
  const latestWorkerState = useRef<IcuSimulationState>(state)
  const initialWorkerSession = useRef(state)
  const scenario = getIcuScenario(state.scenarioId)
  const displayedScenarios = useMemo(
    () =>
      mode === 'assess'
        ? [...availableScenarios].sort(
            (left, right) =>
              maskedOrderValue(left.id, assessmentCatalogSeed) -
              maskedOrderValue(right.id, assessmentCatalogSeed),
          )
        : availableScenarios,
    [assessmentCatalogSeed, availableScenarios, mode],
  )
  const copy = modeCopy[mode]
  const ModeIcon = copy.Icon
  const assessmentDiagnosisHidden = mode === 'assess' && state.phase !== 'debrief'
  const assessmentAwaitingDiagnosis = mode === 'assess' && !state.diagnosis.committed
  const courseWindowReached = state.clock.elapsedSeconds >= scenario.durationHours * 3_600
  const simulationRunning = running && !courseWindowReached && state.phase !== 'debrief'
  const interventionControlsLocked =
    (mode === 'practice' || mode === 'assess') && !state.diagnosis.committed
  const lifecycleMode: CriticalCareActivityMode =
    mode === 'learn' ? 'guided' : mode === 'assess' ? 'challenge' : 'practice'
  const lifecyclePhase: CriticalCareActivityPhase = state.outcome.completed
    ? 'explain'
    : state.diagnosis.committed &&
        (state.reassessedDomains.length > 0 ||
          (state.diagnosis.committedAtSeconds !== null &&
            state.clock.elapsedSeconds > state.diagnosis.committedAtSeconds))
      ? 'observe'
      : state.diagnosis.committed
        ? 'act'
        : state.observations.length > 1
          ? 'predict'
          : 'recognize'
  const lifecycleActivityId = `icu:${mode}:${state.scenarioFamily}`
  const {
    recordPredictionSubmitted: recordLifecyclePrediction,
    recordHintUsed: recordLifecycleHint,
    recordSafetyEvent: recordLifecycleSafetyEvent,
    recordGoalMet: recordLifecycleGoalMet,
    recordDebriefViewed: recordLifecycleDebrief,
    recordActivityCompleted: recordLifecycleCompletion,
  } = useCriticalCareActivityAnalytics({
    moduleId: 'icu-simulation',
    activityId: lifecycleActivityId,
    mode: lifecycleMode,
    phase: lifecyclePhase,
    enabled: mode !== 'sandbox',
  })
  const dispatch = useCallback<Dispatch<IcuCommand>>((command) => {
    const client = workerClient.current
    if (client) {
      latestWorkerRequest.current =
        command.type === 'time.advance' ? client.advance(command.seconds) : client.command(command)
      return
    }
    setState((current) => {
      const currentScenario = getIcuScenario(current.scenarioId)
      return applyIcuCommand(current, currentScenario, command)
    })
  }, [])

  const initializeSession = useCallback((nextState: IcuSimulationState) => {
    setRunning(false)
    setState(nextState)
    latestWorkerState.current = nextState
    progressRecorded.current = null

    const client = workerClient.current
    if (!client) return
    latestWorkerRequest.current = client.init(nextState.scenarioId, nextState.mode, nextState.seed)
    for (const record of nextState.replay.commands) {
      latestWorkerRequest.current = client.command(record.command)
    }
  }, [])

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      const timer = window.setTimeout(() => {
        setEngineNotice(
          'The background simulation worker is unavailable. This session is using the safe main-thread fallback.',
        )
      }, 0)
      return () => window.clearTimeout(timer)
    }

    let active = true
    try {
      const instance = new Worker(new URL('../engine/icu-simulation.worker.ts', import.meta.url), {
        type: 'module',
        name: 'icu-simulation-engine',
      })
      const client = createIcuWorkerClient(instance, (response) => {
        if (!active) return
        if (response.type === 'error') {
          workerClient.current = null
          client.dispose()
          instance.terminate()
          workerInstance.current = null
          window.setTimeout(() => {
            setState(latestWorkerState.current)
            setWorkerActive(false)
            setRestoringSession(false)
            setEngineNotice(
              restoreWorkerRequest.current
                ? 'The saved session could not be restored in the background worker. Its replay remains available; choose Resume again to use the safe fallback.'
                : 'The background simulation worker stopped. The last verified state was preserved and the safe main-thread fallback is active.',
            )
            restoreWorkerRequest.current = null
          }, 0)
          return
        }

        latestWorkerState.current = response.state
        if (response.requestId === latestWorkerRequest.current) {
          setState(response.state)
          if (response.requestId === restoreWorkerRequest.current) {
            restoreWorkerRequest.current = null
            setSavedSession(null)
            setRestoringSession(false)
            setMobileSurface('monitor')
            setEngineNotice(
              'Saved synthetic session resumed from its validated semantic command replay.',
            )
          }
        }
      })
      workerInstance.current = instance
      workerClient.current = client
      const initial = initialWorkerSession.current
      latestWorkerRequest.current = client.init(initial.scenarioId, initial.mode, initial.seed)
      const readyTimer = window.setTimeout(() => setWorkerActive(true), 0)

      return () => {
        active = false
        window.clearTimeout(readyTimer)
        client.dispose()
        instance.terminate()
        if (workerClient.current === client) workerClient.current = null
        if (workerInstance.current === instance) workerInstance.current = null
      }
    } catch {
      const timer = window.setTimeout(() => {
        setEngineNotice(
          'The background simulation worker could not start. This session is using the safe main-thread fallback.',
        )
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextProgress = readIcuProgress(window.localStorage)
      const hadStoredSession =
        window.localStorage.getItem(ICU_SIMULATION_SESSION_STORAGE_KEY) !== null
      const candidate = readIcuSyntheticSession(window.localStorage)
      setProgress(nextProgress)

      if (candidate) {
        const candidateScenario = getIcuScenario(candidate.replay.scenarioId)
        const assessScenarioIsEligible =
          candidate.replay.mode !== 'assess' ||
          !eligibleScenarioIds ||
          eligibleScenarioIds.has(candidate.replay.scenarioId)
        const alreadyCompleted = candidate.replay.commands.some(
          (record) => record.command.type === 'session.complete',
        )
        if (alreadyCompleted) {
          clearIcuSyntheticSession(window.localStorage)
          setEngineNotice(
            'The prior synthetic course was already complete, so its replay was cleared instead of being offered as a new attempt.',
          )
        } else if (!assessScenarioIsEligible) {
          clearIcuSyntheticSession(window.localStorage)
          setEngineNotice(
            'A saved assessment no longer met the current preparation requirements and was safely discarded.',
          )
        } else if (candidate.replay.scenarioVersion === candidateScenario.version) {
          setSavedSession(candidate)
        } else {
          clearIcuSyntheticSession(window.localStorage)
          setEngineNotice(
            'A saved simulation was incompatible with this content version and was safely discarded.',
          )
        }
      } else if (hadStoredSession) {
        clearIcuSyntheticSession(window.localStorage)
        setEngineNotice('An invalid saved simulation was safely discarded.')
      }
      setStorageReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [eligibleScenarioIds])

  useEffect(() => {
    if (!storageReady || savedSession) return
    if (state.outcome.completed) {
      clearIcuSyntheticSession(window.localStorage)
      return
    }
    const timer = window.setTimeout(() => {
      writeIcuSyntheticSession(window.localStorage, state)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [savedSession, state, storageReady])

  useEffect(() => {
    if (!simulationRunning) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 1_500 : 1_000
    const timer = window.setInterval(
      () => dispatch({ type: 'time.advance', seconds: speed }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [dispatch, simulationRunning, speed])

  useEffect(() => {
    if (openedSection.current === mode) return
    openedSection.current = mode
    recordBoundedAnalytics({ interaction: 'section_opened', section: mode })
  }, [mode])

  useEffect(() => {
    const key = `${mode}:${state.scenarioId}:${state.seed}`
    if (openedScenario.current === key) return
    openedScenario.current = key
    predictionRecorded.current = null
    reassessmentRecorded.current = null
    completionRecorded.current = null
    recordBoundedAnalytics({
      interaction: 'scenario_opened',
      section: mode,
      scenarioId: state.scenarioId as IcuSimulationAnalyticsEventPayload['scenarioId'],
    })
  }, [mode, state.scenarioId, state.seed])

  useEffect(() => {
    if (!state.diagnosis.committed) return
    const key = `${state.scenarioId}:${state.seed}`
    if (predictionRecorded.current === key) return
    predictionRecorded.current = key
    recordBoundedAnalytics({
      interaction: 'prediction_committed',
      section: mode,
      scenarioId: state.scenarioId as IcuSimulationAnalyticsEventPayload['scenarioId'],
    })
    recordLifecyclePrediction()
  }, [mode, recordLifecyclePrediction, state.diagnosis.committed, state.scenarioId, state.seed])

  useEffect(() => {
    const key = `${mode}:${state.scenarioId}:${state.seed}`
    if (lifecycleSafetyEvents.current.key !== key) {
      lifecycleSafetyEvents.current = { key, ids: new Set() }
    }
    for (const id of state.outcome.criticalErrorIds) {
      if (lifecycleSafetyEvents.current.ids.has(id)) continue
      lifecycleSafetyEvents.current.ids.add(id)
      recordLifecycleSafetyEvent()
    }
  }, [
    mode,
    recordLifecycleSafetyEvent,
    state.outcome.criticalErrorIds,
    state.scenarioId,
    state.seed,
  ])

  useEffect(() => {
    const key = `${mode}:${state.scenarioId}:${state.seed}`
    if (lifecycleGoalEvents.current.key !== key) {
      lifecycleGoalEvents.current = { key, ids: new Set() }
    }
    for (const id of state.outcome.checkpointIdsCompleted) {
      if (lifecycleGoalEvents.current.ids.has(id)) continue
      lifecycleGoalEvents.current.ids.add(id)
      recordLifecycleGoalMet()
    }
  }, [
    mode,
    recordLifecycleGoalMet,
    state.outcome.checkpointIdsCompleted,
    state.scenarioId,
    state.seed,
  ])

  useEffect(() => {
    if (state.reassessedDomains.length < 5) return
    const key = `${state.scenarioId}:${state.seed}`
    if (reassessmentRecorded.current === key) return
    reassessmentRecorded.current = key
    recordBoundedAnalytics({
      interaction: 'reassessment_completed',
      section: mode,
      scenarioId: state.scenarioId as IcuSimulationAnalyticsEventPayload['scenarioId'],
    })
  }, [mode, state.reassessedDomains.length, state.scenarioId, state.seed])

  useEffect(() => {
    if (!state.outcome.completed) return
    const key = `${state.scenarioId}:${state.seed}`
    if (completionRecorded.current === key) return
    completionRecorded.current = key
    recordBoundedAnalytics({
      interaction: 'scenario_completed',
      section: mode,
      scenarioId: state.scenarioId as IcuSimulationAnalyticsEventPayload['scenarioId'],
      scoreBand: icuSimulationScoreBand(
        mode === 'sandbox' || mode === 'learn' ? null : state.outcome.score.total,
        mode === 'sandbox' || mode === 'learn',
      ),
      elapsedBand: icuSimulationElapsedBand(state.clock.elapsedSeconds),
      criticalErrorCount: Math.min(100, state.outcome.criticalErrorIds.length),
      completed: true,
      mastered: mode === 'sandbox' || mode === 'learn' ? false : state.outcome.mastery,
    })
    recordLifecycleDebrief()
    recordLifecycleCompletion(mode !== 'sandbox' && mode !== 'learn' && state.outcome.mastery)
  }, [
    mode,
    recordLifecycleCompletion,
    recordLifecycleDebrief,
    state.clock.elapsedSeconds,
    state.outcome.completed,
    state.outcome.criticalErrorIds.length,
    state.outcome.mastery,
    state.outcome.score.total,
    state.scenarioId,
    state.seed,
  ])

  useEffect(() => {
    if (!storageReady || !state.outcome.completed) return
    const key = `${mode}:${state.scenarioId}:${state.seed}`
    if (progressRecorded.current === key) return
    progressRecorded.current = key
    const timer = window.setTimeout(() => {
      setProgress((current) => {
        const next = recordIcuScenarioResult(current, state)
        writeIcuProgress(window.localStorage, next)
        if (mode === 'practice' || mode === 'assess') {
          recordCriticalCareIcuOutcome(window.localStorage, {
            scenarioId: state.scenarioFamily,
            mode,
            score: state.outcome.score.total,
            mastered: state.outcome.mastery,
            attempts: next.attempts[state.scenarioFamily] ?? 1,
          })
        }
        return next
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [mode, state, storageReady])

  useEffect(() => {
    if (!storageReady || mode !== 'assess') return
    const moduleMastered = availableScenarios.every((candidate) =>
      progress.masteredScenarioIds.some((scenarioId) => scenarioId === candidate.id),
    )
    if (
      previousModuleMastery.current === false &&
      moduleMastered &&
      !moduleCompletionRecorded.current
    ) {
      moduleCompletionRecorded.current = true
      recordBoundedAnalytics({
        interaction: 'module_completed',
        section: 'assess',
        completed: true,
      })
    }
    previousModuleMastery.current = moduleMastered
  }, [availableScenarios, mode, progress.masteredScenarioIds, storageReady])

  const discardSavedSession = useCallback(() => {
    clearIcuSyntheticSession(window.localStorage)
    restoreWorkerRequest.current = null
    setRestoringSession(false)
    setSavedSession(null)
  }, [])

  const resumeSavedSession = useCallback(() => {
    if (!savedSession || savedSession.replay.mode !== mode) return
    if (
      mode === 'assess' &&
      eligibleScenarioIds &&
      !eligibleScenarioIds.has(savedSession.replay.scenarioId)
    ) {
      discardSavedSession()
      setEngineNotice(
        'A saved assessment no longer met the current preparation requirements and was safely discarded.',
      )
      return
    }
    const client = workerClient.current
    if (client) {
      setRunning(false)
      setRestoringSession(true)
      setEngineNotice('Validating and restoring the saved command replay in the background worker…')
      const requestId = client.restore(savedSession)
      restoreWorkerRequest.current = requestId
      latestWorkerRequest.current = requestId
      return
    }
    try {
      const resumed = resumeIcuSyntheticSession(
        savedSession,
        getIcuScenario(savedSession.replay.scenarioId),
      )
      initializeSession(resumed)
      setSavedSession(null)
      setMobileSurface('monitor')
      setEngineNotice('Saved synthetic session resumed from its validated semantic command replay.')
    } catch {
      discardSavedSession()
      setEngineNotice(
        'The saved simulation was incompatible with this content version and was safely discarded.',
      )
    }
  }, [discardSavedSession, eligibleScenarioIds, initializeSession, mode, savedSession])

  const selectScenario = useCallback(
    (nextScenario: IcuScenarioDefinition) => {
      discardSavedSession()
      initializeSession(createSession(nextScenario, mode, state.seed + 1))
      setMobileSurface('monitor')
      setHelpVisible(false)
    },
    [discardSavedSession, initializeSession, mode, state.seed],
  )

  const resetSession = useCallback(() => {
    discardSavedSession()
    initializeSession(createSession(scenario, mode, state.seed + 1))
    setHelpVisible(false)
  }, [discardSavedSession, initializeSession, mode, scenario, state.seed])

  const lastEvent = state.history.at(-1)
  const activeAlarmCount = state.alarms.filter((alarm) => alarm.active).length
  const completedCheckpointCount = state.outcome.checkpointIdsCompleted.length
  const activityTitle = copy.title
  const progressLabel = assessmentDiagnosisHidden
    ? `${formatClock(state.clock.elapsedSeconds)} · ${activeAlarmCount} active alarms · assessment progress masked`
    : `${formatClock(state.clock.elapsedSeconds)} · ${completedCheckpointCount}/${scenario.checkpoints.length} checkpoints · ${activeAlarmCount} active alarms`
  const currentObjective = assessmentDiagnosisHidden
    ? 'Complete the current reasoning phase using only observable patient, device, and timeline data.'
    : (scenario.learningObjectives[0] ?? copy.description)
  const referenceEntries = assessmentDiagnosisHidden
    ? [
        {
          id: 'icu-assessment-reference-boundary',
          title: 'Assessment reference boundary',
          summary:
            'Scenario-specific coaching and references remain withheld until the causal debrief.',
          meta: 'Masked assessment',
        },
      ]
    : [
        {
          id: scenario.id,
          title: scenario.title,
          summary: scenario.summary,
          meta: `${scenario.durationHours}-hour synthetic course · ${scenario.reviewStatus} review`,
        },
        {
          id: 'icu-educational-boundary',
          title: ICU_EDUCATIONAL_BOUNDARIES.title,
          summary: ICU_EDUCATIONAL_BOUNDARIES.disclaimer,
          meta: 'Applies to every integrated ICU activity',
        },
      ]
  const evidenceEntries = assessmentDiagnosisHidden
    ? [
        {
          id: 'icu-assessment-evidence-boundary',
          title: 'Assessment evidence boundary',
          sourceLabel: 'Scenario-specific evidence is available after debrief.',
          limitation:
            'Use current source documents, manufacturer instructions, local policy, and supervised clinical judgment.',
        },
      ]
    : scenario.evidenceIds.flatMap((evidenceId) => {
        const evidence = ICU_EVIDENCE_BY_ID.get(evidenceId)
        return evidence
          ? [
              {
                id: evidence.id,
                title: evidence.title,
                sourceLabel: `${evidence.organization} · ${evidence.year} · ${evidence.sourceType} · ${evidence.reviewStatus}`,
                limitation: evidence.limitation,
              },
            ]
          : []
      })

  const showHelp = useCallback(() => {
    if (!helpVisible && mode !== 'assess') recordLifecycleHint()
    setHelpVisible(true)
  }, [helpVisible, mode, recordLifecycleHint])

  const saveAndExit = useCallback(() => {
    setRunning(false)
    const sessionToSave = workerClient.current ? latestWorkerState.current : state
    if (sessionToSave.outcome.completed) clearIcuSyntheticSession(window.localStorage)
    else writeIcuSyntheticSession(window.localStorage, sessionToSave)
    router.push('/icu-simulation' as Route)
  }, [router, state])

  const focusCourseAndDebrief = useCallback(() => {
    setMobileSurface('course')
    window.requestAnimationFrame(() => {
      document.getElementById('icu-course-surface')?.focus({ preventScroll: false })
    })
  }, [])

  const activityChrome = (
    <ActivityChrome
      layout="native-workbench"
      breadcrumb={<IcuSimulatorModuleNav activeSection={mode} compact />}
      activityTitle={activityTitle}
      phase={lifecyclePhase}
      mode={lifecycleMode}
      progressLabel={progressLabel}
      showProgressStepper={false}
      theme="dark"
      maskedAssessment={assessmentDiagnosisHidden}
      onHelp={showHelp}
      onReset={resetSession}
      onSaveAndExit={saveAndExit}
      bottomContent={`${progressLabel} · ${ICU_SIMULATION_RELEASE.stage.replaceAll('-', ' ')}`}
      secondaryActions={
        <>
          <ReferenceDrawer
            entries={referenceEntries}
            trigger={<button type="button">Reference</button>}
          />
          <EvidenceDrawer
            entries={evidenceEntries}
            trigger={<button type="button">Evidence</button>}
          />
          <button type="button" onClick={focusCourseAndDebrief}>
            {state.phase === 'debrief' ? 'Open debrief' : 'Course & debrief'}
          </button>
        </>
      }
    >
      <div className={styles.icuNativeActivityFrame}>
        <ClinicalContextStrip>
          <section
            className={styles.compactPatientStrip}
            aria-labelledby="icu-persistent-context-title"
          >
            <ModeIcon aria-hidden="true" />
            <div className={styles.compactPatientIdentity}>
              <span>
                {copy.eyebrow} · {ICU_SIMULATION_RELEASE.stage.replaceAll('-', ' ')}
              </span>
              <h2 id="icu-persistent-context-title">
                {assessmentDiagnosisHidden ? 'Unclassified shock course' : scenario.shortTitle}
              </h2>
            </div>
            <dl className={styles.compactPatientMetrics}>
              <div>
                <dt>Time</dt>
                <dd>{formatClock(state.clock.elapsedSeconds)}</dd>
              </div>
              <div>
                <dt>MAP</dt>
                <dd>{Math.round(state.patient.hemodynamics.mapMmHg)} mm Hg</dd>
              </div>
              <div>
                <dt>SpO₂</dt>
                <dd>{Math.round(state.patient.respiratory.spo2Percent)}%</dd>
              </div>
              <div>
                <dt>Alarms</dt>
                <dd>{activeAlarmCount}</dd>
              </div>
            </dl>
            <div className={styles.compactPatientGoal}>
              <span>Current objective</span>
              <strong>{currentObjective}</strong>
            </div>
            <div className={styles.compactPatientProgress}>
              <span>{copy.status}</span>
              <strong>{progressLabel}</strong>
            </div>
          </section>
        </ClinicalContextStrip>
        <div
          id="icu-activity-viewport"
          className={styles.activityViewport}
          tabIndex={-1}
          data-icu-internal-scroll
        >
          <div className={styles.labShell} data-mode={mode}>
            <section
              className={styles.safetyBanner}
              role="note"
              aria-label="Educational safety boundary"
            >
              <p>
                <strong>{ICU_EDUCATIONAL_BOUNDARIES.title}.</strong>{' '}
                {ICU_EDUCATIONAL_BOUNDARIES.disclaimer}
              </p>
            </section>

            {locale !== 'en' ? (
              <p className={styles.languageFallback} role="status">
                Reviewed-English fallback: this private preview remains English-first while
                localized clinical review is pending.
              </p>
            ) : null}

            {helpVisible ? (
              <section className={styles.helpNotice} role="status" aria-label="Simulation help">
                <strong>Use the native Course surface for the current task.</strong>
                <p>
                  Reference and Evidence describe the educational boundary, source scope, and model
                  limits.
                  {mode === 'assess'
                    ? ' Assessment help does not reveal the diagnosis, scenario-specific targets, or answer key.'
                    : ` ${copy.description}`}
                </p>
              </section>
            ) : null}

            {engineNotice ? (
              <p className={styles.engineNotice} role="status">
                {engineNotice}
              </p>
            ) : null}

            {!storageReady ? (
              <section className={styles.resumeBanner} aria-live="polite">
                <div>
                  <span className={styles.panelKicker}>Local session check</span>
                  <h2>Checking for a resumable synthetic session…</h2>
                  <p>
                    Only the versioned command replay and bounded progress record are stored
                    locally.
                  </p>
                </div>
              </section>
            ) : savedSession ? (
              <section className={styles.resumeBanner} aria-labelledby="resume-session-title">
                <div>
                  <span className={styles.panelKicker}>Saved synthetic session</span>
                  <h2 id="resume-session-title">
                    {savedSession.replay.mode === 'assess'
                      ? 'Unclassified assessment course'
                      : getIcuScenario(savedSession.replay.scenarioId).shortTitle}
                  </h2>
                  <p>
                    A validated {savedSession.replay.mode} session is available on this device.
                    Resume its semantic command replay or start a fresh course. No patient truth,
                    waveform arrays, notes, or free text are stored.
                  </p>
                </div>
                <div className={styles.resumeActions}>
                  {savedSession.replay.mode === mode ? (
                    <button type="button" disabled={restoringSession} onClick={resumeSavedSession}>
                      <Play aria-hidden="true" />
                      {restoringSession ? 'Restoring saved session…' : 'Resume saved session'}
                    </button>
                  ) : (
                    <Link href={modeHref(savedSession.replay.mode)}>
                      Open {savedSession.replay.mode} to resume
                    </Link>
                  )}
                  <button
                    type="button"
                    data-secondary="true"
                    disabled={restoringSession}
                    onClick={() => {
                      discardSavedSession()
                      initializeSession(createSession(initialScenario, mode, state.seed + 1))
                      setHelpVisible(false)
                    }}
                  >
                    Start new session
                  </button>
                </div>
              </section>
            ) : (
              <>
                {embedded ? null : (
                  <section className={styles.caseSelector} aria-labelledby="case-selector-title">
                    <header>
                      <div>
                        <span className={styles.panelKicker}>Patient census</span>
                        <h2 id="case-selector-title">Choose a shock course</h2>
                      </div>
                      <span>
                        {availableScenarios.length} scenario families ·{' '}
                        {progress.completedScenarioIds.length} completed ·{' '}
                        {progress.masteredScenarioIds.length} mastered
                      </span>
                    </header>
                    <div className={styles.caseRail}>
                      {displayedScenarios.map((candidate, index) => {
                        const selected = candidate.id === state.scenarioId
                        const concealed = mode === 'assess'
                        return (
                          <button
                            type="button"
                            key={candidate.id}
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => selectScenario(candidate)}
                          >
                            <span>{String(index + 1).padStart(2, '0')}</span>
                            <strong>
                              {concealed
                                ? `Assessment case ${String(index + 1).padStart(2, '0')}`
                                : candidate.shortTitle}
                            </strong>
                            <small>
                              {concealed
                                ? 'Timed course · classification withheld'
                                : `${candidate.durationHours} h · ${candidate.family.replaceAll('-', ' ')}`}
                            </small>
                            <ChevronRight aria-hidden="true" />
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )}

                <section className={styles.timeDock} aria-label="Shared simulation clock">
                  <div className={styles.clockReadout}>
                    <span>SIMULATION TIME</span>
                    <time>{formatClock(state.clock.elapsedSeconds)}</time>
                  </div>
                  <div className={styles.transportControls}>
                    <button
                      type="button"
                      aria-pressed={simulationRunning}
                      disabled={state.phase === 'debrief' || courseWindowReached}
                      onClick={() => setRunning((value) => !value)}
                    >
                      {simulationRunning ? (
                        <Pause aria-hidden="true" />
                      ) : (
                        <Play aria-hidden="true" />
                      )}
                      {simulationRunning ? 'Pause' : 'Run'}
                    </button>
                    <label>
                      <span>Speed</span>
                      <select
                        value={speed}
                        onChange={(event) =>
                          setSpeed(Number(event.target.value) as SimulationSpeed)
                        }
                      >
                        <option value={1}>1×</option>
                        <option value={5}>5×</option>
                        <option value={30}>30×</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={state.phase === 'debrief' || courseWindowReached}
                      onClick={() => dispatch({ type: 'time.advance', seconds: 60 })}
                    >
                      +1 min
                    </button>
                    <button
                      type="button"
                      disabled={state.phase === 'debrief' || courseWindowReached}
                      onClick={() => dispatch({ type: 'time.advance', seconds: 900 })}
                    >
                      +15 min
                    </button>
                    <button type="button" onClick={resetSession}>
                      <RotateCcw aria-hidden="true" /> Reset
                    </button>
                  </div>
                  <span className={styles.engineStatus}>
                    <i aria-hidden="true" data-active={workerActive || undefined} />
                    {workerActive ? 'Background worker active' : 'Main-thread fallback active'}
                  </span>
                  {courseWindowReached && state.phase !== 'debrief' ? (
                    <span className={styles.engineStatus} role="status">
                      Authored course window reached · complete the course to open the debrief
                    </span>
                  ) : null}
                  <p className={styles.srOnly} aria-live="polite">
                    {lastEvent
                      ? `${formatClock(lastEvent.elapsedSeconds)}: ${lastEvent.label}`
                      : 'Session ready'}
                  </p>
                </section>

                <IcuAlarmCenter state={state} dispatch={dispatch} />

                <nav className={styles.mobileSurfaceNav} aria-label="Choose bedside workspace">
                  {(Object.keys(surfaceCopy) as MobileSurface[]).map((surface) => {
                    const item = surfaceCopy[surface]
                    const Icon = item.Icon
                    return (
                      <button
                        type="button"
                        key={surface}
                        aria-pressed={mobileSurface === surface}
                        onClick={() => setMobileSurface(surface)}
                      >
                        <Icon aria-hidden="true" />
                        <span>
                          <strong>{item.label}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </button>
                    )
                  })}
                </nav>

                <div className={styles.workspace}>
                  <section
                    className={styles.workspaceSurface}
                    data-surface="monitor"
                    data-mobile-visible={mobileSurface === 'monitor'}
                    aria-label="Patient monitor and bedside overview"
                  >
                    <IcuPatientMonitor
                      state={state}
                      concealSyntheticId={assessmentDiagnosisHidden}
                    />
                    <IcuBedsideScene state={state} />
                  </section>

                  <section
                    className={styles.workspaceSurface}
                    data-surface="clinical"
                    data-mobile-visible={mobileSurface === 'clinical'}
                    aria-label="Diagnostic and care actions"
                  >
                    <IcuDiagnosticsPanel state={state} scenario={scenario} dispatch={dispatch} />
                    {mode === 'sandbox' ? (
                      <IcuSandboxControls state={state} dispatch={dispatch} />
                    ) : null}
                    <IcuCarePanel
                      state={state}
                      scenario={scenario}
                      dispatch={dispatch}
                      controlsLocked={interventionControlsLocked}
                      neutralLocked={assessmentAwaitingDiagnosis}
                    />
                  </section>

                  <section
                    className={styles.workspaceSurface}
                    data-surface="devices"
                    data-mobile-visible={mobileSurface === 'devices'}
                    aria-label="Device controls"
                  >
                    <IcuDevicePanels
                      state={state}
                      scenario={scenario}
                      dispatch={dispatch}
                      controlsLocked={interventionControlsLocked}
                      neutralLocked={assessmentAwaitingDiagnosis}
                    />
                  </section>

                  <section
                    id="icu-course-surface"
                    className={styles.workspaceSurface}
                    data-surface="course"
                    data-mobile-visible={mobileSurface === 'course'}
                    aria-label="Course guide and trends"
                    tabIndex={-1}
                  >
                    <IcuCaseGuide
                      state={state}
                      scenario={scenario}
                      mode={mode}
                      dispatch={dispatch}
                    />
                    <IcuTimelinePanel
                      state={state}
                      maskScenarioEvents={assessmentDiagnosisHidden}
                    />
                  </section>
                </div>

                {assessmentDiagnosisHidden ? null : <IcuSourceNotes scenario={scenario} />}
              </>
            )}
          </div>
        </div>
      </div>
    </ActivityChrome>
  )

  if (embedded) {
    return (
      <div className={styles.embeddedActivity} data-icu-activity-route="embedded">
        {activityChrome}
      </div>
    )
  }

  return (
    <div className={styles.icuActivityRoute} data-icu-activity-route="fixed">
      <SimulationLaunchGate
        activityTitle="Integrated ICU bedside simulator"
        minimumViewport="desktop"
        bandwidthClass="heavy"
        estimatedSizeLabel="Interactive bedside, device, and monitor assets"
        lightweightAlternativeHref="/icu-simulation"
        onSaveForLater={() => router.push('/critical-care' as Route)}
        theme="dark"
      >
        {activityChrome}
      </SimulationLaunchGate>
    </div>
  )
}
