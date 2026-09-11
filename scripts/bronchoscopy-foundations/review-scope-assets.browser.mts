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
  const target = file.graph.edges.find((e) => e.id === mark.targetEdgeId)!
  const targetPoint = sampleEdgePose(target, Math.min(7, target.lengthMm * 0.6)).point
  const opposite = file.graph.edges.find((e) => e.id === mark.oppositeEdgeId)
  const from = opposite
    ? sampleEdgePose(opposite, Math.min(7, opposite.lengthMm * 0.6)).point
    : f.position
  const offset = new THREE.Vector3(...targetPoint).sub(new THREE.Vector3(...from))
  const screenRightMm = offset.dot(new THREE.Vector3(...f.right))
  const screenUpMm = offset.dot(new THREE.Vector3(...f.up))
  const relationshipMatches = mark.screenDirection === 'left' ? screenRightMm < 0 : screenUpMm > 0
  assert(relationshipMatches, `${id} reference orientation changed`)
  return {
    id,
    edgeId: mark.edgeId,
    distanceMm: mark.distanceMm,
    frame: f,
    expectation: mark.expectation,
    screenRightMm,
    screenUpMm,
    relationshipMatches,
  }
}
Object.assign(globalThis, { scopeAssetReview: { report, renderReference } })

const anatomyBase = '/bronchoscopy-foundations/anatomy'
const larynxData = (await fetch(`${anatomyBase}/larynx/larynx.json`).then((r) => r.json())) as {
  pathLps: [number, number, number][]
  exitRingLps: [number, number, number][]
  frameLps: {
    forward: [number, number, number]
    left: [number, number, number]
    anterior: [number, number, number]
  }
}
const larynx = await loader.loadAsync(`${anatomyBase}/larynx/larynx-lumen.glb`)
const accessories = await loader.loadAsync(`${anatomyBase}/devices/accessories.glb`)
const devices = (await fetch(`${anatomyBase}/devices/devices.json`).then((r) => r.json())) as {
  accessories: { states: { state: string; node: string }[] }[]
}
const larynxScene = new THREE.Scene()
larynxScene.background = new THREE.Color('#140708')
larynxScene.add(larynx.scene, new THREE.AmbientLight(0xffddcc, 1.4))
const headlight = new THREE.PointLight(0xfff3df, 120, 80, 2)
larynxScene.add(headlight)
const fillLight = new THREE.DirectionalLight(0xffeedc, 1.5)
larynxScene.add(fillLight)
const folds = ['L', 'R'].map(
  (side) => larynx.scene.getObjectByName(`UA_fold_true_${side}`) as THREE.Mesh,
)
const framework = larynx.scene.getObjectByName('UA_skeleton')!
framework.visible = false
const larynxForward = new THREE.Vector3(...larynxData.frameLps.forward)
const larynxLeft = new THREE.Vector3(...larynxData.frameLps.left)
const larynxAnterior = new THREE.Vector3(...larynxData.frameLps.anterior)
const larynxRoot = new THREE.Vector3(...larynxData.pathLps.at(-1)!)
const glottisPoint = larynxRoot.clone().addScaledVector(larynxForward, -15)
const foldChecks = [0, 0.5, 1].map((weight) => {
  for (const fold of folds) fold.morphTargetInfluences![0] = weight
  const edges = folds.map((fold, i) => {
    const xs: number[] = []
    for (let j = 0; j < fold.geometry.getAttribute('position').count; j++) {
      const vertex = fold.getVertexPosition(j, new THREE.Vector3()).sub(glottisPoint)
      if (Math.abs(vertex.dot(larynxAnterior)) < 0.1) xs.push(vertex.dot(larynxLeft))
    }
    assert(xs.length > 0, 'Missing sampled fold midline')
    return i === 0 ? Math.min(...xs) : Math.max(...xs)
  })
  return { weight, midGlottisGapMm: edges[0] - edges[1] }
})
assert(
  foldChecks[0].midGlottisGapMm > foldChecks[1].midGlottisGapMm,
  'Morph does not narrow the opening',
)
assert(foldChecks[1].midGlottisGapMm > 1, 'Half adduction must remain visibly open')
assert(Math.abs(foldChecks[2].midGlottisGapMm) < 0.001, 'Full adduction must close the opening')
const ringDistances = larynxData.exitRingLps.map((p) => {
  point.set(...p)
  sourceBvh.closestPointToPoint(point, nearest)
  return nearest.distance
})
function renderLarynx(weight: number, exterior = false) {
  renderer.setSize(800, 600)
  renderer.setScissorTest(false)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  for (const fold of folds) fold.morphTargetInfluences![0] = weight
  larynx.scene.traverse((o) => {
    if (o instanceof THREE.Mesh)
      o.visible = exterior
        ? !['UA_lumen', 'UA_subglottis'].includes(o.name)
        : o.name !== 'UA_skeleton'
  })
  camera.position.copy(larynxRoot).addScaledVector(larynxForward, -30)
  if (exterior) camera.position.addScaledVector(larynxLeft, 65).addScaledVector(larynxAnterior, 45)
  camera.up.copy(exterior ? larynxForward.clone().negate() : larynxAnterior)
  camera.lookAt(glottisPoint)
  headlight.position.copy(camera.position)
  fillLight.position.copy(camera.position).addScaledVector(larynxLeft, 30)
  fillLight.target.position.copy(glottisPoint)
  larynxScene.add(fillLight.target)
  camera.fov = exterior ? 50 : 72
  camera.updateProjectionMatrix()
  renderer.render(larynxScene, camera)
}
function renderAccessories() {
  renderer.setSize(1200, 700)
  renderer.setScissorTest(true)
  const states = devices.accessories.flatMap((a) => a.states)
  const statesReport = []
  for (let i = 0; i < states.length; i++) {
    const state = states[i]
    const object = accessories.scene.getObjectByName(state.node) as THREE.Mesh
    const s = new THREE.Scene()
    s.background = new THREE.Color('#13222a')
    s.add(object, new THREE.AmbientLight(0xffffff, 2))
    const light = new THREE.DirectionalLight(0xffffff, 3)
    light.position.set(4, 7, 8)
    s.add(light)
    const c = new THREE.PerspectiveCamera(38, 400 / 350, 0.1, 100)
    c.position.set(10, 6, 16)
    c.up.set(0, 0, 1)
    c.lookAt(0, 0, -5)
    const x = Math.floor(i / 2) * 400,
      y = (1 - (i % 2)) * 350
    renderer.setViewport(x, y, 400, 350)
    renderer.setScissor(x, y, 400, 350)
    renderer.render(s, c)
    object.geometry.computeBoundingBox()
    const bounds = object.geometry.boundingBox!
    statesReport.push({
      state: state.state,
      node: state.node,
      vertices: object.geometry.getAttribute('position').count,
      triangles: object.geometry.index!.count / 3,
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
    })
  }
  renderer.setScissorTest(false)
  renderer.setViewport(0, 0, 1200, 700)
  return statesReport
}
Object.assign(globalThis, {
  scopeDeviceReview: {
    renderLarynx,
    renderAccessories,
    report: {
      schema: 'bronchoscopy_foundations_device_review/v1',
      foldChecks,
      pathLengthMm: larynxData.pathLps
        .slice(1)
        .reduce((sum, p, i) => sum + distance(p, larynxData.pathLps[i]), 0),
      maxPathSpacingMm: Math.max(
        ...larynxData.pathLps.slice(1).map((p, i) => distance(p, larynxData.pathLps[i])),
      ),
      pathEndpointGapMm: distance(
        larynxData.pathLps.at(-1)!,
        file.graph.nodes.find((n) => n.id === 0)!.lps,
      ),
      junction: {
        status: 'pending-source-inlet-decision',
        exitRingSourceMaxDistanceMm: Math.max(...ringDistances),
        exitRingSourceMeanDistanceMm:
          ringDistances.reduce((a, b) => a + b, 0) / ringDistances.length,
        continuousOpeningVerified: false,
      },
    },
  },
})
