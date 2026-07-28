import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { buildCriticalCarePublicClientCatalog } from '../content/publicCatalog.server'
import { CriticalCareCasesLibrary } from './CriticalCareCasesLibrary'
import { CriticalCareLabsLibrary } from './CriticalCareLabsLibrary'
import { CriticalCareProgressView } from './CriticalCareProgressView'

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

  it('lists focused draft/preview labs while withholding private-development modules', () => {
    render(<CriticalCareLabsLibrary catalog={catalog} />)
    const labLinks = screen.getAllByRole('link', { name: 'Open full lab' })
    expect(labLinks).toHaveLength(5)
    expect(labLinks.map((link) => link.getAttribute('href'))).toContain('/cardiohelp-ecmo')
    expect(
      screen.queryByRole('heading', { name: 'Integrated ICU Simulator' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ECMO Management' })).toBeInTheDocument()
    expect(
      screen.getByText(/retain their existing draft or preview release gates/i),
    ).toBeInTheDocument()
  })

  it('keeps challenge identities visible and preserves direct case links', () => {
    render(<CriticalCareCasesLibrary catalog={catalog} />)
    fireEvent.change(screen.getByLabelText('Module'), {
      target: { value: 'icu-hemodynamics' },
    })
    fireEvent.change(screen.getByLabelText('Activity type'), {
      target: { value: 'assessment' },
    })

    expect(
      screen.getByRole('heading', {
        name: 'HD-07 pressure-equalization challenge',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open activity' })).toHaveAttribute(
      'href',
      '/icu-hemodynamics/assess?start=1',
    )
  })

  it('presents personal history without grading-style progress', async () => {
    render(<CriticalCareProgressView catalog={catalog} />)

    expect(await screen.findByRole('heading', { name: 'Where you have been' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export JSON' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete local history' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/% complete/i)).not.toBeInTheDocument()
  })
})
