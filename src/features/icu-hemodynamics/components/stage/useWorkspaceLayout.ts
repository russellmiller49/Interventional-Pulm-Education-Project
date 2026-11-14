'use client'

import { useSyncExternalStore } from 'react'

/*
 * The fixed desktop workspace: the same viewport as the shared activity frame and the site's
 * scroll lock (`globals.css`, `hemodynamics-stage.module.css`). There the page does not scroll, so
 * the host ends the text column with the sources (one line, opening in place) rather than giving
 * them a row of the workspace's height. Below it they stay at the end of the page.
 */
export const HEMODYNAMICS_WORKSPACE_QUERY = '(min-width: 1024px) and (min-height: 700px)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(HEMODYNAMICS_WORKSPACE_QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

export function useWorkspaceLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(HEMODYNAMICS_WORKSPACE_QUERY).matches ?? false,
    () => false,
  )
}
