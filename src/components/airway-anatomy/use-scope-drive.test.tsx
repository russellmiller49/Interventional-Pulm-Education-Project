import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'

import { ScopeDriveQueue } from '@/lib/airway-anatomy/drive-queue'
import { useScopeDriveClock } from './use-scope-drive'

/**
 * The page's animation frames are under the test's control: `runPageFrame` runs the callbacks the
 * page has asked for, and a test that never calls it is a headset session presenting, where the
 * browser stops calling the page's `requestAnimationFrame`.
 */
let pageFrameCallbacks: FrameRequestCallback[] = []
let nowMs = 0

function runPageFrame() {
  const callbacks = pageFrameCallbacks
  pageFrameCallbacks = []
  for (const callback of callbacks) callback(nowMs)
}

beforeEach(() => {
  pageFrameCallbacks = []
  nowMs = 1000
  jest.spyOn(performance, 'now').mockImplementation(() => nowMs)
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    pageFrameCallbacks.push(callback)
    return pageFrameCallbacks.length
  })
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

function renderDrive() {
  const advance = jest.fn<void, [number]>()
  const hook = renderHook(() => {
    const [queue] = useState(() => new ScopeDriveQueue())
    const pump = useScopeDriveClock(queue, advance)
    return { queue, pump }
  })
  const advancedMm = () => advance.mock.calls.reduce((total, [mm]) => total + mm, 0)
  return { advance, advancedMm, ...hook }
}

describe('useScopeDriveClock', () => {
  it('drives the scope from the page animation frames on the desktop', () => {
    const { result, advancedMm } = renderDrive()
    act(() => runPageFrame()) // primes the clock
    result.current.queue.push(3) // Advance pressed once (step 3 mm)
    for (let i = 0; i < 30; i += 1) {
      nowMs += 1000 / 60
      act(() => runPageFrame())
    }
    expect(advancedMm()).toBeCloseTo(3, 6)
  })

  it('drives the scope from the VR frame loop while the page frames are stopped', () => {
    const { result, advance, advancedMm } = renderDrive()
    // Headset session presenting: the page's frames never run from here on.
    result.current.pump()
    result.current.queue.push(3) // Advance
    result.current.queue.push(3) // Advance again
    for (let i = 0; i < 40; i += 1) {
      nowMs += 1000 / 72 // Quest 3 frame
      act(() => result.current.pump()) // the XR scene's useFrame
    }
    expect(advance).toHaveBeenCalled()
    expect(advancedMm()).toBeCloseTo(6, 6)

    result.current.queue.push(-3) // Withdraw
    for (let i = 0; i < 40; i += 1) {
      nowMs += 1000 / 72
      act(() => result.current.pump())
    }
    expect(advancedMm()).toBeCloseTo(3, 6)
  })

  it('leaves the scope still in VR when nothing pumps the queue (the reported bug)', () => {
    const { result, advance } = renderDrive()
    result.current.queue.push(3)
    nowMs += 500
    // No page frames and no scene pump: the press stays queued, as it did on the Quest.
    expect(advance).not.toHaveBeenCalled()
    expect(result.current.queue.pending).toBe(3)
  })

  it('keeps one drive speed when the page frames and the VR scene both pump', () => {
    const { result, advancedMm } = renderDrive()
    act(() => runPageFrame())
    result.current.queue.push(15)
    for (let i = 0; i < 12; i += 1) {
      nowMs += 1000 / 60
      act(() => runPageFrame())
      act(() => result.current.pump())
    }
    // 12 frames of 1/60 s at 24 mm/s.
    expect(advancedMm()).toBeCloseTo(24 * (12 / 60), 6)
  })

  it('stops asking for page frames on unmount', () => {
    const { unmount } = renderDrive()
    unmount()
    expect(window.cancelAnimationFrame).toHaveBeenCalled()
  })
})
