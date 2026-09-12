import type { ScopeCommand, ScopeControlKey, ScopeState } from './types'

export const SCOPE_KEY_MAP: Readonly<Record<string, ScopeControlKey>> = {
  w: 'advance',
  s: 'withdraw',
  a: 'rotate',
  d: 'rotate',
  ArrowUp: 'deflect',
  ArrowDown: 'deflect',
  ' ': 'suction',
  r: 'recenter',
  Home: 'teleportStart',
  l: 'branchLabels',
  c: 'capture',
  k: 'acknowledge',
}

export function scopeKeyCommand(key: string, state: ScopeState): ScopeCommand | null {
  switch (key) {
    case 'w':
      return { type: 'advance', mm: state.inputs.stepMm }
    case 's':
      return { type: 'advance', mm: -state.inputs.stepMm }
    case 'a':
      return { type: 'rotate', deg: -5 }
    case 'd':
      return { type: 'rotate', deg: 5 }
    case 'ArrowUp':
      return { type: 'deflect', deg: 5 }
    case 'ArrowDown':
      return { type: 'deflect', deg: -5 }
    case ' ':
      return { type: 'suction', on: !state.inputs.suction }
    case 'r':
      return { type: 'assist', assist: 'recenter' }
    case 'Home':
      return { type: 'assist', assist: 'teleport-to-start' }
    case 'l':
      return { type: 'branch-labels', on: !state.inputs.branchLabels }
    case 'c':
      return { type: 'capture' }
    case 'k':
      return { type: 'acknowledge' }
    default:
      return null
  }
}
