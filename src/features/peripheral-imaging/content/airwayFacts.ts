import { LESION_CENTER } from '../lib/physics'
import {
  LESION_AIRWAYS,
  airwayAlongBeam,
  airwayDepthAtLesion,
  airwayOrigin,
  airwayRouteKeys,
  airwayStem,
  nearestAirway,
  polylineLength,
} from '../lib/airwayTree'
import { AIRWAY_BRANCHES, type AirwayBranchKey } from './airwayNames'

/**
 * What the copy says about the bronchi of the course CT, read from the tree itself.
 *
 * Nothing here is typed in: every length, share and route is computed from
 * `public/peripheral-imaging/anatomy/airway-tree.json`, and the model-truth tests hold the
 * sentences that use them to the ranges those sentences claim. They describe one patient's CT.
 */
const nearest = nearestAirway(LESION_CENTER)

export const AIRWAY_FACTS = {
  rightMainMm: Math.round(polylineLength(airwayStem('RMB', Infinity))),
  leftMainMm: Math.round(polylineLength(airwayStem('LMB', Infinity))),
  /** The height between where the middle lobe bronchus and RB6 arise. */
  middleLobeAboveSuperiorMm: Math.round(
    Math.abs(airwayOrigin('RML-bronchus').points[0][2] - airwayOrigin('RB6').points[0][2]),
  ),
  /** The bronchus whose centreline passes closest to the course nodule, and the way to it. */
  noduleBronchus: nearest.branch.key,
  noduleBronchusMm: Math.round(nearest.distanceMm),
  noduleRoute: airwayRouteKeys(nearest.branch),
  /**
   * The segmental bronchi that cross the nodule's outline on the frontal image, front to back, with
   * how far in front of the nodule's centre (positive) or behind it (negative) each one lies there.
   */
  overNodule: LESION_AIRWAYS.map((key) => ({
    key,
    depthMm: Math.round(airwayDepthAtLesion(key)!),
  })),
} as const

/** How far a bronchus lies in front of or behind the nodule where it crosses it, in whole centimetres. */
export function overNoduleCm(key: AirwayBranchKey): number {
  const entry = AIRWAY_FACTS.overNodule.find((bronchus) => bronchus.key === key)
  if (!entry) throw new Error(`${key} does not cross the nodule on the frontal image.`)
  return Math.round(Math.abs(entry.depthMm) / 10)
}

/** The depth, front to back, that the bronchi over the nodule span, in whole centimetres. */
export const overNoduleSpanCm = Math.round(
  (Math.max(...AIRWAY_FACTS.overNodule.map((bronchus) => bronchus.depthMm)) -
    Math.min(...AIRWAY_FACTS.overNodule.map((bronchus) => bronchus.depthMm))) /
    10,
)

/** The share of a bronchus's first two centimetres that runs along the frontal beam, in percent. */
export const frontalBeamShare = (key: AirwayBranchKey): number =>
  Math.round(airwayAlongBeam(key, 0, 0) * 100)

/** "trachea, left main bronchus, left lower lobe bronchus, LB7+8": a route in running text. */
export function airwayRouteText(keys: readonly AirwayBranchKey[]): string {
  return keys
    .map((key) =>
      AIRWAY_BRANCHES[key].level === 'segment'
        ? AIRWAY_BRANCHES[key].short
        : AIRWAY_BRANCHES[key].name.toLowerCase(),
    )
    .join(', ')
}
