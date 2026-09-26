/**
 * The numbers and pixels behind the Prompt 04 teaching figures, as pure functions of the teaching
 * CT. The components draw what these return and print what these compute, so a caption cannot
 * drift from its image; `model-truth.test.ts` runs the same functions on the real CT.
 */
import {
  CONSPICUITY_SET,
  TRUNCATION_EXAMPLE,
  TWO_AXIS_EXAMPLE,
} from '../../content/teachingFigures'
import {
  collimatedField,
  ctSampler,
  projectCt,
  projectionDisplay,
  projectionPixelOf,
  projectionPixels,
  type CtSampler,
} from '../../lib/ctProjection'
import {
  beamDirection,
  DEFAULT_GEOMETRY,
  LESION_CENTER,
  LESION_RADIUS,
  magnificationAt,
  projectToDetector,
  type Point3,
} from '../../lib/physics'
import { rayProfile } from '../../lib/rayProfile'
import {
  addUniformVeil,
  matchMeanBrightness,
  meanBrightness,
  simulateQuantumNoise,
} from '../../lib/teachingSignal'
import { priorPlaneGray } from '../suite/dtsModel'
import { rayThrough, suiteFrame } from '../suite/suiteModel'

/* ------------------------------------------------------------------ *
 * The target ray, split at the lesion
 * ------------------------------------------------------------------ */

export interface RaySide {
  /** Millimetres of soft-tissue-like, bone-like and aerated-lung-like CT. */
  readonly soft: number
  readonly bone: number
  readonly lung: number
}

/**
 * The target ray in the suite's own cone geometry: from the X-ray source (focal spot), through the
 * lesion's centre, to where it meets the detector. It diverges from the source, so it is not the
 * parallel beam direction translated through the lesion, and it is not confined to one axial slice.
 */
export interface TargetRayGeometry {
  readonly source: Point3
  readonly target: Point3
  readonly hit: Point3
}

export function targetRayGeometry(obliquity: number, tilt: number): TargetRayGeometry {
  const ray = rayThrough(suiteFrame(obliquity, tilt), LESION_CENTER)
  return { source: ray.source, target: LESION_CENTER, hit: ray.hit }
}

export interface TargetRay {
  readonly obliquity: number
  readonly tilt: number
  /** The ray these path lengths were measured along; a figure that draws the ray draws this one. */
  readonly geometry: TargetRayGeometry
  /** From the X-ray tube to the lesion's centre. */
  readonly tubeSide: RaySide
  /** From the lesion's centre to the detector. */
  readonly detectorSide: RaySide
  /** Soft-tissue-like CT on the whole ray, the lesion itself excluded. */
  readonly softTotal: number
}

function side(profile: ReturnType<typeof rayProfile>): RaySide {
  return {
    soft: Math.round(profile.tissueMm.soft),
    bone: Math.round(profile.tissueMm.bone),
    lung: Math.round(profile.tissueMm.lung),
  }
}

/**
 * The central ray through the modeled lesion at one signed obliquity and tilt, measured with the
 * course's own density classes (`rayProfile`), the lesion itself tagged apart.
 */
export function targetRay(
  volume: Uint8Array,
  obliquity: number,
  tilt: number,
  sample: CtSampler = ctSampler(volume),
): TargetRay {
  const geometry = targetRayGeometry(obliquity, tilt)
  const sampleHu = (point: Point3) => sample(point[0], point[1], point[2])
  const measure = (from: Point3, to: Point3) =>
    side(rayProfile(volume, from, to, { stepMm: 1, sampleHu }))
  const tubeSide = measure(geometry.source, geometry.target)
  const detectorSide = measure(geometry.target, geometry.hit)
  return {
    obliquity,
    tilt,
    geometry,
    tubeSide,
    detectorSide,
    softTotal: tubeSide.soft + detectorSide.soft,
  }
}

/* ------------------------------------------------------------------ *
 * Axial CT through the lesion (Sections 9 and 16)
 * ------------------------------------------------------------------ */

