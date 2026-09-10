/** Shared patient-space math. No renderer objects cross application boundaries. */
export type Point3 = [number, number, number]
export interface OpticalFrame {
  position: Point3
  forward: Point3
  up: Point3
  right: Point3
}
export type NavigationMode = 'guided' | 'realistic'
export interface ContactState {
  touching: boolean
  clearanceMm: number
  blockedMm: number
}
export interface LumenCollider {
  clearance(point: Point3): number
  sweep(from: Point3, to: Point3, radiusMm: number): { point: Point3; contact: ContactState }
  visible(from: Point3, to: Point3): boolean
}
export const plus = (a: Point3, b: Point3): Point3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const minus = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const times = (a: Point3, s: number): Point3 => [a[0] * s, a[1] * s, a[2] * s]
export const scalar = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const magnitude = (a: Point3) => Math.hypot(...a)
export const vector = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const unit = (a: Point3, fallback: Point3 = [0, 0, -1]): Point3 =>
  magnitude(a) > 1e-9 ? times(a, 1 / magnitude(a)) : [...fallback]
export function rotate(v: Point3, axis: Point3, radians: number): Point3 {
  const a = unit(axis),
    c = Math.cos(radians),
    s = Math.sin(radians)
  return plus(plus(times(v, c), times(vector(a, v), s)), times(a, scalar(a, v) * (1 - c)))
}
export function makeFrame(
  position: Point3,
  forward: Point3,
  upHint: Point3 = [0, -1, 0],
): OpticalFrame {
  const f = unit(forward)
  const hint =
    Math.abs(scalar(f, unit(upHint))) > 0.9999
      ? ((Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]) as Point3)
      : upHint
  const right = unit(vector(f, hint))
  return { position, forward: f, right, up: unit(vector(right, f)) }
}
/** Minimal rotation transports the frame along a curved path without a global-up flip. */
export function transport(frame: OpticalFrame, position: Point3, forward: Point3): OpticalFrame {
  const f = unit(forward),
    axis = vector(frame.forward, f),
    sin = magnitude(axis)
  const cos = Math.max(-1, Math.min(1, scalar(frame.forward, f)))
  const up = sin > 1e-8 ? rotate(frame.up, times(axis, 1 / sin), Math.atan2(sin, cos)) : frame.up
  return makeFrame(position, f, up)
}
export function rollFrame(frame: OpticalFrame, degrees: number): OpticalFrame {
  const axis = times(frame.forward, -1),
    radians = (degrees * Math.PI) / 180
  return {
    ...frame,
    up: rotate(frame.up, axis, radians),
    right: rotate(frame.right, axis, radians),
  }
}
export function steerFrame(frame: OpticalFrame, rightDeg: number, upDeg: number): OpticalFrame {
  const f = rotate(frame.forward, frame.up, (-rightDeg * Math.PI) / 180)
  const r = rotate(frame.right, frame.up, (-rightDeg * Math.PI) / 180)
  return makeFrame(
    frame.position,
    rotate(f, r, (upDeg * Math.PI) / 180),
    rotate(frame.up, r, (upDeg * Math.PI) / 180),
  )
}
/** FOV is the longest optical dimension, never a fixed vertical angle on a wide pane. */
export function verticalFov(opticalFovDeg: number, aspect: number): number {
  return (
    (2 * Math.atan(Math.tan((opticalFovDeg * Math.PI) / 360) / Math.max(1, aspect)) * 180) / Math.PI
  )
}
export function projectOptical(
  point: Point3,
  frame: OpticalFrame,
  aspect: number,
  opticalFovDeg = 88,
) {
  const offset = minus(point, frame.position),
    depth = scalar(offset, frame.forward)
  if (depth <= 0.06) return null
  const tangent = Math.tan((verticalFov(opticalFovDeg, aspect) * Math.PI) / 360)
  const x = scalar(offset, frame.right) / (depth * tangent * Math.max(aspect, 0.01))
  const y = scalar(offset, frame.up) / (depth * tangent)
  return { x, y, depth, visible: Math.abs(x) < 1 && Math.abs(y) < 1 }
}
/** A bounded spatial sweep is shared by mesh and analytic test colliders. */
export function sweepClearance(
  clearance: (p: Point3) => number,
  from: Point3,
  to: Point3,
  radiusMm: number,
) {
  const delta = minus(to, from),
    length = magnitude(delta)
  const count = Math.max(1, Math.ceil(length / Math.min(0.25, Math.max(0.05, radiusMm / 2))))
  const start = clearance(from)
  let accepted = from,
    available = start
  for (let i = 1; i <= count; i++) {
    const candidate = plus(from, times(delta, i / count)),
      d = clearance(candidate)
    // If a legacy start is too close, permit only motion that improves clearance.
    if (d < 0 || (d < radiusMm && d < Math.min(radiusMm, available) - 1e-5)) break
    accepted = candidate
    available = d
  }
  const blockedMm = magnitude(minus(to, accepted))
  return {
    point: accepted,
    contact: {
      touching: blockedMm > 0.001 || available < radiusMm + 0.1,
      clearanceMm: available,
      blockedMm,
    },
  }
}
