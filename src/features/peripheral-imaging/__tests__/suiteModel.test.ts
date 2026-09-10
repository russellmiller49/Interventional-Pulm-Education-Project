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
  chainStopAnchors,
  roomMonitorOffset,
} from '../components/suite/suiteModel'

const closeVector = (actual: readonly number[], expected: readonly number[]) => {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((n, i) => expect(n).toBeCloseTo(expected[i], 8))
}
it('room furniture spacing preserves the imaging frame and keeps the two monitor anchors together', () => {
  const frame = suiteFrame(45, 0)
  const initial = chainStopAnchors(frame)
  const room = chainStopAnchors(frame, roomMonitorOffset(frame.geometry))
  for (const stop of ['source', 'beam', 'patient', 'detector'] as const)
    closeVector(room[stop], initial[stop])
  closeVector(
    subtract(room.display, room.reconstruction),
    subtract(initial.display, initial.reconstruction),
  )
  expect(room.display[0]).toBeGreaterThan(initial.display[0])
})
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

import { resolveSuiteInputs, suiteViewErrors } from '../components/suite/suiteViewSpec'
import { labReadouts } from '../engine/labMetrics'
import type { SuiteViewSpec } from '../components/suite/types'
const spec: SuiteViewSpec = {
  sectionId: 'projection',
  mode: 'projection',
  litStop: 'beam',
  stopSentence: 'The beam',
  camera: 'suite',
  layers: ['Airways', 'table', 'gantry', 'cone', 'ray', 'monitor', 'labels'],
  variant: 'generic',
  monitor: 'beside',
  bindings: [
    { input: 'orbit', control: 'orbit' },
    { input: 'tilt', control: 'tilt' },
    { input: 'toolDepth', control: 'depth' },
  ],
  defaults: {},
  lab: 'geometry',
  controls: ['orbit', 'tilt', 'depth'],
  readouts: ['separationMm'],
  boundary: 'Authored teaching geometry.',
}

describe('suite input resolution and contract validation', () => {
  it('keeps lab clamping and numeric readouts in agreement even for invalid persisted values', () => {
    const values = { orbit: 500, tilt: Number.NaN, depth: Infinity }
    const inputs = resolveSuiteInputs(spec, values)
    expect(inputs.orbit).toBe(75)
    expect(inputs.tilt).toBe(0)
    expect(inputs.toolDepth).toBe(22)
    const markers = projectionMarkers(suiteFrame(inputs.orbit, inputs.tilt), inputs.toolDepth)
    const readout = labReadouts('geometry', values, 'projection')
    expect(Math.hypot(...subtract(markers.tipRay.hit, markers.targetRay.hit))).toBeCloseTo(
      readout.separationMm as number,
      8,
    )
  })
  it('uses authored defaults for unbound inputs and the lab oracle for bound ones', () => {
    const inputs = resolveSuiteInputs({ ...spec, defaults: { fieldPercent: 55, orbit: 40 } }, {})
    expect(inputs.fieldPercent).toBe(55)
    expect(inputs.orbit).toBe(0)
    expect(suiteViewErrors(spec)).toEqual([])
  })
  it('rejects unknown keys, incompatible bindings and a lit answer', () => {
    expect(suiteViewErrors({ ...spec, chainAnswer: true })).toContain(
      'A chain answer must have litStop: null',
    )
    expect(suiteViewErrors({ ...spec, controls: ['unknown'] })).toContain(
      'Unknown visible control: unknown',
    )
    expect(
      suiteViewErrors({ ...spec, bindings: [{ input: 'orbit', control: 'missing' }] }),
    ).toContain('Unknown binding control: missing')
    expect(suiteViewErrors({ ...spec, bindings: [{ input: 'crop', control: 'orbit' }] })).toContain(
      'Binding type differs: orbit → crop',
    )
  })
})

import { ANATOMY } from '../lib/anatomy'
import { densityBand, rayProfile } from '../lib/rayProfile'
describe('quantized CT ray profile', () => {
  it('sums exact path lengths without overcounting the final sample', () => {
    const profile = rayProfile(new Uint8Array(), [-700, 0, 0], [700, 0, 0], {
      stepMm: 3,
      sampleHu: () => 0,
      tagAuthoredTarget: false,
    })
    const width = ANATOMY.spacingMm[0] * (ANATOMY.sizeXyz[0] - 1)
    expect(profile.pathMm).toBeCloseTo(width, 8)
    expect(profile.tissueMm.soft).toBeCloseTo(width, 8)
    expect(profile.relativeAttenuation).toBeCloseTo(width, 8)
    expect(profile.segments).toHaveLength(1)
  })
  it('classifies density bands as a teaching proxy and never calls air a proven lumen', () => {
    expect(densityBand(-1000)).toBe('air')
    expect(densityBand(-800)).toBe('lung')
    expect(densityBand(0)).toBe('soft')
    expect(densityBand(600)).toBe('bone')
    const miss = rayProfile(new Uint8Array(), [-700, 800, 0], [700, 800, 0], { sampleHu: () => 0 })
    expect(miss.pathMm).toBe(0)
    expect(miss.segments).toHaveLength(0)
  })
  it('tags the authored target only on a ray that crosses its sphere', () => {
    const frame = suiteFrame(30, 15),
      hit = rayThrough(frame, LESION_CENTER).hit
    const profile = rayProfile(new Uint8Array(), frame.source, hit, {
      stepMm: 0.25,
      sampleHu: () => -800,
    })
    expect(profile.tissueMm.target).toBeCloseTo(18, 0)
    expect(Object.values(profile.tissueMm).reduce((a, b) => a + b, 0)).toBeCloseTo(
      profile.pathMm,
      8,
    )
  })
})

