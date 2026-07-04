'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

import { createScopeInputStore } from './scope-input-store'
import type { ScopeInputSnapshot, ScopeInputStore } from './scope-input-store'

const ScopeInputContext = createContext<ScopeInputStore | null>(null)

interface ScopeInputProviderProps {
  children: ReactNode
  /** Start the rAF polling loop on mount (default true). */
  autoStart?: boolean
}

export function ScopeInputProvider({ children, autoStart = true }: ScopeInputProviderProps) {
  const [store] = useState(() => createScopeInputStore())

  useEffect(() => {
    if (autoStart) store.start()
    return () => {
      store.destroy()
    }
  }, [store, autoStart])

  return <ScopeInputContext.Provider value={store}>{children}</ScopeInputContext.Provider>
}

export function useScopeInputStore(): ScopeInputStore {
  const store = useContext(ScopeInputContext)
  if (!store) {
    throw new Error('useScopeInputStore must be used inside a ScopeInputProvider')
  }
  return store
}

/** Live scope input snapshot (re-renders per frame while a device is connected). */
export function useScopeInput(): ScopeInputSnapshot {
  const store = useScopeInputStore()
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
