'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, LocateFixed, Play, SlidersHorizontal } from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { nextPathwaySection } from '@/features/learning-module/curriculum/types'
import { cardiohelpEcmoNavBase } from '@/features/learning-module/moduleRoutes'
import { useRouter } from '@/i18n/navigation'

import { orderChoices } from '../../content/choiceOrder'
import { ecmoDrillStageSources } from '../../content/stageSources'
import { deriveEcmoCircuitPresentation } from '../../content/circuitPresentation'
import { ecmoDrillSpecs } from '../../content/drillSpecs'
import { isEcmoFoundationSectionId } from '../../content/foundationLessons'
import { ecmoSectionSpecById } from '../../content/sectionSpecs'
import type {
  EcmoSimulationState,
  GuidedControlId,
  GuidedLessonDefinition,
} from '../../engine/types'
import {
  useEcmoSessionCore,
  type EcmoSessionLoadContext,
  type EcmoSessionLoadReason,
} from '../../session/useEcmoSessionCore'
import { EcmoOptionalExplanation } from '../shell/EcmoOptionalExplanation'
import { advanceSimulation } from '../PracticeCasePlayer'
import { CardiohelpConsole } from '../CardiohelpConsole'
import { CardiohelpModuleFrame } from '../CardiohelpModuleFrame'
import { FitWidthSurface } from '../FitWidthSurface'
import { EcmoStageSources } from '../shell/EcmoStageSources'
import { EcmoContextStrip, type EcmoContextStripLine } from '../shell/EcmoContextStrip'
import { EcmoHelpDialog } from '../shell/EcmoHelpDialog'
import { EcmoNowCard, type NowCardModel } from '../shell/EcmoNowCard'
import { EcmoSectionHeader } from '../shell/EcmoSectionHeader'
import { EcmoSimulatorSurfaces } from '../shell/EcmoSimulatorSurfaces'
import { EcmoTrackToggle } from '../shell/EcmoTrackToggle'
import shellStyles from '../shell/EcmoActivityShell.module.css'
import { useAlarmAudio } from '../useAlarmAudio'
import { buildDrillStageLesson } from './adapters/drillStageAdapter'
import { DrillTeachingColumn } from './DrillTeachingColumn'
import { panelControlIds, resolveGuidedSimulatorTask, targetLabels } from './drillControlResolver'
import { SectionsDrawer } from './SectionsDrawer'
import { StageLayout } from './StageLayout'
import { ActivityContent } from './ActivityContent'
import { ecmoTaskPresentation } from './activityPresentation'
import { scrollEcmoTargetIntoView, scrollTaskPaneToTop } from './scrollTaskPaneToTop'
import { StageSourcesScope } from './StageSourcesScope'
import { StepList } from './StepList'
import { STAGE_PHASES, type StageLesson, type StagePhase, type StageSurfaceId } from './stageModel'
import styles from './EcmoLessonStage.module.css'

/**
 * A guided drill on the lesson stage.
 *
 * The session is the same `useEcmoSessionCore` the workbench used, so hydration, persistence, the
 * clock, analytics and the loaders are unchanged. What this host owns is the progression — which
 * step is current, which have been performed, the committed choice — and the view state that hangs
 * off it: which surfaces are open, which control is spotlighted, whether help is open. Every step
 * change rewrites the Now card, the open surfaces and the guided focus, so a click on the
 * progression always changes the screen.
 */

interface Progression {
  readonly sectionReviewed: boolean
  readonly index: number
  readonly furthestPerformed: number
  readonly performedIds: readonly string[]
  /** The phase a URL asked for when the mount could not honour it. */
  readonly clampedFrom: StagePhase | null
  readonly choiceByStepId: Readonly<Record<string, string>>
  readonly review: number | null
  /**
   * The furthest step ever entered, which is not the furthest performed: entering a step does not
   * perform it. This is what decides whether the learner is looking back at something already done.
   */
  readonly furthestEntered: number
  /** Surfaces the learner opened or closed on a step, keyed by step id; absent = the step's own. */
  readonly surfacesByStepId: Readonly<Record<string, readonly StageSurfaceId[]>>
  /** The spotlighted control and how many times it was asked for, valid for one step only. */
  readonly help: {
    readonly stepId: string
    readonly controlId: GuidedControlId
    readonly count: number
  } | null
}

