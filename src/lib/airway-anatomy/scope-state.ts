import { add, clamp, distance, lerpVec3, normalize, scale, subtract } from './geometry'
import type {
  AirwayGraph,
  AirwayGraphEdge,
  AirwayGraphNode,
  BranchOption,
  CenterlineLabels,
  ScopePoseSnapshot,
  Vec3,
} from './types'

const CHOICE_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export interface AirwayGraphIndex {
  nodesById: Map<number, AirwayGraphNode>
  edgesById: Map<number, AirwayGraphEdge>
}

export interface ScopeState {
  edgeId: number
  distanceMm: number
  trailLps: Vec3[]
  yawDeg: number
  pitchDeg: number
  rollDeg: number
}

export function createGraphIndex(graph: AirwayGraph): AirwayGraphIndex {
  return {
    nodesById: new Map(graph.nodes.map((node) => [node.id, node])),
    edgesById: new Map(graph.edges.map((edge) => [edge.id, edge])),
  }
}

export function createInitialScopeState(
  graph: AirwayGraph,
  defaultEdgeId = 0,
  initialDistanceMm = 0,
): ScopeState {
  const index = createGraphIndex(graph)
  const edge = index.edgesById.get(defaultEdgeId) ?? graph.edges[0]
  const distanceMm = clamp(initialDistanceMm, 0, edge.lengthMm)
  const sample = sampleEdgePose(edge, distanceMm)
  return {
    edgeId: edge.id,
    distanceMm,
    trailLps: [sample.point],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
  }
}

export function moveScope(
  state: ScopeState,
  graph: AirwayGraph,
  deltaMm: number,
  options: { trailMaxPoints?: number; preferredEdgePath?: number[] } = {},
): ScopeState {
  const index = createGraphIndex(graph)
  let next: ScopeState = {
    ...state,
    trailLps: [...state.trailLps],
  }
  let remaining = deltaMm
  let guard = 0

  while (Math.abs(remaining) > 1e-6 && guard < graph.edges.length + 4) {
    guard += 1
    const edge = requireEdge(index, next.edgeId)
    if (remaining > 0) {
      const room = edge.lengthMm - next.distanceMm
      if (remaining <= room) {
        next = { ...next, distanceMm: next.distanceMm + remaining }
        remaining = 0
        break
      }
      next = { ...next, distanceMm: edge.lengthMm }
      remaining -= room
      const endNode = index.nodesById.get(edge.endNodeId)
      const childEdgeIds = endNode?.childEdgeIds ?? []
      const preferredChildEdgeId = preferredChildForBranch(
        childEdgeIds,
        edge.id,
        options.preferredEdgePath,
      )
      if (childEdgeIds.length !== 1 && preferredChildEdgeId == null) {
        remaining = 0
        break
      }
      next = { ...next, edgeId: preferredChildEdgeId ?? childEdgeIds[0], distanceMm: 0 }
    } else {
      const backward = -remaining
      if (backward <= next.distanceMm) {
        next = { ...next, distanceMm: next.distanceMm - backward }
        remaining = 0
        break
      }
      remaining += next.distanceMm
      const startNode = index.nodesById.get(edge.startNodeId)
      if (startNode?.parentEdgeId == null) {
        next = { ...next, distanceMm: 0 }
        remaining = 0
        break
      }
      const parent = requireEdge(index, startNode.parentEdgeId)
      next = { ...next, edgeId: parent.id, distanceMm: parent.lengthMm }
    }
  }

  return appendTrail(next, index, options.trailMaxPoints)
}

function preferredChildForBranch(
  childEdgeIds: number[],
  currentEdgeId: number,
  preferredEdgePath?: number[],
): number | null {
  if (!preferredEdgePath?.length || childEdgeIds.length < 2) {
    return null
  }
  const currentIndex = preferredEdgePath.indexOf(currentEdgeId)
  const nextPreferredEdgeId = currentIndex >= 0 ? preferredEdgePath[currentIndex + 1] : null
  if (nextPreferredEdgeId != null && childEdgeIds.includes(nextPreferredEdgeId)) {
    return nextPreferredEdgeId
  }
  const candidates = childEdgeIds.filter((edgeId) => preferredEdgePath.includes(edgeId))
  return candidates.length === 1 ? candidates[0] : null
}

export function chooseBranch(state: ScopeState, graph: AirwayGraph, edgeId: number): ScopeState {
  const index = createGraphIndex(graph)
  const currentEdge = requireEdge(index, state.edgeId)
  const endNode = index.nodesById.get(currentEdge.endNodeId)
  if (!endNode?.childEdgeIds.includes(edgeId)) {
    return state
  }
  const edge = requireEdge(index, edgeId)
  const sample = sampleEdgePose(edge, 0)
  return {
    ...state,
    edgeId,
    distanceMm: 0,
    trailLps: [...state.trailLps, sample.point],
  }
}

export function updateLookOffset(
  state: ScopeState,
  nextOffset: Partial<Pick<ScopeState, 'yawDeg' | 'pitchDeg' | 'rollDeg'>>,
): ScopeState {
  return {
    ...state,
    yawDeg: clamp(nextOffset.yawDeg ?? state.yawDeg, -25, 25),
    pitchDeg: clamp(nextOffset.pitchDeg ?? state.pitchDeg, -25, 25),
    rollDeg: clamp(nextOffset.rollDeg ?? state.rollDeg, -45, 45),
  }
}

