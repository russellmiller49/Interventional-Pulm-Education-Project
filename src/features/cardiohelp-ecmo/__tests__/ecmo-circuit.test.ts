import * as THREE from 'three'

import { bloodColor, DRAINAGE_CLAMP_U, RETURN_CLAMP_U } from '../components/ecmo-circuit/constants'
import { buildCircuitLayout } from '../components/ecmo-circuit/layout'
import { applyFlowShader, createFlowUniforms } from '../components/ecmo-circuit/flowMaterials'
import { buildFlowTubeGeometry } from '../components/ecmo-circuit/tubeGeometry'

describe('ECMO bedside circuit layout', () => {
  it('differs anatomically between VV and VA', () => {
    const vv = buildCircuitLayout('vv')
    const va = buildCircuitLayout('va')

    expect(vv.dpc).toBeNull()
    expect(va.dpc).not.toBeNull()
    expect(vv.returnInsertion.equals(va.returnInsertion)).toBe(false)
    expect(vv.returnSite.ringColorKey).toBe('returnVeinRing')
    expect(va.returnSite.ringColorKey).toBe('returnArteryRing')
    expect(vv.labels.some((label) => label.text.includes('right atrium'))).toBe(true)
    expect(va.labels.some((label) => label.text.includes('Femoral artery'))).toBe(true)
    expect(va.labels.some((label) => label.id === 'dpc')).toBe(true)
    expect(vv.labels.some((label) => label.id === 'dpc')).toBe(false)
  })

  it('produces finite curves with near-patient clamp stations', () => {
    for (const mode of ['vv', 'va'] as const) {
      const layout = buildCircuitLayout(mode)
      for (const curve of [
        layout.drainageCannula,
        layout.returnCannula,
        layout.drainageLine,
        layout.returnLine,
        layout.sweepLine,
      ]) {
        for (const point of curve.getPoints(24)) {
          expect(Number.isFinite(point.x)).toBe(true)
          expect(Number.isFinite(point.y)).toBe(true)
          expect(Number.isFinite(point.z)).toBe(true)
        }
      }
      expect(layout.drainageClampU).toBeGreaterThan(0)
      expect(layout.drainageClampU).toBeLessThan(0.5)
      expect(layout.returnClampU).toBeGreaterThan(0.5)
      expect(layout.returnClampU).toBeLessThan(1)
      expect(layout.drainageClampU).toBe(DRAINAGE_CLAMP_U)
      expect(layout.returnClampU).toBe(RETURN_CLAMP_U)
    }
  })

  it('injects flow uniforms and shader chunks via onBeforeCompile', () => {
    const uniforms = createFlowUniforms()
    const material = applyFlowShader(new THREE.MeshStandardMaterial(), uniforms, 'test-core')
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <emissivemap_fragment>',
    }
    material.onBeforeCompile(shader as never, undefined as never)

    expect(shader.uniforms).toHaveProperty('uFlowPhase')
    expect(shader.uniforms).toHaveProperty('uPinchAmount')
    expect(shader.vertexShader).toContain('attribute vec3 aCenter;')
    expect(shader.vertexShader).toContain('uPinchU')
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance')
    expect(material.customProgramCacheKey()).toBe('test-core')
  })

  it('builds tube geometry carrying a centerline attribute', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0.2, 0),
      new THREE.Vector3(2, 0, 0.3),
    ])
    const geometry = buildFlowTubeGeometry(curve, 0.05, 8)
    const centers = geometry.getAttribute('aCenter')
    expect(centers).toBeDefined()
    expect(centers.count).toBe(geometry.attributes.position.count)
    const first = new THREE.Vector3(centers.getX(0), centers.getY(0), centers.getZ(0))
    expect(first.distanceTo(curve.getPointAt(0))).toBeLessThan(1e-6)
    geometry.dispose()
  })

  it('maps oxygen saturation to venous-to-arterial blood tints', () => {
    const venous = bloodColor(0.6)
    const arterial = bloodColor(1)
    expect(arterial.r).toBeGreaterThan(venous.r)
    expect(bloodColor(0.4).getHexString()).toBe(venous.getHexString())
    expect(bloodColor(1.4).getHexString()).toBe(arterial.getHexString())
  })
})
