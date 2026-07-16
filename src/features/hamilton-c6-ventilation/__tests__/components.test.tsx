import { act, fireEvent, render, screen, within } from '@testing-library/react'

import { mechanicalVentilationCaseById } from '../content'
import { createInitialSimulationState } from '../engine'
import { HamiltonC6Console } from '../components/HamiltonC6Console'
import HamiltonC6VentilationLab from '../components/HamiltonC6VentilationLab'

describe('HAMILTON-C6 learner interface', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true }),
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders accessible waveform summaries, textual values, alarm severity, and C6 navigation', () => {
    const state = createInitialSimulationState('MV-14', 'learn')
    const dispatch = jest.fn()
    render(<HamiltonC6Console state={state} dispatch={dispatch} controlsEnabled />)

    expect(screen.getByRole('img', { name: /Paw waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Flow waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Volume waveform/i })).toBeInTheDocument()
    expect(screen.getByText(/Waveform text: Paw/i)).toBeInTheDocument()
    const alarmStatus = screen.getByRole('status')
    expect(within(alarmStatus).getByText('HIGH')).toBeInTheDocument()
    expect(
      within(alarmStatus).getByText(/High pressure|Patient blood pressure low|SpO₂ low/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Controls' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alarms' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Graphics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tools' })).toBeInTheDocument()
  })

  it('supports keyboard adjustment through the selected press-and-turn control', () => {
    render(<HamiltonC6VentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Controls' }))
    const peep = screen.getByRole('button', { name: /PEEP\/CPAP, 5 cmH₂O/i })
    fireEvent.keyDown(peep, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: /PEEP\/CPAP, 6 cmH₂O/i })).toBeInTheDocument()
  })

  it('keeps case guidance and a compact live patient/vent surface in the active workspace', () => {
    render(<HamiltonC6VentilationLab />)

    expect(
      screen.getByRole('region', { name: 'Case guidance and interventions' }),
    ).toBeInTheDocument()
    const liveWorkspace = screen.getByRole('region', {
      name: 'Persistent ventilator and patient physiology',
    })
    expect(
      within(liveWorkspace).getByRole('complementary', { name: 'Live patient status' }),
    ).toBeInTheDocument()
    expect(within(liveWorkspace).getByLabelText('Current comfort and sedation')).toBeInTheDocument()
    expect(
      within(liveWorkspace).getByRole('region', { name: /C6 functional training facsimile/i }),
    ).toBeInTheDocument()

    const surfacePicker = screen.getByRole('group', { name: 'Choose case workspace surface' })
    const caseButton = within(surfacePicker).getByRole('button', { name: 'Case guidance' })
    const ventButton = within(surfacePicker).getByRole('button', { name: 'Vent + patient' })
    expect(caseButton).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(ventButton)
    expect(ventButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches modes only after explicit confirmation', () => {
    render(<HamiltonC6VentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Modes' }))
    fireEvent.click(screen.getByRole('button', { name: /SPONT Spontaneous pressure support/i }))
    expect(screen.getByText(/Adult\/Ped · \(S\)CMV/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm SPONT' }))
    expect(screen.getByText(/Adult\/Ped · SPONT/i)).toBeInTheDocument()
  })

  it('requires commit-before-action in Practice and hides guided answer labels', () => {
    const definition = mechanicalVentilationCaseById.get('MV-01')!
    render(<HamiltonC6VentilationLab />)
    fireEvent.click(screen.getByRole('tab', { name: /Practice/i }))

    expect(screen.queryByText(/^Mechanism:$/i)).not.toBeInTheDocument()
    expect(
      screen.getByText(/Ventilator controls and bedside intervention cards unlock/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Assess the patient at the bedside/i }),
    ).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Suspected mechanism'), {
      target: { value: definition.correctMechanismId },
    })
    fireEvent.change(screen.getByLabelText('Immediate safety priority'), {
      target: { value: definition.correctPriorityId },
    })
    fireEvent.change(screen.getByLabelText('Expected physiologic response'), {
      target: { value: definition.correctResponseId },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))

    expect(screen.getByText(/Prediction locked/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Assess the patient at the bedside/i })).toBeEnabled()
  })

  it('keeps non-English routes on an explicit reviewed-English fallback', () => {
    render(<HamiltonC6VentilationLab locale="es" />)
    expect(screen.getByText(/Reviewed-English fallback/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /HAMILTON-C6 ventilation Learn & Practice simulator/i }),
    ).toBeInTheDocument()
  })

  it('sends only the aggregate analytics contract when the pathway changes', async () => {
    render(<HamiltonC6VentilationLab />)
    fireEvent.click(screen.getByRole('tab', { name: /Practice/i }))
    await act(async () => Promise.resolve())
    const fetchMock = global.fetch as jest.Mock
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string)
    expect(body.moduleId).toBe('hamilton-c6-ventilation')
    expect(body.eventPayload).toEqual({
      caseId: 'MV-01',
      station: 'lung-protection-demand',
      pathway: 'practice',
      completion: false,
      score: null,
      errorCount: 0,
    })
    expect(JSON.stringify(body)).not.toMatch(/waveform|physiology|patientDescription|freeText/i)
  })

  it('exposes holds, O₂ enrichment, manual breath, freeze, audio pause, and screen lock in Tools', () => {
    render(<HamiltonC6VentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
    const consoleRegion = screen.getByRole('region', { name: /C6 functional training facsimile/i })
    expect(within(consoleRegion).getByRole('button', { name: /Inspiratory hold/i })).toBeEnabled()
    expect(within(consoleRegion).getByRole('button', { name: /Expiratory hold/i })).toBeEnabled()
    expect(
      within(consoleRegion).getAllByRole('button', { name: /Manual breath/i }).length,
    ).toBeGreaterThan(0)
    expect(
      within(consoleRegion).getAllByRole('button', { name: /O₂ enrichment/i }).length,
    ).toBeGreaterThan(0)
    expect(within(consoleRegion).getByRole('button', { name: /Freeze waveforms/i })).toBeEnabled()
    expect(within(consoleRegion).getByRole('button', { name: /Alarm audio off/i })).toBeEnabled()
    expect(within(consoleRegion).getByRole('button', { name: 'Lock' })).toBeEnabled()
  })
})
