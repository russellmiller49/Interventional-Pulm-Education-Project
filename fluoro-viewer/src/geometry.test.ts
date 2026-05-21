import {
  computeOverlayCalibrationTranslation,
  createRotationMatrix,
  detectorPercentToLocalMm,
  rotateVec,
  subtract,
} from './geometry'
import type { FluoroConfig } from './types'

const config: FluoroConfig = {
  units: 'mm',
  coordinateSystem: 'LPS',
  isocenter_mm: [-6.285000231743027, -172.10900023174304, -1191.25],
  source_to_isocenter_mm: 600,
  source_to_detector_mm: 1200,
  detector_pixels: [1024, 1024],
  pixel_pitch_mm: 0.3,
  asset_base_url: '/fluoroview',
  default_view: {
    rao_lao_deg: 0,
    cranial_caudal_deg: 0,
  },
  overlay_calibration: {
    method: 'centerline-carina',
    carina_lps_mm: [-7.776358604431152, -134.74790954589844, -1156.4952392578125],
    target_detector_percent: [49.54298915258192, 39.34977470909921],
    source_curves: ['Network curve (0)', 'Network curve (1)', 'Network curve (2)'],
    reference_translation_mm: [0, 0, 0],
  },
}

test('detectorPercentToLocalMm maps screen percent into detector-plane millimeters', () => {
  expect(detectorPercentToLocalMm(config, [50, 50])).toEqual([0, 0, 0])
  const carinaTarget = detectorPercentToLocalMm(config, [50, 45])
  expect(carinaTarget[0]).toBe(0)
  expect(carinaTarget[1]).toBe(0)
  expect(carinaTarget[2]).toBeCloseTo(15.36, 6)
})

test('computeOverlayCalibrationTranslation uses fixed AP reference translation when present', () => {
  const offset = computeOverlayCalibrationTranslation(config)

  expect(offset[0]).toBe(0)
  expect(offset[1]).toBe(0)
  expect(offset[2]).toBe(0)
})

test('computeOverlayCalibrationTranslation keeps the same reference during C-arm rotation', () => {
  const rotationMatrix = createRotationMatrix(-30, -20)
  const offset = computeOverlayCalibrationTranslation(config, rotationMatrix)

  expect(offset).toEqual(config.overlay_calibration?.reference_translation_mm)
})

test('computeOverlayCalibrationTranslation dynamically anchors carina without reference translation', () => {
  const dynamicConfig: FluoroConfig = {
    ...config,
    overlay_calibration: {
      ...config.overlay_calibration!,
      target_detector_percent: [50, 45],
      reference_translation_mm: undefined,
    },
  }
  const rotationMatrix = createRotationMatrix(-30, -20)
  const offset = computeOverlayCalibrationTranslation(dynamicConfig, rotationMatrix)
  const carinaLocal = subtract(
    dynamicConfig.overlay_calibration?.carina_lps_mm ?? [0, 0, 0],
    dynamicConfig.isocenter_mm,
  )
  const rotatedCarina = rotateVec(rotationMatrix, carinaLocal)
  const target = detectorPercentToLocalMm(config, [50, 45])

  expect(rotatedCarina[0] + offset[0]).toBeCloseTo(target[0], 6)
  expect(offset[1]).toBe(0)
  expect(rotatedCarina[2] + offset[2]).toBeCloseTo(target[2], 6)
})
