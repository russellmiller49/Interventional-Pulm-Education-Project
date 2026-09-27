'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { CirclePause, CirclePlay, Clock3, Lightbulb, StepForward } from 'lucide-react'

import { useRouter } from '@/i18n/navigation'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'

import { caseKindLabel } from '../../content/casePresentation'
import { clinicalPracticeScenarioById } from '../../content/clinicalCases'
import {
  cardiohelpCurriculum,
  curriculumUnitById,
  orderedCaseScenarioIds,
  unitIdByCaseScenarioId,
} from '../../content/curriculum'
import { predictionGoals } from '../../content/scenarios'
import { resolvePumpStopExplanation } from '../../engine'
import type { ScenarioOutcome } from '../../engine'
import type {
  EcmoSimulationState,
  ModuleSection,
  ProgressV2,
  ScenarioDefinition,
  SimulationAction,
  SimulationMode,
  SupportMode,
} from '../../engine/types'
import { useEcmoSessionCore, type EcmoActivityMode } from '../../session/useEcmoSessionCore'
import { CardiohelpConsole } from '../CardiohelpConsole'
import { CardiohelpModuleFrame } from '../CardiohelpModuleFrame'
import { formatChannelGroup } from '../channelReadout'
import { FitWidthSurface } from '../FitWidthSurface'
import {
  ActionPanel,
  ClinicalCaseBrief,
  PredictionPanel,
  MODELED_TIME_NOTE,
  PRESENTATION_DATA_NOTE,
  ReassessmentPanel,
  advanceSimulation,
} from '../PracticeCasePlayer'
import { EcmoActivityShell } from '../shell/EcmoActivityShell'
import { EcmoContextStrip, type EcmoContextStripLine } from '../shell/EcmoContextStrip'
import { EcmoHelpDialog } from '../shell/EcmoHelpDialog'
import { EcmoNowCard } from '../shell/EcmoNowCard'
import { EcmoSectionHeader } from '../shell/EcmoSectionHeader'
import { EcmoSimulatorSurfaces } from '../shell/EcmoSimulatorSurfaces'
import { EcmoTrackToggle } from '../shell/EcmoTrackToggle'
import shellStyles from '../shell/EcmoActivityShell.module.css'
import type { StageSurfaceId } from '../stage/stageModel'
import { useAlarmAudio } from '../useAlarmAudio'
import playerStyles from '../cardiohelp-ecmo.module.css'
import { EcmoCaseDebrief, type EcmoCaseDebriefProps } from './EcmoCaseDebrief'
import { resolveNowCard } from './nowCard'
import { describeSafetyEvents } from './safetyLabels'
import {
  resolvePracticeStages,
  semanticPhaseByCaseStage,
  stageReachable,
  type EcmoPracticeStage,
} from './stages'
import {
  practiceCaseLeadsWithPatientOxygenation,
  surfaceForControl,
  surfaceForTarget,
  surfacesForStage,
} from './surfaceDisclosure'
import styles from './EcmoPracticeActivity.module.css'

/**
 * Practice and integrated cases share the existing simulation session and one visible stage.
 * Stages are freely navigable. Starting management initializes activity readiness, while engine
 * facts still determine whether an action or observation actually occurred. Optional responses,
 * clues and disclosures remain local to the current attempt; only topic visits persist.
 */

const CASE_COLUMN_ID = 'ecmo-practice-case-column'

export interface EcmoPracticeCaseViewProps {
  readonly section: Exclude<ModuleSection, 'learn'>
  readonly locale?: string
  readonly state: EcmoSimulationState
  readonly dispatch: (action: SimulationAction) => void
  readonly scenario: ScenarioDefinition
  readonly outcome: ScenarioOutcome
  readonly progress: ProgressV2
  readonly supportMode: SupportMode
  readonly activityMode: EcmoActivityMode
  readonly hydrated?: boolean
  readonly resumedFromStorage?: boolean
  readonly assumedConceptIds?: readonly string[]
  readonly onLoadScenario: (scenarioId: string, mode?: SimulationMode) => void
  readonly onSelectTrack: (mode: SupportMode) => void
  readonly onReveal: () => void
  readonly onSaveAndExit: () => void
  readonly onReset: () => void
  /** The shared lifecycle phase, for analytics; fires when the case's stage changes. */
  readonly onStageChange?: (stage: EcmoPracticeStage) => void
  readonly onHintUsed?: () => void
  /** Fired after a case is loaded, so view state that belongs to the old case can close. */
  readonly onNavigate?: (href: { pathname: string; query?: Record<string, string> }) => void
}

