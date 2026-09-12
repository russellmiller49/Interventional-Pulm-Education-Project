import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createLumenCollider } from '../../src/lib/airway-anatomy/lumen-collider'
import { buildTransportFrames } from '../../src/lib/airway-anatomy/transport-frames'
import { createInitialScopeState } from '../../src/lib/airway-anatomy/scope-state'
import { driveScope, enterFreeDrive } from '../../src/lib/airway-anatomy/drive'
import { makeFrame, minus, plus, times } from '../../src/lib/bronchoscopy-core/frame'
import {
  DEFAULT_PATHOLOGY,
  MORPHOLOGIES,
  PATHOLOGY_SITES,
} from '../../src/lib/airway-anatomy/pathology/model'
import {
  combinePathologyCollider,
  createLesionCollider,
  createPlacedLesionGeometry,
  placePathology,
  sourceVisibility,
} from '../../src/lib/airway-anatomy/pathology/geometry'

async function loadGeometry(file: string) {
  const bytes = await readFile(file)
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
  gltf.scene.updateMatrixWorld(true)
  const meshes: THREE.Mesh[] = []
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o)
  })
  assert.equal(meshes.length, 1)
  return meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld)
}
const root = 'public/airway-anatomy/case-001'
const graph = JSON.parse(await readFile(`${root}/metadata/airway_graph.json`, 'utf8'))
const frames = buildTransportFrames(graph)
const lumen = createLumenCollider(await loadGeometry(`${root}/lumen-v2.glb`))
const results: object[] = []
for (const morphology of MORPHOLOGIES.filter((m) => m.id !== 'none')) {
  const source = await loadGeometry(`public/bronchoscopy-abnormalities/${morphology.id}.glb`)
  assert.ok(source.getAttribute('color'))
  source.computeBoundingBox()
  assert.ok(source.boundingBox!.min.z < 0 && source.boundingBox!.max.z > 0.99)
  for (const site of PATHOLOGY_SITES) {
    for (const size of [0.55, 1, 1.2]) {
      for (const wallAngleDeg of [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]) {
        const settings = {
          ...DEFAULT_PATHOLOGY,
          morphology: morphology.id,
          site: site.id,
          size,
          wallAngleDeg,
        }
        const placement = placePathology(settings, frames, lumen)
        const edge = graph.edges.find((e: { id: number }) => e.id === site.edgeId)
        const geometry = createPlacedLesionGeometry(
          source,
          settings,
          placement,
          frames,
          lumen,
          edge.lengthMm,
        )
        const lesion = createLesionCollider(geometry)
        if (morphology.id === 'mucosal' && site.id === 'right-mainstem' && size === 1) {
          const pos = geometry.getAttribute('position'),
            idx = geometry.index!
          let volume = 0
          const a = new THREE.Vector3(),
            b = new THREE.Vector3(),
            c = new THREE.Vector3()
          for (let i = 0; i < idx.count; i += 3) {
            a.fromBufferAttribute(pos, idx.getX(i))
            b.fromBufferAttribute(pos, idx.getX(i + 1))
            c.fromBufferAttribute(pos, idx.getX(i + 2))
            volume += a.dot(b.cross(c)) / 6
          }
          assert.ok(volume > 0, 'Mucosal surface must retain outward winding')
        }
        const combined = combinePathologyCollider(lumen, lesion)
        const initial = createInitialScopeState(
          graph,
          site.edgeId,
          Math.max(0, site.distanceMm - 24),
        )
        const position = frames.at(initial.edgeId, initial.distanceMm).position
        const target = plus(
          placement.wallPoint,
          times(placement.inward, Math.max(0.15, placement.projectionMm * 0.55)),
        )
        const frame = makeFrame(
          position,
          minus(target, position),
          frames.at(initial.edgeId, initial.distanceMm).up,
        )
        const state = enterFreeDrive(initial, frame, graph)
        assert.ok(
          combined.clearance(position) >= 1.9,
          `${morphology.id}/${site.id}/${size}/${wallAngleDeg}: unsafe starting point`,
        )
        const advanced = driveScope(state, 50, graph, frames, frame, combined)
        assert.ok(advanced.movementMessage, 'Should encounter wall or lesion contact')
        assert.ok(
          combined.clearance(advanced.freeFrame!.position) >= 1.899,
          'Scope penetrated a surface',
        )
        const withdrawn = driveScope(advanced, -5, graph, frames, advanced.freeFrame!, combined)
        assert.ok(!withdrawn.movementMessage, 'Withdrawal should remain available')
        results.push({
          morphology: morphology.id,
          site: site.id,
          size,
          wallAngleDeg,
          projectionMm: placement.projectionMm,
          sourceVisibility: sourceVisibility(frame, placement, lumen),
          startClearance: combined.clearance(position),
          contactClearance: combined.clearance(advanced.freeFrame!.position),
          contact: advanced.movementMessage,
        })
        geometry.dispose()
      }
    }
  }
  console.log(`Reviewed ${morphology.id} at all sites and sizes`)
  source.dispose()
}
await mkdir('artifacts/airway-abnormalities', { recursive: true })
await writeFile(
  'artifacts/airway-abnormalities/geometry-review.json',
  JSON.stringify(results, null, 2),
)
console.log(
  JSON.stringify({
    checked: results.length,
    passed: true,
  }),
)
