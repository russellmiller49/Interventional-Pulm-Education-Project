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
import {
  EcmoPracticeCaseView,
  type EcmoPracticeCaseViewProps,
} from '../components/practice/EcmoPracticeActivity'
import { presentationTitle } from '../content/casePresentation'

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

  it('renders the Learn stage with one progression, one Now card, and no Practice scoring', async () => {
    const { container } = render(<CardiohelpWorkbench section="learn" />)
    await waitFor(() => {
      expect(container.querySelector('[data-now-card]')).toBeInTheDocument()
    })

    const nav = screen.getByRole('navigation', { name: /ECMO Management module sections/i })
    expect(within(nav).getByRole('link', { name: /Learn/i })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).getByRole('link', { name: /Overview/i })).not.toHaveAttribute('aria-current')
    expect(screen.getByText(/Guided focus: circuit and sensors/i)).toBeInTheDocument()
    expect(container.querySelector('[data-critical-care-activity-shell]')).toBeInTheDocument()
    // One progression: the lesson's own step list, and no shared six-phase bar above it.
    expect(screen.queryByRole('group', { name: 'ECMO shared activity phases' })).toBeNull()
    expect(container.querySelectorAll('[data-step-list] [aria-current="step"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-now-card]')).toHaveLength(1)
    for (const legacyLabel of ['Orient', 'Interpret', 'Respond', 'Reassess']) {
      expect(screen.queryByText(legacyLabel, { selector: 'strong' })).not.toBeInTheDocument()
    }

    const nowCard = container.querySelector('[data-now-card]') as HTMLElement
    expect(within(nowCard).getByText('Start with four information domains')).toBeInTheDocument()
    // A read step's one action is also what moves the lesson on.
    fireEvent.click(screen.getByRole('button', { name: /identify all four domains/i }))
    const nextCard = container.querySelector('[data-now-card]') as HTMLElement
    expect(
      within(nextCard).getByText('The pump is stopped: which channels still mean anything?'),
    ).toBeInTheDocument()
    expect(
      within(nextCard).getByText(/show the unavailable indication rather than a number/i),
    ).toBeInTheDocument()
    expect(container.querySelector('[data-stage]')).toHaveAttribute(
      'data-stage',
      'startup-screen-parameters',
    )
    expect(window.localStorage.getItem('cardiohelp-ecmo-progress-v1')).toBeNull()
  })

  /**
   * The Practice view mounted the way the route mounts it, minus the session: a built engine state
   * and a recording dispatch. Everything the learner sees is a function of that state.
   */
  function renderCaseView(
    state: ReturnType<typeof createInitialSimulationState>,
    overrides: Partial<EcmoPracticeCaseViewProps> = {},
  ) {
    const scenario =
      clinicalPracticeScenarios.find((item) => item.id === state.scenario.scenarioId) ??
      cardiohelpScenarios.find((item) => item.id === state.scenario.scenarioId)
    if (!scenario) throw new Error(`Missing scenario ${state.scenario.scenarioId}`)
    const dispatch = jest.fn()
    const props: EcmoPracticeCaseViewProps = {
      section: 'practice',
      state,
      scenario,
      outcome: selectScenarioOutcome(state),
      progress: createDefaultProgress(),
      supportMode: scenario.supportMode,
      activityMode: state.simulationMode === 'challenge' ? 'challenge' : 'practice',
      dispatch,
      onLoadScenario: jest.fn(),
      onSelectTrack: jest.fn(),
      onReveal: jest.fn(),
      onSaveAndExit: jest.fn(),
      onReset: jest.fn(),
      ...overrides,
    }
    const view = render(<EcmoPracticeCaseView {...props} />)
    return { scenario, dispatch, props, view }
  }

  function commitExpectation(state: ReturnType<typeof createInitialSimulationState>) {
    const scenario =
      clinicalPracticeScenarios.find((item) => item.id === state.scenario.scenarioId) ??
      cardiohelpScenarios.find((item) => item.id === state.scenario.scenarioId)
    if (!scenario) throw new Error('missing scenario')
    return ecmoSimulationReducer(state, {
      type: 'COMMIT_PREDICTION',
      goalId: scenario.expectation.goalId,
      control: scenario.expectation.control,
      direction: scenario.expectation.direction,
    })
  }

  it('opens each case on a brief stage with one Now card and no diagnosis in sight', async () => {
    const { container } = render(<CardiohelpWorkbench section="practice" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Begin case/i })).toBeInTheDocument()
    })
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-initiation-ards',
    )!

    // One progression, one Now card, and the shared six-phase bar is gone.
    expect(screen.queryByRole('group', { name: 'ECMO shared activity phases' })).toBeNull()
    expect(container.querySelectorAll('[data-now-card]')).toHaveLength(1)
    expect(container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'brief')
    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    expect(within(workflow).getAllByRole('button')).toHaveLength(5)
    expect(within(workflow).getByRole('button', { name: /\bBrief\b/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    // Later stages are rows, not doors: number and name only, nothing to inspect.
    for (const later of ['Plan', 'Manage', 'Reassess', 'Debrief']) {
      expect(within(workflow).getByRole('button', { name: new RegExp(later) })).toBeDisabled()
    }
    expect(screen.queryByRole('button', { name: 'Commit before action' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Console locked/i)).not.toBeInTheDocument()

    // The title is the presentation, not the diagnosis, and the objectives wait for the debrief.
    expect(
      screen.getByRole('heading', { level: 1, name: presentationTitle(scenario) }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Learning objectives/i })).not.toBeInTheDocument()
    expect(screen.queryByText(scenario.debrief.diagnosis)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Begin case/i }))
    expect(container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'plan')
    const nowCard = container.querySelector('[data-now-card]') as HTMLElement
    expect(
      within(nowCard).getByText(/Commit your plan before touching anything/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit before action' })).toBeDisabled()
    // The coaching toggle lives under Case options, not in the case column.
    const options = container.querySelector('[data-case-options]') as HTMLElement
    expect(within(options).getByRole('button', { name: 'Standard practice' })).toBeInTheDocument()
    expect(
      within(options).getByRole('button', { name: /Less coaching \(harder\)/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Step complete—now verify what changed/i)).not.toBeInTheDocument()
  })

  it('runs the VV initiation case from committed plan through readiness, settings, and support', async () => {
    const { container } = render(<CardiohelpWorkbench section="practice" />)
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
    expect(container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'manage')

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
    await waitFor(() => expect(rpmControl).toHaveFocus())
    const increaseSetpoint = screen.getByRole('button', { name: /Increase setpoint/i })
    for (let index = 0; index < 8; index += 1) fireEvent.click(increaseSetpoint)
    expect(rpmControl).toHaveAttribute('aria-valuenow', '3200')

    // The gas blender opens when the checklist sends the learner to it.
    fireEvent.click(
      within(settingChecklist).getByRole('button', {
        name: /Go to Sweep flow control/i,
      }),
    )
    expect(container.querySelector('[data-surface="gas"]')).toHaveAttribute('data-open', 'true')
    const sweepControl = screen.getByRole('slider', { name: /Sweep flow control/i })
    await waitFor(() => expect(sweepControl).toHaveFocus())
    for (let index = 0; index < 4; index += 1) {
      fireEvent.keyDown(sweepControl, { key: 'ArrowRight' })
    }

    fireEvent.click(
      within(settingChecklist).getByRole('button', {
        name: /Go to Sweep-gas FiO₂ control/i,
      }),
    )
    const fio2Control = screen.getByRole('slider', { name: /Sweep-gas FiO₂ control/i })
    await waitFor(() => expect(fio2Control).toHaveFocus())
    fireEvent.keyDown(fio2Control, { key: 'End' })

    expect(screen.getByText(/All three case orders match/i)).toBeInTheDocument()
    expect(screen.getByRole('note', { name: /RPM initiation order/i })).toHaveTextContent(
      /3200 RPM.*Current: 3200 RPM/i,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start ECMO with current settings' }))

    // Support is running and every required step is done: the stage moves on with the engine.
    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    expect(within(workflow).getByRole('button', { name: /Reassess/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'reassess')

    // A reached stage can be looked back at, read-only, with its response still on it.
    fireEvent.click(within(workflow).getByRole('button', { name: /Manage/i }))
    expect(container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'manage')
    expect(container.querySelector('[data-reviewing-stage]')).toBeInTheDocument()
    expect(screen.getByText(/Patient trajectory · improving/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Forward VV flow is established/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Start ECMO with current settings' })).toBeDisabled()
  })

  it('requires all prediction fields before committing', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const { dispatch } = renderCaseView(state)

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

  it('shows the current stage on the Now card and provides a one-click observation advance', () => {
    let state = commitExpectation(
      createInitialSimulationState('clinical-vv-occult-hemorrhage', 'guided'),
    )
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
    const { dispatch, view } = renderCaseView(state)

    const nowCard = view.container.querySelector('[data-now-card]') as HTMLElement
    expect(
      within(nowCard).getByRole('heading', { name: /Let the response develop — 4 s to go/i }),
    ).toBeInTheDocument()
    const workflow = screen.getByRole('navigation', { name: /Practice workflow steps/i })
    expect(within(workflow).getByRole('button', { name: /Reassess/i })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(screen.getByText(/Response observed for 0\/4 seconds/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Commit reassessment · select all three responses/i }),
    ).toBeDisabled()

    fireEvent.click(within(nowCard).getByRole('button', { name: /Advance 4 seconds now/i }))
    expect(dispatch).toHaveBeenCalledTimes(4)
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'STEP' })
    expect(dispatch).toHaveBeenNthCalledWith(4, { type: 'STEP' })
  })

  it('shows reassessment context without making the observation interval a navigation gate', () => {
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-tension-pneumothorax',
    )!
    let state = commitExpectation(createInitialSimulationState(definition.id, 'guided'))
    // Manage is done the way a learner does it: every required intervention applied, which is
    // also what resolves the case's corrective fault.
    for (const interventionId of definition.clinicalCase!.requiredInterventionIds) {
      state = ecmoSimulationReducer(state, { type: 'APPLY_CLINICAL_INTERVENTION', interventionId })
    }
    expect(state.scenario.correctedFaults).toContain(definition.expectation.correctiveFault)
    renderCaseView(state)

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
    expect(
      screen.getAllByRole('button', { name: /Advance 3 seconds now/i }).length,
    ).toBeGreaterThan(0)
  })

  it('uses objective reassessment choices and offers qualitative clues through Help', () => {
    const definition = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-tension-pneumothorax',
    )!
    let state = commitExpectation(createInitialSimulationState(definition.id, 'guided'))
    for (const interventionId of definition.clinicalCase!.requiredInterventionIds) {
      state = ecmoSimulationReducer(state, { type: 'APPLY_CLINICAL_INTERVENTION', interventionId })
    }
    const { dispatch } = renderCaseView(state)

    const reassessmentPanel = screen.getByRole('region', { name: /Reassess before reveal/i })
    expect(within(reassessmentPanel).getAllByRole('radio')).toHaveLength(9)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    // Clues live behind "What do I do now?", with the Now card's own instruction beside them.
    expect(screen.queryByRole('button', { name: /Give me a clue/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /What do I do now\?/i }))
    const dialog = document.querySelector('[data-ecmo-help-dialog]') as HTMLElement
    // Help re-states the Now card — the same instruction, never a different one.
    const nowHeading = document.querySelector('[data-now-card] h2')?.textContent ?? ''
    expect(nowHeading.length).toBeGreaterThan(0)
    expect(within(dialog).getByText(nowHeading)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: /Give me a clue/i }))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'REQUEST_HINT',
      hintId: definition.hints?.[0].id,
    })
  })

  it('directs required machine changes to the real simulator control', () => {
    const state = commitExpectation(
      createInitialSimulationState('clinical-vv-occult-hemorrhage', 'guided'),
    )
    const { view } = renderCaseView(state)

    expect(
      screen.getByText(/Machine changes cannot be applied from this side panel/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Go to simulator control/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Temporarily reduce pump demand/i }),
    ).not.toBeInTheDocument()
    const nowCard = view.container.querySelector('[data-now-card]') as HTMLElement
    expect(
      within(nowCard).getByRole('heading', { name: /Make the machine change on the simulator/i }),
    ).toBeInTheDocument()
    expect(within(nowCard).getByRole('button', { name: /Go to the control/i })).toBeInTheDocument()
  })

  it('asks for confirmation before discarding a committed case attempt', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)
    render(<CardiohelpWorkbench section="practice" />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Begin case/i })).toBeInTheDocument()
    })
    const initiation = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-initiation-ards',
    )!
    const hemorrhage = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )!
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
      screen.getByRole('heading', { level: 1, name: presentationTitle(initiation) }),
    ).toBeInTheDocument()

    confirmSpy.mockReturnValue(true)
    fireEvent.change(screen.getByLabelText('Case'), {
      target: { value: 'clinical-vv-occult-hemorrhage' },
    })
    expect(
      screen.getByRole('heading', { level: 1, name: presentationTitle(hemorrhage) }),
    ).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('offers every track case grouped by curriculum unit, by presentation, without mixing VV and VA', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards')
    const onLoadScenario = jest.fn()
    renderCaseView(state, { onLoadScenario })

    const caseSelect = screen.getByLabelText('Case')
    const vvCaseCount = cardiohelpCurriculum.vv.reduce(
      (count, unit) => count + unit.caseScenarioIds.length,
      0,
    )
    expect(within(caseSelect).getAllByRole('option')).toHaveLength(vvCaseCount)
    const unitTwo = cardiohelpCurriculum.vv[1]
    expect(
      within(caseSelect).getByRole('group', { name: `Unit 2 · ${unitTwo.title}` }),
    ).toBeInTheDocument()
    for (const caseId of cardiohelpCurriculum.vv.flatMap((unit) => unit.caseScenarioIds)) {
      const definition = clinicalPracticeScenarios.find((item) => item.id === caseId)!
      expect(
        within(caseSelect).getByRole('option', { name: presentationTitle(definition) }),
      ).toBeInTheDocument()
      // The picker never names the diagnosis.
      expect(within(caseSelect).queryByRole('option', { name: definition.title })).toBeNull()
    }
    expect(
      within(caseSelect).queryByRole('option', { name: /Initiate peripheral VA ECMO/i }),
    ).not.toBeInTheDocument()

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
    const { scenario } = renderCaseView(state, { section: 'assess', activityMode: 'challenge' })

    expect(screen.getByText(/Challenge · VA track/i)).toBeInTheDocument()
    // The capstone is named by its presentation until the debrief, never by its diagnosis.
    expect(
      screen.getByRole('heading', { level: 1, name: presentationTitle(scenario) }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: scenario.title })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Case')).not.toBeInTheDocument()
    expect(screen.getByText(/Advance 10 more simulated second/i)).toBeInTheDocument()
    expect(screen.getByText('Required review domains').closest('[role="note"]')).toHaveTextContent(
      /right-arm oxygenation/i,
    )
    expect(screen.getByRole('button', { name: /Commit reassessment/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Standard practice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Give me a clue/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /What do I do now\?/i }))
    expect(document.querySelector('[data-help-clues="off"]')).toHaveTextContent(
      /Clues are off in Challenge/i,
    )
  })

  it('keeps authored initiation orders visible in Challenge while objectives and clues wait for the debrief', () => {
    const state = createInitialSimulationState('clinical-vv-initiation-ards', 'challenge')
    const { scenario } = renderCaseView(state, { section: 'assess', activityMode: 'challenge' })

    // The console's and the blender's simulated case orders are part of the simulator, not of the
    // masking.
    expect(screen.getAllByText('Simulated case order').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { level: 1, name: presentationTitle(scenario) }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: scenario.title })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Standard practice' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Give me a clue/i })).not.toBeInTheDocument()
    for (const objective of scenario.clinicalCase?.learningObjectives ?? []) {
      expect(screen.queryByText(objective)).not.toBeInTheDocument()
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
    const onReveal = jest.fn()
    const onStageChange = jest.fn()
    const { props, view } = renderCaseView(state, { onReveal, onStageChange })

    // The stage is Debrief, waiting on the reveal; the reassessment panel stays readable.
    expect(view.container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'debrief')
    expect(onStageChange).toHaveBeenLastCalledWith('debrief')
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
    // And the Now card offers the same door.
    const nowCard = view.container.querySelector('[data-now-card]') as HTMLElement
    expect(within(nowCard).getByRole('button', { name: /Reveal causal debrief/i })).toBeEnabled()
    // Nothing before the reveal marks a choice as matched or not.
    expect(document.querySelector('[data-result="correct"]')).toBeNull()
    expect(document.querySelector('[data-result="incorrect"]')).toBeNull()

    fireEvent.click(revealButton)
    expect(onReveal).toHaveBeenCalledTimes(1)

    const revealedState = ecmoSimulationReducer(state, { type: 'REVEAL_DEBRIEF' })
    view.rerender(
      <EcmoPracticeCaseView
        {...props}
        state={revealedState}
        outcome={selectScenarioOutcome(revealedState)}
      />,
    )
    const debrief = view.container.querySelector('[data-case-debrief]') as HTMLElement
    expect(debrief).toBeInTheDocument()
    // The diagnosis is finally allowed to appear, in the title and in the debrief.
    expect(screen.getByRole('heading', { level: 1, name: definition.title })).toBeInTheDocument()
    expect(within(debrief).getByText(definition.debrief.diagnosis)).toBeInTheDocument()
    // Every domain names what was recorded and what the model showed, in words.
    expect(within(debrief).getAllByText(/You recorded:/i)).toHaveLength(3)
    expect(within(debrief).getAllByText(/Modeled response:/i)).toHaveLength(3)
    expect(
      within(debrief).getByRole('link', { name: /Review the paired lesson/i }),
    ).toHaveAttribute('href', expect.stringContaining('lesson=va-differential-hypoxemia'))
    expect(within(debrief).getByText(/What this case was designed to teach/i)).toBeInTheDocument()
    for (const objective of definition.clinicalCase?.learningObjectives ?? []) {
      expect(within(debrief).getByText(objective)).toBeInTheDocument()
    }
    expect(within(debrief).getByRole('button', { name: /Replay this case/i })).toBeInTheDocument()
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

  it('masks the diagnosis and the unit name in Challenge until the debrief', () => {
    const state = createInitialSimulationState('gas-source-interruption', 'challenge')
    const { scenario, view } = renderCaseView(state, { activityMode: 'challenge' })

    expect(screen.queryByRole('heading', { name: scenario.title })).not.toBeInTheDocument()
    expect(screen.queryByText(scenario.summary)).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: presentationTitle(scenario) }),
    ).toBeInTheDocument()
    // Units are numbered, not named, so a unit title cannot hand over the mechanism.
    const options = view.container.querySelector('[data-case-options]') as HTMLElement
    for (const group of within(options).getAllByRole('group')) {
      if (group.tagName === 'OPTGROUP') expect(group).toHaveAccessibleName(/^Unit \d+$/)
    }
    // Never masked: the kicker, the stage, the strip and its alarm chip.
    expect(screen.getByText(/Practice · VV track/i)).toBeInTheDocument()
    expect(view.container.querySelector('[data-stage]')).toHaveAttribute('data-stage', 'plan')
    expect(screen.getByText(/No active device alarm/i)).toBeInTheDocument()
  })

  it('defers routine clinical teaching in Challenge mode to the debrief, with no toggle to skip ahead', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-occult-hemorrhage',
    )!
    let state = commitExpectation(createInitialSimulationState(scenario.id, 'challenge'))
    const intervention = scenario.clinicalCase!.interventions.find(
      (item) => item.id === 'hemorrhage-search',
    )!
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: intervention.id,
    })
    renderCaseView(state, { activityMode: 'challenge' })

    expect(screen.queryByText(intervention.response)).not.toBeInTheDocument()
    expect(screen.getByText(/Routine teaching note saved for the debrief/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('checkbox', { name: /Show teaching notes after each action/i }),
    ).not.toBeInTheDocument()
    // Practice shows its task after the commit; Challenge keeps it for the debrief.
    expect(document.querySelector('[data-decision-prompt]')).toBeNull()
  })

  it('keeps a catastrophic ECMO action visible as an immediate safety interruption', () => {
    const scenario = clinicalPracticeScenarios.find(
      (item) => item.id === 'clinical-vv-initiation-ards',
    )!
    let state = commitExpectation(createInitialSimulationState(scenario.id, 'challenge'))
    const unsafe = scenario.clinicalCase!.interventions.find(
      (item) => item.id === 'vv-pressure-escalation',
    )!
    state = ecmoSimulationReducer(state, {
      type: 'APPLY_CLINICAL_INTERVENTION',
      interventionId: unsafe.id,
    })
    const { view } = renderCaseView(state, { activityMode: 'challenge' })

    // The Now card becomes the safety alert: the authored label, never the identifier.
    const interruption = screen.getByRole('alert')
    expect(interruption).toHaveTextContent(/Stopped for safety/i)
    expect(interruption).toHaveTextContent(unsafe.response)
    for (const errorId of state.scenario.criticalErrors) {
      const label = scenario.unsafeActionPenalties.find((item) => item.id === errorId)?.label
      expect(label).toBeDefined()
      expect(interruption).toHaveTextContent(label!)
      expect(view.container.textContent).not.toContain(errorId)
    }
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
