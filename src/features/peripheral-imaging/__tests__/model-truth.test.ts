/** @jest-environment node */
import { resolve } from 'node:path'
import sharp from 'sharp'

import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'
import { SAMPLING_CASE_FIGURE, samplingCaseReadouts } from '../content/caseFigures'
import { CONSPICUITY_SET, TRUNCATION_EXAMPLE, TWO_AXIS_EXAMPLE } from '../content/teachingFigures'
import {
  dtsAbsenceImages,
  dtsModelProjection,
  modeledCatheterFraction,
} from '../components/figures/DtsAbsenceFigure'
import {
  axialPixelOf,
  conspicuityImages,
  targetRay,
  truncationModel,
  twoAxisModel,
} from '../components/figures/teachingFigureModel'
import { DTS_PLANE, priorPlanePoint } from '../components/suite/dtsModel'
import { rayThrough, suiteFrame } from '../components/suite/suiteModel'
import { sampleAnatomy } from '../lib/anatomy'
import { ctSampler, projectCt, projectionPixelOf, projectionPixels } from '../lib/ctProjection'
import { LESION_CENTER, LESION_RADIUS, windowRelationship } from '../lib/physics'
import { rayProfile } from '../lib/rayProfile'

/*
 * Prompt 04's figures make claims about the course's own teaching CT: which obliquity moves the
 * target ray off the soft-tissue density in front of the lesion, that this lesion needs no tilt,
 * that the off-centre volume cuts the lesion, that the DTS model's projection shows its catheter and
 * its planning-CT planes do not. The figures compute every number they print, but the *choices*
 * behind them (−20°, "no tilt", the plane depths) were made by reading the model. This suite decodes
 * the real atlas exactly as `loadAnatomyVolume` does and holds each choice to it, so a change to the
 * CT, the geometry or the example cannot leave a figure asserting something the model no longer
 * shows.
 */
let volume: Uint8Array

beforeAll(async () => {
  const { data, info } = await sharp(resolve('public/peripheral-imaging/anatomy/ct-atlas.png'))
    .raw()
    .toBuffer({ resolveWithObject: true })
  const [sx, sy, sz] = metadata.sizeXyz
  const width = sx * metadata.atlasColumns
  expect([info.width, info.height]).toEqual([width, sy * metadata.atlasRows])
  volume = new Uint8Array(sx * sy * sz)
  for (let z = 0; z < sz; z++) {
    const col = z % metadata.atlasColumns
    const row = Math.floor(z / metadata.atlasColumns)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++)
        volume[(z * sy + y) * sx + x] =
          data[((row * sy + y) * width + col * sx + x) * info.channels]
  }
}, 30_000)

describe('the fast CT sampler is the course sampler', () => {
  it('reads the same HU as sampleAnatomy at points across the chest, including outside the volume', () => {
    const sample = ctSampler(volume)
    const points: [number, number, number][] = [
      [85, -20, -30],
      [0, 0, 0],
      [-120.3, 40.7, 55.1],
      [150, -140, -150],
      [400, 0, 0],
    ]
    for (const point of points)
      expect(sample(...point)).toBeCloseTo(sampleAnatomy(volume, point), 6)
  })
})

