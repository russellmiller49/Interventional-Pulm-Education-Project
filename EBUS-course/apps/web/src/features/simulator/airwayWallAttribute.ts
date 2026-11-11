import type { SimulatorCenterlineAsset } from './types'

/**
 * The per-vertex wall attribute the shared mucosa shader reads when `MUCOSA_ANATOMY` is defined
 * (`aAirwayWall`: cos * cue, sin * cue, ring strength, ring count), computed for this case's
 * airway mesh so the white-light view shows C-shaped cartilage rings in front and the smooth
 * membranous wall behind.
 *
 * Each vertex is given to the nearest point of the case's centerlines. From there it takes:
 * its angle around the airway measured from anatomical posterior; how far down the airway it is,
 * counted in rings; and how strongly rings are drawn at all, which is full through the trachea,
 * main bronchi and bronchus intermedius and fades out beyond them. The mesh itself is untouched.
 *
 * Ring spacing and extent are the same drawing constants the Bronchoscopy Foundations scope view
 * uses. They are a drawing, not a measurement of this patient's cartilages.
 */
export const TRACHEAL_RING_PITCH_MM = 5
export const BRONCHIAL_RING_PITCH_MM = 3.4
/** Rings are drawn at full strength this far past the carina, then fade over the next stretch. */
export const RINGS_PAST_CARINA_MM = 45
export const RING_FADE_MM = 18
/** Posterior in the scene's coordinates, which are [left, superior, -posterior]. */
const POSTERIOR: Vec3 = [0, 0, -1]
/** Tangents are taken across this many points either side: the raw centerline jitters. */
const TANGENT_SPAN = 6
const SAMPLE_STRIDE = 2

type Vec3 = [number, number, number]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const scaled = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const normalized = (a: Vec3): Vec3 | null => {
  const l = length(a)
  return l > 1e-6 ? scaled(a, 1 / l) : null
}

/** The paths long enough to be an airway route (the asset also holds a few stubs). */
const routes = (centerlines: SimulatorCenterlineAsset) =>
  centerlines.polylines.filter((line) => line.points.length >= 20)

/**
 * How far down the shared tracheal path the carina is: the first arc length at which two of the
 * root-to-leaf paths part by more than two millimetres.
 */
export function carinaArcLengthMm(centerlines: SimulatorCenterlineAsset) {
  const lines = routes(centerlines)
  const first = lines[0]
  let carina = Infinity
  for (const other of lines.slice(1)) {
    const shared = Math.min(first.points.length, other.points.length)
    for (let i = 0; i < shared; i++)
      if (length(sub(first.points[i] as Vec3, other.points[i] as Vec3)) > 2) {
        carina = Math.min(carina, first.cumulative_lengths_mm[i])
        break
      }
  }
  return Number.isFinite(carina) ? carina : 0
}

/** Rings counted from the top of the trachea: wider apart in the trachea than in the bronchi. */
export function ringCount(arcMm: number, carinaMm: number) {
  return arcMm <= carinaMm
    ? arcMm / TRACHEAL_RING_PITCH_MM
    : carinaMm / TRACHEAL_RING_PITCH_MM + (arcMm - carinaMm) / BRONCHIAL_RING_PITCH_MM
}
/** How strongly the wall's anatomy is drawn at an arc length: 1, then a smooth fade to 0. */
export function ringCue(arcMm: number, carinaMm: number) {
  const t = (arcMm - (carinaMm + RINGS_PAST_CARINA_MM)) / RING_FADE_MM
  if (t <= 0) return 1
  if (t >= 1) return 0
  return 1 - t * t * (3 - 2 * t)
}

export function airwayWallAttribute(
  vertices: readonly (readonly number[])[],
  centerlines: SimulatorCenterlineAsset,
): Float32Array {
  const carina = carinaArcLengthMm(centerlines)
  const samples: { p: Vec3; t: Vec3; s: number }[] = []
  for (const line of routes(centerlines)) {
    const last = line.points.length - 1
    for (let i = 0; i <= last; i += SAMPLE_STRIDE) {
      const tangent = normalized(
        sub(
          line.points[Math.min(last, i + TANGENT_SPAN)] as Vec3,
          line.points[Math.max(0, i - TANGENT_SPAN)] as Vec3,
        ),
      )
      if (tangent)
        samples.push({ p: line.points[i] as Vec3, t: tangent, s: line.cumulative_lengths_mm[i] })
    }
  }
  const out = new Float32Array(vertices.length * 4)
  for (let v = 0; v < vertices.length; v++) {
    const vertex = vertices[v] as unknown as Vec3
    let best = Infinity,
      nearest = samples[0]
    for (const sample of samples) {
      const dx = vertex[0] - sample.p[0],
        dy = vertex[1] - sample.p[1],
        dz = vertex[2] - sample.p[2],
        d = dx * dx + dy * dy + dz * dz
      if (d < best) {
        best = d
        nearest = sample
      }
    }
    if (!nearest) continue
    const offset = sub(vertex, nearest.p)
    const radial = normalized(sub(offset, scaled(nearest.t, dot(offset, nearest.t))))
    const behind = normalized(sub(POSTERIOR, scaled(nearest.t, dot(POSTERIOR, nearest.t))))
    if (!radial || !behind) continue
    const side = cross(nearest.t, behind)
    // Where the vertex sits along the airway, not where its nearest sample does.
    const arc = nearest.s + dot(offset, nearest.t)
    const cue = ringCue(arc, carina)
    out[v * 4] = dot(radial, behind) * cue
    out[v * 4 + 1] = dot(radial, side) * cue
    out[v * 4 + 2] = cue
    out[v * 4 + 3] = ringCount(arc, carina)
  }
  return out
}