/** A square axial plane of the teaching CT, 360 mm across, radiological display (patient left right, anterior up). */
export const AXIAL_VIEW = { sizePx: 240, spanMm: 360 } as const

export function axialPixelOf(x: number, y: number): [number, number] {
  const scale = AXIAL_VIEW.sizePx / AXIAL_VIEW.spanMm
  return [(x + AXIAL_VIEW.spanMm / 2) * scale, (AXIAL_VIEW.spanMm / 2 - y) * scale]
}

function axialPoint(col: number, row: number): [number, number] {
  const mm = AXIAL_VIEW.spanMm / AXIAL_VIEW.sizePx
  return [(col + 0.5) * mm - AXIAL_VIEW.spanMm / 2, AXIAL_VIEW.spanMm / 2 - (row + 0.5) * mm]
}

export function axialSlicePixels(
  sample: CtSampler,
  z: number,
  keep?: (x: number, y: number) => boolean,
): Uint8ClampedArray {
  const size = AXIAL_VIEW.sizePx
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const [x, y] = axialPoint(col, row)
      const inside = keep ? keep(x, y) : true
      const gray = priorPlaneGray(sample(x, y, z))
      const i = (row * size + col) * 4
      // Outside a modeled reconstruction volume nothing was acquired: drawn as unexposed dark.
      pixels[i] = pixels[i + 1] = pixels[i + 2] = inside ? gray : 12
      pixels[i + 3] = 255
    }
  return pixels
}

export interface AxialRayLine {
  readonly obliquity: number
  /** The 3D ray the line is drawn from: the same geometry its path lengths were measured on. */
  readonly ray: TargetRayGeometry
  /** Where the source, the lesion's centre and the detector hit fall on the axial image (z dropped). */
  readonly sourcePx: [number, number]
  readonly targetPx: [number, number]
  readonly hitPx: [number, number]
  /** The stretch drawn: the projected ray clipped to the image, tube end first. */
  readonly from: [number, number]
  readonly to: [number, number]
}

/**
 * The axial projection of a 3D target ray: its source, the lesion's centre and its detector hit
 * with z dropped, clipped to the image (a margin keeps the detector-end arrowhead in view). The
 * source and the hit lie far outside the image, so the drawn stretch is the part that crosses it.
 * Dropping z is a projection, not a slice: the ray crosses this axial plane only at the lesion.
 */
export function axialRayLine(obliquity: number, ray: TargetRayGeometry): AxialRayLine {
  const sourcePx = axialPixelOf(ray.source[0], ray.source[1])
  const targetPx = axialPixelOf(ray.target[0], ray.target[1])
  const hitPx = axialPixelOf(ray.hit[0], ray.hit[1])
  // Liang–Barsky clip of the projected segment source → hit to the image, less the margin.
  const margin = 3
  const [low, high] = [margin, AXIAL_VIEW.sizePx - margin]
  const d = [hitPx[0] - sourcePx[0], hitPx[1] - sourcePx[1]]
  let [enter, leave] = [0, 1]
  for (const axis of [0, 1]) {
    for (const [p, q] of [
      [-d[axis], sourcePx[axis] - low],
      [d[axis], high - sourcePx[axis]],
    ]) {
      if (p === 0) {
        if (q < 0) throw new Error(`The ray at ${obliquity}° does not cross the axial image`)
        continue
      }
      const t = q / p
      if (p < 0) enter = Math.max(enter, t)
      else leave = Math.min(leave, t)
    }
  }
  if (enter > leave) throw new Error(`The ray at ${obliquity}° does not cross the axial image`)
  const at = (t: number): [number, number] => [sourcePx[0] + d[0] * t, sourcePx[1] + d[1] * t]
  return { obliquity, ray, sourcePx, targetPx, hitPx, from: at(enter), to: at(leave) }
}

/* ------------------------------------------------------------------ *
 * Section 6 · conspicuity set (OD4-06)
 * ------------------------------------------------------------------ */

