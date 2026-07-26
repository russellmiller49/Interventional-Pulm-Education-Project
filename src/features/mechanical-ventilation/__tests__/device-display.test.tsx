import { render, screen, within } from '@testing-library/react'

import {
  canonicalToNativeControlValue,
  createDefaultMechanicalVentilationSettings,
  formatMonitorField,
  getVentilatorDeviceProfile,
  nativeToCanonicalControlValue,
  resolveBreathPhase,
  ventilatorDeviceProfiles,
} from '../content'
import { createInitialSimulationState, ventilatorDeviceIds } from '../engine'
import type { VentilatorDeviceId, VentilationSimulationState } from '../engine'
import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'

function renderConsole(deviceId: VentilatorDeviceId, caseId = 'MV-01') {
  const state = createInitialSimulationState(caseId, 'learn', 1, deviceId)
  render(<MechanicalVentilatorConsole state={state} dispatch={jest.fn()} controlsEnabled />)
  return state
}

describe('device-specific console displays', () => {
  it('gives every device a complete display profile', () => {
    expect(ventilatorDeviceProfiles.map((profile) => profile.id)).toEqual(ventilatorDeviceIds)
    for (const profile of ventilatorDeviceProfiles) {
      const display = profile.display
      expect(display.monitorFields.length).toBeGreaterThanOrEqual(5)
      expect(new Set(display.monitorFields.map((field) => field.metric)).size).toBe(
        display.monitorFields.length,
      )
      expect(display.waveforms.map((channel) => channel.field)).toEqual([
        'pawCmH2O',
        'flowLMin',
        'volumeMl',
      ])
      for (const channel of display.waveforms) {
        expect(channel.minimum).toBeLessThan(channel.maximum)
        expect(channel.label).not.toHaveLength(0)
      }
      expect(display.bezelKeys.length).toBeGreaterThan(0)
      expect(display.knobPosition).toBeGreaterThanOrEqual(0)
      expect(display.knobPosition).toBeLessThanOrEqual(display.bezelKeys.length)
      expect(display.displayNote.length).toBeGreaterThan(40)
      expect(Object.values(display.pressureLabels).every((label) => label.length > 0)).toBe(true)
    }
  })

  /**
   * The defect this work exists to fix: every device rendered a HAMILTON-C6 monitoring screen with
   * a different title bar. No two devices may now agree on both parameter set and vocabulary.
   */
  it('never repeats one device’s monitored-parameter panel on another', () => {
    const signatures = ventilatorDeviceProfiles.map((profile) =>
      profile.display.monitorFields.map((field) => `${field.label}/${field.unit}`).join('|'),
    )
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('prints Evita monitoring values in the pocket-guide order and in mbar', () => {
    const profile = getVentilatorDeviceProfile('drager-evita-v800-v600')
    expect(profile.display.monitorFields.map((field) => field.label)).toEqual([
      'FiO2',
      'PIP',
      'PEEP',
      'MVe',
      'RR',
      'VTe',
    ])
    expect(profile.display.pressureUnit).toBe('mbar')

    renderConsole('drager-evita-v800-v600')
    const monitor = screen.getByRole('complementary', { name: 'Monitoring area' })
    expect(within(monitor).getByText('MVe')).toBeInTheDocument()
    expect(within(monitor).getAllByText('mbar').length).toBe(2)
    expect(screen.queryByText('fTotal')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Paw waveform/i })).toBeInTheDocument()
    expect(screen.getByText(/Waveform text: Paw .* mbar/)).toBeInTheDocument()
  })

  it('opens the PB980 patient-data banner with its breath-phase indicator', () => {
    renderConsole('puritan-bennett-980')
    const banner = screen.getByLabelText('Patient data banner')
    expect(within(banner).getByLabelText(/Breath phase/)).toBeInTheDocument()
    for (const label of ['fTOT', 'V̇E TOT', 'VTE', 'PEEP', 'I:E', 'PPEAK', 'PMEAN']) {
      expect(within(banner).getByText(label)).toBeInTheDocument()
    }
    // The banner replaces the side column rather than sitting next to it.
    expect(screen.queryByRole('complementary', { name: /monitoring parameters/i })).toBeNull()
  })

  it('straddles the PB980 rotary encoder with its documented bezel keys', () => {
    renderConsole('puritan-bennett-980')
    const bezel = screen.getByLabelText('PB980 bezel keys')
    const labels = Array.from(bezel.children).map(
      (child) => child.getAttribute('aria-label') ?? child.textContent?.trim(),
    )
    expect(labels).toEqual([
      'Display lock',
      'Manual inspiration',
      'Press-and-turn control',
      'Inspiratory pause',
      'Expiratory pause',
      'Alarm reset',
      'Alarm silence',
      'Elevate O₂',
    ])
  })

  it('uses the AVEA axis legends and documented waveform scales', () => {
    const display = getVentilatorDeviceProfile('carefusion-avea').display
    expect(
      display.waveforms.map((channel) => [channel.label, channel.minimum, channel.maximum]),
    ).toEqual([
      ['Paw', -40, 80],
      ['Flow', -80, 80],
      ['Vt', -500, 1500],
    ])

    renderConsole('carefusion-avea')
    expect(screen.getByRole('img', { name: /Vt waveform/i })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Volume waveform/i })).toBeNull()
    const monitor = screen.getByRole('complementary', { name: 'Patient data' })
    expect(within(monitor).getByText('Vte')).toBeInTheDocument()
    expect(within(monitor).getByText('BPM')).toBeInTheDocument()
  })

  it('runs the C6 MMP column down the left with an SpO2 strip beneath it', () => {
    const display = getVentilatorDeviceProfile('hamilton-c6').display
    expect(display.monitorLayout).toBe('left-column')
    expect(display.monitorFields.map((field) => `${field.label} ${field.unit}`)).toEqual([
      'Ppeak cmH2O',
      'ExpMinVol l/min',
      'VTE ml',
      'fTotal b/min',
      'I:E ',
    ])

    renderConsole('hamilton-c6')
    const monitor = screen.getByRole('complementary', { name: 'Main monitoring parameters' })
    expect(within(monitor).getByText('ExpMinVol')).toBeInTheDocument()
    expect(within(monitor).getByText('SpO2')).toBeInTheDocument()
    expect(within(monitor).queryByText('MinVol')).toBeNull()
    expect(screen.getByRole('img', { name: /Volume waveform/i })).toBeInTheDocument()
  })

  it('groups the C6 controls by the purposes its mode figures print', () => {
    const initial = createInitialSimulationState('MV-01', 'learn', 1, 'hamilton-c6')
    render(
      <MechanicalVentilatorConsole
        state={{ ...initial, ventilator: { ...initial.ventilator, screen: 'controls' } }}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    const headings = screen
      .getAllByRole('heading', { level: 4 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual([
      'CO2 elimination',
      'Oxygenation',
      'Patient synchronization',
      'Patient, TRC, and apnea',
    ])
    // (S)CMV, Figure 7-2: Vt and Rate lead CO2 elimination; PEEP leads Oxygenation.
    const tiles = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes('Select for press-and-turn'))
    expect(tiles[0]).toMatch(/^Vt,/)
    expect(tiles[1]).toMatch(/^Rate,/)
    expect(tiles.find((label) => label.startsWith('PEEP/CPAP,'))).toBeTruthy()
  })

  it('gives the C6 its documented per-trace waveform colors', () => {
    const display = getVentilatorDeviceProfile('hamilton-c6').display
    const colors = display.waveforms.map((channel) => channel.color)
    expect(new Set(colors).size).toBe(3)
    expect(colors.every(Boolean)).toBe(true)
    // No other device documents trace colors, so they draw every trace alike.
    for (const deviceId of ventilatorDeviceIds.filter((id) => id !== 'hamilton-c6')) {
      const other = getVentilatorDeviceProfile(deviceId).display
      expect(other.waveforms.every((channel) => channel.color === undefined)).toBe(true)
    }
  })

  it('orders the Evita therapy bar and the AVEA primary controls as each vendor prints them', () => {
    const evita = getVentilatorDeviceProfile('drager-evita-v800-v600').display.controlOrder
    expect(evita.slice(0, 6)).toEqual([
      'oxygenPercent',
      'vtMl',
      'targetVtMl',
      'deltaPControlCmH2O',
      'pHighCmH2O',
      'pLowCmH2O',
    ])

    const initial = createInitialSimulationState('MV-01', 'learn', 1, 'drager-evita-v800-v600')
    const { unmount } = render(
      <MechanicalVentilatorConsole
        state={{ ...initial, ventilator: { ...initial.ventilator, screen: 'controls' } }}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    const evitaTiles = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes('Select for press-and-turn'))
    // Pocket guide main screen: FiO2 · VT · Ti · RR · PEEP · ... · Flow.
    expect(evitaTiles[0]).toMatch(/^FiO₂,/)
    expect(evitaTiles[1]).toMatch(/^VT,/)
    expect(evitaTiles.findIndex((label) => label.startsWith('RR,'))).toBeLessThan(
      evitaTiles.findIndex((label) => label.startsWith('PEEP,')),
    )
    unmount()

    const avea = createInitialSimulationState('MV-01', 'learn', 1, 'carefusion-avea')
    render(
      <MechanicalVentilatorConsole
        state={{ ...avea, ventilator: { ...avea.ventilator, screen: 'controls' } }}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    const aveaTiles = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label') ?? '')
      .filter((label) => label.includes('Select for press-and-turn'))
    // Modes guide pp. 43-46: Rate leads the primary-control rows, Volume follows.
    expect(aveaTiles[0]).toMatch(/^Rate,/)
    expect(aveaTiles[1]).toMatch(/^Volume,/)
  })

  it('labels the pressure trace readouts with each vendor’s abbreviations', () => {
    const { unmount } = render(
      <MechanicalVentilatorConsole
        state={createInitialSimulationState('MV-01', 'learn', 1, 'drager-evita-v800-v600')}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    // Once in the monitoring column, once as the Paw trace readout.
    expect(screen.getAllByText('PIP')).toHaveLength(2)
    unmount()

    render(
      <MechanicalVentilatorConsole
        state={createInitialSimulationState('MV-01', 'learn', 1, 'puritan-bennett-980')}
        dispatch={jest.fn()}
        controlsEnabled
      />,
    )
    expect(screen.getAllByText('PPEAK').length).toBeGreaterThan(0)
    expect(screen.getByText('PPL')).toBeInTheDocument()
  })

  it('reads the breath-phase indicator as Control, Assist, or Spontaneous', () => {
    const base = createInitialSimulationState('MV-01', 'learn', 1, 'puritan-bennett-980')
    const settings = base.ventilator.settings
    expect(settings.mode).toBe('volume-ac')
    if (settings.mode !== 'volume-ac') return

    const atSetRate: VentilationSimulationState = {
      ...base,
      waveforms: base.waveforms.map((sample) => ({ ...sample, spontaneous: false })),
      measurements: { ...base.measurements, totalRatePerMin: settings.ratePerMin },
    }
    expect(resolveBreathPhase(atSetRate)).toEqual({ code: 'C', label: 'Control' })

    expect(
      resolveBreathPhase({
        ...atSetRate,
        measurements: { ...atSetRate.measurements, totalRatePerMin: settings.ratePerMin + 6 },
      }),
    ).toEqual({ code: 'A', label: 'Assist' })

    expect(
      resolveBreathPhase({
        ...atSetRate,
        waveforms: atSetRate.waveforms.map((sample) => ({ ...sample, spontaneous: true })),
      }),
    ).toEqual({ code: 'S', label: 'Spontaneous' })
  })

  it('formats an I:E field as a ratio and everything else at its declared precision', () => {
    const state = createInitialSimulationState('MV-01', 'learn', 1, 'drager-evita-v800-v600')
    expect(formatMonitorField(state, { metric: 'ieRatio', label: 'I:E', unit: '' })).toMatch(
      /^1:\d+\.\d$/,
    )
    expect(
      formatMonitorField(state, {
        metric: 'minuteVolume',
        label: 'MVe',
        unit: 'L/min',
        precision: 2,
      }),
    ).toMatch(/^\d+\.\d\d$/)
  })

  /**
   * The Evita, PB980, and AVEA all set the inspiratory pause as a duration. Only the C6 keeps the
   * engine's percentage of flow-delivery time.
   */
  it('shows the inspiratory pause in the unit each device sets it in', () => {
    const volume = { ...createDefaultMechanicalVentilationSettings('volume-ac'), pausePercent: 20 }
    expect(volume.mode).toBe('volume-ac')
    if (volume.mode !== 'volume-ac') return

    expect(canonicalToNativeControlValue('hamilton-c6', volume, 'pausePercent', 20)).toBe(20)

    for (const deviceId of [
      'drager-evita-v800-v600',
      'puritan-bennett-980',
      'carefusion-avea',
    ] as const) {
      const seconds = canonicalToNativeControlValue(deviceId, volume, 'pausePercent', 20)
      expect(seconds).toBeGreaterThan(0)
      expect(seconds).toBeLessThan(2)
      // Round-tripping through a 0.01 s display resolution costs about a percentage point.
      const roundTripped = nativeToCanonicalControlValue(deviceId, volume, 'pausePercent', seconds)
      expect(Math.abs(roundTripped - 20)).toBeLessThanOrEqual(2)
      expect(getVentilatorDeviceProfile(deviceId).controlLabels.pausePercent).toBeTruthy()
    }
  })

  it('keeps the screen lock reachable on devices whose bezel has no lock key', () => {
    for (const deviceId of ventilatorDeviceIds) {
      const initial = createInitialSimulationState('MV-01', 'learn', 1, deviceId)
      const { unmount } = render(
        <MechanicalVentilatorConsole
          state={{ ...initial, ventilator: { ...initial.ventilator, screen: 'tools' } }}
          dispatch={jest.fn()}
          controlsEnabled
        />,
      )
      expect(screen.getAllByRole('button', { name: /lock/i }).length).toBeGreaterThan(0)
      unmount()
    }
  })
})
