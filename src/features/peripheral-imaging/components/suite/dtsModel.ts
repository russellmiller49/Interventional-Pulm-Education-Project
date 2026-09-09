/** Parallel teaching projections are distinct from the cone-geometry orientation arc. */
import { DTS } from '../../lib/tomosynthesis'
import { DEFAULT_GEOMETRY, dtsShift, LESION_CENTER, type Point3 } from '../../lib/physics'
import { add, suiteFrame } from './suiteModel'
export function dtsArc(sweep: number, geometry = DEFAULT_GEOMETRY) {
  return Array.from({ length: DTS.viewsPerSweep }, (_, i) => {
    const angle = -sweep / 2 + (sweep * i) / (DTS.viewsPerSweep - 1)
    return { angle, source: suiteFrame(angle, 0, geometry).source }
  })
}
export function dtsPlaneQuad(depth: number): Point3[] {
  return [
    [-70, -70],
    [70, -70],
    [70, 70],
    [-70, 70],
  ].map(([x, z]) => add(LESION_CENTER, [x - 20, depth, z]))
}
export function smearWidth(objectDepth: number, planeDepth: number, sweep: number) {
  return Math.abs(
    dtsShift(objectDepth, planeDepth, sweep / 2) - dtsShift(objectDepth, planeDepth, -sweep / 2),
  )
}
export function missingWedge(sweep: number) {
  return [
    [sweep / 2, 180 - sweep / 2],
    [180 + sweep / 2, 360 - sweep / 2],
  ] as const
}
