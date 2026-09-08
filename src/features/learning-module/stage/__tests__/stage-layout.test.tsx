import { act, cleanup, render, screen } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { DEFAULT_STAGE_PANE_ORDER, StageLayout, stagePaneSlot } from '../StageLayout'

/**
 * The shared stage's arrangement, and the options that were added to it in September 2026 after a
 * learner review of the ECMO module: visible pane captions, a caller-chosen pane order, the opening
 * widths, and a followed compact pane. Every one is optional, and the first assertion here is that
 * a caller passing none of them gets the markup every adopter had before they existed.
 *
 * jsdom has no layout, so the workspace's measured width is stubbed through the section element's
 * `getBoundingClientRect`, the way the workspace's own suite stubs it.
 */

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
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/x',
}))

const COMPACT_WIDTH = 600
const WIDE_WIDTH = 1400

let measuredWidth = WIDE_WIDTH
let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect
let originalResizeObserver: typeof ResizeObserver | undefined

beforeEach(() => {
  jest.useFakeTimers()
  measuredWidth = WIDE_WIDTH
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function measured(this: HTMLElement) {
    const rect = originalGetBoundingClientRect.call(this)
    if (this.tagName === 'SECTION' && this.hasAttribute('aria-label')) {
      return { ...rect, width: measuredWidth, left: 0 }
    }
    return rect
  }
  originalResizeObserver = globalThis.ResizeObserver
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

afterEach(() => {
  cleanup()
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect
  globalThis.ResizeObserver = originalResizeObserver as typeof ResizeObserver
  jest.useRealTimers()
})

function mountStage(
  props: Partial<Parameters<typeof StageLayout>[0]> = {},
): ReturnType<typeof render> {
  const view = render(
    <StageLayout
      stageId="section-1-recognize"
      label="Stage under test"
      module="module-under-test"
      workspaceLabel="workspace under test"
      header={<div data-testid="header">header</div>}
      simulator={<div data-testid="simulator-content">simulator content</div>}
      teaching={<div data-testid="teaching-content">teaching content</div>}
      task={<div data-testid="task-content">task content</div>}
      {...props}
    />,
  )
  act(() => {
    jest.runOnlyPendingTimers()
  })
  return view
}

function paneOrder(): readonly string[] {
  return Array.from(document.querySelectorAll('[data-pane]')).map(
    (pane) => pane.getAttribute('data-pane') ?? '',
  )
}

function regionNames(): readonly string[] {
  return Array.from(document.querySelectorAll('[role="region"][aria-label$=" panel"]')).map(
    (region) => region.getAttribute('aria-label') ?? '',
  )
}

function visiblePaneContent(): string {
  const panes = Array.from(document.querySelectorAll<HTMLElement>('[role="region"]')).filter(
    (region) => /panel$/.test(region.getAttribute('aria-label') ?? '') && !region.hidden,
  )
  expect(panes).toHaveLength(1)
  return panes[0].querySelector('[data-testid]')?.getAttribute('data-testid') ?? ''
}

describe('a stage that passes none of the options', () => {
  it('renders simulator, teaching, steps, with no caption element, as every adopter did', () => {
    mountStage()

    expect(DEFAULT_STAGE_PANE_ORDER).toEqual(['simulator', 'teaching', 'steps'])
    expect(paneOrder()).toEqual(['simulator', 'teaching', 'task'])
    expect(regionNames()).toEqual(['Simulator panel', 'Teaching panel', 'Steps panel'])
    expect(document.querySelector('[data-pane-label]')).toBeNull()
    // The pane element is the region's only child: nothing was inserted before it.
    for (const region of document.querySelectorAll('[role="region"][aria-label$=" panel"]')) {
      expect(region.children).toHaveLength(1)
      expect(region.firstElementChild?.hasAttribute('data-pane')).toBe(true)
    }
  })

  it('opens the compact view on the first slot and leaves it there', () => {
    measuredWidth = COMPACT_WIDTH
    mountStage()

    expect(visiblePaneContent()).toBe('simulator-content')
  })
})

describe('a stage that leads with its steps', () => {
  const order = ['steps', 'teaching', 'simulator'] as const

  it('puts the panes where the caller says, and names the regions to match', () => {
    mountStage({ paneOrder: order })

    expect(paneOrder()).toEqual(['task', 'teaching', 'simulator'])
    expect(regionNames()).toEqual(['Steps panel', 'Teaching panel', 'Simulator panel'])
    expect(
      screen.getByRole('region', { name: 'Steps panel' }).querySelector('[data-pane="task"]'),
    ).not.toBeNull()
  })

  /*
   * The pane's name is on the pane, not only in its accessible name.
   *
   * A step that says "Where to look: Teaching panel — the walk" is only followable if the pane says
   * the same word on screen, so the caption and the region name are asserted together.
   */
  it("prints each pane's own name on it, in the words a step's location uses", () => {
    mountStage({
      paneOrder: order,
      paneCaptions: {
        steps: 'what to do',
        teaching: 'what to read',
        simulator: 'what to look at',
      },
    })

    expect(
      Array.from(document.querySelectorAll('[data-pane-label]')).map((label) => label.textContent),
    ).toEqual([
      'Steps panel · what to do',
      'Teaching panel · what to read',
      'Simulator panel · what to look at',
    ])
    // The caption sits in the pane's own scrolling region, ahead of the pane content.
    const steps = screen.getByRole('region', { name: 'Steps panel' })
    expect(steps.firstElementChild?.getAttribute('data-pane-label')).toBe('steps')
    expect(steps.children[1]?.getAttribute('data-pane')).toBe('task')
    // Decorative: the region already carries the same name.
    expect(steps.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
  })

  it('captions only the panes it is given a caption for', () => {
    mountStage({ paneOrder: order, paneCaptions: { teaching: 'what to read' } })

    expect(
      Array.from(document.querySelectorAll('[data-pane-label]')).map((label) => label.textContent),
    ).toEqual(['Teaching panel · what to read'])
  })

  it('maps a pane to the slot its order gives it', () => {
    expect(stagePaneSlot(order, 'steps')).toBe('primary')
    expect(stagePaneSlot(order, 'teaching')).toBe('secondary')
    expect(stagePaneSlot(order, 'simulator')).toBe('tertiary')
    expect(stagePaneSlot(DEFAULT_STAGE_PANE_ORDER, 'steps')).toBe('tertiary')
  })

  /*
   * Followed, not forced: the compact view opens on the pane the step is worked in and moves when
   * that changes, through the slot the order gives the pane rather than a fixed slot.
   */
  it('opens the compact view on the pane the step names, wherever the order puts it', () => {
    measuredWidth = COMPACT_WIDTH
    const view = mountStage({ paneOrder: order, compactPane: 'simulator' })
    expect(visiblePaneContent()).toBe('simulator-content')

    view.rerender(
      <StageLayout
        stageId="section-1-predict"
        label="Stage under test"
        module="module-under-test"
        workspaceLabel="workspace under test"
        header={<div data-testid="header">header</div>}
        simulator={<div data-testid="simulator-content">simulator content</div>}
        teaching={<div data-testid="teaching-content">teaching content</div>}
        task={<div data-testid="task-content">task content</div>}
        paneOrder={order}
        compactPane="steps"
      />,
    )
    expect(visiblePaneContent()).toBe('task-content')
  })

  it('opens at the fractions it is given before the first measurement lands', () => {
    mountStage({
      paneOrder: order,
      defaultWidthFractions: { primary: 0.26, secondary: 0.29 },
    })
    const workspace = screen.getByRole('region', { name: 'workspace under test' })
    // After the measurement the widths are pixels; the fractions decide them.
    const primary = Number.parseFloat(workspace.style.getPropertyValue('--tw-primary-width'))
    const secondary = Number.parseFloat(workspace.style.getPropertyValue('--tw-secondary-width'))
    expect(primary).toBeGreaterThan(0)
    expect(secondary).toBeGreaterThan(primary)
  })
})

/**
 * A new step starts at the top of its Steps and Teaching panes.
 *
 * jsdom lays nothing out, so each region is given an inline overflow (what jsdom's
 * `getComputedStyle` reads) and a scroll extent larger than its height, the way a pane with more
 * content than room reports them in a browser. The Simulator pane is scrolled too, and must stay
 * where it is: its position is part of the state the learner is working in.
 */
describe('a stage whose step changes', () => {
  const order = ['steps', 'teaching', 'simulator'] as const

  function region(name: string): HTMLElement {
    return screen.getByRole('region', { name })
  }

  function scrolled(name: string, scrollTop: number): HTMLElement {
    const pane = region(name)
    pane.style.overflowY = 'auto'
    Object.defineProperty(pane, 'scrollHeight', { value: 1600, configurable: true })
    Object.defineProperty(pane, 'clientHeight', { value: 400, configurable: true })
    pane.scrollTop = scrollTop
    return pane
  }

  function stage(stageId: string) {
    return (
      <StageLayout
        stageId={stageId}
        label="Stage under test"
        module="module-under-test"
        workspaceLabel="workspace under test"
        header={<div data-testid="header">header</div>}
        simulator={<div data-testid="simulator-content">simulator content</div>}
        teaching={<div data-testid="teaching-content">teaching content</div>}
        task={<div data-testid="task-content">task content</div>}
        paneOrder={order}
      />
    )
  }

  it('returns the Steps and Teaching panes to their tops and leaves the Simulator pane alone', () => {
    const view = mountStage({ paneOrder: order })
    scrolled('Steps panel', 300)
    scrolled('Teaching panel', 900)
    scrolled('Simulator panel', 120)

    view.rerender(stage('section-1-predict'))

    expect(region('Steps panel').scrollTop).toBe(0)
    expect(region('Teaching panel').scrollTop).toBe(0)
    expect(region('Simulator panel').scrollTop).toBe(120)
  })

  it('does not move a pane while the step is the same', () => {
    const view = mountStage({ paneOrder: order })
    scrolled('Steps panel', 300)
    scrolled('Teaching panel', 900)

    view.rerender(stage('section-1-recognize'))

    expect(region('Steps panel').scrollTop).toBe(300)
    expect(region('Teaching panel').scrollTop).toBe(900)
  })
})
