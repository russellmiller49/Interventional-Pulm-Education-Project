import { AIRWAY_BRANCHES, type AirwayBranchKey } from '../content/airwayNames'
import { AIRWAY_TREE, airwayPathTo, type AirwayBranch } from './airwayTree'
import { LESION_CENTER, projectToDetector, type Point3 } from './physics'

/**
 * The drill "Where is the nodule from the catheter tip?": the catheter is parked in a bronchus
 * near the course nodule that does not reach it, the C-arm turns no more than 30° either way, and
 * the learner says whether the nodule lies in front of or behind the tip, and medial or lateral to
 * it. It is FluoroView's nodule quiz on the course CT.
 *
 * The nodule is part of the CT the image is made from, so it stays where it is and the catheter
 * moves. Each position is a point on the named airway tree; everything said about it — the
 * bronchus, the answer, the distances, which way the nodule moves on the image — is computed here
 * from that point, and `airway-drill.test.ts` holds the copy to it.
 */
export type DrillDepth = 'anterior' | 'posterior'
export type DrillSide = 'medial' | 'lateral'
export type DrillAnswer = `${DrillDepth}-${DrillSide}`

export const DRILL_ANSWERS: readonly DrillAnswer[] = [
  'anterior-medial',
  'anterior-lateral',
  'posterior-medial',
  'posterior-lateral',
]

/** How far the C-arm turns in the drill, each way: enough for parallax, short of a lateral view. */
export const DRILL_ORBIT_LIMIT = 30

/** The value of the hidden `drillCase` lab key when no catheter is drawn. */
export const NO_DRILL_CASE = 'none'

interface DrillDefinition {
  /** Neutral on purpose: the address of a position must not name its bronchus or its answer. */
  readonly id: string
  /** The branch of the airway tree the tip is in. */
  readonly branchId: number
}

/**
 * Eight positions, two for each answer, ordered so that no answer follows itself. Each tip is the
 * far end of its branch: 14 to 45 mm from the nodule's centre, at least 12 mm in front of or behind
 * it and at least 10 mm medial or lateral to it, so neither half of the answer is a close call.
 */
const DEFINITIONS: readonly DrillDefinition[] = [
  { id: 'position-1', branchId: 51 },
  { id: 'position-2', branchId: 260 },
  { id: 'position-3', branchId: 295 },
  { id: 'position-4', branchId: 352 },
  { id: 'position-5', branchId: 25 },
  { id: 'position-6', branchId: 259 },
  { id: 'position-7', branchId: 385 },
  { id: 'position-8', branchId: 168 },
]

export interface AirwayDrillCase {
  readonly id: string
  /** 1-based place in the drill. */
  readonly number: number
  /** The named bronchus the tip is in. */
  readonly bronchus: AirwayBranchKey
  readonly tip: Point3
  /** Trachea to tip along the airway centrelines: the catheter as the image draws it. */
  readonly path: readonly Point3[]
  readonly answer: DrillAnswer
  /** Millimetres the nodule's centre lies in front of the tip (negative: behind it). */
  readonly anteriorMm: number
  /** Millimetres further from the midline than the tip the nodule lies (negative: nearer it). */
  readonly lateralMm: number
  /** Millimetres the nodule's centre lies above the tip (negative: below it). */
  readonly superiorMm: number
  readonly distanceMm: number
  /**
   * The last named bronchus the catheter shares with the way to the nodule: where it has to be
   * withdrawn to.
   */
  readonly sharedBronchus: AirwayBranchKey
}

const BY_BRANCH_ID = new Map(AIRWAY_TREE.map((branch) => [branch.id, branch]))

function centreline(path: readonly AirwayBranch[]): Point3[] {
  const points: Point3[] = []
  for (const branch of path)
    for (const point of branch.points) {
      const last = points[points.length - 1]
      if (!last || last.some((value, axis) => value !== point[axis])) points.push(point)
    }
  return points
}

function sharedBronchus(path: readonly AirwayBranch[], noduleKeys: readonly AirwayBranchKey[]) {
  let shared: AirwayBranchKey = 'trachea'
  for (const branch of path) if (noduleKeys.includes(branch.key)) shared = branch.key
  return shared
}

function buildCase(
  definition: DrillDefinition,
  index: number,
  noduleKeys: readonly AirwayBranchKey[],
): AirwayDrillCase {
  const branch = BY_BRANCH_ID.get(definition.branchId)
  if (!branch)
    throw new Error(`Drill ${definition.id}: the tree has no branch ${definition.branchId}.`)
  const path = airwayPathTo(branch)
  const tip = branch.points[branch.points.length - 1]
  const anteriorMm = LESION_CENTER[1] - tip[1]
  // Both are in the left lung; the midline is the middle of the CT, where the spine lies.
  const lateralMm = Math.abs(LESION_CENTER[0]) - Math.abs(tip[0])
  return {
    id: definition.id,
    number: index + 1,
    bronchus: branch.key,
    tip,
    path: centreline(path),
    answer: `${anteriorMm > 0 ? 'anterior' : 'posterior'}-${lateralMm > 0 ? 'lateral' : 'medial'}`,
    anteriorMm,
    lateralMm,
    superiorMm: LESION_CENTER[2] - tip[2],
    distanceMm: Math.hypot(...tip.map((value, axis) => LESION_CENTER[axis] - value)),
    sharedBronchus: sharedBronchus(path, noduleKeys),
  }
}

/** The named bronchi on the way to the nodule, trachea first. */
function noduleBronchi(): AirwayBranchKey[] {
  let best: AirwayBranch = AIRWAY_TREE[0],
    bestDistance = Infinity
  for (const branch of AIRWAY_TREE)
    for (const point of branch.points) {
      const distance = Math.hypot(...point.map((value, axis) => LESION_CENTER[axis] - value))
      if (distance < bestDistance) {
        best = branch
        bestDistance = distance
      }
    }
  return [...new Set(airwayPathTo(best).map((branch) => branch.key))]
}

const NODULE_BRONCHI = noduleBronchi()

export const AIRWAY_DRILL_CASES: readonly AirwayDrillCase[] = DEFINITIONS.map((definition, index) =>
  buildCase(definition, index, NODULE_BRONCHI),
)

const BY_ID = new Map(AIRWAY_DRILL_CASES.map((entry) => [entry.id, entry]))

export const airwayDrillCase = (id: unknown): AirwayDrillCase | undefined =>
  typeof id === 'string' ? BY_ID.get(id) : undefined

/** The segmental bronchus the nodule is reached through. */
export const DRILL_NODULE_BRONCHUS: AirwayBranchKey =
  [...NODULE_BRONCHI].reverse().find((key) => AIRWAY_BRANCHES[key].level === 'segment') ??
  NODULE_BRONCHI[NODULE_BRONCHI.length - 1]

/**
 * How far the nodule has moved on the detector against the tip since the frontal image, in
 * detector millimetres toward the patient's left. In the left lung that is toward the chest wall;
 * negative is toward the midline.
 */
export function drillShift(entry: AirwayDrillCase, orbit: number, tilt = 0): number {
  const between = (angle: number) =>
    projectToDetector(LESION_CENTER, angle, tilt)[0] - projectToDetector(entry.tip, angle, tilt)[0]
  return between(orbit) - between(0)
}

/** On the frontal image: is the nodule drawn further from the midline than the tip? */
export function drillFrontalSide(entry: AirwayDrillCase): DrillSide {
  return Math.abs(projectToDetector(LESION_CENTER, 0, 0)[0]) >
    Math.abs(projectToDetector(entry.tip, 0, 0)[0])
    ? 'lateral'
    : 'medial'
}
