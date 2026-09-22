'use client'

import type { Route } from 'next'
import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import { Check } from 'lucide-react'

import { criticalCareActivityById } from '@/features/critical-care/content/activities'
import { resolveCriticalCareEvidence } from '@/features/critical-care/content/evidenceRegistry'
import { type CriticalCareActivityPhase } from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { mechanicalCirculatorySupportNavBase } from '@/features/learning-module/moduleRoutes'
import { SimulationLaunchGate } from '@/features/learning-module/components/SimulationLaunchGate'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { Link, useRouter } from '@/i18n/navigation'

import {
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
  createInitialMcsState,
  mcsReducer,
  type McsDeviceKind,
  type McsModuleSection,
  type McsSimulationState,
} from '../engine'
import {
  emptyMcsLearningProgress,
  readMcsLearningProgress,
  recordMcsVisit,
} from '../engine/learningProgress'
import { CirculationMap } from './circulation-map/CirculationMap'
import { mcsPresentationTitle } from '../content/casePresentation'
import { MCS_AF_TRIGGER_CONTAINMENT, mcsAfTriggerLimitApplies } from '../content/afTriggerLimit'
const McsAnatomy3D = lazy(() =>
  import('./McsAnatomy3D').then((module) => ({ default: module.McsAnatomy3D })),
)
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
  const [progress, setProgress] = useState(emptyMcsLearningProgress)
  const [selectedActivityId, setSelectedActivityId] = useState(
    section === 'practice'
      ? (requestedPractice?.id ?? 'studio')
      : (requestedCapstone?.id ?? initialCapstoneForDevice?.id ?? 'CAP-IABP-01'),
  )
  const [studioOpen, setStudioOpen] = useState(
    Boolean(initialDevice) && !requestedPractice && section === 'practice',
  )
  const [anatomyOpen, setAnatomyOpen] = useState(false)
  const [helpVisible, setHelpVisible] = useState(false)
  const activeHref = `${mechanicalCirculatorySupportNavBase}/${section}`
  const revealCausality = true
  const activityMode = 'guided' as const
  const lifecycleActivityId =
    section === 'practice'
      ? `mcs:practice:${state.scenario?.id ?? `studio-${state.deviceKind}`}`
      : `mcs:assess:${state.scenario?.id ?? selectedActivityId}`
  const lifecyclePhase: CriticalCareActivityPhase = !state.scenario
    ? ('recognize' as const)
    : semanticPhaseByMcsPhase[state.scenarioPhase]
  const catalogActivity = criticalCareActivityById.get(lifecycleActivityId)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (state.scenario) recordMcsVisit(state.scenario.id, section, state.deviceKind)
      setProgress(readMcsLearningProgress())
    }, 0)
    return () => window.clearTimeout(timer)
  }, [state.scenario, state.deviceKind, section])

  useEffect(() => {
    if (!state.scenario && !studioOpen) return
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const intervalMs = reducedMotion ? 250 : 100
    const timer = window.setInterval(
      () => dispatch({ type: 'TICK', seconds: intervalMs / 1000 }),
      intervalMs,
    )
    return () => window.clearInterval(timer)
  }, [state.scenario, studioOpen])

  function openStudio(device: McsDeviceKind) {
    setStudioOpen(true)
    setAnatomyOpen(false)
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

    dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
  }

  function choosePractice(id: string) {
    if (id === 'studio') return openStudio(state.deviceKind)
    const scenario = mcsPracticeScenarios.find((candidate) => candidate.id === id)
    if (!scenario) return
    setHelpVisible(false)
    setSelectedActivityId(id)
    setAnatomyOpen(false)

    dispatch({ type: 'LOAD_SCENARIO', scenario })
  }

  const devicePractice = mcsPracticeScenarios.filter(
    (scenario) => scenario.device === state.deviceKind,
  )
  const capstone = mcsCapstoneScenarios.find((scenario) => scenario.device === state.deviceKind)
  const activeTitle = state.scenario
    ? state.completed
      ? state.scenario.title
      : mcsPresentationTitle(state.scenario)
    : studioOpen
      ? 'Mechanism Studio'
      : section === 'practice'
        ? 'Practice'
        : 'Integrated cases'
  const currentObjective =
    (state.scenario
      ? 'Interpret the observations, explain the support pathway’s limits, and reassess the patient.'
      : undefined) ?? 'Compare device support with the synchronized patient and circuit response.'
  const requiredAction = state.scenario
    ? state.scenarioPhase === 'predict'
      ? state.scenario.predictionPrompt
      : 'Explore the model, try an optional prediction, or open the case explanation.'
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
            candidate.id !== state.scenario?.id && !progress.visitedCaseIds.includes(candidate.id),
        ) ?? null)
      : null
  const progressLabel = 'Topic visits and last location stay in this browser'

  function saveAndExit() {
    router.push(mechanicalCirculatorySupportNavBase as Route)
  }

  function resetActivity() {
    setHelpVisible(false)

    dispatch({ type: 'RESET' })
  }

  function focusRestoredActivity() {
    document.getElementById('mcs-activity-viewport')?.focus({ preventScroll: true })
  }

  function selectActivityPhase(phase: CriticalCareActivityPhase) {
    setHelpVisible(false)
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
    setHelpVisible(true)
  }

  return (
    <McsModuleFrame locale={locale} activeHref={activeHref} activityMode flowing theme="light">
      <ActivityShell
        layout="native-workbench"
        activityId={lifecycleActivityId}
        assumedConceptIds={catalogActivity?.assumedConceptIds}
        breadcrumb={
          <>
            <Link href={mechanicalCirculatorySupportNavBase}>Mechanical Circulatory Support</Link>
            {' / '}
            {section === 'assess' ? 'Integrated cases' : 'Practice'}
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
                  value: revealCausality
                    ? congestionPattern(state)
                    : 'Interpret the displayed filling pressures',
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
                    state.alarms.find((alarm) => alarm.active)?.label ??
                    (mcsAfTriggerLimitApplies(state)
                      ? MCS_AF_TRIGGER_CONTAINMENT.notAnAllClear
                      : 'No active modeled alarm'),
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
            targets={revealCausality ? (state.scenario?.learningObjectives ?? []) : []}
            hint={state.scenario?.guidedPrompt || state.scenario?.debrief[0]}
            mode={activityMode}
            hintVisible={helpVisible}
            onHintRequested={showHelp}
          >
            <div className={styles.taskSelectors}>
              <p>
                Switching the device or case starts its reference state and clears current actions
                and answers. Historical records are retained.
              </p>
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
                      data-visited={progress.visitedCaseIds.includes(candidate.id)}
                      onClick={() => choosePractice(candidate.id)}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{mcsPresentationTitle(candidate)}</strong>
                    </button>
                  ))}
                </section>
              ) : (
                <section className={styles.taskCapstoneCard} data-available>
                  <div>
                    <Check aria-hidden="true" />
                    <strong>{capstone ? mcsPresentationTitle(capstone) : 'Integrated case'}</strong>
                  </div>
                  <p>
                    Optional integrated walkthrough. Explanations and controls are available
                    throughout.
                  </p>
                  <button
                    type="button"
                    disabled={!capstone}
                    onClick={() => {
                      if (!capstone) return
                      setHelpVisible(false)

                      setSelectedActivityId(capstone.id)
                      dispatch({ type: 'LOAD_SCENARIO', scenario: capstone })
                    }}
                  >
                    Open integrated case
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
                Next recommended · {mcsPresentationTitle(nextPractice)}
              </Link>
            ) : null}
          </>
        }
        viewport={
          <div id="mcs-activity-viewport" className={styles.activityViewport} tabIndex={-1}>
            {!state.scenario && !studioOpen ? (
              <section className={styles.practiceEntry} aria-label="Choose your practice">
                <article>
                  <h2>Explore mechanisms</h2>
                  <p>
                    Mechanism Studio is open exploration. Change a device setting or loading
                    condition and inspect the response. Use Reset to restore the reference patient
                    and device settings.
                  </p>
                  <button type="button" onClick={() => openStudio(state.deviceKind)}>
                    Explore mechanisms
                  </button>
                </article>
                <article>
                  <h2>
                    {section === 'practice' ? 'Work a clinical case' : 'Explore an integrated case'}
                  </h2>
                  <p>
                    {section === 'practice'
                      ? 'Start with the patient presentation, then inspect, act and reassess.'
                      : 'Explore freely, show the explanation, and repeat at your own pace.'}
                  </p>
                  {(section === 'practice' ? mcsPracticeScenarios : mcsCapstoneScenarios).map(
                    (candidate) => (
                      <button
                        type="button"
                        key={candidate.id}
                        onClick={() => {
                          if (section === 'practice') choosePractice(candidate.id)
                          else {
                            setSelectedActivityId(candidate.id)
                            setAnatomyOpen(false)

                            dispatch({ type: 'LOAD_SCENARIO', scenario: candidate })
                          }
                        }}
                      >
                        {candidate.id} · {mcsPresentationTitle(candidate)}
                      </button>
                    ),
                  )}
                </article>
              </section>
            ) : (
              <>
                <McsCaseWorkflow
                  key={`${state.scenario?.id ?? 'studio'}:${state.seed}`}
                  state={state}
                  dispatch={(action) => {
                    if (action.type === 'RESET') resetActivity()
                    else dispatch(action)
                  }}
                  observations={<McsMonitor state={state} revealCausality={revealCausality} />}
                  controls={
                    <McsControls state={state} dispatch={dispatch} hideUnavailable={false} />
                  }
                />
                <details className={styles.optionalCaseView}>
                  <summary>Support pathway · lightweight circulation map</summary>
                  <CirculationMap state={state} />
                </details>
                <section className={styles.optionalCaseView} data-optional-anatomy>
                  <button
                    type="button"
                    aria-expanded={anatomyOpen}
                    onClick={() => setAnatomyOpen((open) => !open)}
                  >
                    Optional three-dimensional view
                  </button>
                  {anatomyOpen ? (
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
                      <Suspense fallback={<p>Loading optional anatomy…</p>}>
                        <McsAnatomy3D state={state} revealCausality={revealCausality} />
                      </Suspense>
                    </SimulationLaunchGate>
                  ) : null}
                </section>
              </>
            )}

            <section className={styles.privacyNote}>
              <strong>Privacy boundary</strong>
              <span>
                Only topic visits and the last location are saved locally. Current model controls
                and optional responses restart when you reload. Help use is not recorded.
              </span>
            </section>
            <McsSourcesPanel />
          </div>
        }
      />
    </McsModuleFrame>
  )
}
