import { fireEvent, render, screen } from '@testing-library/react'

import { HemodynamicNativeWorkspace } from '../components/HemodynamicNativeWorkspace'
import { PressureSystemTeachingVisual } from '../components/PressureSystemTeachingVisual'
import { hemodynamicCaseById } from '../content'
import { createInitialHemodynamicState } from '../engine'

jest.mock('../components/BedsideMonitor', () => ({
  BedsideMonitor: () => <section aria-label="Mock bedside monitor">Monitor</section>,
}))
jest.mock('../components/PhysiologyPanel', () => ({
  PhysiologyPanel: () => <section>Physiology</section>,
}))
jest.mock('../components/PacActionDock', () => ({
  PacActionDock: () => <section>Catheter controls</section>,
}))
jest.mock('../components/PacSkillsLab', () => ({
  PacSkillsLab: () => <section>Measurement lab</section>,
}))
jest.mock('../components/FormulaDrawer', () => ({
  FormulaDrawer: () => <section>Derived review</section>,
}))

describe('PressureSystemTeachingVisual', () => {
  it('shows the PA safety warning and switches between distinct PA and arterial families', () => {
    const state = createInitialHemodynamicState(hemodynamicCaseById.get('HD-01')!, 'learn', 42)
    const dispatch = jest.fn()
    render(<PressureSystemTeachingVisual state={state} dispatch={dispatch} />)

    expect(screen.getByRole('radio', { name: /Pulmonary artery catheter/i })).toBeChecked()
    expect(
      screen.getByText(
        /Confirm a pulmonary-artery waveform and a fully deflated balloon.*Never fast-flush a wedged or spontaneously wedged catheter/i,
      ),
    ).toHaveTextContent(
      /Confirm a pulmonary-artery waveform and a fully deflated balloon.*Never fast-flush a wedged or spontaneously wedged catheter/i,
    )

    fireEvent.click(screen.getByRole('button', { name: /Run PA-catheter fast-flush test/i }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'FAST_FLUSH',
      lineType: 'pulmonary-artery',
    })
    expect(
      screen.getByRole('img', {
        name: /Pulmonary artery catheter observed fast-flush release response.*pulsatile baseline.*off-scale flush plateau.*releases between beats/i,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /Systemic arterial line/i }))
    expect(screen.queryByRole('img', { name: /observed fast-flush release response/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Run arterial-line fast-flush test/i }))
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'FAST_FLUSH',
      lineType: 'systemic-arterial',
    })
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
    expect(screen.getByRole('button', { name: /Run PA-catheter fast-flush test/i })).toBeDisabled()
  })

  it('keeps the monitor separate from a keyboard-scrollable learning pane', () => {
    const state = createInitialHemodynamicState(hemodynamicCaseById.get('HD-01')!, 'learn', 99)
    render(<HemodynamicNativeWorkspace state={state} dispatch={jest.fn()} />)

    expect(screen.getByRole('region', { name: 'Mock bedside monitor' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', {
        name: 'Scrollable anatomy, catheter controls, and measurement labs',
      }),
    ).toHaveAttribute('tabindex', '0')
  })
})
