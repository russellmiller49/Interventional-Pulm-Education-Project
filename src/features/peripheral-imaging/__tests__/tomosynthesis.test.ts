/** @jest-environment node */
import { resolve } from 'node:path'
import sharp from 'sharp'
import {
  DTS,
  DTS_GRID,
  dtsDetectorCoordinate,
  dtsGridTile,
  dtsPixel,
  dtsSweepAngles,
  reconstructOffCentrePlane,
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

describe('arcs centred off the frontal view', () => {
  const decode = async (file: string) => {
    const { data } = await sharp(resolve(`public/peripheral-imaging/anatomy/${file}`))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    return new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)
  }

  it('puts every view of every offered arc width and centre on the projection grid', () => {
    expect(DTS_GRID.sourceAtlasSha256).toBe(DTS.sourceAtlasSha256)
    for (const sweep of DTS.sweeps)
      for (let centre = -30; centre <= 30; centre += 10) {
        const angles = dtsSweepAngles(sweep, centre)
        expect(angles).toHaveLength(DTS.viewsPerSweep)
        expect(angles[0]).toBeCloseTo(centre - sweep / 2, 9)
        expect(angles[angles.length - 1]).toBeCloseTo(centre + sweep / 2, 9)
        for (const angle of angles) expect(dtsGridTile(angle)).not.toBeNull()
      }
    expect(dtsGridTile(0.4)).toBeNull()
  })

  it('reconstructs a frontal arc from the grid exactly as from the symmetric atlas', async () => {
    const [projections, grid] = await Promise.all([
      decode('dts-projections.png'),
      decode('dts-grid.png'),
    ])
    for (const [sweep, plane] of [
      [30, 0],
      [60, -18],
    ] as const) {
      const frontal = reconstructTeachingPlane(projections, sweep, plane, 48)
      const fromGrid = reconstructOffCentrePlane(grid, sweep, 0, plane, 48)
      expect(fromGrid).not.toBeNull()
      expect(Array.from(fromGrid!)).toEqual(Array.from(frontal))
    }
  }, 60_000)

  it('makes the nodule stand out when the arc is centred where its path clears the heart', async () => {
    // The lab's readout says the path through the nodule crosses the heart frontally and clears it
    // at −20°. Structures on that path lie above and below the nodule in depth, where the arc blurs
    // them into it; centring the arc at −20° leaves lung there, and the nodule shows.
    const grid = await decode('dts-grid.png')
    const size = 256
    const cnr = (centre: number) => {
      const image = reconstructOffCentrePlane(grid, 30, centre, 0, size)!
      const core: number[] = []
      const ring: number[] = []
      for (let row = 0; row < size; row++)
        for (let col = 0; col < size; col++) {
          const across = -20 + ((col - size / 2) * 140) / size
          const z = ((size / 2 - row) * 140) / size
          const r = Math.hypot(across, z)
          const gray = image[(row * size + col) * 4]
          if (r < 6) core.push(gray)
          else if (r > 12 && r < 20) ring.push(gray)
        }
      const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
      const ringMean = mean(ring)
      const sd = Math.sqrt(mean(ring.map((v) => (v - ringMean) ** 2)))
      return (mean(core) - ringMean) / sd
    }
    const frontal = cnr(0)
    const cleared = cnr(-20)
    expect(cleared).toBeGreaterThan(2 * frontal)
    expect(cleared).toBeGreaterThan(2.5)
  }, 60_000)
})
