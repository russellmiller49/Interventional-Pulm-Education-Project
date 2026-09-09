import { detectorFrameForAngles } from '../../../../fluoro-viewer/src/geometry'
import { IMAGING_CONFIG } from '../lib/anatomy'
import { DEFAULT_GEOMETRY, LESION_CENTER, projectToDetector, type Point3 } from '../lib/physics'
import {
  collimator,
  detectorPoint,
  dot,
  projectionMarkers,
  rayThrough,
  subtract,
  suiteFrame,
} from '../components/suite/suiteModel'

const closeVector = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], 8))
}
describe('suite and existing FluoroView detector agreement to eight decimals', () => {
  for (const orbit of [-75, 0, 30, 90])
    for (const tilt of [-25, 0, 15, 25]) {
      it(`agrees at obliquity ${orbit} and tilt ${tilt}`, () => {
        const ours = suiteFrame(orbit, tilt)
        const original = detectorFrameForAngles(IMAGING_CONFIG, orbit, tilt)
        closeVector(ours.source, original.sourceLps)
        closeVector(ours.detectorCenter, original.detectorCenterLps)
        closeVector(ours.normal, original.detectorNormalLps)
        closeVector(ours.u, original.detectorUAxisLps)
        closeVector(ours.v, original.detectorVAxisLps)
        for (const hit of ours.corners)
          expect(dot(subtract(hit, ours.detectorCenter), ours.normal)).toBeCloseTo(0, 8)
        const ray = rayThrough(ours, LESION_CENTER)
        closeVector(ray.uv, projectToDetector(LESION_CENTER, orbit, tilt))
        const targetDirection = subtract(LESION_CENTER, ours.source)
        const hitDirection = subtract(ray.hit, ours.source)
        const t = DEFAULT_GEOMETRY.sid / dot(targetDirection, ours.normal)
        closeVector(
          hitDirection,
          targetDirection.map((n) => n * t),
        )
      })
    }
  it('preserves translated isocenter and custom SOD, SID and field', () => {
    const geometry = { sod: 650, sid: 1100, field: 300 },
      iso: Point3 = [20, -15, 8]
    const ours = suiteFrame(30, 15, geometry, iso)
    const original = detectorFrameForAngles(
      {
        ...IMAGING_CONFIG,
        isocenter_mm: iso,
        source_to_isocenter_mm: geometry.sod,
        source_to_detector_mm: geometry.sid,
        pixel_pitch_mm: geometry.field / IMAGING_CONFIG.detector_pixels[0],
      },
      30,
      15,
    )
    closeVector(ours.source, original.sourceLps)
    closeVector(ours.detectorCenter, original.detectorCenterLps)
    closeVector(detectorPoint(ours, [0, 0]), original.detectorCenterLps)
    closeVector(rayThrough(ours, iso).uv, [0, 0])
  })
  it('keeps the initial ray overlap and reveals parallax after rotation', () => {
    const frontal = projectionMarkers(suiteFrame(0), 22)
    closeVector(frontal.targetRay.hit, frontal.tipRay.hit)
    const oblique = projectionMarkers(suiteFrame(30, 15), 22)
    expect(Math.hypot(...subtract(oblique.targetRay.hit, oblique.tipRay.hit))).toBeGreaterThan(20)
  })
  it('uses the same target-centred clamp as the SVG shutters', () => {
    const frame = suiteFrame(30, 15),
      percent = 45
    const shutter = collimator(frame, percent)
    const uv = rayThrough(frame, LESION_CENTER).uv
    const size = (512 * percent) / 100,
      target = [256 + (uv[0] * 512) / 640, 256 - (uv[1] * 512) / 640]
    expect(((shutter.left + 320) * 512) / 640).toBeCloseTo(
      Math.min(512 - size, Math.max(0, target[0] - size / 2)),
      8,
    )
    expect(((320 - shutter.bottom - shutter.side) * 512) / 640).toBeCloseTo(
      Math.min(512 - size, Math.max(0, target[1] - size / 2)),
      8,
    )
  })
})
