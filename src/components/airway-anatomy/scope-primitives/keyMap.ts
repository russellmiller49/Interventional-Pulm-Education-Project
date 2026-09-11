/**
 * The virtual bronchoscope's keyboard map, as data: arrows steer one unit in the image plane,
 * W/S advance and withdraw one step, Q/E roll the image five degrees, R recenters. The admin
 * module and the Bronchoscopy Foundations pane read the same table, so a key means one thing.
 */
export type ScopeKeyAction =
  | { readonly kind: 'steer'; readonly dxUnit: number; readonly dyUpUnit: number }
  | { readonly kind: 'move'; readonly direction: 1 | -1 }
  | { readonly kind: 'roll'; readonly deltaDeg: number }
  | { readonly kind: 'recenter' }

export const SCOPE_KEY_MAP: Readonly<Record<string, ScopeKeyAction>> = {
  ArrowUp: { kind: 'steer', dxUnit: 0, dyUpUnit: 1 },
  ArrowDown: { kind: 'steer', dxUnit: 0, dyUpUnit: -1 },
  ArrowLeft: { kind: 'steer', dxUnit: -1, dyUpUnit: 0 },
  ArrowRight: { kind: 'steer', dxUnit: 1, dyUpUnit: 0 },
  w: { kind: 'move', direction: 1 },
  W: { kind: 'move', direction: 1 },
  s: { kind: 'move', direction: -1 },
  S: { kind: 'move', direction: -1 },
  q: { kind: 'roll', deltaDeg: -5 },
  Q: { kind: 'roll', deltaDeg: -5 },
  e: { kind: 'roll', deltaDeg: 5 },
  E: { kind: 'roll', deltaDeg: 5 },
  r: { kind: 'recenter' },
  R: { kind: 'recenter' },
}

export function scopeKeyAction(key: string): ScopeKeyAction | null {
  return Object.prototype.hasOwnProperty.call(SCOPE_KEY_MAP, key) ? SCOPE_KEY_MAP[key] : null
}
