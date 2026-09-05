import { fireEvent, render, screen, within } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

import { CardiohelpHub } from '../components/CardiohelpHub'
import { CARDIOHELP_PROGRESS_STORAGE_KEY } from '../engine/progress'

/**
 * The hub's track chooser, as a real ARIA radio group rather than the shape of one.
 *
 * It declared `role="radiogroup"` with two `role="radio"` buttons and implemented none of that
 * pattern's keyboard model: both options sat in the tab sequence, and no arrow key did anything.
 * A keyboard learner could still reach and operate both, so this was never a trap — but the
 * markup promised a radio group to assistive technology and then behaved like two buttons, which
 * is the kind of mismatch that makes a screen reader's description of a control untrustworthy.
 *
 * Native `<input type="radio">` would have supplied all of this for free. It is not used here
 * because the approved presentation is built from fourteen CSS rules selecting
 * `.supportModeTabs button`, two of them inside width breakpoints, and each option renders an
 * icon, a title, a description and a state word. Reproducing that around a visually-hidden input
 * and a label would have rewritten the presentation this package was approved with. The roving
 * tabindex below follows the pattern already used by the workspace pane tabs in
 * `EcmoLearnWorkspace.tsx`.
 */

jest.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string; query?: Record<string, string> }
    children: ReactNode
  }) => {
    const resolved =
      typeof href === 'string'
        ? href
        : `${href.pathname}${
            href.query && Object.keys(href.query).length > 0
              ? `?${new URLSearchParams(href.query).toString()}`
              : ''
          }`
    return (
      <a href={resolved} {...props}>
        {children}
      </a>
    )
  },
}))

function chooser(): HTMLElement {
  return screen.getByRole('radiogroup', { name: 'ECMO support mode' })
}

function options(): HTMLElement[] {
  return within(chooser()).getAllByRole('radio')
}

function vv(): HTMLElement {
  return options()[0]!
}

function va(): HTMLElement {
  return options()[1]!
}

function checkedOption(): HTMLElement | undefined {
  return options().find((option) => option.getAttribute('aria-checked') === 'true')
}

function primaryCtaHref(container: HTMLElement): string | null {
  return container.querySelector('[data-ecmo-continue]')?.getAttribute('href') ?? null
}

/** The tertiary link to the pathway page, shown once the map is browsed; it carries the track. */
function browseHref(): string | null {
  const toggle = screen.getByRole('button', { name: /^Browse all \d+ sections$/ })
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  return screen.getByRole('link', { name: /Open the pathway page/ }).getAttribute('href')
}

function trackOf(href: string | null): string | null {
  if (!href) return null
  return new URLSearchParams(href.split('?')[1] ?? '').get('track')
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
})

