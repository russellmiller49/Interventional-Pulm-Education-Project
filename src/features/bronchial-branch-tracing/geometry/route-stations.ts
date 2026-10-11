import type { CtTrace } from '../content/ct-types'
import type { DisplayPreset, Vec3 } from './coordinates'
import { NATIVE_CT } from './native-ct'
import { pairedPath } from './paired-scope'
import { cameraBasis, type CameraBasis } from './reference-frames'

/**
 * Where the scope stands and how it travels along a route.
 *
 * A route is one arc-length-parameterised polyline from the top of the trachea to the end of the
 * airway model (`pairedPath`). A *station* is a division on it: the scope waits a fixed distance
 * short of the fork, looking at it, with the region's reference roll. A *drive* is the arc between
 * two stations, or from the last station to the end of the route.
 *
 * Everything here is patient space (LPS millimetres). Nothing reads the learner's CT display.
 */

/** How far short of a fork the scope waits, and how far ahead it looks while travelling. */
export const STATION_BACK_MM = 8
/** The scope's field of view, in degrees. A bronchoscope's is wide; this is a little narrower. */
export const SCOPE_FOV_DEG = 100

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** The route point at an arc length, clamped to the route. */
export function sampleRoute(trace: CtTrace, arc: number): Vec3 {
  const { points, arcs } = pairedPath(trace)
  const last = arcs[arcs.length - 1]
  const at = Math.max(0, Math.min(last, arc))
  let i = arcs.findIndex((value) => value >= at)
  if (i < 1) i = 1
  const span = arcs[i] - arcs[i - 1]
  const f = span > 0 ? (at - arcs[i - 1]) / span : 0
  const a = points[i - 1],
    b = points[i]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

export const routeLength = (trace: CtTrace) => {
  const { arcs } = pairedPath(trace)
  return arcs[arcs.length - 1]
}

/** The arc length of the route point nearest a patient-space point. */
export function arcNearest(trace: CtTrace, target: readonly number[]): number {
  const { points, arcs } = pairedPath(trace)
  let best = { gap: Infinity, arc: 0 }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    const length = arcs[i] - arcs[i - 1]
    if (!length) continue
    const f = Math.max(
      0,
      Math.min(
        1,
        ((target[0] - a[0]) * (b[0] - a[0]) +
          (target[1] - a[1]) * (b[1] - a[1]) +
          (target[2] - a[2]) * (b[2] - a[2])) /
          length ** 2,
      ),
    )
    const gap = distance(target, [
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ])
    if (gap < best.gap) best = { gap, arc: arcs[i - 1] + f * length }
  }
  return best.arc
}

/** The native slice an arc length lies on, kept inside the route's own slice range. */
export function arcToSlice(trace: CtTrace, arc: number): number {
  const z = sampleRoute(trace, arc)[2]
  const slice = Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])
  return Math.max(trace.range[0], Math.min(trace.range[1], slice))
}

/** The arc length of a division's fork point; null for a checkpoint without a division. */
export function forkArc(trace: CtTrace, checkpointIndex: number): number | null {
  const decision = trace.checkpoints[checkpointIndex]?.decision
  if (!decision) return null
  const { points, arcs } = pairedPath(trace)
  const index = points.findIndex((p) => distance(p, decision.junctionLps) < 0.001)
  return index >= 0 ? arcs[index] : arcNearest(trace, decision.junctionLps)
}

/**
 * How the scope is rolled: which patient direction is held at the top of its view.
 *
 * - Looking down an airway (trachea, main and lower lobe bronchi): anterior at the top, the
 *   ordinary way a bronchoscope is held.
 * - Looking sideways, forward or backward along a horizontal bronchus: the head at the top.
 * - Looking up an airway inside an upper lobe: the lateral chest wall at the bottom, which is how
 *   Kurimoto and Morita display the right upper lobe and the left upper division. Looking up an
 *   airway anywhere else (a superior segment that climbs): anterior at the top.
 *
 * A scope flexes in one plane, so each of these is what the view becomes when the operator turns
 * toward a branch and flexes up into it. The rule is stated per look direction so that every
 * station's roll can be said in one sentence; the drive blends from one to the next.
 */
export const LOOKING_DOWN = -0.3
export const LOOKING_UP = 0.5
export type LookKind = 'down' | 'level' | 'up'
export const lookKind = (direction: readonly number[]): LookKind =>
  direction[2] <= LOOKING_DOWN ? 'down' : direction[2] >= LOOKING_UP ? 'up' : 'level'
