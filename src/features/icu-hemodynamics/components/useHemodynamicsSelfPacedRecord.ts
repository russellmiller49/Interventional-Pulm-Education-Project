'use client'

import { useSyncExternalStore } from 'react'

import {
  createEmptySelfPacedRecord,
  ICU_HEMODYNAMICS_SELF_PACED_CHANGED_EVENT,
  ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY,
  parseSelfPacedRecord,
  type IcuHemodynamicsSelfPacedRecord,
} from '../engine/selfPacedProgress'

/**
 * The self-paced record, as an external store.
 *
 * The server pass and the hydrating client render both read the empty record — which resolves to
 * section one, exactly what the server rendered — and the stored record replaces it once React is
 * subscribed. The snapshot is cached by the raw string it was parsed from, so an unchanged store
 * yields the same object and nothing re-renders for nothing. The store re-reads when the module
 * writes, so a hub open in another tab follows.
 */
const EMPTY = createEmptySelfPacedRecord()
let cachedRaw: string | null | undefined
let cachedRecord: IcuHemodynamicsSelfPacedRecord = EMPTY

function readSnapshot(): IcuHemodynamicsSelfPacedRecord {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(ICU_HEMODYNAMICS_SELF_PACED_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedRecord = parseSelfPacedRecord(raw) ?? EMPTY
  }
  return cachedRecord
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(ICU_HEMODYNAMICS_SELF_PACED_CHANGED_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(ICU_HEMODYNAMICS_SELF_PACED_CHANGED_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

function serverSnapshot(): IcuHemodynamicsSelfPacedRecord {
  return EMPTY
}

const noSubscription = () => () => {}

export function useHemodynamicsSelfPacedRecord(): {
  readonly record: IcuHemodynamicsSelfPacedRecord
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
