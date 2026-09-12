import routes from './paired-routes.json'
import type { CtTrace } from '../content/ct-types'
import type { DisplayPreset, Vec3 } from './coordinates'
import { NATIVE_CT, sliceZ } from './native-ct'

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]))
const interpolate = (a: readonly number[], b: readonly number[], f: number) =>
  a.map((v, i) => v + (b[i] - v) * f) as Vec3
const edges = new Map(routes.edges.map((e) => [e.id, e.points]))
const cache = new Map<string, { points: Vec3[]; arcs: number[] }>()
/** Fix the reference scope roll, independently of the learner's CT operations. */
export function bookScopeUp(preset: DisplayPreset, forward: Vec3): Vec3 {
  // Apical tracing: lateral chest wall below (RUL: R below; upper division: L below).
  // Caudal tracing: anterior above. A horizontal anterior parent instead uses superior above.
  const preferred: Vec3 =
    preset === 'rul' ? [1, 0, 0] : preset === 'upper-division' ? [-1, 0, 0] : [0, -1, 0]
  return Math.abs(preferred.reduce((n, v, i) => n + v * forward[i], 0)) > 0.95
    ? [0, 0, 1]
    : preferred
}
export function pairedPath(trace: CtTrace) {
  const known = cache.get(trace.id)
  if (known) return known
  const points: Vec3[] = []
  for (const id of trace.sourceEdgeIds) {
    const edge = edges.get(id)
    if (!edge) throw new Error(`Missing paired airway edge ${id}`)
    for (const point of edge) {
      if (!points.length || distance(points[points.length - 1], point) > 0.0001)
        points.push(point as Vec3)
    }
  }
  const arcs = [0]
  for (let i = 1; i < points.length; i++)
    arcs.push(arcs[i - 1] + distance(points[i - 1], points[i]))
  const path = { points, arcs }
  cache.set(trace.id, path)
  return path
}
/** Select by patient plane, then by distance along the selected airway, not screen proximity. */
export function pairedScope(trace: CtTrace, slice: number, active: number, atStart: boolean) {
  const { points, arcs } = pairedPath(trace)
  const anchor: readonly number[] = atStart
    ? [
        NATIVE_CT.origin[0] + trace.anchor.pixel[0] * NATIVE_CT.spacing[0],
        NATIVE_CT.origin[1] + trace.anchor.pixel[1] * NATIVE_CT.spacing[1],
        sliceZ(trace.anchor.slice),
      ]
    : trace.checkpoints[active].lps
  let nearestArc = 0,
    nearestDistance = Infinity
  const candidates: { arc: number; point: Vec3; gap: number }[] = []
  const z = sliceZ(slice)
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      length = arcs[i] - arcs[i - 1]
    if (!length) continue
    const f = Math.max(
      0,
      Math.min(1, a.reduce((sum, v, j) => sum + (anchor[j] - v) * (b[j] - v), 0) / length ** 2),
    )
    const anchorPoint = interpolate(a, b, f)
    const gap = distance(anchor, anchorPoint)
    if (gap < nearestDistance) {
      nearestDistance = gap
      nearestArc = arcs[i - 1] + f * length
    }
    // Preserve distinct stations inside one 0.5 mm acquisition slice (e.g. proximal/distal RB5).
    candidates.push({
      point: anchorPoint,
      arc: arcs[i - 1] + f * length,
      gap: Math.abs(anchorPoint[2] - z),
    })
    const fraction =
      Math.abs(b[2] - a[2]) < 1e-9 ? f : Math.max(0, Math.min(1, (z - a[2]) / (b[2] - a[2])))
    const point = interpolate(a, b, fraction)
    candidates.push({ point, arc: arcs[i - 1] + fraction * length, gap: Math.abs(point[2] - z) })
  }
  const minGap = Math.min(...candidates.map((p) => p.gap))
  const atSelectedPlane = slice === (atStart ? trace.anchor.slice : trace.checkpoints[active].slice)
  const station = candidates
    .filter((p) => p.gap <= (atSelectedPlane ? Math.max(minGap + 0.001, 0.251) : minGap + 0.001))
    .sort((a, b) => Math.abs(a.arc - nearestArc) - Math.abs(b.arc - nearestArc))[0]
  function sample(arc: number) {
    arc = Math.max(0, Math.min(arcs[arcs.length - 1], arc))
    const i = Math.max(
      1,
      arcs.findIndex((v) => v >= arc),
    )
    return interpolate(points[i - 1], points[i], (arc - arcs[i - 1]) / (arcs[i] - arcs[i - 1]))
  }
  // Keep the selected location ahead of the scope, including at a distal checkpoint.
  const decision = !atStart && atSelectedPlane ? trace.checkpoints[active].decision : undefined
  const forkIndex = decision
    ? points.findIndex((p) => distance(p, decision.junctionLps) < 0.001)
    : -1
  const atJunction = forkIndex >= 0
  // Present every division from its parent, without pointing the camera into the answer child.
  const cameraArc = Math.max(0, atJunction ? arcs[forkIndex] - 8 : station.arc - 4)
  const position = sample(cameraArc)
  const look = atJunction
    ? points[forkIndex]
    : sample(Math.min(arcs[arcs.length - 1], cameraArc + 7))
  const norm = distance(position, look)
  const direction = look.map((v, i) => (v - position[i]) / norm) as Vec3
  return {
    position,
    direction,
    up: bookScopeUp(trace.preset, direction),
    point: station.point,
    planeGapMm: station.gap,
    arc: station.arc,
    atJunction,
    atDistalLimit: arcs[arcs.length - 1] - station.arc < 10,
  }
}