export function EcmoPracticeActivity({
  section,
  locale = 'en',
}: {
  readonly section: Exclude<ModuleSection, 'learn'>
  readonly locale?: string
}) {
  const router = useRouter()
  const [loadCount, setLoadCount] = useState(0)
  const onPracticeCaseLoaded = useCallback(() => setLoadCount((count) => count + 1), [])
  const core = useEcmoSessionCore({ section, onPracticeCaseLoaded })
  useAlarmAudio(core.state)
  const { setSemanticPhase, lifecycleAnalytics } = core
  const onStageChange = useCallback(
    (stage: EcmoPracticeStage) => setSemanticPhase(semanticPhaseByCaseStage[stage]),
    [setSemanticPhase],
  )
  const onHintUsed = useCallback(() => lifecycleAnalytics.recordHintUsed(), [lifecycleAnalytics])

  return (
    <EcmoPracticeCaseView
      key={loadCount}
      section={section}
      locale={locale}
      state={core.state}
      dispatch={core.dispatch}
      scenario={core.scenario}
      outcome={core.outcome}
      progress={core.progress}
      supportMode={core.supportMode}
      activityMode={core.activityMode}
      hydrated={core.hydrated}
      resumedFromStorage={core.resumedFromStorage}
      assumedConceptIds={core.catalogActivity?.assumedConceptIds}
      onLoadScenario={core.loadPracticeScenario}
      onSelectTrack={core.selectTrack}
      onReveal={core.revealDebrief}
      onSaveAndExit={core.saveAndExit}
      onReset={core.resetActivity}
      onStageChange={onStageChange}
      onHintUsed={onHintUsed}
      onNavigate={(href) => router.push(href)}
    />
  )
}

