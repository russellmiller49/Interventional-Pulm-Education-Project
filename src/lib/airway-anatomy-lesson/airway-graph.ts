import { AIRWAY_NODES } from '@/data/airway-anatomy-lesson/airway-map'

import type { AirwayNode, Lobe } from './types'

/** id → node lookup. */
export const AIRWAY_BY_ID: Record<string, AirwayNode> = Object.fromEntries(
  AIRWAY_NODES.map((node) => [node.id, node]),
)

/** id → ordered child ids, derived from parentId (source order = sibling order). */
export const CHILD_IDS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {}
  for (const node of AIRWAY_NODES) {
    if (node.parentId) {
      ;(map[node.parentId] ??= []).push(node.id)
    }
  }
  return map
})()

/** The root node (the one with no parent). */
export const ROOT_ID =
  AIRWAY_NODES.find((node) => node.parentId === null)?.id ?? AIRWAY_NODES[0]?.id ?? 'larynx'

export function getNode(id: string): AirwayNode | undefined {
  return AIRWAY_BY_ID[id]
}

export function getChildren(id: string): AirwayNode[] {
  return (CHILD_IDS[id] ?? []).map((childId) => AIRWAY_BY_ID[childId]).filter(Boolean)
}

export function getParent(id: string): AirwayNode | undefined {
  const parentId = AIRWAY_BY_ID[id]?.parentId
  return parentId ? AIRWAY_BY_ID[parentId] : undefined
}

/** Root → node id chain (inclusive), useful for breadcrumb trails. */
export function getAncestry(id: string): AirwayNode[] {
  const chain: AirwayNode[] = []
  let current: AirwayNode | undefined = AIRWAY_BY_ID[id]
  while (current) {
    chain.unshift(current)
    current = current.parentId ? AIRWAY_BY_ID[current.parentId] : undefined
  }
  return chain
}

/**
 * All segmental descendants of a node (or the node itself if it is a segment).
 * Used by the 3D model to highlight a whole lobe when a stem is selected.
 */
export function getDescendantSegments(id: string): AirwayNode[] {
  const out: AirwayNode[] = []
  const walk = (nodeId: string) => {
    const node = AIRWAY_BY_ID[nodeId]
    if (!node) return
    const children = CHILD_IDS[nodeId] ?? []
    if (children.length === 0 && node.glbMatch) {
      out.push(node)
      return
    }
    // A node can carry its own glbMatch (central airways) and still have children.
    if (node.glbMatch && node.kind === 'central') out.push(node)
    children.forEach(walk)
  }
  walk(id)
  return out
}

/**
 * Which GLB-backed airway ids should light up when `id` is selected. A node
 * with its own mesh highlights just itself; a stem without a mesh (lobar /
 * division bronchi) highlights its segment meshes.
 */
export function resolveHighlightIds(id: string): Set<string> {
  const node = AIRWAY_BY_ID[id]
  if (!node) return new Set()
  if (node.glbMatch) return new Set([id])
  return new Set(getDescendantSegments(id).map((n) => n.id))
}

const LOBE_COLORS: Record<Lobe, string> = {
  central: '#94a3b8', // slate
  RUL: '#38bdf8', // sky
  RML: '#34d399', // emerald
  RLL: '#a78bfa', // violet
  LUL: '#fbbf24', // amber
  lingula: '#fb7185', // rose
  LLL: '#f472b6', // pink
}

export function lobeColor(lobe: Lobe): string {
  return LOBE_COLORS[lobe] ?? '#94a3b8'
}

export const LOBE_LABELS: Record<Lobe, string> = {
  central: 'Central airways',
  RUL: 'Right upper lobe',
  RML: 'Right middle lobe',
  RLL: 'Right lower lobe',
  LUL: 'Left upper lobe',
  lingula: 'Lingula',
  LLL: 'Left lower lobe',
}

/** Lobes in survey order, for the color legend. */
export const LEGEND_LOBES: Lobe[] = ['central', 'RUL', 'RML', 'RLL', 'LUL', 'lingula', 'LLL']

