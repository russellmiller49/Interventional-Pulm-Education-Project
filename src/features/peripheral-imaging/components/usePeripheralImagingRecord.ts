'use client'

import { useSyncExternalStore } from 'react'

import {
  createEmptyImagingRecord,
  parseImagingRecord,
  parseLegacyImagingRecord,
  migrateImagingRecordFromV1,
  PERIPHERAL_IMAGING_RECORD_CHANGED_EVENT,
  PERIPHERAL_IMAGING_STORAGE_KEY,
  PERIPHERAL_IMAGING_STORAGE_KEY_V1,
  type ImagingRecord,
} from '../engine/learnProgress'

/**
 * The module record as an external store.
 *
 * The server pass and the hydrating client render both read the empty record — which resolves to
 * section one, exactly what the server rendered — and the stored record replaces it once React is
 * subscribed. The snapshot is cached by the raw string it was parsed from, so an unchanged store
 * yields the same object. The store re-reads when the stage writes, so a hub open in another tab
 * follows.
 */
const EMPTY = createEmptyImagingRecord()
let cachedRaw: string | null | undefined
let cachedRecord: ImagingRecord = EMPTY

function readSnapshot(): ImagingRecord {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(PERIPHERAL_IMAGING_STORAGE_KEY)
    if (raw === null) {
      const legacy = window.localStorage.getItem(PERIPHERAL_IMAGING_STORAGE_KEY_V1)
      raw = legacy === null ? null : `legacy:${legacy}`
    }
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    if (raw === null) cachedRecord = EMPTY
    else if (raw.startsWith('legacy:')) {
      const legacy = parseLegacyImagingRecord(raw.slice('legacy:'.length))
      cachedRecord = legacy ? migrateImagingRecordFromV1(legacy) : EMPTY
    } else cachedRecord = parseImagingRecord(raw) ?? EMPTY
  }
  return cachedRecord
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(PERIPHERAL_IMAGING_RECORD_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(PERIPHERAL_IMAGING_RECORD_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function serverSnapshot(): ImagingRecord {
  return EMPTY
}

const noSubscription = () => () => {}

export function usePeripheralImagingRecord(): {
  readonly record: ImagingRecord
  readonly hydrated: boolean
} {
  const record = useSyncExternalStore(subscribe, readSnapshot, serverSnapshot)
  // False on the server and on the hydrating render, true once React has re-rendered on the
  // client — the one way a client-only flag stays consistent with the server markup.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )
  return { record, hydrated }
}
