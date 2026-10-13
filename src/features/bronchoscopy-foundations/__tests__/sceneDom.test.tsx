import { axe } from 'jest-axe'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { ScopeScenePane, SCOPE_MODES_READY } from '../components/scope/ScopeScenePane'
import { ScopeDock } from '../components/scope/ScopeDock'
import {
  HELD_INTERVAL_MS,
  HELD_STEP_MM,
  HELD_TURN_DEG,
  HOLD_DELAY_MS,
  HOLD_RELEASE_MS,
} from '../components/scope/scopeKeyMap'
import {
  SCOPE_MODES,
  scopeControlId,
  type ScopePaneProps,
  type ScopeViewSpec,
} from '../components/scope/types'
import { createScopeState } from '../engine/scope/scopeReducer'
import { scopeLocationCaption } from '../engine/scope/scopeCaption'
import { teachingCase } from '../test-support/teachingCase'

jest.mock('next/dynamic', () => () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return function MockScene({ onStatus }: { onStatus: (value: string) => void }) {
    React.useEffect(() => onStatus('ready'), [onStatus])
    return <div data-three-state="ready" role="group" tabIndex={0} aria-label="Scope image" />
  }
})
const view: ScopeViewSpec = {
  sectionId: 'scene-dom',
  mode: 'guided-walk',
  profile: 'adult-teaching-combined-left-basal-v1',
  start: { kind: 'airway', label: 'TR', at: 'distal' },
  controls: ['advance', 'withdraw', 'rotate', 'deflect', 'suction', 'capture'],
  assists: {},
  boundary: 'Authored model.',
  readouts: ['depthMm'],
}
function props(extra: Partial<ScopePaneProps> = {}): ScopePaneProps {
  const state = createScopeState(view, teachingCase())
  return {
    view,
    state,
    map: teachingCase().map,
    onCommand: jest.fn(),
    onReset: jest.fn(),
    controlsEnabled: true,
    goals: [],
    caption: scopeLocationCaption(state),
    ...extra,
  }
}
beforeAll(() =>
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
  }),
)

