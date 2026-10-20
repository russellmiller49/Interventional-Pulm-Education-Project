/**
 * What the X-ray path through the nodule crosses besides lung and chest wall: the heart and
 * mediastinum, a rib, the spine, or the diaphragm and upper abdomen.
 *
 * The labels are read off the course CT, not drawn as boxes, because the structures that hide a
 * nodule are not box-shaped: at the level of this nodule the cardiac silhouette spans most of the
 * chest, and the cardiac apex sits on the left dome with lung only above it. The rules, all on the
 * quantized HU volume:
 *
 * - Lung is −970 to −450 HU. In this CT aerated lung peaks near −925 HU and outside air near
 *   −1000 HU, so the course's −950 display band would lose a sixth of the lung.
 * - Mediastinum: in each axial row anterior to the vertebral bodies, the run of non-lung voxels
 *   that crosses the midline and is closed by lung on both sides (a lung that is itself closed by
 *   chest wall, so a skin edge cannot close it), no wider than 240 mm.
 * - Diaphragm: per vertical column, the top of the non-lung mass that reaches the bottom of the
 *   scan with lung above it. Behind the heart it is measured; a column topped by mediastinum is
 *   filled with the lowest neighbouring dome; in front of the heart the dome is never higher than
 *   the reference behind it for the same left–right position. Soft tissue below it is diaphragm.
 * - Bone within the vertebral column is spine; any other bone is reported as a rib. Along the
 *   paths this nodule's projections take, that bone is posterior and anterior ribs.
 *
 * `model-truth.test.ts` decodes the real atlas and holds these labels, and the baked table the lab
 * reads, to the CT.
 */
import { ANATOMY, loadAnatomyVolume } from './anatomy'
import {
  beamDirection,
  LESION_CENTER,
  LESION_RADIUS,
  SOURCE_DISTANCE,
  SPINE_COLUMN,
  type Point3,
} from './physics'

export type RayStructure = 'mediastinum' | 'rib' | 'spine' | 'diaphragm'
export const RAY_STRUCTURE_ORDER: readonly RayStructure[] = [
  'mediastinum',
  'diaphragm',
  'spine',
  'rib',
]

/** The words a readout prints, and how much of the path must cross a structure for it to count. */
export const RAY_STRUCTURES: Readonly<
  Record<RayStructure, { label: string; minMm: number; bit: number }>
> = {
  mediastinum: { label: 'heart and mediastinum', minMm: 10, bit: 1 },
  rib: { label: 'rib', minMm: 3, bit: 2 },
  spine: { label: 'spine', minMm: 3, bit: 4 },
  diaphragm: { label: 'diaphragm', minMm: 10, bit: 8 },
}

/** Voxel codes in a structure volume. */
export const STRUCTURE_CODE = {
  air: 0,
  lung: 1,
  soft: 2,
  rib: 3,
  spine: 4,
  mediastinum: 5,
  diaphragm: 6,
} as const

export const STRUCTURE_RULES = {
  lungLowHu: -970,
  lungHighHu: -450,
  boneHu: 180,
  maxMediastinumMm: 240,
  /** Consecutive lung voxels that close a mediastinal run. */
  runLungVoxels: 4,
  /** Consecutive lung voxels above a column's mass for its top to count as a dome. */
  domeLungVoxels: 6,
  /** No dome is taken above this height: the domes of this CT lie well below the nodule. */
  domeCeilingMm: -10,
  /** The dome is measured behind this coronal plane, clear of the heart. */
  domeReferenceYMm: -10,
  domeFillPasses: 40,
  /** Rows behind this plane are paraspinal, not mediastinal. */
  mediastinumMinYMm: -90,
  /** How far from the midline a mediastinal run may start. */
  midlineMm: 15,
  /** The vertebral column: within SPINE_COLUMN.halfWidth of the midline, between these planes. */
  spineYMm: [SPINE_COLUMN.y - 70, SPINE_COLUMN.y + 45] as const,
} as const

export interface StructureVolume {
  readonly codes: Uint8Array
}

