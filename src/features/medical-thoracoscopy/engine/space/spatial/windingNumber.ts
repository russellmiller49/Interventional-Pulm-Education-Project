import type { Vec3 } from '../vec'
import type { TriangleMesh } from './proxyGlb'

/**
 * How many times a closed, outward surface winds around a point: 1 inside, 0 outside, from the
 * solid angle each triangle subtends (van Oosterom and Strackee). No ray is cast, so no parity can
 * be fooled by a ray that grazes an edge. Used only to classify where a pose starts; after that, an
 * instrument that never comes within its clearance of a surface never changes side.
 */
export function windingNumber(point: Vec3, mesh: TriangleMesh): number {
  const { positions, indices } = mesh
  let total = 0
  for (let f = 0; f < indices.length; f += 3) {
    const ia = indices[f] * 3
    const ib = indices[f + 1] * 3
    const ic = indices[f + 2] * 3
    const ax = positions[ia] - point[0]
    const ay = positions[ia + 1] - point[1]
    const az = positions[ia + 2] - point[2]
    const bx = positions[ib] - point[0]
    const by = positions[ib + 1] - point[1]
    const bz = positions[ib + 2] - point[2]
    const cx = positions[ic] - point[0]
    const cy = positions[ic + 1] - point[1]
    const cz = positions[ic + 2] - point[2]
    const la = Math.hypot(ax, ay, az)
    const lb = Math.hypot(bx, by, bz)
    const lc = Math.hypot(cx, cy, cz)
    const numerator = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
    const denominator =
      la * lb * lc +
      (ax * bx + ay * by + az * bz) * lc +
      (bx * cx + by * cy + bz * cz) * la +
      (cx * ax + cy * ay + cz * az) * lb
    total += 2 * Math.atan2(numerator, denominator)
  }
  return total / (4 * Math.PI)
}

export function isInside(point: Vec3, mesh: TriangleMesh): boolean {
  return windingNumber(point, mesh) > 0.5
}
