import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, cleanup, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { EcmoFoundationLessonActivity } from '../components/EcmoFoundationLessonActivity'
import { FitWidthSurface, fitWidthScale } from '../components/FitWidthSurface'
import { ecmoInteractiveFoundationSectionIds } from '../content/foundationLessonRuntime'

/**
 * The foundation section's layout guarantees, now on the lesson stage.
 *
 * Two of them are measurable here and one is not. Scale arithmetic and which classes, panes and
 * tokens are declared are assertable in jsdom. Computed colour contrast is not: jsdom does not
 * resolve `hsl(var(--token))`, cascade a CSS module, or composite a background, so a "contrast"
 * assertion here would be measuring a stub. That one is measured in a browser against the real
 * stylesheet. What is asserted here instead is the arrangement a learner reads — three panes in a
 * frame the shell sizes to the viewport — and that the stylesheet still declares the rules that,
 * if broken, would silently reinstate a page that scrolls as a whole or paints dark text on dark.
 */

const mockPush = jest.fn()

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string }
    children: ReactNode
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/cardiohelp-ecmo/learn',
}))

/**
 * Mount counters on the two device surfaces.
 *
 * Neither renders under jsdom — the circuit view reaches three.js through `EcmoCircuit3D` — and
 * neither is what these assertions read. What matters is how many times each is mounted, because a
 * layout that remounted the console would restart the simulation the learner is reading.
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
    CircuitSchematic: () => {
      useEffect(() => {
        circuitMounts.count += 1
      }, [])
      return <div data-testid="circuit-schematic" />
    },
    GasBlenderPanel: () => <div data-testid="gas-blender-panel" />,
    PatientMonitor: () => <div data-testid="patient-monitor" />,
    TrendPanel: () => <div data-testid="trend-panel" />,
  }
})

const moduleCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/cardiohelp-ecmo.module.css'),
  'utf8',
)
const stageCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/stage/EcmoLessonStage.module.css'),
  'utf8',
)
const fitWidthCss = readFileSync(
  join(process.cwd(), 'src/features/cardiohelp-ecmo/components/FitWidthSurface.module.css'),
  'utf8',
)

/** The block of a single rule, so a declaration can be asserted to be in the right rule. */
function cssRuleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`${selector} is not declared in the stylesheet`)
  const end = css.indexOf('}', start)
  return css.slice(start, end)
}

beforeEach(() => {
  consoleMounts.count = 0
  circuitMounts.count = 0
  mockPush.mockReset()
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

  it('remeasures when the remeasure key changes', () => {
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

    // The pane widened. Nothing about the child changed, so only a remeasure can find it.
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
    expect(cssRuleBody(fitWidthCss, ".fitSurface[data-fit-mode='actual']")).toContain(
      'overflow-x: auto',
    )
  })
})

/* ------------------------------------------------------------------ *
 * B. The stage layout
 * ------------------------------------------------------------------ */

function mountLesson(
  sectionId: Parameters<
    typeof EcmoFoundationLessonActivity
  >[0]['sectionId'] = 'vv-series-physiology',
  supportMode: 'vv' | 'va' = 'vv',
) {
  return render(<EcmoFoundationLessonActivity sectionId={sectionId} supportMode={supportMode} />)
}

function shell(): HTMLElement {
  const element = document.querySelector('[data-critical-care-activity-shell]')
  if (!(element instanceof HTMLElement)) throw new Error('no activity shell rendered')
  return element
}

function panes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-pane]'))
}

