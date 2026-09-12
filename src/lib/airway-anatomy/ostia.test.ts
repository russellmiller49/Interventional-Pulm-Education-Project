/** @jest-environment node */
import {
  buildUpcomingOstia,
  CONNECTOR_PASSTHROUGH_MM,
  firstLabeledDescendant,
  OSTIUM_LABEL_RANGE_MM,
  resolveOstiaForChild,
  shortAnatomicalLabel,
} from './ostia'
import { createGraphIndex } from './scope-state'
import type {
  AirwayGraph,
  AirwayGraphEdge,
  AirwayGraphNode,
  CenterlineLabels,
  ScopePoseSnapshot,
  Vec3,
} from './types'

/**
 * A small synthetic tree along +z: the trachea (edge 0) ends at node 1, which opens into a short
 * unlabeled connector (edge 1) that splits at node 2 into a labeled branch (edge 2) and an
 * unlabeled one (edge 3) whose only continuation (edge 4) is labeled, and into a labeled main
 * bronchus (edge 5).
 */
function straightEdge(
  id: number,
  startNodeId: number,
  endNodeId: number,
  from: Vec3,
  lengthMm: number,
  heading: Vec3,
): AirwayGraphEdge {
  const norm = Math.hypot(...heading)
  const direction: Vec3 = [heading[0] / norm, heading[1] / norm, heading[2] / norm]
  const points: Vec3[] = [0, 0.5, 1].map(
    (t) =>
      [
        from[0] + direction[0] * lengthMm * t,
        from[1] + direction[1] * lengthMm * t,
        from[2] + direction[2] * lengthMm * t,
      ] as Vec3,
  )
  return {
    id,
    sourceCurve: `c${id}`,
    sourceCellId: id,
    startNodeId,
    endNodeId,
    lengthMm,
    radiusMm: 4,
    pointsLps: points,
  }
}

function node(
  id: number,
  lps: Vec3,
  parentNodeId: number | null,
  parentEdgeId: number | null,
  childEdgeIds: number[],
): AirwayGraphNode {
  return {
    id,
    lps,
    kind:
      childEdgeIds.length > 1 ? 'bifurcation' : childEdgeIds.length === 1 ? 'internal' : 'terminal',
    degree: childEdgeIds.length + (parentEdgeId == null ? 0 : 1),
    rootDistanceMm: 0,
    parentNodeId,
    parentEdgeId,
    childEdgeIds,
  }
}

const edges: AirwayGraphEdge[] = [
  straightEdge(0, 0, 1, [0, 0, 0], 80, [0, 0, 1]),
  straightEdge(1, 1, 2, [0, 0, 80], 10, [1, 0, 0.2]),
  straightEdge(2, 2, 3, [10, 0, 82], 30, [1, 0, 1]),
  straightEdge(3, 2, 4, [10, 0, 82], 8, [1, 0, -1]),
  straightEdge(4, 4, 5, [18, 0, 74], 30, [1, 0, -1]),
  straightEdge(5, 1, 6, [0, 0, 80], 40, [-1, 0, 0.3]),
]

const graph: AirwayGraph = {
  schema: 'fluoroview_airway_graph/v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  rootNodeId: 0,
  carinaNodeId: 1,
  carinaLpsMm: [0, 0, 80],
  terminalNodeIds: [3, 5, 6],
  nodes: [
    node(0, [0, 0, 0], null, null, [0]),
    node(1, [0, 0, 80], 0, 0, [1, 5]),
    node(2, [10, 0, 82], 1, 1, [2, 3]),
    node(3, [40, 0, 112], 2, 2, []),
    node(4, [18, 0, 74], 2, 3, [4]),
    node(5, [48, 0, 44], 4, 4, []),
    node(6, [-40, 0, 92], 1, 5, []),
  ],
  edges,
}

const labels: CenterlineLabels = {
  schema: 'airway_anatomy_centerline_labels/v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  source: 'synthetic',
  edgeLabels: {
    '0': { abbreviatedLabel: 'TR', fullLabel: 'Trachea' },
    '2': { abbreviatedLabel: 'RB1', fullLabel: 'Right Upper Lobe Apical Segment' },
    '4': { abbreviatedLabel: 'RB2', fullLabel: 'Right Upper Lobe Posterior Segment' },
    '5': { abbreviatedLabel: 'LMSB', fullLabel: 'Left Main Bronchus' },
  },
  polylines: [],
}

const index = createGraphIndex(graph)

