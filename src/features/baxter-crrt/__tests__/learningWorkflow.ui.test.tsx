import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'

import BaxterCrrtLab from '../components/BaxterCrrtLab'
import { CRRT_CASE_ARTIFACT_IDS, getBaxterCrrtCase } from '../content'

function submitCrrt01ClinicalPlan() {
  const definition = getBaxterCrrtCase('CRRT-01')
  const hidden = definition.hiddenMechanism
  const plan = within(screen.getByRole('region', { name: 'Plan your approach before acting' }))
  fireEvent.change(plan.getByRole('combobox', { name: '1 · Goal' }), {
    target: { value: hidden.correctGoalOptionId },
  })
  fireEvent.change(plan.getByRole('combobox', { name: '2 · Mechanism' }), {
    target: { value: hidden.correctMechanismOptionId },
  })
  for (const id of hidden.correctControlOptionIds) {
    const option = definition.controlOptions.find((candidate) => candidate.id === id)
    if (!option) throw new Error(`Missing CRRT-01 control option ${id}.`)
    fireEvent.click(plan.getByRole('checkbox', { name: option.label }))
  }
  fireEvent.change(plan.getByRole('combobox', { name: '4 · Expected response' }), {
    target: { value: hidden.correctResponseOptionId },
  })
  for (const id of hidden.correctReassessmentOptionIds) {
    const option = definition.reassessmentOptions.find((candidate) => candidate.id === id)
    if (!option) throw new Error(`Missing CRRT-01 reassessment option ${id}.`)
    fireEvent.click(plan.getByRole('checkbox', { name: option.label }))
  }
  fireEvent.click(plan.getByRole('button', { name: 'Submit plan and prediction' }))
}

