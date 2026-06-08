import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DynamicSignsLab } from '../components/DynamicSignsLab'

describe('DynamicSignsLab', () => {
  it('reveals diagnostic teaching and attribution only after learner commitment', async () => {
    const user = userEvent.setup()

    render(<DynamicSignsLab />)

    expect(screen.getByText(/Clip 1 of 5/i)).toBeInTheDocument()
    expect(screen.queryByText(/Source filename:/i)).not.toBeInTheDocument()

    const video = screen.getByLabelText('Lung ultrasound clip for dynamic-sign classification.')
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('controls')

    await user.click(screen.getByRole('button', { name: 'Normal A-lines' }))
    await user.click(screen.getByRole('button', { name: 'Check my interpretation' }))

    expect(screen.getByRole('heading', { name: 'Correct' })).toBeInTheDocument()
    expect(screen.getByText(/The teaching target is normal A-line/i)).toBeInTheDocument()
    expect(
      screen.getByText(/Source filename: Reg_recommendations_alines_mov1/i),
    ).toBeInTheDocument()
    const attributionLinks = screen.getAllByRole('link', { name: 'CC BY 4.0' })
    expect(attributionLinks).toHaveLength(2)
    for (const attributionLink of attributionLinks) {
      expect(attributionLink).toHaveAttribute(
        'href',
        expect.stringContaining('Reg_recommendations_alines_mov1.mov'),
      )
    }
  })
})
