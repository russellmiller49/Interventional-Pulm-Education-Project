import { fireEvent, render, screen, within } from '@testing-library/react'

import { CrrtCrossDeviceTransferReview } from '../components/CrrtCrossDeviceTransferReview'
import { baxterCrrtCrossDeviceTransferCapstone } from '../content'

describe('cross-device transfer capstone UI', () => {
  it('renders five device-distinct workflow-translation domains', () => {
    render(<CrrtCrossDeviceTransferReview />)

    const capstone = screen.getByRole('region', {
      name: 'Cross-device workflow translation capstone',
    })
    expect(capstone).toHaveAttribute('data-reviewer-only', 'false')
    expect(capstone).toHaveAttribute('data-clinically-interchangeable', 'false')
    expect(within(capstone).getByText(/does not claim.*clinically interchangeable/i)).toBeVisible()
    expect(within(capstone).getAllByRole('listitem')).toHaveLength(5)
    expect(within(capstone).getAllByText('PrisMax')).toHaveLength(5)
    expect(within(capstone).getAllByText('Prismaflex')).toHaveLength(5)
  })

  it('scores a complete correct transfer attempt at 100 percent', () => {
    render(<CrrtCrossDeviceTransferReview />)
    const capstone = screen.getByRole('region', {
      name: 'Cross-device workflow translation capstone',
    })
    for (const domain of baxterCrrtCrossDeviceTransferCapstone.domains) {
      const option = domain.options.find(({ id }) => id === domain.correctOptionId)
      if (!option) throw new Error(`Missing correct option for ${domain.id}`)
      fireEvent.click(within(capstone).getByRole('radio', { name: option.label }))
    }
    expect(within(capstone).getByRole('status')).toHaveTextContent(
      'Score 100%. Transfer capstone complete.',
    )
  })
})
