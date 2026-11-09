import { PRIMER, PRIMER_TITLE, TEACHING_SIMULATOR_STATEMENT } from '../content/bench-copy'
import {
  DIRECTION_CHANGE,
  METHOD_STEPS,
  METHOD_TIPS,
  NAMING_KEY,
  NAMING_USE,
  SLICE_DIRECTION_NOTE,
  SUBSEGMENT_NOTE,
  targetNaming,
} from '../content/course-guide'
import { JUNCTION_FEEDBACK_SCOPE, junctionFeedbackPacket } from '../content/junction-feedback'
import { BASE_PATH, lessonHref } from '../content/module'
import {
  CENTRAL_STATIONS,
  LESSON_GROUPS,
  MAP_STEPS,
  MIN_IDENTIFY_AREA_MM2,
  NAV_LESSONS,
  ORIENTATION_LESSON,
  TARGET_FOR_TRACE,
  THIN_LUMEN_FORKS,
  buildTrip,
  defaultSteps,
  identifiable,
  lessonAfter,
  lessonById,
  lessonNumber,
  plannedTarget,
  routePlan,
  totalMinutes,
  type NavTripSpec,
} from '../content/nav-lessons'
import {
  ANATOMICAL_LABEL,
  PLAN_PART_TITLES,
  STAGE_STEPS,
  arcsFound,
  arcsInstruction,
  arcsMiss,
  frameFound,
  frameInstruction,
  frameMiss,
  frameWords,
  lesionFound,
  lesionInstruction,
  lesionMiss,
  planSummaryLines,
  reviewSentence,
  sectorPhrase,
  sectorWords,
  segmentFound,
  segmentInstruction,
  segmentLabel,
  segmentMiss,
} from '../content/plan-copy'
import {
  ASSESS_TARGET_IDS,
  TARGET_IDS,
  targetById,
  targetLabel,
  targetsByLobe,
  traceForTarget,
} from '../content/targets'
import {
  RIMS,
  SECTORS,
  gradeArcs,
  gradeFrame,
  mappedForks,
  turnedRim,
  type Anatomical,
  type FrameLabels,
  type Rim,
  type Sector,
} from '../engine/arc-map'
import { optionLumenAreaMm2 } from '../engine/junction-feedback'
import {
  routeOption,
  startSession,
  summarize,
  type NavAction,
  type NavSession,
} from '../engine/nav-session'
import { operationsToMatch, stationMatch } from '../engine/orientation-match'
import {
  PLAN_PARTS,
  divisionBearings,
  lesionShowPoint,
  lesionVerdict,
  planFrame,
  segmentChoices,
  summarizePlan,
  type PlanAction,
} from '../engine/plan-session'
import { startTrip, tripReducer, type TripAction, type TripSession } from '../engine/trip-session'
import { CT_TARGETS, CT_TRACES, NATIVE_CT, traceById } from '../geometry/native-ct'
import { STANDARD_ORIENTATION } from '../geometry/orientation'

/**
 * The lesson registry: nine lessons, each one or more trips that plan on the CT, drive the scope
 * along a real route, or both. These tests hold the registry to the routes and lesions it names and
 * to the words the course may use.
 */
const TRIPS = NAV_LESSONS.flatMap((lesson) =>
  lesson.trips.map((spec, index) => ({
    lesson,
    spec,
    index,
    label: `${lesson.id} trip ${index + 1}`,
  })),
)
/** Each trip, built as the host builds it with turning the CT asked for, and as optional. */
const BUILDS = TRIPS.flatMap((trip) =>
  [false, true].map((matchOptional) => ({
    ...trip,
    matchOptional,
    label: `${trip.label}, turning the CT ${matchOptional ? 'optional' : 'asked for'}`,
  })),
)
const forksOf = (traceId: string) =>
  traceById(traceId).checkpoints.flatMap((checkpoint, index) =>
    checkpoint.decision ? [{ id: checkpoint.id, index }] : [],
  )
const ASTRAY_PHASES = ['astray-in', 'astray', 'astray-out']

/** The action the bench itself would take next on the drive: every step shown, then drive on. */
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
/** The same for a whole trip: every planning check shown, then the drive. */
function shownTrip(state: TripSession): TripAction | null {
  if (state.stage === 'plan') {
    const next: Partial<Record<string, PlanAction>> = {
      lesion: { type: 'show-lesion' },
      segment: { type: 'show-segment' },
      views: { type: 'views-done' },
      frame: { type: 'show-frame' },
      arcs: { type: 'show-arcs' },
      review: { type: 'finish' },
    }
    const action = next[state.plan!.stage]
    return action ? { type: 'plan', action } : null
  }
  if (state.stage === 'navigate') {
    const action = shown(state.nav!)
    return action ? { type: 'nav', action } : null
  }
  return null
}

/**
 * Words the course does not use for a learner: scoring and answer-leak wording, and project-record
 * words (review status, how the material was made). Whole words, any case.
 */
