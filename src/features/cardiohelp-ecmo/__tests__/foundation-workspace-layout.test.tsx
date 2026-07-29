import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { FitWidthSurface, fitWidthScale } from '../components/FitWidthSurface'
import { ecmoInteractiveFoundationSectionIds } from '../content/foundationLessonRuntime'

/**
 * The foundation workspace's layout guarantees.
 *
 * Four of them are measurable here and one is not. Scale arithmetic, pane focus, scroll containment
 * and which classes and tokens are declared are all assertable in jsdom. Computed colour contrast is
 * not: jsdom does not resolve `hsl(var(--token))`, cascade a CSS module, or composite a background,
 * so a "contrast" assertion here would be measuring a stub. That one is measured in a browser
 * against the real stylesheet, through the fixture built by
 * `scripts/cardiohelp-ecmo/build-foundation-workspace-preview.mts`, which publishes
 * `window.__ecmoWorkspaceProbe()` for exactly that purpose. What is asserted here instead is that the
 * workspace carries the theme class and that the class declares every token the utilities read —
 * the two things that, if broken, would silently reinstate the unreadable text.
 */

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

/**
 * Mount counters on the two device panes.
 *
 * Neither renders under jsdom — the circuit view reaches three.js through `EcmoCircuit3D` — and
 * neither is what these assertions read. What matters is how many times each is mounted, because a
 * focus change that remounted the console would restart the simulation the learner is reading.
 */
const consoleMounts = { count: 0 }
const circuitMounts = { count: 0 }

jest.mock('../components/CardiohelpConsole', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react')
  return {
    CardiohelpConsole: () => {
      useEffect(() => {
        consoleMounts.count += 1
      }, [])
      return <div data-testid="cardiohelp-console" />
    },
  }
})

jest.mock('../components/CircuitAndMonitors', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react')
  return {
    CircuitAndMonitors: () => {
      useEffect(() => {
        circuitMounts.count += 1
      }, [])
      return <div data-testid="circuit-and-monitors" />
    },
  }
})

const workspaceCssPath = join(
  process.cwd(),
  'src/features/cardiohelp-ecmo/components/EcmoFoundationWorkspace.module.css',
)
const workspaceCss = readFileSync(workspaceCssPath, 'utf8')

/** The block of a single top-level rule, so a token can be asserted to be in the right rule. */
function cssRuleBody(selector: string): string {
  const start = workspaceCss.indexOf(`${selector} {`)
  if (start < 0)
    throw new Error(`${selector} is not declared in EcmoFoundationWorkspace.module.css`)
  const end = workspaceCss.indexOf('}', start)
  return workspaceCss.slice(start, end)
}

beforeEach(() => {
  consoleMounts.count = 0
  circuitMounts.count = 0
})

afterEach(cleanup)

/* ------------------------------------------------------------------ *
 * A. Fit width
 * ------------------------------------------------------------------ */