/** Label every voxel of the quantized course CT. Deterministic: the build script and the tests share it. */
export function labelStructures(volume: Uint8Array): StructureVolume {
  const [sx, sy, sz] = ANATOMY.sizeXyz
  const [ox, oy, oz] = ANATOMY.originMm
  const [dx, dy, dz] = ANATOMY.spacingMm
  const [huLow, huHigh] = ANATOMY.huRange
  const R = STRUCTURE_RULES
  const index = (i: number, j: number, k: number) => (k * sy + j) * sx + i
  const X = (i: number) => ox + i * dx
  const Y = (j: number) => oy + j * dy
  const Z = (k: number) => oz + k * dz
  const C = STRUCTURE_CODE
  const codes = new Uint8Array(sx * sy * sz)
  for (let n = 0; n < codes.length; n++) {
    const hu = huLow + (volume[n] / 255) * (huHigh - huLow)
    codes[n] =
      hu < R.lungLowHu ? C.air : hu < R.lungHighHu ? C.lung : hu < R.boneHu ? C.soft : C.rib
  }
  const at = (i: number, j: number, k: number) => codes[index(i, j, k)]

  // A run is closed by lung only when that lung is itself closed by chest wall, not by outside air.
  const lungBoundary = (i: number, j: number, k: number, step: 1 | -1) => {
    for (let t = 0; t < R.runLungVoxels; t++) {
      const ii = i + step * t
      if (ii < 0 || ii >= sx || at(ii, j, k) !== C.lung) return false
    }
    let air = 0
    for (let ii = i + step * R.runLungVoxels; ii >= 0 && ii < sx; ii += step) {
      const code = at(ii, j, k)
      if (code >= C.soft) return true
      if (code === C.air) {
        if (++air >= 5) return false
      } else air = 0
    }
    return false
  }
  const half = Math.round(R.midlineMm / dx)
  const midline = Math.round(-ox / dx)
  for (let k = 0; k < sz; k++)
    for (let j = 0; j < sy; j++) {
      if (Y(j) <= R.mediastinumMinYMm) continue
      let start = -1
      for (let d = 0; d <= half && start < 0; d++)
        for (const ii of [midline + d, midline - d])
          if (start < 0 && at(ii, j, k) !== C.lung) start = ii
      if (start < 0) continue
      let a = start
      let b = start
      while (a > 0 && !lungBoundary(a - 1, j, k, -1)) a--
      while (b < sx - 1 && !lungBoundary(b + 1, j, k, 1)) b++
      if (a <= 0 || b >= sx - 1 || (b - a) * dx > R.maxMediastinumMm) continue
      for (let i = a; i <= b; i++) {
        const n = index(i, j, k)
        if (codes[n] === C.soft || codes[n] === C.air) codes[n] = C.mediastinum
      }
    }

  const dome = new Float32Array(sx * sy).fill(Number.NaN)
  const fillable = new Uint8Array(sx * sy)
  for (let j = 0; j < sy; j++)
    for (let i = 0; i < sx; i++) {
      const lungAbove = (k: number) => {
        for (let t = 0; t < R.domeLungVoxels; t++)
          if (k + t >= sz || at(i, j, k + t) !== C.lung) return false
        return true
      }
      let k = 0
      while (k < sz - R.domeLungVoxels && !lungAbove(k)) k++
      if (k >= sz - R.domeLungVoxels || k === 0) continue
      if (at(i, j, k - 1) === C.mediastinum || Z(k) > R.domeCeilingMm) fillable[j * sx + i] = 1
      else dome[j * sx + i] = Z(k)
    }
  const jReference = Math.round((R.domeReferenceYMm - oy) / dy)
  for (let pass = 0; pass < R.domeFillPasses; pass++) {
    const next = dome.slice()
    for (let j = 1; j <= jReference; j++)
      for (let i = 1; i < sx - 1; i++) {
        const c = j * sx + i
        if (!fillable[c] || !Number.isNaN(dome[c])) continue
        let low = Infinity
        for (const d of [-1, 1, -sx, sx])
          if (!Number.isNaN(dome[c + d])) low = Math.min(low, dome[c + d])
        if (low < Infinity) next[c] = low
      }
    dome.set(next)
  }
  for (let i = 0; i < sx; i++) {
    let reference = Number.NaN
    for (let j = jReference; j >= 0 && Number.isNaN(reference); j--) reference = dome[j * sx + i]
    for (let j = jReference + 1; j < sy; j++) {
      const c = j * sx + i
      if (Number.isNaN(reference)) dome[c] = Number.NaN
      else if (!Number.isNaN(dome[c])) dome[c] = Math.min(dome[c], reference)
      else if (fillable[c]) dome[c] = reference
    }
  }
  for (let j = 0; j < sy; j++)
    for (let i = 0; i < sx; i++) {
      const top = dome[j * sx + i]
      if (Number.isNaN(top)) continue
      for (let k = 0; k < sz && Z(k) < top; k++) {
        const n = index(i, j, k)
        if (codes[n] === C.soft || codes[n] === C.mediastinum) codes[n] = C.diaphragm
      }
    }

  const [spineBack, spineFront] = R.spineYMm
  for (let k = 0; k < sz; k++)
    for (let j = 0; j < sy; j++) {
      if (Y(j) < spineBack || Y(j) > spineFront) continue
      for (let i = 0; i < sx; i++) {
        const n = index(i, j, k)
        if (codes[n] === C.rib && Math.abs(X(i) - SPINE_COLUMN.x) <= SPINE_COLUMN.halfWidth)
          codes[n] = C.spine
      }
    }
  return { codes }
}

