/** @jest-environment node */
import { PerspectiveCamera, Vector3, type BufferGeometry } from 'three'

import { ANATOMY } from '../lib/anatomy'
import { DEFAULT_GEOMETRY, type Point3 } from '../lib/physics'
import { cameraPose, upFor } from '../components/suite/cameraPose'
import { limbGeometry, loftGeometry, resampleRows, sectionRing } from '../components/suite/loft'
import { carmDimensions, holderAngle, holderPoint } from '../components/suite/ParametricCarm'
import { PATIENT_BACK_Y, PATIENT_TRUNK } from '../components/suite/PatientBody'
import { TABLE, roomBounds } from '../components/suite/Room'
import { suiteFrame, toScene } from '../components/suite/suiteModel'

/**
 * The room the lessons are worked in: the patient figure, the C-arm, the table.
 *
 * The models are authored, but three things about them are claims a clinician will hold the
 * picture to: which side of the picture the patient's left is on, which way an obliquity swings
 * the detector, and that the figure really contains the CT it is drawn round.
 */

function cameraFor(view: 'head' | 'side' | 'anterior', orbit = 0) {
  const frame = suiteFrame(orbit, 0)
  const pose = cameraPose({ view, frame, fov: 42, width: 900, height: 600, labelled: false })
  const camera = new PerspectiveCamera(42, 900 / 600, 1, 12000)
  camera.position.set(...toScene(pose.position))
  camera.up.set(...toScene(pose.up))
  camera.lookAt(...toScene(pose.target))
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  return { camera, frame }
}
const onScreen = (camera: PerspectiveCamera, point: Point3) =>
  new Vector3(...toScene(point)).project(camera)

describe('the room is drawn the way it stands, not in a mirror', () => {
  it('reflects the patient frame into the renderer, and back', () => {
    expect(toScene([85, -20, -30])).toEqual([-85, -20, -30])
    expect(toScene(toScene([85, -20, -30]))).toEqual([85, -20, -30])
  })

  it('from the head of the table, the patient’s left is on the viewer’s left', () => {
    const { camera } = cameraFor('head')
    expect(onScreen(camera, [150, 0, 0]).x).toBeLessThan(onScreen(camera, [-150, 0, 0]).x)
    // Anterior is up: the patient is supine.
    expect(onScreen(camera, [0, 150, 0]).y).toBeGreaterThan(onScreen(camera, [0, -150, 0]).y)
  })

  it('from the head of the table, RAO swings the detector to the viewer’s right', () => {
    // Positive obliquity is RAO: the detector moves toward the patient's right.
    const frontal = cameraFor('head', 0)
    const rao = suiteFrame(30, 0)
    const lao = suiteFrame(-30, 0)
    expect(rao.detectorCenter[0]).toBeLessThan(0)
    expect(onScreen(frontal.camera, rao.detectorCenter).x).toBeGreaterThan(
      onScreen(frontal.camera, frontal.frame.detectorCenter).x,
    )
    expect(onScreen(frontal.camera, lao.detectorCenter).x).toBeLessThan(
      onScreen(frontal.camera, frontal.frame.detectorCenter).x,
    )
  })

  it('looking down on the supine patient with the head up, the patient’s left is on the right', () => {
    // The same arrangement as a frontal image: screen right is the patient's left.
    const { camera } = cameraFor('anterior')
    expect(onScreen(camera, [150, 0, 0]).x).toBeGreaterThan(onScreen(camera, [-150, 0, 0]).x)
    expect(onScreen(camera, [0, 0, 150]).y).toBeGreaterThan(onScreen(camera, [0, 0, -150]).y)
  })

  it('from beside the table the tube is below and the detector above', () => {
    expect(upFor('side')).toEqual([0, 1, 0])
    const { camera, frame } = cameraFor('side')
    expect(onScreen(camera, frame.source).y).toBeLessThan(onScreen(camera, frame.iso).y)
    expect(onScreen(camera, frame.detectorCenter).y).toBeGreaterThan(onScreen(camera, frame.iso).y)
  })

  it('the beam’s view starts at the focal spot and looks at the detector', () => {
    const frame = suiteFrame(20, 5)
    const pose = cameraPose({ view: 'beam', frame, fov: 42, width: 600, height: 600 })
    // Inside the tube housing, a couple of centimetres behind the spot.
    expect(Math.hypot(...pose.position.map((n, i) => n - frame.source[i]))).toBeLessThan(25)
    pose.target.forEach((n, i) => expect(n).toBeCloseTo(frame.detectorCenter[i], 6))
  })
})

