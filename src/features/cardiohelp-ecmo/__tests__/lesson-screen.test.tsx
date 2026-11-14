import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpModuleFrame } from '../components/CardiohelpModuleFrame'
import { EcmoActivityShell } from '../components/shell/EcmoActivityShell'
import { EcmoSectionHeader } from '../components/shell/EcmoSectionHeader'
import { ecmoPinnedLessonBarHeight } from '../components/shell/useEcmoLessonBar'
import { scrollEcmoTargetIntoView } from '../components/stage/scrollTaskPaneToTop'

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

/**
 * The ECMO lesson screen, November 2026.
 *
 * The other critical care modules hide the site menu while a lesson is open and keep one bar
 * (section name, Sections, Save & exit). ECMO runs its own stage, and its lesson is one scrolling
 * page whose bar used to scroll away with it, which only worked while the site menu was pinned
 * above. So ECMO's port has two halves: the frame asks for the menu to be hidden, and the shell
 * pins its own bar. jsdom does no layout: these hold the markers, the published height and the
 * declarations; the geometry is measured in a browser (`e2e/ecmo-layout.spec.ts`).
 */

const shellCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/shell/EcmoActivityShell.module.css'),
  'utf8',
)
const stageCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/stage/EcmoLessonStage.module.css'),
  'utf8',
)

const FIXED_WORKSPACE = '@media (min-width: 1024px) and (min-height: 700px)'

/** Every rule body declared for `selector` inside a fixed-workspace media block. */
function fixedWorkspaceRules(selector: string): string[] {
  const bodies: string[] = []
  let from = 0
  for (;;) {
    const media = shellCss.indexOf(FIXED_WORKSPACE, from)
    if (media < 0) return bodies
    // The block ends at the first closing brace that starts a line.
    const end = shellCss.indexOf('\n}', media)
    const block = shellCss.slice(media, end)
    const start = block.indexOf(`${selector} {`)
    if (start >= 0) bodies.push(block.slice(start, block.indexOf('}', start)))
    from = end
  }
}

function mockLayout(node: HTMLElement, height: number, position = 'sticky') {
  jest.spyOn(node, 'getBoundingClientRect').mockReturnValue({ top: 0, height } as DOMRect)
  node.style.position = position
}

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
})

describe('the site menu', () => {
  it('is hidden while an ECMO lesson, practice case or challenge is open', () => {
    const { container } = render(
      <CardiohelpModuleFrame locale="en" activeHref="/cardiohelp-ecmo/learn" activityMode>
        <p>Lesson</p>
      </CardiohelpModuleFrame>,
    )
    expect(container.querySelector('[data-activity-frame]')).toHaveAttribute(
      'data-site-header',
      'hidden',
    )
  })

  it('stays on the ECMO overview and Learn page', () => {
    const { container } = render(
      <CardiohelpModuleFrame locale="en" activeHref="/cardiohelp-ecmo">
        <p>Overview</p>
      </CardiohelpModuleFrame>,
    )
    expect(container.querySelector('[data-site-header]')).toBeNull()
  })
})

