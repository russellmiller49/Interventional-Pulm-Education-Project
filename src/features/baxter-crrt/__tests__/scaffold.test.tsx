import { fireEvent, render, screen } from '@testing-library/react'

import BaxterCrrtLab from '../components/BaxterCrrtLab'

describe('Baxter CRRT pilot interface scaffold', () => {
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
    expect(screen.getByRole('heading', { name: 'Functional PrisMax pilot' })).toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Original PrisMax functional educational facsimile' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CVVHD circuit, bags, scales, and pressures' }),
    ).toBeInTheDocument()
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
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Phase 4-5 pilot')
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'baxter-crrt-pathway-tab-learn',
    )

    fireEvent.keyDown(learn, { key: 'End' })
    expect(practice).toHaveFocus()
    expect(practice).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Scored pilot')

    expect(window.localStorage.length).toBe(0)
  })

  it('keeps non-English routes on an explicit reviewed-English fallback', () => {
    render(<BaxterCrrtLab locale="es" />)

    expect(screen.getByText('Reviewed-English fallback:')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CRRT Learn & Practice workspace' }),
    ).toBeInTheDocument()
  })

  it('runs all eight setup gates, stops, and reloads a clean interface', () => {
    render(<BaxterCrrtLab />)

    expect(screen.getByRole('button', { name: /Same Patient/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /New Patient/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm case-free context' }))
    fireEvent.click(screen.getByRole('button', { name: /CVVHD/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue with CVVHD pilot' }))

    const bloodFlow = screen.getByRole('spinbutton', { name: /^Blood flow/i })
    const dialysateFlow = screen.getByRole('spinbutton', { name: /^Dialysate flow/i })
    const patientFluidRemoval = screen.getByRole('spinbutton', {
      name: /^Patient fluid removal/i,
    })
    expect(dialysateFlow).toBeDisabled()
    expect(patientFluidRemoval).toBeDisabled()

    fireEvent.change(bloodFlow, { target: { value: '100' } })
    expect(dialysateFlow).toBeEnabled()
    fireEvent.change(dialysateFlow, { target: { value: '1000' } })
    fireEvent.change(patientFluidRemoval, { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review and apply pilot values' }))

    fireEvent.click(screen.getByRole('button', { name: 'Confirm training set path' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm bag and scale positions' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start prime sequence check' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete prime verification' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm simulated line path' }))
    fireEvent.click(screen.getByRole('button', { name: /Start interface run/i }))

    expect(screen.getByText('Interface run active')).toBeInTheDocument()
    expect(screen.getByText('No active alarms')).toBeInTheDocument()
    expect(screen.getByText('Circuit running')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('dialog', { name: /End this equipment checkout/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'End interface run' }))
    expect(screen.getByText('Interface run ended')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reload clean interface' }))

    expect(
      screen.getByRole('heading', { name: 'Start a case-free interface checkout' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByText('Circuit stopped')).toBeInTheDocument()
  })
})
