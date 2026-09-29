import type { TriangleMesh } from '../engine/space/spatial/proxyGlb'

/**
 * Analytic scenes for the space engine's tests (plan, section 7): a sphere, a box, a half-space, a
 * thin plate and a segment of a torus, each a closed, outward triangle mesh; a seeded random number
 * generator; and a brute-force judge of distance that shares no code with the collider.
 */

type Point = [number, number, number]
type ReadPoint = readonly [number, number, number]

function mesh(points: Point[], faces: [number, number, number][]): TriangleMesh {
  return { positions: Float32Array.from(points.flat()), indices: Uint32Array.from(faces.flat()) }
}

/** A UV sphere of the given radius about the centre, outward. */
export function sphereMesh(
  radius: number,
  centre: Point = [0, 0, 0],
  rings = 24,
  segments = 48,
): TriangleMesh {
  const points: Point[] = [[centre[0], centre[1], centre[2] + radius]]
  for (let r = 1; r < rings; r += 1) {
    const theta = (Math.PI * r) / rings
    for (let s = 0; s < segments; s += 1) {
      const phi = (2 * Math.PI * s) / segments
      points.push([
        centre[0] + radius * Math.sin(theta) * Math.cos(phi),
        centre[1] + radius * Math.sin(theta) * Math.sin(phi),
        centre[2] + radius * Math.cos(theta),
      ])
    }
  }
  points.push([centre[0], centre[1], centre[2] - radius])
  const south = points.length - 1
  const at = (r: number, s: number) => 1 + (r - 1) * segments + (s % segments)
  const faces: [number, number, number][] = []
  for (let s = 0; s < segments; s += 1) faces.push([0, at(1, s), at(1, s + 1)])
  for (let r = 1; r < rings - 1; r += 1) {
    for (let s = 0; s < segments; s += 1) {
      faces.push([at(r, s), at(r + 1, s), at(r + 1, s + 1)])
      faces.push([at(r, s), at(r + 1, s + 1), at(r, s + 1)])
    }
  }
  for (let s = 0; s < segments; s += 1) faces.push([south, at(rings - 1, s + 1), at(rings - 1, s)])
  return mesh(points, faces)
}

/** An axis-aligned box, outward. */
export function boxMesh(min: Point, max: Point): TriangleMesh {
  const c = (i: number): Point => [
    i & 1 ? max[0] : min[0],
    i & 2 ? max[1] : min[1],
    i & 4 ? max[2] : min[2],
  ]
  const points = Array.from({ length: 8 }, (_, i) => c(i))
  const quads: [number, number, number, number][] = [
    [0, 2, 3, 1], // z min
    [4, 5, 7, 6], // z max
    [0, 1, 5, 4], // y min
    [2, 6, 7, 3], // y max
    [0, 4, 6, 2], // x min
    [1, 3, 7, 5], // x max
  ]
  return mesh(
    points,
    quads.flatMap(([a, b, c2, d]): [number, number, number][] => [
      [a, b, c2],
      [a, c2, d],
    ]),
  )
}

/** A half-space below z = 0, as a box far larger than anything that meets it. */
export function halfSpaceMesh(): TriangleMesh {
  return boxMesh([-1000, -1000, -1000], [1000, 1000, 0])
}

/** A plate 0.5 mm thick across z = 0: thinner than a step, so a collider that samples would miss it. */
export function thinPlateMesh(): TriangleMesh {
  return boxMesh([-60, -60, -0.25], [60, 60, 0.25])
}

