import { act, renderHook } from '@testing-library/react'
import { fiveControlsLearnInputs } from '../content/fiveControlsLearn'
import { createScopeState, reduceScope } from '../engine/scope/scopeReducer'
import { useBenchPresentation } from '../components/scope/useBenchPresentation'
import { scopeOpticalFrame } from '@/lib/airway-anatomy/transport-frames'
import { authoredScopePose } from '../engine/scope/scopeAuthoredPose'

afterEach(() => jest.restoreAllMocks())

function setup(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches: reduced,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
  })
  const frames: FrameRequestCallback[] = []
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback)
    return frames.length
  })
  const cancel = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  jest.spyOn(performance, 'now').mockReturnValue(0)
  const step = fiveControlsLearnInputs().find((item) => item.learn?.id === 'bend')!
  if (step.workspace?.kind !== 'scope') throw new Error('Bench expected')
  const view = step.workspace.view
  const initial = createScopeState(view, null)
  const changed = reduceScope(initial, { type: 'set-deflection', deg: 60 }, 'pointer', {
    view,
    scopeCase: null,
  })
  return { frames, cancel, initial, changed }
}

test('one presentation transition drives the lever and optical frame without changing learner state', () => {
  const { frames, initial, changed } = setup(false)
  const recorded = JSON.stringify(changed)
  const { result, rerender, unmount } = renderHook(
    ({ state }) => useBenchPresentation(state, true, true),
    {
      initialProps: { state: initial },
    },
  )
  rerender({ state: changed })
  act(() => frames.at(-1)!(110))
  expect(result.current.state.inputs.deflectionDeg).toBe(30)
  expect(scopeOpticalFrame(result.current.state.pose!)).toEqual(
    scopeOpticalFrame(
      authoredScopePose('bench', 0, {
        ...changed.inputs,
        deflectionDeg: 30,
      }),
    ),
  )
  act(() => frames.at(-1)!(220))
  expect(result.current.state.inputs.deflectionDeg).toBe(60)
  expect(JSON.stringify(changed)).toBe(recorded)
  unmount()
})

test('reduced motion and an offscreen pane show the final state without scheduling animation', () => {
  const { initial, changed, frames } = setup(true)
  const { result, rerender } = renderHook(({ state }) => useBenchPresentation(state, true, true), {
    initialProps: { state: initial },
  })
  rerender({ state: changed })
  expect(result.current.state.inputs.deflectionDeg).toBe(60)
  expect(frames).toHaveLength(0)
})

test('a hidden pane cancels its transition and snaps to the current control position', () => {
  const { initial, changed, cancel } = setup(false)
  const { result, rerender, unmount } = renderHook(
    ({ state, visible }) => useBenchPresentation(state, true, visible),
    {
      initialProps: { state: initial, visible: true },
    },
  )
  rerender({ state: changed, visible: true })
  rerender({ state: changed, visible: false })
  expect(cancel).toHaveBeenCalled()
  expect(result.current.state.inputs.deflectionDeg).toBe(60)
  unmount()
})
