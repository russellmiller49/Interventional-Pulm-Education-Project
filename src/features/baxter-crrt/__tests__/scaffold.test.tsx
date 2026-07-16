import { fireEvent, render, screen } from '@testing-library/react'

import BaxterCrrtLab from '../components/BaxterCrrtLab'

describe('Baxter CRRT Phase 1 scaffold', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders the draft, safety, profile, workbench, and source boundaries', () => {
    render(<BaxterCrrtLab />)

    expect(
      screen.getByRole('heading', { name: 'CRRT Learn & Practice workspace' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Authenticated draft')).toBeInTheDocument()
    expect(screen.getByText('Professional education only.')).toBeInTheDocument()
    expect(
      screen.getByText(/not manufactured, sponsored, validated, or endorsed/i),
    ).toBeInTheDocument()
    expect(screen.getByText('PrisMax educational profile')).toBeInTheDocument()
    expect(screen.getByText('Manual for program 2.XX')).toBeInTheDocument()
    expect(screen.getAllByText('Not established from supplied copy')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'No case loaded' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'PrisMax interface not connected' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Models not connected' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'What this draft can—and cannot—claim' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/review pending/i).length).toBeGreaterThan(0)
  })

  it('supports roving keyboard pathway tabs and keeps Mastery unavailable', () => {
    render(<BaxterCrrtLab />)

    const orientation = screen.getByRole('tab', { name: /Orientation/i })
    const learn = screen.getByRole('tab', { name: /Learn/i })
    const practice = screen.getByRole('tab', { name: /Practice/i })
    const mastery = screen.getByRole('tab', { name: /Mastery/i })

    expect(orientation).toHaveAttribute('aria-selected', 'true')
    expect(mastery).toBeDisabled()
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'baxter-crrt-pathway-tab-orientation',
    )

    orientation.focus()
    fireEvent.keyDown(orientation, { key: 'ArrowRight' })
    expect(learn).toHaveFocus()
    expect(learn).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Engine not connected')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'baxter-crrt-pathway-tab-learn',
    )

    fireEvent.keyDown(learn, { key: 'End' })
    expect(practice).toHaveFocus()
    expect(practice).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Cases not loaded')

    expect(window.localStorage.length).toBe(0)
  })

  it('keeps non-English routes on an explicit reviewed-English fallback', () => {
    render(<BaxterCrrtLab locale="es" />)

    expect(screen.getByText('Reviewed-English fallback:')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CRRT Learn & Practice workspace' }),
    ).toBeInTheDocument()
  })
})
