import tree from '../../../../public/peripheral-imaging/anatomy/airway-tree.json'
import {
  AIRWAY_BRANCHES,
  AIRWAY_LOBE_KEYS,
  isAirwayBranchKey,
  type AirwayBranchKey,
  type AirwayLobeKey,
  type AirwaySegmentKey,
} from '../content/airwayNames'
import { beamDirection, type Point3 } from './physics'

/**
 * The named bronchial tree of the course CT: every branch's centreline and radius, in the course
 * frame (millimetres; x toward the patient's left, y anterior, z superior).
 *
 * Built by `scripts/peripheral-imaging/build-airway-tree.ts` from the airway centrelines of this
 * CT and the segment surfaces of the same patient. Everything the course says about where a
 * bronchus runs is read from this tree, and the model-truth tests hold the copy to it.
 */
export interface AirwayBranch {
  readonly id: number
  readonly parent: number | null
  readonly key: AirwayBranchKey
  readonly radiusMm: number
  readonly points: readonly Point3[]
}

export const AIRWAY_TREE: readonly AirwayBranch[] = tree.branches.map((branch) => {
  if (!isAirwayBranchKey(branch.key))
    throw new Error(`Airway branch ${branch.id} has no course name (${String(branch.key)}).`)
  return {
    id: branch.id,
    parent: branch.parent,
    key: branch.key,
    radiusMm: branch.radiusMm,
    points: branch.points as unknown as Point3[],
  }
})

export const AIRWAY_CARINA: Point3 = tree.carinaMm as Point3

const BY_ID = new Map(AIRWAY_TREE.map((branch) => [branch.id, branch]))
const CHILDREN = new Map<number, AirwayBranch[]>()
for (const branch of AIRWAY_TREE) {
  if (branch.parent === null) continue
  const list = CHILDREN.get(branch.parent) ?? []
  list.push(branch)
  CHILDREN.set(branch.parent, list)
}

/** What the learner has asked to see drawn: nothing, the whole tree, or one lobe's bronchi. */
export type AirwayShow = 'off' | 'all' | AirwayLobeKey

export const AIRWAY_SHOW_VALUES: readonly AirwayShow[] = ['off', 'all', ...AIRWAY_LOBE_KEYS]

export const isAirwayShow = (value: unknown): value is AirwayShow =>
  (AIRWAY_SHOW_VALUES as readonly unknown[]).includes(value)

export const lobeOfBranch = (branch: AirwayBranch): AirwayLobeKey | undefined =>
  AIRWAY_BRANCHES[branch.key].lobe

const distance = (a: Point3, b: Point3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function polylineLength(points: readonly Point3[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) length += distance(points[i - 1], points[i])
  return length
}

/** The first branch that carries `key`: where that bronchus leaves its parent. */
export function airwayOrigin(key: AirwayBranchKey): AirwayBranch {
  const origin = AIRWAY_TREE.find(
    (branch) =>
      branch.key === key && (branch.parent === null || BY_ID.get(branch.parent)!.key !== key),
  )
  if (!origin) throw new Error(`The course CT has no branch named ${key}.`)
  return origin
}

/**
 * The centreline of a bronchus from its origin, following its widest continuation, for about
 * `lengthMm`. This is the stem a bronchoscopist would call "the bronchus", without its branches.
 */
export function airwayStem(key: AirwayBranchKey, lengthMm = 20): Point3[] {
  let branch = airwayOrigin(key)
  const points: Point3[] = [...branch.points]
  while (polylineLength(points) < lengthMm) {
    const next = (CHILDREN.get(branch.id) ?? [])
      .filter((child) => child.key === key)
      .sort((a, b) => b.radiusMm - a.radiusMm)[0]
    if (!next) break
    points.push(...next.points.slice(1))
    branch = next
  }
  return points
}

export interface AirwayCourse {
  readonly origin: Point3
  /** Unit vector of the stem, origin to its end: [toward the left, anterior, superior]. */
  readonly direction: Point3
  /**
   * How much of the stem runs front to back, 0 to 1. On a frontal image that part is along the
   * beam and is not seen as length: a bronchus near 1 is drawn short.
   */
  readonly alongFrontalBeam: number
}

export function airwayCourse(key: AirwayBranchKey, lengthMm = 20): AirwayCourse {
  const stem = airwayStem(key, lengthMm)
  const origin = stem[0],
    end = stem[stem.length - 1]
  const span = distance(origin, end) || 1
  const direction = end.map((value, axis) => (value - origin[axis]) / span) as Point3
  return { origin, direction, alongFrontalBeam: Math.abs(direction[1]) }
}

/** How much of a bronchus's stem runs along the beam at this angle, 0 to 1. */
export function airwayAlongBeam(key: AirwayBranchKey, orbit: number, tilt = 0): number {
  const { direction } = airwayCourse(key)
  const beam = beamDirection(orbit, tilt)
  return Math.abs(direction[0] * beam[0] + direction[1] * beam[1] + direction[2] * beam[2])
}

/** The segmental bronchus of a lobe that lies most nearly along the beam, and by how much. */
export function mostForeshortened(lobe: AirwayLobeKey, orbit: number, tilt = 0) {
  return AIRWAY_SEGMENTS_BY_LOBE[lobe]
    .map((key) => ({ key, along: airwayAlongBeam(key, orbit, tilt) }))
    .sort((a, b) => b.along - a.along)[0]
}

/** Trachea to `branch`, in order. */
export function airwayPathTo(branch: AirwayBranch): AirwayBranch[] {
  const path: AirwayBranch[] = []
  for (
    let at: AirwayBranch | undefined = branch;
    at;
    at = at.parent === null ? undefined : BY_ID.get(at.parent)
  )
    path.unshift(at)
  return path
}

/** The branch whose centreline passes closest to `point`, and how close. */
export function nearestAirway(point: Point3): { branch: AirwayBranch; distanceMm: number } {
  let best = AIRWAY_TREE[0],
    bestDistance = Infinity
  for (const branch of AIRWAY_TREE)
    for (let i = 1; i < branch.points.length; i++) {
      const a = branch.points[i - 1],
        b = branch.points[i]
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const t = Math.min(
        1,
        Math.max(
          0,
          ((point[0] - a[0]) * ab[0] + (point[1] - a[1]) * ab[1] + (point[2] - a[2]) * ab[2]) /
            (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1),
        ),
      )
      const d = distance(point, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])
      if (d < bestDistance) {
        best = branch
        bestDistance = d
      }
    }
  return { branch: best, distanceMm: bestDistance }
}

