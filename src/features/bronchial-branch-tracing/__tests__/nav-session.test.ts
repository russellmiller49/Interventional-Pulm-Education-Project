import type { CtTrace } from '../content/ct-types'
import { routePlan } from '../content/nav-lessons'
import {
  optionHasVerdict,
  optionVerdict,
  responseLumen,
  responsePlane,
} from '../engine/junction-feedback'
import {
  benchOrientation,
  flyingThrough,
  matchable,
  navReducer,
  onwardOption,
  routeOption,
  startSession,
  stationCheckpoint,
  summarize,
  type NavAction,
  type NavPlan,
  type NavSession,
  type NavStep,
} from '../engine/nav-session'
import { isAccepted, stationMatch } from '../engine/orientation-match'
import { CT_TRACES, traceById } from '../geometry/native-ct'
import { mappedForks } from '../engine/arc-map'
import { TARGET_FOR_TRACE, plannedTarget } from '../content/nav-lessons'
import {
  STANDARD_ORIENTATION,
  orientationFor,
  sameOrientation,
  type CtOrientation,
} from '../geometry/orientation'

/**
 * One trip of the scope along a route: match, identify, choose, drive, fork after fork. The
 * reducer is pure, so every case here is a list of actions and the state they leave.
 */
const MIRROR: CtOrientation = { turns: 0, reflected: true }
const ALL_STEPS: NavStep[] = ['match', 'identify', 'choose']

const central = traceById('central-right')
/** The trachea and the right main bronchus, every step asked, stopping at the second fork. */
const twoForks: NavPlan = {
  traceId: 'central-right',
  stations: [
    { checkpointIndex: 0, steps: ALL_STEPS },
    { checkpointIndex: 1, steps: ALL_STEPS },
  ],
  arrive: false,
}
const run = (trace: CtTrace, plan: NavPlan, actions: NavAction[], from?: NavSession) =>
  actions.reduce(navReducer(trace, plan), from ?? startSession(trace, plan))
const markAt = (trace: CtTrace, checkpointIndex: number, option: number) => {
  const plane = responsePlane(trace, checkpointIndex, option)!
  return { slice: plane.slice, pixel: [...plane.pixel] as [number, number] }
}
/** The action the bench itself would take next: every step shown, then drive on. */
function shown(state: NavSession): NavAction | null {
  switch (state.phase) {
    case 'match':
      return { type: 'show-match' }
    case 'identify':
      return { type: 'show-mark' }
    case 'choose':
      return { type: 'show-choice' }
    case 'ready':
      return { type: 'drive' }
    case 'drive':
      return { type: 'arrive' }
    default:
      return null
  }
}
function walk(trace: CtTrace, plan: NavPlan, cap = 400) {
  const reduce = navReducer(trace, plan)
  let state = startSession(trace, plan)
  let actions = 0
  for (let action = shown(state); action && actions < cap; action = shown(state)) {
    const next = reduce(state, action)
    // Every shown step moves the trip on.
    expect(next).not.toBe(state)
    state = next
    actions++
  }
  return { state, actions }
}

describe('starting a trip', () => {
  test('a route starts at the trachea in standard axial, asked to match the CT to the scope', () => {
    const plan = routePlan(central, { matchOptional: false })
    const session = startSession(central, plan)
    expect(session).toMatchObject({
      version: 2,
      traceId: 'central-right',
      station: 0,
      phase: 'match',
      orientation: STANDARD_ORIENTATION,
      matchNote: 'asked',
      matchChecked: null,
      identifyOption: 0,
      marks: [null, null],
      declined: [],
      choice: null,
      astray: null,
      optionalCheck: null,
    })
    expect(session.log).toEqual([
      {
        matchAsked: true,
        matchMisses: 0,
        matchShown: false,
        identifyAsked: false,
        identifyMisses: 0,
        identifyShown: false,
        chooseAsked: true,
        chooseMisses: 0,
        chooseShown: false,
        wrongTurns: 0,
        backedOut: 0,
      },
    ])
    // The mirror is what the trachea needs, and the CT does not start there.
    const match = stationMatch(central, 0)!
    expect(match.accepted).toEqual([MIRROR])
    expect(matchable(match)).toBe(true)
    expect(stationCheckpoint(central, plan, 0).id).toBe('junction-1')
    expect(session.orientation).not.toBe(STANDARD_ORIENTATION)
  })

  test('the route’s own opening is the daughter the route continues along', () => {
    for (const trace of CT_TRACES)
      trace.checkpoints.forEach((checkpoint, index) => {
        if (!checkpoint.decision) return
        const option = checkpoint.decision.options[routeOption(trace, index)]
        expect(option.sourceEdgeId).toBe(checkpoint.sourceEdgeId)
        const parentAt = trace.sourceEdgeIds.indexOf(checkpoint.decision.parent.sourceEdgeId)
        expect([trace.id, checkpoint.id, trace.sourceEdgeIds[parentAt + 1]]).toEqual([
          trace.id,
          checkpoint.id,
          option.sourceEdgeId,
        ])
      })
    expect(routeOption(central, 0)).toBe(0) // RMSB
    expect(routeOption(traceById('left-lower-basal'), 0)).toBe(1) // LMSB
  })

  test('a fork is matchable when one display matches, or two that differ along the line of sight', () => {
    expect(matchable(null)).toBe(false)
    const counts = new Map<number, boolean>()
    for (const trace of CT_TRACES)
      trace.checkpoints.forEach((checkpoint, index) => {
        if (!checkpoint.decision) return
        const match = stationMatch(trace, index)!
        counts.set(match.accepted.length, matchable(match))
      })
    expect([...counts].sort((a, b) => a[0] - b[0])).toEqual([
      [1, true],
      [2, true],
      [4, false],
    ])
  })
})

