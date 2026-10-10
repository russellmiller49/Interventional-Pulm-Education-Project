import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import decisions from '../geometry/branch-decisions.json'
import nativeManifest from '../../../../public/branch-tracing/native-v1/manifest.json'
import { CT_TRACES, NATIVE_CT, traceById } from '../geometry/native-ct'

const source = readFileSync('public/fluoroview/cases/patient-new/metadata/airway_graph.json')
type Edge = { id: number; startNodeId: number; endNodeId: number; pointsLps: number[][] }
const graph: { edges: Edge[] } = JSON.parse(source.toString())
const edges = new Map(graph.edges.map((e) => [e.id, e]))

test('all 17 routes include every fork from the trachea, every actual sibling, and the separate distal approach', () => {
  expect(createHash('sha256').update(source).digest('hex')).toBe(decisions.sourceGraphSha256)
  expect(CT_TRACES).toHaveLength(17)
  for (const trace of CT_TRACES) {
    const ancestors: number[] = []
    let edge: Edge | undefined = edges.get(trace.sourceEdgeIds.at(-1)!)
    while (edge) {
      ancestors.unshift(edge.id)
      edge = graph.edges.find((e) => e.endNodeId === edge!.startNodeId)
    }
    expect(trace.sourceEdgeIds).toEqual(ancestors)
    expect(ancestors[0]).toBe(0)
    const forks = ancestors
      .slice(0, -1)
      .filter(
        (id) => graph.edges.filter((e) => e.startNodeId === edges.get(id)!.endNodeId).length > 1,
      )
    expect(trace.checkpoints.filter((p) => p.decision).map((p) => p.decision!.nodeId)).toEqual(
      forks.map((id) => edges.get(id)!.endNodeId),
    )
    expect(trace.checkpoints).toHaveLength(forks.length + 1)
    expect(trace.checkpoints.at(-1)!.id).toBe('target-approach')
    expect(new Set(trace.checkpoints.map((p) => p.id)).size).toBe(trace.checkpoints.length)
    for (const point of trace.checkpoints) {
      if (!point.decision) continue
      const decision = point.decision
      const siblings = graph.edges.filter((e) => e.startNodeId === decision.nodeId)
      expect(decision.options.map((o) => o.sourceEdgeId).sort()).toEqual(
        siblings.map((e) => e.id).sort(),
      )
      expect(decision.options.some((o) => o.sourceEdgeId === point.sourceEdgeId)).toBe(true)
      expect(new Set(decision.options.map((o) => o.label)).size).toBe(siblings.length)
      expect(decision.options.every((o) => o.airway.name && o.direction)).toBe(true)
    }
  }
  expect(traceById('central-right').checkpoints.map((p) => p.decision?.parent.airway.code)).toEqual(
    ['Trachea', 'RMSB', 'BI', 'RML', 'RB5', 'RB5b', 'RB5b', 'RB5b', undefined],
  )
  expect(
    traceById('right-lower-basal').checkpoints.some((p) => p.decision?.options.length === 3),
  ).toBe(true)
  // A common trunk's text prefix is not an inherited daughter label.
  const lingular = traceById('left-lingula').checkpoints.find(
    (p) => p.decision?.parent.airway.code === 'LB4+5',
  )!
  expect(lingular.decision!.options.map((o) => o.airway.code)).toEqual(['LB4', 'LB5'])
  const basal = traceById('left-lower-basal').checkpoints.find(
    (p) => p.decision?.parent.airway.code === 'LB7+8/B9',
  )!
  expect(basal.decision!.options.map((o) => o.airway.code)).toEqual(['LB9', 'LB7+8'])
})

test('every division of a route is the same division on every route that passes it', () => {
  const byId = new Map<string, string>()
  for (const trace of CT_TRACES)
    for (const point of trace.checkpoints) {
      if (!point.decision) continue
      const signature = JSON.stringify(point.decision)
      if (!byId.has(point.id)) byId.set(point.id, signature)
      expect([trace.id, point.id, byId.get(point.id) === signature]).toEqual([
        trace.id,
        point.id,
        true,
      ])
      expect(point.id).toBe(`junction-${point.decision.nodeId}`)
    }
  // 128 forks along 17 routes are 57 distinct divisions: 56 bifurcations and one trifurcation.
  expect(CT_TRACES.flatMap((t) => t.checkpoints.filter((p) => p.decision))).toHaveLength(128)
  expect(byId.size).toBe(57)
  expect(
    [...byId.values()]
      .map((signature) => JSON.parse(signature).options.length)
      .filter((n) => n !== 2),
  ).toEqual([3])
})

// Carried over from the division-levels suite: the export's own levels at the RB4 division.
test('the source levels at the RB4 division are as exported: node nearest slice 306, parent and both daughters on 307', () => {
  const [, , [, , zSpacing, zOrigin]] = nativeManifest.ijkToLps
  expect([zSpacing, zOrigin]).toEqual([NATIVE_CT.spacing[2], NATIVE_CT.origin[2]])
  const raw = decisions.traces
    .find((t) => t.id === 'middle-lobe-lateral')!
    .checkpoints.find((c) => c.id === 'junction-19')!.decision!
  expect((raw.junctionLps[2] - zOrigin) / zSpacing).toBeCloseTo(306.121, 3)
  expect(Math.round((raw.junctionLps[2] - zOrigin) / zSpacing)).toBe(306)
  expect(raw.parent.slice).toBe(307)
  expect(raw.options.map((o) => o.slice)).toEqual([307, 307])
})