const GATED_WORDS = [
  'score',
  'scored',
  'points',
  'grade',
  'graded',
  'pass',
  'passed',
  'mastery',
  'correct',
  'incorrect',
  'wrong',
  'synthetic',
  'authored',
  'NOT REVIEWED',
  'pending',
  'faculty',
]
const gateFor = (words: readonly string[]) =>
  new RegExp(`\\b(${words.map((word) => word.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi')
const gatedWordsIn = (text: string, words: readonly string[] = GATED_WORDS) =>
  [...text.matchAll(gateFor(words))].map((match) => match[0].toLowerCase())

/** No fork explanation is excepted from the gate: a gated word is rephrased in the content instead. */
const REPORTED_NOT_GATED: Record<string, string[]> = {}
/**
 * Course and method sentences that use a gated word, reported to the owner for rephrasing on
 * October 21, 2026 rather than changed here. Each is excepted for that one word only.
 *   content/nav-lessons.ts:246 (OSTIUM_CHECKLIST) "your right hand points to the circle’s right"
 *   content/course-guide.ts:51 (METHOD_TIPS[4]) "helps you recognise a wrong turn"
 */
const REPORTED_COURSE_WORDS: Record<string, string[]> = {}

/** Every string under a value, with a path to it; the named keys are skipped at any depth. */
function strings(label: string, value: unknown, skip: readonly string[] = []): [string, string][] {
  if (typeof value === 'string') return [[label, value]]
  if (Array.isArray(value))
    return value.flatMap((entry, i) => strings(`${label}[${i}]`, entry, skip))
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([key, entry]) =>
      skip.includes(key) ? [] : strings(`${label}.${key}`, entry, skip),
    )
  return []
}

describe('the registry', () => {
  test('nine lessons with their own ids, in four groups, about an hour and a quarter in all', () => {
    expect(NAV_LESSONS).toHaveLength(9)
    const ids = NAV_LESSONS.map((lesson) => lesson.id)
    expect(ids).toEqual([
      'carina-orientation',
      'two-levels',
      'start-at-the-lesion',
      'stand-at-the-ostium',
      'nested-arcs',
      'drive-with-the-map',
      'views-that-help',
      'turn-back',
      'navigate',
    ])
    expect(new Set(ids).size).toBe(9)
    expect(totalMinutes()).toBe(NAV_LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0))
    expect(totalMinutes()).toBe(79)
    for (const lesson of NAV_LESSONS) {
      expect(Number.isInteger(lesson.minutes) && lesson.minutes > 0).toBe(true)
      expect(lesson.trips.length).toBeGreaterThan(0)
      for (const text of [lesson.title, lesson.objective, lesson.concept, lesson.closing])
        expect(text.trim().length).toBeGreaterThan(0)
      // Ids are used in addresses and storage keys.
      expect(lesson.id).toMatch(/^[a-z0-9-]+$/)
      expect(lessonHref(lesson.id)).toBe(`${BASE_PATH}/learn?lesson=${lesson.id}`)
      // The fork patterns of the earlier course are gone from the lesson record.
      expect(Object.keys(lesson)).not.toContain('pattern')
    }
    // Every group id is a lesson, and every lesson is in exactly one group, in course order.
    expect(LESSON_GROUPS).toHaveLength(4)
    const grouped = LESSON_GROUPS.flatMap((group) => group.ids)
    expect(grouped).toEqual(ids)
    for (const group of LESSON_GROUPS) {
      expect(group.label.trim().length).toBeGreaterThan(0)
      expect(group.ids.length).toBeGreaterThan(0)
    }
    expect(LESSON_GROUPS.map((group) => group.ids.length)).toEqual([2, 3, 2, 2])
  })

  test('lessons are found by id, numbered from one, and each leads to the next', () => {
    NAV_LESSONS.forEach((lesson, i) => {
      expect(lessonById(lesson.id)).toBe(lesson)
      expect(lessonNumber(lesson.id)).toBe(i + 1)
      expect(lessonAfter(lesson.id)).toBe(NAV_LESSONS[i + 1])
    })
    expect(lessonAfter(NAV_LESSONS.at(-1)!.id)).toBeUndefined()
    expect(lessonById('not-a-lesson')).toBeUndefined()
    expect(lessonById(undefined)).toBeUndefined()
    expect(lessonNumber('not-a-lesson')).toBe(0)
    // Turning the CT is always asked for in the first lesson.
    expect(ORIENTATION_LESSON).toBe(NAV_LESSONS[0].id)
  })

  test('each step of the method points at a lesson that teaches it, and the change of direction has its own', () => {
    const ids = NAV_LESSONS.map((lesson) => lesson.id)
    expect(METHOD_STEPS.map((step) => step.name)).toEqual([
      'Start at the lesion',
      'Set up the views',
      'Stand at the ostium',
      'Draw each division',
      'Drive with the map',
    ])
    expect(new Set(METHOD_STEPS.map((step) => step.lessonId)).size).toBe(METHOD_STEPS.length)
    for (const step of METHOD_STEPS) {
      expect([step.lessonId, ids.includes(step.lessonId)]).toEqual([step.lessonId, true])
      expect(step.what.trim().length).toBeGreaterThan(0)
    }
    // The lesson a step names plans the part of the method that step is, in every trip.
    const asks = (lessonId: string) =>
      lessonById(lessonId)!.trips.map((trip) => [...(trip.plan?.parts ?? [])])
    const partOf: Record<string, string> = {
      'start-at-the-lesion': 'lesion',
      'views-that-help': 'views',
      'stand-at-the-ostium': 'frame',
      'nested-arcs': 'arcs',
    }
    for (const [lessonId, part] of Object.entries(partOf))
      for (const parts of asks(lessonId))
        expect([lessonId, parts.includes(part as never)]).toEqual([lessonId, true])
    // Driving with the map plans a map and then drives it.
    for (const trip of lessonById('drive-with-the-map')!.trips) {
      expect(trip.plan?.parts).toEqual(expect.arrayContaining(['frame', 'arcs']))
      expect(trip.from).toBeDefined()
    }
    expect(METHOD_TIPS.length).toBeGreaterThan(0)
    for (const tip of METHOD_TIPS) expect(tip.trim().length).toBeGreaterThan(0)
    // The change of direction is taught in its own lesson; the method does not list it as a step.
    expect(ids).toContain(DIRECTION_CHANGE.lessonId)
    expect(METHOD_STEPS.map((step) => step.lessonId)).not.toContain(DIRECTION_CHANGE.lessonId)
  })

  test('only the first two lessons ask for the openings to be marked; every other drive follows the map', () => {
    const marking = new Set<string>()
    for (const { lesson, spec } of TRIPS) {
      if (spec.identify) expect(['carina-orientation', 'two-levels']).toContain(lesson.id)
      const nav = buildTrip(spec, { matchOptional: false }).trip.nav
      for (const station of nav?.stations ?? []) {
        if (station.steps.includes('identify')) marking.add(lesson.id)
        // Outside the first two lessons, every fork is matched and chosen with the map.
        if (!['carina-orientation', 'two-levels'].includes(lesson.id))
          expect([lesson.id, station.steps]).toEqual([lesson.id, MAP_STEPS])
      }
    }
    expect([...marking]).toEqual(['carina-orientation', 'two-levels'])
  })
})

describe('trips', () => {
  test.each(BUILDS.map((build) => [build.label, build] as const))(
    '%s builds on its own route and lesion',
    (_, { spec, matchOptional }) => {
      const built = buildTrip(spec, { matchOptional })
      const { trace, target, trip } = built
      expect(built.spec).toBe(spec)
      expect(trace).toBe(traceById(spec.traceId))
      // The lesion is the one the route is planned to, where the route has one.
      if (TARGET_FOR_TRACE[spec.traceId]) {
        expect(target).toBe(plannedTarget(trace))
        expect(target!.id).toBe(TARGET_FOR_TRACE[spec.traceId])
        expect(traceForTarget(target!.id).id).toBe(trace.id)
      } else expect(target).toBeNull()

      // ── Planning ──
      if (spec.plan) {
        expect(target).not.toBeNull()
        expect(trip.plan).toEqual({
          traceId: trace.id,
          targetId: target!.id,
          parts: spec.plan.parts,
          worked: spec.plan.worked,
        })
        // Parts are asked in the order they are worked, each once.
        expect(spec.plan.parts.length).toBeGreaterThan(0)
        expect([...spec.plan.parts]).toEqual(
          PLAN_PARTS.filter((part) => spec.plan!.parts.includes(part)),
        )
        // Text for a part is only written for a part the trip asks for.
        for (const part of Object.keys(spec.plan.teach ?? {}))
          expect(spec.plan.parts).toContain(part)
        if (spec.plan.locators) expect(spec.plan.parts).toContain('arcs')
        // The map has divisions to draw, and every division text is said at one of them.
        const mapped = mappedForks(trace, target!)
        expect(mapped.length).toBeGreaterThan(0)
        expect(built.divisionTeach).toHaveLength(mapped.length)
        mapped.forEach((checkpointIndex, i) =>
          expect(built.divisionTeach[i]).toBe(
            spec.plan!.divisions?.[trace.checkpoints[checkpointIndex].id],
          ),
        )
        for (const id of Object.keys(spec.plan.divisions ?? {}))
          expect([id, mapped.some((ci) => trace.checkpoints[ci].id === id)]).toEqual([id, true])
      } else {
        expect(trip.plan).toBeNull()
        expect(built.divisionTeach).toEqual([])
      }

      // ── The drive ──
      if (!spec.from) {
        // A trip without a first fork plans and stops.
        expect(spec.plan).toBeDefined()
        expect([spec.stations, spec.arrive, spec.through]).toEqual([
          undefined,
          undefined,
          undefined,
        ])
        expect(trip.nav).toBeNull()
        expect(built.teach).toEqual([])
        return
      }
      const nav = trip.nav!
      expect(nav.traceId).toBe(spec.traceId)
      expect(nav.arrive).toBe(Boolean(spec.arrive))
      expect(nav.matchOptional).toBe(matchOptional)
      const forks = forksOf(spec.traceId)
      const stations = nav.stations
      expect(stations.length).toBeGreaterThan(0)
      expect(built.teach).toHaveLength(stations.length)
      // Consecutive forks of the route, from the one named to the one named.
      stations.forEach((station, i) => {
        expect(trace.checkpoints[station.checkpointIndex].decision).toBeDefined()
        if (i > 0) expect(station.checkpointIndex).toBe(stations[i - 1].checkpointIndex + 1)
      })
      expect(trace.checkpoints[stations[0].checkpointIndex].id).toBe(spec.from)
      const lastId = trace.checkpoints[stations.at(-1)!.checkpointIndex].id
      expect(lastId).toBe(spec.through ?? forks.at(-1)!.id)
      // A trip that arrives drives through the route's last fork, and through every division its
      // map draws.
      if (spec.arrive) {
        expect(stations.at(-1)!.checkpointIndex).toBe(forks.at(-1)!.index)
        if (spec.plan)
          for (const ci of mappedForks(trace, target!))
            expect(stations.map((station) => station.checkpointIndex)).toContain(ci)
      }
      for (const station of stations) {
        const id = trace.checkpoints[station.checkpointIndex].id
        const where = `${spec.traceId} ${id}`
        expect(new Set(station.steps).size).toBe(station.steps.length)
        for (const step of station.steps) expect(['match', 'identify', 'choose']).toContain(step)
        // Steps are asked in the order they are worked.
        expect([...station.steps]).toEqual(
          ['match', 'identify', 'choose'].filter((step) => station.steps.includes(step as never)),
        )
        // A fork is asked to be marked only where every lumen is large enough to click.
        if (station.steps.includes('identify'))
          expect([where, identifiable(trace, station.checkpointIndex)]).toEqual([where, true])
        // A fork the trip does not write steps for is marked only in a trip that marks openings;
        // otherwise it is matched and chosen with the map.
        const written = spec.stations?.[id]?.steps
        expect([where, station.steps]).toEqual([
          where,
          written ?? (spec.identify ? defaultSteps(trace, station.checkpointIndex) : MAP_STEPS),
        ])
        expect(station.worked ?? false).toBe(spec.stations?.[id]?.worked ?? spec.worked ?? false)
      }
      // Every fork the trip writes about is one it visits, and its text arrives at that fork.
      for (const [id, station] of Object.entries(spec.stations ?? {})) {
        const at = stations.findIndex(
          (planned) => trace.checkpoints[planned.checkpointIndex].id === id,
        )
        expect([id, at >= 0]).toEqual([id, true])
        expect(built.teach[at]).toBe(station.teach)
      }
    },
  )

  test.each(BUILDS.map((build) => [build.label, build] as const))(
    '%s can be planned and driven to its end with every step shown',
    (_, { spec, matchOptional }) => {
      const { trace, target, trip } = buildTrip(spec, { matchOptional })
      const reduce = tripReducer(trace, target, trip)
      let state = startTrip(trace, target, trip)
      let actions = 0
      for (let action = shownTrip(state); action && actions < 400; action = shownTrip(state)) {
        const next = reduce(state, action)
        expect(next).not.toBe(state)
        state = next
        actions++
        // Showing the choice always takes the route's own opening: the scope never turns astray.
        expect(ASTRAY_PHASES).not.toContain(state.nav?.phase)
      }
      expect(actions).toBeLessThan(400)
      if (trip.plan) {
        const plan = state.plan!
        expect(plan.stage).toBe('done')
        const parts = trip.plan.parts
        if (parts.includes('lesion'))
          expect(plan.lesionMark).toMatchObject({ ok: true, shown: true })
        if (parts.includes('segment')) expect(plan.segmentChoice).toBe(target!.segment.bronchusCode)
        if (parts.includes('frame')) expect(plan.frameTurn).toBe(0)
        const summary = summarizePlan(trip.plan, plan)
        expect(summary.arcs.asked).toBe(
          parts.includes('arcs') ? mappedForks(trace, target!).length : 0,
        )
        expect(summary.arcs.firstTry).toBe(0)
        if (parts.includes('arcs'))
          expect(plan.arcs.every((arcs) => arcs.ok && arcs.shown)).toBe(true)
      } else expect(state.plan).toBeNull()
      if (!trip.nav) {
        expect(state.stage).toBe('done')
        expect(state.nav).toBeNull()
        return
      }
      const nav = state.nav!
      expect(state.stage).toBe('navigate')
      expect(nav.phase).toBe(trip.nav.arrive ? 'arrived' : 'done')
      expect(nav.station).toBe(trip.nav.stations.length - 1)
      const summary = summarize(nav)
      expect(summary.forks).toBe(trip.nav.stations.length)
      expect([summary.wrongTurns, summary.backedOut]).toEqual([0, 0])
      // Where turning the CT is optional, no fork asks for it.
      if (matchOptional) expect(summary.match.asked).toBe(0)
    },
  )

  test('a trip that names a fork off its route, runs backward, or arrives early does not build', () => {
    const base: NavTripSpec = {
      traceId: 'central-right',
      title: 'Test trip',
      from: 'junction-2',
      through: 'junction-5',
      intro: 'A trip for the test.',
    }
    const build = (spec: NavTripSpec, matchOptional = false) => buildTrip(spec, { matchOptional })
    expect(build(base).trip.nav!.stations.map((station) => station.checkpointIndex)).toEqual([1, 2])
    expect(build(base).trip.nav!.stations.map((station) => station.steps)).toEqual([
      MAP_STEPS,
      MAP_STEPS,
    ])
    expect(build(base, true).trip.nav!.matchOptional).toBe(true)
    expect(build(base, false).trip.nav!.matchOptional).toBe(false)
    expect(build(base).trip.plan).toBeNull()
    expect(() => build({ ...base, from: 'junction-3' })).toThrow(/is not on its route/)
    expect(() => build({ ...base, through: 'junction-1' })).toThrow(/is not on its route/)
    expect(() => build({ ...base, through: 'junction-999' })).toThrow(/is not on its route/)
    expect(() => build({ ...base, arrive: true })).toThrow(
      /arrives without driving through its last fork/,
    )
    expect(() => build({ ...base, stations: { 'junction-10': { teach: 'x' } } })).toThrow(
      /names junction-10, which it does not visit/,
    )
    expect(() => build({ ...base, traceId: 'not-a-route' })).toThrow(/Unknown CT trace/)
    // Without `through`, a trip runs to the route's last fork.
    expect(build({ ...base, through: undefined }).trip.nav!.stations).toHaveLength(
      forksOf('central-right').length - 1,
    )
    // A trip that plans needs a lesion, draws only its own map, and, without a first fork, only plans.
    const planOnly: NavTripSpec = {
      traceId: 'right-upper-apical',
      title: 'Test plan',
      intro: 'A plan for the test.',
      plan: { parts: ['frame'] },
    }
    expect(build(planOnly).trip).toEqual({
      plan: {
        traceId: 'right-upper-apical',
        targetId: 'r-apical-anterior',
        parts: ['frame'],
        worked: undefined,
      },
      nav: null,
    })
    expect(() => build({ ...planOnly, plan: undefined })).toThrow(/neither plans nor drives/)
    expect(() => build({ ...planOnly, arrive: true })).toThrow(/plans only, but names forks/)
    expect(() => build({ ...planOnly, through: 'junction-14' })).toThrow(
      /plans only, but names forks/,
    )
    expect(() => build({ ...planOnly, stations: { 'junction-14': { teach: 'x' } } })).toThrow(
      /plans only, but names forks/,
    )
    expect(() => build({ ...planOnly, traceId: 'central-right' })).toThrow(
      /plans, but its route has no lesion/,
    )
    expect(() =>
      build({ ...planOnly, plan: { parts: ['arcs'], divisions: { 'junction-1': 'x' } } }),
    ).toThrow(/teaches junction-1, which its map does not draw/)
    expect(() => plannedTarget(traceById('central-right'))).toThrow(
      'Route central-right has no lesion to plan to',
    )
  })

  test('lesson 1 opens at the carina asking for the flip, then in RB1 asking for one turn left', () => {
    const lesson = NAV_LESSONS[0]
    expect(lesson.id).toBe('carina-orientation')
    expect(lesson.id).toBe(ORIENTATION_LESSON)
    expect(lesson.trips).toHaveLength(2)
    // The host builds lesson 1 with turning the CT asked for, whatever the learner has shown.
    const carina = buildTrip(lesson.trips[0], { matchOptional: false })
    const carinaNav = carina.trip.nav!
    expect(carina.trip.plan).toBeNull()
    expect(carina.trace.id).toBe('central-right')
    expect(carinaNav.stations).toHaveLength(1)
    expect(carina.trace.checkpoints[carinaNav.stations[0].checkpointIndex].id).toBe('junction-1')
    expect(carinaNav.stations[0].steps).toEqual(['match', 'identify'])
    const start = startSession(carina.trace, carinaNav)
    expect(start.phase).toBe('match')
    expect(start.orientation).toEqual(STANDARD_ORIENTATION)
    const trachea = stationMatch(carina.trace, carinaNav.stations[0].checkpointIndex)!
    expect(trachea.accepted).toEqual([{ turns: 0, reflected: true }])
    expect(operationsToMatch(trachea, STANDARD_ORIENTATION)).toEqual(['flip'])

    const rb1 = buildTrip(lesson.trips[1], { matchOptional: false })
    const rb1Nav = rb1.trip.nav!
    expect(rb1.trip.plan).toBeNull()
    expect(rb1.trace.id).toBe('right-upper-apical')
    expect(rb1Nav.stations).toHaveLength(1)
    const station = rb1Nav.stations[0]
    expect(rb1.trace.checkpoints[station.checkpointIndex].id).toBe('junction-14')
    expect(station.steps).toEqual(['match'])
    expect(startSession(rb1.trace, rb1Nav).phase).toBe('match')
    expect(
      operationsToMatch(stationMatch(rb1.trace, station.checkpointIndex)!, STANDARD_ORIENTATION),
    ).toEqual(['left'])

    // buildTrip carries whatever it is given: built with turning optional, neither trip waits for it.
    const optionalCarina = buildTrip(lesson.trips[0], { matchOptional: true }).trip.nav!
    expect(optionalCarina.matchOptional).toBe(true)
    expect(startSession(carina.trace, optionalCarina)).toMatchObject({
      phase: 'identify',
      matchNote: 'optional',
    })
    const optionalRb1 = buildTrip(lesson.trips[1], { matchOptional: true }).trip.nav!
    expect(startSession(rb1.trace, optionalRb1)).toMatchObject({
      phase: 'done',
      matchNote: 'optional',
    })
  })

  test('driving with the map, the branch that leads away at the second division is driven into and backed out of', () => {
    const lesson = lessonById('drive-with-the-map')!
    const { trace, target, trip, teach } = buildTrip(lesson.trips[0], { matchOptional: false })
    const reduce = tripReducer(trace, target, trip)
    const nav = trip.nav!
    const at = nav.stations.findIndex(
      (station) => trace.checkpoints[station.checkpointIndex].id === 'junction-30',
    )
    expect(at).toBeGreaterThan(0)
    expect(teach[at]).toMatch(/Take the opening that does not hold the star/)
    // The second division the map draws, past the RB1 ostium.
    expect(mappedForks(trace, target!).map((ci) => trace.checkpoints[ci].id)).toEqual([
      'junction-14',
      'junction-30',
      'junction-61',
    ])
    let state = startTrip(trace, target, trip)
    const step = (action: TripAction) => {
      const next = reduce(state, action)
      expect(next).not.toBe(state)
      state = next
    }
    for (let action = shownTrip(state); action; action = shownTrip(state)) {
      if (state.nav?.station === at && state.nav.phase === 'choose') break
      step(action)
    }
    const fork = nav.stations[at].checkpointIndex
    const away = trace.checkpoints[fork].decision!.options.findIndex(
      (_, option) => option !== routeOption(trace, fork),
    )
    step({ type: 'nav', action: { type: 'choose', option: away } })
    expect(state.nav).toMatchObject({ phase: 'astray-in', astray: away })
    step({ type: 'nav', action: { type: 'astray-arrive' } })
    step({ type: 'nav', action: { type: 'back-out' } })
    step({ type: 'nav', action: { type: 'astray-return' } })
    expect(state.nav).toMatchObject({ phase: 'choose', astray: null, declined: [away] })
    step({ type: 'nav', action: { type: 'choose', option: routeOption(trace, fork) } })
    for (let action = shownTrip(state); action; action = shownTrip(state)) step(action)
    expect(state.nav!.phase).toBe('arrived')
    expect(summarize(state.nav!)).toMatchObject({ wrongTurns: 1, backedOut: 1 })
  })
})

describe('whole routes', () => {
  test('a route plan visits every fork, each matched and chosen with the map, and carries whether turning is optional', () => {
    expect(MAP_STEPS).toEqual(['match', 'choose'])
    for (const trace of CT_TRACES)
      for (const matchOptional of [false, true]) {
        const plan = routePlan(trace, { matchOptional })
        const forks = forksOf(trace.id)
        expect(plan.traceId).toBe(trace.id)
        expect(plan.arrive).toBe(true)
        expect(plan.matchOptional).toBe(matchOptional)
        expect(plan.stations.map((station) => station.checkpointIndex)).toEqual(
          forks.map((fork) => fork.index),
        )
        // Practice and the closing set mark no openings: they were read off the CT in planning.
        for (const station of plan.stations) {
          expect(station.steps).toEqual(MAP_STEPS)
          expect(station.worked).toBeUndefined()
        }
      }
  })

  test('a fork is marked only where every lumen is at least the minimum area and none is a thin line; otherwise it is only chosen at', () => {
    expect(CENTRAL_STATIONS).toBe(2)
    expect(MIN_IDENTIFY_AREA_MM2).toBe(5)
    let marked = 0
    let chosenOnly = 0
    const thinOnRoutes = new Set<string>()
    for (const trace of CT_TRACES)
      for (const { index } of forksOf(trace.id)) {
        const id = trace.checkpoints[index].id
        const areas = trace.checkpoints[index].decision!.options.map((_, option) =>
          optionLumenAreaMm2(trace, index, option),
        )
        const large = areas.every((area) => area >= MIN_IDENTIFY_AREA_MM2)
        const thin = THIN_LUMEN_FORKS.includes(id)
        // The five thin-line forks all clear the area rule: that is why they are listed.
        if (thin) {
          thinOnRoutes.add(id)
          expect([id, large]).toEqual([id, true])
        }
        expect([id, identifiable(trace, index)]).toEqual([id, large && !thin])
        expect(defaultSteps(trace, index)).toEqual(
          large && !thin ? ['match', 'identify', 'choose'] : ['choose'],
        )
        if (large && !thin) marked++
        else chosenOnly++
      }
    expect(marked + chosenOnly).toBe(128)
    expect(marked).toBeGreaterThan(chosenOnly)
    expect(chosenOnly).toBeGreaterThan(0)
    expect(THIN_LUMEN_FORKS).toEqual([
      'junction-42',
      'junction-86',
      'junction-161',
      'junction-138',
      'junction-53',
    ])
    expect([...thinOnRoutes].sort()).toEqual([...THIN_LUMEN_FORKS].sort())
    // No lesson trip asks for marks at one of them either.
    for (const { lesson, spec } of TRIPS) {
      const { trace, trip } = buildTrip(spec, { matchOptional: false })
      for (const stop of trip.nav?.stations ?? [])
        if (THIN_LUMEN_FORKS.includes(trace.checkpoints[stop.checkpointIndex].id))
          expect([lesson.id, stop.steps.includes('identify')]).toEqual([lesson.id, false])
    }
    // A checkpoint without a division is never identifiable.
    const trace = CT_TRACES[0]
    expect(identifiable(trace, trace.checkpoints.length - 1)).toBe(false)
  })

  test('each of the thirteen lesions opens one route, and that route ends beside it', () => {
    expect(TARGET_IDS).toHaveLength(13)
    expect(new Set(TARGET_IDS).size).toBe(13)
    expect([...TARGET_IDS].sort()).toEqual(CT_TARGETS.map((target) => target.id).sort())
    const routes = new Set<string>()
    for (const id of TARGET_IDS) {
      const trace = traceForTarget(id)
      expect([id, trace.targetId]).toEqual([id, id])
      expect(targetById(id)!.id).toBe(id)
      routes.add(trace.id)
      // The label names the segment and the last bronchus of the route.
      const target = targetById(id)!
      expect(
        targetLabel(target).startsWith(
          `${target.segment.code} · ${target.segment.name}, by ${target.approachCode}`,
        ),
      ).toBe(true)
      expect(trace.checkpoints.at(-1)!.airway.code).toBe(target.approachCode)
      expect(targetNaming(target).sentence).toContain(target.segment.code)
      // Planning that route plans to that lesion, and its map starts in the lesion's segment.
      expect([id, TARGET_FOR_TRACE[trace.id]]).toEqual([id, id])
      expect(plannedTarget(trace)).toBe(target)
      expect(mappedForks(trace, target).length).toBeGreaterThan(0)
    }
    expect(routes.size).toBe(13)
    expect(Object.keys(TARGET_FOR_TRACE).sort()).toEqual([...routes].sort())
    // No two lesions share a label: the two in RS3 that end in RB3a are told apart by slice.
    const labels = TARGET_IDS.map((id) => targetLabel(targetById(id)!))
    expect(new Set(labels).size).toBe(13)
    expect(targetLabel(targetById('r-anterior-upper')!)).toBe(
      'RS3 · Right anterior segment, by RB3a, slice 419',
    )
    expect(targetLabel(targetById('r-middle-lateral')!)).toBe(
      'RS4 · Right middle lobe lateral segment, by RB4a',
    )
    expect(() => traceForTarget('not-a-lesion')).toThrow(
      'No route is named for lesion not-a-lesion',
    )
    expect(targetById('not-a-lesion')).toBeUndefined()
  })

  test('the closing set is three of those lesions in three lobes, and the lobes hold all thirteen once', () => {
    expect(ASSESS_TARGET_IDS).toHaveLength(3)
    expect(new Set(ASSESS_TARGET_IDS).size).toBe(3)
    for (const id of ASSESS_TARGET_IDS) expect(TARGET_IDS).toContain(id)
    const groups = targetsByLobe()
    expect(groups.map((group) => group.lobe)).toEqual([
      'Right upper lobe',
      'Right middle lobe',
      'Right lower lobe',
      'Left upper lobe',
      'Left lower lobe',
    ])
    const listed = groups.flatMap((group) => group.targets.map((target) => target.id))
    expect(listed).toHaveLength(13)
    expect([...listed].sort()).toEqual([...TARGET_IDS].sort())
    const lobeOf = (id: string) =>
      groups.find((group) => group.targets.some((target) => target.id === id))!.lobe
    expect(new Set(ASSESS_TARGET_IDS.map(lobeOf)).size).toBe(3)
    // Every trip of a lesson runs on a route some lesion opens, or toward that lesion's route.
    for (const { spec } of TRIPS)
      expect(CT_TARGETS.map((target) => target.id)).toContain(traceById(spec.traceId).targetId)
  })
})

describe('the words the course uses', () => {
  const lessonStrings = NAV_LESSONS.flatMap((lesson) => [
    ...strings(`lesson ${lesson.id}`, {
      title: lesson.title,
      objective: lesson.objective,
      concept: lesson.concept,
      closing: lesson.closing,
    }),
    ...lesson.trips.flatMap((trip, i) => [
      ...strings(`lesson ${lesson.id} trip ${i + 1}`, { title: trip.title, intro: trip.intro }),
      ...Object.entries(trip.stations ?? {}).flatMap(([id, station]) =>
        strings(`lesson ${lesson.id} trip ${i + 1} ${id}.teach`, station.teach ?? ''),
      ),
      ...strings(`lesson ${lesson.id} trip ${i + 1} plan`, {
        teach: trip.plan?.teach ?? {},
        divisions: trip.plan?.divisions ?? {},
      }),
    ]),
  ])
  const guideStrings = [
    ...strings('PRIMER', PRIMER),
    ...strings('PRIMER_TITLE', PRIMER_TITLE),
    ...strings('TEACHING_SIMULATOR_STATEMENT', TEACHING_SIMULATOR_STATEMENT),
    ...strings('METHOD_STEPS', METHOD_STEPS, ['lessonId']),
    ...strings('METHOD_TIPS', METHOD_TIPS),
    ...strings('DIRECTION_CHANGE', DIRECTION_CHANGE, ['lessonId']),
    ...strings('LESSON_GROUPS', LESSON_GROUPS, ['ids']),
    ...strings('naming', { NAMING_KEY, NAMING_USE, SUBSEGMENT_NOTE, SLICE_DIRECTION_NOTE }),
    ...CT_TARGETS.flatMap((target) => strings(`targetNaming ${target.id}`, targetNaming(target))),
  ]
  // Everything in a packet but its project record: `uncertain` and `naming.uncertainty`.
  const packetStrings = JUNCTION_FEEDBACK_SCOPE.flatMap((id) =>
    strings(`packet ${id}`, junctionFeedbackPacket(id), [
      'checkpointId',
      'uncertain',
      'uncertainty',
    ]),
  )

  /**
   * What planning can say, on every lesion: each instruction, each confirmation, and each miss the
   * learner can meet, with help on and off. Built from the route geometry, as the bench builds it.
   */
  const planStrings: [string, string][] = (() => {
    const out: [string, string][] = []
    const add = (label: string, value: unknown) => out.push(...strings(label, value))
    add('PLAN_PART_TITLES', PLAN_PART_TITLES)
    add('STAGE_STEPS', STAGE_STEPS)
    add('ANATOMICAL_LABEL', ANATOMICAL_LABEL)
    add('lesionFound', lesionFound())
    add('segmentInstruction', segmentInstruction())
    for (const id of TARGET_IDS) {
      const target = targetById(id)!
      const trace = traceForTarget(id)
      add(`${id} lesionInstruction`, lesionInstruction(target))
      const show = lesionShowPoint(trace)
      for (const help of [true, false]) {
        add(
          `${id} lesionMiss without a nearest point`,
          lesionMiss({ ok: false, nearest: null }, help),
        )
        for (const [dx, dy, dSlice] of [
          [12, 0, 0],
          [0, -12, 0],
          [0, 0, -40],
          [3, 3, 3],
        ])
          add(
            `${id} lesionMiss ${dx},${dy},${dSlice}`,
            lesionMiss(
              lesionVerdict(trace, {
                slice: show.slice + dSlice,
                pixel: [show.pixel[0] + dx, show.pixel[1] + dy],
              }),
              help,
            ),
          )
      }
      add(`${id} segmentFound`, segmentFound(target))
      for (const choice of segmentChoices(target)) {
        add(`${id} segmentLabel ${choice.code}`, segmentLabel(choice))
        for (const help of [true, false])
          add(`${id} segmentMiss ${choice.code}`, segmentMiss(choice, help))
      }
      const frame = planFrame(trace, target)!
      add(`${id} frameInstruction`, frameInstruction(target.segment.bronchusCode))
      const model = frameWords(frame)
      const turned = (turn: 0 | 1 | 2 | 3) => {
        const rim = turnedRim(frame.rim, turn)
        return Object.fromEntries(RIMS.map((r) => [r, rim[r].word])) as Record<Rim, Anatomical>
      }
      const labelSets: Record<string, FrameLabels> = {
        mirrored: { ...model, right: model.left, left: model.right },
        repeated: { ...model, right: model.top },
        along: { ...model, top: frame.into },
        'top and bottom swapped': { ...model, top: model.bottom, bottom: model.top },
      }
      for (const [name, labels] of Object.entries(labelSets)) {
        const grade = gradeFrame(frame, labels)
        if (grade.ok || !grade.complete) continue
        for (const help of [true, false])
          add(`${id} frameMiss ${name}`, frameMiss(grade, frame, labels, help))
      }
      for (const turn of [0, 1, 2, 3] as const) {
        add(`${id} frameFound ${turn}`, frameFound(turn))
        const rim = turned(turn)
        for (const sector of SECTORS) {
          add(`${id} sectorPhrase ${turn} ${sector}`, sectorPhrase(sector, rim))
          add(`${id} sectorWords ${turn} ${sector}`, sectorWords(sector, rim))
        }
      }
      // While the circle is being labelled, a place without a word is named by where it is.
      for (const sector of SECTORS)
        add(
          `${id} sectorWords unlabelled ${sector}`,
          sectorWords(sector, { top: null, right: null, bottom: null, left: null }),
        )
      const mapped = mappedForks(trace, target)
      mapped.forEach((checkpointIndex, division) => {
        const bearings = divisionBearings(trace, target, division, 0)
        const parent = trace.checkpoints[checkpointIndex].decision!.parent.airway.code
        add(
          `${id} arcsInstruction ${division}`,
          arcsInstruction(parent, bearings.length, division === 0),
        )
        add(`${id} arcsFound ${division}`, arcsFound(division === mapped.length - 1))
        const exact = bearings.map((bearing) => bearing.sector)
        const route = bearings.findIndex((bearing) => bearing.onRoute)
        const piled = exact.map(() => ((exact[0] + 4) % 8) as Sector)
        const tries: [string, Sector[], number][] = [
          ['too few', exact.slice(1), route],
          ['piled opposite', piled, route],
          ['another branch toward the lesion', exact, (route + 1) % exact.length],
        ]
        for (const [name, placed, leadsOn] of tries) {
          const grade = gradeArcs(bearings, placed, leadsOn)
          if (grade.ok) continue
          for (const help of [true, false])
            add(
              `${id} arcsMiss ${division} ${name}`,
              arcsMiss(grade, placed, bearings, model, help),
            )
        }
      })
      add(`${id} reviewSentence`, reviewSentence(mapped.length, mapped.length - 1))
    }
    add('reviewSentence one', reviewSentence(1, 0))
    for (const shownStep of [true, false])
      add(
        `planSummaryLines ${shownStep}`,
        planSummaryLines({
          lesion: { asked: true, misses: 0, shown: shownStep },
          segment: { asked: true, misses: 2, shown: false },
          frame: { asked: true, misses: 0, shown: false },
          arcs: { asked: 3, firstTry: 2 },
        }),
      )
    return out
  })()

  test('the gate reads whole words in any case, and nothing else', () => {
    expect(gatedWordsIn('Your score is 3 points. Correct! Not reviewed; PASS pending.')).toEqual([
      'score',
      'points',
      'correct',
      'not reviewed',
      'pass',
      'pending',
    ])
    expect(
      gatedWordsIn('The scope passes the bypass, underscored and incorrectly upgraded.'),
    ).toEqual([])
    expect(gatedWordsIn('A point on the centreline; the passage narrows.')).toEqual([])
  })

  test('the collections hold the text they are meant to', () => {
    expect(lessonStrings.length).toBeGreaterThan(80)
    expect(guideStrings.length).toBeGreaterThan(40)
    expect(planStrings.length).toBeGreaterThan(1000)
    const lessonText = lessonStrings.map(([, text]) => text)
    expect(lessonText).toContain(NAV_LESSONS[0].trips[0].intro)
    expect(lessonText).toContain(lessonById('start-at-the-lesion')!.trips[0].plan!.teach!.lesion)
    expect(lessonText).toContain(
      lessonById('nested-arcs')!.trips[0].plan!.divisions!['junction-61'],
    )
    const guideText = guideStrings.map(([, text]) => text)
    expect(guideText).toContain(PRIMER[0])
    expect(guideText).toContain(METHOD_STEPS[0].what)
    expect(guideText).toContain(METHOD_TIPS[0])
    // The lesson ids a step points at are not learner text.
    expect(guideText).not.toContain(METHOD_STEPS[0].lessonId)
    const planText = planStrings.map(([, text]) => text)
    for (const kind of [
      'is on the circle twice.',
      'is along your line of sight.',
      'This is the mirror image.',
      'branches.',
      'is not where a branch leaves.',
      'The branches are in the right places.',
      'Not the airway that runs into the lesion.',
    ])
      expect([kind, planText.some((text) => text.endsWith(kind))]).toEqual([kind, true])
    // Every planning sentence is a finished sentence, with nothing left unfilled.
    for (const [label, text] of planStrings) {
      expect([label, text.trim().length > 0]).toEqual([label, true])
      expect([label, /undefined|null|NaN|\[object|  |\bthe the\b/.test(text)]).toEqual([
        label,
        false,
      ])
    }
    const packet = junctionFeedbackPacket('junction-1')!
    const packetText = packetStrings.map(([, text]) => text)
    expect(packetText).toContain(packet.divergence)
    expect(packetText).toContain(packet.naming.try!.explanation.RMSB)
    expect(packetText).toContain(packet.whenNearer[0]!.text)
    // The project record is not learner-facing text.
    for (const note of packet.uncertain) expect(packetText).not.toContain(note)
    for (const label of Object.keys(REPORTED_NOT_GATED))
      expect(packetStrings.map(([name]) => name)).toContain(label)
    // Each reported course sentence is still where it was reported.
    const courseLabels = [...lessonStrings, ...guideStrings].map(([name]) => name)
    for (const label of Object.keys(REPORTED_COURSE_WORDS)) expect(courseLabels).toContain(label)
  })

  test('no lesson, primer, method or planning text uses a scoring, answer-leak or project-record word', () => {
    const hits = [...lessonStrings, ...guideStrings, ...planStrings].flatMap(([label, text]) => {
      const reported = REPORTED_COURSE_WORDS[label] ?? []
      return gatedWordsIn(
        text,
        GATED_WORDS.filter((word) => !reported.includes(word)),
      ).map((word) => `${label}: "${word}"`)
    })
    expect(hits).toEqual([])
  })

  test('no fork explanation uses one either', () => {
    const hits = packetStrings.flatMap(([label, text]) => {
      const reported = REPORTED_NOT_GATED[label] ?? []
      return gatedWordsIn(
        text,
        GATED_WORDS.filter((word) => !reported.includes(word)),
      ).map((word) => `${label}: "${word}"`)
    })
    expect(hits).toEqual([])
  })
})

describe('what a lesson says before the segment is named', () => {
  // Anything on screen while the airway into the lesion is found and the segment is named: the
  // lesson's title, objective and concept (lesson notes), every trip title (subtitle and trip
  // list), and this trip's intro and planning text for those two steps.
  const shownBeforeNaming = (lesson: (typeof NAV_LESSONS)[number], spec: NavTripSpec) => [
    lesson.title,
    lesson.objective,
    lesson.concept,
    ...lesson.trips.map((trip) => trip.title),
    spec.intro,
    spec.plan?.teach?.lesion ?? '',
    spec.plan?.teach?.segment ?? '',
  ]

  test('no lesson names the segment it asks the learner to name', () => {
    const asked = NAV_LESSONS.flatMap((lesson) =>
      lesson.trips
        .filter((spec) => spec.plan?.parts.includes('segment'))
        .map((spec) => ({ lesson, spec })),
    )
    expect(asked.length).toBeGreaterThanOrEqual(6)
    for (const { lesson, spec } of asked) {
      const target = plannedTarget(traceById(spec.traceId))
      const choice = segmentChoices(target).find((c) => c.code === target.segment.bronchusCode)!
      const giveaways = [
        new RegExp(`\\b${target.segment.code.replace('+', '\\+')}\\b`),
        new RegExp(`\\b${target.segment.bronchusCode.replace('+', '\\+')}\\b`),
        new RegExp(`\\b${target.approachCode.replace('+', '\\+')}\\b`),
        new RegExp(`\\b${choice.name} segment`, 'i'),
        new RegExp(target.segment.name, 'i'),
      ]
      for (const text of shownBeforeNaming(lesson, spec))
        for (const giveaway of giveaways)
          expect({ lesson: lesson.id, trip: spec.title, found: giveaway.exec(text)?.[0] }).toEqual({
            lesson: lesson.id,
            trip: spec.title,
            found: undefined,
          })
    }
  })

  test('the primer’s count of divisions past the segment holds for every route', () => {
    const most = Math.max(
      ...Object.keys(TARGET_FOR_TRACE).map((id) => {
        const trace = traceById(id)
        return mappedForks(trace, plannedTarget(trace)).length
      }),
    )
    expect(most).toBeLessThanOrEqual(5)
    expect(PRIMER.join(' ')).toContain('no route in this course has more than five of them')
  })

  test('the lesion of the route that comes back up lies above the division of the left main bronchus', () => {
    const trace = traceById('left-lower-returning')
    const target = plannedTarget(trace)
    const fork = trace.checkpoints.find((checkpoint) => checkpoint.id === 'junction-3')!
    expect(fork.decision!.parent.airway.code).toBe('LMSB')
    // Slice numbers rise toward the head: every slice of the lesion is above the fork.
    const forkSlice = Math.round(
      (fork.decision!.junctionLps[2] - NATIVE_CT.origin[2]) / NATIVE_CT.spacing[2],
    )
    const lowest = Math.min(...target.patch.frames.map((frame) => frame.slice))
    expect(lowest).toBeGreaterThan(forkSlice)
    expect(lessonById('turn-back')!.trips[0].intro).toContain(
      'above the fork where the left main bronchus divides',
    )
  })
})
