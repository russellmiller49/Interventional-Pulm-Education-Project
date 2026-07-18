import { render, screen } from '@testing-library/react'

import BaxterCrrtLab from '../components/BaxterCrrtLab'

describe('Baxter CRRT v1 workspace scaffold', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders the private release, educational boundary, profiles, workspace, and evidence boundary', () => {
    render(<BaxterCrrtLab />)

    expect(screen.getByRole('main')).toHaveAttribute('data-release-stage', 'sme-review')
    expect(
      screen.getByRole('heading', { name: 'Baxter CRRT Learn, Practice & Mastery' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Educational safety notice' })).toHaveTextContent(
      /never patient-specific advice or a local operating policy/i,
    )
    expect(screen.getAllByText('PrisMax educational reference profile').length).toBeGreaterThan(0)
    expect(screen.getByText(/optional local extension not loaded/i)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'What this educational module can—and cannot—claim',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/18 cases, seven drills, six tools/i)).toBeInTheDocument()
  })

  it('uses reviewed English fallback on non-English routes', () => {
    render(<BaxterCrrtLab locale="es" />)

    expect(screen.getByRole('main')).toHaveAttribute('data-no-handoff-translate', 'true')
    expect(screen.getByText('Reviewed-English fallback')).toBeInTheDocument()
    expect(screen.getByText(/English remains authoritative/i)).toBeInTheDocument()
  })
})
