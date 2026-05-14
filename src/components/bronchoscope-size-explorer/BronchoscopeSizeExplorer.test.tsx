import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { BronchoscopeSizeExplorer } from './BronchoscopeSizeExplorer'

describe('BronchoscopeSizeExplorer', () => {
  it('updates compatibility result when scope and instrument selections change', async () => {
    const user = userEvent.setup()

    render(<BronchoscopeSizeExplorer />)

    expect(
      screen.getByRole('heading', { name: 'Bronchoscope Size, Reach & Tool Fit Explorer' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Educational use only')).toBeInTheDocument()
    expect(screen.getByText('Fits')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ultrathin bronchoscope/i }))
    await user.click(screen.getByRole('button', { name: /2.6 mm guide sheath system/i }))

    expect(screen.getByText('Does not fit')).toBeInTheDocument()
    expect(screen.getByText(/Working channel area/i)).toBeInTheDocument()
    expect(screen.getByText(/Source and evidence notes/i)).toBeInTheDocument()
  })
})
