/** @jest-environment node */
import { PerspectiveCamera, Vector3 } from 'three'

import type { ScopePose } from '../components/space/types'
import { aimScopeCamera } from '../components/space/scene/scopeCamera'
import { scopeGeometry } from '../engine/space/fulcrum'
import { instrument } from '../engine/space/instrument'
import { portFrame } from '../engine/space/portDefinition'
import { dot, type Vec3 } from '../engine/space/vec'
import table from '../test-support/landmark-table.json'

/**
 * The independent landmark and projection table (plan, section 7; independent review, R3). The
 * expected answers come from `scripts/medical-thoracoscopy/landmark_table.py`, written in Python
 * apart from the engine and three.js, from the raw records. Here they are checked against the
 * engine's own optical frame and against the three.js camera the scene aims with the same function it
 * draws with; the browser suite checks them against real pixels. Five fixed, asymmetric landmarks
 * and five poses (straight, turned toward the head, along the ribs, rolled a quarter turn, and all
 * of these at once) catch an axis swap, a flipped hand, a mirrored side, a wrong scale or a turned
 * camera: each moves at least one landmark to another place in the picture.
 *
 * Tolerances: the engine's frame against the table, 1e-9 (both in double precision); three.js's
 * projection against the table, 1e-5 of the field's half-width (three.js keeps its matrices in
 * single precision); pixels, in the browser suite, the marker's own size.
 */
type Entry = (typeof table.poses)[number]
const landmarks = table.landmarks as Record<string, number[]>

function near(a: readonly number[], b: readonly number[], tolerance: number) {
  return a.every((value, i) => Math.abs(value - b[i]) <= tolerance)
}

describe('the independent landmark table (R3)', () => {
  it('was made for the field of view and the optic the engine uses', () => {
    const device = instrument()
    expect(table.fieldOfViewDeg).toBe(device.fieldOfViewDeg)
    expect(table.opticOffsetMm).toBe(device.opticOffsetMm)
    expect(table.poses.map((entry) => entry.pose)).toEqual([
      'straight',
      'toward-head-10',
      'along-8',
      'rolled-90',
      'combined',
    ])
  })

  it.each(table.poses.map((entry) => [entry.pose, entry] as const))(
    'the engine’s optical frame agrees with it: %s',
    (_name, entry: Entry) => {
      const camera = scopeGeometry(entry.scopePose as ScopePose, portFrame(), instrument()).camera
      expect(near(camera.origin, entry.camera.origin, 1e-9)).toBe(true)
      expect(near(camera.forward, entry.camera.forward, 1e-9)).toBe(true)
      expect(near(camera.up, entry.camera.up, 1e-9)).toBe(true)
      // and so where each landmark falls in the picture
      const focal = 1 / Math.tan((table.fieldOfViewDeg * Math.PI) / 360)
      const right = entry.camera.right as unknown as Vec3
      for (const [key, point] of Object.entries(landmarks)) {
        const p: Vec3 = [
          point[0] - camera.origin[0],
          point[1] - camera.origin[1],
          point[2] - camera.origin[2],
        ]
        const ahead = dot(p, camera.forward)
        const ndc = [(focal * dot(p, right)) / ahead, (focal * dot(p, camera.up)) / ahead]
        const expected = entry.landmarks[key as keyof typeof entry.landmarks].ndc
        expect({ key, near: near(ndc, expected, 1e-9) }).toEqual({ key, near: true })
      }
    },
  )

  it.each(table.poses.map((entry) => [entry.pose, entry] as const))(
    'the scene’s three.js camera puts every landmark where it says: %s',
    (_name, entry: Entry) => {
      const frame = scopeGeometry(entry.scopePose as ScopePose, portFrame(), instrument()).camera
      const camera = new PerspectiveCamera()
      aimScopeCamera(camera, frame, table.fieldOfViewDeg)
      for (const [key, point] of Object.entries(landmarks)) {
        const projected = new Vector3(point[0], point[1], point[2]).project(camera)
        const expected = entry.landmarks[key as keyof typeof entry.landmarks].ndc
        expect({ key, x: projected.x, y: projected.y }).toEqual({
          key,
          x: expect.closeTo(expected[0], 5),
          y: expect.closeTo(expected[1], 5),
        })
        // in front of the camera, inside its depth range
        expect(projected.z).toBeLessThan(1)
      }
    },
  )

  it('is itself asymmetric: no two landmarks share a place in any pose, and turns move them', () => {
    for (const entry of table.poses) {
      const places = Object.values(entry.landmarks).map((l) =>
        l.ndc.map((v) => v.toFixed(3)).join(),
      )
      expect(new Set(places).size).toBe(places.length)
    }
    const at = (pose: string, key: string) =>
      table.poses.find((entry) => entry.pose === pose)!.landmarks[key as keyof Entry['landmarks']]
        .ndc
    // the superior landmark is above the centre when the picture's up is toward the head
    expect(at('straight', 'superior-12')[1]).toBeGreaterThan(at('straight', 'centre-70')[1])
    // a quarter turn clockwise, as one looks down the telescope, carries what was on the right to the top
    const straight = at('straight', 'anterior-inferior')
    const rolled = at('rolled-90', 'anterior-inferior')
    expect(Math.sign(straight[0])).toBe(1)
    expect(rolled[1]).toBeGreaterThan(Math.abs(rolled[0]))
  })
})