describe('OD4-08 · the two-axis worked example reads the model, not a rule', () => {
  it('the chosen obliquity moves the detector-side ray off the density in front of the lesion', () => {
    const frontal = targetRay(volume, 0, 0)
    const chosen = targetRay(volume, TWO_AXIS_EXAMPLE.chosenObliquity, 0)
    // Frontally the ray crosses a long soft-tissue-like path anterior to the lesion.
    expect(frontal.detectorSide.soft).toBeGreaterThan(80)
    // At the chosen obliquity most of it is gone, and the whole ray crosses less soft tissue.
    expect(chosen.detectorSide.soft).toBeLessThan(frontal.detectorSide.soft / 2)
    expect(chosen.softTotal).toBeLessThan(frontal.softTotal)
  })

  it('the chosen obliquity has the shortest soft-tissue path of every candidate shown', () => {
    const chosen = targetRay(volume, TWO_AXIS_EXAMPLE.chosenObliquity, 0)
    for (const obliquity of TWO_AXIS_EXAMPLE.stripObliquities)
      expect(chosen.softTotal).toBeLessThanOrEqual(targetRay(volume, obliquity, 0).softTotal)
  })

  it('going further lengthens the tube-side path, and the opposite sign runs through more density', () => {
    const chosen = targetRay(volume, TWO_AXIS_EXAMPLE.chosenObliquity, 0)
    const further = targetRay(volume, -35, 0)
    const opposite = targetRay(volume, -TWO_AXIS_EXAMPLE.chosenObliquity, 0)
    const frontal = targetRay(volume, 0, 0)
    expect(further.tubeSide.soft + further.tubeSide.bone).toBeGreaterThan(
      chosen.tubeSide.soft + chosen.tubeSide.bone,
    )
    expect(opposite.detectorSide.soft).toBeGreaterThan(frontal.detectorSide.soft)
  })

  it('"no tilt needed" is only printed because tilt changes the detector-side path by little here', () => {
    const model = twoAxisModel(volume)
    expect(model.tiltRangeMm).toBeLessThanOrEqual(TWO_AXIS_EXAMPLE.tiltToleranceMm)
    expect(model.tilts.map((ray) => ray.tilt)).toEqual([...TWO_AXIS_EXAMPLE.tiltCheck.tilts])
    expect(model.tilts.every((ray) => ray.obliquity === TWO_AXIS_EXAMPLE.tiltCheck.obliquity)).toBe(
      true,
    )
  })

  it('draws each candidate beam through the lesion, detector end in the direction the sign says', () => {
    const model = twoAxisModel(volume)
    const [lx, ly] = axialPixelOf(LESION_CENTER[0], LESION_CENTER[1])
    for (const line of model.lines) {
      // The line passes through the lesion's centre (within a pixel).
      const [fx, fy] = line.from
      const [tx, ty] = line.to
      const cross =
        Math.abs((tx - fx) * (ly - fy) - (ty - fy) * (lx - fx)) / Math.hypot(tx - fx, ty - fy)
      expect(cross).toBeLessThan(1)
      // Anterior is up in the radiological axial display, so the detector end is higher.
      expect(ty).toBeLessThan(fy)
      // Positive obliquity: detector toward the patient's right, which is the image's left.
      if (line.obliquity > 0) expect(tx).toBeLessThan(lx)
      if (line.obliquity < 0) expect(tx).toBeGreaterThan(lx)
      if (line.obliquity === 0) expect(Math.abs(tx - lx)).toBeLessThan(1)
    }
  })

  it('shows the modeled tool nearly in profile at the chosen view and foreshortened near its axis', () => {
    const { alignment, advancement } = twoAxisModel(volume).toolViews
    expect(advancement.obliquity).toBe(TWO_AXIS_EXAMPLE.chosenObliquity)
    expect(advancement.profileFraction).toBeGreaterThanOrEqual(0.9)
    expect(alignment.profileFraction).toBeLessThanOrEqual(0.3)
  })
})