describe('match', () => {
  const plan = routePlan(central, { matchOptional: false })
  const reduce = navReducer(central, plan)
  const start = startSession(central, plan)

  test('a check that does not match is counted once, and stays put', () => {
    const missed = reduce(start, { type: 'check-match' })
    expect(missed.phase).toBe('match')
    expect(missed.matchChecked).toEqual(STANDARD_ORIENTATION)
    expect(missed.log[0].matchMisses).toBe(1)
    expect(missed.orientation).toEqual(STANDARD_ORIENTATION)
    // Checking the same display again changes nothing: the same object comes back.
    expect(reduce(missed, { type: 'check-match' })).toBe(missed)
    // A different display that also does not match is a new miss.
    const turned = reduce(missed, { type: 'turn', operation: 'left' })
    expect(turned.matchChecked).toBeNull()
    expect(turned.orientation).toEqual({ turns: 3, reflected: false })
    expect(turned.log[0].matchMisses).toBe(1)
    expect(reduce(turned, { type: 'check-match' }).log[0].matchMisses).toBe(2)
  })

  test('turning clears the last check; flipping then checking moves on to the next asked step', () => {
    const missed = reduce(start, { type: 'check-match' })
    const flipped = reduce(missed, { type: 'turn', operation: 'flip' })
    expect(flipped.orientation).toEqual(MIRROR)
    expect(flipped.matchChecked).toBeNull()
    expect(flipped.phase).toBe('match')
    const matched = reduce(flipped, { type: 'check-match' })
    // The first two forks of a route are matched and chosen at, not marked.
    expect(plan.stations[0].steps).toEqual(['match', 'choose'])
    expect(matched.phase).toBe('choose')
    expect(matched.matchChecked).toBeNull()
    expect(matched.orientation).toEqual(MIRROR)
    expect(matched.log[0]).toMatchObject({ matchAsked: true, matchMisses: 1, matchShown: false })
    // Where the fork asks for its openings to be identified, that comes first.
    const identified = run(central, twoForks, [
      { type: 'turn', operation: 'flip' },
      { type: 'check-match' },
    ])
    expect(identified.phase).toBe('identify')
    expect(identified.log[0]).toMatchObject({ matchMisses: 0, identifyAsked: true })
  })

  test('a turn that changes nothing returns the same object, and the CT can be turned in any resting phase', () => {
    expect(reduce(start, { type: 'turn', operation: 'reset' })).toBe(start)
    const chosen = run(central, plan, [{ type: 'show-match' }, { type: 'show-choice' }])
    expect(chosen.phase).toBe('ready')
    const turned = reduce(chosen, { type: 'turn', operation: 'right' })
    expect(turned.orientation).toEqual({ turns: 1, reflected: true })
    expect(turned.phase).toBe('ready')
    // Not while the scope is moving.
    const driving = reduce(chosen, { type: 'drive' })
    expect(reduce(driving, { type: 'turn', operation: 'right' })).toBe(driving)
  })

  test('show-match turns the CT to a matching display and records that it was shown', () => {
    const shownMatch = reduce(start, { type: 'show-match' })
    expect(shownMatch.orientation).toEqual(MIRROR)
    expect(isAccepted(stationMatch(central, 0)!, shownMatch.orientation)).toBe(true)
    expect(shownMatch.phase).toBe('choose')
    expect(shownMatch.matchChecked).toBeNull()
    expect(shownMatch.log[0]).toMatchObject({ matchShown: true, matchMisses: 0 })
    // Only while matching is the step in hand.
    expect(reduce(shownMatch, { type: 'show-match' })).toBe(shownMatch)
    expect(reduce(shownMatch, { type: 'check-match' })).toBe(shownMatch)
  })

  test('the bench keeps a display that matches, prefers the book’s when it must turn, and otherwise turns least', () => {
    const trachea = stationMatch(central, 0)!
    expect(benchOrientation(trachea, MIRROR)).toBe(MIRROR)
    expect(benchOrientation(trachea, STANDARD_ORIENTATION)).toEqual(MIRROR)
    for (const trace of CT_TRACES)
      trace.checkpoints.forEach((checkpoint, index) => {
        if (!checkpoint.decision) return
        const match = stationMatch(trace, index)!
        for (const current of [STANDARD_ORIENTATION, MIRROR, orientationFor(trace.preset)]) {
          const chosen = benchOrientation(match, current)
          expect(isAccepted(match, chosen)).toBe(true)
          if (isAccepted(match, current)) expect(chosen).toBe(current)
          else if (match.bookAccepted) expect(sameOrientation(chosen, match.book)).toBe(true)
        }
      })
  })
})

