'use client'

import type { Route } from 'next'
import { useEffect, useReducer, useRef, useState } from 'react'
import { ArrowRight, Check, LockKeyhole } from 'lucide-react'

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
  mcsLessonTransferByLessonId,
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
  type McsSimulationState,
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

function rhythmLabel(state: McsSimulationState): string {
  if (state.patient.rhythm === 'atrial-fibrillation') return 'Atrial fibrillation'
  if (state.patient.rhythm === 'paced') return 'Paced'
  return 'Sinus rhythm'
}

function shockPhenotype(state: McsSimulationState, masked: boolean): string {
  if (masked) return 'Undifferentiated hemodynamic instability'
  if (state.patient.tamponade) return 'Obstructive / tamponade pattern'
  const lvLimited =
    state.patient.leftVentricularContractility < 0.55 || state.metrics.pcwpMmHg >= 20
  const rvLimited =
    state.patient.rightVentricularContractility < 0.55 ||
    state.metrics.papi < 1.5 ||
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

function guidedSurfaceForActionId(
  actionId: string | undefined,
): 'anatomy' | 'monitor' | 'controls' | 'workflow' {
  if (!actionId) return 'anatomy'
  if (actionId.startsWith('device:select:')) return 'anatomy'
  if (actionId.startsWith('inspect:')) return 'monitor'
  if (actionId === 'team:escalate') return 'workflow'
  return 'controls'
}

function learnPhaseForAction(
  actionId: string | undefined,
  performed: boolean,
  transferActive: boolean,
): CriticalCareActivityPhase {
  if (transferActive) return 'transfer'
  if (performed) return 'observe'
  if (!actionId || actionId.startsWith('inspect:') || actionId.startsWith('device:select:')) {
    return 'recognize'
  }
  return 'act'
}

function guidedActionLabel(actionId: string): string | null {
  if (actionId === 'inspect:arterial') return 'Inspect arterial waveform'
  if (actionId === 'inspect:preload') return 'Inspect filling pressures and RV delivery'
  if (actionId === 'inspect:device') return 'Inspect device and effective flow'
  if (actionId === 'team:escalate') return 'Escalate to shock/MCS team'
  if (actionId === 'device:select:iabp') return 'Select the IABP mechanism'
  if (actionId === 'device:select:impella') return 'Select the Impella mechanism'
  if (actionId === 'device:select:lvad') return 'Select the LVAD mechanism'
  return null
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
  const [activeLessonStepIndex, setActiveLessonStepIndex] = useState(0)
  const [lessonTransferActive, setLessonTransferActive] = useState(false)
  const [transferChoiceId, setTransferChoiceId] = useState<string | null>(null)
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null)
  const recordedCompletion = useRef<string | null>(null)
  const recordedSafetyEvents = useRef(new Set<string>())
  const activeHref = `${mechanicalCirculatorySupportNavBase}/${section}`
  const lesson = mcsLessons.find((candidate) => candidate.id === selectedLessonId) ?? mcsLessons[0]
  const lessonTransfer = mcsLessonTransferByLessonId.get(lesson.id)
  const activeLessonStep =
    lesson.steps[activeLessonStepIndex] ?? lesson.steps[lesson.steps.length - 1]
  const activeLessonStepPerformed = activeLessonStep.targetActionId
    ? state.actionIds.includes(activeLessonStep.targetActionId)
    : false
  const transferActionsMet =
    lessonTransfer?.requiredActionIds.every((id) => state.actionIds.includes(id)) ?? false
  const guidedSurface =
    section === 'learn'
      ? guidedSurfaceForActionId(
          lessonTransferActive
            ? (lessonTransfer?.requiredActionIds.find((id) => !state.actionIds.includes(id)) ??
                lessonTransfer?.requiredActionIds[0])
            : activeLessonStep.targetActionId,
        )
      : 'workflow'
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
    section === 'learn'
      ? learnPhaseForAction(
          activeLessonStep.targetActionId,
          activeLessonStepPerformed,
          lessonTransferActive,
        )
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

  function resetLessonRuntime() {
    setActiveLessonStepIndex(0)
    setLessonTransferActive(false)
    setTransferChoiceId(null)
    setTransferFeedback(null)
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
      resetLessonRuntime()
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
    resetLessonRuntime()
    setSelectedLessonId(id)
    setSelectedActivityId(id)
    dispatch({
      type: 'OPEN_STUDIO',
      device: next.device === 'shared' ? state.deviceKind : next.device,
    })
    recordCriticalCareActivitySelection(window.localStorage, {
      activityId: `mcs:learn:${next.id}`,
      mode: 'guided',
      query: { lesson: next.id },
      payloadVersion: 'mcs-selection-v1',
    })
  }

  function completeLessonFromEvidence() {
    if (!lessonTransfer || !transferChoiceId || !transferActionsMet) return
    if (!lessonTransfer.item.correctChoiceIds.includes(transferChoiceId)) return
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

  function dispatchGuidedAction(actionId: string) {
    if (actionId === 'inspect:arterial') dispatch({ type: 'INSPECT', id: 'arterial' })
    else if (actionId === 'inspect:preload') dispatch({ type: 'INSPECT', id: 'preload' })
    else if (actionId === 'inspect:device') dispatch({ type: 'INSPECT', id: 'device' })
    else if (actionId === 'team:escalate') dispatch({ type: 'ESCALATE' })
    else if (actionId.startsWith('device:select:')) {
      const device = actionId.replace('device:select:', '') as McsDeviceKind
      dispatch({ type: 'SELECT_DEVICE', device })
    }
  }

  function beginLessonTransfer() {
    if (!lessonTransfer || !activeLessonStepPerformed) return
    setLessonTransferActive(true)
    setTransferChoiceId(null)
    setTransferFeedback(null)
    dispatch({ type: 'OPEN_STUDIO', device: lessonTransfer.setupDevice })
    for (const action of lessonTransfer.setupActions) dispatch(action)
  }

  function advanceLessonStep() {
    if (!activeLessonStepPerformed) return
    if (activeLessonStepIndex >= lesson.steps.length - 1) {
      beginLessonTransfer()
      return
    }
    setActiveLessonStepIndex((index) => index + 1)
    setHelpVisible(false)
  }

  function checkTransferDecision() {
    if (!lessonTransfer || !transferChoiceId) {
      setTransferFeedback('Choose the best response before checking the transfer case.')
      return
    }
    const correct = lessonTransfer.item.correctChoiceIds.includes(transferChoiceId)
    const choice = lessonTransfer.item.choices.find(
      (candidate) => candidate.id === transferChoiceId,
    )
    if (!correct) {
      setTransferFeedback(
        `${choice?.rationale ?? 'That response does not fit the modeled mechanism.'} Reassess the patient, loading condition, and support pathway.`,
      )
      return
    }
    if (!transferActionsMet) {
      setTransferFeedback(
        `${choice?.rationale ?? lessonTransfer.item.explanation} Now complete the required simulator action and check again.`,
      )
      return
    }
    setTransferFeedback(lessonTransfer.item.explanation)
    completeLessonFromEvidence()
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
    : section === 'learn'
      ? lessonTransferActive
        ? (lessonTransfer?.title ?? 'Apply the mechanism to a new loading condition.')
        : activeLessonStep.title
      : (state.scenario?.learningObjectives[0] ??
        'Compare device support with the synchronized patient and circuit response.')
  const requiredAction = assessmentMasked
    ? maskedRequiredAction
    : section === 'learn'
      ? lessonTransferActive
        ? (lessonTransfer?.requiredActionLabel ?? 'Complete the transfer interaction.')
        : activeLessonStep.instruction
      : state.scenario
        ? state.scenarioPhase === 'predict'
          ? state.scenario.predictionPrompt
          : state.scenario.guidedPrompt
        : 'Change one bounded variable and reconcile the patient, monitor, and device response.'
  const activeSourceIds = assessmentMasked
    ? []
    : section === 'learn' && lessonTransferActive && lessonTransfer
      ? [...lesson.sourceIds, ...lessonTransfer.item.evidenceIds]
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
  const followingLesson =
    section === 'learn'
      ? (mcsLessons[mcsLessons.findIndex((candidate) => candidate.id === lesson.id) + 1] ?? null)
      : null
  const lessonComplete = progress.completedLessonIds.includes(lesson.id)
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

  function resetActivity() {
    setHelpVisible(false)
    if (section === 'learn') resetLessonRuntime()
    dispatch({ type: 'RESET' })
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
        layout="native-workbench"
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
        theme="light"
        maskedAssessment={section === 'assess'}
        patientContext={
          <>
            <PatientContextBar
              items={[
                {
                  label: 'Support',
                  value: `${deviceLabels[state.deviceKind].short} · ${deviceSetting(state)}`,
                },
                { label: 'Shock phenotype', value: shockPhenotype(state, assessmentMasked) },
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
                description={
                  assessmentMasked
                    ? 'The saved assessment route and device selection are open. Prior simulation state was not replayed.'
                    : `${activeTitle} is open with its saved route and device selection. Prior controls and answers were not replayed.`
                }
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
              assessmentMasked
                ? []
                : section === 'learn'
                  ? lessonTransferActive
                    ? [lessonTransfer?.item.stem ?? requiredAction]
                    : [activeLessonStep.title]
                  : (state.scenario?.learningObjectives ?? [])
            }
            hint={
              assessmentMasked
                ? undefined
                : section === 'learn'
                  ? lessonTransferActive
                    ? lessonTransfer?.item.explanation
                    : activeLessonStep.rationale
                  : state.scenario?.guidedPrompt
            }
            mode={activityMode}
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          >
            <div className={styles.taskSelectors}>
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
              {section === 'learn' ? (
                <section className={styles.taskActivityRail} aria-label="Eight guided lessons">
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
                    </button>
                  ))}
                </section>
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
                <section className={styles.taskCapstoneGate} data-unlocked={capstoneUnlocked}>
                  <div>
                    {capstoneUnlocked ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <LockKeyhole aria-hidden="true" />
                    )}
                    <strong>
                      {assessmentMasked
                        ? `${deviceLabels[state.deviceKind].short} capstone assessment`
                        : (capstone?.title ?? 'MCS capstone')}
                    </strong>
                  </div>
                  <p>
                    {capstoneUnlocked
                      ? 'Capstone unlocked. Coaching remains hidden until debrief.'
                      : `${remaining.length} requirement${remaining.length === 1 ? '' : 's'} remain.`}
                  </p>
                  <button
                    type="button"
                    disabled={!capstoneUnlocked || !capstone}
                    onClick={() => {
                      if (!capstone) return
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
                    }}
                  >
                    Start capstone
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
                  id: assessmentMasked
                    ? 'mcs-masked-assessment'
                    : (state.scenario?.id ?? lesson.id),
                  title: activeTitle,
                  summary: assessmentMasked
                    ? 'Scenario-specific coaching and references remain hidden until debrief.'
                    : (state.scenario?.presentation ?? lesson.summary),
                  meta: assessmentMasked
                    ? 'Masked assessment'
                    : mcsSources
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
            {section === 'learn' ? (
              <section className={styles.lessonRuntime} aria-label="Active guided MCS lesson">
                <header>
                  <div>
                    <span className={styles.kicker}>
                      {lessonTransferActive
                        ? 'AUTHORED TRANSFER'
                        : `STEP ${activeLessonStepIndex + 1} OF ${lesson.steps.length}`}
                    </span>
                    <h2>
                      {lessonTransferActive
                        ? (lessonTransfer?.title ?? 'Transfer case')
                        : activeLessonStep.title}
                    </h2>
                  </div>
                  <span className={styles.lessonEvidenceBadge} data-complete={lessonComplete}>
                    {lessonComplete
                      ? 'Evidence complete'
                      : lessonTransferActive
                        ? 'Transfer evidence required'
                        : activeLessonStepPerformed
                          ? 'Interaction observed'
                          : 'Interaction pending'}
                  </span>
                </header>

                {!lessonTransferActive ? (
                  <>
                    <nav className={styles.lessonStepRail} aria-label="Lesson interaction steps">
                      {lesson.steps.map((step, index) => {
                        const completed = step.targetActionId
                          ? state.actionIds.includes(step.targetActionId)
                          : false
                        return (
                          <button
                            type="button"
                            key={step.id}
                            aria-current={index === activeLessonStepIndex ? 'step' : undefined}
                            data-complete={completed}
                            disabled={index > activeLessonStepIndex && !completed}
                            onClick={() => setActiveLessonStepIndex(index)}
                          >
                            <span>{completed ? <Check aria-hidden="true" /> : index + 1}</span>
                            <small>{step.title}</small>
                          </button>
                        )
                      })}
                    </nav>
                    <div className={styles.lessonRuntimeBody}>
                      <div>
                        <strong>Do this in the live workbench</strong>
                        <p>{activeLessonStep.instruction}</p>
                        <small>
                          <strong>Why:</strong> {activeLessonStep.rationale}
                        </small>
                      </div>
                      <div className={styles.lessonRuntimeActions}>
                        {activeLessonStep.targetActionId &&
                        guidedActionLabel(activeLessonStep.targetActionId) ? (
                          <button
                            type="button"
                            disabled={activeLessonStepPerformed}
                            onClick={() =>
                              dispatchGuidedAction(activeLessonStep.targetActionId ?? '')
                            }
                          >
                            {activeLessonStepPerformed ? (
                              <>
                                <Check aria-hidden="true" /> Interaction observed
                              </>
                            ) : (
                              guidedActionLabel(activeLessonStep.targetActionId)
                            )}
                          </button>
                        ) : (
                          <p className={styles.guidedControlPrompt}>
                            Use the highlighted {guidedSurface} surface. This step advances only
                            after the authored control action appears in the simulation record.
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={!activeLessonStepPerformed}
                          onClick={advanceLessonStep}
                        >
                          {activeLessonStepIndex === lesson.steps.length - 1
                            ? 'Load transfer patient'
                            : 'Continue to next step'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : lessonTransfer ? (
                  <div className={styles.transferWorkspace}>
                    <div className={styles.transferContext}>
                      {lessonTransfer.contextItems.map((item) => (
                        <span key={item.label}>
                          <small>{item.label}</small>
                          <strong>{item.value}</strong>
                        </span>
                      ))}
                    </div>
                    <div className={styles.transferGrid}>
                      <fieldset disabled={lessonComplete}>
                        <legend>{lessonTransfer.item.stem}</legend>
                        {lessonTransfer.item.choices.map((choice) => (
                          <label key={choice.id}>
                            <input
                              type="radio"
                              name={`transfer-${lesson.id}`}
                              value={choice.id}
                              checked={transferChoiceId === choice.id}
                              onChange={() => {
                                setTransferChoiceId(choice.id)
                                setTransferFeedback(null)
                              }}
                            />
                            <span>{choice.label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <div className={styles.transferAction}>
                        <strong>Required simulator evidence</strong>
                        <p>{lessonTransfer.requiredActionLabel}</p>
                        <div>
                          {lessonTransfer.requiredActionIds
                            .filter((id) => guidedActionLabel(id))
                            .map((id) => (
                              <button
                                type="button"
                                key={id}
                                disabled={state.actionIds.includes(id)}
                                onClick={() => dispatchGuidedAction(id)}
                              >
                                {state.actionIds.includes(id) ? (
                                  <>
                                    <Check aria-hidden="true" /> {guidedActionLabel(id)}
                                  </>
                                ) : (
                                  guidedActionLabel(id)
                                )}
                              </button>
                            ))}
                        </div>
                        {lessonTransfer.requiredActionIds.every((id) => !guidedActionLabel(id)) ? (
                          <p className={styles.guidedControlPrompt}>
                            Use the highlighted {guidedSurface} controls, then return here to check
                            the transfer decision.
                          </p>
                        ) : null}
                        {!lessonComplete ? (
                          <button type="button" onClick={checkTransferDecision}>
                            Check transfer decision
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {transferFeedback ? (
                      <div
                        className={styles.transferFeedback}
                        data-complete={lessonComplete}
                        role="status"
                      >
                        {lessonComplete ? <Check aria-hidden="true" /> : null}
                        <span>{transferFeedback}</span>
                      </div>
                    ) : null}
                    {lessonComplete ? (
                      <section className={styles.lessonCompletion} aria-label="Lesson complete">
                        <div aria-live="polite">
                          <Check aria-hidden="true" />
                          <span>
                            <strong>Lesson complete</strong>
                            <small>
                              Your transfer evidence is saved. Continue when you are ready.
                            </small>
                          </span>
                        </div>
                        {followingLesson ? (
                          <button type="button" onClick={() => chooseLesson(followingLesson.id)}>
                            <span>
                              Continue to next lesson
                              <small>{followingLesson.title}</small>
                            </span>
                            <ArrowRight aria-hidden="true" />
                          </button>
                        ) : (
                          <Link href={`${mechanicalCirculatorySupportNavBase}/practice`}>
                            <span>
                              Continue to practice
                              <small>Apply the completed lessons in coached cases</small>
                            </span>
                            <ArrowRight aria-hidden="true" />
                          </Link>
                        )}
                      </section>
                    ) : null}
                  </div>
                ) : null}
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
              <div
                data-mobile-visible={mobileSurface === 'anatomy'}
                data-guided-focus={section === 'learn' && guidedSurface === 'anatomy'}
              >
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
              <div
                data-mobile-visible={mobileSurface === 'monitor'}
                data-guided-focus={section === 'learn' && guidedSurface === 'monitor'}
              >
                <McsMonitor state={state} revealCausality={revealCausality} />
              </div>
              <div
                className={styles.liveControlsRail}
                data-mobile-visible={mobileSurface === 'controls'}
                data-guided-focus={section === 'learn' && guidedSurface === 'controls'}
              >
                <McsControls state={state} dispatch={dispatch} />
              </div>
            </section>
            <section
              className={styles.taskGrid}
              data-mobile-visible={mobileSurface === 'workflow'}
              data-guided-focus={section === 'learn' && guidedSurface === 'workflow'}
            >
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
