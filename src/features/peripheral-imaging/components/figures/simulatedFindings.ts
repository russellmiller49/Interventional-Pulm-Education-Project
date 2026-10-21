/**
 * Two findings the course's CT does not contain, simulated on it: a new dependent opacity and the
 * doubled edges of motion during a CBCT spin.
 *
 * Owner decision, 2026-10-12, replacing the deferral recorded as OD4-06 (2026-09-22): the checks in
 * Sections 4 and 16 show what their questions describe, and Section 16's artifact strip shows all
 * three of its appearances. Both are pure functions of the CT, so `model-truth.test.ts` holds what
 * each image is said to show to the real volume.
 *
 * - The opacity is drawn where gravity puts it in a supine patient: against the posterior pleura of
 *   both lungs, densest at the most dependent point, with a hazy, uneven front. The check's lesion is
 *   a small solid nodule in the dependent left lung, present on both images and covered on the
 *   second.
 * - Motion is drawn as breathing: the lung, the nodule and the catheter are averaged over a
 *   craniocaudal excursion that dwells at its two ends, so each edge appears twice. The excursion is
 *   largest at the lung bases and nil at the spine and the posterior chest wall, which stay sharp.
 */
import { ctSampler, type CtSampler } from '../../lib/ctProjection'
import { LESION_CENTER, rollAboutLongAxis, type Point3 } from '../../lib/physics'
import { priorPlaneGray } from '../suite/dtsModel'
import type { LesionMark } from './teachingFigureModel'

const smooth = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Smooth value noise in −1…1, fixed for a given position: the same image on every render. */
function valueNoise(x: number, y: number, cellMm: number): number {
  const hash = (i: number, j: number) => {
    const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453
    return (h - Math.floor(h)) * 2 - 1
  }
  const u = x / cellMm
  const v = y / cellMm
  const i = Math.floor(u)
  const j = Math.floor(v)
  const a = smooth(0, 1, u - i)
  const b = smooth(0, 1, v - j)
  return (
    (hash(i, j) * (1 - a) + hash(i + 1, j) * a) * (1 - b) +
    (hash(i, j + 1) * (1 - a) + hash(i + 1, j + 1) * a) * b
  )
}

function grayImage(sizePx: number, hu: (col: number, row: number) => number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(sizePx * sizePx * 4)
  for (let row = 0; row < sizePx; row++)
    for (let col = 0; col < sizePx; col++) {
      const i = (row * sizePx + col) * 4
      pixels[i] = pixels[i + 1] = pixels[i + 2] = priorPlaneGray(hu(col, row))
      pixels[i + 3] = 255
    }
  return pixels
}

/* ------------------------------------------------------------------ *
 * A new dependent opacity (Section 4's check; Section 16's strip)
 * ------------------------------------------------------------------ */

export const DEPENDENT_OPACITY = {
  sizePx: 288,
  spanMm: 340,
  /** An axial level through both lower lobes, below the course's own nodule. */
  sliceZ: -52,
  /** How far the opacity reaches forward from the most dependent pleura, in millimetres. */
  reachMm: 38,
  /** The share of that reach that is dense; the rest fades out as ground glass. */
  denseShare: 0.5,
  /** The opacity fades out by this height above the most dependent point of the lung, in mm. */
  ceilingMm: 62,
  /** How closely the front follows the curve of the posterior pleura (1) or lies level (0). */
  pleuralShare: 0.65,
  /** Atelectatic lung, in HU. */
  opacityHu: 26,
  /** The check's lesion: a solid nodule in the dependent left lung. */
  nodule: { xMm: 95, fromPleuraMm: 11, radiusMm: 5.5, hu: 5 },
} as const

/** Millimetres of the plane's pixel centre: patient left on the image right, anterior at the top. */
export function dependentOpacityPoint(col: number, row: number): [number, number] {
  const mm = DEPENDENT_OPACITY.spanMm / DEPENDENT_OPACITY.sizePx
  return [
    (col + 0.5) * mm - DEPENDENT_OPACITY.spanMm / 2,
    DEPENDENT_OPACITY.spanMm / 2 - (row + 0.5) * mm,
  ]
}

export function dependentOpacityPixelOf(x: number, y: number): [number, number] {
  const scale = DEPENDENT_OPACITY.sizePx / DEPENDENT_OPACITY.spanMm
  return [(x + DEPENDENT_OPACITY.spanMm / 2) * scale, (DEPENDENT_OPACITY.spanMm / 2 - y) * scale]
}