/** The structure code at a point, by nearest voxel; outside the scan is air. */
export function structureAt({ codes }: StructureVolume, [x, y, z]: Point3): number {
  const [sx, sy, sz] = ANATOMY.sizeXyz
  const i = Math.round((x - ANATOMY.originMm[0]) / ANATOMY.spacingMm[0])
  const j = Math.round((y - ANATOMY.originMm[1]) / ANATOMY.spacingMm[1])
  const k = Math.round((z - ANATOMY.originMm[2]) / ANATOMY.spacingMm[2])
  if (i < 0 || j < 0 || k < 0 || i >= sx || j >= sy || k >= sz) return STRUCTURE_CODE.air
  return codes[(k * sy + j) * sx + i]
}

/** The source of the beam at a view obliquity and tilt, isocentre at the origin. */
export function beamSource(viewObliquity: number, tilt: number): Point3 {
  return beamDirection(viewObliquity, tilt).map((n) => -n * SOURCE_DISTANCE) as Point3
}

/**
 * Millimetres of each structure on the path from the source through `target`, across the whole
 * scan, leaving out the target itself (a sphere of `LESION_RADIUS`).
 */
export function structuresOnRay(
  structures: StructureVolume,
  viewObliquity: number,
  tilt: number,
  target: Point3 = LESION_CENTER,
  stepMm = 1,
): Record<RayStructure, number> {
  const source = beamSource(viewObliquity, tilt)
  const delta = target.map((n, i) => n - source[i]) as Point3
  const length = Math.hypot(...delta)
  const direction = delta.map((n) => n / length) as Point3
  const mm: Record<RayStructure, number> = { mediastinum: 0, rib: 0, spine: 0, diaphragm: 0 }
  // The scan is a 352 mm cube about the isocentre; 400 mm either side of the target covers it.
  for (let s = length - 400; s < length + 400; s += stepMm) {
    const point = source.map((n, i) => n + direction[i] * s) as Point3
    if (Math.hypot(...point.map((n, i) => n - target[i])) <= LESION_RADIUS) continue
    switch (structureAt(structures, point)) {
      case STRUCTURE_CODE.mediastinum:
        mm.mediastinum += stepMm
        break
      case STRUCTURE_CODE.rib:
        mm.rib += stepMm
        break
      case STRUCTURE_CODE.spine:
        mm.spine += stepMm
        break
      case STRUCTURE_CODE.diaphragm:
        mm.diaphragm += stepMm
        break
    }
  }
  return mm
}

export type RayCrossing = Readonly<Record<RayStructure, boolean>>

export function crossingFromMm(mm: Record<RayStructure, number>): RayCrossing {
  return {
    mediastinum: mm.mediastinum >= RAY_STRUCTURES.mediastinum.minMm,
    rib: mm.rib >= RAY_STRUCTURES.rib.minMm,
    spine: mm.spine >= RAY_STRUCTURES.spine.minMm,
    diaphragm: mm.diaphragm >= RAY_STRUCTURES.diaphragm.minMm,
  }
}

export function crossingBits(crossing: RayCrossing): number {
  return RAY_STRUCTURE_ORDER.reduce(
    (bits, structure) => (crossing[structure] ? bits | RAY_STRUCTURES[structure].bit : bits),
    0,
  )
}

export function crossingFromBits(bits: number): RayCrossing {
  return {
    mediastinum: (bits & RAY_STRUCTURES.mediastinum.bit) !== 0,
    rib: (bits & RAY_STRUCTURES.rib.bit) !== 0,
    spine: (bits & RAY_STRUCTURES.spine.bit) !== 0,
    diaphragm: (bits & RAY_STRUCTURES.diaphragm.bit) !== 0,
  }
}

