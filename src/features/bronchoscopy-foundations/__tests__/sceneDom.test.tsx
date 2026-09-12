import { axe } from 'jest-axe'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { ScopeScenePane, SCOPE_MODES_READY } from '../components/scope/ScopeScenePane'
import { ScopeDock } from '../components/scope/ScopeDock'
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
