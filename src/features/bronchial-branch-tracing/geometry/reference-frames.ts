import { cross } from '@/lib/airway-anatomy/geometry'
import { dot, normalize, type Vec3 } from './coordinates'
import { orientationLabels, orientationName, type CtOrientation } from './orientation'

/**
 * The three reference frames this module keeps apart.
 *
 * 1. Native CT pixels and patient space (LPS millimetres). Response planes, marks, the airway
 *    graph and the reference-camera definitions live here and never move.
 * 2. The learner's CT display: rotation, reflection, crop and magnification applied to the image
 *    of frame 1 (`orientation.ts`). A pure screen operation; the R/L/A/P letters move with the pixels.
 * 3. The modelled parent camera: a position, forward vector and up/roll defined in frame 1 along
 *    the source route (`paired-scope.ts`). It is a function of the route and the regional preset,
 *    never of frame 2, so turning or reflecting the CT does not roll or move it.
 *
 * Everything here describes frame 3 and projects frame-1 directions into it. Frame 2 is read only
 * to be named beside frame 3 in a caption. Nothing here decides anatomy: the words describe where
 * the modelled camera points, not where an ostium is.
 */
export interface CameraBasis {
  forward: Vec3
  right: Vec3
  up: Vec3
}

/** Right-handed screen basis for a camera looking along `direction` with `referenceUp` held up. */
export function cameraBasis(direction: Vec3, referenceUp: Vec3): CameraBasis {
  const forward = normalize(direction)
  const right = normalize(cross(forward, referenceUp))
  const up = normalize(cross(right, forward))
  return { forward, right, up }
}

/** Orthographic projection of a frame-1 direction onto the camera's screen plane: [right, down]. */
export const projectDirection = (basis: CameraBasis, v: Vec3): [number, number] => [
  dot(v, basis.right),
  -dot(v, basis.up),
]

export interface PatientAxis {
  label: 'R' | 'L' | 'A' | 'P' | 'S' | 'I'
  name: string
  vector: Vec3
}
export const PATIENT_AXES: PatientAxis[] = [
  { label: 'R', name: 'patient right', vector: [-1, 0, 0] },
  { label: 'L', name: 'patient left', vector: [1, 0, 0] },
  { label: 'A', name: 'anterior', vector: [0, -1, 0] },
  { label: 'P', name: 'posterior', vector: [0, 1, 0] },
  { label: 'S', name: 'superior', vector: [0, 0, 1] },
  { label: 'I', name: 'inferior', vector: [0, 0, -1] },
]
const AXIS_PAIRS: [PatientAxis['label'], PatientAxis['label']][] = [
  ['R', 'L'],
  ['A', 'P'],
  ['S', 'I'],
]
/** Below this projected length an axis is treated as running along the line of sight. */
export const AXIS_IN_PLANE_THRESHOLD = 0.3

export interface ProjectedAxis extends PatientAxis {
  point: [number, number]
}
export interface AlongViewAxis {
  /** e.g. "S–I" */
  pair: string
  /** The end of the axis that points into the view, away from the camera. */
  into: PatientAxis
  /** The end that points back toward the viewer. */
  toward: PatientAxis
}
/**
 * Which patient directions can honestly be drawn in this camera's view. An axis nearly parallel
 * to the line of sight projects to a point and is reported separately instead of being given an
 * arbitrary screen arrow.
 */
export function patientAxesInView(basis: CameraBasis): {
  inPlane: ProjectedAxis[]
  alongView: AlongViewAxis[]
} {
  const inPlane: ProjectedAxis[] = []
  const alongView: AlongViewAxis[] = []
  for (const [a, b] of AXIS_PAIRS) {
    const first = PATIENT_AXES.find((axis) => axis.label === a)!
    const second = PATIENT_AXES.find((axis) => axis.label === b)!
    const point = projectDirection(basis, first.vector)
    if (Math.hypot(...point) > AXIS_IN_PLANE_THRESHOLD) {
      inPlane.push({ ...first, point })
      inPlane.push({ ...second, point: projectDirection(basis, second.vector) })
    } else {
      const firstInto = dot(first.vector, basis.forward) > 0
      alongView.push({
        pair: `${a}–${b}`,
        into: firstInto ? first : second,
        toward: firstInto ? second : first,
      })
    }
  }
  return { inPlane, alongView }
}

