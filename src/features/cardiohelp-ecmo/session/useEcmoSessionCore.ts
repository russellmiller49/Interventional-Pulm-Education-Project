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

import { resolveGuidedLesson } from '../components/stage/adapters/drillStageAdapter'
import { resolveScenarioDefinition } from '../components/PracticeCasePlayer'
import {
  capstoneScenarioIdForMode,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
} from '../content/curriculum'
import { cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import {
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  readLearningProgress,
  recordTopicVisit,
  selectScenarioOutcome,
  setLastCaseForMode,
  setLastLessonForMode,
  setLastStation,
  setLastVisited,
  writeLearningProgress,
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
/**
 * Shared ECMO simulation session: reducer, existing one-second clock, URL loaders and minimal
 * local topic locations. Grading/lifecycle analytics are disabled for self-paced entry. Legacy
 * records remain untouched inside the existing storage key. View state stays with each host.
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

  const scenario = useMemo(
    () => resolveScenarioDefinition(state.scenario.scenarioId),
    [state.scenario.scenarioId],
  )
  const learnLesson = useMemo(() => resolveGuidedLesson(learnScenarioId), [learnScenarioId])
  const outcome = useMemo(() => selectScenarioOutcome(state), [state])
  const supportMode: SupportMode = section === 'assess' ? assessTrack : state.supportMode
  const activityMode: EcmoActivityMode = section === 'learn' ? 'guided' : 'practice'
  const lifecycleActivityId =
    section === 'learn' ? `ecmo:learn:${learnLesson.scenarioId}` : `ecmo:${section}:${scenario.id}`
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'cardiohelp-ecmo',
    activityId: lifecycleActivityId,
    mode: activityMode,
    phase: semanticPhase,
    enabled: false,
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
      const updated = update(current)
      const next = updated.lastVisited ? recordTopicVisit(updated, updated.lastVisited) : updated
      writeLearningProgress(next)
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
      optionsRef.current.onLearnLessonLoaded?.(lesson, 'navigate', { requestedPhase: null })
    },
    [persistProgress, syncUrl],
  )

  const attemptInProgress = state.scenario.activityStarted && state.scenario.phase !== 'complete'

  const loadPracticeScenario = useCallback(
    (scenarioId: string, mode?: SimulationMode) => {
      const resolvedMode = mode === 'challenge' ? 'guided' : (mode ?? 'guided')
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
      optionsRef.current.onPracticeCaseLoaded?.(definition, 'navigate', { requestedPhase: null })
    },
    [persistProgress, section, syncUrl],
  )

  // Visits are saved on entry. Finishing a step never creates a grade or a completion record.
  const completeLearnLesson = useCallback(() => {}, [])

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
    },
    [loadLearnScenario, loadPracticeScenario, progress, section, supportMode],
  )

  useEffect(() => {
    const stored = readLearningProgress()
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
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: capstoneId, mode: 'guided' })
      syncUrl({ track })
      optionsRef.current.onPracticeCaseLoaded?.(
        resolveScenarioDefinition(capstoneId),
        'hydrate',
        context,
      )
    }
    const currentParams = new URLSearchParams(window.location.search)
    const currentTrack = parseTrack(currentParams.get('track')) ?? 'vv'
    const currentId =
      currentParams.get(section === 'learn' ? 'lesson' : 'case') ??
      capstoneScenarioIdForMode(currentTrack)
    const visited = recordTopicVisit(stored, {
      section,
      scenarioId: currentId,
      supportMode: currentTrack,
    })
    setProgress(visited)
    writeLearningProgress(visited)
    setHydrated(true)
    // The hydration pass intentionally runs once per section mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: 'TICK' }), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const revealDebrief = useCallback(() => {
    if (section !== 'learn') dispatch({ type: 'REVEAL_DEBRIEF' })
  }, [section])

  const saveAndExit = useCallback(() => {
    writeLearningProgress(progress)
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
