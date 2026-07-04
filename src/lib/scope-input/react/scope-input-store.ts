import {
  GamepadScopeSource,
  loadActiveScopeTrackerProfile,
  normalizeScopeTrackerProfile,
  startInputFrameLoop,
  subscribeToScopeTrackerProfileChanges,
} from '../core'
import type {
  ScopeInputFrame,
  ScopeInputSource,
  ScopeTrackerProfile,
  VirtualScopeSource,
} from '../core'

export type ScopeInputSourceKind = 'hardware' | 'virtual'

export interface ScopeInputSnapshot {
  frame: ScopeInputFrame | null
  connected: boolean
  deviceId: string | null
  profile: ScopeTrackerProfile
  sourceKind: ScopeInputSourceKind
  running: boolean
}

/**
 * rAF-polled scope input store, following the probeStore pattern:
 * - React subscribers read batched snapshots via useSyncExternalStore.
 * - Imperative consumers can reach the underlying source via getSource().
 */
export interface ScopeInputStore {
  getSnapshot: () => ScopeInputSnapshot
  getServerSnapshot: () => ScopeInputSnapshot
  subscribe: (listener: () => void) => () => void
  start: () => void
  stop: () => void
  /** Apply a (possibly unsaved) profile to the live pipeline. */
  setProfile: (profile: ScopeTrackerProfile) => void
  /** Re-read the active profile from localStorage. */
  reloadProfile: () => void
  /** Route input through an emulated source (null returns to hardware). */
  setVirtualSource: (source: VirtualScopeSource | null) => void
  getSource: () => ScopeInputSource
  destroy: () => void
}

const SERVER_SNAPSHOT: ScopeInputSnapshot = {
  frame: null,
  connected: false,
  deviceId: null,
  profile: normalizeScopeTrackerProfile(),
  sourceKind: 'hardware',
  running: false,
}

export function createScopeInputStore(): ScopeInputStore {
  const listeners = new Set<() => void>()
  let profile = normalizeScopeTrackerProfile()
  const hardwareSource = new GamepadScopeSource({ profile })
  let virtualSource: VirtualScopeSource | null = null
  let running = false
  let stopLoop: (() => void) | null = null
  let unsubscribeProfiles: (() => void) | null = null
  let snapshot: ScopeInputSnapshot = { ...SERVER_SNAPSHOT, profile }

  const activeSource = (): ScopeInputSource => virtualSource ?? hardwareSource

  const emit = () => {
    for (const listener of Array.from(listeners)) listener()
  }

  const publish = (frame: ScopeInputFrame | null) => {
    const source = activeSource()
    snapshot = {
      frame,
      connected: source.connected,
      deviceId: source.deviceId,
      profile,
      sourceKind: virtualSource ? 'virtual' : 'hardware',
      running,
    }
    emit()
  }

  const tick = () => {
    if (!running) return
    const frame = activeSource().sample()
    // Skip notifications while nothing is connected and nothing changed,
    // so idle pages don't re-render at 60 Hz.
    if (
      frame !== null ||
      snapshot.frame !== null ||
      snapshot.connected !== activeSource().connected
    ) {
      publish(frame)
    }
  }

  const start = () => {
    if (running || typeof window === 'undefined') return
    running = true
    profile = loadActiveScopeTrackerProfile()
    hardwareSource.setProfile(profile)
    virtualSource?.setProfile(profile)
    unsubscribeProfiles = subscribeToScopeTrackerProfileChanges(() => {
      reloadProfile()
    })
    publish(null)
    stopLoop = startInputFrameLoop(tick)
  }

  const stop = () => {
    running = false
    if (stopLoop) {
      stopLoop()
      stopLoop = null
    }
    if (unsubscribeProfiles) {
      unsubscribeProfiles()
      unsubscribeProfiles = null
    }
    publish(null)
  }

  const setProfile = (nextProfile: ScopeTrackerProfile) => {
    profile = nextProfile
    hardwareSource.setProfile(nextProfile)
    virtualSource?.setProfile(nextProfile)
    publish(snapshot.frame)
  }

  const reloadProfile = () => {
    setProfile(loadActiveScopeTrackerProfile())
  }

  const setVirtualSource = (source: VirtualScopeSource | null) => {
    if (virtualSource === source) return
    virtualSource = source
    virtualSource?.setProfile(profile)
    hardwareSource.reset()
    publish(null)
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start,
    stop,
    setProfile,
    reloadProfile,
    setVirtualSource,
    getSource: activeSource,
    destroy: () => {
      stop()
      listeners.clear()
    },
  }
}
