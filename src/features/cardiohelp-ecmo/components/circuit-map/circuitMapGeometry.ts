import type { SupportMode } from '../../engine/types'

/**
 * Where everything sits on the pressure-zone map, in the map's own units.
 *
 * The map is drawn in `CircuitAndMonitors.tsx` inside a 1120 × 590 viewBox. Until this file existed
 * its path strings lived as literals inside the drawing, which was fine while the drawing was the
 * only thing that needed them. The emphasis layer needs them too — it draws a halo along the very
 * same limb the drawing draws — and a second copy of a path string is a second opinion about where
 * the limb is. So the coordinates that two things read live here, and both read them.
 *
 * Pure. No React, no engine values beyond the support mode, which is the only thing that moves a
 * line: the return cannula sits in a different vessel on VA, and the return limb ends at a
 * different port because of it.
 */

export const CIRCUIT_MAP_VIEWBOX = Object.freeze({ x: 0, y: 0, width: 1120, height: 590 })

/**
 * The three ways the map can be framed.
 *
 * `whole` is the drawing as authored: the patient on the left, the circuit on the right. `circuit`
 * frames the extracorporeal panel alone, which is where every limb, the pump, the membrane and the
 * sensor flags live. `follow` frames whatever is being marked: the smallest window of a fixed shape
 * that holds the marked places with room around them, never tighter than a minimum window and never
 * outside the drawing — so a walk that stands at the pump shows the pump at a size a learner can
 * read, and a stop that spans the whole return path shows the whole return path.
 *
 * The poster was drawn for a thousand pixels of width. On the lesson stage it gets about half that,
 * which is why `follow` exists: fitting the whole drawing to the pane makes every label five pixels
 * tall, and scrolling it sideways hides the half the lesson is not standing in. A window that moves
 * with the marking keeps the type at the size it was drawn for.
 */
export type CircuitMapFrame = 'whole' | 'circuit' | 'follow'

export interface CircuitMapRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const CIRCUIT_MAP_FRAME_RECT: Readonly<Record<'whole' | 'circuit', CircuitMapRect>> =
  Object.freeze({
    whole: { x: 0, y: 0, width: 1120, height: 590 },
    // The circuit backdrop is x 330–1102, y 22–522, with the return-limb label below it at y 568.
    circuit: { x: 318, y: 10, width: 796, height: 572 },
  })

export const CIRCUIT_MAP_FRAME_VIEWBOX: Readonly<Record<'whole' | 'circuit', string>> =
  Object.freeze({
    whole: viewBoxString(CIRCUIT_MAP_FRAME_RECT.whole),
    circuit: viewBoxString(CIRCUIT_MAP_FRAME_RECT.circuit),
  })

export function viewBoxString(rect: CircuitMapRect): string {
  const round = (value: number) => Math.round(value * 10) / 10
  return `${round(rect.x)} ${round(rect.y)} ${round(rect.width)} ${round(rect.height)}`
}

/**
 * The following window: the same shape every time, so the map's box on the page keeps one height
 * as the window moves and nothing below it reflows between stops; never smaller than a window in
 * which the smallest marked thing — the pump — is still surrounded by the limbs that feed it.
 *
 * A marking wider than the drawing can be framed at this shape is framed at the drawing's full
 * width with the window taller than the drawing: the map letterboxes rather than changing shape.
 * The first version clamped both dimensions to the drawing instead, and the box's height changed
 * by a fifth of its width between the membrane stop and the return stop — the whole pane below the
 * map moved while the pan was still running.
 */
export const FOLLOW_ASPECT = 4 / 3
const FOLLOW_MIN_WIDTH = 520
const FOLLOW_PADDING = 44

export function circuitMapFollowRect(bounds: readonly CircuitMapRect[]): CircuitMapRect {
  const whole = CIRCUIT_MAP_FRAME_RECT.whole
  if (bounds.length === 0) return whole
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const b of bounds) {
    left = Math.min(left, b.x)
    top = Math.min(top, b.y)
    right = Math.max(right, b.x + b.width)
    bottom = Math.max(bottom, b.y + b.height)
  }
  left -= FOLLOW_PADDING
  top -= FOLLOW_PADDING
  right += FOLLOW_PADDING
  bottom += FOLLOW_PADDING

  // Grow to the fixed shape, and to the minimum, about the centre of what is marked.
  let width = Math.max(right - left, FOLLOW_MIN_WIDTH)
  let height = Math.max(bottom - top, FOLLOW_MIN_WIDTH / FOLLOW_ASPECT)
  if (width / height > FOLLOW_ASPECT) height = width / FOLLOW_ASPECT
  else width = height * FOLLOW_ASPECT
  // Never wider than the drawing; the height follows the shape, past the drawing if it must.
  if (width > whole.width) {
    width = whole.width
    height = width / FOLLOW_ASPECT
  }
  const centreX = (left + right) / 2
  const centreY = (top + bottom) / 2
  const x = Math.min(Math.max(centreX - width / 2, whole.x), whole.x + whole.width - width)
  const y =
    height >= whole.height
      ? whole.y + (whole.height - height) / 2
      : Math.min(Math.max(centreY - height / 2, whole.y), whole.y + whole.height - height)
  return { x, y, width, height }
}

export interface CircuitMapGeometry {
  readonly returnPortX: number
  readonly drainageCannula: string
  readonly drainageLimb: string
  readonly postPumpLimb: string
  readonly membraneBloodPath: string
  /** From the membrane outlet to the return port, in one path — the drawing's return limb. */
  readonly returnLimb: string
  /** The run after the membrane, where the return-side readings are taken, up to the corner. */
  readonly postMembraneRun: string
  /** The rest of the return limb: round the corner, down, back along the bottom, up to the port. */
  readonly returnRun: string
  readonly returnCannula: string
  readonly membraneGasPath: string
  readonly pump: { readonly cx: number; readonly cy: number; readonly r: number }
  readonly oxygenator: {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
  }
  readonly accessPoint: { readonly cx: number; readonly cy: number }
}

export function circuitMapGeometry(supportMode: SupportMode): CircuitMapGeometry {
  const isVa = supportMode === 'va'
  const returnPortX = isVa ? 244 : 214
  return {
    returnPortX,
    drainageCannula: 'M146 245 C132 295 110 366 96 447',
    drainageLimb: 'M96 447 C215 467 293 385 405 385',
    postPumpLimb: 'M486 346 Q512 346 526 364 Q536 377 552 385 H700',
    membraneBloodPath: 'M700 385 H825',
    returnLimb: `M825 385 H1000 Q1042 385 1042 427 V512 Q1042 540 1014 540 H${
      returnPortX + 28
    } Q${returnPortX} 540 ${returnPortX} 512 V455`,
    // The seam between the two is the corner after the run, a feature the drawing actually has.
    postMembraneRun: 'M825 385 H1000',
    returnRun: `M1000 385 Q1042 385 1042 427 V512 Q1042 540 1014 540 H${returnPortX + 28} Q${returnPortX} 540 ${returnPortX} 512 V455`,
    returnCannula: isVa
      ? 'M244 447 C226 411 207 379 197 335 C195 299 194 247 193 213'
      : 'M214 447 C199 384 181 291 170 185',
    membraneGasPath: 'M762 462 V310',
    pump: { cx: 455, cy: 385, r: 53 },
    oxygenator: { x: 700, y: 292, width: 125, height: 186 },
    accessPoint: { cx: 650, cy: 385 },
  }
}
