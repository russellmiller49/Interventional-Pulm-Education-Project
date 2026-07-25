import { render, screen, fireEvent } from '@testing-library/react'
import { useReducer } from 'react'

import { hemodynamicCaseById } from '../content'
import { createInitialHemodynamicState, icuHemodynamicsReducer } from '../engine'
import { PacActionDock } from '../components/PacActionDock'

function AdvancementHarness() {
  const definition = hemodynamicCaseById.get('HD-01')!
  const [state, dispatch] = useReducer(icuHemodynamicsReducer, undefined, () =>
    icuHemodynamicsReducer(createInitialHemodynamicState(definition, 'learn', 71), {
      type: 'SET_CATHETER_POSITION',
      position: 'introducer',
    }),
  )
  return <PacActionDock state={state} dispatch={dispatch} focus="advancement" />
}

function WedgeHarness() {
  const definition = hemodynamicCaseById.get('HD-01')!
  const [state, dispatch] = useReducer(icuHemodynamicsReducer, undefined, () =>
    icuHemodynamicsReducer(createInitialHemodynamicState(definition, 'learn', 72), {
      type: 'SET_CATHETER_POSITION',
      position: 'pa',
    }),
  )
  return <PacActionDock state={state} dispatch={dispatch} focus="wedge" />
}

describe('PAC action dock advancement semantics', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn().mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    })
  })

  it('requires actual movement and confirmation of each waveform before completion', () => {
    render(<AdvancementHarness />)

    const advance = screen.getByRole('button', { name: 'Advance' })
    fireEvent.click(advance)
    expect(screen.getByText(/Tip: RA/)).toBeInTheDocument()
    expect(advance).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm RA waveform' }))
    expect(screen.getByRole('button', { name: 'RA waveform confirmed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(advance).toBeEnabled()

    fireEvent.click(advance)
    expect(screen.getByText(/Tip: RV/)).toBeInTheDocument()
    expect(advance).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm RV waveform' }))
    fireEvent.click(advance)
    expect(screen.getByText(/Tip: PA/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm PA waveform' }))
    expect(screen.getByRole('button', { name: 'PA waveform confirmed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('keeps the normal wedge tracing available beside both false-wedge patterns', () => {
    render(<WedgeHarness />)

    expect(
      screen.getByRole('heading', { name: 'True wedge versus false wedge' }),
    ).toBeInTheDocument()
    const normalWedge = screen.getByRole('tab', { name: 'Normal wedge' })
    expect(normalWedge).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Hybrid' }))
    expect(screen.getByText(/mixture of pulmonary artery and wedge waveforms/i)).toBeInTheDocument()

    fireEvent.click(normalWedge)
    expect(normalWedge).toHaveAttribute('aria-selected', 'true')
  })
})
