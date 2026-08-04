import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useReducer, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import { ecmoLearnPredictionFor } from '../content/learnPredictionItems'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type GuidedControlId,
  type GuidedTarget,
} from '../engine'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { LearnLessonPlayer, resolveGuidedLesson } from '../components/LearnLessonPlayer'
import { LearnStepTeaching, type LearnStepStatus } from '../components/LearnStepTeaching'

/*
 * These walkthroughs drive a seventeen-step console tour through a real reducer and a real console,
 * with a `waitFor` at most steps. Isolated they run in a couple of seconds; in a full-suite run on a
 * machine that gives Jest a worker per core they can exceed the five-second default, and the B3/B4
 * suites added enough load to make that regular rather than rare. Nothing here is slow because it is
 * doing more work than it should — the budget simply has to match what a seventeen-step UI
 * walkthrough costs under contention.
 */
jest.setTimeout(30_000)

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function LearnHarness({
  initialScenarioId,
  onCompleteLesson = jest.fn(),
  onTryPractice = jest.fn(),
  onTargetChange = jest.fn(),
  onControlHelpChange = jest.fn(),
}: {
  initialScenarioId: string
  onCompleteLesson?: (scenarioId: string) => void
  onTryPractice?: (scenarioId: string) => void
  onTargetChange?: (target: GuidedTarget) => void
  onControlHelpChange?: (controlId: GuidedControlId | null) => void
}) {
  const [scenarioId, setScenarioId] = useState(initialScenarioId)
  const [state, dispatch] = useReducer(ecmoSimulationReducer, initialScenarioId, (id) =>
    createInitialSimulationState(id, 'guided'),
  )
  const [, setCompletedLessonIds] = useState<Set<string>>(() => new Set())
  const [guidedTarget, setGuidedTarget] = useState<GuidedTarget>('circuit')
  const [guidedControlId, setGuidedControlId] = useState<GuidedControlId | null>(null)
  // B3 moved the step's rationale, the live snapshot, and the completed-step response into the
  // workspace's teaching pane. The harness composes the same surfaces the workspace composes, so
  // these assertions still walk one lesson through one engine rather than two copies of it.
  const [stepStatus, setStepStatus] = useState<LearnStepStatus | null>(null)
  const lesson = resolveGuidedLesson(scenarioId)

  function selectLesson(nextScenarioId: string) {
    setScenarioId(nextScenarioId)
    dispatch({ type: 'LOAD_SCENARIO', scenarioId: nextScenarioId, mode: 'guided' })
  }

  return (
    <>
      <output data-testid="clock">{state.simulationTime}</output>
      <output data-testid="screen">{state.device.screen}</output>
      <output data-testid="rpm">{state.device.rpmSetpoint}</output>
      <output data-testid="gas-source">{String(state.gas.sourceConnected)}</output>
      <output data-testid="clamps">
        {[
          state.circuit.drainageClampClosed ? 'closed' : 'open',
          state.circuit.returnClampClosed ? 'closed' : 'open',
        ].join('|')}
      </output>
      <output data-testid="pump">{state.device.pumpRunning ? 'running' : 'stopped'}</output>
      <output data-testid="faults">{state.scenario.activeFaults.join(',')}</output>
      {/* What the engine actually received, so a test can tell a real commitment from a rendered one. */}
      <output data-testid="prediction">
        {[
          String(state.scenario.prediction.committed),
          state.scenario.prediction.goalId ?? '',
          state.scenario.prediction.control ?? '',
          state.scenario.prediction.direction ?? '',
        ].join('|')}
      </output>
      <output data-testid="credit">
        {[
          `goal:${state.scenario.credit.goal}`,
          `control:${state.scenario.credit.control}`,
          `direction:${state.scenario.credit.direction}`,
        ].join('|')}
      </output>
      <LearnLessonPlayer
        key={lesson.id}
        state={state}
        lesson={lesson}
        dispatch={dispatch}
        onSelectLesson={selectLesson}
        onCompleteLesson={(completedScenarioId) => {
          setCompletedLessonIds((current) => new Set(current).add(completedScenarioId))
          onCompleteLesson(completedScenarioId)
        }}
        onTryPractice={onTryPractice}
        onTargetChange={(target) => {
          setGuidedTarget(target)
          onTargetChange(target)
        }}
        onControlHelpChange={(controlId) => {
          setGuidedControlId(controlId)
          onControlHelpChange(controlId)
        }}
        onStepStatusChange={setStepStatus}
      />
      {stepStatus ? <LearnStepTeaching state={state} status={stepStatus} /> : null}
      <CardiohelpConsole
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={guidedTarget}
        guidedControlId={guidedControlId}
      />
      <CircuitAndMonitors
        state={state}
        dispatch={dispatch}
        controlsEnabled
        guidedTarget={guidedTarget}
        guidedControlId={guidedControlId}
      />
    </>
  )
}

