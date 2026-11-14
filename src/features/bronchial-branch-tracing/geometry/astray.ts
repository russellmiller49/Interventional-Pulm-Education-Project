import children from './off-route-children.json'
import type { CtTrace } from '../content/ct-types'
import type { Vec3 } from './coordinates'
import { NATIVE_CT } from './native-ct'
import { edgePoints, pairedPath } from './paired-scope'
import { cameraBasis } from './reference-frames'
import {
  STATION_BACK_MM,
  blendPose,
  forkArc,
  scopeUp,
  stationCamera,
  type ScopePose,
  type StationCamera,
} from './route-stations'

/**
 * A turn into a daughter the route does not take, and back out.
 *
 * The scope leaves the fork's station, drives into the other daughter and stops short of that
 * daughter's own next division, looking at it: a view that does not match the map. Backing out
 * retraces the same path to the fork's station. The route's own drives are untouched.
 *
 * Everything here is patient space. The daughter's next division comes from
 * `off-route-children.json`, one generation past each daughter the routes do not take.
 */

/** The scope never stops nearer the fork than this, so the view has left the parent airway. */
export const MIN_ASTRAY_MM = 2
/** Where the next division's openings are framed: this far into each of its branches. */
const NEXT_FRAME_MM = 6

interface PathLine {
  points: Vec3[]
  arcs: number[]
}

const childrenOf = new Map(
  children.children.map((entry) => [
    entry.parentEdgeId,
    entry.edges.map((edge) => ({ id: edge.id, points: edge.points as Vec3[] })),
  ]),
)
/** The branches at the next division of a daughter the routes do not take; empty where it ends. */
export const nextBranches = (edgeId: number) => childrenOf.get(edgeId) ?? []
/** An airway's radius in the source model, where known. */
export const edgeRadiusMm = (edgeId: number): number | null =>
  (children.radii as Record<string, number>)[String(edgeId)] ?? null

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

function line(points: Vec3[]): PathLine {
  const arcs = [0]
  for (let i = 1; i < points.length; i++)
    arcs.push(arcs[i - 1] + distance(points[i - 1], points[i]))
  return { points, arcs }
}
function sample(path: PathLine, arc: number): Vec3 {
  const last = path.arcs[path.arcs.length - 1]
  const at = Math.max(0, Math.min(last, arc))
  let i = path.arcs.findIndex((value) => value >= at)
  if (i < 1) i = 1
  const span = path.arcs[i] - path.arcs[i - 1]
  const f = span > 0 ? (at - path.arcs[i - 1]) / span : 0
  const a = path.points[i - 1],
    b = path.points[i]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}
const unit = (v: readonly number[]): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / length, v[1] / length, v[2] / length]
}

export interface AstrayPath extends PathLine {
  /** Arc length of the fork on this path. */
  forkArc: number
  /** The daughter turned into. */
  edgeId: number
  /** True when the airway model ends in this daughter: there is no next division to see. */
  ends: boolean
}

const paths = new Map<string, AstrayPath | null>()
/**
 * The route from the top of the trachea to the fork, then on into the daughter at `optionIndex`.
 * Null for the route's own daughter, or one without a centreline.
 */
export function astrayPath(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
): AstrayPath | null {
  const key = `${trace.id}:${checkpointIndex}:${optionIndex}`
  if (paths.has(key)) return paths.get(key)!
  const checkpoint = trace.checkpoints[checkpointIndex]
  const option = checkpoint?.decision?.options[optionIndex]
  const fork = forkArc(trace, checkpointIndex)
  const daughter = option ? edgePoints(option.sourceEdgeId) : null
  let result: AstrayPath | null = null
  if (option && fork !== null && daughter && option.sourceEdgeId !== checkpoint.sourceEdgeId) {
    const route = pairedPath(trace)
    const prefix = route.points.filter((_, i) => route.arcs[i] < fork - 1e-6)
    const points = [...prefix, ...daughter]
    const built = line(points)
    const forkAt = built.arcs[prefix.length]
    result = {
      ...built,
      forkArc: forkAt,
      edgeId: option.sourceEdgeId,
      ends: nextBranches(option.sourceEdgeId).length === 0,
    }
  }
  paths.set(key, result)
  return result
}

export interface AstrayStop extends ScopePose {
  /** How far into the daughter the scope stopped. */
  intoMm: number
  /** The daughter's own length to its next division, or to where the model ends. */
  lengthMm: number
}

