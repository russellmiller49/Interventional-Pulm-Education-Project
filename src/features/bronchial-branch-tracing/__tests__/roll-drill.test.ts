import {
  ROLL_CHOICE_DECLINED,
  ROLL_CLOSING,
  ROLL_CONCEPT,
  ROLL_OBJECTIVE,
  ROLL_TITLE,
  ROLL_TURN_FITS,
  ROLL_TURN_SHOWN,
  mapTurnReadout,
  rollChooseCard,
  rollDriveCard,
  rollReadyCard,
  rollStartCard,
  rollSummaryLines,
  rollTurnCard,
  rollTurnVerdict,
} from '../content/roll-copy'
import { ALL_LESSONS, buildTrip } from '../content/nav-lessons'
import { ASSESS_TARGET_IDS } from '../content/targets'
import { angleGap, mapTurnToScope, mappedForks } from '../engine/arc-map'
import { DEMO_LESSON_ID } from '../engine/demo-script'
import {
  MAP_TURN_STEP,
  MAP_TURN_TOLERANCE,
  ROLL_DRILL_FORKS,
  ROLL_DRILL_ID,
  gradeMapTurn,
  rollForkGeometry,
  rollReducer,
  shownTurn,
  startRollDrill,
  summarizeRoll,
  type RollAction,
  type RollSession,
} from '../engine/roll-drill'
import { dot } from '../geometry/coordinates'
import { openingAnchors } from '../geometry/opening-anchors'
import { cameraBasis } from '../geometry/reference-frames'
import { rollPose, stationCamera } from '../geometry/route-stations'

const GATE =
  /\b(score|scored|points|grade|graded|pass|passed|mastery|correct|incorrect|wrong|synthetic|authored|NOT\s+REVIEWED|pending|faculty)\b/i
const run = (actions: RollAction[], from: RollSession = startRollDrill()) =>
  actions.reduce(rollReducer, from)
const FORKS = ROLL_DRILL_FORKS.map((_, index) => rollForkGeometry(index))

describe('rolling the scope', () => {
  const rest = stationCamera(FORKS[0].trace, FORKS[0].checkpointIndex)!

  test('turns the picture and nothing else: same place, same look, an upright still square to it', () => {
    for (const degrees of [0, 45, 90, 135, 180, -90, 270]) {
      const rolled = rollPose(rest, degrees)
      expect(rolled.position).toEqual(rest.position)
      expect(rolled.direction).toEqual(rest.direction)
      expect(rolled.arc).toBe(rest.arc)
      expect(Math.hypot(...rolled.up)).toBeCloseTo(1, 6)
      expect(dot(rolled.up, rolled.direction)).toBeCloseTo(0, 6)
    }
    const basis = cameraBasis(rest.direction, rest.up)
    // A quarter turn puts what was at the top of the picture on its right: clockwise.
    const quarter = cameraBasis(rest.direction, rollPose(rest, 90).up)
    expect(dot(basis.up, quarter.right)).toBeCloseTo(1, 6)
    expect(dot(basis.up, quarter.up)).toBeCloseTo(0, 6)
    // A whole turn is no turn.
    rollPose(rest, 360).up.forEach((value, i) => expect(value).toBeCloseTo(basis.up[i], 6))
  })

  test('the map has to be turned by the scope’s roll, on top of the turn the airway already asks', () => {
    for (const { frame, trace, checkpointIndex, fork, mapTurn } of FORKS) {
      const camera = stationCamera(trace, checkpointIndex)!
      const natural = mapTurnToScope(frame, 0, cameraBasis(camera.direction, camera.up)).angle
      expect(angleGap(mapTurn, natural + fork.rollDeg)).toBeLessThan(0.001)
    }
  })

  test('an opening’s number is anchored along its airway, deepest first', () => {
    const anchors = openingAnchors([0, 0, 0], [0, 0, 20])
    expect(anchors.map((point) => point[2])).toEqual([12, 9, 6, 3, 1.5])
    // A daughter shorter than 3 mm is not overshot at the fourth anchor.
    expect(openingAnchors([1, 1, 1], [1, 3, 1])[3]).toEqual([1, 3, 1])
    openingAnchors([1, 1, 1], [1, 1, 1]).forEach((point) =>
      point.forEach((value) => expect(Number.isFinite(value)).toBe(true)),
    )
  })
})

