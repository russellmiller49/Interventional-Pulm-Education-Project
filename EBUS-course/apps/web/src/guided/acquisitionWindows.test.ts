import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { computeSimulatorPose } from '../features/simulator/pose'
import {
  buildChannelRaycastMesh,
  contactQualityForPose,
  clampPosePositionInsideChannel,
  isInsideChannel,
} from '../features/simulator/channelExtent'
import { acousticPoseFromScope } from '../features/simulator/acousticAdapter'
import {
  DEFAULT_ACOUSTIC_CONTROLS,
  renderAcousticFrame,
  type AcousticVolume,
} from '@bronchoscopy-core/acoustic'
import type {
  SimulatorCaseManifest,
  SimulatorCenterlineAsset,
  SimulatorMeshAsset,
} from '../features/simulator/types'
import { emptyLinkedSweep, sampleLinkedSweep } from '../../../../../src/lib/ebus-linked-contract'
const root = resolve('public/simulator/case-001')
const json = <T>(file: string): T => JSON.parse(readFileSync(resolve(root, file), 'utf8'))
const manifest = json<SimulatorCaseManifest>('case_manifest.simplified.web.json')
const lines = json<SimulatorCenterlineAsset>(manifest.assets.centerlines)
const channel = buildChannelRaycastMesh(json<SimulatorMeshAsset>(manifest.assets.airway_mesh))
const ref = manifest.assets.acoustic_volume!
const volume: AcousticVolume = {
  metadata: json(ref.metadata),
  data: new Uint8Array(gunzipSync(readFileSync(resolve(root, ref.data)))),
}
describe('actual acoustic windows at original and changed assisted positions', () => {
  it.each(['station_7_node_a::rms', 'station_7_node_a::lms', 'station_4r_node_a::default'])(
    '%s supports continuous target crossing without moving the anatomy',
    (key) => {
      const preset = manifest.presets.find((p) => p.preset_key === key)!
      const line = lines.polylines.find((l) => l.line_index === preset.line_index)!
      const positions = [0, 3].map((offset) =>
        computeSimulatorPose(line, preset.centerline_s_mm + offset, 0, preset),
      )
      expect(positions[0].position.distanceTo(positions[1].position)).toBeGreaterThan(1)
      for (const offset of [0, 3]) {
        let sweep = emptyLinkedSweep()
        for (let roll = 90; roll >= -90; roll -= 10) {
          const pose = clampPosePositionInsideChannel(
            computeSimulatorPose(line, preset.centerline_s_mm + offset, roll, preset),
            channel,
            0.2,
          )
          expect(isInsideChannel(channel, pose.position, pose.tangent)).toBe(true)
          const contact = contactQualityForPose(pose, channel)
          expect(contact).toBeGreaterThan(0.45)
          const frame = renderAcousticFrame(
            volume,
            acousticPoseFromScope(pose),
            { ...DEFAULT_ACOUSTIC_CONTROLS, contactQuality: contact },
            96,
            96,
            80,
            100,
          )
          const visible = frame.structures.some(
            (s) => volume.metadata.labels[s.id].key === preset.station_key,
          )
          sweep = sampleLinkedSweep(sweep, {
            roll,
            visible,
            contact,
            frameId: key + ':' + offset + ':' + roll,
          })
        }
        expect(sweep.phase).toBe('complete')
      }
    },
  )
})
