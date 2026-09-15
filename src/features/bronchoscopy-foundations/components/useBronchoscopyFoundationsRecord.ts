'use client'

import { useSyncExternalStore } from 'react'

import {
  BRONCH_SELF_PACED_CHANGED_EVENT,
  BRONCH_SELF_PACED_STORAGE_KEY,
  createEmptyBronchSelfPacedRecord,
  parseBronchSelfPacedRecord,
  type BronchSelfPacedRecord,
} from '../engine/selfPacedProgress'

/**
 * The module's self-paced record as an external store.
 *
 * The server pass and the hydrating client render both read the empty record — which resolves to
 * section one, exactly what the server rendered — and the stored record replaces it once React is
 * subscribed. The snapshot is cached by the raw string it was parsed from, so an unchanged store
 * yields the same object. The store re-reads when the stage writes, so a hub open in another tab
 * follows.
 */
const EMPTY = createEmptyBronchSelfPacedRecord()
let cachedRaw: string | null | undefined
let cachedRecord: BronchSelfPacedRecord = EMPTY

function readSnapshot(): BronchSelfPacedRecord {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(BRONCH_SELF_PACED_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedRecord = raw === null ? EMPTY : (parseBronchSelfPacedRecord(raw) ?? EMPTY)
  }
  return cachedRecord
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(BRONCH_SELF_PACED_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(BRONCH_SELF_PACED_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function serverSnapshot(): BronchSelfPacedRecord {
  return EMPTY
}

const noSubscription = () => () => {}

export function useBronchoscopyFoundationsRecord(): {
  readonly record: BronchSelfPacedRecord
  readonly hydrated: boolean
} {
  const record = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot)
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  return { record, hydrated }
}