describe('FitWidthSurface', () => {
  /**
   * jsdom has no layout, so the two measurements the component makes are stubbed on the prototype
   * before mounting — the surface's available width, and the content's width and height, the width
   * answering `min-content` with the intrinsic width exactly as a real layout would.
   */
  const geometry = { available: 0, intrinsicWidth: 0, intrinsicHeight: 0, contentMeasurements: 0 }
  let resizeCallbacks: ResizeObserverCallback[] = []
  let originalClientWidth: PropertyDescriptor | undefined
  let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect
  let originalResizeObserver: typeof ResizeObserver | undefined

  beforeEach(() => {
    geometry.available = 0
    geometry.intrinsicWidth = 0
    geometry.intrinsicHeight = 0
    geometry.contentMeasurements = 0
    resizeCallbacks = []

    originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute('data-fit-width-surface') ? geometry.available : 0
      },
    })

    originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
    HTMLElement.prototype.getBoundingClientRect = function measured(this: HTMLElement) {
      if (!this.hasAttribute('data-fit-width-content')) {
        return originalGetBoundingClientRect.call(this)
      }
      geometry.contentMeasurements += 1
      const width =
        this.style.width === 'min-content'
          ? geometry.intrinsicWidth
          : Number.parseFloat(this.style.width) || 0
      return {
        ...originalGetBoundingClientRect.call(this),
        width,
        height: geometry.intrinsicHeight,
      }
    }

    originalResizeObserver = globalThis.ResizeObserver
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
    }
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
    globalThis.ResizeObserver = originalResizeObserver as typeof ResizeObserver
  })

  function notifyResize() {
    act(() => {
      for (const callback of resizeCallbacks) {
        callback([], {} as ResizeObserver)
      }
    })
  }

  function surface() {
    const element = document.querySelector('[data-fit-width-surface]')
    if (!(element instanceof HTMLElement)) throw new Error('no fit surface rendered')
    return element
  }

  function content() {
    const element = document.querySelector('[data-fit-width-content]')
    if (!(element instanceof HTMLElement)) throw new Error('no fit content rendered')
    return element
  }

  it('never magnifies a surface that already fits', () => {
    expect(fitWidthScale(900, 800)).toBe(1)
    expect(fitWidthScale(800, 800)).toBe(1)
    // Degenerate measurements resolve to 1 rather than to 0 or Infinity.
    expect(fitWidthScale(0, 800)).toBe(1)
    expect(fitWidthScale(900, 0)).toBe(1)
  })

  it('scales down by the ratio of available to intrinsic width', () => {
    expect(fitWidthScale(400, 800)).toBe(0.5)
    expect(fitWidthScale(600, 800)).toBe(0.75)
  })

  it('exposes the measured widths and a scale of 1 when the child fits', () => {
    geometry.available = 900
    geometry.intrinsicWidth = 800
    geometry.intrinsicHeight = 600
    render(
      <FitWidthSurface>
        <div>console</div>
      </FitWidthSurface>,
    )

    expect(surface().dataset.fitMeasured).toBe('true')
    expect(surface().dataset.intrinsicWidth).toBe('800')
    expect(surface().dataset.availableWidth).toBe('900')
    expect(surface().dataset.fitScale).toBe('1.0000')
    // Laid out at the available width, so a pane wider than the console gets a console that fills it.
    expect(content().style.width).toBe('900px')
    expect(content().style.transform).toBe('')
    // No explicit height while unscaled: the surface takes the child's own height.
    expect(surface().style.height).toBe('')
  })

  it('scales, and heights the wrapper by intrinsic height times scale, when the child does not fit', () => {
    geometry.available = 400
    geometry.intrinsicWidth = 800
    geometry.intrinsicHeight = 600
    render(
      <FitWidthSurface>
        <div>console</div>
      </FitWidthSurface>,
    )

    expect(surface().dataset.fitScale).toBe('0.5000')
    expect(content().style.width).toBe('800px')
    expect(content().style.transform).toBe('scale(0.5)')
    // 600 × 0.5: no unscaled blank layout box is left behind.
    expect(surface().style.height).toBe('300px')
  })

  it('leaves no horizontal overflow in fit mode', () => {
    geometry.available = 583
    geometry.intrinsicWidth = 859
    geometry.intrinsicHeight = 703
    render(
      <FitWidthSurface>
        <div>console</div>
      </FitWidthSurface>,
    )

    const scale = Number(surface().dataset.fitScale)
    const layoutWidth = Number.parseFloat(content().style.width)
    // The painted width is the available width, to within a rounding of the scale.
    expect(layoutWidth * scale).toBeLessThanOrEqual(geometry.available + 0.5)
    expect(surface().dataset.fitMode).toBe('fit')
  })

  it('recalculates on a ResizeObserver notification', () => {
    geometry.available = 800
    geometry.intrinsicWidth = 800
    geometry.intrinsicHeight = 600
    render(
      <FitWidthSurface>
        <div>console</div>
      </FitWidthSurface>,
    )
    expect(surface().dataset.fitScale).toBe('1.0000')

    geometry.available = 400
    notifyResize()

    expect(surface().dataset.fitScale).toBe('0.5000')
    expect(surface().dataset.availableWidth).toBe('400')
  })

  it('remeasures when the workspace focus changes', () => {
    geometry.available = 400
    geometry.intrinsicWidth = 800
    geometry.intrinsicHeight = 600
    const { rerender } = render(
      <FitWidthSurface remeasureKey="all">
        <div>console</div>
      </FitWidthSurface>,
    )
    const measurementsAfterMount = geometry.contentMeasurements
    expect(surface().dataset.fitScale).toBe('0.5000')

    // Maximizing the pane widens it. Nothing about the child changed, so only a remeasure can find it.
    geometry.available = 1200
    rerender(
      <FitWidthSurface remeasureKey="primary">
        <div>console</div>
      </FitWidthSurface>,
    )

    expect(geometry.contentMeasurements).toBeGreaterThan(measurementsAfterMount)
    expect(surface().dataset.fitScale).toBe('1.0000')
    expect(surface().dataset.availableWidth).toBe('1200')
  })

  it('renders at design size and scrolls internally in actual-size mode', () => {
    geometry.available = 400
    geometry.intrinsicWidth = 800
    geometry.intrinsicHeight = 600
    render(
      <FitWidthSurface mode="actual">
        <div>console</div>
      </FitWidthSurface>,
    )

    expect(surface().dataset.fitMode).toBe('actual')
    expect(surface().dataset.fitScale).toBe('1.0000')
    expect(content().style.transform).toBe('')
    expect(cssRuleBody(".fitSurface[data-fit-mode='actual']")).toContain('overflow-x: auto')
  })
})