/** Part of a torus about the z axis, closed with flat ends, outward. */
export function torusSegmentMesh(
  major = 60,
  minor = 12,
  fromDeg = 0,
  toDeg = 180,
  arcSteps = 36,
  tubeSteps = 24,
): TriangleMesh {
  const points: Point[] = []
  for (let i = 0; i <= arcSteps; i += 1) {
    const u = ((fromDeg + ((toDeg - fromDeg) * i) / arcSteps) * Math.PI) / 180
    for (let j = 0; j < tubeSteps; j += 1) {
      const v = (2 * Math.PI * j) / tubeSteps
      points.push([
        (major + minor * Math.cos(v)) * Math.cos(u),
        (major + minor * Math.cos(v)) * Math.sin(u),
        minor * Math.sin(v),
      ])
    }
  }
  const at = (i: number, j: number) => i * tubeSteps + (j % tubeSteps)
  const faces: [number, number, number][] = []
  for (let i = 0; i < arcSteps; i += 1) {
    for (let j = 0; j < tubeSteps; j += 1) {
      faces.push([at(i, j), at(i + 1, j), at(i + 1, j + 1)])
      faces.push([at(i, j), at(i + 1, j + 1), at(i, j + 1)])
    }
  }
  // the two ends, each a fan about its centre
  const startCentre = points.length
  const u0 = (fromDeg * Math.PI) / 180
  points.push([major * Math.cos(u0), major * Math.sin(u0), 0])
  const endCentre = points.length
  const u1 = (toDeg * Math.PI) / 180
  points.push([major * Math.cos(u1), major * Math.sin(u1), 0])
  for (let j = 0; j < tubeSteps; j += 1) {
    faces.push([startCentre, at(0, j), at(0, j + 1)])
    faces.push([endCentre, at(arcSteps, j + 1), at(arcSteps, j)])
  }
  return mesh(points, faces)
}

/** A small, fast, seeded generator (mulberry32), so a failing sequence can be replayed from its seed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── The independent judge ────────────────────────────────────────────────────────────────────

function pointTriangle(p: ReadPoint, a: ReadPoint, b: ReadPoint, c: ReadPoint): number {
  // Barycentric projection, then the three edges: a different route from the collider's regions.
  const e0x = b[0] - a[0]
  const e0y = b[1] - a[1]
  const e0z = b[2] - a[2]
  const e1x = c[0] - a[0]
  const e1y = c[1] - a[1]
  const e1z = c[2] - a[2]
  const vx = p[0] - a[0]
  const vy = p[1] - a[1]
  const vz = p[2] - a[2]
  const d00 = e0x * e0x + e0y * e0y + e0z * e0z
  const d01 = e0x * e1x + e0y * e1y + e0z * e1z
  const d11 = e1x * e1x + e1y * e1y + e1z * e1z
  const d20 = vx * e0x + vy * e0y + vz * e0z
  const d21 = vx * e1x + vy * e1y + vz * e1z
  const denominator = d00 * d11 - d01 * d01
  if (denominator > 1e-14) {
    const s = (d11 * d20 - d01 * d21) / denominator
    const t = (d00 * d21 - d01 * d20) / denominator
    if (s >= 0 && t >= 0 && s + t <= 1) {
      const x = vx - s * e0x - t * e1x
      const y = vy - s * e0y - t * e1y
      const z = vz - s * e0z - t * e1z
      return Math.sqrt(x * x + y * y + z * z)
    }
  }
  return Math.min(pointEdge(p, a, b), pointEdge(p, b, c), pointEdge(p, c, a))
}

function pointEdge(p: ReadPoint, u: ReadPoint, w: ReadPoint): number {
  const dx = w[0] - u[0]
  const dy = w[1] - u[1]
  const dz = w[2] - u[2]
  const px = p[0] - u[0]
  const py = p[1] - u[1]
  const pz = p[2] - u[2]
  const len2 = dx * dx + dy * dy + dz * dz
  let t = len2 > 0 ? (px * dx + py * dy + pz * dz) / len2 : 0
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const x = px - t * dx
  const y = py - t * dy
  const z = pz - t * dz
  return Math.sqrt(x * x + y * y + z * z)
}

/**
 * The distance from a segment to a triangle, by golden-section search along the segment (the
 * distance to a convex set is convex along a line), refined to well under a micrometre. It shares
 * no code with the collider's closed-form test.
 */
