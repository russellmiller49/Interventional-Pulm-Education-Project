import { PRIMER, PRIMER_TITLE, TEACHING_SIMULATOR_STATEMENT } from '../content/bench-copy'
import {
  DIRECTION_CHANGE,
  NAMING_KEY,
  NAMING_USE,
  PATTERNS,
  SLICE_DIRECTION_NOTE,
  SUBSEGMENT_NOTE,
  patternFor,
  targetNaming,
} from '../content/course-guide'
import { JUNCTION_FEEDBACK_SCOPE, junctionFeedbackPacket } from '../content/junction-feedback'
import { BASE_PATH, lessonHref } from '../content/module'
import {
  CENTRAL_STATIONS,
  LESSON_GROUPS,
  MIN_IDENTIFY_AREA_MM2,
  NAV_LESSONS,
  buildTrip,
  defaultSteps,
  identifiable,
  lessonAfter,
  lessonById,
  lessonNumber,
  routePlan,
  totalMinutes,
  type NavTripSpec,
} from '../content/nav-lessons'
import {
  ASSESS_TARGET_IDS,
  TARGET_IDS,
  targetById,
  targetLabel,
  targetsByLobe,
  traceForTarget,
} from '../content/targets'
import { optionLumenAreaMm2 } from '../engine/junction-feedback'
import {
  navReducer,
  startSession,
  summarize,
  type NavAction,
  type NavSession,
} from '../engine/nav-session'
import { operationsToMatch, stationMatch } from '../engine/orientation-match'
import { CT_TARGETS, CT_TRACES, traceById } from '../geometry/native-ct'
import { STANDARD_ORIENTATION } from '../geometry/orientation'

/**
 * The lesson registry: eight lessons, each one or more trips along a real route. These tests hold
 * the registry to the routes it names and to the words the course may use.
 */
const TRIPS = NAV_LESSONS.flatMap((lesson) =>
  lesson.trips.map((spec, index) => ({
    lesson,
    spec,
    index,
    label: `${lesson.id} trip ${index + 1}`,
  })),
)
const forksOf = (traceId: string) =>
  traceById(traceId).checkpoints.flatMap((checkpoint, index) =>
    checkpoint.decision ? [{ id: checkpoint.id, index }] : [],
  )

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

/** No sentence is excepted from the gate: a gated word is rephrased in the content instead. */
const REPORTED_NOT_GATED: Record<string, string[]> = {}

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
  test('eight lessons with their own ids, in four groups, about an hour in all', () => {
    expect(NAV_LESSONS).toHaveLength(8)
    const ids = NAV_LESSONS.map((lesson) => lesson.id)
    expect(new Set(ids).size).toBe(8)
    expect(totalMinutes()).toBe(NAV_LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0))
    for (const lesson of NAV_LESSONS) {
      expect(Number.isInteger(lesson.minutes) && lesson.minutes > 0).toBe(true)
      expect(lesson.trips.length).toBeGreaterThan(0)
      for (const text of [lesson.title, lesson.objective, lesson.concept, lesson.closing])
        expect(text.trim().length).toBeGreaterThan(0)
      // Ids are used in addresses and storage keys.
      expect(lesson.id).toMatch(/^[a-z0-9-]+$/)
      expect(lessonHref(lesson.id)).toBe(`${BASE_PATH}/learn?lesson=${lesson.id}`)
    }
    // Every group id is a lesson, and every lesson is in exactly one group, in course order.
    const grouped = LESSON_GROUPS.flatMap((group) => group.ids)
    expect(grouped).toEqual(ids)
    for (const group of LESSON_GROUPS) {
      expect(group.label.trim().length).toBeGreaterThan(0)
      expect(group.ids.length).toBeGreaterThan(0)
    }
  })

  test('lessons are found by id, numbered from one, and each leads to the next', () => {
    NAV_LESSONS.forEach((lesson, i) => {
      expect(lessonById(lesson.id)).toBe(lesson)
      expect(lessonNumber(lesson.id)).toBe(i + 1)
      expect(lessonAfter(lesson.id)).toBe(NAV_LESSONS[i + 1])
    })
    expect(lessonAfter(NAV_LESSONS[7].id)).toBeUndefined()
    expect(lessonById('not-a-lesson')).toBeUndefined()
    expect(lessonById(undefined)).toBeUndefined()
    expect(lessonNumber('not-a-lesson')).toBe(0)
  })

  test('the four fork patterns and the change of direction each point at a lesson that carries them', () => {
    const ids = NAV_LESSONS.map((lesson) => lesson.id)
    expect(PATTERNS.map((pattern) => pattern.name)).toEqual([
      'Vertical',
      'Horizontal–horizontal',
      'Horizontal–vertical',
      'Horizontal–oblique',
    ])
    expect(new Set(PATTERNS.map((pattern) => pattern.lessonId)).size).toBe(4)
    for (const pattern of PATTERNS) {
      expect([pattern.lessonId, ids.includes(pattern.lessonId)]).toEqual([pattern.lessonId, true])
      expect(patternFor(pattern.lessonId)).toBe(pattern)
      expect(pattern.definition.length).toBeGreaterThan(0)
      // The lesson names the same pattern the reference files it under.
      expect(lessonById(pattern.lessonId)!.pattern).toBe(pattern.name)
    }
    expect(ids).toContain(DIRECTION_CHANGE.lessonId)
    // The course does not call the change of direction a fifth pattern.
    expect(patternFor(DIRECTION_CHANGE.lessonId)).toBeUndefined()
    expect(lessonById(DIRECTION_CHANGE.lessonId)!.pattern).toBeUndefined()
    expect(
      NAV_LESSONS.filter((lesson) => lesson.pattern)
        .map((lesson) => lesson.id)
        .sort(),
    ).toEqual(PATTERNS.map((pattern) => pattern.lessonId).sort())
  })
})