describe('identify', () => {
  const reduce = navReducer(central, twoForks)
  const identifying = run(central, twoForks, [{ type: 'show-match' }])
  const [rmsb, lmsb] = [markAt(central, 0, 0), markAt(central, 0, 1)]

  test('the openings are identified in order, each on its own response plane', () => {
    expect(identifying.phase).toBe('identify')
    expect(identifying.identifyOption).toBe(0)
    expect(identifying.marks).toEqual([null, null])
    expect([rmsb.slice, lmsb.slice]).toEqual([372, 372])
  })

  test('a mark on another slice, or without a pixel, is ignored', () => {
    expect(reduce(identifying, { type: 'mark', mark: { ...rmsb, slice: 387 } })).toBe(identifying)
    expect(reduce(identifying, { type: 'mark', mark: { ...rmsb, slice: 371 } })).toBe(identifying)
    expect(reduce(identifying, { type: 'mark', mark: { slice: 372, pixel: null } })).toBe(
      identifying,
    )
    // And a mark outside the identify step is not a mark at all.
    const matching = startSession(central, twoForks)
    expect(reduce(matching, { type: 'mark', mark: rmsb })).toBe(matching)
    expect(reduce(matching, { type: 'show-mark' })).toBe(matching)
  })

  test('a mark in the other opening’s lumen is recorded as a miss and the opening is asked again', () => {
    const missed = reduce(identifying, { type: 'mark', mark: lmsb })
    expect(missed.phase).toBe('identify')
    expect(missed.identifyOption).toBe(0)
    expect(missed.marks).toEqual([
      { mark: lmsb, verdict: 'other-airway', ok: false, shown: false },
      null,
    ])
    expect(missed.log[0]).toMatchObject({ identifyMisses: 1, identifyShown: false })
    expect(missed.marks[0]!.verdict).toBe(optionVerdict(central, 0, 0, lmsb)!.verdict)
    // The next mark replaces it.
    const again = reduce(missed, { type: 'mark', mark: rmsb })
    expect(again.marks[0]).toEqual({
      mark: rmsb,
      verdict: 'intended-lumen',
      ok: true,
      shown: false,
    })
    expect(again.log[0].identifyMisses).toBe(1)
    expect(again.identifyOption).toBe(1)
  })

  test('a mark in the opening’s own lumen moves on to the next opening, and after the last to choosing', () => {
    const first = reduce(identifying, { type: 'mark', mark: rmsb })
    expect(first.identifyOption).toBe(1)
    expect(first.phase).toBe('identify')
    expect(first.marks).toEqual([
      { mark: rmsb, verdict: 'intended-lumen', ok: true, shown: false },
      null,
    ])
    // The first opening's lumen is not the second's.
    const wrong = reduce(first, { type: 'mark', mark: rmsb })
    expect(wrong.identifyOption).toBe(1)
    expect(wrong.marks[1]).toMatchObject({ verdict: 'other-airway', ok: false })
    const second = reduce(first, { type: 'mark', mark: lmsb })
    expect(second.phase).toBe('choose')
    expect(second.marks.map((m) => m?.ok)).toEqual([true, true])
    expect(second.log[0]).toMatchObject({ identifyAsked: true, identifyMisses: 0 })
    expect(reduce(second, { type: 'mark', mark: lmsb })).toBe(second)
  })

  test('show-mark places the mark in the opening’s lumen on its response plane and says it was shown', () => {
    const one = reduce(identifying, { type: 'show-mark' })
    // The bench marks the lumen itself: the air nearest the opening's model centre.
    expect(one.marks[0]).toEqual({
      mark: { slice: 372, pixel: responseLumen(central, 0, 0)!.pixel },
      verdict: 'intended-lumen',
      ok: true,
      shown: true,
    })
    expect(one.identifyOption).toBe(1)
    expect(one.log[0]).toMatchObject({ identifyShown: true, identifyMisses: 0 })
    const two = reduce(one, { type: 'show-mark' })
    expect(two.phase).toBe('choose')
    expect(two.marks[1]).toMatchObject({
      mark: { slice: 372, pixel: responseLumen(central, 0, 1)!.pixel },
      verdict: 'intended-lumen',
      shown: true,
      ok: true,
    })
  })

  test('a plan that stops after identifying is done there, or ready to drive when it goes on', () => {
    const matchAndIdentify: NavStep[] = ['match', 'identify']
    const only: NavPlan = {
      ...twoForks,
      stations: [{ checkpointIndex: 0, steps: matchAndIdentify }],
    }
    const actions: NavAction[] = [
      { type: 'show-match' },
      { type: 'show-mark' },
      { type: 'show-mark' },
    ]
    expect(run(central, only, actions).phase).toBe('done')
    expect(run(central, { ...only, arrive: true }, actions).phase).toBe('ready')
  })
})

