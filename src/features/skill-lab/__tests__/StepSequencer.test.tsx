import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StepSequencer } from '../components/StepSequencer'
import type { StepSequence } from '../engine/types'

const sequence: StepSequence = {
  id: 'demo',
  title: 'Demo sequence',
  prompt: 'Order these steps',
  steps: [
    { id: 'a', label: 'First step', detail: 'Detail A' },
    { id: 'b', label: 'Second step', detail: 'Detail B' },
  ],
  rationale: 'Because the order matters here.',
}

/**
 * For a two-step sequence the shuffle is deterministic: it always presents the
 * reversed order (the unchanged-guard rotates an unshuffled result), so the
 * test can rely on the initial render showing [b, a].
 */
describe('StepSequencer', () => {
  it('renders the prompt and steps', () => {
    render(<StepSequencer sequence={sequence} />)
    expect(screen.getByText('Order these steps')).toBeInTheDocument()
    expect(screen.getByText('First step')).toBeInTheDocument()
    expect(screen.getByText('Second step')).toBeInTheDocument()
  })

  it('grades a corrected order and reveals the rationale', async () => {
    const user = userEvent.setup()
    render(<StepSequencer sequence={sequence} />)

    const items = screen.getAllByRole('listitem')
    // Deterministic reversed start: first item is the second authored step.
    expect(within(items[0]).getByText('Second step')).toBeInTheDocument()

    // Rationale is hidden until the sequence is correct.
    expect(screen.queryByText('Because the order matters here.')).not.toBeInTheDocument()

    // Bubble 'First step' up into position, then grade.
    await user.click(screen.getByRole('button', { name: 'Move step earlier: First step' }))
    await user.click(screen.getByRole('button', { name: 'Check order' }))

    expect(screen.getByText('Correct sequence')).toBeInTheDocument()
    expect(screen.getByText('Because the order matters here.')).toBeInTheDocument()
  })

  it('reports an incorrect order without revealing the rationale', async () => {
    const user = userEvent.setup()
    render(<StepSequencer sequence={sequence} />)

    // Grade the reversed (incorrect) starting order directly.
    await user.click(screen.getByRole('button', { name: 'Check order' }))

    expect(screen.getByText(/Not quite/)).toBeInTheDocument()
    expect(screen.queryByText('Because the order matters here.')).not.toBeInTheDocument()
  })
})