function performAndAdvance(actionName: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: actionName }))
  fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
}

function predictionChoice(scenarioId: string, plausibility: string) {
  const prediction = ecmoLearnPredictionFor(scenarioId)
  if (!prediction) throw new Error(`No authored prediction for ${scenarioId}`)
  const choice = prediction.item.choices.find((item) => item.plausibility === plausibility)
  if (!choice) throw new Error(`No ${plausibility} choice for ${scenarioId}`)
  return { ...choice, commitment: prediction.commitments[choice.id] }
}

/** Answers the prediction the way the lesson intends, then takes the separate Continue. */
function answerPredictionAndAdvance(scenarioId: string, plausibility = 'best') {
  fireEvent.click(
    screen.getByRole('radio', { name: predictionChoice(scenarioId, plausibility).label }),
  )
  fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

/** Ramps the rotary from a stopped circuit to the reference speed, the way the lesson asks. */
async function rampToReferenceSpeedAndAdvance() {
  const knob = screen.getByRole('slider', { name: /RPM rotary setpoint/i })
  while (Number(screen.getByTestId('rpm').textContent) < 3200) {
    fireEvent.keyDown(knob, { key: 'ArrowUp' })
  }
  expect(screen.getByTestId('rpm')).toHaveTextContent('3200')
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled()
  })
  fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
}

async function useConsoleScreenAndAdvance(buttonName: string) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled()
  })
  fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
}

