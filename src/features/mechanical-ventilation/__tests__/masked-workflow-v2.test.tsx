import { render, screen } from '@testing-library/react'

import { CaseWorkflow } from '../components/CaseWorkflow'
import { mechanicalVentilationCaseById } from '../content'
import { createInitialSimulationState } from '../engine'

describe('masked ventilation assessment workflow', () => {
  it('withholds case identity until the preserved engine reaches debrief', () => {
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
      screen.getByRole('heading', { name: 'Masked respiratory failure case' }),
    ).toBeInTheDocument()
    expect(screen.queryByText(definition.title)).not.toBeInTheDocument()

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
})