export function judgeSegmentTriangle(
  p0: ReadPoint,
  p1: ReadPoint,
  a: ReadPoint,
  b: ReadPoint,
  c: ReadPoint,
): number {
  const at = (t: number): number =>
    pointTriangle(
      [p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1]), p0[2] + t * (p1[2] - p0[2])],
      a,
      b,
      c,
    )
  let lo = 0
  let hi = 1
  const g = (Math.sqrt(5) - 1) / 2
  let x1 = hi - g * (hi - lo)
  let x2 = lo + g * (hi - lo)
  let f1 = at(x1)
  let f2 = at(x2)
  for (let i = 0; i < 60; i += 1) {
    if (f1 < f2) {
      hi = x2
      x2 = x1
      f2 = f1
      x1 = hi - g * (hi - lo)
      f1 = at(x1)
    } else {
      lo = x1
      x1 = x2
      f1 = f2
      x2 = lo + g * (hi - lo)
      f2 = at(x2)
    }
  }
  return Math.min(f1, f2, at(0), at(1))
}

/** The clearance of a capsule from a mesh, by the judge, over every triangle. */
export function judgeClearance(
  mesh: TriangleMesh,
  start: ReadPoint,
  end: ReadPoint,
  radius: number,
): number {
  const { positions, indices } = mesh
  const vertex = (i: number): Point => [
    positions[i * 3],
    positions[i * 3 + 1],
    positions[i * 3 + 2],
  ]
  let best = Infinity
  for (let f = 0; f < indices.length; f += 3) {
    best = Math.min(
      best,
      judgeSegmentTriangle(
        start,
        end,
        vertex(indices[f]),
        vertex(indices[f + 1]),
        vertex(indices[f + 2]),
      ),
    )
  }
  return best - radius
}

// ── A fast judge, still sharing no code with the collider ──────────────────────────────────────

/** Whether segment p0p1 passes through triangle abc (Möller and Trumbore's test, written here). */
function crossesJudge(
  p0: ReadPoint,
  p1: ReadPoint,
  a: ReadPoint,
  b: ReadPoint,
  c: ReadPoint,
): boolean {
  const dx = p1[0] - p0[0]
  const dy = p1[1] - p0[1]
  const dz = p1[2] - p0[2]
  const e1x = b[0] - a[0]
  const e1y = b[1] - a[1]
  const e1z = b[2] - a[2]
  const e2x = c[0] - a[0]
  const e2y = c[1] - a[1]
  const e2z = c[2] - a[2]
  const hx = dy * e2z - dz * e2y
  const hy = dz * e2x - dx * e2z
  const hz = dx * e2y - dy * e2x
  const det = e1x * hx + e1y * hy + e1z * hz
  if (Math.abs(det) < 1e-14) return false // parallel: the ends and the edges find a touch
  const sx = p0[0] - a[0]
  const sy = p0[1] - a[1]
  const sz = p0[2] - a[2]
  const u = (sx * hx + sy * hy + sz * hz) / det
  if (u < 0 || u > 1) return false
  const qx = sy * e1z - sz * e1y
  const qy = sz * e1x - sx * e1z
  const qz = sx * e1y - sy * e1x
  const v = (dx * qx + dy * qy + dz * qz) / det
  if (v < 0 || u + v > 1) return false
  const t = (e2x * qx + e2y * qy + e2z * qz) / det
  return t >= 0 && t <= 1
}

/**
 * The distance between two segments: the least of the square's interior stationary point, if it
 * lies inside, and the least along each of its four edges, found by clamping.
 */