const INITIAL_PROGRESSION: Progression = {
  sectionReviewed: false,
  index: 0,
  furthestPerformed: -1,
  performedIds: [],
  clampedFrom: null,
  choiceByStepId: {},
  review: null,
  furthestEntered: 0,
  surfacesByStepId: {},
  help: null,
}

function parsePhase(value: string | null): StagePhase {
  return (STAGE_PHASES as readonly string[]).includes(value ?? '')
    ? (value as StagePhase)
    : 'recognize'
}

function surfaceForControl(controlId: GuidedControlId): StageSurfaceId | null {
  switch (controlId) {
    case 'cardiohelp-circuit-panel':
    case 'cardiohelp-circuit-check':
    case 'cardiohelp-clamp-drainage':
    case 'cardiohelp-clamp-return':
    case 'cardiohelp-resume-support':
      return 'circuit'
    case 'cardiohelp-gas-panel':
    case 'cardiohelp-sweep-control':
    case 'cardiohelp-fio2-control':
    case 'cardiohelp-restore-gas-source':
      return 'gas'
    case 'cardiohelp-patient-monitor':
      return 'monitor'
    case 'cardiohelp-trend-panel':
      return 'trends'
    default:
      return null
  }
}

function predictionPerformed(lesson: StageLesson, performedIds: readonly string[]): boolean {
  if (lesson.predictionStepIndex < 0) return true
  const step = lesson.steps[lesson.predictionStepIndex]
  return step ? performedIds.includes(step.id) : true
}

