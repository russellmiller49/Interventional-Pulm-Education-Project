import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, render } from '@testing-library/react'
import { createRef, type RefObject } from 'react'

import { useImagingFocusClearance } from '../components/stage/useImagingFocusClearance'

/**
 * G02-PI-01: on the projection lab, Tab could move focus to a lab slider while that slider sat
 * behind the pinned course header, and ArrowRight then changed a value the learner could not see.
 *
 * The repair is declarative — `scroll-padding` on the page, which is the activity's scroll
 * container, plus dropping the pin from chrome that no longer fits — fed by a measurement, because
 * the chrome is content-sized and grows several-fold as text is enlarged. jsdom does no layout, so
 * these hold the stylesheet's declarations and the hook's arithmetic; the geometry itself is
 * checked in the browser (see docs/gap-remediation/self-paced/PI-FOCUS-01-handoff.md).
 */
const flowStyles = readFileSync(
  join(process.cwd(), 'src/features/peripheral-imaging/components/stage/imaging-flow.module.css'),
  'utf8',
)

function ruleBody(css: string, selector: string): string {
  const match = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*{([^}]*)}`).exec(
    css,
  )
  if (!match) throw new Error(`No rule for ${selector}`)
  return match[1]
}

describe("the activity's focus clearance", () => {
  it('reserves the pinned chrome on the page, which is what the browser scrolls', () => {
    const rule = ruleBody(flowStyles, ':global(html):has(.course)')
    expect(rule).toMatch(/scroll-padding-top:\s*var\(--imaging-focus-clear-top/)
    expect(rule).toMatch(/scroll-padding-bottom:\s*var\(--imaging-focus-clear-bottom/)
  })

  it('falls back to the desktop chrome when nothing has measured yet', () => {
    const rule = ruleBody(flowStyles, ':global(html):has(.course)')
    expect(rule).toMatch(/--imaging-focus-clear-top,\s*calc\(var\(--site-header-height/)
  })

  it('keeps the reservation to pages that render the activity', () => {
    expect(flowStyles).toContain(':global(html):has(.course)')
    expect(flowStyles).not.toMatch(/^html\s*{/m)
  })

  it('unpins header and footer together once the measurement says they no longer fit', () => {
    const rule = ruleBody(
      flowStyles,
      ".course[data-chrome-pinned='false'] .header,\n.course[data-chrome-pinned='false'] .actions",
    )
    expect(rule).toMatch(/position:\s*static/)
  })
})

/** Renders the hook against nodes whose geometry and position the test controls. */
function Harness({
  header,
  footer,
  shell,
}: {
  header: RefObject<HTMLElement | null>
  footer: RefObject<HTMLElement | null>
  shell: RefObject<HTMLElement | null>
}) {
  useImagingFocusClearance(shell, header, footer)
  return null
}

function chrome({
  headerHeight,
  headerBottom,
  footerHeight,
  footerTop,
  position = 'sticky',
}: {
  headerHeight: number
  headerBottom: number
  footerHeight: number
  footerTop: number
  position?: string
}) {
  const shell = document.createElement('section')
  const header = document.createElement('header')
  const footer = document.createElement('footer')
  shell.append(header, footer)
  document.body.append(shell)
  const rect = (height: number, top: number) =>
    ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top }) as DOMRect
  header.getBoundingClientRect = () => rect(headerHeight, headerBottom - headerHeight)
  footer.getBoundingClientRect = () => rect(footerHeight, footerTop)
  const styles = new Map<Element, string>([
    [header, position],
    [footer, position],
  ])
  jest
    .spyOn(window, 'getComputedStyle')
    .mockImplementation(
      (node: Element) =>
        ({ position: styles.get(node) ?? 'static', zoom: '1' }) as unknown as CSSStyleDeclaration,
    )
  return { shell, header, footer }
}

describe('the focus-clearance measurement', () => {
  const originalHeight = window.innerHeight
  const originalObserver = globalThis.ResizeObserver

  beforeEach(() => {
    // jsdom has no ResizeObserver, and does no layout for it to report.
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalObserver
    jest.restoreAllMocks()
    document.body.innerHTML = ''
    document.documentElement.removeAttribute('style')
    Object.defineProperty(window, 'innerHeight', { value: originalHeight, configurable: true })
  })

  const mount = (nodes: ReturnType<typeof chrome>) => {
    const shell = createRef<HTMLElement>() as RefObject<HTMLElement | null>
    const header = createRef<HTMLElement>() as RefObject<HTMLElement | null>
    const footer = createRef<HTMLElement>() as RefObject<HTMLElement | null>
    shell.current = nodes.shell
    header.current = nodes.header
    footer.current = nodes.footer
    return render(<Harness shell={shell} header={header} footer={footer} />)
  }

  it('reserves the header and the footer it measures, plus room for the focus ring', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    mount(chrome({ headerHeight: 99, headerBottom: 180, footerHeight: 72, footerTop: 928 }))
    expect(document.documentElement.style.getPropertyValue('--imaging-focus-clear-top')).toBe(
      '188px',
    )
    expect(document.documentElement.style.getPropertyValue('--imaging-focus-clear-bottom')).toBe(
      '80px',
    )
  })

  it('keeps the chrome pinned while it leaves the task most of the viewport', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    const nodes = chrome({ headerHeight: 99, headerBottom: 180, footerHeight: 72, footerTop: 928 })
    mount(nodes)
    expect(nodes.shell.getAttribute('data-chrome-pinned')).toBe('true')
  })

  it('drops the pin once the chrome would hold more of the viewport than the task', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    const nodes = chrome({
      headerHeight: 479,
      headerBottom: 640,
      footerHeight: 314,
      footerTop: 686,
    })
    mount(nodes)
    expect(nodes.shell.getAttribute('data-chrome-pinned')).toBe('false')
  })

  it('reserves nothing for chrome that scrolls away instead of pinning', () => {
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
    mount(
      chrome({
        headerHeight: 99,
        headerBottom: 180,
        footerHeight: 72,
        footerTop: 772,
        position: 'static',
      }),
    )
    // Only the focus-ring gap is left; nothing is painted over the page.
    expect(document.documentElement.style.getPropertyValue('--imaging-focus-clear-top')).toBe('8px')
    expect(document.documentElement.style.getPropertyValue('--imaging-focus-clear-bottom')).toBe(
      '8px',
    )
  })

  it('leaves the page as it found it when the activity unmounts', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    const nodes = chrome({ headerHeight: 99, headerBottom: 180, footerHeight: 72, footerTop: 928 })
    const view = mount(nodes)
    act(() => view.unmount())
    expect(document.documentElement.style.getPropertyValue('--imaging-focus-clear-top')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--imaging-focus-clear-bottom')).toBe('')
    expect(nodes.shell.hasAttribute('data-chrome-pinned')).toBe(false)
  })
})