function segmentsJudge(p0: ReadPoint, p1: ReadPoint, q0: ReadPoint, q1: ReadPoint): number {
  const ux = p1[0] - p0[0]
  const uy = p1[1] - p0[1]
  const uz = p1[2] - p0[2]
  const vx = q1[0] - q0[0]
  const vy = q1[1] - q0[1]
  const vz = q1[2] - q0[2]
  const wx = p0[0] - q0[0]
  const wy = p0[1] - q0[1]
  const wz = p0[2] - q0[2]
  const a = ux * ux + uy * uy + uz * uz
  const b = ux * vx + uy * vy + uz * vz
  const c = vx * vx + vy * vy + vz * vz
  const d = ux * wx + uy * wy + uz * wz
  const e = vx * wx + vy * wy + vz * wz
  const at = (s: number, t: number) => {
    const x = wx + s * ux - t * vx
    const y = wy + s * uy - t * vy
    const z = wz + s * uz - t * vz
    return Math.sqrt(x * x + y * y + z * z)
  }
  const clamp = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
  let best = Infinity
  const det = a * c - b * b
  if (det > 1e-14) {
    const s = (b * e - c * d) / det
    const t = (a * e - b * d) / det
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) best = at(s, t)
  }
  best = Math.min(best, at(0, c > 0 ? clamp(e / c) : 0), at(1, c > 0 ? clamp((e + b) / c) : 0))
  best = Math.min(best, at(a > 0 ? clamp(-d / a) : 0, 0), at(a > 0 ? clamp((b - d) / a) : 0, 1))
  return best
}

/** The distance from a point to a triangle, by the judge's own route. */
export const judgePointTriangle = pointTriangle

/** The distance from a segment to a triangle, closed-form, by the judge's own routes. */
export function fastJudgeSegmentTriangle(
  p0: ReadPoint,
  p1: ReadPoint,
  a: ReadPoint,
  b: ReadPoint,
  c: ReadPoint,
): number {
  if (crossesJudge(p0, p1, a, b, c)) return 0
  return Math.min(
    pointTriangle(p0, a, b, c),
    pointTriangle(p1, a, b, c),
    segmentsJudge(p0, p1, a, b),
    segmentsJudge(p0, p1, b, c),
    segmentsJudge(p0, p1, c, a),
  )
}

/** A mesh's triangles, each with a bounding sphere, so the brute force can skip the far ones. */
export interface JudgedMesh {
  readonly triangles: readonly (readonly [Point, Point, Point])[]
  readonly centres: readonly Point[]
  readonly radii: readonly number[]
}

export function judgedMesh(
  mesh: TriangleMesh,
  keep: (a: Point, b: Point, c: Point) => boolean = () => true,
): JudgedMesh {
  const vertex = (i: number): Point => [
    mesh.positions[i * 3],
    mesh.positions[i * 3 + 1],
    mesh.positions[i * 3 + 2],
  ]
  const triangles: [Point, Point, Point][] = []
  for (let f = 0; f < mesh.indices.length; f += 3) {
    const t: [Point, Point, Point] = [
      vertex(mesh.indices[f]),
      vertex(mesh.indices[f + 1]),
      vertex(mesh.indices[f + 2]),
    ]
    if (keep(...t)) triangles.push(t)
  }
  const centres = triangles.map(
    ([a, b, c]): Point => [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ],
  )
  const radii = triangles.map((t, i) =>
    Math.max(
      ...t.map((p) => Math.hypot(p[0] - centres[i][0], p[1] - centres[i][1], p[2] - centres[i][2])),
    ),
  )
  return { triangles, centres, radii }
}

function pointSegment(p: ReadPoint, s0: ReadPoint, s1: ReadPoint): number {
  return pointEdge(p, s0, s1)
}

/**
 * The least distance from a segment to a judged mesh, by brute force over its triangles: every
 * triangle is measured unless its bounding sphere already lies further than the best so far, which
 * starts from the triangle whose sphere is nearest.
 */
export function judgeSegmentMesh(mesh: JudgedMesh, p0: ReadPoint, p1: ReadPoint): number {
  const count = mesh.triangles.length
  if (count === 0) return Infinity
  const lower = new Float64Array(count)
  let first = 0
  for (let i = 0; i < count; i += 1) {
    lower[i] = pointSegment(mesh.centres[i], p0, p1) - mesh.radii[i]
    if (lower[i] < lower[first]) first = i
  }
  let best = fastJudgeSegmentTriangle(p0, p1, ...mesh.triangles[first])
  for (let i = 0; i < count; i += 1) {
    if (lower[i] >= best) continue
    best = Math.min(best, fastJudgeSegmentTriangle(p0, p1, ...mesh.triangles[i]))
  }
  return best
}