export function EcmoPracticeCaseView({
  section,
  locale = 'en',
  state,
  dispatch,
  scenario,
  outcome,
  progress,
  supportMode,
  activityMode,
  hydrated = true,
  resumedFromStorage = false,
  assumedConceptIds,
  onLoadScenario,
  onSelectTrack,
  onReveal,
  onSaveAndExit,
  onReset,
  onStageChange,
  onNavigate,
}: EcmoPracticeCaseViewProps) {
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [shownHintIds, setShownHintIds] = useState<readonly string[]>([])
  const [view, setView] = useState<{
    readonly attemptKey: string
    readonly briefAcknowledged: boolean
    readonly expanded: {
      readonly whenCurrent: EcmoPracticeStage
      readonly stage: EcmoPracticeStage
    } | null
    readonly surfaces: {
      readonly stage: EcmoPracticeStage
      readonly open: readonly StageSurfaceId[]
    } | null
  } | null>(null)

  const attemptKey = `${scenario.id}:${state.simulationMode}:${state.scenario.attempts}`
  const attemptView = view?.attemptKey === attemptKey ? view : null
  const briefAcknowledged = attemptView?.briefAcknowledged ?? false
  const committedGoalLabel = predictionGoals.find(
    (goal) => goal.id === state.scenario.prediction.goalId,
  )?.label
  const facts = resolvePracticeStages(state, scenario, briefAcknowledged, committedGoalLabel)
  const { currentStage, stages } = facts
  const activeStage: EcmoPracticeStage =
    attemptView?.expanded && attemptView.expanded.whenCurrent === currentStage
      ? attemptView.expanded.stage
      : currentStage
  const reviewing = activeStage !== currentStage
  const debriefRevealed = facts.debriefRevealed
  const showTeachingFeedback = true

  useEffect(() => {
    onStageChange?.(currentStage)
  }, [currentStage, onStageChange])

  /* ------------------------------------------------------------------ *
   * Machine tasks, clues, initiation orders — what the Now card and the surfaces read
   * ------------------------------------------------------------------ */
  const clinicalCase = scenario.clinicalCase
  const clinical = state.scenario.clinical
  const appliedIds = new Set(clinical?.appliedInterventions.map((record) => record.interventionId))
  const pendingMachineTask = clinicalCase?.interventions.find(
    (item) => item.simulatorAction?.visibility === 'prompted' && !appliedIds.has(item.id),
  )
  const targets = clinicalCase?.initiationTargets
  const initiationControls = targets
    ? [
        {
          controlId: 'cardiohelp-rpm-control',
          matched: Math.abs(state.device.rpmSetpoint - targets.rpm) <= (targets.rpmTolerance ?? 50),
        },
        {
          controlId: 'cardiohelp-sweep-control',
          matched:
            Math.abs(state.gas.sweepLpm - targets.sweepLpm) <= (targets.sweepTolerance ?? 0.1),
        },
        {
          controlId: 'cardiohelp-fio2-control',
          matched: Math.abs(state.gas.fio2 - targets.fio2) <= (targets.fio2Tolerance ?? 0.01),
        },
      ]
    : null
  const initiation =
    initiationControls && clinical && clinical.supportStatus !== 'on-ecmo'
      ? {
          allMatched: initiationControls.every((item) => item.matched),
          nextControlId: initiationControls.find((item) => !item.matched)?.controlId ?? null,
        }
      : null

  const hints = scenario.hints ?? []
  const usedHints = hints.filter((hint) => shownHintIds.includes(hint.id))
  const nextHint = hints.find((hint) => !shownHintIds.includes(hint.id))
  const latestHint = usedHints.at(-1)
  const activeGuidedTarget = latestHint?.target ?? null
  const activeGuidedControlId = latestHint?.controlId ?? null

  /* ------------------------------------------------------------------ *
   * Surfaces: declared per stage, opened by the learner, applied on entry only
   * ------------------------------------------------------------------ */
  const surfaceExtras = [
    ...(pendingMachineTask?.simulatorAction && activeStage === 'manage'
      ? [surfaceForControlTarget(pendingMachineTask.simulatorAction.controlId)]
      : []),
    ...(latestHint?.target ? [latestHint.target] : []),
  ].filter((target): target is NonNullable<typeof target> => Boolean(target))
  const defaultSurfaces = surfacesForStage(activeStage, surfaceExtras, {
    patientOxygenationFocus: practiceCaseLeadsWithPatientOxygenation(scenario.id),
  })
  const openSurfaces = new Set<StageSurfaceId>(
    attemptView?.surfaces && attemptView.surfaces.stage === activeStage
      ? attemptView.surfaces.open
      : defaultSurfaces,
  )

  function updateView(patch: Partial<NonNullable<typeof view>>) {
    setView((current) => {
      const base =
        current?.attemptKey === attemptKey
          ? current
          : { attemptKey, briefAcknowledged: false, expanded: null, surfaces: null }
      return { ...base, ...patch }
    })
  }

  function toggleSurface(surface: StageSurfaceId, open: boolean) {
    const next = new Set(openSurfaces)
    if (open) next.add(surface)
    else next.delete(surface)
    updateView({ surfaces: { stage: activeStage, open: [...next] } })
  }

  function focusControl(controlId: string) {
    const surface = surfaceForControl(controlId)
    if (surface && !openSurfaces.has(surface)) {
      updateView({ surfaces: { stage: activeStage, open: [...openSurfaces, surface] } })
    }
    window.requestAnimationFrame(() => focusElementById(controlId, 'center'))
  }

  function showStage(stage: EcmoPracticeStage) {
    if (!stageReachable(stages, currentStage, stage)) return
    if (stage === 'debrief') {
      onReveal()
      return
    }
    if (stage === 'manage' && !state.scenario.activityStarted) dispatch({ type: 'START_ACTIVITY' })
    updateView({ expanded: stage === currentStage ? null : { whenCurrent: currentStage, stage } })
  }

  function beginCase() {
    updateView({ briefAcknowledged: true, expanded: null })
  }

  function restartCase() {
    onLoadScenario(scenario.id, section === 'assess' ? 'challenge' : state.simulationMode)
  }

  function requestClue() {
    if (!nextHint) return
    setShownHintIds((ids) => [...ids, nextHint.id])
    setHelpOpen(false)
    if (nextHint.focusId) {
      focusControl(nextHint.focusId)
    } else if (nextHint.target) {
      const surface = surfaceForTarget(nextHint.target)
      if (surface) toggleSurface(surface, true)
    }
  }

  /* ------------------------------------------------------------------ *
   * Next step after the debrief
   * ------------------------------------------------------------------ */
  const orderedCases = orderedCaseScenarioIds(supportMode)
  const nextCaseId = orderedCases[orderedCases.indexOf(scenario.id) + 1]
  const recommendedNext =
    section === 'assess'
      ? null
      : nextCaseId
        ? { kind: 'case' as const, scenarioId: nextCaseId }
        : { kind: 'capstone' as const }
  /*
   * Moving to the next case is a load, not a navigation.
   *
   * The next-case target is this same route with a different `case` query, and the session hydrates
   * from `window.location.search` in an effect keyed on `section` — so it reads the URL once, on
   * mount, and a client-side push to the same route changed the address bar and nothing else. A
   * learner review in September 2026 reported it as "I can't advance to the next case", which is
   * exactly what it looked like: the button worked, the URL moved, the case did not.
   *
   * A case therefore loads through the session's own loader, which swaps the scenario, records the
   * progress and syncs the URL. A lesson or the capstone is a different route and still navigates.
   * The href stays on the control either way so it is still a real link to open in a new tab.
   */
  const nextLink: EcmoCaseDebriefProps['nextLink'] = recommendedNext
    ? recommendedNext.kind === 'case'
      ? {
          href: {
            pathname: `${cardiohelpEcmoNavBase}/practice`,
            query: { case: recommendedNext.scenarioId, track: supportMode },
          },
          label: `Case · ${caseLabel(recommendedNext.scenarioId)}`,
          onSelect: () => onLoadScenario?.(recommendedNext.scenarioId),
        }
      : {
          href: { pathname: `${cardiohelpEcmoNavBase}/assess`, query: { track: supportMode } },
          label: `${supportMode.toUpperCase()} integrated case`,
        }
    : null

  /* ------------------------------------------------------------------ *
   * The Now card
   * ------------------------------------------------------------------ */
  const secondsSinceLastAction =
    facts.observation.anchor === null
      ? null
      : Math.max(0, state.simulationTime - facts.observation.anchor)
  const nowModel = resolveNowCard({
    facts,
    activeStage,
    activityMode: 'practice',
    setting: clinicalCase?.setting,
    safety:
      state.scenario.criticalErrors.length > 0
        ? {
            labels: describeSafetyEvents(scenario, state.scenario.criticalErrors),
            lastResponse: clinical?.lastResponse ?? undefined,
          }
        : undefined,
    pendingMachineTask:
      activeStage === 'manage' && pendingMachineTask?.simulatorAction
        ? {
            label: pendingMachineTask.label,
            controlId: pendingMachineTask.simulatorAction.controlId,
          }
        : null,
    initiation,
    secondsSinceLastAction,
    nextLabel: nextLink?.label ?? null,
    actions: {
      beginCase,
      focusControl,
      openStage: showStage,
      advanceSeconds: (seconds) => advanceSimulation(dispatch, seconds),
      reveal: onReveal,
      restart: restartCase,
      replay: onReset,
      next: nextLink?.onSelect
        ? nextLink.onSelect
        : nextLink && onNavigate
          ? () => onNavigate(nextLink.href)
          : undefined,
    },
  })

  /* ------------------------------------------------------------------ *
   * Header, strip, picker
   * ------------------------------------------------------------------ */
  const trackUnits = cardiohelpCurriculum[supportMode]
  const caseUnits = trackUnits.filter((unit) => unit.caseScenarioIds.length > 0)
  const unitId = unitIdByCaseScenarioId.get(scenario.id)
  const unit = unitId ? curriculumUnitById.get(unitId) : undefined
  const unitNumber = unit ? trackUnits.findIndex((item) => item.id === unit.id) + 1 : null
  const unitLabel =
    section === 'assess' ? null : unit && unitNumber ? `Unit ${unitNumber} · ${unit.title}` : null
  const kicker = `${section === 'assess' ? 'Integrated case' : 'Practice'} · ${supportMode.toUpperCase()} track`
  const title = scenario.title
  const meta = [
    caseKindLabel(scenario) ?? `${scenario.clinicalPhase} support`,
    ...(clinicalCase ? [clinicalCase.setting] : []),
    ...(unitLabel ? [unitLabel] : []),
  ]

  const activeAlarm = [...state.alarms]
    .filter((alarm) => alarm.active && alarm.source === 'device')
    .sort((a, b) => alarmRank(b.priority) - alarmRank(a.priority))[0]
  /*
   * The strip's speed field is a setting, and says so whenever the pump is not turning.
   *
   * "2,800 rpm · 2.0 L/min" sat in this line beside a case status of "not on ecmo" (C1-5), and
   * "3,600 rpm" sat beside 0.00 L/min after a protective stop (C3-1). The number was right in both;
   * what it was a number of was not said.
   */
  const pumpStop = resolvePumpStopExplanation(state)
  const contextLine: EcmoContextStripLine = {
    mode: `${supportMode.toUpperCase()} ${section === 'assess' ? 'integrated case' : 'practice'}`,
    flow: state.circuit.flowSensorConnected
      ? `${state.circuit.bloodFlow.toFixed(2)} L/min`
      : '-- · flow sensor disconnected',
    rpm: pumpStop.running
      ? `${state.device.rpmSetpoint} rpm`
      : `${state.device.rpmSetpoint} rpm requested · ${pumpStop.label.toLocaleLowerCase()}`,
    // Before support starts the sweep is a setting on the blender, not gas meeting blood (C1-5).
    sweep:
      state.scenario.clinical && state.scenario.clinical.supportStatus !== 'on-ecmo'
        ? `${state.gas.sweepLpm.toFixed(1)} L/min set · support not started`
        : `${state.gas.sweepLpm.toFixed(1)} L/min`,
    alarm: activeAlarm
      ? { priority: activeAlarm.priority, text: activeAlarm.message }
      : { priority: 'none', text: 'No active device alarm' },
  }
  const contextDetails = [
    {
      label: 'Mode / indication',
      value: `${supportMode.toUpperCase()} · ${clinicalCase?.setting ?? `${scenario.clinicalPhase} support`}`,
    },
    {
      label: 'Cannulation / configuration',
      value:
        supportMode === 'vv'
          ? 'Venous drainage → oxygenator → venous return'
          : 'Venous drainage → oxygenator → arterial return',
    },
    {
      label: 'Drainage / pre-oxygenator / return',
      value: formatChannelGroup(
        [state.circuit.readouts.pVen, state.circuit.readouts.pInt, state.circuit.readouts.pArt],
        'mm Hg',
      ).text,
    },
    {
      label: 'Oxygenator ΔP',
      value: formatChannelGroup([state.circuit.readouts.deltaP], 'mm Hg').text,
    },
    {
      label: 'Sweep-gas oxygen fraction',
      value: `${Math.round(state.gas.fio2 * 100)}%`,
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
  ]

  const caseOptions =
    section === 'practice' ? (
      <details className={styles.caseOptions} data-case-options>
        <summary className={styles.caseOptionsSummary}>Case options</summary>
        <div className={styles.caseOptionsBody}>
          <label>
            Case
            <select value={scenario.id} onChange={(event) => onLoadScenario(event.target.value)}>
              {caseUnits.map((unitItem) => {
                const groupNumber = trackUnits.findIndex((item) => item.id === unitItem.id) + 1
                return (
                  <optgroup key={unitItem.id} label={`Unit ${groupNumber} · ${unitItem.title}`}>
                    {unitItem.caseScenarioIds.map((caseId) => (
                      <option key={caseId} value={caseId}>
                        {caseLabel(caseId)}
                        {progress.visitedTopicIds?.includes(`practice:${supportMode}:${caseId}`)
                          ? ' · visited'
                          : ''}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </label>
        </div>
      </details>
    ) : undefined

  const header = (
    <EcmoSectionHeader
      breadcrumb={{ href: cardiohelpEcmoNavBase, label: 'ECMO Management' }}
      kicker={kicker}
      title={title}
      meta={meta}
      sectionsControl={caseOptions}
      trackToggle={<EcmoTrackToggle supportMode={supportMode} onSelect={onSelectTrack} />}
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={restartCase}
      restartLabel="Restart case"
      onSaveAndExit={onSaveAndExit}
      resumedNote={
        hydrated && resumedFromStorage
          ? 'Reopened where you left off · the case restarts from its opening state'
          : undefined
      }
    />
  )

  /* ------------------------------------------------------------------ *
   * The one live simulator, built once
   * ------------------------------------------------------------------ */
  const consoleNode = (
    <FitWidthSurface mode="actual" label="CARDIOHELP console">
      <CardiohelpConsole
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={activeGuidedTarget}
        guidedControlId={activeGuidedControlId}
        initiationTargets={clinicalCase?.initiationTargets ?? null}
      />
    </FitWidthSurface>
  )

  /* ------------------------------------------------------------------ *
   * The active stage panel
   * ------------------------------------------------------------------ */
  const stageNumber = (stage: EcmoPracticeStage) =>
    stages.find((item) => item.id === stage)?.number ?? 1
  let stagePanel: ReactNode = null
  if (activeStage === 'brief') {
    stagePanel = (
      <section id="practice-brief" aria-label="Case brief" tabIndex={-1}>
        <ClinicalCaseBrief state={state} scenario={scenario} />
      </section>
    )
  } else if (activeStage === 'plan') {
    stagePanel = (
      <>
        {clinicalCase ? (
          <ClinicalCaseBrief state={state} scenario={scenario} />
        ) : scenario.challengeBrief ? (
          <section aria-label="Case brief" className={playerStyles.clinicalCaseBrief}>
            <p>{scenario.challengeBrief.presentation}</p>
          </section>
        ) : null}
        <PredictionPanel
          key={`prediction-${attemptKey}`}
          state={state}
          dispatch={dispatch}
          stageNumber={stageNumber('plan')}
        />
      </>
    )
  } else if (activeStage === 'manage') {
    stagePanel = (
      <>
        {clinical && clinical.revealedFindings.length ? (
          <div
            className={playerStyles.revealedFindings}
            role="status"
            aria-live="polite"
            data-revealed-findings
          >
            <strong>New findings</strong>
            <ul>
              {clinical.revealedFindings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {clinicalCase ? (
          <div className={playerStyles.clinicalDecisionPrompt} data-decision-prompt>
            <div>
              <strong>Your task</strong>
              <span>{clinicalCase.decisionPrompt}</span>
            </div>
          </div>
        ) : null}
        <ActionPanel
          state={state}
          scenario={scenario}
          dispatch={dispatch}
          stageNumber={stageNumber('manage')}
          showTeachingFeedback={showTeachingFeedback}
          onFocusControl={focusControl}
        />
      </>
    )
  } else if (activeStage === 'debrief' && debriefRevealed) {
    stagePanel = (
      <EcmoCaseDebrief
        state={state}
        scenario={scenario}
        outcome={outcome}
        supportMode={supportMode}
        assumedConceptIds={assumedConceptIds}
        nextLink={nextLink}
        onReplay={onReset}
      />
    )
  } else {
    stagePanel = (
      <ReassessmentPanel
        key={`reassessment-${attemptKey}`}
        state={state}
        scenario={scenario}
        dispatch={dispatch}
        onReveal={onReveal}
        stageNumber={stageNumber('reassess')}
        onShowStage={showStage}
        showRevealControl={!facts.reassessmentSubmitted}
      />
    )
  }

  useEffect(() => {
    const column = document.getElementById(CASE_COLUMN_ID)
    const destination =
      facts.reassessmentSubmitted && !debriefRevealed
        ? column?.querySelector<HTMLButtonElement>('[data-now-primary]')
        : column
    destination?.focus({ preventScroll: true })
    column?.scrollIntoView?.({ block: 'start', behavior: 'instant' })
  }, [activeStage, attemptKey, facts.reassessmentSubmitted, debriefRevealed])

  const helpDialog = (
    <EcmoHelpDialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      returnFocusTo={helpButtonRef}
    >
      <p className={shellStyles.kicker}>{nowModel.kicker}</p>
      <p>
        <strong>{nowModel.heading}</strong>
      </p>
      {nowModel.body ? <p>{nowModel.body}</p> : null}
      {nowModel.primary?.onActivate ? (
        <button
          type="button"
          className={shellStyles.nowPrimary}
          onClick={() => {
            setHelpOpen(false)
            nowModel.primary?.onActivate?.()
          }}
        >
          {nowModel.primary.label}
        </button>
      ) : null}
      {hints.length ? (
        <div className={styles.helpClue} data-help-clues="on">
          <strong>Clues</strong>
          {usedHints.length ? (
            <ol>
              {usedHints.map((hint) => (
                <li key={hint.id}>
                  <strong>{hint.title}.</strong> {hint.text}
                </li>
              ))}
            </ol>
          ) : (
            <p>Hints are optional. Read one whenever it would help you explore this case.</p>
          )}
          {nextHint && !debriefRevealed ? (
            <button type="button" onClick={requestClue}>
              <Lightbulb aria-hidden="true" />
              {usedHints.length ? 'Show a stronger clue' : 'Give me a clue'}
            </button>
          ) : usedHints.length ? (
            <p>All available clues have been shown.</p>
          ) : null}
        </div>
      ) : null}
    </EcmoHelpDialog>
  )

  return (
    <CardiohelpModuleFrame
      locale={locale}
      activeHref={`${cardiohelpEcmoNavBase}/${section === 'assess' ? 'assess' : 'practice'}`}
      activityMode
    >
      <EcmoActivityShell
        flowing
        section={section}
        stage={activeStage}
        label={`CARDIOHELP ${section === 'assess' ? 'integrated case' : 'practice'} case`}
        header={header}
        contextStrip={
          <EcmoContextStrip
            line={contextLine}
            details={contextDetails}
            constraints={[
              'Use an independent patient review alongside console and circuit data.',
              'Follow current manufacturer instructions, ELSO guidance, and local policy.',
            ]}
            badge="Simulated values"
            onOpenConsole={
              activeStage === 'manage' || activeStage === 'reassess'
                ? () => focusControl('cardiohelp-console')
                : undefined
            }
          >
            {clinicalCase && (briefAcknowledged || facts.planComplete) ? (
              <dl className={styles.caseData} aria-label="Case data at presentation">
                <div data-presentation-note>
                  <dt>Case data</dt>
                  <dd>{PRESENTATION_DATA_NOTE}</dd>
                </div>
                {clinicalCase.data.map((item) => (
                  <div key={item.label} data-trend={item.trend ?? 'stable'}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </EcmoContextStrip>
        }
        footer={
          <p className={styles.footerLine}>
            Education only · a bounded teaching model, not a clinical device or a treatment protocol
            · personal history stays local
          </p>
        }
      >
        <div
          className={`${styles.body} ${styles.flowBody}`}
          data-presentation="clinical-case"
          data-case-stage={activeStage}
          data-hydrated={hydrated}
          data-activity-mode={activityMode}
        >
          <div
            id={CASE_COLUMN_ID}
            className={styles.caseColumn}
            role="region"
            aria-label="Case workflow"
            tabIndex={-1}
            data-case-column
          >
            <div className={styles.nowCardHolder}>
              <EcmoNowCard
                model={
                  activeStage === 'debrief' && debriefRevealed
                    ? { ...nowModel, primary: undefined, secondary: undefined }
                    : nowModel
                }
              >
                {clinicalCase?.initiationTargets &&
                (activeStage === 'brief' || activeStage === 'plan') ? (
                  <aside aria-label="Written simulation order" className="rounded-xl border p-3">
                    <p>Simulated case order</p>
                    <p>
                      {clinicalCase.initiationTargets.rpm} RPM · Sweep{' '}
                      {clinicalCase.initiationTargets.sweepLpm} L/min · Sweep-gas oxygen fraction{' '}
                      {clinicalCase.initiationTargets.fio2.toFixed(2)}
                    </p>
                  </aside>
                ) : null}
                <div className={styles.stagePanel} data-stage-panel={activeStage}>
                  {stagePanel}
                </div>
                {/*
                  Buttons that look like buttons (C1-5). They were bare text in a row — "Start guided
                  activity  Show explanation without answering  Hint  Try again" read as a sentence.
                */}
                <div
                  className="my-4 flex flex-wrap gap-3"
                  role="group"
                  aria-label="Self-paced case navigation"
                  data-self-paced-row
                >
                  {activeStage !== 'manage' ? (
                    <button
                      type="button"
                      className={shellStyles.nowSecondary}
                      onClick={() => showStage('manage')}
                    >
                      Start guided activity
                    </button>
                  ) : null}
                  {!debriefRevealed ? (
                    <button
                      type="button"
                      className={shellStyles.nowSecondary}
                      onClick={() => {
                        onReveal()
                        updateView({ expanded: null })
                      }}
                    >
                      Show explanation without answering
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={shellStyles.nowSecondary}
                    onClick={() => setHelpOpen(true)}
                  >
                    Hint
                  </button>
                  <button type="button" className={shellStyles.nowSecondary} onClick={onReset}>
                    Try again
                  </button>
                  <button
                    type="button"
                    className={shellStyles.nowSecondary}
                    onClick={() => {
                      if (nextLink?.onSelect) nextLink.onSelect()
                      else
                        onNavigate?.(
                          nextLink?.href ?? {
                            pathname: `${cardiohelpEcmoNavBase}/learn`,
                            query: { track: supportMode },
                          },
                        )
                    }}
                  >
                    Continue to another topic
                  </button>
                </div>
              </EcmoNowCard>
            </div>
            <details className={styles.workflowMap}>
              <summary>Case workflow</summary>
              <nav aria-label="Practice workflow steps">
                <ol className={styles.stageNav} data-stages={stages.length}>
                  {stages.map((stage) => {
                    const stateLabel = stage.complete
                      ? 'complete'
                      : stage.id === currentStage
                        ? 'current'
                        : 'available'
                    return (
                      <li key={stage.id}>
                        <button
                          type="button"
                          className={styles.stageButton}
                          data-state={stateLabel}
                          data-expanded={stage.id === activeStage}
                          aria-current={stage.id === currentStage ? 'step' : undefined}
                          onClick={() => showStage(stage.id)}
                        >
                          <span>{stage.complete ? '✓' : stage.number}</span>
                          <strong>{stage.label}</strong>
                          <small>{stage.summary ?? stateLabel}</small>
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </nav>
            </details>
            {reviewing ? (
              <p className={styles.reviewNote} role="note" data-reviewing-stage>
                Reviewing an earlier stage.{' '}
                <button type="button" onClick={() => showStage(currentStage)}>
                  Back to the current stage
                </button>
              </p>
            ) : null}

            <div className={styles.clockStrip} aria-label="Simulation clock" role="group">
              <Clock3 aria-hidden="true" />
              <span>
                <strong>{state.simulationTime} modeled s</strong>{' '}
                {state.scenario.phase === 'complete'
                  ? 'stopped at the reveal'
                  : state.paused
                    ? 'paused'
                    : 'running'}
              </span>
              <button
                type="button"
                disabled={state.scenario.phase === 'complete'}
                onClick={() => dispatch({ type: 'SET_PAUSED', paused: !state.paused })}
              >
                {state.paused ? (
                  <CirclePlay aria-hidden="true" />
                ) : (
                  <CirclePause aria-hidden="true" />
                )}
                {state.paused ? 'Run clock' : 'Pause clock'}
              </button>
              <button
                type="button"
                disabled={state.scenario.phase === 'complete'}
                onClick={() => dispatch({ type: 'STEP' })}
              >
                <StepForward aria-hidden="true" /> Step 1 modeled second
              </button>
              <small data-time-scale>{MODELED_TIME_NOTE}</small>
            </div>
          </div>
          {activeStage === 'manage' || activeStage === 'reassess' ? (
            <div
              className={styles.simulatorColumn}
              role="region"
              aria-label="Simulator"
              tabIndex={-1}
              data-simulator-column
            >
              <EcmoSimulatorSurfaces
                console={consoleNode}
                // The patient's saturation is what these cases act on: its monitor leads (C5-2).
                leadingSurfaces={
                  practiceCaseLeadsWithPatientOxygenation(scenario.id) ? ['monitor'] : undefined
                }
                openSurfaces={openSurfaces}
                onToggleSurface={toggleSurface}
                state={state}
                dispatch={dispatch}
                controlsEnabled
                guidedTarget={activeGuidedTarget}
                guidedControlId={activeGuidedControlId}
                circuitViewPreference={null}
                initiationTargets={clinicalCase?.initiationTargets ?? null}
                onSaveForLater={() => onNavigate?.({ pathname: cardiohelpEcmoNavBase })}
              />
            </div>
          ) : null}
        </div>
      </EcmoActivityShell>
      {helpDialog}
    </CardiohelpModuleFrame>
  )
}

function focusElementById(id: string, block: ScrollLogicalPosition) {
  const element = document.getElementById(id)
  if (!element) return
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  element.focus({ preventScroll: true })
  element.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block })
}

function alarmRank(priority: EcmoContextStripLine['alarm']['priority']): number {
  return priority === 'high' ? 3 : priority === 'medium' ? 2 : priority === 'low' ? 1 : 0
}

function caseLabel(caseId: string): string {
  const definition = clinicalPracticeScenarioById.get(caseId)
  return definition ? definition.title : 'a case in this unit'
}

/** The surface a prompted machine task's control sits on, as a guided target. */
function surfaceForControlTarget(
  controlId: string,
): 'circuit' | 'gas-panel' | 'patient-monitor' | 'trend-panel' | null {
  switch (surfaceForControl(controlId)) {
    case 'circuit':
      return 'circuit'
    case 'gas':
      return 'gas-panel'
    case 'monitor':
      return 'patient-monitor'
    case 'trends':
      return 'trend-panel'
    default:
      return null
  }
}
