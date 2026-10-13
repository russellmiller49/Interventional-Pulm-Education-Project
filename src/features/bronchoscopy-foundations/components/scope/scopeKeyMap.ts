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

/**
 * Holding a movement key or the Advance and Withdraw buttons (educator feedback, 2026-10-13).
 *
 * A press is one whole step, as before. A hold then repeats in fine increments at a steady rate, so
 * the view glides along the airway and a turn can be stopped where the learner wants it, instead of
 * arriving a step at a time. Presentation of the same commands: nothing here is a new control.
 */
export const HELD_INTERVAL_MS = 50
export const HELD_STEP_MM = 1
export const HELD_TURN_DEG = 2
/** How long a button is pressed before the press counts as a hold. */
export const HOLD_DELAY_MS = 260
/** How long after a hold's release its own click may still arrive. */
export const HOLD_RELEASE_MS = 400

/** The fine increment a held movement key sends, in the direction of its first press. */
export function heldKeyCommand(command: ScopeCommand): ScopeCommand {
  switch (command.type) {
    case 'advance':
      return { type: 'advance', mm: Math.sign(command.mm) * HELD_STEP_MM }
    case 'rotate':
      return { type: 'rotate', deg: Math.sign(command.deg) * HELD_TURN_DEG }
    case 'deflect':
      return { type: 'deflect', deg: Math.sign(command.deg) * HELD_TURN_DEG }
    default:
      return command
  }
}

const KEY_WORDS: readonly (readonly [ScopeControlKey, string])[] = [
  ['advance', 'W advances'],
  ['withdraw', 'S withdraws'],
  ['rotate', 'A and D rotate'],
  ['deflect', 'the up and down arrows deflect'],
  ['suction', 'Space turns suction on or off'],
  ['recenter', 'R recenters'],
  ['teleportStart', 'Home goes back to the start'],
  ['branchLabels', 'L turns the in-view labels on or off'],
  ['capture', 'C captures an image'],
  ['acknowledge', 'K acknowledges the assistant'],
]

/**
 * The keys this step answers to, said beside the controls (fellow walkthrough SUP-09).
 *
 * Built from `SCOPE_KEY_MAP` and the step's own controls, so it never names a key the pane would
 * ignore. Holding a movement key repeats it and pressing and holding Advance or Withdraw keeps the
 * scope moving, both in the fine increments above; this only says so.
 */
export function scopeKeyboardHint(controls: readonly ScopeControlKey[]): string | null {
  const parts = KEY_WORDS.filter(
    ([key, words]) =>
      controls.includes(key) && Object.values(SCOPE_KEY_MAP).includes(key) && words.length > 0,
  ).map(([, words]) => words)
  if (parts.length === 0) return null
  const moving = controls.filter((key) =>
    ['advance', 'withdraw', 'rotate', 'deflect'].includes(key),
  )
  const held = moving.length > 0 ? ' Hold a movement key to keep moving.' : ''
  const pressAndHold =
    controls.includes('advance') || controls.includes('withdraw')
      ? ' With a mouse or finger, press and hold Advance or Withdraw.'
      : ''
  return `Keyboard, once the scope view is selected (click it or Tab to it): ${parts.join('; ')}.${held}${pressAndHold}`
}
