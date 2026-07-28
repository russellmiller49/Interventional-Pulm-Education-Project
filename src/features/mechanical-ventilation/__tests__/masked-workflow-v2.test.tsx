import { fireEvent, render, screen } from '@testing-library/react'

import { CaseWorkflow } from '../components/CaseWorkflow'
import { mechanicalVentilationCaseById } from '../content'
import { createInitialSimulationState } from '../engine'

describe('open ventilation challenge workflow', () => {
  it('keeps the stable case identity visible throughout the preserved engine flow', () => {
    const definition = mechanicalVentilationCaseById.get('MV-14')
    if (!definition) throw new Error('Expected MV-14')
    const state = createInitialSimulationState('MV-14', 'practice', 1, 'hamilton-c6')
    const dispatch = jest.fn()
    const onResult = jest.fn()
    const { rerender } = render(
      <CaseWorkflow
        state={state}
        definition={definition}
        dispatch={dispatch}
        onResult={onResult}
        maskedAssessment
      />,
    )

    expect(
      screen.getByRole('heading', { name: `${definition.id} · ${definition.title}` }),
    ).toBeInTheDocument()

    rerender(
      <CaseWorkflow
        state={{ ...state, phase: 'debrief' }}
        definition={definition}
        dispatch={dispatch}
        onResult={onResult}
        maskedAssessment
      />,
    )
    expect(
      screen.getByRole('heading', { name: `${definition.id} · ${definition.title}` }),
    ).toBeInTheDocument()
  })

  it('defers routine challenge teaching until the learner opts in', () => {
    const definition = mechanicalVentilationCaseById.get('MV-14')
    if (!definition) throw new Error('Expected MV-14')
    const state = {
      ...createInitialSimulationState('MV-14', 'practice', 1, 'hamilton-c6'),
      lastResponse: 'Mechanism-level action response',
    }
    const onShowActionFeedbackChange = jest.fn()
    const { rerender } = render(
      <CaseWorkflow
        state={state}
        definition={definition}
        dispatch={jest.fn()}
        onResult={jest.fn()}
        showActionFeedback={false}
        onShowActionFeedbackChange={onShowActionFeedbackChange}
      />,
    )

    expect(screen.queryByText('Mechanism-level action response')).not.toBeInTheDocument()
    expect(screen.getByText(/Routine teaching note saved for the debrief/i)).toBeInTheDocument()
    const toggle = screen.getByRole('checkbox', {
      name: /Show teaching notes after each action/i,
    })
    fireEvent.click(toggle)
    expect(onShowActionFeedbackChange).toHaveBeenCalledWith(true)

    rerender(
      <CaseWorkflow
        state={state}
        definition={definition}
        dispatch={jest.fn()}
        onResult={jest.fn()}
        showActionFeedback
        onShowActionFeedbackChange={onShowActionFeedbackChange}
      />,
    )
    expect(screen.getByText('Mechanism-level action response')).toBeInTheDocument()
  })
})
