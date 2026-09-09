import {
  beamDirection,
  centeredForTeaching,
  dtsShift,
  kapGyCm2,
  kapMicroGyM2,
  projectPoint,
  projectToDetector,
  toolTipForDepth,
  LESION_CENTER,
  type Point3,
  sphereSliceRadius,
  temporalMetrics,
  windowRelationship,
} from '../lib/physics'
import { detectorFrameForAngles } from '../../../../fluoro-viewer/src/geometry'
import { IMAGING_CONFIG } from '../lib/anatomy'

describe('authored imaging geometry', () => {
  it('keeps the frontal tip on the source-target ray while obliquity reveals its offset', () => {
    for (const depth of [-30, 0, 22, 30]) {
      const tip = toolTipForDepth(depth)
      const target = projectToDetector(LESION_CENTER, 0)
      const p = projectToDetector(tip, 0)
      expect(p[0]).toBeCloseTo(target[0], 8)
      expect(p[1]).toBeCloseTo(target[1], 8)
      expect(Math.hypot(...tip.map((v, i) => v - LESION_CENTER[i]))).toBeCloseTo(Math.abs(depth))
    }
    const target = projectToDetector(LESION_CENTER, 30),
      tip = projectToDetector(toolTipForDepth(22), 30)
    expect(Math.hypot(target[0] - tip[0], target[1] - tip[1])).toBeGreaterThan(20)
  })
  it('projects overlays with the original FluoroView renderer cone frame at coupled angles', () => {
    const dot = (a: Point3, b: Point3) => a.reduce((s, n, i) => s + n * b[i], 0)
    for (const orbit of [-75, 0, 30, 90])
      for (const tilt of [-25, 0, 25]) {
        const frame = detectorFrameForAngles(IMAGING_CONFIG, orbit, tilt)
        const fromSource = LESION_CENTER.map((v, i) => v - frame.sourceLps[i]) as Point3
        const m = IMAGING_CONFIG.source_to_detector_mm / dot(fromSource, frame.detectorNormalLps)
        const projected = projectToDetector(LESION_CENTER, orbit, tilt)
        expect(projected[0]).toBeCloseTo(dot(fromSource, frame.detectorUAxisLps) * m, 8)
        expect(projected[1]).toBeCloseTo(dot(fromSource, frame.detectorVAxisLps) * m, 8)
      }
  })
  it('hides depth frontally and reveals the expected separation with obliquity', () => {
    expect(projectPoint([0, 10, 0], 0)).toEqual([0, 0])
    expect(projectPoint([0, 10, 0], 30)[0]).toBeCloseTo(5)
    expect(projectPoint([0, 10, 0], -30)[0]).toBeCloseTo(-5)
  })
  it('uses the same beam normal as the rotating 3D source/detector for both axes', () => {
    for (const orbit of [-60, 0, 50])
      for (const tilt of [-20, 0, 25]) {
        const n = beamDirection(orbit, tilt)
        expect(Math.hypot(...n)).toBeCloseTo(1)
        const image = projectPoint(n, orbit, tilt)
        expect(image[0]).toBeCloseTo(0)
        expect(image[1]).toBeCloseTo(0)
      }
  })
  it('distinguishes window intersection from tip location and from projected overlap', () => {
    expect(windowRelationship([14, 14, 0])).toMatchObject({
      intersects: false,
      full: false,
      tipInside: false,
    })
    expect(windowRelationship([14, 0, 0])).toMatchObject({
      intersects: true,
      full: true,
      tipInside: false,
    })
    expect(windowRelationship([18, 0, 0])).toMatchObject({ intersects: true, full: false })
    expect(windowRelationship([24, 0, 0]).intersects).toBe(false)
    expect(windowRelationship([5, 0, 0]).tipInside).toBe(true)
    // Finite window radius must agree with the rendered cylinder at the sphere edge.
    expect(windowRelationship([10, 9, 0]).intersects).toBe(true)
    expect(windowRelationship([10, 10, 0]).intersects).toBe(false)
    expect(windowRelationship([10, 8, 0]).full).toBe(false)
    expect(windowRelationship([10, 7, 0]).full).toBe(true)
  })
  it('slices the same sphere and excludes distant planes', () => {
    expect(sphereSliceRadius(0)).toBe(9)
    expect(sphereSliceRadius(5)).toBeCloseTo(Math.sqrt(56))
    expect(sphereSliceRadius(10)).toBe(0)
    expect(sphereSliceRadius(-5)).toBe(sphereSliceRadius(5))
    expect(sphereSliceRadius(9.5, 9, 1.5)).toBeGreaterThan(0)
    expect(sphereSliceRadius(10, 9, 1.5)).toBe(0)
    expect(sphereSliceRadius(0, 0.65, 1.5)).toBe(0.65)
  })
  it('aligns only the selected DTS depth and broadens off-plane displacement with angle', () => {
    expect(dtsShift(10, 10, 30)).toBe(0)
    expect(dtsShift(25, 0, 30)).toBeGreaterThan(dtsShift(25, 0, 10))
    expect(dtsShift(25, 0, -30)).toBeCloseTo(-dtsShift(25, 0, 30))
  })
  it('requires centering in both authored scout dimensions', () => {
    expect(centeredForTeaching(0, 18)).toBe(false)
    expect(centeredForTeaching(18, 0)).toBe(false)
    expect(centeredForTeaching(0, 0)).toBe(true)
  })
})
describe('dimensioned teaching arithmetic', () => {
  it('does not equate a pulse-rate reduction with lower tube load', () => {
    const initial = temporalMetrics(7.5, 5, 20, 20)
    const compensated = temporalMetrics(3.75, 10, 20, 20)
    expect(initial.masPerSecond).toBe(0.75)
    expect(compensated.masPerSecond).toBe(initial.masPerSecond)
    expect(compensated.inFrameBlur).toBe(initial.inFrameBlur * 2)
    expect(compensated.interFrameTravel).toBe(initial.interFrameTravel * 2)
    expect(temporalMetrics(7.5, 5, 20, 0).interFrameTravel).toBe(0)
  })
  it('calculates KAP with explicit Gy and area conversion, without a skin-dose claim', () => {
    expect(kapGyCm2(10, 400)).toBe(4)
    expect(kapGyCm2(12, 100)).toBe(1.2)
    expect(kapMicroGyM2(1)).toBe(100)
    expect(kapMicroGyM2(25)).toBe(2500)
  })
})
