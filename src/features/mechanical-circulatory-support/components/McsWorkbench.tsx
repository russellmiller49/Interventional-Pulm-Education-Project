'use client'

import type { Route } from 'next'
import { useEffect, useReducer, useRef, useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { resolveCriticalCareEvidence } from '@/features/critical-care/content/evidenceRegistry'
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
import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { PathwayNav } from '@/features/learning-module/curriculum'
import { Link, useRouter } from '@/i18n/navigation'

import {
  MCS_ANALYTICS_MODULE_ID,
  MCS_LEARN_PHASES,
  MCS_MODEL_BOUNDARIES,
  mcsCapstoneScenarios,
  mcsDerivedValueGuides,
  mcsFoundationLessonIds,
  mcsLessonTransferByLessonId,
  mcsLessons,
  mcsPracticeScenarios,
  mcsSectionLearningContractById,
  mcsSources,
  type McsLearnPhase,
  type McsSectionLearningContract,
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
  type McsAction,
  type McsDeviceKind,
  type McsModuleSection,
  type McsProgressV1,
  type McsSimulationState,
} from '../engine'
import { McsAnatomy3D } from './McsAnatomy3D'
import { McsCaseWorkflow } from './McsCaseWorkflow'
import { McsCommonModel } from './McsCommonModel'
import { McsControls } from './McsControls'
import { McsLearnSection } from './McsLearnSection'
import { McsModuleFrame } from './McsModuleFrame'
import { McsMonitor } from './McsMonitor'
import { McsSourcesPanel } from './McsSourcesPanel'
import { McsSupportPathwayCards } from './McsSupportPathwayCards'
import styles from './mechanical-circulatory-support.module.css'

const mcsLearningPathway = criticalCareLearningPathway('mechanical-circulatory-support')

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

function rhythmLabel(state: McsSimulationState): string {
  if (state.patient.rhythm === 'atrial-fibrillation') return 'Atrial fibrillation'
  if (state.patient.rhythm === 'paced') return 'Paced'
  return 'Sinus rhythm'
}

function shockPhenotype(state: McsSimulationState): string {
  if (state.patient.tamponade) return 'Obstructive / tamponade pattern'
  const lvLimited =
    state.patient.leftVentricularContractility < 0.55 || state.metrics.pcwpMmHg >= 20
  const rvLimited =
    state.patient.rightVentricularContractility < 0.55 ||
    state.metrics.papi < MCS_MODEL_BOUNDARIES.rvLimitedPapiMax ||
    state.metrics.rapMmHg >= 14
  if (lvLimited && rvLimited) return 'Biventricular / mixed shock'
  if (rvLimited) return 'RV-dominant shock'
  if (lvLimited) return 'LV-dominant shock'
  return 'Supported low-output physiology'
}

function deviceSetting(state: McsSimulationState): string {
  if (state.device.kind === 'iabp') {
    return `1:${state.device.assistRatio} · ${state.device.triggerSource.toUpperCase()} trigger`
  }
  if (state.device.kind === 'impella') {
    const left = state.device.left.enabled
      ? `${state.device.left.variant === '55' ? '5.5' : 'CP'} P${state.device.left.performanceLevel}`
      : 'left pump off'
    const right = state.device.right.enabled
      ? `RP P${state.device.right.performanceLevel}`
      : 'RP off'
    return `${left} · ${right}`
  }
  return `${state.device.speedRpm} RPM · ${state.device.powerConnected ? 'power verified' : 'power lost'}`
}

/**
 * Opens a Learn section on its authored starting state.
 *
 * The section decides the topology and any loading it needs; nothing else changes when a learner
 * moves between sections, which is what keeps a section from silently resetting state a neighbouring
 * one had established.
 */
function openLearnSection(
  dispatch: (action: McsAction) => void,
  contract: McsSectionLearningContract,
): void {
  dispatch({ type: 'OPEN_STUDIO', device: contract.startingDevice })
  for (const action of contract.startingActions) dispatch(action)
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
  const initialContract =
    section === 'learn' ? mcsSectionLearningContractById.get(initialLesson.id) : undefined
  const [state, dispatch] = useReducer(mcsReducer, undefined, () => {
    if (initialContract) {
      let next = createInitialMcsState(section, initialContract.startingDevice)
      for (const action of initialContract.startingActions) next = mcsReducer(next, action)
      return next
    }
    const initial = createInitialMcsState(section, activeInitialDevice)
    const requestedScenario = requestedPractice ?? requestedCapstone
    return requestedScenario
      ? mcsReducer(initial, { type: 'LOAD_SCENARIO', scenario: requestedScenario })
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
  const [learnPhase, setLearnPhase] = useState<McsLearnPhase>('recognize')
  const [furthestLearnPhase, setFurthestLearnPhase] = useState<McsLearnPhase>('recognize')
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false)
  const recordedCompletion = useRef<string | null>(null)
  const recordedSafetyEvents = useRef(new Set<string>())
  const activeHref = `${mechanicalCirculatorySupportNavBase}/${section}`
  const lesson = mcsLessons.find((candidate) => candidate.id === selectedLessonId) ?? mcsLessons[0]
  const lessonTransfer = mcsLessonTransferByLessonId.get(lesson.id)
  const learnContract = mcsSectionLearningContractById.get(lesson.id)
  const lessonIndex = mcsLessons.findIndex((candidate) => candidate.id === lesson.id)
  const revealCausality =
    section !== 'assess' ||
    showChallengeFeedback ||
    state.completed ||
    state.alarms.some((alarm) => alarm.active && alarm.priority === 'critical')
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
  const lifecyclePhase: CriticalCareActivityPhase =
    section === 'learn'
      ? learnPhase
      : !state.scenario
        ? ('recognize' as const)
        : semanticPhaseByMcsPhase[state.scenarioPhase]
  const lifecycleAnalytics = useCriticalCareActivityAnalytics({
    moduleId: 'mechanical-circulatory-support',
    activityId: lifecycleActivityId,
    mode: activityMode,
    phase: lifecyclePhase,
    enabled: section !== 'assess' || state.scenario !== null,
  })
  const catalogActivity = criticalCareActivityById.get(lifecycleActivityId)

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
      },
    })
  }, [progress, section, selectedActivityId, state.completed, state.deviceKind])

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

  function resetLessonRuntime() {
    setLearnPhase('recognize')
    setFurthestLearnPhase('recognize')
  }

  function moveToLearnPhase(next: McsLearnPhase) {
    setLearnPhase(next)
    setHelpVisible(false)
    if (MCS_LEARN_PHASES.indexOf(next) > MCS_LEARN_PHASES.indexOf(furthestLearnPhase)) {
      setFurthestLearnPhase(next)
    }
  }

  function selectDevice(device: McsDeviceKind) {
    if (section === 'practice') return openStudio(device)
    if (section === 'assess') {
      const capstone = mcsCapstoneScenarios.find((candidate) => candidate.device === device)
      if (!capstone) return
      setSelectedActivityId(capstone.id)
      setHelpVisible(false)
      setShowChallengeFeedback(false)
      dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
      return
    }
    const deviceLesson = mcsLessons.find((candidate) => candidate.device === device)
    if (deviceLesson) {
      chooseLesson(deviceLesson.id)
      return
    }
    dispatch({ type: 'OPEN_STUDIO', device })
  }

  function chooseLesson(id: string) {
    const next = mcsSectionLearningContractById.get(id)
    if (!next) return
    setHelpVisible(false)
    resetLessonRuntime()
    setSelectedLessonId(id)
    setSelectedActivityId(id)
    openLearnSection(dispatch, next)
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: `mcs:learn:${next.sectionId}`,
      mode: 'guided',
      query: { lesson: next.sectionId },
      payloadVersion: 'mcs-selection-v1',
    })
  }

  /**
   * The only place a Learn section is recorded.
   *
   * Called by the section runtime once the whole authored sequence has been worked through — there
   * is no learner-facing control that records a section, and reaching a phase, committing an answer,
   * or performing the action alone does not reach here.
   */
  function recordSectionWorkedThrough() {
    const device = lesson.device === 'shared' ? state.deviceKind : lesson.device
    setProgress((current) => {
      if (current.completedLessonIds.includes(lesson.id)) return current
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
  const activeTitle =
    section === 'learn' ? lesson.title : (state.scenario?.title ?? 'Mechanism Studio')
  const learnPhaseInstruction =
    learnContract && section === 'learn'
      ? learnPhase === 'recognize'
        ? learnContract.recognizePrompt
        : learnPhase === 'predict'
          ? learnContract.predictionPrompt
          : learnPhase === 'act'
            ? learnContract.actionInstruction
            : learnPhase === 'observe'
              ? learnContract.observationFocus
              : learnPhase === 'explain'
                ? learnContract.reassessmentPrompt
                : learnContract.transferPrompt
      : null
  const currentObjective =
    section === 'learn'
      ? (learnContract?.clinicalQuestion ?? lesson.summary)
      : (state.scenario?.learningObjectives[0] ??
        'Compare device support with the synchronized patient and circuit response.')
  const requiredAction =
    section === 'learn'
      ? (learnPhaseInstruction ?? lesson.summary)
      : state.scenario
        ? state.scenarioPhase === 'predict'
          ? state.scenario.predictionPrompt
          : state.scenario.guidedPrompt
        : 'Change one bounded variable and reconcile the patient, monitor, and device response.'
  const activeSourceIds =
    section === 'learn' && learnPhase === 'transfer' && lessonTransfer
      ? [...lesson.sourceIds, ...lessonTransfer.item.evidenceIds]
      : state.scenario
        ? [...state.scenario.sourceIds, ...state.scenario.evidenceSourceIds]
        : lesson.sourceIds
  const derivedValueEvidence = resolveCriticalCareEvidence([
    ...mcsDerivedValueGuides.pulmonaryArteryPulsatilityIndex.references.flatMap(
      (reference) => reference.evidenceIds,
    ),
    ...mcsDerivedValueGuides.cardiacPowerOutputW.references.flatMap(
      (reference) => reference.evidenceIds,
    ),
  ])
  const evidenceEntries = Array.from(
    new Map(
      [
        ...mcsSources
          .filter((source) => activeSourceIds.includes(source.id))
          .map((source) => ({
            id: source.id,
            title: source.title,
            sourceLabel: source.citation,
            limitation:
              source.limitation ??
              'Use the current source, manufacturer instructions, local policy, and supervised clinical judgment.',
          })),
        ...derivedValueEvidence.map((source) => ({
          id: source.id,
          title: source.title,
          sourceLabel: source.citation,
          limitation: source.limitation,
        })),
      ].map((entry) => [entry.id, entry] as const),
    ).values(),
  )
  const nextLesson =
    section === 'learn'
      ? (mcsLessons.find(
          (candidate) =>
            candidate.id !== lesson.id && !progress.completedLessonIds.includes(candidate.id),
        ) ?? null)
      : null
  const previousLesson = section === 'learn' ? (mcsLessons[lessonIndex - 1] ?? null) : null
  const followingLesson = section === 'learn' ? (mcsLessons[lessonIndex + 1] ?? null) : null
  const lessonComplete = progress.completedLessonIds.includes(lesson.id)
  /*
   * The common model still opens the two foundation sections, and the pathway cards still join it on
   * the mechanisms section. They now sit in the teaching pane rather than above the simulator,
   * because that pane is where a learner reads why the surface beside it looks the way it does.
   */
  const showCommonModel = section === 'learn' && mcsFoundationLessonIds.includes(lesson.id)
  const showPathwayCards = section === 'learn' && lesson.id === 'mcs-foundations-mechanisms'
  const nextPractice =
    section === 'practice'
      ? (devicePractice.find(
          (candidate) =>
            candidate.id !== state.scenario?.id && !progress.masteredCaseIds.includes(candidate.id),
        ) ?? null)
      : null
  const progressLabel = state.completed
    ? 'Worked through · personal history saved locally'
    : 'Personal history stays in this browser'

  function saveAndExit() {
    writeMcsProgress(progress)
    router.push(mechanicalCirculatorySupportNavBase as Route)
  }

  function resetActivity() {
    setHelpVisible(false)
    setShowChallengeFeedback(false)
    if (section === 'learn') resetLessonRuntime()
    dispatch({ type: 'RESET' })
  }

  function focusRestoredActivity() {
    document.getElementById('mcs-activity-viewport')?.focus({ preventScroll: true })
  }

  function selectActivityPhase(phase: CriticalCareActivityPhase) {
    setHelpVisible(false)
    if (section === 'learn') {
      /*
       * Moving back through phases already worked through is free. Jumping ahead is not: the six
       * phases are the instructional sequence, and skipping into a later one would present an
       * observation with nothing observed and a transfer with nothing to transfer.
       */
      const requested = MCS_LEARN_PHASES.find((candidate) => candidate === phase)
      if (
        requested &&
        MCS_LEARN_PHASES.indexOf(requested) <= MCS_LEARN_PHASES.indexOf(furthestLearnPhase)
      ) {
        setLearnPhase(requested)
      }
      window.requestAnimationFrame(focusRestoredActivity)
      return
    }

    const surface: MobileSurface =
      phase === 'act'
        ? 'controls'
        : phase === 'recognize' || phase === 'observe'
          ? 'monitor'
          : 'workflow'
    setMobileSurface(surface)
    const targetId =
      phase === 'recognize'
        ? 'mcs-case-inspect'
        : phase === 'predict'
          ? 'mcs-case-predict'
          : phase === 'observe'
            ? 'mcs-case-response'
            : 'mcs-case-actions'
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.focus({ preventScroll: false })
    })
  }

  function showHelp() {
    if (!helpVisible && section !== 'assess') lifecycleAnalytics.recordHintUsed()
    setHelpVisible(true)
  }

  return (
    <McsModuleFrame locale={locale} activeHref={activeHref} activityMode>
      <ActivityShell
        layout="native-workbench"
        activityId={lifecycleActivityId}
        assumedConceptIds={catalogActivity?.assumedConceptIds}
        breadcrumb={
          <>
            <Link href={mechanicalCirculatorySupportNavBase}>Mechanical Circulatory Support</Link>
            {' / '}
            {section}
          </>
        }
        activityTitle={activeTitle}
        phase={lifecyclePhase}
        mode={activityMode}
        progressLabel={progressLabel}
        stepperAriaLabel="MCS shared activity phases"
        onPhaseSelect={selectActivityPhase}
        theme="light"
        patientContext={
          <>
            <PatientContextBar
              items={[
                {
                  label: 'Support',
                  value: `${deviceLabels[state.deviceKind].short} · ${deviceSetting(state)}`,
                },
                { label: 'Shock phenotype', value: shockPhenotype(state) },
                {
                  label: 'Rhythm',
                  value: `${rhythmLabel(state)} · ${state.patient.heartRateBpm} bpm`,
                },
                {
                  label: 'MAP / pulse pressure',
                  value: `${state.metrics.mapMmHg} / ${state.metrics.pulsePressureMmHg} mm Hg`,
                },
                {
                  label: 'RAP / PCWP / PAPi',
                  value: `${state.metrics.rapMmHg} / ${state.metrics.pcwpMmHg} mm Hg · ${state.metrics.papi}`,
                },
                {
                  label: 'Native / device / effective flow',
                  value: `${state.metrics.nativeFlowLMin.toFixed(1)} / ${state.metrics.deviceFlowLMin.toFixed(1)} / ${state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min`,
                },
                {
                  label: 'Perfusion',
                  value: `SvO₂ ${state.metrics.svo2Percent}% · CPO ${state.metrics.cardiacPowerOutputW.toFixed(2)} W`,
                },
                {
                  label: 'Active alarm / limitation',
                  value:
                    state.alarms.find((alarm) => alarm.active)?.label ?? 'No active modeled alarm',
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
                title={section === 'learn' ? 'Return to saved lesson' : 'Return to saved case'}
                description={`${activeTitle} is open with its saved route and device selection. Prior controls and answers were not replayed.`}
                onResume={focusRestoredActivity}
                resumeActionLabel={section === 'learn' ? 'Return to lesson' : 'Return to case'}
              />
            ) : null}
          </>
        }
        currentTask={
          <TaskPanel
            objective={currentObjective}
            requiredAction={requiredAction}
            targets={
              section === 'learn' && learnContract
                ? [learnContract.learningObjective, learnContract.observationFocus]
                : (state.scenario?.learningObjectives ?? [])
            }
            hint={
              section === 'learn'
                ? (learnContract?.predictionReasoning ?? lesson.summary)
                : state.scenario?.guidedPrompt
            }
            mode={activityMode}
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          >
            <div className={styles.taskSelectors}>
              {/*
               * The device tabs are an axis orthogonal to the teaching sequence, so inside Learn
               * they are replaced by the ordered pathway rail: the two shared foundation sections
               * read as foundations rather than as items 01–02 of a flat device list, and the
               * cross-device integration section closes the arc. Selecting a section switches the
               * device track for you. Practice and Challenge keep the tabs.
               */}
              {section === 'learn' ? null : (
                <>
                  <strong>Device track</strong>
                  <nav className={styles.taskDeviceTabs} aria-label="Choose device track">
                    {(Object.keys(deviceLabels) as McsDeviceKind[]).map((device) => (
                      <button
                        key={device}
                        type="button"
                        aria-pressed={state.deviceKind === device}
                        onClick={() => selectDevice(device)}
                      >
                        <span>{deviceLabels[device].short}</span>
                        <small>{deviceLabels[device].title}</small>
                      </button>
                    ))}
                  </nav>
                </>
              )}
              {section === 'learn' ? (
                <PathwayNav
                  pathway={mcsLearningPathway}
                  label="MCS learning pathway"
                  activeSectionId={selectedLessonId}
                  onSelect={(sectionId) => chooseLesson(sectionId)}
                />
              ) : section === 'practice' ? (
                <section
                  className={styles.taskActivityRail}
                  aria-label="Mechanism Studio and device cases"
                >
                  <button
                    type="button"
                    aria-current={selectedActivityId === 'studio' ? 'true' : undefined}
                    onClick={() => choosePractice('studio')}
                  >
                    <span>00</span>
                    <strong>Mechanism Studio</strong>
                  </button>
                  {devicePractice.map((candidate, index) => (
                    <button
                      type="button"
                      key={candidate.id}
                      aria-current={selectedActivityId === candidate.id ? 'true' : undefined}
                      data-complete={progress.masteredCaseIds.includes(candidate.id)}
                      onClick={() => choosePractice(candidate.id)}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{candidate.shortTitle}</strong>
                    </button>
                  ))}
                </section>
              ) : (
                <section className={styles.taskCapstoneCard} data-available>
                  <div>
                    <Check aria-hidden="true" />
                    <strong>{capstone?.title ?? 'MCS challenge'}</strong>
                  </div>
                  <p>Open from the start. Feedback is collected for the end-of-case debrief.</p>
                  <button
                    type="button"
                    disabled={!capstone}
                    onClick={() => {
                      if (!capstone) return
                      setHelpVisible(false)
                      setShowChallengeFeedback(false)
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
                    }}
                  >
                    Open challenge
                  </button>
                </section>
              )}
            </div>
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
                  id: state.scenario?.id ?? lesson.id,
                  title: activeTitle,
                  summary: state.scenario?.presentation ?? lesson.summary,
                  meta: mcsSources
                    .filter((source) => activeSourceIds.includes(source.id))
                    .map((source) => source.title)
                    .join(' · '),
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
            {section === 'learn' && learnContract && lessonTransfer ? (
              /*
               * Learn only. Practice and Challenge keep the surface grid below unchanged, because
               * their timing, feedback and debrief rules are not part of this package.
               *
               * Keyed by section id so a learner's recognition, prediction, captured readings and
               * transfer answer cannot survive a move to another section.
               */
              <McsLearnSection
                key={learnContract.sectionId}
                contract={learnContract}
                transfer={lessonTransfer}
                state={state}
                dispatch={dispatch}
                phase={learnPhase}
                onPhaseChange={moveToLearnPhase}
                sectionComplete={lessonComplete}
                onSectionWorkedThrough={recordSectionWorkedThrough}
                helpVisible={helpVisible}
                onHelp={showHelp}
                conceptIds={catalogActivity?.teachesConceptIds}
                foundationMaterial={
                  showCommonModel ? (
                    <>
                      <McsCommonModel state={state} />
                      {showPathwayCards ? <McsSupportPathwayCards /> : null}
                    </>
                  ) : null
                }
                sectionNav={
                  <>
                    <span>
                      Section {lessonIndex + 1} of {mcsLessons.length}
                    </span>
                    {previousLesson ? (
                      <button type="button" onClick={() => chooseLesson(previousLesson.id)}>
                        Back to {previousLesson.title}
                      </button>
                    ) : null}
                    {followingLesson ? (
                      <button type="button" onClick={() => chooseLesson(followingLesson.id)}>
                        Ahead to {followingLesson.title}
                      </button>
                    ) : null}
                  </>
                }
                afterCompletion={
                  followingLesson ? (
                    <button type="button" onClick={() => chooseLesson(followingLesson.id)}>
                      <span>Continue to the next section: {followingLesson.title}</span>
                      <ArrowRight aria-hidden="true" />
                    </button>
                  ) : (
                    <Link href={`${mechanicalCirculatorySupportNavBase}/practice`}>
                      <span>
                        Continue to practice
                        <small>Apply what these sections built in coached patient cases</small>
                      </span>
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  )
                }
              />
            ) : (
              <>
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
                <section
                  className={styles.simulationGrid}
                  aria-label="Synchronized support simulation"
                >
                  <div data-mobile-visible={mobileSurface === 'anatomy'}>
                    <SimulationLaunchGate
                      activityTitle="Mechanical circulatory support 3D anatomy"
                      minimumViewport="desktop"
                      bandwidthClass="heavy"
                      estimatedSizeLabel="Interactive heart and device model"
                      lightweightAlternativeHref="/critical-care/reference?item=mcs-cardiac-text-summary"
                      onSaveForLater={() =>
                        router.push(mechanicalCirculatorySupportNavBase as Route)
                      }
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
                <section
                  className={styles.taskGrid}
                  data-mobile-visible={mobileSurface === 'workflow'}
                >
                  <McsCaseWorkflow
                    state={state}
                    dispatch={dispatch}
                    showChallengeFeedback={showChallengeFeedback}
                    onShowChallengeFeedbackChange={setShowChallengeFeedback}
                  />
                </section>
              </>
            )}

            {state.completed && state.scenario && state.score ? (
              <DebriefPanel
                clinicalModel={state.causalExplanation || state.scenario.debrief.join(' ')}
                actions={state.actionIds}
                consequences={state.scenario.debrief}
                performanceDomains={[
                  { label: 'Inspection', result: 'Review the cues opened before action' },
                  { label: 'Prediction', result: 'Compare the committed frame with the response' },
                  { label: 'Management', result: 'Trace each bounded device or loading change' },
                  { label: 'Response', result: 'Reconcile native, device, and effective flow' },
                  { label: 'Reassessment', result: 'Return to the whole patient' },
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
                This module sends only the device track, station, and coarse activity state.
                Physiologic traces, pressures, detailed action histories, and free text remain in
                this browser.
              </span>
            </section>
            <McsSourcesPanel />
          </div>
        }
      />
    </McsModuleFrame>
  )
}
