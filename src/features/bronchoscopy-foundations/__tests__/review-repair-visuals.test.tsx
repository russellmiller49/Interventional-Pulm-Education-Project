import { readFileSync } from 'fs'
import { join } from 'path'

import { act, cleanup, fireEvent, render, within } from '@testing-library/react'

import {
  BENCH_TRANSITION_MS,
  interpolateBenchMotion,
  type BenchMotion,
} from '../components/scope/benchPresentation'
import { ScopeScenePane } from '../components/scope/ScopeScenePane'
import { TipCompass } from '../components/scope/TipCompass'
import type { ScopePaneProps, ScopeState, ScopeViewSpec } from '../components/scope/types'
import { MediaWorkspace } from '../components/stage/MediaWorkspace'
import { benchTipOrientation, compassRadius } from '../engine/scope/benchOrientation'
import { authoredScopePose } from '../engine/scope/scopeAuthoredPose'
import { ScopeDriver } from '../test-support/teachingCase'
import { COMPARISON_WORKSPACE } from '../test-support/comparisonWorkspace'

/**
 * BF-PRE-REVIEW-03 independent review, blockers 2, 3 and 4.
 *
 * 2. The end-on tip drawing read the commanded state while the 3D bench was still moving toward
 *    it. The pane now owns one displayed state; these tests step the transition frame by frame and
 *    compare the drawing with an independent interpolation and with what the scene was handed.
 * 3. The note that the card is outside the scope view's field — and that this is the bench, not a
 *    lost view of an airway — was printed for the eye only. It is checked here by role and name.
 * 4. The S7 comparison's card-size rule also matched the enlarged dialog's frame. The stylesheet's
 *    own selectors are matched against the rendered card and dialog.
 *
 * The browser suite holds the user-facing acceptance (real frames, the accessibility tree, the
 * measured image sizes); these pin the mechanisms.
 */

/** The 3D scene cannot run in jsdom. This stands in for it and keeps what the pane handed it. */
const mockScene = {
  frames: [] as { state: ScopeState; presentation?: { state: ScopeState } }[],
  status: 'ready' as 'ready' | 'failed',
}
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const { useEffect } = jest.requireActual<typeof import('react')>('react')
    return function SceneStandIn(props: {
      state: ScopeState
      presentation?: { state: ScopeState }
      onStatus: (status: 'ready' | 'failed') => void
    }) {
      mockScene.frames.push({ state: props.state, presentation: props.presentation })
      const { onStatus } = props
      useEffect(() => onStatus(mockScene.status), [onStatus])
      return null
    }
  },
}))

const benchView: ScopeViewSpec = {
  sectionId: 'five-controls',
  mode: 'controls-isolated',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'bench' },
  controls: ['rotate', 'deflect', 'advance', 'withdraw'],
  assists: {},
  boundary: 'Authored model.',
  physicalControlLabels: true,
}

function bench(rotation: number, deflection: number): ScopeDriver {
  const driver = new ScopeDriver(benchView, null)
  driver.send({ type: 'set-rotation', deg: rotation })
  driver.send({ type: 'set-deflection', deg: deflection })
  return driver
}

function paneProps(state: ScopeState): ScopePaneProps {
  return {
    view: benchView,
    state,
    map: null,
    onCommand: () => {},
    onReset: () => {},
    controlsEnabled: true,
    goals: [],
    caption: '',
  }
}

function reducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

/** What the drawing shows, read from the marks themselves. */
function drawn(container: HTMLElement) {
  const figure = container.querySelector('[data-tip-compass]')!
  const tip = figure.querySelector('[data-compass-tip]')!
  const plane = figure.querySelector('[data-compass-plane]')!
  return {
    tip: { x: Number(tip.getAttribute('cx')), y: Number(tip.getAttribute('cy')) },
    up: { x: Number(plane.getAttribute('x2')), y: Number(plane.getAttribute('y2')) },
    caption: figure.querySelector('figcaption')!.textContent!,
  }
}

/** The same marks for an orientation, by the drawing's published rule. */
function marksFor(state: Pick<ScopeState, 'pose' | 'place' | 'inputs'>) {
  const orientation = benchTipOrientation(state)!
  const radius = compassRadius(orientation.angleDeg)
  return {
    tip: orientation.toward
      ? { x: orientation.toward.x * radius, y: -orientation.toward.y * radius }
      : { x: 0, y: 0 },
    up: { x: orientation.bendUp.x, y: -orientation.bendUp.y },
    angle: orientation.angleDeg,
  }
}

