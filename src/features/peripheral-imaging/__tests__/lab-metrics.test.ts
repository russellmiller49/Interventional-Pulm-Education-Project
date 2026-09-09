/**
 * @jest-environment node
 */
import {
  formatReadout,
  LAB_CONTROLS,
  labDefaults,
  labReadouts,
  labValue,
} from '../engine/labMetrics'
import {
  centeredForTeaching,
  kapGyCm2,
  LESION_CENTER,
  projectToDetector,
  temporalMetrics,
  toolTipForDepth,
  windowRelationship,
} from '../lib/physics'
import type { LabId } from '../types'

const LABS: readonly LabId[] = [
  'geometry',
  'field',
  'temporal',
  'dts',
  'acquisition',
  'mpr',
  'registration',
  'safety',
  'dose',
]

describe('lab control registry', () => {
  it('has controls for every lab, with unique keys and ranges that contain their defaults', () => {
    for (const lab of LABS) {
      const controls = LAB_CONTROLS[lab]
      expect(controls.length).toBeGreaterThan(0)
      const keys = controls.map((control) => control.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const control of controls) {
        if (control.kind === 'range') {
          const fallback = labValue(lab, {}, control.key, 'projection')
          expect(typeof fallback).toBe('number')
          expect(fallback as number).toBeGreaterThanOrEqual(control.min ?? -Infinity)
          expect(fallback as number).toBeLessThanOrEqual(control.max ?? Infinity)
        }
      }
    }
  })

  it('reproduces the draft lab fallbacks', () => {
    expect(labDefaults('geometry', 'projection')).toEqual({ orbit: 0, tilt: 0, depth: 22 })
    expect(labDefaults('temporal', 'time')).toEqual({ rate: 7.5, width: 5, speed: 20 })
    expect(labDefaults('acquisition', 'fixed-suite').kind).toBe('fixed')
    expect(labDefaults('acquisition', 'mobile-suite').kind).toBe('mobile')
    expect(labDefaults('acquisition', 'cbct-acquisition').kind).toBe('mobile')
    expect(labDefaults('mpr', 'tool-confirmation')).toMatchObject({ tipX: 14, tipY: 14, tipZ: 0 })
    expect(labDefaults('registration', 'current-anatomy')).toEqual({
      previous: 0,
      shift: 0,
      overlay: true,
      showCurrent: true,
    })
    expect(labDefaults('safety', 'staff-protection')).toEqual({
      distance: 1.6,
      orbit: 0,
      shield: false,
    })
    expect(labDefaults('dose', 'dose-reporting')).toEqual({ kerma: 10, area: 400 })
  })

  it('clamps out-of-range values and falls back for the wrong type', () => {
    expect(labValue('geometry', { orbit: 500 }, 'orbit', 'projection')).toBe(75)
    expect(labValue('geometry', { orbit: 'x' }, 'orbit', 'projection')).toBe(0)
    expect(labValue('temporal', { rate: 9 }, 'rate', 'time')).toBe(7.5)
    expect(labValue('temporal', { rate: 3.75 }, 'rate', 'time')).toBe(3.75)
    expect(labValue('acquisition', { kind: 'other' }, 'kind', 'fixed-suite')).toBe('fixed')
    expect(labValue('field', { crop: 'yes' }, 'crop', 'field')).toBe(false)
  })
})

describe('lab readouts derive from the physics module', () => {
  it('geometry separation is the detector-plane distance between target and tip', () => {
    const values = { orbit: 30, tilt: -10, depth: 18 }
    const target = projectToDetector(LESION_CENTER, 30, -10)
    const tip = projectToDetector(toolTipForDepth(18), 30, -10)
    const readouts = labReadouts('geometry', values, 'projection')
    expect(readouts.separationMm).toBeCloseTo(
      Math.hypot(target[0] - tip[0], target[1] - tip[1]),
      10,
    )
    expect(readouts.depthMm).toBe(18)
  })

  it('frontal overlap survives a depth offset, and an oblique view reveals it', () => {
    const frontal = labReadouts('geometry', { orbit: 0, tilt: 0, depth: 22 }, 'projection')
    const oblique = labReadouts('geometry', { orbit: 30, tilt: 0, depth: 22 }, 'projection')
    expect(frontal.separationMm as number).toBeLessThan(0.01)
    expect(oblique.separationMm as number).toBeGreaterThan(5)
  })

  it('field area follows the square of the side unless the crop is a display crop', () => {
    expect(labReadouts('field', { field: 70 }, 'field').irradiatedAreaPct).toBeCloseTo(49)
    expect(labReadouts('field', { field: 70, crop: true }, 'field').irradiatedAreaPct).toBe(100)
    expect(labReadouts('field', {}, 'field').zoomAddsExposure).toBe(false)
  })

  it('temporal readouts match temporalMetrics at the fixed 20 mA', () => {
    const readouts = labReadouts('temporal', { rate: 3.75, width: 10, speed: 30 }, 'time')
    const metrics = temporalMetrics(3.75, 10, 20, 30)
    expect(readouts.masPerSecond).toBeCloseTo(metrics.masPerSecond)
    expect(readouts.inFrameBlurMm).toBeCloseTo(metrics.inFrameBlur)
    expect(readouts.interFrameTravelMm).toBeCloseTo(metrics.interFrameTravel)
    expect(readouts.intervalMs).toBeCloseTo(metrics.intervalMs)
  })

  it('acquisition readiness needs both centering dimensions and every check', () => {
    const centered = { offsetX: 4, offsetDepth: -6 }
    expect(centeredForTeaching(4, -6)).toBe(true)
    expect(labReadouts('acquisition', centered, 'cbct-acquisition').ready).toBe(false)
    const checks = { target: true, clearance: true, state: true, protection: true }
    expect(labReadouts('acquisition', { ...centered, ...checks }, 'cbct-acquisition').ready).toBe(
      true,
    )
    expect(
      labReadouts('acquisition', { offsetX: 18, offsetDepth: 0, ...checks }, 'cbct-acquisition')
        .ready,
    ).toBe(false)
  })

  it('mpr readouts carry the window relationship of the analytic geometry', () => {
    const values = { tipX: 14, tipY: 0, tipZ: 0 }
    const readouts = labReadouts('mpr', values, 'tool-confirmation')
    const relationship = windowRelationship([14, 0, 0])
    expect(readouts.windowLabel).toBe(relationship.label)
    expect(readouts.windowIntersects).toBe(relationship.intersects)
    expect(readouts.windowFull).toBe(relationship.full)
    expect(readouts.tipInside).toBe(relationship.tipInside)
  })

  it('registration, safety and dose readouts are the draft arithmetic', () => {
    expect(labReadouts('registration', { shift: 12, previous: 0 }, 'changing-anatomy')).toEqual({
      storedShiftMm: 0,
      currentShiftMm: 12,
      contourStale: true,
    })
    expect(
      labReadouts('safety', { distance: 2 }, 'staff-protection').inverseSquareRatio,
    ).toBeCloseTo(0.25)
    const dose = labReadouts('dose', { kerma: 12, area: 100 }, 'dose-reporting')
    expect(dose.kapGyCm2).toBeCloseTo(kapGyCm2(12, 100))
    expect(dose.kapMicroGyM2).toBeCloseTo(kapGyCm2(12, 100) * 100)
  })

  it('formats readouts with their units', () => {
    expect(formatReadout('kapGyCm2', 1.2)).toBe('1.20 Gy·cm²')
    expect(formatReadout('centered', true)).toBe('yes')
    expect(formatReadout('separationMm', undefined)).toBe('—')
  })
})
