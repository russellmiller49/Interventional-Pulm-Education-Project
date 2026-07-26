import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useReducer, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'

import { criticalCareLearningPathway } from '@/features/critical-care/content/learningPathways'

import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import {
  createInitialSimulationState,
  ecmoSimulationReducer,
  type GuidedControlId,
  type GuidedTarget,
} from '../engine'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { LearnLessonPlayer, resolveGuidedLesson } from '../components/LearnLessonPlayer'

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
      <output data-testid="faults">{state.scenario.activeFaults.join(',')}</output>
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
      />
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

    expect(screen.getByRole('heading', { name: 'Open the parameter list' })).toBeInTheDocument()
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
    performAndAdvance(/Commit the guided prediction/i)
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
    performAndAdvance(/Commit the guided prediction/i)

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
    performAndAdvance(/Commit the guided prediction/i)
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
    performAndAdvance(/Commit the guided prediction/i)

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
    performAndAdvance(/Commit the guided prediction/i)

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

  it('progressively guides isolate, de-air, ordered unclamp, and reset through the real controls', async () => {
    render(<LearnHarness initialScenarioId="arterial-bubble-stop" />)

    performAndAdvance(/Advance 4 simulated seconds to the event/i)
    performAndAdvance(/Commit the guided prediction/i)

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

    // Resume: drainage first, then return.
    fireEvent.click(screen.getByRole('button', { name: /Drainage clamp/i }))
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /Return clamp/i }))
    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    fireEvent.click(screen.getByRole('button', { name: /Show me where/i }))
    const interventionsTab = screen.getByRole('button', { name: 'Interventions' })
    await waitFor(() => {
      expect(interventionsTab).toHaveFocus()
      expect(interventionsTab).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(interventionsTab)

    const resetBubble = screen.getByRole('button', { name: /Reset bubble intervention/i })
    await waitFor(() => {
      expect(resetBubble).toHaveFocus()
      expect(resetBubble).toHaveAttribute('data-guided-help', 'true')
    })
    fireEvent.click(resetBubble)

    await waitFor(() => {
      expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    })
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
