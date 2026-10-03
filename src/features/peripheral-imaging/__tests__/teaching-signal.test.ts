import { ANATOMY } from '../lib/anatomy'
import {
  collimatedField,
  ctSampler,
  huToMu,
  projectCt,
  projectionDisplay,
  projectionPixelOf,
  PROJECTION_MU_SCALE,
} from '../lib/ctProjection'
import { LESION_CENTER, type Point3 } from '../lib/physics'
import {
  addUniformVeil,
  matchMeanBrightness,
  meanBrightness,
  regionContrast,
  seededRandom,
  simulateQuantumNoise,
} from '../lib/teachingSignal'

const [sx, sy, sz] = ANATOMY.sizeXyz
const encode = (hu: number) =>
  Math.round(((hu - ANATOMY.huRange[0]) / (ANATOMY.huRange[1] - ANATOMY.huRange[0])) * 255)

/** A synthetic volume: `hu` everywhere, and a denser sphere of `radius` mm at `centre`. */
function volumeWith(hu: number, sphere?: { centre: Point3; radius: number; hu: number }) {
  const volume = new Uint8Array(sx * sy * sz).fill(encode(hu))
  if (!sphere) return volume
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        const mm = [x, y, z].map((n, i) => ANATOMY.originMm[i] + n * ANATOMY.spacingMm[i])
        if (Math.hypot(...mm.map((v, i) => v - sphere.centre[i])) <= sphere.radius)
          volume[(z * sy + y) * sx + x] = encode(sphere.hu)
      }
  return volume
}

describe('the CPU projection is FluoroView’s mapping on the suite’s geometry', () => {
  it('uses FluoroView’s attenuation and display constants at the suite’s default settings', () => {
    expect(PROJECTION_MU_SCALE).toBe(7.5)
    expect(huToMu(-1000)).toBe(0)
    // At 80 HU the soft-tissue ramp (−850 to 80) is complete and the bone ramp (from 160) not begun.
    expect(huToMu(80)).toBeCloseTo(0.00013 * 1.08 + 0.00009, 12)
    expect(huToMu(0)).toBeLessThan(huToMu(80))
    expect(huToMu(1300)).toBeGreaterThan(huToMu(100))
    expect(projectionDisplay(0.035)).toBe(0)
    expect(projectionDisplay(0.92)).toBe(1)
    expect(projectionDisplay(0.5)).toBeGreaterThan(projectionDisplay(0.3))
  })

  it('reads nothing through air, and puts a dense sphere where the suite geometry projects it', () => {
    expect(
      // The atlas floor, −1100 HU, is the one value with no density at all once quantized.
      Math.max(
        ...projectCt(ctSampler(volumeWith(-1100)), { orbit: 0, tilt: 0, sizePx: 16, fieldMm: 200 })
          .lineIntegral,
      ),
    ).toBe(0)
    const centre: Point3 = [LESION_CENTER[0] - 30, LESION_CENTER[1] + 10, LESION_CENTER[2] + 25]
    const volume = volumeWith(-1100, { centre, radius: 12, hu: 1000 })
    for (const orbit of [0, -20, 35]) {
      const image = projectCt(ctSampler(volume), { orbit, tilt: 0, sizePx: 48, fieldMm: 240 })
      let best = 0
      let at = 0
      image.lineIntegral.forEach((value, i) => {
        if (value > best) {
          best = value
          at = i
        }
      })
      const [px, py] = projectionPixelOf(image, centre, orbit, 0)
      expect(Math.abs((at % 48) + 0.5 - px)).toBeLessThan(1.5)
      expect(Math.abs(Math.floor(at / 48) + 0.5 - py)).toBeLessThan(1.5)
    }
  })

  it('collimates a centred square of the requested width', () => {
    const { exposed, edgePx } = collimatedField({ sizePx: 100, fieldMm: 200 }, 100)
    expect(edgePx).toEqual({ low: 25, high: 75 })
    expect(exposed[0]).toBe(0)
    expect(exposed[50 * 100 + 50]).toBe(1)
    expect(exposed.reduce((sum, value) => sum + value, 0)).toBe(50 * 50)
  })
})

describe('the simulated effects are shaped honestly and drawn the same way every time', () => {
  const ramp = new Float32Array(400).map((_, i) => 0.1 + (i % 20) * 0.02)

  it('draws the same noise for the same seed, and less of it from more photons', () => {
    const a = simulateQuantumNoise(ramp, { photonsPerPixel: 700, seed: 6 })
    const b = simulateQuantumNoise(ramp, { photonsPerPixel: 700, seed: 6 })
    expect(Array.from(a)).toEqual(Array.from(b))
    const deviation = (values: Float32Array) =>
      values.reduce((sum, value, i) => sum + Math.abs(value - ramp[i]), 0) / values.length
    expect(
      deviation(simulateQuantumNoise(ramp, { photonsPerPixel: 70_000, seed: 6 })),
    ).toBeLessThan(deviation(a) / 5)
    // Mottle is heavier where fewer photons get through (denser pixels).
    const dense = ramp.map(() => 0.5)
    const thin = ramp.map(() => 0.1)
    const spread = (values: Float32Array, base: number) =>
      values.reduce((sum, value) => sum + Math.abs(value - base), 0) / values.length
    expect(
      spread(simulateQuantumNoise(dense, { photonsPerPixel: 700, seed: 1 }), 0.5),
    ).toBeGreaterThan(spread(simulateQuantumNoise(thin, { photonsPerPixel: 700, seed: 1 }), 0.1))
    expect(seededRandom(3)()).toBe(seededRandom(3)())
  })

  it('lowers contrast with the veil, and restores brightness without restoring contrast', () => {
    const veiled = addUniformVeil(ramp, { fractionOfMean: 1 })
    expect(regionContrast(veiled)).toBeLessThan(regionContrast(ramp))
    const target = meanBrightness(ramp, projectionDisplay)
    const levelled = matchMeanBrightness(veiled, projectionDisplay, target)
    expect(meanBrightness(levelled, projectionDisplay)).toBeCloseTo(target, 3)
    // A level shift only: every pixel moves by the same amount, so the veil's contrast loss stays.
    const shift = levelled[0] - veiled[0]
    levelled.forEach((value, i) => expect(value - veiled[i]).toBeCloseTo(shift, 5))
    expect(regionContrast(levelled)).toBeCloseTo(regionContrast(veiled), 5)
  })
})