test('all seven modes select the scene implementation', () => {
  expect([...SCOPE_MODES_READY]).toEqual(SCOPE_MODES)
})
test('keyboard commands use the displayed state and do not hijack form inputs', () => {
  const p = props()
  render(<ScopeScenePane {...p} />)
  const workspace = screen.getByLabelText('Interactive scope workspace')
  fireEvent.keyDown(workspace, { key: 'w' })
  expect(p.onCommand).toHaveBeenLastCalledWith(
    { type: 'advance', mm: p.state.inputs.stepMm },
    'keyboard',
  )
  fireEvent.keyDown(workspace, { key: 'd' })
  expect(p.onCommand).toHaveBeenLastCalledWith({ type: 'rotate', deg: 5 }, 'keyboard')
  const count = (p.onCommand as jest.Mock).mock.calls.length
  fireEvent.keyDown(document.getElementById(scopeControlId('rotate'))!, { key: 'ArrowUp' })
  fireEvent.keyDown(workspace, { key: 'Home' })
  expect(p.onCommand).toHaveBeenCalledTimes(count)
})
test('locked controls block keyboard commands and explain the lock', () => {
  const p = props({
    controlsEnabled: false,
    lockedReason: 'Read the image before changing the controls.',
  })
  render(<ScopeScenePane {...p} />)
  fireEvent.keyDown(screen.getByLabelText('Interactive scope workspace'), { key: 'w' })
  expect(p.onCommand).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /^Advance$/ })).toBeDisabled()
  expect(screen.getByText(p.lockedReason!)).toBeVisible()
})
test('dock commands retain device input provenance and button ids', () => {
  const p = props()
  render(<ScopeDock {...p} needsStep />)
  fireEvent.click(screen.getByRole('button', { name: /^Advance$/ }))
  expect(p.onCommand).toHaveBeenLastCalledWith(
    { type: 'advance', mm: p.state.inputs.stepMm },
    'pointer',
  )
  fireEvent.keyDown(screen.getByRole('button', { name: 'Capture an image' }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: 'Capture an image' }))
  expect(p.onCommand).toHaveBeenLastCalledWith({ type: 'capture' }, 'keyboard')
  fireEvent.click(screen.getByRole('button', { name: 'Step one second' }))
  expect(p.onCommand).toHaveBeenLastCalledWith({ type: 'tick', seconds: 1 }, 'keyboard')
})
test('a held movement key glides: one step on the press, then fine increments at a steady rate', () => {
  jest.useFakeTimers()
  const p = props()
  const onCommand = p.onCommand as jest.Mock
  const mounted = render(<ScopeScenePane {...p} />)
  const workspace = screen.getByLabelText('Interactive scope workspace')
  fireEvent.keyDown(workspace, { key: 'w' })
  expect(onCommand).toHaveBeenLastCalledWith(
    { type: 'advance', mm: p.state.inputs.stepMm },
    'keyboard',
  )
  // The keyboard repeats faster than the glide runs: a repeat inside the interval sends nothing.
  fireEvent.keyDown(workspace, { key: 'w', repeat: true })
  expect(onCommand).toHaveBeenCalledTimes(1)
  for (let i = 0; i < 3; i += 1) {
    act(() => jest.advanceTimersByTime(HELD_INTERVAL_MS))
    fireEvent.keyDown(workspace, { key: 'w', repeat: true })
    fireEvent.keyDown(workspace, { key: 'w', repeat: true })
  }
  expect(onCommand.mock.calls.slice(1)).toEqual(
    Array.from({ length: 3 }, () => [{ type: 'advance', mm: HELD_STEP_MM }, 'keyboard']),
  )
  // Withdrawing and turning glide the same way, in the direction of the key.
  for (const [key, held] of [
    ['s', { type: 'advance', mm: -HELD_STEP_MM }],
    ['a', { type: 'rotate', deg: -HELD_TURN_DEG }],
    ['ArrowUp', { type: 'deflect', deg: HELD_TURN_DEG }],
  ] as const) {
    act(() => jest.advanceTimersByTime(HELD_INTERVAL_MS))
    fireEvent.keyDown(workspace, { key, repeat: true })
    expect(onCommand).toHaveBeenLastCalledWith(held, 'keyboard')
  }
  // Only movement repeats: a held capture key is one capture.
  const sent = onCommand.mock.calls.length
  act(() => jest.advanceTimersByTime(HELD_INTERVAL_MS))
  fireEvent.keyDown(workspace, { key: 'c', repeat: true })
  expect(onCommand).toHaveBeenCalledTimes(sent)
  mounted.unmount()
  jest.useRealTimers()
})
test('a press of Advance is one step; a hold glides, and the click that ends it adds no step', () => {
  jest.useFakeTimers()
  // This jsdom has neither pointer events nor pointer capture. A mouse event stands in for the
  // press (it carries the button the dock checks), and capture, which the dock asks for so that a
  // drag off the button still ends the hold, is a stub.
  const hadPointerEvent = 'PointerEvent' in window
  if (!hadPointerEvent)
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: MouseEvent })
  const elementPrototype = Element.prototype as unknown as { setPointerCapture?: unknown }
  const hadCapture = 'setPointerCapture' in elementPrototype
  if (!hadCapture) elementPrototype.setPointerCapture = jest.fn()
  const p = props()
  const onCommand = p.onCommand as jest.Mock
  const mounted = render(<ScopeDock {...p} needsStep={false} />)
  const advance = screen.getByRole('button', { name: /^Advance$/ })
  const step = [{ type: 'advance', mm: p.state.inputs.stepMm }, 'pointer']
  const fine = [{ type: 'advance', mm: HELD_STEP_MM }, 'pointer']

  // A short press: released inside the delay, so the click is the whole of it.
  fireEvent.pointerDown(advance, { button: 0 })
  expect(elementPrototype.setPointerCapture).toHaveBeenCalledTimes(hadCapture ? 0 : 1)
  act(() => jest.advanceTimersByTime(HOLD_DELAY_MS - 1))
  expect(onCommand).not.toHaveBeenCalled()
  fireEvent.pointerUp(advance)
  fireEvent.click(advance)
  act(() => jest.advanceTimersByTime(4 * HOLD_DELAY_MS))
  expect(onCommand.mock.calls).toEqual([step])

  // A hold: nothing until the delay has run, then one fine increment per interval.
  onCommand.mockClear()
  fireEvent.pointerDown(advance, { button: 0 })
  act(() => jest.advanceTimersByTime(HOLD_DELAY_MS))
  expect(onCommand.mock.calls).toEqual([fine])
  act(() => jest.advanceTimersByTime(3 * HELD_INTERVAL_MS))
  expect(onCommand.mock.calls).toEqual([fine, fine, fine, fine])
  // The release stops the glide, and the click the browser sends after it is not one more step.
  fireEvent.pointerUp(advance)
  fireEvent.click(advance)
  act(() => jest.advanceTimersByTime(10 * HELD_INTERVAL_MS))
  expect(onCommand).toHaveBeenCalledTimes(4)
  // The next press is an ordinary step again.
  fireEvent.click(advance)
  expect(onCommand.mock.calls.at(-1)).toEqual(step)

  // Withdraw glides the other way, and a hold that loses the pointer stops too.
  onCommand.mockClear()
  const withdraw = screen.getByRole('button', { name: /^Withdraw$/ })
  fireEvent.pointerDown(withdraw, { button: 0 })
  act(() => jest.advanceTimersByTime(HOLD_DELAY_MS + HELD_INTERVAL_MS))
  expect(onCommand.mock.calls).toEqual(
    Array.from({ length: 2 }, () => [{ type: 'advance', mm: -HELD_STEP_MM }, 'pointer']),
  )
  fireEvent.pointerCancel(withdraw)
  act(() => jest.advanceTimersByTime(HOLD_RELEASE_MS))
  expect(onCommand).toHaveBeenCalledTimes(2)
  // A cancelled hold is followed by no click of its own, so the learner's next press still counts.
  fireEvent.click(withdraw)
  expect(onCommand.mock.calls.at(-1)).toEqual([
    { type: 'advance', mm: -p.state.inputs.stepMm },
    'pointer',
  ])
  expect(onCommand).toHaveBeenCalledTimes(3)

  mounted.unmount()
  if (!hadCapture) delete elementPrototype.setPointerCapture
  if (!hadPointerEvent) delete (window as { PointerEvent?: unknown }).PointerEvent
  jest.useRealTimers()
})
test('reduced motion exposes an explicit step and never ticks on its own', () => {
  jest.useFakeTimers()
  const v: ScopeViewSpec = {
    ...view,
    mode: 'larynx-entry',
    start: { kind: 'larynx' },
    script: 'breathing-cords',
  }
  const p = props({ view: v, state: createScopeState(v, teachingCase()) })
  const mounted = render(<ScopeScenePane {...p} />)
  expect(screen.getByRole('button', { name: 'Step one second' })).toBeEnabled()
  act(() => jest.advanceTimersByTime(5000))
  expect(p.onCommand).not.toHaveBeenCalled()
  mounted.unmount()
  jest.useRealTimers()
})

test('scene controls, tabs and readouts have no automated accessibility violations', async () => {
  const { container } = render(<ScopeScenePane {...props()} />)
  expect((await axe(container)).violations).toEqual([])
})
