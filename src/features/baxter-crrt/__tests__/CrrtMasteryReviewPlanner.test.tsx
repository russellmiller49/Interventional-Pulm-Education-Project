import { fireEvent, render, screen, within } from '@testing-library/react'

import { recordSiteModuleEvent } from '@/lib/analytics'

import { CrrtMasteryReviewPlanner } from '../components/CrrtMasteryReviewPlanner'

jest.mock('@/lib/analytics', () => ({
  recordSiteModuleEvent: jest.fn(),
}))

describe('Phase 7 Mastery composition planner UI', () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.mocked(recordSiteModuleEvent).mockClear()
  })

  it('renders an explicit reviewer-only boundary and all frozen candidate rules', () => {
    render(<CrrtMasteryReviewPlanner />)

    const planner = screen.getByTestId('crrt-mastery-review-planner')
    expect(planner).toHaveAttribute('data-reviewer-only', 'true')
    expect(planner).toHaveAttribute('data-review-status', 'pending')
    expect(planner).toHaveAttribute('data-rule-status', 'unapproved-candidate-rules')
    expect(planner).toHaveAttribute('data-capstone-runtime', 'none')
    expect(planner).toHaveAttribute('data-session-creation', 'none')
    expect(planner).toHaveAttribute('data-scoring', 'none')
    expect(planner).toHaveAttribute('data-analytics', 'none')
    expect(planner).toHaveAttribute('data-progress-write', 'none')
    expect(planner).toHaveAttribute('data-persistence', 'none')
    expect(planner).toHaveAttribute('data-competency', 'none')
    expect(planner).toHaveAttribute('data-learner-selection', 'none')
    expect(
      within(planner).getByRole('note', { name: 'Composition preview—not a Mastery session.' }),
    ).toHaveTextContent(
      /no capstone runtime, score, attempt, analytics, progress, local storage, competency, or learner activity/i,
    )

    expect(within(planner).getByText('Unseen title before debrief')).toBeInTheDocument()
    expect(within(planner).getByText('No hints')).toBeInTheDocument()
    expect(within(planner).getByText('Clean initial state')).toBeInTheDocument()
    expect(within(planner).getByText('At least 2 problem domains')).toBeInTheDocument()
    expect(within(planner).getByText('Reassessment required')).toBeInTheDocument()
    expect(within(planner).getByText('Candidate score ≥ 80%')).toBeInTheDocument()
    expect(within(planner).getByText('Zero critical errors allowed')).toBeInTheDocument()
    expect(within(planner).getAllByText('Unapproved candidate rule')).toHaveLength(7)
    expect(window.localStorage).toHaveLength(0)
    expect(recordSiteModuleEvent).not.toHaveBeenCalled()
  })

  it('offers only the seven pending reviewer cases as thematic checkboxes', () => {
    render(<CrrtMasteryReviewPlanner />)

    const group = screen.getByRole('group', { name: 'Pending reviewer case themes' })
    const caseIds = within(group)
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.closest('label')?.textContent?.match(/CRRT-\d{2}/)?.[0])

    expect(caseIds).toEqual([
      'CRRT-01',
      'CRRT-02',
      'CRRT-05',
      'CRRT-06',
      'CRRT-07',
      'CRRT-11',
      'CRRT-15',
    ])
    expect(within(group).queryByRole('checkbox', { name: /CRRT-04/ })).not.toBeInTheDocument()
    expect(within(group).queryByRole('checkbox', { name: /CRRT-09/ })).not.toBeInTheDocument()
  })

  it('previews multi-domain selection without unlocking or creating Mastery', () => {
    render(<CrrtMasteryReviewPlanner />)

    fireEvent.click(screen.getByRole('checkbox', { name: /CRRT-01/ }))
    expect(
      screen.getByRole('heading', { name: '1 source candidate · 1 problem domain' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/This will not unlock Mastery/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /CRRT-15/ }))
    expect(
      screen.getByRole('heading', { name: '2 source candidates · 2 problem domains' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/minimum of 2 problem domains is represented for reviewer discussion only/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/No capstone runtime is created/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /start|score|complete|submit/i }),
    ).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
    expect(recordSiteModuleEvent).not.toHaveBeenCalled()
  })

  it('clears the ephemeral composition draft without persistence', () => {
    render(<CrrtMasteryReviewPlanner />)

    fireEvent.click(screen.getByRole('checkbox', { name: /CRRT-05/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /CRRT-11/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear draft' }))

    expect(
      screen.getByRole('heading', { name: '0 source candidates · 0 problem domains' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No themes selected.')).toBeInTheDocument()
    expect(
      screen.getAllByRole('checkbox').every((checkbox) => !checkbox.hasAttribute('checked')),
    ).toBe(true)
    expect(window.localStorage).toHaveLength(0)
    expect(recordSiteModuleEvent).not.toHaveBeenCalled()
  })
})
