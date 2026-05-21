import {
  computeOverlayCalibrationTranslation,
  createRotationMatrix,
  rotateVec,
  subtract,
} from './geometry'
import type {
  AirwayGraph,
  AirwayGraphEdge,
  AirwayGraphNode,
  CtAxis,
  CtVolumePreview,
  FluoroConfig,
  Vec2,
  Vec3,
} from './types'

export interface AirwaySnapResult {
  lps: Vec3
  distanceMm: number
  edgeId: number
  routeTerminalNodeId: number
}

export interface RoutePath {
  terminalNodeId: number
  points: Vec3[]
  lengthMm: number
}

export interface RouteSample {
  point: Vec3
  distanceMm: number
  progress: number
}

export interface DetectorProjection {
  point: Vec2
  inFrame: boolean
  depthMm: number
}

export function lpsToCtIndex(lps: Vec3, ct: CtVolumePreview): Vec3 {
  return [
    (lps[0] - ct.originLps[0]) / ct.spacingXyzMm[0],
    (lps[1] - ct.originLps[1]) / ct.spacingXyzMm[1],
    (lps[2] - ct.originLps[2]) / ct.spacingXyzMm[2],
  ]
}

export function ctIndexToLps(index: Vec3, ct: CtVolumePreview): Vec3 {
  return [
    ct.originLps[0] + index[0] * ct.spacingXyzMm[0],
    ct.originLps[1] + index[1] * ct.spacingXyzMm[1],
    ct.originLps[2] + index[2] * ct.spacingXyzMm[2],
  ]
}

export function canvasPointToLps(
  x: number,
  y: number,
  width: number,
  height: number,
  axis: CtAxis,
  sliceIndex: number,
  ct: CtVolumePreview,
): Vec3 {
  const normalizedX = clamp(x / Math.max(width, 1), 0, 1)
  const normalizedY = clamp(y / Math.max(height, 1), 0, 1)
  const [sx, sy, sz] = ct.sizeXyz
  if (axis === 'axial') {
    return ctIndexToLps([normalizedX * (sx - 1), normalizedY * (sy - 1), sliceIndex], ct)
  }
  if (axis === 'coronal') {
    return ctIndexToLps([normalizedX * (sx - 1), sliceIndex, (1 - normalizedY) * (sz - 1)], ct)
  }
  return ctIndexToLps([sliceIndex, normalizedX * (sy - 1), (1 - normalizedY) * (sz - 1)], ct)
}

export function projectLpsToCanvas(
  lps: Vec3,
  axis: CtAxis,
  sliceIndex: number,
  ct: CtVolumePreview,
  width: number,
  height: number,
): { x: number; y: number; distanceFromSlice: number; inFrame: boolean } {
  const [i, j, k] = lpsToCtIndex(lps, ct)
  const [sx, sy, sz] = ct.sizeXyz
  let x = 0
  let y = 0
  let depth = 0
  if (axis === 'axial') {
    x = (i / Math.max(sx - 1, 1)) * width
    y = (j / Math.max(sy - 1, 1)) * height
    depth = k
  } else if (axis === 'coronal') {
    x = (i / Math.max(sx - 1, 1)) * width
    y = (1 - k / Math.max(sz - 1, 1)) * height
    depth = j
  } else {
    x = (j / Math.max(sy - 1, 1)) * width
    y = (1 - k / Math.max(sz - 1, 1)) * height
    depth = i
  }
  return {
    x,
    y,
    distanceFromSlice: Math.abs(depth - sliceIndex),
    inFrame: x >= 0 && x <= width && y >= 0 && y <= height,
  }
}

export function findNearestAirwayPoint(
  graph: AirwayGraph,
  lps: Vec3,
  snapRadiusMm: number,
): AirwaySnapResult | null {
  let best: AirwaySnapResult | null = null
  for (const edge of graph.edges) {
    for (const point of edge.pointsLps) {
      const distanceMm = distance(point, lps)
      if (!best || distanceMm < best.distanceMm) {
        best = {
          lps: point,
          distanceMm,
          edgeId: edge.id,
          routeTerminalNodeId: deepestTerminalForEdge(graph, edge),
        }
      }
    }
  }
  return best && best.distanceMm <= snapRadiusMm ? best : null
}

