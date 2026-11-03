import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { useMemo, type ReactElement } from 'react'

import { GameHudOverlay, useAirwayGame } from './AirwayGameLayer'
import type {
  AirwayGraph,
  AirwayGraphEdge,
  AirwayGraphNode,
  CenterlineLabels,
  ScopePoseSnapshot,
  Vec3,
} from '@/lib/airway-anatomy/types'

// The HUD file also holds the 3D beacon and burst; nothing in this test mounts a Canvas.
jest.mock('@react-three/fiber', () => ({ useFrame: jest.fn() }))
jest.mock('@react-three/drei', () => ({ Html: () => null }))

/**
 * A right-lung tree with the case-001 labels and forks: the trachea splits into the mainstems, the
 * RMSB into the RUL and the bronchus intermedius, the BI into the RML and RLL, and the RLL into
 * RB6 and its own continuation, the basal trunk. RB6 is the only segment, so a Segments run sends
 * the learner to RB6 every time.
 */
const TREE: Array<{ id: number; parent: number | null; heading: Vec3; label?: [string, string] }> =
  [
    { id: 0, parent: null, heading: [0, 0, -1], label: ['TR', 'Trachea'] },
    { id: 1, parent: 0, heading: [-1, 0, -1], label: ['RMSB', 'Right Mainstem Bronchus'] },
    { id: 2, parent: 0, heading: [1, 0, -0.6], label: ['LMSB', 'Left Mainstem Bronchus'] },
    { id: 3, parent: 1, heading: [-1, 0, 0.2], label: ['RUL', 'Right Upper Lobe Bronchus'] },
    { id: 4, parent: 1, heading: [-0.2, 0, -1], label: ['BI', 'Bronchus Intermedius'] },
    { id: 8, parent: 4, heading: [0, 0.4, -1], label: ['RLL', 'Right Lower Lobe Bronchus'] },
    { id: 9, parent: 4, heading: [0, -1, -0.4], label: ['RML', 'Right Middle Lobe Bronchus'] },
    { id: 16, parent: 8, heading: [0, 0, -1], label: ['RLL', 'Right Lower Lobe Bronchus'] },
    {
      id: 17,
      parent: 8,
      heading: [0, 1, 0],
      label: ['RB6', 'Right Lower Lobe Superior Segment'],
    },
  ]
const EDGE_LENGTH_MM = 20

function buildCase(): { graph: AirwayGraph; labels: CenterlineLabels } {
  const root: AirwayGraphNode = {
    id: 0,
    lps: [0, -160, -100],
    kind: 'root',
    degree: 1,
    rootDistanceMm: 0,
    parentNodeId: null,
    parentEdgeId: null,
    childEdgeIds: [],
  }
  const nodes = new Map<number, AirwayGraphNode>([[0, root]])
  const edges: AirwayGraphEdge[] = []
  const edgeLabels: CenterlineLabels['edgeLabels'] = {}
  for (const spec of TREE) {
    const startNodeId = spec.parent == null ? 0 : 100 + spec.parent
    const start = nodes.get(startNodeId)!
    const norm = Math.hypot(...spec.heading)
    const end: Vec3 = [
      start.lps[0] + (spec.heading[0] / norm) * EDGE_LENGTH_MM,
      start.lps[1] + (spec.heading[1] / norm) * EDGE_LENGTH_MM,
      start.lps[2] + (spec.heading[2] / norm) * EDGE_LENGTH_MM,
    ]
    const mid: Vec3 = [
      (start.lps[0] + end[0]) / 2,
      (start.lps[1] + end[1]) / 2,
      (start.lps[2] + end[2]) / 2,
    ]
    start.childEdgeIds.push(spec.id)
    nodes.set(100 + spec.id, {
      id: 100 + spec.id,
      lps: end,
      kind: 'bifurcation',
      degree: 1,
      rootDistanceMm: start.rootDistanceMm + EDGE_LENGTH_MM,
      parentNodeId: startNodeId,
      parentEdgeId: spec.id,
      childEdgeIds: [],
    })
    edges.push({
      id: spec.id,
      sourceCurve: 'test',
      sourceCellId: spec.id,
      startNodeId,
      endNodeId: 100 + spec.id,
      lengthMm: EDGE_LENGTH_MM,
      radiusMm: 4,
      pointsLps: [start.lps, mid, end],
    })
    if (spec.label) {
      edgeLabels[String(spec.id)] = { abbreviatedLabel: spec.label[0], fullLabel: spec.label[1] }
    }
  }
  return {
    graph: {
      schema: 'test',
      units: 'mm',
      coordinateSystem: 'LPS',
      rootNodeId: 0,
      carinaNodeId: 100,
      carinaLpsMm: nodes.get(100)!.lps,
      terminalNodeIds: [],
      nodes: [...nodes.values()],
      edges,
    },
    labels: {
      schema: 'test',
      units: 'mm',
      coordinateSystem: 'LPS',
      source: 'test',
      edgeLabels,
      polylines: [],
    },
  }
}

