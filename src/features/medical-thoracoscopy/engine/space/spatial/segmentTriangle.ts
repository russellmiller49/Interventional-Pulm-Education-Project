import { add, cross, dot, lerp, scale, sub, type Vec3 } from '../vec'

/**
 * Exact distances between segments, triangles and boxes, written here because the installed
 * `three-mesh-bvh` (0.8.3) gets one wrong: its segment-to-triangle distance reports 4.47 mm for a
 * segment that passes straight through a triangle (plan, section 1, finding 2). Everything is
 * closed-form; nothing samples.
 *
 * A segment and a triangle that do not cross are closest either at an end of the segment and a
 * point of the triangle, or at a point of the segment and a point of one of the triangle's edges;
 * crossing, they are at distance zero.
 */

const EPS = 1e-12

/** The point of triangle abc closest to p (Ericson, Real-Time Collision Detection, 5.1.5). */
export function closestPointOnTriangle(p: Vec3, a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ab = sub(b, a)
  const ac = sub(c, a)
  const ap = sub(p, a)
  const d1 = dot(ab, ap)
  const d2 = dot(ac, ap)
  if (d1 <= 0 && d2 <= 0) return a
  const bp = sub(p, b)
  const d3 = dot(ab, bp)
  const d4 = dot(ac, bp)
  if (d3 >= 0 && d4 <= d3) return b
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const denominator = d1 - d3
    return add(a, scale(ab, denominator > EPS ? d1 / denominator : 0))
  }
  const cp = sub(p, c)
  const d5 = dot(ab, cp)
  const d6 = dot(ac, cp)
  if (d6 >= 0 && d5 <= d6) return c
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const denominator = d2 - d6
    return add(a, scale(ac, denominator > EPS ? d2 / denominator : 0))
  }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const denominator = d4 - d3 + (d5 - d6)
    return add(b, scale(sub(c, b), denominator > EPS ? (d4 - d3) / denominator : 0))
  }
  const denominator = va + vb + vc
  if (Math.abs(denominator) < EPS) return a
  return add(a, add(scale(ab, vb / denominator), scale(ac, vc / denominator)))
}

/** The closest points of segments p0p1 and q0q1, and the distance between them (Ericson 5.1.9). */
export function segmentSegment(
  p0: Vec3,
  p1: Vec3,
  q0: Vec3,
  q1: Vec3,
): {
  readonly distance: number
  readonly onFirst: Vec3
  readonly onSecond: Vec3
} {
  const d1 = sub(p1, p0)
  const d2 = sub(q1, q0)
  const r = sub(p0, q0)
  const a = dot(d1, d1)
  const e = dot(d2, d2)
  const f = dot(d2, r)
  let s: number
  let t: number
  if (a <= EPS && e <= EPS) {
    s = 0
    t = 0
  } else if (a <= EPS) {
    s = 0
    t = clamp01(f / e)
  } else {
    const c = dot(d1, r)
    if (e <= EPS) {
      t = 0
      s = clamp01(-c / a)
    } else {
      const b = dot(d1, d2)
      const denominator = a * e - b * b
      s = denominator > EPS ? clamp01((b * f - c * e) / denominator) : 0
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = clamp01(-c / a)
      } else if (t > 1) {
        t = 1
        s = clamp01((b - c) / a)
      }
    }
  }
  const onFirst = lerp(p0, p1, s)
  const onSecond = lerp(q0, q1, t)
  const gap = sub(onFirst, onSecond)
  return { distance: Math.sqrt(dot(gap, gap)), onFirst, onSecond }
}

/** Whether segment p0p1 meets triangle abc, edges and ends included. */
export function segmentCrossesTriangle(p0: Vec3, p1: Vec3, a: Vec3, b: Vec3, c: Vec3): boolean {
  const n = cross(sub(b, a), sub(c, a))
  const s0 = dot(n, sub(p0, a))
  const s1 = dot(n, sub(p1, a))
  if ((s0 > 0 && s1 > 0) || (s0 < 0 && s1 < 0)) return false
  if (s0 === s1) return false // parallel to the plane (or in it): the edge tests below decide
  const hit = lerp(p0, p1, s0 / (s0 - s1))
  // inside the triangle, by the signs of the three sub-areas
  const c0 = dot(n, cross(sub(b, a), sub(hit, a)))
  const c1 = dot(n, cross(sub(c, b), sub(hit, b)))
  const c2 = dot(n, cross(sub(a, c), sub(hit, c)))
  return (c0 >= 0 && c1 >= 0 && c2 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0)
}

