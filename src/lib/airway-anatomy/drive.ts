import {
  plus,
  minus,
  times,
  scalar,
  magnitude,
  type OpticalFrame,
  type LumenCollider,
} from '../bronchoscopy-core/frame'
import { buildScopePathLps, moveScope, sampleEdgePose, type ScopeState } from './scope-state'
import type { AirwayGraph, Vec3 } from './types'
import type { TransportFrames } from './transport-frames'

export const FLEXIBLE_TIP_RADIUS_MM = 1.9
export const MAX_SCOPE_PATH_POINTS = 8192

export function locateTip(graph: AirwayGraph, tip: Vec3, currentEdgeId: number) {
  const current = graph.edges.find((e) => e.id === currentEdgeId)!
  const related = new Set([current.startNodeId, current.endNodeId])
  let result = { edgeId: currentEdgeId, distanceMm: 0, error: Infinity }
  for (const edge of graph.edges) {
    if (!related.has(edge.startNodeId) && !related.has(edge.endNodeId)) continue
    let travel = 0
    for (let i = 1; i < edge.pointsLps.length; i++) {
      const a = edge.pointsLps[i - 1],
        b = edge.pointsLps[i],
        ab = minus(b, a),
        length = magnitude(ab)
      const t = Math.max(
        0,
        Math.min(1, scalar(minus(tip, a), ab) / Math.max(length * length, 1e-9)),
      )
      const error = magnitude(minus(tip, plus(a, times(ab, t))))
      if (error < result.error) result = { edgeId: edge.id, distanceMm: travel + t * length, error }
      travel += length
    }
  }
  return result
}
export function enterFreeDrive(
  state: ScopeState,
  frame: OpticalFrame,
  graph: AirwayGraph,
): ScopeState {
  return {
    ...state,
    freeFrame: frame,
    freePath: [...buildScopePathLps(graph, state.edgeId, state.distanceMm), frame.position],
  }
}
/** Guided positions stay on the graph; free positions advance along the optical frame. */
export function driveScope(
  state: ScopeState,
  deltaMm: number,
  graph: AirwayGraph,
  frames: TransportFrames,
  frame: OpticalFrame,
  collider: LumenCollider | null,
): ScopeState {
  if (!Number.isFinite(deltaMm)) return state
  let next = { ...state, movementMessage: undefined as string | undefined }
  let remaining = Math.max(-50, Math.min(50, deltaMm))
  while (Math.abs(remaining) > 1e-6) {
    const step = Math.sign(remaining) * Math.min(0.25, Math.abs(remaining))
    remaining -= step
    if (next.freeFrame && collider) {
      const f = next.freeFrame,
        path = [...(next.freePath ?? [f.position])]
      if (step > 0 && path.length >= MAX_SCOPE_PATH_POINTS)
        return {
          ...next,
          movementMessage: 'Insertion history limit reached. Withdraw to continue.',
        }
      let target = plus(f.position, times(f.forward, step))
      if (step < 0 && path.length > 1) {
        let back = -step,
          tip = f.position
        while (path.length > 1 && back > 0) {
          const previous = path[path.length - 2],
            length = magnitude(minus(tip, previous))
          if (length <= back) {
            back -= length
            tip = previous
            path.pop()
          } else {
            tip = plus(tip, times(minus(previous, tip), back / length))
            back = 0
            path[path.length - 1] = tip
          }
        }
        target = tip
      }
      const swept = collider.sweep(f.position, target, FLEXIBLE_TIP_RADIUS_MM)
      // A rejected withdrawal must not consume the recorded shaft path.
      if (step < 0 && swept.contact.blockedMm > 0.001)
        return { ...next, movementMessage: 'Wall contact — redirect the tip before withdrawing.' }
      if (step > 0 && magnitude(minus(swept.point, f.position)) > 0.001) path.push(swept.point)
      const located = locateTip(graph, swept.point, next.edgeId)
      next = {
        ...next,
        edgeId: located.edgeId,
        distanceMm: located.distanceMm,
        freeFrame: { ...f, position: swept.point },
        freePath: path,
        trailLps: [...next.trailLps, swept.point].slice(-180),
        movementMessage:
          swept.contact.blockedMm > 0.001
            ? 'Wall contact — withdraw or redirect the tip.'
            : undefined,
      }
      if (swept.contact.blockedMm > 0.001) break
    } else {
      const old = sampleEdgePose(
        graph.edges.find((e) => e.id === next.edgeId)!,
        next.distanceMm,
      ).point
      const moved = moveScope(next, graph, step, {
        requireAim: true,
        viewForward: frame.forward,
        trailMaxPoints: 180,
      })
      if (moved.movementMessage) return moved
      const target = sampleEdgePose(
        graph.edges.find((e) => e.id === moved.edgeId)!,
        moved.distanceMm,
      ).point
      if (collider && collider.sweep(old, target, 0.12).contact.blockedMm > 0.001)
        return { ...next, movementMessage: 'End of the visible lumen. Withdraw to continue.' }
      next = { ...moved, movementMessage: undefined }
      // At a junction preserve viewing direction relative to the transported child frame.
      if (next.edgeId !== state.edgeId) {
        const base = frames.at(next.edgeId, next.distanceMm)
        next.yawDeg =
          (Math.atan2(-scalar(frame.forward, base.right), scalar(frame.forward, base.forward)) *
            180) /
          Math.PI
        next.pitchDeg =
          (Math.asin(Math.max(-1, Math.min(1, scalar(frame.forward, base.up)))) * 180) / Math.PI
      }
    }
  }
  return next
}
