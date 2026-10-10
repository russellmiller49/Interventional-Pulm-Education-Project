import type { AirwayLabel, CtNoduleTarget, CtTrace } from '../content/ct-types'
import type { Vec3 } from '../geometry/coordinates'
import { NATIVE_CT } from '../geometry/native-ct'
import { projectToParentView } from '../geometry/reference-frames'
import { SCOPE_FOV_DEG, stationCamera } from '../geometry/route-stations'
import { responsePlane } from './junction-feedback'
import { routeOption } from './nav-session'

/**
 * What the route geometry says about one fork: where each opening sits in the scope's view, which
 * way each daughter runs, and on which slice each is identified. Read from the unchanged export;
 * every sentence the bench prints about a fork's levels or directions comes from here.
 */
export type ViewSide =
  | 'left'
  | 'right'
  | 'upper'
  | 'lower'
  | 'upper left'
  | 'upper right'
  | 'lower left'
  | 'lower right'

export interface OpeningFacts {
  index: number
  airway: AirwayLabel
  /** The opening's anchor in the scope view: a point just inside the daughter, patient space. */
  anchor: Vec3
  /** Where that anchor falls in the scope's square view, 0–100. */
  view: [number, number]
  /** Where the opening sits relative to the others in the scope's view. */
  side: ViewSide
  /** The plane this daughter is identified on. */
  slice: number
  /** That plane relative to the fork: positive is toward the head. */
  slicesFromFork: number
  mmFromFork: number
  /** Which way the daughter leaves the fork, in patient words: "down and back". */
  course: string
  /** The opening the route takes. */
  onRoute: boolean
  /** The daughter's code is also the parent's or a sibling's, so the code alone does not name it. */
  repeatedName: boolean
}
export interface ForkFacts {
  checkpointId: string
  parent: AirwayLabel
  /** The slice the fork point itself lies on. */
  forkSlice: number
  openings: OpeningFacts[]
  /** Every daughter is identified within one slice of the others: a fork lying in the plane. */
  inPlane: boolean
}

/** How far into a daughter the scope letter is anchored, from the fork point. */
export const OPENING_ANCHOR_MM = 3

const sliceOf = (z: number) => Math.round((z - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2])

/** "down and back", from a patient-space direction; the dominant one or two components. */
export function courseWords(v: readonly number[]): string {
  const length = Math.hypot(v[0], v[1], v[2]) || 1
  const parts = [
    { value: v[2] / length, positive: 'up', negative: 'down' },
    { value: v[1] / length, positive: 'back', negative: 'forward' },
    { value: v[0] / length, positive: 'to the patient’s left', negative: 'to the patient’s right' },
  ]
    .filter((part) => Math.abs(part.value) >= 0.45)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 2)
    .map((part) => (part.value > 0 ? part.positive : part.negative))
  return parts.join(' and ')
}

