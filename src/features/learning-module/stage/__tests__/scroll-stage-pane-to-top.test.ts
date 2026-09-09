/**
 * @jest-environment jsdom
 */
import { scrollStagePaneToTop } from '../scrollStagePaneToTop'

/**
 * The one scrolling ancestor is reset; nothing else moves.
 *
 * jsdom lays nothing out, so each element's overflow comes from its inline style (which is what
 * jsdom's `getComputedStyle` reads) and its scroll extent from own-property overrides, the way a
 * pane with more content than height would report them in a browser.
 */
function box(overflowY: string, scrollHeight: number, clientHeight: number): HTMLElement {
  const element = document.createElement('div')
  element.style.overflowY = overflowY
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true })
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('scrollStagePaneToTop', () => {
  it('resets the nearest ancestor that is actually scrolling, and only that one', () => {
    const outer = box('auto', 2000, 500)
    const pane = box('auto', 1200, 400)
    const inner = box('visible', 0, 0)
    const target = document.createElement('h2')
    inner.append(target)
    pane.append(inner)
    outer.append(pane)
    document.body.append(outer)
    outer.scrollTop = 150
    pane.scrollTop = 300

    scrollStagePaneToTop(target)

    expect(pane.scrollTop).toBe(0)
    // The ancestor above the pane is a scroller too, and it is left exactly where it was.
    expect(outer.scrollTop).toBe(150)
  })

  it('skips an ancestor that has overflow set but nothing to scroll', () => {
    const scroller = box('auto', 1200, 400)
    const fits = box('auto', 300, 400)
    const target = document.createElement('p')
    fits.append(target)
    scroller.append(fits)
    document.body.append(scroller)
    scroller.scrollTop = 220
    fits.scrollTop = 0

    scrollStagePaneToTop(target)

    expect(scroller.scrollTop).toBe(0)
  })

  it('never scrolls the document, even when it is the only scroller', () => {
    const target = document.createElement('p')
    document.body.append(target)
    document.documentElement.style.overflowY = 'auto'
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 5000,
      configurable: true,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      value: 800,
      configurable: true,
    })
    document.documentElement.scrollTop = 640

    scrollStagePaneToTop(target)

    expect(document.documentElement.scrollTop).toBe(640)
    document.documentElement.style.overflowY = ''
  })

  it('does nothing for a missing node', () => {
    expect(() => scrollStagePaneToTop(null)).not.toThrow()
  })
})