const stops = new Map<string, AstrayStop | null>()
/**
 * Where the scope stops in the other daughter: `STATION_BACK_MM` short of that daughter's next
 * division and at least `MIN_ASTRAY_MM` in, aimed between the next division's openings. Where the
 * model ends in that daughter, it stops short of the end, looking along it.
 */
export function astrayStop(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
): AstrayStop | null {
  const key = `${trace.id}:${checkpointIndex}:${optionIndex}`
  if (stops.has(key)) return stops.get(key)!
  const path = astrayPath(trace, checkpointIndex, optionIndex)
  let stop: AstrayStop | null = null
  if (path) {
    const end = path.arcs[path.arcs.length - 1]
    const lengthMm = end - path.forkArc
    const intoMm = Math.max(Math.min(MIN_ASTRAY_MM, lengthMm * 0.5), lengthMm - STATION_BACK_MM)
    const arc = path.forkArc + intoMm
    const position = sample(path, arc)
    const next = nextBranches(path.edgeId)
    const aim: Vec3 = next.length
      ? (next
          .map((branch) => {
            const branchLine = line(branch.points)
            return sample(branchLine, NEXT_FRAME_MM)
          })
          .reduce((sum, p) => [sum[0] + p[0], sum[1] + p[1], sum[2] + p[2]], [0, 0, 0])
          .map((v) => v / next.length) as Vec3)
      : sample(path, end)
    const lookFrom = next.length ? position : sample(path, Math.max(path.forkArc, arc - 1))
    const direction = unit([aim[0] - lookFrom[0], aim[1] - lookFrom[1], aim[2] - lookFrom[2]])
    stop = { arc, position, direction, up: scopeUp(trace.preset, direction), intoMm, lengthMm }
  }
  stops.set(key, stop)
  return stop
}

/** The scope travelling on the turned-into path, looking `aheadMm` farther along it. */
function poseOnPath(trace: CtTrace, path: AstrayPath, arc: number, aheadMm = STATION_BACK_MM) {
  const end = path.arcs[path.arcs.length - 1]
  const at = Math.max(0, Math.min(end, arc))
  const position = sample(path, at)
  const ahead = Math.min(end, at + aheadMm)
  const from = ahead - at < 1 ? sample(path, Math.max(0, ahead - aheadMm)) : position
  const direction = unit([0, 1, 2].map((axis) => sample(path, ahead)[axis] - from[axis]))
  return { arc: at, position, direction, up: scopeUp(trace.preset, direction) }
}

export interface AstrayDrive {
  path: AstrayPath
  fromArc: number
  toArc: number
  from: ScopePose
  to: ScopePose
}
/** Into the other daughter, from the fork's station to where the scope stops. */
export function astrayIn(trace: CtTrace, checkpointIndex: number, optionIndex: number) {
  const path = astrayPath(trace, checkpointIndex, optionIndex)
  const station = stationCamera(trace, checkpointIndex)
  const stop = astrayStop(trace, checkpointIndex, optionIndex)
  if (!path || !station || !stop) return null
  return { path, fromArc: station.arc, toArc: stop.arc, from: station, to: stop } as AstrayDrive
}
/** Back out to the fork's station, the same way. */
export function astrayOut(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
): AstrayDrive | null {
  const drive = astrayIn(trace, checkpointIndex, optionIndex)
  if (!drive) return null
  return {
    path: drive.path,
    fromArc: drive.toArc,
    toArc: drive.fromArc,
    from: drive.to,
    to: drive.from,
  }
}
/** The scope part-way through a turn in or a back-out. */
export function astrayPose(trace: CtTrace, drive: AstrayDrive, progress: number): ScopePose {
  const t = Math.max(0, Math.min(1, progress))
  const arc = drive.fromArc + (drive.toArc - drive.fromArc) * t
  return blendPose(poseOnPath(trace, drive.path, arc), drive.from, drive.to, t, trace.preset)
}
/** Length of a turn in or back-out, for timing the drive. */
export const astrayLengthMm = (drive: AstrayDrive) => Math.abs(drive.toArc - drive.fromArc)

/** The CT slice the scope tip lies on, inside the planes the module ships (239–478). */
export const tipSlice = (pose: { position: readonly number[] }) =>
  Math.max(
    239,
    Math.min(478, Math.round((pose.position[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])),
  )

/** The station pose a back-out returns to, for checks. */
export const returnPose = (trace: CtTrace, checkpointIndex: number): StationCamera | null =>
  stationCamera(trace, checkpointIndex)

/** The camera basis at a stop, for the openings the scope view numbers there. */
export const stopBasis = (stop: ScopePose) => cameraBasis(stop.direction, stop.up)
