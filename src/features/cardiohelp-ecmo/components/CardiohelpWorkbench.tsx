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
import { GraduationCap, HeartPulse, Lock, Wind } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import { recordSiteModuleEvent } from '@/lib/analytics'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import {
  capstoneScenarioIdForMode,
  isTrackCapstoneUnlocked,
  orderedCaseScenarioIds,
  orderedLessonScenarioIds,
  remainingCapstonePrerequisites,
} from '../content/curriculum'
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
  type ModuleSection,
  type ProgressV2,
  type SupportMode,
} from '../engine'
import { CardiohelpConsole } from './CardiohelpConsole'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { LearnLessonPlayer, resolveGuidedLesson } from './LearnLessonPlayer'
import { PracticeCasePlayer, resolveScenarioDefinition } from './PracticeCasePlayer'
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
  const [hydrated, setHydrated] = useState(false)
  const lastAudibleAlarmId = useRef<string | null>(null)

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
  const capstoneUnlocked = isTrackCapstoneUnlocked(progress, supportMode)
  const assessLocked = section === 'assess' && !capstoneUnlocked
  const activeGuidedTarget =
    section === 'learn' ? guidedTarget : (latestPracticeHint?.target ?? null)
  const activeGuidedControlId =
    section === 'learn' ? guidedControlId : (latestPracticeHint?.controlId ?? null)
  const controlsEnabled = section === 'learn' || state.scenario.prediction.committed

  const handleGuidedTargetChange = useCallback((target: GuidedTarget) => {
    setGuidedTarget(target)
  }, [])
  const handleGuidedControlHelpChange = useCallback((controlId: GuidedControlId | null) => {
    setGuidedControlId(controlId)
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
      setGuidedTarget(lesson.steps[0]?.target ?? 'console')
      setGuidedControlId(null)
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
      setGuidedControlId(null)
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: definition.id, mode: resolvedMode })
      const isCapstone = definition.hiddenUntilAssessment === true
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
    },
    [persistProgress, progress],
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
        if (isTrackCapstoneUnlocked(progress, nextMode)) {
          loadPracticeScenario(capstoneScenarioIdForMode(nextMode), 'guided')
        } else {
          syncUrl({ track: nextMode })
        }
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
      syncUrl({ case: initialCase, track })
    } else {
      const track = trackParam ?? stored.lastVisited?.supportMode ?? 'vv'
      setAssessTrack(track)
      if (isTrackCapstoneUnlocked(stored, track)) {
        dispatch({
          type: 'LOAD_SCENARIO',
          scenarioId: capstoneScenarioIdForMode(track),
          mode: 'guided',
        })
      }
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
    if (
      section === 'learn' ||
      state.scenario.reassessment === null ||
      state.scenario.phase === 'complete'
    )
      return
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

  const completedLearnLessonIds = useMemo(
    () => new Set(progress.completedLearnLessonIds),
    [progress.completedLearnLessonIds],
  )
  const remainingPrerequisites = assessLocked
    ? remainingCapstonePrerequisites(progress, supportMode)
    : []

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

  return (
    <CardiohelpModuleFrame locale={locale} activeHref={sectionHref} headerExtra={trackToggle}>
      <section
        className={styles.experiencePanel}
        aria-label={`CARDIOHELP ${section} workbench`}
        data-hydrated={hydrated}
      >
        {assessLocked ? (
          <div className={styles.capstoneLockedPanel} role="status">
            <Lock aria-hidden="true" />
            <div>
              <h2>{supportMode.toUpperCase()} capstone is locked</h2>
              <p>
                The capstone is an unseen scored scenario. Complete every{' '}
                {supportMode.toUpperCase()} lesson to unlock it—{remainingPrerequisites.length}{' '}
                {remainingPrerequisites.length === 1 ? 'lesson remains' : 'lessons remain'}.
              </p>
              <ul>
                {remainingPrerequisites.map((prerequisite) => (
                  <li key={prerequisite.scenarioId}>
                    <Link
                      href={{
                        pathname: `${cardiohelpEcmoNavBase}/learn`,
                        query: { lesson: prerequisite.scenarioId, track: supportMode },
                      }}
                    >
                      <GraduationCap aria-hidden="true" /> {prerequisite.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className={styles.workbench}>
            {section === 'learn' ? (
              <LearnLessonPlayer
                key={learnLesson.id}
                state={state}
                lesson={learnLesson}
                completedLessonIds={completedLearnLessonIds}
                dispatch={dispatch}
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
              />
            ) : (
              <PracticeCasePlayer
                state={state}
                scenario={scenario}
                progress={progress}
                outcome={outcome}
                dispatch={dispatch}
                onLoadScenario={loadPracticeScenario}
                onReveal={revealDebrief}
                section={section === 'assess' ? 'assess' : 'practice'}
              />
            )}
            <div className={styles.simulatorColumn}>
              {!controlsEnabled ? (
                <div className={styles.simulatorLockBanner} role="status">
                  <Lock aria-hidden="true" />
                  <span>
                    <strong>Console locked</strong> — commit your plan to unlock all simulator
                    controls.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const target =
                        document.getElementById('practice-plan') ??
                        document.getElementById('practice-stage-rail')
                      if (!target) return
                      const reduceMotion =
                        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
                      target.focus({ preventScroll: true })
                      target.scrollIntoView?.({
                        behavior: reduceMotion ? 'auto' : 'smooth',
                        block: 'start',
                      })
                    }}
                  >
                    Go to plan
                  </button>
                </div>
              ) : null}
              <CardiohelpConsole
                state={state}
                dispatch={dispatch}
                controlsEnabled={controlsEnabled}
                guidedTarget={activeGuidedTarget}
                guidedControlId={activeGuidedControlId}
                initiationTargets={
                  section !== 'learn' ? (scenario.clinicalCase?.initiationTargets ?? null) : null
                }
              />
              <CircuitAndMonitors
                state={state}
                dispatch={dispatch}
                controlsEnabled={controlsEnabled}
                guidedTarget={activeGuidedTarget}
                guidedControlId={activeGuidedControlId}
                initiationTargets={
                  section !== 'learn' ? (scenario.clinicalCase?.initiationTargets ?? null) : null
                }
              />
            </div>
          </div>
        )}
      </section>
    </CardiohelpModuleFrame>
  )
}