export function buildScopePoseSnapshot({
  state,
  graph,
  labels,
  lookAheadMm,
}: {
  state: ScopeState
  graph: AirwayGraph
  labels?: CenterlineLabels | null
  lookAheadMm: number
}): ScopePoseSnapshot {
  const index = createGraphIndex(graph)
  const edge = requireEdge(index, state.edgeId)
  const edgeSample = sampleEdgePose(edge, state.distanceMm)
  const lookSample = sampleLookAhead(index, edge, state.distanceMm, lookAheadMm)
  const endNode = index.nodesById.get(edge.endNodeId)
  const branchOptions =
    state.distanceMm >= edge.lengthMm - 0.01 && endNode && endNode.childEdgeIds.length > 1
      ? buildBranchOptions(index, endNode, labels)
      : []

  return {
    edgeId: edge.id,
    distanceMm: state.distanceMm,
    edgeLengthMm: edge.lengthMm,
    tipLps: edgeSample.point,
    tangentLps: edgeSample.tangent,
    lookAtLps: lookSample,
    branchNodeId: branchOptions.length ? (endNode?.id ?? null) : null,
    branchOptions,
    trailLps: state.trailLps,
    yawDeg: state.yawDeg,
    pitchDeg: state.pitchDeg,
    rollDeg: state.rollDeg,
  }
}

export function sampleEdgePose(
  edge: AirwayGraphEdge,
  distanceMm: number,
): { point: Vec3; tangent: Vec3 } {
  const points = edge.pointsLps
  if (!points.length) return { point: [0, 0, 0], tangent: [0, 0, -1] }
  if (points.length === 1 || distanceMm <= 0) {
    return {
      point: points[0],
      tangent: normalize(subtract(points[Math.min(1, points.length - 1)], points[0])),
    }
  }

  let travelled = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const next = points[index]
    const segmentLength = distance(previous, next)
    if (travelled + segmentLength >= distanceMm) {
      const t = (distanceMm - travelled) / Math.max(segmentLength, 1e-6)
      return {
        point: lerpVec3(previous, next, t),
        tangent: normalize(subtract(next, previous)),
      }
    }
    travelled += segmentLength
  }

  return {
    point: points[points.length - 1],
    tangent: normalize(subtract(points[points.length - 1], points[points.length - 2])),
  }
}

export function pointsUntilDistance(edge: AirwayGraphEdge, distanceMm: number): Vec3[] {
  const points = edge.pointsLps
  if (!points.length) return []
  const output: Vec3[] = [points[0]]
  if (distanceMm <= 0) return output

  let travelled = 0
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const next = points[index]
    const segmentLength = distance(previous, next)
    if (travelled + segmentLength < distanceMm) {
      output.push(next)
      travelled += segmentLength
      continue
    }
    const t = (distanceMm - travelled) / Math.max(segmentLength, 1e-6)
    output.push(lerpVec3(previous, next, t))
    return output
  }

  return points
}

function appendTrail(state: ScopeState, index: AirwayGraphIndex, trailMaxPoints = 180): ScopeState {
  const sample = sampleEdgePose(requireEdge(index, state.edgeId), state.distanceMm)
  const previous = state.trailLps[state.trailLps.length - 1]
  const trail =
    previous && distance(previous, sample.point) < 0.5
      ? state.trailLps
      : [...state.trailLps, sample.point]
  return {
    ...state,
    trailLps: trail.slice(Math.max(0, trail.length - trailMaxPoints)),
  }
}

function sampleLookAhead(
  index: AirwayGraphIndex,
  edge: AirwayGraphEdge,
  distanceMm: number,
  lookAheadMm: number,
): Vec3 {
  const targetDistance = distanceMm + lookAheadMm
  if (targetDistance <= edge.lengthMm) {
    return sampleEdgePose(edge, targetDistance).point
  }
  const endNode = index.nodesById.get(edge.endNodeId)
  const childEdgeIds = endNode?.childEdgeIds ?? []
  const childDistanceMm = targetDistance - edge.lengthMm
  if (!childEdgeIds.length) {
    return add(
      sampleEdgePose(edge, edge.lengthMm).point,
      scale(sampleEdgePose(edge, edge.lengthMm).tangent, 8),
    )
  }
  if (childEdgeIds.length > 1) {
    const childLookPoints = childEdgeIds.map((childEdgeId) => {
      const child = requireEdge(index, childEdgeId)
      return sampleEdgePose(child, Math.min(childDistanceMm, child.lengthMm)).point
    })
    const total = childLookPoints.reduce<Vec3>((sum, point) => add(sum, point), [0, 0, 0])
    return scale(total, 1 / childLookPoints.length)
  }
  const child = requireEdge(index, childEdgeIds[0])
  return sampleEdgePose(child, Math.min(childDistanceMm, child.lengthMm)).point
}

function buildBranchOptions(
  index: AirwayGraphIndex,
  node: AirwayGraphNode,
  labels?: CenterlineLabels | null,
): BranchOption[] {
  return node.childEdgeIds.map((edgeId, optionIndex) => {
    const edge = requireEdge(index, edgeId)
    const edgeLabel = labels?.edgeLabels[String(edge.id)]
    return {
      edgeId,
      toNodeId: edge.endNodeId,
      label: CHOICE_LABELS[optionIndex] ?? `${optionIndex + 1}`,
      anatomicalLabel: edgeLabel?.abbreviatedLabel,
    }
  })
}

function requireEdge(index: AirwayGraphIndex, edgeId: number): AirwayGraphEdge {
  const edge = index.edgesById.get(edgeId)
  if (!edge) {
    throw new Error(`Missing airway graph edge ${edgeId}`)
  }
  return edge
}
