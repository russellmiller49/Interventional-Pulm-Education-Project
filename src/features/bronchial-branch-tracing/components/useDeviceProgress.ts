'use client'

import { useMemo, useSyncExternalStore } from 'react'
import {
  CRITICAL_CARE_PROGRESS_CHANGED_EVENT,
  CRITICAL_CARE_PROGRESS_STORAGE_KEY,
  createEmptyCriticalCareProgress,
  parseSerializedCriticalCareProgress,
} from '@/features/learning-module/activity/progress'
import { browserStorage } from '../engine/progress'

function subscribe(changed: () => void) {
  window.addEventListener('storage', changed)
  window.addEventListener(CRITICAL_CARE_PROGRESS_CHANGED_EVENT, changed)
  return () => {
    window.removeEventListener('storage', changed)
    window.removeEventListener(CRITICAL_CARE_PROGRESS_CHANGED_EVENT, changed)
  }
}
function snapshot() {
  try {
    return browserStorage()?.getItem(CRITICAL_CARE_PROGRESS_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}
const serverSnapshot = () => undefined

/** Observe the existing store, including changes from another tab, without adding a second store. */
export function useDeviceProgress() {
  const serialized = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const progress = useMemo(
    () =>
      parseSerializedCriticalCareProgress(serialized) ??
      createEmptyCriticalCareProgress('1970-01-01T00:00:00.000Z'),
    [serialized],
  )
  return { ready: serialized !== undefined, progress }
}
