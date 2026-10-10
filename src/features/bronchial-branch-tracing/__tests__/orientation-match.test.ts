import type { CtTrace } from '../content/ct-types'
import {
  ALL_ORIENTATIONS,
  MATCH_AXIS_THRESHOLD,
  SCORE_TIE,
  displaySides,
  isAccepted,
  matchOrientation,
  operationsSentence,
  operationsToMatch,
  readMatch,
  screenSide,
  stationMatch,
  type OrientationMatch,
} from '../engine/orientation-match'
import type { Vec3 } from '../geometry/coordinates'
import { CT_TRACES, traceById } from '../geometry/native-ct'
import {
  STANDARD_ORIENTATION,
  orientationFor,
  sameOrientation,
  turnCt,
  type CtOrientation,
} from '../geometry/orientation'
import { cameraBasis } from '../geometry/reference-frames'
import { stationCamera } from '../geometry/route-stations'

/**
 * Which CT display matches what the scope sees. The synthetic frames hold the rule; the routes
 * hold what it gives at every fork the scope waits at.
 */
const STANDARD: CtOrientation = { turns: 0, reflected: false }
const MIRROR: CtOrientation = { turns: 0, reflected: true }
const QUARTER_CLOCKWISE: CtOrientation = { turns: 1, reflected: false }
const QUARTER_COUNTERCLOCKWISE: CtOrientation = { turns: 3, reflected: false }
const ANTERIOR: Vec3 = [0, -1, 0]
const CAUDAL: Vec3 = [0, 0, -1]
const CRANIAL: Vec3 = [0, 0, 1]

const frame = (direction: Vec3, up: Vec3) => matchOrientation(cameraBasis(direction, up), 'mirror')

interface Station {
  trace: CtTrace
  index: number
  id: string
  match: OrientationMatch
}
const STATIONS: Station[] = CT_TRACES.flatMap((trace) =>
  trace.checkpoints.flatMap((checkpoint, index) =>
    checkpoint.decision
      ? [{ trace, index, id: checkpoint.id, match: stationMatch(trace, index)! }]
      : [],
  ),
)
const stationOn = (traceId: string, checkpointId: string) => {
  const trace = traceById(traceId)
  const index = trace.checkpoints.findIndex((p) => p.id === checkpointId)
  return { trace, index, match: stationMatch(trace, index)! }
}