/**
 * Where the lung begins in front of the posterior chest wall on one sagittal line, in millimetres,
 * or null where that line meets no lung. Walking forward from behind the patient: the chest wall is
 * the first sustained run of tissue, and the lung the first sustained run of air after it.
 */
export function posteriorPleura(sample: CtSampler, x: number, z: number): number | null {
  let tissue = 0
  let inside = false
  let run = 0
  let start = 0
  for (let y = -172; y <= 80; y += 1) {
    const hu = sample(x, y, z)
    if (!inside) {
      tissue = hu > -300 ? tissue + 1 : 0
      if (tissue >= 8) inside = true
      continue
    }
    if (hu < -600) {
      if (run === 0) start = y
      run++
      if (run >= 6) return start
    } else run = 0
  }
  return null
}

/**
 * The posterior pleural line the opacity is measured from, one value per image column.
 *
 * Beside the spine a sagittal line can pass through the vertebra or the aorta and first meet lung
 * well in front of them. Taken as found, that would start a second, separate opacity in front of the
 * aorta, with a straight edge at its side. Such columns, and columns that meet no lung, take the line
 * of their neighbours instead, and the whole line is then smoothed, so the opacity has one continuous
 * front in each lung.
 */
function dependentSurface(
  found: readonly (number | null)[],
  columnX: (col: number) => number,
  lowest: { readonly left: number; readonly right: number },
): readonly (number | null)[] {
  // `columnX` is the column's distance from the patient's midline, signed patient-left positive.
  const line: (number | null)[] = found.map(() => null)
  for (const side of ['left', 'right'] as const) {
    const columns = found.flatMap((_, col) => {
      const x = columnX(col)
      return x > 0 === (side === 'left') ? [col] : []
    })
    // The lateral chest wall curves forward, so the line may rise there; near the spine it may not.
    const trusted = columns.filter((col) => {
      const y = found[col]
      return y !== null && y <= lowest[side] + 24 + 0.9 * Math.max(0, Math.abs(columnX(col)) - 55)
    })
    if (trusted.length === 0) continue
    for (const col of columns) {
      const before = trusted.filter((candidate) => candidate <= col).at(-1)
      const after = trusted.find((candidate) => candidate >= col)
      if (before === undefined || after === undefined) {
        // Beyond the last trusted column: lung found there is kept, anything else is not filled.
        line[col] = found[col] === null ? null : found[(before ?? after)!]
        continue
      }
      const share = after === before ? 0 : (col - before) / (after - before)
      line[col] = found[before]! * (1 - share) + found[after]! * share
    }
    // A short running mean, within the lung.
    const raw = [...line]
    for (const col of columns) {
      if (raw[col] === null) continue
      let sum = 0
      let count = 0
      for (let near = col - 4; near <= col + 4; near++)
        if (columns.includes(near) && raw[near] !== null) {
          sum += raw[near]!
          count++
        }
      line[col] = sum / count
    }
  }
  return line
}

export interface DependentOpacityImages {
  readonly sizePx: number
  /** The level as it was on the planning CT, with the check's nodule. */
  readonly planning: Uint8ClampedArray
  /** The same level with the dependent opacity. */
  readonly current: Uint8ClampedArray
  /** The nodule, in image pixels; null on a volume with no lung where it would lie. */
  readonly nodule: LesionMark | null
  /** The nodule's centre, in millimetres. */
  readonly noduleMm: readonly [number, number] | null
  /** How much of the opacity covers the nodule's centre, 0–1. */
  readonly noduleCover: number
  /** The roll the level is drawn at: 0 supine, positive with the patient's left side lifted. */
  readonly wedgeDeg: number
  /** The image row level with the front of the vertebral body; lung below it is dependent. */
  readonly equatorPx: number | null
}

/** Roll an axial point about the isocentre: positive lifts the patient's left side. */
function rollAxial(x: number, y: number, degrees: number): [number, number] {
  const [rx, ry] = rollAboutLongAxis([x, y, 0], degrees)
  return [rx, ry]
}

/** Inside the scan's 352 mm square at any roll. */
const ROLLED_FIELD_RADIUS_MM = 172