describe('the lesson bar', () => {
  function shell(flowing: boolean) {
    return render(
      <EcmoActivityShell
        section="practice"
        stage="brief"
        label="Practice"
        header={<button type="button">Save &amp; exit</button>}
        flowing={flowing}
      >
        <p>Task</p>
      </EcmoActivityShell>,
    )
  }

  it('is the first row of the shell and holds the way out', () => {
    const { container } = shell(true)
    const bar = container.querySelector('[data-ecmo-shell] > [data-ecmo-lesson-bar]')
    expect(bar).not.toBeNull()
    expect(bar).toBe(container.querySelector('[data-ecmo-shell]')!.firstElementChild)
    expect(bar).toHaveTextContent('Save & exit')
  })

  it('is pinned to the top of the scrolling shell on a desktop window', () => {
    const [rule] = fixedWorkspaceRules(".shell[data-flowing='true'] > .header")
    expect(rule).toContain('position: sticky')
    expect(rule).toContain('top: 0')
    // Opaque, because the task scrolls underneath it.
    expect(rule).toMatch(/background:\s*color-mix\([^;]*#061519\)/)
  })

  it('lets go when enlarged text wraps it past a quarter of the window', () => {
    const [rule] = fixedWorkspaceRules(
      ".shell[data-flowing='true'] > .header[data-bar-unfits='true']",
    )
    expect(rule).toContain('position: static')

    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    const { container, unmount } = shell(true)
    const bar = container.querySelector<HTMLElement>('[data-ecmo-lesson-bar]')!
    mockLayout(bar, 61)
    window.dispatchEvent(new Event('resize'))
    expect(bar.dataset.barUnfits).toBe('false')
    mockLayout(bar, 240)
    window.dispatchEvent(new Event('resize'))
    expect(bar.dataset.barUnfits).toBe('true')
    unmount()
  })

  it('publishes its height while pinned, and zero while it is not', () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 852 })
    const { container, unmount } = shell(true)
    const root = container.querySelector<HTMLElement>('[data-ecmo-shell]')!
    const bar = container.querySelector<HTMLElement>('[data-ecmo-lesson-bar]')!
    // jsdom lays nothing out: unpinned and zero until a measurement says otherwise.
    expect(root.style.getPropertyValue('--ecmo-lesson-bar-height')).toBe('0px')

    mockLayout(bar, 61)
    window.dispatchEvent(new Event('resize'))
    expect(root.style.getPropertyValue('--ecmo-lesson-bar-height')).toBe('61px')
    expect(ecmoPinnedLessonBarHeight(root.querySelector('p'))).toBe(61)

    // Below the fixed workspace the stylesheet leaves the bar in the flow.
    mockLayout(bar, 61, 'static')
    window.dispatchEvent(new Event('resize'))
    expect(root.style.getPropertyValue('--ecmo-lesson-bar-height')).toBe('0px')
    expect(ecmoPinnedLessonBarHeight(root.querySelector('p'))).toBe(0)

    unmount()
    expect(root.style.getPropertyValue('--ecmo-lesson-bar-height')).toBe('')
  })

  it('is not measured where the shell does not scroll as one page', () => {
    const { container } = shell(false)
    const root = container.querySelector<HTMLElement>('[data-ecmo-shell]')!
    expect(root.style.getPropertyValue('--ecmo-lesson-bar-height')).toBe('')
  })
})

