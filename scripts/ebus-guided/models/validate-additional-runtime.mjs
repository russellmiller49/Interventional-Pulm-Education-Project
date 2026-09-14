/** Verify the actual exported cylinder axis/pivots against expected fixed-entry needle endpoints. */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Vector3 } from 'three'
const dir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../EBUS-course/apps/web/public/simulator/case-001/models/guided-v2',
)
const contract = JSON.parse(readFileSync(resolve(dir, 'model-contract.json'), 'utf8'))
const raw = readFileSync(resolve(dir, 'ebus-needle-assembly.glb'))
const scene = (
  await new GLTFLoader().parseAsync(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    '',
  )
).scene
scene.scale.setScalar(1000)
const shaft = scene.getObjectByName('needle_shaft'),
  tip = scene.getObjectByName('needle_tip'),
  pivot = scene.getObjectByName('needle_motion')
const direction = new Vector3(...contract.needle.axis),
  base = new Vector3(...shaft.userData.fixedBaseWebMm)
let worst = 0,
  poses = 0
for (const sheath of [0, 1, 2])
  for (const extension of [0, 4, 12, 22]) {
    const motion = direction.clone().multiplyScalar(extension + sheath)
    const end = new Vector3(...contract.needle.retractedTip).add(motion)
    pivot.position.copy(motion).multiplyScalar(0.001)
    shaft.position.copy(base).add(end).multiplyScalar(0.5).sub(motion).multiplyScalar(0.001)
    shaft.scale.y = end.distanceTo(base) / shaft.userData.spanMm
    scene.updateMatrixWorld(true)
    const positions = shaft.geometry.attributes.position,
      projections = []
    for (let i = 0; i < positions.count; i++)
      projections.push(
        new Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(shaft.matrixWorld)
          .sub(base)
          .dot(direction),
      )
    const error = Math.max(
      Math.abs(Math.min(...projections)),
      Math.abs(Math.max(...projections) - end.distanceTo(base)),
      tip.getWorldPosition(new Vector3()).distanceTo(end),
    )
    worst = Math.max(worst, error)
    poses++
  }
if (worst > 0.002) throw new Error('Exported needle endpoint mismatch: ' + worst + ' mm')
const path = resolve(dir, 'geometry-validation.json'),
  proof = JSON.parse(readFileSync(path, 'utf8'))
proof.runtimeNeedle = {
  poses,
  maxEndpointErrorMm: worst,
  check:
    'Actual GLB vertices, pivot, cylinder axis and rendered shaft scaling compared with fixed entry and true tip.',
}
writeFileSync(path, JSON.stringify(proof, null, 2) + '\n')
console.log('Verified', poses, 'GLB needle poses; maximum endpoint error', worst, 'mm')