describe('choose', () => {
  const plan = routePlan(central, { matchOptional: false })
  const reduce = navReducer(central, plan)
  const choosing = run(central, plan, [{ type: 'show-match' }])
  const route = routeOption(central, 0)
  const other = 1 - route

  test('the opening the route takes is accepted and the scope is ready to drive', () => {
    expect(choosing.phase).toBe('choose')
    const chosen = reduce(choosing, { type: 'choose', option: route })
    expect(chosen.phase).toBe('ready')
    expect(chosen.choice).toBe(route)
    expect(chosen.declined).toEqual([])
    expect(chosen.log[0]).toMatchObject({ chooseAsked: true, chooseMisses: 0, chooseShown: false })
    expect(onwardOption(central, plan, chosen)).toBe(route)
    // Before a choice is made the scope would still take the route's own opening.
    expect(onwardOption(central, plan, choosing)).toBe(route)
  })

  test('an opening that leads away is driven into, backed out of, then greyed', () => {
    const turning = reduce(choosing, { type: 'choose', option: other })
    expect(turning).toMatchObject({ phase: 'astray-in', astray: other, choice: null, declined: [] })
    expect(turning.log[0]).toMatchObject({ chooseMisses: 1, wrongTurns: 1, backedOut: 0 })
    // Nothing else happens while the scope moves.
    expect(reduce(turning, { type: 'turn', operation: 'flip' })).toBe(turning)
    expect(reduce(turning, { type: 'choose', option: route })).toBe(turning)
    expect(reduce(turning, { type: 'back-out' })).toBe(turning)
    const inside = reduce(turning, { type: 'astray-arrive' })
    expect(inside).toMatchObject({ phase: 'astray', astray: other })
    expect(reduce(inside, { type: 'choose', option: route })).toBe(inside)
    // The CT can be turned while the scope rests in the other branch.
    expect(reduce(inside, { type: 'turn', operation: 'flip' }).orientation).not.toEqual(
      inside.orientation,
    )
    const leaving = reduce(inside, { type: 'back-out' })
    expect(leaving.phase).toBe('astray-out')
    const back = reduce(leaving, { type: 'astray-return' })
    expect(back).toMatchObject({ phase: 'choose', astray: null, declined: [other], choice: null })
    expect(back.log[0]).toMatchObject({ chooseMisses: 1, wrongTurns: 1, backedOut: 1 })
    // Once backed out of, the opening is greyed: choosing it again does nothing.
    expect(reduce(back, { type: 'choose', option: other })).toBe(back)
    const chosen = reduce(back, { type: 'choose', option: route })
    expect(chosen).toMatchObject({ phase: 'ready', choice: route, declined: [other] })
    expect(chosen.log[0].chooseMisses).toBe(1)
  })

  test('an opening the fork does not have is ignored, and so is choosing outside the step', () => {
    expect(reduce(choosing, { type: 'choose', option: 2 })).toBe(choosing)
    expect(reduce(choosing, { type: 'choose', option: -1 })).toBe(choosing)
    const start = startSession(central, plan)
    expect(reduce(start, { type: 'choose', option: route })).toBe(start)
    expect(reduce(start, { type: 'show-choice' })).toBe(start)
  })

  test('show-choice takes the route’s opening and says it was shown', () => {
    const shownChoice = reduce(choosing, { type: 'show-choice' })
    expect(shownChoice).toMatchObject({ phase: 'ready', choice: route, declined: [] })
    expect(shownChoice.log[0]).toMatchObject({ chooseShown: true, chooseMisses: 0 })
  })
})