export function scopeUp(preset: DisplayPreset, direction: Vec3): Vec3 {
  const kind = lookKind(direction)
  const preferred: Vec3 =
    kind === 'level'
      ? [0, 0, 1]
      : kind === 'up' && preset === 'rul'
        ? [1, 0, 0]
        : kind === 'up' && preset === 'upper-division'
          ? [-1, 0, 0]
          : [0, -1, 0]
  const along = Math.abs(
    preferred[0] * direction[0] + preferred[1] * direction[1] + preferred[2] * direction[2],
  )
  // A reference that lies along the line of sight carries no roll: fall back to the head.
  return along > 0.95 ? (preferred[2] ? [0, -1, 0] : [0, 0, 1]) : preferred
}

export interface ScopePose {
  arc: number
  position: Vec3
  direction: Vec3
  up: Vec3
}

/**
 * The scope at an arc length, looking at the route point `aheadMm` farther on, with the roll in
 * force for that look.
 */
export function poseAt(trace: CtTrace, arc: number, aheadMm = STATION_BACK_MM): ScopePose {
  const length = routeLength(trace)
  const at = Math.max(0, Math.min(length, arc))
  const position = sampleRoute(trace, at)
  // Near the end of the route there is nothing ahead to look at: look along the last stretch.
  const ahead = Math.min(length, at + aheadMm)
  const from = ahead - at < 1 ? sampleRoute(trace, Math.max(0, ahead - aheadMm)) : position
  const to = sampleRoute(trace, ahead)
  const norm = distance(from, to) || 1
  const direction: Vec3 = [
    (to[0] - from[0]) / norm,
    (to[1] - from[1]) / norm,
    (to[2] - from[2]) / norm,
  ]
  return { arc: at, position, direction, up: scopeUp(trace.preset, direction) }
}

export interface StationCamera extends ScopePose {
  forkArc: number
  /** How far short of the fork the scope waits. */
  backMm: number
  basis: CameraBasis
}

/** How far the scope may wait from a fork, nearest first. */
const BACK_CHOICES_MM = [8, 10, 12, 14, 16, 18, 20]
/** The scope waits at least this far past the fork before, and never nearer its own than this. */
export const PAST_PREVIOUS_FORK_MM = 1
export const MIN_BACK_MM = 2
/** Both openings should fall inside this much of the square view, 0–100. */
const FRAME_MARGIN = 24
/** Where an opening is framed: this far into the daughter from the fork. */
const FRAME_DEPTH_MM = 6

/** A point just inside each daughter of a fork: where its opening is, for aiming and framing. */
function openingPoints(trace: CtTrace, checkpointIndex: number): Vec3[] {
  const decision = trace.checkpoints[checkpointIndex].decision!
  const fork = decision.junctionLps
  return decision.options.map((option) => {
    const delta = [option.lps[0] - fork[0], option.lps[1] - fork[1], option.lps[2] - fork[2]]
    const length = Math.hypot(delta[0], delta[1], delta[2]) || 1
    return [0, 1, 2].map((axis) => fork[axis] + (delta[axis] / length) * FRAME_DEPTH_MM) as Vec3
  })
}

/** The largest distance of any opening from the centre of the view, in view units. */
function framing(points: Vec3[], pose: ScopePose): number {
  const basis = cameraBasis(pose.direction, pose.up)
  const tangent = Math.tan((SCOPE_FOV_DEG * Math.PI) / 360)
  let worst = 0
  for (const target of points) {
    const point = [0, 1, 2].map((axis) => target[axis] - pose.position[axis])
    const depth =
      point[0] * basis.forward[0] + point[1] * basis.forward[1] + point[2] * basis.forward[2]
    if (depth <= 0.5) return Infinity
    const x =
      (point[0] * basis.right[0] + point[1] * basis.right[1] + point[2] * basis.right[2]) / depth
    const y = (point[0] * basis.up[0] + point[1] * basis.up[1] + point[2] * basis.up[2]) / depth
    worst = Math.max(worst, (50 * Math.max(Math.abs(x), Math.abs(y))) / tangent)
  }
  return worst
}

const stations = new Map<string, StationCamera | null>()
/**
 * The scope waiting at a division, aimed between its openings.
 *
 * It waits `STATION_BACK_MM` short of the fork where that shows every opening, farther back in a
 * wide airway whose openings would otherwise sit at the rim, and nearer where the fork before is
 * closer than that: it always stays inside the parent airway. It looks at the middle of the
 * openings, not at the spur between them, so each opening is in view.
 */
