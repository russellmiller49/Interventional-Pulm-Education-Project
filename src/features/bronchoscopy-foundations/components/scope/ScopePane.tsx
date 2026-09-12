'use client'

import { ScopeFallback } from './ScopeFallback'
import { SCOPE_MODES_READY, ScopeScenePane } from './ScopeScenePane'
import type { ScopePaneProps } from './types'

/**
 * The simulator pane the stage host renders: Codex's scene for the modes it has, the DOM-only
 * fallback for the rest. The host never knows which it got — both honour `./types.ts`.
 */
export function ScopePane(props: ScopePaneProps) {
  return SCOPE_MODES_READY.has(props.view.mode) ? (
    <ScopeScenePane {...props} />
  ) : (
    <ScopeFallback {...props} />
  )
}
