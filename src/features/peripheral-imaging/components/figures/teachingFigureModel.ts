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

export interface TargetRay {
  readonly obliquity: number
  readonly tilt: number
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
  const ray = rayThrough(suiteFrame(obliquity, tilt), LESION_CENTER)
  const sampleHu = (point: Point3) => sample(point[0], point[1], point[2])
  const tubeSide = side(rayProfile(volume, ray.source, LESION_CENTER, { stepMm: 1, sampleHu }))
  const detectorSide = side(rayProfile(volume, LESION_CENTER, ray.hit, { stepMm: 1, sampleHu }))
  return {
    obliquity,
    tilt,
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

/**
 * The central ray's line across the axial plane, from the tube side to the detector side, clipped
 * to the image so the arrow at its detector end stays in view.
 */
export function axialBeamLine(obliquity: number): {
  readonly from: [number, number]
  readonly to: [number, number]
} {
  const direction = beamDirection(obliquity, 0)
  const at = (t: number) =>
    axialPixelOf(LESION_CENTER[0] + direction[0] * t, LESION_CENTER[1] + direction[1] * t)
  const margin = 3
  const inside = ([x, y]: [number, number]) =>
    x >= margin && y >= margin && x <= AXIAL_VIEW.sizePx - margin && y <= AXIAL_VIEW.sizePx - margin
  const reach = (sign: 1 | -1) => {
    let t = 0
    while (t < AXIAL_VIEW.spanMm * 2 && inside(at(sign * (t + 1)))) t += 1
    return sign * t
  }
  return { from: at(reach(-1)), to: at(reach(1)) }
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

export interface ToolView {
  readonly obliquity: number
  /** Projected tool length on the detector, as a fraction of its length seen side-on (0–1). */
  readonly profileFraction: number
  /** Endpoints of the projected tool and the lesion's projected circle, in a 160 × 120 frame. */
  readonly from: [number, number]
  readonly to: [number, number]
  readonly lesion: LesionMark
}

export interface TwoAxisModel {
  readonly axial: Uint8ClampedArray
  readonly lesionAxial: LesionMark
  readonly lines: readonly {
    readonly obliquity: number
    readonly from: [number, number]
    readonly to: [number, number]
  }[]
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

function toolView(obliquity: number): ToolView {
  const [start, end] = toolEnds()
  const a = projectToDetector(start, obliquity, 0)
  const b = projectToDetector(end, obliquity, 0)
  const length = Math.hypot(a[0] - b[0], a[1] - b[1])
  const normal = beamDirection(obliquity, 0)
  const depthOf = (point: Point3) => point.reduce((sum, value, i) => sum + value * normal[i], 0)
  // Side-on, the whole tool is perpendicular to the beam: its length times the magnification there.
  const sideOnLength =
    TWO_AXIS_EXAMPLE.toolLengthMm * magnificationAt((depthOf(start) + depthOf(end)) / 2)
  const scale = 1.1
  const frame = (point: [number, number]): [number, number] => [
    80 + (point[0] - b[0]) * scale,
    60 - (point[1] - b[1]) * scale,
  ]
  const r = LESION_RADIUS * magnificationAt(depthOf(LESION_CENTER)) * scale
  const [lx, ly] = frame(b)
  return {
    obliquity,
    profileFraction: Math.min(1, length / sideOnLength),
    from: frame(a),
    to: frame(b),
    lesion: { x: lx, y: ly, r },
  }
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
  return {
    axial: axialSlicePixels(sample, example.sliceZ),
    lesionAxial: { x: lx, y: ly, r: LESION_RADIUS * axialScale },
    lines: example.candidates.map((obliquity) => ({ obliquity, ...axialBeamLine(obliquity) })),
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
    toolViews: {
      alignment: toolView(example.alignmentObliquity),
      advancement: toolView(example.chosenObliquity),
    },
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
