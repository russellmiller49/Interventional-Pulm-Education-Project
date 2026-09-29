import { portCandidates, portRecord } from '../../content/anatomy'
import { cross, dot, normalize, scale, sub, type Vec3 } from './vec'

/**
 * The port the telescope turns about, from the port record (owner decisions, T6: a default, not a
 * decision): the pivot at the level of the ribs, the corridor axis into the chest, the direction
 * across the ribs (from the lower rib toward the upper) and the one along them, the disc of chest
 * wall the shaft may cross, where the pleura is, and the gap between the ribs and how deep they are.
 */
export interface PortFrame {
  readonly pivot: Vec3
  /** Into the chest. */
  readonly inward: Vec3
  /** Across the ribs, from the lower rib toward the upper: toward the head. */
  readonly acrossRibs: Vec3
  /** Along the ribs; completes a right-handed frame with the other two. */
  readonly alongRibs: Vec3
  readonly pleura: Vec3
  /** How far in along the corridor the pleura lies from the pivot. */
  readonly pleuraDepthMm: number
  readonly patchRadiusMm: number
  readonly ribGapMm: number
  /** How deep the deeper of the two ribs is along the corridor, measured on the scan. */
  readonly ribDepthMm: number
}

export function portFrame(): PortFrame {
  const row = portCandidates.rows.find(
    (entry) =>
      entry.space === portRecord.space &&
      entry.line === portRecord.line &&
      entry.status === 'measured',
  )
  if (!row || row.status !== 'measured') throw new Error('The port record has no measured row')
  const inward = normalize(portRecord.corridorAxis)
  const ribward = sub(row.upperRibPointLps, row.lowerRibPointLps)
  const acrossRibs = normalize(sub(ribward, scale(inward, dot(ribward, inward))))
  const alongRibs = normalize(cross(inward, acrossRibs))
  const pleuraDepthMm = dot(sub(portRecord.pleuraPointLps, portRecord.pivotLps), inward)
  return {
    pivot: portRecord.pivotLps,
    inward,
    acrossRibs,
    alongRibs,
    pleura: portRecord.pleuraPointLps,
    pleuraDepthMm,
    patchRadiusMm: portRecord.wallPatch.radiusMm,
    ribGapMm: portRecord.ribGapMm,
    ribDepthMm: portRecord.ribDepthMm,
  }
}
