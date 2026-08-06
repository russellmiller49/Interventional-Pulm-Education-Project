'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { HeartPulse, Wind } from 'lucide-react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { Link, useRouter } from '@/i18n/navigation'
import { recordSiteModuleEvent } from '@/lib/analytics'
import {
  useCriticalCareActivityAnalytics,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import {
  capstoneScenarioIdForMode,
  isTrackCapstoneUnlocked,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
} from '../content/curriculum'
import { cardiohelpEvidence } from '../content/evidence'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import {
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  readProgress,
  recordLearnLessonCompleted,
  recordScenarioResult,
  selectScenarioOutcome,
  setLastCaseForMode,
  setLastLessonForMode,
  setLastStation,
  setLastVisited,
  withMastery,
  writeProgress,
  type EcmoSimulationState,
  type GuidedControlId,
  type GuidedTarget,
  type GuidedWalkthroughStep,
  type ModuleSection,
  type ProgressV2,
  type SupportMode,
} from '../engine'
import { CardiohelpConsole } from './CardiohelpConsole'
import { formatChannelGroup } from './channelReadout'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { EcmoLearnWorkspace } from './EcmoLearnWorkspace'
import { FitWidthSurface } from './FitWidthSurface'
import { resolveGuidedLesson } from './LearnLessonPlayer'
import {
  PracticeCasePlayer,
  resolveScenarioDefinition,
  type EcmoPracticeStage,
} from './PracticeCasePlayer'
import { CardiohelpModuleFrame } from './CardiohelpModuleFrame'
import styles from './cardiohelp-ecmo.module.css'

const MODULE_ID = 'cardiohelp-ecmo'
const REQUIRED_SCENARIO_IDS_BY_MODE: Readonly<Record<SupportMode, readonly string[]>> = {
  vv: orderedCaseScenarioIds('vv'),
  va: orderedCaseScenarioIds('va'),
}

function hasModeMastery(progress: ProgressV2, supportMode: SupportMode): boolean {
  return REQUIRED_SCENARIO_IDS_BY_MODE[supportMode].every(
    (id) =>
      progress.completedLabs.includes(id) &&
      (progress.bestScores[id] ?? 0) >= 80 &&
      progress.criticalErrorStatus[id] !== true,
  )
}

function parseTrack(value: string | null): SupportMode | null {
  return value === 'vv' || value === 'va' ? value : null
}

interface CardiohelpWorkbenchProps {
  section: ModuleSection
  locale?: string
}

export function CardiohelpWorkbench({ section, locale = 'en' }: CardiohelpWorkbenchProps) {
  const router = useRouter()
  const [state, dispatch] = useReducer(ecmoSimulationReducer, undefined, () =>
    createInitialSimulationState(),
  )
  const [progress, setProgress] = useState<ProgressV2>(createDefaultProgress)
  const [learnScenarioId, setLearnScenarioId] = useState(() => orderedLessonScenarioIds('vv')[0])
  const [assessTrack, setAssessTrack] = useState<SupportMode>('vv')
  const [guidedTarget, setGuidedTarget] = useState<GuidedTarget | null>(
    section === 'learn' ? 'circuit' : null,
  )
  const [guidedControlId, setGuidedControlId] = useState<GuidedControlId | null>(null)
  const [activeLearnStep, setActiveLearnStep] = useState<GuidedWalkthroughStep>(
    () => resolveGuidedLesson(orderedLessonScenarioIds('vv')[0]).steps[0],
  )
  const [activePracticeStage, setActivePracticeStage] = useState<EcmoPracticeStage>('brief')
  const [phaseRequest, setPhaseRequest] = useState<{
    readonly stage: EcmoPracticeStage
    readonly requestId: number
  } | null>(null)
  const [semanticPhase, setSemanticPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [helpVisible, setHelpVisible] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const lastAudibleAlarmId = useRef<string | null>(null)
  const recordedHintEvents = useRef({ activityId: '', ids: new Set<string>() })
  const recordedSafetyEvents = useRef({ activityId: '', ids: new Set<string>() })

  const scenario = useMemo(
    () => resolveScenarioDefinition(state.scenario.scenarioId),
    [state.scenario.scenarioId],
  )
  const learnLesson = useMemo(() => resolveGuidedLesson(learnScenarioId), [learnScenarioId])
  const outcome = useMemo(() => selectScenarioOutcome(state), [state])
  const latestPracticeHint = useMemo(
    () =>
      [...(scenario.hints ?? [])]
        .reverse()
        .find((hint) => state.scenario.usedHintIds.includes(hint.id)),
    [scenario.hints, state.scenario.usedHintIds],
  )
  const supportMode: SupportMode = section === 'assess' ? assessTrack : state.supportMode
  const activeGuidedTarget =
    section === 'learn' ? guidedTarget : (latestPracticeHint?.target ?? null)
  const activeGuidedControlId =
    section === 'learn' ? guidedControlId : (latestPracticeHint?.controlId ?? null)
  const activityMode =
    section === 'learn'
      ? ('guided' as const)
      : section === 'assess' || state.simulationMode === 'challenge'
        ? ('challenge' as const)
        : ('practice' as const)
  const lifecycleActivityId =
    section === 'learn' ? `ecmo:learn:${learnLesson.scenarioId}` : `ecmo:${section}:${scenario.id}`
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'cardiohelp-ecmo',
    activityId: lifecycleActivityId,
    mode: activityMode,
    phase: semanticPhase,
    enabled: hydrated,
  })
  const catalogActivity = criticalCareActivityById.get(lifecycleActivityId)

  const handleGuidedTargetChange = useCallback((target: GuidedTarget) => {
    setGuidedTarget(target)
  }, [])
  const handleGuidedControlHelpChange = useCallback((controlId: GuidedControlId | null) => {
    setGuidedControlId(controlId)
  }, [])
  const handleActiveLearnStepChange = useCallback((step: GuidedWalkthroughStep) => {
    setActiveLearnStep(step)
  }, [])
  const handleActivePracticeStageChange = useCallback((stage: EcmoPracticeStage) => {
    setActivePracticeStage(stage)
  }, [])

  const syncUrl = useCallback((query: Record<string, string>) => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.search = new URLSearchParams(query).toString()
    window.history.replaceState(null, '', url)
  }, [])

  const persistProgress = useCallback((update: (current: ProgressV2) => ProgressV2) => {
    setProgress((current) => {
      const next = update(current)
      writeProgress(next)
      return next
    })
  }, [])

  const loadLearnScenario = useCallback(
    (scenarioId: string) => {
      const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
      if (!lesson) return
      setLearnScenarioId(lesson.scenarioId)
      setHelpVisible(false)
      setGuidedTarget(lesson.steps[0]?.target ?? 'console')
      setGuidedControlId(null)
      if (lesson.steps[0]) setActiveLearnStep(lesson.steps[0])
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: lesson.scenarioId, mode: 'guided' })
      persistProgress((current) =>
        setLastVisited(setLastLessonForMode(current, lesson.supportMode, lesson.scenarioId), {
          section: 'learn',
          scenarioId: lesson.scenarioId,
          supportMode: lesson.supportMode,
        }),
      )
      syncUrl({ lesson: lesson.scenarioId, track: lesson.supportMode })
      recordSiteModuleEvent({
        eventType: 'module_interaction',
        moduleId: MODULE_ID,
        section: 'learn',
        eventPayload: {
          interaction: 'guided_lesson_loaded',
          scenarioId: lesson.scenarioId,
          supportMode: lesson.supportMode,
          experience: 'learn',
        },
      })
    },
    [persistProgress, syncUrl],
  )

  const attemptInProgress =
    state.scenario.prediction.committed && state.scenario.phase !== 'complete'

  const currentSimulationMode = state.simulationMode
  const loadPracticeScenario = useCallback(
    (scenarioId: string, mode?: EcmoSimulationState['simulationMode']) => {
      const resolvedMode = mode ?? currentSimulationMode
      if (
        section !== 'learn' &&
        attemptInProgress &&
        !window.confirm('This will discard your current case attempt. Start over?')
      ) {
        return
      }
      const definition = resolveScenarioDefinition(scenarioId)
      setHelpVisible(false)
      setGuidedControlId(null)
      setActivePracticeStage(definition.clinicalCase ? 'brief' : 'plan')
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: definition.id, mode: resolvedMode })
      const isCapstone = section === 'assess'
      persistProgress((current) => {
        const withStation = setLastStation(current, definition.stationId)
        const withCase = isCapstone
          ? withStation
          : setLastCaseForMode(withStation, definition.supportMode, definition.id)
        return setLastVisited(withCase, {
          section: isCapstone ? 'assess' : 'practice',
          scenarioId: definition.id,
          supportMode: definition.supportMode,
        })
      })
      if (isCapstone) {
        syncUrl({ track: definition.supportMode })
      } else {
        syncUrl({ case: definition.id, track: definition.supportMode })
      }
      recordSiteModuleEvent({
        eventType: 'module_interaction',
        moduleId: MODULE_ID,
        section: definition.stationId,
        eventPayload: {
          interaction: 'practice_scenario_loaded',
          scenarioId: definition.id,
          supportMode: definition.supportMode,
          experience: 'practice',
          simulationMode: resolvedMode,
        },
      })
    },
    [attemptInProgress, currentSimulationMode, persistProgress, section, syncUrl],
  )

  const completeLearnLesson = useCallback(
    (scenarioId: string) => {
      const lessonSupportMode = resolveScenarioDefinition(scenarioId).supportMode
      const wasUnlocked = isTrackCapstoneUnlocked(progress, lessonSupportMode)
      const nowUnlocked = isTrackCapstoneUnlocked(
        recordLearnLessonCompleted(progress, scenarioId),
        lessonSupportMode,
      )
      persistProgress((current) => recordLearnLessonCompleted(current, scenarioId))
      if (!wasUnlocked && nowUnlocked) {
        recordSiteModuleEvent({
          eventType: 'section_completed',
          moduleId: MODULE_ID,
          section: `${lessonSupportMode}:capstone-unlocked`,
          eventPayload: {
            completionId: `cardiohelp-ecmo-${lessonSupportMode}-capstone-unlocked-v1`,
            supportMode: lessonSupportMode,
            experience: 'learn',
          },
        })
      }
      recordSiteModuleEvent({
        eventType: 'module_interaction',
        moduleId: MODULE_ID,
        section: 'learn',
        eventPayload: {
          interaction: 'guided_walkthrough_completed',
          scenarioId,
          supportMode: lessonSupportMode,
          experience: 'learn',
        },
      })
      lifecycleAnalytics.recordGoalMet()
      lifecycleAnalytics.recordActivityCompleted()
    },
    [lifecycleAnalytics, persistProgress, progress],
  )

  const selectTrack = useCallback(
    (nextMode: SupportMode) => {
      if (nextMode === supportMode) return
      if (section === 'learn') {
        const validLessons = orderedLessonScenarioIds(nextMode)
        const stored = progress.lastLessonScenarioIdByMode[nextMode]
        loadLearnScenario(stored && validLessons.includes(stored) ? stored : validLessons[0])
      } else if (section === 'practice') {
        const validCases = orderedCaseScenarioIds(nextMode)
        const stored = progress.lastCaseScenarioIdByMode[nextMode]
        loadPracticeScenario(
          stored && validCases.includes(stored) ? stored : validCases[0],
          'guided',
        )
      } else {
        setAssessTrack(nextMode)
        loadPracticeScenario(capstoneScenarioIdForMode(nextMode), 'challenge')
      }
      recordSiteModuleEvent({
        eventType: 'module_interaction',
        moduleId: MODULE_ID,
        section: `${nextMode}:${section}`,
        eventPayload: {
          interaction: 'support_mode_selected',
          supportMode: nextMode,
          experience: section,
        },
      })
    },
    [loadLearnScenario, loadPracticeScenario, progress, section, supportMode, syncUrl],
  )

  useEffect(() => {
    const stored = readProgress()
    setProgress(stored)
    const params = new URLSearchParams(window.location.search)
    const trackParam = parseTrack(params.get('track'))

    if (section === 'learn') {
      const lessonParam = params.get('lesson')
      const paramTrack =
        trackParam ??
        (lessonParam && orderedLessonScenarioIds('va').includes(lessonParam)
          ? 'va'
          : lessonParam && orderedLessonScenarioIds('vv').includes(lessonParam)
            ? 'vv'
            : null)
      const track = paramTrack ?? stored.lastVisited?.supportMode ?? 'vv'
      const validLessons = orderedLessonScenarioIds(track)
      const storedLesson = stored.lastLessonScenarioIdByMode[track]
      const initialLesson =
        lessonParam && validLessons.includes(lessonParam)
          ? lessonParam
          : storedLesson && validLessons.includes(storedLesson)
            ? storedLesson
            : validLessons[0]
      setLearnScenarioId(initialLesson)
      const lesson = cardiohelpLearnLessonByScenarioId.get(initialLesson)
      setGuidedTarget(lesson?.steps[0]?.target ?? 'circuit')
      if (lesson?.steps[0]) setActiveLearnStep(lesson.steps[0])
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: initialLesson, mode: 'guided' })
      syncUrl({ lesson: initialLesson, track })
    } else if (section === 'practice') {
      const caseParam = params.get('case')
      const paramTrack =
        trackParam ??
        (caseParam && orderedCaseScenarioIds('va').includes(caseParam)
          ? 'va'
          : caseParam && orderedCaseScenarioIds('vv').includes(caseParam)
            ? 'vv'
            : null)
      const track = paramTrack ?? stored.lastVisited?.supportMode ?? 'vv'
      const validCases = orderedCaseScenarioIds(track)
      const storedCase = stored.lastCaseScenarioIdByMode[track]
      const initialCase =
        caseParam && validCases.includes(caseParam)
          ? caseParam
          : storedCase && validCases.includes(storedCase)
            ? storedCase
            : validCases[0]
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: initialCase, mode: 'guided' })
      setActivePracticeStage(resolveScenarioDefinition(initialCase).clinicalCase ? 'brief' : 'plan')
      syncUrl({ case: initialCase, track })
    } else {
      const track = trackParam ?? stored.lastVisited?.supportMode ?? 'vv'
      setAssessTrack(track)
      dispatch({
        type: 'LOAD_SCENARIO',
        scenarioId: capstoneScenarioIdForMode(track),
        mode: 'challenge',
      })
      setActivePracticeStage('plan')
      syncUrl({ track })
    }
    setHydrated(true)
    // The hydration pass intentionally runs once per section mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!state.scenario.prediction.committed) return
    lifecycleAnalytics.recordPredictionSubmitted()
  }, [lifecycleAnalytics, state.scenario.prediction.committed])

  useEffect(() => {
    if (recordedHintEvents.current.activityId !== lifecycleActivityId) {
      recordedHintEvents.current = { activityId: lifecycleActivityId, ids: new Set() }
    }
    for (const hintId of state.scenario.usedHintIds) {
      if (recordedHintEvents.current.ids.has(hintId)) continue
      recordedHintEvents.current.ids.add(hintId)
      lifecycleAnalytics.recordHintUsed()
    }
  }, [lifecycleActivityId, lifecycleAnalytics, state.scenario.usedHintIds])

  useEffect(() => {
    if (recordedSafetyEvents.current.activityId !== lifecycleActivityId) {
      recordedSafetyEvents.current = { activityId: lifecycleActivityId, ids: new Set() }
    }
    for (const error of state.scenario.criticalErrors) {
      if (recordedSafetyEvents.current.ids.has(error)) continue
      recordedSafetyEvents.current.ids.add(error)
      lifecycleAnalytics.recordSafetyEvent()
    }
  }, [lifecycleActivityId, lifecycleAnalytics, state.scenario.criticalErrors])

  useEffect(() => {
    const alarm =
      state.alarms.find((candidate) => candidate.acknowledgedAt === undefined) ?? state.alarms[0]
    const acknowledgedPauseActive =
      alarm?.acknowledgedAt !== undefined &&
      (state.device.alarmPausedUntil ?? 0) > state.simulationTime
    if (acknowledgedPauseActive) {
      lastAudibleAlarmId.current = null
      return
    }
    if (!state.device.alarmAudioEnabled || !alarm || alarm.id === lastAudibleAlarmId.current) {
      return
    }
    lastAudibleAlarmId.current = alarm.id
    try {
      const AudioContextClass = window.AudioContext
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value =
        alarm.priority === 'high' ? 880 : alarm.priority === 'medium' ? 660 : 520
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.18)
      oscillator.addEventListener('ended', () => void context.close(), { once: true })
    } catch {
      // Audio is optional; visual and text alarm communication remains complete.
    }
  }, [
    state.alarms,
    state.device.alarmAudioEnabled,
    state.device.alarmPausedUntil,
    state.simulationTime,
  ])

  function revealDebrief() {
    if (section === 'learn' || state.scenario.phase === 'complete') return
    lifecycleAnalytics.recordDebriefViewed()
    if (outcome.mastery) lifecycleAnalytics.recordGoalMet()
    lifecycleAnalytics.recordActivityCompleted(outcome.mastery)
    dispatch({ type: 'REVEAL_DEBRIEF' })
    setProgress((current) => {
      const withResult = recordScenarioResult(current, {
        scenarioId: scenario.id,
        score: outcome.score,
        criticalError: outcome.criticalErrors.length > 0,
        completed: true,
      })
      // The stored mastery boolean retains its original VV meaning; VA mastery is derived by ID.
      const next = withMastery(withResult, REQUIRED_SCENARIO_IDS_BY_MODE.vv)
      writeProgress(next)
      const modeScenarios = REQUIRED_SCENARIO_IDS_BY_MODE[scenario.supportMode]
      const modeCompletedCount = modeScenarios.filter((id) =>
        next.completedLabs.includes(id),
      ).length
      const modePercentComplete = Math.round((modeCompletedCount / modeScenarios.length) * 100)
      const modeWasMastered = hasModeMastery(current, scenario.supportMode)
      const modeIsMastered = hasModeMastery(next, scenario.supportMode)
      const moduleWasMastered = hasModeMastery(current, 'vv') && hasModeMastery(current, 'va')
      const moduleIsMastered = hasModeMastery(next, 'vv') && hasModeMastery(next, 'va')
      const aggregateCompletedCount = clinicalPracticeScenarios.filter((item) =>
        next.completedLabs.includes(item.id),
      ).length
      const rawAggregatePercent = Math.round(
        (aggregateCompletedCount / clinicalPracticeScenarios.length) * 100,
      )
      const aggregatePercentComplete = moduleIsMastered ? 100 : Math.min(rawAggregatePercent, 99)

      recordSiteModuleEvent({
        eventType: 'quiz_submitted',
        moduleId: MODULE_ID,
        section: `${scenario.supportMode}:${scenario.stationId}`,
        percentComplete: aggregatePercentComplete,
        eventPayload: {
          scenarioId: scenario.id,
          supportMode: scenario.supportMode,
          experience: 'practice',
          score: outcome.score,
          criticalErrorCount: outcome.criticalErrors.length,
          roundMastery: outcome.mastery,
          modeMastery: modeIsMastered,
          modePercentComplete,
          aggregatePercentComplete,
        },
      })

      const stationScenarioIds = clinicalPracticeScenarios
        .filter(
          (item) =>
            item.stationId === scenario.stationId && item.supportMode === scenario.supportMode,
        )
        .map((item) => item.id)
      const stationWasComplete = stationScenarioIds.every((id) =>
        current.completedLabs.includes(id),
      )
      const stationIsComplete = stationScenarioIds.every((id) => next.completedLabs.includes(id))
      if (!stationWasComplete && stationIsComplete) {
        recordSiteModuleEvent({
          eventType: 'section_completed',
          moduleId: MODULE_ID,
          section: `${scenario.supportMode}:${scenario.stationId}`,
          eventPayload: {
            completionId: `${scenario.supportMode}-${scenario.stationId}-complete`,
            supportMode: scenario.supportMode,
            experience: 'practice',
          },
        })
      }
      if (!modeWasMastered && modeIsMastered) {
        recordSiteModuleEvent({
          eventType: 'section_completed',
          moduleId: MODULE_ID,
          section: `${scenario.supportMode}:mastery`,
          eventPayload: {
            completionId: `cardiohelp-ecmo-${scenario.supportMode}-mastery-v1`,
            supportMode: scenario.supportMode,
            experience: 'practice',
            modePercentComplete: 100,
          },
        })
      }
      if (!moduleWasMastered && moduleIsMastered) {
        recordSiteModuleEvent({
          eventType: 'module_completed',
          moduleId: MODULE_ID,
          percentComplete: 100,
          eventPayload: {
            completionId: 'cardiohelp-ecmo-vv-va-mastery-v1',
            supportMode: scenario.supportMode,
            experience: 'practice',
            masteredSupportModes: ['vv', 'va'],
          },
        })
      }
      return next
    })
  }

  const handleTrackKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const nextMode =
      event.key === 'Home'
        ? 'vv'
        : event.key === 'End'
          ? 'va'
          : event.key === 'ArrowRight' ||
              event.key === 'ArrowDown' ||
              event.key === 'ArrowLeft' ||
              event.key === 'ArrowUp'
            ? supportMode === 'vv'
              ? 'va'
              : 'vv'
            : null
    if (!nextMode) return
    event.preventDefault()
    selectTrack(nextMode)
  }

  const trackToggle = (
    <div className={styles.trackToggle} role="radiogroup" aria-label="ECMO support mode">
      <button
        type="button"
        role="radio"
        aria-checked={supportMode === 'vv'}
        tabIndex={supportMode === 'vv' ? 0 : -1}
        data-active={supportMode === 'vv'}
        onKeyDown={handleTrackKeyDown}
        onClick={() => selectTrack('vv')}
      >
        <Wind aria-hidden="true" /> VV track
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={supportMode === 'va'}
        tabIndex={supportMode === 'va' ? 0 : -1}
        data-active={supportMode === 'va'}
        onKeyDown={handleTrackKeyDown}
        onClick={() => selectTrack('va')}
      >
        <HeartPulse aria-hidden="true" /> VA track
      </button>
    </div>
  )

  const sectionHref =
    section === 'learn'
      ? `${cardiohelpEcmoNavBase}/learn`
      : section === 'practice'
        ? `${cardiohelpEcmoNavBase}/practice`
        : `${cardiohelpEcmoNavBase}/assess`
  const activityTitle = section === 'learn' ? learnLesson.title : scenario.title
  const workspaceTitle = `${supportMode.toUpperCase()} ${
    section === 'assess' ? 'challenge' : section
  } workspace`
  const practiceTask = (() => {
    if (activePracticeStage === 'brief') {
      return {
        objective:
          'Review the observable patient, indication, support configuration, and baseline.',
        requiredAction:
          'Open the case brief, then begin when the patient and circuit context are clear.',
      }
    }
    if (activePracticeStage === 'plan') {
      return {
        objective: scenario.clinicalCase?.decisionPrompt ?? 'Commit the immediate ECMO goal.',
        requiredAction:
          'Choose the immediate goal, the control or bedside action, and the expected direction before acting.',
      }
    }
    if (activePracticeStage === 'manage') {
      return {
        objective: scenario.clinicalCase?.decisionPrompt ?? scenario.summary,
        requiredAction: scenario.debrief.correctWorkflow[0] ?? 'Resolve the modeled cause safely.',
      }
    }
    if (activePracticeStage === 'reassess') {
      return {
        objective: 'Reconcile the response across device, circuit or gas path, and patient.',
        requiredAction:
          'Submit a device, circuit/gas, and patient reassessment before opening the debrief.',
      }
    }
    return {
      objective: 'Explain the causal chain and identify the next transfer target.',
      requiredAction: 'Review the safety events, causal debrief, and recommended next case.',
    }
  })()
  const currentObjective = section === 'learn' ? activeLearnStep.title : practiceTask.objective
  const currentTargets =
    section === 'learn' ? [activeLearnStep.actionLabel] : [practiceTask.requiredAction]
  const currentRequiredAction =
    section === 'learn' ? activeLearnStep.instruction : practiceTask.requiredAction
  const currentHint =
    activityMode === 'challenge'
      ? undefined
      : section === 'learn'
        ? activeLearnStep.rationale
        : (latestPracticeHint?.text ?? scenario.hints?.[0]?.text)
  const visibleEvidenceIds = scenario.evidenceIds
  const evidenceEntries = cardiohelpEvidence
    .filter((entry) => visibleEvidenceIds.includes(entry.id))
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      sourceLabel: `${entry.citation}${entry.pages ? ` · ${entry.pages}` : ''}`,
      limitation: entry.limitations,
    }))
  const progressLabel = `${supportMode.toUpperCase()} ${
    section === 'assess' ? 'challenge' : section
  } · personal history stays local`

  function saveAndExit() {
    writeProgress(progress)
    router.push(cardiohelpEcmoNavBase)
  }

  function resetActivity() {
    if (section === 'learn') loadLearnScenario(learnLesson.scenarioId)
    else loadPracticeScenario(scenario.id, state.simulationMode)
  }

  function focusRestoredActivity() {
    document.getElementById('ecmo-activity-viewport')?.focus({ preventScroll: true })
  }

  function selectActivityPhase(phase: CriticalCareActivityPhase) {
    setSemanticPhase(phase)
    if (section === 'learn') {
      window.requestAnimationFrame(focusRestoredActivity)
      return
    }
    const stage: EcmoPracticeStage =
      phase === 'recognize'
        ? 'brief'
        : phase === 'predict'
          ? 'plan'
          : phase === 'act'
            ? 'manage'
            : phase === 'observe'
              ? 'reassess'
              : 'debrief'
    setActivePracticeStage(stage)
    setPhaseRequest((current) => ({ stage, requestId: (current?.requestId ?? 0) + 1 }))
  }

  function showHelp() {
    if (!helpVisible && activityMode !== 'challenge') lifecycleAnalytics.recordHintUsed()
    setHelpVisible(true)
  }

  /*
   * The one live simulator, built once.
   *
   * Learn hands this node to the three-pane workspace and Practice/Assess render it beside the case
   * player. Constructing a second copy for the workspace would put a second set of guided control
   * ids in the document, and both the guided help targeting and the practice hint focus resolve
   * controls by id — so `document.getElementById` would start returning whichever came first.
   */
  const consoleNode = (
    <CardiohelpConsole
      state={state}
      dispatch={dispatch}
      controlsEnabled
      guidedTarget={activeGuidedTarget}
      guidedControlId={activeGuidedControlId}
      initiationTargets={
        section !== 'learn' ? (scenario.clinicalCase?.initiationTargets ?? null) : null
      }
    />
  )

  const simulatorColumn = (
    <div className={styles.simulatorColumn}>
      {/*
        Learn puts the console in a workspace pane, and the console's device grid cannot lay out
        narrower than about 840px of `min-content`. The widest validated viewport gives that pane
        roughly 650px, so before this the right-hand column of the facsimile — the physical control
        panel, the power indicators, and the "simulated values" badge that says the numbers are not a
        device reading — was cut off by 200px or more with `overflow-x: hidden` and no way to reach
        it. Scaling is what the foundation route already does, and for the same reason.

        Only the console is scaled. The circuit view, gas panel, patient monitor and trend panel have
        `min-content` widths of 159–366px, so they lay out in any of these panes; shrinking their
        prose to fit a constraint they do not have would cost readability for nothing.

        Practice and Assess render this column beside the case player in a different arrangement and
        are deliberately left exactly as they were.
      */}
      {section === 'learn' ? (
        <FitWidthSurface label="CARDIOHELP console, scaled to fit the width of this panel">
          {consoleNode}
        </FitWidthSurface>
      ) : (
        consoleNode
      )}
      <CircuitAndMonitors
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={activeGuidedTarget}
        guidedControlId={activeGuidedControlId}
        initiationTargets={
          section !== 'learn' ? (scenario.clinicalCase?.initiationTargets ?? null) : null
        }
        onSaveForLater={() => router.push(cardiohelpEcmoNavBase)}
      />
    </div>
  )

  return (
    <CardiohelpModuleFrame
      locale={locale}
      activeHref={sectionHref}
      headerExtra={trackToggle}
      activityMode
    >
      <ActivityShell
        layout="native-workbench"
        activityId={lifecycleActivityId}
        assumedConceptIds={catalogActivity?.assumedConceptIds}
        breadcrumb={
          <>
            <Link href={cardiohelpEcmoNavBase}>ECMO Management</Link>
            {' / '}
            {section}
          </>
        }
        activityTitle={workspaceTitle}
        phase={semanticPhase}
        mode={activityMode}
        progressLabel={progressLabel}
        stepperAriaLabel="ECMO shared activity phases"
        onPhaseSelect={selectActivityPhase}
        theme="dark"
        patientContext={
          <>
            <PatientContextBar
              items={[
                {
                  label: 'Mode / indication',
                  value: `${supportMode.toUpperCase()} · ${
                    scenario.clinicalCase?.setting ?? `${scenario.clinicalPhase} support`
                  }`,
                },
                {
                  label: 'Cannulation / configuration',
                  value:
                    supportMode === 'vv'
                      ? 'Venous drainage → oxygenator → venous return'
                      : 'Venous drainage → oxygenator → arterial return',
                },
                {
                  label: 'Flow / RPM',
                  value: `${state.circuit.bloodFlow.toFixed(2)} L/min · ${state.device.rpmSetpoint} RPM`,
                },
                {
                  label: 'Drainage / pre-oxygenator / return',
                  value: formatChannelGroup(
                    [
                      state.circuit.readouts.pVen,
                      state.circuit.readouts.pInt,
                      state.circuit.readouts.pArt,
                    ],
                    'mm Hg',
                  ).text,
                },
                {
                  label: 'Oxygenator ΔP',
                  value: formatChannelGroup([state.circuit.readouts.deltaP], 'mm Hg').text,
                },
                {
                  label: 'Sweep / circuit FdO₂',
                  value: `${state.gas.sweepLpm.toFixed(1)} L/min · ${Math.round(state.gas.fio2 * 100)}%`,
                },
                {
                  label: supportMode === 'va' ? 'Right arm / femoral SpO₂' : 'Patient SpO₂',
                  value:
                    supportMode === 'va'
                      ? `${state.patient.rightRadialSpo2.toFixed(1)}% / ${state.patient.femoralArterialSpo2.toFixed(1)}%`
                      : `${state.patient.spo2.toFixed(1)}%`,
                },
                {
                  label: 'ABG / MAP',
                  value: `pH ${state.patient.pH.toFixed(2)} · PaCO₂ ${state.patient.paCO2.toFixed(0)} · MAP ${state.patient.meanArterialPressure.toFixed(0)}`,
                },
                {
                  label: 'Active alarm / limitation',
                  value:
                    state.alarms.find((alarm) => alarm.active)?.message ??
                    (state.gas.sourceConnected
                      ? 'No active modeled alarm'
                      : 'Sweep-gas source disconnected'),
                },
              ]}
              immediateGoal={currentObjective}
              safetyConstraints={[
                'Use an independent patient review alongside console and circuit data.',
                'Follow current manufacturer instructions, ELSO guidance, and local policy.',
              ]}
            />
            {hydrated && progress.lastVisited ? (
              <ResumeBanner
                state="ready"
                title={section === 'learn' ? 'Return to saved lesson' : 'Return to saved case'}
                description={`${activityTitle} is open in the saved ${progress.lastVisited.supportMode.toUpperCase()} track; prior controls and answers were not replayed.`}
                onResume={focusRestoredActivity}
                resumeActionLabel={section === 'learn' ? 'Return to lesson' : 'Return to case'}
              />
            ) : null}
          </>
        }
        currentTask={
          <TaskPanel
            objective={currentObjective}
            requiredAction={currentRequiredAction}
            targets={currentTargets}
            hint={currentHint}
            mode={activityMode}
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          >
            {helpVisible ? (
              <p role="note">
                Open Reference or Evidence below for the existing safety guidance, source scope, and
                model limits.
              </p>
            ) : null}
          </TaskPanel>
        }
        onHelp={showHelp}
        onReset={resetActivity}
        onSaveAndExit={saveAndExit}
        bottomContent={progressLabel}
        secondaryActions={
          <>
            <ReferenceDrawer
              entries={[
                {
                  id: scenario.id,
                  title: activityTitle,
                  summary: scenario.summary,
                  meta: `${supportMode.toUpperCase()} · ${scenario.stationId}`,
                },
              ]}
              trigger={<button type="button">Reference</button>}
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={<button type="button">Evidence</button>}
            />
          </>
        }
        viewport={
          <div id="ecmo-activity-viewport" className={styles.activityViewport} tabIndex={-1}>
            <section
              className={styles.experiencePanel}
              aria-label={`CARDIOHELP ${section} workbench`}
              data-hydrated={hydrated}
            >
              <div className={styles.workbench} data-learn-workspace={section === 'learn'}>
                {section === 'learn' ? (
                  <EcmoLearnWorkspace
                    state={state}
                    lesson={learnLesson}
                    dispatch={dispatch}
                    simulator={simulatorColumn}
                    onSelectLesson={loadLearnScenario}
                    onCompleteLesson={completeLearnLesson}
                    onTryPractice={(scenarioId) =>
                      router.push({
                        pathname: `${cardiohelpEcmoNavBase}/practice`,
                        query: { case: scenarioId, track: supportMode },
                      })
                    }
                    onTargetChange={handleGuidedTargetChange}
                    onControlHelpChange={handleGuidedControlHelpChange}
                    onPhaseChange={setSemanticPhase}
                    onActiveStepChange={handleActiveLearnStepChange}
                  />
                ) : (
                  <>
                    <PracticeCasePlayer
                      state={state}
                      scenario={scenario}
                      progress={progress}
                      outcome={outcome}
                      dispatch={dispatch}
                      onLoadScenario={loadPracticeScenario}
                      onReveal={revealDebrief}
                      section={section === 'assess' ? 'assess' : 'practice'}
                      phaseRequest={phaseRequest}
                      onPhaseChange={setSemanticPhase}
                      onActiveStageChange={handleActivePracticeStageChange}
                    />
                    {simulatorColumn}
                  </>
                )}
              </div>
              {section !== 'learn' && state.scenario.phase === 'complete' ? (
                <DebriefPanel
                  clinicalModel={scenario.debrief.diagnosis}
                  actions={state.history
                    .filter((entry) => entry.kind === 'action')
                    .map((entry) => entry.label)}
                  consequences={scenario.debrief.causalChain}
                  performanceDomains={[
                    {
                      label: 'Safety review',
                      result:
                        outcome.criticalErrors.length === 0
                          ? 'No safety stop appeared in this run'
                          : 'Revisit the interrupted action and its cue',
                    },
                    { label: 'Causal chain', result: 'Compare actions with the modeled response' },
                    { label: 'Reassessment', result: 'Reconnect device, circuit, and patient' },
                  ]}
                  transfer={<p>{scenario.debrief.correctWorkflow.join(' ')}</p>}
                  replay={
                    <button type="button" onClick={resetActivity}>
                      Replay this case
                    </button>
                  }
                />
              ) : null}
            </section>
          </div>
        }
      />
    </CardiohelpModuleFrame>
  )
}