describe('the drill’s divisions', () => {
  test('are divisions past the ostium of lessons’ own lesions, never the closing set’s', () => {
    const taught = new Set(
      ALL_LESSONS.flatMap((lesson) =>
        lesson.trips.map(
          (spec) => buildTrip(spec, { matchOptional: true, cruise: true }).target?.id ?? '',
        ),
      ),
    )
    expect(ROLL_DRILL_FORKS).toHaveLength(5)
    for (const fork of ROLL_DRILL_FORKS) {
      expect(taught.has(fork.targetId)).toBe(true)
      expect(ASSESS_TARGET_IDS).not.toContain(fork.targetId)
      expect(fork.division).toBeGreaterThanOrEqual(1)
    }
    expect(new Set(ROLL_DRILL_FORKS.map((fork) => fork.targetId)).size).toBe(2)
    expect([ROLL_DRILL_ID, DEMO_LESSON_ID]).not.toContain(ALL_LESSONS[0].id)
    expect(ALL_LESSONS.map((lesson) => lesson.id)).not.toContain(ROLL_DRILL_ID)
  })

  test('each is driven to from the division before it, with a turn that is well defined', () => {
    FORKS.forEach((geometry, index) => {
      const forks = mappedForks(geometry.trace, geometry.target)
      expect(geometry.checkpointIndex).toBe(forks[geometry.fork.division])
      expect(geometry.fromCheckpointIndex).toBe(forks[geometry.fork.division - 1])
      expect(geometry.reliable).toBe(true)
      // No drill fork is unrolled, and none is rolled the same as the fork before it.
      expect(geometry.fork.rollDeg % 360).not.toBe(0)
      expect(geometry.fork.rollDeg).not.toBe(geometry.fromRollDeg)
      const before = ROLL_DRILL_FORKS[index - 1]
      expect(geometry.fromRollDeg).toBe(
        before && before.targetId === geometry.fork.targetId ? before.rollDeg : 0,
      )
      const options = geometry.trace.checkpoints[geometry.checkpointIndex].decision!.options
      expect(geometry.routeOption).toBeLessThan(options.length)
      // The camera at rest is the station's own, rolled.
      const rest = stationCamera(geometry.trace, geometry.checkpointIndex)!
      expect(geometry.camera.position).toEqual(rest.position)
      expect(geometry.camera.up).toEqual(rollPose(rest, geometry.fork.rollDeg).up)
    })
    expect(() => rollForkGeometry(ROLL_DRILL_FORKS.length)).toThrow(/no fork/)
  })

  test('a step of the turn buttons always lands inside the tolerance', () => {
    expect(MAP_TURN_STEP).toBeLessThanOrEqual(MAP_TURN_TOLERANCE)
    for (const { mapTurn } of FORKS) {
      expect(shownTurn(mapTurn) % MAP_TURN_STEP).toBe(0)
      expect(gradeMapTurn(shownTurn(mapTurn), mapTurn).verdict).toBe('fits')
    }
    expect(shownTurn(359)).toBe(0)
  })
})

describe('checking the map’s turn', () => {
  test('within 45° fits; a half turn and a quarter turn out are named; the rest is not yet', () => {
    expect(gradeMapTurn(90, 98)).toEqual({ gap: 8, verdict: 'fits' })
    expect(gradeMapTurn(45, 90).verdict).toBe('fits')
    expect(gradeMapTurn(350, 10).verdict).toBe('fits')
    expect(gradeMapTurn(270, 98).verdict).toBe('half')
    expect(gradeMapTurn(225, 90).verdict).toBe('half')
    expect(gradeMapTurn(0, 98).verdict).toBe('quarter')
    expect(gradeMapTurn(180, 98).verdict).toBe('quarter')
    expect(gradeMapTurn(40, 98).verdict).toBe('off')
    expect(gradeMapTurn(150, 30).verdict).toBe('off')
  })
})