const motionOf = (state: ScopeState): BenchMotion => ({
  depth: state.depthMm,
  rotation: state.inputs.rotationDeg,
  deflection: state.inputs.deflectionDeg,
  suction: Number(state.inputs.suction),
})

/**
 * The bench part-way through a transition, worked out here from the interpolation rule alone. Once
 * the transition's time is up it is the model's own state, value for value.
 */
function partWay(from: ScopeState, to: ScopeState, elapsedMs: number) {
  const motion =
    elapsedMs < BENCH_TRANSITION_MS
      ? interpolateBenchMotion(motionOf(from), motionOf(to), elapsedMs / BENCH_TRANSITION_MS)
      : motionOf(to)
  const inputs = { ...to.inputs, rotationDeg: motion.rotation, deflectionDeg: motion.deflection }
  return {
    motion,
    state: {
      place: 'bench' as const,
      inputs,
      pose: authoredScopePose('bench', motion.depth, inputs),
    },
  }
}

function expectClose(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 9)
  expect(actual.y).toBeCloseTo(expected.y, 9)
}

const FRAME_MS = 16

beforeEach(() => {
  mockScene.frames = []
  mockScene.status = 'ready'
  jest.useFakeTimers()
  reducedMotion(false)
})
afterEach(() => {
  cleanup()
  jest.useRealTimers()
})

/** Start each transition on a frame boundary, so a frame lands every 16 ms after it. */
function alignToFrame() {
  const over = performance.now() % FRAME_MS
  act(() => {
    jest.advanceTimersByTime(over === 0 ? FRAME_MS : FRAME_MS - over)
  })
  expect(performance.now() % FRAME_MS).toBe(0)
}

