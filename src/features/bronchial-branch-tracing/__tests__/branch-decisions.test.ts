import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import decisions from '../geometry/branch-decisions.json'
import { CT_TRACES, traceById } from '../geometry/native-ct'
import { pairedScope } from '../geometry/paired-scope'
import { ctSessionReducer, emptyCtSession, lastUnlocked, traceComplete } from '../engine/ct-session'
import { orientationFor } from '../geometry/orientation'

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

test('junction cameras remain in the parent and checkpoint stations move continuously along the route', () => {
  for (const trace of CT_TRACES) {
    let previousArc = -1
    for (const [i, point] of trace.checkpoints.entries()) {
      const pose = pairedScope(trace, point.slice, i, false)
      if (point.decision) expect(pose.arc).toBeGreaterThan(previousArc)
      else expect(pose.arc).toBeGreaterThanOrEqual(previousArc - 0.001) // Final nodule inspection may reuse the last clear daughter plane.
      previousArc = pose.arc
      expect(pose.planeGapMm).toBeLessThanOrEqual(0.251)
      expect(pose.atJunction).toBe(Boolean(point.decision))
      if (point.decision) {
        const delta = point.decision.junctionLps.map((v, j) => v - pose.position[j])
        const len = Math.hypot(...delta)
        expect(len).toBeGreaterThan(0)
        delta.forEach((v, j) => expect(v / len).toBeCloseTo(pose.direction[j], 8))
      }
    }
  }
})

test('future forks and the lesion cannot bypass a choice, a mark and explicit recording; wrong first responses stay immutable', () => {
  const trace = traceById('central-right'),
    transfer = traceById('left-lower-basal')
  const reduce = ctSessionReducer(trace, transfer)
  let s = reduce(emptyCtSession(trace), { type: 'advance' })
  s = reduce(s, { type: 'orientation', value: orientationFor(trace.preset) })
  s = reduce(s, { type: 'check-orientation' })
  const first = trace.checkpoints[0],
    wrong = first.decision!.options.find((o) => o.sourceEdgeId !== first.sourceEdgeId)!.sourceEdgeId
  expect(reduce(s, { type: 'active', index: trace.checkpoints.length - 1 })).toBe(s)
  expect(
    reduce(s, { type: 'mark', index: 1, mark: { slice: trace.checkpoints[1].slice, pixel: null } }),
  ).toBe(s)
  s = reduce(s, { type: 'branch', index: 0, value: wrong })
  expect(reduce(s, { type: 'record-junction' })).toBe(s)
  s = reduce(s, { type: 'mark', index: 0, mark: { slice: first.slice, pixel: [10, 10] } })
  expect(reduce(s, { type: 'active', index: 1 })).toBe(s)
  s = reduce(s, { type: 'record-junction' })
  expect(lastUnlocked(s.recorded)).toBe(1)
  expect(s.active).toBe(0) // Feedback does not auto-advance.
  expect(s.branches[0]).toBe(wrong)
  expect(reduce(s, { type: 'branch', index: 0, value: first.sourceEdgeId })).toBe(s)
  expect(reduce(s, { type: 'mark', index: 0, mark: { slice: first.slice, pixel: null } })).toBe(s)
  for (let i = 1; i < trace.checkpoints.length; i++) {
    s = reduce(s, { type: 'active', index: i })
    if (trace.checkpoints[i].decision)
      s = reduce(s, { type: 'branch', index: i, value: 'unresolved' })
    s = reduce(s, {
      type: 'mark',
      index: i,
      mark: { slice: trace.checkpoints[i].slice, pixel: null },
    })
    expect(reduce(s, { type: 'advance' })).toBe(s)
    s = reduce(s, { type: 'record-junction' })
  }
  expect(traceComplete(trace, s)).toBe(true)
  s = reduce(s, { type: 'advance' })
  s = reduce(s, { type: 'course', value: 'uncertain' })
  s = reduce(s, { type: 'target-relation', value: 'unresolved' })
  s = reduce(s, { type: 'advance' })
  expect(s.prediction!.branches[0]).toBe(wrong)
  expect(s.prediction!.marks[0].pixel).toEqual([10, 10])
  s = reduce(reduce(s, { type: 'advance' }), { type: 'advance' })
  expect(s.marks).toEqual(transfer.checkpoints.map(() => null))
  expect(s.branches).toEqual(transfer.checkpoints.map(() => null))
  expect(s.recorded.every((v) => !v)).toBe(true)
  expect(reduce(s, { type: 'advance' })).toBe(s)
})
