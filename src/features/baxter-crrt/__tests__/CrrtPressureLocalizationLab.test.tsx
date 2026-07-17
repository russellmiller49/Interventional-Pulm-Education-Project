import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtPressureLocalizationLab } from '../components/CrrtPressureLocalizationLab'
import { pressureLocalizationCandidateSourceIds } from '../pressureLocalizationLabModel'

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

describe('reviewer-only Pressure Localization Lab UI', () => {
  beforeEach(() => window.localStorage.clear())

  it('states the pending boundary and remains isolated from progress and persistence', () => {
    render(<CrrtPressureLocalizationLab />)

    const lab = screen.getByRole('region', { name: 'Pressure Localization Lab' })
    expect(lab).toHaveAttribute('data-reviewer-only', 'true')
    expect(lab).toHaveAttribute('data-review-status', 'pending')
    expect(lab).toHaveAttribute('data-scoring', 'none')
    expect(lab).toHaveAttribute('data-progress-write', 'none')
    expect(lab).toHaveAttribute('data-persistence', 'none')
    expect(within(lab).getByRole('note', { name: 'Reviewer-only boundary' })).toHaveTextContent(
      'not available to learners',
    )
    expect(
      within(lab).getByText(/no alarm priority, automatic device response/i),
    ).toBeInTheDocument()
    expect(within(lab).getByLabelText('Candidate source records')).toHaveTextContent(
      'Candidate source records · review pending',
    )
    for (const sourceId of pressureLocalizationCandidateSourceIds) {
      expect(within(lab).getByText(sourceId)).toBeVisible()
    }
    expect(
      within(lab).getByText(/do not validate the authored obstruction directions/i),
    ).toBeVisible()
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
      'Pattern unavailable pending source and device review',
    )
    expect(screen.getByText('Pattern unavailable pending source and device review')).toBeVisible()
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
      'Prediction committed. The synthetic result is still hidden.',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reveal synthetic pattern' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Reveal synthetic pattern' }))

    const table = screen.getByRole('table', {
      name: 'Pressure directions relative to the arbitrary synthetic baseline',
    })
    expect(table).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(7)
    expect(
      within(table).getByRole('row', { name: /Access pressure Unchanged Lower/i }),
    ).toHaveTextContent('-15 mmHg → -35 mmHg')
    expect(
      screen.getByText(/provides no clinical normal, threshold, device response/i),
    ).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('hides the result again when the reviewer revises the prediction', () => {
    render(<CrrtPressureLocalizationLab />)
    chooseEveryPrediction('Higher')
    fireEvent.click(screen.getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reveal synthetic pattern' }))
    expect(screen.getByRole('table')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Revise prediction' }))

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Commit prediction' })).toBeEnabled()
  })
})