describe('driving on', () => {
  const plan = routePlan(central, { matchOptional: false })
  const reduce = navReducer(central, plan)
  const ready = run(central, plan, [{ type: 'show-match' }, { type: 'show-choice' }])

  test('the scope drives only when ready, and arrives only while driving', () => {
    for (const state of [
      startSession(central, plan),
      run(central, plan, [{ type: 'show-match' }]),
      run(central, twoForks, [{ type: 'show-match' }]),
    ]) {
      expect(['match', 'choose', 'identify']).toContain(state.phase)
      expect(navReducer(central, plan)(state, { type: 'drive' })).toBe(state)
      expect(navReducer(central, plan)(state, { type: 'arrive' })).toBe(state)
    }
    expect(reduce(ready, { type: 'arrive' })).toBe(ready)
    const driving = reduce(ready, { type: 'drive' })
    expect(driving.phase).toBe('drive')
    expect(driving.station).toBe(0)
    expect(reduce(driving, { type: 'drive' })).toBe(driving)
  })

  test('arriving where the CT still matches keeps it, and goes straight to the next asked step', () => {
    const arrived = run(central, plan, [{ type: 'drive' }, { type: 'arrive' }], ready)
    expect(arrived.station).toBe(1)
    expect(stationCheckpoint(central, plan, 1).id).toBe('junction-2')
    expect(arrived.orientation).toEqual(MIRROR)
    expect(isAccepted(stationMatch(central, 1)!, MIRROR)).toBe(true)
    expect(arrived.matchNote).toBe('kept')
    expect(arrived.phase).toBe('choose')
    // A fresh fork: nothing marked, declined or chosen, and its own line in the log.
    expect(arrived).toMatchObject({
      identifyOption: 0,
      marks: [null, null],
      declined: [],
      choice: null,
    })
    expect(arrived.log).toHaveLength(2)
    expect(arrived.log[1]).toMatchObject({
      matchAsked: false,
      identifyAsked: false,
      chooseAsked: true,
    })
    expect(arrived.log[0]).toEqual(ready.log[0])
  })

  test('arriving where the scope’s view has turned asks for the match again', () => {
    const trace = traceById('right-upper-apical')
    const upper = routePlan(trace, { matchOptional: false, cruise: false })
    const actions: NavAction[] = [
      { type: 'show-match' },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
    ]
    const atRul = run(trace, upper, actions)
    expect(atRul.station).toBe(2)
    expect(upper.stations[2].checkpointIndex).toBe(2)
    expect(stationCheckpoint(trace, upper, 2).decision!.parent.airway.code).toBe('RUL')
    // The CT came mirrored down the trachea and right main bronchus; the scope now looks sideways.
    expect(atRul.orientation).toEqual(MIRROR)
    expect(isAccepted(stationMatch(trace, 2)!, MIRROR)).toBe(false)
    expect(atRul.phase).toBe('match')
    expect(atRul.matchNote).toBe('asked')
    expect(atRul.log[2].matchAsked).toBe(true)
    // At the fork before, the mirror still matched and was kept.
    expect(atRul.log[1].matchAsked).toBe(false)
  })

  test('where a plan does not ask for the match, the bench turns the CT itself and says so', () => {
    const trace = traceById('right-upper-apical')
    const chooseOnly: NavStep[] = ['choose']
    const plan3: NavPlan = {
      traceId: trace.id,
      stations: [0, 1, 2].map((checkpointIndex) => ({ checkpointIndex, steps: chooseOnly })),
      arrive: false,
    }
    const start = startSession(trace, plan3)
    // Not asked at the trachea: the CT is already mirrored when the trip opens.
    expect(start).toMatchObject({ phase: 'choose', orientation: MIRROR, matchNote: 'set' })
    expect(start.log[0].matchAsked).toBe(false)
    const atRul = run(trace, plan3, [
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
    ])
    expect(atRul.station).toBe(2)
    expect(atRul.matchNote).toBe('set')
    expect(atRul.phase).toBe('choose')
    expect(isAccepted(stationMatch(trace, 2)!, atRul.orientation)).toBe(true)
    expect(atRul.log.map((entry) => entry.matchAsked)).toEqual([false, false, false])
    expect(run(trace, plan3, [{ type: 'show-choice' }], atRul).phase).toBe('done')
  })

  test('a fork with no steps is driven through; as the last fork of a trip that does not arrive, it ends the trip', () => {
    const through: NavPlan = {
      traceId: 'central-right',
      stations: [
        { checkpointIndex: 0, steps: ['match', 'choose'] },
        { checkpointIndex: 1, steps: [] },
        { checkpointIndex: 2, steps: [] },
      ],
      arrive: false,
    }
    const middle = run(central, through, [
      { type: 'show-match' },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
    ])
    expect(middle.station).toBe(1)
    expect(middle.phase).toBe('ready')
    expect(middle.log[1]).toMatchObject({
      matchAsked: false,
      identifyAsked: false,
      chooseAsked: false,
    })
    expect(onwardOption(central, through, middle)).toBe(routeOption(central, 1))
    const last = run(central, through, [{ type: 'drive' }, { type: 'arrive' }], middle)
    expect(last.station).toBe(2)
    expect(last.phase).toBe('done')
    expect(navReducer(central, through)(last, { type: 'drive' })).toBe(last)
  })

  test('a trip that arrives drives on from its last fork to the end of the route', () => {
    const arriving: NavPlan = {
      traceId: 'central-right',
      stations: [{ checkpointIndex: central.checkpoints.length - 2, steps: [] }],
      arrive: true,
    }
    const start = startSession(central, arriving)
    expect(start.phase).toBe('ready')
    const driving = run(central, arriving, [{ type: 'drive' }])
    expect(driving.phase).toBe('drive')
    const arrived = run(central, arriving, [{ type: 'arrive' }], driving)
    expect(arrived.phase).toBe('arrived')
    expect(arrived.station).toBe(0)
    // Nothing follows arrival but a restart.
    const reduce1 = navReducer(central, arriving)
    for (const action of [
      { type: 'drive' },
      { type: 'arrive' },
      { type: 'show-match' },
      { type: 'show-mark' },
      { type: 'show-choice' },
      { type: 'check-match' },
    ] as NavAction[])
      expect(reduce1(arrived, action)).toBe(arrived)
    expect(reduce1(arrived, { type: 'restart' })).toEqual(start)
  })

  test('restart returns a fresh trip from anywhere', () => {
    const fresh = startSession(central, plan)
    const far = run(
      central,
      plan,
      [{ type: 'check-match' }, { type: 'drive' }, { type: 'arrive' }],
      ready,
    )
    expect(far.station).toBe(1)
    const restarted = reduce(far, { type: 'restart' })
    expect(restarted).toEqual(fresh)
    expect(restarted).not.toBe(far)
    expect(reduce(fresh, { type: 'restart' })).toEqual(fresh)
  })
})

