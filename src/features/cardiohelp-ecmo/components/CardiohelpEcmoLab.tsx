'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  BadgeCheck,
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
  HeartPulse,
  Languages,
  LockKeyhole,
  ShieldAlert,
  SlidersHorizontal,
  Stethoscope,
  Wind,
} from 'lucide-react'

import { HandoffContent } from '@/i18n/handoff'
import { recordSiteModuleEvent } from '@/lib/analytics'

import { cardiohelpDeviceProfile, cardiohelpEcmoPublicationStatus } from '../content/deviceProfile'
import {
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessonsBySupportMode,
} from '../content/learnLessons'
import {
  clinicalPracticeScenarios,
  clinicalPracticeScenariosBySupportMode,
} from '../content/clinicalCases'
import {
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  readProgress,
  recordScenarioResult,
  selectScenarioOutcome,
  setLastStation,
  withMastery,
  writeProgress,
  type GuidedControlId,
  type GuidedTarget,
  type LearningExperience,
  type ProgressV1,
  type SupportMode,
} from '../engine'
import { CardiohelpConsole } from './CardiohelpConsole'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { LearnWorkflow, resolveGuidedLesson } from './LearnWorkflow'
import { LearningWorkflow, resolveScenarioDefinition } from './LearningWorkflow'
import { SourcesPanel } from './SourcesPanel'
import styles from './cardiohelp-ecmo.module.css'

const MODULE_ID = 'cardiohelp-ecmo'
const REQUIRED_SCENARIO_IDS_BY_MODE: Readonly<Record<SupportMode, readonly string[]>> = {
  vv: clinicalPracticeScenariosBySupportMode.vv.map((scenario) => scenario.id),
  va: clinicalPracticeScenariosBySupportMode.va.map((scenario) => scenario.id),
}
const FIRST_LEARN_SCENARIO_ID_BY_MODE: Readonly<Record<SupportMode, string>> = {
  vv: cardiohelpLearnLessonsBySupportMode.vv[0].scenarioId,
  va: cardiohelpLearnLessonsBySupportMode.va[0].scenarioId,
}
const FIRST_PRACTICE_SCENARIO_ID_BY_MODE: Readonly<Record<SupportMode, string>> = {
  vv: clinicalPracticeScenariosBySupportMode.vv[0].id,
  va: clinicalPracticeScenariosBySupportMode.va[0].id,
}

function hasModeMastery(progress: ProgressV1, supportMode: SupportMode): boolean {
  return REQUIRED_SCENARIO_IDS_BY_MODE[supportMode].every(
    (id) =>
      progress.completedLabs.includes(id) &&
      (progress.bestScores[id] ?? 0) >= 80 &&
      progress.criticalErrorStatus[id] !== true,
  )
}

