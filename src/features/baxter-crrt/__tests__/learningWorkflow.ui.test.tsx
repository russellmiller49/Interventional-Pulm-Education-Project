import { fireEvent, render, screen, within } from '@testing-library/react'

import BaxterCrrtLab from '../components/BaxterCrrtLab'
import { shouldRenderCrrtCalibrationPanel } from '../components/CrrtCalibrationPanel'

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

  it('requires all five prediction fields before unlocking machine and action controls', () => {
    render(<BaxterCrrtLab />)
    openPathway('Learn')

    const commit = screen.getByRole('button', { name: /Commit prediction/ })
    const newPatient = screen.getByRole('button', { name: /New Patient/ })
    expect(commit).toBeDisabled()
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
    expect(screen.getByRole('button', { name: /Commit prediction/ })).toBeDisabled()
    expect(screen.getByText('No hints revealed.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: '1 · Goal' })).toHaveValue('')

    openPathway('Practice')
    expect(screen.getByRole('button', { name: /Commit prediction/ })).toBeDisabled()
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
  })

  it('keeps the calibration panel out of production and non-development renders', () => {
    expect(shouldRenderCrrtCalibrationPanel('development')).toBe(true)
    expect(shouldRenderCrrtCalibrationPanel('production')).toBe(false)
    expect(shouldRenderCrrtCalibrationPanel('test')).toBe(false)

    render(<BaxterCrrtLab />)
    openPathway('Learn')
    expect(screen.queryByTestId('crrt-development-calibration')).not.toBeInTheDocument()
  })
})