export function buildRoutePath(graph: AirwayGraph, terminalNodeId: number): RoutePath {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]))
  const edgeMap = new Map(graph.edges.map((edge) => [edge.id, edge]))
  const edges: AirwayGraphEdge[] = []
  let node: AirwayGraphNode | undefined = nodeMap.get(terminalNodeId)
  while (node?.parentEdgeId != null && node.parentNodeId != null) {
    const edge = edgeMap.get(node.parentEdgeId)
    if (!edge) break
    edges.push(edge)
    node = nodeMap.get(node.parentNodeId)
  }
  edges.reverse()

  const points: Vec3[] = []
  for (const edge of edges) {
    const edgePoints = edge.pointsLps
    if (!points.length) {
      points.push(...edgePoints)
    } else {
      points.push(
        ...edgePoints.slice(pointsEqual(points[points.length - 1], edgePoints[0]) ? 1 : 0),
      )
    }
  }
  return { terminalNodeId, points, lengthMm: polylineLength(points) }
}

export function sampleRoutePath(route: RoutePath, progress: number): RouteSample {
  const targetDistance = clamp(progress, 0, 1) * route.lengthMm
  if (!route.points.length) {
    return { point: [0, 0, 0], distanceMm: 0, progress: 0 }
  }
  if (targetDistance <= 0) {
    return { point: route.points[0], distanceMm: 0, progress: 0 }
  }
  let travelled = 0
  for (let index = 1; index < route.points.length; index += 1) {
    const prev = route.points[index - 1]
    const next = route.points[index]
    const segmentLength = distance(prev, next)
    if (travelled + segmentLength >= targetDistance) {
      const t = (targetDistance - travelled) / Math.max(segmentLength, 1e-6)
      return {
        point: lerpVec(prev, next, t),
        distanceMm: targetDistance,
        progress: clamp(progress, 0, 1),
      }
    }
    travelled += segmentLength
  }
  return { point: route.points[route.points.length - 1], distanceMm: route.lengthMm, progress: 1 }
}

export function projectLpsToDetector(
  point: Vec3,
  config: FluoroConfig,
  raoLaoDeg: number,
  cranialCaudalDeg: number,
): DetectorProjection {
  const rotationMatrix = createRotationMatrix(-raoLaoDeg, -cranialCaudalDeg)
  const local = subtract(point, config.isocenter_mm)
  const rotated = rotateVec(rotationMatrix, local)
  const calibrationOffset = computeOverlayCalibrationTranslation(config, rotationMatrix)
  const translated: Vec3 = [
    rotated[0] + calibrationOffset[0],
    rotated[1] + calibrationOffset[1],
    rotated[2] + calibrationOffset[2],
  ]
  const sourceToPoint = config.source_to_isocenter_mm + translated[1]
  const magnification = config.source_to_isocenter_mm / Math.max(sourceToPoint, 1)
  const detectorWidthMm = config.detector_pixels[0] * config.pixel_pitch_mm
  const detectorHeightMm = config.detector_pixels[1] * config.pixel_pitch_mm
  const x = 50 + ((translated[0] * magnification) / detectorWidthMm) * 100
  const y = 50 - ((translated[2] * magnification) / detectorHeightMm) * 100
  return {
    point: [x, y],
    inFrame: x >= -5 && x <= 105 && y >= -5 && y <= 105,
    depthMm: translated[1],
  }
}

export function routeOptions(graph: AirwayGraph, limit = 24): Array<{ id: number; label: string }> {
  return graph.terminalNodeIds
    .map((nodeId) => graph.nodes[nodeId])
    .filter(Boolean)
    .sort((a, b) => b.rootDistanceMm - a.rootDistanceMm || a.id - b.id)
    .slice(0, limit)
    .map((node, index) => ({
      id: node.id,
      label: `Distal route ${index + 1} (${node.rootDistanceMm.toFixed(0)} mm)`,
    }))
}

function deepestTerminalForEdge(graph: AirwayGraph, edge: AirwayGraphEdge): number {
  const descendants = collectTerminalDescendants(graph, edge.endNodeId)
  if (!descendants.length) return edge.endNodeId
  return descendants.sort(
    (a, b) => graph.nodes[b].rootDistanceMm - graph.nodes[a].rootDistanceMm || a - b,
  )[0]
}

function collectTerminalDescendants(graph: AirwayGraph, nodeId: number): number[] {
  const stack = [nodeId]
  const terminals: number[] = []
  while (stack.length) {
    const current = stack.pop()
    if (current == null) continue
    const node = graph.nodes[current]
    if (!node) continue
    if (node.kind === 'terminal' || !node.childEdgeIds.length) {
      terminals.push(current)
      continue
    }
    for (const edgeId of node.childEdgeIds) {
      const edge = graph.edges.find((item) => item.id === edgeId)
      if (edge) stack.push(edge.endNodeId)
    }
  }
  return terminals
}

function polylineLength(points: Vec3[]): number {
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index])
  }
  return total
}

function pointsEqual(a: Vec3, b: Vec3): boolean {
  return distance(a, b) < 0.001
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
