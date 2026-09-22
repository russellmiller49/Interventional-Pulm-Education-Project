import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { linkedCalloutFocus, surfaceAnchor } from './structureCallouts'

describe('historical linked-model marker anchors', () => {
  it('keeps the baseline SVC and aorta vertices when the observer frames the landmark region', async () => {
    const bytes = await readFile(new URL('../../public/simulator/case-001/models/guided-v1/mediastinum-teaching.glb', import.meta.url))
    const anatomy = (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene
    anatomy.scale.setScalar(1000)
    anatomy.updateMatrixWorld(true)
    // World-space vertices independently measured from the 2124cd0 baseline asset and anchor calculation.
    const historical = {
      superior_vena_cava: [-42.78440400958061, 1221.9802141189575, 190.69688022136688],
      aorta: [4.524850286543369, 1228.0302047729492, 171.64286971092224],
    }
    const regionalCameraTarget = new THREE.Vector3(-15.80960163846612, 1228.2301783561707, 174.6673658490181)
    for (const [id, expected] of Object.entries(historical)) {
      const mesh = anatomy.getObjectByName(id) as THREE.Mesh
      const fixed = surfaceAnchor(mesh, linkedCalloutFocus(null))
      fixed.toArray().forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6))
      // This was the regression: feeding the observer target chooses a different surface vertex.
      expect(surfaceAnchor(mesh, regionalCameraTarget).distanceTo(fixed)).toBeGreaterThan(3)
    }
  })
  it('keeps distal and whole-scope marker references in the genuine scope basis', () => {
    const basis = new THREE.Matrix4().makeRotationY(0.7).setPosition(2, 3, 4)
    const distal = linkedCalloutFocus(basis).applyMatrix4(basis.clone().invert()).toArray()
    ;[12, 10, 0].forEach((value, i) => expect(distal[i]).toBeCloseTo(value, 6))
    const whole = linkedCalloutFocus(basis, true).applyMatrix4(basis.clone().invert()).toArray()
    ;[99, -1, 0].forEach((value, i) => expect(whole[i]).toBeCloseTo(value, 6))
  })
})
