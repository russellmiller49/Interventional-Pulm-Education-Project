import airPlanes from '../geometry/answer-plane-air.json'
import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import type { AirwayLabel, CtMark, LocalCtExercise } from '../content/ct-types'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'

/**
 * Comparison between a learner's checked marks and the model locators on the same axial plane.
 * It reports where a mark sits relative to named model airways, in millimetres, and, where the
 * answer plane has an air mask, which lumen the mark is in (`markVerdict`). It never moves a mark.
 */
export type LocatorRole = 'intended' | 'daughter' | 'parent' | 'other'
export interface ModelLocator {
  edgeId: number
  airway: AirwayLabel
  role: LocatorRole
  /** Native CT pixels on the mark's slice. */
  pixel: [number, number]
}
export interface LocatorDistance {
  locator: ModelLocator
  mm: number
}
export type MarkStatus = 'unresolved' | 'nearest-intended' | 'nearest-other'
export interface MarkComparison {
  slot: number
  label: string
  slice: number
  status: MarkStatus
  /** Null only for an unresolved response. */
  intended: LocatorDistance | null
  /** Other model airways crossing this slice, nearest first: this division's parent and other daughter, then one per unrelated airway code. */
  others: LocatorDistance[]
  /** The nearest of `others`, whatever its role. Null when no other locator crosses this slice. */
  nearestOther: LocatorDistance | null
  /**
   * The nearest other daughter of this same division, when one of them crosses this plane.
   * Sibling-specific feedback is written about this locator, never about `nearestOther`.
   */
  nearestSibling: LocatorDistance | null
  /** Distance between the intended locator and `nearestOther`, in millimetres on this plane. */
  spanMm: number | null
  /** The mark is farther from the intended locator than the two locators are from each other. */
  beyondSpan: boolean
  /** Which lumen the mark is in. Null for an unresolved response or a plane without a mask. */
  verdict: VerdictResult | null
}

/**
 * Where a mark is, read from the CT's own air:
 * - `intended-lumen`: in the air of the airway asked for;
 * - `near-fork`: in the same air column as the airway asked for, but on another airway's side of
 *   it (the lumens have not separated on this slice, or the mark is in the parent before the fork);
 * - `other-airway`: in a different named airway's lumen;
 * - `not-in-airway`: on wall, vessel or lung, or in air that joins no named airway nearby.
 */
export type MarkVerdict = 'intended-lumen' | 'near-fork' | 'other-airway' | 'not-in-airway'
export interface VerdictResult {
  verdict: MarkVerdict
  /** The mark, or a pixel within MARK_SNAP_MM of it, is air. */
  markInAir: boolean
  /** Named model airways whose lumen the mark's air region reaches, nearest first. */
  reached: LocatorDistance[]
  /** The reached airway nearest the mark; the one the mark is taken to be in. */
  nearest: ModelLocator | null
  /** Straight line from the mark to the intended locator on this slice. */
  toIntended: PlaneMove
}
/** Patient directions on an axial plane: +x is the patient's left, +y is posterior. */
export interface PlaneMove {
  mm: number
  leftMm: number
  posteriorMm: number
}

export const AIR_HU = airPlanes.airHu
/** The flood fill stops this far from the mark, so a leak cannot run across the lung. */
export const FILL_CAP_MM = airPlanes.capMm
/** A click on the wall of a 2 mm lumen still counts as that lumen. */
export const MARK_SNAP_MM = 1
/** A centreline sample may sit on the wall of a small lumen; its lumen is the air this close. */
export const LOCATOR_SNAP_MM = 1.5