describe('CARDIOHELP ECMO Learn walkthrough', () => {
  it('directs learners to the real console and automatically accepts the completed task', async () => {
    const onTargetChange = jest.fn()
    render(
      <LearnHarness
        initialScenarioId="startup-sensor-orientation"
        onTargetChange={onTargetChange}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: cardiohelpLearnLessonsBySupportMode.vv[0].steps[0].title,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Focus: Circuit and sensors')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next step/i })).toBeDisabled()
    const rail = screen.getByRole('navigation', { name: /VV learning pathway sections/i })
    expect(within(rail).getAllByRole('button')).toHaveLength(
      criticalCareLearningPathway('cardiohelp-ecmo', 'vv').sections.length,
    )

    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    expect(
      screen.getByRole('heading', { name: /which channels still mean anything/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Focus: Device console')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Open Parameter list$/i })).not.toBeInTheDocument()
    expect(screen.getByText(/This step completes automatically/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const parameterButton = screen.getByRole('button', { name: 'Parameter list' })
    await waitFor(() => {
      expect(parameterButton).toHaveFocus()
      expect(parameterButton).toHaveAttribute('data-guided-help', 'true')
    })

    fireEvent.click(parameterButton)
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('screen')).toHaveTextContent('parameters')
    expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled()
    expect(onTargetChange).toHaveBeenCalledWith('circuit')
    expect(onTargetChange).toHaveBeenCalledWith('console')
  })

  it('uses the real RPM rotary for the demonstrated safe action without showing a score', async () => {
    render(<LearnHarness initialScenarioId="preload-drainage-collapse" />)

    performAndAdvance(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('preload-drainage-collapse')
    expect(
      screen.queryByRole('button', { name: /Reduce RPM from 3600 to 3300/i }),
    ).not.toBeInTheDocument()
    const decreaseSetpoint = screen.getByRole('button', { name: /Decrease setpoint/i })
    for (let index = 0; index < 6; index += 1) fireEvent.click(decreaseSetpoint)

    expect(screen.getByTestId('rpm')).toHaveTextContent('3300')
    expect(screen.queryByText(/Round score/i)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/No critical RPM-escalation error/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /Correct the identified drainage cause/i }))
    expect(screen.getByTestId('faults')).not.toHaveTextContent('preload-limited')
  })

  it('provides progressive help for the Menu to Alarm list path', async () => {
    render(<LearnHarness initialScenarioId="startup-sensor-orientation" />)

    performAndAdvance(/identify all four domains/i)
    await useConsoleScreenAndAdvance('Parameter list')
    // A3.3: the stopped-pump recognition is followed by a ramp, so the rest of the tour is read on
    // a running circuit rather than a dead one.
    await rampToReferenceSpeedAndAdvance()
    // The reference circuit only responds once the model is advanced; the tour is read on that.
    performAndAdvance(/Advance the model and let the circuit settle/i)
    await useConsoleScreenAndAdvance('Parameter list')
    await useConsoleScreenAndAdvance('Blood parameters')
    await useConsoleScreenAndAdvance('Transport')
    await useConsoleScreenAndAdvance('Interventions')
    await useConsoleScreenAndAdvance('Timers')

    expect(
      screen.getByRole('heading', { name: /Use alarm history as context/i }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))

    const menuButton = screen.getByRole('button', { name: 'Menu' })
    await waitFor(() => {
      expect(menuButton).toHaveFocus()
      expect(menuButton).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(menuButton)

    await waitFor(() => {
      const alarmList = screen.getByRole('button', { name: /Alarm list/i })
      expect(alarmList).toHaveAttribute('data-guided-help', 'true')
      expect(alarmList).toHaveFocus()
    })
    const alarmListButton = screen.getByRole('button', { name: /Alarm list/i })
    fireEvent.click(alarmListButton)

    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('screen')).toHaveTextContent('alarm-history')

    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const homeButton = screen.getByRole('button', { name: 'Home' })
    await waitFor(() => {
      expect(homeButton).toHaveFocus()
      expect(homeButton).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(homeButton)
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('screen')).toHaveTextContent('startup')
  })

  it('advances timed teaching events deterministically while the walkthrough is paused', () => {
    render(<LearnHarness initialScenarioId="gas-source-interruption" />)

    fireEvent.click(
      screen.getByRole('button', { name: /Advance 5 simulated seconds to the event/i }),
    )
    expect(screen.getByTestId('clock')).toHaveTextContent('5')
    expect(screen.getByTestId('gas-source')).toHaveTextContent('false')
    expect(screen.getAllByText(/Gas source interrupted/i).length).toBeGreaterThan(0)
  })

  it('guides a sweep change on the external gas control and accepts the new setting', async () => {
    render(<LearnHarness initialScenarioId="acute-hypercapnia" />)

    performAndAdvance(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('acute-hypercapnia')

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const sweepControl = screen.getByRole('slider', { name: 'Sweep flow control' })
    await waitFor(() => {
      expect(sweepControl).toHaveFocus()
      expect(sweepControl).toHaveAttribute('data-guided-help', 'true')
    })

    fireEvent.change(sweepControl, { target: { value: '3' } })
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Increase sweep to 3.0/i })).not.toBeInTheDocument()
  })

  it('bridges a finished lesson to its paired clinical case in Practice', async () => {
    const onTryPractice = jest.fn()
    const onCompleteLesson = jest.fn()
    render(
      <LearnHarness
        initialScenarioId="acute-hypercapnia"
        onCompleteLesson={onCompleteLesson}
        onTryPractice={onTryPractice}
      />,
    )

    performAndAdvance(/Inspect the starting pattern/i)
    answerPredictionAndAdvance('acute-hypercapnia')
    fireEvent.change(screen.getByRole('slider', { name: 'Sweep flow control' }), {
      target: { value: '3' },
    })
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    performAndAdvance(/Advance 1 second and inspect the response/i)
    expect(
      screen.getByRole('heading', { name: /Transfer: Compensated hypercapnia/i }),
    ).toBeInTheDocument()
    expect(onCompleteLesson).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Blood parameters' }))

    await waitFor(() => expect(onCompleteLesson).toHaveBeenCalledWith('acute-hypercapnia'))
    fireEvent.click(screen.getByRole('button', { name: /Apply this in Practice/i }))
    expect(onTryPractice).toHaveBeenCalledWith('clinical-vv-gas-disconnection')
  })

  it('guides restoration through the real gas-source control', async () => {
    render(<LearnHarness initialScenarioId="gas-source-interruption" />)

    performAndAdvance(/Advance 5 simulated seconds to the event/i)
    answerPredictionAndAdvance('gas-source-interruption')

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const restoreGas = screen.getByRole('button', { name: /Restore verified gas source/i })
    await waitFor(() => {
      expect(restoreGas).toHaveFocus()
      expect(restoreGas).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(restoreGas)

    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('gas-source')).toHaveTextContent('true')
  })

  it('highlights and accepts the AC restore control on the Transport screen', async () => {
    render(<LearnHarness initialScenarioId="transport-power-loss" />)

    performAndAdvance(/Advance .* simulated seconds to the event/i)
    answerPredictionAndAdvance('transport-power-loss')

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const restorePower = await screen.findByRole('button', {
      name: /Reconnect verified AC source/i,
    })
    await waitFor(() => {
      expect(restorePower).toHaveFocus()
      expect(restorePower).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(restorePower)

    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
  })

  it('progressively guides isolation, source correction, and bounded resumption through the real controls', async () => {
    render(<LearnHarness initialScenarioId="arterial-bubble-stop" />)

    performAndAdvance(/Advance 4 simulated seconds to the event/i)
    answerPredictionAndAdvance('arterial-bubble-stop')

    // Isolate: the clamp steps auto-complete when the real clamp buttons reach
    // the requested state, and guided help highlights the matching button.
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const returnClamp = await screen.findByRole('button', { name: /Return clamp/i })
    await waitFor(() => {
      expect(returnClamp).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(returnClamp)
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    const drainageClamp = screen.getByRole('button', { name: /Drainage clamp/i })
    fireEvent.click(drainageClamp)
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    performAndAdvance(/Correct the source and clear the circuit/i)

    /*
     * Coming back is one act, on its own control.
     *
     * The lesson used to walk the learner out through open-drainage, open-return, reset — which put
     * the patient back on both limbs of a stopped centrifugal circuit before anything was turning.
     * There is no clamp step here to find any more, and the control the guided help points at is
     * neither a clamp nor the console reset.
     */
    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    // By id rather than by name: the stepper entry for this step carries the same words, and the
    // control this asserts on is the one on the bedside circuit.
    const resume = document.getElementById('cardiohelp-resume-support')
    if (!resume) throw new Error('The bedside circuit did not render the resume control')
    await waitFor(() => {
      expect(resume).toHaveFocus()
      expect(resume).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(resume)

    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    // One transition: both limbs open and the pump running, with no frame in between.
    expect(screen.getByTestId('clamps')).toHaveTextContent('open|open')
    expect(screen.getByTestId('pump')).toHaveTextContent('running')
  })

  it('resets to the first step and clean simulation state when the lesson changes', async () => {
    render(<LearnHarness initialScenarioId="startup-sensor-orientation" />)

    performAndAdvance(/identify all four domains/i)
    fireEvent.click(screen.getByRole('button', { name: 'Parameter list' }))
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    expect(screen.getByTestId('screen')).toHaveTextContent('parameters')

    fireEvent.click(screen.getByRole('button', { name: /Acute hypercapnic acidemia/i }))
    const selectedLesson = cardiohelpLearnLessonsBySupportMode.vv.find(
      (lesson) => lesson.scenarioId === 'acute-hypercapnia',
    )
    expect(
      screen.getByRole('heading', { name: selectedLesson?.steps[0].title }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('screen')).toHaveTextContent('startup')
    expect(screen.getByRole('button', { name: /Next step/i })).toBeDisabled()
  })
})

/**
 * B1/B2 — the Learn prediction is answered, and the answer is the learner's.
 *
 * Three separate leaks used to make this step unanswerable: the instruction named the goal, the
 * control and the direction; the rationale printed the scenario's whole causal chain above the
 * button; and the single button dispatched the scenario's own expectation whatever the learner
 * believed. Each block below fails if any one of them is restored.
 */
describe('CARDIOHELP ECMO Learn prediction', () => {
  function openPredictionStep(scenarioId: string, firstAction: RegExp) {
    render(<LearnHarness initialScenarioId={scenarioId} />)
    performAndAdvance(firstAction)
  }

  it('offers the authored options and commits nothing until one is chosen', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const prediction = ecmoLearnPredictionFor('preload-drainage-collapse')
    if (!prediction) throw new Error('missing prediction')
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(prediction.item.choices.length)
    expect(radios.length).toBeGreaterThan(1)
    for (const choice of prediction.item.choices) {
      expect(screen.getByRole('radio', { name: choice.label })).toBeInTheDocument()
    }

    // Nothing has reached the engine, and the commit control refuses to run without an answer.
    expect(screen.getByTestId('prediction')).toHaveTextContent('false|||')
    expect(screen.getByRole('button', { name: /Commit this prediction/i })).toBeDisabled()
    expect(document.querySelector('[data-answer-verdict]')).toBeNull()
  })

  it('says nothing about the expected answer before the learner has committed', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    // Everything on the prediction step that is not an answer option. A choice label naming an
    // action is the point of the exercise; the surrounding copy must not settle it.
    const visible = [
      screen.getByRole('heading', { name: /Commit to a prediction/i }).textContent ?? '',
      document.querySelector('[class*="guidedStepFocus"]')?.textContent ?? '',
      document.querySelector('[class*="guidedWhy"]')?.textContent ?? '',
      screen.getByRole('button', { name: /Commit this prediction/i }).textContent ?? '',
    ]
      .join(' ')
      .toLowerCase()

    expect(visible).not.toContain('restore-drainage')
    expect(visible).not.toMatch(/\bthe safe goal is\b/)
    expect(visible).not.toMatch(/\bpredict decrease\b/)
    // The causal chain is the debrief's job, not the question's.
    expect(visible).not.toContain('available venous return becomes insufficient')
    // No rationale is on screen yet — every one of them belongs to the verdict.
    for (const choice of ecmoLearnPredictionFor('preload-drainage-collapse')?.item.choices ?? []) {
      expect(screen.queryByText(choice.rationale)).toBeNull()
    }
  })

  it('sends the learner’s own triple to the engine, including when it is the wrong one', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const unsafe = predictionChoice('preload-drainage-collapse', 'unsafe')
    fireEvent.click(screen.getByRole('radio', { name: unsafe.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    expect(screen.getByTestId('prediction')).toHaveTextContent(
      `true|${unsafe.commitment.goalId}|${unsafe.commitment.control}|${unsafe.commitment.direction}`,
    )
    // The engine scored what was actually decided; it is not the scenario's expectation.
    expect(screen.getByTestId('credit')).toHaveTextContent(
      'goal:false|control:true|direction:false',
    )
  })

  it('credits the expectation only when the learner selects the choice that carries it', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const best = predictionChoice('preload-drainage-collapse', 'best')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    expect(screen.getByTestId('prediction')).toHaveTextContent(
      `true|${best.commitment.goalId}|${best.commitment.control}|${best.commitment.direction}`,
    )
    expect(screen.getByTestId('credit')).toHaveTextContent('goal:true|control:true|direction:true')
  })

  it('shows the verdict on commitment, stays on the step, and advances only on Continue', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const best = predictionChoice('preload-drainage-collapse', 'best')
    fireEvent.click(screen.getByRole('radio', { name: best.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).not.toBeNull()
    expect(verdict).toHaveAttribute('data-plausibility', 'best')
    expect(verdict?.textContent).toContain(best.rationale)
    expect(screen.getByText(/why the other answers do not fit/i)).toBeInTheDocument()

    // Committing did not move the learner on.
    expect(
      screen.getByRole('heading', { name: /Commit to a prediction before you act/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Reduce pump demand first/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(screen.getByRole('heading', { name: /Reduce pump demand first/i })).toBeInTheDocument()
  })

  it('keeps the committed answer selected and locked while the verdict is on screen', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const incomplete = predictionChoice('preload-drainage-collapse', 'reasonable-but-incomplete')
    fireEvent.click(screen.getByRole('radio', { name: incomplete.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    const chosen = screen.getByRole('radio', { name: incomplete.label })
    expect(chosen).toBeChecked()
    expect(chosen).toBeDisabled()
    expect(document.querySelector('[data-answer-verdict]')?.textContent).toContain(incomplete.label)
  })

  it('announces an unsafe commitment assertively', () => {
    openPredictionStep('preload-drainage-collapse', /Inspect the starting pattern/i)

    const unsafe = predictionChoice('preload-drainage-collapse', 'unsafe')
    fireEvent.click(screen.getByRole('radio', { name: unsafe.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))

    const verdict = document.querySelector('[data-answer-verdict]')
    expect(verdict).toHaveAttribute('data-plausibility', 'unsafe')
    expect(verdict).toHaveAttribute('role', 'alert')
    expect(verdict).toHaveAttribute('aria-live', 'assertive')
  })

  it('reaches an answerable prediction at the end of the console tour', async () => {
    // The orientation lessons had the leak in its quietest form: the prompt did not name the
    // answer, but there was still nothing to choose between and the payload was already filled in.
    render(<LearnHarness initialScenarioId="startup-sensor-orientation" />)

    performAndAdvance(/identify all four domains/i)
    await useConsoleScreenAndAdvance('Parameter list')
    await rampToReferenceSpeedAndAdvance()
    // The reference circuit only responds once the model is advanced; the tour is read on that.
    performAndAdvance(/Advance the model and let the circuit settle/i)
    await useConsoleScreenAndAdvance('Parameter list')
    await useConsoleScreenAndAdvance('Blood parameters')
    await useConsoleScreenAndAdvance('Transport')
    await useConsoleScreenAndAdvance('Interventions')
    await useConsoleScreenAndAdvance('Timers')
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    await useConsoleScreenAndAdvance('Alarm list')
    await useConsoleScreenAndAdvance('Home')
    performAndAdvance(/I can distinguish the two gas controls/i)
    // The demonstration ends and the circuit goes back to the state a startup actually begins from.
    performAndAdvance(/Return the circuit to its pre-use state/i)

    const prediction = ecmoLearnPredictionFor('startup-sensor-orientation')
    if (!prediction) throw new Error('missing orientation prediction')
    expect(screen.getAllByRole('radio')).toHaveLength(prediction.item.choices.length)
    expect(screen.getByTestId('prediction')).toHaveTextContent('false|||')

    const unsafe = predictionChoice('startup-sensor-orientation', 'unsafe')
    fireEvent.click(screen.getByRole('radio', { name: unsafe.label }))
    fireEvent.click(screen.getByRole('button', { name: /Commit this prediction/i }))
    expect(screen.getByTestId('prediction')).toHaveTextContent(
      `true|${unsafe.commitment.goalId}|${unsafe.commitment.control}|${unsafe.commitment.direction}`,
    )
    expect(document.querySelector('[data-answer-verdict]')).toHaveAttribute('role', 'alert')
  })

  it('gives the VA orientation lesson its own question rather than the venovenous one', () => {
    const vaBest = predictionChoice('va-startup-sensor-orientation', 'best')
    const vvBest = predictionChoice('startup-sensor-orientation', 'best')

    // Both scenarios carry the same expectation, so inheriting the venovenous question would look
    // correct and teach nothing about a femoral arterial return.
    expect(vaBest.commitment).toEqual(vvBest.commitment)
    expect(vaBest.label).not.toEqual(vvBest.label)
    const vaLesson = cardiohelpLearnLessonsBySupportMode.va.find(
      (lesson) => lesson.scenarioId === 'va-startup-sensor-orientation',
    )
    const predictionSteps = (vaLesson?.steps ?? []).filter((step) => step.predictionScenarioId)
    expect(predictionSteps).toHaveLength(1)
    expect(predictionSteps[0].predictionScenarioId).toBe('va-startup-sensor-orientation')
  })
})
