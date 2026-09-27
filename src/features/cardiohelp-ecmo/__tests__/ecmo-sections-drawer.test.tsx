import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { SectionsDrawer } from '../components/stage/SectionsDrawer'
import { ecmoLearningPathways } from '../content/sectionSpecs'

// The shared curriculum barrel pulls in next-intl navigation, which Jest cannot parse.
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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

/*
 * Live report, 2026-09-27: the Sections drawer "stops at section 02" on both tracks. The shared
 * PathwayNav is a horizontal rail; inside the 26 rem drawer it showed two of seventeen sections and
 * hid the rest behind a sideways scroller with no visible cue (0 of 17 at 320 px with 200% text).
 */

const stageCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/stage/EcmoLessonStage.module.css'),
  'utf8',
)

function ruleBody(selector: string): string {
  const start = stageCss.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`${selector} is not declared`)
  return stageCss.slice(start, stageCss.indexOf('}', start))
}

describe('ECMO Sections drawer', () => {
  it('lays the shared rail out as a list inside the drawer, so no section sits off to the side', () => {
    const nav = ruleBody('.sectionsPanel nav')
    expect(nav).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(nav).toContain('overflow: visible')
    const list = ruleBody('.sectionsPanel nav ol')
    expect(list).toContain('flex-direction: column')
    expect(list).toContain('overflow: visible')
    expect(ruleBody('.sectionsPanel nav button')).toContain('overflow-wrap: anywhere')
    // The panel is what scrolls, vertically.
    expect(ruleBody('.sectionsPanel')).toContain('overflow: auto')
  })

  it.each(['vv', 'va'] as const)('offers every %s section, not just the first two', (track) => {
    const pathway = ecmoLearningPathways().find((candidate) => candidate.trackId === track)!
    expect(pathway.sections).toHaveLength(17)
    const onSelect = jest.fn()
    render(
      <SectionsDrawer
        pathway={pathway}
        activeSectionId={pathway.sections[1].id}
        position={`2 of ${pathway.sections.length}`}
        onSelect={onSelect}
      />,
    )
    const nav = screen.getByRole('navigation', {
      name: `${track.toUpperCase()} learning pathway sections`,
    })
    const buttons = within(nav).getAllByRole('button')
    expect(buttons).toHaveLength(17)
    fireEvent.click(buttons[16])
    expect(onSelect).toHaveBeenCalledWith(pathway.sections[16].id)
  })

  it('brings the current section into the middle of the panel when it opens, moving only the panel', () => {
    const pathway = ecmoLearningPathways().find((candidate) => candidate.trackId === 'vv')!
    const { container } = render(
      <SectionsDrawer
        pathway={pathway}
        activeSectionId={pathway.sections[11].id}
        position={`12 of ${pathway.sections.length}`}
        onSelect={() => {}}
      />,
    )
    const drawer = container.querySelector<HTMLDetailsElement>('details[data-sections-drawer]')!
    const panel = container.querySelector<HTMLElement>('[data-sections-panel]')!
    const current = panel.querySelector<HTMLElement>('[aria-current="step"]')!
    expect(current).toHaveAccessibleName(/^12\. /)

    // jsdom has no layout: give the panel a 300 px window at y = 100 and the current section a
    // 44 px row 700 px down it.
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 300 })
    Object.defineProperty(current, 'offsetHeight', { configurable: true, value: 44 })
    panel.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
    current.getBoundingClientRect = () => ({ top: 800 }) as DOMRect
    const pageScroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})

    drawer.open = true
    fireEvent(drawer, new Event('toggle'))

    expect(panel.scrollTop).toBe(700 - (300 - 44) / 2)
    expect(pageScroll).not.toHaveBeenCalled()
    pageScroll.mockRestore()
  })
})
