import { render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BaxterCrrtModuleFrame } from '@/features/baxter-crrt/components/BaxterCrrtModuleFrame'
import { CardiohelpModuleFrame } from '@/features/cardiohelp-ecmo/components/CardiohelpModuleFrame'
import { McsModuleFrame } from '@/features/mechanical-circulatory-support/components/McsModuleFrame'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const expectedSections = ['Overview', 'Learn', 'Practice', 'Assess']

function expectNavigationGrammar(name: string, activeSection: string) {
  const navigation = screen.getByRole('navigation', { name })
  const links = within(navigation).getAllByRole('link')

  expect(links.map((link) => link.querySelector('strong')?.textContent)).toEqual(expectedSections)
  expect(within(navigation).getByRole('link', { name: new RegExp(activeSection) })).toHaveAttribute(
    'aria-current',
    'page',
  )
}

describe('critical-care shared shell convergence', () => {
  it('bounds activity frames to a definite desktop viewport without document scrolling', () => {
    const sharedStyles = readFileSync(
      join(process.cwd(), 'src/features/learning-module/components/learning-module-v2.module.css'),
      'utf8',
    )
    expect(sharedStyles).toMatch(/\.moduleFrame\[data-activity-frame='true'\][\s\S]*height: 100%/)
    expect(sharedStyles).toMatch(/\.activityFrameBody > \[data-critical-care-activity-shell\]/)

    for (const path of [
      'src/features/mechanical-circulatory-support/components/mechanical-circulatory-support.module.css',
      'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css',
      'src/features/baxter-crrt/components/baxter-crrt.module.css',
    ]) {
      const moduleStyles = readFileSync(join(process.cwd(), path), 'utf8')
      expect(moduleStyles).toMatch(
        /\.moduleShell\[data-activity-mode='true'\][\s\S]*height: calc\(100dvh - 4rem\)[\s\S]*overflow: hidden/,
      )
    }
  })

  it('keeps the MCS compatibility frame on the light V2 shell', () => {
    const { container } = render(
      <McsModuleFrame locale="en" activeHref="/mechanical-circulatory-support/learn">
        <div>Existing MCS engine</div>
      </McsModuleFrame>,
    )

    expect(container.querySelector('[data-learning-module-v2-theme-root]')).toHaveAttribute(
      'data-theme',
      'light',
    )
    expect(screen.getByText('Mechanical Circulatory Support')).toBeInTheDocument()
    expect(screen.getByText('IABP, Impella, and durable LVAD device labs')).toBeInTheDocument()
    expect(screen.getByText('unlisted preview')).toBeInTheDocument()
    expectNavigationGrammar('Mechanical circulatory support module sections', 'Learn')
  })

  it('uses the ECMO Management identity without dropping player header controls', () => {
    const { container } = render(
      <CardiohelpModuleFrame
        locale="en"
        activeHref="/cardiohelp-ecmo/practice"
        headerExtra={<button type="button">Track toggle</button>}
      >
        <div>Existing CARDIOHELP engine</div>
      </CardiohelpModuleFrame>,
    )

    expect(container.querySelector('[data-learning-module-v2-theme-root]')).toHaveAttribute(
      'data-theme',
      'dark',
    )
    expect(screen.getByText('ECMO Management')).toBeInTheDocument()
    expect(screen.getByText('CARDIOHELP console lab')).toBeInTheDocument()
    expect(screen.getByText('Unlisted tester access')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Track toggle' })).toBeInTheDocument()
    expectNavigationGrammar('ECMO Management module sections', 'Practice')
  })

  it('preserves CRRT release and progress contracts on the dark V2 shell', () => {
    const { container } = render(
      <BaxterCrrtModuleFrame locale="en" activeHref="/baxter-crrt/assess">
        <div>Existing PrisMax engine</div>
      </BaxterCrrtModuleFrame>,
    )

    const main = screen.getByRole('main')
    expect(main).toHaveAttribute('data-release-stage', 'unlisted-preview')
    expect(main).toHaveAttribute('data-publication-status', 'draft')
    expect(main).toHaveAttribute('data-analytics', 'allowlisted')
    expect(main).toHaveAttribute('data-progress-write', 'v3')
    expect(container.querySelector('[data-learning-module-v2-theme-root]')).toHaveAttribute(
      'data-theme',
      'dark',
    )
    expect(screen.getByText('CRRT')).toBeInTheDocument()
    expect(screen.getByText('PrisMax console lab')).toBeInTheDocument()
    expectNavigationGrammar('CRRT module sections', 'Assess')
  })
})
