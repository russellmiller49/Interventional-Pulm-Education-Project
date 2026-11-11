import { createHash } from 'crypto'
import { mucosaFragmentShader } from '@/lib/bronchoscopy-core/mucosa'
import {
  SCOPE_SHADER_ANCHORS,
  SCOPE_VESSELS,
  createScopeMaterial,
  scopeFragmentShader,
  setScopeReach,
} from '../components/scope-material'
import { CT_TRACES } from '../geometry/native-ct'
import { FALLOFF_MM, falloffMmFor, routeRadiusMm } from '../geometry/airway-radius'
import { pairedPath } from '../geometry/paired-scope'

/**
 * The scope picture's material is the shared mucosa shader with four of its lines replaced. The
 * shared shader belongs to the navigation trainer and the EBUS course too, so it is not edited
 * here; these tests notice when it changes under this module.
 */
describe('the scope picture is built on the shared mucosa shader', () => {
  test.each(Object.entries(SCOPE_SHADER_ANCHORS))(
    'the shared shader has the "%s" line in exactly one place',
    (_key, anchor) => {
      expect(mucosaFragmentShader.split(anchor)).toHaveLength(2)
    },
  )

  // A change to the shared shader is allowed; it has to be looked at in this module's picture.
  // After looking (lesson 4, a subsegmental fork and the arrival), update the hash.
  test('the shared shader is the one this picture was tuned against', () => {
    expect(createHash('sha256').update(mucosaFragmentShader).digest('hex')).toBe(
      '28c654488f6ec59c6dd9dc5d3edf55fb3697ac7218176160015efc076beb08f2',
    )
  })

  test('the reach of the light and the vessel lines are added, and nothing else is removed', () => {
    const source = scopeFragmentShader()
    expect(source).toContain('uniform float uFalloffMm;')
    expect(source).toContain('uniform float uVessels;')
    expect(source).toContain('pow(distanceMm/uFalloffMm,1.65)')
    expect(source).not.toContain('distanceMm/23.0')
    expect(source).not.toContain('smoothstep(80.0,180.0,distanceMm)')
    // Every line of the shared shader that holds none of the four is still there, unchanged.
    const anchors = Object.values(SCOPE_SHADER_ANCHORS)
    const kept = mucosaFragmentShader
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !anchors.some((anchor) => line.includes(anchor)))
    expect(kept.length).toBeGreaterThan(20)
    for (const line of kept) expect(source).toContain(line)
  })

  test('the material starts at the shared reach and takes a new one', () => {
    const material = createScopeMaterial()
    expect(material.uniforms.uFalloffMm.value).toBe(FALLOFF_MM.far)
    expect(material.uniforms.uVessels.value).toBe(SCOPE_VESSELS)
    setScopeReach(material, 7)
    expect(material.uniforms.uFalloffMm.value).toBe(7)
    material.dispose()
  })
})

describe('the light reaches as far as the airway is wide', () => {
  test('the reach stays inside its limits', () => {
    expect(falloffMmFor(0)).toBe(FALLOFF_MM.near)
    expect(falloffMmFor(1)).toBe(FALLOFF_MM.near)
    expect(falloffMmFor(9)).toBe(FALLOFF_MM.far)
    expect(falloffMmFor(3)).toBeGreaterThan(FALLOFF_MM.near)
    expect(falloffMmFor(3)).toBeLessThan(FALLOFF_MM.far)
  })

  test.each(CT_TRACES.map((trace) => [trace.id, trace] as const))(
    '%s: the shared reach in the trachea, a short one at the end, no step on the way',
    (_id, trace) => {
      const { arcs } = pairedPath(trace)
      const end = arcs[arcs.length - 1]
      expect(falloffMmFor(routeRadiusMm(trace, 0))).toBe(FALLOFF_MM.far)
      expect(falloffMmFor(routeRadiusMm(trace, end))).toBeLessThan(8)
      // Past either end of the route the radius is the end's own.
      expect(routeRadiusMm(trace, end + 50)).toBeGreaterThan(0)
      expect(routeRadiusMm(trace, -50)).toBeGreaterThan(0)
      let step = 0
      for (let arc = 0; arc < end; arc += 1) {
        const here = falloffMmFor(routeRadiusMm(trace, arc))
        const next = falloffMmFor(routeRadiusMm(trace, arc + 1))
        step = Math.max(step, Math.abs(next - here))
      }
      // Under 3 mm of reach for a millimetre driven: the picture's light eases, it does not jump.
      expect(step).toBeLessThan(3)
    },
  )
})