describe('OD4-06 · Section 6 compares on the real CT, and says what is simulated', () => {
  it('the changed view has less soft-tissue-like CT on the target ray, as its readout prints', () => {
    const images = conspicuityImages(volume)
    expect(images.rays.changed.obliquity).toBe(CONSPICUITY_SET.changedView.orbit)
    expect(images.rays.changed.softTotal).toBeLessThan(images.rays.reference.softTotal)
  })

  it('draws the reference, noise and superimposition frames collimated, and the scatter frame open', () => {
    const images = conspicuityImages(volume)
    const size = images.sizePx
    const corner = (pixels: Uint8ClampedArray) => pixels[0]
    expect(corner(images.reference)).toBe(10)
    expect(corner(images.noise)).toBe(10)
    expect(corner(images.superimposition)).toBe(10)
    expect(corner(images.scatter)).not.toBe(10)
    // The lesion projects at the centre of every frame.
    expect(images.lesion.reference.x).toBeCloseTo(size / 2, 1)
    expect(images.lesion.reference.y).toBeCloseTo(size / 2, 1)
  })

  it('the veiled frame has lower contrast than the same open field without the veil', () => {
    const images = conspicuityImages(volume)
    const spread = (pixels: Uint8ClampedArray) => {
      let min = 255
      let max = 0
      for (let i = 0; i < pixels.length; i += 4) {
        min = Math.min(min, pixels[i])
        max = Math.max(max, pixels[i])
      }
      return max - min
    }
    const open = projectCt(ctSampler(volume), {
      ...CONSPICUITY_SET.referenceView,
      sizePx: CONSPICUITY_SET.sizePx,
      fieldMm: CONSPICUITY_SET.frameFieldMm,
    })
    expect(spread(images.scatter)).toBeLessThan(spread(projectionPixels(open.lineIntegral)) * 0.8)
  })
})

describe('OD4-06 · Section 16 truncation shows coverage the model really has', () => {
  it('the modeled volume is the CBCT model’s own cylinder and its edge runs through the lesion', () => {
    const model = truncationModel(volume)
    expect(model.lesionCoveredFraction).toBeGreaterThan(0.35)
    expect(model.lesionCoveredFraction).toBeLessThan(0.65)
    expect(TRUNCATION_EXAMPLE.radiusMm).toBe(192)
    expect(
      Math.hypot(
        LESION_CENTER[0] - TRUNCATION_EXAMPLE.centreMm[0],
        LESION_CENTER[1] - TRUNCATION_EXAMPLE.centreMm[1],
      ),
    ).toBeCloseTo(TRUNCATION_EXAMPLE.radiusMm, 6)
  })
})

describe('QS-5 · practice case 9 shows what its situation says', () => {
  it('the modeled catheter is visible on the projection panel, as a bright line ending at the lesion', () => {
    const projection = dtsModelProjection(volume)
    const size = DTS_PLANE.sizePx
    const at = (col: number, row: number) => projection[(row * size + col) * 4]
    // The catheter's axis runs along the frame's centre row, from 60 mm short of the lesion's centre
    // up to it. Along that whole span it stands out as a thin line above the rows 8 px either side
    // (anatomy makes the background slope, so the two sides are averaged).
    const row = size / 2
    expect(priorPlanePoint(0, row, 0)[2]).toBeCloseTo(LESION_CENTER[2], 6)
    for (const col of [58, 70, 90, 110, 130, 150, 160]) {
      const [x, , z] = priorPlanePoint(col, row, 0)
      expect(modeledCatheterFraction(x, LESION_CENTER[1] - 18, z)).toBe(1)
      const peak = Math.max(at(col, row - 1), at(col, row), at(col, row + 1))
      const above = peak - at(col, row - 8)
      const below = peak - at(col, row + 8)
      expect(Math.min(above, below)).toBeGreaterThanOrEqual(6)
      expect((above + below) / 2).toBeGreaterThanOrEqual(10)
    }
    // Beyond the lesion's centre there is no catheter to see.
    const [xBeyond, , zBeyond] = priorPlanePoint(200, row, 0)
    expect(modeledCatheterFraction(xBeyond, LESION_CENTER[1] - 18, zBeyond)).toBe(0)
  })

  it('the three reconstructed planes and the planning CT carry no catheter: they are the CT alone', () => {
    const images = dtsAbsenceImages(volume)
    // The catheter's own voxels, on the plane at its depth, read as lung-like CT, not a dense tool.
    for (const col of [70, 110, 150]) {
      const [x, y, z] = priorPlanePoint(col, 128, -18)
      expect(modeledCatheterFraction(x, y, z)).toBeGreaterThan(0)
      expect(sampleAnatomy(volume, [x, y, z])).toBeLessThan(-150)
    }
    // The plane through the lesion and the planning CT panel are the same samples: the resemblance
    // the answer rests on is real in this model.
    expect(Buffer.from(images.planes[2]).equals(Buffer.from(images.ct))).toBe(true)
  })

  it('names no airway: the modeled catheter runs through lung-density CT, which is why the text does not', () => {
    const lumen = []
    for (let dx = -55; dx <= -5; dx += 5)
      lumen.push(
        sampleAnatomy(volume, [LESION_CENTER[0] + dx, LESION_CENTER[1] - 18, LESION_CENTER[2]]),
      )
    // An airway lumen would read close to air (below −950 HU) along the catheter's course.
    expect(lumen.filter((hu) => hu < -950).length).toBeLessThan(lumen.length / 2)
  })

  it('the authored nodule is in the posterior left lung, which is all the case says', () => {
    // Model axes: x patient left, y anterior. No lobe is named until the CT is reviewed (OD4-11).
    expect(LESION_CENTER[0]).toBeGreaterThan(0)
    expect(LESION_CENTER[1]).toBeLessThan(0)
  })
})

