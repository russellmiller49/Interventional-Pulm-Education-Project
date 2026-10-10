'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}
/** False on the server and during hydration, true afterwards: gates reads of browser storage. */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
