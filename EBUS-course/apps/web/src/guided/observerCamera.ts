/**
 * Pure observer-camera and label-layout math for the guided 3D views (EBUS-PRE-REVIEW-03).
 * Nothing here touches the acquisition pose, evidence or geometry; it only decides where an
 * observer camera sits and where screen-space labels go. Everything is node-testable.
 */
import * as THREE from 'three'

/**
 * The model frame these views draw in, verified from `src/lib/bronchoscopy-core/devices.ts`:
 * web `[x, y, z]` = patient `[L, S, -P]`, so +x is the patient's left, +y superior and +z
 * anterior. This describes the model coordinate frame only; it is not a claim about any
 * clinical image's display convention.
 */
export const MODEL_FRAME_AXES: ReadonlyArray<{ key: 'R' | 'L' | 'S' | 'I' | 'A' | 'P'; axis: [number, number, number] }> = [
  { key: 'R', axis: [-1, 0, 0] },
  { key: 'L', axis: [1, 0, 0] },
  { key: 'S', axis: [0, 1, 0] },
  { key: 'I', axis: [0, -1, 0] },
  { key: 'A', axis: [0, 0, 1] },
  { key: 'P', axis: [0, 0, -1] },
]

/** Camera distance at which a box of `size` fits a perspective frustum with padding. */
export function fitDistance(
  size: { x: number; y: number; z: number },
  fovDeg: number,
  aspect: number,
  padding = 1.18,
): number {
  const halfFov = Math.tan((fovDeg * Math.PI) / 360)
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3
  const fit = Math.max(size.y / 2 / halfFov, size.x / 2 / halfFov / safeAspect)
  const distance = (Number.isFinite(fit) && fit > 0 ? fit : 1) * padding + size.z / 2
  return Math.max(distance, 1)
}

/**
 * Camera distance at which a sphere of `radius` fits the narrower of the two half-fields, whatever
 * direction the camera looks from. Used for the framed views, where the box is seen obliquely.
 */
export function fitSphereDistance(radius: number, fovDeg: number, aspect: number, padding = 1.1): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 4 / 3
  const vertical = (fovDeg * Math.PI) / 360
  const horizontal = Math.atan(Math.tan(vertical) * safeAspect)
  const half = Math.min(vertical, horizontal)
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1
  return Math.max(1, (safeRadius / Math.sin(half)) * padding)
}

/** Screen-space directions of the model axes for a camera basis; used by the compass overlay. */
export function compassDirections(camera: THREE.Camera) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  return MODEL_FRAME_AXES.map(({ key, axis }) => {
    const a = new THREE.Vector3(...axis)
    return { key, dx: a.dot(right), dy: -a.dot(up), toward: a.dot(forward) }
  })
}

export type CalloutSide = 'left' | 'right'
/**
 * Which column each label sits in. Letters used to swap columns whenever their anchor crossed the
 * canvas midline (L3-3: "letters swap sides as the scope rotates"); a marker now keeps its column
 * until its anchor is clearly on the other side. The first assignment is a balanced median split.
 */
export function assignColumns(
  items: { id: string; x: number }[],
  width: number,
  previous: Map<string, CalloutSide>,
  hysteresis = 0.16,
): Map<string, CalloutSide> {
  const result = new Map<string, CalloutSide>()
  const fresh = items.filter((item) => !previous.has(item.id)).sort((a, b) => a.x - b.x)
  const split = Math.ceil(fresh.length / 2)
  fresh.forEach((item, index) => result.set(item.id, index < split ? 'left' : 'right'))
  for (const item of items) {
    const kept = previous.get(item.id)
    if (!kept) continue
    const mid = width / 2
    const band = hysteresis * width
    result.set(
      item.id,
      kept === 'left' && item.x > mid + band
        ? 'right'
        : kept === 'right' && item.x < mid - band
          ? 'left'
          : kept,
    )
  }
  return result
}

/**
 * Vertical label placement for one column: ordered by anchor y, at least `minGap` apart and
 * inside `[margin, height - margin]`. A forward pass pushes overlaps down, a backward pass pulls
 * the tail back up when it ran off the bottom.
 */
export function spreadColumn(
  items: { id: string; y: number }[],
  height: number,
  minGap: number,
  margin: number,
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  const ys = sorted.map((item) => Math.min(height - margin, Math.max(margin, item.y)))
  for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + minGap)
  for (let i = ys.length - 1; i >= 0; i--) {
    const cap = i === ys.length - 1 ? height - margin : ys[i + 1] - minGap
    ys[i] = Math.min(ys[i], cap)
  }
  const result = new Map<string, number>()
  sorted.forEach((item, index) => result.set(item.id, ys[index]))
  return result
}

/** Project world points through a camera into css pixels of a `width × height` canvas. */
export function projectPoint(point: THREE.Vector3, camera: THREE.Camera, width: number, height: number) {
  const p = point.clone().project(camera)
  return {
    x: ((p.x + 1) * width) / 2,
    y: ((1 - p.y) * height) / 2,
    inFront: Math.abs(p.z) < 1,
    inView: Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1,
  }
}

/**
 * A route-comparison camera that keeps the approach arrow legible. The old placement stood the
 * camera on the arrow's own axis (3–11° off it), so a 14–20 mm arrow projected to 4–18 px
 * (L19-1: "I couldn't find arrows"). The camera now looks at the same target from a direction
 * turned about the model's superior axis away from the approach vector, so the arrow crosses the
 * view instead of pointing into it. Only the observer moves; locator and target are the contract's.
 */
export function routeObserverPosition(
  locator: THREE.Vector3,
  target: THREE.Vector3,
  distance = 125,
  turnDeg = 62,
  rise = 22,
) {
  const approach = locator.clone().sub(target)
  if (approach.lengthSq() < 1e-9) return target.clone().add(new THREE.Vector3(0, rise, distance))
  approach.normalize()
  const up = new THREE.Vector3(0, 1, 0)
  // Turn about an axis perpendicular to the approach, so the view is always `turnDeg` off the
  // arrow whatever its direction; a near-vertical approach turns about the model's x axis.
  const axis = new THREE.Vector3().crossVectors(approach, up)
  if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
  else axis.normalize()
  const turned = approach.clone().applyAxisAngle(axis, THREE.MathUtils.degToRad(turnDeg))
  return target.clone().addScaledVector(turned, distance).add(new THREE.Vector3(0, rise, 0))
}