describe('the drill, step by step', () => {
  const first = FORKS[0]
  const fits = shownTurn(first.mapTurn)

  test('opens at the ostium, unrolled, and nothing can be turned or chosen until the scope stops', () => {
    const start = startRollDrill()
    expect(start).toMatchObject({ fork: 0, phase: 'start', mapTurn: 0, checked: null })
    for (const action of [
      { type: 'turn', degrees: 45 },
      { type: 'check' },
      { type: 'show-turn' },
      { type: 'choose', option: 0 },
      { type: 'arrive' },
      { type: 'replay' },
    ] as RollAction[])
      expect(rollReducer(start, action)).toBe(start)
    const driving = run([{ type: 'drive' }])
    expect(driving.phase).toBe('drive')
    expect(rollReducer(driving, { type: 'turn', degrees: 45 })).toBe(driving)
    expect(run([{ type: 'arrive' }], driving).phase).toBe('turn')
  })

  test('the map turns in steps either way round, and a turn clears the last check', () => {
    const turning = run([{ type: 'drive' }, { type: 'arrive' }])
    expect(run([{ type: 'turn', degrees: -45 }], turning).mapTurn).toBe(315)
    expect(
      run(
        [
          { type: 'turn', degrees: 45 },
          { type: 'turn', degrees: 45 },
        ],
        turning,
      ).mapTurn,
    ).toBe(90)
    expect(rollReducer(turning, { type: 'turn', degrees: 360 })).toBe(turning)
    const half = (fits + 180) % 360
    const missed = run([{ type: 'turn', degrees: half }, { type: 'check' }], turning)
    expect(missed).toMatchObject({ phase: 'turn', checked: 'half' })
    expect(missed.log[0].turnMisses).toBe(1)
    // The same turn checked again is not a second miss.
    expect(rollReducer(missed, { type: 'check' })).toBe(missed)
    const moved = run([{ type: 'turn', degrees: 90 }], missed)
    expect(moved.checked).toBeNull()
    const quarter = run([{ type: 'check' }], moved)
    expect(quarter.checked).toBe('quarter')
    expect(quarter.log[0].turnMisses).toBe(2)
  })

  test('a map that fits goes on to the choice; the opening that leads away is refused once', () => {
    const choosing = run([
      { type: 'drive' },
      { type: 'arrive' },
      { type: 'turn', degrees: fits },
      { type: 'check' },
    ])
    expect(choosing).toMatchObject({ phase: 'choose', mapTurn: fits, checked: null })
    expect(choosing.log[0]).toMatchObject({ turnMisses: 0, turnShown: false })
    // The map is held once it fits.
    expect(rollReducer(choosing, { type: 'turn', degrees: 45 })).toBe(choosing)
    const other = 1 - first.routeOption
    const declined = run([{ type: 'choose', option: other }], choosing)
    expect(declined).toMatchObject({ phase: 'choose', declined: [other] })
    expect(declined.log[0].chooseMisses).toBe(1)
    expect(rollReducer(declined, { type: 'choose', option: other })).toBe(declined)
    expect(rollReducer(declined, { type: 'choose', option: 9 })).toBe(declined)
    const taken = run([{ type: 'choose', option: first.routeOption }], declined)
    expect(taken.phase).toBe('ready')
  })

  test('the drive in can be watched again, and that is counted, not held against the learner', () => {
    const turning = run([{ type: 'drive' }, { type: 'arrive' }, { type: 'turn', degrees: 45 }])
    const again = run([{ type: 'replay' }], turning)
    expect(again).toMatchObject({ phase: 'drive', mapTurn: 45 })
    expect(again.log[0]).toMatchObject({ replays: 1, turnMisses: 0 })
    expect(run([{ type: 'arrive' }], again).phase).toBe('turn')
  })

  /** One fork taken cleanly, from the turn step. */
  const clean = (index: number): RollAction[] => [
    { type: 'arrive' },
    { type: 'show-turn' },
    { type: 'choose', option: FORKS[index].routeOption },
    { type: 'drive' },
  ]

  test('the map stays as held along a route and goes back to how it was drawn on the next', () => {
    let session = run([{ type: 'drive' }, ...clean(0)])
    // Still the RB1 route: straight into the next drive, the map as it was left.
    expect(session).toMatchObject({ fork: 1, phase: 'drive', mapTurn: shownTurn(FORKS[0].mapTurn) })
    session = run(clean(1), session)
    // A new route: back at its ostium, the map unturned.
    expect(session).toMatchObject({ fork: 2, phase: 'start', mapTurn: 0, declined: [] })
    session = run([{ type: 'drive' }, ...clean(2), ...clean(3)], session)
    expect(session).toMatchObject({ fork: 4, phase: 'drive' })
    session = run(clean(4), session)
    expect(session.phase).toBe('done')
    expect(session.log).toHaveLength(5)
    // The bench showed every turn, so none counts as a first check; every choice was the first.
    expect(summarizeRoll(session)).toEqual({
      forks: 5,
      turn: { asked: 5, firstTry: 0 },
      choose: { asked: 5, firstTry: 5 },
    })
    expect(rollReducer(session, { type: 'drive' })).toBe(session)
    expect(rollReducer(session, { type: 'restart' })).toEqual(startRollDrill())
  })

  test('the summary counts only divisions that are finished', () => {
    expect(summarizeRoll(startRollDrill())).toMatchObject({
      turn: { asked: 0, firstTry: 0 },
      choose: { asked: 0, firstTry: 0 },
    })
    const ready = run([
      { type: 'drive' },
      { type: 'arrive' },
      { type: 'turn', degrees: fits },
      { type: 'check' },
      { type: 'show-choice' },
    ])
    expect(ready.phase).toBe('ready')
    expect(summarizeRoll(ready)).toMatchObject({
      turn: { asked: 1, firstTry: 1 },
      choose: { asked: 1, firstTry: 0 },
    })
  })
})

