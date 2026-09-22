import { act, cleanup, render } from '@testing-library/react'
import { useRef, useState, type ReactNode } from 'react'

import { useScopePlayback } from '../components/scope/useScopePlayback'
import type { ScopeCommand, ScopeInputMode, ScopePaneProps } from '../components/scope/types'
import { section as branchEntry } from '../content/sections/branch-entry'
import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import { section as viewLoss } from '../content/sections/view-loss'
import { createScopeState } from '../engine/scope/scopeReducer'
import { teachingCase } from '../test-support/teachingCase'

/**
 * The scripted scene's clock, as the pane actually produces it (A2, A3).
 *
 * The host rebuilds `onCommand` on every render and every tick causes one, so the effect that owns
 * the interval must not depend on that identity: otherwise each tick tears the interval down and
 * starts its elapsed base again, losing the time between the two and leaving a window in which a
 * second interval can exist. A hidden tab, an offscreen pane, reduced motion and an explicit step
 * control each hold the clock instead — none of them makes it run fast on return.
 */

const ONE_SECOND_OF_TICKS = 10

function mockMatchMedia(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

function mockIntersection(intersecting: boolean) {
  class Observer {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe() {
      this.callback(
        [{ isIntersecting: intersecting } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }
    disconnect() {}
  }
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: Observer,
  })
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

const larynxAct = larynxAndEntry.act.kind === 'scope-lab' ? larynxAndEntry.act : null
const branchAct = branchEntry.act.kind === 'scope-lab' ? branchEntry.act : null
const viewLossAct = viewLoss.act.kind === 'scope-lab' ? viewLoss.act : null

function Harness({
  view,
  onCommand,
  forceManual = false,
  ready = true,
  controlsEnabled = true,
  onPlayback,
}: {
  view: NonNullable<typeof larynxAct>['view']
  onCommand: (command: ScopeCommand, inputMode: ScopeInputMode) => void
  forceManual?: boolean
  ready?: boolean
  controlsEnabled?: boolean
  onPlayback?: (playback: { needsStep: boolean }) => void
}): ReactNode {
  const root = useRef<HTMLDivElement>(null)
  // The host hands the pane a new callback on every render, exactly as `BronchStageHost` does.
  const [renders, setRenders] = useState(0)
  const props = {
    view,
    state: createScopeState(view, teachingCase()),
    map: null,
    onCommand: (command: ScopeCommand, inputMode: ScopeInputMode) => {
      setRenders((count) => count + 1)
      onCommand(command, inputMode)
    },
    onReset: () => {},
    controlsEnabled,
    goals: [],
    caption: '',
  } as unknown as ScopePaneProps
  const playback = useScopePlayback(props, root, ready, forceManual)
  onPlayback?.(playback)
  return <div ref={root} data-renders={renders} />
}

describe('the pane’s scripted clock', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockMatchMedia(false)
    mockIntersection(true)
    setVisibility('visible')
  })
  afterEach(() => {
    cleanup()
    jest.useRealTimers()
  })

  it('hands the host simulated time on a breathing scene, marked scripted', () => {
    const onCommand = jest.fn()
    render(<Harness view={larynxAct!.view} onCommand={onCommand} />)
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(onCommand.mock.calls.length).toBeGreaterThanOrEqual(ONE_SECOND_OF_TICKS - 1)
    for (const [command, inputMode] of onCommand.mock.calls) {
      expect(command.type).toBe('tick')
      expect(command.seconds).toBeLessThanOrEqual(0.25)
      expect(inputMode).toBe('scripted')
    }
  })

  it('keeps one interval across the renders its own ticks cause', () => {
    const started = jest.spyOn(window, 'setInterval')
    const onCommand = jest.fn()
    const { container } = render(<Harness view={larynxAct!.view} onCommand={onCommand} />)
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    const ticks = onCommand.mock.calls.length
    expect(ticks).toBeGreaterThanOrEqual(2 * ONE_SECOND_OF_TICKS - 1)
    // Every tick rerenders the host. One interval survives all of them, with one elapsed base.
    expect(Number(container.querySelector('[data-renders]')?.getAttribute('data-renders'))).toBe(
      ticks,
    )
    expect(started).toHaveBeenCalledTimes(1)
    started.mockRestore()
  })

  it('runs the assistant’s hold on the same clock', () => {
    const onCommand = jest.fn()
    render(<Harness view={branchAct!.observe!.view!} onCommand={onCommand} />)
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(onCommand).toHaveBeenCalled()
    expect(onCommand.mock.calls[0][1]).toBe('scripted')
  })

  it('does not run a scene that has no clock of its own', () => {
    const onCommand = jest.fn()
    render(<Harness view={viewLossAct!.view} onCommand={onCommand} />)
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('holds the clock in a background tab, offscreen, before the scene is ready and while locked', () => {
    for (const setup of [() => setVisibility('hidden'), () => mockIntersection(false)] as const) {
      const onCommand = jest.fn()
      setup()
      const { unmount } = render(<Harness view={larynxAct!.view} onCommand={onCommand} />)
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(onCommand).not.toHaveBeenCalled()
      unmount()
      setVisibility('visible')
      mockIntersection(true)
    }
    for (const props of [{ ready: false }, { controlsEnabled: false }]) {
      const onCommand = jest.fn()
      const { unmount } = render(
        <Harness view={larynxAct!.view} onCommand={onCommand} {...props} />,
      )
      act(() => {
        jest.advanceTimersByTime(2000)
      })
      expect(onCommand).not.toHaveBeenCalled()
      unmount()
    }
  })

  it('offers the manual step instead of animating when motion is reduced', () => {
    mockMatchMedia(true)
    const onCommand = jest.fn()
    let playback = { needsStep: false }
    render(
      <Harness
        view={larynxAct!.view}
        onCommand={onCommand}
        onPlayback={(value) => {
          playback = value
        }}
      />,
    )
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(onCommand).not.toHaveBeenCalled()
    expect(playback.needsStep).toBe(true)
  })

  it('offers no step control where there is no scripted scene', () => {
    mockMatchMedia(true)
    let playback = { needsStep: true }
    render(
      <Harness
        view={viewLossAct!.view}
        onCommand={jest.fn()}
        onPlayback={(value) => {
          playback = value
        }}
      />,
    )
    expect(playback.needsStep).toBe(false)
  })
})
