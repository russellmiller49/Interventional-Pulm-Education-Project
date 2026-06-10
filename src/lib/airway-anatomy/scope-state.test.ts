import {
  alignViewToBranch,
  buildScopePathLps,
  buildScopePoseSnapshot,
  createInitialScopeState,
  moveScope,
  updateLookOffset,
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
  it('moves forward along an edge without leaving it when there is room', () => {
    const initial = createInitialScopeState(graph)
    const moved = moveScope(initial, graph, 6)
    const snapshot = buildScopePoseSnapshot({ state: moved, graph, lookAheadMm: 5 })

    expect(snapshot.edgeId).toBe(0)
    expect(snapshot.distanceMm).toBe(6)
  })

  it('aims through the midpoint of visible child branches at a bifurcation', () => {
    const atBranch = moveScope(createInitialScopeState(graph), graph, 10)
    const snapshot = buildScopePoseSnapshot({ state: atBranch, graph, lookAheadMm: 5 })

    expect(snapshot.lookAtLps[0]).toBeCloseTo(0)
    expect(snapshot.lookAtLps[2]).toBeLessThan(snapshot.tipLps[2])
  })

  it('drives through a bifurcation into the branch the view is steered toward', () => {
    const initial = createInitialScopeState(graph)
    // Edge 2 heads toward negative X; positive yaw steers toward positive X.
    const steeredLeft = updateLookOffset(initial, { yawDeg: -30 })
    const movedLeft = moveScope(steeredLeft, graph, 20)
    expect(movedLeft.edgeId).toBe(2)
    expect(movedLeft.distanceMm).toBeCloseTo(10)

    const steeredRight = updateLookOffset(initial, { yawDeg: 30 })
    const movedRight = moveScope(steeredRight, graph, 20)
    expect(movedRight.edgeId).toBe(1)
  })

  it('aligns the steered view toward a chosen branch ostium', () => {
    const atBranch = moveScope(createInitialScopeState(graph), graph, 10)
    const aligned = alignViewToBranch(atBranch, graph, 2, 5)

    expect(aligned.yawDeg).toBeLessThan(-10)
    const advanced = moveScope(aligned, graph, 5)
    expect(advanced.edgeId).toBe(2)
  })

  it('records a trail while advancing', () => {
    const advanced = moveScope(createInitialScopeState(graph), graph, 15, { trailMaxPoints: 8 })
    expect(advanced.trailLps.length).toBeGreaterThan(1)
  })

  it('moves backward across a parent edge', () => {
    const advanced = moveScope(createInitialScopeState(graph), graph, 14)
    const rewound = moveScope(advanced, graph, -8)
    const snapshot = buildScopePoseSnapshot({ state: rewound, graph, lookAheadMm: 5 })

    expect(snapshot.edgeId).toBe(0)
    expect(snapshot.distanceMm).toBeCloseTo(6)
  })

  it('builds the scope insertion path from the tree root to the tip', () => {
    const advanced = moveScope(createInitialScopeState(graph), graph, 14)
    const path = buildScopePathLps(graph, advanced.edgeId, advanced.distanceMm)

    expect(path[0]).toEqual([0, 0, 0])
    expect(path.length).toBeGreaterThanOrEqual(3)
    const last = path[path.length - 1]
    expect(last[2]).toBeLessThan(-10)
  })
})