export function DrillStageHost({
  locale = 'en',
  onStateChange,
}: {
  readonly locale?: string
  /** Observability seam: the engine state after every change. See `EcmoLessonStage`. */
  readonly onStateChange?: (state: EcmoSimulationState) => void
}) {
  const router = useRouter()
  const [progression, setProgression] = useState<Progression>(INITIAL_PROGRESSION)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpButtonRef = useRef<HTMLButtonElement>(null)
  const nowHeadingRef = useRef<HTMLDivElement>(null)
  const completionRecorded = useRef<string | null>(null)

  const onLearnLessonLoaded = useCallback(
    (
      lesson: GuidedLessonDefinition,
      reason: EcmoSessionLoadReason,
      context: EcmoSessionLoadContext,
    ) => {
      // A drill always opens on its first step. Commitment is never persisted, so a URL into a
      // later phase cannot be honoured; the note beside the title says which phase was asked for.
      const requested = reason === 'hydrate' ? parsePhase(context.requestedPhase) : 'recognize'
      setProgression({
        ...INITIAL_PROGRESSION,
        clampedFrom: requested === 'recognize' ? null : requested,
      })
      completionRecorded.current = null
      setHelpOpen(false)
    },
    [],
  )

  const core = useEcmoSessionCore({ section: 'learn', onLearnLessonLoaded })
  const { state, dispatch, hydrated, learnLesson, supportMode, setSemanticPhase } = core
  useAlarmAudio(state)

  useEffect(() => {
    onStateChange?.(state)
  }, [onStateChange, state])

  const lesson = useMemo(
    () => buildDrillStageLesson(learnLesson, learnLesson.supportMode),
    [learnLesson],
  )
  const pathway = criticalCareLearningPathway('cardiohelp-ecmo', supportMode)
  const nextSection = nextPathwaySection(pathway, lesson.sectionId)
  const sectionSpec = ecmoSectionSpecById.get(lesson.sectionId)

  const activeIndex = Math.min(progression.index, lesson.steps.length - 1)
  const activeStep = lesson.steps[activeIndex]
  const presentation = ecmoTaskPresentation(lesson, activeStep)
  const isLastStep = activeIndex === lesson.steps.length - 1

  const simulatorTask =
    activeStep.interaction.kind === 'simulator-task' ||
    activeStep.interaction.kind === 'transfer-scenario'
      ? resolveGuidedSimulatorTask(activeStep.interaction.actions, state)
      : null
  /*
   * A recognised control task is performed the moment the simulator reaches the requested state.
   * That is read off the engine rather than copied into state, so nothing has to watch for it;
   * moving on records it, and the step list shows it as done from the same predicate.
   */
  const autoPerformed =
    simulatorTask?.satisfied === true &&
    (activeStep.interaction.kind !== 'transfer-scenario' || state.scenario.activityStarted)
  const recordedIds = progression.performedIds
  const performedIds = useMemo(
    () => new Set(autoPerformed ? [...recordedIds, activeStep.id] : recordedIds),
    [activeStep.id, autoPerformed, recordedIds],
  )
  const stepPerformed = performedIds.has(activeStep.id)
  const furthestPerformed = stepPerformed
    ? Math.max(progression.furthestPerformed, activeIndex)
    : progression.furthestPerformed
  const predictionCommitted = predictionPerformed(lesson, [...performedIds])
  const finished = (isLastStep && stepPerformed) || progression.sectionReviewed

  const helpControlId: GuidedControlId | null =
    simulatorTask?.controlId ??
    (activeStep.focusTarget ? panelControlIds[activeStep.focusTarget] : null)
  const help = progression.help?.stepId === activeStep.id ? progression.help : null
  // While help is on for this step it follows the task: once the Menu is pressed, the next
  // unsatisfied control (the alarm list) is the one that lights up, as the learner expects.
  const guidedControlId = help ? helpControlId : null
  const openSurfaces = useMemo(
    () =>
      new Set<StageSurfaceId>(progression.surfacesByStepId[activeStep.id] ?? activeStep.surfaces),
    [activeStep.id, activeStep.surfaces, progression.surfacesByStepId],
  )
  const circuitViewPreference = activeStep.circuitView
    ? { view: activeStep.circuitView, stepId: activeStep.id }
    : null
  /*
   * What the pressure-zone map marks for this drill: the implicated places of its localization
   * row. Teaching remains available before an optional prediction; this does not record an answer
   * or a performed action. A drill with no row — the startup tour, the CO₂ drills, the bubble and power
   * drills — marks nothing, and says so through the absence of a caption rather than through a
   * marker that would have to mean "nowhere".
   */
  const localizationRowId = ecmoDrillSpecs[lesson.scenarioId]?.localizationRowId
  const circuitPresentation = localizationRowId
    ? deriveEcmoCircuitPresentation(state, { kind: 'drill-reveal', rowId: localizationRowId })
    : null

  /* ---------------------------------------------------------------- *
   * Progression
   * ---------------------------------------------------------------- */

  /** Enter a step: load a transfer case if it carries one, then move. */
  const enterStep = useCallback(
    (index: number, performedNow: readonly string[]) => {
      const nextStep = lesson.steps[index]
      if (!nextStep) return
      if (nextStep.interaction.kind === 'transfer-scenario') {
        dispatch({
          type: 'LOAD_SCENARIO',
          scenarioId: nextStep.interaction.scenarioId,
          mode: 'guided',
        })
      }
      setSemanticPhase(nextStep.phase)
      setProgression((current) => ({
        ...current,
        index,
        review: null,
        performedIds: performedNow,
        furthestEntered: Math.max(current.furthestEntered, index),
        furthestPerformed: Math.max(
          current.furthestPerformed,
          performedNow.includes(lesson.steps[current.index]?.id ?? '') ? current.index : -1,
        ),
      }))
    },
    [dispatch, lesson, setSemanticPhase],
  )

  function startTransfer() {
    if (activeStep.interaction.kind !== 'transfer-scenario' || state.scenario.activityStarted)
      return
    dispatch({ type: 'START_ACTIVITY' })
    for (const action of activeStep.interaction.setupActions) {
      if (action.type === 'TICK') advanceSimulation(dispatch, action.seconds ?? 1)
      else dispatch(action)
    }
  }

  function skipStep() {
    if (isLastStep) setProgression((current) => ({ ...current, sectionReviewed: true }))
    else enterStep(activeIndex + 1, progression.performedIds)
  }

  function retryPrediction() {
    setProgression((current) => ({
      ...current,
      performedIds: current.performedIds.filter((id) => id !== activeStep.id),
      choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: '' },
    }))
  }

  const recordPerformed = useCallback(
    (stepId: string): readonly string[] =>
      recordedIds.includes(stepId) ? recordedIds : [...recordedIds, stepId],
    [recordedIds],
  )

  const completeActiveStep = useCallback(() => {
    const performedNow = recordPerformed(activeStep.id)
    setProgression((current) => ({
      ...current,
      performedIds: performedNow,
      furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
      help: null,
    }))
  }, [activeIndex, activeStep.id, recordPerformed])

  const advance = useCallback(() => {
    const performedNow = stepPerformed ? recordPerformed(activeStep.id) : recordedIds
    const next = activeIndex + 1
    enterStep(next, performedNow)
  }, [activeIndex, activeStep.id, enterStep, recordPerformed, recordedIds, stepPerformed])

  const performStep = useCallback(() => {
    if (stepPerformed) return
    const { interaction } = activeStep
    if (
      interaction.kind === 'simulator-task' ||
      interaction.kind === 'model-advance' ||
      interaction.kind === 'transfer-scenario'
    ) {
      for (const action of interaction.actions) dispatch(action)
    }
    completeActiveStep()
  }, [activeStep, completeActiveStep, dispatch, stepPerformed])

  const commitPrediction = useCallback(() => {
    if (activeStep.interaction.kind !== 'prediction' || stepPerformed) return
    const choiceId = progression.choiceByStepId[activeStep.id]
    if (!choiceId) return
    const commitment = activeStep.interaction.commitments?.[choiceId]
    if (commitment) {
      dispatch({
        type: 'COMMIT_PREDICTION',
        goalId: commitment.goalId,
        control: commitment.control,
        direction: commitment.direction,
      })
    }
    completeActiveStep()
  }, [activeStep, completeActiveStep, dispatch, progression.choiceByStepId, stepPerformed])

  const readAndAdvance = useCallback(() => {
    const performedNow = recordPerformed(activeStep.id)
    const next = activeIndex + 1
    if (next >= lesson.steps.length) {
      setProgression((current) => ({
        ...current,
        performedIds: performedNow,
        furthestPerformed: Math.max(current.furthestPerformed, activeIndex),
      }))
      return
    }
    enterStep(next, performedNow)
  }, [activeIndex, activeStep.id, enterStep, lesson.steps.length, recordPerformed])

  // Finishing the closing step is what records the drill as worked — once per load.
  useEffect(() => {
    if (!finished || completionRecorded.current === lesson.scenarioId) return
    completionRecorded.current = lesson.scenarioId
    core.completeLearnLesson(lesson.scenarioId)
  }, [core, finished, lesson.scenarioId])

  /* ---------------------------------------------------------------- *
   * Step entry: focus, the URL phase, and the spotlight
   * ---------------------------------------------------------------- */

  useEffect(() => {
    nowHeadingRef.current?.focus({ preventScroll: true })
    scrollTaskPaneToTop(nowHeadingRef.current)
  }, [activeStep.id])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('phase', activeStep.phase)
    window.history.replaceState(window.history.state, '', url)
  }, [activeStep.phase, hydrated, lesson.scenarioId])

  const helpCount = help?.count ?? 0
  useEffect(() => {
    if (helpCount === 0 || !guidedControlId) return
    const timer = window.setTimeout(() => {
      const control = document.getElementById(guidedControlId)
      if (!control) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      control.focus({ preventScroll: true })
      scrollEcmoTargetIntoView(control, reduceMotion ? 'auto' : 'smooth')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [guidedControlId, helpCount])

  /*
   * Which pane a compact viewport opens on for this step.
   *
   * A drill step is mostly worked on the device, and "Show me where" focuses and scrolls a console
   * control — which is a silent no-op if that pane is the hidden one. So a step that aims at a
   * simulator surface opens there, a task-pane step opens on the steps, and asking where a control
   * is moves the learner to the pane holding it.
   */
  const compactPane: 'primary' | 'tertiary' =
    activeStep.focusTarget || helpCount > 0 ? 'tertiary' : 'primary'

  function showWhere() {
    if (!helpControlId) return
    const surface = surfaceForControl(helpControlId)
    const stepId = activeStep.id
    setProgression((current) => {
      const opened = new Set(current.surfacesByStepId[stepId] ?? activeStep.surfaces)
      if (surface) opened.add(surface)
      const previous = current.help?.stepId === stepId ? current.help.count : 0
      return {
        ...current,
        surfacesByStepId: { ...current.surfacesByStepId, [stepId]: [...opened] },
        help: { stepId, controlId: helpControlId, count: previous + 1 },
      }
    })
  }

  function toggleSurface(surface: StageSurfaceId, open: boolean) {
    const stepId = activeStep.id
    setProgression((current) => {
      const next = new Set(current.surfacesByStepId[stepId] ?? activeStep.surfaces)
      if (open) next.add(surface)
      else next.delete(surface)
      return { ...current, surfacesByStepId: { ...current.surfacesByStepId, [stepId]: [...next] } }
    })
  }

  function goToSection(sectionId: string) {
    if (sectionId === lesson.sectionId) return
    if (isEcmoFoundationSectionId(sectionId)) {
      router.push({
        pathname: `${cardiohelpEcmoNavBase}/learn`,
        query: { lesson: sectionId, track: supportMode },
      })
      return
    }
    core.loadLearnScenario(sectionId)
  }

  /** Selecting a row reviews it in place. See the foundation host's note on why this is not navigation. */
  function selectStepRow(index: number) {
    goToStep(index)
  }

  /**
   * Back to a step already worked. See the foundation host's note.
   *
   * One honesty point specific to drills: a drill runs one engine forward, so coming back does not
   * rewind the circuit unless the step being entered authors its own scenario. The Now card says
   * which of those happened rather than leaving the learner to guess.
   */
  function goToStep(index: number) {
    const target = lesson.steps[index]
    if (!target || index === activeIndex) return
    enterStep(index, progression.performedIds)
  }

  /* ---------------------------------------------------------------- *
   * The Now card
   * ---------------------------------------------------------------- */

  const selectedChoiceId = progression.choiceByStepId[activeStep.id] ?? null
  // One word for a unit of work across the pathway: the foundation hosts, this host and the
  // "Tasks in this section" list all say task (S2-8, S7-5).
  const stepPosition = `Task ${activeStep.ordinal} of ${lesson.steps.length}`
  const showWhereAction =
    helpControlId && !stepPerformed
      ? {
          label: helpCount > 0 ? 'Highlight it again' : 'Show me where',
          onActivate: showWhere,
          icon: <LocateFixed aria-hidden="true" />,
        }
      : undefined

  const previousStep = activeIndex > 0 ? lesson.steps[activeIndex - 1] : undefined
  const canGoBack = previousStep !== undefined
  const lookingBack = activeIndex < progression.furthestEntered

  /*
   * Every source this drill cites, for the footer that cites them all in one place. Derived from
   * the content registries rather than reported by the panes at render, so the set cannot go stale
   * behind a surface that quietly starts citing something new — see `content/stageSources.ts`.
   */
  const stageSources = useMemo(() => ecmoDrillStageSources(lesson.scenarioId), [lesson.scenarioId])

  const nowModel: NowCardModel = (() => {
    /*
     * The way back, offered on every step after the first.
     *
     * The previous step is performed by construction — a learner only reaches step N by working
     * step N-1, and a lesson mounted at a later phase marks the steps before it performed — so this
     * is always a real destination rather than a control that sometimes does nothing.
     */
    const base = {
      kicker: stepPosition,
      heading: activeStep.title,
      body: activeStep.instruction,
      why: activeStep.rationale,
      ...(canGoBack && previousStep
        ? {
            back: {
              label: `Back to ${previousStep.title}`,
              onActivate: () => goToStep(activeIndex - 1),
            },
          }
        : {}),
    }
    if (activeStep.interaction.kind === 'transfer-scenario' && !state.scenario.activityStarted) {
      return {
        ...base,
        primary: { label: 'Start guided activity', onActivate: startTransfer },
        status:
          'New clinical situation. Start to initialize its authored event; no prediction is required.',
      }
    }
    if (finished) {
      return { ...base, status: 'Section reviewed. You can return to any activity.' }
    }
    if (stepPerformed) {
      return {
        ...base,
        // A drill runs one engine forward, so coming back does not rewind the circuit. Say so.
        status: lookingBack
          ? 'Done. You are looking back at an earlier step. The simulator is where you left it, and nothing you have worked through is lost.'
          : 'Done.',
        primary: isLastStep
          ? undefined
          : {
              label: activeStep.interaction.kind === 'prediction' ? 'Continue' : 'Next step',
              onActivate: advance,
              icon: <ArrowRight aria-hidden="true" />,
            },
      }
    }
    switch (activeStep.interaction.kind) {
      case 'read':
        return {
          ...base,
          primary: { label: activeStep.actionLabel, onActivate: readAndAdvance },
        }
      case 'model-advance':
        return {
          ...base,
          status: 'Simulation update — no console action.',
          primary: {
            label: activeStep.actionLabel,
            onActivate: performStep,
            icon: <Play aria-hidden="true" />,
          },
        }
      case 'prediction':
        return {
          ...base,
          primary: {
            label: activeStep.actionLabel,
            onActivate: commitPrediction,
            disabled: selectedChoiceId === null,
            disabledReason: 'Choose one option to enable this.',
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
        }
      case 'simulator-task':
      case 'transfer-scenario':
        if (simulatorTask) {
          return {
            ...base,
            status: `Waiting for: ${activeStep.actionLabel}. This step is done once the simulator reaches the state you were asked for.`,
            secondary: showWhereAction,
          }
        }
        return {
          ...base,
          status: activeStep.focusTarget
            ? `Focus: ${targetLabels[activeStep.focusTarget]}`
            : undefined,
          primary: {
            label: activeStep.actionLabel,
            onActivate: performStep,
            icon: <SlidersHorizontal aria-hidden="true" />,
          },
          secondary: showWhereAction,
        }
      default:
        return base
    }
  })()

  const nowBody = (() => {
    if (activeStep.interaction.kind === 'prediction') {
      const { item } = activeStep.interaction
      if (stepPerformed && selectedChoiceId) {
        return (
          <>
            <AnswerVerdict
              item={item}
              choiceId={selectedChoiceId}
              // This module's owner asked for the outcome in as many words; the other labs
              // render the descriptive form until each of their owners has looked at it.
              outcome="stated"
              timing="immediate-after-commit"
              theme="dark"
              onContinue={undefined}
            />
          </>
        )
      }
      return (
        <fieldset className={styles.choiceList} disabled={stepPerformed} data-prediction-choices>
          <legend>{item.stem}</legend>
          {orderChoices(item.id, item.choices).map((choice) => (
            <label
              key={choice.id}
              className={styles.choice}
              data-selected={selectedChoiceId === choice.id}
            >
              <input
                type="radio"
                name={`ecmo-prediction-${activeStep.id}`}
                value={choice.id}
                checked={selectedChoiceId === choice.id}
                onChange={() =>
                  setProgression((current) => ({
                    ...current,
                    choiceByStepId: { ...current.choiceByStepId, [activeStep.id]: choice.id },
                  }))
                }
              />
              <span>{choice.label}</span>
            </label>
          ))}
        </fieldset>
      )
    }
    if (simulatorTask && !stepPerformed) {
      return (
        <p className={styles.taskInstruction} data-simulator-task role="status" aria-live="polite">
          <strong>Do this on the simulator.</strong> {simulatorTask.instruction}
        </p>
      )
    }
    return null
  })()

  /* ---------------------------------------------------------------- *
   * Panes
   * ---------------------------------------------------------------- */

  const activeAlarm = state.alarms.find((alarm) => alarm.active && alarm.source === 'device')
  const contextLine: EcmoContextStripLine = {
    mode: supportMode.toUpperCase(),
    flow: state.circuit.flowSensorConnected
      ? `${state.circuit.bloodFlow.toFixed(2)} L/min`
      : '-- · flow sensor disconnected',
    rpm: `${state.device.rpmSetpoint} RPM`,
    sweep: `${state.gas.sweepLpm.toFixed(1)} L/min`,
    alarm: activeAlarm
      ? { priority: activeAlarm.priority, text: activeAlarm.message }
      : { priority: 'none', text: 'No active device alarm' },
  }

  const consoleNode = (
    <FitWidthSurface mode="actual" label="CARDIOHELP console">
      <CardiohelpConsole
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={activeStep.focusTarget}
        guidedControlId={guidedControlId}
        initiationTargets={null}
      />
    </FitWidthSurface>
  )

  /*
   * Every source this lesson cites, for the footer that cites them all in one place.
   * Derived from the content registries rather than reported by the panes at render, so the
   * set cannot go stale behind a surface that quietly starts citing something new — see
   * `content/stageSources.ts` and the rendered check in `stage-sources.test.ts`.
   */

  const simulator = (
    <EcmoSimulatorSurfaces
      console={presentation?.console ? consoleNode : null}
      surfaceIds={[...new Set([...(presentation?.surfaces ?? []), ...openSurfaces])]}
      state={state}
      dispatch={dispatch}
      controlsEnabled
      guidedTarget={activeStep.focusTarget}
      guidedControlId={guidedControlId}
      circuitViewPreference={circuitViewPreference}
      circuitPresentation={circuitPresentation}
      circuitAutoScroll={false}
      circuitFit="pane"
      // Reading the pattern and committing to it are both read off the numbers (S8-2).
      readingsFirst={activeStep.phase === 'recognize' || activeStep.phase === 'predict'}
      openSurfaces={openSurfaces}
      onToggleSurface={toggleSurface}
      onSaveForLater={() => router.push(cardiohelpEcmoNavBase)}
    />
  )

  const teaching = <DrillTeachingColumn state={state} step={activeStep} />

  /*
   * What the completion card offers depends on what the unit holds. Only a case that applies the
   * mechanism this lesson taught is called an application of it; the unit's next case is offered as
   * exactly that, and a unit with no case offers the next section alone.
   */
  const pairing = lesson.practicePairing
  const completionLead =
    pairing?.kind === 'mechanism-match'
      ? 'You can review this section at any time. Apply it to the paired clinical case in Practice, starting fresh with less prompting.'
      : pairing?.kind === 'next-in-unit'
        ? 'You can review this section at any time. The next case in this unit is ready in Practice, starting fresh with less prompting.'
        : 'You can review this section at any time. Continue to the next section to keep building on this.'

  const explanation = (
    <EcmoOptionalExplanation
      key={activeStep.id}
      onContinue={skipStep}
      onRetry={activeStep.interaction.kind === 'prediction' ? retryPrediction : undefined}
    >
      {activeStep.interaction.kind === 'prediction' ? (
        <>
          <p>{activeStep.interaction.item.explanation}</p>
          <ul>
            {activeStep.interaction.item.choices.map((choice) => (
              <li key={choice.id}>
                <strong>{choice.label}</strong> {choice.rationale}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p>{activeStep.rationale ?? activeStep.instruction}</p>
          <p>
            Expected response in this teaching example; viewing it performs no simulator action.
          </p>
          <ul>
            {activeStep.expectedResponse?.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </EcmoOptionalExplanation>
  )

  const task = (
    <>
      <div ref={nowHeadingRef} tabIndex={-1} data-now-focus>
        <EcmoNowCard model={nowModel}>
          {/*
            The question, or the thing to do on the simulator, first.

            A fellow walkthrough (S8-2) found a drill's options about 3,600 px under the task
            heading, below the whole teaching column and the whole simulator, so steps 1 and 2
            looked identical above the fold. In a flowing task the current question — or the
            simulator task and its status — and the explanation row now lead the card; the teaching
            and the simulator follow, all still on the page and nothing withheld.
          */}
          {presentation ? (
            <div className={styles.drillLead} data-drill-lead>
              {nowBody}
              {explanation}
            </div>
          ) : null}
          <ActivityContent
            presentation={presentation}
            teaching={teaching}
            visual={simulator}
            visualFirst={
              activeStep.phase === 'act' ||
              activeStep.phase === 'observe' ||
              activeStep.phase === 'transfer'
            }
          >
            {presentation ? null : nowBody}
            {presentation ? null : explanation}
          </ActivityContent>
        </EcmoNowCard>
      </div>
      {activeIndex === 0 && sectionSpec ? (
        <details className={styles.objectives} data-stage-objectives>
          <summary>What this section is for</summary>
          <p>{sectionSpec.objective}</p>
          <p>
            <strong>One new idea:</strong> {sectionSpec.newConcept}
          </p>
        </details>
      ) : null}
      <details data-task-history>
        <summary>Tasks in this section</summary>
        <StepList
          lesson={lesson}
          currentIndex={activeIndex}
          furthestPerformedIndex={furthestPerformed}
          performedStepIds={performedIds}
          predictionCommitted={predictionCommitted}
          reviewIndex={progression.review}
          recapFor={(index) => {
            const step = lesson.steps[index]
            if (!step) return []
            if (step.interaction.kind === 'prediction') {
              const choiceId = progression.choiceByStepId[step.id]
              const choice = step.interaction.item.choices.find((item) => item.id === choiceId)
              return choice ? [`You chose: ${choice.label}`] : ['Prediction recorded.']
            }
            return step.expectedResponse ?? []
          }}
          onSelect={selectStepRow}
        />
      </details>
      {finished ? (
        <section
          className={styles.completion}
          role="status"
          aria-live="polite"
          data-stage-completion
        >
          <h3>Section reviewed</h3>
          <p>{completionLead}</p>
          {pairing?.kind === 'next-in-unit' ? (
            <p data-practice-pairing-note>It applies a different mechanism from this lesson.</p>
          ) : null}
          <div className={styles.completionActions}>
            {pairing ? (
              <button
                type="button"
                className={shellStyles.nowPrimary}
                data-practice-pairing={pairing.kind}
                onClick={() =>
                  router.push({
                    pathname: `${cardiohelpEcmoNavBase}/practice`,
                    query: { case: pairing.caseId, track: supportMode },
                  })
                }
              >
                {pairing.kind === 'mechanism-match'
                  ? `Apply this in Practice: ${pairing.title}`
                  : `Next case in this unit: ${pairing.title}`}
                <ArrowRight aria-hidden="true" />
              </button>
            ) : null}
            {nextSection ? (
              <button
                type="button"
                className={shellStyles.nowSecondary}
                onClick={() => goToSection(nextSection.id)}
              >
                Continue to next section: {nextSection.title}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  )

  const header = (
    <EcmoSectionHeader
      breadcrumb={{ href: cardiohelpEcmoNavBase, label: 'ECMO Management' }}
      kicker={`${supportMode.toUpperCase()} track · Section ${lesson.index + 1} of ${lesson.total} · ${lesson.minutes} min`}
      title={lesson.title}
      sectionsControl={
        <SectionsDrawer
          pathway={pathway}
          activeSectionId={lesson.sectionId}
          position={`${lesson.index + 1} of ${lesson.total}`}
          onSelect={goToSection}
        />
      }
      trackToggle={<EcmoTrackToggle supportMode={supportMode} onSelect={core.selectTrack} />}
      helpRef={helpButtonRef}
      onHelp={() => setHelpOpen(true)}
      onRestart={core.resetActivity}
      restartLabel="Restart section"
      onSaveAndExit={core.saveAndExit}
      resumedNote={
        progression.clampedFrom
          ? `This section reopened at its first step with a fresh simulation. Choose any task from the outline; previous answers and actions were not restored.`
          : undefined
      }
    />
  )

  const helpDialog = (
    <EcmoHelpDialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      returnFocusTo={helpButtonRef}
    >
      <p className={shellStyles.kicker}>{stepPosition}</p>
      <p>
        <strong>{activeStep.title}</strong>
      </p>
      <p>{activeStep.instruction}</p>
      {simulatorTask && !stepPerformed ? <p>{simulatorTask.instruction}</p> : null}
      {activeStep.rationale ? <p>{activeStep.rationale}</p> : null}
      {showWhereAction ? (
        <button
          type="button"
          className={shellStyles.nowSecondary}
          onClick={() => {
            setHelpOpen(false)
            showWhere()
          }}
        >
          <LocateFixed aria-hidden="true" /> Show me where
        </button>
      ) : null}
    </EcmoHelpDialog>
  )

  return (
    <CardiohelpModuleFrame
      locale={locale}
      activeHref={`${cardiohelpEcmoNavBase}/learn`}
      activityMode
    >
      <StageSourcesScope>
        <StageLayout
          presentation={presentation}
          stageId={activeStep.id}
          label={`Guided CARDIOHELP ${supportMode.toUpperCase()} lesson`}
          supportMode={supportMode}
          header={header}
          contextStrip={
            <div data-operational-status={presentation?.operational || undefined}>
              <EcmoContextStrip line={contextLine} badge="Simulated values" />
              <p className="px-4 py-1">
                Modeled time {state.simulationTime} s · {state.paused ? 'paused' : 'running'}
              </p>
            </div>
          }
          simulator={simulator}
          teaching={teaching}
          compactPane={compactPane}
          task={task}
          footer={
            <>
              <p className={styles.footerLine}>
                Professional education only. Not a clinical device or a patient-specific guide;
                every value is simulated. Follow current manufacturer instructions and local
                protocol.
              </p>
              <EcmoStageSources
                sources={stageSources}
                label="Sources for this lesson"
                claimsVisible
              />
            </>
          }
          overlay={helpDialog}
        />
      </StageSourcesScope>
    </CardiohelpModuleFrame>
  )
}
