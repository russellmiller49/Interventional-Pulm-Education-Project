'use client'

import { useSyncExternalStore } from 'react'

import {
  createEmptyLearnRecord,
  ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT,
  ICU_HEMODYNAMICS_LEARN_STORAGE_KEY,
  parseLearnRecord,
  type IcuHemodynamicsLearnRecord,
} from '../engine/learnProgress'

/**
 * The Learn record, as an external store.
 *
 * The server pass and the hydrating client render both read the empty record — which resolves to
 * section one, exactly what the server rendered — and the stored record replaces it once React
 * is subscribed. The snapshot is cached by the raw string it was parsed from, so an unchanged
 * store yields the same object and nothing re-renders for nothing. The store re-reads when the
 * stage writes a completion, so a hub open in another tab follows.
 */
const EMPTY = createEmptyLearnRecord()
let cachedRaw: string | null | undefined
let cachedRecord: IcuHemodynamicsLearnRecord = EMPTY

function readSnapshot(): IcuHemodynamicsLearnRecord {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(ICU_HEMODYNAMICS_LEARN_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedRecord = parseLearnRecord(raw) ?? EMPTY
  }
  return cachedRecord
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function serverSnapshot(): IcuHemodynamicsLearnRecord {
  return EMPTY
}

const noSubscription = () => () => {}

export function useHemodynamicsLearnRecord(): {
  readonly record: IcuHemodynamicsLearnRecord
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
