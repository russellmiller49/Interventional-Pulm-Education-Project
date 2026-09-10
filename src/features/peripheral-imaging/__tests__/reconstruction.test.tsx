import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { axe } from 'jest-axe'

import { ReconstructionComparison } from '../components/stage/ReconstructionComparison'
import {
  RECONSTRUCTION_ACCOUNTS,
  RECONSTRUCTION_CONTRAST,
  RECONSTRUCTION_SECTIONS,
  reconstructionAccount,
  validateImagingReconstruction,
} from '../content/reconstruction'
import { peripheralImagingSectionIds } from '../content/pathway'
import { SOURCE_BY_ID } from '../data/sources'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn() }),
}))

afterEach(cleanup)

describe('how a reconstruction is made', () => {
  it('validates clean at import', () => {
    expect(validateImagingReconstruction()).toEqual([])
  })

  it('accounts for both acquisitions, and says what each cannot answer', () => {
    expect(RECONSTRUCTION_ACCOUNTS.map((a) => a.id)).toEqual(['tomosynthesis', 'cone-beam'])
    for (const account of RECONSTRUCTION_ACCOUNTS) {
      expect(account.built.length).toBeGreaterThanOrEqual(2)
      expect(account.canAsk.length).toBeGreaterThan(0)
      // The half that keeps this honest: a reconstruction that only lists what it answers
      // teaches a learner to trust it everywhere.
      expect(account.cannotAsk.length).toBeGreaterThan(0)
      expect(account.boundary).not.toHaveLength(0)
      expect(peripheralImagingSectionIds).toContain(account.shownIn)
    }
  })

  it('cites only sources the module has reviewed', () => {
    for (const account of RECONSTRUCTION_ACCOUNTS) {
      expect(account.sourceIds.length).toBeGreaterThan(0)
      for (const id of account.sourceIds) expect(SOURCE_BY_ID.get(id)).toBeDefined()
    }
  })

  it('points every account at a section that actually builds one', () => {
    for (const account of RECONSTRUCTION_ACCOUNTS) {
      expect(RECONSTRUCTION_SECTIONS).toContain(account.shownIn)
    }
    for (const sectionId of RECONSTRUCTION_SECTIONS) {
      expect(peripheralImagingSectionIds).toContain(sectionId)
    }
  })

  it('throws rather than resolve an account it does not hold', () => {
    expect(() => reconstructionAccount('nonsense' as never)).toThrow(/Unknown reconstruction/)
  })

  it('draws both accounts, each with a described picture', async () => {
    const { container } = render(<ReconstructionComparison />)
    expect(container.textContent).toContain(RECONSTRUCTION_CONTRAST)
    for (const account of RECONSTRUCTION_ACCOUNTS) {
      const card = container.querySelector(`[data-reconstruction="${account.id}"]`)
      expect(card).not.toBeNull()
      expect(card!.textContent).toContain(account.comesOut)
      expect(card!.textContent).toContain(account.boundary)
      // The drawing carries the mechanism, so it needs a description of its own.
      const picture = card!.querySelector('svg[role="img"]')
      expect(picture).not.toBeNull()
      const labelledBy = picture!.getAttribute('aria-labelledby')
      expect(labelledBy).toBeTruthy()
      expect(
        card!.querySelector(`#${CSS.escape(labelledBy!)}`)?.textContent ?? '',
      ).not.toHaveLength(0)
    }
    expect(await axe(container)).toHaveNoViolations()
  })

  it('leaves out the two lists in the dense rendering, and keeps the mechanism', () => {
    const { container } = render(<ReconstructionComparison dense />)
    for (const account of RECONSTRUCTION_ACCOUNTS) {
      const card = container.querySelector(`[data-reconstruction="${account.id}"]`)!
      for (const step of account.built) expect(card.textContent).toContain(step)
      expect(card.textContent).not.toContain(account.canAsk[0])
    }
  })
})
