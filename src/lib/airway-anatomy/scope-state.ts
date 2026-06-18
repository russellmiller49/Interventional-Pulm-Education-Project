import {
  add,
  clamp,
  cross,
  distance,
  dot,
  lerpVec3,
  normalize,
  rotateAroundAxis,
  scale,
  subtract,
} from './geometry'
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

export const YAW_LIMIT_DEG = 60
export const PITCH_LIMIT_DEG = 60
export const ROLL_LIMIT_DEG = 90

/** How far down a child branch we probe when comparing it against the view direction. */
const BRANCH_PROBE_MM = 8

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

export interface ViewBasis {
  forward: Vec3
  right: Vec3
  up: Vec3
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

/**
 * Camera basis for the endoluminal view. Must stay in lockstep with the
 * quaternion math in the bronchoscopy <ScopeCamera> so that screen-space
 * projections and steered branch selection agree with what the user sees.
 */
export function computeViewBasis(
  baseForward: Vec3,
  yawDeg: number,
  pitchDeg: number,
  rollDeg = 0,
): ViewBasis {
  let forward = normalize(baseForward)
  // Patient-view basis for this Slicer export: the right mainstem has
  // negative LPS X coordinates, so it should project to screen-right.
  const upHint: Vec3 = [0, -1, 0]
  let right = normalize(cross(forward, upHint), [1, 0, 0])
  let up = normalize(cross(right, forward))

  const yawRad = (yawDeg * Math.PI) / 180
  const pitchRad = (pitchDeg * Math.PI) / 180
  const rollRad = (rollDeg * Math.PI) / 180

  forward = rotateAroundAxis(forward, up, yawRad)
  right = rotateAroundAxis(right, up, yawRad)
  forward = rotateAroundAxis(forward, right, pitchRad)
  up = rotateAroundAxis(up, right, pitchRad)
  if (rollRad !== 0) {
    const cameraZ = scale(forward, -1)
    right = rotateAroundAxis(right, cameraZ, rollRad)
    up = rotateAroundAxis(up, cameraZ, rollRad)
  }

  return { forward, right, up }
}

/**
 * Free-drive advance/withdraw. Crossing a bifurcation enters the child branch
 * best aligned with the current steered view direction, like driving a real
 * scope: deflect the tip toward an ostium, then push forward.
 */
export function moveScope(
  state: ScopeState,
  graph: AirwayGraph,
  deltaMm: number,
  options: { trailMaxPoints?: number; lookAheadMm?: number } = {},
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
      if (!childEdgeIds.length || !endNode) {
        remaining = 0
        break
      }
      const chosenEdgeId =
        childEdgeIds.length === 1
          ? childEdgeIds[0]
          : steeredChildEdgeId(index, edge, endNode, next, options.lookAheadMm ?? 12)
      next = { ...next, edgeId: chosenEdgeId, distanceMm: 0 }
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

function steeredChildEdgeId(
  index: AirwayGraphIndex,
  edge: AirwayGraphEdge,
  node: AirwayGraphNode,
  state: ScopeState,
  lookAheadMm: number,
): number {
  const base = baseForwardAt(index, edge, edge.lengthMm, lookAheadMm)
  const { forward } = computeViewBasis(base, state.yawDeg, state.pitchDeg, 0)

  let bestEdgeId = node.childEdgeIds[0]
  let bestDot = Number.NEGATIVE_INFINITY
  for (const childEdgeId of node.childEdgeIds) {
    const child = requireEdge(index, childEdgeId)
    const probe = sampleEdgePose(child, Math.min(BRANCH_PROBE_MM, child.lengthMm)).point
    const direction = normalize(subtract(probe, node.lps))
    const alignment = dot(forward, direction)
    if (alignment > bestDot) {
      bestDot = alignment
      bestEdgeId = childEdgeId
    }
  }
  return bestEdgeId
}

/**
 * Point the steered view at the ostium of a child branch (used when a user
 * taps an in-view branch label). Decomposes the desired direction into the
 * yaw-then-pitch convention used by computeViewBasis.
 */
export function alignViewToBranch(
  state: ScopeState,
  graph: AirwayGraph,
  branchEdgeId: number,
  lookAheadMm = 12,
): ScopeState {
  const index = createGraphIndex(graph)
  const edge = requireEdge(index, state.edgeId)
  const child = index.edgesById.get(branchEdgeId)
  if (!child) return state

  const tip = sampleEdgePose(edge, state.distanceMm).point
  const base = baseForwardAt(index, edge, state.distanceMm, lookAheadMm)
  const { forward, right, up } = computeViewBasis(base, 0, 0, 0)
  const ostium = sampleEdgePose(child, Math.min(BRANCH_PROBE_MM, child.lengthMm)).point
  const target = normalize(subtract(ostium, tip))

  const pitchDeg = (Math.asin(clamp(dot(target, up), -1, 1)) * 180) / Math.PI
  const yawDeg = (Math.atan2(-dot(target, right), dot(target, forward)) * 180) / Math.PI
  return updateLookOffset(state, { yawDeg, pitchDeg })
}

/**
 * The insertion path of the scope shaft: root of the tree down to the current
 * tip. Used to render the scope body in the 3D correlation view.
 */
export function buildScopePathLps(graph: AirwayGraph, edgeId: number, distanceMm: number): Vec3[] {
  const index = createGraphIndex(graph)
  const edge = index.edgesById.get(edgeId)
  if (!edge) return []

  const segments: Vec3[][] = [pointsUntilDistance(edge, distanceMm)]
  let node = index.nodesById.get(edge.startNodeId)
  let guard = 0
  while (node?.parentEdgeId != null && guard < graph.edges.length + 2) {
    guard += 1
    const parent = index.edgesById.get(node.parentEdgeId)
    if (!parent) break
    segments.push(parent.pointsLps)
    node = index.nodesById.get(parent.startNodeId)
  }
  segments.reverse()
  return segments.flat()
}

export function updateLookOffset(
  state: ScopeState,
  nextOffset: Partial<Pick<ScopeState, 'yawDeg' | 'pitchDeg' | 'rollDeg'>>,
): ScopeState {
  return {
    ...state,
    yawDeg: clamp(nextOffset.yawDeg ?? state.yawDeg, -YAW_LIMIT_DEG, YAW_LIMIT_DEG),
    pitchDeg: clamp(nextOffset.pitchDeg ?? state.pitchDeg, -PITCH_LIMIT_DEG, PITCH_LIMIT_DEG),
    rollDeg: clamp(nextOffset.rollDeg ?? state.rollDeg, -ROLL_LIMIT_DEG, ROLL_LIMIT_DEG),
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
    endNode && endNode.childEdgeIds.length > 1 ? buildBranchOptions(index, endNode, labels) : []

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

function baseForwardAt(
  index: AirwayGraphIndex,
  edge: AirwayGraphEdge,
  distanceMm: number,
  lookAheadMm: number,
): Vec3 {
  const sample = sampleEdgePose(edge, distanceMm)
  const look = sampleLookAhead(index, edge, distanceMm, lookAheadMm)
  return normalize(subtract(look, sample.point), sample.tangent)
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
