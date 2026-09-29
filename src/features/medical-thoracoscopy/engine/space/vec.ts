/**
 * Three-vectors as plain tuples, so state stays plain JSON. Millimetres, LPS unless a caller says
 * otherwise.
 */
export type Vec3 = readonly [number, number, number]

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const length = (a: Vec3): number => Math.sqrt(dot(a, a))
export const distance = (a: Vec3, b: Vec3): number => length(sub(a, b))

export function normalize(a: Vec3): Vec3 {
  const l = length(a)
  if (l === 0) throw new Error('Cannot normalise a zero vector')
  return scale(a, 1 / l)
}

/** a + t (b − a). */
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t))

/** Rotate v about the unit axis k by an angle in radians (Rodrigues). */
export function rotate(v: Vec3, k: Vec3, radians: number): Vec3 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)))
}

export const degrees = (radians: number): number => (radians * 180) / Math.PI
export const radians = (deg: number): number => (deg * Math.PI) / 180
