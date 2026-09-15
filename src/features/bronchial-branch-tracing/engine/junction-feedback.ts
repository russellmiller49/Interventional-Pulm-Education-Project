import decisions from '../geometry/branch-decisions.json'
import routes from '../geometry/paired-routes.json'
import type { AirwayLabel, CtMark, LocalCtExercise } from '../content/ct-types'
import { NATIVE_CT, sliceZ } from '../geometry/native-ct'

/**
 * Position comparison between a learner's checked marks and the model locators
 * on the same axial plane. It reports where a mark sits relative to named model
 * airways, in millimetres; it never moves a mark, never assigns a verdict, and
 * cannot say why a mark was placed where it was.
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
  /** Other named model airways crossing this slice, nearest first, one per airway code. */
  others: LocatorDistance[]
  /** The mark is farther from the intended locator than the nearest other locator is. */
  beyondSpan: boolean
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
      return { ...base, status: 'unresolved', intended: null, others: [], beyondSpan: false }
    const locators = slotLocators(exercise, slot)
    const intendedLocator = locators.find((l) => l.role === 'intended')!
    const intended = {
      locator: intendedLocator,
      mm: planeDistanceMm(mark.pixel, intendedLocator.pixel),
    }
    const byCode = new Map<string, LocatorDistance>()
    for (const locator of locators) {
      if (locator.role === 'intended' || locator.airway.code === intendedLocator.airway.code)
        continue
      const candidate = { locator, mm: planeDistanceMm(mark.pixel, locator.pixel) }
      const current = byCode.get(locator.airway.code)
      if (!current || candidate.mm < current.mm) byCode.set(locator.airway.code, candidate)
    }
    const others = [...byCode.values()].sort((a, b) => a.mm - b.mm)
    const nearestOther = others[0]
    return {
      ...base,
      status: nearestOther && nearestOther.mm < intended.mm ? 'nearest-other' : 'nearest-intended',
      intended,
      others,
      beyondSpan: Boolean(
        nearestOther &&
        intended.mm > planeDistanceMm(intendedLocator.pixel, nearestOther.locator.pixel),
      ),
    }
  })
}