export interface AirPlane {
  x0: number
  y0: number
  w: number
  h: number
  /** Row-major, 1 where the pixel is at or below AIR_HU. */
  air: Uint8Array
}
const decodedPlanes = new Map<number, AirPlane | null>()
/** The air mask for one answer slice, or null when none was generated for it. */
export function airPlane(slice: number): AirPlane | null {
  if (decodedPlanes.has(slice)) return decodedPlanes.get(slice)!
  const raw = (airPlanes.planes as Record<string, Omit<AirPlane, 'air'> & { runs: string }>)[
    String(slice)
  ]
  let plane: AirPlane | null = null
  if (raw) {
    const air = new Uint8Array(raw.w * raw.h)
    let at = 0,
      value = 0
    for (const run of raw.runs.split(' ')) {
      const length = Number(run)
      if (value) air.fill(1, at, at + length)
      at += length
      value = 1 - value
    }
    plane = { x0: raw.x0, y0: raw.y0, w: raw.w, h: raw.h, air }
  }
  decodedPlanes.set(slice, plane)
  return plane
}

const isAir = (plane: AirPlane, x: number, y: number) =>
  x >= plane.x0 &&
  y >= plane.y0 &&
  x < plane.x0 + plane.w &&
  y < plane.y0 + plane.h &&
  plane.air[(y - plane.y0) * plane.w + (x - plane.x0)] === 1

/** The air pixel nearest a point, no farther than `snapMm` from it; null when there is none. */
export function nearestAir(
  plane: AirPlane,
  pixel: readonly number[],
  snapMm: number,
): [number, number] | null {
  const reach = Math.ceil(snapMm / NATIVE_CT.spacing[0])
  const cx = Math.round(pixel[0]),
    cy = Math.round(pixel[1])
  let best: { mm: number; at: [number, number] } | null = null
  for (let y = cy - reach; y <= cy + reach; y++)
    for (let x = cx - reach; x <= cx + reach; x++) {
      if (!isAir(plane, x, y)) continue
      const mm = planeDistanceMm([x, y], pixel)
      // The pixel under the point always counts: a point inside a pixel is on that pixel.
      if ((x === cx && y === cy) || mm <= snapMm)
        if (!best || mm < best.mm) best = { mm, at: [x, y] }
    }
  return best?.at ?? null
}

/**
 * Four-connected air region around a seed pixel, limited to `capMm` from the seed. Returns the
 * set of pixels as `y * 512 + x`. An empty set means the seed is not air.
 */
export function floodFillAir(
  plane: AirPlane,
  seed: readonly [number, number],
  capMm: number,
): Set<number> {
  const region = new Set<number>()
  if (!isAir(plane, seed[0], seed[1])) return region
  const key = (x: number, y: number) => y * NATIVE_CT.size + x
  const stack: [number, number][] = [[seed[0], seed[1]]]
  region.add(key(seed[0], seed[1]))
  while (stack.length) {
    const [x, y] = stack.pop()!
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (region.has(key(nx, ny)) || !isAir(plane, nx, ny)) continue
      if (planeDistanceMm([nx, ny], seed) > capMm) continue
      region.add(key(nx, ny))
      stack.push([nx, ny])
    }
  }
  return region
}

const planeMove = (from: readonly number[], to: readonly number[]): PlaneMove => ({
  mm: planeDistanceMm(from, to),
  leftMm: (to[0] - from[0]) * NATIVE_CT.spacing[0],
  posteriorMm: (to[1] - from[1]) * NATIVE_CT.spacing[1],
})

/**
 * Which lumen a mark is in on its answer slice. The mark's air region is flood-filled out to
 * FILL_CAP_MM; a named airway is reached when the air at its model locator is part of that
 * region. The mark is taken to be in the reached airway whose locator is nearest.
 *
 * Returns null when no verdict can be given honestly: the slice has no air mask, or the intended
 * locator has no air within LOCATOR_SNAP_MM at this threshold.
 */
