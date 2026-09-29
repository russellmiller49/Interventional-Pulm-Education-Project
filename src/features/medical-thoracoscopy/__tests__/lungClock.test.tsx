import { act, render } from '@testing-library/react'

import { frameClock, MAX_FRAME_MS } from '../components/space/lungClock'
import { useSpaceEngine, type SpaceLoader } from '../components/space/useSpaceEngine'
import { createResolver } from '../engine/space/loadSpace'
import { LUNG_STEP_MS, reduce, startEngine, type EngineState } from '../engine/space/spaceReducer'
import { spaceSnapshot } from '../engine/space/spaceSnapshot'
import { scene } from '../test-support/spaceScenes'

/**
 * The lung's clock under animation frames (independent review, R1): the review held frames back
 * for three seconds, as a hidden tab does, and the lung jumped two steps at once when they came
 * back. Frames here are fake and so is the time, so every case is deterministic.
 */
describe('the frame clock', () => {
  it('hands on the wall-clock time exactly, whatever the frames, while no frame is long', () => {
    for (const frameMs of [7, 16.7, 33.3, 50, MAX_FRAME_MS]) {
      const clock = frameClock(1000)
      let total = 0
      let now = 1000
      while (now + frameMs <= 1000 + 2000) {
        now += frameMs
        total += clock.advance(now)
      }
      expect(Math.abs(total - (now - 1000))).toBeLessThan(1)
    }
  })

  it('hands on at most one frame’s worth after a stall, a slow first frame or a hidden page', () => {
    const clock = frameClock(0)
    expect(clock.advance(16)).toBe(16)
    expect(clock.advance(16 + 3073)).toBe(MAX_FRAME_MS)
    const slowFirst = frameClock(0)
    expect(slowFirst.advance(900)).toBe(MAX_FRAME_MS)
  })

  it('counts nothing for the time away once the page is shown again', () => {
    const clock = frameClock(0)
    expect(clock.advance(16)).toBe(16)
    clock.resume(5000)
    expect(clock.advance(5016)).toBe(16)
  })

  it('never runs backwards', () => {
    const clock = frameClock(100)
    expect(clock.advance(50)).toBe(0)
    expect(clock.advance(66)).toBe(16)
  })
})

describe('the lung under different frame schedules', () => {
  const space = scene('spheres').space
  const resolver = createResolver(space)
  const start = (): EngineState =>
    startEngine(resolver, {
      scenario: 'clock',
      lungStep: 0,
      pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 },
      reducedMotion: false,
      snapshot: spaceSnapshot('clock', 0),
    })
  const run = (frames: readonly number[]) => {
    let state = reduce(start(), { type: 'lung-target', step: 2 }, resolver)
    const clock = frameClock(0)
    let now = 0
    for (const gap of frames) {
      now += gap
      const ms = clock.advance(now)
      if (ms > 0) state = reduce(state, { type: 'tick', ms }, resolver)
    }
    return state
  }

  it('gives the same events at the same times however often the renderer calls back', () => {
    const wall = 3 * LUNG_STEP_MS
    const even = (gap: number) => Array.from({ length: Math.ceil(wall / gap) }, () => gap)
    const uneven = [3, 41, 17, 99, 8, 64, 33, 12, 90, 27, 77, 55, 5, 70, 61, 38, 44, 96, 11, 80]
    const results = [even(16), even(33), even(100), [...uneven, ...uneven]].map(run)
    const events = results.map((state) => state.events)
    for (const other of events.slice(1)) expect(other).toEqual(events[0])
    expect(events[0].map((e) => [e.kind, e.atMs])).toEqual([
      ['lung-moved', LUNG_STEP_MS],
      ['lung-moved', 2 * LUNG_STEP_MS],
    ])
  })

  it('moves the lung no more than one step after frames held back for three seconds', () => {
    // two frames, then nothing for three seconds, then frames again
    const state = run([16, 16, 3073, 16, 16])
    expect(state.lungStep).toBe(0)
    const later = run([16, 16, 3073, ...Array.from({ length: 25 }, () => 16)])
    expect(later.lungStep).toBe(1)
  })
})

// ── The hook, with fake frames and a fake clock ────────────────────────────────────────────────

describe('the space host’s clock', () => {
  let queue: Map<number, FrameRequestCallback>
  let next = 0
  let now = 0
  let visibility: DocumentVisibilityState = 'visible'
  const frame = (gap: number) => {
    now += gap
    const due = [...queue.entries()]
    queue.clear()
    for (const [, callback] of due) callback(now)
  }

  beforeEach(() => {
    queue = new Map()
    now = 0
    visibility = 'visible'
    jest.spyOn(performance, 'now').mockImplementation(() => now)
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      next += 1
      queue.set(next, callback)
      return next
    })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      queue.delete(id)
    })
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
  })
  afterEach(() => jest.restoreAllMocks())

  const loadScene: SpaceLoader = async () => scene('spheres').space
  function Host({ reducedMotion = false }: { readonly reducedMotion?: boolean }) {
    const session = useSpaceEngine(
      {
        scenario: 'clock',
        lungStep: 0,
        pose: { tiltAcrossRibsDeg: 0, tiltAlongRibsDeg: 0, depthMm: 20, rollDeg: 0 },
      },
      { reducedMotion, load: loadScene },
    )
    return (
      <button
        type="button"
        data-lung-step={session.paneState.lungStep}
        onClick={() => session.setLungTarget(2)}
      />
    )
  }
  const step = (container: HTMLElement) =>
    Number(container.querySelector('[data-lung-step]')?.getAttribute('data-lung-step'))

  it('does not jump the lung when a hidden page is shown again (the review’s reproduction)', async () => {
    const { container } = render(<Host />)
    await act(async () => {})
    act(() => (container.querySelector('[data-lung-step]') as HTMLElement).click())
    act(() => frame(16))
    act(() => frame(16))
    expect(step(container)).toBe(0)
    // hidden: no frames for three seconds; then shown again
    visibility = 'hidden'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    now += 3073
    visibility = 'visible'
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => frame(16))
    expect(step(container)).toBe(0)
    // and from then on at its own pace, one step a lung interval
    for (let k = 0; k < 24; k += 1) act(() => frame(16))
    expect(step(container)).toBe(1)
    for (let k = 0; k < 25; k += 1) act(() => frame(16))
    expect(step(container)).toBe(2)
  })

  it('moves the lung at most one step after a long frame, even without a visibility event', async () => {
    const { container } = render(<Host />)
    await act(async () => {})
    act(() => (container.querySelector('[data-lung-step]') as HTMLElement).click())
    act(() => frame(16))
    act(() => frame(4000))
    expect(step(container)).toBeLessThanOrEqual(0)
    act(() => frame(16))
    expect(step(container)).toBeLessThanOrEqual(1)
  })

  it('under reduced motion runs no frames at all, as before', async () => {
    const { container } = render(<Host reducedMotion />)
    await act(async () => {})
    act(() => (container.querySelector('[data-lung-step]') as HTMLElement).click())
    expect(queue.size).toBe(0)
    act(() => frame(5000))
    expect(step(container)).toBe(0)
  })

  it('stops its frames and its listener when the space goes', async () => {
    const remove = jest.spyOn(document, 'removeEventListener')
    const { container, unmount } = render(<Host />)
    await act(async () => {})
    act(() => (container.querySelector('[data-lung-step]') as HTMLElement).click())
    expect(queue.size).toBe(1)
    unmount()
    expect(queue.size).toBe(0)
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })
})
