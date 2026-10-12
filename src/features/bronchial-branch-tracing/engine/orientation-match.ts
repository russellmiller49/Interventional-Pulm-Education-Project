import type { CtTrace } from '../content/ct-types'
import type { DisplayPreset, Vec3 } from '../geometry/coordinates'
import {
  orientPoint,
  orientationFor,
  sameOrientation,
  turnCt,
  type CtOrientation,
  type OrientationOperation,
} from '../geometry/orientation'
import { projectDirection, type CameraBasis } from '../geometry/reference-frames'
import { stationCamera } from '../geometry/route-stations'

/**
 * Which CT display matches what the scope sees.
 *
 * The axial CT shows two patient axes: left–right and anterior–posterior. The scope's screen shows
 * wherever those two axes project for its position and roll. A CT display *matches* when each of
 * those axes points the same way on both screens: patient-left on the CT's right edge when
 * patient-left is on the scope's right, and so on.
 *
 * An axis that runs almost along the line of sight has no side on the scope's screen, so it cannot
 * be matched or mismatched: either way round is accepted for it. That happens when the scope looks
 * sideways along a horizontal bronchus.
 *
 * The book's regional display (`orientationFor(preset)`) is reported beside the result, never used
 * to judge it. It is the display for looking *into* a region; on the way there the scope looks
 * down the trachea and the match is the left–right reflection.
 */
export const ALL_ORIENTATIONS: readonly CtOrientation[] = [0, 1, 2, 3].flatMap((turns) =>
  [false, true].map((reflected) => ({ turns: turns as CtOrientation['turns'], reflected })),
)

/**
 * A patient axis is on the scope's screen when at least half of it lies across the line of sight,
 * that is when it is more than 30° away from the direction the scope looks. Below that it has no
 * side to match.
 */
export const MATCH_AXIS_THRESHOLD = 0.5

/** Two displays this close in agreement with the scope are both a match (a 45° look). */
export const SCORE_TIE = 0.15

export type PatientPair = 'left-right' | 'anterior-posterior'
export type ScreenSide = 'top' | 'right' | 'bottom' | 'left'

const PATIENT_LEFT: Vec3 = [1, 0, 0]
const PATIENT_POSTERIOR: Vec3 = [0, 1, 0]

/** The screen edge a [right, down] direction points at. */
export function screenSide([x, y]: readonly number[]): ScreenSide {
  return Math.abs(x) >= Math.abs(y) ? (x >= 0 ? 'right' : 'left') : y >= 0 ? 'bottom' : 'top'
}
const horizontal = (side: ScreenSide) => side === 'left' || side === 'right'
const OPPOSITE: Record<ScreenSide, ScreenSide> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

export interface OrientationMatch {
  /** The display that agrees best with the scope. */
  best: CtOrientation
  /** Every display that counts as matching; always includes `best`. */
  accepted: CtOrientation[]
  /** The axis the scope looks along, which has no side on its screen; null when both show. */
  weakAxis: PatientPair | null
  /**
   * Both CT axes show, but along the same edge of the scope's view (an oblique look). No CT
   * display can put two perpendicular axes on one edge, so the best display agrees on the stronger
   * axis only.
   */
  oblique: boolean
  /** Where the scope shows each patient direction; null for the axis it looks along. */
  scopeSides: {
    L: ScreenSide | null
    R: ScreenSide | null
    A: ScreenSide | null
    P: ScreenSide | null
  }
  /** The book's regional display for this route, and whether it is among the matches here. */
  book: CtOrientation
  bookAccepted: boolean
  scores: { orientation: CtOrientation; score: number }[]
}

export function matchOrientation(basis: CameraBasis, preset: DisplayPreset): OrientationMatch {
  const left = projectDirection(basis, PATIENT_LEFT)
  const posterior = projectDirection(basis, PATIENT_POSTERIOR)
  const leftStrong = Math.hypot(...left) >= MATCH_AXIS_THRESHOLD
  const posteriorStrong = Math.hypot(...posterior) >= MATCH_AXIS_THRESHOLD
  const scores = ALL_ORIENTATIONS.map((orientation) => {
    const l = orientPoint([1, 0], orientation)
    const p = orientPoint([0, 1], orientation)
    return {
      orientation,
      score: left[0] * l[0] + left[1] * l[1] + posterior[0] * p[0] + posterior[1] * p[1],
    }
  }).sort((a, b) => b.score - a.score)
  const best = scores[0].orientation
  const bestLeft = screenSide(orientPoint([1, 0], best))
  const bestPosterior = screenSide(orientPoint([0, 1], best))
  const accepted = scores
    .filter(({ orientation, score }) => {
      if (scores[0].score - score <= SCORE_TIE) return true
      // Agrees with the best display on every axis the scope actually shows.
      const sameLeft = !leftStrong || screenSide(orientPoint([1, 0], orientation)) === bestLeft
      const samePosterior =
        !posteriorStrong || screenSide(orientPoint([0, 1], orientation)) === bestPosterior
      return sameLeft && samePosterior && (!leftStrong || !posteriorStrong)
    })
    .map((entry) => entry.orientation)
  const leftSide = leftStrong ? screenSide(left) : null
  const posteriorSide = posteriorStrong ? screenSide(posterior) : null
  const book = orientationFor(preset)
  return {
    best,
    accepted,
    weakAxis: !leftStrong ? 'left-right' : !posteriorStrong ? 'anterior-posterior' : null,
    oblique: Boolean(
      leftSide && posteriorSide && horizontal(leftSide) === horizontal(posteriorSide),
    ),
    scopeSides: {
      L: leftSide,
      R: leftSide ? OPPOSITE[leftSide] : null,
      P: posteriorSide,
      A: posteriorSide ? OPPOSITE[posteriorSide] : null,
    },
    book,
    bookAccepted: accepted.some((o) => sameOrientation(o, book)),
    scores,
  }
}

