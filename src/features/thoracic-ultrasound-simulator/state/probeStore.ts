'use client'

import { useSyncExternalStore } from 'react'

import type { ThoracicProbeState } from '../types'

/**
 * Shared probe transform store.
 *
 * Writes land in `getState()` immediately so imperative readers (the R3F frame
 * loop poses the probe mesh straight from the store every frame) always see the
 * newest transform. React subscribers read `getSnapshot()`, which only advances
 * once per animation frame: dragging the probe fires dozens of `setState` calls
 * per frame but the React tree re-renders at most once per frame.
 */
export interface ProbeStore {
  /** Latest state, updated synchronously on every set. For imperative readers. */
  getState: () => ThoracicProbeState
  /** rAF-batched state for useSyncExternalStore subscribers. */
  getSnapshot: () => ThoracicProbeState
  getServerSnapshot: () => ThoracicProbeState
  setState: (partial: Partial<ThoracicProbeState>) => void
  replaceState: (next: ThoracicProbeState) => void
  subscribe: (listener: () => void) => () => void
  /** Force any pending batched notification to fire now (drag end, tests). */
  flushSync: () => void
}

type FrameScheduler = (callback: () => void) => void

const defaultScheduler: FrameScheduler = (callback) => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback())
  } else {
    setTimeout(callback, 16)
  }
}

export function createProbeStore(
  initial: ThoracicProbeState,
  scheduler: FrameScheduler = defaultScheduler,
): ProbeStore {
  let state = initial
  let snapshot = initial
  let flushScheduled = false
  const listeners = new Set<() => void>()

  function notify() {
    if (snapshot === state) {
      flushScheduled = false
      return
    }
    snapshot = state
    flushScheduled = false
    for (const listener of listeners) {
      listener()
    }
  }

  function scheduleFlush() {
    if (flushScheduled) {
      return
    }
    flushScheduled = true
    scheduler(notify)
  }

  return {
    getState: () => state,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    setState: (partial) => {
      state = { ...state, ...partial }
      scheduleFlush()
    },
    replaceState: (next) => {
      state = next
      scheduleFlush()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    flushSync: notify,
  }
}

/** React view of the store; re-renders at most once per animation frame. */
export function useProbeState(store: ProbeStore): ThoracicProbeState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
