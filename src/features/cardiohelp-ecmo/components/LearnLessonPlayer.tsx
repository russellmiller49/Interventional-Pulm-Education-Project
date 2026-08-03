'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  CircleHelp,
  CircleDot,
  GraduationCap,
  ListChecks,
  LocateFixed,
  RotateCcw,
  SlidersHorizontal,
  Target,
} from 'lucide-react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'
import type { CriticalCareActivityPhase } from '@/features/learning-module/activity'
import { AnswerVerdict } from '@/features/learning-module/components/AnswerVerdict'
import { PathwayNav, nextPathwaySection } from '@/features/learning-module/curriculum'

import { cardiohelpLearnLessons, cardiohelpLearnLessonByScenarioId } from '../content/learnLessons'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import {
  cardiohelpCurriculum,
  curriculumUnitById,
  orderedLessonScenarioIds,
  pairedCaseIdsForLesson,
  unitIdByLessonScenarioId,
} from '../content/curriculum'
import { isEcmoFoundationSectionId } from '../content/foundationLessons'
import { clinicalPracticeScenarioById } from '../content/clinicalCases'
import type {
  ConsoleScreen,
  EcmoSimulationState,
  GuidedControlId,
  GuidedLessonDefinition,
  GuidedTarget,
  GuidedWalkthroughStep,
  SimulationAction,
} from '../engine'
import { formatChannelGroup, formatChannelReadout } from './channelReadout'
import styles from './cardiohelp-ecmo.module.css'

interface LearnLessonPlayerProps {
  state: EcmoSimulationState
  lesson: GuidedLessonDefinition
  dispatch: (action: SimulationAction) => void
  onSelectLesson: (scenarioId: string) => void
  onCompleteLesson: (scenarioId: string) => void
  onTryPractice: (scenarioId: string) => void
  onTargetChange: (target: GuidedTarget) => void
  onControlHelpChange: (controlId: GuidedControlId | null) => void
  onPhaseChange?: (phase: CriticalCareActivityPhase) => void
  onActiveStepChange?: (step: GuidedWalkthroughStep) => void
}

const targetLabels: Record<GuidedTarget, string> = {
  console: 'Device console',
  circuit: 'Circuit and sensors',
  'gas-panel': 'Separate gas panel',
  'patient-monitor': 'Independent patient monitor',
  'trend-panel': 'Device + patient trends',
}

const phaseLabels = {
  orient: 'Recognize',
  observe: 'Recognize',
  interpret: 'Predict',
  respond: 'Act',
  reassess: 'Observe',
  transfer: 'Transfer',
} as const

function semanticPhaseForGuidedStep(
  phase: GuidedWalkthroughStep['phase'],
  lessonFinished: boolean,
): CriticalCareActivityPhase {
  if (lessonFinished) return 'transfer'
  if (phase === 'orient' || phase === 'observe') return 'recognize'
  if (phase === 'interpret') return 'predict'
  if (phase === 'respond') return 'act'
  if (phase === 'reassess') return 'observe'
  if (phase === 'transfer') return 'transfer'
  return 'explain'
}

const panelControlIds: Record<GuidedTarget, GuidedControlId> = {
  console: 'cardiohelp-console',
  circuit: 'cardiohelp-circuit-panel',
  'gas-panel': 'cardiohelp-gas-panel',
  'patient-monitor': 'cardiohelp-patient-monitor',
  'trend-panel': 'cardiohelp-trend-panel',
}

const screenControlIds: Partial<Record<ConsoleScreen, GuidedControlId>> = {
  parameters: 'cardiohelp-screen-parameters',
  blood: 'cardiohelp-screen-blood',
  transport: 'cardiohelp-screen-transport',
  interventions: 'cardiohelp-screen-interventions',
  timers: 'cardiohelp-screen-timers',
}

interface GuidedSimulatorTask {
  controlId: GuidedControlId
  instruction: string
  satisfied: boolean
}

