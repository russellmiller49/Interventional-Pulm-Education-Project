/** @jest-environment node */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'

import { minus, scalar, unit } from '../bronchoscopy-core/frame'
import { driveScope } from './drive'
import { createLumenCollider } from './lumen-collider'
import { deriveScopeLocation, type AirwayScopeLocation } from './scope-location'
import {
  buildScopePoseSnapshot,
  createInitialScopeState,
  sampleEdgePose,
  updateLookOffset,
} from './scope-state'
import { buildTransportFrames, poseWithTransport, scopeOpticalFrame } from './transport-frames'
import type { AirwayAnatomyCaseManifest, AirwayGraph, CenterlineLabels } from './types'

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
const anchor = (edgeId: number) => {
  const edge = edges.get(edgeId)!
  return sampleEdgePose(edge, Math.min(7, edge.lengthMm * 0.6)).point
}

/** Same lumen reader as dolphin-case.test.ts. */
function lumenGeometry() {
  const buffer = fs.readFileSync(path.join(caseDir, 'lumen-v2.glb'))
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

describe('deriveScopeLocation', () => {
  it('names the edge and the passage the scope came down', () => {
    const rb4 = graph.edges.find((edge) => abbr(edge.id) === 'RB4')!
    const location = deriveScopeLocation(
      graph,
      labels,
      { edgeId: rb4.id, distanceMm: 3, edgeLengthMm: rb4.lengthMm },
      false,
    )
    expect(location.abbr).toBe('RB4')
    expect(location.pathAbbrs).toEqual(['LNP', 'NPX', 'LS', 'LX', 'TRA', 'RMB', 'RB4'])
    expect(location.freeDrive).toBe(false)
  })

  it('reports an unlabelled edge honestly', () => {
    const location = deriveScopeLocation(
      graph,
      { ...labels, edgeLabels: {} },
      { edgeId: 0, distanceMm: 0, edgeLengthMm: 1 },
      false,
    )
    expect(location.abbr).toBe('Edge 0')
    expect(location.name).toBe('Unlabeled branch')
  })

  it('reports each edge of a headless drive from the naris to the right main bronchus', () => {
    const collider = createLumenCollider(lumenGeometry())
    let state = createInitialScopeState(
      graph,
      manifest.interaction.defaultEdgeId,
      manifest.interaction.initialDistanceMm,
    )
    const reported: AirwayScopeLocation[] = []
    let lastEdge = -1
    const report = () => {
      if (state.edgeId === lastEdge) return
      lastEdge = state.edgeId
      reported.push(
        deriveScopeLocation(graph, labels, { ...state, edgeLengthMm: 0 }, Boolean(state.freeFrame)),
      )
    }
    report()
    const preferred = ['NPX', 'LS', 'LX', 'TRA', 'RMB']
    for (let step = 0; step < 900 && abbr(state.edgeId) !== 'RMB'; step++) {
      const pose = poseWithTransport(
        buildScopePoseSnapshot({ state, graph, labels, lookAheadMm: 14 }),
        frames,
      )
      const frame = scopeOpticalFrame(pose)
      const next = driveScope(state, 1, graph, frames, frame, collider)
      const wrongTurn =
        next.edgeId !== state.edgeId &&
        abbr(next.edgeId) !== abbr(state.edgeId) &&
        !preferred.includes(abbr(next.edgeId)!)
      if (next.movementMessage || wrongTurn) {
        const at = wrongTurn ? state : next
        const target = childrenOf(at.edgeId).find((id) => preferred.includes(abbr(id)!))!
        const direction = unit(minus(anchor(target), frame.position))
        const base = frames.at(at.edgeId, at.distanceMm)
        state = updateLookOffset(at, {
          yawDeg:
            (Math.atan2(-scalar(direction, base.right), scalar(direction, base.forward)) * 180) /
            Math.PI,
          pitchDeg: (Math.asin(scalar(direction, base.up)) * 180) / Math.PI,
        })
        continue
      }
      state = next
      report()
    }
    const sequence = reported
      .map((location) => location.abbr)
      .filter((value, index, all) => all[index - 1] !== value)
    expect(sequence).toEqual(['LNP', 'NPX', 'LS', 'LX', 'TRA', 'RMB'])
    expect(reported.at(-1)!.pathAbbrs).toEqual(['LNP', 'NPX', 'LS', 'LX', 'TRA', 'RMB'])
  })
})
