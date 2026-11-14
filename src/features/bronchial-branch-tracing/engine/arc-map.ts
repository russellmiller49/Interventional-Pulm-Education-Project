import type { CtNoduleTarget, CtTrace } from '../content/ct-types'
import { dot, normalize, type Vec3 } from '../geometry/coordinates'
import { nextBranches } from '../geometry/astray'
import { edgePoints } from '../geometry/paired-scope'
import type { CameraBasis } from '../geometry/reference-frames'
import { stationCamera } from '../geometry/route-stations'
import { routeOption } from './nav-session'

/**
 * The nested-arc map of Mortimer and Saghaie's simplified branch tracing.
 *
 * The map is drawn in one fixed frame: the scope at the ostium of the segmental bronchus, looking
 * in. Its rim carries four anatomical directions. Each division from there to the lesion is drawn
 * as arcs inside the arc of the branch before it, at the side that branch's daughters leave toward,
 * read in that same frame. Everything here is patient space and the route geometry; nothing reads
 * the learner's CT display.
 */

export type Anatomical = 'superior' | 'inferior' | 'medial' | 'lateral' | 'anterior' | 'posterior'
export const ANATOMICAL: readonly Anatomical[] = [
  'superior',
  'inferior',
  'medial',
  'lateral',
  'anterior',
  'posterior',
]
export const OPPOSITE: Readonly<Record<Anatomical, Anatomical>> = {
  superior: 'inferior',
  inferior: 'superior',
  medial: 'lateral',
  lateral: 'medial',
  anterior: 'posterior',
  posterior: 'anterior',
}

export type LungSide = 'right' | 'left'
/** Which lung a route ends in, from its main bronchus. */
export function lungSide(trace: CtTrace): LungSide {
  const main = trace.airwayPath.find((airway) => /MSB$/.test(airway.code))
  if (!main) throw new Error(`Route ${trace.id} has no main bronchus`)
  return main.code.startsWith('R') ? 'right' : 'left'
}

/** The patient-space vector of an anatomical direction (LPS: x left, y posterior, z superior). */
export function anatomicalVector(word: Anatomical, side: LungSide): Vec3 {
  const medial = side === 'right' ? 1 : -1
  switch (word) {
    case 'superior':
      return [0, 0, 1]
    case 'inferior':
      return [0, 0, -1]
    case 'anterior':
      return [0, -1, 0]
    case 'posterior':
      return [0, 1, 0]
    case 'medial':
      return [medial, 0, 0]
    case 'lateral':
      return [-medial, 0, 0]
  }
}

/** The four rim positions of the ostium circle, clockwise from the top. */
export type Rim = 'top' | 'right' | 'bottom' | 'left'
export const RIMS: readonly Rim[] = ['top', 'right', 'bottom', 'left']

/**
 * Eight places around a circle, clockwise from the top: 0 top, 2 right, 4 bottom, 6 left. A branch
 * is placed in one of these; a rim word sits on the even ones.
 */
export type Sector = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
export const SECTORS: readonly Sector[] = [0, 1, 2, 3, 4, 5, 6, 7]
export const sectorAngle = (sector: Sector) => sector * 45
export const rimSector: Readonly<Record<Rim, Sector>> = { top: 0, right: 2, bottom: 4, left: 6 }

/** Below this, a second anatomical word is as true of a rim position as the first. */
export const RIM_TIE = 0.15

export interface RimWord {
  /** The anatomical direction that lies nearest this rim position. */
  word: Anatomical
  /** A second direction nearly as near: the position is between the two. */
  also: Anatomical | null
  /** How much of `word` lies across the view at this position, 0–1. */
  strength: number
}
export interface OstiumFrame {
  checkpointIndex: number
  side: LungSide
  basis: CameraBasis
  rim: Record<Rim, RimWord>
  /** The direction the scope looks into the segment, in anatomical words. */
  into: Anatomical
}

/**
 * The segmental bronchus's first division on a route: the first fork whose parent is the
 * segment's own bronchus. The map starts there; null when the route never enters that segment.
 */
export function segmentalForkIndex(trace: CtTrace, segmentCode: string): number | null {
  const index = trace.checkpoints.findIndex(
    (checkpoint) => checkpoint.decision?.parent.airway.code === segmentCode,
  )
  return index >= 0 ? index : null
}

