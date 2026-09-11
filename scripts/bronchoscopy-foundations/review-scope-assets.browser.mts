/** Standalone asset harness: uses the actual browser decoder, collider and drive code. */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshBVH } from 'three-mesh-bvh'
import { createLumenCollider } from '../../src/lib/airway-anatomy/lumen-collider'
import { createBronchoscopyMaterial } from '../../src/lib/airway-anatomy/airway-render'
import { buildTransportFrames } from '../../src/lib/airway-anatomy/transport-frames'
import { createInitialScopeState, sampleEdgePose } from '../../src/lib/airway-anatomy/scope-state'
import {
  driveScope,
  enterFreeDrive,
  FLEXIBLE_TIP_RADIUS_MM,
} from '../../src/lib/airway-anatomy/drive'
import {
  createScopeCase,
  type TeachingGraphFile,
} from '../../src/features/bronchoscopy-foundations/engine/scope/scopeCase'

const base = '/bronchoscopy-foundations/anatomy/adult-teaching-combined-left-basal-v1'
const decoder = new DRACOLoader().setDecoderPath('/fluoroview/draco/').setWorkerLimit(1)
const loader = new GLTFLoader().setDRACOLoader(decoder)
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const file = (await fetch(`${base}/graph.json`).then((r) => r.json())) as TeachingGraphFile
const bytes = await fetch(`${base}/lumen.glb`).then((r) => r.arrayBuffer())
const started = performance.now()
const gltf = await loader.parseAsync(bytes, '')
const decodeMs = performance.now() - started
const meshes: THREE.Mesh[] = []
gltf.scene.traverse((o) => {
  if (o instanceof THREE.Mesh) meshes.push(o)
})
assert(meshes.length === 1, 'One display/collision mesh required')
const geometry = meshes[0].geometry
const bvhStarted = performance.now()
const collider = createLumenCollider(geometry)
const bvhBuildMs = performance.now() - bvhStarted
const scopeCase = createScopeCase(file, { collider })
const frames = buildTransportFrames(file.graph, [...file.orientationLandmarks])
let centerlineSamples = 0,
  interpolatedSamples = 0
const outside: { edgeId: number; clearanceMm: number; point: number[] }[] = []
let minimumClearanceMm = Infinity
for (const edge of file.graph.edges) {
  for (const point of edge.pointsLps) {
    const c = collider.clearance(point)
    centerlineSamples++
    minimumClearanceMm = Math.min(minimumClearanceMm, c)
    if (c < 0) outside.push({ edgeId: edge.id, clearanceMm: c, point })
  }
  for (let d = 0; d <= edge.lengthMm; d += 0.25) {
    const point = sampleEdgePose(edge, d).point
    const c = collider.clearance(point)
    interpolatedSamples++
    if (c < 0) outside.push({ edgeId: edge.id, clearanceMm: c, point })
  }
}
const airwayClearances = [...scopeCase.originEdge].map(([label, edgeId]) => {
  const edge = scopeCase.index.edgesById.get(edgeId)!
  let min = Infinity
  for (let d = 0; d < edge.lengthMm; d += 0.25)
    min = Math.min(min, collider.clearance(sampleEdgePose(edge, d).point))
  min = Math.min(min, ...edge.pointsLps.map((p) => collider.clearance(p)))
  return { label, edgeId, minClearanceMm: min, freeDriveFits: min >= FLEXIBLE_TIP_RADIUS_MM }
})
const frame = frames.at(0, 30)
const initial = enterFreeDrive(createInitialScopeState(file.graph, 0, 30), frame, file.graph)
const advanced = driveScope(initial, 5, file.graph, frames, frame, collider)
const withdrawn = driveScope(advanced, -5, file.graph, frames, advanced.freeFrame!, collider)
const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]))
const lateral = { ...frame, forward: frame.right }
const blocked = driveScope(
  { ...initial, freeFrame: lateral },
  50,
  file.graph,
  frames,
  lateral,
  collider,
)
const rootFrame = frames.at(0, 0)
const rootInitial = enterFreeDrive(createInitialScopeState(file.graph, 0, 0), rootFrame, file.graph)
const rootAdvance = driveScope(rootInitial, 5, file.graph, frames, rootFrame, collider)
const rootEntry = {
  clearanceMm: collider.clearance(rootFrame.position),
  freeDriveAdvanceMm: distance(rootFrame.position, rootAdvance.freeFrame!.position),
  message: rootAdvance.movementMessage ?? null,
}

// Verify Draco preserves topology and bound displacement of every corresponding source vertex.
const rawBytes = await fetch('/build/lumen.raw.glb').then((r) => r.arrayBuffer())
const rawGltf = await loader.parseAsync(rawBytes, '')
let raw!: THREE.BufferGeometry
rawGltf.scene.traverse((o) => {
  if (o instanceof THREE.Mesh) raw = o.geometry
})
const rawPos = raw.getAttribute('position'),
  pos = geometry.getAttribute('position')
const cells = new Map<string, number[]>()
const key = (x: number, y: number, z: number) => `${x},${y},${z}`
for (let i = 0; i < rawPos.count; i++) {
  const k = key(
    Math.round(rawPos.getX(i) * 100),
    Math.round(rawPos.getY(i) * 100),
    Math.round(rawPos.getZ(i) * 100),
  )
  const list = cells.get(k) ?? []
  list.push(i)
  cells.set(k, list)
}
const mapping: number[] = [],
  displacements: number[] = []