/* ------------------------------------------------------------------ *
 * B. Workspace focus
 * ------------------------------------------------------------------ */

function mountLesson(
  sectionId: Parameters<
    typeof EcmoFoundationLessonActivity
  >[0]['sectionId'] = 'vv-series-physiology',
  supportMode: 'vv' | 'va' = 'vv',
) {
  return render(<EcmoFoundationLessonActivity sectionId={sectionId} supportMode={supportMode} />)
}

function frame() {
  const element = document.querySelector('[data-ecmo-workspace-frame]')
  if (!(element instanceof HTMLElement)) throw new Error('no workspace frame rendered')
  return element
}

function paneRegions() {
  return Array.from(document.querySelectorAll('[data-ecmo-workspace-frame] [role="region"]'))
}

function scroller(pane: 'primary' | 'secondary' | 'tertiary') {
  const element = document.querySelector(`[data-scroll-pane="${pane}"]`)
  if (!(element instanceof HTMLElement)) throw new Error(`no scroll pane stamped for ${pane}`)
  return element
}

describe('foundation workspace focus', () => {
  it('renders all three panes, and only one of each device surface, by default', () => {
    mountLesson()

    expect(frame().dataset.workspaceFocus).toBe('all')
    expect(paneRegions()).toHaveLength(3)
    for (const region of paneRegions()) {
      expect(region.getAttribute('data-mobile-visible')).toBe('true')
    }
    expect(screen.getAllByTestId('cardiohelp-console')).toHaveLength(1)
    expect(screen.getAllByTestId('circuit-and-monitors')).toHaveLength(1)
    expect(consoleMounts.count).toBe(1)
    expect(circuitMounts.count).toBe(1)
    // One workspace, not two.
    expect(document.querySelectorAll('[data-ecmo-workspace-frame] > section')).toHaveLength(1)
  })

  it('maximizes the device pane and hides the other two', () => {
    mountLesson()

    fireEvent.click(screen.getByRole('button', { name: 'Maximize circuit & console' }))

    expect(frame().dataset.workspaceFocus).toBe('primary')
    const visibility = paneRegions().map((region) => region.getAttribute('data-mobile-visible'))
    expect(visibility).toEqual(['true', 'false', 'false'])
    expect(screen.getByRole('button', { name: 'Maximize circuit & console' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('maximizes the teaching and activity panes too', () => {
    mountLesson()

    fireEvent.click(screen.getByRole('button', { name: 'Maximize teaching' }))
    expect(frame().dataset.workspaceFocus).toBe('secondary')
    expect(paneRegions().map((region) => region.getAttribute('data-mobile-visible'))).toEqual([
      'false',
      'true',
      'false',
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Maximize your turn' }))
    expect(frame().dataset.workspaceFocus).toBe('tertiary')
    expect(paneRegions().map((region) => region.getAttribute('data-mobile-visible'))).toEqual([
      'false',
      'false',
      'true',
    ])
  })

  it('hides the resize handles and collapses to one column while focused', () => {
    mountLesson()
    fireEvent.click(screen.getByRole('button', { name: 'Maximize circuit & console' }))

    const workspace = document.querySelector('[data-ecmo-workspace-frame] > section')
    expect(workspace?.className).toContain('focusedWorkspace')

    // What that class does. jsdom applies no CSS module, so the rule itself is the assertion.
    expect(workspaceCss).toContain(
      '.focusedWorkspace [data-teaching-resize-handle] {\n  display: none;\n}',
    )
    expect(workspaceCss).toContain(
      ".focusedWorkspace [data-mobile-visible='false'] {\n  display: none;\n}",
    )
    expect(cssRuleBody('.focusedWorkspace.focusedWorkspace')).toContain(
      'grid-template-columns: minmax(0, 1fr)',
    )
  })

  it('restores all three panes without remounting the simulation', () => {
    mountLesson()

    fireEvent.click(screen.getByRole('button', { name: 'Maximize circuit & console' }))
    fireEvent.click(screen.getByRole('button', { name: 'Return to three panes' }))

    expect(frame().dataset.workspaceFocus).toBe('all')
    expect(paneRegions().map((region) => region.getAttribute('data-mobile-visible'))).toEqual([
      'true',
      'true',
      'true',
    ])
    expect(screen.getAllByTestId('cardiohelp-console')).toHaveLength(1)
    expect(screen.getAllByTestId('circuit-and-monitors')).toHaveLength(1)
    expect(consoleMounts.count).toBe(1)
    expect(circuitMounts.count).toBe(1)
  })

  it('toggles focus off when the same pane is chosen twice', () => {
    mountLesson()
    const button = screen.getByRole('button', { name: 'Maximize teaching' })

    fireEvent.click(button)
    expect(frame().dataset.workspaceFocus).toBe('secondary')
    fireEvent.click(button)
    expect(frame().dataset.workspaceFocus).toBe('all')
  })

  it('announces the focused pane politely, and only offers a restore when there is one', () => {
    mountLesson()

    const restore = screen.getByRole('button', { name: 'Return to three panes' })
    expect(restore).toBeDisabled()
    expect(screen.getByText('All three workspace panels are shown.').getAttribute('role')).toBe(
      'status',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Maximize circuit & console' }))

    expect(restore).toBeEnabled()
    const announcement = screen.getByText(/Circuit & console is maximized/)
    expect(announcement).toHaveAttribute('role', 'status')
    expect(announcement).toHaveClass('sr-only')
  })

  it('offers the console at actual size, defaulting to fit', () => {
    mountLesson()
    const toggle = screen.getByRole('button', { name: 'Console at actual size' })

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(toggle.dataset.consoleFitMode).toBe('fit')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle.dataset.consoleFitMode).toBe('actual')
  })
})

/* ------------------------------------------------------------------ *
 * C. Scroll containment
 * ------------------------------------------------------------------ */

describe('foundation workspace pane scrolling', () => {
  it('stamps the scroll marker on the element that actually scrolls', () => {
    mountLesson()

    for (const pane of ['primary', 'secondary', 'tertiary'] as const) {
      // The scrolling element is the shared pane region, not this activity's content wrapper.
      expect(scroller(pane).getAttribute('role')).toBe('region')
      expect(scroller(pane).querySelector('[data-pane]')).not.toBeNull()
    }
    expect(scroller('secondary').querySelector('[data-pane="teaching"]')).not.toBeNull()
  })

  it('declares independent, contained scrolling for every pane', () => {
    const rule = cssRuleBody('.readableWorkspace [data-scroll-pane]')
    expect(rule).toContain('min-width: 0')
    expect(rule).toContain('min-height: 0')
    expect(rule).toContain('overflow-y: auto')
    expect(rule).toContain('overscroll-behavior: contain')
    expect(rule).toContain('scrollbar-gutter: stable')
  })

  it('scrolls one pane without moving the others or the page', () => {
    mountLesson()
    const before = {
      primary: scroller('primary').scrollTop,
      secondary: scroller('secondary').scrollTop,
      tertiary: scroller('tertiary').scrollTop,
      page: window.scrollY,
    }

    scroller('secondary').scrollTop = 480
    fireEvent.scroll(scroller('secondary'))

    expect(scroller('secondary').scrollTop).toBe(480)
    expect(scroller('primary').scrollTop).toBe(before.primary)
    expect(scroller('tertiary').scrollTop).toBe(before.tertiary)
    expect(window.scrollY).toBe(before.page)
  })

  it('puts each pane back where it was after a focus change', () => {
    mountLesson()

    scroller('secondary').scrollTop = 240
    fireEvent.scroll(scroller('secondary'))
    scroller('primary').scrollTop = 90
    fireEvent.scroll(scroller('primary'))

    fireEvent.click(screen.getByRole('button', { name: 'Maximize circuit & console' }))
    /*
     * A browser destroys the scroll box of a pane it takes out of the layout, so the pane comes back
     * at the top. jsdom has no layout and so cannot do that to us; the reset is applied by hand here
     * so that what is under test is the restore, which is the part that has to work. The browser
     * fixture confirms the reset itself: at 1280 × 800 the teaching pane really does read 0 while
     * hidden and 520 again after the restore.
     */
    scroller('secondary').scrollTop = 0
    scroller('tertiary').scrollTop = 0

    fireEvent.click(screen.getByRole('button', { name: 'Return to three panes' }))

    expect(scroller('secondary').scrollTop).toBe(240)
    expect(scroller('primary').scrollTop).toBe(90)
    expect(window.scrollY).toBe(0)
  })

  it('keeps a wide matrix inside its own horizontal scroller', () => {
    mountLesson('va-integration-capstone', 'va')

    const matrix = document.querySelector('[data-hypothesis-matrix]')
    expect(matrix).not.toBeNull()
    const scrollerElement = matrix?.parentElement
    expect(scrollerElement?.className).toContain('overflow-x-auto')
    // And the pane it lives in is allowed to be narrower than the matrix.
    expect(cssRuleBody('.readingPane :global(.overflow-x-auto)')).toContain('min-width: 0')
  })
})

/* ------------------------------------------------------------------ *
 * D. Theme
 * ------------------------------------------------------------------ */

describe('foundation workspace theme', () => {
  const semanticTokens = [
    '--background',
    '--foreground',
    '--card',
    '--card-foreground',
    '--popover',
    '--popover-foreground',
    '--muted',
    '--muted-foreground',
    '--primary',
    '--primary-foreground',
    '--border',
    '--input',
    '--ring',
  ]

  it('puts the readable-theme class on the shared workspace', () => {
    mountLesson()
    const workspace = document.querySelector('[data-ecmo-workspace-frame] > section')
    expect(workspace?.className).toContain('readableWorkspace')
  })

  it('re-declares every semantic token the utilities read', () => {
    const rule = cssRuleBody('.readableWorkspace')
    for (const token of semanticTokens) {
      expect(rule).toContain(`${token}: `)
    }
    expect(rule).toContain('color-scheme: light')
  })

  it('bounds the workspace height on the viewport and a measured offset', () => {
    const rule = cssRuleBody('.workspaceFrame')
    expect(rule).toContain('100dvh')
    expect(rule).toContain('var(--ecmo-workspace-offset')
    expect(rule).toContain('min-height: 0')
    expect(rule).toContain('overflow: hidden')
  })

  it('hands the device palette back to the console and circuit surfaces', () => {
    mountLesson()
    const surface = document.querySelector('[data-pane="circuit-and-console"] > .deviceSurface')
    expect(surface).not.toBeNull()
    expect(surface?.querySelector('[data-testid="cardiohelp-console"]')).not.toBeNull()
    expect(surface?.querySelector('[data-testid="circuit-and-monitors"]')).not.toBeNull()
    expect(cssRuleBody('.deviceSurface')).toContain('color: var(--ink')
  })

  it('sets essential copy without opacity-based dimming', () => {
    mountLesson()

    for (const pane of ['teaching', 'your-turn'] as const) {
      const root = document.querySelector(`[data-pane="${pane}"]`)
      expect(root).not.toBeNull()
      const dimmed = Array.from(root?.querySelectorAll('*') ?? []).filter((element) => {
        const className = element.getAttribute('class') ?? ''
        return /(^|\s)opacity-\d/.test(className) || /text-[a-z-]+\/\d/.test(className)
      })
      expect(dimmed.map((element) => element.getAttribute('class'))).toEqual([])
    }
  })

  it('promotes the reading panes to body-sized copy', () => {
    mountLesson()
    for (const pane of ['teaching', 'your-turn'] as const) {
      expect(document.querySelector(`[data-pane="${pane}"]`)?.className).toContain('readingPane')
    }
    expect(cssRuleBody('.readingPane :global(.text-sm)')).toContain('font-size: 1rem')
    expect(cssRuleBody('.readingPane :global(.text-xs)')).toContain('font-size: 0.9375rem')
    // A short tracked uppercase string is a label and stays compact.
    expect(cssRuleBody('.readingPane :global(.text-xs.uppercase)')).toContain(
      'font-size: 0.8125rem',
    )
  })
})

/* ------------------------------------------------------------------ *
 * E. Regression
 * ------------------------------------------------------------------ */

describe('foundation workspace regression', () => {
  it('still mounts all ten interactive foundation sections in the workspace', () => {
    expect(ecmoInteractiveFoundationSectionIds).toHaveLength(10)

    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      const supportMode = sectionId.startsWith('va-') ? 'va' : 'vv'
      const view = mountLesson(sectionId, supportMode)
      expect(frame().dataset.workspaceFocus).toBe('all')
      expect(paneRegions()).toHaveLength(3)
      expect(screen.getAllByTestId('cardiohelp-console')).toHaveLength(1)
      view.unmount()
    }
  })
})