const { graph, labels } = buildCase()

function snapshotOn(edgeId: number): ScopePoseSnapshot {
  const edge = graph.edges.find((entry) => entry.id === edgeId)!
  const [start, mid, end] = edge.pointsLps
  const tangent: Vec3 = [
    (end[0] - start[0]) / EDGE_LENGTH_MM,
    (end[1] - start[1]) / EDGE_LENGTH_MM,
    (end[2] - start[2]) / EDGE_LENGTH_MM,
  ]
  return {
    edgeId,
    distanceMm: EDGE_LENGTH_MM / 2,
    edgeLengthMm: EDGE_LENGTH_MM,
    tipLps: mid,
    tangentLps: tangent,
    lookAtLps: end,
    branchNodeId: null,
    branchOptions: [],
    trailLps: [mid],
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
  }
}

/** The real game hook and HUD, driven by the edge the scope tip sits in. */
function Harness({ edgeId }: { edgeId: number }) {
  const snapshot = useMemo(() => snapshotOn(edgeId), [edgeId])
  const game = useAirwayGame({
    enabled: true,
    graph,
    labels,
    snapshot,
    onResetScope: () => {},
  })
  return (
    <>
      <button type="button" onClick={() => game.actions.start('segments')}>
        Start run
      </button>
      <GameHudOverlay
        view={game.view}
        actions={game.actions}
        pose={snapshot}
        aspect={4 / 3}
        fovDeg={70}
      />
    </>
  )
}

/** Start a Segments run and wait out the 3 · 2 · 1 countdown. */
function startRun() {
  const view = render(<Harness edgeId={0} />)
  fireEvent.click(screen.getByRole('button', { name: 'Start run' }))
  act(() => {
    jest.advanceTimersByTime(2200)
  })
  expect(screen.getByText('RB6')).toBeInTheDocument()
  return view
}

function driveThrough(rerender: (ui: ReactElement) => void, edgeIds: number[]) {
  for (const edgeId of edgeIds) rerender(<Harness edgeId={edgeId} />)
}

const debriefRegion = () => screen.queryByRole('status', { name: 'Last branch entered' })

describe('Bronch Quest branch debrief', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('names the entered and intended branch, the scope landmark and the CT direction', () => {
    const { rerender } = startRun()
    driveThrough(rerender, [1, 4])
    expect(debriefRegion()).not.toBeInTheDocument()

    // At the end of the bronchus intermedius the learner turns into the middle lobe.
    rerender(<Harness edgeId={9} />)
    const debrief = debriefRegion()!
    expect(debrief).toHaveTextContent('Entered RML; intended RLL, toward RB6.')
    expect(within(debrief).getByText('RML', { selector: 'strong' })).toBeInTheDocument()
    expect(within(debrief).getByText('RLL', { selector: 'strong' })).toBeInTheDocument()
    expect(debrief).toHaveTextContent(
      "Scope Looking down the BI, anterior at 12: RLL posterior, 6 o'clock · RML anterior, 12 o'clock",
    )
    expect(debrief).toHaveTextContent(
      'CT Axial: RLL toward the image bottom · RML toward the image top',
    )
    expect(debrief).not.toHaveTextContent(/\b(correct|incorrect|wrong)\b/i)

    // Back on the route the landmark stays up while the learner re-steers; reaching RB6 clears it.
    driveThrough(rerender, [4, 8])
    expect(debriefRegion()).toHaveTextContent('Entered RML; intended RLL, toward RB6.')
    rerender(<Harness edgeId={17} />)
    expect(debriefRegion()).not.toBeInTheDocument()
  })

  it('shows no CT line for a fork the lesson gives only one direction', () => {
    const { rerender } = startRun()
    // Past the superior segment, the learner stays in the lower lobe's own continuation.
    driveThrough(rerender, [1, 4, 8, 16])
    const debrief = debriefRegion()!
    expect(debrief).toHaveTextContent('Entered the RLL basal trunk; intended RB6.')
    expect(debrief).toHaveTextContent(
      "Scope Looking down the RLL, anterior at 12: RB6 posterior, 6 o'clock · RLL basal trunk continues ahead",
    )
    expect(within(debrief).queryByText('CT')).not.toBeInTheDocument()
    expect(debrief).not.toHaveTextContent(/Axial|Coronal/)
  })

  it('names a mainstem turn with the membranous wall and the mirrored CT sides', () => {
    const { rerender } = startRun()
    rerender(<Harness edgeId={2} />)
    const debrief = debriefRegion()!
    expect(debrief).toHaveTextContent('Entered LMSB; intended RMSB, toward RB6.')
    expect(debrief).toHaveTextContent(
      "Looking down the trachea, anterior at 12, membranous wall at 6: RMSB right, 3 o'clock · LMSB left, 9 o'clock",
    )
    // Axial CT is seen from the feet: the patient's right is on the image left.
    expect(debrief).toHaveTextContent(
      'Axial: RMSB toward the image left · LMSB toward the image right',
    )
  })
})
