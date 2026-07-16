import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cardiohelpScenarios } from '../content/scenarios'
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import {
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
} from '../engine'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import CardiohelpEcmoLab from '../components/CardiohelpEcmoLab'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { LearningWorkflow } from '../components/LearningWorkflow'

describe('CARDIOHELP ECMO learner interface', () => {
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

  it('provides text alarm severity, screen navigation, audio state, and rotary keyboard control', () => {
    let state = createInitialSimulationState('arterial-bubble-stop')
    state = ecmoSimulationReducer(state, { type: 'INJECT_FAULT', fault: 'arterial-bubble' })
    state = ecmoSimulationReducer(state, { type: 'STEP' })
    const dispatch = jest.fn()
    render(<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />)

    expect(screen.getByText(/HIGH: Arterial bubble - pump stopped/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Parameter list' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Optional alarm audio off/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Parameter list' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', screen: 'parameters' })

    fireEvent.keyDown(screen.getByRole('slider', { name: /RPM rotary setpoint/i }), {
      key: 'ArrowUp',
    })
    expect(dispatch).toHaveBeenCalledWith({ type: 'ROTARY_DELTA', delta: 1 })
  })

  it('defaults to an accessible Learn pathway and switches to a clean Practice attempt', () => {
    render(<CardiohelpEcmoLab />)

    const learnTab = screen.getByRole('tab', { name: /Learn.*one step at a time/i })
    const practiceTab = screen.getByRole('tab', {
      name: /Practice.*Start ECMO when indicated/i,
    })
    expect(learnTab).toHaveAttribute('aria-selected', 'true')
    expect(practiceTab).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('heading', { name: /Guided lessons/i })).toBeInTheDocument()
    expect(screen.getByText(/Learn focus: circuit and sensors/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    expect(window.localStorage.getItem('cardiohelp-ecmo-progress-v1')).toBeNull()

    fireEvent.click(practiceTab)
    expect(practiceTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('heading', { name: /Guided lessons/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit before action' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Untimed practice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Timed challenge' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /48-year-old with refractory hypoxemic and hypercapnic respiratory failure/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()
  })

  it('runs the VV initiation case from committed plan through readiness, settings, and support', () => {
    render(<CardiohelpEcmoLab />)
    fireEvent.click(screen.getByRole('tab', { name: /VV Practice/i }))
    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'initiate-vv-support' },
    })
    fireEvent.change(screen.getByLabelText('First priority'), {
      target: { value: 'initiate-support' },
    })
    fireEvent.change(screen.getByLabelText('Expected immediate effect'), {
      target: { value: 'gas-exchange' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Commit before action' }))

    const readinessButton = screen.getByRole('button', {
      name: /Complete VV readiness and tip-to-tip check/i,
    })
    expect(readinessButton).toBeEnabled()
    fireEvent.click(readinessButton)

    expect(
      screen.getByText(/No circuit defect is found; the prepared VV circuit is ready to connect/i),
    ).toBeInTheDocument()
    expect(readinessButton).toBeDisabled()

    fireEvent.click(
      screen.getByRole('button', {
        name: /Confirm cannulation and connect the prepared VV circuit/i,
      }),
    )

    const settingChecklist = screen.getByRole('list', {
      name: /Initiation setting checklist/i,
    })
    expect(within(settingChecklist).queryByRole('spinbutton')).not.toBeInTheDocument()

    fireEvent.click(
      within(settingChecklist).getByRole('button', {
        name: /Go to CARDIOHELP RPM control/i,
      }),
    )
    const rpmControl = screen.getByRole('slider', { name: /RPM rotary setpoint/i })
    expect(rpmControl).toHaveFocus()
    const increaseSetpoint = screen.getByRole('button', { name: /Increase setpoint/i })
    for (let index = 0; index < 8; index += 1) fireEvent.click(increaseSetpoint)
    expect(rpmControl).toHaveAttribute('aria-valuenow', '3200')

    fireEvent.click(
      within(settingChecklist).getByRole('button', {
        name: /Go to Sweep flow control/i,
      }),
    )
    const sweepControl = screen.getByRole('slider', { name: /Sweep flow control/i })
    expect(sweepControl).toHaveFocus()
    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(sweepControl, { key: 'ArrowRight' })
    }

    fireEvent.click(
      within(settingChecklist).getByRole('button', {
        name: /Go to Sweep-gas FiO₂ control/i,
      }),
    )
    const fio2Control = screen.getByRole('slider', { name: /Sweep-gas FiO₂ control/i })
    expect(fio2Control).toHaveFocus()
    fireEvent.keyDown(fio2Control, { key: 'End' })

    expect(screen.getByText(/All three case orders match/i)).toBeInTheDocument()
    expect(screen.getByRole('note', { name: /RPM initiation order/i })).toHaveTextContent(
      /3200 RPM.*Current: 3200 RPM/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start ECMO with current settings' }))

    expect(screen.getByText(/Patient trajectory · improving/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Forward VV flow is established/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Start ECMO with current settings' })).toBeDisabled()
  })

  it('requires all prediction fields before committing', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === state.scenario.scenarioId,
    )!
    const dispatch = jest.fn()
    render(
      <LearningWorkflow
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={dispatch}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    const commit = screen.getByRole('button', { name: 'Commit before action' })
    expect(commit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'initiate-vv-support' },
    })
    fireEvent.change(screen.getByLabelText('First priority'), {
      target: { value: 'initiate-support' },
    })
    fireEvent.change(screen.getByLabelText('Expected immediate effect'), {
      target: { value: 'gas-exchange' },
    })
    expect(commit).toBeEnabled()
    fireEvent.click(commit)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'COMMIT_PREDICTION',
      goalId: 'initiate-vv-support',
      control: 'initiate-support',
      direction: 'gas-exchange',
    })
  })

  it('shows the current workflow step and provides a one-click observation advance', () => {
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )!
    let state = createInitialSimulationState(definition.id, 'guided')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: definition.expectation.goalId,
      control: definition.expectation.control,
      direction: definition.expectation.direction,
    })
    for (const interventionId of [
      'hemorrhage-reduce-rpm',
      'hemorrhage-search',
      'hemorrhage-prbc',
      'hemorrhage-source-control',
    ]) {
      state = ecmoSimulationReducer(state, {
        type: 'APPLY_CLINICAL_INTERVENTION',
        interventionId,
      })
    }
    const dispatch = jest.fn()

    render(
      <LearningWorkflow
        state={state}
        scenario={definition}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={dispatch}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /Observe the response for 4 more seconds/i }),
    ).toBeInTheDocument()
    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    expect(within(workflow).getByRole('button', { name: /Reassess current/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByText(/Response observed for 0\/4 seconds/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Commit reassessment · observe 4s first/i }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Advance 4 seconds now/i }))
    expect(dispatch).toHaveBeenCalledTimes(4)
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'STEP' })
    expect(dispatch).toHaveBeenNthCalledWith(4, { type: 'STEP' })
  })

  it('explains every requirement that keeps reassessment disabled', () => {
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-tension-pneumothorax',
    )!
    const state = createInitialSimulationState(definition.id, 'guided')

    render(
      <LearningWorkflow
        state={state}
        scenario={definition}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    const checklist = screen.getByLabelText(/Requirements to unlock Commit reassessment/i)
    expect(checklist).toHaveTextContent(/Initial clinical plan committed/i)
    expect(checklist).toHaveTextContent(/intervention or corrective action completed/i)
    expect(checklist).toHaveTextContent(/Device\/console observation entered/i)
    expect(checklist).toHaveTextContent(/Circuit\/gas observation entered/i)
    expect(checklist).toHaveTextContent(/Patient observation entered/i)
    expect(
      screen.getByRole('button', {
        name: /Commit reassessment · commit the clinical plan first/i,
      }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: /Go to clinical plan/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Return to treatment step/i })).toBeInTheDocument()
  })

  it('navigates the clinical Practice stations without mixing VV and VA rounds', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === state.scenario.scenarioId,
    )!
    const onLoadScenario = jest.fn()
    const firstVvDeterioration = clinicalPracticeScenarios.find(
      (item) => item.supportMode === 'vv' && item.stationId === 'flow-pressure',
    )!
    render(
      <LearningWorkflow
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={onLoadScenario}
        onReveal={jest.fn()}
      />,
    )

    const stationNavigation = screen.getByRole('navigation', {
      name: /CARDIOHELP ECMO clinical practice stations/i,
    })
    expect(within(stationNavigation).getByRole('button', { name: /Start ECMO/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(
      within(stationNavigation).getByRole('button', { name: /Patient deterioration/i }),
    ).toBeEnabled()
    expect(within(stationNavigation).getByRole('button', { name: /Complications/i })).toBeEnabled()
    expect(
      screen.getByRole('option', { name: /Initiate VV ECMO for refractory severe ARDS/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Initiate VA ECMO/i })).not.toBeInTheDocument()

    fireEvent.click(
      within(stationNavigation).getByRole('button', { name: /Patient deterioration/i }),
    )
    expect(onLoadScenario).toHaveBeenCalledWith(firstVvDeterioration.id)
  })

  it('shows the VA capstone observation window and required reassessment domains', () => {
    let state = createInitialSimulationState('va-mixed-circulation-capstone')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: 'protect-upper-body',
      control: 'assess-upper-body',
      direction: 'inspect',
    })
    state = ecmoSimulationReducer(state, {
      type: 'CORRECT_FAULT',
      fault: 'differential-hypoxemia',
    })
    const scenario = cardiohelpScenarios.find((item) => item.id === state.scenario.scenarioId)!
    render(
      <LearningWorkflow
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(screen.getByText(/Advance 10 more simulated second/i)).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/right-arm oxygenation/i)
    expect(screen.getByRole('button', { name: /Commit reassessment/i })).toBeDisabled()
  })

  it('makes the debrief action explicit after a reassessment is submitted', () => {
    let state = createInitialSimulationState('va-clinical-differential-hypoxemia')
    state = [
      {
        type: 'COMMIT_PREDICTION' as const,
        goalId: 'protect-upper-body',
        control: 'assess-upper-body' as const,
        direction: 'gas-exchange' as const,
      },
      { type: 'CORRECT_FAULT' as const, fault: 'differential-hypoxemia' as const },
      { type: 'SET_PAUSED' as const, paused: false },
      { type: 'TICK' as const, seconds: 4 },
      {
        type: 'COMMIT_REASSESSMENT' as const,
        device: 'Mixing point causing differential hypoxia',
        circuit: 'Low R radial SpO2',
        patient: 'SpO2',
      },
    ].reduce(ecmoSimulationReducer, state)
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === state.scenario.scenarioId,
    )!
    const onReveal = jest.fn()

    const view = render(
      <LearningWorkflow
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={onReveal}
      />,
    )

    expect(screen.getByText(/Reassessment submitted\. Select/i)).toHaveTextContent(
      /Reassessment submitted.*Reveal diagnosis and score/i,
    )
    const reassessmentPanel = screen.getByRole('region', { name: /Reassess before reveal/i })
    expect(
      within(reassessmentPanel).getByRole('button', { name: /Reassessment submitted/i }),
    ).toBeDisabled()
    const revealButton = within(reassessmentPanel).getByRole('button', {
      name: /Reveal diagnosis and score/i,
    })
    expect(revealButton).toBeEnabled()
    expect(revealButton).toHaveFocus()

    fireEvent.click(revealButton)
    expect(onReveal).toHaveBeenCalledTimes(1)

    const revealedState = ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
    view.rerender(
      <LearningWorkflow
        state={revealedState}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(revealedState)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={onReveal}
      />,
    )
    expect(screen.getByRole('note', { name: /Reassessment scoring/i })).toHaveTextContent(
      /Reassessment credit not earned.*did not include enough scenario-relevant evidence/i,
    )
  })

  it('withholds injected pattern labels until reassessment and reveal', () => {
    const state = createInitialSimulationState('afterload-oxygenator-resistance')
    render(<CircuitAndMonitors state={state} dispatch={jest.fn()} controlsEnabled={false} />)

    expect(
      screen.getByText(/Pattern label withheld until reassessment and reveal/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Oxygenator resistance pattern')).not.toBeInTheDocument()
    expect(screen.getByText(/CENTER INLET → TANGENTIAL OUTFLOW/i)).toBeInTheDocument()
    expect(screen.getByText(/BLOOD AROUND FIBERS · GAS THROUGH FIBERS/i)).toBeInTheDocument()
    expect(screen.getByText(/Sweep-gas path through simplified hollow fibers/i)).toBeInTheDocument()
  })

  it('masks answer-bearing scenario titles and summaries in Challenge mode', () => {
    const state = createInitialSimulationState('gas-source-interruption', 'challenge')
    const scenario = cardiohelpScenarios.find((item) => item.id === state.scenario.scenarioId)!
    render(
      <LearningWorkflow
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: /Challenge: interpret the observable pattern/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(scenario.title)).not.toBeInTheDocument()
    expect(screen.queryByText(scenario.summary)).not.toBeInTheDocument()
  })

  it('shows editable alarm limits as device settings rather than patient targets', () => {
    const initial = createInitialSimulationState('startup-sensor-orientation')
    const state = {
      ...initial,
      device: { ...initial.device, screen: 'settings' as const },
    }
    const dispatch = jest.fn()
    render(<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />)

    expect(screen.getByRole('note')).toHaveTextContent(
      'Alarm limits are device settings, not patient targets.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Increase pVen warning low' }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'ADJUST_LIMIT',
      parameter: 'pVenWarningLow',
      delta: 5,
    })
  })

  it('requires a one-second hold to unlock the physical controls', () => {
    jest.useFakeTimers()
    const initial = createInitialSimulationState('startup-sensor-orientation')
    const state = {
      ...initial,
      device: { ...initial.device, locked: true },
    }
    const dispatch = jest.fn()
    render(<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />)

    const lockButton = screen.getByRole('button', { name: 'Hold to unlock' })
    fireEvent.pointerDown(lockButton)
    act(() => jest.advanceTimersByTime(999))
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'TOGGLE_LOCK' })
    act(() => jest.advanceTimersByTime(1))
    expect(dispatch).toHaveBeenCalledWith({ type: 'TOGGLE_LOCK' })
    fireEvent.pointerUp(lockButton)
  })

  it('models Safety as a held chord rather than a click latch', () => {
    const initial = createInitialSimulationState('acute-hypercapnia')
    const state = {
      ...initial,
      scenario: {
        ...initial.scenario,
        prediction: {
          committed: true,
          goalId: 'improve-acidemia',
          control: 'sweep' as const,
          direction: 'increase' as const,
        },
      },
    }
    const dispatch = jest.fn()
    render(<CardiohelpConsole state={state} dispatch={dispatch} controlsEnabled />)

    const safety = screen.getByRole('button', {
      name: 'Hold Safety; while held activate zero flow or Global Override',
    })
    fireEvent.pointerDown(safety)
    expect(dispatch).toHaveBeenCalledWith({ type: 'PRESS_SAFETY' })
    fireEvent.pointerUp(safety)
    expect(dispatch).toHaveBeenCalledWith({ type: 'RELEASE_SAFETY' })
    fireEvent.click(safety)
    expect(dispatch).toHaveBeenCalledTimes(2)
  })

  it('shows an explicit reviewed-English fallback on non-English routes', () => {
    render(<CardiohelpEcmoLab locale="es" />)
    expect(screen.getByRole('note')).toHaveTextContent(/Reviewed English content fallback/i)
    expect(screen.getByRole('heading', { name: 'Gas blender' })).toBeInTheDocument()
    expect(screen.getByText(/not CARDIOHELP-i touchscreen controls/i)).toBeInTheDocument()
  })

  it('encodes touch-target, focus, and reduced-motion safeguards in the feature stylesheet', () => {
    const css = readFileSync(
      join(process.cwd(), 'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css'),
      'utf8',
    )
    expect(css).toContain('min-height: 44px')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('.circuitFlowMoving')
    expect(css).toContain('.cannulaReturnFlowMoving')
    expect(css).toContain('.oxygenatorGasMoving')
    expect(css).toContain('.pumpRotor')
    expect(css).toContain('animation: none !important')
  })
})