/** Every division the map draws: from the segment's first division to the route's last. */
export function mappedForks(trace: CtTrace, target: CtNoduleTarget): number[] {
  const first = segmentalForkIndex(trace, target.segment.bronchusCode)
  if (first === null) return []
  return trace.checkpoints
    .map((checkpoint, index) => (index >= first && checkpoint.decision ? index : -1))
    .filter((index) => index >= 0)
}

function rimWord(direction: Vec3, side: LungSide): RimWord {
  const scored = ANATOMICAL.map((word) => ({
    word,
    score: dot(anatomicalVector(word, side), direction),
  })).sort((a, b) => b.score - a.score)
  const [first, second] = scored
  return {
    word: first.word,
    also: first.score - second.score < RIM_TIE ? second.word : null,
    strength: first.score,
  }
}

const frames = new Map<string, OstiumFrame | null>()
/**
 * The ostium circle at a division: the scope waiting at the segment's first division, as the
 * station camera stands there. Its up, right, down and left, named in anatomical words.
 */
export function ostiumFrame(trace: CtTrace, checkpointIndex: number): OstiumFrame | null {
  const key = `${trace.id}:${checkpointIndex}`
  if (frames.has(key)) return frames.get(key)!
  const camera = stationCamera(trace, checkpointIndex)
  let frame: OstiumFrame | null = null
  if (camera) {
    const side = lungSide(trace)
    const { basis } = camera
    const neg = (v: Vec3): Vec3 => [-v[0], -v[1], -v[2]]
    frame = {
      checkpointIndex,
      side,
      basis,
      rim: {
        top: rimWord(basis.up, side),
        right: rimWord(basis.right, side),
        bottom: rimWord(neg(basis.up), side),
        left: rimWord(neg(basis.right), side),
      },
      into: rimWord(basis.forward, side).word,
    }
  }
  frames.set(key, frame)
  return frame
}

/** How far along a daughter its direction is read: past the fork's own curvature. */
export const BEARING_DEPTH_MM = 6
/** Below this share of a branch's separation lying across the view, its side is uncertain. */
export const BEARING_IN_VIEW = 0.35

/** A point `depth` millimetres along a polyline from its start, clamped to its end. */
export function pointAlong(points: readonly Vec3[], depth: number): Vec3 {
  let left = depth
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    const span = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    if (span >= left && span > 0) {
      const f = left / span
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    }
    left -= span
  }
  return points[points.length - 1]
}

export interface Bearing {
  index: number
  /** Clockwise from the top of the map, degrees 0–360. */
  angle: number
  /** The nearest of the eight places. */
  sector: Sector
  /** How much of this branch's separation from its siblings lies across the map, 0–1. */
  inView: number
  /** True when that is below `BEARING_IN_VIEW`: the branches separate mostly along the view. */
  uncertain: boolean
  onRoute: boolean
}

export const angleSector = (angle: number): Sector =>
  (Math.round((((angle % 360) + 360) % 360) / 45) % 8) as Sector

/** Each daughter's direction from the fork, read along its centreline. */
export function daughterDirections(trace: CtTrace, checkpointIndex: number): Vec3[] {
  const decision = trace.checkpoints[checkpointIndex]?.decision
  if (!decision) return []
  const fork = decision.junctionLps
  return decision.options.map((option) => {
    const points = edgePoints(option.sourceEdgeId)
    const reach = points ? pointAlong(points, BEARING_DEPTH_MM) : option.lps
    return normalize([reach[0] - fork[0], reach[1] - fork[1], reach[2] - fork[2]])
  })
}

/**
 * Where each daughter of a division is drawn on the map: its direction relative to its siblings
 * (its own direction minus their mean), laid across the ostium frame. Relative, because the
 * method draws each branch "in the approximate position relative to the other branch(es)".
 */
