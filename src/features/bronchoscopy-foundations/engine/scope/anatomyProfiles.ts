import { AIRWAY_LABELS, isAirwayLabel, type AirwayLabel } from '../../components/scope/types'
import { parentLabel, TEACHING_TREE } from '../../content/airwayTree'
import type { ScopeCase, TeachingGraphFile } from './scopeCase'
import { START_FRACTION } from './scopeScripts'

/**
 * The declared anatomy profile, `adult-teaching-combined-left-basal-v1`, held against the teaching
 * graph that carries it.
 *
 * Three vocabularies must agree before a learner drives a scope: the manifest's 31-node tree
 * (`content/airwayTree.ts`, ids verbatim), the teaching graph's edge labels (the engine's), and the
 * parentage between them. Each of the 31 nodes is an airway label the graph carries, or one of the
 * two educational groupings, which are explicitly not separately labelled. Parentage is read from
 * the graph — the airway the tip is in just before it crosses into another — and must equal the
 * tree's (A03: the bronchus intermedius arises from the right main bronchus, RB6 from the right
 * lower lobe, the lingula from the left upper lobe). Every graph label is a profile label, and the
 * tree refuses any label or alias that reads as a lymph-node station, so the graph cannot carry one
 * (A05).
 */

export type ProfileNodeBinding =
  | { readonly nodeId: string; readonly label: AirwayLabel }
  | { readonly nodeId: string; readonly label: null; readonly note: 'not separately labelled' }

export const PROFILE_NODE_BINDINGS: readonly ProfileNodeBinding[] = TEACHING_TREE.map((node) =>
  node.label
    ? { nodeId: node.id, label: node.label }
    : { nodeId: node.id, label: null, note: 'not separately labelled' },
)

export const TEACHING_GRAPH_SCHEMA = 'bronchoscopy_foundations_teaching_graph/v1'

/** What is wrong with a teaching-graph file before any case is built from it. */
export function teachingGraphFileErrors(file: TeachingGraphFile): readonly string[] {
  const errors: string[] = []
  if (file.schema !== TEACHING_GRAPH_SCHEMA)
    errors.push(`The teaching graph has schema ${file.schema}.`)
  if (file.profileId !== 'adult-teaching-combined-left-basal-v1')
    errors.push(`The teaching graph declares profile ${file.profileId}.`)
  if (file.graph.coordinateSystem !== 'LPS' || file.graph.units !== 'mm')
    errors.push('The teaching graph is not in patient LPS millimetres.')
  const edges = new Map(file.graph.edges.map((edge) => [edge.id, edge]))
  const nodes = new Map(file.graph.nodes.map((node) => [node.id, node]))
  for (const [edgeId, entry] of Object.entries(file.edgeLabels)) {
    if (!entry) continue
    if (!edges.has(Number(edgeId))) errors.push(`Edge ${edgeId} is labelled but not in the graph.`)
    if (!isAirwayLabel(entry.abbreviatedLabel))
      errors.push(
        `Edge ${edgeId} carries ${entry.abbreviatedLabel}, which the profile does not name.`,
      )
  }
  for (const node of file.graph.nodes) {
    for (const childId of node.childEdgeIds) {
      if (edges.get(childId)?.startNodeId !== node.id)
        errors.push(`Node ${node.id} lists edge ${childId}, which does not start there.`)
    }
    if (node.parentEdgeId != null && edges.get(node.parentEdgeId)?.endNodeId !== node.id)
      errors.push(
        `Node ${node.id} names parent edge ${node.parentEdgeId}, which does not end there.`,
      )
  }
  if (!nodes.has(file.graph.rootNodeId)) errors.push('The teaching graph has no root node.')
  if (!nodes.has(file.graph.carinaNodeId)) errors.push('The teaching graph has no carina node.')
  for (const mark of file.orientationLandmarks) {
    if (!edges.has(mark.edgeId) || !edges.has(mark.targetEdgeId))
      errors.push(`Orientation landmark ${mark.id} names an edge the graph does not carry.`)
  }
  for (const mark of file.ostialLandmarks) {
    const label = file.edgeLabels[String(mark.edgeId)]?.abbreviatedLabel
    if (label !== mark.label)
      errors.push(`The ostial landmark on edge ${mark.edgeId} names ${mark.label}, not ${label}.`)
  }
  return errors
}

/** What is wrong with a built case against the teaching tree: origins, parentage, the carina. */
export function scopeCaseProfileErrors(scopeCase: ScopeCase): readonly string[] {
  const errors: string[] = []
  const { index } = scopeCase
  const parentEdge = (edgeId: number) => {
    const edge = index.edgesById.get(edgeId)
    return edge ? (index.nodesById.get(edge.startNodeId)?.parentEdgeId ?? null) : null
  }
  for (const label of AIRWAY_LABELS) {
    const origin = scopeCase.originEdge.get(label)
    if (origin === undefined) {
      errors.push(`${label} has no airway in the teaching graph.`)
      continue
    }
    if (!((index.edgesById.get(origin)?.lengthMm ?? 0) > 0))
      errors.push(`${label} begins with an edge of no length.`)
    const above = parentEdge(origin)
    const graphParent = above === null ? null : scopeCase.labelAt(above)
    const treeParent = parentLabel(label)
    if (graphParent !== treeParent)
      errors.push(
        `${label} arises from ${graphParent ?? 'the root'} in the teaching graph but from ${treeParent ?? 'the root'} in the teaching tree.`,
      )
  }
  // Each airway is one run of edges below its origin: climbing from any of its edges reaches it.
  for (const [edgeId, label] of scopeCase.ownLabel) {
    let current = edgeId
    let above = parentEdge(current)
    while (above !== null && scopeCase.labelAt(above) === label) {
      current = above
      above = parentEdge(current)
    }
    if (current !== scopeCase.originEdge.get(label))
      errors.push(`Edge ${edgeId} carries ${label} but is cut off from that airway's origin.`)
  }
  const trachea = index.edgesById.get(scopeCase.originEdge.get('TR') ?? -1)
  if (trachea?.startNodeId !== scopeCase.graph.rootNodeId)
    errors.push('The trachea does not begin at the root of the teaching graph.')
  if (trachea?.endNodeId !== scopeCase.graph.carinaNodeId)
    errors.push('The trachea does not end at the main carina.')
  return errors
}

/** Where an authored airway start puts the tip: along that airway's first labelled segment. */
export function airwayStartPlacement(
  scopeCase: ScopeCase,
  label: AirwayLabel,
  at: keyof typeof START_FRACTION,
): { readonly edgeId: number; readonly distanceMm: number } {
  const edgeId = scopeCase.originEdge.get(label)
  const edge = edgeId === undefined ? undefined : scopeCase.index.edgesById.get(edgeId)
  if (edgeId === undefined || !edge) throw new Error(`The teaching graph does not carry ${label}`)
  return { edgeId, distanceMm: edge.lengthMm * START_FRACTION[at] }
}
