import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import BaxterCrrtLab from '../components/BaxterCrrtLab'
import { shouldRenderCrrtCalibrationPanel } from '../components/CrrtCalibrationPanel'
import { CrrtLearningWorkflow } from '../components/CrrtLearningWorkflow'
import { getBaxterCrrtPilotCase } from '../content'
import { createCrrtLearningSession } from '../engine'

let mockForceMaskedMasteryComposition = false

jest.mock('../engine', () => {
  const actual = jest.requireActual<typeof import('../engine')>('../engine')
  return {
    ...actual,
    crrtLearningSessionReducer: (
      state: Parameters<typeof actual.crrtLearningSessionReducer>[0],
      action: Parameters<typeof actual.crrtLearningSessionReducer>[1],
    ) => {
      const next = actual.crrtLearningSessionReducer(state, action)
      return mockForceMaskedMasteryComposition && action.type === 'LOAD_CASE'
        ? {
            ...next,
            experience: 'mastery' as const,
            simulation: { ...next.simulation, experience: 'mastery' as const },
          }
        : next
    },
  }
})

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: jest.fn(),
}))

function chooseFirstOption(select: HTMLElement) {
  const options = within(select).getAllByRole('option') as HTMLOptionElement[]
  const firstChoice = options.find((option) => option.value !== '')
  if (!firstChoice) throw new Error('Expected a non-placeholder option.')
  fireEvent.change(select, { target: { value: firstChoice.value } })
}

function completeFiveFieldPrediction() {
  chooseFirstOption(screen.getByRole('combobox', { name: '1 · Goal' }))
  chooseFirstOption(screen.getByRole('combobox', { name: '2 · Mechanism' }))
  fireEvent.click(
    within(screen.getByRole('group', { name: '3 · Planned control' })).getAllByRole('checkbox')[0],
  )
  chooseFirstOption(screen.getByRole('combobox', { name: '4 · Expected response' }))
  fireEvent.click(
    within(screen.getByRole('group', { name: '5 · Reassessment plan' })).getAllByRole(
      'checkbox',
    )[0],
  )
}

function openPathway(name: 'Learn' | 'Practice') {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))
}

function expectCurrentReasoningStep(name: string) {
  const ribbon = screen.getByRole('navigation', { name: 'CRRT reasoning sequence' })
  const currentItems = within(ribbon)
    .getAllByRole('listitem')
    .filter((item) => item.getAttribute('aria-current') === 'step')
  expect(currentItems).toHaveLength(1)
  expect(within(currentItems[0]).getByText(name)).toBeInTheDocument()
}