/** The front of the vertebral body on the midline at a level: the first bone walking back. */
export function vertebralBodyFront(sample: CtSampler, z: number): number | null {
  for (let y = -40; y >= -140; y -= 0.5) if (sample(0, y, z) > 200) return y
  return null
}

/**
 * The same level supine, or wedged: rolled about the long axis with the patient's left side lifted
 * by `wedgeDeg`. The image is drawn as the patient lies in the room, so gravity stays toward the
 * bottom of the image and the opacity forms in whatever lung is now lowest. The check's nodule is
 * fixed in the patient, so it rolls with the chest.
 */
export function dependentOpacityImages(
  volume: Uint8Array,
  { wedgeDeg = 0 }: { readonly wedgeDeg?: number } = {},
): DependentOpacityImages {
  const patient = ctSampler(volume)
  const sample: CtSampler =
    wedgeDeg === 0
      ? patient
      : (x, y, z) => {
          const [px, py] = rollAxial(x, y, -wedgeDeg)
          // A round field of view inside the scan, so a rolled level shows no corner of the volume;
          // its edge is softened over a few millimetres so it does not step at display size.
          const outside = smooth(
            ROLLED_FIELD_RADIUS_MM - 3,
            ROLLED_FIELD_RADIUS_MM,
            Math.hypot(px, py),
          )
          if (outside >= 1) return -1000
          const hu = patient(px, py, z)
          return hu + outside * (-1000 - hu)
        }
  /** Signed distance from the patient's midline, patient-left positive, of a room-frame point. */
  const lateral = (x: number, y: number) => (wedgeDeg === 0 ? x : rollAxial(x, y, -wedgeDeg)[0])
  const { sizePx, sliceZ, reachMm, denseShare, pleuralShare, opacityHu, ceilingMm } =
    DEPENDENT_OPACITY
  const roomX = (col: number) => dependentOpacityPoint(col, 0)[0]
  const found = Array.from({ length: sizePx }, (_, col) =>
    posteriorPleura(sample, roomX(col), sliceZ),
  )
  // Where each column lies relative to the midline, measured at its pleura (or behind the lung).
  const columnX = (col: number) => lateral(roomX(col), found[col] ?? -110)
  // The most dependent point of each lung: the opacity is deepest there.
  const lowest = { left: Infinity, right: Infinity }
  found.forEach((y, col) => {
    if (y === null) return
    const side = columnX(col) > 0 ? 'left' : 'right'
    lowest[side] = Math.min(lowest[side], y)
  })
  const pleura = dependentSurface(found, columnX, lowest)
  const noduleSpec = DEPENDENT_OPACITY.nodule
  // Placed on the supine level, then rolled with the chest.
  const nodulePleura = posteriorPleura(patient, noduleSpec.xMm, sliceZ)
  const noduleMm: [number, number] | null =
    nodulePleura === null
      ? null
      : rollAxial(noduleSpec.xMm, nodulePleura + noduleSpec.fromPleuraMm, wedgeDeg)
  const bodyFront = vertebralBodyFront(patient, sliceZ)
  // The "equator": the level of the front of the vertebral body, level in the room.
  const equatorMm = bodyFront === null ? null : rollAxial(0, bodyFront, wedgeDeg)[1]

  const withNodule = (x: number, y: number, hu: number) => {
    if (!noduleMm) return hu
    const dx = x - noduleMm[0]
    const dy = y - noduleMm[1]
    // Slightly lobulated, so it does not read as a drawn circle.
    const radius = noduleSpec.radiusMm * (1 + 0.1 * Math.sin(3 * Math.atan2(dy, dx) + 0.7))
    const inside = 1 - smooth(radius - 1.6, radius + 1.4, Math.hypot(dx, dy))
    return hu + inside * Math.max(0, noduleSpec.hu - hu)
  }
  const cover = (x: number, y: number, pleuraY: number | null) => {
    // A few millimetres behind the pleural line are partial-volume lung, and fill with it.
    if (pleuraY === null || y < pleuraY - 6) return 0
    // Dependent means low: the opacity thins out with height above the lowest point of the lung.
    // Supine the two lungs' lowest points lie level and each lung is measured from its own; rolled,
    // height is measured from the lowest point of the chest, so the lifted lung is less dependent.
    const aboveLowest =
      y -
      (wedgeDeg === 0
        ? lowest[lateral(x, y) > 0 ? 'left' : 'right']
        : Math.min(lowest.left, lowest.right))
    const depth =
      pleuralShare * (y - pleuraY) +
      (1 - pleuralShare) * aboveLowest +
      5 * valueNoise(x, y, 14) +
      2.5 * valueNoise(x + 40, y - 17, 6)
    return (
      (1 - smooth(denseShare * reachMm, 1.05 * reachMm, depth)) *
      (1 - smooth(ceilingMm - 24, ceilingMm, aboveLowest))
    )
  }
  const planningHu = (col: number, row: number) => {
    const [x, y] = dependentOpacityPoint(col, row)
    return withNodule(x, y, sample(x, y, sliceZ))
  }
  const currentHu = (col: number, row: number) => {
    const [x, y] = dependentOpacityPoint(col, row)
    const hu = planningHu(col, row)
    const target = opacityHu + 14 * valueNoise(x, y, 9)
    return hu < target ? hu + cover(x, y, pleura[col]) * (target - hu) : hu
  }
  const mark = noduleMm ? dependentOpacityPixelOf(noduleMm[0], noduleMm[1]) : null
  return {
    sizePx,
    planning: grayImage(sizePx, planningHu),
    current: grayImage(sizePx, currentHu),
    nodule: mark && {
      x: mark[0],
      y: mark[1],
      r: (noduleSpec.radiusMm * sizePx) / DEPENDENT_OPACITY.spanMm,
    },
    noduleMm,
    noduleCover:
      noduleMm && mark
        ? cover(
            noduleMm[0],
            noduleMm[1],
            pleura[Math.min(sizePx - 1, Math.max(0, Math.floor(mark[0])))],
          )
        : 0,
    wedgeDeg,
    equatorPx: equatorMm === null ? null : dependentOpacityPixelOf(0, equatorMm)[1],
  }
}

