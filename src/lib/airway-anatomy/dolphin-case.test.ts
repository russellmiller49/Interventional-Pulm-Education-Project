/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { buildTransportFrames, poseWithTransport, scopeOpticalFrame } from './transport-frames'
import {
  buildScopePoseSnapshot,
  createInitialScopeState,
  sampleEdgePose,
  updateLookOffset,
} from './scope-state'
import { driveScope } from './drive'
import { createLumenCollider } from './lumen-collider'
import { minus, projectOptical, scalar, times, unit } from '../bronchoscopy-core/frame'
import type { AirwayAnatomyCaseManifest, AirwayGraph, CenterlineLabels, Vec3 } from './types'

const caseDir = path.join(process.cwd(), 'public/airway-anatomy/dolphin-001')
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(caseDir, file), 'utf8'))
const graph = read('metadata/airway_graph.json') as AirwayGraph
const manifest = read('case_manifest.json') as AirwayAnatomyCaseManifest
const labels = read('metadata/centerline_labels.json') as CenterlineLabels
const frames = buildTransportFrames(
  graph,
  manifest.orientationLandmarks,
  manifest.interaction.rootUpLps,
)
const edges = new Map(graph.edges.map((edge) => [edge.id, edge]))
const nodes = new Map(graph.nodes.map((node) => [node.id, node]))
const abbr = (edgeId: number) => labels.edgeLabels[String(edgeId)]?.abbreviatedLabel
const childrenOf = (edgeId: number) => nodes.get(edges.get(edgeId)!.endNodeId)!.childEdgeIds
const meanX = (edgeId: number) => {
  const points = edges.get(edgeId)!.pointsLps
  return points.reduce((sum, point) => sum + point[0], 0) / points.length
}
const anchor = (edgeId: number) => {
  const edge = edges.get(edgeId)!
  return sampleEdgePose(edge, Math.min(7, edge.lengthMm * 0.6)).point
}
const firstEdge = (label: string) => graph.edges.find((edge) => abbr(edge.id) === label)!

/** The lumen GLB written by build-dolphin-case.py: one POSITION accessor and one index list. */
function lumenGeometry() {
  const buffer = fs.readFileSync(path.join(caseDir, 'lumen.glb'))
  const jsonLength = buffer.readUInt32LE(12)
  const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString())
  const binary = buffer.subarray(20 + jsonLength + 8)
  const view = (index: number) => {
    const { byteOffset, byteLength } = document.bufferViews[index]
    const start = binary.byteOffset + byteOffset
    return binary.buffer.slice(start, start + byteLength)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(view(0)), 3))
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(view(1)), 1))
  return geometry
}

