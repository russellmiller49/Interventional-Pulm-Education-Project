/**
 * Lofted surfaces for the suite's authored figures: the patient, the drape, the staff member.
 *
 * A loft is a stack of closed rings joined into one smooth skin. Each ring is listed
 * counter-clockwise as seen from the direction the stack advances in, which makes every face point
 * outward. Pure geometry: no React, and nothing here knows what it is drawing.
 */
import { BufferGeometry, CatmullRomCurve3, Float32BufferAttribute, Vector3 } from 'three'
import type { Point3 } from '../../lib/physics'

export type Ring = readonly Point3[]

/** One smooth skin through `rings`, closed at either end by a fan to the end ring's centroid. */
export function loftGeometry(
  rings: readonly Ring[],
  { capStart = true, capEnd = true }: { capStart?: boolean; capEnd?: boolean } = {},
): BufferGeometry {
  const count = rings[0].length
  if (rings.length < 2 || rings.some((ring) => ring.length !== count))
    throw new Error('A loft needs two or more rings of one size.')
  const positions: number[] = rings.flatMap((ring) => ring.flat())
  const index: number[] = []
  for (let r = 0; r < rings.length - 1; r++)
    for (let p = 0; p < count; p++) {
      const a = r * count + p,
        b = r * count + ((p + 1) % count),
        c = a + count,
        d = b + count
      index.push(a, b, c, b, d, c)
    }
  const centroid = (ring: Ring): Point3 =>
    ring
      .reduce<Point3>(
        (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]],
        [0, 0, 0],
      )
      .map((n) => n / ring.length) as Point3
  if (capStart) {
    const centre = positions.length / 3
    positions.push(...centroid(rings[0]))
    for (let p = 0; p < count; p++) index.push(centre, (p + 1) % count, p)
  }
  if (capEnd) {
    const centre = positions.length / 3,
      base = (rings.length - 1) * count
    positions.push(...centroid(rings[rings.length - 1]))
    for (let p = 0; p < count; p++) index.push(centre, base + p, base + ((p + 1) % count))
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Rows of numbers keyed by their first column, resampled smoothly along that column.
 *
 * Each remaining column is a cubic Hermite curve through its keys with finite-difference slopes,
 * so an authored table of a dozen cross-sections becomes a skin without visible facets.
 */
export function resampleRows(
  keys: readonly (readonly number[])[],
  perSpan: number,
): readonly number[][] {
  const slope = (column: number, i: number) => {
    const low = Math.max(0, i - 1),
      high = Math.min(keys.length - 1, i + 1)
    return (keys[high][column] - keys[low][column]) / (keys[high][0] - keys[low][0])
  }
  const rows: number[][] = []
  for (let i = 0; i < keys.length - 1; i++) {
    const span = keys[i + 1][0] - keys[i][0]
    for (let s = 0; s < perSpan; s++) {
      const t = s / perSpan,
        t2 = t * t,
        t3 = t2 * t
      rows.push(
        keys[i].map((_, column) =>
          column === 0
            ? keys[i][0] + span * t
            : (2 * t3 - 3 * t2 + 1) * keys[i][column] +
              (t3 - 2 * t2 + t) * span * slope(column, i) +
              (-2 * t3 + 3 * t2) * keys[i + 1][column] +
              (t3 - t2) * span * slope(column, i + 1),
        ),
      )
    }
  }
  rows.push([...keys[keys.length - 1]])
  return rows
}

const signedPower = (value: number, exponent: number) =>
  Math.sign(value) * Math.abs(value) ** exponent

/**
 * A rounded cross-section in the plane of two axes: a superellipse, squarer as `squareness` rises
 * (2 is an ellipse). `flatBelow` squares off the lower half only, the way a body rests on a pad.
 */
export function sectionRing(
  place: (across: number, up: number) => Point3,
  halfWidth: number,
  low: number,
  high: number,
  options: { segments?: number; squareness?: number; flatBelow?: number } = {},
): Ring {
  const { segments = 40, squareness = 2.4 } = options
  const flatBelow = options.flatBelow ?? squareness
  const centre = (low + high) / 2,
    half = (high - low) / 2
  return Array.from({ length: segments }, (_, i) => {
    const angle = (i / segments) * Math.PI * 2
    const sine = Math.sin(angle)
    const n = sine < 0 ? flatBelow : squareness
    return place(
      halfWidth * signedPower(Math.cos(angle), 2 / n),
      centre + half * signedPower(sine, 2 / n),
    )
  })
}

export interface LimbPoint {
  readonly at: Point3
  /** Half-width across the limb. */
  readonly radius: number
  /** Half-thickness front to back; the same as `radius` when omitted. */
  readonly depth?: number
}

/**
 * A limb: a rounded tube through `points`, its width following each point's radius, with both
 * ends closed by a dome. `front` is the direction the limb's front-to-back thickness is taken in.
 */
export function limbGeometry(
  points: readonly LimbPoint[],
  { radial = 20, perSpan = 6, front = [0, 1, 0] as Point3 } = {},
): BufferGeometry {
  const curve = new CatmullRomCurve3(
    points.map((point) => new Vector3(...point.at)),
    false,
    'centripetal',
  )
  const spans = points.length - 1
  const sizes = resampleRows(
    points.map((point, i) => [i / spans, point.radius, point.depth ?? point.radius]),
    perSpan,
  )
  const rings: Point3[][] = []
  const ring = (centre: Vector3, tangent: Vector3, radius: number, depth: number) => {
    const hint = new Vector3(...front)
    if (Math.abs(hint.dot(tangent)) > 0.92) hint.set(1, 0, 0)
    const normal = hint.addScaledVector(tangent, -hint.dot(tangent)).normalize()
    const across = normal.clone().cross(tangent)
    rings.push(
      Array.from({ length: radial }, (_, i) => {
        const angle = (i / radial) * Math.PI * 2
        return centre
          .clone()
          .addScaledVector(across, Math.cos(angle) * radius)
          .addScaledVector(normal, Math.sin(angle) * depth)
          .toArray() as Point3
      }),
    )
  }
  const dome = (centre: Vector3, tangent: Vector3, radius: number, depth: number, end: 1 | -1) => {
    const steps = [0.35, 0.65, 0.88, 0.99]
    const made = steps.map((s) => ({
      shift: Math.sin((s * Math.PI) / 2) * Math.min(radius, depth) * end,
      scale: Math.cos((s * Math.PI) / 2),
    }))
    for (const step of end === 1 ? made : made.reverse())
      ring(
        centre.clone().addScaledVector(tangent, step.shift),
        tangent,
        radius * step.scale,
        depth * step.scale,
      )
  }
  sizes.forEach(([t, radius, depth], i) => {
    const centre = curve.getPoint(t),
      tangent = curve.getTangent(t).normalize()
    if (i === 0) dome(centre, tangent, radius, depth, -1)
    ring(centre, tangent, radius, depth)
    if (i === sizes.length - 1) dome(centre, tangent, radius, depth, 1)
  })
  return loftGeometry(rings)
}
