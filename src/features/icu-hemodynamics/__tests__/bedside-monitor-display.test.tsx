import { render, screen, within } from '@testing-library/react'

import { hemodynamicCases } from '../content'
import { BedsideMonitor } from '../components/BedsideMonitor'
import {
  END_EXPIRATION_TOLERANCE_PHASE,
  RIGHT_ATRIAL_C_WAVE_BASE_PHASE,
  createInitialHemodynamicState,
  icuHemodynamicsReducer,
  latestEndExpiratoryCvpCursor,
  recentTracePressureMetrics,
} from '../engine'

function stateAt(position: 'introducer' | 'ra' | 'rv' | 'pa') {
  return icuHemodynamicsReducer(createInitialHemodynamicState(hemodynamicCases[0], 'learn', 510), {
    type: 'SET_CATHETER_POSITION',
    position,
  })
}

describe('BedsideMonitor position-aware display', () => {
  it('starts with no implied chamber trace and withholds unestablished PAC measurements', () => {
    const state = stateAt('introducer')
    render(<BedsideMonitor state={state} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)

    expect(
      screen.getByRole('img', {
        name: /PAC channel unavailable.*tip remains in the introducer/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('CARDIAC INDEX LOW')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      /PAC.*—.*tip in introducer.*no chamber pressure/i,
    )
    expect(screen.getByRole('group', { name: 'PAWP measurement' })).toHaveTextContent(
      /Stored PAWP.*—.*not captured/i,
    )
    expect(screen.getByRole('group', { name: 'Thermodilution cardiac output' })).toHaveTextContent(
      /CO \/ CI.*—.*not established/i,
    )
    expect(screen.getByRole('group', { name: 'Mixed venous oxygen saturation' })).toHaveTextContent(
      /SvO₂.*—.*not available before PA/i,
    )
  })

  it('derives the arterial rail values from the latest displayed pressure cycle', () => {
    const state = stateAt('introducer')
    const metrics = recentTracePressureMetrics(
      state.waveforms,
      'artMmHg',
      state.measurements.heartRateBpm,
    )
    expect(metrics).not.toBeNull()

    render(<BedsideMonitor state={state} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)
    const arterial = screen.getByRole('group', { name: 'Systemic arterial pressure' })
    expect(
      within(arterial).getByText(
        `${Math.round(metrics!.systolic)}/${Math.round(metrics!.diastolic)}`,
      ),
    ).toBeInTheDocument()
    expect(arterial).toHaveTextContent(`trace MAP ${Math.round(metrics!.mean)}`)
  })

  it('labels the rail for the actual PAC chamber and reveals distal values only in PA', () => {
    const ra = stateAt('ra')
    const { rerender } = render(
      <BedsideMonitor state={ra} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />,
    )
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      /PAC · RA.*end-exp c-base/i,
    )
    expect(screen.queryByText('PAP')).not.toBeInTheDocument()

    const pa = stateAt('pa')
    rerender(<BedsideMonitor state={pa} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      /PAP.*mPAP/i,
    )
    expect(screen.getByRole('group', { name: 'Mixed venous oxygen saturation' })).toHaveTextContent(
      new RegExp(`${pa.measurements.svo2Percent}.*distal PA sample`, 'i'),
    )
  })

  it('shows the PA-to-PAWP morphology transition while the balloon is occlusive', () => {
    let state = stateAt('pa')
    state = icuHemodynamicsReducer(state, { type: 'START_WEDGE' })
    state = icuHemodynamicsReducer(state, { type: 'TICK', seconds: 0.2 })

    render(<BedsideMonitor state={state} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)

    expect(
      screen.getByRole('img', {
        name: /PAWP waveform.*marker identifies balloon occlusion → PAWP/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      /PAC · PAWP.*live occlusion mean/i,
    )
    expect(screen.getByRole('group', { name: 'PAWP measurement' })).toHaveTextContent(
      /Stored PAWP.*—.*live trace visible.*not stored/i,
    )
  })

  it('locks CVP and PAC · RA to one end-expiratory c-wave-base sample', () => {
    const state = stateAt('ra')
    const cursor = latestEndExpiratoryCvpCursor(
      state.waveforms,
      state.measurements.heartRateBpm,
      state.parameters.respiratoryRateBpm,
    )
    const arbitraryOneBeatMean = recentTracePressureMetrics(
      state.waveforms,
      'cvpMmHg',
      state.measurements.heartRateBpm,
    )

    expect(cursor).not.toBeNull()
    expect(arbitraryOneBeatMean).not.toBeNull()
    expect(Math.round(cursor!.value)).not.toBe(Math.round(arbitraryOneBeatMean!.mean))
    expect(Math.min(cursor!.respiratoryPhase, 1 - cursor!.respiratoryPhase)).toBeLessThanOrEqual(
      END_EXPIRATION_TOLERANCE_PHASE,
    )
    const cardiacDistance = Math.abs(cursor!.cardiacPhase - RIGHT_ATRIAL_C_WAVE_BASE_PHASE)
    expect(Math.min(cardiacDistance, 1 - cardiacDistance)).toBeLessThan(0.03)

    render(<BedsideMonitor state={state} dispatch={jest.fn()} onOpenCardiacOutput={jest.fn()} />)
    const expected = Math.round(cursor!.value).toString()
    expect(screen.getByRole('group', { name: 'Central venous pressure' })).toHaveTextContent(
      new RegExp(`CVP / RAP.*${expected}.*end-exp c-base`, 'i'),
    )
    expect(screen.getByRole('group', { name: 'Current PAC pressure' })).toHaveTextContent(
      new RegExp(`PAC · RA.*${expected}.*end-exp c-base`, 'i'),
    )
    expect(
      screen.getByRole('img', {
        name: new RegExp(`CVP waveform.*end-exp · c-base ${expected} cursor`, 'i'),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: new RegExp(`ART waveform.*end-exp cursor at ${cursor!.time.toFixed(1)}`, 'i'),
      }),
    ).toBeInTheDocument()
  })
})