/* ------------------------------------------------------------------ *
 * Motion during a CBCT spin (Section 16's check and strip)
 * ------------------------------------------------------------------ */

export type MotionPlaneId = 'coronal' | 'sagittal' | 'axial'

export const MOTION_EXAMPLE = {
  sizePx: 224,
  spanMm: 130,
  /** Half the craniocaudal excursion at the lung base: edges there appear about twice this apart. */
  amplitudeMm: 3.5,
  /** Anteroposterior excursion, as a share of the craniocaudal one. */
  anteroposteriorShare: 0.3,
  /** Phases of the breath, −1…1, and the share of the spin spent near each: it dwells at the ends. */
  phases: [-1, -0.9, -0.5, 0, 0.5, 0.9, 1],
  dwell: [3.4, 1.0, 0.45, 0.4, 0.45, 0.9, 2.6],
  /** A catheter from the left hilum to the nodule, lying in the coronal plane through the nodule. */
  catheter: {
    radiusMm: 1.25,
    hu: 1500,
    path: [
      [30, LESION_CENTER[1], 34],
      [52, LESION_CENTER[1], -14],
      [82, LESION_CENTER[1], -28],
    ] as readonly Point3[],
  },
  /** The nodule's solid part, so that its margin is an edge that can be seen twice. */
  nodule: { radiusMm: 6.5, hu: -40 },
  /** The three planes, and the point each view is centred on. */
  centre: [66, LESION_CENTER[1], -8] as Point3,
  planes: { coronalY: LESION_CENTER[1], sagittalX: LESION_CENTER[0], axialZ: -27 },
} as const

const CATHETER_POINTS: readonly Point3[] = Array.from({ length: 41 }, (_, i) => {
  const t = i / 40
  const [p0, p1, p2] = MOTION_EXAMPLE.catheter.path
  const a = (1 - t) ** 2
  const b = 2 * t * (1 - t)
  const c = t * t
  return [
    a * p0[0] + b * p1[0] + c * p2[0],
    a * p0[1] + b * p1[1] + c * p2[1],
    a * p0[2] + b * p1[2] + c * p2[2],
  ] as Point3
})

function catheterDistance(x: number, y: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < CATHETER_POINTS.length - 1; i++) {
    const [ax, ay, az] = CATHETER_POINTS[i]
    const [bx, by, bz] = CATHETER_POINTS[i + 1]
    const ex = bx - ax
    const ey = by - ay
    const ez = bz - az
    const t = Math.min(
      1,
      Math.max(0, ((x - ax) * ex + (y - ay) * ey + (z - az) * ez) / (ex * ex + ey * ey + ez * ez)),
    )
    const distance = Math.hypot(x - ax - t * ex, y - ay - t * ey, z - az - t * ez)
    if (distance < best) best = distance
  }
  return best
}