/** The patient direction a unit vector matches, or null when it is not aligned with one. */
export function axisName(v: Vec3): PatientAxis | null {
  const unit = normalize(v)
  return PATIENT_AXES.find((axis) => dot(axis.vector, unit) > 0.999) ?? null
}

/** Where the camera looks, in patient words; "mainly" when the direction is oblique. */
export function lookingDirection(direction: Vec3): string {
  const [x, y, z] = normalize(direction)
  const candidates = [
    { value: z, positive: 'cranially', negative: 'caudally' },
    { value: x, positive: "toward the patient's left", negative: "toward the patient's right" },
    { value: y, positive: 'posteriorly', negative: 'anteriorly' },
  ]
  const dominant = candidates.reduce((best, next) =>
    Math.abs(next.value) > Math.abs(best.value) ? next : best,
  )
  const word = dominant.value >= 0 ? dominant.positive : dominant.negative
  return Math.abs(dominant.value) > 0.85 ? word : `mainly ${word}`
}

export interface ParentCameraPose {
  direction: Vec3
  up: Vec3
  atJunction: boolean
}
/**
 * One caption for frame 3. It names the airway the camera looks along, the direction it looks in
 * patient words and the declared roll for this region. It never claims a universal convention.
 */
export function parentCameraCaption(pose: ParentCameraPose, airwayCode: string): string {
  const upAxis = axisName(pose.up)
  const roll = upAxis
    ? `Reference roll for this region: ${upAxis.name} at the top of the view.`
    : 'Reference roll for this region: the declared reference direction at the top of the view.'
  return `Model parent view: looking ${lookingDirection(pose.direction)} along ${airwayCode}${
    pose.atJunction ? ' toward its division' : ''
  }. ${roll}`
}

/** One caption for frame 2, so the display state is named beside the camera, not confused with it. */
export function ctDisplayCaption(orientation: CtOrientation): string {
  const labels = orientationLabels(orientation)
  return `CT display: ${orientationName(orientation)} (${labels.top} up, ${labels.left} screen-left). Turning or reflecting the CT does not move the parent camera.`
}

export interface ParentViewProjection {
  /** 0–100 across the square view, matching a viewBox of 0 0 100 100. */
  x: number
  y: number
  /** Distance along the line of sight, in millimetres. */
  depthMm: number
  /** False when the point lies beside or behind the camera and cannot be drawn. */
  inFront: boolean
}
/**
 * Perspective projection of a frame-1 point into the parent camera's square view. Matches a
 * vertical field of view of `fovDeg` at aspect ratio 1, which is how the paired view renders.
 * Line-of-sight occlusion is not decided here; it needs the airway surface.
 */
export function projectToParentView(
  camera: { position: Vec3; direction: Vec3; up: Vec3 },
  point: Vec3,
  fovDeg = 80,
): ParentViewProjection {
  const basis = cameraBasis(camera.direction, camera.up)
  const delta: Vec3 = [
    point[0] - camera.position[0],
    point[1] - camera.position[1],
    point[2] - camera.position[2],
  ]
  const depthMm = dot(delta, basis.forward)
  const tangent = Math.tan((fovDeg * Math.PI) / 360)
  if (depthMm <= 0.1) return { x: NaN, y: NaN, depthMm, inFront: false }
  const x = 50 + (50 * (dot(delta, basis.right) / depthMm)) / tangent
  const y = 50 - (50 * (dot(delta, basis.up) / depthMm)) / tangent
  return { x, y, depthMm, inFront: x >= 0 && x <= 100 && y >= 0 && y <= 100 }
}
