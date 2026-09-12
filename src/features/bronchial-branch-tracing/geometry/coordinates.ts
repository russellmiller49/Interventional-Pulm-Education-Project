import { add, cross, dot, normalize, scale, subtract } from '@/lib/airway-anatomy/geometry'
import type { Vec3 } from '@/lib/airway-anatomy/types'

export type { Vec3 }
export { add, dot, normalize, scale, subtract }
export type DisplayPreset = 'standard' | 'mirror' | 'rul' | 'upper-division'
export const DISPLAY_PRESETS: Record<DisplayPreset, string> = {
  standard: 'Standard axial',
  mirror: 'Horizontal reversal',
  rul: '90° counterclockwise',
  'upper-division': '90° clockwise',
}

/** Semantic space is RAS mm. These two conversions are the same involution. */
export function lpsToRas(p: Vec3): Vec3 {
  return [-p[0], -p[1], p[2]]
}
export const rasToLps = lpsToRas

/** Screen coordinates, normalized around the center. Never applied to patient geometry. */
export function displayPoint([x, y]: readonly number[], preset: DisplayPreset): [number, number] {
  if (preset === 'mirror') return [-x, y]
  if (preset === 'rul') return [y, -x]
  if (preset === 'upper-division') return [-y, x]
  return [x, y]
}
export function undisplayPoint(p: readonly number[], preset: DisplayPreset): [number, number] {
  return displayPoint(
    p,
    preset === 'rul' ? 'upper-division' : preset === 'upper-division' ? 'rul' : preset,
  )
}
export function directionError(a: number, b: number, period = 360): number {
  const d = (((a - b) % period) + period) % period
  return Math.min(d, period - d)
}
export function cameraFrame(position: Vec3, target: Vec3, up: Vec3, rollDeg: number) {
  const forward = normalize(subtract(target, position))
  const right = normalize(cross(forward, up))
  const vertical = normalize(cross(right, forward))
  const r = (rollDeg * Math.PI) / 180
  return {
    forward,
    right: add(scale(right, Math.cos(r)), scale(vertical, Math.sin(r))),
    up: add(scale(vertical, Math.cos(r)), scale(right, -Math.sin(r))),
  }
}
export function pointSegmentDistance(p: Vec3, a: Vec3, b: Vec3) {
  const ab = subtract(b, a)
  const t = Math.max(0, Math.min(1, dot(subtract(p, a), ab) / Math.max(dot(ab, ab), 1e-8)))
  return Math.hypot(...subtract(p, add(a, scale(ab, t))))
}

/** Row-major, applied to column vectors; rejects invalid homogeneous points. */
export function transformPoint(m: readonly number[], p: Vec3): Vec3 {
  if (m.length !== 16 || !m.every(Number.isFinite)) throw new Error('Invalid affine')
  const q = [0, 1, 2, 3].map(
    (row) => m[row * 4] * p[0] + m[row * 4 + 1] * p[1] + m[row * 4 + 2] * p[2] + m[row * 4 + 3],
  )
  if (!q.every(Number.isFinite) || Math.abs(q[3]) < 1e-9) throw new Error('Invalid point')
  return [q[0] / q[3], q[1] / q[3], q[2] / q[3]]
}
