import {
  ACTIVE_PROFILE_STORAGE_KEY,
  PROFILE_BROADCAST_CHANNEL,
  PROFILES_STORAGE_KEY,
} from './constants'
import { clamp } from './decode'
import type { ScopeTrackerProfile } from './types'

export const DEFAULT_PROFILE_ID = 'default'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function baseProfile(): ScopeTrackerProfile {
  return {
    version: 1,
    id: DEFAULT_PROFILE_ID,
    name: 'Default',
    device: { gamepadId: null },
    flexion: { invert: false, deadzone: 0.04, trim: 0, expo: 0 },
    depth: { invert: false, noiseGateMm: 0.05, gain: 1 },
    roll: { invert: false, gain: 1 },
    buttons: { swapAB: false },
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** Tolerantly merge unknown input onto defaults. Never throws. */
export function normalizeScopeTrackerProfile(input?: unknown): ScopeTrackerProfile {
  const base = baseProfile()
  const source = asRecord(input)
  const device = asRecord(source.device)
  const flexion = asRecord(source.flexion)
  const depth = asRecord(source.depth)
  const roll = asRecord(source.roll)
  const buttons = asRecord(source.buttons)
  return {
    version: 1,
    id: asString(source.id, base.id),
    name: asString(source.name, base.name),
    device: {
      gamepadId: typeof device.gamepadId === 'string' && device.gamepadId ? device.gamepadId : null,
    },
    flexion: {
      invert: asBoolean(flexion.invert, base.flexion.invert),
      deadzone: asNumber(flexion.deadzone, base.flexion.deadzone, 0, 0.4),
      trim: asNumber(flexion.trim, base.flexion.trim, -0.5, 0.5),
      expo: asNumber(flexion.expo, base.flexion.expo, 0, 1),
    },
    depth: {
      invert: asBoolean(depth.invert, base.depth.invert),
      noiseGateMm: asNumber(depth.noiseGateMm, base.depth.noiseGateMm, 0, 5),
      gain: asNumber(depth.gain, base.depth.gain, 0.1, 10),
    },
    roll: {
      invert: asBoolean(roll.invert, base.roll.invert),
      gain: asNumber(roll.gain, base.roll.gain, 0.1, 10),
    },
    buttons: {
      swapAB: asBoolean(buttons.swapAB, base.buttons.swapAB),
    },
  }
}

function randomProfileId(): string {
  const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return `sp-${cryptoApi.randomUUID().slice(0, 8)}`
  }
  return `sp-${Math.random().toString(36).slice(2, 10)}`
}

export function createScopeTrackerProfile(
  name: string,
  overrides?: Partial<Omit<ScopeTrackerProfile, 'version' | 'id' | 'name'>>,
): ScopeTrackerProfile {
  return normalizeScopeTrackerProfile({ ...overrides, id: randomProfileId(), name })
}

/**
 * Apply per-user flexion shaping: trim -> deadzone (rescaled) -> expo -> invert.
 */
export function shapeFlexion(value: number, shaping: ScopeTrackerProfile['flexion']): number {
  let shaped = clamp(clamp(value, -1, 1) - shaping.trim, -1, 1)
  const deadzone = clamp(shaping.deadzone, 0, 0.4)
  if (Math.abs(shaped) <= deadzone) {
    shaped = 0
  } else if (deadzone > 0) {
    const sign = shaped > 0 ? 1 : -1
    shaped = sign * ((Math.abs(shaped) - deadzone) / (1 - deadzone))
  }
  const expo = clamp(shaping.expo, 0, 1)
  shaped = shaped * (1 - expo) + shaped ** 3 * expo
  if (shaping.invert) shaped = -shaped
  return clamp(shaped, -1, 1)
}

export interface ScopeTrackerProfilesState {
  profiles: ScopeTrackerProfile[]
  activeId: string
}

function defaultStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Load all profiles; always returns at least the default profile and a valid activeId. */
export function loadScopeTrackerProfiles(storage?: StorageLike | null): ScopeTrackerProfilesState {
  const store = storage === undefined ? defaultStorage() : storage
  let profiles: ScopeTrackerProfile[] = []
  let activeId = DEFAULT_PROFILE_ID
  if (store) {
    try {
      const rawProfiles = store.getItem(PROFILES_STORAGE_KEY)
      if (rawProfiles) {
        const parsed: unknown = JSON.parse(rawProfiles)
        if (Array.isArray(parsed)) {
          profiles = parsed.map((entry) => normalizeScopeTrackerProfile(entry))
        }
      }
      activeId = store.getItem(ACTIVE_PROFILE_STORAGE_KEY) ?? DEFAULT_PROFILE_ID
    } catch {
      profiles = []
    }
  }
  if (profiles.length === 0) {
    profiles = [normalizeScopeTrackerProfile()]
  }
  // Drop duplicate ids, keeping the first occurrence.
  const seen = new Set<string>()
  profiles = profiles.filter((profile) => {
    if (seen.has(profile.id)) return false
    seen.add(profile.id)
    return true
  })
  if (!profiles.some((profile) => profile.id === activeId)) {
    activeId = profiles[0].id
  }
  return { profiles, activeId }
}

export function loadActiveScopeTrackerProfile(storage?: StorageLike | null): ScopeTrackerProfile {
  const { profiles, activeId } = loadScopeTrackerProfiles(storage)
  return profiles.find((profile) => profile.id === activeId) ?? profiles[0]
}

export function saveScopeTrackerProfiles(
  state: ScopeTrackerProfilesState,
  storage?: StorageLike | null,
): void {
  const store = storage === undefined ? defaultStorage() : storage
  if (!store) return
  try {
    store.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state.profiles))
    store.setItem(ACTIVE_PROFILE_STORAGE_KEY, state.activeId)
  } catch {
    return
  }
  broadcastProfilesUpdated()
}

/** Notify same-origin listeners (e.g. embedded simulator iframes) that profiles changed. */
export function broadcastProfilesUpdated(): void {
  if (typeof BroadcastChannel === 'undefined') return
  try {
    const channel = new BroadcastChannel(PROFILE_BROADCAST_CHANNEL)
    channel.postMessage({ type: 'profiles-updated' })
    channel.close()
  } catch {
    // Best effort only.
  }
}

/**
 * Subscribe to profile changes from this tab (BroadcastChannel) and other tabs
 * (storage events). Returns an unsubscribe function; a no-op on the server.
 */
export function subscribeToScopeTrackerProfileChanges(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROFILES_STORAGE_KEY || event.key === ACTIVE_PROFILE_STORAGE_KEY) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  let channel: BroadcastChannel | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(PROFILE_BROADCAST_CHANNEL)
      channel.onmessage = () => listener()
    } catch {
      channel = null
    }
  }
  return () => {
    window.removeEventListener('storage', onStorage)
    if (channel) channel.close()
  }
}
