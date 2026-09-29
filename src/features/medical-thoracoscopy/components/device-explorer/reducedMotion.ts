'use client'

import { useSyncExternalStore } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(listener: () => void) {
  const media = window.matchMedia?.(QUERY)
  media?.addEventListener('change', listener)
  return () => media?.removeEventListener('change', listener)
}

/**
 * Whether the viewer asked for less motion. The explorer's viewport renders on the client only, so
 * reading it at mount cannot disagree with a server render. Camera flights and blends then happen
 * at once; the assembly sequence still plays when asked, since playing it is the viewer's choice.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  )
}

/** A transition's length, or an instant when less motion is wanted. */
export function motionSeconds(seconds: number, reduced: boolean): number {
  return reduced ? 1e-3 : seconds
}
