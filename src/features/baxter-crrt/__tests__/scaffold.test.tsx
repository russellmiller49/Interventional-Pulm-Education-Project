import { fireEvent, render, screen, within } from '@testing-library/react'

import BaxterCrrtLab from '../components/BaxterCrrtLab'
import { CrrtPhase7ReviewPanel } from '../components/CrrtPhase7ReviewPanel'

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
    expect(screen.getByRole('link', { name: 'Open CRRT reviewer workspace' })).toHaveAttribute(
      'href',
      '/en/baxter-crrt/review',
    )
    expect(
      screen.queryByRole('heading', { name: 'Full PrisMax curriculum—mapped, not activated' }),
    ).not.toBeInTheDocument()
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
    expect(screen.getByRole('tabpanel', { name: /Orientation/i })).toHaveAttribute(
      'aria-labelledby',
      'baxter-crrt-pathway-tab-orientation',
    )

    orientation.focus()
    fireEvent.keyDown(orientation, { key: 'ArrowRight' })
    expect(learn).toHaveFocus()
    expect(learn).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /Learn/i })).toHaveTextContent('Protected pilot')
    expect(screen.getByRole('tabpanel', { name: /Learn/i })).toHaveAttribute(
      'aria-labelledby',
      'baxter-crrt-pathway-tab-learn',
    )

    fireEvent.keyDown(learn, { key: 'End' })
    expect(practice).toHaveFocus()
    expect(practice).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: /Practice/i })).toHaveTextContent('Scored pilot')

    expect(window.localStorage.length).toBe(0)
  })

  it('keeps non-English routes on an explicit reviewed-English fallback', () => {
    render(<BaxterCrrtLab locale="es" />)

    expect(screen.getByText('Reviewed-English fallback:')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CRRT Learn & Practice workspace' }),
    ).toBeInTheDocument()
  })

  it('mounts bounded tools only inside the collapsed Phase 7 reviewer disclosure', () => {
    render(<CrrtPhase7ReviewPanel />)

    const registry = screen.getByRole('region', {
      name: 'Full PrisMax curriculum—mapped, not activated',
    })
    const reviewerToolsSummary = within(registry)
      .getByText('Reviewer-only instructional tools')
      .closest('summary')
    const reviewerToolsDisclosure = reviewerToolsSummary?.closest('details')
    const reviewerToolsContent = document.getElementById('baxter-crrt-phase7-reviewer-tools')

    if (!reviewerToolsSummary || !reviewerToolsDisclosure || !reviewerToolsContent) {
      throw new Error('Expected the Phase 7 reviewer-tool disclosure and content.')
    }
    expect(reviewerToolsDisclosure).toHaveAttribute('data-reviewer-only', 'true')
    expect(reviewerToolsDisclosure).toHaveAttribute('data-progress-write', 'none')
    expect(reviewerToolsDisclosure).toHaveAttribute('data-scoring', 'none')
    expect(reviewerToolsDisclosure).not.toHaveAttribute('open')
    expect(reviewerToolsContent).not.toBeVisible()
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument()

    fireEvent.click(reviewerToolsSummary)

    expect(reviewerToolsDisclosure).toHaveAttribute('open')
    expect(reviewerToolsContent).toBeVisible()
    expect(
      within(reviewerToolsContent).getByRole('region', {
        name: 'Concept labs—isolated from learner runtime',
      }),
    ).toHaveAttribute('data-progress-write', 'none')
    expect(
      within(reviewerToolsContent).getByRole('region', { name: 'Pressure Localization Lab' }),
    ).toHaveAttribute('data-persistence', 'none')
    expect(
      within(reviewerToolsContent).getByRole('region', { name: 'Full Prescription Workbench' }),
    ).toHaveAttribute('data-progress-write', 'none')
    expect(window.localStorage).toHaveLength(0)

    fireEvent.click(reviewerToolsSummary)
    expect(reviewerToolsDisclosure).not.toHaveAttribute('open')
    expect(reviewerToolsContent).not.toBeVisible()
    expect(
      within(reviewerToolsContent).queryByRole('region', { name: 'Pressure Localization Lab' }),
    ).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
  })

  it('mounts reviewer cases only inside their isolated non-persistent disclosure', () => {
    render(<CrrtPhase7ReviewPanel />)

    const registry = screen.getByRole('region', {
      name: 'Full PrisMax curriculum—mapped, not activated',
    })
    const summary = within(registry).getByText('Reviewer-only case candidates').closest('summary')
    const disclosure = summary?.closest('details')
    const content = document.getElementById('baxter-crrt-phase7-reviewer-cases')

    if (!summary || !disclosure || !content) {
      throw new Error('Expected the Phase 7 reviewer-case disclosure and content.')
    }
    expect(disclosure).toHaveAttribute('data-reviewer-only', 'true')
    expect(disclosure).toHaveAttribute('data-analytics', 'none')
    expect(disclosure).toHaveAttribute('data-progress-write', 'none')
    expect(disclosure).not.toHaveAttribute('open')
    expect(screen.queryByTestId('crrt-phase7-case-review')).not.toBeInTheDocument()

    fireEvent.click(summary)

    expect(disclosure).toHaveAttribute('open')
    expect(content).toBeVisible()
    expect(screen.getByTestId('crrt-phase7-case-review')).toHaveAttribute(
      'data-runtime-audience',
      'reviewer',
    )
    expect(within(content).getByRole('combobox', { name: 'Review case candidate' })).toHaveValue(
      'CRRT-01',
    )
    expect(window.localStorage).toHaveLength(0)

    fireEvent.click(summary)
    expect(disclosure).not.toHaveAttribute('open')
    expect(screen.queryByTestId('crrt-phase7-case-review')).not.toBeInTheDocument()
    expect(window.localStorage).toHaveLength(0)
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
