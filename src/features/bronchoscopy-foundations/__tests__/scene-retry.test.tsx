import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'

import {
  INITIAL_SCENE_LOAD,
  MAX_AUTO_RECOVERIES,
  SCENE_LOAD_DEADLINE_MS,
  reduceSceneLoad,
  type SceneLoadEvent,
  type SceneLoadState,
} from '../components/scope/sceneLoad'
import { ScopeScenePane } from '../components/scope/ScopeScenePane'
import { useScopePlayback } from '../components/scope/useScopePlayback'
import type { ScopePaneProps } from '../components/scope/types'
import { section as larynxAndEntry } from '../content/sections/larynx-and-entry'
import { createScopeState } from '../engine/scope/scopeReducer'
import { teachingCase } from '../test-support/teachingCase'

/**
 * BF-01 finding 3: after an asset failure, "Try the 3D view again" stayed in loading.
 *
 * Two things are pinned here. The load is a state machine in which every way back to `loading` is
 * counted and bounded. And the pane's visibility observer follows the element that is actually on
 * the page: the 3D view and the schematic view mount different elements, and an observer left on
 * the one that was removed reported the pane as offscreen for good, so the scene never drew.
 */

function run(events: readonly SceneLoadEvent[], from: SceneLoadState = INITIAL_SCENE_LOAD) {
  return events.reduce(reduceSceneLoad, from)
}

describe('the 3D view’s load machine', () => {
  it('starts loading and is ready on the first drawn frame', () => {
    expect(INITIAL_SCENE_LOAD.status).toBe('loading')
    expect(run([{ type: 'drawn' }])).toMatchObject({ status: 'ready', attempt: 0, failure: null })
  })

  it('fails, retries as a new attempt and succeeds', () => {
    const failed = run([{ type: 'failed' }])
    expect(failed).toMatchObject({ status: 'failed', failure: 'error', attempt: 0 })
    const retried = reduceSceneLoad(failed, { type: 'retry' })
    expect(retried).toMatchObject({ status: 'loading', attempt: 1, failure: null })
    expect(reduceSceneLoad(retried, { type: 'drawn' }).status).toBe('ready')
  })

  it('returns to failed on every repeated failure, never to an unbounded loading', () => {
    let state = INITIAL_SCENE_LOAD
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      state = reduceSceneLoad(state, { type: 'failed' })
      expect(state.status).toBe('failed')
      state = reduceSceneLoad(state, { type: 'retry' })
      expect(state).toMatchObject({ status: 'loading', attempt })
    }
    expect(reduceSceneLoad(state, { type: 'deadline' })).toMatchObject({
      status: 'failed',
      failure: 'deadline',
    })
  })

  it('gives up on an attempt at its deadline, and only while it is still loading', () => {
    expect(run([{ type: 'deadline' }])).toMatchObject({ status: 'failed', failure: 'deadline' })
    const ready = run([{ type: 'drawn' }])
    expect(reduceSceneLoad(ready, { type: 'deadline' })).toBe(ready)
  })

  it('does not call a view ready from a frame drawn after it failed', () => {
    const failed = run([{ type: 'deadline' }])
    expect(reduceSceneLoad(failed, { type: 'drawn' })).toBe(failed)
  })

  it('recovers a lost graphics context a bounded number of times, then leaves it to the learner', () => {
    let state = run([{ type: 'drawn' }])
    for (let recovery = 1; recovery <= MAX_AUTO_RECOVERIES; recovery += 1) {
      state = reduceSceneLoad(state, { type: 'context-lost' })
      expect(state).toMatchObject({ status: 'loading', autoRecoveries: recovery })
      state = reduceSceneLoad(state, { type: 'drawn' })
    }
    state = reduceSceneLoad(state, { type: 'context-lost' })
    expect(state).toMatchObject({ status: 'failed', failure: 'context-lost' })
    // The learner's own retry is a fresh attempt with the automatic recoveries available again.
    expect(reduceSceneLoad(state, { type: 'retry' })).toMatchObject({
      status: 'loading',
      autoRecoveries: 0,
    })
  })

  it('has a deadline long enough for a slow first load and short enough to be a bound', () => {
    expect(SCENE_LOAD_DEADLINE_MS).toBeGreaterThanOrEqual(30_000)
    expect(SCENE_LOAD_DEADLINE_MS).toBeLessThanOrEqual(60_000)
  })
})

/* ------------------------------------------------------------------ *
 * The pane: failure → schematic → retry
 * ------------------------------------------------------------------ */

type Report = (status: 'loading' | 'ready' | 'failed') => void
const mockScene: { outcomes: ('ready' | 'failed')[]; mounts: number; visible: boolean[] } = {
  outcomes: [],
  mounts: 0,
  visible: [],
}

// The scene double draws only while the pane says it is on screen, as the real canvas does.
jest.mock('next/dynamic', () => () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return function MockScene({ onStatus, visible }: { onStatus: Report; visible: boolean }) {
    const [outcome] = React.useState(() => {
      mockScene.mounts += 1
      return mockScene.outcomes.shift() ?? 'ready'
    })
    React.useEffect(() => {
      mockScene.visible.push(visible)
      if (outcome === 'failed') onStatus('failed')
      else if (visible) onStatus('ready')
      else onStatus('loading')
    }, [onStatus, outcome, visible])
    return <div data-mock-scene={outcome} />
  }
})