export function branchBearings(
  trace: CtTrace,
  checkpointIndex: number,
  frame: OstiumFrame,
): Bearing[] {
  const directions = daughterDirections(trace, checkpointIndex)
  if (!directions.length) return []
  const mean = [0, 1, 2].map(
    (axis) => directions.reduce((sum, d) => sum + d[axis], 0) / directions.length,
  )
  const route = routeOption(trace, checkpointIndex)
  return directions.map((direction, index) => {
    const relative: Vec3 = [direction[0] - mean[0], direction[1] - mean[1], direction[2] - mean[2]]
    const length = Math.hypot(...relative) || 1
    const x = dot(relative, frame.basis.right)
    const y = dot(relative, frame.basis.up)
    const angle = ((((Math.atan2(x, y) * 180) / Math.PI) % 360) + 360) % 360
    const inView = Math.hypot(x, y) / length
    return {
      index,
      angle,
      sector: angleSector(angle),
      inView,
      uncertain: inView < BEARING_IN_VIEW,
      onRoute: index === route,
    }
  })
}

/**
 * Where the next division of a daughter the route does not take would be drawn, in the same
 * frame: one generation inside that daughter's arc. Mortimer and Saghaie draw a generation inside
 * the branches that do not lead to the target, so that a wrong turn shows a division the map
 * does not expect. Empty where the airway model ends in that daughter.
 */
export function referenceAngles(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
  frame: OstiumFrame,
): number[] {
  const option = trace.checkpoints[checkpointIndex]?.decision?.options[optionIndex]
  const branches = option ? nextBranches(option.sourceEdgeId) : []
  if (branches.length < 2) return []
  const directions = branches.map((branch) => {
    const start = branch.points[0]
    const reach = pointAlong(branch.points, BEARING_DEPTH_MM)
    return normalize([reach[0] - start[0], reach[1] - start[1], reach[2] - start[2]])
  })
  const mean = [0, 1, 2].map(
    (axis) => directions.reduce((sum, d) => sum + d[axis], 0) / directions.length,
  )
  return directions.map((direction) => {
    const relative: Vec3 = [direction[0] - mean[0], direction[1] - mean[1], direction[2] - mean[2]]
    const x = dot(relative, frame.basis.right)
    const y = dot(relative, frame.basis.up)
    return ((((Math.atan2(x, y) * 180) / Math.PI) % 360) + 360) % 360
  })
}

// ── The learner's frame ───────────────────────────────────────────────────────────────────────

export type FrameLabels = Record<Rim, Anatomical | null>
export type QuarterTurn = 0 | 1 | 2 | 3
export interface FrameGrade {
  /** Every rim position has a word. */
  complete: boolean
  /** The four words are the ostium's, in some roll, and not mirrored. */
  ok: boolean
  /**
   * How far the learner's circle is turned from the model scope's, in quarter turns clockwise:
   * the model's top sits at the learner's `RIMS[turn]`. The best fit when `ok` is false.
   */
  turn: QuarterTurn
  /** The words fit a mirror image of the ostium: the left and right are swapped. */
  mirrored: boolean
  /** Rim positions whose word does not fit the best arrangement. */
  off: Rim[]
}

const fitsWord = (word: Anatomical | null, rim: RimWord) =>
  word !== null && (word === rim.word || word === rim.also)

const TURNS: readonly QuarterTurn[] = [0, 1, 2, 3]

/** The model scope's rim as it sits on a circle turned `turn` quarter turns clockwise. */
export function turnedRim(rim: Record<Rim, RimWord>, turn: QuarterTurn): Record<Rim, RimWord> {
  const out = {} as Record<Rim, RimWord>
  RIMS.forEach((position, i) => {
    out[RIMS[(i + turn) % 4]] = rim[position]
  })
  return out
}
const mirrorRim = (rim: Record<Rim, RimWord>): Record<Rim, RimWord> => ({
  top: rim.top,
  right: rim.left,
  bottom: rim.bottom,
  left: rim.right,
})
const offFor = (labels: FrameLabels, rim: Record<Rim, RimWord>) =>
  RIMS.filter((position) => !fitsWord(labels[position], rim[position]))

/**
 * Whether four rim words describe the ostium. Any roll is accepted, because how far the scope is
 * turned is the operator's choice; a mirror image is not, because the view's handedness is fixed.
 */
export function gradeFrame(frame: OstiumFrame, labels: FrameLabels): FrameGrade {
  const complete = RIMS.every((position) => labels[position] !== null)
  let best = { turn: 0 as QuarterTurn, off: RIMS.slice() as Rim[] }
  for (const turn of TURNS) {
    const off = offFor(labels, turnedRim(frame.rim, turn))
    if (off.length < best.off.length) best = { turn, off }
  }
  const mirrored =
    complete &&
    best.off.length > 0 &&
    TURNS.some((turn) => offFor(labels, turnedRim(mirrorRim(frame.rim), turn)).length === 0)
  return { complete, ok: complete && best.off.length === 0, ...best, mirrored }
}