describe('the hub track chooser implements the radio-group keyboard model', () => {
  it('puts exactly one option in the tab sequence', () => {
    render(<CardiohelpHub />)

    // Tab enters the group once and leaves it once: the unselected option is reachable by arrow
    // key, not by Tab.
    expect(options().filter((option) => option.tabIndex === 0)).toHaveLength(1)
    expect(vv().tabIndex).toBe(0)
    expect(va().tabIndex).toBe(-1)
  })

  it.each(['ArrowRight', 'ArrowDown'] as const)('selects VA with %s', (key) => {
    render(<CardiohelpHub />)
    vv().focus()

    fireEvent.keyDown(vv(), { key })

    expect(va()).toHaveAttribute('aria-checked', 'true')
    expect(vv()).toHaveAttribute('aria-checked', 'false')
    expect(va().tabIndex).toBe(0)
    expect(vv().tabIndex).toBe(-1)
  })

  it.each(['ArrowLeft', 'ArrowUp'] as const)('returns to VV with %s', (key) => {
    render(<CardiohelpHub />)
    fireEvent.keyDown(vv(), { key: 'ArrowRight' })

    fireEvent.keyDown(va(), { key })

    expect(vv()).toHaveAttribute('aria-checked', 'true')
    expect(va()).toHaveAttribute('aria-checked', 'false')
  })

  it('wraps forward from the last option to the first', () => {
    render(<CardiohelpHub />)
    fireEvent.keyDown(vv(), { key: 'ArrowRight' })
    expect(checkedOption()).toBe(va())

    fireEvent.keyDown(va(), { key: 'ArrowRight' })

    expect(checkedOption()).toBe(vv())
  })

  it('wraps backward from the first option to the last', () => {
    render(<CardiohelpHub />)

    fireEvent.keyDown(vv(), { key: 'ArrowLeft' })

    expect(checkedOption()).toBe(va())
  })

  it('moves focus with the selection', () => {
    render(<CardiohelpHub />)
    vv().focus()
    expect(document.activeElement).toBe(vv())

    fireEvent.keyDown(vv(), { key: 'ArrowRight' })

    expect(document.activeElement).toBe(va())
    expect(va()).toHaveAttribute('aria-checked', 'true')
  })

  it('selects the focused option with Space', () => {
    render(<CardiohelpHub />)
    // Arrow onto VA, arrow back so focus sits on an option that is not selected only if the
    // pattern were focus-without-selection; here selection follows focus, so Space re-affirms the
    // focused option rather than changing it, and must not throw or move the selection elsewhere.
    fireEvent.keyDown(vv(), { key: 'ArrowRight' })
    fireEvent.keyDown(va(), { key: ' ' })

    expect(checkedOption()).toBe(va())
    expect(document.activeElement).toBe(va())
  })

  it('keeps exactly one option checked at all times', () => {
    render(<CardiohelpHub />)
    expect(options().filter((o) => o.getAttribute('aria-checked') === 'true')).toHaveLength(1)

    fireEvent.keyDown(vv(), { key: 'ArrowRight' })
    expect(options().filter((o) => o.getAttribute('aria-checked') === 'true')).toHaveLength(1)

    fireEvent.keyDown(va(), { key: 'ArrowLeft' })
    expect(options().filter((o) => o.getAttribute('aria-checked') === 'true')).toHaveLength(1)
  })
})

describe('keyboard track selection carries through to both entry actions', () => {
  it('moves the Continue call to action onto the selected track', () => {
    const { container } = render(<CardiohelpHub />)
    expect(trackOf(primaryCtaHref(container))).toBe('vv')

    fireEvent.keyDown(vv(), { key: 'ArrowRight' })

    expect(trackOf(primaryCtaHref(container))).toBe('va')
  })

  it('moves the browse link onto the selected track', () => {
    render(<CardiohelpHub />)
    expect(trackOf(browseHref())).toBe('vv')

    fireEvent.keyDown(vv(), { key: 'ArrowRight' })

    expect(trackOf(browseHref())).toBe('va')
  })

  it('shows the selected track in the grouped list heading', () => {
    render(<CardiohelpHub />)
    fireEvent.keyDown(vv(), { key: 'ArrowRight' })

    expect(screen.getByRole('heading', { name: /pathway$/ }).textContent).toBe('VA pathway')
  })
})

describe('the chooser keeps its existing behaviour', () => {
  it('still selects by pointer', () => {
    const { container } = render(<CardiohelpHub />)

    fireEvent.click(va())

    expect(va()).toHaveAttribute('aria-checked', 'true')
    expect(trackOf(primaryCtaHref(container))).toBe('va')

    fireEvent.click(vv())

    expect(vv()).toHaveAttribute('aria-checked', 'true')
    expect(trackOf(primaryCtaHref(container))).toBe('vv')
  })

  it('writes nothing to storage when the learner only changes track', () => {
    // Choosing a track on the hub is a local view preference. It is not progress, and the module
    // has no writer for it — the workbench is what records where a learner actually went.
    const setItem = jest.spyOn(Storage.prototype, 'setItem')
    try {
      render(<CardiohelpHub />)

      fireEvent.keyDown(vv(), { key: 'ArrowRight' })
      fireEvent.click(vv())
      fireEvent.keyDown(vv(), { key: 'ArrowDown' })

      expect(setItem).not.toHaveBeenCalled()
      expect(window.localStorage.getItem(CARDIOHELP_PROGRESS_STORAGE_KEY)).toBeNull()
    } finally {
      setItem.mockRestore()
    }
  })

  it('carries the selection state in text, not only in colour', () => {
    render(<CardiohelpHub />)
    expect(vv().textContent).toContain('Selected')

    fireEvent.keyDown(vv(), { key: 'ArrowRight' })

    expect(va().textContent).toContain('Selected')
    expect(vv().textContent).not.toContain('Selected')
  })
})
