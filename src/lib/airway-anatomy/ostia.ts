import { sampleEdgePose, type AirwayGraphIndex } from './scope-state'
import type { AirwayAnatomyCaseManifest, CenterlineLabels, ScopePoseSnapshot, Vec3 } from './types'

/**
 * The openings ahead of the scope tip, as labels the learner can read or steer toward.
 *
 * Pure graph helpers extracted from the admin airway-anatomy module so the Bronchoscopy
 * Foundations pane can share them. Behaviour is unchanged: an ostium is offered once the tip is
 * within `OSTIUM_LABEL_RANGE_MM` of the next node, a labeled child yields itself, and a short
 * unlabeled connector that immediately splits is looked through.
 */
export interface OstiumLabel {
  edgeId: number
  pointLps: Vec3
  abbr: string
  descriptor: string
}

export const OSTIUM_LABEL_RANGE_MM = 60

/** How short an unlabeled connector can be before we look through it to the next split. */
export const CONNECTOR_PASSTHROUGH_MM = 14

export interface ResolvedOstium {
  /** The immediate child of the current branch the user must steer into. */
  steerEdgeId: number
  pointLps: Vec3
  info: { abbreviatedLabel: string; fullLabel: string } | undefined
}

export function buildUpcomingOstia(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  pose: ScopePoseSnapshot,
  landmarks: AirwayAnatomyCaseManifest['ostialLandmarks'] = [],
): OstiumLabel[] {
  const edge = index.edgesById.get(pose.edgeId)
  if (!edge) return []
  const node = index.nodesById.get(edge.endNodeId)
  if (!node || !node.childEdgeIds.length) return []
  const distanceToNode = pose.edgeLengthMm - pose.distanceMm
  if (distanceToNode > OSTIUM_LABEL_RANGE_MM) return []

  const currentInfo = labels.edgeLabels[String(edge.id)]
  const ostia: OstiumLabel[] = []
  const seenAbbr = new Set<string>()
  for (const childEdgeId of node.childEdgeIds) {
    for (const resolved of resolveOstiaForChild(index, labels, childEdgeId)) {
      const reviewed = landmarks.find((l) => l.edgeId === resolved.steerEdgeId)
      const info = reviewed
        ? { abbreviatedLabel: reviewed.label, fullLabel: reviewed.description }
        : resolved.info
      const abbr = info?.abbreviatedLabel ?? `Branch ${resolved.steerEdgeId}`
      if (info && info.abbreviatedLabel === currentInfo?.abbreviatedLabel) continue
      if (seenAbbr.has(abbr)) continue
      seenAbbr.add(abbr)
      const descriptor = info ? shortAnatomicalLabel(info.fullLabel, info.abbreviatedLabel) : ''
      ostia.push({
        edgeId: resolved.steerEdgeId,
        pointLps: reviewed?.pointLps ?? resolved.pointLps,
        abbr,
        descriptor: descriptor === abbr ? '' : descriptor,
      })
    }
  }
  return ostia
}

/**
 * Map a single child edge to the ostium label(s) the user should see. A labeled
 * child yields itself. A short unlabeled connector that immediately splits (e.g.
 * the RUL stem that opens into RB1 + RB2) is looked through, surfacing the
 * deeper ostia — but the user still steers into the connector edge.
 */
export function resolveOstiaForChild(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  steerEdgeId: number,
): ResolvedOstium[] {
  const child = index.edgesById.get(steerEdgeId)
  if (!child) return []
  const ostiumPoint = sampleEdgePose(child, Math.min(7, child.lengthMm * 0.6)).point
  const directInfo = labels.edgeLabels[String(steerEdgeId)]
  if (directInfo) {
    return [{ steerEdgeId, pointLps: ostiumPoint, info: directInfo }]
  }

  const endNode = index.nodesById.get(child.endNodeId)
  if (child.lengthMm <= CONNECTOR_PASSTHROUGH_MM && endNode && endNode.childEdgeIds.length > 1) {
    const expanded: ResolvedOstium[] = []
    for (const grandchildId of endNode.childEdgeIds) {
      const grandchild = index.edgesById.get(grandchildId)
      if (!grandchild) continue
      const info =
        labels.edgeLabels[String(grandchildId)] ??
        firstLabeledDescendant(index, labels, grandchildId)
      // Aim at the deeper ostium so tapping RB1 vs RB2 biases the steered
      // descent differently even though both pass through the same connector.
      expanded.push({
        steerEdgeId: grandchildId,
        pointLps: sampleEdgePose(grandchild, Math.min(7, grandchild.lengthMm * 0.6)).point,
        info,
      })
    }
    if (expanded.length) return expanded
  }

  return [
    {
      steerEdgeId,
      pointLps: ostiumPoint,
      info: firstLabeledDescendant(index, labels, steerEdgeId),
    },
  ]
}

export function firstLabeledDescendant(
  index: AirwayGraphIndex,
  labels: CenterlineLabels,
  edgeId: number,
): { abbreviatedLabel: string; fullLabel: string } | undefined {
  const queue: number[] = [edgeId]
  let guard = 0
  while (queue.length && guard < 64) {
    guard += 1
    const currentId = queue.shift()
    if (currentId == null) break
    const info = labels.edgeLabels[String(currentId)]
    if (info) return info
    const edge = index.edgesById.get(currentId)
    const node = edge ? index.nodesById.get(edge.endNodeId) : undefined
    // Only follow an unambiguous continuation; a bifurcation introduces a new
    // decision point that should surface as its own labels later.
    if (node?.childEdgeIds.length === 1) {
      queue.push(node.childEdgeIds[0])
    }
  }
  return undefined
}

export function shortAnatomicalLabel(fullLabel: string, abbreviatedLabel: string): string {
  if (/^bronchus intermedius$/i.test(fullLabel)) return 'B. Intermedius'
  let label = fullLabel.replace(/\s+Segment$/i, '').replace(/\s+Bronchus$/i, '')
  if (/^[RL]B\d/i.test(abbreviatedLabel)) {
    label = label.replace(/^(Right|Left)\s+(Upper|Middle|Lower)\s+Lobe\s+/i, '')
  }
  return label
}