export interface ConspicuityImages {
  readonly sizePx: number
  readonly reference: Uint8ClampedArray
  readonly noise: Uint8ClampedArray
  readonly scatter: Uint8ClampedArray
  readonly superimposition: Uint8ClampedArray
  /** Where the lesion projects, and how large, in each frame's pixels. */
  readonly lesion: { readonly reference: LesionMark; readonly changed: LesionMark }
  /** The collimated field's edges in pixels (the scatter frame is open). */
  readonly collimatedEdgePx: { readonly low: number; readonly high: number }
  readonly rays: { readonly reference: TargetRay; readonly changed: TargetRay }
}

export interface LesionMark {
  readonly x: number
  readonly y: number
  readonly r: number
}

function lesionMark(
  image: Parameters<typeof projectionPixelOf>[0],
  orbit: number,
  tilt: number,
): LesionMark {
  const [x, y] = projectionPixelOf(image, LESION_CENTER, orbit, tilt)
  const normal = beamDirection(orbit, tilt)
  const depth = LESION_CENTER.reduce((sum, value, i) => sum + value * normal[i], 0)
  const r =
    (LESION_RADIUS * magnificationAt(depth, DEFAULT_GEOMETRY) * image.sizePx) / image.fieldMm
  return { x, y, r }
}

export function conspicuityImages(volume: Uint8Array): ConspicuityImages {
  const sample = ctSampler(volume)
  const { sizePx, frameFieldMm, collimatedFieldMm, referenceView, changedView } = CONSPICUITY_SET
  const reference = projectCt(sample, { ...referenceView, sizePx, fieldMm: frameFieldMm })
  const changed = projectCt(sample, { ...changedView, sizePx, fieldMm: frameFieldMm })
  const { exposed, edgePx } = collimatedField(reference, collimatedFieldMm)
  const noisy = simulateQuantumNoise(reference.lineIntegral, CONSPICUITY_SET.noise)
  const veiled = matchMeanBrightness(
    addUniformVeil(reference.lineIntegral, CONSPICUITY_SET.veil),
    projectionDisplay,
    meanBrightness(reference.lineIntegral, projectionDisplay, exposed),
  )
  return {
    sizePx,
    reference: projectionPixels(reference.lineIntegral, { exposed }),
    noise: projectionPixels(noisy, { exposed }),
    scatter: projectionPixels(veiled),
    superimposition: projectionPixels(changed.lineIntegral, { exposed }),
    lesion: {
      reference: lesionMark(reference, referenceView.orbit, referenceView.tilt),
      changed: lesionMark(changed, changedView.orbit, changedView.tilt),
    },
    collimatedEdgePx: edgePx,
    rays: {
      reference: targetRay(volume, referenceView.orbit, referenceView.tilt, sample),
      changed: targetRay(volume, changedView.orbit, changedView.tilt, sample),
    },
  }
}

/* ------------------------------------------------------------------ *
 * Section 9 · CT → two-axis worked example (OD4-08)
 * ------------------------------------------------------------------ */

/** The frame both tool views are drawn in, in SVG units. */
export const TOOL_VIEW_FRAME = { width: 160, height: 120, marginPx: 10 } as const

export interface ToolView {
  readonly obliquity: number
  /** Projected tool length on the detector, as a fraction of its length seen side-on (0–1). */
  readonly profileFraction: number
  /** Frame units per detector millimetre: one value shared by every view compared. */
  readonly scale: number
  /** Endpoints of the projected tool and the lesion's projected circle, in `TOOL_VIEW_FRAME`. */
  readonly from: [number, number]
  readonly to: [number, number]
  readonly lesion: LesionMark
}

export interface TwoAxisModel {
  readonly axial: Uint8ClampedArray
  readonly lesionAxial: LesionMark
  /** One per candidate beam, each drawn from the strip row that prints its path lengths. */
  readonly lines: readonly AxialRayLine[]
  readonly strip: readonly TargetRay[]
  readonly tilts: readonly TargetRay[]
  /** Largest change in the detector-side soft-tissue path across the tilts checked, in mm. */
  readonly tiltRangeMm: number
  readonly projections: {
    readonly sizePx: number
    readonly before: Uint8ClampedArray
    readonly after: Uint8ClampedArray
    readonly lesionBefore: LesionMark
    readonly lesionAfter: LesionMark
    readonly approachBefore: readonly [[number, number], [number, number]]
    readonly approachAfter: readonly [[number, number], [number, number]]
  }
  readonly toolViews: { readonly alignment: ToolView; readonly advancement: ToolView }
}

