import { LESION_CENTER } from '../lib/physics'
import {
  airwayAlongBeam,
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
} as const

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