describe('trips', () => {
  test.each(TRIPS.map((trip) => [trip.label, trip] as const))(
    '%s builds on its own route, fork after fork',
    (_, { spec }) => {
      const trip = buildTrip(spec)
      expect(trip.spec).toBe(spec)
      expect(trip.trace).toBe(traceById(spec.traceId))
      expect(trip.plan.traceId).toBe(spec.traceId)
      expect(trip.plan.arrive).toBe(Boolean(spec.arrive))
      const forks = forksOf(spec.traceId)
      const stations = trip.plan.stations
      expect(stations.length).toBeGreaterThan(0)
      expect(trip.teach).toHaveLength(stations.length)
      // Consecutive forks of the route, from the one named to the one named.
      stations.forEach((station, i) => {
        expect(trip.trace.checkpoints[station.checkpointIndex].decision).toBeDefined()
        if (i > 0) expect(station.checkpointIndex).toBe(stations[i - 1].checkpointIndex + 1)
      })
      expect(trip.trace.checkpoints[stations[0].checkpointIndex].id).toBe(spec.from)
      const lastId = trip.trace.checkpoints[stations.at(-1)!.checkpointIndex].id
      expect(lastId).toBe(spec.through ?? forks.at(-1)!.id)
      // A trip that arrives drives through the route's last fork.
      if (spec.arrive) expect(stations.at(-1)!.checkpointIndex).toBe(forks.at(-1)!.index)
      for (const station of stations) {
        const where = `${spec.traceId} ${trip.trace.checkpoints[station.checkpointIndex].id}`
        expect(new Set(station.steps).size).toBe(station.steps.length)
        for (const step of station.steps) expect(['match', 'identify', 'choose']).toContain(step)
        // Steps are asked in the order they are worked.
        expect([...station.steps]).toEqual(
          ['match', 'identify', 'choose'].filter((step) => station.steps.includes(step as never)),
        )
        // A fork is asked to be marked only where every lumen is large enough to click.
        if (station.steps.includes('identify'))
          expect([where, identifiable(trip.trace, station.checkpointIndex)]).toEqual([where, true])
        expect(station.worked ?? false).toBe(
          spec.stations?.[trip.trace.checkpoints[station.checkpointIndex].id]?.worked ??
            spec.worked ??
            false,
        )
      }
      // Every fork the trip writes about is one it visits, and its text arrives at that fork.
      for (const [id, station] of Object.entries(spec.stations ?? {})) {
        const at = stations.findIndex(
          (planned) => trip.trace.checkpoints[planned.checkpointIndex].id === id,
        )
        expect([id, at >= 0]).toEqual([id, true])
        expect(trip.teach[at]).toBe(station.teach)
        if (station.steps) expect(stations[at].steps).toEqual(station.steps)
        else
          expect(stations[at].steps).toEqual(defaultSteps(trip.trace, stations[at].checkpointIndex))
      }
    },
  )

  test.each(TRIPS.map((trip) => [trip.label, trip] as const))(
    '%s can be driven to its end with every step shown',
    (_, { spec }) => {
      const { trace, plan } = buildTrip(spec)
      const reduce = navReducer(trace, plan)
      let state = startSession(trace, plan)
      let actions = 0
      for (let action = shown(state); action && actions < 400; action = shown(state)) {
        const next = reduce(state, action)
        expect(next).not.toBe(state)
        state = next
        actions++
      }
      expect(actions).toBeLessThan(400)
      expect(state.phase).toBe(plan.arrive ? 'arrived' : 'done')
      expect(state.station).toBe(plan.stations.length - 1)
      expect(summarize(state).forks).toBe(plan.stations.length)
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
    expect(buildTrip(base).plan.stations.map((station) => station.checkpointIndex)).toEqual([1, 2])
    expect(() => buildTrip({ ...base, from: 'junction-3' })).toThrow(/is not on its route/)
    expect(() => buildTrip({ ...base, through: 'junction-1' })).toThrow(/is not on its route/)
    expect(() => buildTrip({ ...base, through: 'junction-999' })).toThrow(/is not on its route/)
    expect(() => buildTrip({ ...base, arrive: true })).toThrow(
      /arrives without driving through its last fork/,
    )
    expect(() => buildTrip({ ...base, stations: { 'junction-10': { teach: 'x' } } })).toThrow(
      /names junction-10, which it does not visit/,
    )
    expect(() => buildTrip({ ...base, traceId: 'not-a-route' })).toThrow(/Unknown CT trace/)
    // Without `through`, a trip runs to the route's last fork.
    expect(buildTrip({ ...base, through: undefined }).plan.stations).toHaveLength(
      forksOf('central-right').length - 1,
    )
  })

  test('lesson 1 opens at the carina asking for the flip, then in RB1 asking for one turn left', () => {
    const lesson = NAV_LESSONS[0]
    expect(lesson.id).toBe('carina-orientation')
    expect(lesson.trips).toHaveLength(2)
    const carina = buildTrip(lesson.trips[0])
    expect(carina.trace.id).toBe('central-right')
    expect(carina.plan.stations).toHaveLength(1)
    expect(carina.trace.checkpoints[carina.plan.stations[0].checkpointIndex].id).toBe('junction-1')
    const start = startSession(carina.trace, carina.plan)
    expect(start.phase).toBe('match')
    expect(start.orientation).toEqual(STANDARD_ORIENTATION)
    const trachea = stationMatch(carina.trace, carina.plan.stations[0].checkpointIndex)!
    expect(trachea.accepted).toEqual([{ turns: 0, reflected: true }])
    expect(operationsToMatch(trachea, STANDARD_ORIENTATION)).toEqual(['flip'])

    const rb1 = buildTrip(lesson.trips[1])
    expect(rb1.trace.id).toBe('right-upper-apical')
    expect(rb1.plan.stations).toHaveLength(1)
    const station = rb1.plan.stations[0]
    expect(rb1.trace.checkpoints[station.checkpointIndex].id).toBe('junction-14')
    expect(station.steps).toEqual(['match'])
    expect(startSession(rb1.trace, rb1.plan).phase).toBe('match')
    expect(
      operationsToMatch(stationMatch(rb1.trace, station.checkpointIndex)!, STANDARD_ORIENTATION),
    ).toEqual(['left'])
  })
})

