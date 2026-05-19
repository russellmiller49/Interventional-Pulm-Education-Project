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
  isocenter_mm: [-8, -134.8, -1153.2],
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
    carina_lps_mm: [-7.689563751220703, -134.31544494628906, -1157.5181884765625],
    target_detector_percent: [50, 45],
    source_curves: ['Network curve (0)', 'Network curve (1)', 'Network curve (2)'],
  },
}

test('detectorPercentToLocalMm maps screen percent into detector-plane millimeters', () => {
  expect(detectorPercentToLocalMm(config, [50, 50])).toEqual([0, 0, 0])
  const carinaTarget = detectorPercentToLocalMm(config, [50, 45])
  expect(carinaTarget[0]).toBe(0)
  expect(carinaTarget[1]).toBe(0)
  expect(carinaTarget[2]).toBeCloseTo(15.36, 6)
})

test('computeOverlayCalibrationTranslation anchors the centerline carina in AP view', () => {
  const offset = computeOverlayCalibrationTranslation(config)

  expect(offset[0]).toBeCloseTo(-0.3104362487792969, 6)
  expect(offset[1]).toBe(0)
  expect(offset[2]).toBeCloseTo(19.67818847656245, 6)
})

test('computeOverlayCalibrationTranslation keeps the carina anchored after C-arm rotation', () => {
  const rotationMatrix = createRotationMatrix(-30, -20)
  const offset = computeOverlayCalibrationTranslation(config, rotationMatrix)
  const carinaLocal = subtract(
    config.overlay_calibration?.carina_lps_mm ?? [0, 0, 0],
    config.isocenter_mm,
  )
  const rotatedCarina = rotateVec(rotationMatrix, carinaLocal)
  const target = detectorPercentToLocalMm(config, [50, 45])

  expect(rotatedCarina[0] + offset[0]).toBeCloseTo(target[0], 6)
  expect(offset[1]).toBe(0)
  expect(rotatedCarina[2] + offset[2]).toBeCloseTo(target[2], 6)
})
