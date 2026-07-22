import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { render, screen } from '@testing-library/react'

import { criticalCareModules } from '../content/modules'
import { CriticalCareHub } from './CriticalCareHub'

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

describe('CriticalCareHub', () => {
  it('provides one direct launch link for every critical care module', () => {
    render(<CriticalCareHub />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Critical Care Learning Center' }),
    ).toBeInTheDocument()

    for (const moduleDefinition of criticalCareModules) {
      expect(screen.getByRole('link', { name: `Open ${moduleDefinition.title}` })).toHaveAttribute(
        'href',
        moduleDefinition.href,
      )
    }

    expect(screen.getAllByRole('link')).toHaveLength(criticalCareModules.length)
  })

  it('makes the existing Baxter sign-in boundary visible before launch', () => {
    render(<CriticalCareHub />)
    expect(screen.getByText('Sign-in required')).toBeInTheDocument()
    expect(screen.getAllByText('Sign-in required')).toHaveLength(1)
  })
})