const cache = new Map<string, ForkFacts | null>()
export function forkFacts(trace: CtTrace, checkpointIndex: number): ForkFacts | null {
  const key = `${trace.id}:${checkpointIndex}`
  if (cache.has(key)) return cache.get(key)!
  const checkpoint = trace.checkpoints[checkpointIndex]
  const decision = checkpoint?.decision
  const camera = stationCamera(trace, checkpointIndex)
  if (!decision || !camera) {
    cache.set(key, null)
    return null
  }
  const fork = decision.junctionLps
  const forkSlice = sliceOf(fork[2])
  const route = routeOption(trace, checkpointIndex)
  const codes = decision.options.map((option) => option.airway.code)
  const raw = decision.options.map((option, index) => {
    const delta = [option.lps[0] - fork[0], option.lps[1] - fork[1], option.lps[2] - fork[2]]
    const length = Math.hypot(delta[0], delta[1], delta[2]) || 1
    const reach = Math.min(OPENING_ANCHOR_MM, length)
    const anchor: Vec3 = [
      fork[0] + (delta[0] / length) * reach,
      fork[1] + (delta[1] / length) * reach,
      fork[2] + (delta[2] / length) * reach,
    ]
    const projected = projectToParentView(camera, anchor, SCOPE_FOV_DEG)
    return { option, index, delta, anchor, view: [projected.x, projected.y] as [number, number] }
  })
  const centre = [
    raw.reduce((sum, entry) => sum + entry.view[0], 0) / raw.length,
    raw.reduce((sum, entry) => sum + entry.view[1], 0) / raw.length,
  ]
  // Openings are told apart along whichever screen axis separates them more.
  const spreadX = Math.max(...raw.map((e) => e.view[0])) - Math.min(...raw.map((e) => e.view[0]))
  const spreadY = Math.max(...raw.map((e) => e.view[1])) - Math.min(...raw.map((e) => e.view[1]))
  const openings = raw.map(({ option, index, delta, anchor, view }): OpeningFacts => {
    const plane = responsePlane(trace, checkpointIndex, index) ?? {
      slice: option.slice,
      pixel: option.pixel,
    }
    const code = option.airway.code
    const repeatedName =
      code === decision.parent.airway.code || codes.filter((other) => other === code).length > 1
    const horizontal = view[0] < centre[0] ? 'left' : 'right'
    const vertical = view[1] < centre[1] ? 'upper' : 'lower'
    // Two openings are told apart along one axis. Three need both.
    const side: ViewSide =
      raw.length > 2 && Math.abs(view[0] - centre[0]) > 4 && Math.abs(view[1] - centre[1]) > 4
        ? (`${vertical} ${horizontal}` as ViewSide)
        : raw.length > 2
          ? Math.abs(view[0] - centre[0]) >= Math.abs(view[1] - centre[1])
            ? horizontal
            : vertical
          : spreadX >= spreadY
            ? horizontal
            : vertical
    return {
      index,
      airway: option.airway,
      anchor,
      view,
      side,
      slice: plane.slice,
      slicesFromFork: plane.slice - forkSlice,
      mmFromFork: Math.abs(plane.slice - forkSlice) * NATIVE_CT.spacing[2],
      course: courseWords(delta),
      onRoute: index === route,
      repeatedName,
    }
  })
  const slices = openings.map((opening) => opening.slice)
  const facts: ForkFacts = {
    checkpointId: checkpoint.id,
    parent: decision.parent.airway,
    forkSlice,
    openings,
    inPlane: Math.max(...slices) - Math.min(...slices) <= 1,
  }
  cache.set(key, facts)
  return facts
}

/** "9 slices (4.5 mm) toward the head" */
export function levelPhrase(slices: number) {
  if (slices === 0) return 'on the fork’s own slice'
  const count = Math.abs(slices)
  const mm = (count * NATIVE_CT.spacing[2]).toFixed(count % 2 ? 1 : 0)
  return `${count} ${count === 1 ? 'slice' : 'slices'} (${mm} mm) toward the ${slices > 0 ? 'head' : 'feet'}`
}

export interface LesionFacts {
  slice: number
  /** Lesion slice minus the fork's slice: positive is toward the head. */
  slicesFromFork: number
  /** Straight-line distance from the fork to the lesion's centre. */
  mm: number
  /** Which way the lesion lies from the fork, in patient words. */
  bearing: string
}
/** Where the lesion lies from a fork: the evidence for choosing an opening. */
export function lesionFromFork(
  trace: CtTrace,
  checkpointIndex: number,
  target: CtNoduleTarget,
): LesionFacts | null {
  const fork = trace.checkpoints[checkpointIndex]?.decision?.junctionLps
  if (!fork) return null
  const delta = [
    target.centerLps[0] - fork[0],
    target.centerLps[1] - fork[1],
    target.centerLps[2] - fork[2],
  ]
  return {
    slice: target.slice,
    slicesFromFork: target.slice - sliceOf(fork[2]),
    mm: Math.hypot(delta[0], delta[1], delta[2]),
    bearing: courseWords(delta),
  }
}
