'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { anatomyManifest } from '../../content/data/generated/anatomy'
import {
  createResolver,
  loadSpace,
  type LoadedSpace,
  type SpaceResolver,
} from '../../engine/space/loadSpace'
import { paneStateOf } from '../../engine/space/paneState'
import { spaceSnapshot } from '../../engine/space/spaceSnapshot'
import {
  reduce,
  startEngine,
  type EngineState,
  type SimulatedAction,
} from '../../engine/space/spaceReducer'
import type { TeachingTarget } from '../../engine/space/teachingTarget'
import { currentReach } from '../../engine/space/zoneReach'
import { frameClock } from './lungClock'
import { READINESS_WORDS } from './spaceWords'
import {
  emptyLedger,
  type ScopePose,
  type SpaceCommand,
  type SpaceInputMode,
  type SpacePaneState,
} from './types'

/**
 * The space engine's host (plan, section 4.6): it loads the collision proxies, holds the engine's
 * state, turns the pane's commands into simulated actions, runs the clock while the lung has a move
 * due, and gives the pane its state. Nothing here works out anything spatial; the engine does.
 *
 * Loading is guarded: a result that arrives after a newer attempt has started is dropped, and trying
 * again never marks a region seen, since the engine starts afresh from the scenario's start. The clock
 * runs on animation frames only while a move of the lung is due, in whole milliseconds, each frame
 * handing the engine at most `MAX_FRAME_MS`; a hidden tab has no frames, so the lung waits, and the
 * time away is not handed on when the tab returns. Under reduced motion the engine holds the clock.
 */
export interface SpaceEngineStart {
  readonly scenario: string
  readonly pose: ScopePose
  readonly lungStep: number
  /** The forceps in the channel, and whether the target is authorised (the contact spike). */
  readonly tool?: { readonly authorised: boolean }
  /** The teaching target's name, which the snapshot's geometry carries (the contact spike). */
  readonly target?: string
}

export type SpaceLoader = (signal: AbortSignal) => Promise<LoadedSpace>

export interface SpaceEngineSession {
  readonly paneState: SpacePaneState
  /** The loaded space, once it is ready, for a scene to draw the same geometry the engine uses. */
  readonly space: LoadedSpace | null
  onCommand(command: SpaceCommand, input: SpaceInputMode): void
  setLungTarget(step: number): void
  /**
   * Start the engine afresh at another start, without loading anything again: a teaching example
   * or a stop on a tour. It is never a simulated action, and nothing seen before carries over.
   */
  restart(start: SpaceEngineStart): void
}

/**
 * The packaged proxies, over the network, from the generated anatomy manifest, with a teaching
 * target set in the space if one is given.
 */
export function packagedSpaceLoader(
  options: { readonly target?: TeachingTarget } = {},
): SpaceLoader {
  return async (signal) => {
    const fetchBytes = async (id: string) => {
      const file = anatomyManifest.files.find((entry) => entry.id === id)
      if (!file) throw new Error(`The anatomy manifest has no ${id}`)
      const response = await fetch(file.url, { signal })
      if (!response.ok) throw new Error(`${file.url}: ${response.status}`)
      return new Uint8Array(await response.arrayBuffer())
    }
    const [space, lung] = await Promise.all([
      fetchBytes('proxy-pleural-space'),
      fetchBytes('proxy-lung'),
    ])
    return loadSpace(space, lung, options)
  }
}

/** The packaged proxies, as the lessons use them. */
export const loadPackagedSpace: SpaceLoader = packagedSpaceLoader()

/** What the engine starts from, for a start. */
function engineStart(start: SpaceEngineStart, reducedMotion: boolean) {
  return {
    scenario: start.scenario,
    lungStep: start.lungStep,
    pose: start.pose,
    reducedMotion,
    snapshot: spaceSnapshot(start.scenario, start.lungStep, start.target),
    ...(start.tool ? { tool: start.tool } : {}),
  }
}

type Loaded =
  | { readonly kind: 'loading'; readonly again: boolean }
  | { readonly kind: 'ready'; readonly space: LoadedSpace; readonly resolver: SpaceResolver }
  | { readonly kind: 'failed'; readonly canRetry: boolean }

