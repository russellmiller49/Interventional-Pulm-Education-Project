import {
  projectOptical,
  type LumenCollider,
  type OpticalFrame,
} from '@/lib/bronchoscopy-core/frame'
import type { Vec3 } from '@/lib/airway-anatomy/types'

import type { AirwayLabel, OstiumPin } from '../../components/scope/types'
import { airwayDisplayName, labelAncestry } from '../../content/airwayTree'
import type { ScopeCase } from './scopeCase'
import { DISTAL_VIEW_MM } from './scopeScripts'

/**
 * The openings ahead of the tip, and which of them the optical field holds.
 *
 * From the tip, the tree is walked forward through unlabelled connectors and continuations of the
 * current airway until the next labelled airway begins; each such airway contributes one pin at
 * its opening. "In view" means inside the round optical field — the circle inscribed in the nominal
 * 4:3, 88° frame, as a bronchoscope's image is round — near enough to be seen, and, when the lumen
 * is loaded, not hidden behind a wall. Labels come from the graph position only, and the field is
 * round, so rolling the scope moves a pin around the image but never changes what it names or
 * whether it is in view (A06/A28).
 */

export const OPTICAL_ASPECT = 4 / 3
export const OPTICAL_FOV_DEG = 88
/** How far along the tree beyond the tip an opening is pinned. */
export const OSTIUM_LOOKAHEAD_MM = 45
/** Beyond this distance an opening in the field is too far away to count as seen. */
export const OSTIUM_VISIBLE_RANGE_MM = 60

export function pointInOpticalField(
  point: Vec3,
  frame: OpticalFrame,
  collider: LumenCollider | null,
): boolean {
  const projected = projectOptical(point, frame, OPTICAL_ASPECT, OPTICAL_FOV_DEG)
  if (!projected || projected.depth > OSTIUM_VISIBLE_RANGE_MM) return false
  // (x · aspect, y) is the image plane in units of the frame's half-height: radius 1 is the circle.
  if (Math.hypot(projected.x * OPTICAL_ASPECT, projected.y) >= 1) return false
  return collider ? collider.visible(frame.position, point) : true
}

export function upcomingOstia(
  scopeCase: ScopeCase,
  edgeId: number,
  distanceMm: number,
  frame: OpticalFrame,
): readonly OstiumPin[] {
  const edge = scopeCase.index.edgesById.get(edgeId)
  if (!edge) return []
  const currentLabel = scopeCase.labelAt(edgeId)
  const pins: OstiumPin[] = []
  const visit = (nodeId: number, travelledMm: number) => {
    if (travelledMm > OSTIUM_LOOKAHEAD_MM) return
    const node = scopeCase.index.nodesById.get(nodeId)
    for (const childId of node?.childEdgeIds ?? []) {
      const child = scopeCase.index.edgesById.get(childId)
      if (!child) continue
      const own = scopeCase.ownLabel.get(childId) ?? null
      if (own && own !== currentLabel && scopeCase.originEdge.get(own) === childId) {
        const point = scopeCase.ostiumPoint.get(own)
        if (!point) continue
        pins.push({
          label: own,
          fullLabel: airwayDisplayName(own),
          edgeId: childId,
          pointLps: point,
          inView: pointInOpticalField(point, frame, scopeCase.collider),
        })
      } else {
        visit(child.endNodeId, travelledMm + child.lengthMm)
      }
    }
  }
  visit(edge.endNodeId, Math.max(0, edge.lengthMm - distanceMm))
  return pins
}

/**
 * Airways the tip has gone far enough inside to see beyond their opening: every airway on its
 * path whose first segment it is at least `DISTAL_VIEW_MM` (or half that segment) beyond.
 */
export function distalViewAirways(
  scopeCase: ScopeCase,
  edgeId: number,
  distanceMm: number,
): ReadonlySet<AirwayLabel> {
  const label = scopeCase.labelAt(edgeId)
  const result = new Set<AirwayLabel>()
  if (!label) return result
  const tipDepth = (scopeCase.edgeStartDepthMm.get(edgeId) ?? 0) + distanceMm
  for (const airway of labelAncestry(label)) {
    const origin = scopeCase.originEdge.get(airway)
    if (origin === undefined) continue
    const originEdge = scopeCase.index.edgesById.get(origin)
    if (!originEdge) continue
    const into = tipDepth - (scopeCase.edgeStartDepthMm.get(origin) ?? 0)
    if (into >= Math.min(DISTAL_VIEW_MM, originEdge.lengthMm * 0.5)) result.add(airway)
  }
  return result
}
