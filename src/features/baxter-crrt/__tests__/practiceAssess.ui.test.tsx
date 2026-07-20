import { render, screen, waitFor, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { BaxterCrrtAssess } from '../components/BaxterCrrtAssess'
import { BaxterCrrtPractice } from '../components/BaxterCrrtPractice'
import { baxterCrrtCoreCaseIds } from '../content'
import { createDefaultProgress, writeProgress } from '../engine/progress'

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

describe('Baxter CRRT Practice curation and Assess gating', () => {
  beforeEach(() => window.localStorage.clear())

  it('shows ten station-grouped core cases, collapses seven extras, and hides CRRT-16', () => {
    render(<BaxterCrrtPractice />)

    const selector = screen.getByRole('combobox', { name: 'Station-grouped core case' })
    const values = within(selector)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)
    expect(values).toEqual(baxterCrrtCoreCaseIds)
    expect(values).not.toContain('CRRT-16')
    expect(selector.querySelectorAll('optgroup')).toHaveLength(6)
    expect(screen.getByText(/Additional cases \(7\)/)).toBeInTheDocument()
  })

  it('keeps the capstone locked and links every remaining core case', async () => {
    render(<BaxterCrrtAssess />)

    const heading = await screen.findByRole('heading', {
      name: 'Complete 10 remaining core cases',
    })
    const gate = heading.closest('section')
    expect(gate).not.toBeNull()
    expect(within(gate as HTMLElement).getAllByRole('link')).toHaveLength(10)
  })

  it('unlocks only after all ten core cases are complete', async () => {
    const progress = {
      ...createDefaultProgress(),
      completedPracticeCaseIds: baxterCrrtCoreCaseIds.map((id) => id.toLowerCase()),
    }
    expect(writeProgress(progress, window.localStorage)).toBe(true)

    render(<BaxterCrrtAssess />)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Unseen PrisMax capstone', level: 2 }),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Capstone locked')).not.toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Capstone safeguards.' })).toBeInTheDocument()
  })
})