function guidedActionSatisfied(action: SimulationAction, state: EcmoSimulationState): boolean {
  switch (action.type) {
    case 'SET_SCREEN':
      return state.device.screen === action.screen
    case 'SET_RPM':
      return state.device.pumpMode === 'rpm' && state.device.rpmSetpoint === action.rpm
    case 'SET_FLOW_TARGET':
      return (
        state.device.pumpMode === 'lpm' && Math.abs(state.device.lpmSetpoint - action.flow) < 0.001
      )
    case 'SET_SWEEP':
      return Math.abs(state.gas.sweepLpm - action.sweep) < 0.001
    case 'SET_GAS_FIO2':
      return Math.abs(state.gas.fio2 - action.fio2) < 0.001
    case 'SET_PUMP_MODE':
      return state.device.pumpMode === action.mode
    case 'RESTORE_GAS_SOURCE':
      return state.gas.sourceConnected
    case 'RESTORE_AC_POWER':
      return state.device.powerSource === 'ac'
    case 'TOGGLE_CIRCUIT_CLAMP': {
      // Guided clamp steps always declare an explicit target state.
      const targetClosed = action.closed ?? true
      return action.limb === 'drainage'
        ? state.circuit.drainageClampClosed === targetClosed
        : state.circuit.returnClampClosed === targetClosed
    }
    case 'RESET_BUBBLE':
      return (
        !state.circuit.bubbleResetRequired &&
        state.scenario.correctedFaults.includes('arterial-bubble')
      )
    case 'PERFORM_CHECK':
      return (
        state.circuit.circuitInspected &&
        state.scenario.correctedFaults.includes('startup-inspection')
      )
    default:
      return false
  }
}

function resolveGuidedSimulatorTask(
  guidedStep: GuidedWalkthroughStep,
  state: EcmoSimulationState,
): GuidedSimulatorTask | null {
  if (guidedStep.actions.length !== 1) return null
  const action = guidedStep.actions[0]
  const satisfied = guidedActionSatisfied(action, state)

  switch (action.type) {
    case 'SET_SCREEN': {
      if (action.screen === 'startup') {
        return {
          controlId: 'cardiohelp-home-button',
          instruction: 'On the console toolbar, select Home to return to the START screen.',
          satisfied,
        }
      }
      if (action.screen === 'alarm-history') {
        return state.device.screen === 'menu'
          ? {
              controlId: 'cardiohelp-alarm-list-button',
              instruction: 'In the console Menu, select Alarm list.',
              satisfied,
            }
          : {
              controlId: 'cardiohelp-menu-button',
              instruction: 'On the console toolbar, select Menu. Then choose Alarm list.',
              satisfied,
            }
      }
      const controlId = screenControlIds[action.screen]
      if (!controlId) return null
      const screenLabels: Partial<Record<ConsoleScreen, string>> = {
        parameters: 'PARAM',
        blood: 'BLOOD',
        transport: 'TRANS',
        interventions: 'INTERV',
        timers: 'TIME',
      }
      return {
        controlId,
        instruction: `On the CARDIOHELP touchscreen, select ${screenLabels[action.screen] ?? action.screen}.`,
        satisfied,
      }
    }
    case 'SET_RPM':
      return state.device.pumpMode === 'rpm'
        ? {
            controlId: 'cardiohelp-rpm-control',
            instruction: `Use the physical rotary control to set ${action.rpm} RPM.`,
            satisfied,
          }
        : {
            controlId: 'cardiohelp-pump-mode-rpm',
            instruction: 'On the physical console panel, select RPM mode first.',
            satisfied,
          }
    case 'SET_FLOW_TARGET':
      return state.device.pumpMode === 'lpm'
        ? {
            controlId: 'cardiohelp-rpm-control',
            instruction: `Use the physical rotary control to set ${action.flow.toFixed(1)} L/min.`,
            satisfied,
          }
        : {
            controlId: 'cardiohelp-pump-mode-lpm',
            instruction: 'On the physical console panel, select LPM mode first.',
            satisfied,
          }
    case 'SET_PUMP_MODE':
      return {
        controlId: action.mode === 'rpm' ? 'cardiohelp-pump-mode-rpm' : 'cardiohelp-pump-mode-lpm',
        instruction: `On the physical console panel, select ${action.mode.toUpperCase()} mode.`,
        satisfied,
      }
    case 'SET_SWEEP':
      return {
        controlId: 'cardiohelp-sweep-control',
        instruction: `On the separate gas blender, set sweep flow to ${action.sweep.toFixed(1)} L/min.`,
        satisfied,
      }
    case 'SET_GAS_FIO2':
      return {
        controlId: 'cardiohelp-fio2-control',
        instruction: `On the separate gas blender, set sweep-gas FiO₂ to ${Math.round(action.fio2 * 100)}%.`,
        satisfied,
      }
    case 'PERFORM_CHECK':
      return {
        controlId: 'cardiohelp-circuit-check',
        instruction: 'In the circuit panel, perform the tip-to-tip circuit and sensor check.',
        satisfied,
      }
    case 'TOGGLE_CIRCUIT_CLAMP': {
      const closing = action.closed ?? true
      return {
        controlId:
          action.limb === 'drainage' ? 'cardiohelp-clamp-drainage' : 'cardiohelp-clamp-return',
        instruction: `On the bedside circuit, ${closing ? 'close' : 'open'} the ${action.limb}-limb clamp near the patient.`,
        satisfied,
      }
    }
    case 'RESTORE_GAS_SOURCE':
      return {
        controlId: 'cardiohelp-restore-gas-source',
        instruction: 'On the separate gas panel, select Restore verified gas source.',
        satisfied,
      }
    case 'RESET_BUBBLE':
      return state.device.screen === 'interventions'
        ? {
            controlId: 'cardiohelp-reset-bubble',
            instruction: 'On the Interventions screen, reset the bubble intervention.',
            satisfied,
          }
        : {
            controlId: 'cardiohelp-screen-interventions',
            instruction: 'Open INTERV on the console, then use the bubble reset control.',
            satisfied,
          }
    case 'RESTORE_AC_POWER':
      return state.device.screen === 'transport'
        ? {
            controlId: 'cardiohelp-restore-ac-power',
            instruction: 'On the Transport screen, reconnect the verified AC source.',
            satisfied,
          }
        : {
            controlId: 'cardiohelp-screen-transport',
            instruction: 'Open TRANS on the console, then reconnect the verified AC source.',
            satisfied,
          }
    default:
      return null
  }
}