// ── The learner's arcs ────────────────────────────────────────────────────────────────────────

/** A branch drawn in the same or a neighbouring place counts: the map need not be exact. */
export const ARC_TOLERANCE_DEG = 67.5

export const angleGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return Math.min(d, 360 - d)
}

/** The bearings as drawn on a circle turned `turn` quarter turns from the model scope's. */
export const turnBearings = (bearings: readonly Bearing[], turn: QuarterTurn): Bearing[] =>
  bearings.map((bearing) => {
    const angle = (bearing.angle + turn * 90) % 360
    return { ...bearing, angle, sector: angleSector(angle) }
  })

function permutations(n: number): number[][] {
  if (n <= 1) return [[0]].slice(0, n)
  const out: number[][] = []
  const walk = (prefix: number[]) => {
    if (prefix.length === n) return void out.push(prefix)
    for (let i = 0; i < n; i++) if (!prefix.includes(i)) walk([...prefix, i])
  }
  walk([])
  return out
}

export interface ArcGrade {
  /** As many branches drawn as the division has. */
  countOk: boolean
  /** Every branch drawn within tolerance, and the one marked as leading on is the route's. */
  ok: boolean
  /** For each drawn branch, the daughter it is read as: the closest overall fit. */
  assignment: number[]
  /** Drawn branches more than `ARC_TOLERANCE_DEG` from the daughter they are read as. */
  off: number[]
  /** The branch marked as leading to the lesion is the route's own; null when none is marked. */
  leadsOnOk: boolean | null
}

/**
 * Whether drawn branches match a division. The learner does not say which drawn branch is which
 * daughter: each is read as the daughter that gives the closest fit overall.
 */
export function gradeArcs(
  bearings: readonly Bearing[],
  placed: readonly Sector[],
  leadsOn: number | null,
): ArcGrade {
  const countOk = placed.length === bearings.length
  if (!countOk) return { countOk, ok: false, assignment: [], off: [], leadsOnOk: null }
  let best: { cost: number; order: number[] } | null = null
  for (const order of permutations(placed.length)) {
    const cost = order.reduce(
      (sum, daughter, i) => sum + angleGap(sectorAngle(placed[i]), bearings[daughter].angle),
      0,
    )
    if (!best || cost < best.cost) best = { cost, order }
  }
  const assignment = best!.order
  const off = assignment
    .map((daughter, i) => ({ daughter, i }))
    .filter(
      ({ daughter, i }) =>
        !bearings[daughter].uncertain &&
        angleGap(sectorAngle(placed[i]), bearings[daughter].angle) > ARC_TOLERANCE_DEG,
    )
    .map(({ i }) => i)
  const route = bearings.findIndex((bearing) => bearing.onRoute)
  const leadsOnOk = leadsOn === null ? null : assignment[leadsOn] === route
  return { countOk, ok: off.length === 0 && leadsOnOk === true, assignment, off, leadsOnOk }
}

// ── Drawing the map ───────────────────────────────────────────────────────────────────────────

export interface Circle {
  cx: number
  cy: number
  r: number
}
export interface MapRegion {
  id: string
  /** One generation inside a branch the route does not take, drawn for reference only. */
  reference?: boolean
  /** The model's own arc for a branch of this division, laid over the learner's for comparison. */
  ghost?: boolean
  /** Which division of the map this branch comes from, 0 first; null for the ostium itself. */
  level: number | null
  /** The daughter, in the division's own order. */
  daughter: number | null
  parent: string | null
  /** The circle that cuts this branch out of its parent; its edge inside the parent is the arc. */
  cut: Circle | null
  /** The largest circle inside the branch: where its own division is drawn. */
  inner: Circle
  /** The branch the route continues in. */
  onRoute: boolean
  /** The last branch toward the lesion: it carries the star. */
  target: boolean
}
export interface MapLevel {
  /** Clockwise from the top, degrees, one per daughter. */
  angles: readonly number[]
  /** The daughter the route continues in; null when the map stops here. */
  route: number | null
  /** For each daughter the route does not take, where its own next division would be drawn. */
  references?: readonly (readonly number[])[]
  /**
   * The model's angles for this division's branches, drawn as extra arcs in the same parent for
   * comparison. They take no part in the nesting: the next division is still drawn inside the
   * learner's own branch.
   */
  ghost?: readonly number[]
}