/** An observer that reports a node as offscreen once it has left the document, as browsers do. */
class FollowingObserver {
  static live = new Set<FollowingObserver>()
  private node: Element | null = null
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(node: Element) {
    this.node = node
    FollowingObserver.live.add(this)
    this.report()
  }
  disconnect() {
    FollowingObserver.live.delete(this)
  }
  report() {
    if (!this.node) return
    this.callback(
      [{ isIntersecting: this.node.isConnected } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    )
  }
  static flush() {
    for (const observer of [...FollowingObserver.live]) observer.report()
  }
}

const act9 = larynxAndEntry.act.kind === 'scope-lab' ? larynxAndEntry.act : null

function paneProps(): ScopePaneProps {
  const view = act9!.view
  return {
    view,
    state: createScopeState(view, teachingCase()),
    map: null,
    onCommand: () => {},
    onReset: () => {},
    controlsEnabled: true,
    goals: [],
    caption: '',
  } as unknown as ScopePaneProps
}

beforeEach(() => {
  mockScene.outcomes = []
  mockScene.mounts = 0
  mockScene.visible = []
  FollowingObserver.live.clear()
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: FollowingObserver,
  })
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
})
afterEach(cleanup)

const scopeState = () =>
  document.querySelector('[data-scope-state]')?.getAttribute('data-scope-state')

async function toSchematic() {
  fireEvent.click(await screen.findByRole('button', { name: 'Use the schematic view' }))
  // The 3D view's element has left the page; the browser tells its observer so.
  act(() => FollowingObserver.flush())
}

describe('the pane after an asset failure', () => {
  it('failure → schematic → Try the 3D view again draws the scene and opens the controls', async () => {
    mockScene.outcomes = ['failed', 'ready']
    render(<ScopeScenePane {...paneProps()} />)
    expect(scopeState()).toBe('failed')
    await toSchematic()
    expect(scopeState()).toBe('fallback')
    fireEvent.click(screen.getByRole('button', { name: 'Try the 3D view again' }))
    act(() => FollowingObserver.flush())
    expect(mockScene.mounts).toBe(2)
    // The new scene was told it is on screen, so it could draw.
    expect(mockScene.visible[mockScene.visible.length - 1]).toBe(true)
    expect(scopeState()).toBe('ready')
    expect(document.querySelector('[data-scope-controls-waiting]')).toBeNull()
  })

  it('a retry that fails again is failed, with both ways on, as often as it is tried', async () => {
    mockScene.outcomes = ['failed', 'failed', 'failed', 'ready']
    render(<ScopeScenePane {...paneProps()} />)
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      expect(scopeState()).toBe('failed')
      await toSchematic()
      fireEvent.click(screen.getByRole('button', { name: 'Try the 3D view again' }))
      act(() => FollowingObserver.flush())
      expect(mockScene.mounts).toBe(attempt + 1)
      expect(scopeState()).toBe('failed')
      expect(screen.getByRole('button', { name: 'Use the schematic view' })).toBeTruthy()
    }
    await toSchematic()
    fireEvent.click(screen.getByRole('button', { name: 'Try the 3D view again' }))
    act(() => FollowingObserver.flush())
    expect(scopeState()).toBe('ready')
  })

  it('says the controls are waiting while the scene has not drawn, and stops saying it after', () => {
    mockScene.outcomes = ['ready']
    // Offscreen: the scene double stays in loading, as a canvas that draws no frame does.
    class Offscreen extends FollowingObserver {
      report() {
        ;(this as unknown as { callback: IntersectionObserverCallback }).callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: Offscreen,
    })
    render(<ScopeScenePane {...paneProps()} />)
    expect(scopeState()).toBe('fallback')
    expect(document.querySelector('[data-scope-controls-waiting]')?.textContent).toMatch(
      /still loading/,
    )
  })
})

describe('the visibility observer follows the mounted element', () => {
  function Swap({ onVisible }: { onVisible: (visible: boolean) => void }) {
    const [second, setSecond] = useState(false)
    const [node, setNode] = useState<HTMLElement | null>(null)
    const playback = useScopePlayback(paneProps(), node, true)
    onVisible(playback.visible)
    return (
      <>
        <button type="button" onClick={() => setSecond((value) => !value)}>
          swap
        </button>
        {second ? <section ref={setNode} data-second /> : <div ref={setNode} data-first />}
      </>
    )
  }

  it('stays visible when the observed element is replaced by another', () => {
    const seen: boolean[] = []
    render(<Swap onVisible={(visible) => seen.push(visible)} />)
    expect(seen[seen.length - 1]).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'swap' }))
    act(() => FollowingObserver.flush())
    expect(seen[seen.length - 1]).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'swap' }))
    act(() => FollowingObserver.flush())
    expect(seen[seen.length - 1]).toBe(true)
    // One live observer: the replaced element's was disconnected.
    expect(FollowingObserver.live.size).toBe(1)
  })
})
