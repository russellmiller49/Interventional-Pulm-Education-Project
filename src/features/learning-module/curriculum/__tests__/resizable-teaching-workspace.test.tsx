import { act, cleanup, fireEvent, render } from '@testing-library/react'

import { ResizableTeachingWorkspace } from '../ResizableTeachingWorkspace'

/**
 * The compact tablist's keyboard contract, on the shared component itself.
 *
 * Every consumer — the ECMO foundation activity, the MV workbench, the MCS Learn sections — gets
 * this tab row below the compact threshold, and until the correction it was a keyboard trap: the
 * two inactive tabs sat at tabIndex −1 with no key handling, so keyboard-only access to two of the
 * three panes was impossible at compact widths in every module at once. The contract is the
 * WAI-ARIA tabs pattern with selection following focus.
 *
 * jsdom has no layout, so the workspace's measured width is stubbed through the section element's
 * `getBoundingClientRect`, exactly the way the ECMO workspace-layout suite stubs its geometry.
 */

const COMPACT_WIDTH = 600
const WIDE_WIDTH = 1400

let measuredWidth = COMPACT_WIDTH
let originalGetBoundingClientRect: typeof HTMLElement.prototype.getBoundingClientRect
let originalResizeObserver: typeof ResizeObserver | undefined

beforeEach(() => {
  jest.useFakeTimers()
  measuredWidth = COMPACT_WIDTH
  originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  HTMLElement.prototype.getBoundingClientRect = function measured(this: HTMLElement) {
    const rect = originalGetBoundingClientRect.call(this)
    if (this.tagName === 'SECTION') return { ...rect, width: measuredWidth, left: 0 }
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

function mountWorkspace(props: { activePane?: 'primary' | 'secondary' | 'tertiary' } = {}) {
  const view = render(
    <ResizableTeachingWorkspace
      primary={<div data-testid="primary-content">primary content</div>}
      secondary={<div data-testid="secondary-content">secondary content</div>}
      tertiary={<div data-testid="tertiary-content">tertiary content</div>}
      paneLabels={{ primary: 'Circuit & console', secondary: 'Teaching', tertiary: 'Your turn' }}
      workspaceLabel="workspace under test"
      {...props}
    />,
  )
  // The component measures itself in a zero-delay timeout before deciding it is compact.
  act(() => {
    jest.runOnlyPendingTimers()
  })
  return view
}

function tabs(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
}

function tabByName(name: string): HTMLButtonElement {
  const match = tabs().find((tab) => tab.textContent === name)
  if (!match) throw new Error(`no tab named ${name}`)
  return match
}

function selectedTabName(): string | null {
  return tabs().find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent ?? null
}

/** aria-selected, roving tabIndex, focus, and the visible pane, all read together. */
function expectSelected(name: string) {
  const selected = tabByName(name)
  expect(selected.getAttribute('aria-selected')).toBe('true')
  expect(selected.tabIndex).toBe(0)
  expect(document.activeElement).toBe(selected)

  const others = tabs().filter((tab) => tab !== selected)
  expect(others).toHaveLength(2)
  for (const other of others) {
    expect(other.getAttribute('aria-selected')).toBe('false')
    expect(other.tabIndex).toBe(-1)
  }

  // The selected tab's pane is the one not hidden, and aria-controls points at it.
  const paneId = selected.getAttribute('aria-controls')
  expect(paneId).toBeTruthy()
  const pane = document.getElementById(paneId!)
  expect(pane).not.toBeNull()
  expect(pane!.hasAttribute('hidden')).toBe(false)
}

function press(key: string) {
  const active = document.activeElement
  if (!(active instanceof HTMLElement)) throw new Error('nothing focused')
  fireEvent.keyDown(active, { key })
}

describe('the compact tablist', () => {
  it('appears below the compact threshold and not above it', () => {
    mountWorkspace()
    expect(tabs()).toHaveLength(3)
    cleanup()

    measuredWidth = WIDE_WIDTH
    mountWorkspace()
    expect(tabs()).toHaveLength(0)
  })

  it('never renders when a parent owns the switcher through activePane', () => {
    mountWorkspace({ activePane: 'secondary' })
    expect(tabs()).toHaveLength(0)
  })

  it('keeps exactly one tab in the Tab order, so the row is entered and left once', () => {
    mountWorkspace()
    const stops = tabs().filter((tab) => tab.tabIndex === 0)
    expect(stops).toHaveLength(1)
    expect(stops[0].textContent).toBe('Circuit & console')
  })
})

describe('the tablist keyboard model', () => {
  it('moves selection and focus right, wrapping at the end', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()

    press('ArrowRight')
    expectSelected('Teaching')
    press('ArrowRight')
    expectSelected('Your turn')
    press('ArrowRight')
    expectSelected('Circuit & console')
  })

  it('moves selection and focus left, wrapping at the start', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()

    press('ArrowLeft')
    expectSelected('Your turn')
    press('ArrowLeft')
    expectSelected('Teaching')
    press('ArrowLeft')
    expectSelected('Circuit & console')
  })

  it('mirrors next and previous on ArrowDown and ArrowUp', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()

    press('ArrowDown')
    expectSelected('Teaching')
    press('ArrowUp')
    expectSelected('Circuit & console')
  })

  it('jumps to the first and last tab on Home and End', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()

    press('End')
    expectSelected('Your turn')
    press('Home')
    expectSelected('Circuit & console')
  })

  it('reaches every pane from the keyboard alone — the trap this contract closes', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()

    press('ArrowRight')
    expect(
      document.getElementById(tabByName('Teaching').getAttribute('aria-controls')!)!,
    ).not.toHaveAttribute('hidden')

    press('ArrowRight')
    expect(
      document.getElementById(tabByName('Your turn').getAttribute('aria-controls')!)!,
    ).not.toHaveAttribute('hidden')
  })

  it('ignores keys that are not part of the pattern', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()

    for (const key of ['Enter', ' ', 'PageDown', 'a', 'Escape']) {
      fireEvent.keyDown(document.activeElement!, { key })
      expect(selectedTabName()).toBe('Circuit & console')
    }
  })
})

describe('what switching panes preserves', () => {
  it('keeps every pane mounted while hidden, so pane state survives a switch', () => {
    mountWorkspace()
    tabByName('Circuit & console').focus()
    press('ArrowRight')

    // Hidden, not unmounted: all three contents stay in the document.
    for (const testId of ['primary-content', 'secondary-content', 'tertiary-content']) {
      expect(document.querySelector(`[data-testid="${testId}"]`)).not.toBeNull()
    }
    const primaryPane = document.getElementById(
      tabByName('Circuit & console').getAttribute('aria-controls')!,
    )
    expect(primaryPane).toHaveAttribute('hidden')
  })

  it('still activates on pointer click, unchanged by the keyboard model', () => {
    mountWorkspace()
    fireEvent.click(tabByName('Teaching'))

    expect(tabByName('Teaching').getAttribute('aria-selected')).toBe('true')
    expect(
      document.getElementById(tabByName('Teaching').getAttribute('aria-controls')!),
    ).not.toHaveAttribute('hidden')
  })
})
