/** @jest-environment node */
import * as THREE from 'three'
import { makeFrame, sweepClearance, type LumenCollider } from '@/lib/bronchoscopy-core/frame'
import { advanceBleedingTime, bleedingAmount, DEFAULT_PATHOLOGY } from './model'
import {
  combinePathologyCollider,
  createLesionCollider,
  createPlacedLesionGeometry,
  placePathology,
  sourceVisibility,
  wallDistance,
} from './geometry'

const lumen: LumenCollider = {
  clearance: (p) => 8 - Math.hypot(p[0], p[1]),
  sweep: (a, b, r) => sweepClearance(lumen.clearance, a, b, r),
  visible: () => true,
}
const frame = makeFrame([0, 0, 0], [0, 0, 1], [0, 1, 0])
const frames = { at: () => frame }

describe('wall-attached abnormality placement', () => {
  it('refreshes render bounds after conforming a plaque to patient-space anatomy', () => {
    const source = new THREE.SphereGeometry(1, 16, 12)
    source.computeBoundingSphere()
    const patientFrames = { at: () => makeFrame([0, 0, 140], [0, 0, 1], [0, 1, 0]) }
    const settings = { ...DEFAULT_PATHOLOGY, morphology: 'mucosal' as const }
    const placement = placePathology(settings, patientFrames, lumen)
    const placed = createPlacedLesionGeometry(source, settings, placement, patientFrames, lumen, 25)
    expect(placed.boundingSphere!.center.z).toBeGreaterThan(130)
    const pos = placed.getAttribute('position')
    for (let i = 0; i < pos.count; i++)
      expect(
        placed.boundingSphere!.containsPoint(new THREE.Vector3().fromBufferAttribute(pos, i)),
      ).toBe(true)
    source.dispose()
    placed.dispose()
  })
  it('uses the first actual lumen wall and a right-handed lesion transform', () => {
    expect(wallDistance(lumen, [0, 0, 0], [1, 0, 0])).toBeCloseTo(8, 3)
    const p = placePathology({ ...DEFAULT_PATHOLOGY, morphology: 'obstructing' }, frames, lumen)
    expect(lumen.clearance(p.wallPoint)).toBeCloseTo(0.025, 3)
    expect(p.matrix.determinant()).toBeGreaterThan(0)
    const crown = new THREE.Vector3(0, 0, 1).applyMatrix4(p.matrix)
    expect(lumen.clearance(crown.toArray())).toBeGreaterThan(0)
    expect(crown.distanceTo(new THREE.Vector3(...p.wallPoint))).toBeCloseTo(p.projectionMm)
  })
  it('rotates the wall attachment without moving the centerline anchor', () => {
    const a = placePathology({ ...DEFAULT_PATHOLOGY, wallAngleDeg: 0 }, frames, lumen)
    const b = placePathology({ ...DEFAULT_PATHOLOGY, wallAngleDeg: 180 }, frames, lumen)
    expect(a.wallPoint[0]).toBeCloseTo(-b.wallPoint[0])
    expect(a.radiusMm).toBeCloseTo(b.radiusMm)
  })
  it('rejects an outside anchor rather than placing a floating lesion', () => {
    expect(() => wallDistance(lumen, [20, 0, 0], [1, 0, 0])).toThrow(/outside/)
  })
})

describe('the displayed solid also blocks and occludes the scope', () => {
  const geometry = new THREE.BoxGeometry(4, 4, 4).translate(0, 0, 10)
  const lesion = createLesionCollider(geometry)
  const combined = combinePathologyCollider(lumen, lesion)
  afterAll(() => geometry.dispose())
  it('has signed distance outside and inside a closed mass', () => {
    expect(lesion.clearance([0, 0, 0])).toBeCloseTo(8)
    expect(lesion.clearance([0, 0, 10])).toBeCloseTo(-2)
  })
  it('stops a swept 3.8 mm scope before the surface, including a large advance', () => {
    const sweep = combined.sweep([0, 0, 0], [0, 0, 25], 1.9)
    expect(sweep.point[2]).toBeGreaterThan(5.5)
    expect(sweep.point[2]).toBeLessThanOrEqual(6.1)
    expect(sweep.contact.blockedMm).toBeGreaterThan(18)
    expect(combined.clearance(sweep.point)).toBeGreaterThanOrEqual(1.9)
  })
  it('permits withdrawal after contact and does not block an open path beside the mass', () => {
    const forward = combined.sweep([0, 0, 0], [0, 0, 25], 1.9)
    expect(combined.sweep(forward.point, [0, 0, 0], 1.9).contact.blockedMm).toBe(0)
    expect(combined.sweep([5, 0, 0], [5, 0, 25], 1.9).contact.blockedMm).toBe(0)
  })
  it('hides labels behind the solid and keeps unobstructed labels visible', () => {
    expect(combined.visible([0, 0, 0], [0, 0, 20])).toBe(false)
    expect(combined.visible([5, 0, 0], [5, 0, 20])).toBe(true)
  })
})

describe('bleeding is a bounded, source-dependent visual effect', () => {
  it('advances only while running and caps long interrupted frames', () => {
    expect(advanceBleedingTime(4, 0.05, false)).toBe(4)
    expect(advanceBleedingTime(4, 0.05, true)).toBe(4.05)
    expect(advanceBleedingTime(4, 900, true)).toBe(4.1)
    expect(advanceBleedingTime(4, NaN, true)).toBe(4)
  })
  it('stays absent when off and distinguishes visual presets without blood-volume units', () => {
    expect(bleedingAmount(80, 'off')).toBe(0)
    expect(bleedingAmount(10, 'brisk')).toBeGreaterThan(bleedingAmount(10, 'oozing'))
    expect(bleedingAmount(1e6, 'brisk')).toBe(1)
  })
  it('does not obscure a view facing away from or occluded from the source', () => {
    const placement = placePathology(DEFAULT_PATHOLOGY, frames, lumen)
    const toward = makeFrame(
      [0, 0, -10],
      placement.wallPoint.map((v, i) => v - [0, 0, -10][i]) as [number, number, number],
    )
    expect(sourceVisibility(toward, placement, lumen)).toBeGreaterThan(0)
    expect(sourceVisibility(makeFrame([0, 0, -10], [0, 0, -1]), placement, lumen)).toBe(0)
    expect(sourceVisibility(toward, placement, { ...lumen, visible: () => false })).toBe(0)
  })
})
