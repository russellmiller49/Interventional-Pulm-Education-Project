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
      const next = childrenOf(edgeId).find((id) => !['RNP', 'TB'].includes(abbr(id)!))
      edgeId = next!
    }
    route.push(abbr(edgeId)!)
    expect([...new Set(route)]).toEqual(['LNP', 'NPX', 'LX', 'TR'])
    expect(childrenOf(firstEdge('LNP').id).map(abbr).sort()).toEqual(['NPX', 'RNP'])
    expect(nodes.get(graph.carinaNodeId)!.childEdgeIds.map(abbr).sort()).toEqual(['LPB', 'RPB'])
  })

  it('puts the tracheal bronchus and the principal bronchi on their own sides', () => {
    const carinaX = graph.carinaLpsMm[0]
    // LPS: +x is the animal's left.
    expect(meanX(firstEdge('TB').id)).toBeLessThan(carinaX)
    expect(meanX(firstEdge('RPB').id)).toBeLessThan(carinaX)
    expect(meanX(firstEdge('LPB').id)).toBeGreaterThan(carinaX)
    expect(meanX(firstEdge('LNP').id)).toBeGreaterThan(meanX(firstEdge('RNP').id))
    const trachea = graph.edges.filter((edge) => abbr(edge.id) === 'TR')
    expect(trachea.some((edge) => childrenOf(edge.id).map(abbr).includes('TB'))).toBe(true)
  })

  it('starts rostral-up and reads the trachea ventral-up with the right bronchus on the right', () => {
    expect(frames.at(0, manifest.interaction.initialDistanceMm ?? 0).up[2]).toBeGreaterThan(0.9)
    // The trachea runs obliquely, so compare with ventral seen across the lumen.
    const trachea = firstEdge('TR')
    const view = frames.at(trachea.id, trachea.lengthMm / 2)
    const ventral: Vec3 = [0, -1, 0]
    const across = unit(minus(ventral, times(view.forward, scalar(ventral, view.forward))))
    expect(scalar(view.up, across)).toBeGreaterThan(0.9)
    const carinaView = frames.at(nodes.get(graph.carinaNodeId)!.parentEdgeId!, 0)
    const right = projectOptical(anchor(firstEdge('RPB').id), carinaView, 4 / 3)!
    const left = projectOptical(anchor(firstEdge('LPB').id), carinaView, 4 / 3)!
    expect(right.x).toBeGreaterThan(left.x)
  })

  it('drives from the nasal passage through the goosebeak into the right principal bronchus', () => {
    const collider = createLumenCollider(lumenGeometry())
    let state = createInitialScopeState(
      graph,
      manifest.interaction.defaultEdgeId,
      manifest.interaction.initialDistanceMm,
    )
    const visited = new Set<string>()
    const preferred = ['NPX', 'LX', 'TR', 'RPB']
    for (let step = 0; step < 900 && abbr(state.edgeId) !== 'RPB'; step++) {
      const pose = poseWithTransport(
        buildScopePoseSnapshot({ state, graph, labels, lookAheadMm: 14 }),
        frames,
      )
      const frame = scopeOpticalFrame(pose)
      const next = driveScope(state, 1, graph, frames, frame, collider)
      if (next.movementMessage) {
        // A learner aims into the opening, as the "Aim into an opening" prompt asks.
        expect(next.movementMessage).toMatch(/^Aim into/)
        const target = childrenOf(next.edgeId).find((id) => preferred.includes(abbr(id)!))!
        const direction = unit(minus(anchor(target), frame.position))
        const base = frames.at(next.edgeId, next.distanceMm)
        expect(collider.visible(frame.position, anchor(target))).toBe(true)
        state = updateLookOffset(next, {
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
    expect(abbr(state.edgeId)).toBe('RPB')
    expect([...visited]).toEqual(['LNP', 'NPX', 'LX', 'TR', 'RPB'])
  })
})
