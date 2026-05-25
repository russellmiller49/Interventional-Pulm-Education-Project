import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { RapidOnsiteCytologyModule } from '../components/RapidOnsiteCytologyModule'

describe('RapidOnsiteCytologyModule', () => {
  it('updates the interpretation panel from hover, focus, and slide changes', async () => {
    const user = userEvent.setup()

    render(<RapidOnsiteCytologyModule />)

    expect(
      screen.getByRole('heading', { name: /Rapid onsite cytology interpretation/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/education and slide-interpretation practice only/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3D malignant cluster' })).toBeInTheDocument()

    await user.hover(screen.getByRole('button', { name: /Inspect Nuclear crowding/i }))
    expect(screen.getByRole('heading', { name: 'Nuclear crowding' })).toBeInTheDocument()

    fireEvent.focus(screen.getByRole('button', { name: /Inspect Background cells/i }))
    expect(screen.getByRole('heading', { name: 'Background cells' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Squamous vs granuloma/i }))
    expect(
      screen.getByRole('heading', { name: /EBUS-TBNA squamous carcinoma versus granuloma/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Squamous tumor cluster' })).toBeInTheDocument()
  })

  it('hides annotations, reveals quiz explanations after answering, and resets zoom', async () => {
    const user = userEvent.setup()

    render(<RapidOnsiteCytologyModule />)

    await user.click(screen.getByRole('button', { name: /Squamous vs granuloma/i }))

    await user.click(screen.getByRole('button', { name: /Hide/i }))
    expect(
      screen.queryByRole('button', { name: /Inspect Dense cytoplasm/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Show/i }))
    expect(screen.getByRole('button', { name: /Inspect Dense cytoplasm/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Quiz mode' }))
    await user.click(screen.getByRole('button', { name: /Inspect Dense cytoplasm/i }))

    expect(
      screen.getByText(/Dense cytoplasm in this atypical group points most toward/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Choose an answer to reveal/i)).toBeInTheDocument()
    expect(screen.queryByText(/Dense cytoplasm within atypical cells/i)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /Squamous cell carcinoma with keratinizing cytoplasm/i,
      }),
    )

    expect(screen.getByText(/Correct\. Review the explanation below\./i)).toBeInTheDocument()
    expect(screen.getByText(/Dense cytoplasm within atypical cells/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText('125%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset zoom and pan' }))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