describe('the closing summary', () => {
  test('counts what was asked and what landed on the first try', () => {
    const route = routeOption(central, 0)
    const session = run(central, twoForks, [
      // Fork 1. Match: one check that misses, then the flip.
      { type: 'check-match' },
      { type: 'turn', operation: 'flip' },
      { type: 'check-match' },
      // Identify: the first mark is in the other bronchus.
      { type: 'mark', mark: markAt(central, 0, 1) },
      { type: 'mark', mark: markAt(central, 0, 0) },
      { type: 'mark', mark: markAt(central, 0, 1) },
      // Choose: the opening that leads away, in and back out, then the route's.
      { type: 'choose', option: 1 - route },
      { type: 'astray-arrive' },
      { type: 'back-out' },
      { type: 'astray-return' },
      { type: 'choose', option: route },
      { type: 'drive' },
      { type: 'arrive' },
      // Fork 2. The CT still matches; both openings are shown; the choice lands.
      { type: 'show-mark' },
      { type: 'show-mark' },
      { type: 'choose', option: routeOption(central, 1) },
    ])
    expect(session.phase).toBe('done')
    expect(session.station).toBe(1)
    expect(session.log).toEqual([
      {
        matchAsked: true,
        matchMisses: 1,
        matchShown: false,
        identifyAsked: true,
        identifyMisses: 1,
        identifyShown: false,
        chooseAsked: true,
        chooseMisses: 1,
        chooseShown: false,
        wrongTurns: 1,
        backedOut: 1,
      },
      {
        matchAsked: false,
        matchMisses: 0,
        matchShown: false,
        identifyAsked: true,
        identifyMisses: 0,
        identifyShown: true,
        chooseAsked: true,
        chooseMisses: 0,
        chooseShown: false,
        wrongTurns: 0,
        backedOut: 0,
      },
    ])
    expect(summarize(session)).toEqual({
      forks: 2,
      match: { asked: 1, firstTry: 0 },
      identify: { asked: 2, firstTry: 0 },
      choose: { asked: 2, firstTry: 1 },
      wrongTurns: 1,
      backedOut: 1,
      slowest: { station: 0, tries: 4 },
    })
  })

  test('a clean trip has no slowest fork, and a fresh one has only what its first fork asks', () => {
    const route = routeOption(central, 0)
    const clean = run(central, twoForks, [
      { type: 'turn', operation: 'flip' },
      { type: 'check-match' },
      { type: 'mark', mark: markAt(central, 0, 0) },
      { type: 'mark', mark: markAt(central, 0, 1) },
      { type: 'choose', option: route },
    ])
    expect(clean.phase).toBe('ready')
    expect(summarize(clean)).toEqual({
      forks: 1,
      match: { asked: 1, firstTry: 1 },
      identify: { asked: 1, firstTry: 1 },
      choose: { asked: 1, firstTry: 1 },
      wrongTurns: 0,
      backedOut: 0,
      slowest: null,
    })
    expect(summarize(startSession(central, twoForks))).toMatchObject({
      forks: 1,
      match: { asked: 1 },
      identify: { asked: 1 },
      choose: { asked: 1 },
      slowest: null,
    })
  })
})