describe('the rule, on synthetic frames', () => {
  test('there are eight displays, and the thresholds are the documented ones', () => {
    expect(ALL_ORIENTATIONS).toHaveLength(8)
    expect(new Set(ALL_ORIENTATIONS.map((o) => `${o.turns}${o.reflected}`)).size).toBe(8)
    expect(MATCH_AXIS_THRESHOLD).toBe(0.5)
    expect(SCORE_TIE).toBe(0.15)
  })

  test('looking caudally with anterior up, only the left–right reflection matches', () => {
    const match = frame(CAUDAL, ANTERIOR)
    expect(match.accepted).toEqual([MIRROR])
    expect(match.best).toEqual(MIRROR)
    expect(match.weakAxis).toBeNull()
    // The scope has the patient's right on its right: the CT drawn from the feet has it on the left.
    expect(match.scopeSides).toEqual({ R: 'right', L: 'left', A: 'top', P: 'bottom' })
    expect(match.scopeSides).toEqual(displaySides(MIRROR))
    expect(match.scores).toHaveLength(8)
    expect(match.scores[0].score).toBeCloseTo(2, 12)
    expect(match.scores.map((s) => s.score)).toEqual(
      [...match.scores.map((s) => s.score)].sort((a, b) => b - a),
    )
  })

  test('looking cranially with anterior up, only standard axial matches', () => {
    const match = frame(CRANIAL, ANTERIOR)
    expect(match.accepted).toEqual([STANDARD])
    expect(match.scopeSides).toEqual({ R: 'left', L: 'right', A: 'top', P: 'bottom' })
    expect(match.scopeSides).toEqual(displaySides(STANDARD))
  })

  test('looking cranially with the right chest wall at the bottom, only 90° counterclockwise matches', () => {
    // Patient-left up: the book's right upper lobe display.
    const match = frame(CRANIAL, [1, 0, 0])
    expect(match.accepted).toEqual([QUARTER_COUNTERCLOCKWISE])
    expect(match.accepted).toEqual([orientationFor('rul')])
    expect(match.scopeSides).toEqual({ L: 'top', R: 'bottom', A: 'left', P: 'right' })
    expect(match.scopeSides).toEqual(displaySides(QUARTER_COUNTERCLOCKWISE))
  })

  test('looking cranially with the left chest wall at the bottom, only 90° clockwise matches', () => {
    const match = frame(CRANIAL, [-1, 0, 0])
    expect(match.accepted).toEqual([QUARTER_CLOCKWISE])
    expect(match.accepted).toEqual([orientationFor('upper-division')])
    expect(match.scopeSides).toEqual({ R: 'top', L: 'bottom', P: 'left', A: 'right' })
    expect(match.scopeSides).toEqual(displaySides(QUARTER_CLOCKWISE))
  })

  test('a level look along left–right has no side for R and L, and accepts both ways round', () => {
    // Looking toward the patient's right with the head at the top.
    const match = frame([-1, 0, 0], [0, 0, 1])
    expect(match.weakAxis).toBe('left-right')
    expect(match.scopeSides.L).toBeNull()
    expect(match.scopeSides.R).toBeNull()
    expect(match.accepted).toHaveLength(2)
    expect(match.accepted.some((o) => sameOrientation(o, match.best))).toBe(true)
    const [first, second] = match.accepted.map(displaySides)
    // The two agree on where A and P sit, as the scope has them, and differ only in R and L.
    expect([first.A, first.P]).toEqual([match.scopeSides.A, match.scopeSides.P])
    expect([second.A, second.P]).toEqual([first.A, first.P])
    expect([second.L, second.R]).toEqual([first.R, first.L])
    expect(match.accepted[0].reflected).not.toBe(match.accepted[1].reflected)
  })

  test('a level look along anterior–posterior has no side for A and P', () => {
    // Looking toward the back with the head at the top, as in LB6.
    const match = frame([0, 1, 0], [0, 0, 1])
    expect(match.weakAxis).toBe('anterior-posterior')
    expect(match.scopeSides).toEqual({ L: 'right', R: 'left', A: null, P: null })
    expect(match.accepted).toHaveLength(2)
    // Seen from in front, the patient's left is on the right, as on a standard axial CT.
    expect(isAccepted(match, STANDARD)).toBe(true)
    expect(isAccepted(match, MIRROR)).toBe(false)
    for (const accepted of match.accepted) expect(displaySides(accepted).L).toBe('right')
  })

  test('the book’s regional display is reported beside the match, never used to judge it', () => {
    const basis = cameraBasis(CAUDAL, ANTERIOR)
    for (const preset of ['standard', 'mirror', 'rul', 'upper-division'] as const) {
      const match = matchOrientation(basis, preset)
      expect(match.accepted).toEqual([MIRROR])
      expect(match.book).toEqual(orientationFor(preset))
      expect(match.bookAccepted).toBe(preset === 'mirror')
    }
  })

  test('screen sides: the edge a [right, down] direction points at', () => {
    expect(screenSide([1, 0])).toBe('right')
    expect(screenSide([-1, 0])).toBe('left')
    expect(screenSide([0, 1])).toBe('bottom')
    expect(screenSide([0, -1])).toBe('top')
    expect(screenSide([0.6, -0.5])).toBe('right')
    expect(screenSide([0.3, -0.5])).toBe('top')
    // Each display puts the four letters on four different edges.
    for (const orientation of ALL_ORIENTATIONS) {
      const sides = displaySides(orientation)
      expect(new Set(Object.values(sides)).size).toBe(4)
    }
    expect(displaySides(STANDARD)).toEqual({ A: 'top', P: 'bottom', R: 'left', L: 'right' })
  })
})

