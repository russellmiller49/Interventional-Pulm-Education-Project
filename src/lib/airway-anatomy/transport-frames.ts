import {
  makeFrame,
  minus,
  plus,
  times,
  scalar,
  rollFrame,
  transport,
  unit,
  vector,
  rotate,
  type OpticalFrame,
} from '../bronchoscopy-core/frame'
import { sampleEdgePose } from './scope-state'
import type { AirwayGraph, OrientationLandmark, ScopePoseSnapshot, Vec3 } from './types'

export interface TransportFrames {
  at(edgeId: number, distanceMm: number): OpticalFrame
}
/** Built once per case/profile. Corrections are inherited through the tree, not reset at forks. */
export function buildTransportFrames(
  graph: AirwayGraph,
  landmarks: OrientationLandmark[] = [],
): TransportFrames {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const edges = new Map(graph.edges.map((e) => [e.id, e]))
  const samples = new Map<number, { distances: number[]; frames: OpticalFrame[] }>()
  const walk = (edgeId: number, parent: OpticalFrame | null) => {
    const edge = edges.get(edgeId)!
    const distances: number[] = [],
      frames: OpticalFrame[] = []
    const count = Math.max(2, Math.ceil(edge.lengthMm / 1.5))
    let previous = parent
    for (let i = 0; i <= count; i++) {
      const d = (edge.lengthMm * i) / count,
        p = sampleEdgePose(edge, d).point
      const behind = sampleEdgePose(edge, Math.max(0, d - 2)).point
      const ahead = sampleEdgePose(edge, Math.min(edge.lengthMm, d + 2)).point
      const forward = unit(minus(ahead, behind))
      const frame = previous ? transport(previous, p, forward) : makeFrame(p, forward)
      frames.push(frame)
      distances.push(d)
      previous = frame
    }
    samples.set(edgeId, { distances, frames })
    const landmark = landmarks.find((l) => l.edgeId === edgeId)
    if (landmark && edges.has(landmark.targetEdgeId)) {
      // The reviewed starting view looks at the ostial group. Centerline tangents near
      // a junction can otherwise point predominantly into one daughter branch.
      const children = (nodes.get(edge.endNodeId)?.childEdgeIds ?? [])
        .map((id) => edges.get(id)!)
        .filter(Boolean)
      if (children.length > 1) {
        const anchors = children.map(
          (child) => sampleEdgePose(child, Math.min(4, child.lengthMm * 0.5)).point,
        )
        const center = times(
          anchors.reduce((a, p) => plus(a, p), [0, 0, 0] as Vec3),
          1 / anchors.length,
        )
        for (let i = 0; i < frames.length; i++) {
          const t = Math.min(1, distances[i] / Math.max(landmark.distanceMm, 1)),
            weight = t * t * (3 - 2 * t)
          const desired = unit(minus(center, frames[i].position))
          // Stop steering toward the ostial center once the tip passes the reference.
          const referenceDirection = unit(
            minus(center, sampleEdgePose(edge, landmark.distanceMm).point),
          )
          frames[i] = transport(
            frames[i],
            frames[i].position,
            unit(
              plus(
                times(frames[i].forward, 1 - weight),
                times(distances[i] <= landmark.distanceMm ? desired : referenceDirection, weight),
              ),
            ),
          )
        }
      }
      const reference = at(edgeId, landmark.distanceMm)
      const targetEdge = edges.get(landmark.targetEdgeId)!
      const target = sampleEdgePose(targetEdge, Math.min(7, targetEdge.lengthMm * 0.6)).point
      const opposite = landmark.oppositeEdgeId != null ? edges.get(landmark.oppositeEdgeId) : null
      const from = opposite
        ? sampleEdgePose(opposite, Math.min(7, opposite.lengthMm * 0.6)).point
        : reference.position
      const offset = minus(target, from)
      const currentAngle = Math.atan2(scalar(offset, reference.up), scalar(offset, reference.right))
      const desired = landmark.screenDirection === 'up' ? Math.PI / 2 : Math.PI
      const correction =
        (Math.atan2(Math.sin(currentAngle - desired), Math.cos(currentAngle - desired)) * 180) /
        Math.PI
      for (let i = 0; i < frames.length; i++) {
        const t = Math.min(1, distances[i] / Math.max(landmark.distanceMm, 1))
        frames[i] = rollFrame(frames[i], correction * t * t * (3 - 2 * t))
      }
    }
    for (const child of nodes.get(edge.endNodeId)?.childEdgeIds ?? [])
      walk(child, frames[frames.length - 1])
  }
  function at(edgeId: number, distanceMm: number): OpticalFrame {
    const data = samples.get(edgeId)
    if (!data) return makeFrame([0, 0, 0], [0, 0, -1])
    let i = 0
    while (i < data.distances.length - 2 && data.distances[i + 1] < distanceMm) i++
    const t = Math.max(
      0,
      Math.min(
        1,
        (distanceMm - data.distances[i]) /
          Math.max(1e-6, data.distances[i + 1] - data.distances[i]),
      ),
    )
    const a = data.frames[i],
      b = data.frames[i + 1]
    const blend = (x: Vec3, y: Vec3) => plus(times(x, 1 - t), times(y, t))
    return makeFrame(blend(a.position, b.position), blend(a.forward, b.forward), blend(a.up, b.up))
  }
  for (const edgeId of nodes.get(graph.rootNodeId)?.childEdgeIds ?? []) walk(edgeId, null)
  return { at }
}

export function poseWithTransport(
  pose: ScopePoseSnapshot,
  frames: TransportFrames,
): ScopePoseSnapshot {
  if (pose.opticalFrame) return pose
  const base = frames.at(pose.edgeId, pose.distanceMm)
  let forward = rotate(base.forward, base.up, (pose.yawDeg * Math.PI) / 180)
  const right = rotate(base.right, base.up, (pose.yawDeg * Math.PI) / 180)
  forward = rotate(forward, right, (pose.pitchDeg * Math.PI) / 180)
  const up = rotate(base.up, right, (pose.pitchDeg * Math.PI) / 180)
  const opticalFrame = rollFrame(makeFrame(pose.tipLps, forward, up), pose.rollDeg)
  return { ...pose, opticalFrame, lookAtLps: plus(pose.tipLps, times(forward, 12)) }
}

export function scopeOpticalFrame(pose: ScopePoseSnapshot): OpticalFrame {
  if (pose.opticalFrame) return pose.opticalFrame
  const base = makeFrame(pose.tipLps, minus(pose.lookAtLps, pose.tipLps))
  let forward = rotate(base.forward, base.up, (pose.yawDeg * Math.PI) / 180)
  const right = rotate(base.right, base.up, (pose.yawDeg * Math.PI) / 180)
  forward = rotate(forward, right, (pose.pitchDeg * Math.PI) / 180)
  return rollFrame(makeFrame(pose.tipLps, forward, unit(vector(right, forward))), pose.rollDeg)
}