export function resolveGuidedLesson(scenarioId: string): GuidedLessonDefinition {
  return cardiohelpLearnLessonByScenarioId.get(scenarioId) ?? cardiohelpLearnLessons[0]
}

export function LearnLessonPlayer({
  state,
  lesson,
  dispatch,
  onSelectLesson,
  onCompleteLesson,
  onTryPractice,
  onTargetChange,
  onControlHelpChange,
  onPhaseChange,
  onActiveStepChange,
}: LearnLessonPlayerProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set())
  const [lessonFinished, setLessonFinished] = useState(false)
  const [helpRequestCount, setHelpRequestCount] = useState(0)
  // Kept per step rather than per lesson so stepping back to a committed prediction still shows the
  // learner what they answered beside the verdict on it.
  const [predictionChoiceByStepId, setPredictionChoiceByStepId] = useState<
    Readonly<Record<string, string>>
  >({})
  const activePanelRef = useRef<HTMLDivElement>(null)
  const activeStep = lesson.steps[activeStepIndex] ?? lesson.steps[0]
  const stepPerformed = completedStepIds.has(activeStep.id)
  const prediction = activeStep.predictionScenarioId
    ? ecmoLearnPredictionFor(activeStep.predictionScenarioId)
    : undefined
  const selectedPredictionChoiceId = predictionChoiceByStepId[activeStep.id] ?? null
  const simulatorTask = resolveGuidedSimulatorTask(activeStep, state)
  const simulatorTaskSatisfied = simulatorTask?.satisfied ?? false
  const helpControlId = simulatorTask?.controlId ?? panelControlIds[activeStep.target]
  const helpRequested = helpRequestCount > 0
  const trackPathway = criticalCareLearningPathway('cardiohelp-ecmo', state.supportMode)

  // Foundation sections open the interactive three-pane workspace on their own route; drill
  // sections stay inside this player. They were prose when this navigation was written, and the
  // static view that rendered them has since been removed entirely.
  const onSelectSection = (sectionId: string) => {
    if (isEcmoFoundationSectionId(sectionId)) {
      window.location.assign(
        `/cardiohelp-ecmo/learn?lesson=${sectionId}&track=${state.supportMode}`,
      )
      return
    }
    onSelectLesson(sectionId)
  }

  // The pathway, not the unit list, defines what comes next: it also contains the physiology
  // sections, which the unit list does not know about.
  const nextPathwaySectionForLesson = nextPathwaySection(trackPathway, lesson.scenarioId)

  const trackUnits = cardiohelpCurriculum[state.supportMode]
  const modeLessons = useMemo(
    () =>
      orderedLessonScenarioIds(state.supportMode)
        .map((scenarioId) => cardiohelpLearnLessonByScenarioId.get(scenarioId))
        .filter((item): item is GuidedLessonDefinition => Boolean(item)),
    [state.supportMode],
  )
  const lessonIndex = modeLessons.findIndex((item) => item.id === lesson.id)
  const nextLesson = modeLessons[lessonIndex + 1]
  const previousLesson = modeLessons[lessonIndex - 1]
  const activeUnitId = unitIdByLessonScenarioId.get(lesson.scenarioId)
  const activeUnit = activeUnitId ? curriculumUnitById.get(activeUnitId) : undefined
  const activeUnitNumber = activeUnit
    ? trackUnits.findIndex((unit) => unit.id === activeUnit.id) + 1
    : null
  const pairedCaseId = pairedCaseIdsForLesson(lesson.scenarioId)[0]
  const pairedCase = pairedCaseId ? clinicalPracticeScenarioById.get(pairedCaseId) : undefined
  const simulatorSnapshot = useMemo(
    () => ({
      time: state.simulationTime,
      flow: state.circuit.bloodFlow.toFixed(2),
      // Formatted from the engine readouts, so a stopped circuit's intercepts never appear here as
      // though the console had measured them.
      pVen: formatChannelReadout('pVen', state.circuit.readouts.pVen, 'mmHg'),
      pIntPArt: formatChannelGroup([state.circuit.readouts.pInt, state.circuit.readouts.pArt], ''),
      sweep: state.gas.sweepLpm.toFixed(1),
      spo2: state.patient.spo2.toFixed(1),
      paCO2: state.patient.paCO2.toFixed(1),
      rightRadialSpo2: state.patient.rightRadialSpo2.toFixed(1),
      femoralArterialSpo2: state.patient.femoralArterialSpo2.toFixed(1),
    }),
    [state],
  )

  useEffect(() => {
    onTargetChange(activeStep.target)
    onControlHelpChange(null)
    window.requestAnimationFrame(() => activePanelRef.current?.focus({ preventScroll: true }))
  }, [activeStep.id, activeStep.target, onControlHelpChange, onTargetChange])

  useEffect(() => {
    onPhaseChange?.(semanticPhaseForGuidedStep(activeStep.phase, lessonFinished))
  }, [activeStep.phase, lessonFinished, onPhaseChange])

  useEffect(() => {
    onActiveStepChange?.(activeStep)
  }, [activeStep, onActiveStepChange])

  useEffect(
    () => () => {
      onControlHelpChange(null)
    },
    [onControlHelpChange],
  )

  const completeActiveStep = useCallback(() => {
    if (stepPerformed) return
    setCompletedStepIds((current) => new Set(current).add(activeStep.id))
    setHelpRequestCount(0)
    onControlHelpChange(null)
    if (activeStepIndex === lesson.steps.length - 1) {
      setLessonFinished(true)
      onCompleteLesson(lesson.scenarioId)
    }
  }, [
    activeStep.id,
    activeStepIndex,
    lesson.scenarioId,
    lesson.steps.length,
    onCompleteLesson,
    onControlHelpChange,
    stepPerformed,
  ])

  useEffect(() => {
    if (!simulatorTask || !simulatorTaskSatisfied || stepPerformed) return
    const frame = window.requestAnimationFrame(completeActiveStep)
    return () => window.cancelAnimationFrame(frame)
  }, [completeActiveStep, simulatorTask, simulatorTaskSatisfied, stepPerformed])

  useEffect(() => {
    if (!helpRequested) return
    onControlHelpChange(helpControlId)
    const frame = window.requestAnimationFrame(() => {
      const control = document.getElementById(helpControlId)
      if (!control) return
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
      control.focus({ preventScroll: true })
      control.scrollIntoView?.({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'center',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [helpControlId, helpRequestCount, helpRequested, onControlHelpChange])

  function performStep() {
    for (const action of activeStep.actions) dispatch(action)
    completeActiveStep()
  }

  /**
   * The learner's own selection becomes the committed prediction.
   *
   * This is the whole point of the step: the payload is read off the choice that was picked, so a
   * learner who holds the wrong model commits the wrong triple and the existing engine scoring —
   * untouched here — sees what they actually decided rather than what the scenario expected.
   */
  function commitPrediction() {
    if (!prediction || !selectedPredictionChoiceId || stepPerformed) return
    const commitment = prediction.commitments[selectedPredictionChoiceId]
    if (!commitment) return
    dispatch({
      type: 'COMMIT_PREDICTION',
      goalId: commitment.goalId,
      control: commitment.control,
      direction: commitment.direction,
    })
    completeActiveStep()
  }

  function goToStep(index: number) {
    if (index < 0 || index >= lesson.steps.length) return
    if (index > activeStepIndex && !stepPerformed) return
    setHelpRequestCount(0)
    onControlHelpChange(null)
    const nextStep = lesson.steps[index]
    if (nextStep.transferScenarioId) {
      dispatch({
        type: 'LOAD_SCENARIO',
        scenarioId: nextStep.transferScenarioId,
        mode: 'guided',
      })
      for (const action of nextStep.transferSetupActions ?? []) dispatch(action)
    } else if (activeStep.transferScenarioId) {
      dispatch({ type: 'LOAD_SCENARIO', scenarioId: lesson.scenarioId, mode: 'guided' })
    }
    setActiveStepIndex(index)
    setLessonFinished(false)
  }

  function restartLesson() {
    setActiveStepIndex(0)
    setCompletedStepIds(new Set())
    setLessonFinished(false)
    setHelpRequestCount(0)
    setPredictionChoiceByStepId({})
    onControlHelpChange(null)
    onSelectLesson(lesson.scenarioId)
  }

  return (
    <aside
      className={styles.learningColumn}
      aria-label={`Guided CARDIOHELP ${state.supportMode.toUpperCase()} lesson player`}
    >
      <section className={styles.learnLessonNavigator} aria-labelledby="learn-lessons-heading">
        <div className={styles.learnNavigatorHeading}>
          <div>
            <span className={styles.kicker}>{state.supportMode.toUpperCase()} Learn pathway</span>
            <h2 id="learn-lessons-heading">Guided lessons</h2>
          </div>
          <span>Choose any lesson</span>
        </div>
        {/*
         * The ordered rail replaces the previous grouped dropdown. A dropdown hides the shape of
         * the course: it cannot show that the physiology sections precede the console tour, or
         * where in the arc the learner currently is.
         */}
        <PathwayNav
          pathway={trackPathway}
          label={`${state.supportMode.toUpperCase()} learning pathway`}
          activeSectionId={lesson.scenarioId}
          onSelect={onSelectSection}
        />
        <div className={styles.lessonNavActions}>
          <button
            type="button"
            disabled={!previousLesson}
            onClick={() => previousLesson && onSelectLesson(previousLesson.scenarioId)}
          >
            <ArrowLeft aria-hidden="true" /> Previous lesson
          </button>
          <button
            type="button"
            disabled={!nextLesson}
            onClick={() => nextLesson && onSelectLesson(nextLesson.scenarioId)}
          >
            Next lesson <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className={styles.guidedLessonHeader}>
        <div className={styles.guidedLessonEyebrow}>
          <GraduationCap aria-hidden="true" />
          {activeUnit && activeUnitNumber
            ? `Unit ${activeUnitNumber} · ${activeUnit.title} — `
            : ''}
          Guided lesson
        </div>
        <h2>{lesson.title}</h2>
        <ul>
          {lesson.learningObjectives.map((objective) => (
            <li key={objective}>
              <Target aria-hidden="true" /> {objective}
            </li>
          ))}
        </ul>
        <p className={styles.learnProgress}>Work through the sequence at your own pace.</p>
      </section>

      <nav className={styles.guidedStepper} aria-label="Lesson steps">
        <ol>
          {lesson.steps.map((item, index) => {
            const complete = completedStepIds.has(item.id)
            const current = index === activeStepIndex
            const available = index <= activeStepIndex || complete
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!available}
                  data-current={current}
                  data-complete={complete}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span>{complete ? <Check aria-hidden="true" /> : index + 1}</span>
                  <span>
                    <strong>{phaseLabels[item.phase]}</strong>
                    <small>{item.title}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>

      <section className={styles.guidedStepCard} aria-labelledby="guided-step-heading">
        <div
          ref={activePanelRef}
          tabIndex={-1}
          className={styles.guidedStepFocus}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.guidedStepMeta}>
            <span>{phaseLabels[activeStep.phase]} focus</span>
            <span>
              <CircleDot aria-hidden="true" /> Focus: {targetLabels[activeStep.target]}
            </span>
          </div>
          <h3 id="guided-step-heading">{activeStep.title}</h3>
          <p>{activeStep.instruction}</p>
        </div>

        <div className={styles.guidedWhy}>
          <BookOpenCheck aria-hidden="true" />
          <div>
            <strong>Why this step matters</strong>
            <p>{activeStep.rationale}</p>
          </div>
        </div>

        <div className={styles.guidedSnapshot} aria-label="Current simulated values">
          <span>
            <small>Clock</small>
            <strong>{simulatorSnapshot.time}s</strong>
          </span>
          <span>
            <small>Flow</small>
            <strong>{simulatorSnapshot.flow} L/min</strong>
          </span>
          <span data-readout-status={simulatorSnapshot.pVen.status}>
            <small>pVen</small>
            <strong aria-hidden="true">{simulatorSnapshot.pVen.valueText}</strong>
            <span className="sr-only">{simulatorSnapshot.pVen.screenReaderText}</span>
          </span>
          <span>
            <small>pInt / pArt</small>
            <strong>{simulatorSnapshot.pIntPArt.text}</strong>
          </span>
          <span>
            <small>Sweep</small>
            <strong>{simulatorSnapshot.sweep} L/min</strong>
          </span>
          {state.supportMode === 'va' ? (
            <span>
              <small>Right arm / femoral SpO₂</small>
              <strong>
                {simulatorSnapshot.rightRadialSpo2}% / {simulatorSnapshot.femoralArterialSpo2}%
              </strong>
            </span>
          ) : (
            <span>
              <small>SpO₂ / PaCO₂</small>
              <strong>
                {simulatorSnapshot.spo2}% / {simulatorSnapshot.paCO2}
              </strong>
            </span>
          )}
        </div>

        {prediction ? (
          /*
           * The prediction step is answered, not performed. The options are the only thing shown
           * before commitment — every rationale, the comparison between them and the explanation
           * live in the verdict below, which does not exist until a choice has been committed.
           */
          <div className={styles.guidedPrediction}>
            <fieldset disabled={stepPerformed}>
              <legend>{prediction.item.stem}</legend>
              {prediction.item.choices.map((choice) => (
                <label key={choice.id} data-selected={selectedPredictionChoiceId === choice.id}>
                  <input
                    type="radio"
                    name={`ecmo-prediction-${activeStep.id}`}
                    value={choice.id}
                    checked={selectedPredictionChoiceId === choice.id}
                    onChange={() =>
                      setPredictionChoiceByStepId((current) => ({
                        ...current,
                        [activeStep.id]: choice.id,
                      }))
                    }
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </fieldset>
            {stepPerformed && selectedPredictionChoiceId ? (
              <AnswerVerdict
                item={prediction.item}
                choiceId={selectedPredictionChoiceId}
                timing="immediate-after-commit"
                theme="dark"
                onContinue={
                  activeStepIndex < lesson.steps.length - 1
                    ? () => goToStep(activeStepIndex + 1)
                    : undefined
                }
              />
            ) : (
              <button
                type="button"
                className={styles.guidedPerformAction}
                disabled={!selectedPredictionChoiceId}
                onClick={commitPrediction}
              >
                <SlidersHorizontal aria-hidden="true" /> {activeStep.actionLabel}
              </button>
            )}
          </div>
        ) : !stepPerformed && simulatorTask ? (
          <div className={styles.guidedSimulatorTask} role="status" aria-live="polite">
            <LocateFixed aria-hidden="true" />
            <div>
              <strong>Do this on the simulator</strong>
              <p>{simulatorTask.instruction}</p>
              <small>
                Waiting for: {activeStep.actionLabel}. This step completes automatically when the
                simulator reaches the requested state.
              </small>
            </div>
            <button
              type="button"
              className={styles.guidedHelpAction}
              onClick={() => setHelpRequestCount((count) => count + 1)}
            >
              <CircleHelp aria-hidden="true" />
              {helpRequested ? 'Highlight it again' : 'Show me where'}
            </button>
          </div>
        ) : !stepPerformed ? (
          <div className={styles.guidedManualActions}>
            <button type="button" className={styles.guidedPerformAction} onClick={performStep}>
              <SlidersHorizontal aria-hidden="true" /> {activeStep.actionLabel}
            </button>
            <button
              type="button"
              className={styles.guidedHelpAction}
              onClick={() => setHelpRequestCount((count) => count + 1)}
            >
              <CircleHelp aria-hidden="true" />
              {helpRequested ? 'Highlight it again' : 'I need help finding it'}
            </button>
          </div>
        ) : (
          <div className={styles.guidedExpectedResponse} role="status">
            <CheckCircle2 aria-hidden="true" />
            <div>
              <strong>Step complete—now verify what changed</strong>
              {activeStep.expectedResponse.length ? (
                <ul>
                  {activeStep.expectedResponse.map((response) => (
                    <li key={response}>{response}</li>
                  ))}
                </ul>
              ) : (
                <p>No control change was required for this observation step.</p>
              )}
            </div>
          </div>
        )}

        <div className={styles.guidedStepActions}>
          <button
            type="button"
            disabled={activeStepIndex === 0}
            onClick={() => goToStep(activeStepIndex - 1)}
          >
            <ArrowLeft aria-hidden="true" /> Previous step
          </button>
          {activeStepIndex < lesson.steps.length - 1 ? (
            <button
              type="button"
              disabled={!stepPerformed}
              onClick={() => goToStep(activeStepIndex + 1)}
            >
              Next step <ArrowRight aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" onClick={restartLesson}>
            <RotateCcw aria-hidden="true" /> Restart lesson
          </button>
        </div>
      </section>

      {lessonFinished ? (
        <section className={styles.guidedCompletion} role="status" aria-live="polite">
          <ListChecks aria-hidden="true" />
          <div>
            <h3>Lesson worked through</h3>
            <p>
              {pairedCase
                ? 'The reasoning sequence has been demonstrated. Apply it to the paired clinical case in Practice from a clean state with fewer step-by-step cues.'
                : 'The reasoning sequence has been demonstrated. Continue to the next lesson to keep building the track.'}
            </p>
            {activeUnit ? <small>Continue within {activeUnit.title} whenever useful.</small> : null}
            <div>
              {pairedCase ? (
                <button type="button" onClick={() => onTryPractice(pairedCase.id)}>
                  Apply this in Practice: {pairedCase.title} <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
              {nextPathwaySectionForLesson ? (
                <button
                  type="button"
                  onClick={() => onSelectSection(nextPathwaySectionForLesson.id)}
                >
                  Continue to next section: {nextPathwaySectionForLesson.title}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </aside>
  )
}