// ── Analytic scenes the whole engine runs on ─────────────────────────────────────────────────

/**
 * A closed, outward box whose faces are cut into rectangles at the given positions along each axis,
 * sharing the cuts at the edges, so that it stays closed.
 */
export function gridBoxMesh(cuts: {
  readonly x: readonly number[]
  readonly y: readonly number[]
  readonly z: readonly number[]
}): TriangleMesh {
  const points: Point[] = []
  const ids = new Map<string, number>()
  const id = (p: Point) => {
    const key = p.join(',')
    const found = ids.get(key)
    if (found !== undefined) return found
    points.push(p)
    ids.set(key, points.length - 1)
    return points.length - 1
  }
  const faces: [number, number, number][] = []
  const axes = [cuts.x, cuts.y, cuts.z]
  // each face: the fixed axis at its low or high end, and the two others in right-handed order
  for (const [fixed, u, v] of [
    [0, 1, 2],
    [1, 2, 0],
    [2, 0, 1],
  ] as const) {
    for (const high of [false, true]) {
      const level = high ? axes[fixed][axes[fixed].length - 1] : axes[fixed][0]
      for (let i = 0; i + 1 < axes[u].length; i += 1) {
        for (let j = 0; j + 1 < axes[v].length; j += 1) {
          const corner = (di: number, dj: number): number => {
            const p: Point = [0, 0, 0]
            p[fixed] = level
            p[u] = axes[u][i + di]
            p[v] = axes[v][j + dj]
            return id(p)
          }
          const [a, b, c, d] = [corner(0, 0), corner(1, 0), corner(1, 1), corner(0, 1)]
          // u × v points along +fixed; the low face turns the other way
          if (high) faces.push([a, b, c], [a, c, d])
          else faces.push([a, c, b], [a, d, c])
        }
      }
    }
  }
  return mesh(points, faces)
}

export function translateMesh(source: TriangleMesh, offset: Point): TriangleMesh {
  const positions = Float32Array.from(source.positions, (value, i) => value + offset[i % 3])
  return { positions, indices: source.indices }
}

// ── Inside or outside, and the shape of a surface, by the judge's own routes ─────────────────

/**
 * Three fixed ray directions, none along an axis or a diagonal. The engine classifies a point by
 * winding number; the judge casts rays and counts crossings, a different method that shares no
 * code with it (independent review, R2 and R7).
 */
const RAYS: readonly ReadPoint[] = (
  [
    [0.5364, 0.3172, 0.7821],
    [-0.6121, 0.7043, 0.3597],
    [0.2791, -0.8612, 0.4247],
  ] as const
).map((d) => {
  const l = Math.hypot(d[0], d[1], d[2])
  return [d[0] / l, d[1] / l, d[2] / l] as const
})

/** Crossings of a ray with the triangles, or null if a hit is too near an edge to count. */
function crossings(mesh: JudgedMesh, p: ReadPoint, d: ReadPoint): number | null {
  let count = 0
  for (const [a, b, c] of mesh.triangles) {
    // Möller and Trumbore
    const e1: ReadPoint = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const e2: ReadPoint = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const h: ReadPoint = [
      d[1] * e2[2] - d[2] * e2[1],
      d[2] * e2[0] - d[0] * e2[2],
      d[0] * e2[1] - d[1] * e2[0],
    ]
    const det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2]
    if (Math.abs(det) < 1e-12) continue
    const s: ReadPoint = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
    const u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det
    if (u < -1e-9 || u > 1 + 1e-9) continue
    const q: ReadPoint = [
      s[1] * e1[2] - s[2] * e1[1],
      s[2] * e1[0] - s[0] * e1[2],
      s[0] * e1[1] - s[1] * e1[0],
    ]
    const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det
    if (v < -1e-9 || u + v > 1 + 1e-9) continue
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det
    if (t <= 0) continue
    const edge = 1e-7
    if (u < edge || v < edge || 1 - u - v < edge) return null
    count += 1
  }
  return count
}

