import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { opticalRay, teachingScopeMatrix } from './linkedModels'
import {
  computeSimulatorPose,
  cephalicImageAxis,
  resolveEndoscopeCameraCalibration,
} from '../features/simulator/pose'
import manifest from '../../public/simulator/case-001/case_manifest.simplified.web.json'
import centerlines from '../../public/simulator/case-001/geometry/centerlines.json'
import type {
  SimulatorCaseManifest,
  SimulatorCenterlinePolyline,
} from '../features/simulator/types'

describe('teaching device calibration', () => {
  const caseData = manifest as unknown as SimulatorCaseManifest
  it.each(['station_7_node_a::rms', 'station_7_node_a::lms', 'station_4r_node_a::default'])(
    'preserves the fan origin and optical axes at %s',
    (key) => {
      const preset = caseData.presets.find((p) => p.preset_key === key)!
      const line = centerlines.polylines[
        preset.line_index
      ] as unknown as SimulatorCenterlinePolyline
      for (const roll of [-45, 0, 45])
        for (const flexion of [0, 15]) {
          const pose = computeSimulatorPose(line, preset.centerline_s_mm, roll, preset, flexion)
          const matrix = teachingScopeMatrix(pose)
          expect(new THREE.Vector3().applyMatrix4(matrix).distanceTo(pose.position)).toBeLessThan(
            1e-9,
          )
          expect(
            new THREE.Vector3(1, 0, 0).transformDirection(matrix).dot(cephalicImageAxis(pose)),
          ).toBeCloseTo(1, 8)
          expect(
            new THREE.Vector3(0, 1, 0).transformDirection(matrix).dot(pose.depthAxis),
          ).toBeCloseTo(1, 8)
          expect(matrix.determinant()).toBeCloseTo(1, 8)
          const camera = resolveEndoscopeCameraCalibration(caseData.endoscope_camera),
            ray = opticalRay(pose, camera)
          expect(ray.direction.dot(pose.tangent)).toBeCloseTo(
            Math.cos((camera.optical_axis_offset_deg * Math.PI) / 180),
            8,
          )
          expect(ray.origin.distanceTo(pose.position)).toBeCloseTo(6, 8)
        }
    },
  )
})