/** The exact distance between segment p0p1 and triangle abc. */
export function segmentTriangleDistance(p0: Vec3, p1: Vec3, a: Vec3, b: Vec3, c: Vec3): number {
  if (segmentCrossesTriangle(p0, p1, a, b, c)) return 0
  let best = Infinity
  for (const p of [p0, p1]) {
    const q = closestPointOnTriangle(p, a, b, c)
    const gap = sub(p, q)
    best = Math.min(best, Math.sqrt(dot(gap, gap)))
  }
  for (const [u, v] of [
    [a, b],
    [b, c],
    [c, a],
  ] as const) {
    best = Math.min(best, segmentSegment(p0, p1, u, v).distance)
  }
  return best
}

/** The exact distance from segment p0p1 to the box [min, max]; zero if the segment enters it. */
export function segmentBoxDistance(p0: Vec3, p1: Vec3, min: Vec3, max: Vec3): number {
  // The slab test: does the segment enter the box?
  let t0 = 0
  let t1 = 1
  let crosses = true
  for (let axis = 0; axis < 3; axis += 1) {
    const d = p1[axis] - p0[axis]
    if (Math.abs(d) < EPS) {
      if (p0[axis] < min[axis] || p0[axis] > max[axis]) {
        crosses = false
        break
      }
    } else {
      let near = (min[axis] - p0[axis]) / d
      let far = (max[axis] - p0[axis]) / d
      if (near > far) [near, far] = [far, near]
      t0 = Math.max(t0, near)
      t1 = Math.min(t1, far)
      if (t0 > t1) {
        crosses = false
        break
      }
    }
  }
  if (crosses) return 0
  let best = Math.min(pointBoxDistance(p0, min, max), pointBoxDistance(p1, min, max))
  const corner = (i: number): Vec3 => [
    i & 1 ? max[0] : min[0],
    i & 2 ? max[1] : min[1],
    i & 4 ? max[2] : min[2],
  ]
  for (let i = 0; i < 8; i += 1) {
    for (const bit of [1, 2, 4]) {
      if (i & bit) continue
      best = Math.min(best, segmentSegment(p0, p1, corner(i), corner(i | bit)).distance)
    }
  }
  return best
}

/**
 * A lower bound on the distance from segment p0p1 to the box, cheap enough to order and prune a
 * BVH's boxes by: zero if the segment enters the box, else the larger of the gap between the
 * segment's own bounding box and this one, and the distance to the box's centre less its half
 * diagonal. Either is never more than the true distance, so pruning by it never skips the nearest
 * triangle; the distances to triangles stay exact.
 */
export function segmentBoxLowerBound(
  p0: Vec3,
  p1: Vec3,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): number {
  // the slab test
  let t0 = 0
  let t1 = 1
  let enters = true
  const mins = [minX, minY, minZ]
  const maxs = [maxX, maxY, maxZ]
  for (let axis = 0; axis < 3 && enters; axis += 1) {
    const d = p1[axis] - p0[axis]
    if (Math.abs(d) < EPS) {
      if (p0[axis] < mins[axis] || p0[axis] > maxs[axis]) enters = false
    } else {
      let near = (mins[axis] - p0[axis]) / d
      let far = (maxs[axis] - p0[axis]) / d
      if (near > far) [near, far] = [far, near]
      if (near > t0) t0 = near
      if (far < t1) t1 = far
      if (t0 > t1) enters = false
    }
  }
  if (enters) return 0
  let gap = 0
  for (let axis = 0; axis < 3; axis += 1) {
    const lo = Math.min(p0[axis], p1[axis])
    const hi = Math.max(p0[axis], p1[axis])
    const g = Math.max(0, mins[axis] - hi, lo - maxs[axis])
    gap += g * g
  }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const cz = (minZ + maxZ) / 2
  const half = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const dz = p1[2] - p0[2]
  const length2 = dx * dx + dy * dy + dz * dz
  let t = length2 > EPS ? ((cx - p0[0]) * dx + (cy - p0[1]) * dy + (cz - p0[2]) * dz) / length2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const toCentre = Math.hypot(p0[0] + t * dx - cx, p0[1] + t * dy - cy, p0[2] + t * dz - cz)
  return Math.max(Math.sqrt(gap), toCentre - half, 0)
}

export function pointBoxDistance(p: Vec3, min: Vec3, max: Vec3): number {
  let sum = 0
  for (let axis = 0; axis < 3; axis += 1) {
    const excess = Math.max(min[axis] - p[axis], 0, p[axis] - max[axis])
    sum += excess * excess
  }
  return Math.sqrt(sum)
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