/** The named bronchi on the way to `branch`, without repeats: "Trachea", "LMB", … */
export function airwayRouteKeys(branch: AirwayBranch): AirwayBranchKey[] {
  const keys: AirwayBranchKey[] = []
  for (const step of airwayPathTo(branch))
    if (keys[keys.length - 1] !== step.key) keys.push(step.key)
  return keys
}

/** Where the label of a bronchus goes: the far end of its longest run. */
export function airwayLabelAnchor(key: AirwayBranchKey): Point3 {
  const origin = airwayOrigin(key)
  if (AIRWAY_BRANCHES[key].level !== 'segment') {
    // A central bronchus is labelled at its middle, clear of the branches at either end.
    const stem = airwayStem(key, Infinity)
    const half = polylineLength(stem) / 2
    let run = 0
    for (let i = 1; i < stem.length; i++) {
      const step = distance(stem[i - 1], stem[i])
      if (run + step >= half) {
        const t = (half - run) / (step || 1)
        return stem[i - 1].map((value, axis) => value + (stem[i][axis] - value) * t) as Point3
      }
      run += step
    }
    return stem[stem.length - 1]
  }
  let far = origin.points[origin.points.length - 1],
    farLength = 0
  const walk = (branch: AirwayBranch, length: number) => {
    const total = length + polylineLength(branch.points)
    if (total > farLength) {
      farLength = total
      far = branch.points[branch.points.length - 1]
    }
    for (const child of CHILDREN.get(branch.id) ?? []) if (child.key === key) walk(child, total)
  }
  walk(origin, 0)
  return far
}

export const AIRWAY_SEGMENTS_BY_LOBE: Readonly<Record<AirwayLobeKey, readonly AirwaySegmentKey[]>> =
  {
    RUL: ['RB1', 'RB2', 'RB3'],
    RML: ['RB4', 'RB5'],
    RLL: ['RB6', 'RB7', 'RB8', 'RB9', 'RB10'],
    LUL: ['LB1+2', 'LB3', 'LB4', 'LB5'],
    LLL: ['LB6', 'LB7+8', 'LB9', 'LB10'],
  }

/**
 * One colour per lobe for the whole tree, and one per segment inside a lobe. The same colours are
 * used on the image, in the 3D view and in the legend, so a bronchus is one colour everywhere.
 */
export const AIRWAY_LOBE_COLORS: Readonly<Record<AirwayLobeKey, string>> = {
  RUL: '#f2b25c',
  RML: '#7fd6a4',
  RLL: '#6fb7f0',
  LUL: '#f08fb4',
  LLL: '#c7a6f5',
}
export const AIRWAY_CENTRAL_COLOR = '#e6efe9'
const SEGMENT_COLORS = ['#f2b25c', '#6fd3e0', '#f08fb4', '#a8e06c', '#c7a6f5'] as const

export function airwayColor(branch: AirwayBranch, show: AirwayShow): string | null {
  if (show === 'off') return null
  const lobe = lobeOfBranch(branch)
  if (show === 'all') return lobe ? AIRWAY_LOBE_COLORS[lobe] : AIRWAY_CENTRAL_COLOR
  if (lobe !== show) return null
  const index = (AIRWAY_SEGMENTS_BY_LOBE[show] as readonly string[]).indexOf(branch.key)
  return index < 0 ? AIRWAY_CENTRAL_COLOR : SEGMENT_COLORS[index % SEGMENT_COLORS.length]
}

/** The names drawn for a setting, each with its colour: lobes for the whole tree, segments for a lobe. */
export function airwayLegend(
  show: AirwayShow,
): readonly { key: string; label: string; color: string }[] {
  if (show === 'off') return []
  if (show === 'all')
    return AIRWAY_LOBE_KEYS.map((lobe) => ({
      key: lobe,
      label: lobe,
      color: AIRWAY_LOBE_COLORS[lobe],
    }))
  return AIRWAY_SEGMENTS_BY_LOBE[show].map((segment, index) => ({
    key: segment,
    label: segment,
    color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
  }))
}
