import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, render } from '@testing-library/react'
import { createRef, type RefObject } from 'react'

import { useImagingOutlinePlacement } from '../components/stage/useImagingOutlinePlacement'

/**
 * G02-PI-02: opening Course outline put the panel outside the viewport. At 900 x 1000 with root
 * text at 32 px the panel opened 412.9 css px past the inline-start edge, with every section
 * link's centre outside the viewport; on a phone it ran past the bottom instead, so the last
 * section could not be reached at all.
 *
 * The repair is declarative — the panel is laid out against the usable band, the viewport minus
 * whatever chrome is pinned over it — fed by a measurement, because whether the anchored panel
 * still fits depends on where enlarged text has wrapped the trigger to. jsdom does no layout, so
 * these drive the hook against geometry the test states and hold the stylesheet's declarations;
 * the geometry itself is checked in the browser, by `e2e/peripheral-imaging.spec.ts` and by
 * docs/gap-remediation/self-paced/PI-OUTLINE-01-handoff.md.
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

interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

interface Scene {
  viewport: { width: number; height: number }
  rootFontSize: number
  zoom?: number
  /** Site chrome pinned to the very top of the viewport, above the module. */
  siteHeader: Box | null
  /** The course header, pinned only while `headerPinned`. */
  header: Box
  headerPinned: boolean
  /** The Activity-navigation footer, pinned only while `footerPinned`. */
  footer: Box
  footerPinned: boolean
  trigger: Box
}

const rect = (box: Box): DOMRect =>
  ({
    ...box,
    width: box.right - box.left,
    height: box.bottom - box.top,
    x: box.left,
    y: box.top,
  }) as DOMRect

/** Builds the DOM the hook measures and mocks the geometry jsdom will not compute. */
function scene(spec: Scene) {
  const site = spec.siteHeader ? document.createElement('header') : null
  const shell = document.createElement('section')
  const header = document.createElement('header')
  const footer = document.createElement('footer')
  const outline = document.createElement('details')
  const trigger = document.createElement('summary')
  const link = document.createElement('a')
  const nextLink = document.createElement('a')
  const outside = document.createElement('button')
  outline.append(trigger, link, nextLink)
  header.append(outline)
  shell.append(header, footer)
  if (site) document.body.append(site)
  document.body.append(shell, outside)

  header.getBoundingClientRect = () => rect(spec.header)
  footer.getBoundingClientRect = () => rect(spec.footer)
  trigger.getBoundingClientRect = () => rect(spec.trigger)
  const siteBox = spec.siteHeader
  if (site && siteBox) site.getBoundingClientRect = () => rect(siteBox)

  const positions = new Map<Element, string>([
    [header, spec.headerPinned ? 'sticky' : 'static'],
    [footer, spec.footerPinned ? 'sticky' : 'static'],
  ])
  if (site) positions.set(site, 'sticky')
  jest.spyOn(window, 'getComputedStyle').mockImplementation(
    (node: Element) =>
      ({
        position: positions.get(node) ?? 'static',
        zoom: String(spec.zoom ?? 1),
        fontSize: `${spec.rootFontSize}px`,
      }) as unknown as CSSStyleDeclaration,
  )
  Object.defineProperty(window, 'innerWidth', { value: spec.viewport.width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: spec.viewport.height, configurable: true })
  return { shell, header, footer, outline, trigger, link, nextLink, outside }
}

function Harness({
  shell,
  header,
  footer,
  outline,
  trigger,
}: {
  shell: RefObject<HTMLElement | null>
  header: RefObject<HTMLElement | null>
  footer: RefObject<HTMLElement | null>
  outline: RefObject<HTMLDetailsElement | null>
  trigger: RefObject<HTMLElement | null>
}) {
  useImagingOutlinePlacement(shell, header, footer, outline, trigger)
  return null
}

function mount(nodes: ReturnType<typeof scene>) {
  const ref = <T,>(node: T) => {
    const held = createRef<T>() as RefObject<T | null>
    held.current = node
    return held
  }
  return render(
    <Harness
      shell={ref(nodes.shell)}
      header={ref(nodes.header)}
      footer={ref(nodes.footer)}
      outline={ref(nodes.outline)}
      trigger={ref(nodes.trigger)}
    />,
  )
}

/** Measured on the projection activity, in the condition each name states. */
const DESKTOP: Scene = {
  viewport: { width: 1440, height: 1000 },
  rootFontSize: 16,
  siteHeader: { top: 0, bottom: 81, left: 0, right: 1440 },
  header: { top: 81, bottom: 179.7, left: 0, right: 1440 },
  headerPinned: true,
  footer: { top: 927.81, bottom: 1000, left: 0, right: 1440 },
  footerPinned: true,
  trigger: { top: 107.84, bottom: 151.84, left: 880.41, right: 1018.97 },
}

