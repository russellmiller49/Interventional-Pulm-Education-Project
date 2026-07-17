import { render, screen } from '@testing-library/react'

import { CrrtPhase8ReviewPanel } from '../components/CrrtPhase8ReviewPanel'

describe('CrrtPhase8ReviewPanel', () => {
  it('renders only guarded Prismaflex and transfer review surfaces', () => {
    const { container } = render(<CrrtPhase8ReviewPanel />)
    const section = container.querySelector('[data-phase8-runtime="disabled"]')

    expect(section).not.toBeNull()
    expect(section).toHaveAttribute('data-reviewer-only', 'true')
    expect(section).toHaveAttribute('data-analytics', 'none')
    expect(section).toHaveAttribute('data-progress-write', 'none')
    expect(section).toHaveAttribute('data-scoring', 'none')
    expect(section).toHaveAttribute('data-competency', 'none')
    expect(
      screen.getByRole('heading', { name: 'Prismaflex adapter—source-mapped, not activated' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Learner runtime locked').length).toBeGreaterThan(0)
  })

  it('exposes the softkey and transfer plans without activation controls', () => {
    render(<CrrtPhase8ReviewPanel />)

    expect(screen.getByText('Prismaflex reviewer-only softkey console')).toBeInTheDocument()
    expect(screen.getByText('Cross-device transfer composition plan')).toBeInTheDocument()
    expect(screen.getByText('No equivalence claim is available.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /activate|publish|start therapy/i })).toBeNull()
  })
})