/** The CT with the catheter in place and the nodule's solid part, at rest. */
export function motionSceneSampler(sample: CtSampler): CtSampler {
  const { catheter, nodule } = MOTION_EXAMPLE
  const reach = catheter.radiusMm + 1
  const [p0, , p2] = catheter.path
  return (x, y, z) => {
    let hu = sample(x, y, z)
    const fromNodule = Math.hypot(x - LESION_CENTER[0], y - LESION_CENTER[1], z - LESION_CENTER[2])
    if (fromNodule < nodule.radiusMm + 2) {
      const inside = 1 - smooth(nodule.radiusMm - 1.1, nodule.radiusMm + 1.1, fromNodule)
      hu += inside * Math.max(0, nodule.hu - hu)
    }
    if (
      Math.abs(y - p0[1]) > reach ||
      x < p0[0] - reach ||
      x > p2[0] + reach ||
      z > p0[2] + reach ||
      z < p2[2] - reach
    )
      return hu
    const inside =
      1 - smooth(catheter.radiusMm - 0.7, catheter.radiusMm + 0.7, catheterDistance(x, y, z))
    return hu + inside * (catheter.hu - hu)
  }
}

/**
 * How much of the breathing excursion a point takes, 0–1: nil at the spine and the posterior chest
 * wall, full in front of them, and growing from the apex to the lung base.
 */
export function breathingShare(y: number, z: number): number {
  return smooth(-128, -92, y) * (0.35 + 0.65 * smooth(120, -60, z))
}

/** The scene averaged over the breath: what a spin acquired during breathing reconstructs. */
export function movingSceneSampler(scene: CtSampler): CtSampler {
  const { amplitudeMm, anteroposteriorShare, phases, dwell } = MOTION_EXAMPLE
  const total = dwell.reduce((sum, value) => sum + value, 0)
  return (x, y, z) => {
    const share = breathingShare(y, z)
    let sum = 0
    for (let k = 0; k < phases.length; k++) {
      const shift = amplitudeMm * phases[k] * share
      sum += dwell[k] * scene(x, y + anteroposteriorShare * shift, z + shift)
    }
    return sum / total
  }
}

/** The point at a plane's pixel centre, in millimetres. */
export function motionPlanePoint(plane: MotionPlaneId, col: number, row: number): Point3 {
  const { sizePx, spanMm, centre, planes } = MOTION_EXAMPLE
  const mm = spanMm / sizePx
  const across = (col + 0.5) * mm - spanMm / 2
  const down = (row + 0.5) * mm - spanMm / 2
  // Coronal and axial: patient left on the image right. Sagittal: anterior on the image left.
  if (plane === 'coronal') return [centre[0] + across, planes.coronalY, centre[2] - down]
  if (plane === 'sagittal') return [planes.sagittalX, centre[1] - across, centre[2] - down]
  return [centre[0] + across, centre[1] - down, planes.axialZ]
}

export function motionPlanePixels(
  volume: Uint8Array,
  plane: MotionPlaneId,
  options: { readonly moving: boolean } = { moving: true },
): Uint8ClampedArray {
  const scene = motionSceneSampler(ctSampler(volume))
  const sample = options.moving ? movingSceneSampler(scene) : scene
  return grayImage(MOTION_EXAMPLE.sizePx, (col, row) => {
    const [x, y, z] = motionPlanePoint(plane, col, row)
    return sample(x, y, z)
  })
}

export interface MotionPlanes {
  readonly sizePx: number
  readonly coronal: Uint8ClampedArray
  readonly sagittal: Uint8ClampedArray
  readonly axial: Uint8ClampedArray
}

/** The three planes of a spin acquired during breathing: Section 16's check. */
export function motionPlanes(volume: Uint8Array): MotionPlanes {
  return {
    sizePx: MOTION_EXAMPLE.sizePx,
    coronal: motionPlanePixels(volume, 'coronal'),
    sagittal: motionPlanePixels(volume, 'sagittal'),
    axial: motionPlanePixels(volume, 'axial'),
  }
}
