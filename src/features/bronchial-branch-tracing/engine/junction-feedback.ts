import airPlanes from '../geometry/answer-plane-air.json'
import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import type { AirwayLabel, CtMark, CtTrace } from '../content/ct-types'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'
import { RESPONSE_PLANE_OVERRIDES } from './response-planes'

/**
 * Which lumen a mark is in, read from the CT's own air.
 *
 * Each daughter of a fork is identified on one axial plane (`responsePlane`). The plane has an air
 * mask (geometry/answer-plane-air.json). A mark's air region is flood-filled out to FILL_CAP_MM;
 * a named airway is reached when the air at its model centre is part of that region, and the mark
 * is taken to be in the reached airway whose centre is nearest. Nothing here moves a mark.
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
/** Without an air mask a mark counts for the model centre nearest it, no farther than this. */
export const NO_MASK_REACH_MM = 3

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
 * The plane a daughter is identified on, and its model locator there. The export's own response
 * point, except where `RESPONSE_PLANE_OVERRIDES` moves the plane along the daughter's centreline.
 */
export function responsePlane(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
): { slice: number; pixel: [number, number] } | null {
  const checkpoint = trace.checkpoints[checkpointIndex]
  const option = checkpoint?.decision?.options[optionIndex]
  if (!checkpoint || !option) return null
  const override = RESPONSE_PLANE_OVERRIDES[checkpoint.id]
  if (override === undefined || override === option.slice)
    return { slice: option.slice, pixel: option.pixel }
  const crossing = edgeCrossings(option.sourceEdgeId, override)[0]
  return crossing
    ? { slice: override, pixel: crossing }
    : { slice: option.slice, pixel: option.pixel }
}

/**
 * Model locators on one daughter's response plane: that daughter, the other daughters, the parent
 * where its edge still crosses the plane, and every other named model edge crossing it.
 */
export function optionLocators(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
): ModelLocator[] {
  const decision = trace.checkpoints[checkpointIndex]?.decision
  const point = responsePlane(trace, checkpointIndex, optionIndex)
  if (!decision || !point) return []
  const option = decision.options[optionIndex]
  const locators: ModelLocator[] = [
    { edgeId: option.sourceEdgeId, airway: option.airway, role: 'intended', pixel: point.pixel },
  ]
  decision.options.forEach((other, i) => {
    if (i === optionIndex) return
    const there = responsePlane(trace, checkpointIndex, i)
    if (there && there.slice === point.slice)
      locators.push({
        edgeId: other.sourceEdgeId,
        airway: other.airway,
        role: 'daughter',
        pixel: there.pixel,
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

/**
 * The area of a daughter's lumen on its response plane, in mm², read from the air mask: 0 when
 * the plane has no mask or the locator has no air under it. A lumen a pixel or two across cannot
 * be clicked reliably, so the bench asks for a mark only above a minimum area.
 */
export function optionLumenAreaMm2(trace: CtTrace, checkpointIndex: number, optionIndex: number) {
  const point = responsePlane(trace, checkpointIndex, optionIndex)
  const plane = point ? airPlane(point.slice) : null
  const seed = point && plane ? nearestAir(plane, point.pixel, LOCATOR_SNAP_MM) : null
  if (!plane || !seed) return 0
  return floodFillAir(plane, seed, FILL_CAP_MM).size * NATIVE_CT.spacing[0] * NATIVE_CT.spacing[1]
}

/**
 * Where the bench itself marks a daughter: the air nearest its model centre on its response
 * plane. A centreline sample can sit on the wall of a small lumen, a millimetre outside the air a
 * click must land in, so the centre itself is not always inside the lumen it names.
 */
export function responseLumen(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
): { slice: number; pixel: [number, number] } | null {
  const point = responsePlane(trace, checkpointIndex, optionIndex)
  if (!point) return null
  const plane = airPlane(point.slice)
  const air = plane ? nearestAir(plane, point.pixel, LOCATOR_SNAP_MM) : null
  return air ? { slice: point.slice, pixel: air } : point
}

/** True when the daughter's locator has air under it, so a mark there can be given a verdict. */
export function optionHasVerdict(trace: CtTrace, checkpointIndex: number, optionIndex: number) {
  const point = responsePlane(trace, checkpointIndex, optionIndex)
  const plane = point ? airPlane(point.slice) : null
  return Boolean(point && plane && nearestAir(plane, point.pixel, LOCATOR_SNAP_MM))
}

/**
 * Which lumen a mark is in on a daughter's response plane.
 *
 * Where the plane has an air mask, the mark's air region decides. Where it has none, or the
 * daughter's locator has no air under it at this threshold (a lumen a pixel or two wide), the
 * nearest model locator decides instead and `markInAir` is left false.
 */
export function optionVerdict(
  trace: CtTrace,
  checkpointIndex: number,
  optionIndex: number,
  mark: CtMark | null | undefined,
): VerdictResult | null {
  const point = responsePlane(trace, checkpointIndex, optionIndex)
  if (!point || !mark?.pixel || mark.slice !== point.slice) return null
  const locators = optionLocators(trace, checkpointIndex, optionIndex)
  const intended = locators.find((l) => l.role === 'intended')
  if (!intended) return null
  const toIntended = planeMove(mark.pixel, intended.pixel)
  const plane = airPlane(point.slice)
  const mx = Math.round(mark.pixel[0]),
    my = Math.round(mark.pixel[1])
  const inMask =
    plane && mx >= plane.x0 && my >= plane.y0 && mx < plane.x0 + plane.w && my < plane.y0 + plane.h
  if (!plane || !inMask || !nearestAir(plane, intended.pixel, LOCATOR_SNAP_MM)) {
    // No air evidence for this lumen: fall back to the nearest model centre, within a lumen's reach.
    const ranked = locators
      .map((locator) => ({ locator, mm: planeDistanceMm(mark.pixel!, locator.pixel) }))
      .sort((a, b) => a.mm - b.mm)
    const nearest = ranked[0]
    if (!nearest || nearest.mm > NO_MASK_REACH_MM)
      return { verdict: 'not-in-airway', markInAir: false, reached: [], nearest: null, toIntended }
    return {
      verdict: nearest.locator.role === 'intended' ? 'intended-lumen' : 'other-airway',
      markInAir: false,
      reached: [nearest],
      nearest: nearest.locator,
      toIntended,
    }
  }
  const seed = nearestAir(plane, mark.pixel, MARK_SNAP_MM)
  if (!seed)
    return { verdict: 'not-in-airway', markInAir: false, reached: [], nearest: null, toIntended }
  const region = floodFillAir(plane, seed, FILL_CAP_MM)
  const reached: LocatorDistance[] = []
  for (const locator of locators) {
    const lumen = nearestAir(plane, locator.pixel, LOCATOR_SNAP_MM)
    if (!lumen || !region.has(lumen[1] * NATIVE_CT.size + lumen[0])) continue
    const candidate = { locator, mm: planeDistanceMm(mark.pixel, locator.pixel) }
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