/** The modeled tool's approach: its last stretch, ending at the lesion's centre (geometry lab direction). */
function toolEnds(): [Point3, Point3] {
  return [
    [LESION_CENTER[0] - TWO_AXIS_EXAMPLE.toolLengthMm, LESION_CENTER[1], LESION_CENTER[2]],
    LESION_CENTER,
  ]
}

/** The modeled tool projected at one obliquity, in detector millimetres, before any drawing. */
function projectedTool(obliquity: number) {
  const [start, end] = toolEnds()
  const a = projectToDetector(start, obliquity, 0)
  const b = projectToDetector(end, obliquity, 0)
  const length = Math.hypot(a[0] - b[0], a[1] - b[1])
  const normal = beamDirection(obliquity, 0)
  const depthOf = (point: Point3) => point.reduce((sum, value, i) => sum + value * normal[i], 0)
  // Side-on, the whole tool is perpendicular to the beam: its length times the magnification there.
  const sideOnLength =
    TWO_AXIS_EXAMPLE.toolLengthMm * magnificationAt((depthOf(start) + depthOf(end)) / 2)
  const lesionR = LESION_RADIUS * magnificationAt(depthOf(LESION_CENTER))
  return { obliquity, a, b, profileFraction: Math.min(1, length / sideOnLength), lesionR }
}

/**
 * The tool views drawn for comparison, all at one scale and with the tool's tip (the lesion's
 * projected centre) at one place in the frame, so a shorter line means a more foreshortened tool.
 * The scale and that shared anchor are chosen once, from every view together, so the longest
 * projected tool and each lesion circle fit inside the margin. Nothing is fitted per view.
 */
export function toolViews(obliquities: readonly number[]): readonly ToolView[] {
  const tools = obliquities.map(projectedTool)
  // Extents about the tip, detector millimetres, v up.
  const extents = tools.flatMap((tool) => [
    [tool.a[0] - tool.b[0], tool.a[1] - tool.b[1]],
    [-tool.lesionR, -tool.lesionR],
    [tool.lesionR, tool.lesionR],
  ])
  const [minU, maxU] = [
    Math.min(...extents.map((e) => e[0])),
    Math.max(...extents.map((e) => e[0])),
  ]
  const [minV, maxV] = [
    Math.min(...extents.map((e) => e[1])),
    Math.max(...extents.map((e) => e[1])),
  ]
  const { width, height, marginPx } = TOOL_VIEW_FRAME
  const scale = Math.min(
    (width - 2 * marginPx) / (maxU - minU),
    (height - 2 * marginPx) / (maxV - minV),
  )
  // The shared tip position centres the union of every view's extents in the frame.
  const tipX = width / 2 - ((minU + maxU) / 2) * scale
  const tipY = height / 2 + ((minV + maxV) / 2) * scale
  return tools.map((tool) => {
    const frame = (point: readonly [number, number]): [number, number] => [
      tipX + (point[0] - tool.b[0]) * scale,
      tipY - (point[1] - tool.b[1]) * scale,
    ]
    return {
      obliquity: tool.obliquity,
      profileFraction: tool.profileFraction,
      scale,
      from: frame(tool.a),
      to: frame(tool.b),
      lesion: { x: tipX, y: tipY, r: tool.lesionR * scale },
    }
  })
}

function approach(
  image: Parameters<typeof projectionPixelOf>[0],
  orbit: number,
): readonly [[number, number], [number, number]] {
  const [start, end] = toolEnds()
  return [projectionPixelOf(image, start, orbit, 0), projectionPixelOf(image, end, orbit, 0)]
}

