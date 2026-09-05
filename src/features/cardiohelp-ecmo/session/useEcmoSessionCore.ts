'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import {
  useCriticalCareActivityAnalytics,
  type CriticalCareActivityLifecycleAnalytics,
  type CriticalCareActivityPhase,
} from '@/features/learning-module/activity'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { useRouter } from '@/i18n/navigation'
import { recordSiteModuleEvent } from '@/lib/analytics'

import { resolveGuidedLesson } from '../components/stage/adapters/drillStageAdapter'
import { resolveScenarioDefinition } from '../components/PracticeCasePlayer'
import {
  capstoneScenarioIdForMode,
  isTrackCapstoneUnlocked,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
} from '../content/curriculum'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
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
  type GuidedLessonDefinition,
  type ModuleSection,
  type ProgressV2,
  type ScenarioDefinition,
  type ScenarioOutcome,
  type SimulationAction,
  type SimulationMode,
  type SupportMode,
} from '../engine'
import {
  REQUIRED_SCENARIO_IDS_BY_MODE,
  capstoneUnlockedEvent,
  guidedLessonLoadedEvent,
  guidedWalkthroughCompletedEvent,
  practiceScenarioLoadedEvent,
  roundSubmittedEvents,
  supportModeSelectedEvent,
} from './ecmoSessionAnalytics'

/**
 * The one simulation session behind every ECMO activity surface.
 *
 * Owns the reducer, the progress envelope and its writes, hydration from the URL and storage, the
 * one-second clock, the lifecycle analytics contract, the debrief reveal with its site events, the
 * track switch, and the scenario loaders. It owns no view state: which panel is highlighted, which
 * stage is expanded, whether help is open — those belong to the surface that renders the session,
 * and the surface hears about scenario loads through the two optional callbacks so it can reset
 * them. Keeping the two apart is what lets the Learn stage and the Practice activity be different
 * compositions over identical persistence, URL and analytics behaviour.
 *
 * Contracts preserved from the workbench this was lifted out of: the storage key and envelope are
 * untouched (`engine/progress.ts`), the `?lesson=` / `?case=` / `?track=` query names and the
 * `history.replaceState` sync are unchanged, and every site event is built by
 * `ecmoSessionAnalytics.ts` so the strict `/api/analytics` schema sees the same shapes.
 */

export type EcmoActivityMode = 'guided' | 'practice' | 'challenge'
export type EcmoSessionLoadReason = 'hydrate' | 'navigate'

/** What the URL asked for at hydration, read before the canonical query is written back. */
export interface EcmoSessionLoadContext {
  readonly requestedPhase: string | null
}

export interface EcmoSessionCoreOptions {
  readonly section: ModuleSection
  /** Fired after a guided lesson is loaded, on hydration and on navigation. */
  readonly onLearnLessonLoaded?: (
    lesson: GuidedLessonDefinition,
    reason: EcmoSessionLoadReason,
    context: EcmoSessionLoadContext,
  ) => void
  /** Fired after a Practice case or a Challenge capstone is loaded, on hydration and on navigation. */
  readonly onPracticeCaseLoaded?: (
    definition: ScenarioDefinition,
    reason: EcmoSessionLoadReason,
    context: EcmoSessionLoadContext,
  ) => void
}

export interface EcmoSessionCore {
  readonly section: ModuleSection
  readonly state: EcmoSimulationState
  readonly dispatch: (action: SimulationAction) => void
  readonly scenario: ScenarioDefinition
  readonly outcome: ScenarioOutcome
  readonly supportMode: SupportMode
  readonly activityMode: EcmoActivityMode
  readonly hydrated: boolean
  /** True when the open case came from stored progress rather than the URL. */
  readonly resumedFromStorage: boolean
  readonly attemptInProgress: boolean
  readonly progress: ProgressV2
  readonly persistProgress: (update: (current: ProgressV2) => ProgressV2) => void
  readonly learnScenarioId: string
  readonly learnLesson: GuidedLessonDefinition
  readonly assessTrack: SupportMode
  readonly loadLearnScenario: (scenarioId: string) => void
  readonly loadPracticeScenario: (scenarioId: string, mode?: SimulationMode) => void
  readonly selectTrack: (nextMode: SupportMode) => void
  readonly completeLearnLesson: (scenarioId: string) => void
  readonly revealDebrief: () => void
  readonly saveAndExit: () => void
  readonly resetActivity: () => void
  readonly semanticPhase: CriticalCareActivityPhase
  readonly setSemanticPhase: (phase: CriticalCareActivityPhase) => void
  readonly lifecycleAnalytics: CriticalCareActivityLifecycleAnalytics
  readonly lifecycleActivityId: string
  readonly catalogActivity: ReturnType<typeof criticalCareActivityById.get>
}

function parseTrack(value: string | null): SupportMode | null {
  return value === 'vv' || value === 'va' ? value : null
}