export function useSpaceEngine(
  start: SpaceEngineStart,
  {
    reducedMotion,
    load = loadPackagedSpace,
  }: { readonly reducedMotion: boolean; readonly load?: SpaceLoader },
): SpaceEngineSession {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading', again: false })
  const [engine, setEngine] = useState<EngineState | null>(null)
  // The start is the engine's at its start; a new scenario is a new host (give it a new key).
  const [begin] = useState(() => start)
  // Load, and drop any result that a newer attempt has overtaken.
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    load(controller.signal).then(
      (space) => {
        if (!current) return
        const resolver = createResolver(space)
        try {
          // the motion preference follows below, once the engine exists
          setEngine(startEngine(resolver, engineStart(begin, true)))
          setLoaded({ kind: 'ready', space, resolver })
        } catch {
          // a start the engine refuses is the scenario's fault, and loading again will not mend it
          setLoaded({ kind: 'failed', canRetry: false })
        }
      },
      () => {
        if (current) setLoaded({ kind: 'failed', canRetry: true })
      },
    )
    return () => {
      current = false
      controller.abort()
    }
  }, [attempt, load, begin])

  const resolver = loaded.kind === 'ready' ? loaded.resolver : null
  const dispatch = useCallback(
    (action: SimulatedAction) => {
      if (!resolver) return
      setEngine((state) => (state ? reduce(state, action, resolver) : state))
    },
    [resolver],
  )

  // The motion preference, as it is now: before hydration it reads as reduced, the safer, and the
  // learner may change it while the space is open. Applied while rendering, once per change.
  if (engine && resolver && engine.reducedMotion !== reducedMotion) {
    setEngine(reduce(engine, { type: 'motion', reduced: reducedMotion }, resolver))
  }

  // The clock: animation frames while a move of the lung is due, whole milliseconds at a time, no
  // frame handing the engine more than a frame's worth, and the time a hidden page had no frames
  // counting for nothing (`lungClock.ts`).
  const due =
    engine !== null && !engine.reducedMotion && engine.nextLungMoveAtMs !== null && !engine.lungHeld
  useEffect(() => {
    if (!due) return
    const clock = frameClock(performance.now())
    let frame = 0
    const onFrame = (now: number) => {
      const ms = clock.advance(now)
      if (ms > 0) dispatch({ type: 'tick', ms })
      frame = requestAnimationFrame(onFrame)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') clock.resume(performance.now())
    }
    document.addEventListener('visibilitychange', onVisibility)
    frame = requestAnimationFrame(onFrame)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [due, dispatch])

  const onCommand = useCallback(
    (command: SpaceCommand, input: SpaceInputMode) => {
      if (command.kind === 'retry-geometry') {
        if (loaded.kind === 'failed' && loaded.canRetry) {
          setEngine(null)
          setLoaded({ kind: 'loading', again: true })
          setAttempt((n) => n + 1)
        }
        return
      }
      setEngine((state) =>
        state && resolver
          ? reduce(state, { type: 'command', command, input, snapshot: state.snapshot }, resolver)
          : state,
      )
    },
    [loaded, resolver],
  )

  const setLungTarget = useCallback(
    (step: number) => dispatch({ type: 'lung-target', step }),
    [dispatch],
  )

  const restart = useCallback(
    (next: SpaceEngineStart) => {
      if (!resolver) return
      setEngine(startEngine(resolver, engineStart(next, reducedMotion)))
    },
    [resolver, reducedMotion],
  )

  const reach = useMemo(() => (resolver ? currentReach(resolver.sampleCount) : null), [resolver])
  const paneState = useMemo((): SpacePaneState => {
    if (loaded.kind === 'ready' && engine) {
      return paneStateOf(engine, loaded.space, reach)
    }
    return {
      snapshot: spaceSnapshot(start.scenario, start.lungStep, start.target),
      readiness:
        loaded.kind === 'failed'
          ? { kind: 'unavailable', why: READINESS_WORDS.unavailable, canRetry: loaded.canRetry }
          : {
              kind: 'loading',
              what:
                loaded.kind === 'loading' && loaded.again
                  ? READINESS_WORDS.loadingAgain
                  : READINESS_WORDS.loading,
            },
      pose: start.pose,
      lungStep: start.lungStep,
      inView: [],
      ledger: emptyLedger(),
      refusal: null,
      crossSection: null,
      clock: { held: false },
    }
  }, [loaded, engine, reach, start.scenario, start.lungStep, start.pose, start.target])

  return {
    paneState,
    space: loaded.kind === 'ready' ? loaded.space : null,
    onCommand,
    setLungTarget,
    restart,
  }
}
