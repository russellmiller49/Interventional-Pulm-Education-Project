'use client'

import type { Route } from 'next'
import { useEffect, useReducer, useRef, useState } from 'react'
import { Check } from 'lucide-react'

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
import { Link, useRouter } from '@/i18n/navigation'

import {
  MCS_ANALYTICS_MODULE_ID,
  MCS_CONGESTION_PATTERN_BOUNDARY,
  mcsCapstoneScenarios,
  mcsCongestionProfileDefinition,
  mcsCongestionProfileId,
  mcsDerivedValueGuides,
  mcsLessons,
  mcsPracticeScenarios,
  mcsSources,
} from '../content'
import {
  createDefaultMcsProgress,
  createInitialMcsState,
  hasMcsMastery,
  mcsProgressPercent,
  mcsReducer,
  readMcsProgress,
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
import { mcsDeviceFlowText } from './teaching/selectors'
import styles from './mechanical-circulatory-support.module.css'

/**
 * The two sections the workbench still hosts. Learn moved to the lesson stage
 * (`stage/McsStageHost`), which the Learn route renders directly.
 */
export type McsWorkbenchSection = Exclude<McsModuleSection, 'learn'>

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

/**
 * The filling-pressure congestion pattern, from the framework the module already carries.
 *
 * What stood here was a private classifier: left-limited below a contractility of 0.55 or a wedge of
 * 20, right-limited below 0.55, below the simulator's PAPi boundary, or at a right atrial pressure
 * of 14 — and from those, a confident label naming a ventricular shock mechanism. None of those cut
 * points came from anywhere, and M4 had already removed the equivalent classifier from the teaching
 * panel below. The bar above it went on stating the mechanism the panel had stopped claiming.
 *
 * It now reads the accepted ACC-described pattern, at the same threshold and through the same
 * helper the panel uses. A pattern says where filling pressures are elevated; it does not name the
 * cause of shock and does not select a device, which is why the boundary travels with it.
 *
 * The modeled pericardial constraint is named separately rather than replacing the pattern: it is a
 * selected obstruction fault in this simulation, not a fourth congestion category.
 */
function congestionPattern(state: McsSimulationState): string {
  const profile = mcsCongestionProfileDefinition(
    mcsCongestionProfileId(state.metrics.rapMmHg, state.metrics.pcwpMmHg),
  )
  return state.patient.tamponade
    ? `${profile.label} · modeled pericardial constraint`
    : profile.label
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

export function McsWorkbench({
  section,
  locale = 'en',
  initialDevice,
  initialActivityId,
}: {
  section: McsWorkbenchSection
  locale?: string
  initialDevice?: McsDeviceKind
  initialActivityId?: string
}) {
  const router = useRouter()
  const requestedPractice =
    section === 'practice'
      ? mcsPracticeScenarios.find((candidate) => candidate.id === initialActivityId)
      : undefined
  const requestedCapstone =
    section === 'assess'
      ? mcsCapstoneScenarios.find((candidate) => candidate.id === initialActivityId)
      : undefined
  const requestedActivityDevice = requestedPractice?.device ?? requestedCapstone?.device
  const activeInitialDevice = initialDevice ?? requestedActivityDevice ?? 'iabp'
  /*
   * Mechanism Studio has no scenario of its own. While no scenario is loaded, the reference and
   * evidence drawers stand on the first lesson of the requested device track, as they always have.
   */
  const studioLesson = initialDevice
    ? (mcsLessons.find((candidate) => candidate.device === initialDevice) ?? mcsLessons[0])
    : mcsLessons[0]
  const initialCapstoneForDevice = mcsCapstoneScenarios.find(
    (candidate) => candidate.device === activeInitialDevice,
  )
  const [state, dispatch] = useReducer(mcsReducer, undefined, () => {
    const initial = createInitialMcsState(section, activeInitialDevice)
    const requestedScenario = requestedPractice ?? requestedCapstone
    return requestedScenario
      ? mcsReducer(initial, { type: 'LOAD_SCENARIO', scenario: requestedScenario })
      : initial
  })
  const [progress, setProgress] = useState<McsProgressV1>(createDefaultMcsProgress)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState(
    section === 'practice'
      ? (requestedPractice?.id ?? 'studio')
      : (requestedCapstone?.id ?? initialCapstoneForDevice?.id ?? 'CAP-IABP-01'),
  )
  const [mobileSurface, setMobileSurface] = useState<MobileSurface>('anatomy')
  const [helpVisible, setHelpVisible] = useState(false)
  const [showChallengeFeedback, setShowChallengeFeedback] = useState(false)
  const recordedCompletion = useRef<string | null>(null)
  const recordedSafetyEvents = useRef(new Set<string>())
  const activeHref = `${mechanicalCirculatorySupportNavBase}/${section}`
  const revealCausality =
    section !== 'assess' ||
    showChallengeFeedback ||
    state.completed ||
    state.alarms.some((alarm) => alarm.active && alarm.priority === 'critical')
  const activityMode = section === 'practice' ? ('practice' as const) : ('challenge' as const)
  const lifecycleActivityId =
    section === 'practice'
      ? `mcs:practice:${state.scenario?.id ?? `studio-${state.deviceKind}`}`
      : `mcs:assess:${state.scenario?.id ?? selectedActivityId}`
  const lifecyclePhase: CriticalCareActivityPhase = !state.scenario
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
      if (requestedPractice) {
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
  }, [requestedPractice])

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

  function selectDevice(device: McsDeviceKind) {
    if (section === 'practice') return openStudio(device)
    const capstone = mcsCapstoneScenarios.find((candidate) => candidate.device === device)
    if (!capstone) return
    setSelectedActivityId(capstone.id)
    setHelpVisible(false)
    setShowChallengeFeedback(false)
    dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
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
  const activeTitle = state.scenario?.title ?? 'Mechanism Studio'
  const currentObjective =
    state.scenario?.learningObjectives[0] ??
    'Compare device support with the synchronized patient and circuit response.'
  const requiredAction = state.scenario
    ? state.scenarioPhase === 'predict'
      ? state.scenario.predictionPrompt
      : state.scenario.guidedPrompt
    : 'Change one bounded variable and reconcile the patient, monitor, and device response.'
  const activeSourceIds = state.scenario
    ? [...state.scenario.sourceIds, ...state.scenario.evidenceSourceIds]
    : studioLesson.sourceIds
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
    dispatch({ type: 'RESET' })
  }

  function focusRestoredActivity() {
    document.getElementById('mcs-activity-viewport')?.focus({ preventScroll: true })
  }

  function selectActivityPhase(phase: CriticalCareActivityPhase) {
    setHelpVisible(false)
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
    <McsModuleFrame locale={locale} activeHref={activeHref} activityMode theme="light">
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
                {
                  label: 'Filling-pressure congestion pattern',
                  value: congestionPattern(state),
                },
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
                  value: `Native ${state.metrics.nativeFlowLMin.toFixed(1)} L/min · device ${mcsDeviceFlowText(state)} · effective ${state.metrics.effectiveSystemicFlowLMin.toFixed(1)} L/min`,
                },
                {
                  label: 'Modeled balance and pressure–flow summary',
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
                /*
                 * The two boundaries that belong beside the two values above, in the words the
                 * accepted content already uses: a congestion pattern selects no device, and a
                 * cardiac power output above the cited bands is not evidence of perfusion.
                 */
                MCS_CONGESTION_PATTERN_BOUNDARY.doesNotEstablish,
                mcsDerivedValueGuides.cardiacPowerOutputW.doNotInfer,
              ]}
            />
            {initialActivityId ? (
              <ResumeBanner
                state="ready"
                title="Return to saved case"
                description={`${activeTitle} is open with its saved route and device selection. Prior controls and answers were not replayed.`}
                onResume={focusRestoredActivity}
                resumeActionLabel="Return to case"
              />
            ) : null}
          </>
        }
        currentTask={
          <TaskPanel
            objective={currentObjective}
            requiredAction={requiredAction}
            targets={state.scenario?.learningObjectives ?? []}
            hint={state.scenario?.guidedPrompt}
            mode={activityMode}
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          >
            <div className={styles.taskSelectors}>
              {/*
               * The device tabs are an axis orthogonal to the teaching sequence, which is why the
               * lesson stage that now carries Learn has none. Practice and Challenge keep them.
               */}
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
              {section === 'practice' ? (
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
                  id: state.scenario?.id ?? studioLesson.id,
                  title: activeTitle,
                  summary: state.scenario?.presentation ?? studioLesson.summary,
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
            {nextPractice ? (
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
              <McsCaseWorkflow
                state={state}
                dispatch={dispatch}
                showChallengeFeedback={showChallengeFeedback}
                onShowChallengeFeedbackChange={setShowChallengeFeedback}
              />
            </section>

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
