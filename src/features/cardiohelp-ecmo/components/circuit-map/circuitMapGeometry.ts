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
 * The two ways the map can be framed.
 *
 * `whole` is the drawing as authored: the patient on the left, the circuit on the right. It is
 * what the lesson stage shows, marked or not — the walk is a "you are here" on the whole path, and
 * a learner who wants the drawing larger widens the pane and gets all of it larger. `circuit`
 * frames the extracorporeal panel alone and is kept for a host that asks for it.
 *
 * A first version panned a window across the drawing to follow the marked place, to keep the type
 * legible in a narrow pane. The owner's verdict on it: "I can't see the whole animation, and
 * resizing the panel just makes the part I can see bigger." The window is gone; the pane is the
 * zoom.
 */
export type CircuitMapFrame = 'whole' | 'circuit'

export interface CircuitMapRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export const CIRCUIT_MAP_FRAME_RECT: Readonly<Record<CircuitMapFrame, CircuitMapRect>> =
  Object.freeze({
    whole: { x: 0, y: 0, width: 1120, height: 590 },
    // The circuit backdrop is x 330–1102, y 22–522, with the return-limb label below it at y 568.
    circuit: { x: 318, y: 10, width: 796, height: 572 },
  })

export const CIRCUIT_MAP_FRAME_VIEWBOX: Readonly<Record<CircuitMapFrame, string>> = Object.freeze({
  whole: viewBoxString(CIRCUIT_MAP_FRAME_RECT.whole),
  circuit: viewBoxString(CIRCUIT_MAP_FRAME_RECT.circuit),
})

export function viewBoxString(rect: CircuitMapRect): string {
  const round = (value: number) => Math.round(value * 10) / 10
  return `${round(rect.x)} ${round(rect.y)} ${round(rect.width)} ${round(rect.height)}`
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