import { fieldGeometry } from '../components/suite/suiteModel'
import { SUITE_VIEWS } from '../content/suiteViews'
it('field geometry shrinks the irradiated plane; display crop leaves a full beam', () => {
  const frame = suiteFrame(25)
  const full = fieldGeometry(frame, 100, false)
  const narrow = fieldGeometry(frame, 45, false)
  const crop = fieldGeometry(frame, 45, true)
  const side = (p: readonly Point3[]) => Math.hypot(...subtract(p[1], p[0]))
  expect(side(narrow.irradiated) / side(full.irradiated)).toBeCloseTo(0.45, 8)
  expect(crop.irradiated).toEqual(full.irradiated)
  expect(crop.image).toEqual(narrow.image)
  expect(narrow.blades.map((p) => dot(subtract(p, frame.source), frame.normal))).toEqual(
    expect.arrayContaining([expect.closeTo(frame.geometry.sod * 0.1, 8)]),
  )
})
it('every authored section resolves and validates against the scene contract', () => {
  for (const view of Object.values(SUITE_VIEWS)) expect(suiteViewErrors(view)).toEqual([])
})

import { temporal } from '../components/suite/suiteModel'
it('temporal images land only after each pulse, then hold until the next completed pulse', () => {
  for (const pulseRate of [3.75, 7.5, 15]) {
    const base = { pulseRate, pulseWidthMs: 20, speedMmS: 40 }
    expect(temporal({ ...base, phase: 0 }).sampleIndex).toBe(-1)
    const completed = temporal({ ...base, phase: 0.02 })
    const between = temporal({ ...base, phase: 1 / pulseRate - 0.001 })
    expect(completed.sampleIndex).toBe(0)
    expect(between.sampledTip).toEqual(completed.sampledTip)
    expect(between.pulseIsOn).toBe(false)
    const next = temporal({ ...base, phase: 1 / pulseRate + 0.02 })
    expect(next.sampleIndex).toBe(1)
    expect(Math.hypot(...subtract(next.sampledTip, completed.sampledTip))).toBeCloseTo(
      next.interFrameTravel,
      8,
    )
    expect(Math.hypot(...subtract(...completed.blurSegment))).toBeCloseTo(completed.inFrameBlur, 8)
  }
})
it('pulse width changes within-frame blur without changing inter-frame travel', () => {
  const inputs = { pulseRate: 7.5, pulseWidthMs: 5, speedMmS: 20, phase: 1 }
  const short = temporal(inputs),
    long = temporal({ ...inputs, pulseWidthMs: 20 })
  expect(long.inFrameBlur).toBe(short.inFrameBlur * 4)
  expect(long.interFrameTravel).toBe(short.interFrameTravel)
  expect(temporal({ ...inputs, speedMmS: 0 }).inFrameBlur).toBe(0)
})

import {
  cbctOrbitSamples,
  cbctSetup,
  fovCylinder,
  sweptEnvelope,
} from '../components/suite/suiteModel'
import { centeredForTeaching } from '../lib/physics'
it('CBCT samples include the authored arc endpoints and panel FOV uses cone magnification', () => {
  for (const count of [24, 36]) {
    const samples = cbctOrbitSamples(200, count)
    expect(samples).toHaveLength(count)
    expect(samples[0]).toBe(-100)
    expect(samples[count - 1]).toBe(100)
    expect(samples[1] - samples[0]).toBeCloseTo(200 / (count - 1), 8)
  }
  expect(fovCylinder('fixed').radius).toBe(192)
  expect(fovCylinder('mobile').radius).toBe(90)
  expect(fovCylinder('mobile', { sod: 600, sid: 1200, field: 300 }).radius).toBe(75)
})
it('CBCT moves CT and target together; its teaching box is exactly the engine centering predicate', () => {
  for (const offsetX of [-30, -9, -8, 0, 8, 9, 30])
    for (const offsetDepth of [-9, -8, 0, 8, 9]) {
      const inputs = resolveSuiteInputs(SUITE_VIEWS['mobile-suite'], { offsetX, offsetDepth })
      const setup = cbctSetup(inputs)
      closeVector(
        LESION_CENTER.map((n, i) => n + setup.offset[i]),
        [offsetX, offsetDepth, 0],
      )
      expect(setup.centered).toBe(centeredForTeaching(offsetX, offsetDepth))
      expect(setup.geometry.field).toBe(300)
    }
  const fixed = sweptEnvelope('fixed', 200),
    mobile = sweptEnvelope('mobile', 200)
  expect(fixed.source).toHaveLength(65)
  expect(mobile.halfWidth).toBeLessThan(fixed.halfWidth)
  expect(Math.hypot(...mobile.source[0])).toBeLessThan(Math.hypot(...fixed.source[0]))
})