describe('blocker 2 — the end-on drawing moves with the animated bench, frame by frame', () => {
  /**
   * Commands the bench from one settled state to another and checks every animation frame until
   * the transition ends. Returns how many frames were strictly between the two states.
   */
  function transition(from: ScopeState, to: ScopeState) {
    const view = render(<ScopeScenePane {...paneProps(from)} />)
    act(() => {
      jest.advanceTimersByTime(BENCH_TRANSITION_MS + FRAME_MS)
    })
    expectClose(drawn(view.container).tip, marksFor(from).tip)
    alignToFrame()
    const started = performance.now()
    view.rerender(<ScopeScenePane {...paneProps(to)} />)

    let intermediate = 0
    for (let frame = 1; frame * FRAME_MS <= BENCH_TRANSITION_MS + 2 * FRAME_MS; frame += 1) {
      act(() => {
        jest.advanceTimersByTime(FRAME_MS)
      })
      const elapsed = performance.now() - started
      const expected = partWay(from, to, elapsed)
      const marks = marksFor(expected.state)
      const shown = drawn(view.container)

      // The drawing is at the interpolated orientation, not at the commanded one.
      expectClose(shown.tip, marks.tip)
      expectClose(shown.up, marks.up)
      expect(shown.caption).toContain(
        Math.round(marks.angle) === 0
          ? 'Tip: straight ahead'
          : `Tip: ${Math.round(marks.angle)}° from straight ahead`,
      )

      // And it is the very state the 3D scene was handed in the same render.
      const scene = mockScene.frames[mockScene.frames.length - 1]
      expect(scene.presentation).toBeDefined()
      expect(scene.presentation!.state.inputs.rotationDeg).toBeCloseTo(expected.motion.rotation, 9)
      expect(scene.presentation!.state.inputs.deflectionDeg).toBeCloseTo(
        expected.motion.deflection,
        9,
      )
      expectClose(shown.tip, marksFor(scene.presentation!.state).tip)
      expectClose(shown.up, marksFor(scene.presentation!.state).up)

      if (elapsed < BENCH_TRANSITION_MS) intermediate += 1
    }

    // Settled: exactly the commanded state's drawing, as before the repair.
    const settled = drawn(view.container)
    expectClose(settled.tip, marksFor(to).tip)
    expectClose(settled.up, marksFor(to).up)
    const figure = view.container.querySelector('[data-tip-compass]')!
    const final = benchTipOrientation(to)!
    expect(figure.getAttribute('data-tip-angle')).toBe(final.angleDeg.toFixed(1))
    expect(figure.getAttribute('data-bend-up')).toBe(
      `${final.bendUp.x.toFixed(3)},${final.bendUp.y.toFixed(3)}`,
    )
    view.unmount()
    return intermediate
  }

  it.each([
    ['deflection 0° to +120°', [0, 0], [0, 120]],
    ['deflection +120° to −120°', [0, 120], [0, -120]],
    ['deflection −120° to 0°', [0, -120], [0, 0]],
    ['rotation 0° to 90°, with a 30° bend to show it', [0, 30], [90, 30]],
    ['rotation 90° to 180°', [90, 30], [180, 30]],
    ['rotation 180° to 270°', [180, 30], [270, 30]],
    ['rotation and deflection together', [0, 0], [90, 60]],
    ['rotation and deflection together, back across neutral', [90, 60], [-90, -45]],
  ] as const)('%s', (_name, from, to) => {
    const start = bench(from[0], from[1]).state
    const end = bench(to[0], to[1]).state
    const intermediate = transition(start, end)
    // 220 ms at 16 ms a frame: thirteen frames on the way, each one checked above.
    expect(intermediate).toBe(Math.ceil(BENCH_TRANSITION_MS / FRAME_MS) - 1)
  })

  it('is between the two states in the middle of a transition, not already at the end', () => {
    const from = bench(0, 0).state
    const to = bench(0, 120).state
    const view = render(<ScopeScenePane {...paneProps(from)} />)
    alignToFrame()
    view.rerender(<ScopeScenePane {...paneProps(to)} />)
    act(() => {
      jest.advanceTimersByTime(FRAME_MS * 6)
    })
    const middle = drawn(view.container)
    // 96 ms of 220: well short of the rim the commanded 120° sits on.
    expect(-middle.tip.y).toBeGreaterThan(0.1)
    expect(-middle.tip.y).toBeLessThan(0.6)
    expect(-marksFor(to).tip.y).toBeCloseTo(1, 9)
    // The controls and readouts are the learner's command, and stay on it.
    const lever = view.container.querySelector<HTMLInputElement>(
      'input[type="range"][id$="deflect"]',
    )
    expect(lever!.value).toBe('120')
  })

  it('names a turn in progress by the short way round, never past 180°', () => {
    const from = bench(180, 30).state
    const to = bench(270, 30).state
    expect(to.inputs.rotationDeg).toBe(-90)
    const view = render(<ScopeScenePane {...paneProps(from)} />)
    alignToFrame()
    view.rerender(<ScopeScenePane {...paneProps(to)} />)
    for (let frame = 0; frame < 16; frame += 1) {
      act(() => {
        jest.advanceTimersByTime(FRAME_MS)
      })
      const turn = /Control section turned (\d+)°/.exec(drawn(view.container).caption)
      expect(Number(turn![1])).toBeGreaterThanOrEqual(90)
      expect(Number(turn![1])).toBeLessThanOrEqual(180)
    }
  })

  it('has no transition with reduced motion: the bench and the drawing change together at once', () => {
    reducedMotion(true)
    const from = bench(0, 0).state
    const to = bench(90, 60).state
    const view = render(<ScopeScenePane {...paneProps(from)} />)
    alignToFrame()
    view.rerender(<ScopeScenePane {...paneProps(to)} />)
    expectClose(drawn(view.container).tip, marksFor(to).tip)
    const scene = mockScene.frames[mockScene.frames.length - 1]
    expect(scene.presentation!.state.inputs.deflectionDeg).toBe(60)
    expect(scene.presentation!.state.inputs.rotationDeg).toBe(90)
    act(() => {
      jest.advanceTimersByTime(BENCH_TRANSITION_MS)
    })
    expectClose(drawn(view.container).tip, marksFor(to).tip)
  })

  it('has no transition in the schematic view, where the picture itself has none', () => {
    mockScene.status = 'failed'
    const from = bench(0, 0).state
    const to = bench(0, 120).state
    const view = render(<ScopeScenePane {...paneProps(from)} />)
    act(() => {
      jest.advanceTimersByTime(FRAME_MS)
    })
    fireEvent.click(within(view.container).getByRole('button', { name: 'Use the schematic view' }))
    alignToFrame()
    view.rerender(<ScopeScenePane {...paneProps(to)} />)
    // The schematic drawing reports the commanded deflection at once; so does the end-on drawing.
    expect(
      within(view.container).getByRole('img', {
        name: /Schematic scope view.*deflection 120 degrees/,
      }),
    ).toBeTruthy()
    expectClose(drawn(view.container).tip, marksFor(to).tip)
  })
})

