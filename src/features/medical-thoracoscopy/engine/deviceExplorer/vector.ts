/**
 * The little vector and rotation arithmetic the explorer's assembly needs, on plain tuples so the
 * sequence stays a pure function that tests can run without a renderer. Millimetres throughout.
 */
export type Vec3 = readonly [number, number, number]
/** A unit quaternion, x y z w, the order three.js uses. */
export type Quat = readonly [number, number, number, number]

export const IDENTITY: Quat = [0, 0, 0, 1]

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s]
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2])
}

export function normalize(a: Vec3): Vec3 {
  const size = length(a)
  if (size === 0) throw new Error('Cannot normalise a zero vector')
  return scale(a, 1 / size)
}

export function distance(a: Vec3, b: Vec3): number {
  return length(sub(a, b))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Smooth start and stop, zero slope at both ends. */
export function smoothstep(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

/** 0 before `from`, 1 after `to`, smooth between. */
export function band(value: number, from: number, to: number): number {
  return smoothstep((value - from) / (to - from))
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

export function quatFromAxisAngle(axis: Vec3, radians: number): Quat {
  const unit = normalize(axis)
  const half = radians / 2
  const s = Math.sin(half)
  return [unit[0] * s, unit[1] * s, unit[2] * s, Math.cos(half)]
}

/**
 * The shortest rotation that turns direction `from` onto direction `to`. When the two are opposed
 * the turn is about an axis perpendicular to both, chosen deterministically.
 */
export function quatBetween(from: Vec3, to: Vec3): Quat {
  const a = normalize(from)
  const b = normalize(to)
  const cosine = dot(a, b)
  if (cosine > 1 - 1e-12) return IDENTITY
  if (cosine < -1 + 1e-12) {
    const helper: Vec3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    return quatFromAxisAngle(cross(a, helper), Math.PI)
  }
  const axis = cross(a, b)
  const w = 1 + cosine
  const size = Math.hypot(axis[0], axis[1], axis[2], w)
  return [axis[0] / size, axis[1] / size, axis[2] / size, w / size]
}

export function rotate(q: Quat, v: Vec3): Vec3 {
  const [x, y, z, w] = q
  // v' = v + 2w (q × v) + 2 q × (q × v)
  const u: Vec3 = [x, y, z]
  const t = scale(cross(u, v), 2)
  return add(add(v, scale(t, w)), cross(u, t))
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  let cosine = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  let end: Quat = b
  if (cosine < 0) {
    cosine = -cosine
    end = [-b[0], -b[1], -b[2], -b[3]]
  }
  if (cosine > 0.9995) {
    const mixed: Quat = [
      lerp(a[0], end[0], t),
      lerp(a[1], end[1], t),
      lerp(a[2], end[2], t),
      lerp(a[3], end[3], t),
    ]
    const size = Math.hypot(...mixed)
    return [mixed[0] / size, mixed[1] / size, mixed[2] / size, mixed[3] / size]
  }
  const angle = Math.acos(cosine)
  const sine = Math.sin(angle)
  const wa = Math.sin((1 - t) * angle) / sine
  const wb = Math.sin(t * angle) / sine
  return [
    a[0] * wa + end[0] * wb,
    a[1] * wa + end[1] * wb,
    a[2] * wa + end[2] * wb,
    a[3] * wa + end[3] * wb,
  ]
}

/** A rigid placement: a device-frame point p lands at rotate(quaternion, p) + position. */
export interface Pose {
  readonly position: Vec3
  readonly quaternion: Quat
}

export const IDENTITY_POSE: Pose = { position: [0, 0, 0], quaternion: IDENTITY }

export function applyPose(pose: Pose, point: Vec3): Vec3 {
  return add(rotate(pose.quaternion, point), pose.position)
}

export function applyPoseToDirection(pose: Pose, direction: Vec3): Vec3 {
  return rotate(pose.quaternion, direction)
}

/** `outer` after `inner`: a point placed by `inner`, then by `outer`. */
export function composePose(outer: Pose, inner: Pose): Pose {
  return {
    position: applyPose(outer, inner.position),
    quaternion: quatMultiply(outer.quaternion, inner.quaternion),
  }
}