describe('whole routes', () => {
  test('a route plan visits every fork; the trachea and main bronchus are matched and chosen, not marked', () => {
    expect(CENTRAL_STATIONS).toBe(2)
    expect(MIN_IDENTIFY_AREA_MM2).toBe(5)
    for (const trace of CT_TRACES) {
      const plan = routePlan(trace)
      const forks = forksOf(trace.id)
      expect(plan.traceId).toBe(trace.id)
      expect(plan.arrive).toBe(true)
      expect(plan.stations.map((station) => station.checkpointIndex)).toEqual(
        forks.map((fork) => fork.index),
      )
      plan.stations.forEach((station, i) => {
        if (i < CENTRAL_STATIONS) expect(station.steps).toEqual(['match', 'choose'])
        else expect(station.steps).toEqual(defaultSteps(trace, station.checkpointIndex))
        expect(station.steps).toContain('choose')
      })
    }
  })

  test('a fork is marked only where every lumen is at least the minimum area; otherwise it is only chosen at', () => {
    let marked = 0
    let chosenOnly = 0
    for (const trace of CT_TRACES)
      for (const { index } of forksOf(trace.id)) {
        const areas = trace.checkpoints[index].decision!.options.map((_, option) =>
          optionLumenAreaMm2(trace, index, option),
        )
        const large = areas.every((area) => area >= MIN_IDENTIFY_AREA_MM2)
        expect(identifiable(trace, index)).toBe(large)
        expect(defaultSteps(trace, index)).toEqual(
          large ? ['match', 'identify', 'choose'] : ['choose'],
        )
        if (large) marked++
        else chosenOnly++
      }
    expect(marked + chosenOnly).toBe(128)
    expect(marked).toBeGreaterThan(chosenOnly)
    expect(chosenOnly).toBeGreaterThan(0)
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
    }
    expect(routes.size).toBe(13)
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
      pattern: lesson.pattern ?? '',
      closing: lesson.closing,
    }),
    ...lesson.trips.flatMap((trip, i) => [
      ...strings(`lesson ${lesson.id} trip ${i + 1}`, { title: trip.title, intro: trip.intro }),
      ...Object.entries(trip.stations ?? {}).flatMap(([id, station]) =>
        strings(`lesson ${lesson.id} trip ${i + 1} ${id}.teach`, station.teach ?? ''),
      ),
    ]),
  ])
  const guideStrings = [
    ...strings('PRIMER', PRIMER),
    ...strings('PRIMER_TITLE', PRIMER_TITLE),
    ...strings('TEACHING_SIMULATOR_STATEMENT', TEACHING_SIMULATOR_STATEMENT),
    ...strings('PATTERNS', PATTERNS, ['lessonId']),
    ...strings('DIRECTION_CHANGE', DIRECTION_CHANGE, ['lessonId']),
    ...strings('LESSON_GROUPS', LESSON_GROUPS, ['ids']),
    ...strings('naming', { NAMING_KEY, NAMING_USE, SUBSEGMENT_NOTE, SLICE_DIRECTION_NOTE }),
  ]
  // Everything in a packet but its project record: `uncertain` and `naming.uncertainty`.
  const packetStrings = JUNCTION_FEEDBACK_SCOPE.flatMap((id) =>
    strings(`packet ${id}`, junctionFeedbackPacket(id), [
      'checkpointId',
      'uncertain',
      'uncertainty',
    ]),
  )

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
    expect(guideStrings.length).toBeGreaterThan(20)
    expect(packetStrings.length).toBeGreaterThan(200)
    expect(lessonStrings.map(([, text]) => text)).toContain(NAV_LESSONS[0].trips[0].intro)
    expect(guideStrings.map(([, text]) => text)).toContain(PRIMER[0])
    const packet = junctionFeedbackPacket('junction-1')!
    const packetText = packetStrings.map(([, text]) => text)
    expect(packetText).toContain(packet.divergence)
    expect(packetText).toContain(packet.naming.try!.explanation.RMSB)
    expect(packetText).toContain(packet.whenNearer[0]!.text)
    // The project record is not learner-facing text.
    for (const note of packet.uncertain) expect(packetText).not.toContain(note)
    for (const label of Object.keys(REPORTED_NOT_GATED))
      expect(packetStrings.map(([name]) => name)).toContain(label)
  })

  test('no lesson, primer or pattern text uses a scoring, answer-leak or project-record word', () => {
    const hits = [...lessonStrings, ...guideStrings].flatMap(([label, text]) =>
      gatedWordsIn(text).map((word) => `${label}: "${word}"`),
    )
    expect(hits).toEqual([])
  })

  test('no fork explanation uses one either, outside the two reported sentences', () => {
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