describe('blocker 3 — the bench’s out-of-view note is in the accessibility tree, once', () => {
  /** The words as assistive technology gets them: everything not hidden from it. */
  function exposedText(container: HTMLElement) {
    const clone = container.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove())
    return clone.textContent ?? ''
  }
  const occurrences = (text: string, part: string) => text.split(part).length - 1

  it.each([
    [0, 60],
    [0, -60],
    [0, 120],
    [0, -120],
    [90, 60],
    [180, 120],
    [-90, -60],
  ])('says so at rotation %i°, deflection %i°', (rotation, deflection) => {
    const state = bench(rotation, deflection).state
    expect(benchTipOrientation(state)!.cardInView).toBe(false)
    const { container } = render(<TipCompass state={state} />)
    const text = exposedText(container)
    // The card is outside the scope view's field; this is the bench; it is not an airway lost view.
    expect(text).toContain('The card is outside the field of view')
    expect(text).toContain(`the tip points ${Math.abs(deflection)}° from straight ahead`)
    expect(text).toContain('This is the bench, not a lost view of an airway.')
    expect(occurrences(text, 'outside the field of view')).toBe(1)
    expect(occurrences(text, 'not a lost view of an airway')).toBe(1)
    // It is not folded into the drawing's name, so the image is not announced with it a second time.
    const image = within(container).getByRole('img')
    const name = document.getElementById(image.getAttribute('aria-labelledby')!)!.textContent!
    expect(name).not.toContain('outside the field of view')
    // Nothing here claims more than the bench drawing shows.
    expect(text).not.toMatch(/obstruct|contact|mucosa|wall|unsafe|injur|trauma|red-out/i)
    cleanup()
  })

  it.each([
    [0, 0],
    [0, 15],
    [0, -15],
    [90, 15],
    [180, 0],
  ])('says nothing of the kind with the card in view (rotation %i°, deflection %i°)', (r, d) => {
    const state = bench(r, d).state
    expect(benchTipOrientation(state)!.cardInView).toBe(true)
    const { container } = render(<TipCompass state={state} />)
    expect(exposedText(container)).not.toMatch(/outside the field of view|lost view/)
    cleanup()
  })

  it('drops the note when the card comes back into view', () => {
    const driver = bench(0, 120)
    const view = render(<TipCompass state={driver.state} />)
    expect(exposedText(view.container)).toContain('outside the field of view')
    driver.send({ type: 'set-deflection', deg: 0 })
    view.rerender(<TipCompass state={driver.state} />)
    expect(exposedText(view.container)).not.toMatch(/outside the field of view|lost view/)
    driver.send({ type: 'set-deflection', deg: -60 })
    view.rerender(<TipCompass state={driver.state} />)
    expect(occurrences(exposedText(view.container), 'outside the field of view')).toBe(1)
  })

  it('is in the pane exactly once in the 3D view and in the schematic view', () => {
    const state = bench(0, 60).state
    const view = render(<ScopeScenePane {...paneProps(state)} />)
    expect(occurrences(exposedText(view.container), 'not a lost view of an airway')).toBe(1)
    view.unmount()
    mockScene.status = 'failed'
    const schematic = render(<ScopeScenePane {...paneProps(state)} />)
    act(() => {
      jest.advanceTimersByTime(FRAME_MS)
    })
    fireEvent.click(
      within(schematic.container).getByRole('button', { name: 'Use the schematic view' }),
    )
    // The schematic picture is one image with a name; its printed note is not exposed inside it.
    expect(
      within(schematic.container).getByRole('img', { name: /Schematic scope view/ }),
    ).toBeTruthy()
    expect(occurrences(exposedText(schematic.container), 'not a lost view of an airway')).toBe(1)
  })

  it('records no lost view and touches no goal: bending off the card is not an airway event', () => {
    const driver = new ScopeDriver(benchView, null)
    for (const deflection of [60, -60, 120, -120, 0]) {
      driver.send({ type: 'set-deflection', deg: deflection })
      expect(driver.state.signals.view).toBe('clear')
      expect(driver.state.signals.lossOfViewCount).toBe(0)
      expect(driver.state.signals.contactCount).toBe(0)
    }
    driver.send({ type: 'set-rotation', deg: 90 })
    driver.send({ type: 'set-deflection', deg: 120 })
    expect(driver.state.signals.lossOfViewCount).toBe(0)
    expect(
      driver.state.events.filter((event) =>
        /red-out|advanced-blind|lens-contaminated|wall-contact|aim-refused|entered|ostium/.test(
          event,
        ),
      ),
    ).toEqual([])
    expect(driver.state.ledger).toEqual(new ScopeDriver(benchView, null).state.ledger)
    expect(driver.state.location.label).toBeNull()
  })
})

