import {
  ecmoScrollOwner,
  scrollEcmoTargetIntoView,
  scrollTaskPaneToTop,
} from '../components/stage/scrollTaskPaneToTop'

function dimensions(node: HTMLElement, clientHeight: number, scrollHeight: number, top = 0) {
  Object.defineProperties(node, {
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  })
  jest
    .spyOn(node, 'getBoundingClientRect')
    .mockReturnValue({ top, height: clientHeight } as DOMRect)
}

beforeEach(() => {
  document.body.innerHTML =
    '<header></header><main id="main-content"><section data-ecmo-shell="learn"><div data-ecmo-context-strip></div><div id="pane"><button id="target">Control</button></div></section></main>'
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1600 })
  document.body.style.overflowY = 'hidden'
})
afterEach(() => {
  jest.restoreAllMocks()
  document.body.innerHTML = ''
  document.body.style.overflowY = ''
})

it('resets the flowing shell without moving hidden ancestors or the document', () => {
  const shell = document.querySelector<HTMLElement>('[data-ecmo-shell]')!
  shell.style.overflowY = 'auto'
  dimensions(shell, 819, 2500)
  shell.scrollTop = 600
  const docScroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
  scrollTaskPaneToTop(document.getElementById('target'))
  expect(shell.scrollTop).toBe(0)
  expect(docScroll).not.toHaveBeenCalled()
})

it.each(['Steps', 'Teaching', 'Simulator'])('targets the nearest %s pane only', () => {
  const pane = document.getElementById('pane')!
  pane.style.overflowY = 'auto'
  dimensions(pane, 400, 1800, 200)
  const shell = document.querySelector<HTMLElement>('[data-ecmo-shell]')!
  shell.style.overflowY = 'auto'
  dimensions(shell, 819, 2000)
  shell.scrollTop = 20
  const target = document.getElementById('target')!
  dimensions(target, 30, 30, 1000)
  const scroll = jest.fn()
  pane.scrollTo = scroll
  const docScroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
  expect(ecmoScrollOwner(target)).toBe(pane)
  scrollEcmoTargetIntoView(target)
  expect(scroll).toHaveBeenCalledWith({ top: 784, behavior: 'auto' })
  expect(shell.scrollTop).toBe(20)
  expect(docScroll).not.toHaveBeenCalled()
})

it('does not scroll desktop document even when a pane has no overflow', () => {
  const docScroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
  scrollTaskPaneToTop(document.getElementById('target'))
  scrollEcmoTargetIntoView(document.getElementById('target')!)
  expect(docScroll).not.toHaveBeenCalled()
})

it('uses the document only at reflow sizes and measures the real site header', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  document.body.style.overflowY = 'visible'
  dimensions(document.querySelector('header')!, 97, 97)
  dimensions(document.querySelector<HTMLElement>('[data-ecmo-shell]')!, 2000, 2000, 97)
  const docScroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {})
  scrollTaskPaneToTop(document.getElementById('target'))
  expect(docScroll).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
})

it('leaves room for the actual sticky operational strip when revealing a control', () => {
  const shell = document.querySelector<HTMLElement>('[data-ecmo-shell]')!
  shell.style.overflowY = 'auto'
  dimensions(shell, 819, 2500, 81)
  const strip = document.querySelector<HTMLElement>('[data-ecmo-context-strip]')!
  strip.style.position = 'sticky'
  dimensions(strip, 120, 120)
  const target = document.getElementById('target')!
  dimensions(target, 30, 30, 1000)
  shell.scrollTo = jest.fn()
  scrollEcmoTargetIntoView(target)
  expect(shell.scrollTo).toHaveBeenCalledWith({ top: 783, behavior: 'auto' })
})
