'use client'

import { useEffect, useState } from 'react'

import {
  createEmptyLearnRecord,
  ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT,
  readLearnRecord,
  type IcuHemodynamicsLearnRecord,
} from '../engine/learnProgress'

/**
 * The Learn record, hydration-safe.
 *
 * The server pass and the first client render both see an empty record — which resolves to
 * section one, exactly what the server rendered — and the stored record arrives in an effect.
 * The record re-reads when the stage writes a completion, so a hub open in another tab follows.
 */
export function useHemodynamicsLearnRecord(): {
  readonly record: IcuHemodynamicsLearnRecord
  readonly hydrated: boolean
} {
  const [record, setRecord] = useState<IcuHemodynamicsLearnRecord>(createEmptyLearnRecord)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const refresh = () => setRecord(readLearnRecord())
    // Reading storage is the one thing this effect exists to do; the server pass has none.
     
    refresh()
    setHydrated(true)
    window.addEventListener(ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(ICU_HEMODYNAMICS_LEARN_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return { record, hydrated }
}
