/** @jest-environment node */
import {
  makeFrame,
  transport,
  rollFrame,
  steerFrame,
  scalar,
  magnitude,
  projectOptical,
  sweepClearance,
  type Point3,
} from './frame'
import {
  makeSlicePlane,
  patientToVoxel,
  voxelToPatient,
  trilinear,
  slicePixelToPatient,
  patientToSlicePixel,
  reslice,
  type CtGeometry,
} from './ct'

describe('patient-space optical frame', () => {
  it('transports smoothly through the former global-up singularity', () => {
    let frame = makeFrame([0, 0, 0], [0, 0, -1])
    for (let angle = 0; angle <= Math.PI; angle += 0.01) {
      const next = transport(frame, [0, 0, 0], [0, -Math.sin(angle), -Math.cos(angle)])
      expect(scalar(frame.up, next.up)).toBeGreaterThan(0.99)
      expect(scalar(next.up, next.forward)).toBeCloseTo(0, 10)
      expect(magnitude(next.right)).toBeCloseTo(1, 10)
      frame = next
    }
  })
  it('steers in screen coordinates after any shaft rotation', () => {
    for (const roll of [0, 90, 180, 270, 720]) {
      const frame = rollFrame(makeFrame([0, 0, 0], [0, 0, -1]), roll)
      const right = steerFrame(frame, 10, 0),
        up = steerFrame(frame, 0, 10)
      expect(scalar(right.forward, frame.right)).toBeGreaterThan(0.15)
      expect(scalar(up.forward, frame.up)).toBeGreaterThan(0.15)
    }
  })
  it('keeps the longest optical field constant across wide panes', () => {
    const frame = makeFrame([0, 0, 0], [0, 0, -1], [0, 1, 0]),
      point: Point3 = [5, 0, -10]
    expect(projectOptical(point, frame, 16 / 9)!.x).toBeCloseTo(
      projectOptical(point, frame, 4 / 3)!.x,
      10,
    )
  })
})
describe('spatial collision sweep', () => {
  const clearance = ([x, y]: Point3) => 3 - Math.hypot(x, y)
  it('cannot tunnel through a wall during a slow frame', () => {
    const result = sweepClearance(clearance, [0, 0, 0], [30, 0, 0], 0.55)
    expect(result.point[0]).toBeLessThanOrEqual(2.45)
    expect(result.point[0]).toBeGreaterThan(2.15)
    expect(result.contact.touching).toBe(true)
  })
  it('allows withdrawal away from contact and rotation without position changes', () => {
    const result = sweepClearance(clearance, [2.5, 0, 0], [0, 0, 0], 0.55)
    expect(result.contact.blockedMm).toBe(0)
    expect(result.point).toEqual([0, 0, 0])
  })
})
describe('physical CT resampling', () => {
  const g: CtGeometry = {
    sizeXyz: [7, 9, 11],
    spacingXyzMm: [0.6, 1.2, 2.5],
    originLps: [10, -30, 50],
    directionLps: [0, -1, 0, -1, 0, 0, 0, 0, -1],
  }
  it('round trips anisotropic reversed and oblique axes', () => {
    for (const directionLps of [g.directionLps, [0.8, -0.6, 0, 0.6, 0.8, 0, 0, 0, 1]]) {
      const geometry = { ...g, directionLps },
        index: Point3 = [2.35, 4.2, 7.1]
      patientToVoxel(geometry, voxelToPatient(geometry, index)).forEach((v, i) =>
        expect(v).toBeCloseTo(index[i], 10),
      )
    }
  })
  it('preserves signed HU and interpolates a linear asymmetric landmark volume', () => {
    expect(trilinear(g, [2.5, 3.5, 4.5], (i, j, k) => -1000 + i + 10 * j + 100 * k)).toBeCloseTo(
      -512.5,
    )
    expect(trilinear(g, [-1, 0, 0], () => 1000)).toBe(-1024)
  })
  it.each(['axial', 'coronal', 'sagittal', 'oblique'] as const)(
    'agrees to subpixel precision in %s',
    (axis) => {
      const frame = makeFrame(voxelToPatient(g, [3, 4, 5]), [0.4, 0.5, -0.7])
      const plane = makeSlicePlane(g, axis, frame, 1.4, [2, -3], 0, 192)
      const pixel = patientToSlicePixel(plane, slicePixelToPatient(plane, 50.25, 60.75))
      expect(pixel.x).toBeCloseTo(50.25, 8)
      expect(pixel.y).toBeCloseTo(60.75, 8)
      expect(pixel.offPlaneMm).toBeCloseTo(0, 8)
      expect(plane.width / plane.height).toBeCloseTo(plane.widthMm / plane.heightMm, 1)
    },
  )
  it('windows a negative HU value without an unsigned cast', () => {
    const plane = makeSlicePlane(g, 'axial', makeFrame([0, 0, 0], [0, 0, -1]), 1, [0, 0], 0, 8)
    const pixels = reslice(plane, -1000, 0, () => -500)
    expect([...pixels.slice(0, 4)]).toEqual([128, 128, 128, 255])
  })
})
