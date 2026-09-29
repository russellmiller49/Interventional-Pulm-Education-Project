'use client'

import { useSyncExternalStore } from 'react'

import {
  snapshotFromStorage,
  THORACOSCOPY_PROGRESS_CHANGED_EVENT,
  THORACOSCOPY_PROGRESS_STORAGE_KEY,
  type ThoracoscopyProgressSnapshot,
} from '../engine/selfPacedProgress'

/**
 * The progress record as an external store. The server pass and the hydrating render both read
 * the empty record, and the stored record replaces it once React is subscribed. The snapshot is
 * cached by the raw string it came from, and re-read when the course writes or another tab does.
 */
const SERVER_SNAPSHOT: ThoracoscopyProgressSnapshot = snapshotFromStorage(null, true)
let cachedToken: string | undefined
let cachedSnapshot: ThoracoscopyProgressSnapshot = SERVER_SNAPSHOT

function readSnapshot(): ThoracoscopyProgressSnapshot {
  let raw: string | null = null
  let available = true
  try {
    raw = window.localStorage.getItem(THORACOSCOPY_PROGRESS_STORAGE_KEY)
  } catch {
    available = false
  }
  const token = available ? (raw === null ? 'empty' : `saved:${raw}`) : 'unavailable'
  if (token !== cachedToken) {
    cachedToken = token
    cachedSnapshot = snapshotFromStorage(raw, available)
  }
  return cachedSnapshot
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(THORACOSCOPY_PROGRESS_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

const noSubscription = () => () => {}

export function useThoracoscopyProgress(): ThoracoscopyProgressSnapshot & {
  readonly hydrated: boolean
} {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => SERVER_SNAPSHOT)
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  return { progress: snapshot.progress, status: snapshot.status, hydrated }
}