export function markVerdict(
  exercise: LocalCtExercise,
  slot: number,
  mark: CtMark | null | undefined,
): VerdictResult | null {
  const point = exercise.answerPoints[slot]
  if (!point || !mark?.pixel || mark.slice !== point.slice) return null
  const plane = airPlane(point.slice)
  if (!plane) return null
  // The mask covers the region around the answer. A mark outside it gets no verdict: an airway
  // out there would otherwise read as "not air".
  const mx = Math.round(mark.pixel[0]),
    my = Math.round(mark.pixel[1])
  if (mx < plane.x0 || my < plane.y0 || mx >= plane.x0 + plane.w || my >= plane.y0 + plane.h)
    return null
  const locators = slotLocators(exercise, slot)
  const intended = locators.find((l) => l.role === 'intended')
  if (!intended || !nearestAir(plane, intended.pixel, LOCATOR_SNAP_MM)) return null
  const toIntended = planeMove(mark.pixel, intended.pixel)
  const seed = nearestAir(plane, mark.pixel, MARK_SNAP_MM)
  if (!seed)
    return { verdict: 'not-in-airway', markInAir: false, reached: [], nearest: null, toIntended }
  const region = floodFillAir(plane, seed, FILL_CAP_MM)
  const reached: LocatorDistance[] = []
  for (const locator of locators) {
    const lumen = nearestAir(plane, locator.pixel, LOCATOR_SNAP_MM)
    if (!lumen || !region.has(lumen[1] * NATIVE_CT.size + lumen[0])) continue
    const candidate = { locator, mm: planeDistanceMm(mark.pixel, locator.pixel) }
    // One entry per source edge: an edge that crosses the plane twice is still one airway.
    const index = reached.findIndex((r) => r.locator.edgeId === locator.edgeId)
    if (index < 0) reached.push(candidate)
    else if (candidate.mm < reached[index].mm) reached[index] = candidate
  }
  reached.sort((a, b) => a.mm - b.mm)
  const nearest = reached[0]?.locator ?? null
  const verdict: MarkVerdict = !nearest
    ? 'not-in-airway'
    : nearest.role === 'intended'
      ? 'intended-lumen'
      : reached.some((r) => r.locator.role === 'intended')
        ? 'near-fork'
        : 'other-airway'
  return { verdict, markInAir: true, reached, nearest, toIntended }
}

const UNNAMED: AirwayLabel = {
  code: 'model airway',
  name: 'Unnamed model airway',
  shortName: 'Model airway',
}

/** Airway label for every source edge named anywhere in the branch registry. */
const EDGE_AIRWAYS: ReadonlyMap<number, AirwayLabel> = (() => {
  const map = new Map<number, AirwayLabel>()
  const put = (edgeId: number, airway: AirwayLabel) => {
    if (!map.has(edgeId)) map.set(edgeId, airway)
  }
  for (const trace of decisions.traces)
    for (const point of trace.checkpoints) {
      put(point.sourceEdgeId, point.airway)
      if (point.decision) {
        put(point.decision.parent.sourceEdgeId, point.decision.parent.airway)
        for (const option of point.decision.options) put(option.sourceEdgeId, option.airway)
      }
    }
  return map
})()

export const edgeAirway = (edgeId: number) => EDGE_AIRWAYS.get(edgeId)

export const planeDistanceMm = (a: readonly number[], b: readonly number[]) =>
  Math.hypot((a[0] - b[0]) * NATIVE_CT.spacing[0], (a[1] - b[1]) * NATIVE_CT.spacing[1])

/** Every point where a model edge crosses an axial plane, in native pixels. */
export function edgeCrossings(edgeId: number, slice: number): [number, number][] {
  const edge = routes.edges.find((e) => e.id === edgeId)
  if (!edge) return []
  const z = sliceZ(slice)
  const crossings: [number, number][] = []
  for (let i = 1; i < edge.points.length; i++) {
    const a = edge.points[i - 1],
      b = edge.points[i]
    if ((z - a[2]) * (z - b[2]) > 0 || a[2] === b[2]) continue
    const f = (z - a[2]) / (b[2] - a[2])
    const pixel = [0, 1].map(
      (axis) =>
        (a[axis] + f * (b[axis] - a[axis]) - NATIVE_CT.origin[axis]) / NATIVE_CT.spacing[axis],
    ) as [number, number]
    if (!crossings.some((c) => Math.hypot(c[0] - pixel[0], c[1] - pixel[1]) < 1))
      crossings.push(pixel)
  }
  return crossings
}

/**
 * Model locators on one answer slice: the intended daughter (the exercise's own
 * answer point), the other daughters, the parent where its edge still crosses
 * the plane, and every other named model edge crossing it.
 */
