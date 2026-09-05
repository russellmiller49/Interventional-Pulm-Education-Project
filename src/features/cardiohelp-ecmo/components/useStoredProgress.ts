'use client'

import { useMemo, useSyncExternalStore } from 'react'

import {
  CARDIOHELP_PROGRESS_STORAGE_KEY,
  createDefaultProgress,
  parseProgress,
} from '../engine/progress'
import type { ProgressV2 } from '../engine/types'

/**
 * The learner's stored progress, read as an external store.
 *
 * The hub and the Learn landing both render before the browser has been asked anything, so the
 * server pass and the first client render must agree (a fresh envelope), and the stored envelope
 * must replace it once the browser can be read. `useSyncExternalStore` gives exactly that without a
 * setState-in-effect: the snapshot is the raw stored string (stable between writes), the server
 * snapshot is empty, and the parsed envelope is memoised on the string.
 *
 * `parseProgress` still owns validation and the version envelope; this hook only decides when to
 * ask it.
 */
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CARDIOHELP_PROGRESS_STORAGE_KEY) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(CARDIOHELP_PROGRESS_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function getServerSnapshot(): string {
  return ''
}

export function useStoredProgress(): { readonly progress: ProgressV2; readonly hydrated: boolean } {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const progress = useMemo(
    () => (hydrated ? (parseProgress(raw) ?? createDefaultProgress()) : createDefaultProgress()),
    [raw, hydrated],
  )
  return { progress, hydrated }
}
