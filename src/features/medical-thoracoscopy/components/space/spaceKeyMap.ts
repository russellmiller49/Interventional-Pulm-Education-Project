import type { SpaceCommand } from './types'

/**
 * The space pane's keys, as data, so the pane, its help panel and the tests read one table and a key
 * means one thing. The arrows move the hand on the eyepiece: right and left toward the patient's head
 * and feet, which is right and left in the Chest view; up and down toward the front and the back.
 * W and S take the telescope in and out, Q and E turn it, N steps a waiting model on under reduced
 * motion, and ? shows or hides this table. Where the forceps are in the channel (slice 13), F puts
 * them out and B brings them back in.
 *
 * The keys act only while the pane has focus, so the arrows and the space bar still scroll the page
 * everywhere else.
 */
export type SpaceKeyAction = SpaceCommand | { readonly kind: 'help' }

const pivot = (hand: 'head' | 'feet' | 'front' | 'back'): SpaceCommand => ({ kind: 'pivot', hand })
const depth = (direction: 'in' | 'out'): SpaceCommand => ({ kind: 'depth', direction })
const roll = (direction: 'clockwise' | 'anticlockwise'): SpaceCommand => ({
  kind: 'roll',
  direction,
})
const tool = (direction: 'extend' | 'retract'): SpaceCommand => ({ kind: 'tool', direction })

export const SPACE_KEY_MAP: Readonly<Record<string, SpaceKeyAction>> = {
  ArrowRight: pivot('head'),
  ArrowLeft: pivot('feet'),
  ArrowUp: pivot('front'),
  ArrowDown: pivot('back'),
  w: depth('in'),
  W: depth('in'),
  s: depth('out'),
  S: depth('out'),
  e: roll('clockwise'),
  E: roll('clockwise'),
  q: roll('anticlockwise'),
  Q: roll('anticlockwise'),
  n: { kind: 'step-clock' },
  N: { kind: 'step-clock' },
  f: tool('extend'),
  F: tool('extend'),
  b: tool('retract'),
  B: tool('retract'),
  '?': { kind: 'help' },
}

export function spaceKeyAction(key: string): SpaceKeyAction | null {
  return Object.prototype.hasOwnProperty.call(SPACE_KEY_MAP, key) ? SPACE_KEY_MAP[key] : null
}

/** The rows of the help panel: the key as printed, and what it does. */
export const SPACE_KEY_HELP: readonly { readonly keys: string; readonly key: string }[] = [
  { keys: 'Right arrow', key: 'ArrowRight' },
  { keys: 'Left arrow', key: 'ArrowLeft' },
  { keys: 'Up arrow', key: 'ArrowUp' },
  { keys: 'Down arrow', key: 'ArrowDown' },
  { keys: 'W', key: 'w' },
  { keys: 'S', key: 's' },
  { keys: 'E', key: 'e' },
  { keys: 'Q', key: 'q' },
  { keys: 'N', key: 'n' },
  { keys: 'F', key: 'f' },
  { keys: 'B', key: 'b' },
  { keys: '?', key: '?' },
]
