'use client'

import { ScopeFallback } from './ScopeFallback'
import type { ScopeMode, ScopePaneProps } from './types'

/**
 * CODEX-OWNED. The 3D bronchoscopy simulator: the optical view through the teaching lumen, the
 * larynx, the tube and the accessory scenes, the ostium pins, the control dock and the readouts,
 * per the brief in `docs/bronchoscopy-foundations/codex-scope-brief.md`, part 2.
 *
 * Until a mode's scene lands, it is not in `SCOPE_MODES_READY` and `ScopePane` routes that mode
 * to `ScopeFallback`. Add a mode here only when its scene honours every prop and data attribute
 * in `./types.ts` — the commands, the element ids, the view signal, the map pins, the readouts,
 * the inspection record and the boundary line. The flow tests never mount this file (they use
 * `test-support/ScopeTestDouble`), so the scene's own tests and the e2e pixel checks are what
 * prove it. Load the scene through `next/dynamic` with `ssr: false` when it arrives; nothing
 * here may import three.js at module scope.
 */
export const SCOPE_MODES_READY: ReadonlySet<ScopeMode> = new Set<ScopeMode>([])

export { resolveScopeInputs } from '../../engine/scope/scopeInputs'
export { scopeViewErrors } from '../../engine/scope/scopeViewErrors'

export function ScopeScenePane(props: ScopePaneProps) {
  return <ScopeFallback {...props} />
}
