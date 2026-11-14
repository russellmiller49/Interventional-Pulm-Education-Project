import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { ModuleFrameV2 } from '../ModuleFrameV2'

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

/**
 * Lesson mode: the site's own menu is hidden while a lesson is open.
 *
 * Measured at 1600 × 900 in November 2026, the site menu took 81 px above a lesson that already
 * carries its own bar, and the simulator ran off the bottom of the window. A module frame opts in
 * with `hideSiteHeader`; the marker it prints is acted on by one rule in the global stylesheet.
 * jsdom does no layout, so this holds the marker and the declarations rather than the geometry.
 */
const frameProps = {
  eyebrow: 'Critical care',
  title: 'A module',
  activeHref: '/a-module/learn',
  navItems: [],
  safetyNotice: 'Teaching simulator.',
} as const

function frame(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>('[data-learning-module-v2-theme-root]')
  if (!root) throw new Error('No module frame rendered')
  return root
}

describe('ModuleFrameV2 lesson mode', () => {
  it('marks the frame when a lesson is open and the module asked for the whole window', () => {
    const { container } = render(
      <ModuleFrameV2 {...frameProps} activityMode hideSiteHeader>
        <p>Lesson</p>
      </ModuleFrameV2>,
    )
    expect(frame(container)).toHaveAttribute('data-site-header', 'hidden')
  })

  it('leaves the site menu alone on the module overview', () => {
    const { container } = render(
      <ModuleFrameV2 {...frameProps} hideSiteHeader>
        <p>Overview</p>
      </ModuleFrameV2>,
    )
    expect(frame(container)).not.toHaveAttribute('data-site-header')
  })

  it('leaves the site menu alone for a module that has not opted in', () => {
    const { container } = render(
      <ModuleFrameV2 {...frameProps} activityMode>
        <p>Lesson</p>
      </ModuleFrameV2>,
    )
    expect(frame(container)).not.toHaveAttribute('data-site-header')
  })
})

describe('the global rule that acts on the marker', () => {
  const globals = readFileSync(join(process.cwd(), 'src/styles/globals.css'), 'utf8')

  it('removes the site header', () => {
    expect(globals).toMatch(
      /html:has\(#main-content \[data-site-header='hidden'\]\) #site-header\s*{\s*display:\s*none;/,
    )
  })

  it('publishes a zero header height, so shells sized beneath the header take the room', () => {
    expect(globals).toMatch(
      /html:has\(#main-content \[data-site-header='hidden'\]\)\s*{\s*--site-header-height:\s*0px;/,
    )
  })

  it('applies only in the fixed workspace, where the lesson bar is always on screen', () => {
    // Below the threshold a lesson flows with the document and some lesson bars scroll away; the
    // site header is then the one pinned way out of the lesson.
    expect(globals).toMatch(
      /@media \(min-width: 1024px\) and \(min-height: 700px\)\s*{\s*html:has\(#main-content \[data-site-header='hidden'\]\)/,
    )
  })
})

describe('the Sections menu', () => {
  const stage = readFileSync(
    join(process.cwd(), 'src/features/learning-module/stage/lesson-stage.module.css'),
    'utf8',
  )

  it("shows each section's own title under its topic", () => {
    expect(stage).toMatch(/\.sectionsPanel nav button small\s*{\s*display:\s*block;/)
  })
})