describe('every route', () => {
  test.each(CT_TRACES.map((trace) => [trace.id, trace] as const))(
    '%s can be driven from the trachea to the lesion with every step shown',
    (_, trace) => {
      const plan = routePlan(trace, { matchOptional: false, cruise: false })
      const forks = trace.checkpoints.filter((checkpoint) => checkpoint.decision).length
      expect(plan.stations).toHaveLength(forks)
      expect(plan.stations.some((station) => station.cruise)).toBe(false)
      expect(plan.arrive).toBe(true)
      const { state, actions } = walk(trace, plan)
      expect(state.phase).toBe('arrived')
      expect(actions).toBeLessThan(400)
      expect(state.station).toBe(forks - 1)
      const summary = summarize(state)
      expect(summary.forks).toBe(plan.stations.length)
      // Everything was shown, so nothing is a miss and no fork took longest.
      expect(summary.slowest).toBeNull()
      expect(summary.choose).toEqual({ asked: forks, firstTry: 0 })
      expect(summary.match.firstTry).toBe(0)
      expect(summary.identify.firstTry).toBe(0)
      // The CT ended on a display that matches the last fork.
      const last = plan.stations[forks - 1].checkpointIndex
      expect(isAccepted(stationMatch(trace, last)!, state.orientation)).toBe(true)
      expect(state.choice).toBe(routeOption(trace, last))
    },
  )
})

describe('the fly-through of the central airways', () => {
  const apical = traceById('right-upper-apical')
  const plan = routePlan(apical, { matchOptional: true })

  test('the scope flies through every fork above the one that gives off the segment, and stops there', () => {
    expect(plan.stations.map((station) => Boolean(station.cruise))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])
    const start = startSession(apical, plan)
    expect(start).toMatchObject({ station: 0, phase: 'drive', matchNote: 'optional', choice: null })
    expect(flyingThrough(plan, start)).toBe(true)
    const second = run(apical, plan, [{ type: 'arrive' }, { type: 'arrive' }])
    expect([second.station, second.phase, flyingThrough(plan, second)]).toEqual([2, 'drive', true])
    const stop = run(apical, plan, [{ type: 'arrive' }], second)
    expect([stop.station, stop.phase, flyingThrough(plan, stop)]).toEqual([3, 'choose', false])
    // Nothing was asked at the forks flown through, and the CT was left as it was.
    for (const entry of stop.log.slice(0, 3))
      expect([entry.matchAsked, entry.identifyAsked, entry.chooseAsked]).toEqual([
        false,
        false,
        false,
      ])
    expect(stop.log[3].chooseAsked).toBe(true)
    expect(stop.orientation).toEqual(STANDARD_ORIENTATION)
  })

  test('asked to stop, the next fork is an ordinary one, and the fly-through goes on after it', () => {
    const held = run(apical, plan, [{ type: 'arrive', hold: true }])
    expect([held.station, held.phase, flyingThrough(plan, held)]).toEqual([1, 'choose', false])
    expect(held.log[1].chooseAsked).toBe(true)
    const driving = run(apical, plan, [{ type: 'show-choice' }, { type: 'drive' }], held)
    // Driving on from a fork that was stopped at is an ordinary drive, not the fly-through.
    expect([driving.phase, flyingThrough(plan, driving)]).toEqual(['drive', false])
    const on = run(apical, plan, [{ type: 'arrive' }], driving)
    expect([on.station, on.phase, flyingThrough(plan, on)]).toEqual([2, 'drive', true])
  })

  test('the summary counts only the forks that were chosen at', () => {
    const { state } = walk(apical, plan)
    expect(state.phase).toBe('arrived')
    const summary = summarize(state)
    expect(summary.forks).toBe(7)
    expect(summary.choose).toEqual({ asked: 4, firstTry: 0 })
    expect(summary.match.asked).toBe(0)
    expect(summary.slowest).toBeNull()
  })

  test('where turning the CT is asked for, the bench turns it at the forks flown through', () => {
    const asked = routePlan(apical, { matchOptional: false })
    const start = startSession(apical, asked)
    expect(start.phase).toBe('drive')
    expect(isAccepted(stationMatch(apical, 0)!, start.orientation)).toBe(true)
    expect(start.matchNote).toBe('set')
    expect(start.log[0].matchAsked).toBe(false)
  })

  test.each(
    CT_TRACES.filter((trace) => TARGET_FOR_TRACE[trace.id]).map(
      (trace) => [trace.id, trace] as const,
    ),
  )('%s stops first at the fork that gives off the lesion’s segmental bronchus', (_, trace) => {
    const target = plannedTarget(trace)
    const route = routePlan(trace, { matchOptional: true })
    const flown = route.stations.filter((station) => station.cruise).length
    // The forks flown through are the first ones, with no gap.
    expect(route.stations.slice(0, flown).every((station) => station.cruise)).toBe(true)
    expect(flown).toBeGreaterThanOrEqual(1)
    const first = route.stations[flown]
    // The next fork after it is the first division the map draws.
    expect(route.stations[flown + 1].checkpointIndex).toBe(mappedForks(trace, target)[0])
    const decision = trace.checkpoints[first.checkpointIndex].decision!
    expect(decision.options[routeOption(trace, first.checkpointIndex)].airway.code).toBe(
      target.segment.bronchusCode,
    )
    const { state } = walk(trace, route)
    expect(state.phase).toBe('arrived')
    expect(summarize(state).choose.asked).toBe(route.stations.length - flown)
  })

  test('a route that ends at no lesion is not flown through', () => {
    const plain = routePlan(central, { matchOptional: true })
    expect(plain.stations.some((station) => station.cruise)).toBe(false)
  })
})