/** How deep into its parent a branch reaches, as a share of the parent's inner diameter. */
const BRANCH_DEPTH = { two: 0.44, three: 0.38 }
/** The cutting circle's radius, as a multiple of the parent's inner radius: a gentle arc. */
const CUT_SCALE = 1.25

const unitAt = (angle: number): [number, number] => {
  const a = (angle * Math.PI) / 180
  return [Math.sin(a), -Math.cos(a)]
}

/**
 * The nested arcs. The ostium is a circle of radius 1 at the origin, y down. Each division cuts
 * its daughters from the branch before it with circles centred outside, toward each daughter's
 * side, so every daughter shows as an arc whose ends meet its parent's outline; the next division
 * is drawn inside the daughter the route continues in.
 */
export function layoutArcMap(levels: readonly MapLevel[]): MapRegion[] {
  const root: MapRegion = {
    id: 'ostium',
    level: null,
    daughter: null,
    parent: null,
    cut: null,
    inner: { cx: 0, cy: 0, r: 1 },
    onRoute: true,
    target: false,
  }
  const regions = [root]
  let parent: MapRegion | null = root
  levels.forEach((level, index) => {
    if (!parent) return
    const { cx, cy, r } = parent.inner
    const share = level.angles.length > 2 ? BRANCH_DEPTH.three : BRANCH_DEPTH.two
    let next: MapRegion | null = null
    level.angles.forEach((angle, daughter) => {
      const [ux, uy] = unitAt(angle)
      const cutR = r * CUT_SCALE
      const cutAt = r * (1 - 2 * share) + cutR
      const innerAt = r * (1 - share)
      const region: MapRegion = {
        id: `${index}:${daughter}`,
        level: index,
        daughter,
        parent: parent!.id,
        cut: { cx: cx + ux * cutAt, cy: cy + uy * cutAt, r: cutR },
        inner: { cx: cx + ux * innerAt, cy: cy + uy * innerAt, r: r * share * 0.92 },
        onRoute: level.route === daughter,
        target: level.route === daughter && index === levels.length - 1,
      }
      regions.push(region)
      if (region.onRoute) next = region
      // One generation inside a branch the route does not take, for reference.
      const inside = level.references?.[daughter] ?? []
      if (!region.onRoute && inside.length > 1) {
        const r2 = region.inner.r
        const share2 = inside.length > 2 ? BRANCH_DEPTH.three : BRANCH_DEPTH.two
        inside.forEach((angle2, child) => {
          const [vx, vy] = unitAt(angle2)
          const cutR2 = r2 * CUT_SCALE
          const cutAt2 = r2 * (1 - 2 * share2) + cutR2
          const innerAt2 = r2 * (1 - share2)
          regions.push({
            id: `${index}:${daughter}:${child}`,
            level: index,
            daughter,
            parent: region.id,
            cut: { cx: region.inner.cx + vx * cutAt2, cy: region.inner.cy + vy * cutAt2, r: cutR2 },
            inner: {
              cx: region.inner.cx + vx * innerAt2,
              cy: region.inner.cy + vy * innerAt2,
              r: r2 * share2 * 0.92,
            },
            onRoute: false,
            target: false,
            reference: true,
          })
        })
      }
    })
    // The model's arcs for this division, cut from the same parent the learner's are.
    ;(level.ghost ?? []).forEach((angle, k) => {
      const [ux, uy] = unitAt(angle)
      const ghostShare = (level.ghost?.length ?? 2) > 2 ? BRANCH_DEPTH.three : BRANCH_DEPTH.two
      const cutR = r * CUT_SCALE
      const cutAt = r * (1 - 2 * ghostShare) + cutR
      const innerAt = r * (1 - ghostShare)
      regions.push({
        id: `${index}:g${k}`,
        level: index,
        daughter: null,
        parent: parent!.id,
        cut: { cx: cx + ux * cutAt, cy: cy + uy * cutAt, r: cutR },
        inner: { cx: cx + ux * innerAt, cy: cy + uy * innerAt, r: r * ghostShare * 0.92 },
        onRoute: false,
        target: false,
        ghost: true,
      })
    })
    parent = next
  })
  return regions
}

