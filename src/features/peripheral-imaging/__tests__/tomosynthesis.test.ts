/** @jest-environment node */
import {
  DTS,
  dtsDetectorCoordinate,
  dtsPixel,
  reconstructTeachingPlane,
} from '../lib/tomosynthesis'

it('aligns the chosen depth across views and separates a different depth', () => {
  const x = 85,
    selectedDepth = -20
  for (const angle of [-30, -15, 0, 15, 30]) {
    const u = dtsDetectorCoordinate(x, selectedDepth, angle)
    const restored =
      (u - selectedDepth * Math.sin((angle * Math.PI) / 180)) / Math.cos((angle * Math.PI) / 180)
    expect(restored).toBeCloseTo(x)
  }
  expect(
    Math.abs(dtsDetectorCoordinate(x, -38, 30) - dtsDetectorCoordinate(x, -20, 30)),
  ).toBeCloseTo(9)
})

it('samples the intended sweep/view tile, interpolates, and excludes unavailable rays', () => {
  const width = DTS.tileSize * DTS.viewsPerSweep
  const data = new Uint8ClampedArray(width * DTS.tileSize * DTS.sweeps.length * 4)
  const row = DTS.sweeps.indexOf(30),
    view = 6
  const set = (x: number, y: number, value: number) => {
    data[((row * DTS.tileSize + y) * width + view * DTS.tileSize + x) * 4] = value
  }
  set(10, 20, 20)
  set(11, 20, 40)
  set(10, 21, 60)
  set(11, 21, 80)
  expect(dtsPixel(data, 30, 6, 10.5, 20.5)).toBe(50)
  expect(dtsPixel(data, 30, 5, 10.5, 20.5)).toBe(0)
  expect(dtsPixel(data, 30, 6, -1, 20)).toBe(0)
})

it('uses one display window across reconstructed depths rather than normalizing each image', () => {
  const data = new Uint8ClampedArray(
    DTS.tileSize ** 2 * DTS.viewsPerSweep * DTS.sweeps.length * 4,
  ).fill(128)
  const near = reconstructTeachingPlane(data, 30, 0, 16)
  const far = reconstructTeachingPlane(data, 30, 25, 16)
  expect(near).toEqual(far)
  expect(near[0]).toBe(95)
  expect(near[3]).toBe(255)
})
