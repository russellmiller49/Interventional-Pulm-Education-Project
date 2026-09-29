import * as THREE from 'three'

import type { CameraKey } from '../../engine/deviceExplorer/assembly'

/**
 * Cameras as a target, the direction from it to the eye, and how much must stay in view. Keys from
 * the assembly are in the telescope's frame and are turned into the scene by the display rotation;
 * the distance follows from the field of view and the viewport's shape, so a key frames the same
 * thing in any window.
 */
export interface WorldCameraKey {
  readonly target: THREE.Vector3
  readonly direction: THREE.Vector3
  readonly radius: number
}

/** An instrument lies along the screen, distal end to the right, optic side up. */
export const INSTRUMENT_DISPLAY = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  -Math.PI / 2,
)
/** The tower's file stands on +Z with its front to −Y; turn it upright, front to the viewer. */
export const TOWER_DISPLAY = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
)

/** The default viewing direction for a single model, in the scene: front, a little above. */
export const FRONT_VIEW = new THREE.Vector3(0.18, 0.32, 1).normalize()

export function keyToWorld(key: CameraKey, display: THREE.Quaternion): WorldCameraKey {
  return {
    target: new THREE.Vector3(...key.target).applyQuaternion(display),
    direction: new THREE.Vector3(...key.direction).applyQuaternion(display).normalize(),
    radius: key.radius,
  }
}

export function distanceFor(radius: number, camera: THREE.PerspectiveCamera): number {
  const vertical = THREE.MathUtils.degToRad(camera.fov)
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * Math.max(camera.aspect, 0.1))
  return radius / Math.sin(Math.min(vertical, horizontal) / 2)
}

export function keyFromCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
): WorldCameraKey {
  const toEye = camera.position.clone().sub(target)
  const distance = Math.max(toEye.length(), 1e-3)
  const vertical = THREE.MathUtils.degToRad(camera.fov)
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * Math.max(camera.aspect, 0.1))
  return {
    target: target.clone(),
    direction: toEye.divideScalar(distance),
    radius: distance * Math.sin(Math.min(vertical, horizontal) / 2),
  }
}

export function blendKeys(a: WorldCameraKey, b: WorldCameraKey, t: number): WorldCameraKey {
  const k = THREE.MathUtils.smootherstep(t, 0, 1)
  const direction = a.direction.clone().lerp(b.direction, k)
  if (direction.lengthSq() < 1e-8) direction.copy(b.direction)
  return {
    target: a.target.clone().lerp(b.target, k),
    direction: direction.normalize(),
    radius: Math.exp(THREE.MathUtils.lerp(Math.log(a.radius), Math.log(b.radius), k)),
  }
}

/** Put the camera on a key; the near plane follows the distance so close-ups stay sharp. */
export function applyKey(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  key: WorldCameraKey,
): void {
  const distance = distanceFor(key.radius, camera)
  target.copy(key.target)
  camera.position.copy(key.direction).multiplyScalar(distance).add(key.target)
  camera.lookAt(key.target)
  fitClipping(camera, distance)
}

export function fitClipping(camera: THREE.PerspectiveCamera, distance: number): void {
  const near = Math.max(0.02, distance / 400)
  const far = Math.max(4000, distance * 40)
  if (Math.abs(camera.near - near) / near > 0.05 || camera.far !== far) {
    camera.near = near
    camera.far = far
    camera.updateProjectionMatrix()
  }
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * The key that frames a set of points from a direction as tightly as this camera's field of view
 * and aspect allow: the distance at which every point's projection fits, expressed as the radius
 * `distanceFor` turns back into that distance.
 */
export function fitPoints(
  points: readonly THREE.Vector3[],
  direction: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  margin = 1.08,
): WorldCameraKey {
  const centre = new THREE.Box3().setFromPoints([...points]).getCenter(new THREE.Vector3())
  const back = direction.clone().normalize()
  const forward = back.clone().negate()
  const right = new THREE.Vector3().crossVectors(forward, UP)
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0)
  right.normalize()
  const up = new THREE.Vector3().crossVectors(right, forward)
  const vertical = THREE.MathUtils.degToRad(camera.fov)
  const tanV = Math.tan(vertical / 2)
  const tanH = tanV * Math.max(camera.aspect, 0.1)
  let distance = 0
  const relative = new THREE.Vector3()
  for (const point of points) {
    relative.copy(point).sub(centre)
    const depth = relative.dot(back)
    distance = Math.max(
      distance,
      depth + Math.abs(relative.dot(right)) / tanH,
      depth + Math.abs(relative.dot(up)) / tanV,
    )
  }
  distance *= margin
  const horizontal = 2 * Math.atan(tanH)
  return {
    target: centre,
    direction: back,
    radius: distance * Math.sin(Math.min(vertical, horizontal) / 2),
  }
}

/** The eight corners of a box, turned by a rotation. */
export function boxCorners(box: THREE.Box3, rotation?: THREE.Quaternion): THREE.Vector3[] {
  const corners: THREE.Vector3[] = []
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const corner = new THREE.Vector3(x, y, z)
        corners.push(rotation ? corner.applyQuaternion(rotation) : corner)
      }
  return corners
}
