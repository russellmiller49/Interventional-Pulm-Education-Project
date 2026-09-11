/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import { buildTransportFrames, poseWithTransport } from './transport-frames'
import { buildScopePoseSnapshot, createInitialScopeState, sampleEdgePose } from './scope-state'
import { driveScope, enterFreeDrive } from './drive'
import {
  projectOptical,
  sweepClearance,
  scalar,
  type LumenCollider,
} from '../bronchoscopy-core/frame'
import type { AirwayGraph, AirwayAnatomyCaseManifest, CenterlineLabels } from './types'
const read = (file: string) =>
  JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'public/airway-anatomy/case-001', file), 'utf8'),
  )
const graph = read('metadata/airway_graph.json') as AirwayGraph
const manifest = read('case_manifest.json') as AirwayAnatomyCaseManifest
const labels = read('metadata/centerline_labels.json') as CenterlineLabels
const frames = buildTransportFrames(graph, manifest.orientationLandmarks)
const anchor = (id: number) => {
  const e = graph.edges.find((e) => e.id === id)!
  return sampleEdgePose(e, Math.min(7, e.lengthMm * 0.6)).point
}
const projected = (id: number, edge: number, d: number) =>
  projectOptical(anchor(id), frames.at(edge, d), 4 / 3)!
describe('reviewed flexible views', () => {
  it('places apical RB1 at the top of the RUL ostial group', () => {
    const apical = projected(13, 3, 10),
      anterior = projected(7, 3, 10),
      posterior = projected(12, 3, 10)
    expect(apical.visible).toBe(true)
    expect(apical.y).toBeGreaterThan(anterior.y)
    expect(apical.y).toBeGreaterThan(posterior.y)
  })
  it('places medial RB5 to the left of lateral RB4', () => {
    expect(projected(19, 9, 6).x).toBeLessThan(projected(18, 9, 6).x)
  })
  it('places the upper division above lingula with both visible', () => {
    const upper = projected(21, 496, 9),
      lingula = projected(20, 496, 9)
    expect(upper.y).toBeGreaterThan(lingula.y)
    expect(upper.visible && lingula.visible).toBe(true)
  })
  it('keeps flexible corrections separate from robotic framing', () => {
    const robotic = buildTransportFrames(graph)
    expect(scalar(frames.at(9, 6).up, robotic.at(9, 6).up)).toBeLessThan(0.99)
  })
})
describe('navigation v2', () => {
  it('pauses advancement when looking away from both main bronchi', () => {
    const edge = graph.edges.find((e) => e.id === 0)!,
      state = createInitialScopeState(graph, 0, edge.lengthMm - 0.05)
    const frame = frames.at(0, state.distanceMm)
    frame.forward = frame.forward.map((v) => -v) as [number, number, number]
    const next = driveScope(state, 5, graph, frames, frame, null)
    expect(next.edgeId).toBe(0)
    expect(next.movementMessage).toContain('Aim')
  })
  it('sweeps independent motion and withdraws along the recorded insertion path', () => {
    const state = createInitialScopeState(graph, 0, 30),
      frame = frames.at(0, 30)
    const clearance = () => 10
    const collider: LumenCollider = {
      clearance,
      visible: () => true,
      sweep: (a, b, r) => sweepClearance(clearance, a, b, r),
    }
    const free = enterFreeDrive(state, frame, graph),
      advanced = driveScope(free, 5, graph, frames, frame, collider)
    expect(advanced.freeFrame?.position).not.toEqual(frame.position)
    const withdrawn = driveScope(advanced, -5, graph, frames, advanced.freeFrame!, collider)
    withdrawn.freeFrame!.position.forEach((v, i) => expect(v).toBeCloseTo(frame.position[i], 6))
    const pose = poseWithTransport(
      buildScopePoseSnapshot({ state: withdrawn, graph, labels, lookAheadMm: 12 }),
      frames,
    )
    expect(pose.opticalFrame).toEqual(withdrawn.freeFrame)
    expect(pose.tipLps).toEqual(withdrawn.freeFrame!.position)
  })
})