describe('the C-arm’s holder', () => {
  it('stays on the stand’s side while the C slides through it', () => {
    expect(holderAngle(0)).toBeCloseTo(Math.PI, 10)
    const reach = carmDimensions(DEFAULT_GEOMETRY).radius
    for (const orbit of [-60, -30, 0, 30, 60]) {
      const [x, y, z] = holderPoint(suiteFrame(orbit, 0))
      // On the patient's right, about level with the C's centre, wherever the tube has gone.
      expect(x).toBeLessThan(-reach * 0.95)
      expect(Math.abs(y)).toBeLessThan(DEFAULT_GEOMETRY.field * 0.4)
      expect(z).toBeCloseTo(0, 6)
    }
  })

  it('rides with the C once a spin has run out of arc to slide', () => {
    expect(holderAngle(100)).toBe(holderAngle(90))
    expect(holderAngle(-100)).toBe(holderAngle(-90))
  })
})

function signedVolume(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position')
  const index = geometry.getIndex()!
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3()
  let volume = 0
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i))
    b.fromBufferAttribute(position, index.getX(i + 1))
    c.fromBufferAttribute(position, index.getX(i + 2))
    volume += a.dot(b.clone().cross(c)) / 6
  }
  return volume
}

describe('lofted figures', () => {
  it('closes a skin whose faces point outward', () => {
    // A cylinder of radius 10 and height 20, as a loft of three rings.
    const ring = (z: number) =>
      sectionRing((x, y) => [x, y, z], 10, -10, 10, { segments: 64, squareness: 2 })
    const volume = signedVolume(loftGeometry([ring(0), ring(10), ring(20)]))
    expect(volume).toBeGreaterThan(0)
    expect(volume).toBeCloseTo(Math.PI * 100 * 20, -2)
  })

  it('closes a limb whose faces point outward', () => {
    const volume = signedVolume(
      limbGeometry([
        { at: [0, 0, 0], radius: 10 },
        { at: [0, 0, 100], radius: 10 },
      ]),
    )
    expect(volume).toBeGreaterThan(Math.PI * 100 * 100 * 0.95)
  })

  it('refuses rings of different sizes', () => {
    expect(() =>
      loftGeometry([
        [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        [
          [0, 0, 1],
          [1, 0, 1],
        ],
      ]),
    ).toThrow()
  })

  it('resamples through its keys', () => {
    const rows = resampleRows(
      [
        [0, 1],
        [10, 3],
        [20, 2],
      ],
      4,
    )
    expect(rows[0]).toEqual([0, 1])
    expect(rows[4][0]).toBeCloseTo(10)
    expect(rows[4][1]).toBeCloseTo(3)
    expect(rows.at(-1)).toEqual([20, 2])
  })
})

describe('the patient figure is drawn round the CT', () => {
  const layer = (name: string) => ANATOMY.layers.find((item) => item.name === name)!
  const [ctLow, ctHigh] = [ANATOMY.originMm[2], ANATOMY.originMm[2] + 191 * ANATOMY.spacingMm[2]]
  const chest = resampleRows(PATIENT_TRUNK, 5).filter(([z]) => z >= ctLow && z <= ctHigh)

  it('holds the ribs and the lungs inside the skin', () => {
    const ribs = layer('Ribs and spine').boundsMm
    const lungs = layer('Lungs').boundsMm
    expect(chest.length).toBeGreaterThan(10)
    for (const [, halfWidth, back, front] of chest) {
      expect(halfWidth).toBeGreaterThan(Math.max(-ribs[0][0], ribs[1][0]))
      expect(front).toBeGreaterThan(lungs[1][1])
      expect(back).toBeLessThanOrEqual(PATIENT_BACK_Y + 1)
    }
  })

  it('lies on the table, head toward the bronchoscopist', () => {
    const vertex = Math.max(...PATIENT_TRUNK.map(([z]) => z))
    expect(vertex).toBeGreaterThan(ctHigh + 250)
    expect(TABLE.headZ).toBeGreaterThan(vertex)
    expect(TABLE.halfWidth).toBeGreaterThan(Math.max(...PATIENT_TRUNK.map(([, w]) => w)))
  })

  it('gives a camera the whole room to frame', () => {
    const frame = suiteFrame(20, 0)
    const points = roomBounds(frame)
    const xs = points.map(([x]) => x)
    // The stand is on the patient's right, the monitor cart on the left.
    expect(Math.min(...xs)).toBeLessThan(carmDimensions(frame.geometry).standX)
    expect(Math.max(...xs)).toBeGreaterThan(TABLE.halfWidth * 2)
  })
})