const WIDE_TEXT_200: Scene = {
  viewport: { width: 900, height: 1000 },
  rootFontSize: 32,
  siteHeader: { top: 0, bottom: 161, left: 0, right: 900 },
  header: { top: 161, bottom: 639.81, left: 0, right: 900 },
  headerPinned: false,
  footer: { top: 685.8, bottom: 1000, left: 0, right: 900 },
  footerPinned: false,
  trigger: { top: 444.42, bottom: 523.22, left: 32, right: 307.11 },
}

const PHONE_TEXT_200: Scene = {
  viewport: { width: 390, height: 844 },
  rootFontSize: 32,
  siteHeader: { top: 0, bottom: 145, left: 0, right: 390 },
  header: { top: 145, bottom: 1030, left: 0, right: 390 },
  headerPinned: false,
  footer: { top: 1400, bottom: 1600, left: 0, right: 390 },
  footerPinned: false,
  trigger: { top: 835.98, bottom: 914.78, left: 32, right: 307.11 },
}

const ZOOM_2: Scene = {
  viewport: { width: 1440, height: 1000 },
  rootFontSize: 16,
  zoom: 2,
  siteHeader: { top: 0, bottom: 298, left: 0, right: 1440 },
  header: { top: 298, bottom: 556.2, left: 0, right: 1440 },
  headerPinned: false,
  footer: { top: 750, bottom: 1000, left: 0, right: 1440 },
  footerPinned: false,
  trigger: { top: 581.42, bottom: 669.42, left: 32, right: 303.52 },
}

const property = (shell: HTMLElement, name: string) => shell.style.getPropertyValue(name)
/** The published length in css px. Compared numerically: these are measurements, not strings. */
const length = (shell: HTMLElement, name: string) => Number.parseFloat(property(shell, name))

describe('where the Course outline opens', () => {
  const originals = { width: window.innerWidth, height: window.innerHeight }
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
    Object.defineProperty(window, 'innerWidth', { value: originals.width, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: originals.height, configurable: true })
  })

  it('leaves the anchored dropdown alone at desktop width and normal text', () => {
    const nodes = scene(DESKTOP)
    mount(nodes)
    expect(nodes.shell.getAttribute('data-outline-contained')).toBe('false')
  })

  it('caps the anchored dropdown at the end of the usable band, not at the viewport', () => {
    const nodes = scene(DESKTOP)
    mount(nodes)
    // The pinned footer starts at 927.81, and the trigger's bottom edge is 151.84.
    expect(length(nodes.shell, '--imaging-outline-anchored-max-block')).toBeCloseTo(775.97, 2)
  })

  it('contains the panel once the enlarged header has wrapped the trigger off the inline end', () => {
    // 900 x 1000 at 200% text: the panel is min(80vw, 30rem) = 720 css px wide and the trigger's
    // inline-end edge is at 307.11, so the anchored panel would start 412.89 px off the viewport.
    const nodes = scene(WIDE_TEXT_200)
    mount(nodes)
    expect(nodes.shell.getAttribute('data-outline-contained')).toBe('true')
    expect(length(nodes.shell, '--imaging-outline-block-start')).toBeCloseTo(523.22, 2)
    expect(length(nodes.shell, '--imaging-outline-max-block')).toBeCloseTo(476.78, 2)
  })

  it('opens below the trigger, so the panel never covers the control that closes it', () => {
    const nodes = scene(WIDE_TEXT_200)
    mount(nodes)
    expect(length(nodes.shell, '--imaging-outline-block-start')).toBe(WIDE_TEXT_200.trigger.bottom)
  })

  it('takes the whole usable band when the trigger has itself been pushed out of it', () => {
    // 390 x 844 at 200% text: the trigger's bottom edge is at 914.78, below the viewport, so there
    // is nothing on screen to hang the panel below.
    const nodes = scene(PHONE_TEXT_200)
    mount(nodes)
    expect(nodes.shell.getAttribute('data-outline-contained')).toBe('true')
    expect(length(nodes.shell, '--imaging-outline-block-start')).toBeCloseTo(145, 2)
    expect(length(nodes.shell, '--imaging-outline-max-block')).toBeCloseTo(699, 2)
  })

  it('divides the measurement back out of css zoom, which scales the length again', () => {
    const nodes = scene(ZOOM_2)
    mount(nodes)
    expect(nodes.shell.getAttribute('data-outline-contained')).toBe('true')
    // 669.42 and 330.58 rendered pixels, which are 334.71 and 165.29 css px at zoom 2.
    expect(length(nodes.shell, '--imaging-outline-block-start')).toBeCloseTo(334.71, 2)
    expect(length(nodes.shell, '--imaging-outline-max-block')).toBeCloseTo(165.29, 2)
  })

  it('turns over exactly where the panel would cross the viewport, not at a breakpoint', () => {
    // `width: min(80vw, 30rem)` is 480 css px at this width and text size, and the contained panel
    // is inset by 1rem, so a trigger ending at 496 is the last one the anchored panel fits behind.
    const fits = scene({ ...DESKTOP, trigger: { ...DESKTOP.trigger, right: 496 } })
    mount(fits)
    expect(fits.shell.getAttribute('data-outline-contained')).toBe('false')
    document.body.innerHTML = ''
    jest.restoreAllMocks()

    const overflows = scene({ ...DESKTOP, trigger: { ...DESKTOP.trigger, right: 495 } })
    mount(overflows)
    expect(overflows.shell.getAttribute('data-outline-contained')).toBe('true')
  })

  it('contains the panel when the anchored one would be too short to read', () => {
    // The trigger sits 100 px above the footer: 8rem of room is the least worth opening into.
    const nodes = scene({
      ...DESKTOP,
      trigger: { ...DESKTOP.trigger, top: 783.81, bottom: 827.81 },
    })
    mount(nodes)
    expect(nodes.shell.getAttribute('data-outline-contained')).toBe('true')
  })

  it('leaves the activity as it found it when it unmounts', () => {
    const nodes = scene(WIDE_TEXT_200)
    const view = mount(nodes)
    act(() => view.unmount())
    expect(property(nodes.shell, '--imaging-outline-block-start')).toBe('')
    expect(property(nodes.shell, '--imaging-outline-max-block')).toBe('')
    expect(property(nodes.shell, '--imaging-outline-anchored-max-block')).toBe('')
    expect(nodes.shell.hasAttribute('data-outline-contained')).toBe(false)
  })
})

