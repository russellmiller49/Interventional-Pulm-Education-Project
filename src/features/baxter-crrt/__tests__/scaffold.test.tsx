import { render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtHub } from '../components/BaxterCrrtHub'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}?${new URLSearchParams(href.query ?? {}).toString()}`
    return (
      <a href={resolved} {...rest}>
        {children}
      </a>
    )
  },
}))

describe('Baxter CRRT module scaffold', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders the protected release, safety boundary, four routes, curriculum, and evidence panel', () => {
    render(<BaxterCrrtHub />)

    expect(screen.getByRole('main')).toHaveAttribute('data-release-stage', 'sme-review')
    expect(
      screen.getByRole('heading', { name: 'High-yield CRRT reasoning on PrisMax' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Educational safety notice' })).toHaveTextContent(
      /never patient-specific advice or a local operating policy/i,
    )
    const moduleNav = screen.getByRole('navigation', { name: 'Baxter CRRT module sections' })
    expect(within(moduleNav).getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('heading', { name: 'Curriculum map' })).toBeInTheDocument()
    expect(screen.getAllByText(/ten core cases/i).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { name: 'What supports this educational module' }),
    ).toBeInTheDocument()
  })

  it('uses reviewed English fallback on non-English routes', () => {
    render(<BaxterCrrtHub locale="es" />)

    expect(screen.getByRole('main')).toHaveAttribute('data-no-handoff-translate', 'true')
    expect(screen.getByText('Reviewed-English fallback')).toBeInTheDocument()
    expect(screen.getByText(/English remains authoritative/i)).toBeInTheDocument()
  })
})
