'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

import {
  createEmptyRecord,
  NAVIGATOR_CHANGED_EVENT,
  NAVIGATOR_STORAGE_KEY,
  parseRecord,
  readRecord,
  writeRecord,
  type NavigatorRecord,
} from '../engine/record'

/**
 * The learner's record as an external store. The server pass and the hydrating client both read
 * the empty record, and the stored record replaces it once React is subscribed. The snapshot is
 * cached by the raw string it was parsed from, so an unchanged store yields the same object.
 */
const EMPTY = createEmptyRecord()
let cachedRaw: string | null | undefined
let cachedRecord: NavigatorRecord = EMPTY

function readSnapshot(): NavigatorRecord {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(NAVIGATOR_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedRecord = raw === null ? EMPTY : (parseRecord(raw) ?? EMPTY)
  }
  return cachedRecord
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(NAVIGATOR_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(NAVIGATOR_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

const serverSnapshot = () => EMPTY
const noSubscription = () => () => {}

export function useNavigatorRecord(): {
  readonly record: NavigatorRecord
  readonly hydrated: boolean
  /** Apply a pure update to the latest stored record and persist it. */
  readonly update: (fn: (current: NavigatorRecord) => NavigatorRecord) => NavigatorRecord
} {
  const record = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot)
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  const update = useCallback((fn: (current: NavigatorRecord) => NavigatorRecord) => {
    const next = fn(readRecord())
    writeRecord(next)
    return next
  }, [])
  return { record, hydrated, update }
}

/** A stable "now" for a render: ISO string, refreshed per call. */
export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * One "now" per record version. Status and schedule derivations take the time as an argument so
 * they stay pure; this pins it for a render and refreshes it whenever the record changes, so a
 * review that falls due is picked up on the next write rather than mid-render.
 */
export function useNow(record: NavigatorRecord): string {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshed per record version on purpose
  return useMemo(() => nowIso(), [record])
}
