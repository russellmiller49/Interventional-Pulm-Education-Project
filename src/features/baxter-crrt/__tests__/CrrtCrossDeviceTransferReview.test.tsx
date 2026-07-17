import { render, screen, within } from '@testing-library/react'

import { CrrtCrossDeviceTransferReview } from '../components/CrrtCrossDeviceTransferReview'

describe('CrrtCrossDeviceTransferReview', () => {
  it('renders a reviewer-only, fail-closed comparison plan', () => {
    const { container } = render(<CrrtCrossDeviceTransferReview />)
    const shell = container.querySelector('[data-reviewer-only="true"]')

    expect(shell).not.toBeNull()
    expect(shell).toHaveAttribute('data-learner-runtime', 'disabled')
    expect(shell).toHaveAttribute('data-scoring', 'none')
    expect(shell).toHaveAttribute('data-progress-write', 'none')
    expect(shell).toHaveAttribute('data-analytics', 'none')
    expect(shell).toHaveAttribute('data-competency', 'none')
    expect(screen.getByText('No equivalence claim is available.')).toBeInTheDocument()
    expect(screen.getByText('Learner runtime locked')).toBeInTheDocument()
  })

  it('keeps the two device questions distinct for every planned domain', () => {
    render(<CrrtCrossDeviceTransferReview />)

    const domainHeadings = screen
      .getAllByRole('heading', { level: 4 })
      .filter((heading) => /translation$/.test(heading.textContent ?? ''))
    expect(domainHeadings).toHaveLength(5)

    for (const heading of domainHeadings) {
      const card = heading.closest('article')
      expect(card).not.toBeNull()
      expect(within(card as HTMLElement).getByText('PrisMax')).toBeInTheDocument()
      expect(within(card as HTMLElement).getByText('Prismaflex')).toBeInTheDocument()
      expect(within(card as HTMLElement).getByText('Boundary')).toBeInTheDocument()
    }
  })

  it('shows every prerequisite as pending without offering an activation control', () => {
    const { container } = render(<CrrtCrossDeviceTransferReview />)
    expect(screen.getAllByText('Pending')).toHaveLength(5)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('form')).toBeNull()
  })
})
