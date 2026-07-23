import { fireEvent, render, screen } from '@testing-library/react'

import { PressureSystemTeachingVisual } from '../components/PressureSystemTeachingVisual'
import { hemodynamicCaseById } from '../content'
import { createInitialHemodynamicState } from '../engine'

describe('PressureSystemTeachingVisual', () => {
  it('shows the PA safety warning and switches between distinct PA and arterial families', () => {
    const state = createInitialHemodynamicState(hemodynamicCaseById.get('HD-01')!, 'learn', 42)
    render(<PressureSystemTeachingVisual state={state} dispatch={jest.fn()} />)

    expect(screen.getByRole('radio', { name: /Pulmonary artery catheter/i })).toBeChecked()
    expect(
      screen.getByText(
        /Confirm a pulmonary-artery waveform and a fully deflated balloon.*Never fast-flush a wedged or spontaneously wedged catheter/i,
      ),
    ).toHaveTextContent(
      /Confirm a pulmonary-artery waveform and a fully deflated balloon.*Never fast-flush a wedged or spontaneously wedged catheter/i,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Fast flush test' }))
    expect(
      screen.getByRole('img', {
        name: /Pulmonary artery catheter observed fast-flush release response.*Two pulsatile beats.*off-scale flush plateau/i,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Systemic arterial line/i }))
    expect(
      screen.getByRole('img', {
        name: /Systemic arterial line observed fast-flush release response/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^PA safety\./i)).not.toBeInTheDocument()
  })

  it('blocks a PA fast flush when the simulated catheter is wedged', () => {
    const state = createInitialHemodynamicState(hemodynamicCaseById.get('HD-08')!, 'learn', 84)
    render(
      <PressureSystemTeachingVisual
        state={state}
        dispatch={jest.fn()}
        challengeMode="current-state"
      />,
    )

    expect(screen.getByRole('radio', { name: /Systemic arterial line/i })).toBeChecked()
    fireEvent.click(screen.getByRole('radio', { name: /Pulmonary artery catheter/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      /current simulated catheter state does not meet this prerequisite/i,
    )
    expect(screen.getByRole('button', { name: 'Fast flush test' })).toBeDisabled()
  })
})
