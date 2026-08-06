import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { mechanicalVentilationCaseById } from '../content'
import { createInitialSimulationState } from '../engine'
import { MechanicalVentilatorConsole } from '../components/MechanicalVentilatorConsole'
import MechanicalVentilationLab from '../components/MechanicalVentilationLab'

describe('multi-device mechanical ventilation learner interface', () => {
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
    render(<MechanicalVentilatorConsole state={state} dispatch={dispatch} controlsEnabled />)

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
    render(<MechanicalVentilationLab />)
    expect(screen.getByText('Unlisted tester preview')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Controls' }))
    const peep = screen.getByRole('button', { name: /PEEP\/CPAP, 5 cmH₂O/i })
    fireEvent.keyDown(peep, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: /PEEP\/CPAP, 6 cmH₂O/i })).toBeInTheDocument()
  })

  it('keeps case guidance and a compact live patient/vent surface in the active workspace', () => {
    render(<MechanicalVentilationLab />)

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
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Modes' }))
    fireEvent.click(screen.getByRole('button', { name: /SPONT Spontaneous breathing with CPAP/i }))
    expect(screen.getByText(/Adult\/Ped · \(S\)CMV/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm SPONT' }))
    expect(screen.getByText(/Adult\/Ped · SPONT/i)).toBeInTheDocument()
  })

  it('selects an advanced native mode and reveals its dedicated controls and features', () => {
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Modes' }))
    fireEvent.click(screen.getByRole('button', { name: /^ASV Adaptive support targeting/i }))
    expect(screen.getByText(/Adult\/Ped · \(S\)CMV/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm ASV' }))
    expect(screen.getByText(/Adult\/Ped · ASV/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Controls' }))
    expect(screen.getByRole('button', { name: /%MinVol, 100 %/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /IntelliSync\+/i })).toBeEnabled()
  })

  it('shows neonatal-only AVEA modes and Volume Guarantee without allowing activation', () => {
    const initial = createInitialSimulationState('MV-01', 'learn', 1, 'carefusion-avea')
    const modesState = {
      ...initial,
      ventilator: { ...initial.ventilator, screen: 'modes' as const },
    }
    const dispatch = jest.fn()
    const { rerender } = render(
      <MechanicalVentilatorConsole state={modesState} dispatch={dispatch} controlsEnabled />,
    )

    expect(screen.getByRole('button', { name: /TCPL A\/C/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /TCPL SIMV/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /PRVC A\/C/i })).toBeEnabled()
    expect(screen.getAllByText(/current 15-case adult pathway/i).length).toBeGreaterThan(0)

    const pressureInitial = createInitialSimulationState('MV-04', 'learn', 1, 'carefusion-avea')
    rerender(
      <MechanicalVentilatorConsole
        state={{
          ...pressureInitial,
          ventilator: { ...pressureInitial.ventilator, screen: 'controls' as const },
        }}
        dispatch={dispatch}
        controlsEnabled
      />,
    )
    expect(screen.getByRole('checkbox', { name: /Volume Guarantee/i })).toBeDisabled()
    expect(screen.getByText(/neonatal test-lung pathway is required/i)).toBeInTheDocument()
  })

  it('keeps Practice actions open while hiding guided answer labels', () => {
    const definition = mechanicalVentilationCaseById.get('MV-01')!
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('tab', { name: /Practice/i }))

    expect(screen.queryByText(/^Mechanism:$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/unlock after commitment/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Assess the patient at the bedside/i })).toBeEnabled()

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

    expect(screen.getAllByText(/Initial frame recorded/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Assess the patient at the bedside/i })).toBeEnabled()
  })

  it('keeps non-English routes on an explicit reviewed-English fallback', () => {
    render(<MechanicalVentilationLab locale="es" />)
    expect(screen.getByText('Reviewed-English fallback:')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /Mechanical ventilation Learn & Practice simulator/i }),
    ).toBeInTheDocument()
  })

  it('sends only the aggregate analytics contract when the pathway changes', async () => {
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('tab', { name: /Practice/i }))
    await act(async () => Promise.resolve())
    const fetchMock = global.fetch as jest.Mock
    expect(fetchMock).toHaveBeenCalled()
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string)
    expect(body.moduleId).toBe('mechanical-ventilation')
    expect(body.eventPayload).toEqual({
      caseId: 'MV-01',
      deviceId: 'hamilton-c6',
      station: 'lung-protection-demand',
      pathway: 'practice',
      completion: false,
      score: null,
      errorCount: 0,
    })
    expect(JSON.stringify(body)).not.toMatch(/waveform|physiology|patientDescription|freeText/i)
  })

  it('supports keyboard device selection, confirmation, and a clean same-case reload', async () => {
    const user = userEvent.setup()
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Controls' }))
    fireEvent.keyDown(screen.getByRole('button', { name: /PEEP\/CPAP, 5 cmH₂O/i }), {
      key: 'ArrowUp',
    })
    expect(screen.getByRole('button', { name: /PEEP\/CPAP, 6 cmH₂O/i })).toBeInTheDocument()

    const evitaChoice = screen.getByRole('radio', { name: /Dräger Evita V800 \/ V600/i })
    evitaChoice.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('alertdialog', { name: /Switch to Dräger Evita/i })
    expect(within(dialog).getByText(/restart at time zero/i)).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: /HAMILTON-C6 functional training facsimile/i }),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Switch and reset case' }))
    expect(evitaChoice).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('region', {
        name: /Dräger Evita V800 \/ V600 functional training facsimile/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/VC-AC/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Therapy bar' }))
    expect(screen.getByRole('button', { name: /PEEP, 5 mbar/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Evita V800 / V600 Instructions for Use' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/8c4c65aadd7267d181c694947b9602278f511746af25001ceb220f3be09e8151/),
    ).toBeInTheDocument()
    expect(screen.getByText('Personal history stays local')).toBeInTheDocument()

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls.at(-1)![1].body as string)
    expect(body.eventPayload).toEqual({
      interaction: 'device_changed',
      fromDeviceId: 'hamilton-c6',
      deviceId: 'drager-evita-v800-v600',
      caseId: 'MV-01',
      pathway: 'learn',
    })
  })

  it('keeps Evita numeric and discrete settings pending until knob confirmation', () => {
    const initial = createInitialSimulationState('MV-01', 'learn', 1, 'drager-evita-v800-v600')
    const state = {
      ...initial,
      ventilator: { ...initial.ventilator, screen: 'controls' as const },
    }
    const dispatch = jest.fn()
    render(<MechanicalVentilatorConsole state={state} dispatch={dispatch} controlsEnabled />)

    fireEvent.keyDown(screen.getByRole('button', { name: /PEEP, 5 mbar/i }), { key: 'ArrowUp' })
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByText('Pending PEEP')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Press knob to confirm' }))
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: 6,
    })

    fireEvent.change(screen.getByLabelText('Trigger type'), { target: { value: 'pressure' } })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Pending Trigger type')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Press knob to confirm' }))
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_CONTROL',
      control: 'triggerType',
      value: 'pressure',
    })
  })

  it('keeps Evita AutoFlow pending until rotary confirmation', () => {
    const initial = createInitialSimulationState('MV-01', 'learn', 1, 'drager-evita-v800-v600')
    const state = {
      ...initial,
      ventilator: { ...initial.ventilator, screen: 'controls' as const },
    }
    const dispatch = jest.fn()
    render(<MechanicalVentilatorConsole state={state} dispatch={dispatch} controlsEnabled />)

    fireEvent.click(screen.getByRole('checkbox', { name: /AutoFlow/i }))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByText('Pending AutoFlow')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Press knob to confirm' }))
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_CONTROL',
      control: 'autoFlowEnabled',
      value: true,
    })
  })

  it('supports AVEA Touch-Turn-Touch, Accept, and Cancel without premature dispatch', () => {
    const initial = createInitialSimulationState('MV-01', 'learn', 1, 'carefusion-avea')
    const state = {
      ...initial,
      ventilator: { ...initial.ventilator, screen: 'controls' as const },
    }
    const dispatch = jest.fn()
    render(<MechanicalVentilatorConsole state={state} dispatch={dispatch} controlsEnabled />)

    const originalPeep = screen.getByRole('button', { name: /PEEP, 5 cmH₂O/i })
    fireEvent.keyDown(originalPeep, { key: 'ArrowUp' })
    expect(dispatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(dispatch).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /PEEP, 5 cmH₂O/i })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('button', { name: /PEEP, 5 cmH₂O/i }), { key: 'ArrowUp' })
    fireEvent.click(screen.getByRole('button', { name: /PEEP, 6 cmH₂O/i }))
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'SET_CONTROL',
      control: 'peepCmH2O',
      value: 6,
    })

    fireEvent.keyDown(screen.getByRole('button', { name: /PEEP, 5 cmH₂O/i }), { key: 'ArrowUp' })
    fireEvent.click(screen.getByRole('button', { name: 'ACCEPT' }))
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('exposes holds, O₂ enrichment, manual breath, freeze, audio pause, and screen lock in Tools', () => {
    render(<MechanicalVentilationLab />)
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
    expect(within(consoleRegion).getByRole('button', { name: 'Screen lock' })).toBeEnabled()
  })

  /**
   * A hold used to be performed on a screen that had replaced the waveform, so the occlusion and
   * the plateau drew while the learner was looking at a menu.
   */
  it('keeps the pressure and flow traces on the Tools screen so a hold can be watched', () => {
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }))

    expect(screen.getByRole('img', { name: /Paw waveform/i })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Flow waveform/i })).toBeInTheDocument()
    // Volume adds nothing to a hold and stays on the monitoring screen.
    expect(screen.queryByRole('img', { name: /Volume waveform/i })).not.toBeInTheDocument()
  })

  it('names the occlusion and what the held pressure means while a hold runs', () => {
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
    const consoleRegion = screen.getByRole('region', { name: /C6 functional training facsimile/i })
    expect(within(consoleRegion).getByText(/No maneuver running/i)).toBeInTheDocument()

    fireEvent.click(within(consoleRegion).getByRole('button', { name: /Inspiratory hold/i }))

    expect(within(consoleRegion).getByText(/Occluding at end-inspiration/i)).toBeInTheDocument()
    expect(within(consoleRegion).getByText(/flow is zero/i)).toBeInTheDocument()
    // Still on Tools, still showing the trace the plateau is drawn on.
    expect(within(consoleRegion).getByRole('img', { name: /Paw waveform/i })).toBeInTheDocument()
    expect(
      within(consoleRegion).getByRole('button', { name: /Expiratory hold/i }),
    ).toBeInTheDocument()
  })

  /**
   * The device prints the plateau either way; the learner is the one who has to know it is not
   * usable while the patient is still pulling.
   */
  it('marks the plateau readout unreliable and says why in the text alternative', () => {
    const state = createInitialSimulationState('MV-01', 'learn')
    const active = {
      ...state,
      measurements: {
        ...state.measurements,
        plateauIsInterpretable: false,
        endInspiratoryEffortCmH2O: 8,
      },
    }
    render(<MechanicalVentilatorConsole state={active} dispatch={jest.fn()} controlsEnabled />)
    expect(screen.getByText(/Pplateau .* not interpretable: patient effort 8/)).toBeInTheDocument()
  })

  it('leaves the plateau unmarked once the patient is passive', () => {
    const state = createInitialSimulationState('MV-01', 'learn')
    /*
     * Passivity has to be taken out of the trace, not only out of the derived flag: the console
     * asks whether the patient has been quiet across the recent waveform buffer, because the
     * engine's instantaneous flag flips several times inside a single occlusion.
     */
    const passive = {
      ...state,
      waveforms: state.waveforms.map((sample) => ({ ...sample, pmusCmH2O: 0 })),
      measurements: {
        ...state.measurements,
        plateauIsInterpretable: true,
        endInspiratoryEffortCmH2O: 0,
      },
    }
    render(<MechanicalVentilatorConsole state={passive} dispatch={jest.fn()} controlsEnabled />)
    expect(screen.queryByText(/not interpretable/)).not.toBeInTheDocument()
  })

  /**
   * The defect this replaced: the trace annotation called the plateau "elastic load only" and the
   * readout beside it, in the same render, said the plateau was not interpretable. Every case that
   * teaches the split has a patient who is pulling, so this was the normal state of the lesson.
   */
  it('does not call the plateau an elastic load while the patient is pulling', () => {
    render(<MechanicalVentilationLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
    const consoleRegion = screen.getByRole('region', { name: /C6 functional training facsimile/i })
    fireEvent.click(within(consoleRegion).getByRole('button', { name: /Inspiratory hold/i }))

    expect(within(consoleRegion).queryByText(/elastic load only/i)).not.toBeInTheDocument()
    expect(
      within(consoleRegion).getAllByText(/depressed by the patient’s own effort/i).length,
    ).toBeGreaterThan(0)
  })

  it('labels the pressure components once the patient is passive', () => {
    const state = createInitialSimulationState('MV-01', 'learn')
    const passive = {
      ...state,
      paused: true,
      waveforms: state.waveforms.map((sample) => ({ ...sample, pmusCmH2O: 0 })),
      measurements: {
        ...state.measurements,
        plateauIsInterpretable: true,
        endInspiratoryEffortCmH2O: 0,
      },
    }
    render(<MechanicalVentilatorConsole state={passive} dispatch={jest.fn()} controlsEnabled />)
    expect(screen.getAllByText(/Pplateau .* elastic load only/i).length).toBeGreaterThan(0)
  })
})
