import type { CtTrace } from '../content/ct-types'
import { edgeRadiusMm } from './astray'
import { pairedPath } from './paired-scope'

/**
 * How wide the airway is where the scope stands, read from the source graph's radius for each
 * airway of the route. The scope's picture uses it to set how fast its light falls off: a light
 * that reaches the far wall of the trachea would flood a 2 mm airway to one even tone.
 */
const FALLBACK_RADIUS_MM = 1.5

/** The radius of the airway the route is in at an arc length. */
function radiusAt(trace: CtTrace, arc: number): number {
  const { arcs, segmentEdges } = pairedPath(trace)
  const last = arcs[arcs.length - 1]
  const at = Math.max(0, Math.min(last, arc))
  let i = arcs.findIndex((value) => value >= at)
  if (i < 0) i = arcs.length - 1
  return edgeRadiusMm(segmentEdges[i]) ?? FALLBACK_RADIUS_MM
}

/**
 * The airway's radius round the scope tip, smoothed over a short stretch behind and ahead, so the
 * picture's light does not step as the scope crosses from one airway into the next.
 */
export function routeRadiusMm(trace: CtTrace, arc: number): number {
  const samples = [-4, 0, 4, 8, 12].map((offset) => radiusAt(trace, arc + offset))
  return samples.reduce((sum, value) => sum + value, 0) / samples.length
}

/**
 * Reach per millimetre of radius. The source graph gives the trachea of this CT a radius of about
 * 6 mm, and 3.8 puts the trachea and main bronchi at the shared reach.
 */
const REACH_PER_RADIUS = 3.8
/** The widest and narrowest the light's reach is set to, in millimetres. */
export const FALLOFF_MM = { far: 23, near: 5 } as const
/**
 * How far the scope's light reaches for an airway of this radius. In the trachea and main bronchi
 * it is the reach the shared mucosa shader has always used (23 mm); it shortens with the airway,
 * so in a subsegmental airway the lumen ahead falls dark and the wall beside the lens stays lit.
 */
export function falloffMmFor(radiusMm: number): number {
  return Math.max(FALLOFF_MM.near, Math.min(FALLOFF_MM.far, radiusMm * REACH_PER_RADIUS))
}