export function useEcmoSessionCore(options: EcmoSessionCoreOptions): EcmoSessionCore {
  const { section } = options
  const router = useRouter()
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const [state, dispatch] = useReducer(ecmoSimulationReducer, undefined, () =>
    createInitialSimulationState(),
  )
  const [progress, setProgress] = useState<ProgressV2>(createDefaultProgress)
  const [learnScenarioId, setLearnScenarioId] = useState(() => orderedLessonScenarioIds('vv')[0])
  const [assessTrack, setAssessTrack] = useState<SupportMode>('vv')
  const [semanticPhase, setSemanticPhase] = useState<CriticalCareActivityPhase>('recognize')
  const [hydrated, setHydrated] = useState(false)
  const [resumedFromStorage, setResumedFromStorage] = useState(false)
  const recordedHintEvents = useRef({ activityId: '', ids: new Set<string>() })
  const recordedSafetyEvents = useRef({ activityId: '', ids: new Set<string>() })

  const scenario = useMemo(
    () => resolveScenarioDefinition(state.scenario.scenarioId),
    [state.scenario.scenarioId],
  )
  const learnLesson = useMemo(() => resolveGuidedLesson(learnScenarioId), [learnScenarioId])
  const outcome = useMemo(() => selectScenarioOutcome(state), [state])
  const supportMode: SupportMode = section === 'assess' ? assessTrack : state.supportMode
  const activityMode: EcmoActivityMode =
    section === 'learn'
      ? 'guided'
      : section === 'assess' || state.simulationMode === 'challenge'
        ? 'challenge'
        : 'practice'
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
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: lesson.scenarioId, mode: 'guided' })
      persistProgress((current) =>
        setLastVisited(setLastLessonForMode(current, lesson.supportMode, lesson.scenarioId), {
          section: 'learn',
          scenarioId: lesson.scenarioId,
          supportMode: lesson.supportMode,
        }),
      )
      syncUrl({ lesson: lesson.scenarioId, track: lesson.supportMode })
      recordSiteModuleEvent(guidedLessonLoadedEvent(lesson))
      optionsRef.current.onLearnLessonLoaded?.(lesson, 'navigate', { requestedPhase: null })
    },
    [persistProgress, syncUrl],
  )

  const attemptInProgress =
    state.scenario.prediction.committed && state.scenario.phase !== 'complete'

  const currentSimulationMode = state.simulationMode
  const loadPracticeScenario = useCallback(
    (scenarioId: string, mode?: SimulationMode) => {
      const resolvedMode = mode ?? currentSimulationMode
      if (
        section !== 'learn' &&
        attemptInProgress &&
        !window.confirm('This will discard your current case attempt. Start over?')
      ) {
        return
      }
      const definition = resolveScenarioDefinition(scenarioId)
      setResumedFromStorage(false)
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
      recordSiteModuleEvent(practiceScenarioLoadedEvent(definition, resolvedMode))
      optionsRef.current.onPracticeCaseLoaded?.(definition, 'navigate', { requestedPhase: null })
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
        recordSiteModuleEvent(capstoneUnlockedEvent(lessonSupportMode))
      }
      recordSiteModuleEvent(guidedWalkthroughCompletedEvent(scenarioId, lessonSupportMode))
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
      recordSiteModuleEvent(supportModeSelectedEvent(nextMode, section))
    },
    [loadLearnScenario, loadPracticeScenario, progress, section, supportMode],
  )

  useEffect(() => {
    const stored = readProgress()
    setProgress(stored)
    const params = new URLSearchParams(window.location.search)
    const trackParam = parseTrack(params.get('track'))
    const context: EcmoSessionLoadContext = { requestedPhase: params.get('phase') }

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
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: initialLesson, mode: 'guided' })
      syncUrl({ lesson: initialLesson, track })
      if (lesson) optionsRef.current.onLearnLessonLoaded?.(lesson, 'hydrate', context)
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
      const caseFromUrl = caseParam && validCases.includes(caseParam) ? caseParam : null
      const caseFromStorage = storedCase && validCases.includes(storedCase) ? storedCase : null
      const initialCase = caseFromUrl ?? caseFromStorage ?? validCases[0]
      setResumedFromStorage(caseFromUrl === null && caseFromStorage !== null)
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: initialCase, mode: 'guided' })
      syncUrl({ case: initialCase, track })
      optionsRef.current.onPracticeCaseLoaded?.(
        resolveScenarioDefinition(initialCase),
        'hydrate',
        context,
      )
    } else {
      const track = trackParam ?? stored.lastVisited?.supportMode ?? 'vv'
      const capstoneId = capstoneScenarioIdForMode(track)
      setAssessTrack(track)
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: capstoneId, mode: 'challenge' })
      syncUrl({ track })
      optionsRef.current.onPracticeCaseLoaded?.(
        resolveScenarioDefinition(capstoneId),
        'hydrate',
        context,
      )
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

  const revealDebrief = useCallback(() => {
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
      for (const event of roundSubmittedEvents({ current, next, scenario, outcome })) {
        recordSiteModuleEvent(event)
      }
      return next
    })
  }, [lifecycleAnalytics, outcome, scenario, section, state.scenario.phase])

  const saveAndExit = useCallback(() => {
    writeProgress(progress)
    router.push(cardiohelpEcmoNavBase)
  }, [progress, router])

  const resetActivity = useCallback(() => {
    if (section === 'learn') loadLearnScenario(learnLesson.scenarioId)
    else loadPracticeScenario(scenario.id, state.simulationMode)
  }, [
    learnLesson.scenarioId,
    loadLearnScenario,
    loadPracticeScenario,
    scenario.id,
    section,
    state.simulationMode,
  ])

  return {
    section,
    state,
    dispatch,
    scenario,
    outcome,
    supportMode,
    activityMode,
    hydrated,
    resumedFromStorage,
    attemptInProgress,
    progress,
    persistProgress,
    learnScenarioId,
    learnLesson,
    assessTrack,
    loadLearnScenario,
    loadPracticeScenario,
    selectTrack,
    completeLearnLesson,
    revealDebrief,
    saveAndExit,
    resetActivity,
    semanticPhase,
    setSemanticPhase,
    lifecycleAnalytics,
    lifecycleActivityId,
    catalogActivity,
  }
}