describe('Baxter CRRT Phase 4-5 learning workflow', () => {
  beforeEach(() => window.localStorage.clear())

  it('activates Learn and Practice while keeping Mastery locked', () => {
    render(<BaxterCrrtLab />)

    const learn = screen.getByRole('tab', { name: /^Learn/ })
    const practice = screen.getByRole('tab', { name: /^Practice/ })
    const mastery = screen.getByRole('tab', { name: /^Mastery/ })

    expect(mastery).toBeDisabled()
    expect(mastery).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(learn)
    expect(learn).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /CRRT-04 · Guided Learn/ })).toBeInTheDocument()

    fireEvent.click(practice)
    expect(practice).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: /CRRT-04 · Scored Practice/ })).toBeInTheDocument()
  })

  it('offers exactly the three approved pilot cases and loads CRRT-10 and CRRT-13 in Operations', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')

    const caseSelect = screen.getByRole('combobox', { name: 'Pilot case' })
    expect(
      within(caseSelect)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(['CRRT-04', 'CRRT-10', 'CRRT-13'])

    fireEvent.change(caseSelect, { target: { value: 'CRRT-10' } })
    expect(screen.getByRole('heading', { name: /CRRT-10 · Guided Learn/ })).toBeInTheDocument()
    expect(screen.getByText('Interface run active')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Pilot case' }), {
      target: { value: 'CRRT-13' },
    })
    expect(screen.getByRole('heading', { name: /CRRT-13 · Guided Learn/ })).toBeInTheDocument()
    expect(screen.getByText('Interface run active')).toBeInTheDocument()
    expect(screen.getByText('Pressure display')).toBeInTheDocument()
  })

  it('restores and announces workflow focus after pathway, case, and clean-attempt remounts', async () => {
    const user = userEvent.setup()
    render(<BaxterCrrtLab />)

    const learnTab = screen.getByRole('tab', { name: /^Learn/ })
    await user.click(learnTab)
    expect(learnTab).toHaveFocus()

    await user.selectOptions(screen.getByRole('combobox', { name: 'Pilot case' }), 'CRRT-10')
    expect(
      screen.getByRole('heading', { name: 'CRRT-10 · Guided Learn. Attempt 1.' }),
    ).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Clean attempt' }))
    expect(
      screen.getByRole('heading', { name: 'CRRT-10 · Guided Learn. Attempt 2.' }),
    ).toHaveFocus()

    const practiceTab = screen.getByRole('tab', { name: /^Practice/ })
    await user.click(practiceTab)
    expect(practiceTab).toHaveFocus()
    expect(
      screen.getByRole('heading', { name: 'CRRT-10 · Scored Practice. Attempt 2.' }),
    ).toBeInTheDocument()

    const orientationTab = screen.getByRole('tab', { name: /^Orientation/ })
    await user.click(orientationTab)
    expect(orientationTab).toHaveFocus()
    await user.click(learnTab)
    expect(learnTab).toHaveFocus()
  })

  it('requires all five prediction fields before unlocking machine and action controls', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')

    const commit = screen.getByRole('button', { name: /Commit prediction/ })
    const newPatient = screen.getByRole('button', { name: /New Patient/ })
    expect(commit).toBeEnabled()
    expect(newPatient).toBeDisabled()
    expect(screen.getByText('Prediction commitment required')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Perform' })).not.toBeInTheDocument()

    completeFiveFieldPrediction()
    expect(commit).toBeEnabled()
    fireEvent.click(commit)

    expect(screen.queryByText('Prediction commitment required')).not.toBeInTheDocument()
    expect(newPatient).toBeEnabled()
    expect(screen.getAllByRole('button', { name: 'Perform' }).length).toBeGreaterThan(0)
  })

  it('offers deterministic fixed time intervals while preserving the existing increments', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')

    const controls = screen.getByRole('group', { name: 'Advance simulated time' })
    const intervalLabels = ['+1 min', '+5 min', '+15 min', '+30 min', '+1 hr', '+6 hr']
    for (const label of intervalLabels) {
      expect(within(controls).getByRole('button', { name: label })).toBeDisabled()
    }
    expect(
      within(controls).getByRole('button', { name: 'Advance to next scheduled event' }),
    ).toBeDisabled()

    completeFiveFieldPrediction()
    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))

    for (const label of intervalLabels) {
      const button = within(controls).getByRole('button', { name: label })
      expect(button).toBeEnabled()
      fireEvent.click(button)
    }
    expect(within(controls).getByText('471 min')).toBeInTheDocument()
  })

  it('advances only to event times already present in the seeded engine queue', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')
    completeFiveFieldPrediction()
    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))

    const controls = screen.getByRole('group', { name: 'Advance simulated time' })
    fireEvent.click(
      within(controls).getByRole('button', { name: 'Advance to next scheduled event' }),
    )
    expect(within(controls).getByText('120 min')).toBeInTheDocument()

    fireEvent.click(
      within(controls).getByRole('button', { name: 'Advance to next scheduled event' }),
    )
    expect(within(controls).getByText('180 min')).toBeInTheDocument()
    expect(
      within(controls).queryByRole('button', { name: 'Advance to next scheduled event' }),
    ).not.toBeInTheDocument()
  })

  it('announces an incomplete keyboard submission and links each error to its required field', async () => {
    const user = userEvent.setup()
    render(<BaxterCrrtLab />)
    openPathway('Learn')

    const commit = screen.getByRole('button', { name: /Commit prediction/ })
    commit.focus()
    await user.keyboard('{Enter}')

    const summary = await screen.findByRole('alert', { name: 'Prediction not committed' })
    expect(summary).toHaveFocus()
    expect(within(summary).getAllByRole('button')).toHaveLength(1)

    const goal = screen.getByRole('combobox', { name: '1 · Goal' })
    expect(goal).toBeRequired()
    expect(goal).toHaveAttribute('aria-invalid', 'true')
    expect(goal).toHaveAccessibleDescription(
      'Required. Choose one goal. Choose a goal before committing.',
    )
    const mechanism = screen.getByRole('combobox', { name: '2 · Mechanism' })
    const response = screen.getByRole('combobox', { name: '4 · Expected response' })
    for (const requiredSelect of [mechanism, response]) {
      expect(requiredSelect).toBeRequired()
      expect(requiredSelect).toHaveAttribute('aria-invalid', 'true')
      expect(requiredSelect).toHaveAttribute('aria-describedby')
    }

    const controlGroup = screen.getByRole('group', { name: '3 · Planned control' })
    const firstControl = within(controlGroup).getAllByRole('checkbox')[0]
    expect(controlGroup).toHaveAttribute('data-invalid', 'true')
    expect(controlGroup).toHaveAccessibleDescription(
      'Required. After defining a goal, select at least one planned control. Select a planned control before committing.',
    )
    expect(firstControl).toHaveAttribute('aria-invalid', 'true')

    const reassessmentGroup = screen.getByRole('group', { name: '5 · Reassessment plan' })
    const firstReassessment = within(reassessmentGroup).getAllByRole('checkbox')[0]
    expect(reassessmentGroup).toHaveAccessibleDescription(
      'Required. After choosing a mechanism and planned control, select at least one reassessment. Select a reassessment before committing.',
    )
    expect(firstReassessment).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: /New Patient/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Perform' })).not.toBeInTheDocument()

    const goToGoal = within(summary).getByRole('button', {
      name: 'Go to first missing field: 1 · Goal',
    })
    goToGoal.focus()
    await user.keyboard('{Enter}')
    expect(goal).toHaveFocus()
    expectCurrentReasoningStep('Define')

    const firstGoalChoice = within(goal)
      .getAllByRole('option')
      .find((option) => (option as HTMLOptionElement).value !== '') as HTMLOptionElement | undefined
    if (!firstGoalChoice) throw new Error('Expected an authored goal option.')
    await user.selectOptions(goal, firstGoalChoice.value)
    await user.tab()
    expect(mechanism).toHaveFocus()
    expectCurrentReasoningStep('Select')
  })

  it('renders every aria-current step from ordered canonical engine transitions', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')
    expectCurrentReasoningStep('Read')

    const goal = screen.getByRole('combobox', { name: '1 · Goal' })
    const mechanism = screen.getByRole('combobox', { name: '2 · Mechanism' })
    const plannedControl = screen.getByRole('group', { name: '3 · Planned control' })
    const response = screen.getByRole('combobox', { name: '4 · Expected response' })
    const plannedReassessment = screen.getByRole('group', { name: '5 · Reassessment plan' })

    expect(mechanism).toBeDisabled()
    expect(within(plannedControl).getAllByRole('checkbox')[0]).toBeDisabled()
    expect(response).toBeDisabled()
    expect(within(plannedReassessment).getAllByRole('checkbox')[0]).toBeDisabled()

    fireEvent.focus(goal)
    expectCurrentReasoningStep('Define')
    chooseFirstOption(goal)

    expect(mechanism).toBeEnabled()
    expect(within(plannedControl).getAllByRole('checkbox')[0]).toBeEnabled()
    fireEvent.focus(mechanism)
    expectCurrentReasoningStep('Select')
    chooseFirstOption(mechanism)
    fireEvent.click(within(plannedControl).getAllByRole('checkbox')[0])

    expect(response).toBeEnabled()
    expect(within(plannedReassessment).getAllByRole('checkbox')[0]).toBeEnabled()
    fireEvent.focus(response)
    expectCurrentReasoningStep('Predict')
    chooseFirstOption(response)
    fireEvent.click(within(plannedReassessment).getAllByRole('checkbox')[0])

    fireEvent.change(goal, { target: { value: '' } })
    expectCurrentReasoningStep('Define')
    expect(mechanism).toBeDisabled()
    expect(within(plannedControl).getAllByRole('checkbox')[0]).not.toBeChecked()
    expect(response).toBeDisabled()
    expect(response).toHaveValue('')
    expect(within(plannedReassessment).getAllByRole('checkbox')[0]).not.toBeChecked()

    chooseFirstOption(goal)
    fireEvent.focus(mechanism)
    expectCurrentReasoningStep('Select')
    chooseFirstOption(mechanism)
    fireEvent.click(within(plannedControl).getAllByRole('checkbox')[0])
    fireEvent.focus(response)
    expectCurrentReasoningStep('Predict')
    chooseFirstOption(response)
    fireEvent.click(within(plannedReassessment).getAllByRole('checkbox')[0])

    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))
    expectCurrentReasoningStep('Run')

    const firstAvailableAction = screen
      .getAllByRole('button', { name: 'Perform' })
      .find((button) => !button.hasAttribute('disabled'))
    if (!firstAvailableAction) throw new Error('Expected at least one available intervention.')
    fireEvent.click(firstAvailableAction)
    expectCurrentReasoningStep('Run')

    fireEvent.click(screen.getByRole('button', { name: '+5 min' }))
    expectCurrentReasoningStep('Reassess')

    const reassessment = screen.getByRole('group', {
      name: 'Select every reassessment you actually completed',
    })
    fireEvent.click(within(reassessment).getAllByRole('checkbox')[0])
    fireEvent.click(within(reassessment).getByRole('button', { name: 'Commit reassessment' }))
    expectCurrentReasoningStep('Reflect')

    fireEvent.click(screen.getByRole('button', { name: /Reveal causal debrief/ }))
    expectCurrentReasoningStep('Reflect')
  })

  it('clears prediction, hints, and local selections when the case or pathway changes', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')
    completeFiveFieldPrediction()
    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal hint 1' }))

    expect(screen.queryByRole('button', { name: /Commit prediction/ })).not.toBeInTheDocument()
    expect(screen.queryByText('No hints revealed.')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Pilot case' }), {
      target: { value: 'CRRT-10' },
    })
    expect(screen.getByRole('button', { name: /Commit prediction/ })).toBeEnabled()
    expect(screen.getByText('No hints revealed.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '1 · Goal' })).toHaveValue('')

    openPathway('Practice')
    expect(screen.getByRole('button', { name: /Commit prediction/ })).toBeEnabled()
    expect(screen.getByText('No hints revealed.')).toBeInTheDocument()
    expect(screen.getByText('Interface run active')).toBeInTheDocument()
  })

  it('supports hint, intervention, reassessment, and scored Practice debrief', () => {
    render(<BaxterCrrtLab />)
    openPathway('Practice')
    completeFiveFieldPrediction()
    fireEvent.click(screen.getByRole('button', { name: /Commit prediction/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal hint 1' }))

    const firstAvailableAction = screen
      .getAllByRole('button', { name: 'Perform' })
      .find((button) => !button.hasAttribute('disabled'))
    if (!firstAvailableAction) throw new Error('Expected at least one available intervention.')
    fireEvent.click(firstAvailableAction)

    expect(
      within(
        screen.getByRole('group', {
          name: 'Select every reassessment you actually completed',
        }),
      ).getAllByRole('checkbox')[0],
    ).toBeDisabled()
    expect(
      screen.getByText('Advance simulated time by a positive interval before reassessment.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+5 min' }))

    const reassessment = screen.getByRole('group', {
      name: 'Select every reassessment you actually completed',
    })
    fireEvent.click(within(reassessment).getAllByRole('checkbox')[0])
    fireEvent.click(within(reassessment).getByRole('button', { name: 'Commit reassessment' }))
    fireEvent.click(screen.getByRole('button', { name: /Reveal causal debrief/ }))

    expect(screen.getByRole('region', { name: 'Practice score' })).toHaveTextContent(/\/100/)
    expect(screen.getByRole('region', { name: 'Practice score' })).toHaveTextContent(
      '5 hint-penalty points',
    )
    expect(screen.getByText('Causal debrief')).toBeInTheDocument()

    const attemptEvidence = screen.getByRole('region', { name: 'Actual attempt evidence' })
    expect(attemptEvidence).toHaveTextContent('Committed control plan')
    expect(attemptEvidence).toHaveTextContent('Performed interventions')
    expect(attemptEvidence).toHaveTextContent('Missed required actions')
    expect(attemptEvidence).toHaveTextContent('Recorded action timeline')

    const trendEvidence = within(attemptEvidence).getByRole('region', {
      name: /Actual attempt sampled trend evidence/i,
    })
    expect(trendEvidence).toHaveAttribute('tabindex', '0')
    expect(trendEvidence).toHaveTextContent('Prescribed effluent dose')
    expect(trendEvidence).toHaveTextContent('Delivered dose')
    expect(trendEvidence).toHaveTextContent('Whole-patient balance')
    expect(trendEvidence).toHaveTextContent('Access pressure')
    expect(trendEvidence).toHaveTextContent('potassium')
  })

  it('keeps the calibration panel out of production and non-development renders', () => {
    expect(shouldRenderCrrtCalibrationPanel('development')).toBe(true)
    expect(shouldRenderCrrtCalibrationPanel('production')).toBe(false)
    expect(shouldRenderCrrtCalibrationPanel('test')).toBe(false)

    render(<BaxterCrrtLab />)
    openPathway('Learn')
    expect(screen.queryByTestId('crrt-development-calibration')).not.toBeInTheDocument()
  })

  it('masks the case title and removes all hint controls in a Mastery session', () => {
    const caseDefinition = getBaxterCrrtPilotCase('CRRT-04')
    const practiceSession = createCrrtLearningSession({
      caseDefinition,
      experience: 'practice',
      roleLens: 'integrated',
      attempt: 1,
    })
    const session = {
      ...practiceSession,
      experience: 'mastery' as const,
      simulation: { ...practiceSession.simulation, experience: 'mastery' as const },
    }

    const { container } = render(
      <CrrtLearningWorkflow
        session={session}
        dispatch={jest.fn()}
        availableCases={[caseDefinition]}
        mobileSurface="case"
        onCaseChange={jest.fn()}
        onRoleChange={jest.fn()}
        onReset={jest.fn()}
      />,
    )

    const caseSelector = screen.getByRole('combobox', { name: 'Mastery capstone' })
    expect(caseSelector).toBeDisabled()
    expect(caseSelector).toHaveValue('mastery-masked')
    expect(caseSelector).toHaveAttribute('aria-describedby', 'crrt-mastery-boundary')
    expect(screen.getByRole('heading', { name: 'Unseen PrisMax capstone' })).toBeInTheDocument()
    expect(container).not.toHaveTextContent(caseDefinition.title)
    expect(container.innerHTML).not.toContain(caseDefinition.title)
    expect(screen.getByRole('note', { name: 'Mastery safeguards.' })).toHaveTextContent(
      /identity remains masked until causal debrief/i,
    )
    expect(screen.queryByRole('heading', { name: /hint/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument()
    expect(
      screen.queryByText(/hint ladder|no hints in mastery|requests are rejected/i),
    ).not.toBeInTheDocument()
  })

  it('masks the underlying case identity across the fully composed lab before Mastery debrief', () => {
    const caseDefinition = getBaxterCrrtPilotCase('CRRT-04')
    mockForceMaskedMasteryComposition = true
    const originalNodeEnvironment = process.env.NODE_ENV
    Object.defineProperty(process.env, 'NODE_ENV', {
      configurable: true,
      value: 'development',
    })

    try {
      const { container } = render(<BaxterCrrtLab />)
      fireEvent.click(screen.getByRole('tab', { name: /^Learn/ }))

      expect(screen.getByRole('tab', { name: /^Mastery/ })).toBeDisabled()
      expect(screen.getByRole('note', { name: 'Mastery safeguards.' })).toBeInTheDocument()
      expect(
        screen.getByRole('heading', {
          name: 'Start Masked case: Unseen PrisMax capstone',
        }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('heading', {
          name: 'Full PrisMax curriculum—mapped, not activated',
        }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('heading', { name: 'What this draft can—and cannot—claim' }),
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('crrt-development-calibration')).not.toBeInTheDocument()

      expect(container).not.toHaveTextContent(caseDefinition.id)
      expect(container).not.toHaveTextContent(caseDefinition.title)
      expect(container).not.toHaveTextContent('SYNTH-CRRT-04')
      expect(container.innerHTML).not.toContain(caseDefinition.id)
      expect(container.innerHTML).not.toContain(caseDefinition.title)
      expect(container.innerHTML).not.toContain('SYNTH-CRRT-04')
    } finally {
      mockForceMaskedMasteryComposition = false
      Object.defineProperty(process.env, 'NODE_ENV', {
        configurable: true,
        value: originalNodeEnvironment,
      })
    }
  })
})
