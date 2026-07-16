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

import {
  cardiohelpLearnLessons,
  cardiohelpLearnLessonByScenarioId,
  cardiohelpLearnLessonsBySupportMode,
} from '../content/learnLessons'
import type {
  ConsoleScreen,
  EcmoSimulationState,
  GuidedControlId,
  GuidedLessonDefinition,
  GuidedTarget,
  GuidedWalkthroughStep,
  SimulationAction,
} from '../engine'
import styles from './cardiohelp-ecmo.module.css'

interface LearnWorkflowProps {
  state: EcmoSimulationState
  lesson: GuidedLessonDefinition
  completedLessonIds: ReadonlySet<string>
  dispatch: (action: SimulationAction) => void
  onSelectLesson: (scenarioId: string) => void
  onCompleteLesson: (scenarioId: string) => void
  onTryPractice: (scenarioId: string) => void
  onTargetChange: (target: GuidedTarget) => void
  onControlHelpChange: (controlId: GuidedControlId | null) => void
}

const targetLabels: Record<GuidedTarget, string> = {
  console: 'Device console',
  circuit: 'Circuit and sensors',
  'gas-panel': 'Separate gas panel',
  'patient-monitor': 'Independent patient monitor',
  'trend-panel': 'Device + patient trends',
}

const phaseLabels = {
  orient: 'Orient',
  observe: 'Observe',
  interpret: 'Interpret',
  respond: 'Respond',
  reassess: 'Reassess',
  transfer: 'Transfer',
} as const

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

export function LearnWorkflow({
  state,
  lesson,
  completedLessonIds,
  dispatch,
  onSelectLesson,
  onCompleteLesson,
  onTryPractice,
  onTargetChange,
  onControlHelpChange,
}: LearnWorkflowProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(() => new Set())
  const [lessonFinished, setLessonFinished] = useState(false)
  const [helpRequestCount, setHelpRequestCount] = useState(0)
  const activePanelRef = useRef<HTMLDivElement>(null)
  const activeStep = lesson.steps[activeStepIndex] ?? lesson.steps[0]
  const stepPerformed = completedStepIds.has(activeStep.id)
  const simulatorTask = resolveGuidedSimulatorTask(activeStep, state)
  const simulatorTaskSatisfied = simulatorTask?.satisfied ?? false
  const helpControlId = simulatorTask?.controlId ?? panelControlIds[activeStep.target]
  const helpRequested = helpRequestCount > 0
  const modeLessons = cardiohelpLearnLessonsBySupportMode[state.supportMode]
  const lessonIndex = modeLessons.findIndex((item) => item.id === lesson.id)
  const nextLesson = modeLessons[lessonIndex + 1]
  const previousLesson = modeLessons[lessonIndex - 1]
  const percentComplete = Math.round((completedStepIds.size / lesson.steps.length) * 100)

  const simulatorSnapshot = useMemo(
    () => ({
      time: state.simulationTime,
      flow: state.circuit.bloodFlow.toFixed(2),
      pVen: state.circuit.pVen,
      pInt: state.circuit.pInt,
      pArt: state.circuit.pArt,
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

  function goToStep(index: number) {
    if (index < 0 || index >= lesson.steps.length) return
    if (index > activeStepIndex && !stepPerformed) return
    setHelpRequestCount(0)
    onControlHelpChange(null)
    setActiveStepIndex(index)
    setLessonFinished(false)
  }

  function restartLesson() {
    setActiveStepIndex(0)
    setCompletedStepIds(new Set())
    setLessonFinished(false)
    setHelpRequestCount(0)
    onControlHelpChange(null)
    onSelectLesson(lesson.scenarioId)
  }

  return (
    <aside
      className={styles.learningColumn}
      aria-label={`Guided CARDIOHELP ${state.supportMode.toUpperCase()} learning walkthrough`}
    >
      <section className={styles.learnLessonNavigator} aria-labelledby="learn-lessons-heading">
        <div className={styles.learnNavigatorHeading}>
          <div>
            <span className={styles.kicker}>{state.supportMode.toUpperCase()} Learn pathway</span>
            <h2 id="learn-lessons-heading">Guided lessons</h2>
          </div>
          <span>
            {modeLessons.filter((item) => completedLessonIds.has(item.scenarioId)).length}/
            {modeLessons.length} this session
          </span>
        </div>
        <label>
          Lesson
          <select
            value={lesson.scenarioId}
            onChange={(event) => onSelectLesson(event.target.value)}
          >
            {modeLessons.map((item, index) => (
              <option key={item.id} value={item.scenarioId}>
                {index + 1}. {item.title}
                {completedLessonIds.has(item.scenarioId) ? ' · reviewed' : ''}
              </option>
            ))}
          </select>
        </label>
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
          Lesson {lessonIndex + 1} of {modeLessons.length} · unscored walkthrough
        </div>
        <h2>{lesson.title}</h2>
        <ul>
          {lesson.learningObjectives.map((objective) => (
            <li key={objective}>
              <Target aria-hidden="true" /> {objective}
            </li>
          ))}
        </ul>
        <div className={styles.learnProgress}>
          <span>Walkthrough progress</span>
          <strong>{percentComplete}%</strong>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentComplete}
          >
            <i style={{ width: `${percentComplete}%` }} />
          </div>
        </div>
      </section>

      <nav className={styles.guidedStepper} aria-label="Walkthrough steps">
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
            <span>
              Step {activeStepIndex + 1} of {lesson.steps.length}
            </span>
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
          <span>
            <small>pVen</small>
            <strong>{simulatorSnapshot.pVen}</strong>
          </span>
          <span>
            <small>pInt / pArt</small>
            <strong>
              {simulatorSnapshot.pInt} / {simulatorSnapshot.pArt}
            </strong>
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

        {!stepPerformed && simulatorTask ? (
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
            <RotateCcw aria-hidden="true" /> Restart walkthrough
          </button>
        </div>
      </section>

      {lessonFinished ? (
        <section className={styles.guidedCompletion} role="status" aria-live="polite">
          <ListChecks aria-hidden="true" />
          <div>
            <h3>Walkthrough complete</h3>
            <p>
              The reasoning sequence has been demonstrated. Practice reloads this round from a clean
              state and removes the step-by-step answer cues.
            </p>
            <div>
              <button type="button" onClick={() => onTryPractice(lesson.scenarioId)}>
                Try this round in Practice <ArrowRight aria-hidden="true" />
              </button>
              {nextLesson ? (
                <button type="button" onClick={() => onSelectLesson(nextLesson.scenarioId)}>
                  Continue to next lesson
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </aside>
  )
}
