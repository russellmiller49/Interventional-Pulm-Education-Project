import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareCasesLibrary } from './CriticalCareCasesLibrary'
import { CriticalCareLabsLibrary } from './CriticalCareLabsLibrary'

const catalog = buildCriticalCarePublicClientCatalog()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('critical-care global libraries', () => {
  it('filters stable practice and assessment deep links', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), {
      target: { value: 'icu-hemodynamics' },
    })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'practice-case' },
    })
    expect(screen.getByText('8 activities')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'The numbers do not fit the patient' }),
    ).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'Open activity' })
    expect(links).toHaveLength(8)
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/icu-hemodynamics\/practice\?case=HD-/),
    )
  })

  it('lists only reviewed labs and withholds draft/private identities and links', () => {
    render(<CriticalCareLabsLibrary catalog={catalog} />)
    expect(screen.getAllByRole('link', { name: 'Open lab' })).toHaveLength(4)
    expect(
      screen.queryByRole('heading', { name: 'Integrated ICU Simulator' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'ECMO Management' })).not.toBeInTheDocument()
    expect(
      screen.getByText(/Additional labs follow their existing release gates/i),
    ).toBeInTheDocument()
  })

  it('masks public assessment identities and removes their case query', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), {
      target: { value: 'icu-hemodynamics' },
    })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'assessment' },
    })

    expect(screen.getByRole('heading', { name: 'Masked assessment' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open activity' })).toHaveAttribute(
      'href',
      '/icu-hemodynamics/assess',
    )
    expect(
      screen.queryByText(/Pressure equalization with a falling pulse pressure/),
    ).not.toBeInTheDocument()
  })
})