export function twoAxisModel(volume: Uint8Array): TwoAxisModel {
  const sample = ctSampler(volume)
  const example = TWO_AXIS_EXAMPLE
  const [lx, ly] = axialPixelOf(LESION_CENTER[0], LESION_CENTER[1])
  const axialScale = AXIAL_VIEW.sizePx / AXIAL_VIEW.spanMm
  const strip = example.stripObliquities.map((obliquity) => targetRay(volume, obliquity, 0, sample))
  const tilts = example.tiltCheck.tilts.map((tilt) =>
    targetRay(volume, example.tiltCheck.obliquity, tilt, sample),
  )
  const detectorSoft = tilts.map((ray) => ray.detectorSide.soft)
  const { sizePx, fieldMm } = example.projection
  const before = projectCt(sample, { orbit: 0, tilt: 0, sizePx, fieldMm })
  const after = projectCt(sample, { orbit: example.chosenObliquity, tilt: 0, sizePx, fieldMm })
  // Each beam line is drawn from the very ray its strip row was measured along.
  const lines = example.candidates.map((obliquity) => {
    const printed = strip.find((ray) => ray.obliquity === obliquity)
    if (!printed) throw new Error(`Candidate beam ${obliquity}° has no row in the strip`)
    return axialRayLine(obliquity, printed.geometry)
  })
  const [alignment, advancement] = toolViews([example.alignmentObliquity, example.chosenObliquity])
  return {
    axial: axialSlicePixels(sample, example.sliceZ),
    lesionAxial: { x: lx, y: ly, r: LESION_RADIUS * axialScale },
    lines,
    strip,
    tilts,
    tiltRangeMm: Math.max(...detectorSoft) - Math.min(...detectorSoft),
    projections: {
      sizePx,
      before: projectionPixels(before.lineIntegral),
      after: projectionPixels(after.lineIntegral),
      lesionBefore: lesionMark(before, 0, 0),
      lesionAfter: lesionMark(after, example.chosenObliquity, 0),
      approachBefore: approach(before, 0),
      approachAfter: approach(after, example.chosenObliquity),
    },
    toolViews: { alignment, advancement },
  }
}

/* ------------------------------------------------------------------ *
 * Section 16 · truncation (OD4-06, D5)
 * ------------------------------------------------------------------ */

export function insideReconstruction(x: number, y: number): boolean {
  const [cx, cy] = TRUNCATION_EXAMPLE.centreMm
  return Math.hypot(x - cx, y - cy) <= TRUNCATION_EXAMPLE.radiusMm
}

export interface TruncationModel {
  readonly axial: Uint8ClampedArray
  readonly lesionAxial: LesionMark
  /** The reconstruction volume's circle in axial pixels. */
  readonly boundary: LesionMark
  /** Share of the lesion's cross-section on this plane that lies inside the volume (0–1). */
  readonly lesionCoveredFraction: number
}

export function truncationModel(volume: Uint8Array): TruncationModel {
  const sample = ctSampler(volume)
  const scale = AXIAL_VIEW.sizePx / AXIAL_VIEW.spanMm
  const [lx, ly] = axialPixelOf(LESION_CENTER[0], LESION_CENTER[1])
  const [bx, by] = axialPixelOf(TRUNCATION_EXAMPLE.centreMm[0], TRUNCATION_EXAMPLE.centreMm[1])
  let inside = 0
  let total = 0
  for (let dx = -LESION_RADIUS; dx <= LESION_RADIUS; dx += 0.25)
    for (let dy = -LESION_RADIUS; dy <= LESION_RADIUS; dy += 0.25) {
      if (Math.hypot(dx, dy) > LESION_RADIUS) continue
      total++
      if (insideReconstruction(LESION_CENTER[0] + dx, LESION_CENTER[1] + dy)) inside++
    }
  return {
    axial: axialSlicePixels(sample, TRUNCATION_EXAMPLE.sliceZ, insideReconstruction),
    lesionAxial: { x: lx, y: ly, r: LESION_RADIUS * scale },
    boundary: { x: bx, y: by, r: TRUNCATION_EXAMPLE.radiusMm * scale },
    lesionCoveredFraction: inside / total,
  }
}
