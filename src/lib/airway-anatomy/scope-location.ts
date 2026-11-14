import { edgePathToNode } from './airway-game'
import { shortAnatomicalLabel } from './ostia'
import type { AirwayGraph, AirwayGraphNode, CenterlineLabels } from './types'

/**
 * Where the scope tip is, in the airway's own names.
 *
 * The synchronized module reports this to an embedding lesson on every change of edge, so a lesson
 * can tell "reached the spout" from "turned into the fornix" without reading the renderer. Pure:
 * the same graph, labels and pose give the same answer in a test, a frame script or the browser.
 */
export interface AirwayScopeLocation {
  readonly edgeId: number
  /** The label's abbreviation ("LS", "RB4"), or `Edge n` on an unlabelled edge. */
  readonly abbr: string
  readonly name: string
  readonly distanceMm: number
  readonly edgeLengthMm: number
  /** True while the scope is in realistic (free) navigation rather than guided along the centerline. */
  readonly freeDrive: boolean
  /**
   * The labels from the root to this edge, in order, each once: the passage the scope has come
   * down, whatever detours it took on the way.
   */
  readonly pathAbbrs: readonly string[]
}

export interface ScopeLocationPose {
  readonly edgeId: number
  readonly distanceMm: number
  readonly edgeLengthMm: number
}

export function edgeAbbreviation(labels: CenterlineLabels, edgeId: number): string {
  return labels.edgeLabels[String(edgeId)]?.abbreviatedLabel ?? `Edge ${edgeId}`
}

export function deriveScopeLocation(
  graph: AirwayGraph,
  labels: CenterlineLabels,
  pose: ScopeLocationPose,
  freeDrive: boolean,
  nodeById: ReadonlyMap<number, AirwayGraphNode> = new Map(graph.nodes.map((n) => [n.id, n])),
): AirwayScopeLocation {
  const info = labels.edgeLabels[String(pose.edgeId)]
  const edge = graph.edges.find((candidate) => candidate.id === pose.edgeId)
  const pathEdgeIds = edge
    ? edgePathToNode(edge.endNodeId, nodeById as Map<number, AirwayGraphNode>)
    : [pose.edgeId]
  const pathAbbrs: string[] = []
  for (const id of pathEdgeIds) {
    const abbr = edgeAbbreviation(labels, id)
    if (pathAbbrs[pathAbbrs.length - 1] !== abbr) pathAbbrs.push(abbr)
  }
  return {
    edgeId: pose.edgeId,
    abbr: info?.abbreviatedLabel ?? `Edge ${pose.edgeId}`,
    name: info ? shortAnatomicalLabel(info.fullLabel, info.abbreviatedLabel) : 'Unlabeled branch',
    distanceMm: pose.distanceMm,
    edgeLengthMm: pose.edgeLengthMm,
    freeDrive,
    pathAbbrs,
  }
}