const cache = new Map<string, OrientationMatch | null>()
/** The match for the scope waiting at one division of a route. */
export function stationMatch(trace: CtTrace, checkpointIndex: number): OrientationMatch | null {
  const key = `${trace.id}:${checkpointIndex}`
  if (cache.has(key)) return cache.get(key)!
  const camera = stationCamera(trace, checkpointIndex)
  const match = camera ? matchOrientation(camera.basis, trace.preset) : null
  cache.set(key, match)
  return match
}

export const isAccepted = (match: OrientationMatch, orientation: CtOrientation) =>
  match.accepted.some((o) => sameOrientation(o, orientation))

/** Where a CT display puts each patient direction. */
export function displaySides(
  orientation: CtOrientation,
): Record<'L' | 'R' | 'A' | 'P', ScreenSide> {
  const left = screenSide(orientPoint([1, 0], orientation))
  const posterior = screenSide(orientPoint([0, 1], orientation))
  return { L: left, R: OPPOSITE[left], P: posterior, A: OPPOSITE[posterior] }
}

/** The fewest CT operations that reach a matching display: [] when it already matches. */
export function operationsToMatch(
  match: OrientationMatch,
  orientation: CtOrientation,
): OrientationOperation[] {
  const queue: { at: CtOrientation; path: OrientationOperation[] }[] = [
    { at: orientation, path: [] },
  ]
  const seen = new Set<string>()
  while (queue.length) {
    const { at, path } = queue.shift()!
    if (isAccepted(match, at)) return path
    const key = `${at.turns}${at.reflected}`
    if (seen.has(key)) continue
    seen.add(key)
    for (const operation of ['flip', 'left', 'right'] as const)
      queue.push({ at: turnCt(at, operation), path: [...path, operation] })
  }
  return []
}

export type MismatchKind = 'matches' | 'mirrored' | 'rotated' | 'rotated-and-mirrored'
export interface MatchReading {
  kind: MismatchKind
  /** A patient direction that sits on different sides of the two screens; null when it matches. */
  example: { letter: 'L' | 'R' | 'A' | 'P'; scope: ScreenSide; ct: ScreenSide } | null
  operations: OrientationOperation[]
}

/** How the learner's CT display differs from what the scope shows. */
export function readMatch(match: OrientationMatch, orientation: CtOrientation): MatchReading {
  const operations = operationsToMatch(match, orientation)
  if (!operations.length) return { kind: 'matches', example: null, operations }
  const ct = displaySides(orientation)
  const example =
    (['R', 'L', 'A', 'P'] as const)
      .map((letter) => ({ letter, scope: match.scopeSides[letter], ct: ct[letter] }))
      .find(
        (entry): entry is { letter: 'L' | 'R' | 'A' | 'P'; scope: ScreenSide; ct: ScreenSide } =>
          entry.scope !== null && entry.scope !== entry.ct,
      ) ?? null
  const flips = operations.filter((operation) => operation === 'flip').length
  const turns = operations.length - flips
  return {
    kind: flips && turns ? 'rotated-and-mirrored' : flips ? 'mirrored' : 'rotated',
    example,
    operations,
  }
}

const OPERATION_WORDS: Record<OrientationOperation, string> = {
  flip: 'flip',
  left: 'rotate left',
  right: 'rotate right',
  reset: 'return to standard axial',
}
/** "Flip, then rotate left." */
export function operationsSentence(operations: readonly OrientationOperation[]) {
  if (!operations.length) return ''
  const words: string[] = []
  for (let i = 0; i < operations.length; i++) {
    const twice = operations[i + 1] === operations[i] && operations[i] !== 'flip'
    words.push(twice ? `${OPERATION_WORDS[operations[i]]} twice` : OPERATION_WORDS[operations[i]])
    if (twice) i++
  }
  const sentence = words.join(', then ')
  return `${sentence[0].toUpperCase()}${sentence.slice(1)}.`
}
