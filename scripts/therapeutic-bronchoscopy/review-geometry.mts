import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createLumenCollider } from '../../src/lib/airway-anatomy/lumen-collider'
import { buildTransportFrames } from '../../src/lib/airway-anatomy/transport-frames'
import { DEFAULT_PATHOLOGY, siteFor } from '../../src/lib/airway-anatomy/pathology/model'
import {
  placePathology,
  createPlacedLesionGeometry,
  createLesionCollider,
  combinePathologyCollider,
} from '../../src/lib/airway-anatomy/pathology/geometry'
import {
  approachPose,
  initialInstrumentState,
  instrumentContact,
  instrumentTransition,
  makeTumorTarget,
} from '../../src/features/therapeutic-bronchoscopy/engine/instruments'
import {
  TissueVolume,
  serializeGeometry,
  geometryFromData,
} from '../../src/features/therapeutic-bronchoscopy/engine/tissue'
async function load(file: string) {
  const bytes = await readFile(file)
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  )
  const meshes: THREE.Mesh[] = []
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o)
  })
  assert.equal(meshes.length, 1)
  return meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld)
}
const root = 'public/airway-anatomy/case-001'
const graph = JSON.parse(await readFile(`${root}/metadata/airway_graph.json`, 'utf8')),
  frames = buildTransportFrames(graph)
const lumen = createLumenCollider(await load(`${root}/lumen-v2.glb`)),
  results = []
for (const site of ['trachea', 'left-mainstem', 'right-mainstem', 'intermedius'] as const) {
  for (const id of ['forceps', 'cryoprobe', 'snare'] as const) {
    const settings = {
      ...DEFAULT_PATHOLOGY,
      site,
      morphology: id === 'snare' ? ('polypoid' as const) : ('obstructing' as const),
      size: id === 'forceps' ? 0.85 : 1,
    }
    const placement = placePathology(settings, frames, lumen),
      source = await load(`public/bronchoscopy-abnormalities/${settings.morphology}.glb`)
    const geometry = createPlacedLesionGeometry(
      source,
      settings,
      placement,
      frames,
      lumen,
      graph.edges.find((e: { id: number }) => e.id === siteFor(site).edgeId).lengthMm,
    )
    const collider = combinePathologyCollider(lumen, createLesionCollider(geometry)),
      pose = approachPose(frames, placement, collider, site, id)
    assert.ok(pose, `${id}/${site}: approach`)
    const target = makeTumorTarget(geometry)
    let state = initialInstrumentState(id)
    let contact = instrumentContact(pose, state, target, lumen, placement, settings.morphology)
    state = { ...state, extension: contact.maximumExtension, open: true, returnElectrode: true }
    contact = instrumentContact(pose, state, target, lumen, placement, settings.morphology)
    if (id === 'snare') {
      assert.ok(contact.stalkInLoop, `${site}: stalk capture`)
      state = instrumentTransition(state, { type: 'close' }, contact).state
    }
    if (id === 'cryoprobe') state = { ...state, freezing: true, adhesion: 1 }
    const action = {
      type: id === 'forceps' ? 'close' : id === 'cryoprobe' ? 'extract' : 'energize',
    } as const
    const transition = instrumentTransition(state, action, contact)
    assert.ok(transition.cut, `${id}/${site}: ${transition.state.status}`)
    const volume = new TissueVolume(serializeGeometry(geometry)),
      result = volume.cut(transition.cut)
    assert.ok(result.removedMm3 > 0, `${id}/${site}: actual tissue removed`)
    const residual = geometryFromData(result),
      remaining = createLesionCollider(residual)
    assert.ok(Number.isFinite(remaining.clearance(pose.position)))
    if (transition.cut.kind === 'bite') assert.ok(remaining.clearance(transition.cut.center) > 0.1)
    results.push({
      site,
      instrument: id,
      remaining: result.remainingFraction,
      removedMm3: result.removedMm3,
      triangles: (residual.index?.count ?? 0) / 3,
    })
    console.log(site, id, Math.round(result.remainingFraction * 100) + '% residual')
  }
}
await mkdir('artifacts/therapeutic-bronchoscopy', { recursive: true })
await writeFile(
  'artifacts/therapeutic-bronchoscopy/geometry-review.json',
  JSON.stringify(results, null, 2),
)