describe('blocker 4 — the S7 comparison limits the card’s frame, not the enlarged one', () => {
  const PUBLIC = join(__dirname, '../../../../public')
  const quizFrames = JSON.parse(
    readFileSync(join(PUBLIC, 'airway-lesson/airway-quiz-frames.json'), 'utf8'),
  )
  const ctFrames = JSON.parse(
    readFileSync(join(PUBLIC, 'airway-lesson/airway-survey-ct.json'), 'utf8'),
  )
  const stylesheet = readFileSync(
    join(__dirname, '../components/stage/bronch-stage.module.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '')

  /** Every rule that sizes something from the comparison row's height. */
  function compareHeightSelectors(): string[] {
    const selectors: string[] = []
    for (const rule of stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (
        /(^|[;\s])(width|height|max-width|max-height)\s*:[^;]*var\(--compare-height\)/.test(rule[2])
      )
        selectors.push(rule[1].trim())
    }
    return selectors
  }

  beforeEach(() => {
    jest.useRealTimers()
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
    }
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      const path = String(url)
      const body = path.includes('airway-quiz-frames')
        ? quizFrames
        : path.includes('airway-survey-ct')
          ? ctFrames
          : null
      return { ok: body !== null, status: body ? 200 : 404, json: async () => body } as Response
    }) as typeof fetch
  })

  it('matches the card’s frame and neither enlarged frame, for the CT and for the still', async () => {
    const { container } = render(
      <MediaWorkspace
        media={COMPARISON_WORKSPACE.media}
        caption={COMPARISON_WORKSPACE.caption}
        mediaNotes={COMPARISON_WORKSPACE.mediaNotes}
        comparisonNote={COMPARISON_WORKSPACE.comparisonNote}
      />,
    )
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    const selectors = compareHeightSelectors()
    expect(selectors.length).toBeGreaterThan(0)
    const sized = (element: Element) => selectors.some((selector) => element.matches(selector))

    const figures = [...container.querySelectorAll('figure')]
    expect(figures).toHaveLength(2)
    for (const figure of figures) {
      const card = figure.querySelector('[data-media-frame-size="card"]')!
      expect(sized(card)).toBe(true)
      fireEvent.click(within(figure).getByRole('button', { name: /^Enlarge image/ }))
      const enlarged = figure.querySelector('dialog[open] [data-media-frame-size="enlarged"]')!
      expect(enlarged).not.toBeNull()
      // The enlarged frame is inside the same figure and the same comparison grid as the card.
      expect(enlarged.closest('[data-media-compare="true"]')).not.toBeNull()
      expect(sized(enlarged)).toBe(false)
      // Same file, same aspect: nothing about the image itself differs between the two.
      const cardImage = card.querySelector('img')!
      const enlargedImage = enlarged.querySelector('img')!
      expect(enlargedImage.getAttribute('src')).toBe(cardImage.getAttribute('src'))
      expect(enlargedImage.getAttribute('width')).toBe(cardImage.getAttribute('width'))
      expect(enlargedImage.getAttribute('height')).toBe(cardImage.getAttribute('height'))
      fireEvent.click(figure.querySelector('[data-media-dialog-close]')!)
    }
  })
})
