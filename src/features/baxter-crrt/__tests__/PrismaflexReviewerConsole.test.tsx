import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PrismaflexReviewerConsole } from '../components/PrismaflexReviewerConsole'

describe('PrismaflexReviewerConsole', () => {
  it('renders an isolated reviewer surface with no learner or persistence behavior', () => {
    const { container } = render(<PrismaflexReviewerConsole />)
    const shell = container.querySelector('[data-reviewer-only="true"]')

    expect(shell).not.toBeNull()
    expect(shell).toHaveAttribute('data-learner-runtime', 'disabled')
    expect(shell).toHaveAttribute('data-device-action', 'none')
    expect(shell).toHaveAttribute('data-progress-write', 'none')
    expect(shell).toHaveAttribute('data-analytics', 'none')
    expect(shell).toHaveAttribute('data-scoring', 'none')
    expect(shell).toHaveAttribute('data-competency', 'none')
    expect(screen.getByText('Adapter not learner-registered')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Choose Patient' })).toBeInTheDocument()
  })

  it('uses softkeys to browse review views without invoking device actions', async () => {
    const user = userEvent.setup()
    render(<PrismaflexReviewerConsole />)

    await user.click(screen.getByRole('button', { name: 'Display math' }))
    expect(
      screen.getByRole('heading', { name: 'Device display contexts stay separate' }),
    ).toBeInTheDocument()
    expect(screen.getByText('2,110 mL/h')).toBeInTheDocument()
    expect(screen.getByText('2,100 mL/h')).toBeInTheDocument()
    expect(screen.getByText('CONFLICT-010 remains unresolved.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Alarm taxonomy' }))
    expect(
      screen.getByRole('heading', { name: 'Prismaflex category vocabulary' }),
    ).toBeInTheDocument()
    for (const category of ['Warning', 'Malfunction', 'Caution', 'Advisory']) {
      expect(screen.getByText(category)).toBeInTheDocument()
    }
  })

  it('browses and resets the setup source sequence with accessible controls', async () => {
    const user = userEvent.setup()
    render(<PrismaflexReviewerConsole />)

    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    expect(
      screen.getByRole('heading', { name: 'Enter and Confirm Patient Information' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Reset review' }))
    expect(screen.getByRole('heading', { name: 'Choose Patient' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous step' })).toBeDisabled()
  })
})