export function slotLocators(exercise: LocalCtExercise, slot: number): ModelLocator[] {
  const decision = exercise.trace.checkpoints[0].decision
  const point = exercise.answerPoints[slot]
  if (!decision || !point) return []
  const option = decision.options[slot]
  const locators: ModelLocator[] = [
    { edgeId: option.sourceEdgeId, airway: option.airway, role: 'intended', pixel: point.pixel },
  ]
  decision.options.forEach((other, i) => {
    if (i === slot) return
    if (other.slice === point.slice)
      locators.push({
        edgeId: other.sourceEdgeId,
        airway: other.airway,
        role: 'daughter',
        pixel: other.pixel,
      })
    else
      for (const pixel of edgeCrossings(other.sourceEdgeId, point.slice))
        locators.push({ edgeId: other.sourceEdgeId, airway: other.airway, role: 'daughter', pixel })
  })
  for (const pixel of edgeCrossings(decision.parent.sourceEdgeId, point.slice))
    locators.push({
      edgeId: decision.parent.sourceEdgeId,
      airway: decision.parent.airway,
      role: 'parent',
      pixel,
    })
  const covered = new Set(locators.map((l) => l.edgeId))
  for (const edge of routes.edges) {
    if (covered.has(edge.id)) continue
    for (const pixel of edgeCrossings(edge.id, point.slice))
      locators.push({
        edgeId: edge.id,
        airway: EDGE_AIRWAYS.get(edge.id) ?? UNNAMED,
        role: 'other',
        pixel,
      })
  }
  return locators
}

export function compareMarks(
  exercise: LocalCtExercise,
  marks: readonly (CtMark | null)[],
): MarkComparison[] {
  if (!exercise.trace.checkpoints[0].decision) return []
  return exercise.answerPoints.map((point, slot) => {
    const mark = marks[slot]
    const base = { slot, label: point.label, slice: point.slice }
    if (!mark?.pixel || mark.slice !== point.slice)
      return {
        ...base,
        status: 'unresolved',
        intended: null,
        others: [],
        nearestOther: null,
        nearestSibling: null,
        spanMm: null,
        beyondSpan: false,
        verdict: null,
      }
    const locators = slotLocators(exercise, slot)
    const intendedLocator = locators.find((l) => l.role === 'intended')!
    const intended = {
      locator: intendedLocator,
      mm: planeDistanceMm(mark.pixel, intendedLocator.pixel),
    }
    const byCode = new Map<string, LocatorDistance>()
    for (const locator of locators) {
      if (locator.role === 'intended' || locator.edgeId === intendedLocator.edgeId) continue
      // The parent and the other daughter of this division always count, even when they share
      // the intended daughter's code (LB6 into LB6 and LB6). An unrelated edge that shares it
      // does not, and unrelated edges are merged one per code.
      const ofDivision = locator.role === 'daughter' || locator.role === 'parent'
      if (!ofDivision && locator.airway.code === intendedLocator.airway.code) continue
      const key = ofDivision ? `${locator.role}:${locator.edgeId}` : locator.airway.code
      const candidate = { locator, mm: planeDistanceMm(mark.pixel, locator.pixel) }
      const current = byCode.get(key)
      if (!current || candidate.mm < current.mm) byCode.set(key, candidate)
    }
    const others = [...byCode.values()].sort((a, b) => a.mm - b.mm)
    const nearestOther = others[0] ?? null
    const nearestSibling = others.find((o) => o.locator.role === 'daughter') ?? null
    const spanMm = nearestOther
      ? planeDistanceMm(intendedLocator.pixel, nearestOther.locator.pixel)
      : null
    return {
      ...base,
      status: nearestOther && nearestOther.mm < intended.mm ? 'nearest-other' : 'nearest-intended',
      intended,
      others,
      nearestOther,
      nearestSibling,
      spanMm,
      beyondSpan: Boolean(spanMm !== null && intended.mm > spanMm),
      verdict: markVerdict(exercise, slot, mark),
    }
  })
}