export function stationCamera(trace: CtTrace, checkpointIndex: number): StationCamera | null {
  const key = `${trace.id}:${checkpointIndex}`
  if (stations.has(key)) return stations.get(key)!
  const fork = forkArc(trace, checkpointIndex)
  let camera: StationCamera | null = null
  if (fork !== null) {
    const points = openingPoints(trace, checkpointIndex)
    const aim = points
      .reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0])
      .map((value) => value / points.length)
    // Stay inside the parent airway: never as far back as the fork before this one. Where two
    // forks are closer together than the usual waiting distance, wait just past the earlier one.
    const previous = checkpointIndex > 0 ? forkArc(trace, checkpointIndex - 1) : null
    const room = previous === null ? fork : fork - previous - PAST_PREVIOUS_FORK_MM
    const nearest = Math.max(MIN_BACK_MM, Math.min(STATION_BACK_MM, room))
    const choices = [nearest, ...BACK_CHOICES_MM.filter((back) => back > nearest && back <= room)]
    let best: { pose: ScopePose; back: number; spread: number } | null = null
    for (const back of choices) {
      const arc = Math.max(0, fork - back)
      const position = sampleRoute(trace, arc)
      const norm = distance(position, aim) || 1
      const direction: Vec3 = [
        (aim[0] - position[0]) / norm,
        (aim[1] - position[1]) / norm,
        (aim[2] - position[2]) / norm,
      ]
      const pose = { arc, position, direction, up: scopeUp(trace.preset, direction) }
      const spread = framing(points, pose)
      if (!best || spread < best.spread) best = { pose, back, spread }
      if (spread <= 50 - FRAME_MARGIN) break
    }
    const { pose, back } = best!
    camera = { ...pose, forkArc: fork, backMm: back, basis: cameraBasis(pose.direction, pose.up) }
  }
  stations.set(key, camera)
  return camera
}

/** Where a route ends for the scope: beside its last checkpoint, short of the model's end. */
export function arrivalArc(trace: CtTrace): number {
  const last = trace.checkpoints[trace.checkpoints.length - 1]
  return Math.min(arcNearest(trace, last.lps), routeLength(trace) - 1)
}

export interface Drive {
  fromArc: number
  toArc: number
  /** The station poses the drive leaves from and arrives on; no arrival pose at the route's end. */
  from: ScopePose
  to: ScopePose | null
}
/** The drive on from one station: to the next station's waiting point, or to the route's end. */
export function driveFrom(trace: CtTrace, checkpointIndex: number): Drive {
  const here = stationCamera(trace, checkpointIndex)!
  const next = stationCamera(trace, checkpointIndex + 1)
  return { fromArc: here.arc, from: here, toArc: next ? next.arc : arrivalArc(trace), to: next }
}
/** The scope at rest at the end of the route. */
export const arrivalPose = (trace: CtTrace) => poseAt(trace, arrivalArc(trace))

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}
const unit = (v: Vec3, fallback: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2])
  return length > 1e-6 ? [v[0] / length, v[1] / length, v[2] / length] : fallback
}

/**
 * The scope part-way through a drive. It travels along the route looking ahead down the airway,
 * and it leaves from the departure station's pose and settles onto the arrival's: the direction
 * it looks and its roll are eased from one to the other, so the view never snaps at either end.
 */
export function drivePose(trace: CtTrace, drive: Drive, progress: number): ScopePose {
  const t = Math.max(0, Math.min(1, progress))
  const arc = drive.fromArc + (drive.toArc - drive.fromArc) * t
  const along = poseAt(trace, arc)
  const end = drive.to ?? poseAt(trace, drive.toArc)
  const leaving = 1 - smooth(t / 0.3)
  const arriving = smooth((t - 0.7) / 0.3)
  const cruising = Math.max(0, 1 - leaving - arriving)
  const direction = unit(
    [0, 1, 2].map(
      (axis) =>
        along.direction[axis] * cruising +
        drive.from.direction[axis] * leaving +
        end.direction[axis] * arriving,
    ) as Vec3,
    along.direction,
  )
  const blended = mix(drive.from.up, end.up, smooth(t))
  const onSight =
    Math.abs(blended[0] * direction[0] + blended[1] * direction[1] + blended[2] * direction[2]) /
    (Math.hypot(...blended) || 1)
  // A blended roll that has swung onto the line of sight carries no roll: keep the look's own.
  const up = onSight < 0.98 ? unit(blended, along.up) : scopeUp(trace.preset, direction)
  return { arc, position: along.position, direction, up }
}
