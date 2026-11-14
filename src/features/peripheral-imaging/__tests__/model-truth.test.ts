/** @jest-environment node */
import { resolve } from 'node:path'
import sharp from 'sharp'

import metadata from '../../../../public/peripheral-imaging/anatomy/manifest.json'
import { SAMPLING_CASE_FIGURE, samplingCaseReadouts } from '../content/caseFigures'
import {
  CONSPICUITY_SET,
  SIGNAL_LATER_DEMONSTRATION_OBLIQUITY,
  TRUNCATION_EXAMPLE,
  TWO_AXIS_EXAMPLE,
} from '../content/teachingFigures'
import {
  dtsAbsenceImages,
  dtsModelProjection,
  modeledCatheterFraction,
} from '../components/figures/DtsAbsenceFigure'
import {
  breathingShare,
  DEPENDENT_OPACITY,
  dependentOpacityImages,
  dependentOpacityPoint,
  MOTION_EXAMPLE,
  motionPlanePixels,
  motionSceneSampler,
  movingSceneSampler,
  posteriorPleura,
  vertebralBodyFront,
} from '../components/figures/simulatedFindings'
import {
  AXIAL_VIEW,
  axialPixelOf,
  conspicuityImages,
  targetRay,
  TOOL_VIEW_FRAME,
  toolViews,
  truncationModel,
  twoAxisModel,
} from '../components/figures/teachingFigureModel'
import { DTS_PLANE, priorPlanePoint } from '../components/suite/dtsModel'
import { rayThrough, suiteFrame } from '../components/suite/suiteModel'
import { sampleAnatomy } from '../lib/anatomy'
import {
  ctSampler,
  projectCt,
  projectionDisplay,
  projectionPixelOf,
  projectionPixels,
} from '../lib/ctProjection'
import { teachingDemonstration } from '../content/teachingExamples'
import { fieldDisplay } from '../lib/fieldDisplay'
import {
  beamDirection,
  collimatedFieldRect,
  DETECTOR_FIELD,
  fieldContextCoverage,
  LESION_CENTER,
  LESION_RADIUS,
  SPINE_COLUMN,
  spineInField,
  windowRelationship,
} from '../lib/physics'
import { rayProfile } from '../lib/rayProfile'
import { RAY_CROSSING_TABLE, tableCrossing } from '../lib/rayCrossingTable'
import {
  beamSource,
  crossingBits,
  crossingFromMm,
  labelStructures,
  pathSegments,
  rayCrossingLabel,
  STRUCTURE_CODE,
  structureAt,
  structuresOnRay,
  type StructureVolume,
} from '../lib/rayStructures'
import {
  ANGLE_EXAMPLES,
  COURSE_NODULE_QUADRANT,
  OBLIQUITY_ALONG_CHEST_WALL,
  obliquityName,
  type ChestWallQuadrant,
} from '../content/angleRules'
import { viewObliquity, WEDGE_CONTROL } from '../engine/labMetrics'

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
      // Frontally the ray still leans toward the patient's left (image right): it diverges from a
      // source under the isocentre to a lesion left of it. PR #279's sanity review (F1) found the
      // figure drawing this line vertical, which is the beam direction, not the ray it measured.
      if (line.obliquity === 0) expect(tx).toBeGreaterThan(lx + 1)
    }
  })

  it('draws each beam as the axial projection of the exact ray its path lengths were measured on (F1)', () => {
    const model = twoAxisModel(volume)
    const sample = ctSampler(volume)
    const sampleHu = (point: readonly number[]) => sample(point[0], point[1], point[2])
    const measure = (from: readonly number[], to: readonly number[]) =>
      Math.round(
        rayProfile(volume, from as [number, number, number], to as [number, number, number], {
          stepMm: 1,
          sampleHu,
        }).tissueMm.soft,
      )
    const cross = (
      [ax, ay]: readonly number[],
      [bx, by]: readonly number[],
      [cx, cy]: readonly number[],
    ) => Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / Math.hypot(bx - ax, by - ay)
    expect(model.lines.map((line) => line.obliquity)).toEqual([...TWO_AXIS_EXAMPLE.candidates])
    for (const line of model.lines) {
      const printed = model.strip.find((ray) => ray.obliquity === line.obliquity)!
      // One geometry: the line is drawn from the very object the strip row was measured along.
      expect(line.ray).toBe(printed.geometry)

      // That object is the suite's actual source → lesion → detector ray, not a parallel beam.
      const frame = suiteFrame(line.obliquity, 0)
      const actual = rayThrough(frame, LESION_CENTER)
      expect(line.ray.source).toEqual(frame.source)
      expect(line.ray.target).toEqual(LESION_CENTER)
      expect(line.ray.hit).toEqual(actual.hit)

      // Measuring along it again gives exactly the numbers the strip prints.
      expect(measure(line.ray.source, line.ray.target)).toBe(printed.tubeSide.soft)
      expect(measure(line.ray.target, line.ray.hit)).toBe(printed.detectorSide.soft)

      // The ray is three-dimensional: it leaves the source at the isocentre's height and reaches
      // the lesion 30 mm lower, so it lies in no single axial slice. The figure draws its
      // projection (z dropped), which is what these pixel positions are.
      expect(line.ray.source[2]).not.toBeCloseTo(line.ray.target[2], 0)
      expect(line.sourcePx).toEqual(axialPixelOf(line.ray.source[0], line.ray.source[1]))
      expect(line.targetPx).toEqual(axialPixelOf(LESION_CENTER[0], LESION_CENTER[1]))
      expect(line.hitPx).toEqual(axialPixelOf(line.ray.hit[0], line.ray.hit[1]))

      // Source, lesion, hit and both drawn endpoints are collinear on the image.
      for (const point of [line.targetPx, line.from, line.to])
        expect(cross(line.sourcePx, line.hitPx, point)).toBeLessThan(1e-6)
      // In order along the ray: source, tube end, lesion, detector end, hit.
      const along = (point: readonly number[]) =>
        ((point[0] - line.sourcePx[0]) * (line.hitPx[0] - line.sourcePx[0]) +
          (point[1] - line.sourcePx[1]) * (line.hitPx[1] - line.sourcePx[1])) /
        Math.hypot(line.hitPx[0] - line.sourcePx[0], line.hitPx[1] - line.sourcePx[1]) ** 2
      const order = [line.sourcePx, line.from, line.targetPx, line.to, line.hitPx].map(along)
      expect([...order].sort((a, b) => a - b)).toEqual(order)
      // The source and the hit lie off the image; the drawn ends are its edges, less the margin.
      for (const off of [line.sourcePx, line.hitPx])
        expect(off.some((value) => value < 0 || value > AXIAL_VIEW.sizePx)).toBe(true)
      for (const end of [line.from, line.to])
        for (const value of end) {
          expect(value).toBeGreaterThanOrEqual(3 - 1e-9)
          expect(value).toBeLessThanOrEqual(AXIAL_VIEW.sizePx - 3 + 1e-9)
        }

      // Its angle on the image differs from the parallel beam's by a few degrees (the caption's
      // claim), because the rays diverge from the source and the lesion is off the isocentre.
      const beam = beamDirection(line.obliquity, 0)
      const drawn = [line.to[0] - line.from[0], -(line.to[1] - line.from[1])]
      const degrees =
        (Math.acos(
          (drawn[0] * beam[0] + drawn[1] * beam[1]) /
            (Math.hypot(drawn[0], drawn[1]) * Math.hypot(beam[0], beam[1])),
        ) *
          180) /
        Math.PI
      expect(degrees).toBeGreaterThan(3)
      expect(degrees).toBeLessThan(10)
    }
    // Frontally the reviewer measured about 6.9° between the parallel beam and the true ray.
    const frontal = model.lines.find((line) => line.obliquity === 0)!
    const lean =
      (Math.atan2(frontal.to[0] - frontal.from[0], frontal.from[1] - frontal.to[1]) * 180) / Math.PI
    expect(lean).toBeCloseTo((Math.atan2(85, 700) * 180) / Math.PI, 1)
  })

  it('fits both tool views in their frame at one shared scale and anchor (F4)', () => {
    const { alignment, advancement } = twoAxisModel(volume).toolViews
    // One scale and one tip position for both views, so their lengths compare directly.
    expect(alignment.scale).toBe(advancement.scale)
    expect([alignment.lesion.x, alignment.lesion.y]).toEqual([
      advancement.lesion.x,
      advancement.lesion.y,
    ])
    // The same views computed on their own agree: nothing depends on the CT or on the caller.
    expect(
      toolViews([TWO_AXIS_EXAMPLE.alignmentObliquity, TWO_AXIS_EXAMPLE.chosenObliquity]),
    ).toEqual([alignment, advancement])
    const { width, height, marginPx } = TOOL_VIEW_FRAME
    for (const view of [alignment, advancement]) {
      // Every projected tool endpoint and each lesion circle lie inside the frame's margin: no
      // part of either tool is clipped (the side-on tool used to start about 30 units off-frame).
      for (const [x, y] of [view.from, view.to]) {
        expect(x).toBeGreaterThanOrEqual(marginPx - 1e-9)
        expect(x).toBeLessThanOrEqual(width - marginPx + 1e-9)
        expect(y).toBeGreaterThanOrEqual(marginPx - 1e-9)
        expect(y).toBeLessThanOrEqual(height - marginPx + 1e-9)
      }
      expect(view.lesion.x - view.lesion.r).toBeGreaterThanOrEqual(marginPx - 1e-9)
      expect(view.lesion.x + view.lesion.r).toBeLessThanOrEqual(width - marginPx + 1e-9)
      expect(view.lesion.y - view.lesion.r).toBeGreaterThanOrEqual(marginPx - 1e-9)
      expect(view.lesion.y + view.lesion.r).toBeLessThanOrEqual(height - marginPx + 1e-9)
    }
    // The drawn lengths keep the model's ratio: presentation only, no geometry change.
    const drawnLength = (view: typeof alignment) =>
      Math.hypot(view.to[0] - view.from[0], view.to[1] - view.from[1])
    const alignmentFrame = suiteFrame(TWO_AXIS_EXAMPLE.alignmentObliquity, 0)
    const advancementFrame = suiteFrame(TWO_AXIS_EXAMPLE.chosenObliquity, 0)
    const start: [number, number, number] = [
      LESION_CENTER[0] - TWO_AXIS_EXAMPLE.toolLengthMm,
      LESION_CENTER[1],
      LESION_CENTER[2],
    ]
    const detectorLength = (frame: typeof alignmentFrame) => {
      const [a, b] = [rayThrough(frame, start).uv, rayThrough(frame, LESION_CENTER).uv]
      return Math.hypot(a[0] - b[0], a[1] - b[1])
    }
    expect(drawnLength(alignment) / drawnLength(advancement)).toBeCloseTo(
      detectorLength(alignmentFrame) / detectorLength(advancementFrame),
      9,
    )
    expect(drawnLength(advancement)).toBeCloseTo(
      detectorLength(advancementFrame) * advancement.scale,
      9,
    )
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

  it('the later demonstration’s angle redistributes the overlap rather than shortening it, as the note says', () => {
    // PR #279 sanity review: the conspicuity set's −20° and the section's later −35°
    // demonstration are different examples, not a contradiction. The note under the set says so;
    // this holds its second half to the CT.
    expect(SIGNAL_LATER_DEMONSTRATION_OBLIQUITY).toBe(-35)
    const frontal = targetRay(volume, 0, 0)
    const later = targetRay(volume, SIGNAL_LATER_DEMONSTRATION_OBLIQUITY, 0)
    // The detector-side stretch falls and the tube-side stretch grows, by tens of millimetres...
    expect(later.detectorSide.soft).toBeLessThan(frontal.detectorSide.soft - 30)
    expect(later.tubeSide.soft).toBeGreaterThan(frontal.tubeSide.soft + 30)
    // ...while the whole ray crosses about as much as it did frontally.
    expect(Math.abs(later.softTotal - frontal.softTotal)).toBeLessThanOrEqual(10)
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
  it('the window partly intersects the lesion and the tip lies beyond it', () => {
    const readouts = samplingCaseReadouts()
    expect(readouts).toMatchObject({ intersects: true, full: false, tipInside: false })
    expect(readouts.label).toBe('Sampling window partly intersects the lesion')
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

/*
 * Owner's teaching, 2026-10-11 (collimation). The section says that closing the field until the
 * spine is outside it lets the display range work on the lung, and its readout says when the spine
 * is in the field. Both are claims about this CT at this section's projection, held here.
 */
describe('collimating the spine out of the field, on the teaching CT', () => {
  /** The collimation section's projection. */
  const ORBIT = 25

  it('the authored vertebral column is where the CT has its midline bone', () => {
    const sample = ctSampler(volume)
    for (const z of [-90, -30, 30, 90]) {
      let sumX = 0
      let sumY = 0
      let count = 0
      for (let x = -45; x <= 45; x += 2)
        for (let y = -170; y <= -20; y += 2)
          if (sample(x, y, z) > 200) {
            sumX += x
            sumY += y
            count++
          }
      expect(count).toBeGreaterThan(50)
      expect(Math.abs(sumX / count - SPINE_COLUMN.x)).toBeLessThan(10)
      expect(Math.abs(sumY / count - SPINE_COLUMN.y)).toBeLessThan(25)
    }
  })

  it('the spine is in the open field and leaves it a little under half width', () => {
    expect(spineInField(100)).toBe(true)
    expect(spineInField(70)).toBe(true)
    const widths = Array.from({ length: 71 }, (_, i) => 100 - i)
    const firstOut = widths.find((width) => !spineInField(width))!
    expect(firstOut).toBeGreaterThanOrEqual(42)
    expect(firstOut).toBeLessThanOrEqual(50)
    // Once out it stays out as the field closes further.
    for (const width of widths.filter((w) => w <= firstOut)) expect(spineInField(width)).toBe(false)
  })

  it('the worked examples show what their captions say', () => {
    const examples = teachingDemonstration('field')!.examples
    const value = (title: string) =>
      Number(examples.find((example) => example.title === title)!.values.field)
    const open = value('Baseline · full acquisition field')
    const path = value('Physical collimation')
    const lesion = value('Collimated to the lesion · spine out of the field')
    expect([spineInField(open), fieldContextCoverage(open)]).toEqual([true, true])
    expect([spineInField(path), fieldContextCoverage(path)]).toEqual([true, true])
    expect(spineInField(lesion)).toBe(false)
  })

  it('with the spine out, the display range is spent on a much narrower span of the image', () => {
    const size = 96
    const projection = projectCt(ctSampler(volume), {
      orbit: ORBIT,
      tilt: 0,
      sizePx: size,
      fieldMm: DETECTOR_FIELD,
      centre: [0, 0, 0],
    })
    const gray = Uint8Array.from(projection.lineIntegral, (value) =>
      Math.round(projectionDisplay(value) * 255),
    )
    const display = (width: number) => {
      const rect = collimatedFieldRect(width, ORBIT, 0)
      return fieldDisplay(
        gray,
        size,
        {
          left: (rect.left + DETECTOR_FIELD / 2) / DETECTOR_FIELD,
          top: (DETECTOR_FIELD / 2 - (rect.bottom + rect.side)) / DETECTOR_FIELD,
          size: rect.side / DETECTOR_FIELD,
        },
        (width / 100) ** 2,
      )
    }
    const open = display(100)
    const forPath = display(80)
    const atLesion = display(40)
    expect(open.gain).toBeCloseTo(1, 6)
    // Narrowing for the tool path helps a little; taking the spine out helps a lot.
    expect(forPath.gain).toBeGreaterThan(1)
    expect(forPath.gain).toBeLessThan(1.5)
    expect(atLesion.gain).toBeGreaterThan(1.8)
    expect(atLesion.window[1]).toBeLessThan(open.window[1])
  })
})

describe('the simulated dependent opacity is where gravity puts it, and covers the check’s nodule', () => {
  const gray = (pixels: Uint8ClampedArray, col: number, row: number) =>
    pixels[(row * DEPENDENT_OPACITY.sizePx + col) * 4]
  /** Mean gray of the pixels whose distance from the nodule's centre lies in a ring, in mm. */
  const ring = (
    pixels: Uint8ClampedArray,
    centre: readonly [number, number],
    innerMm: number,
    outerMm: number,
  ) => {
    let sum = 0
    let count = 0
    for (let row = 0; row < DEPENDENT_OPACITY.sizePx; row++)
      for (let col = 0; col < DEPENDENT_OPACITY.sizePx; col++) {
        const [x, y] = dependentOpacityPoint(col, row)
        const d = Math.hypot(x - centre[0], y - centre[1])
        if (d < innerMm || d > outerMm) continue
        sum += gray(pixels, col, row)
        count++
      }
    return sum / count
  }

  it('finds the posterior pleura of the left lower lobe, and puts the nodule just in front of it', () => {
    const { sliceZ, nodule } = DEPENDENT_OPACITY
    const pleura = posteriorPleura(ctSampler(volume), nodule.xMm, sliceZ)!
    expect(pleura).not.toBeNull()
    // Behind it is chest wall, in front of it aerated lung.
    expect(sampleAnatomy(volume, [nodule.xMm, pleura - 12, sliceZ])).toBeGreaterThan(-300)
    expect(sampleAnatomy(volume, [nodule.xMm, pleura + 25, sliceZ])).toBeLessThan(-700)
    const images = dependentOpacityImages(volume)
    expect(images.noduleMm).toEqual([nodule.xMm, pleura + nodule.fromPleuraMm])
    // The level is clear of the course's own nodule, so only one lesion is on the image.
    expect(Math.abs(sliceZ - LESION_CENTER[2])).toBeGreaterThan(LESION_RADIUS + 8)
  })

  it('the nodule is distinct on the planning image and covered on the current one', () => {
    const images = dependentOpacityImages(volume)
    const centre = images.noduleMm!
    // Against the lung beside and behind it, at its own depth: the opacity thins toward the front.
    const beside: [number, number] = [centre[0], centre[1] - 3]
    const contrast = (pixels: Uint8ClampedArray) =>
      ring(pixels, centre, 0, 3) - ring(pixels, beside, 9, 11)
    expect(contrast(images.planning)).toBeGreaterThan(80)
    expect(Math.abs(contrast(images.current))).toBeLessThan(12)
    expect(images.noduleCover).toBeGreaterThan(0.95)
  })

  it('the opacity is posterior and bilateral, and nothing else on the image changes', () => {
    const images = dependentOpacityImages(volume)
    const size = DEPENDENT_OPACITY.sizePx
    const changed = { left: 0, right: 0, anterior: 0 }
    let highest = -Infinity
    for (let row = 0; row < size; row++)
      for (let col = 0; col < size; col++) {
        const delta = gray(images.current, col, row) - gray(images.planning, col, row)
        // The opacity only ever adds density.
        expect(delta).toBeGreaterThanOrEqual(0)
        if (delta < 20) continue
        const [x, y] = dependentOpacityPoint(col, row)
        highest = Math.max(highest, y)
        if (y > -40) changed.anterior++
        else if (x > 0) changed.left++
        else changed.right++
      }
    expect(changed.left).toBeGreaterThan(400)
    expect(changed.right).toBeGreaterThan(400)
    expect(changed.anterior).toBe(0)
    // It reaches forward a few centimetres from the posterior pleura, no further.
    const pleura = posteriorPleura(
      ctSampler(volume),
      DEPENDENT_OPACITY.nodule.xMm,
      DEPENDENT_OPACITY.sliceZ,
    )!
    expect(highest - pleura).toBeLessThan(DEPENDENT_OPACITY.reachMm + 25)
  })
})

describe('the simulated motion doubles what breathing moves, and nothing else', () => {
  const y = MOTION_EXAMPLE.planes.coronalY
  /** Local maxima of a profile sampled every `stepMm`, above a floor. */
  const peaks = (values: readonly number[], floor: number) =>
    values.flatMap((value, i) =>
      value > floor && value > (values[i - 1] ?? -Infinity) && value >= (values[i + 1] ?? -Infinity)
        ? [i]
        : [],
    )

  it('the catheter runs to the nodule and appears once at rest, twice during breathing', () => {
    const scene = motionSceneSampler(ctSampler(volume))
    const moving = movingSceneSampler(scene)
    const [, , tip] = MOTION_EXAMPLE.catheter.path
    expect(
      Math.hypot(tip[0] - LESION_CENTER[0], tip[1] - LESION_CENTER[1], tip[2] - LESION_CENTER[2]),
    ).toBeLessThan(MOTION_EXAMPLE.nodule.radiusMm)
    // A craniocaudal line across the catheter's distal third, where the lung moves most.
    const x = 66
    const step = 0.25
    const zs = Array.from({ length: 160 }, (_, i) => -45 + i * step)
    const still = peaks(
      zs.map((z) => scene(x, y, z)),
      -500,
    )
    const doubled = peaks(
      zs.map((z) => moving(x, y, z)),
      -500,
    )
    expect(still).toHaveLength(1)
    expect(doubled).toHaveLength(2)
    const apart = (doubled[1] - doubled[0]) * step
    // "A few millimetres apart": about twice the amplitude, along the line.
    expect(apart).toBeGreaterThan(4)
    expect(apart).toBeLessThan(9)
  })

  it('the nodule’s margin is drawn at two positions, a few millimetres apart', () => {
    // In uniform lung, so the measurement is of the nodule's solid edge alone: the CT's own
    // part-solid halo around it is soft, and would blur where each edge is.
    const scene = motionSceneSampler(() => -850)
    const moving = movingSceneSampler(scene)
    const step = 0.25
    const zs = Array.from({ length: 240 }, (_, i) => -60 + i * step)
    // Where at least a third of the spin saw the nodule.
    const floor = -850 + (MOTION_EXAMPLE.nodule.hu + 850) / 3
    const extent = (sample: (x: number, y: number, z: number) => number) =>
      zs.filter((z) => sample(LESION_CENTER[0], y, z) > floor).length * step
    expect(extent(scene)).toBeCloseTo(2 * MOTION_EXAMPLE.nodule.radiusMm, 0)
    const widened = extent(moving) - extent(scene)
    expect(widened).toBeGreaterThan(4)
    expect(widened).toBeLessThan(9)
    // And in the middle, where both positions overlap, it is as dense as at rest.
    const [cx, cy, cz] = LESION_CENTER
    expect(moving(cx, cy, cz)).toBeCloseTo(scene(cx, cy, cz), 0)
  })

  it('the spine and the posterior chest wall do not move, so they stay sharp', () => {
    expect(breathingShare(-130, -30)).toBe(0)
    expect(breathingShare(-20, -30)).toBeGreaterThan(0.9)
    const scene = motionSceneSampler(ctSampler(volume))
    const moving = movingSceneSampler(scene)
    for (const [px, py, pz] of [
      [0, -135, -30],
      [20, -140, 10],
      [-60, -150, -52],
    ])
      expect(moving(px, py, pz)).toBeCloseTo(scene(px, py, pz), 6)
  })

  it('draws three different planes, each changed by the motion', () => {
    for (const plane of ['coronal', 'sagittal', 'axial'] as const) {
      const still = motionPlanePixels(volume, plane, { moving: false })
      const moved = motionPlanePixels(volume, plane)
      let differing = 0
      for (let i = 0; i < still.length; i += 4) if (Math.abs(still[i] - moved[i]) > 12) differing++
      expect(differing).toBeGreaterThan(300)
    }
  })
})

describe('the anatomy-over-the-nodule readout reads the CT', () => {
  let structures: StructureVolume
  beforeAll(() => {
    structures = labelStructures(volume)
  })

  it('labels the heart, the lung, the chest wall, the abdomen and the spine where the CT has them', () => {
    const code = (point: [number, number, number]) => structureAt(structures, point)
    // Heart and mediastinum at and above the level of the nodule.
    expect(code([0, 40, -10])).toBe(STRUCTURE_CODE.mediastinum)
    expect(code([20, 30, 0])).toBe(STRUCTURE_CODE.mediastinum)
    // Aerated lung on both sides, including the left lower lobe between the nodule and its dome.
    expect(code([-100, -20, 20])).toBe(STRUCTURE_CODE.lung)
    expect(code([85, -20, -60])).toBe(STRUCTURE_CODE.lung)
    // Lateral chest wall is neither mediastinum nor abdomen.
    expect(code([-160, 0, 0])).toBe(STRUCTURE_CODE.soft)
    // Liver under the right dome and the upper abdomen under the left.
    expect(code([-80, -20, -100])).toBe(STRUCTURE_CODE.diaphragm)
    expect(code([80, -60, -100])).toBe(STRUCTURE_CODE.diaphragm)
    // The cardiac apex sits on the left dome with lung only above it; it is not abdomen.
    expect(code([100, 80, -33])).not.toBe(STRUCTURE_CODE.diaphragm)
    // Bone in the vertebral column is spine, bone in the posterior chest wall is rib.
    let spine = 0
    for (let y = -125; y <= -75; y++) if (code([0, y, 0]) === STRUCTURE_CODE.spine) spine++
    expect(spine).toBeGreaterThan(5)
    expect(code([71, -133, -25])).toBe(STRUCTURE_CODE.rib)
  })

  it('bakes every whole-degree view of the table from this atlas', () => {
    expect(RAY_CROSSING_TABLE.atlasSha256).toBe(metadata.atlasSha256)
    expect(RAY_CROSSING_TABLE.target).toEqual(LESION_CENTER)
    const { obliquity, tilt, rows } = RAY_CROSSING_TABLE
    expect(rows).toHaveLength(tilt.max - tilt.min + 1)
    let mismatches = 0
    for (let t = tilt.min; t <= tilt.max; t++) {
      expect(rows[t - tilt.min]).toHaveLength(obliquity.max - obliquity.min + 1)
      for (let o = obliquity.min; o <= obliquity.max; o++) {
        const live = crossingBits(crossingFromMm(structuresOnRay(structures, o, t)))
        if (live !== Number.parseInt(rows[t - tilt.min][o - obliquity.min], 16)) mismatches++
      }
    }
    expect(mismatches).toBe(0)
  }, 60_000)

  it('frontally the nodule lies over the heart; the two-axis example’s obliquity clears it', () => {
    expect(tableCrossing(0, 0).mediastinum).toBe(true)
    expect(tableCrossing(TWO_AXIS_EXAMPLE.chosenObliquity, 0).mediastinum).toBe(false)
  })

  it('a 3° nudge of beam tilt moves a rib onto or off the nodule', () => {
    // Frontally the path through the nodule crosses a posterior rib; 3° caudal takes it off.
    expect(tableCrossing(0, 0).rib).toBe(true)
    expect(tableCrossing(0, -3).rib).toBe(false)
  })

  it('caudal angulation steep enough to clear the heart brings the diaphragm over the nodule', () => {
    expect(tableCrossing(0, -6).mediastinum).toBe(false)
    expect(tableCrossing(0, -6).diaphragm).toBe(true)
    expect(tableCrossing(0, 0).diaphragm).toBe(false)
  })
})

describe('the nudge: what cranial or caudal angulation does to a nodule relative to the ribs', () => {
  /*
   * +v on the detector is superior on the monitor: the DRR's V axis is the physics v (pinned in
   * suiteModel.test.ts against FluoroView's detector frame) and the overlays draw 256 − v. Positive
   * tilt is cranial (detector toward the head). So the rule a fellow can use at the table is the
   * sign of how far the nodule moves against a rib behind it and a rib in front of it.
   */
  const firstBoneAlongFrontalRay = (sign: 1 | -1) => {
    const { source } = rayThrough(suiteFrame(0, 0), LESION_CENTER)
    const delta = LESION_CENTER.map((n, i) => n - source[i])
    const length = Math.hypot(...delta)
    const direction = delta.map((n) => n / length)
    let run = 0
    for (let s = LESION_RADIUS + 1; s < 220; s += 0.5) {
      const point = LESION_CENTER.map((n, i) => n + sign * direction[i] * s) as [
        number,
        number,
        number,
      ]
      if (sampleAnatomy(volume, point) > 200) {
        if (++run >= 8) return point
      } else run = 0
    }
    return null
  }
  const nearestAnteriorRib = () => {
    const { source } = rayThrough(suiteFrame(0, 0), LESION_CENTER)
    const delta = LESION_CENTER.map((n, i) => n - source[i])
    let best: { point: [number, number, number]; distance: number } | null = null
    for (let x = 80; x <= 140; x += 1)
      for (let y = 60; y <= 130; y += 1)
        for (let z = -70; z <= 10; z += 1) {
          if (sampleAnatomy(volume, [x, y, z]) <= 200) continue
          const t = (y - LESION_CENTER[1]) / delta[1]
          const distance = Math.hypot(
            x - (LESION_CENTER[0] + delta[0] * t),
            z - (LESION_CENTER[2] + delta[2] * t),
          )
          if (!best || distance < best.distance) best = { point: [x, y, z], distance }
        }
    return best
  }
  const relative = (rib: [number, number, number], tilt: number) =>
    rayThrough(suiteFrame(0, tilt), LESION_CENTER).uv[1] -
    rayThrough(suiteFrame(0, tilt), rib).uv[1]

  it('caudal moves the nodule up against the rib behind it, and down against a rib in front of it', () => {
    const behind = firstBoneAlongFrontalRay(-1)
    const front = nearestAnteriorRib()
    expect(behind).not.toBeNull()
    expect(front).not.toBeNull()
    if (!behind || !front) return
    // Both are ribs, not the vertebral column, one behind the nodule and one in front of it.
    for (const rib of [behind, front.point])
      expect(Math.abs(rib[0] - SPINE_COLUMN.x)).toBeGreaterThan(SPINE_COLUMN.halfWidth)
    expect(behind[1]).toBeLessThan(LESION_CENTER[1])
    expect(front.point[1]).toBeGreaterThan(LESION_CENTER[1])
    // The anterior rib beside the nodule's projection, not one a rib space away.
    expect(front.distance).toBeLessThan(15)
    // 3° caudal: the nodule rises against the posterior rib, by most of a rib's projected height.
    expect(relative(behind, -3) - relative(behind, 0)).toBeGreaterThan(8)
    // and drops against the anterior rib; cranial reverses both.
    expect(relative(front.point, -3) - relative(front.point, 0)).toBeLessThan(-5)
    expect(relative(behind, 3) - relative(behind, 0)).toBeLessThan(-8)
    expect(relative(front.point, 3) - relative(front.point, 0)).toBeGreaterThan(5)
  })
})

describe('a wedge under the nodule side lifts it out of the dependent lung', () => {
  it('draws the equator level with the front of the vertebral body', () => {
    const supine = dependentOpacityImages(volume)
    const front = vertebralBodyFront(ctSampler(volume), DEPENDENT_OPACITY.sliceZ)
    expect(front).not.toBeNull()
    expect(supine.equatorPx).not.toBeNull()
    const [, equatorY] = dependentOpacityPoint(0, supine.equatorPx! - 0.5)
    expect(Math.abs(equatorY - front!)).toBeLessThan(1)
    // The vertebral body sits behind the lungs' front and in front of their dependent bases.
    expect(front!).toBeLessThan(-50)
    expect(front!).toBeGreaterThan(-90)
  })

  it('supine, the check’s nodule lies in the opacity; wedged 30°, it lies above the equator and clear of it', () => {
    const supine = dependentOpacityImages(volume)
    const wedged = dependentOpacityImages(volume, { wedgeDeg: 30 })
    expect(supine.noduleCover).toBeGreaterThan(0.9)
    expect(wedged.noduleCover).toBeLessThan(0.1)
    expect(wedged.nodule!.y).toBeLessThan(wedged.equatorPx!)
    expect(supine.nodule!.y).toBeGreaterThan(supine.equatorPx!)
  })

  it('a 15° wedge under the left side and LAO 9° give the clear LAO 24° view', () => {
    const { wedge, orbit } = ANGLE_EXAMPLES.wedge
    expect(viewObliquity(orbit, wedge)).toBe(ANGLE_EXAMPLES.clearOblique.obliquity)
    expect(Math.abs(orbit)).toBeLessThanOrEqual(ANGLE_EXAMPLES.runThroughOrbitLimit)
    expect(WEDGE_CONTROL.options?.some((option) => option.value === wedge)).toBe(true)
  })

  it('moves the opacity into the lung that is now lowest', () => {
    const wedged = dependentOpacityImages(volume, { wedgeDeg: 30 })
    const { sizePx } = wedged
    const changed = { left: 0, right: 0 }
    for (let row = 0; row < sizePx; row++)
      for (let col = 0; col < sizePx; col++) {
        const i = (row * sizePx + col) * 4
        if (wedged.current[i] - wedged.planning[i] > 20)
          changed[col < sizePx / 2 ? 'right' : 'left']++
      }
    // The image shows the patient's right on the left; lifting the left side drops the right lung.
    expect(changed.right).toBeGreaterThan(1.5 * changed.left)
  })
})

describe('the angle rules the expert session taught, held to this CT and this convention', () => {
  /*
   * Expert-session round, part 2: the educators' slides confirmed each rule below. The angles are
   * this CT's own; positive obliquity is RAO (detector toward the patient's right) and positive tilt
   * is cranial (detector toward the head), as the monitor caption and the glossary state.
   */
  let structures: StructureVolume
  beforeAll(() => {
    structures = labelStructures(volume)
  })
  const clear = (obliquity: number, tilt: number) =>
    rayCrossingLabel(tableCrossing(obliquity, tilt)) === 'Lung only'

  it('a beam along the chest wall at the nodule: left anterior or right posterior is RAO, right anterior or left posterior LAO', () => {
    const normals: Record<ChestWallQuadrant, [number, number]> = {
      'left anterior': [1, 1],
      'left posterior': [1, -1],
      'right anterior': [-1, 1],
      'right posterior': [-1, -1],
    }
    for (const [quadrant, [left, anterior]] of Object.entries(normals) as [
      ChestWallQuadrant,
      [number, number],
    ][]) {
      const side = OBLIQUITY_ALONG_CHEST_WALL[quadrant]
      const beam = beamDirection(side === 'RAO' ? 45 : -45, 0)
      // The beam runs along the chest wall: square to the outward normal at the nodule.
      expect(Math.abs(beam[0] * left + beam[1] * anterior)).toBeLessThan(1e-9)
      // The opposite side's 45° view crosses the chest wall instead.
      const other = beamDirection(side === 'RAO' ? -45 : 45, 0)
      expect(Math.abs(other[0] * left + other[1] * anterior)).toBeGreaterThan(1)
    }
  })

  it('the course nodule is left posterior: left of the spine, with the heart in front of it', () => {
    expect(COURSE_NODULE_QUADRANT).toBe('left posterior')
    expect(LESION_CENTER[0]).toBeGreaterThan(SPINE_COLUMN.x + SPINE_COLUMN.halfWidth)
    let first: number | null = null
    for (let y = LESION_CENTER[1] + LESION_RADIUS + 1; y < 140 && first === null; y++) {
      const code = structureAt(structures, [LESION_CENTER[0], y, LESION_CENTER[2]])
      if (code !== STRUCTURE_CODE.lung) first = code
    }
    expect(first).toBe(STRUCTURE_CODE.mediastinum)
  })

  it('read the obliquity off the axial: only the LAO side clears the heart, and LAO 24° leaves lung only', () => {
    for (let obliquity = 0; obliquity <= 75; obliquity++)
      expect(tableCrossing(obliquity, 0).mediastinum).toBe(true)
    const { obliquity, tilt } = ANGLE_EXAMPLES.clearOblique
    expect(clear(obliquity, tilt)).toBe(true)
    expect(obliquityName(obliquity)).toBe('LAO 24°')
  })

  it('read the tilt off the sagittal: straight on, cranial clears the heart; caudal only trades it for the diaphragm', () => {
    const { obliquity, tilt } = ANGLE_EXAMPLES.cranialFrontal
    for (const t of [tilt, tilt + 1, tilt + 2]) expect(clear(obliquity, t)).toBe(true)
    for (let t = -25; t < 0; t++) {
      const crossing = tableCrossing(obliquity, t)
      expect(crossing.mediastinum || crossing.diaphragm).toBe(true)
    }
    expect(tableCrossing(obliquity, -6).diaphragm).toBe(true)
  })

  it('the nudge at LAO 20°: a posterior rib lies over the nodule, and 3° cranial takes it off', () => {
    const { obliquity, tilt } = ANGLE_EXAMPLES.ribOblique
    expect(obliquity).toBe(TWO_AXIS_EXAMPLE.chosenObliquity)
    expect(rayCrossingLabel(tableCrossing(obliquity, tilt))).toBe('Rib')
    expect(rayCrossingLabel(tableCrossing(obliquity, tilt - 2))).toBe('Rib')
    for (let t = 2; t <= 4; t++) expect(clear(obliquity, t)).toBe(true)
    expect(clear(obliquity, ANGLE_EXAMPLES.ribNudgeTilt)).toBe(true)
    // The rib lies behind the nodule, on the tube side of the path: a posterior rib.
    const source = beamSource(obliquity, tilt)
    const detector = source.map((n, i) => n + (LESION_CENTER[i] - n) * 3) as [
      number,
      number,
      number,
    ]
    const distance = (point: readonly number[]) => Math.hypot(...point.map((n, i) => n - source[i]))
    const rib = pathSegments(structures, source, detector).find((segment) => segment.kind === 'rib')
    expect(rib).toBeDefined()
    expect(distance(rib!.end)).toBeLessThan(distance(LESION_CENTER) - LESION_RADIUS)
  })
})
