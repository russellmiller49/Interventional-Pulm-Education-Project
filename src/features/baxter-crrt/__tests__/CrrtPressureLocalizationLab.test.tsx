import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtPressureLocalizationLab } from '../components/CrrtPressureLocalizationLab'

function chooseEveryPrediction(direction: 'Lower' | 'Unchanged' | 'Higher') {
  for (const signal of [
    'Access pressure',
    'Filter pressure',
    'Return pressure',
    'Effluent pressure',
    'TMP',
    'Filter pressure drop',
  ]) {
    fireEvent.click(
      within(screen.getByRole('group', { name: signal })).getByRole('radio', {
        name: direction,
      }),
    )
  }
}

describe('learner Pressure Localization Lab UI', () => {
  beforeEach(() => window.localStorage.clear())

  it('states the educational boundary and keeps source limitations informational', () => {
    render(<CrrtPressureLocalizationLab />)

    const lab = screen.getByRole('region', { name: 'Pressure Localization Lab' })
    expect(lab).toHaveAttribute('data-reviewer-only', 'false')
    expect(lab).toHaveAttribute('data-review-metadata', 'informational')
    expect(lab).toHaveAttribute('data-scoring', 'tool-specific')
    expect(lab).toHaveAttribute('data-progress-write', 'learner-mode-only')
    expect(lab).toHaveAttribute('data-persistence', 'learner-mode-only')
    expect(within(lab).getByRole('note', { name: 'Educational boundary' })).toHaveTextContent(
      'Practice localizing a circuit problem from pressure direction',
    )
    expect(within(lab).getByText(/alarm priority, automatic device response/i)).toBeInTheDocument()
    expect(within(lab).getByLabelText('Lab scope')).toHaveTextContent('Scope of this lab')
    expect(within(lab).getByText(/does not establish a clinical normal/i)).toBeVisible()
    expect(lab.querySelector('form')).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('keeps catheter and line as separate placement controls with an accessible diagram summary', () => {
    render(<CrrtPressureLocalizationLab />)

    expect(screen.getByRole('radio', { name: 'Access catheter' })).toBeChecked()
    expect(
      screen.getByRole('img', {
        name: /obstruction at the access catheter.*separate teaching locations/i,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Access line' }))

    expect(screen.getByRole('radio', { name: 'Access line' })).toBeChecked()
    expect(
      screen.getByRole('img', {
        name: /obstruction at the access line.*separate teaching locations/i,
      }),
    ).toBeInTheDocument()
  })

  it('keeps disconnection visible but fails the entire unsupported model closed', () => {
    render(<CrrtPressureLocalizationLab />)

    const disconnection = screen.getByRole('radio', { name: /^Disconnection/i })
    expect(disconnection).toBeDisabled()
    expect(disconnection).toHaveAccessibleDescription(
      'Pattern unavailable in this version of the lab',
    )
    expect(screen.getByText('Pattern unavailable in this version of the lab')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Access catheter' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Access line' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Filter' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Return line' })).toBeEnabled()
    expect(screen.getByRole('radio', { name: 'Effluent line' })).toBeEnabled()
  })

  it('requires a complete committed prediction and a separate reveal action', () => {
    render(<CrrtPressureLocalizationLab />)

    const commitButton = screen.getByRole('button', { name: 'Commit prediction' })
    expect(commitButton).toBeDisabled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    chooseEveryPrediction('Unchanged')
    expect(commitButton).toBeEnabled()
    fireEvent.click(commitButton)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Prediction submitted. The pressure result is still hidden.',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal pressure pattern' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Reveal pressure pattern' }))

    const table = screen.getByRole('table', {
      name: 'Pressure directions relative to the starting values',
    })
    expect(table).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(7)
    expect(
      within(table).getByRole('row', { name: /Access pressure Unchanged Lower/i }),
    ).toHaveTextContent('-15 mmHg → -35 mmHg')
    expect(screen.getByText(/does not provide a clinical normal, alarm limit/i)).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('hides the result again when the learner revises the prediction', () => {
    render(<CrrtPressureLocalizationLab />)
    chooseEveryPrediction('Higher')
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal pressure pattern' }))
    expect(screen.getByRole('table')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Revise prediction' }))

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeEnabled()
  })
})
