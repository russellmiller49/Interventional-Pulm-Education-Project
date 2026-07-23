'use client'

import type { Route } from 'next'
import { useEffect, useReducer, useRef, useState } from 'react'
import { Check, LockKeyhole } from 'lucide-react'

import { recordSiteModuleEvent } from '@/lib/analytics'
import { recordCriticalCareActivitySelection } from '@/features/critical-care/progress/selection'
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
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { Link, useRouter } from '@/i18n/navigation'

import {
  MCS_ANALYTICS_MODULE_ID,
  isMcsCapstoneUnlocked,
  mcsCapstoneScenarios,
  mcsLessons,
  mcsPracticeScenarios,
  mcsSources,
  remainingMcsCapstoneRequirements,
} from '../content'
import {
  createDefaultMcsProgress,
  createInitialMcsState,
  hasMcsMastery,
  mcsProgressPercent,
  mcsReducer,
  readMcsProgress,
  recordMcsLessonComplete,
  recordMcsScenarioResult,
  writeMcsProgress,
  type McsDeviceKind,
  type McsModuleSection,
  type McsProgressV1,
} from '../engine'
import { McsAnatomy3D } from './McsAnatomy3D'
import { McsCaseWorkflow } from './McsCaseWorkflow'
import { McsControls } from './McsControls'
import { McsModuleFrame } from './McsModuleFrame'
import { McsMonitor } from './McsMonitor'
import { McsSourcesPanel } from './McsSourcesPanel'
import styles from './mechanical-circulatory-support.module.css'

const deviceLabels: Record<McsDeviceKind, { short: string; title: string; mechanism: string }> = {
  iabp: { short: 'IABP', title: 'Intra-aortic balloon pump', mechanism: 'Counterpulsation' },
  impella: {
    short: 'Impella',
    title: 'Impella CP / 5.5 / RP',
    mechanism: 'LV, RV, or biventricular support',
  },
  lvad: {
    short: 'LVAD',
    title: 'Durable continuous-flow LVAD',
    mechanism: 'Apical continuous flow',
  },
}

type MobileSurface = 'anatomy' | 'monitor' | 'controls' | 'workflow'

const semanticPhaseByMcsPhase: Readonly<
  Record<ReturnType<typeof createInitialMcsState>['scenarioPhase'], CriticalCareActivityPhase>
> = {
  inspect: 'recognize',
  predict: 'predict',
  adjust: 'act',
  observe: 'observe',
  reassess: 'explain',
  debrief: 'explain',
}

function scoreBand(score: number | null) {
  if (score === null) return 'not-scored'
  if (score >= 80) return '80-100'
  if (score >= 60) return '60-79'
  return 'below-60'
}