describe('at every fork of every route', () => {
  test('each of the 128 stations has a match: one to four displays, the best among them', () => {
    expect(CT_TRACES).toHaveLength(17)
    expect(STATIONS).toHaveLength(128)
    let plain = 0
    for (const { trace, index, id, match } of STATIONS) {
      const where = `${trace.id} ${id}`
      expect([where, match === null]).toEqual([where, false])
      expect([where, isAccepted(match, match.best)]).toEqual([where, true])
      expect([where, match.accepted.length >= 1 && match.accepted.length <= 4]).toEqual([
        where,
        true,
      ])
      expect(match.book).toEqual(orientationFor(trace.preset))
      expect(match.bookAccepted).toBe(isAccepted(match, match.book))
      // The same object is handed back each time, and it is the camera's own match.
      expect(stationMatch(trace, index)).toBe(match)
      expect(matchOrientation(stationCamera(trace, index)!.basis, trace.preset)).toEqual(match)
      if (match.weakAxis === null) {
        for (const letter of ['L', 'R', 'A', 'P'] as const)
          expect([where, letter, match.scopeSides[letter] === null]).toEqual([where, letter, false])
      }
      // One display, and the scope has each letter on an edge of its own: the display's letters
      // are on those same edges.
      if (
        match.weakAxis === null &&
        match.accepted.length === 1 &&
        new Set(Object.values(match.scopeSides)).size === 4
      ) {
        plain++
        expect([where, match.scopeSides]).toEqual([where, displaySides(match.best)])
      }
      // An axis the scope looks along has no side; the other always has one.
      if (match.weakAxis === 'left-right')
        expect([match.scopeSides.L, match.scopeSides.R]).toEqual([null, null])
      else expect(match.scopeSides.L).not.toBeNull()
      if (match.weakAxis === 'anterior-posterior')
        expect([match.scopeSides.A, match.scopeSides.P]).toEqual([null, null])
      else if (match.weakAxis === null) expect(match.scopeSides.A).not.toBeNull()
    }
    expect(plain).toBeGreaterThan(60)
    // A checkpoint without a division has no station and no match.
    const trace = CT_TRACES[0]
    expect(stationMatch(trace, trace.checkpoints.length - 1)).toBeNull()
  })

  test('the tracheal fork matches the left–right reflection on every route', () => {
    for (const trace of CT_TRACES) {
      expect(trace.checkpoints[0].id).toBe('junction-1')
      const match = stationMatch(trace, 0)!
      expect([trace.id, match.accepted]).toEqual([trace.id, [MIRROR]])
      expect([trace.id, match.weakAxis]).toEqual([trace.id, null])
    }
  })

  test('inside the upper lobes the match is the book’s quarter turn; looking back along LB6 it is standard axial', () => {
    // RB1, looking up with the right chest wall at the bottom.
    expect(stationOn('right-upper-apical', 'junction-14').match.accepted).toEqual([
      QUARTER_COUNTERCLOCKWISE,
    ])
    // The left upper division, looking up with the left chest wall at the bottom.
    expect(stationOn('left-upper-division', 'junction-23').match.accepted).toEqual([
      QUARTER_CLOCKWISE,
    ])
    // LB6 runs backward: the scope looks along the slice, and the flip comes off.
    const lb6 = stationOn('left-lower-returning', 'junction-11').match
    expect(isAccepted(lb6, STANDARD)).toBe(true)
    expect(isAccepted(lb6, MIRROR)).toBe(false)
    expect(lb6.weakAxis).toBe('anterior-posterior')
    expect(lb6.bookAccepted).toBe(false)
  })

  test('the summary the report script prints: 128 stations, the book’s display matches at 100, 42 accept more than one', () => {
    // npx tsx scripts/branch-tracing/orientation-match-report.ts --summary
    const stations = STATIONS.length
    const bookMatches = STATIONS.filter(({ match }) => match.bookAccepted).length
    const twoWay = STATIONS.filter(({ match }) => match.accepted.length > 1).length
    expect(
      `${stations} stations: the book's regional display matches at ${bookMatches}, differs at ${stations - bookMatches}; ${twoWay} accept more than one display.`,
    ).toBe(
      "128 stations: the book's regional display matches at 100, differs at 28; 42 accept more than one display.",
    )
  })

  test('from any display, the operations given reach a matching one in at most three steps', () => {
    for (const { trace, id, match } of STATIONS)
      for (const start of ALL_ORIENTATIONS) {
        const operations = operationsToMatch(match, start)
        const where = `${trace.id} ${id} from ${start.turns}${start.reflected}`
        expect([where, operations.length <= 3]).toEqual([where, true])
        expect([where, isAccepted(match, operations.reduce(turnCt, start))]).toEqual([where, true])
        // No shorter way exists: nothing short of the last step already matches.
        let at = start
        for (const operation of operations) {
          expect([where, isAccepted(match, at)]).toEqual([where, false])
          at = turnCt(at, operation)
        }
        const reading = readMatch(match, start)
        expect(reading.operations).toEqual(operations)
        expect([where, reading.kind === 'matches']).toEqual([where, isAccepted(match, start)])
        expect([where, reading.kind === 'matches']).toEqual([where, operations.length === 0])
        if (reading.example) {
          // The example names a letter the scope does show, on a different side of the CT.
          expect(reading.example.scope).toBe(match.scopeSides[reading.example.letter])
          expect(reading.example.ct).toBe(displaySides(start)[reading.example.letter])
          expect(reading.example.scope).not.toBe(reading.example.ct)
        }
      }
  })
})