describe('QS-8 · integrated case 5 is drawn at a geometry the model reads as the answer', () => {
  it('the window partly intersects the modeled lesion and the tip lies beyond it', () => {
    const readouts = samplingCaseReadouts()
    expect(readouts).toMatchObject({ intersects: true, full: false, tipInside: false })
    expect(readouts.label).toBe('Sampling window partly intersects the modeled lesion')
    expect(readouts.tipFromSurfaceMm).toBeGreaterThan(0)
    expect(windowRelationship(SAMPLING_CASE_FIGURE.tip)).toMatchObject({ tipInside: false })
    // The tip is beyond the lesion along the needle's own direction (+x), not merely off to a side.
    const [x, y, z] = SAMPLING_CASE_FIGURE.tip
    expect(x).toBeGreaterThan(Math.sqrt(LESION_RADIUS ** 2 - y ** 2 - z ** 2))
  })

  it('each linked plane passes through what it is meant to show', () => {
    const [x, y, z] = SAMPLING_CASE_FIGURE.tip
    const { axial, coronal, sagittal } = SAMPLING_CASE_FIGURE.planes
    expect(axial).toBe(z)
    expect(coronal).toBe(y)
    // The sagittal plane cuts the window (tip − 14 to tip − 6) where it lies inside the lesion.
    expect(sagittal).toBeGreaterThanOrEqual(x - 14)
    expect(sagittal).toBeLessThanOrEqual(x - 6)
    expect(sagittal ** 2 + y ** 2 + z ** 2).toBeLessThan(LESION_RADIUS ** 2)
  })
})

describe('the CPU projection keeps the suite’s geometry', () => {
  it('centres the lesion at every obliquity, as the suite’s projection geometry places it', () => {
    const sample = ctSampler(volume)
    for (const orbit of [0, -20, 35]) {
      const image = projectCt(sample, { orbit, tilt: 0, sizePx: 64, fieldMm: 200 })
      const [px, py] = projectionPixelOf(image, LESION_CENTER, orbit, 0)
      expect(px).toBeCloseTo(32, 6)
      expect(py).toBeCloseTo(32, 6)
    }
  })

  it('the fast sampler gives the target-ray readouts the course’s own ray profile gives', () => {
    for (const obliquity of [0, -20]) {
      const fast = targetRay(volume, obliquity, 0)
      const ray = rayThrough(suiteFrame(obliquity, 0), LESION_CENTER)
      const slow = rayProfile(volume, LESION_CENTER, ray.hit, { stepMm: 1 })
      expect(Math.abs(fast.detectorSide.soft - slow.tissueMm.soft)).toBeLessThanOrEqual(1)
    }
  })
})