describe('dolphin airway case', () => {
  it('labels the route from the left bony nasal passage to the carina in order', () => {
    expect(graph.edges.every((edge) => abbr(edge.id))).toBe(true)
    const root = nodes.get(graph.rootNodeId)!
    expect(root.childEdgeIds.map(abbr)).toEqual(['LNP'])
    const route: string[] = []
    let edgeId = root.childEdgeIds[0]
    while (nodes.get(edges.get(edgeId)!.endNodeId)!.id !== graph.carinaNodeId) {
      route.push(abbr(edgeId)!)
      const next = childrenOf(edgeId).find((id) => !['RNP', 'NPF', 'RTB'].includes(abbr(id)!))
      edgeId = next!
    }
    route.push(abbr(edgeId)!)
    expect([...new Set(route)]).toEqual(['LNP', 'NPX', 'LS', 'LX', 'TRA'])
    expect(childrenOf(firstEdge('LNP').id).map(abbr).sort()).toEqual(['NPX', 'RNP'])
    expect(nodes.get(graph.carinaNodeId)!.childEdgeIds.map(abbr).sort()).toEqual(['LMB', 'RMB'])
  })

  it('offers the glottis between the left and right nasopharyngeal fornix', () => {
    const pharynx = firstEdge('NPX')
    const choices = childrenOf(pharynx.id)
    expect(choices.map(abbr).sort()).toEqual(['LS', 'NPF', 'NPF'])
    const glottisX = edges.get(firstEdge('LS').id)!.pointsLps[0][0]
    const sides = choices.filter((id) => abbr(id) === 'NPF').map((id) => meanX(id) - glottisX)
    expect(Math.min(...sides)).toBeLessThan(0)
    expect(Math.max(...sides)).toBeGreaterThan(0)
    // Arriving at the fork, the glottis is in the field of view.
    const arrival = frames.at(pharynx.id, pharynx.lengthMm)
    expect(projectOptical(anchor(firstEdge('LS').id), arrival, 4 / 3)!.visible).toBe(true)
  })

  it('puts the tracheal bronchus and the main bronchi on their own sides', () => {
    const carinaX = graph.carinaLpsMm[0]
    // LPS: +x is the animal's left.
    expect(meanX(firstEdge('RTB').id)).toBeLessThan(carinaX)
    expect(meanX(firstEdge('RMB').id)).toBeLessThan(carinaX)
    expect(meanX(firstEdge('LMB').id)).toBeGreaterThan(carinaX)
    expect(meanX(firstEdge('LNP').id)).toBeGreaterThan(meanX(firstEdge('RNP').id))
    const trachea = graph.edges.filter((edge) => abbr(edge.id) === 'TRA')
    expect(trachea.some((edge) => childrenOf(edge.id).map(abbr).includes('RTB'))).toBe(true)
  })

  it('names the bronchi as the bottlenose dolphin bronchoscopy guide does', () => {
    const names = new Set(Object.values(labels.edgeLabels).map((info) => info!.abbreviatedLabel))
    for (const name of ['RT1', 'RT2', 'RT3']) expect(names.has(name)).toBe(true)
    for (let n = 1; n <= 13; n++) expect(names.has(`RB${n}`)).toBe(true)
    for (let n = 1; n <= 14; n++) expect(names.has(`LB${n}`)).toBe(true)
    // Each numbered branch comes straight off its main bronchus.
    for (const edge of graph.edges) {
      const name = abbr(edge.id)!
      const parent = nodes.get(edge.startNodeId)!.parentEdgeId
      if (/^[RL]B\d+$/.test(name) && parent != null && abbr(parent) !== name) {
        expect(abbr(parent)).toBe(`${name[0]}MB`)
      }
    }
    // The larynx below the spout is the 4-5 cm pear-shaped cavity of Tsang et al.
    const larynx = graph.edges.filter((edge) => abbr(edge.id) === 'LX')
    const larynxMm = larynx.reduce((sum, edge) => sum + edge.lengthMm, 0)
    expect(larynxMm).toBeGreaterThan(40)
    expect(larynxMm).toBeLessThan(50)
  })

  it('reads as for an animal in sternal recumbency: dorsal up, right main bronchus on the left', () => {
    expect(frames.at(0, manifest.interaction.initialDistanceMm ?? 0).up[2]).toBeLessThan(-0.9)
    // The trachea runs obliquely, so compare with dorsal seen across the lumen.
    const trachea = firstEdge('TRA')
    const view = frames.at(trachea.id, trachea.lengthMm / 2)
    const dorsal: Vec3 = [0, 1, 0]
    const across = unit(minus(dorsal, times(view.forward, scalar(dorsal, view.forward))))
    expect(scalar(view.up, across)).toBeGreaterThan(0.9)
    const carinaView = frames.at(nodes.get(graph.carinaNodeId)!.parentEdgeId!, 0)
    const right = projectOptical(anchor(firstEdge('RMB').id), carinaView, 4 / 3)!
    const left = projectOptical(anchor(firstEdge('LMB').id), carinaView, 4 / 3)!
    expect(right.x).toBeLessThan(left.x)
  })

  it('drives from the naris through the laryngeal spout and larynx into the right main bronchus', () => {
    const collider = createLumenCollider(lumenGeometry())
    let state = createInitialScopeState(
      graph,
      manifest.interaction.defaultEdgeId,
      manifest.interaction.initialDistanceMm,
    )
    const visited = new Set<string>()
    const preferred = ['NPX', 'LS', 'LX', 'TRA', 'RMB']
    for (let step = 0; step < 900 && abbr(state.edgeId) !== 'RMB'; step++) {
      const pose = poseWithTransport(
        buildScopePoseSnapshot({ state, graph, labels, lookAheadMm: 14 }),
        frames,
      )
      const frame = scopeOpticalFrame(pose)
      const next = driveScope(state, 1, graph, frames, frame, collider)
      // Steering stays where it was left, so a fork can also be entered on the wrong side.
      const wrongTurn =
        next.edgeId !== state.edgeId &&
        abbr(next.edgeId) !== abbr(state.edgeId) &&
        !preferred.includes(abbr(next.edgeId)!)
      if (next.movementMessage || wrongTurn) {
        // A learner aims into the opening, as the "Aim into an opening" prompt asks.
        if (next.movementMessage) expect(next.movementMessage).toMatch(/^Aim into/)
        const at = wrongTurn ? state : next
        const target = childrenOf(at.edgeId).find((id) => preferred.includes(abbr(id)!))!
        const direction = unit(minus(anchor(target), frame.position))
        const base = frames.at(at.edgeId, at.distanceMm)
        expect(collider.visible(frame.position, anchor(target))).toBe(true)
        state = updateLookOffset(at, {
          yawDeg:
            (Math.atan2(-scalar(direction, base.right), scalar(direction, base.forward)) * 180) /
            Math.PI,
          pitchDeg: (Math.asin(scalar(direction, base.up)) * 180) / Math.PI,
        })
        continue
      }
      visited.add(abbr(next.edgeId)!)
      state = next
    }
    expect(abbr(state.edgeId)).toBe('RMB')
    expect([...visited]).toEqual(['LNP', 'NPX', 'LS', 'LX', 'TRA', 'RMB'])
  })
})