describe('reading a mismatch', () => {
  const mirrorOnly = frame(CAUDAL, ANTERIOR)
  const standardOnly = frame(CRANIAL, ANTERIOR)
  const rulOnly = frame(CRANIAL, [1, 0, 0])

  test('operationsToMatch gives the fewest operations, and none when the display already matches', () => {
    expect(operationsToMatch(mirrorOnly, STANDARD_ORIENTATION)).toEqual(['flip'])
    expect(operationsToMatch(mirrorOnly, MIRROR)).toEqual([])
    expect(operationsToMatch(standardOnly, STANDARD_ORIENTATION)).toEqual([])
    expect(operationsToMatch(rulOnly, STANDARD_ORIENTATION)).toEqual(['left'])
    expect(operationsToMatch(frame(CRANIAL, [-1, 0, 0]), STANDARD_ORIENTATION)).toEqual(['right'])
    expect(operationsToMatch(rulOnly, QUARTER_CLOCKWISE)).toEqual(['left', 'left'])
    expect(operationsToMatch(rulOnly, MIRROR)).toEqual(['flip', 'left'])
  })

  test('standard axial against a mirror match reads as mirrored, with R or L as the example', () => {
    const reading = readMatch(mirrorOnly, STANDARD_ORIENTATION)
    expect(reading.kind).toBe('mirrored')
    expect(reading.operations).toEqual(['flip'])
    expect(['R', 'L']).toContain(reading.example!.letter)
    expect(reading.example).toEqual({ letter: 'R', scope: 'right', ct: 'left' })
  })

  test('a quarter turn away reads as rotated; a flip and a turn away as both', () => {
    const rotated = readMatch(rulOnly, STANDARD_ORIENTATION)
    expect(rotated.kind).toBe('rotated')
    expect(rotated.operations).toEqual(['left'])
    expect(rotated.example).toEqual({ letter: 'R', scope: 'bottom', ct: 'left' })
    expect(readMatch(rulOnly, QUARTER_CLOCKWISE).kind).toBe('rotated')
    expect(readMatch(rulOnly, MIRROR).kind).toBe('rotated-and-mirrored')
  })

  test('a matching display reads as matching, with no example and nothing to do', () => {
    expect(readMatch(mirrorOnly, MIRROR)).toEqual({
      kind: 'matches',
      example: null,
      operations: [],
    })
    expect(readMatch(standardOnly, STANDARD)).toEqual({
      kind: 'matches',
      example: null,
      operations: [],
    })
  })

  test('operations are said as one sentence', () => {
    expect(operationsSentence([])).toBe('')
    expect(operationsSentence(['flip'])).toBe('Flip.')
    expect(operationsSentence(['flip', 'left'])).toBe('Flip, then rotate left.')
    expect(operationsSentence(['left', 'left'])).toBe('Rotate left twice.')
    expect(operationsSentence(['right'])).toBe('Rotate right.')
    expect(operationsSentence(['flip', 'right', 'right'])).toBe('Flip, then rotate right twice.')
    expect(operationsSentence(['reset'])).toBe('Return to standard axial.')
  })
})
