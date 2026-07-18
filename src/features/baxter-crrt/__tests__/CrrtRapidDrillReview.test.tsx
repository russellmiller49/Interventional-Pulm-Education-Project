import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtRapidDrillReview } from '../components/CrrtRapidDrillReview'
import { CRRT_CAUSE_FIRST_STEPS, CRRT_RAPID_DRILL_IDS, getCrrtReviewerRapidDrill } from '../content'

describe('CRRT runnable rapid-drill interface', () => {
  beforeEach(() => window.localStorage.clear())

  it('exposes all seven drills and holds the signal behind a prediction commitment', () => {
    render(<CrrtRapidDrillReview />)

    const drillUi = screen.getByTestId('crrt-rapid-drill-review')
    expect(drillUi).toHaveAttribute('data-reviewer-only', 'false')
    expect(drillUi).toHaveAttribute('data-learner-runnable', 'true')
    expect(drillUi).toHaveAttribute('data-analytics', 'allowlisted')

    const selector = within(drillUi).getByRole('combobox', { name: 'Rapid drill' })
    expect(
      within(selector)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual(CRRT_RAPID_DRILL_IDS)

    const drill = getCrrtReviewerRapidDrill('DRILL-AIR')
    expect(screen.queryByText(drill.openingSignal)).not.toBeInTheDocument()
    const commit = within(drillUi).getByRole('button', { name: 'Commit prediction' })
    expect(commit).toBeDisabled()
    fireEvent.click(
      within(drillUi).getByRole('radio', {
        name: new RegExp(drill.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(commit)
    expect(screen.getByText(drill.openingSignal)).toBeInTheDocument()
  })

  it('separates acknowledgement from correction and completes the cause-first sequence', () => {
    render(<CrrtRapidDrillReview />)
    const drillUi = screen.getByTestId('crrt-rapid-drill-review')
    const drill = getCrrtReviewerRapidDrill('DRILL-AIR')
    fireEvent.click(
      within(drillUi).getByRole('radio', {
        name: new RegExp(drill.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Commit prediction' }))
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Acknowledge signal' }))
    expect(within(drillUi).getByRole('status')).toHaveTextContent(
      /Acknowledgement does not correct the cause/i,
    )

    for (const step of CRRT_CAUSE_FIRST_STEPS) {
      fireEvent.click(within(drillUi).getByRole('button', { name: `Complete: ${step.label}` }))
    }
    expect(drillUi).toHaveAttribute('data-correction-verification', 'reviewed')
    expect(within(drillUi).getByText(/6 of 6 steps complete.*Outcome: safe/i)).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('starts a clean state when a learner changes drills or resets', () => {
    render(<CrrtRapidDrillReview />)
    const drillUi = screen.getByTestId('crrt-rapid-drill-review')
    fireEvent.change(within(drillUi).getByRole('combobox', { name: 'Rapid drill' }), {
      target: { value: 'DRILL-BLOOD-RETURN' },
    })
    const selected = getCrrtReviewerRapidDrill('DRILL-BLOOD-RETURN')
    fireEvent.click(
      within(drillUi).getByRole('radio', {
        name: new RegExp(selected.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Commit prediction' }))
    expect(screen.getByText(selected.openingSignal)).toBeInTheDocument()
    fireEvent.click(within(drillUi).getByRole('button', { name: 'Reset drill' }))
    expect(screen.queryByText(selected.openingSignal)).not.toBeInTheDocument()
    expect(within(drillUi).getByRole('button', { name: 'Commit prediction' })).toBeDisabled()
  })
})
