import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtRapidDrillReview } from '../components/CrrtRapidDrillReview'
import {
  CRRT_CAUSE_FIRST_STEPS,
  CRRT_REVIEWER_RAPID_DRILL_IDS,
  getCrrtReviewerRapidDrill,
} from '../content'

describe('CRRT reviewer-only rapid-drill interface', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('holds the signal and actions behind a committed prediction without persistence', () => {
    render(<CrrtRapidDrillReview />)

    const review = screen.getByTestId('crrt-rapid-drill-review')
    expect(review).toHaveAttribute('data-reviewer-only', 'true')
    expect(review).toHaveAttribute('data-review-status', 'pending')
    expect(review).toHaveAttribute('data-learner-runnable', 'false')
    expect(review).toHaveAttribute('data-scoring', 'none')
    expect(review).toHaveAttribute('data-analytics', 'none')
    expect(review).toHaveAttribute('data-progress-write', 'none')
    expect(review).toHaveAttribute('data-persistence', 'none')
    expect(review).toHaveAttribute('data-competency', 'none')
    expect(review).toHaveAttribute('data-correction-verification', 'not-reviewed')
    expect(
      within(review).getByRole('note', { name: 'Non-actionable reviewer prototype.' }),
    ).toHaveTextContent(/no alarm threshold, device correction sequence.*score/i)

    const selector = within(review).getByRole('combobox', {
      name: 'Rapid-drill reviewer candidate',
    })
    expect(
      within(selector)
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value),
    ).toEqual([...CRRT_REVIEWER_RAPID_DRILL_IDS])
    expect(within(selector).queryByRole('option', { name: /wrong solution/i })).toBeNull()
    expect(within(selector).queryByRole('option', { name: /blood-return/i })).toBeNull()

    const drill = getCrrtReviewerRapidDrill('DRILL-AIR')
    expect(screen.queryByText(drill.openingSignal)).toBeNull()
    expect(screen.queryByRole('button', { name: /acknowledge signal/i })).toBeNull()
    expect(screen.queryByRole('heading', { name: /review each gate/i })).toBeNull()

    const commit = within(review).getByRole('button', { name: 'Commit reviewer prediction' })
    expect(commit).toBeDisabled()
    fireEvent.click(
      within(review).getByRole('radio', {
        name: new RegExp(drill.predictionOptions[0].label, 'i'),
      }),
    )
    expect(commit).toBeEnabled()
    fireEvent.click(commit)

    expect(screen.getByText(drill.openingSignal)).toBeInTheDocument()
    expect(screen.getByText(drill.deviceResponseBoundary)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /review each gate/i })).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('does not treat acknowledgement as correction and exposes only the next ordered gate', () => {
    render(<CrrtRapidDrillReview />)

    const review = screen.getByTestId('crrt-rapid-drill-review')
    const drill = getCrrtReviewerRapidDrill('DRILL-AIR')
    fireEvent.click(
      within(review).getByRole('radio', {
        name: new RegExp(drill.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(review).getByRole('button', { name: 'Commit reviewer prediction' }))

    fireEvent.click(within(review).getByRole('button', { name: 'Acknowledge signal for review' }))
    expect(
      within(review).getByText(/Acknowledgement does not correct the cause or authorize/i),
    ).toBeInTheDocument()
    expect(review).toHaveAttribute('data-correction-verification', 'not-reviewed')
    expect(
      within(review).getByText(/Correction-verification gate not reviewed/i),
    ).toBeInTheDocument()

    for (const [index, step] of CRRT_CAUSE_FIRST_STEPS.entries()) {
      const currentButton = within(review).getByRole('button', {
        name: `Mark reviewed: ${step.label}`,
      })
      expect(currentButton).toBeEnabled()
      if (index + 1 < CRRT_CAUSE_FIRST_STEPS.length) {
        expect(
          within(review).getByRole('button', {
            name: `Locked: ${CRRT_CAUSE_FIRST_STEPS[index + 1].label}`,
          }),
        ).toBeDisabled()
      }
      fireEvent.click(currentButton)
      expect(within(review).getAllByText('Reviewed')).toHaveLength(index + 1)
      expect(review).toHaveAttribute(
        'data-correction-verification',
        index >= 3 ? 'reviewed' : 'not-reviewed',
      )
    }

    expect(within(review).getByText(/6 of 6 review gates complete/i)).toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('starts a clean non-revealed state when the candidate changes or resets', () => {
    render(<CrrtRapidDrillReview />)

    const review = screen.getByTestId('crrt-rapid-drill-review')
    const air = getCrrtReviewerRapidDrill('DRILL-AIR')
    fireEvent.click(
      within(review).getByRole('radio', {
        name: new RegExp(air.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(review).getByRole('button', { name: 'Commit reviewer prediction' }))
    fireEvent.click(
      within(review).getByRole('button', {
        name: `Mark reviewed: ${CRRT_CAUSE_FIRST_STEPS[0].label}`,
      }),
    )

    fireEvent.change(
      within(review).getByRole('combobox', { name: 'Rapid-drill reviewer candidate' }),
      { target: { value: 'DRILL-POWER' } },
    )
    const power = getCrrtReviewerRapidDrill('DRILL-POWER')
    expect(screen.queryByText(power.openingSignal)).toBeNull()
    expect(
      within(review).getByText(/signal and all review actions remain hidden/i),
    ).toBeInTheDocument()
    expect(
      within(review).getByRole('button', { name: 'Commit reviewer prediction' }),
    ).toBeDisabled()
    expect(review).toHaveAttribute('data-correction-verification', 'not-reviewed')

    fireEvent.click(
      within(review).getByRole('radio', {
        name: new RegExp(power.predictionOptions[0].label, 'i'),
      }),
    )
    fireEvent.click(within(review).getByRole('button', { name: 'Reset drill preview' }))
    expect(
      within(review).getByRole('button', { name: 'Commit reviewer prediction' }),
    ).toBeDisabled()
    expect(
      within(review)
        .getAllByRole('radio')
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true)
    expect(window.localStorage).toHaveLength(0)
  })
})
