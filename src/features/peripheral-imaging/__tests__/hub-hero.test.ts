/** @jest-environment node */
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { IMAGING_HUB_HERO, validateImagingHubHero } from '../content/hubHero'
import { CHAIN_STOPS } from '../content/imagingChain'
import { PerspectiveCamera, Vector3 } from 'three'

import { ROOM_FIXTURE, ROOM_HERO } from '../../../../scripts/peripheral-imaging/room-fixture'
import { cameraPose } from '../components/suite/cameraPose'
import { roomBounds } from '../components/suite/Room'
import { chainStopAnchors, roomMonitorOffset, suiteFrame } from '../components/suite/suiteModel'
import { resolveSuiteInputs } from '../components/suite/suiteViewSpec'

describe('the hub picture', () => {
  it('validates clean at import', () => {
    expect(validateImagingHubHero()).toEqual([])
  })

  it('declares the size the file actually has', () => {
    // The still is re-rendered by a script the hub does not own. If it comes back at another size,
    // a stale declaration here would stretch it; read the PNG header rather than trust the number.
    const png = readFileSync(path.join(process.cwd(), 'public', IMAGING_HUB_HERO.src))
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(IMAGING_HUB_HERO.width)
    expect(png.readUInt32BE(20)).toBe(IMAGING_HUB_HERO.height)
  })

  it('says where every stop of the chain is, and no stop the chain does not have', () => {
    expect(Object.keys(IMAGING_HUB_HERO.where).sort()).toEqual(
      CHAIN_STOPS.map((stop) => stop.id).sort(),
    )
  })

  // Report O5. The on-figure labels are anchored by the model, not by eye: project the suite's own
  // anchor for each component through the camera the still was rendered with, and hold the
  // declared position to it. A re-rendered picture that moves a component fails here.
  it('puts every on-figure label at the projected position of the component it names', () => {
    const inputs = resolveSuiteInputs(ROOM_FIXTURE, {})
    const frame = suiteFrame(inputs.orbit, inputs.tilt, inputs.geometry)
    const monitorOffset = roomMonitorOffset(inputs.geometry)
    const pose = cameraPose({
      view: 'room',
      frame,
      fov: 42,
      width: ROOM_HERO.width,
      height: ROOM_HERO.height,
      overviewBounds: roomBounds(frame),
      labelled: false,
      roomComposition: true,
      monitorOffset,
    })
    const camera = new PerspectiveCamera(42, ROOM_HERO.width / ROOM_HERO.height, 1, 12000)
    camera.position.set(...pose.position)
    camera.up.set(...pose.up)
    camera.lookAt(...pose.target)
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    expect(ROOM_HERO.width).toBe(IMAGING_HUB_HERO.width)
    expect(ROOM_HERO.height).toBe(IMAGING_HUB_HERO.height)
    const anchors = chainStopAnchors(frame, monitorOffset)
    for (const stop of CHAIN_STOPS) {
      const point = new Vector3(...anchors[stop.id]).project(camera)
      const [x, y] = IMAGING_HUB_HERO.anchors[stop.id]
      expect(Math.abs(((point.x + 1) / 2) * 100 - x)).toBeLessThan(0.1)
      expect(Math.abs(((1 - point.y) / 2) * 100 - y)).toBeLessThan(0.1)
      // Inside the picture, with room for a label beside it.
      expect(x).toBeGreaterThan(5)
      expect(x).toBeLessThan(95)
      expect(y).toBeGreaterThan(5)
      expect(y).toBeLessThan(95)
    }
  })

  it('keeps the on-figure labels apart', () => {
    // Labels are about 2.2% of the picture's height tall at their largest; two labels on the same
    // side need more than that between their anchors, or to be far apart horizontally.
    const stops = CHAIN_STOPS.map((stop) => stop.id)
    for (const a of stops)
      for (const b of stops) {
        if (a >= b || IMAGING_HUB_HERO.labelSide[a] !== IMAGING_HUB_HERO.labelSide[b]) continue
        const [ax, ay] = IMAGING_HUB_HERO.anchors[a]
        const [bx, by] = IMAGING_HUB_HERO.anchors[b]
        expect(Math.abs(ay - by) > 6 || Math.abs(ax - bx) > 25).toBe(true)
      }
  })
})