describe('stage layout', () => {
  it('renders the shell root inside the module frame’s activity mode', () => {
    mountLesson()

    expect(shell().getAttribute('data-critical-care-activity-shell')).toBe('true')
    expect(shell().getAttribute('data-ecmo-shell')).toBe('learn')
    expect(shell().getAttribute('aria-label')).toBe('VV foundation section')
    // The frame hands the viewport to the shell rather than letting the page grow.
    const frame = shell().closest('main')
    expect(frame).not.toBeNull()
    expect(frame?.getAttribute('data-activity-mode')).toBe('true')
    expect(shell().querySelector('[data-ecmo-stage-frame]')).not.toBeNull()
  })

  it('bounds the module shell on the viewport and contains its overflow', () => {
    const rule = cssRuleBody(moduleCss, ".moduleShell[data-activity-mode='true']")
    expect(rule).toContain('height: calc(100dvh - var(--site-header-height, 4rem))')
    expect(rule).toContain('min-height: 0')
    expect(rule).toContain('overflow: hidden')
  })

  it('fills the shell with the workspace frame and paints the dark workspace', () => {
    const frame = cssRuleBody(stageCss, '.workspaceFrame')
    expect(frame).toContain('height: 100%')
    expect(frame).toContain('min-height: 0')

    // Doubled for specificity: the shared `.workspace` rule paints a light surface at the same
    // single-class specificity, and which of two equal rules wins would depend on stylesheet order.
    const workspace = cssRuleBody(stageCss, '.workspace.workspace')
    expect(workspace).toContain('color-scheme: dark')
    expect(workspace).toMatch(/background: #/)
    expect(workspace).toMatch(/color: var\(--ink/)

    // And the dark palette re-declares every semantic token the utilities read.
    const tokens = cssRuleBody(stageCss, '.workspace')
    for (const token of [
      '--background',
      '--foreground',
      '--card',
      '--card-foreground',
      '--muted',
      '--muted-foreground',
      '--primary',
      '--primary-foreground',
      '--border',
      '--input',
      '--ring',
    ]) {
      expect(tokens).toContain(`${token}: `)
    }
  })

  it('renders exactly three panes, each in its own labelled region of the shared workspace', () => {
    mountLesson()

    expect(panes().map((pane) => pane.getAttribute('data-pane'))).toEqual([
      'simulator',
      'teaching',
      'task',
    ])
    const workspace = screen.getByRole('region', {
      name: 'ECMO lesson workspace: simulator, teaching, and steps',
    })
    expect(workspace.className).toContain('workspace')
    expect(shell().querySelector('[data-ecmo-stage-frame]')).toContainElement(workspace)
    for (const [pane, label] of [
      ['simulator', 'Simulator panel'],
      ['teaching', 'Teaching panel'],
      ['task', 'Steps panel'],
    ] as const) {
      const region = screen.getByRole('region', { name: label })
      expect(region.querySelector(`[data-pane="${pane}"]`)).not.toBeNull()
    }
  })

  it('mounts the console once, scaled to fit the simulator pane', () => {
    mountLesson()

    const simulator = document.querySelector('[data-pane="simulator"]')
    const fit = simulator?.querySelector('[data-fit-width-surface]')
    expect(fit).not.toBeNull()
    expect(fit?.getAttribute('data-fit-mode')).toBe('fit')
    expect(fit?.querySelector('[data-testid="cardiohelp-console"]')).not.toBeNull()
    expect(screen.getAllByTestId('cardiohelp-console')).toHaveLength(1)
    expect(screen.getAllByTestId('circuit-schematic')).toHaveLength(1)
    expect(consoleMounts.count).toBe(1)
    expect(circuitMounts.count).toBe(1)
  })

  it('keeps a wide matrix inside its own horizontal scroller', () => {
    mountLesson('va-integration-capstone', 'va')

    const matrix = document.querySelector('[data-hypothesis-matrix]')
    expect(matrix).not.toBeNull()
    expect(document.querySelector('[data-pane="teaching"]')).toContainElement(matrix as HTMLElement)
    const scroller = matrix?.parentElement
    expect(scroller?.className).toContain('overflow-x-auto')
    // And the pane it lives in is allowed to be narrower than the matrix.
    expect(cssRuleBody(stageCss, '.teachingColumn :global(.overflow-x-auto)')).toContain(
      'min-width: 0',
    )
  })
})

/* ------------------------------------------------------------------ *
 * C. Regression
 * ------------------------------------------------------------------ */

describe('stage layout regression', () => {
  it('still mounts all ten interactive foundation sections on the stage', () => {
    expect(ecmoInteractiveFoundationSectionIds).toHaveLength(10)

    for (const sectionId of ecmoInteractiveFoundationSectionIds) {
      const supportMode = sectionId.startsWith('va-') ? 'va' : 'vv'
      const view = mountLesson(sectionId, supportMode)
      expect(shell().getAttribute('data-stage')).toBe(`${sectionId}-recognize`)
      expect(panes()).toHaveLength(3)
      expect(screen.getAllByTestId('cardiohelp-console')).toHaveLength(1)
      view.unmount()
    }
  })
})