describe('the bench’s own marks', () => {
  test('wherever a daughter has air under its centre, the mark the bench places is read as that lumen', () => {
    // A centreline sample can sit on the wall of a small lumen; the bench marks the air beside it.
    let checked = 0
    for (const trace of CT_TRACES)
      trace.checkpoints.forEach((checkpoint, index) => {
        checkpoint.decision?.options.forEach((_, option) => {
          if (!optionHasVerdict(trace, index, option)) return
          const lumen = responseLumen(trace, index, option)!
          const result = optionVerdict(trace, index, option, lumen)
          checked++
          expect([trace.id, checkpoint.id, option, result?.markInAir]).toEqual([
            trace.id,
            checkpoint.id,
            option,
            true,
          ])
          expect([trace.id, checkpoint.id, option, result?.verdict === 'not-in-airway']).toEqual([
            trace.id,
            checkpoint.id,
            option,
            false,
          ])
        })
      })
    expect(checked).toBeGreaterThan(200)
  })
})

describe('turning the CT once it is optional', () => {
  const plan = routePlan(central, { matchOptional: true })
  const reduce = navReducer(central, plan)
  const start = startSession(central, plan)

  test('no fork waits for the match; the CT stays as the learner left it', () => {
    expect(start).toMatchObject({ phase: 'choose', matchNote: 'optional', optionalCheck: null })
    expect(start.orientation).toEqual(STANDARD_ORIENTATION)
    expect(start.log[0].matchAsked).toBe(false)
    const turned = reduce(start, { type: 'turn', operation: 'flip' })
    const driven = run(central, plan, [
      { type: 'turn', operation: 'flip' },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
    ])
    expect(driven).toMatchObject({ station: 1, matchNote: 'optional' })
    expect(driven.orientation).toEqual(turned.orientation)
  })

  test('a check is answered without holding the fork, and a turn clears it', () => {
    const checked = reduce(start, { type: 'check-match' })
    expect(checked).toMatchObject({ phase: 'choose', optionalCheck: { ok: false } })
    expect(checked.log[0].matchMisses).toBe(0)
    expect(reduce(checked, { type: 'check-match' })).toBe(checked)
    const flipped = reduce(checked, { type: 'turn', operation: 'flip' })
    expect(flipped.optionalCheck).toBeNull()
    expect(reduce(flipped, { type: 'check-match' }).optionalCheck).toMatchObject({ ok: true })
  })

  test('a check is not answered where turning is still asked for', () => {
    const asking = routePlan(central, { matchOptional: false })
    const asked = startSession(central, asking)
    const ready = run(central, asking, [{ type: 'show-match' }])
    expect(asked.phase).toBe('match')
    expect(navReducer(central, asking)(ready, { type: 'check-match' })).toBe(ready)
  })
})