export function McsWorkbench({
  section,
  locale = 'en',
  initialDevice,
  initialActivityId,
}: {
  section: McsModuleSection
  locale?: string
  initialDevice?: McsDeviceKind
  initialActivityId?: string
}) {
  const router = useRouter()
  const requestedLesson =
    section === 'learn'
      ? mcsLessons.find((candidate) => candidate.id === initialActivityId)
      : undefined
  const requestedPractice =
    section === 'practice'
      ? mcsPracticeScenarios.find((candidate) => candidate.id === initialActivityId)
      : undefined
  const requestedCapstone =
    section === 'assess'
      ? mcsCapstoneScenarios.find((candidate) => candidate.id === initialActivityId)
      : undefined
  const requestedActivityDevice =
    requestedLesson?.device === 'shared'
      ? undefined
      : (requestedLesson?.device ?? requestedPractice?.device ?? requestedCapstone?.device)
  const activeInitialDevice = initialDevice ?? requestedActivityDevice ?? 'iabp'
  const initialLesson =
    requestedLesson ??
    (initialDevice
      ? (mcsLessons.find((candidate) => candidate.device === initialDevice) ?? mcsLessons[0])
      : mcsLessons[0])
  const initialCapstoneForDevice = mcsCapstoneScenarios.find(
    (candidate) => candidate.device === activeInitialDevice,
  )
  const [state, dispatch] = useReducer(mcsReducer, undefined, () => {
    const initial = createInitialMcsState(section, activeInitialDevice)
    return requestedPractice
      ? mcsReducer(initial, { type: 'LOAD_SCENARIO', scenario: requestedPractice })
      : initial
  })
  const [progress, setProgress] = useState<McsProgressV1>(createDefaultMcsProgress)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState(initialLesson.id)
  const [selectedActivityId, setSelectedActivityId] = useState(
    section === 'practice'
      ? (requestedPractice?.id ?? 'studio')
      : section === 'learn'
        ? initialLesson.id
        : (requestedCapstone?.id ?? initialCapstoneForDevice?.id ?? 'CAP-IABP-01'),
  )
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('anatomy')
  const [helpVisible, setHelpVisible] = useState(false)
  const recordedCompletion = useRef<string | null>(null)
  const recordedSafetyEvents = useRef(new Set<string>())
  const activeHref = `${mechanicalCirculatorySupportNavBase}/${section}`
  const lesson = mcsLessons.find((candidate) => candidate.id === selectedLessonId) ?? mcsLessons[0]
  const assessmentMasked = section === 'assess' && !state.completed
  const revealCausality = !assessmentMasked
  const activityMode =
    section === 'learn'
      ? ('guided' as const)
      : section === 'practice'
        ? ('practice' as const)
        : ('challenge' as const)
  const lifecycleActivityId =
    section === 'learn'
      ? `mcs:learn:${lesson.id}`
      : section === 'practice'
        ? `mcs:practice:${state.scenario?.id ?? `studio-${state.deviceKind}`}`
        : `mcs:assess:${state.scenario?.id ?? selectedActivityId}`
  const lifecyclePhase =
    section === 'learn' || !state.scenario
      ? ('recognize' as const)
      : semanticPhaseByMcsPhase[state.scenarioPhase]
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-circulatory-support',
    activityId: lifecycleActivityId,
    mode: activityMode,
    phase: lifecyclePhase,
    enabled: section !== 'assess' || state.scenario !== null,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setProgress(readMcsProgress())
      setProgressLoaded(true)
      if (requestedLesson) {
        recordCriticalCareActivitySelection(window.localStorage, {
          activityId: `mcs:learn:${requestedLesson.id}`,
          mode: 'guided',
          query: { lesson: requestedLesson.id },
          payloadVersion: 'mcs-selection-v1',
        })
      } else if (requestedPractice) {
        recordCriticalCareActivitySelection(window.localStorage, {
          activityId: `mcs:practice:${requestedPractice.id}`,
          mode: 'practice',
          query: { case: requestedPractice.id },
          scenarioId: requestedPractice.id,
          deviceId: requestedPractice.device,
          payloadVersion: 'mcs-selection-v1',
        })
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [requestedLesson, requestedPractice])

  useEffect(() => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(
      () => dispatch({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    recordSiteModuleEvent({
      eventType: state.completed ? 'section_completed' : 'module_interaction',
      moduleId: MCS_ANALYTICS_MODULE_ID,
      section,
      percentComplete: mcsProgressPercent(progress),
      eventPayload: {
        deviceTrack: state.deviceKind,
        station: selectedActivityId,
        completion: state.completed ? 'complete' : 'in-progress',
        scoreBand: scoreBand(state.score?.total ?? null),
      },
    })
  }, [progress, section, selectedActivityId, state.completed, state.deviceKind, state.score?.total])

  useEffect(() => {
    if (!progressLoaded || !state.completed || !state.scenario || !state.score) {
      if (!state.completed) recordedCompletion.current = null
      return
    }
    const key = `${state.scenario.id}:${state.score.total}:${state.criticalErrors.length}`
    if (recordedCompletion.current === key) return
    recordedCompletion.current = key
    const timer = window.setTimeout(() => {
      setProgress((current) => {
        const next = recordMcsScenarioResult(current, state)
        writeMcsProgress(next)
        return next
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [progressLoaded, state])

  useEffect(() => {
    if (!state.predictionCommitted) return
    lifecycleAnalytics.recordPredictionSubmitted()
  }, [lifecycleAnalytics, state.predictionCommitted])

  useEffect(() => {
    if (state.criticalErrors.length === 0) {
      recordedSafetyEvents.current.clear()
      return
    }
    for (const error of state.criticalErrors) {
      if (recordedSafetyEvents.current.has(error)) continue
      recordedSafetyEvents.current.add(error)
      lifecycleAnalytics.recordSafetyEvent()
    }
  }, [lifecycleAnalytics, state.criticalErrors])

  useEffect(() => {
    if (
      state.scenario &&
      state.scenario.requiredActionIds.length > 0 &&
      state.scenario.requiredActionIds.every((id) => state.actionIds.includes(id))
    ) {
      lifecycleAnalytics.recordGoalMet()
    }
  }, [lifecycleAnalytics, state.actionIds, state.scenario])

  useEffect(() => {
    if (!state.completed || !state.score) return
    lifecycleAnalytics.recordDebriefViewed()
    lifecycleAnalytics.recordActivityCompleted(hasMcsMastery(state))
  }, [lifecycleAnalytics, state])

  function openStudio(device: McsDeviceKind) {
    setHelpVisible(false)
    setSelectedActivityId('studio')
    dispatch({ type: 'OPEN_STUDIO', device })
  }

  function selectDevice(device: McsDeviceKind) {
    if (section === 'practice') return openStudio(device)
    if (section === 'assess') {
      const capstone = mcsCapstoneScenarios.find((candidate) => candidate.device === device)
      if (!capstone) return
      setSelectedActivityId(capstone.id)
      setHelpVisible(false)
      if (isMcsCapstoneUnlocked(progress, device))
        dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
      else dispatch({ type: 'OPEN_STUDIO', device })
      return
    }
    const deviceLesson = mcsLessons.find((candidate) => candidate.device === device)
    if (deviceLesson) {
      setHelpVisible(false)
      setSelectedLessonId(deviceLesson.id)
      setSelectedActivityId(deviceLesson.id)
      recordCriticalCareActivitySelection(window.localStorage, {
        activityId: `mcs:learn:${deviceLesson.id}`,
        mode: 'guided',
        query: { lesson: deviceLesson.id },
        payloadVersion: 'mcs-selection-v1',
      })
    }
    dispatch({ type: 'OPEN_STUDIO', device })
  }

  function chooseLesson(id: string) {
    const next = mcsLessons.find((candidate) => candidate.id === id)
    if (!next) return
    setHelpVisible(false)
    setSelectedLessonId(id)
    setSelectedActivityId(id)
    if (next.device !== 'shared') dispatch({ type: 'OPEN_STUDIO', device: next.device })
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: `mcs:learn:${next.id}`,
      mode: 'guided',
      query: { lesson: next.id },
      payloadVersion: 'mcs-selection-v1',
    })
  }

  function completeLesson() {
    const device = lesson.device === 'shared' ? state.deviceKind : lesson.device
    setProgress((current) => {
      const next = recordMcsLessonComplete(current, lesson.id, device)
      writeMcsProgress(next)
      return next
    })
    lifecycleAnalytics.recordGoalMet()
    lifecycleAnalytics.recordActivityCompleted()
  }

  function choosePractice(id: string) {
    if (id === 'studio') return openStudio(state.deviceKind)
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === id)
    if (!scenario) return
    setHelpVisible(false)
    setSelectedActivityId(id)
    dispatch({ type: 'LOAD_SCENARIO', scenario })
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: `mcs:practice:${scenario.id}`,
      mode: 'practice',
      query: { case: scenario.id },
      scenarioId: scenario.id,
      deviceId: scenario.device,
      payloadVersion: 'mcs-selection-v1',
    })
  }

  const devicePractice = mcsPracticeScenarios.filter(
    (scenario) => scenario.device === state.deviceKind,
  )
  const capstone = mcsCapstoneScenarios.find((scenario) => scenario.device === state.deviceKind)
  const capstoneUnlocked = isMcsCapstoneUnlocked(progress, state.deviceKind)
  const remaining = remainingMcsCapstoneRequirements(progress, state.deviceKind)
  const activeTitle = assessmentMasked
    ? 'Masked MCS capstone'
    : section === 'learn'
      ? lesson.title
      : (state.scenario?.title ?? 'Mechanism Studio')
  const maskedRequiredAction =
    state.scenarioPhase === 'inspect'
      ? 'Inspect the observable patient, device, and waveform data.'
      : state.scenarioPhase === 'predict'
        ? 'Commit a prediction from the observable data before changing support.'
        : state.scenarioPhase === 'adjust'
          ? 'Apply a bounded action using the available controls.'
          : state.scenarioPhase === 'observe'
            ? 'Observe the simulated response before reassessment.'
            : state.scenarioPhase === 'reassess'
              ? 'Reassess the patient and support response.'
              : 'Review the completed attempt.'
  const currentObjective = assessmentMasked
    ? 'Complete the full reasoning loop using only observable case and device data.'
    : (state.scenario?.learningObjectives[0] ??
      lesson.objectives[0] ??
      'Compare device support with the synchronized patient and circuit response.')
  const requiredAction = assessmentMasked
    ? maskedRequiredAction
    : state.scenario
      ? state.scenarioPhase === 'predict'
        ? state.scenario.predictionPrompt
        : state.scenario.guidedPrompt
      : (lesson.steps[0]?.instruction ?? lesson.summary)
  const activeSourceIds = assessmentMasked
    ? []
    : state.scenario
      ? [...state.scenario.sourceIds, ...state.scenario.evidenceSourceIds]
      : lesson.sourceIds
  const evidenceEntries = assessmentMasked
    ? [
        {
          id: 'mcs-assessment-evidence-boundary',
          title: 'Assessment evidence boundary',
          sourceLabel: 'Scenario-specific sources available after debrief',
          limitation:
            'Use current manufacturer instructions, local policy, and supervised clinical judgment.',
        },
      ]
    : mcsSources
        .filter((source) => activeSourceIds.includes(source.id))
        .map((source) => ({
          id: source.id,
          title: source.title,
          sourceLabel: source.citation,
          limitation:
            source.limitation ??
            'Use the current source, manufacturer instructions, local policy, and supervised clinical judgment.',
        }))
  const nextLesson =
    section === 'learn'
      ? (mcsLessons.find(
          (candidate) =>
            candidate.id !== lesson.id && !progress.completedLessonIds.includes(candidate.id),
        ) ?? null)
      : null
  const nextPractice =
    section === 'practice'
      ? (devicePractice.find(
          (candidate) =>
            candidate.id !== state.scenario?.id && !progress.masteredCaseIds.includes(candidate.id),
        ) ?? null)
      : null
  const progressLabel = `${mcsProgressPercent(progress)}% saved · ${progress.completedLessonIds.length}/8 lessons · ${progress.masteredCaseIds.length}/9 cases mastered`

  function saveAndExit() {
    writeMcsProgress(progress)
    router.push(mechanicalCirculatorySupportNavBase as Route)
  }

  function focusRestoredActivity() {
    document.getElementById('mcs-activity-viewport')?.focus({ preventScroll: true })
  }

  function showHelp() {
    if (!helpVisible && section !== 'assess') lifecycleAnalytics.recordHintUsed()
    setHelpVisible(true)
  }

  return (
    <McsModuleFrame locale={locale} activeHref={activeHref} activityMode>
      <ActivityShell
        breadcrumb={
          <>
            <Link href={mechanicalCirculatorySupportNavBase}>Mechanical Circulatory Support</Link>
            {' / '}
            {section}
          </>
        }
        activityTitle={activeTitle}
        phase={semanticPhaseByMcsPhase[state.scenarioPhase]}
        mode={activityMode}
        progressLabel={progressLabel}
        stepperAriaLabel="MCS shared activity phases"
        theme="light"
        maskedAssessment={section === 'assess'}
        patientContext={
          <>
            <PatientContextBar
              items={[
                { label: 'Device track', value: deviceLabels[state.deviceKind].short },
                { label: 'Workspace', value: section },
                {
                  label: 'Activity',
                  value: assessmentMasked ? 'Masked assessment' : (state.scenario?.id ?? lesson.id),
                },
              ]}
              immediateGoal={currentObjective}
              safetyConstraints={[
                'Educational model only; verify current device instructions and local policy.',
                'Use direct examination, imaging, and the responsible shock or LVAD team.',
              ]}
            />
            {initialActivityId ? (
              <ResumeBanner
                state="ready"
                title="Exact activity restored"
                description={
                  assessmentMasked
                    ? 'The saved masked assessment is open with its device and route context.'
                    : `${initialActivityId} is open with its saved device and route context.`
                }
                onResume={focusRestoredActivity}
              />
            ) : null}
          </>
        }
        currentTask={
          <TaskPanel
            objective={currentObjective}
            requiredAction={requiredAction}
            targets={
              assessmentMasked ? [] : (state.scenario?.learningObjectives ?? lesson.objectives)
            }
            hint={
              assessmentMasked
                ? undefined
                : (state.scenario?.guidedPrompt ?? lesson.steps[0]?.rationale)
            }
            mode={activityMode}
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          >
            <strong>Current selection</strong>
            <span>
              {assessmentMasked ? 'Masked capstone' : (state.scenario?.shortTitle ?? lesson.title)}
            </span>
          </TaskPanel>
        }
        onHelp={showHelp}
        onReset={() => dispatch({ type: 'RESET' })}
        onSaveAndExit={saveAndExit}
        bottomContent={progressLabel}
        secondaryActions={
          <>
            <ReferenceDrawer
              entries={[
                {
                  id: assessmentMasked
                    ? 'mcs-masked-assessment'
                    : (state.scenario?.id ?? lesson.id),
                  title: activeTitle,
                  summary: assessmentMasked
                    ? 'Scenario-specific coaching and references remain hidden until debrief.'
                    : (state.scenario?.presentation ?? lesson.summary),
                  meta: assessmentMasked ? 'Masked assessment' : activeSourceIds.join(' · '),
                },
              ]}
              trigger={<button type="button">Reference</button>}
            />
            <EvidenceDrawer
              entries={evidenceEntries}
              trigger={<button type="button">Evidence</button>}
            />
            {nextLesson ? (
              <Link
                href={{
                  pathname: `${mechanicalCirculatorySupportNavBase}/learn`,
                  query: { lesson: nextLesson.id },
                }}
              >
                Next recommended · {nextLesson.title}
              </Link>
            ) : nextPractice ? (
              <Link
                href={{
                  pathname: `${mechanicalCirculatorySupportNavBase}/practice`,
                  query: { case: nextPractice.id },
                }}
              >
                Next recommended · {nextPractice.shortTitle}
              </Link>
            ) : null}
          </>
        }
        viewport={
          <div id="mcs-activity-viewport" className={styles.activityViewport} tabIndex={-1}>
            <section className={styles.workbenchHero}>
              <div>
                <span className={styles.kicker}>{section.toUpperCase()} WORKSPACE</span>
                <h1>
                  {section === 'learn'
                    ? 'Build the mechanism'
                    : section === 'practice'
                      ? 'Explain, change, and reassess'
                      : 'Demonstrate safe transfer'}
                </h1>
                <p>
                  {section === 'learn'
                    ? 'Guided, unscored lessons keep causal feedback visible.'
                    : section === 'practice'
                      ? 'Nine scored cases reveal causal coaching after you commit.'
                      : 'One unseen capstone per device with hints withheld. Mastery requires ≥80% and no critical safety error.'}
                </p>
              </div>
              <aside>
                <strong>{mcsProgressPercent(progress)}%</strong>
                <span>saved module progress</span>
                <small>
                  {progress.completedLessonIds.length}/8 lessons · {progress.masteredCaseIds.length}
                  /9 cases mastered
                </small>
              </aside>
            </section>

            <nav className={styles.deviceTabs} aria-label="Choose device track">
              {(Object.keys(deviceLabels) as McsDeviceKind[]).map((device) => (
                <button
                  key={device}
                  type="button"
                  aria-pressed={state.deviceKind === device}
                  onClick={() => selectDevice(device)}
                >
                  <span>{deviceLabels[device].short}</span>
                  <strong>{deviceLabels[device].title}</strong>
                  <small>{deviceLabels[device].mechanism}</small>
                </button>
              ))}
            </nav>

            {section === 'learn' ? (
              <section className={styles.activityRail} aria-label="Eight guided lessons">
                {mcsLessons.map((candidate, index) => (
                  <button
                    type="button"
                    key={candidate.id}
                    aria-current={selectedLessonId === candidate.id ? 'true' : undefined}
                    data-complete={progress.completedLessonIds.includes(candidate.id)}
                    onClick={() => chooseLesson(candidate.id)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{candidate.title}</strong>
                    <small>
                      {candidate.device === 'shared'
                        ? 'Shared foundation'
                        : deviceLabels[candidate.device].short}
                      {progress.completedLessonIds.includes(candidate.id) ? ' · complete' : ''}
                    </small>
                  </button>
                ))}
              </section>
            ) : section === 'practice' ? (
              <section
                className={styles.activityRail}
                aria-label="Mechanism Studio and device cases"
              >
                <button
                  type="button"
                  aria-current={selectedActivityId === 'studio' ? 'true' : undefined}
                  onClick={() => choosePractice('studio')}
                >
                  <span>00</span>
                  <strong>Mechanism Studio</strong>
                  <small>Open · unscored</small>
                </button>
                {devicePractice.map((scenario, index) => (
                  <button
                    type="button"
                    key={scenario.id}
                    aria-current={selectedActivityId === scenario.id ? 'true' : undefined}
                    data-complete={progress.masteredCaseIds.includes(scenario.id)}
                    onClick={() => choosePractice(scenario.id)}
                  >
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{scenario.shortTitle}</strong>
                    <small>
                      {progress.masteredCaseIds.includes(scenario.id)
                        ? `Mastered · ${progress.bestScores[scenario.id]}%`
                        : progress.completedCaseIds.includes(scenario.id)
                          ? `Best ${progress.bestScores[scenario.id]}%`
                          : 'Practice case'}
                    </small>
                  </button>
                ))}
              </section>
            ) : (
              <section className={styles.capstoneGate} data-unlocked={capstoneUnlocked}>
                <div>
                  {capstoneUnlocked ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <LockKeyhole aria-hidden="true" />
                  )}
                </div>
                <div>
                  <span className={styles.kicker}>
                    {assessmentMasked ? 'MASKED CAPSTONE' : capstone?.id}
                  </span>
                  <h2>
                    {assessmentMasked
                      ? `${deviceLabels[state.deviceKind].short} capstone assessment`
                      : capstone?.title}
                  </h2>
                  <p>
                    {capstoneUnlocked
                      ? 'Capstone unlocked. Coaching remains hidden until your debrief.'
                      : `Complete the two shared foundations, this device’s two lessons, and all three practice cases. ${remaining.length} requirement${remaining.length === 1 ? '' : 's'} remain.`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!capstoneUnlocked || !capstone}
                  onClick={() => {
                    if (capstone) {
                      setHelpVisible(false)
                      setSelectedActivityId(capstone.id)
                      dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
                      recordCriticalCareActivitySelection(window.localStorage, {
                        activityId: `mcs:assess:${capstone.id}`,
                        mode: 'challenge',
                        query: { case: capstone.id },
                        scenarioId: capstone.id,
                        deviceId: capstone.device,
                        payloadVersion: 'mcs-selection-v1',
                      })
                    }
                  }}
                >
                  Start capstone
                </button>
              </section>
            )}

            {section === 'learn' ? (
              <section className={styles.lessonCard}>
                <div>
                  <span className={styles.kicker}>
                    {lesson.device === 'shared'
                      ? 'SHARED FOUNDATION'
                      : deviceLabels[lesson.device].title}
                  </span>
                  <h2>{lesson.title}</h2>
                  <p>{lesson.summary}</p>
                  <ul>
                    {lesson.objectives.map((objective) => (
                      <li key={objective}>{objective}</li>
                    ))}
                  </ul>
                </div>
                <ol>
                  {lesson.steps.map((step, index) => (
                    <li key={step.id}>
                      <span>{index + 1}</span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.instruction}</p>
                        <small>
                          <strong>Why:</strong> {step.rationale}
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  data-complete={progress.completedLessonIds.includes(lesson.id)}
                  onClick={completeLesson}
                >
                  {progress.completedLessonIds.includes(lesson.id) ? (
                    <>
                      <Check aria-hidden="true" /> Lesson complete
                    </>
                  ) : (
                    'Mark lesson complete'
                  )}
                </button>
              </section>
            ) : null}

            <div
              className={styles.mobileSurfaceTabs}
              role="group"
              aria-label="Choose mobile workspace surface"
            >
              {(['anatomy', 'monitor', 'controls', 'workflow'] as const).map((surface) => (
                <button
                  type="button"
                  key={surface}
                  aria-pressed={mobileSurface === surface}
                  onClick={() => setMobileSurface(surface)}
                >
                  {surface}
                </button>
              ))}
            </div>
            <section className={styles.simulationGrid} aria-label="Synchronized support simulation">
              <div data-mobile-visible={mobileSurface === 'anatomy'}>
                <SimulationLaunchGate
                  activityTitle="Mechanical circulatory support 3D anatomy"
                  minimumViewport="desktop"
                  bandwidthClass="heavy"
                  estimatedSizeLabel="Interactive heart and device model"
                  lightweightAlternativeHref="/critical-care/reference?item=mcs-cardiac-text-summary"
                  onSaveForLater={() => router.push(mechanicalCirculatorySupportNavBase as Route)}
                >
                  <McsAnatomy3D state={state} revealCausality={revealCausality} />
                </SimulationLaunchGate>
              </div>
              <div data-mobile-visible={mobileSurface === 'monitor'}>
                <McsMonitor state={state} revealCausality={revealCausality} />
              </div>
              <div
                className={styles.liveControlsRail}
                data-mobile-visible={mobileSurface === 'controls'}
              >
                <McsControls state={state} dispatch={dispatch} />
              </div>
            </section>
            <section className={styles.taskGrid} data-mobile-visible={mobileSurface === 'workflow'}>
              <McsCaseWorkflow state={state} dispatch={dispatch} />
            </section>

            {state.completed && state.scenario && state.score ? (
              <DebriefPanel
                clinicalModel={state.causalExplanation || state.scenario.debrief.join(' ')}
                actions={state.actionIds}
                consequences={state.scenario.debrief}
                performanceDomains={[
                  { label: 'Inspection', result: `${state.score.inspection}` },
                  { label: 'Prediction', result: `${state.score.prediction}` },
                  { label: 'Management', result: `${state.score.management}` },
                  { label: 'Response', result: `${state.score.response}` },
                  { label: 'Reassessment', result: `${state.score.reassessment}` },
                  { label: 'Total', result: `${state.score.total}%` },
                ]}
                transfer={<p>{state.scenario.learningObjectives.join(' ')}</p>}
                replay={
                  <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
                    Replay this case
                  </button>
                }
              />
            ) : null}

            <section className={styles.privacyNote}>
              <strong>Privacy boundary</strong>
              <span>
                This module sends only device track, station, completion state, and score band.
                Physiologic traces, pressures, detailed action histories, and free text remain in
                the browser.
              </span>
            </section>
            <McsSourcesPanel />
          </div>
        }
      />
    </McsModuleFrame>
  )
}
