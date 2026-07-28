'use client'

import { useCallback, useSyncExternalStore } from 'react'

import {
  EQUIPMENT_SETS_STORAGE_KEY,
  MAX_EQUIPMENT_SETS,
  parseStoredEquipmentSets,
  serializeEquipmentSets,
  type EquipmentSet,
} from '../domain/equipment-set'

/**
 * Equipment sets live in browser storage for now.
 *
 * They are personal, reusable descriptions of trays the physician already owns, and this
 * keeps them working before the per-user database lands. The stored shape is versioned so
 * the same records can be lifted into Postgres later without a migration dance.
 */
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function readSnapshot(): string {
  return window.localStorage.getItem(EQUIPMENT_SETS_STORAGE_KEY) ?? ''
}

/** Server render has no storage; an empty snapshot keeps hydration consistent. */
function readServerSnapshot(): string {
  return ''
}

export function useEquipmentSets() {
  // useSyncExternalStore reads storage during render rather than assigning state inside an
  // effect, so there is no cascading re-render on mount and edits in another tab propagate.
  // The server snapshot is empty, so the first paint shows no sets and React re-renders
  // with the stored ones straight after hydration — no effect, no cascading render.
  const raw = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot)
  const sets = parseStoredEquipmentSets(raw || null)

  const persist = useCallback((next: EquipmentSet[]) => {
    try {
      window.localStorage.setItem(EQUIPMENT_SETS_STORAGE_KEY, serializeEquipmentSets(next))
    } catch {
      // A full or blocked storage quota must not crash the editor.
    }
    for (const listener of listeners) listener()
  }, [])

  const saveSet = useCallback(
    (set: EquipmentSet) => {
      const index = sets.findIndex((candidate) => candidate.id === set.id)
      const stamped = { ...set, updatedAt: new Date().toISOString() }
      if (index >= 0) {
        const next = [...sets]
        next[index] = stamped
        persist(next)
        return
      }
      if (sets.length >= MAX_EQUIPMENT_SETS) return
      persist([...sets, stamped])
    },
    [persist, sets],
  )

  const deleteSet = useCallback(
    (setId: string) => persist(sets.filter((set) => set.id !== setId)),
    [persist, sets],
  )

  const duplicateSet = useCallback(
    (setId: string) => {
      const source = sets.find((set) => set.id === setId)
      if (!source || sets.length >= MAX_EQUIPMENT_SETS) return
      const now = new Date().toISOString()
      persist([
        ...sets,
        {
          ...source,
          id: `set-${now}-${Math.round(performance.now())}`,
          name: `${source.name} (copy)`,
          createdAt: now,
          updatedAt: now,
        },
      ])
    },
    [persist, sets],
  )

  return { sets, saveSet, deleteSet, duplicateSet }
}
