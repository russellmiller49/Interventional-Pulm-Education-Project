'use client'

import { useSyncExternalStore } from 'react'

import {
  IMAGING_PROGRESS_CHANGED_EVENT,
  IMAGING_PROGRESS_STORAGE_KEY,
  snapshotFromStorage,
  type ImagingProgressSnapshot,
} from '../engine/selfPacedProgress'

/**
 * The self-paced progress record as an external store.
 *
 * The server pass and the hydrating client render both read the empty record — which recommends
 * section one, exactly what the server rendered — and the stored record replaces it once React is
 * subscribed. The snapshot is cached by the raw string it came from, so an unchanged store yields
 * the same object, and it re-reads when the course writes or another tab does.
 */
const SERVER_SNAPSHOT: ImagingProgressSnapshot = snapshotFromStorage(null, true)
let cachedToken: string | undefined
let cachedSnapshot: ImagingProgressSnapshot = SERVER_SNAPSHOT

function readSnapshot(): ImagingProgressSnapshot {
  let raw: string | null = null
  let available = true
  try {
    raw = window.localStorage.getItem(IMAGING_PROGRESS_STORAGE_KEY)
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
  window.addEventListener(IMAGING_PROGRESS_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(IMAGING_PROGRESS_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function serverSnapshot(): ImagingProgressSnapshot {
  return SERVER_SNAPSHOT
}

const noSubscription = () => () => {}

export function useImagingProgress(): ImagingProgressSnapshot & { readonly hydrated: boolean } {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot)
  // False on the server and on the hydrating render, true once React has re-rendered on the
  // client — the one way a client-only flag stays consistent with the server markup.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  return { progress: snapshot.progress, status: snapshot.status, hydrated }
}
