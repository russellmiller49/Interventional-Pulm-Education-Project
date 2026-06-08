import {
  buildScopePoseSnapshot,
  chooseBranch,
  createInitialScopeState,
  moveScope,
} from './scope-state'
import type { AirwayGraph } from './types'

const graph: AirwayGraph = {
  schema: 'fluoroview_airway_graph/v1',
  units: 'mm',
  coordinateSystem: 'LPS',
  rootNodeId: 0,
  carinaNodeId: 1,
  carinaLpsMm: [0, 0, -10],
  terminalNodeIds: [2, 3],
  nodes: [
    {
      id: 0,
      lps: [0, 0, 0],
      kind: 'root',
      degree: 1,
      rootDistanceMm: 0,
      parentNodeId: null,
      parentEdgeId: null,
      childEdgeIds: [0],
    },
    {
      id: 1,
      lps: [0, 0, -10],
      kind: 'carina',
      degree: 3,
      rootDistanceMm: 10,
      parentNodeId: 0,
      parentEdgeId: 0,
      childEdgeIds: [1, 2],
    },
    {
      id: 2,
      lps: [10, 0, -20],
      kind: 'terminal',
      degree: 1,
      rootDistanceMm: 24,
      parentNodeId: 1,
      parentEdgeId: 1,
      childEdgeIds: [],
    },
    {
      id: 3,
      lps: [-10, 0, -20],
      kind: 'terminal',
      degree: 1,
      rootDistanceMm: 24,
      parentNodeId: 1,
      parentEdgeId: 2,
      childEdgeIds: [],
    },
  ],
  edges: [
    {
      id: 0,
      sourceCurve: 'Network curve_1 (0).mrk',
      sourceCellId: 0,
      startNodeId: 0,
      endNodeId: 1,
      lengthMm: 10,
      radiusMm: 6,
      pointsLps: [
        [0, 0, 0],
        [0, 0, -10],
      ],
    },
    {
      id: 1,
      sourceCurve: 'Network curve_1 (1).mrk',
      sourceCellId: 1,
      startNodeId: 1,
      endNodeId: 2,
      lengthMm: 14.142,
      radiusMm: 4,
      pointsLps: [
        [0, 0, -10],
        [10, 0, -20],
      ],
    },
    {
      id: 2,
      sourceCurve: 'Network curve_1 (2).mrk',
      sourceCellId: 2,
      startNodeId: 1,
      endNodeId: 3,
      lengthMm: 14.142,
      radiusMm: 4,
      pointsLps: [
        [0, 0, -10],
        [-10, 0, -20],
      ],
    },
  ],
}

describe('airway anatomy scope state', () => {
  it('moves forward along an edge and pauses at a bifurcation', () => {
    const initial = createInitialScopeState(graph)
    const moved = moveScope(initial, graph, 25)
    const snapshot = buildScopePoseSnapshot({ state: moved, graph, lookAheadMm: 5 })

    expect(snapshot.edgeId).toBe(0)
    expect(snapshot.distanceMm).toBe(10)
    expect(snapshot.branchNodeId).toBe(1)
    expect(snapshot.branchOptions.map((option) => option.edgeId)).toEqual([1, 2])
  })

  it('aims through the midpoint of visible child branches at a bifurcation', () => {
    const atBranch = moveScope(createInitialScopeState(graph), graph, 25)
    const snapshot = buildScopePoseSnapshot({ state: atBranch, graph, lookAheadMm: 5 })

    expect(snapshot.lookAtLps[0]).toBeCloseTo(0)
    expect(snapshot.lookAtLps[2]).toBeLessThan(snapshot.tipLps[2])
  })

  it('continues on a selected child branch and records a trail', () => {
    const atBranch = moveScope(createInitialScopeState(graph), graph, 25)
    const selected = chooseBranch(atBranch, graph, 2)
    const advanced = moveScope(selected, graph, 5, { trailMaxPoints: 8 })
    const snapshot = buildScopePoseSnapshot({ state: advanced, graph, lookAheadMm: 5 })

    expect(snapshot.edgeId).toBe(2)
    expect(snapshot.tipLps[0]).toBeLessThan(0)
    expect(snapshot.trailLps.length).toBeGreaterThan(1)
  })

  it('auto-follows a preferred route through a bifurcation', () => {
    const initial = createInitialScopeState(graph)
    const moved = moveScope(initial, graph, 15, { preferredEdgePath: [0, 2] })
    const snapshot = buildScopePoseSnapshot({ state: moved, graph, lookAheadMm: 5 })

    expect(snapshot.edgeId).toBe(2)
    expect(snapshot.distanceMm).toBeCloseTo(5)
    expect(snapshot.branchOptions).toEqual([])
  })

  it('moves backward across a parent edge', () => {
    const atBranch = moveScope(createInitialScopeState(graph), graph, 25)
    const selected = chooseBranch(atBranch, graph, 1)
    const advanced = moveScope(selected, graph, 4)
    const rewound = moveScope(advanced, graph, -8)
    const snapshot = buildScopePoseSnapshot({ state: rewound, graph, lookAheadMm: 5 })

    expect(snapshot.edgeId).toBe(0)
    expect(snapshot.distanceMm).toBeCloseTo(6)
  })
})