for (let i = 0; i < pos.count; i++) {
  const xyz = [pos.getX(i), pos.getY(i), pos.getZ(i)]
  const cell = xyz.map((v) => Math.round(v * 100))
  let best = -1,
    min = Infinity
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++)
        for (const j of cells.get(key(cell[0] + x, cell[1] + y, cell[2] + z)) ?? []) {
          const d = distance(xyz, [rawPos.getX(j), rawPos.getY(j), rawPos.getZ(j)])
          if (d < min) {
            min = d
            best = j
          }
        }
  assert(best >= 0 && min < 0.01, 'Draco changed or lost a source vertex')
  mapping.push(best)
  displacements.push(min)
}
const triangles = (g: THREE.BufferGeometry, map?: number[]) => {
  const result = new Map<string, number>(),
    index = g.index!
  for (let i = 0; i < index.count; i += 3) {
    const a = [0, 1, 2].map((k) => (map ? map[index.getX(i + k)] : index.getX(i + k)))
    // Cyclic rotation preserves face orientation (sorting alone would hide reversed normals).
    const first = a.indexOf(Math.min(...a))
    const k = [...a.slice(first), ...a.slice(0, first)].join(',')
    result.set(k, (result.get(k) ?? 0) + 1)
  }
  return result
}
const rawTriangles = triangles(raw),
  compressedTriangles = triangles(geometry, mapping)
const topologyPreserved =
  rawTriangles.size === compressedTriangles.size &&
  [...rawTriangles].every(([k, v]) => compressedTriangles.get(k) === v)
assert(topologyPreserved, 'Draco changed the triangulation or winding')
const maxVertexDisplacementMm = Math.max(...displacements)
const deviation = {
  method:
    'Exhaustive vertex correspondence and oriented triangle equivalence before/after Draco. Maximum vertex displacement bounds every point of each corresponding triangle in both directions.',
  sourceSurface: 'Retained source triangles; authored distal closing caps reported separately.',
  decimation: 'None',
  vertexSamples: displacements.length,
  topologyPreserved,
  maxSurfaceDeviationBoundMm: maxVertexDisplacementMm,
  meanVertexDisplacementMm: displacements.reduce((a, b) => a + b, 0) / displacements.length,
}
assert(maxVertexDisplacementMm <= 0.3, 'Source deviation budget exceeded')

const source = await loader.loadAsync('/airway-anatomy/case-001/lumen-v2.glb')
let sourceGeometry!: THREE.BufferGeometry
source.scene.traverse((o) => {
  if (o instanceof THREE.Mesh) sourceGeometry = o.geometry
})
const sourceBvh = new MeshBVH(sourceGeometry)
const caps = (await fetch('/build/lumen-caps.json').then((r) => r.json())) as {
  triangles: number[][][]
}
const nearest = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 },
  point = new THREE.Vector3()
const capDistances = caps.triangles.map((t) => {
  point.set(0, 0, 0)
  for (const p of t) point.add(new THREE.Vector3(...p))
  point.multiplyScalar(1 / 3)
  sourceBvh.closestPointToPoint(point, nearest)
  return nearest.distance
})

const report = {
  schema: 'bronchoscopy_foundations_collision_review/v1',
  centerlineSamples,
  interpolatedSamples,
  outsideSamples: outside.length,
  outside,
  minimumClearanceMm,
  tipRadiusMm: FLEXIBLE_TIP_RADIUS_MM,
  airwayClearances,
  belowTipRadius: airwayClearances.filter((a) => !a.freeDriveFits).map((a) => a.label),
  actualSurfaceAdvanceWithdraw:
    distance(frame.position, advanced.freeFrame!.position) > 4.9 &&
    distance(frame.position, withdrawn.freeFrame!.position) < 0.001,
  largeStepWallStop: Boolean(blocked.movementMessage?.includes('Wall contact')),
  wallStopClearanceMm: collider.clearance(blocked.freeFrame!.position),
  rootEntry,
  deviation,
  authoredCaps: {
    triangleCentroidSamples: capDistances.length,
    maxDistanceToSourceMm: Math.max(...capDistances),
    meanDistanceToSourceMm: capDistances.reduce((a, b) => a + b, 0) / capDistances.length,
  },
  browser: {
    userAgent: navigator.userAgent,
    dracoDecodeAndParseMs: decodeMs,
    bvhBuildMs,
    decoderPath: '/fluoroview/draco/',
    timingMethod:
      'Cold GLTFLoader.parseAsync including decoder initialization and one worker; BVH on decoded geometry; performance.now; one run.',
  },
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(800, 600)
renderer.setPixelRatio(1)
document.body.style.margin = '0'
document.body.append(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#080303')
const material = createBronchoscopyMaterial()
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
const camera = new THREE.PerspectiveCamera(88, 4 / 3, 0.08, 800)
function renderReference(id: string, original = false) {
  const mark = file.orientationLandmarks.find((m) => m.id === id)!
  const f = frames.at(mark.edgeId, mark.distanceMm)
  camera.position.set(...f.position)
  camera.up.set(...f.up)
  camera.lookAt(new THREE.Vector3(...f.position).add(new THREE.Vector3(...f.forward)))
  mesh.geometry = original ? sourceGeometry : geometry
  renderer.render(scene, camera)
  return {
    id,
    edgeId: mark.edgeId,
    distanceMm: mark.distanceMm,
    frame: f,
    expectation: mark.expectation,
  }
}
Object.assign(globalThis, { scopeAssetReview: { report, renderReference } })