function poseOnEdge(edgeId: number, distanceMm: number): ScopePoseSnapshot {
  const edge = index.edgesById.get(edgeId)!
  return {
    edgeId,
    distanceMm,
    edgeLengthMm: edge.lengthMm,
    tipLps: [0, 0, distanceMm],
    tangentLps: [0, 0, 1],
    lookAtLps: [0, 0, distanceMm + 10],
    branchNodeId: null,
    branchOptions: [],
    trailLps: [],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
  }
}

describe('resolveOstiaForChild', () => {
  it('yields a labeled child as itself, aimed just inside its opening', () => {
    const [resolved] = resolveOstiaForChild(index, labels, 5)
    expect(resolved.steerEdgeId).toBe(5)
    expect(resolved.info?.abbreviatedLabel).toBe('LMSB')
    // 7 mm along a 40 mm edge (min(7, 24)), on a unit heading of [-1, 0, 0.3].
    expect(resolved.pointLps[0]).toBeCloseTo(-7 / Math.hypot(1, 0.3), 5)
  })

  it('looks through a short unlabeled connector to the openings beyond it', () => {
    expect(edges[1].lengthMm).toBeLessThanOrEqual(CONNECTOR_PASSTHROUGH_MM)
    const resolved = resolveOstiaForChild(index, labels, 1)
    expect(resolved.map((entry) => entry.steerEdgeId)).toEqual([2, 3])
    expect(resolved.map((entry) => entry.info?.abbreviatedLabel)).toEqual(['RB1', 'RB2'])
  })

  it('does not look through a connector longer than the pass-through length', () => {
    const longer: AirwayGraph = {
      ...graph,
      edges: graph.edges.map((edge) =>
        edge.id === 1 ? { ...edge, lengthMm: CONNECTOR_PASSTHROUGH_MM + 1 } : edge,
      ),
    }
    const [resolved] = resolveOstiaForChild(createGraphIndex(longer), labels, 1)
    expect(resolved.steerEdgeId).toBe(1)
    expect(resolved.info).toBeUndefined()
  })
})

describe('firstLabeledDescendant', () => {
  it('follows a single continuation to the first label', () => {
    expect(firstLabeledDescendant(index, labels, 3)?.abbreviatedLabel).toBe('RB2')
  })

  it('stops at a bifurcation rather than choosing a branch', () => {
    expect(firstLabeledDescendant(index, labels, 1)).toBeUndefined()
  })
})

describe('buildUpcomingOstia', () => {
  it('lists nothing while the next node is out of range', () => {
    expect(
      buildUpcomingOstia(index, labels, poseOnEdge(0, 80 - OSTIUM_LABEL_RANGE_MM - 1)),
    ).toEqual([])
  })

  it('lists every opening ahead once, with the deeper ostia through the connector', () => {
    const ostia = buildUpcomingOstia(index, labels, poseOnEdge(0, 70))
    expect(ostia.map((ostium) => ostium.abbr)).toEqual(['RB1', 'RB2', 'LMSB'])
    // The unlabeled grandchild (edge 3) is what the learner steers into; its label is RB2's.
    expect(ostia.map((ostium) => ostium.edgeId)).toEqual([2, 3, 5])
    expect(ostia.find((ostium) => ostium.abbr === 'RB1')?.descriptor).toBe('Apical')
    expect(ostia.find((ostium) => ostium.abbr === 'LMSB')?.descriptor).toBe('Left Main')
  })

  it('prefers a reviewed ostial landmark for an opening it names', () => {
    const ostia = buildUpcomingOstia(index, labels, poseOnEdge(0, 70), [
      { edgeId: 5, pointLps: [-3, 0, 81], label: 'LMSB', description: 'Left main bronchus' },
    ])
    const left = ostia.find((ostium) => ostium.abbr === 'LMSB')
    expect(left?.pointLps).toEqual([-3, 0, 81])
    expect(left?.descriptor).toBe('Left main')
  })

  it('never offers the airway the tip is already in', () => {
    const relabeled: CenterlineLabels = {
      ...labels,
      edgeLabels: { ...labels.edgeLabels, '5': { abbreviatedLabel: 'TR', fullLabel: 'Trachea' } },
    }
    const ostia = buildUpcomingOstia(index, relabeled, poseOnEdge(0, 70))
    expect(ostia.map((ostium) => ostium.abbr)).toEqual(['RB1', 'RB2'])
  })
})

describe('shortAnatomicalLabel', () => {
  it('abbreviates the bronchus intermedius and strips lobe prefixes from segments', () => {
    expect(shortAnatomicalLabel('Bronchus Intermedius', 'BI')).toBe('B. Intermedius')
    expect(shortAnatomicalLabel('Right Upper Lobe Apical Segment', 'RB1')).toBe('Apical')
    expect(shortAnatomicalLabel('Left Lower Lobe Bronchus', 'LLL')).toBe('Left Lower Lobe')
  })
})