/** Whether a point lies inside a closed surface: the parity of each ray, the majority of three. */
export function judgeInside(mesh: JudgedMesh, p: ReadPoint): boolean {
  let inside = 0
  let counted = 0
  for (const ray of RAYS) {
    const n = crossings(mesh, p, ray)
    if (n === null) continue
    counted += 1
    if (n % 2 === 1) inside += 1
  }
  if (counted === 0) throw new Error(`Every ray from ${p.join(', ')} grazes an edge`)
  return inside * 2 > counted
}

export interface JudgedTopology {
  /** Every edge is shared by exactly two triangles. */
  readonly closedManifold: boolean
  /** Every shared edge is walked in opposite directions by its two triangles. */
  readonly consistent: boolean
  /** Positive for an outward surface. */
  readonly signedVolumeMm3: number
  /** Vertices − edges + faces, after welding coincident vertices: 2 for a sphere-like surface. */
  readonly euler: number
}

/** The shape of a triangle mesh, welded by position, by the judge's own counting. */
export function judgeTopology(source: TriangleMesh): JudgedTopology {
  const key = (i: number) =>
    [0, 1, 2].map((k) => Math.round(source.positions[i * 3 + k] * 1e5)).join(',')
  const weld = new Map<string, number>()
  const id = (i: number) => {
    const k = key(i)
    const found = weld.get(k)
    if (found !== undefined) return found
    weld.set(k, weld.size)
    return weld.size - 1
  }
  const directed = new Map<string, number>()
  const undirected = new Map<string, number>()
  let volume = 0
  const faces = source.indices.length / 3
  for (let f = 0; f < source.indices.length; f += 3) {
    const v = [source.indices[f], source.indices[f + 1], source.indices[f + 2]]
    const w = v.map(id)
    for (let k = 0; k < 3; k += 1) {
      const a = w[k]
      const b = w[(k + 1) % 3]
      directed.set(`${a}>${b}`, (directed.get(`${a}>${b}`) ?? 0) + 1)
      const u = a < b ? `${a}-${b}` : `${b}-${a}`
      undirected.set(u, (undirected.get(u) ?? 0) + 1)
    }
    const p = v.map((i) => [0, 1, 2].map((k) => source.positions[i * 3 + k]))
    volume +=
      (p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) -
        p[0][1] * (p[1][0] * p[2][2] - p[1][2] * p[2][0]) +
        p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0])) /
      6
  }
  const closedManifold = [...undirected.values()].every((n) => n === 2)
  const consistent = [...directed.entries()].every(([edge, n]) => {
    const [a, b] = edge.split('>')
    return n === 1 && directed.get(`${b}>${a}`) === 1
  })
  return {
    closedManifold,
    consistent,
    signedVolumeMm3: volume,
    euler: weld.size - undirected.size + faces,
  }
}

/** Only the triangles whose bounding spheres reach within `margin` of a box: a quicker judge. */
export function judgedNear(
  mesh: JudgedMesh,
  box: { readonly min: ReadPoint; readonly max: ReadPoint },
  margin: number,
): JudgedMesh {
  const keep: number[] = []
  mesh.centres.forEach((c, i) => {
    const r = mesh.radii[i] + margin
    if (
      c[0] + r >= box.min[0] &&
      c[0] - r <= box.max[0] &&
      c[1] + r >= box.min[1] &&
      c[1] - r <= box.max[1] &&
      c[2] + r >= box.min[2] &&
      c[2] - r <= box.max[2]
    )
      keep.push(i)
  })
  return {
    triangles: keep.map((i) => mesh.triangles[i]),
    centres: keep.map((i) => mesh.centres[i]),
    radii: keep.map((i) => mesh.radii[i]),
  }
}