describe('Baxter CRRT v1 learner workspace', () => {
  beforeEach(() => window.localStorage.clear())

  it('offers Learn, Practice, Mastery, all 18 station-grouped cases, drills, and tools', () => {
    render(<BaxterCrrtLab />)

    const experiences = screen.getByRole('tablist', { name: 'CRRT learning experiences' })
    for (const label of ['Learn', 'Practice', 'Mastery', 'Drills', 'Tools']) {
      expect(within(experiences).getByRole('tab', { name: new RegExp(`^${label}`) })).toBeEnabled()
    }

    const caseSelect = screen.getByRole('combobox', { name: 'Station-grouped case' })
    expect(
      within(caseSelect)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(CRRT_CASE_ARTIFACT_IDS)
    expect(caseSelect.querySelectorAll('optgroup')).toHaveLength(6)

    fireEvent.click(within(experiences).getByRole('tab', { name: /^Drills/ }))
    expect(screen.getByRole('heading', { name: 'Rapid drills' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Rapid drill' })).toHaveLength(7)

    fireEvent.click(within(experiences).getByRole('tab', { name: /^Tools/ }))
    expect(screen.getByRole('heading', { name: 'Interactive concept labs' })).toBeInTheDocument()
    expect(screen.getByText('Six instructional tools')).toBeInTheDocument()
  })

  it('switches between both operational manual-reference device profiles', async () => {
    render(<BaxterCrrtLab />)

    const device = screen.getByRole('combobox', { name: 'Device profile' })
    expect(device).toHaveValue('prismax-aw8035-2xx')
    expect(screen.getByText(/procedure workflow/i)).toBeInTheDocument()

    fireEvent.change(device, { target: { value: 'prismaflex-g5036003-6xx' } })
    expect(device).toHaveValue('prismaflex-g5036003-6xx')
    expect(screen.getByText(/softkey workflow/i)).toBeInTheDocument()
    expect(screen.getAllByText(/G5036003/i).length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(screen.getByTestId('crrt-case-workflow').id).toMatch(/prismaflex-g5036003-6xx/),
    )
  })

  it('integrates the generated PrisMax machine simulator into the training surfaces', () => {
    render(<BaxterCrrtLab />)

    const surfaces = screen.getByRole('tablist', { name: 'CRRT mobile workspace surface' })
    const machineTab = within(surfaces).getByRole('tab', { name: 'Machine' })
    fireEvent.click(machineTab)

    const machinePanel = document.getElementById(machineTab.getAttribute('aria-controls') ?? '')
    expect(machinePanel).toHaveAttribute('data-mobile-active', 'true')
    expect(
      within(machinePanel as HTMLElement).getByRole('heading', {
        name: 'PrisMax machine simulator',
      }),
    ).toBeInTheDocument()
    expect(
      within(machinePanel as HTMLElement).getByRole('img', {
        name: /original front-facing educational illustration of a CRRT machine/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(machinePanel as HTMLElement).getByRole('region', {
        name: 'Original PrisMax functional educational facsimile',
      }),
    ).toBeInTheDocument()
    expect(
      within(machinePanel as HTMLElement).getByText(
        'Complete the clinical plan to unlock controls',
      ),
    ).toBeInTheDocument()
    expect(
      within(machinePanel as HTMLElement).getByRole('button', {
        name: 'Complete clinical plan',
      }),
    ).toBeEnabled()
    expect(within(machinePanel as HTMLElement).getByRole('button', { name: 'Stop' })).toBeDisabled()

    fireEvent.click(
      within(machinePanel as HTMLElement).getByRole('button', {
        name: 'Explore Solution pump deck',
      }),
    )
    expect(
      within(machinePanel as HTMLElement).getByText(
        /four pump positions provide spatial orientation to the circuit/i,
      ),
    ).toBeInTheDocument()

    fireEvent.click(
      within(machinePanel as HTMLElement).getByRole('button', {
        name: 'Complete clinical plan',
      }),
    )
    expect(within(surfaces).getByRole('tab', { name: 'Case' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('applies an authored case setting directly from the unlocked console', () => {
    render(<BaxterCrrtLab />)
    submitCrrt01ClinicalPlan()

    const surfaces = screen.getByRole('tablist', { name: 'CRRT mobile workspace surface' })
    const machineTab = within(surfaces).getByRole('tab', { name: 'Machine' })
    fireEvent.click(machineTab)
    const machinePanel = document.getElementById(machineTab.getAttribute('aria-controls') ?? '')
    const machine = within(machinePanel as HTMLElement)

    expect(
      machine.getByRole('heading', { name: 'Adjust case-relevant machine settings' }),
    ).toBeInTheDocument()
    const settingButton = machine.getByRole('button', {
      name: 'Apply case setting: Adjust machine fluid removal after assessment',
    })
    expect(settingButton).toBeDisabled()

    fireEvent.click(
      machine.getByRole('button', {
        name: 'Record clinical step: Complete the initial clinical assessment',
      }),
    )
    expect(settingButton).toBeEnabled()
    fireEvent.click(settingButton)

    expect(machine.getByLabelText('Pilot flow displays')).toHaveTextContent('70 mL/h')
    expect(settingButton).toHaveTextContent('Applied')
    expect(settingButton).toBeDisabled()
  })

  it('runs the masked PrisMax Mastery experience without hints and shows the transfer capstone', () => {
    render(<BaxterCrrtLab />)

    fireEvent.click(screen.getByRole('tab', { name: /^Mastery/ }))

    expect(screen.getByRole('heading', { name: 'Unseen PrisMax capstone' })).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Mastery safeguards.' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Reveal guidance/i })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Device profile' })).toBeDisabled()
    expect(screen.getByRole('combobox', { name: 'Station-grouped case' })).toBeDisabled()
    expect(
      screen.getByRole('heading', { name: 'Cross-device workflow translation capstone' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/does not claim.*clinically interchangeable/i)).toBeInTheDocument()
  })

  it('keeps final-SME preview functionality on while suppressing persistence and telemetry', () => {
    render(<BaxterCrrtLab sessionMode="review-preview" />)

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-session-mode', 'review-preview')
    expect(main).toHaveAttribute('data-analytics', 'suppressed')
    expect(main).toHaveAttribute('data-progress-write', 'suppressed')
    expect(screen.getByRole('tab', { name: /^Mastery/ })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Station-grouped case' })).toHaveLength(18)
  })
})
