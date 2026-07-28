import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cardiohelpScenarios } from '../content/scenarios'
import { resolveScenarioReassessment } from '../content/practiceSupport'
import { clinicalPracticeScenarios } from '../content/clinicalCases'
import { cardiohelpCurriculum } from '../content/curriculum'
import {
  createDefaultProgress,
  createInitialSimulationState,
  ecmoSimulationReducer,
  selectScenarioOutcome,
} from '../engine'
import { CardiohelpConsole } from '../components/CardiohelpConsole'
import { CardiohelpWorkbench } from '../components/CardiohelpWorkbench'
import { CircuitAndMonitors } from '../components/CircuitAndMonitors'
import { PracticeCasePlayer } from '../components/PracticeCasePlayer'

const mockRouterPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
  useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/practice',
}))

describe('CARDIOHELP ECMO learner interface', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.history.replaceState(null, '', '/')
    mockRouterPush.mockReset()
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

  it('renders the Learn workbench with section navigation and no Practice scoring', async () => {
    const { container } = render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Guided lessons/i })).toBeInTheDocument()
    })

    const nav = screen.getByRole('navigation', { name: /ECMO Management module sections/i })
    expect(within(nav).getByRole('link', { name: /Learn/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: /Overview/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByText(/Guided focus: circuit and sensors/i)).toBeInTheDocument()
    expect(container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    const sharedPhases = screen.getByRole('group', { name: 'ECMO shared activity phases' })
    for (const label of ['Recognize', 'Predict', 'Act', 'Observe', 'Explain', 'Transfer']) {
      expect(within(sharedPhases).getByText(label)).toBeInTheDocument()
    }
    for (const legacyLabel of ['Orient', 'Interpret', 'Respond', 'Reassess']) {
      expect(screen.queryByText(legacyLabel, { selector: 'strong' })).not.toBeInTheDocument()
    }

    const currentTask = screen.getByRole('complementary', { name: 'Current task' })
    expect(within(currentTask).getByText('Start with four information domains')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    fireEvent.click(screen.getByRole('button', { name: /Next step/i }))
    expect(within(currentTask).getByText('Open the parameter list')).toBeInTheDocument()
    expect(
      within(currentTask).getByText(/Open Parameter list and locate pVen, pInt, pArt/i),
    ).toBeInTheDocument()
    expect(window.localStorage.getItem('cardiohelp-ecmo-progress-v1')).toBeNull()
  })

  it('opens each case on a brief stage while keeping the workflow and console available', async () => {
    render(<CardiohelpWorkbench section="practice" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Begin case/i })).toBeInTheDocument()
    })

    expect(screen.queryByRole('heading', { name: /Guided lessons/i })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Learning objectives/i })).toBeInTheDocument()
    expect(
      screen.getByText(/Verify circuit, sensors, gas, power, and team readiness/i),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Commit before action' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Console locked/i)).not.toBeInTheDocument()
    const currentTask = screen.getByRole('complementary', { name: 'Current task' })
    expect(
      within(currentTask).getByText(/Review the observable patient, indication/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
    expect(within(currentTask).getByText(/Complete readiness checks/i)).toBeInTheDocument()
    expect(
      within(currentTask).getAllByText(/Choose the immediate goal, the control or bedside action/i),
    ).not.toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Commit before action' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Standard practice' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Less coaching \(harder\)/i })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: /Initiate VV ECMO for refractory severe ARDS/i,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()
  })

  it('runs the VV initiation case from committed plan through readiness, settings, and support', async () => {
    render(<CardiohelpWorkbench section="practice" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Begin case/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
    fireEvent.change(screen.getByLabelText('Goal'), {
      target: { value: 'initiate-vv-support' },
    })
    fireEvent.change(screen.getByLabelText('First priority'), {
      target: { value: 'initiate-support' },
    })
    fireEvent.change(screen.getByLabelText('Expected immediate effect'), {
      target: { value: 'gas-exchange' },
    })
    expect(screen.queryByText(/Console locked/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Commit before action' }))
    expect(
      (global.fetch as jest.Mock).mock.calls
        .map(([, request]) => JSON.parse(request.body as string))
        .some(
          (payload) =>
            payload.moduleId === 'critical-care' &&
            payload.eventPayload?.interaction === 'critical_care_prediction_submitted' &&
            payload.eventPayload?.moduleId === 'cardiohelp-ecmo',
        ),
    ).toBe(true)

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

    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    const sharedPhases = screen.getByRole('group', { name: 'ECMO shared activity phases' })
    for (const label of ['Recognize', 'Predict', 'Act', 'Observe', 'Explain', 'Transfer']) {
      expect(within(sharedPhases).getByText(label)).toBeInTheDocument()
    }
    expect(within(workflow).getByRole('button', { name: /Reassess/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    fireEvent.click(within(workflow).getByRole('button', { name: /Manage/i }))
    expect(screen.getByRole('button', { name: 'Start ECMO with current settings' })).toBeDisabled()
  })

  it('requires all prediction fields before committing', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === state.scenario.scenarioId,
    )!
    const dispatch = jest.fn()
    render(
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={dispatch}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
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
    state = ecmoSimulationReducer(state, { type: 'SET_RPM', rpm: 3200 })
    for (const interventionId of [
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
      <PracticeCasePlayer
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
      screen.getByRole('button', { name: /Commit reassessment · select all three responses/i }),
    ).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /Advance 4 seconds now/i }))
    expect(dispatch).toHaveBeenCalledTimes(4)
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'STEP' })
    expect(dispatch).toHaveBeenNthCalledWith(4, { type: 'STEP' })
  })

  it('shows reassessment context without making the observation interval a navigation gate', () => {
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-tension-pneumothorax',
    )!
    let state = createInitialSimulationState(definition.id, 'guided')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: definition.expectation.goalId,
      control: definition.expectation.control,
      direction: definition.expectation.direction,
    })
    state = ecmoSimulationReducer(state, {
      type: 'CORRECT_FAULT',
      fault: definition.expectation.correctiveFault,
    })

    render(
      <PracticeCasePlayer
        state={state}
        scenario={definition}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    expect(within(workflow).getByRole('button', { name: /Reassess/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    const checklist = screen.getByLabelText(/Reassessment context/i)
    expect(checklist).toHaveTextContent(/Initial clinical plan committed/i)
    expect(checklist).toHaveTextContent(/intervention or corrective action completed/i)
    expect(checklist).toHaveTextContent(/Response observed for 0\/3 seconds/i)
    expect(checklist).toHaveTextContent(/Device\/console response selected/i)
    expect(checklist).toHaveTextContent(/Circuit\/gas response selected/i)
    expect(checklist).toHaveTextContent(/Patient response selected/i)
    expect(
      screen.getByRole('button', {
        name: /Commit reassessment · select all three responses/i,
      }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: /Advance 3 seconds now/i })).toBeInTheDocument()
  })

  it('uses objective reassessment choices and offers qualitative clues', () => {
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-tension-pneumothorax',
    )!
    let state = createInitialSimulationState(definition.id, 'guided')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: definition.expectation.goalId,
      control: definition.expectation.control,
      direction: definition.expectation.direction,
    })
    state = ecmoSimulationReducer(state, {
      type: 'CORRECT_FAULT',
      fault: definition.expectation.correctiveFault,
    })
    const dispatch = jest.fn()

    render(
      <PracticeCasePlayer
        state={state}
        scenario={definition}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={dispatch}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(screen.getAllByRole('radio')).toHaveLength(9)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const clueButton = screen.getByRole('button', { name: /Give me a clue/i })
    fireEvent.click(clueButton)
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REQUEST_HINT',
      hintId: definition.hints?.[0].id,
    })
  })

  it('directs required machine changes to the real simulator control', () => {
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

    render(
      <PracticeCasePlayer
        state={state}
        scenario={definition}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(
      screen.getByText(/Machine changes cannot be applied from this side panel/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Go to simulator control/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Temporarily reduce pump demand/i }),
    ).not.toBeInTheDocument()
  })

  it('asks for confirmation before discarding a committed case attempt', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CardiohelpWorkbench section="practice" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Begin case/i })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
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

    fireEvent.change(screen.getByLabelText('Case'), {
      target: { value: 'clinical-vv-occult-hemorrhage' },
    })
    expect(confirmSpy).toHaveBeenCalled()
    expect(
      screen.getByRole('heading', { name: /Initiate VV ECMO for refractory severe ARDS/i }),
    ).toBeInTheDocument()

    confirmSpy.mockReturnValue(true)
    fireEvent.change(screen.getByLabelText('Case'), {
      target: { value: 'clinical-vv-occult-hemorrhage' },
    })
    expect(
      screen.getByRole('heading', { name: /Occult hemorrhage with drainage insufficiency/i }),
    ).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('offers every track case grouped by curriculum unit without mixing VV and VA', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === state.scenario.scenarioId,
    )!
    const onLoadScenario = jest.fn()
    render(
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={onLoadScenario}
        onReveal={jest.fn()}
      />,
    )

    const caseSelect = screen.getByLabelText('Case')
    const vvCaseCount = cardiohelpCurriculum.vv.reduce(
      (count, unit) => count + unit.caseScenarioIds.length,
      0,
    )
    expect(within(caseSelect).getAllByRole('option')).toHaveLength(vvCaseCount)
    expect(
      within(caseSelect).getByRole('group', { name: /Unit 2 · Drainage & preload/i }),
    ).toBeInTheDocument()
    expect(
      within(caseSelect).getByRole('option', {
        name: /Initiate VV ECMO for refractory severe ARDS/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(caseSelect).queryByRole('option', { name: /Initiate peripheral VA ECMO/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Unit 1 · Foundations & console orientation/i)).toBeInTheDocument()

    fireEvent.change(caseSelect, { target: { value: 'clinical-vv-occult-hemorrhage' } })
    expect(onLoadScenario).toHaveBeenCalledWith('clinical-vv-occult-hemorrhage')
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
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
        section="assess"
      />,
    )

    expect(screen.getByText('Challenge')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: scenario.title })).toBeInTheDocument()
    expect(screen.queryByLabelText('Case')).not.toBeInTheDocument()
    expect(screen.getByText(/Advance 10 more simulated second/i)).toBeInTheDocument()
    expect(screen.getByText('Required review domains').closest('[role="note"]')).toHaveTextContent(
      /right-arm oxygenation/i,
    )
    expect(screen.getByRole('button', { name: /Commit reassessment/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Standard practice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Hide diagnosis cues/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Give me a clue/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Challenge mode collects teaching feedback/i)).toHaveAttribute(
      'role',
      'note',
    )
    for (const objective of scenario.clinicalCase?.learningObjectives ?? []) {
      expect(screen.getByText(objective)).toBeInTheDocument()
    }
  })

  it('keeps authored initiation orders and objectives visible while challenge clues stay deferred', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-initiation-ards',
    )!
    render(
      <>
        <PracticeCasePlayer
          state={state}
          scenario={scenario}
          progress={createDefaultProgress()}
          outcome={selectScenarioOutcome(state)}
          dispatch={jest.fn()}
          onLoadScenario={jest.fn()}
          onReveal={jest.fn()}
          section="assess"
        />
        <CardiohelpConsole
          state={state}
          dispatch={jest.fn()}
          controlsEnabled={false}
          initiationTargets={scenario.clinicalCase?.initiationTargets ?? null}
        />
      </>,
    )

    expect(screen.getByText('Simulated case order')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: scenario.title })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Standard practice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Give me a clue/i })).not.toBeInTheDocument()
    for (const objective of scenario.clinicalCase?.learningObjectives ?? []) {
      expect(screen.getByText(objective)).toBeInTheDocument()
    }
  })

  it('makes the debrief action explicit after a reassessment is submitted', () => {
    let state = createInitialSimulationState('va-clinical-differential-hypoxemia')
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'va-clinical-differential-hypoxemia',
    )!
    const reassessment = resolveScenarioReassessment(definition)
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
        answers: {
          deviceOptionId: reassessment.device.options.find(
            (item) => item.id !== reassessment.device.correctOptionId,
          )!.id,
          circuitOptionId: reassessment.circuit.options.find(
            (item) => item.id !== reassessment.circuit.correctOptionId,
          )!.id,
          patientOptionId: reassessment.patient.options.find(
            (item) => item.id !== reassessment.patient.correctOptionId,
          )!.id,
        },
      },
    ].reduce(ecmoSimulationReducer, state)
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === state.scenario.scenarioId,
    )!
    const onReveal = jest.fn()
    const onPhaseChange = jest.fn()

    const view = render(
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={onReveal}
        onPhaseChange={onPhaseChange}
      />,
    )

    expect(screen.getByText(/Reassessment submitted\. Select/i)).toHaveTextContent(
      /Reassessment submitted.*Reveal causal debrief/i,
    )
    const reassessmentPanel = screen.getByRole('region', { name: /Reassess before reveal/i })
    expect(
      within(reassessmentPanel).getByRole('button', { name: /Reassessment submitted/i }),
    ).toBeDisabled()
    const revealButton = within(reassessmentPanel).getByRole('button', {
      name: /Reveal causal debrief/i,
    })
    expect(revealButton).toBeEnabled()
    expect(revealButton).toHaveFocus()

    fireEvent.click(revealButton)
    expect(onReveal).toHaveBeenCalledTimes(1)

    const revealedState = ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
    view.rerender(
      <PracticeCasePlayer
        state={revealedState}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(revealedState)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={onReveal}
        onPhaseChange={onPhaseChange}
      />,
    )
    expect(onPhaseChange).toHaveBeenLastCalledWith('explain')
    expect(onPhaseChange).not.toHaveBeenCalledWith('transfer')
    expect(screen.getByRole('note', { name: /Reassessment comparison/i })).toHaveTextContent(
      /At least one selected response differs from the authored post-intervention evidence/i,
    )
    expect(screen.getByRole('link', { name: /Review the paired lesson/i })).toHaveAttribute(
      'href',
      expect.stringContaining('lesson=va-differential-hypoxemia'),
    )
    expect(screen.getByRole('link', { name: /Next recommended/i })).toBeInTheDocument()
    expect(screen.getByText(/Learning objectives/i)).toBeInTheDocument()
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

  it('provides accessible circuit-view switching and independent clamp controls', async () => {
    const state = ecmoSimulationReducer(createInitialSimulationState('acute-hypercapnia'), {
      type: 'COMMIT_PREDICTION',
      goalId: 'improve-acidemia',
      control: 'sweep',
      direction: 'increase',
    })
    const dispatch = jest.fn()
    render(<CircuitAndMonitors state={state} dispatch={dispatch} controlsEnabled />)

    expect(screen.getByRole('tab', { name: 'Bedside 3D circuit' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const diagnosticTab = screen.getByRole('tab', { name: 'Pressure-zone map' })
    fireEvent.click(diagnosticTab)
    expect(diagnosticTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: 'Bedside 3D circuit' }))
    fireEvent.click(await screen.findByRole('button', { name: /Drainage clamp.*Open/i }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'drainage',
    })
    fireEvent.click(screen.getByRole('button', { name: /Return clamp.*Open/i }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'TOGGLE_CIRCUIT_CLAMP',
      limb: 'return',
    })
  })

  it('keeps scenario titles and summaries visible in Challenge mode', () => {
    const state = createInitialSimulationState('gas-source-interruption', 'challenge')
    const scenario = cardiohelpScenarios.find((item) => item.id === state.scenario.scenarioId)!
    render(
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(screen.getByRole('heading', { name: scenario.title })).toBeInTheDocument()
    expect(screen.getByText(scenario.summary)).toBeInTheDocument()
  })

  it('defers routine clinical teaching in Challenge mode and reveals it on request', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )!
    let state = createInitialSimulationState(scenario.id, 'challenge')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: scenario.expectation.goalId,
      control: scenario.expectation.control,
      direction: scenario.expectation.direction,
    })
    const intervention = scenario.clinicalCase!.interventions.find(
      (item) => item.id === 'hemorrhage-search',
    )!
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: intervention.id,
    })

    render(
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    expect(screen.queryByText(intervention.response)).not.toBeInTheDocument()
    expect(screen.getByText(/Routine teaching note saved for the debrief/i)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Show teaching notes after each action/i }),
    )
    expect(screen.getAllByText(intervention.response).length).toBeGreaterThan(0)
  })

  it('keeps a catastrophic ECMO action visible as an immediate safety interruption', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-initiation-ards',
    )!
    let state = createInitialSimulationState(scenario.id, 'challenge')
    state = ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: scenario.expectation.goalId,
      control: scenario.expectation.control,
      direction: scenario.expectation.direction,
    })
    const unsafe = scenario.clinicalCase!.interventions.find(
      (item) => item.id === 'vv-pressure-escalation',
    )!
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: unsafe.id,
    })

    render(
      <PracticeCasePlayer
        state={state}
        scenario={scenario}
        progress={createDefaultProgress()}
        outcome={selectScenarioOutcome(state)}
        dispatch={jest.fn()}
        onLoadScenario={jest.fn()}
        onReveal={jest.fn()}
      />,
    )

    const interruption = screen.getByRole('alert')
    expect(interruption).toHaveTextContent(/Safety interruption/i)
    expect(interruption).toHaveTextContent(unsafe.response)
    expect(
      within(interruption).getByRole('button', { name: /Restart from the clean case/i }),
    ).toBeInTheDocument()
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

  it('shows an explicit reviewed-English fallback on non-English routes', async () => {
    render(<CardiohelpWorkbench section="learn" locale="es" />)
    await waitFor(() => {
      expect(screen.getByText(/Reviewed English content fallback/i)).toBeInTheDocument()
    })
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
