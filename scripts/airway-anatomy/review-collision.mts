import fs from 'node:fs'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createLumenCollider } from '../../src/lib/airway-anatomy/lumen-collider'
import { buildTransportFrames } from '../../src/lib/airway-anatomy/transport-frames'
import { createInitialScopeState } from '../../src/lib/airway-anatomy/scope-state'
import { driveScope, enterFreeDrive } from '../../src/lib/airway-anatomy/drive'
import type { AirwayGraph, AirwayAnatomyCaseManifest } from '../../src/lib/airway-anatomy/types'

const root = 'public/airway-anatomy/case-001/'
const graph = JSON.parse(
  fs.readFileSync(root + 'metadata/airway_graph.json', 'utf8'),
) as AirwayGraph
const manifest = JSON.parse(
  fs.readFileSync(root + 'case_manifest.json', 'utf8'),
) as AirwayAnatomyCaseManifest
const bytes = fs.readFileSync(root + 'lumen-v2.glb')
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  '',
)
gltf.scene.updateMatrixWorld(true)
let geometry: THREE.BufferGeometry | undefined
gltf.scene.traverse((object) => {
  if (object instanceof THREE.Mesh) {
    assert.equal(geometry, undefined, 'Expected one source lumen')
    geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
  }
})
assert.ok(geometry)
const collider = createLumenCollider(geometry)
let samples = 0
const outside = []
for (const edge of graph.edges)
  for (let i = 0; i < edge.pointsLps.length; i++) {
    const clearance = collider.clearance(edge.pointsLps[i])
    samples++
    if (clearance < -0.0001) outside.push({ edge: edge.id, index: i, clearance })
  }
assert.equal(outside.length, 0, JSON.stringify(outside))
const frames = buildTransportFrames(graph, manifest.orientationLandmarks),
  frame = frames.at(0, 30)
const initial = enterFreeDrive(createInitialScopeState(graph, 0, 30), frame, graph)
const advanced = driveScope(initial, 5, graph, frames, frame, collider)
assert.ok(Math.hypot(...advanced.freeFrame!.position.map((v, i) => v - frame.position[i])) > 4.9)
const withdrawn = driveScope(advanced, -5, graph, frames, advanced.freeFrame!, collider)
assert.ok(Math.hypot(...withdrawn.freeFrame!.position.map((v, i) => v - frame.position[i])) < 0.001)
// A large step toward the tracheal wall is swept and stopped while still inside.
const lateral = { ...frame, forward: frame.right }
const blocked = driveScope({ ...initial, freeFrame: lateral }, 50, graph, frames, lateral, collider)
assert.ok(blocked.movementMessage?.includes('Wall contact'))
assert.ok(collider.clearance(blocked.freeFrame!.position) >= 1.89)
console.log(
  JSON.stringify(
    {
      centerlineSamples: samples,
      outsideSamples: outside.length,
      actualSurfaceAdvanceWithdraw: true,
      largeStepWallStop: true,
      wallStopClearanceMm: collider.clearance(blocked.freeFrame!.position),
    },
    null,
    2,
  ),
)