describe('the drill’s words', () => {
  test('every sentence is whole, and none uses a word of marking', () => {
    const cards = [
      rollStartCard('RB1', true),
      rollStartCard('RB5', false),
      rollDriveCard(2),
      rollTurnCard(3),
      rollChooseCard(),
      rollReadyCard(false, false),
      rollReadyCard(false, true),
      rollReadyCard(true, false),
    ]
    const bands = [
      rollTurnVerdict('half'),
      rollTurnVerdict('quarter'),
      rollTurnVerdict('off'),
      ROLL_TURN_FITS,
      ROLL_TURN_SHOWN,
      ROLL_CHOICE_DECLINED,
    ]
    const said = [
      ROLL_TITLE,
      ROLL_OBJECTIVE,
      ROLL_CONCEPT,
      ROLL_CLOSING,
      ...cards.flatMap((card) => [card.heading, card.body, card.where ?? 'x']),
      ...bands.flatMap((band) => [band.headline, band.detail]),
      ...[0, 45, 90, 135, 180, 225, 270, 315, 360, -90].map(mapTurnReadout),
      ...rollSummaryLines({
        forks: 5,
        turn: { asked: 5, firstTry: 3 },
        choose: { asked: 5, firstTry: 4 },
      }),
    ]
    for (const text of said) {
      expect(text).toBe(text.trim())
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/undefined|null|NaN|\[object|  /)
      expect(text).not.toMatch(GATE)
    }
    expect(new Set(bands.map((band) => band.headline)).size).toBe(bands.length)
    // The three verdicts carry their tone by more than colour: each has its own headline.
    expect(rollTurnVerdict('half').tone).toBe('near')
    expect(rollTurnVerdict('quarter').tone).toBe('miss')
  })

  test('the map’s turn is read out the shorter way round', () => {
    expect(mapTurnReadout(0)).toBe('The map sits as it was drawn.')
    expect(mapTurnReadout(360)).toBe('The map sits as it was drawn.')
    expect(mapTurnReadout(90)).toBe('Map turned 90° clockwise.')
    expect(mapTurnReadout(180)).toBe('Map turned a half turn.')
    expect(mapTurnReadout(270)).toBe('Map turned 90° counterclockwise.')
    expect(mapTurnReadout(-45)).toBe('Map turned 45° counterclockwise.')
  })
})
