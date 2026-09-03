'use client'

import { useCallback, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { HeartPulse, Wind } from 'lucide-react'

import { Link, useRouter } from '@/i18n/navigation'
import { type CriticalCareActivityPhase } from '@/features/learning-module/activity'
import { ActivityShell } from '@/features/learning-module/components/ActivityShell'
import { DebriefPanel } from '@/features/learning-module/components/DebriefPanel'
import { EvidenceDrawer } from '@/features/learning-module/components/EvidenceDrawer'
import { PatientContextBar } from '@/features/learning-module/components/PatientContextBar'
import { ReferenceDrawer } from '@/features/learning-module/components/ReferenceDrawer'
import { ResumeBanner } from '@/features/learning-module/components/ResumeBanner'
import { TaskPanel } from '@/features/learning-module/components/TaskPanel'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { cardiohelpEvidence } from '../content/evidence'
import {
  type CircuitViewPreference,
  type GuidedControlId,
  type GuidedLessonDefinition,
  type GuidedTarget,
  type GuidedWalkthroughStep,
  type ModuleSection,
  type ScenarioDefinition,
  type SupportMode,
} from '../engine'
import { useEcmoSessionCore, type EcmoSessionLoadReason } from '../session/useEcmoSessionCore'
import { CardiohelpConsole } from './CardiohelpConsole'
import { formatChannelGroup } from './channelReadout'
import { CircuitAndMonitors } from './CircuitAndMonitors'
import { EcmoLearnWorkspace } from './EcmoLearnWorkspace'
import { FitWidthSurface } from './FitWidthSurface'
import { PracticeCasePlayer, type EcmoPracticeStage } from './PracticeCasePlayer'
import { CardiohelpModuleFrame } from './CardiohelpModuleFrame'
import { useAlarmAudio } from './useAlarmAudio'
import styles from './cardiohelp-ecmo.module.css'

interface CardiohelpWorkbenchProps {
  section: ModuleSection
  locale?: string
}

/**
 * The activity surface for Learn drills, Practice cases and the Challenge capstones.
 *
 * Everything about the simulation session — reducer, progress, hydration, clock, analytics,
 * loaders — lives in `useEcmoSessionCore`. What stays here is view state: which panel is guided,
 * which control is spotlighted, which stage or step is active, and whether help is open. The
 * session tells this component when a scenario has been loaded so those can be reset.
 */
export function CardiohelpWorkbench({ section, locale = 'en' }: CardiohelpWorkbenchProps) {
  const router = useRouter()
  const [guidedTarget, setGuidedTarget] = useState<GuidedTarget | null>(
    section === 'learn' ? 'circuit' : null,
  )
  const [guidedControlId, setGuidedControlId] = useState<GuidedControlId | null>(null)
  const [circuitViewPreference, setCircuitViewPreference] = useState<{
    readonly view: CircuitViewPreference
    readonly stepId: string
  } | null>(null)
  const [activeLearnStep, setActiveLearnStep] = useState<GuidedWalkthroughStep | null>(null)
  const [activePracticeStage, setActivePracticeStage] = useState<EcmoPracticeStage>('brief')
  const [phaseRequest, setPhaseRequest] = useState<{
    readonly stage: EcmoPracticeStage
    readonly requestId: number
  } | null>(null)
  const [helpVisible, setHelpVisible] = useState(false)

  const onLearnLessonLoaded = useCallback(
    (lesson: GuidedLessonDefinition, reason: EcmoSessionLoadReason) => {
      setHelpVisible(false)
      setGuidedTarget(lesson.steps[0]?.target ?? (reason === 'hydrate' ? 'circuit' : 'console'))
      setGuidedControlId(null)
      if (lesson.steps[0]) setActiveLearnStep(lesson.steps[0])
    },
    [],
  )
  const onPracticeCaseLoaded = useCallback((definition: ScenarioDefinition) => {
    setHelpVisible(false)
    setGuidedControlId(null)
    setActivePracticeStage(definition.clinicalCase ? 'brief' : 'plan')
  }, [])

  const core = useEcmoSessionCore({ section, onLearnLessonLoaded, onPracticeCaseLoaded })
  const {
    state,
    dispatch,
    scenario,
    outcome,
    supportMode,
    activityMode,
    hydrated,
    progress,
    learnLesson,
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
  } = core

  useAlarmAudio(state)

  const currentLearnStep = activeLearnStep ?? learnLesson.steps[0]
  const latestPracticeHint = [...(scenario.hints ?? [])]
    .reverse()
    .find((hint) => state.scenario.usedHintIds.includes(hint.id))
  const activeGuidedTarget =
    section === 'learn' ? guidedTarget : (latestPracticeHint?.target ?? null)
  const activeGuidedControlId =
    section === 'learn' ? guidedControlId : (latestPracticeHint?.controlId ?? null)

  const handleGuidedTargetChange = useCallback((target: GuidedTarget | null) => {
    setGuidedTarget(target)
  }, [])
  const handleCircuitViewPreferenceChange = useCallback(
    (preference: { view: CircuitViewPreference; stepId: string } | null) => {
      setCircuitViewPreference(preference)
    },
    [],
  )
  const handleGuidedControlHelpChange = useCallback((controlId: GuidedControlId | null) => {
    setGuidedControlId(controlId)
  }, [])
  const handleActiveLearnStepChange = useCallback((step: GuidedWalkthroughStep) => {
    setActiveLearnStep(step)
  }, [])
  const handleActivePracticeStageChange = useCallback((stage: EcmoPracticeStage) => {
    setActivePracticeStage(stage)
  }, [])

  const handleTrackKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const nextMode: SupportMode | null =
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
  const currentObjective = section === 'learn' ? currentLearnStep.title : practiceTask.objective
  const currentTargets =
    section === 'learn' ? [currentLearnStep.actionLabel] : [practiceTask.requiredAction]
  const currentRequiredAction =
    section === 'learn' ? currentLearnStep.instruction : practiceTask.requiredAction
  const currentHint =
    activityMode === 'challenge'
      ? undefined
      : section === 'learn'
        ? currentLearnStep.rationale
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
        circuitViewPreference={section === 'learn' ? circuitViewPreference : null}
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
                    onCircuitViewPreferenceChange={handleCircuitViewPreferenceChange}
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