const PHRASE: Readonly<Record<RayStructure, string>> = {
  mediastinum: 'the heart and mediastinum',
  diaphragm: 'the diaphragm',
  spine: 'the spine',
  rib: 'a rib',
}

/** For a sentence: "the heart and mediastinum plus a rib", "a rib" or "only lung". */
export function rayCrossingPhrase(crossing: RayCrossing): string {
  const names = RAY_STRUCTURE_ORDER.filter((structure) => crossing[structure]).map(
    (structure) => PHRASE[structure],
  )
  return names.length === 0 ? 'only lung' : names.join(' plus ')
}

/** "Heart and mediastinum, rib" or "Lung only". */
export function rayCrossingLabel(crossing: RayCrossing): string {
  const names = RAY_STRUCTURE_ORDER.filter((structure) => crossing[structure]).map(
    (structure) => RAY_STRUCTURES[structure].label,
  )
  if (names.length === 0) return 'Lung only'
  const text = names.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** What one stretch of the path crosses, for drawing the path in the scene and its strip. */
export type PathKind =
  | 'lung'
  | 'chestWall'
  | 'mediastinum'
  | 'diaphragm'
  | 'spine'
  | 'rib'
  | 'nodule'
export interface PathSegment {
  readonly start: Point3
  readonly end: Point3
  readonly kind: PathKind
  readonly lengthMm: number
}

const KIND_OF_CODE: Readonly<Record<number, PathKind | 'air'>> = {
  [STRUCTURE_CODE.air]: 'air',
  [STRUCTURE_CODE.lung]: 'lung',
  [STRUCTURE_CODE.soft]: 'chestWall',
  [STRUCTURE_CODE.rib]: 'rib',
  [STRUCTURE_CODE.spine]: 'spine',
  [STRUCTURE_CODE.mediastinum]: 'mediastinum',
  [STRUCTURE_CODE.diaphragm]: 'diaphragm',
}

/**
 * The path from `source` to `detector` inside the body, as consecutive stretches of one kind.
 * Air inside the chest is lung (airways and the darkest lung lie below the lung band); the outside
 * air before the skin and after it is left out.
 */
export function pathSegments(
  structures: StructureVolume,
  source: Point3,
  detector: Point3,
  target: Point3 = LESION_CENTER,
  stepMm = 1,
): PathSegment[] {
  const delta = detector.map((n, i) => n - source[i]) as Point3
  const length = Math.hypot(...delta)
  if (!Number.isFinite(length) || length === 0) return []
  const direction = delta.map((n) => n / length) as Point3
  const at = (s: number) => source.map((n, i) => n + direction[i] * s) as Point3
  const samples: { s: number; kind: PathKind | 'air' }[] = []
  for (let s = 0; s < length; s += stepMm) {
    const point = at(s + stepMm / 2)
    const kind =
      Math.hypot(...point.map((n, i) => n - target[i])) <= LESION_RADIUS
        ? 'nodule'
        : KIND_OF_CODE[structureAt(structures, point)]
    samples.push({ s, kind })
  }
  const first = samples.findIndex((sample) => sample.kind !== 'air')
  if (first < 0) return []
  let last = samples.length - 1
  while (samples[last].kind === 'air') last--
  const segments: { start: number; end: number; kind: PathKind }[] = []
  for (let n = first; n <= last; n++) {
    const kind: PathKind = samples[n].kind === 'air' ? 'lung' : (samples[n].kind as PathKind)
    const previous = segments[segments.length - 1]
    if (previous?.kind === kind) previous.end = samples[n].s + stepMm
    else segments.push({ start: samples[n].s, end: samples[n].s + stepMm, kind })
  }
  return segments.map(({ start, end, kind }) => ({
    start: at(start),
    end: at(end),
    kind,
    lengthMm: end - start,
  }))
}

let cachedStructures: Promise<StructureVolume> | undefined
/** The labelled course CT, built once in the browser from the shared atlas (under 0.2 s). */
export function loadStructureVolume(): Promise<StructureVolume> {
  if (!cachedStructures)
    cachedStructures = loadAnatomyVolume()
      .then(labelStructures)
      .catch((error: unknown) => {
        cachedStructures = undefined
        throw error
      })
  return cachedStructures
}
