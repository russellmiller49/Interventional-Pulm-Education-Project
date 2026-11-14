/** @jest-environment node */
import { resolve } from 'node:path'
import sharp from 'sharp'

import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'
import { DEFAULT_DRR_LOOK } from '../../../../fluoro-viewer/src/volume-drr'
import { rayThrough, suiteFrame } from '../components/suite/suiteModel'
import { ANATOMY } from '../lib/anatomy'
import { BONE_DEPTH_SPLIT, boneShareVolume, FLUORO_LOOK } from '../lib/fluoroLook'
import { LESION_CENTER } from '../lib/physics'
import { tableCrossing } from '../lib/rayCrossingTable'
import { STRUCTURE_RULES } from '../lib/rayStructures'

/*
 * The fluoroscopic image draws bone so that ribs show. Two things have to stay true for that to
 * teach rather than decorate: what the image draws as bone is what the "Anatomy over the nodule"
 * readout calls bone, on the same CT; and the renderer the course shares with FluoroView still
 * draws FluoroView's own image unless it is asked for the course's.
 */
const [sx, sy, sz] = ANATOMY.sizeXyz
const encode = (hu: number) =>
  Math.round(((hu - ANATOMY.huRange[0]) / (ANATOMY.huRange[1] - ANATOMY.huRange[0])) * 255)

describe('the course’s bone weighting', () => {
  it('leaves FluoroView’s own image as it was', () => {
    expect(DEFAULT_DRR_LOOK).toEqual({
      boneMu: 0.00038,
      boneLowHu: 160,
      boneHighHu: 1250,
      toneHigh: 0.92,
      toneGamma: 1,
      depthTint: 0,
      depthSplitLps: [0, 0, 0],
    })
  })

  it('starts below the HU the readout calls bone, and weights bone above FluoroView’s', () => {
    expect(FLUORO_LOOK.boneLowHu).toBeLessThan(STRUCTURE_RULES.boneHu)
    expect(FLUORO_LOOK.boneHighHu).toBeGreaterThan(STRUCTURE_RULES.boneHu)
    expect(FLUORO_LOOK.boneMu).toBeGreaterThan(DEFAULT_DRR_LOOK.boneMu)
  })

  it('measures bone depth from the nodule', () => {
    expect(BONE_DEPTH_SPLIT).toEqual(LESION_CENTER)
  })
})

describe('the bone volume', () => {
  const range = (bytes: Uint8Array) => {
    let low = 255
    let high = 0
    for (const value of bytes) {
      low = Math.min(low, value)
      high = Math.max(high, value)
    }
    return [low, high]
  }

  it('is empty in lung and soft tissue and full in dense bone', () => {
    const uniform = (hu: number) => boneShareVolume(new Uint8Array(sx * sy * sz).fill(encode(hu)))
    expect(range(uniform(-800))).toEqual([0, 0])
    expect(range(uniform(40))).toEqual([0, 0])
    expect(range(uniform(900))).toEqual([255, 255])
  })

  it('spreads a single bone voxel over its neighbours without adding or losing bone', () => {
    const volume = new Uint8Array(sx * sy * sz).fill(encode(-800))
    const at = (60 * sy + 70) * sx + 80
    volume[at] = encode(1200)
    const share = boneShareVolume(volume)
    expect(share[at]).toBe(Math.round(255 / 8))
    expect(share[at + 1]).toBe(Math.round(255 / 16))
    expect(share[at + sx]).toBe(share[at + 1])
    expect(share[at + sx * sy]).toBe(share[at + 1])
    let total = 0
    for (const value of share) total += value
    // 27 voxels, each rounded to a byte.
    expect(Math.abs(total - 255)).toBeLessThan(14)
  })
})

describe('on the course CT, the image draws what the readout names', () => {
  let share: Uint8Array

  beforeAll(async () => {
    const { data, info } = await sharp(resolve('public/peripheral-imaging/anatomy/ct-atlas.png'))
      .raw()
      .toBuffer({ resolveWithObject: true })
    const width = sx * metadata.atlasColumns
    const volume = new Uint8Array(sx * sy * sz)
    for (let z = 0; z < sz; z++) {
      const col = z % metadata.atlasColumns
      const row = Math.floor(z / metadata.atlasColumns)
      for (let y = 0; y < sy; y++)
        for (let x = 0; x < sx; x++)
          volume[(z * sy + y) * sx + x] =
            data[((row * sy + y) * width + col * sx + x) * info.channels]
    }
    share = boneShareVolume(volume)
  }, 30_000)

  /** Millimetres of bone on the path from the tube through the nodule to the detector. */
  const boneOverNodule = (orbit: number, tilt: number) => {
    const frame = suiteFrame(orbit, tilt)
    const { hit } = rayThrough(frame, LESION_CENTER)
    const length = Math.hypot(...hit.map((n, i) => n - frame.source[i]))
    let mm = 0
    for (let t = 0; t < length; t += 0.5) {
      const voxel = frame.source.map((n, i) =>
        Math.round((n + ((hit[i] - n) * t) / length - ANATOMY.originMm[i]) / ANATOMY.spacingMm[i]),
      )
      if (voxel.some((n, i) => n < 0 || n >= ANATOMY.sizeXyz[i])) continue
      mm += (share[(voxel[2] * sy + voxel[1]) * sx + voxel[0]] / 255) * 0.5
    }
    return mm
  }

  it('draws a rib over the nodule at LAO 20°, and none once the beam is tilted 3° cranial', () => {
    // The lesson's own example: the readout says "Rib", then "Lung only".
    expect(tableCrossing(-20, 0).rib).toBe(true)
    expect(tableCrossing(-20, 3).rib).toBe(false)
    const on = boneOverNodule(-20, 0)
    const off = boneOverNodule(-20, 3)
    expect(on).toBeGreaterThan(3)
    expect(off).toBeLessThan(on / 3)
  })

  it('agrees with the readout across the obliquities the lessons use', () => {
    for (const orbit of [-30, -24, -20, -10, 0, 10, 25])
      for (const tilt of [-6, -3, 0, 3, 6]) {
        const bone = boneOverNodule(orbit, tilt)
        const named = tableCrossing(orbit, tilt)
        // Where the readout names no bone at all, the image draws little on that path: the readout
        // asks for 3 mm of voxels above its threshold, and the image's ramp starts just below it.
        if (!named.rib && !named.spine) expect(bone).toBeLessThan(4)
        // Where the image draws a clear band of bone, the readout has named it.
        if (bone > 6) expect(named.rib || named.spine).toBe(true)
      }
  })
})
