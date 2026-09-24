import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtRapidDrillReview } from '../components/CrrtRapidDrillReview'
import { CRRT_CAUSE_FIRST_STEPS, CRRT_RAPID_DRILL_IDS, getCrrtReviewerRapidDrill } from '../content'

describe('CRRT runnable rapid-drill interface', () => {
  beforeEach(() => window.localStorage.clear())

  it('exposes all five drills and holds the signal behind a prediction commitment', () => {
    render(<CrrtRapidDrillReview />)

    const drillUi = screen.getByTestId('crrt-rapid-drill-review')
    expect(drillUi).toHaveAttribute('data-reviewer-only', 'false')
    expect(drillUi).toHaveAttribute('data-learner-runnable', 'true')
    expect(drillUi).toHaveAttribute('data-analytics', 'none')

    const selector = within(drillUi).getByRole('combobox', { name: 'Rapid drill' })
    expect(
      within(selector)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(CRRT_RAPID_DRILL_IDS)

    const drill = getCrrtReviewerRapidDrill('DRILL-AIR')
    expect(screen.queryByText(drill.openingSignal)).not.toBeInTheDocument()
    const commit = within(drillUi).getByRole('button', { name: 'Check this response' })
    expect(commit).toBeDisabled()
    fireEvent.click(
      within(drillUi).getByRole('radio', {
        name: new RegExp(drill.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(commit)
    expect(screen.getByText(drill.openingSignal)).toBeInTheDocument()
  })

  it('separates acknowledgement from correction and reviews the sequence without claiming cause correction', () => {
    render(<CrrtRapidDrillReview />)
    const drillUi = screen.getByTestId('crrt-rapid-drill-review')
    const drill = getCrrtReviewerRapidDrill('DRILL-AIR')
    fireEvent.click(
      within(drillUi).getByRole('radio', {
        name: new RegExp(drill.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Check this response' }))
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Acknowledge signal' }))
    expect(within(drillUi).getByRole('status')).toHaveTextContent(
      /Acknowledgement does not resolve the cause/i,
    )

    for (const step of [...CRRT_CAUSE_FIRST_STEPS].reverse()) {
      fireEvent.click(within(drillUi).getByRole('button', { name: `Review: ${step.label}` }))
    }
    expect(drillUi).toHaveAttribute('data-correction-verification', 'not-reviewed')
    expect(
      within(drillUi).getByText(/Reviewing steps does not verify cause correction/),
    ).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('starts a clean state when a learner changes drills or resets', () => {
    render(<CrrtRapidDrillReview />)
    const drillUi = screen.getByTestId('crrt-rapid-drill-review')
    fireEvent.change(within(drillUi).getByRole('combobox', { name: 'Rapid drill' }), {
      target: { value: 'DRILL-WRONG-SOLUTION' },
    })
    const selected = getCrrtReviewerRapidDrill('DRILL-WRONG-SOLUTION')
    fireEvent.click(
      within(drillUi).getByRole('radio', {
        name: new RegExp(selected.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Check this response' }))
    expect(screen.getByText(selected.openingSignal)).toBeInTheDocument()
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Reset this drill' }))
    expect(screen.queryByText(selected.openingSignal)).not.toBeInTheDocument()
    expect(within(drillUi).getByRole('button', { name: 'Check this response' })).toBeDisabled()
  })
})
