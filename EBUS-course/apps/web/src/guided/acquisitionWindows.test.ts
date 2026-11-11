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
import {
  emptyLinkedSweep,
  sampleLinkedSweep,
  LINKED_ALONG_AIRWAY,
  LINKED_LANDMARKS,
  linkedLateralPosition,
  linkedSetup,
  type LinkedLesson,
  type LinkedVariant,
} from '../../../../../src/lib/ebus-linked-contract'
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

describe('every structure a lesson asks the learner to find is reachable on ultrasound', () => {
  const cases: [LinkedLesson, LinkedVariant, string][] = [
    ['scope-orientation', 'guided', 'station_7_node_a::rms'],
    ['ct-map', 'guided', 'station_7_node_a::rms'],
    ['station-seven', 'guided', 'station_7_node_a::rms'],
    ['station-seven', 'guided', 'station_7_node_a::lms'],
    ['station-seven', 'changed-window', linkedSetup('station-seven', 'changed-window').presetKey],
    ['right-paratracheal', 'guided', linkedSetup('right-paratracheal', 'guided').presetKey],
    [
      'right-paratracheal',
      'changed-window',
      linkedSetup('right-paratracheal', 'changed-window').presetKey,
    ],
  ]
  it.each(cases)('%s (%s) from %s', (lesson, variant, key) => {
    const preset = manifest.presets.find((p) => p.preset_key === key)!
    const line = lines.polylines.find((l) => l.line_index === preset.line_index)!
    const offset = linkedSetup(lesson, variant).offsetMm
    const best = new Map<string, number>()
    for (let roll = 90; roll >= -90; roll -= 5) {
      const pose = clampPosePositionInsideChannel(
        computeSimulatorPose(line, preset.centerline_s_mm + offset, roll, preset),
        channel,
        0.2,
      )
      const frame = renderAcousticFrame(
        volume,
        acousticPoseFromScope(pose),
        { ...DEFAULT_ACOUSTIC_CONTROLS, contactQuality: contactQualityForPose(pose, channel) },
        192,
        192,
        80,
        100,
      )
      const counts = new Map<number, number>()
      for (const id of frame.labelImage) counts.set(id, (counts.get(id) ?? 0) + 1)
      for (const [id, n] of counts) {
        const name = volume.metadata.labels[id].key
        best.set(name, Math.max(best.get(name) ?? 0, n))
      }
    }
    // A structure the learner must click needs a patch they can hit: at least 1% of the image.
    for (const id of LINKED_LANDMARKS[lesson])
      expect([id, (best.get(id) ?? 0) >= 192 * 192 * 0.01]).toEqual([id, true])
  })
})

describe('the advance-and-withdraw task on the real model', () => {
  const setup = linkedSetup('scope-orientation', 'along-airway')
  const preset = manifest.presets.find((p) => p.preset_key === setup.presetKey)!
  const line = lines.polylines.find((l) => l.line_index === preset.line_index)!
  const targetId = volume.metadata.labels.findIndex((label) => label.key === preset.station_key)
  /** The same reading the workbench reports: the mean column of the node's own pixels. */
  const at = (offsetMm: number) => {
    const pose = clampPosePositionInsideChannel(
      computeSimulatorPose(line, preset.centerline_s_mm + offsetMm, setup.initialRoll, preset),
      channel,
      0.2,
    )
    const contact = contactQualityForPose(pose, channel)
    const frame = renderAcousticFrame(
      volume,
      acousticPoseFromScope(pose),
      { ...DEFAULT_ACOUSTIC_CONTROLS, contactQuality: contact },
      192,
      192,
      80,
      100,
    )
    let sum = 0
    let count = 0
    for (let i = 0; i < frame.labelImage.length; i++)
      if (frame.labelImage[i] === targetId) {
        sum += i % frame.width
        count += 1
      }
    return { contact, lateral: count >= 10 ? (sum / count + 0.5) / frame.width : null }
  }
  const { startOffsetMm, minOffsetMm, maxOffsetMm } = LINKED_ALONG_AIRWAY
  it('starts with the node on the dot side, in a tissue window', () => {
    expect(targetId).toBeGreaterThanOrEqual(3)
    const start = at(startOffsetMm)
    expect(start.contact).toBeGreaterThanOrEqual(0.45)
    expect(linkedLateralPosition(start.lateral)).toBe('right')
  })
  it('slides the node toward the dot as the scope advances, and keeps contact across the range', () => {
    const offsets = []
    for (let offset = minOffsetMm; offset <= maxOffsetMm; offset += 2) offsets.push(offset)
    const readings = offsets.map(at)
    for (const reading of readings) expect(reading.contact).toBeGreaterThanOrEqual(0.45)
    const laterals = readings.map((reading) => reading.lateral!)
    for (let i = 1; i < laterals.length; i++) expect(laterals[i]).toBeGreaterThan(laterals[i - 1])
    // The other end of the range is past the middle: the learner can overshoot and come back.
    expect(linkedLateralPosition(laterals[0])).toBe('left')
  })
  it('reaches the middle within the range, by withdrawing from the start', () => {
    const centred = []
    for (let offset = minOffsetMm; offset <= maxOffsetMm; offset += 1)
      if (linkedLateralPosition(at(offset).lateral) === 'centre') centred.push(offset)
    expect(centred.length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...centred)).toBeLessThan(startOffsetMm)
  })
})