describe('closing the Course outline', () => {
  const originalObserver = globalThis.ResizeObserver

  beforeEach(() => {
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
  })

  it('closes on Escape and puts focus back on the trigger', () => {
    const nodes = scene(PHONE_TEXT_200)
    mount(nodes)
    nodes.outline.open = true
    const focus = jest.spyOn(nodes.trigger, 'focus')
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(nodes.outline.open).toBe(false)
    expect(focus).toHaveBeenCalled()
  })

  it('closes on a pointer press outside it, and not on one inside it', () => {
    const nodes = scene(PHONE_TEXT_200)
    mount(nodes)
    nodes.outline.open = true
    act(() => {
      nodes.link.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(nodes.outline.open).toBe(true)
    act(() => {
      nodes.outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })
    expect(nodes.outline.open).toBe(false)
  })

  it('stays open while Tab moves between its own section links', () => {
    const nodes = scene(PHONE_TEXT_200)
    mount(nodes)
    nodes.outline.open = true
    act(() => {
      nodes.link.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: nodes.nextLink }),
      )
    })
    expect(nodes.outline.open).toBe(true)
  })

  it('closes when focus leaves it, including Shift+Tab back to the trigger', () => {
    // Where the panel has had to take the whole usable band it covers the trigger, so focus
    // arriving back on the trigger has to close it or the learner cannot see what is focused.
    const nodes = scene(PHONE_TEXT_200)
    mount(nodes)
    nodes.outline.open = true
    act(() => {
      nodes.link.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: nodes.trigger }),
      )
    })
    expect(nodes.outline.open).toBe(false)

    nodes.outline.open = true
    act(() => {
      nodes.link.dispatchEvent(
        new FocusEvent('focusout', { bubbles: true, relatedTarget: nodes.outside }),
      )
    })
    expect(nodes.outline.open).toBe(false)
  })

  it('stays open when focus leaves the document altogether', () => {
    const nodes = scene(PHONE_TEXT_200)
    mount(nodes)
    nodes.outline.open = true
    act(() => {
      nodes.link.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
    })
    expect(nodes.outline.open).toBe(true)
  })
})

describe("the outline's stylesheet", () => {
  it('still declares the anchored width the measurement mirrors', () => {
    expect(ruleBody(flowStyles, '.outline nav')).toMatch(/width:\s*min\(80vw,\s*30rem\)/)
  })

  it('caps the anchored panel against the measured band, falling back to the 65dvh it had', () => {
    expect(ruleBody(flowStyles, '.outline nav')).toMatch(
      /max-block-size:\s*min\(65dvh,\s*var\(--imaging-outline-anchored-max-block,\s*65dvh\)\)/,
    )
  })

  it('lays the contained panel out against the viewport, inset from both inline edges', () => {
    const rule = ruleBody(flowStyles, ".course[data-outline-contained='true'] .outline nav")
    expect(rule).toMatch(/position:\s*fixed/)
    expect(rule).toMatch(/inset-block:\s*var\(--imaging-outline-block-start/)
    expect(rule).toMatch(/inset-inline:\s*1rem/)
    expect(rule).toMatch(/max-block-size:\s*var\(--imaging-outline-max-block/)
  })

  it('scrolls the panel rather than the page behind it', () => {
    const rule = ruleBody(flowStyles, '.outline nav')
    expect(rule).toMatch(/overflow-y:\s*auto/)
    expect(rule).toMatch(/overscroll-behavior:\s*contain/)
  })
})