function reducedMotionRequested(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

interface CardiohelpEcmoLabProps {
  locale?: string
}

export default function CardiohelpEcmoLab({ locale = 'en' }: CardiohelpEcmoLabProps) {
  const [state, dispatch] = useReducer(ecmoSimulationReducer, undefined, () =>
    createInitialSimulationState(),
  )
  const [progress, setProgress] = useState<ProgressV1>(createDefaultProgress)
  const [experience, setExperience] = useState<LearningExperience>('learn')
  const [learnScenarioId, setLearnScenarioId] = useState(FIRST_LEARN_SCENARIO_ID_BY_MODE.vv)
  const [completedLearnLessonIds, setCompletedLearnLessonIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [guidedTarget, setGuidedTarget] = useState<GuidedTarget | null>('circuit')
  const [guidedControlId, setGuidedControlId] = useState<GuidedControlId | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const lastAudibleAlarmId = useRef<string | null>(null)
  const lastPracticeScenarioId = useRef<Record<SupportMode, string>>({
    vv: FIRST_PRACTICE_SCENARIO_ID_BY_MODE.vv,
    va: FIRST_PRACTICE_SCENARIO_ID_BY_MODE.va,
  })
  const lastLearnScenarioId = useRef<Record<SupportMode, string>>({
    vv: FIRST_LEARN_SCENARIO_ID_BY_MODE.vv,
    va: FIRST_LEARN_SCENARIO_ID_BY_MODE.va,
  })
  const experiencePanelRef = useRef<HTMLElement>(null)
  const supportModeButtonRefs = useRef<Partial<Record<SupportMode, HTMLButtonElement | null>>>({})
  const experienceButtonRefs = useRef<
    Partial<Record<LearningExperience, HTMLButtonElement | null>>
  >({})
  const scenario = useMemo(
    () => resolveScenarioDefinition(state.scenario.scenarioId),
    [state.scenario.scenarioId],
  )
  const learnLesson = useMemo(() => resolveGuidedLesson(learnScenarioId), [learnScenarioId])
  const outcome = useMemo(() => selectScenarioOutcome(state), [state])
  const supportMode = state.supportMode
  const modeScenarios = clinicalPracticeScenariosBySupportMode[supportMode]
  const modeLearnLessons = cardiohelpLearnLessonsBySupportMode[supportMode]
  const controlsEnabled = experience === 'learn' || state.scenario.prediction.committed
  const practicePercentComplete = Math.round(
    (modeScenarios.filter((item) => progress.completedLabs.includes(item.id)).length /
      modeScenarios.length) *
      100,
  )
  const learnPercentComplete = Math.round(
    (modeLearnLessons.filter((item) => completedLearnLessonIds.has(item.scenarioId)).length /
      modeLearnLessons.length) *
      100,
  )
  const modeMastery = hasModeMastery(progress, supportMode)
  const percentComplete = experience === 'learn' ? learnPercentComplete : practicePercentComplete
  const handleGuidedTargetChange = useCallback((target: GuidedTarget) => {
    setGuidedTarget(target)
  }, [])
  const handleGuidedControlHelpChange = useCallback((controlId: GuidedControlId | null) => {
    setGuidedControlId(controlId)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readProgress()
      const initialScenario =
        clinicalPracticeScenariosBySupportMode.vv.find(
          (item) => item.stationId === stored.lastStation,
        ) ?? clinicalPracticeScenariosBySupportMode.vv[0]
      lastPracticeScenarioId.current.vv = initialScenario.id
      setProgress(stored)
      dispatch({
        type: 'LOAD_SCENARIO',
        scenarioId: FIRST_LEARN_SCENARIO_ID_BY_MODE.vv,
        mode: 'guided',
      })
      setHydrated(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

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

  function focusExperiencePanel() {
    window.requestAnimationFrame(() => {
      experiencePanelRef.current?.focus({ preventScroll: true })
      experiencePanelRef.current?.scrollIntoView?.({
        behavior: reducedMotionRequested() ? 'auto' : 'smooth',
        block: 'start',
      })
    })
  }

  function handleSupportModeKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentMode: SupportMode,
  ) {
    const nextMode =
      event.key === 'Home'
        ? 'vv'
        : event.key === 'End'
          ? 'va'
          : event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? currentMode === 'vv'
              ? 'va'
              : 'vv'
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? currentMode === 'vv'
                ? 'va'
                : 'vv'
              : null
    if (!nextMode) return
    event.preventDefault()
    selectSupportMode(nextMode)
    window.requestAnimationFrame(() => supportModeButtonRefs.current[nextMode]?.focus())
  }

  function handleExperienceKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentExperience: LearningExperience,
  ) {
    const nextExperience =
      event.key === 'Home'
        ? 'learn'
        : event.key === 'End'
          ? 'practice'
          : event.key === 'ArrowRight' || event.key === 'ArrowDown'
            ? currentExperience === 'learn'
              ? 'practice'
              : 'learn'
            : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
              ? currentExperience === 'learn'
                ? 'practice'
                : 'learn'
              : null
    if (!nextExperience) return
    event.preventDefault()
    if (nextExperience === 'learn') openLearn()
    else openPractice()
    window.requestAnimationFrame(() => experienceButtonRefs.current[nextExperience]?.focus())
  }

  function loadPracticeScenario(
    scenarioId: string,
    mode: typeof state.simulationMode = state.simulationMode,
  ) {
    const definition = resolveScenarioDefinition(scenarioId)
    setGuidedControlId(null)
    lastPracticeScenarioId.current[definition.supportMode] = definition.id
    dispatch({ type: 'LOAD_SCENARIO', scenarioId: definition.id, mode })
    setProgress((current) => {
      const next = setLastStation(current, definition.stationId)
      writeProgress(next)
      return next
    })
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: definition.stationId,
      eventPayload: {
        interaction: 'practice_scenario_loaded',
        scenarioId: definition.id,
        supportMode: definition.supportMode,
        experience: 'practice',
        simulationMode: mode,
      },
    })
  }

  function loadLearnScenario(scenarioId: string) {
    const lesson = cardiohelpLearnLessonByScenarioId.get(scenarioId)
    if (!lesson) return
    lastLearnScenarioId.current[lesson.supportMode] = lesson.scenarioId
    setLearnScenarioId(lesson.scenarioId)
    setGuidedTarget(lesson.steps[0]?.target ?? 'console')
    setGuidedControlId(null)
    dispatch({ type: 'LOAD_SCENARIO', scenarioId: lesson.scenarioId, mode: 'guided' })
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
  }

  function completeLearnLesson(scenarioId: string) {
    setCompletedLearnLessonIds((current) => new Set(current).add(scenarioId))
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: 'learn',
      eventPayload: {
        interaction: 'guided_walkthrough_completed',
        scenarioId,
        supportMode: resolveScenarioDefinition(scenarioId).supportMode,
        experience: 'learn',
      },
    })
  }

  function openLearn() {
    if (experience === 'learn') return
    setExperience('learn')
    loadLearnScenario(lastLearnScenarioId.current[supportMode])
    focusExperiencePanel()
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: 'learn',
      eventPayload: {
        interaction: 'experience_selected',
        experience: 'learn',
        supportMode,
      },
    })
  }

  function openPractice(scenarioId = lastPracticeScenarioId.current[supportMode]) {
    setExperience('practice')
    setGuidedTarget(null)
    setGuidedControlId(null)
    loadPracticeScenario(scenarioId, 'guided')
    focusExperiencePanel()
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: 'practice',
      eventPayload: {
        interaction: 'experience_selected',
        experience: 'practice',
        supportMode: resolveScenarioDefinition(scenarioId).supportMode,
      },
    })
  }

  function selectSupportMode(nextMode: SupportMode) {
    if (nextMode === supportMode) return
    if (experience === 'learn') {
      loadLearnScenario(lastLearnScenarioId.current[nextMode])
    } else {
      loadPracticeScenario(lastPracticeScenarioId.current[nextMode], 'guided')
    }
    focusExperiencePanel()
    recordSiteModuleEvent({
      eventType: 'module_interaction',
      moduleId: MODULE_ID,
      section: `${nextMode}:${experience}`,
      eventPayload: {
        interaction: 'support_mode_selected',
        supportMode: nextMode,
        experience,
      },
    })
  }

  function revealDebrief() {
    if (
      experience !== 'practice' ||
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
      // ProgressV1.mastery retains its original VV meaning; VA mastery is derived by ID.
      const next = withMastery(withResult, REQUIRED_SCENARIO_IDS_BY_MODE.vv)
      writeProgress(next)
      const modeCompletedCount = modeScenarios.filter((item) =>
        next.completedLabs.includes(item.id),
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

  return (
    <HandoffContent>
      <main
        className={styles.moduleShell}
        data-hydrated={hydrated}
        data-no-handoff-translate={locale !== 'en'}
      >
        <header className={styles.hero}>
          <div className={styles.heroBackdrop} aria-hidden="true" />
          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>
              <span>Adult {supportMode.toUpperCase()} ECMO</span>
              <span>CARDIOHELP-i</span>
              <span>Learn → Practice → reassess</span>
            </div>
            <h1>CARDIOHELP-i Console & Troubleshooting Lab</h1>
            <p>
              Select VV or peripheral VA, learn each reasoning sequence with step-by-step guidance,
              then enter Practice to manage evolving clinical cases in which console, circuit, gas,
              and bedside interventions change the patient trajectory.
            </p>
            <div className={styles.heroBadges}>
              <span>
                <LockKeyhole aria-hidden="true" />{' '}
                {cardiohelpEcmoPublicationStatus === 'published'
                  ? 'Authenticated reviewed release'
                  : 'Authenticated draft'}
              </span>
              {cardiohelpEcmoPublicationStatus === 'published' ? (
                <span>
                  <BadgeCheck aria-hidden="true" /> Clinical + device review approved
                </span>
              ) : (
                <>
                  <span>
                    <ClipboardCheck aria-hidden="true" /> Device review pending
                  </span>
                  <span>
                    <Stethoscope aria-hidden="true" /> Adult ECMO review pending
                  </span>
                </>
              )}
            </div>
            {locale !== 'en' ? (
              <div className={styles.englishFallback} data-no-handoff-translate={true} role="note">
                <Languages aria-hidden="true" />
                Reviewed English content fallback: Spanish and Simplified Chinese clinical
                translations are not yet approved.
              </div>
            ) : null}
          </div>
          <div className={styles.heroScoreCard}>
            <span>
              {experience === 'learn'
                ? `${supportMode.toUpperCase()} guided learning · this session`
                : `${supportMode.toUpperCase()} Practice progress · local non-PHI`}
            </span>
            <strong>{percentComplete}%</strong>
            <div
              role="progressbar"
              aria-label={`${supportMode.toUpperCase()} ${experience === 'learn' ? 'Learn' : 'Practice'} progress`}
              aria-valuenow={percentComplete}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${percentComplete}%` }} />
            </div>
            <small>
              {experience === 'learn'
                ? `${modeLearnLessons.filter((item) => completedLearnLessonIds.has(item.scenarioId)).length} of ${modeLearnLessons.length} walkthroughs reviewed`
                : `${modeScenarios.filter((item) => progress.completedLabs.includes(item.id)).length} of ${modeScenarios.length} rounds completed`}
            </small>
            <em data-mastery={experience === 'practice' && modeMastery}>
              {experience === 'learn' ? (
                <GraduationCap aria-hidden="true" />
              ) : modeMastery ? (
                <BadgeCheck aria-hidden="true" />
              ) : (
                <BookOpenCheck aria-hidden="true" />
              )}
              {experience === 'learn'
                ? 'Unscored guidance; Practice remains clean'
                : modeMastery
                  ? `${supportMode.toUpperCase()} mastery recorded`
                  : 'Mastery: ≥80% each, no critical error'}
            </em>
          </div>
        </header>

        <section className={styles.safetyBanner} aria-label="Educational safety boundary">
          <ShieldAlert aria-hidden="true" />
          <div>
            <strong>
              Professional education only—not a clinical device, digital twin, certification, or
              patient-specific guide.
            </strong>
            <span>
              This independent educational module is not manufactured, sponsored, or endorsed by
              Getinge. Follow current manufacturer instructions, ELSO guidance, local protocols,
              hands-on competency requirements, and supervised multidisciplinary judgment. All
              physiologic values are simulated.
            </span>
          </div>
        </section>

        <section className={styles.profileStrip} aria-label="Locked device profile">
          <span>
            <strong>Profile</strong> {cardiohelpDeviceProfile.displayName}
          </span>
          <span>
            <strong>U.S. IFU</strong> rev {cardiohelpDeviceProfile.ifuRevision} ·{' '}
            {cardiohelpDeviceProfile.ifuDate}
          </span>
          <span>
            <strong>Software</strong> ≥{cardiohelpDeviceProfile.minimumSoftwareVersion}
          </span>
          <span>
            <strong>thApp</strong> {cardiohelpDeviceProfile.thApp}
          </span>
          <span>
            <strong>Curriculum</strong> VV + peripheral VA · draft review
          </span>
        </section>

        <section className={styles.supportModeSwitch} aria-labelledby="support-mode-heading">
          <div className={styles.experienceIntro}>
            <span className={styles.kicker}>1 · Choose the circuit configuration</span>
            <h2 id="support-mode-heading">
              Select VV or peripheral VA before choosing Learn or Practice
            </h2>
            <p>
              The console workflow is shared, but the return vessel, patient physiology, independent
              monitoring, lessons, scenarios, capstone, and circuit schematic change with the mode.
            </p>
          </div>
          <div className={styles.supportModeTabs} role="radiogroup" aria-label="ECMO support mode">
            <button
              type="button"
              role="radio"
              ref={(node) => {
                supportModeButtonRefs.current.vv = node
              }}
              aria-checked={supportMode === 'vv'}
              tabIndex={supportMode === 'vv' ? 0 : -1}
              data-active={supportMode === 'vv'}
              onKeyDown={(event) => handleSupportModeKeyDown(event, 'vv')}
              onClick={() => selectSupportMode('vv')}
            >
              <Wind aria-hidden="true" />
              <span>
                <strong>VV ECMO</strong>
                <small>
                  Femoral vein drainage → pump + oxygenator → femoral vein return toward the right
                  atrium.
                </small>
              </span>
              <em>{supportMode === 'vv' ? 'Selected' : 'Choose VV'}</em>
            </button>
            <button
              type="button"
              role="radio"
              ref={(node) => {
                supportModeButtonRefs.current.va = node
              }}
              aria-checked={supportMode === 'va'}
              tabIndex={supportMode === 'va' ? 0 : -1}
              data-active={supportMode === 'va'}
              onKeyDown={(event) => handleSupportModeKeyDown(event, 'va')}
              onClick={() => selectSupportMode('va')}
            >
              <HeartPulse aria-hidden="true" />
              <span>
                <strong>Peripheral VA ECMO</strong>
                <small>
                  Femoral vein drainage → pump + oxygenator → femoral artery return toward the
                  aorta.
                </small>
              </span>
              <em>{supportMode === 'va' ? 'Selected' : 'Choose VA'}</em>
            </button>
          </div>
          <p className={styles.supportModeBoundary}>
            Femoral anatomy is schematic. VA cannulation, distal-perfusion procedures,
            unloading-device selection, and liberation protocols require supervised hands-on
            training and local review.
          </p>
        </section>

        <section className={styles.experienceSwitch} aria-labelledby="experience-heading">
          <div className={styles.experienceIntro}>
            <span className={styles.kicker}>2 · Choose your pathway</span>
            <h2 id="experience-heading">
              Enter {supportMode.toUpperCase()} Learn or {supportMode.toUpperCase()} Practice
            </h2>
            <p>
              Both pathways use the same console, circuit, gas, patient, alarm, and physiology
              engine. Switching pathways reloads a clean scenario so answer cues never carry into
              Practice.
            </p>
          </div>
          <div
            className={styles.experienceTabs}
            role="tablist"
            aria-label={`${supportMode.toUpperCase()} learning pathway`}
          >
            <button
              type="button"
              role="tab"
              ref={(node) => {
                experienceButtonRefs.current.learn = node
              }}
              id="experience-learn-tab"
              aria-selected={experience === 'learn'}
              aria-controls="cardiohelp-experience-panel"
              tabIndex={experience === 'learn' ? 0 : -1}
              data-active={experience === 'learn'}
              onKeyDown={(event) => handleExperienceKeyDown(event, 'learn')}
              onClick={openLearn}
            >
              <GraduationCap aria-hidden="true" />
              <span>
                <strong>{supportMode.toUpperCase()} Learn</strong>
                <small>
                  One step at a time: where to look, what to do, why it matters, and what should
                  change.
                </small>
              </span>
              <em>Guided · unscored</em>
            </button>
            <button
              type="button"
              role="tab"
              ref={(node) => {
                experienceButtonRefs.current.practice = node
              }}
              id="experience-practice-tab"
              aria-selected={experience === 'practice'}
              aria-controls="cardiohelp-experience-panel"
              tabIndex={experience === 'practice' ? 0 : -1}
              data-active={experience === 'practice'}
              onKeyDown={(event) => handleExperienceKeyDown(event, 'practice')}
              onClick={() => openPractice()}
            >
              <SlidersHorizontal aria-hidden="true" />
              <span>
                <strong>{supportMode.toUpperCase()} Practice</strong>
                <small>
                  Start ECMO when indicated or manage deterioration with machine, circuit,
                  resuscitation, medication, and procedural actions.
                </small>
              </span>
              <em>Clinical cases · scored</em>
            </button>
          </div>
        </section>

        <section
          id="cardiohelp-experience-panel"
          ref={experiencePanelRef}
          className={styles.experiencePanel}
          role="tabpanel"
          aria-labelledby={`experience-${experience}-tab`}
          tabIndex={-1}
        >
          <div className={styles.workbench}>
            {experience === 'learn' ? (
              <LearnWorkflow
                key={learnLesson.id}
                state={state}
                lesson={learnLesson}
                completedLessonIds={completedLearnLessonIds}
                dispatch={dispatch}
                onSelectLesson={loadLearnScenario}
                onCompleteLesson={completeLearnLesson}
                onTryPractice={openPractice}
                onTargetChange={handleGuidedTargetChange}
                onControlHelpChange={handleGuidedControlHelpChange}
              />
            ) : (
              <LearningWorkflow
                state={state}
                scenario={scenario}
                progress={progress}
                outcome={outcome}
                dispatch={dispatch}
                onLoadScenario={loadPracticeScenario}
                onReveal={revealDebrief}
              />
            )}
            <div className={styles.simulatorColumn}>
              <CardiohelpConsole
                state={state}
                dispatch={dispatch}
                controlsEnabled={controlsEnabled}
                guidedTarget={experience === 'learn' ? guidedTarget : null}
                guidedControlId={experience === 'learn' ? guidedControlId : null}
                initiationTargets={
                  experience === 'practice'
                    ? (scenario.clinicalCase?.initiationTargets ?? null)
                    : null
                }
              />
              <CircuitAndMonitors
                state={state}
                dispatch={dispatch}
                controlsEnabled={controlsEnabled}
                guidedTarget={experience === 'learn' ? guidedTarget : null}
                guidedControlId={experience === 'learn' ? guidedControlId : null}
                initiationTargets={
                  experience === 'practice'
                    ? (scenario.clinicalCase?.initiationTargets ?? null)
                    : null
                }
              />
            </div>
          </div>
        </section>

        <SourcesPanel publicationStatus={cardiohelpEcmoPublicationStatus} />
      </main>
    </HandoffContent>
  )
}