/**
 * The learner's map with the model's arcs laid over it, division by division: where a learner's
 * arc and the model's sit a place apart, both are in the picture.
 */
export function withGhost(learner: readonly MapLevel[], model: readonly MapLevel[]): MapLevel[] {
  return learner.map((level, d) => (model[d] ? { ...level, ghost: model[d].angles } : level))
}

/** The chain of regions from the ostium to a region, outermost first: what clips its arc. */
export function regionAncestry(regions: readonly MapRegion[], id: string): MapRegion[] {
  const byId = new Map(regions.map((region) => [region.id, region]))
  const chain: MapRegion[] = []
  for (let at = byId.get(id); at; at = at.parent ? byId.get(at.parent) : undefined)
    chain.unshift(at)
  return chain
}

/**
 * How far to turn a map drawn in the ostium frame so it sits as the scope now shows it, in
 * degrees clockwise. The scope's roll changes as it is turned into each branch; the method's
 * answer is to turn the map, or the scope, to match. `reliable` is false when the map's own
 * directions lie mostly along the scope's line of sight here.
 */
export function mapTurnToScope(
  frame: OstiumFrame,
  turn: QuarterTurn,
  basis: CameraBasis,
): { angle: number; reliable: boolean } {
  const { up, right } = frame.basis
  const q = (turn * Math.PI) / 2
  // The patient directions at the top and right of the learner's turned circle.
  const top: Vec3 = [0, 1, 2].map((i) => up[i] * Math.cos(q) - right[i] * Math.sin(q)) as Vec3
  const side: Vec3 = [0, 1, 2].map((i) => right[i] * Math.cos(q) + up[i] * Math.sin(q)) as Vec3
  const read = (v: Vec3) => ({ x: dot(v, basis.right), y: dot(v, basis.up) })
  const a = read(top),
    b = read(side)
  const useTop = Math.hypot(a.x, a.y) >= Math.hypot(b.x, b.y)
  const v = useTop ? a : b
  const raw = (Math.atan2(v.x, v.y) * 180) / Math.PI - (useTop ? 0 : 90)
  return { angle: ((raw % 360) + 360) % 360, reliable: Math.hypot(v.x, v.y) >= 0.5 }
}

/**
 * The model map for a lesion, drawn on a circle turned `turn` quarter turns from the model scope's:
 * every division's branches where they leave, the route's branch at each, and a reference
 * generation inside each branch the route does not take.
 */
export function modelMapLevels(
  trace: CtTrace,
  target: CtNoduleTarget,
  turn: QuarterTurn,
): MapLevel[] {
  const forks = mappedForks(trace, target)
  const frame = forks.length ? ostiumFrame(trace, forks[0]) : null
  if (!frame) return []
  const spin = (angle: number) => (angle + turn * 90) % 360
  return forks.map((ci) => {
    const bearings = branchBearings(trace, ci, frame)
    return {
      angles: bearings.map((b) => spin(b.angle)),
      route: routeOption(trace, ci),
      references: bearings.map((b) =>
        b.onRoute ? [] : referenceAngles(trace, ci, b.index, frame).map(spin),
      ),
    }
  })
}

/**
 * The learner's own map with the model's reference generations added: each drawn branch is read
 * as the daughter it fits best, and carries that daughter's reference arcs.
 */
export function withReferences(
  learner: readonly MapLevel[],
  model: readonly MapLevel[],
): MapLevel[] {
  return learner.map((level, d) => {
    const truth = model[d]
    if (!truth || level.angles.length !== truth.angles.length) return level
    const bearings: Bearing[] = truth.angles.map((angle, index) => ({
      index,
      angle,
      sector: angleSector(angle),
      inView: 1,
      uncertain: false,
      onRoute: index === truth.route,
    }))
    const grade = gradeArcs(
      bearings,
      level.angles.map((angle) => angleSector(angle)),
      level.route,
    )
    return {
      ...level,
      references: level.angles.map((_, i) =>
        i === level.route ? [] : (truth.references?.[grade.assignment[i]] ?? []),
      ),
    }
  })
}
