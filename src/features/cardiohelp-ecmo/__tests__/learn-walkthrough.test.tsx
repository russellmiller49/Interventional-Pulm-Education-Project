import { fireEvent, render, screen } from '@testing-library/react'
import { useReducer, useState } from 'react'

import { cardiohelpLearnLessonsBySupportMode } from '../content/learnLessons'
import { createInitialSimulationState, ecmoSimulationReducer, type GuidedTarget } from '../engine'
import { LearnWorkflow, resolveGuidedLesson } from '../components/LearnWorkflow'

function LearnHarness({
  initialScenarioId,
  onCompleteLesson = jest.fn(),
  onTryPractice = jest.fn(),
  onTargetChange = jest.fn(),
}: {
  initialScenarioId: string
  onCompleteLesson?: (scenarioId: string) => void
  onTryPractice?: (scenarioId: string) => void
  onTargetChange?: (target: GuidedTarget) => void
}) {
  const [scenarioId, setScenarioId] = useState(initialScenarioId)
  const [state, dispatch] = useReducer(ecmoSimulationReducer, initialScenarioId, (id) =>
    createInitialSimulationState(id, 'guided'),
  )
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(() => new Set())
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
      <LearnWorkflow
        key={lesson.id}
        state={state}
        lesson={lesson}
        completedLessonIds={completedLessonIds}
        dispatch={dispatch}
        onSelectLesson={selectLesson}
        onCompleteLesson={(completedScenarioId) => {
          setCompletedLessonIds((current) => new Set(current).add(completedScenarioId))
          onCompleteLesson(completedScenarioId)
        }}
        onTryPractice={onTryPractice}
        onTargetChange={onTargetChange}
      />
    </>
  )
}

function performAndAdvance(actionName: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name: actionName }))
  fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
}

describe('CARDIOHELP ECMO Learn walkthrough', () => {
  it('presents one ordered step at a time with a named visual target', () => {
    const onTargetChange = jest.fn()
    render(
      <LearnHarness
        initialScenarioId="startup-sensor-orientation"
        onTargetChange={onTargetChange}
      />,
    )

    expect(screen.getByText('Step 1 of 13')).toBeInTheDocument()
    expect(screen.getByText('Focus: Circuit and sensors')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next step/i })).toBeDisabled()
    expect(screen.queryByRole('option', { name: /capstone/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(
      cardiohelpLearnLessonsBySupportMode.vv.length,
    )

    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(screen.getByText(/Step complete—now verify what changed/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Next step/i })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))

    expect(screen.getByRole('heading', { name: 'Open the parameter list' })).toBeInTheDocument()
    expect(screen.getByText('Focus: Device console')).toBeInTheDocument()
    expect(onTargetChange).toHaveBeenCalledWith('circuit')
    expect(onTargetChange).toHaveBeenCalledWith('console')
  })

  it('uses the real reducer for the demonstrated safe action without showing a score', () => {
    render(<LearnHarness initialScenarioId="preload-drainage-collapse" />)

    performAndAdvance(/Inspect the starting pattern/i)
    performAndAdvance(/Commit the guided prediction/i)
    fireEvent.click(screen.getByRole('button', { name: /Reduce RPM from 3600 to 3300/i }))

    expect(screen.getByTestId('rpm')).toHaveTextContent('3300')
    expect(screen.queryByText(/Round score/i)).not.toBeInTheDocument()
    expect(screen.getByText(/No critical RPM-escalation error/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /Correct the identified drainage cause/i }))
    expect(screen.getByTestId('faults')).not.toHaveTextContent('preload-limited')
  })

  it('advances timed teaching events deterministically while the walkthrough is paused', () => {
    render(<LearnHarness initialScenarioId="gas-source-interruption" />)

    fireEvent.click(
      screen.getByRole('button', { name: /Advance 5 simulated seconds to the event/i }),
    )
    expect(screen.getByTestId('clock')).toHaveTextContent('5')
    expect(screen.getByTestId('gas-source')).toHaveTextContent('false')
    expect(screen.getByText(/Gas source interrupted/i)).toBeInTheDocument()
  })

  it('resets to the first step and clean simulation state when the lesson changes', () => {
    render(<LearnHarness initialScenarioId="startup-sensor-orientation" />)

    performAndAdvance(/identify all four domains/i)
    fireEvent.click(screen.getByRole('button', { name: /Open Parameter list/i }))
    expect(screen.getByTestId('screen')).toHaveTextContent('parameters')

    fireEvent.change(screen.getByLabelText('Lesson'), {
      target: { value: 'acute-hypercapnia' },
    })
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument()
    expect(screen.getByTestId('screen')).toHaveTextContent('startup')
    expect(screen.getByRole('button', { name: /Next step/i })).toBeDisabled()
  })
})