describe('one row at a laptop width', () => {
  // At 1280 px the bar had wrapped to 84 to 129 px with six controls in line. Pinned, that would
  // sit over the task. Below 1500 px the three rarely used controls fold into one menu.
  const original = window.matchMedia
  function narrow(matches: boolean) {
    window.matchMedia = ((query: string) => ({
      matches: matches && query === '(max-width: 1499px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia
  }
  afterEach(() => {
    window.matchMedia = original
  })

  function bar(onRestart = jest.fn(), onMainMenu = jest.fn()) {
    render(
      <EcmoSectionHeader
        kicker="VA track · Section 12 of 17"
        title="VA left ventricular loading: interpreting low pulsatility"
        sectionsControl={<button type="button">Sections</button>}
        onHelp={() => {}}
        onSaveAndExit={() => {}}
        onMainMenu={onMainMenu}
        onRestart={onRestart}
        restartLabel="Restart section"
        onRestartCourse={() => {}}
      />,
    )
    return document.querySelector<HTMLDetailsElement>('details[data-ecmo-header-more]')!
  }

  it('keeps the section name, Sections, help and Save & exit in the bar', () => {
    narrow(true)
    const menu = bar()
    expect(menu).not.toHaveAttribute('open')
    for (const name of ['Sections', 'What do I do now?', 'Save & exit']) {
      const control = screen.getByRole('button', {
        name: new RegExp(`^${name.replace('?', '\\?')}`),
      })
      expect(menu.contains(control)).toBe(false)
    }
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'VA left ventricular loading: interpreting low pulsatility',
    )
    for (const name of ['Main menu', 'Restart section', 'Restart course']) {
      expect(menu.contains(screen.getByRole('button', { name }))).toBe(true)
    }
  })

  it('opens the folded controls from one button, and closes on Escape with focus back on it', () => {
    narrow(true)
    const menu = bar()
    const summary = menu.querySelector('summary')!
    fireEvent.click(summary)
    expect(menu).toHaveAttribute('open')
    screen.getByRole('button', { name: 'Restart section' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(menu).not.toHaveAttribute('open')
    expect(summary).toHaveFocus()
  })

  it('closes on a press outside the menu', () => {
    narrow(true)
    const menu = bar()
    fireEvent.click(menu.querySelector('summary')!)
    expect(menu).toHaveAttribute('open')
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Sections' }))
    expect(menu).not.toHaveAttribute('open')
  })

  it('closes once a control in it has been used', () => {
    narrow(true)
    const onRestart = jest.fn()
    const menu = bar(onRestart)
    fireEvent.click(menu.querySelector('summary')!)
    fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))
    expect(onRestart).toHaveBeenCalledTimes(1)
    expect(menu).not.toHaveAttribute('open')
  })

  it('leaves all six controls in line on a wide window', () => {
    narrow(false)
    const menu = bar()
    expect(menu).toHaveAttribute('open')
    fireEvent.click(screen.getByRole('button', { name: 'Restart section' }))
    expect(menu).toHaveAttribute('open')
  })
})

describe('what starts under the pinned bar', () => {
  it('the urgent device strip pins below it, not behind it', () => {
    const [rule] = fixedWorkspaceRules(
      ".shell[data-flowing='true'] > .strip:has([data-operational-status='true'])",
    )
    expect(rule).toContain('top: var(--ecmo-lesson-bar-height, 0px)')
  })

  it('keyboard focus is scrolled clear of it in every flowing activity', () => {
    const [rule] = fixedWorkspaceRules(".shell[data-flowing='true']")
    expect(rule).toContain(
      'scroll-padding-block-start: calc(var(--ecmo-lesson-bar-height, 0px) + 1rem)',
    )
    // Learn adds its pinned strip to the same allowance.
    expect(shellCss).toMatch(
      /\.shell\[data-ecmo-shell='learn'\]\[data-flowing='true'\]\s*{\s*scroll-padding-block-start:\s*calc\(\s*var\(--ecmo-lesson-bar-height, 0px\) \+ var\(--ecmo-sticky-strip-height, 0px\) \+ 1rem\s*\);/,
    )
  })

  it('a control revealed by the lesson lands below the bar and the strip', () => {
    document.body.innerHTML =
      '<header></header><main id="main-content"><section data-ecmo-shell="learn"><div data-ecmo-lesson-bar></div><div data-ecmo-context-strip></div><div><button id="target">Control</button></div></section></main>'
    const root = document.querySelector<HTMLElement>('[data-ecmo-shell]')!
    root.style.overflowY = 'auto'
    Object.defineProperties(root, {
      clientHeight: { configurable: true, value: 852 },
      scrollHeight: { configurable: true, value: 2500 },
    })
    jest.spyOn(root, 'getBoundingClientRect').mockReturnValue({ top: 0, height: 852 } as DOMRect)
    mockLayout(document.querySelector<HTMLElement>('[data-ecmo-lesson-bar]')!, 61)
    mockLayout(document.querySelector<HTMLElement>('[data-ecmo-context-strip]')!, 72)
    const target = document.getElementById('target')!
    jest.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 1000 } as DOMRect)
    root.scrollTo = jest.fn()
    scrollEcmoTargetIntoView(target)
    // 1000 px down, less the bar (61), the strip (72) and the 16 px breathing room.
    expect(root.scrollTo).toHaveBeenCalledWith({ top: 1000 - 61 - 72 - 16, behavior: 'auto' })
    document.body.innerHTML = ''
  })
})

describe('the Sections menu', () => {
  it("shows each section's own title under its topic, as the other modules' menus do", () => {
    expect(stageCss).toMatch(/\.sectionsPanel nav button small\s*{\s*display:\s*block;/)
  })
})