/**
 * Convert a clock position (1–12, 12 at top) to a unit-circle offset with the
 * origin at center. Returns {x, y} where y grows downward (SVG convention).
 */
export function clockToOffset(clock: number, radius: number): { x: number; y: number } {
  // 12 o'clock = -90° (straight up); each hour = 30°, clockwise.
  const angleDeg = clock * 30 - 90
  const angleRad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(angleRad) * radius, y: Math.sin(angleRad) * radius }
}

/**
 * Extract the segmental code token (e.g. "RB1", "LB7+8", "LB10") from a raw GLB
 * mesh/node name, normalizing whitespace and dropping any ".001" suffixes and
 * unbalanced parentheses that appear in the exported asset.
 */
export function extractSegmentCode(rawName: string): string | null {
  const match = rawName.match(/\b([RL]B\d{1,2}(?:\+\d{1,2})?)\b/i)
  return match ? match[1].toUpperCase() : null
}

/**
 * Map a raw GLB node name to an AirwayNode id, using the segmental code when
 * present and otherwise a keyword match against each node's `glbMatch`.
 */
export function glbNodeToAirwayId(rawName: string): string | undefined {
  const normalized = rawName.toLowerCase()
  // The exported GLB carries a redundant full-tree mesh; never tag it (and note
  // "trachea" is a substring of "tracheobronchial", so this guard must run
  // before the keyword match below).
  if (
    normalized.includes('tracheobronchial') ||
    normalized.includes('complete_airway') ||
    normalized.includes('tree_full')
  ) {
    return undefined
  }
  const code = extractSegmentCode(rawName)
  if (code) {
    const byCode = AIRWAY_NODES.find((node) => node.code?.toUpperCase() === code)
    if (byCode) return byCode.id
  }
  // Keyword match for central airways (trachea, mainstems, bronchus intermedius).
  const byKeyword = AIRWAY_NODES.find(
    (node) => node.glbMatch && !node.code && normalized.includes(node.glbMatch.toLowerCase()),
  )
  return byKeyword?.id
}

export interface DiagramLayoutNode {
  node: AirwayNode
  /** Normalized position in [0, 1]; x = depth, y = leaf order. */
  x: number
  y: number
}

export interface DiagramLayout {
  nodes: DiagramLayoutNode[]
  /** Parent→child links by id, for drawing edges. */
  links: { fromId: string; toId: string }[]
  maxDepth: number
  leafCount: number
}

/**
 * Tidy horizontal dendrogram layout: depth increases with x, leaves are spread
 * evenly on y and internal nodes are centered on their children. Deterministic
 * (no randomness), so the diagram renders identically every time.
 */
export function computeDiagramLayout(rootId: string = ROOT_ID): DiagramLayout {
  const links: { fromId: string; toId: string }[] = []
  const depthById: Record<string, number> = {}
  const yById: Record<string, number> = {}
  let leafCounter = 0
  let maxDepth = 0

  const assign = (id: string, depth: number): number => {
    depthById[id] = depth
    maxDepth = Math.max(maxDepth, depth)
    const children = CHILD_IDS[id] ?? []
    if (children.length === 0) {
      const y = leafCounter
      leafCounter += 1
      yById[id] = y
      return y
    }
    let sum = 0
    for (const childId of children) {
      links.push({ fromId: id, toId: childId })
      sum += assign(childId, depth + 1)
    }
    const y = sum / children.length
    yById[id] = y
    return y
  }

  assign(rootId, 0)

  const leafCount = Math.max(1, leafCounter)
  const nodes: DiagramLayoutNode[] = Object.keys(depthById).map((id) => ({
    node: AIRWAY_BY_ID[id],
    x: maxDepth === 0 ? 0 : depthById[id] / maxDepth,
    y: leafCount === 1 ? 0.5 : yById[id] / (leafCount - 1),
  }))

  return { nodes, links, maxDepth, leafCount }
}
