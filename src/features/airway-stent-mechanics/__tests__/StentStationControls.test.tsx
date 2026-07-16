import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { StentStationControls } from '../components/explorer/StentStationControls'
import { createDefaultStentExplorerControlState } from '../explorer/controlState'
import { getStentExplorerStation } from '../explorer/stations'
import type { StentExplorerControlState } from '../explorer/types'

const station = getStentExplorerStation('migration')

function ControlsHarness({ onReset = jest.fn() }: { onReset?: () => void }) {
  const [value, setValue] = useState<StentExplorerControlState>(() =>
    createDefaultStentExplorerControlState(station),
  )

  return (
    <StentStationControls
      architectureId={station.defaultArchitectureId}
      station={station}
      value={value}
      onChange={setValue}
      onReset={onReset}
    />
  )
}

describe('StentStationControls', () => {
  it('renders native labeled inputs with the qualitative evidence boundary', () => {
    render(<ControlsHarness />)

    expect(
      screen.getByRole('group', { name: `Qualitative controls for ${station.title}` }),
    ).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Loss of apposition' })).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Displacement pathway' })).toBeVisible()
    expect(screen.getByRole('checkbox', { name: /Fixed landmark tracking/i })).toBeChecked()
    expect(
      screen.getByText(/do not calculate patient-specific force, airflow, sizing/i),
    ).toBeVisible()
  })

  it('updates qualitative values and resets the station controls', async () => {
    const user = userEvent.setup()
    const onReset = jest.fn()
    render(<ControlsHarness onReset={onReset} />)

    const range = screen.getByRole('slider', { name: 'Loss of apposition' })
    const preset = screen.getByRole('combobox', { name: 'Displacement pathway' })
    const landmarks = screen.getByRole('checkbox', { name: /Fixed landmark tracking/i })
    const reset = screen.getByRole('button', { name: 'Reset controls' })

    expect(range).toHaveValue('0.5')
    expect(preset).toHaveValue('distal')
    expect(reset).toBeDisabled()

    fireEvent.change(range, { target: { value: '0.88' } })
    await user.selectOptions(preset, 'proximal')
    await user.click(landmarks)

    expect(range).toHaveValue('1')
    expect(preset).toHaveValue('proximal')
    expect(landmarks).not.toBeChecked()
    expect(reset).toBeEnabled()

    await user.click(reset)

    expect(range).toHaveValue('0.5')
    expect(preset).toHaveValue('distal')
    expect(landmarks).toBeChecked()
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('limits tumor pathways and cover controls to compatible architectures', () => {
    const tumorStation = getStentExplorerStation('tumor-ingrowth-overgrowth')
    const uncoveredDefaults = createDefaultStentExplorerControlState(
      tumorStation,
      'free-crossing-braid',
    )
    const { rerender } = render(
      <StentStationControls
        architectureId="free-crossing-braid"
        station={tumorStation}
        value={uncoveredDefaults}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByRole('option', { name: 'Through open cells' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Around a covered end' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Cover discontinuity/i })).not.toBeInTheDocument()

    rerender(
      <StentStationControls
        architectureId="laser-cut-covered"
        station={tumorStation}
        value={createDefaultStentExplorerControlState(tumorStation, 'laser-cut-covered')}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByRole('option', { name: 'Around a covered end' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Through a cover defect' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Through open cells' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Cover discontinuity/i })).toBeVisible()
  })
})
