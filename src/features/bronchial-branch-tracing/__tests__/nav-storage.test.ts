import { RIMS, mappedForks, turnedRim, type FrameLabels } from '../engine/arc-map'
import { lessonById, buildTrip, routePlan } from '../content/nav-lessons'
import { targetById, traceForTarget, TARGET_IDS } from '../content/targets'
import type { NavAction, NavPlan } from '../engine/nav-session'
import {
  NAV_ENTRY_LIMIT,
  NAV_STORAGE_KEY,
  ORIENTATION_MATCHES,
  navKey,
  orientationShown,
  readNavEntry,
  readOrientationProgress,
  recordOrientationProgress,
  savedNavKeys,
  writeNavEntry,
} from '../engine/nav-storage'
import { PLAN_PARTS, lesionShowPoint, planFrame, type PlanAction } from '../engine/plan-session'
import {
  startTrip,
  tripReducer,
  type TripAction,
  type TripPlan,
  type TripSession,
} from '../engine/trip-session'
import { SELF_PACED_STORAGE_KEY } from '../engine/selfPacedProgress'
import { responsePlane } from '../engine/junction-feedback'
import { traceById } from '../geometry/native-ct'

/** A tiny in-memory Storage: only what the module uses, with switches to make it fail. */
class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  failReads = false
  failWrites = false
  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
    if (this.failReads) throw new Error('read refused')
    return this.items.get(key) ?? null
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota exceeded')
    this.items.set(key, value)
  }
}

/** A drive with no planning: the whole central-right route, turning the CT asked for. */
const trace = traceById('central-right')
const driveOnly: TripPlan = { plan: null, nav: routePlan(trace, { matchOptional: false }) }
const fresh = () => startTrip(trace, null, driveOnly)
const nav = (action: NavAction): TripAction => ({ type: 'nav', action })
const after = (actions: NavAction[]) =>
  actions.map(nav).reduce(tripReducer(trace, null, driveOnly), fresh())
/**
 * A drive a few steps in: matched after a miss, driven into the left main bronchus and backed out
 * of it, then on through the carina to the next fork.
 */
const underway = (): TripSession =>
  after([
    { type: 'check-match' },
    { type: 'turn', operation: 'flip' },
    { type: 'check-match' },
    { type: 'choose', option: 1 },
    { type: 'astray-arrive' },
    { type: 'back-out' },
    { type: 'astray-return' },
    { type: 'choose', option: 0 },
    { type: 'drive' },
    { type: 'arrive' },
  ])
const stored = (storage: Storage) => JSON.parse(storage.getItem(NAV_STORAGE_KEY)!)
const NO_PROGRESS = { firstTryMatches: 0, lessonOneDone: false }

beforeEach(() => jest.useFakeTimers().setSystemTime(Date.parse('2026-10-09T12:00:00.000Z')))
afterEach(() => jest.useRealTimers())

describe('where a trip was left', () => {
  test('keys name the section and the lesson or lesion', () => {
    expect(NAV_STORAGE_KEY).toBe('branch-tracing.nav-v2')
    expect(NAV_STORAGE_KEY).not.toBe(SELF_PACED_STORAGE_KEY)
    expect(NAV_ENTRY_LIMIT).toBe(24)
    expect(ORIENTATION_MATCHES).toBe(3)
    expect(navKey('learn', 'two-levels')).toBe('learn:two-levels')
    expect(navKey('practice', 'r-anterior-basal')).toBe('practice:r-anterior-basal')
    expect(navKey('assess', 'l-inferior-lingula')).toBe('assess:l-inferior-lingula')
  })

  test('a drive-only trip comes back exactly as it was written, under its own key', () => {
    const storage = new MemoryStorage()
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'empty', entry: null })
    expect(savedNavKeys(storage)).toEqual([])
    const trip = underway()
    expect(trip).toMatchObject({ version: 2, stage: 'navigate', plan: null })
    expect(trip.nav).toMatchObject({ station: 1, orientation: { turns: 0, reflected: true } })
    expect(trip.nav!.log[0]).toMatchObject({ wrongTurns: 1, backedOut: 1, chooseMisses: 1 })
    expect(writeNavEntry('learn:two-levels', { leg: 2, trip }, storage)).toBe(true)
    const read = readNavEntry('learn:two-levels', storage)
    expect(read.status).toBe('saved')
    expect(read.entry).toEqual({ leg: 2, trip, updatedAt: '2026-10-09T12:00:00.000Z' })
    expect(read.entry!.trip.nav!.log).toEqual(trip.nav!.log)
    // Another key has nothing, and says so without calling the record unreadable.
    expect(readNavEntry('practice:r-anterior-basal', storage)).toEqual({
      status: 'saved',
      entry: null,
    })
    expect(savedNavKeys(storage)).toEqual(['learn:two-levels'])
    // One record under one storage key, and nothing else is written.
    expect(storage.length).toBe(1)
    expect(storage.key(0)).toBe(NAV_STORAGE_KEY)
    expect(stored(storage)).toEqual({
      version: 2,
      entries: {
        'learn:two-levels': { leg: 2, trip, updatedAt: '2026-10-09T12:00:00.000Z' },
      },
      orientation: NO_PROGRESS,
    })
  })

  test('a trip that plans and then drives survives the round trip at every stage of its plan', () => {
    const storage = new MemoryStorage()
    const target = targetById('r-apical-anterior')!
    const apical = traceForTarget(target.id)
    const trip: TripPlan = {
      plan: { traceId: apical.id, targetId: target.id, parts: PLAN_PARTS },
      nav: routePlan(apical, { matchOptional: true }),
    }
    const reduce = tripReducer(apical, target, trip)
    const frame = planFrame(apical, target)!
    const rim = turnedRim(frame.rim, 1)
    const turned = Object.fromEntries(RIMS.map((r) => [r, rim[r].word])) as FrameLabels
    const far = lesionShowPoint(apical)
    const planActions: PlanAction[] = [
      // A miss, then the airway itself.
      { type: 'mark-lesion', mark: { slice: far.slice, pixel: [far.pixel[0] + 40, far.pixel[1]] } },
      { type: 'mark-lesion', mark: lesionShowPoint(apical) },
      { type: 'choose-segment', code: 'RB3' },
      { type: 'show-segment' },
      { type: 'set-view', view: 'coronal', on: true },
      { type: 'views-done' },
      // The learner's circle in another roll.
      ...RIMS.map((r) => ({ type: 'label-rim', rim: r, word: turned[r] }) as PlanAction),
      { type: 'check-frame' },
      { type: 'place-arc', sector: 0 },
      { type: 'place-arc', sector: 4 },
      { type: 'lead-on', index: 1 },
      { type: 'check-arcs' },
      ...mappedForks(apical, target).map(() => ({ type: 'show-arcs' }) as PlanAction),
      { type: 'finish' },
    ]
    const actions: TripAction[] = [
      ...planActions.map((action) => ({ type: 'plan', action }) as TripAction),
      nav({ type: 'check-match' }),
      nav({ type: 'show-choice' }),
      nav({ type: 'drive' }),
      nav({ type: 'arrive' }),
    ]
    let session = startTrip(apical, target, trip)
    const stages: string[] = []
    for (const action of [null, ...actions]) {
      if (action) session = reduce(session, action)
      stages.push(session.stage === 'plan' ? session.plan!.stage : session.stage)
      expect(writeNavEntry('practice:r-apical-anterior', { leg: 0, trip: session }, storage)).toBe(
        true,
      )
      const read = readNavEntry('practice:r-apical-anterior', storage)
      expect([stages.at(-1), read.status]).toEqual([stages.at(-1), 'saved'])
      expect(read.entry!.trip).toEqual(session)
    }
    // Every planning stage, then the drive, was written and read back.
    expect([...new Set(stages)]).toEqual([
      'lesion',
      'segment',
      'views',
      'frame',
      'arcs',
      'review',
      'navigate',
    ])
    expect(session.plan).toMatchObject({
      stage: 'done',
      segmentChoice: 'RB1',
      views: { coronal: true, sagittal: false },
      frameTurn: 1,
      lesionMark: { ok: true, shown: false },
      log: { lesion: { misses: 1 }, segment: { misses: 1, shown: true } },
    })
    // Turning the CT was optional at every fork driven.
    expect(session.nav).toMatchObject({ station: 1, matchNote: 'optional' })
    expect(session.nav!.log.map((line) => line.matchAsked)).toEqual([false, false])
  })

  test('the whole shown plan for every lesion reads back, lesion marks and arcs included', () => {
    const storage = new MemoryStorage()
    for (const id of TARGET_IDS) {
      const target = targetById(id)!
      const route = traceForTarget(id)
      const trip: TripPlan = {
        plan: { traceId: route.id, targetId: id, parts: PLAN_PARTS },
        nav: routePlan(route, { matchOptional: false }),
      }
      const reduce = tripReducer(route, target, trip)
      const plan = (action: PlanAction): TripAction => ({ type: 'plan', action })
      const session = [
        plan({ type: 'show-lesion' }),
        plan({ type: 'show-segment' }),
        plan({ type: 'views-done' }),
        plan({ type: 'show-frame' }),
        ...mappedForks(route, target).map(() => plan({ type: 'show-arcs' })),
        plan({ type: 'finish' }),
      ].reduce(reduce, startTrip(route, target, trip))
      expect([id, session.stage]).toEqual([id, 'navigate'])
      expect(writeNavEntry(navKey('practice', id), { leg: 0, trip: session }, storage)).toBe(true)
      expect([id, readNavEntry(navKey('practice', id), storage).entry?.trip]).toEqual([id, session])
    }
    expect(savedNavKeys(storage)).toHaveLength(TARGET_IDS.length)
  })

  test('every phase of a drive, with its marks, verdicts and wrong turn, survives the round trip', () => {
    const storage = new MemoryStorage()
    const marking: NavPlan = {
      traceId: 'central-right',
      stations: [{ checkpointIndex: 0, steps: ['match', 'identify', 'choose'] }],
      arrive: true,
    }
    const trip: TripPlan = { plan: null, nav: marking }
    const reduce = tripReducer(trace, null, trip)
    const plane = (option: number) => responsePlane(trace, 0, option)!
    const actions: NavAction[] = [
      { type: 'check-match' },
      { type: 'show-match' },
      { type: 'mark', mark: { slice: 372, pixel: plane(1).pixel } },
      { type: 'mark', mark: { slice: 372, pixel: plane(0).pixel } },
      { type: 'show-mark' },
      { type: 'choose', option: 1 },
      { type: 'astray-arrive' },
      { type: 'back-out' },
      { type: 'astray-return' },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
    ]
    const phases: string[] = []
    let session = startTrip(trace, null, trip)
    for (const action of [null, ...actions]) {
      if (action) session = reduce(session, nav(action))
      phases.push(session.nav!.phase)
      expect(writeNavEntry('practice:r-middle-medial-b', { leg: 0, trip: session }, storage)).toBe(
        true,
      )
      const read = readNavEntry('practice:r-middle-medial-b', storage)
      expect([session.nav!.phase, read.status]).toEqual([session.nav!.phase, 'saved'])
      expect(read.entry!.trip).toEqual(session)
    }
    expect(phases).toEqual([
      'match',
      'match',
      'identify',
      'identify',
      'identify',
      'choose',
      'astray-in',
      'astray',
      'astray-out',
      'choose',
      'ready',
      'drive',
      'arrived',
    ])
    expect(session.nav!.marks.map((mark) => [mark?.verdict, mark?.shown])).toEqual([
      ['intended-lumen', false],
      ['intended-lumen', true],
    ])
    expect(session.nav!.log[0]).toMatchObject({ wrongTurns: 1, backedOut: 1, chooseShown: true })
    // A drive that ends at a fork without arriving ends in `done`, with the check of an optional
    // match kept beside it.
    const stopping: TripPlan = {
      plan: null,
      nav: {
        traceId: 'central-right',
        stations: [{ checkpointIndex: 0, steps: ['match', 'choose'] }],
        arrive: false,
        matchOptional: true,
      },
    }
    const done = [nav({ type: 'check-match' }), nav({ type: 'show-choice' })].reduce(
      tripReducer(trace, null, stopping),
      startTrip(trace, null, stopping),
    )
    expect(done.nav).toMatchObject({
      phase: 'done',
      matchNote: 'optional',
      optionalCheck: { ok: false },
    })
    expect(writeNavEntry('learn:two-levels', { leg: 0, trip: done }, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage).entry!.trip).toEqual(done)
  })

  test('writing a key again replaces that entry and keeps the others', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, trip: fresh() }, storage)
    writeNavEntry('practice:r-anterior-basal', { leg: 0, trip: fresh() }, storage)
    jest.setSystemTime(Date.parse('2026-10-09T12:05:00.000Z'))
    const later = underway()
    expect(writeNavEntry('learn:two-levels', { leg: 1, trip: later }, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage).entry).toEqual({
      leg: 1,
      trip: later,
      updatedAt: '2026-10-09T12:05:00.000Z',
    })
    expect(readNavEntry('practice:r-anterior-basal', storage).entry).toMatchObject({
      leg: 0,
      updatedAt: '2026-10-09T12:00:00.000Z',
    })
    expect(savedNavKeys(storage).sort()).toEqual(['learn:two-levels', 'practice:r-anterior-basal'])
  })

  test('writing null removes one entry and leaves the rest', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, trip: fresh() }, storage)
    writeNavEntry('practice:r-anterior-basal', { leg: 0, trip: underway() }, storage)
    expect(writeNavEntry('learn:two-levels', null, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'saved', entry: null })
    expect(savedNavKeys(storage)).toEqual(['practice:r-anterior-basal'])
    expect(readNavEntry('practice:r-anterior-basal', storage).entry!.trip).toEqual(underway())
    // Removing a key that was never saved is not an error.
    expect(writeNavEntry('assess:l-inferior-lingula', null, storage)).toBe(true)
    expect(savedNavKeys(storage)).toEqual(['practice:r-anterior-basal'])
  })

  test('a lesson trip as the host builds it is saved and read back', () => {
    const storage = new MemoryStorage()
    const built = buildTrip(lessonById('drive-with-the-map')!.trips[0], { matchOptional: false })
    const session = startTrip(built.trace, built.target, built.trip)
    expect(session).toMatchObject({ stage: 'plan', plan: { stage: 'frame' } })
    expect(writeNavEntry('learn:drive-with-the-map', { leg: 0, trip: session }, storage)).toBe(true)
    expect(readNavEntry('learn:drive-with-the-map', storage).entry!.trip).toEqual(session)
  })
})

describe('a record that cannot be read', () => {
  test('a value that is not JSON is reported as unreadable, and the next write replaces it', () => {
    const storage = new MemoryStorage()
    storage.setItem(NAV_STORAGE_KEY, '{not json')
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'unreadable', entry: null })
    expect(savedNavKeys(storage)).toEqual([])
    expect(readOrientationProgress(storage)).toEqual(NO_PROGRESS)
    // Reading never repairs or removes it.
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe('{not json')
    const trip = underway()
    expect(writeNavEntry('learn:two-levels', { leg: 0, trip }, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage)).toEqual({
      status: 'saved',
      entry: { leg: 0, trip, updatedAt: '2026-10-09T12:00:00.000Z' },
    })
    expect(Object.keys(stored(storage).entries)).toEqual(['learn:two-levels'])
  })

  test('a version 1 record is not read: under the new key it is unreadable and replaced, and the old key is left alone', () => {
    const storage = new MemoryStorage()
    // The shape version 1 wrote: a bare drive session per entry, no orientation progress.
    const { optionalCheck, astray, log, ...v1Fields } = underway().nav!
    expect([optionalCheck, astray]).toEqual([null, null])
    const v1Session = {
      ...v1Fields,
      version: 1,
      // Version 1 kept no count of wrong turns.
      log: log.map((line) =>
        Object.fromEntries(
          Object.entries(line).filter(([key]) => key !== 'wrongTurns' && key !== 'backedOut'),
        ),
      ),
    }
    const v1 = {
      version: 1,
      entries: {
        'learn:two-levels': { leg: 2, session: v1Session, updatedAt: '2026-10-01T00:00:00.000Z' },
      },
    }
    // Written under the old key, it is simply not there.
    storage.setItem('branch-tracing.nav-v1', JSON.stringify(v1))
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'empty', entry: null })
    // Written under the new key, it does not parse.
    storage.setItem(NAV_STORAGE_KEY, JSON.stringify(v1))
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'unreadable', entry: null })
    expect(savedNavKeys(storage)).toEqual([])
    expect(readOrientationProgress(storage)).toEqual(NO_PROGRESS)
    // Nor does the same record merely relabelled as version 2.
    storage.setItem(
      NAV_STORAGE_KEY,
      JSON.stringify({ ...v1, version: 2, orientation: NO_PROGRESS }),
    )
    expect(readNavEntry('learn:two-levels', storage).status).toBe('unreadable')
    // The next write replaces it with a version 2 record; the old key is never touched.
    const trip = underway()
    expect(writeNavEntry('learn:two-levels', { leg: 2, trip }, storage)).toBe(true)
    expect(stored(storage)).toEqual({
      version: 2,
      entries: { 'learn:two-levels': { leg: 2, trip, updatedAt: '2026-10-09T12:00:00.000Z' } },
      orientation: NO_PROGRESS,
    })
    expect(JSON.parse(storage.getItem('branch-tracing.nav-v1')!)).toEqual(v1)
  })

  test('a field the record does not declare, at any depth, fails the strict schema', () => {
    const storage = new MemoryStorage()
    const target = targetById('r-apical-anterior')!
    const apical = traceForTarget(target.id)
    const planned: TripPlan = {
      plan: { traceId: apical.id, targetId: target.id, parts: PLAN_PARTS },
      nav: routePlan(apical, { matchOptional: false }),
    }
    const planningActions: TripAction[] = [
      { type: 'plan', action: { type: 'show-lesion' } },
      { type: 'plan', action: { type: 'show-segment' } },
      { type: 'plan', action: { type: 'views-done' } },
      { type: 'plan', action: { type: 'show-frame' } },
      { type: 'plan', action: { type: 'place-arc', sector: 2 } },
    ]
    const planning = planningActions.reduce(
      tripReducer(apical, target, planned),
      startTrip(apical, target, planned),
    )
    expect(planning.plan).toMatchObject({ stage: 'arcs', arcs: [{ placed: [2] }, {}, {}] })
    writeNavEntry('learn:two-levels', { leg: 0, trip: underway() }, storage)
    writeNavEntry('learn:nested-arcs', { leg: 1, trip: planning }, storage)
    const good = stored(storage)
    const entry = good.entries['learn:two-levels']
    const drive = entry.trip.nav
    const planEntry = good.entries['learn:nested-arcs']
    const plan = planEntry.trip.plan
    const withDrive = (change: object) => ({
      ...good,
      entries: {
        ...good.entries,
        'learn:two-levels': { ...entry, trip: { ...entry.trip, nav: { ...drive, ...change } } },
      },
    })
    const withPlan = (change: object) => ({
      ...good,
      entries: {
        ...good.entries,
        'learn:nested-arcs': {
          ...planEntry,
          trip: { ...planEntry.trip, plan: { ...plan, ...change } },
        },
      },
    })
    const variants: Record<string, unknown> = {
      'extra field on the record': { ...good, score: 3 },
      'extra field on the entry': {
        ...good,
        entries: { ...good.entries, 'learn:two-levels': { ...entry, result: 'pass' } },
      },
      'extra field on the trip': {
        ...good,
        entries: {
          ...good.entries,
          'learn:two-levels': { ...entry, trip: { ...entry.trip, grade: 'B' } },
        },
      },
      'extra field on the drive': withDrive({ hints: 2 }),
      'extra field on the display': withDrive({ orientation: { ...drive.orientation, zoom: 2 } }),
      'extra field on a log line': withDrive({
        log: drive.log.map((line: object) => ({ ...line, seconds: 40 })),
      }),
      'extra field on the plan': withPlan({ confidence: 0.9 }),
      'extra field on a drawn division': withPlan({
        arcs: plan.arcs.map((arcs: object) => ({ ...arcs, scored: true })),
      }),
      'extra field on a planning log': withPlan({
        log: { ...plan.log, lesion: { ...plan.log.lesion, seconds: 12 } },
      }),
      'extra field on the orientation progress': {
        ...good,
        orientation: { ...good.orientation, mastery: true },
      },
      'no orientation progress': { version: 2, entries: good.entries },
      'version 1': { ...good, version: 1 },
      'a trip of version 1': {
        ...good,
        entries: {
          ...good.entries,
          'learn:two-levels': { ...entry, trip: { ...entry.trip, version: 1 } },
        },
      },
      'a session where the trip was': {
        ...good,
        entries: {
          ...good.entries,
          'learn:two-levels': { leg: 0, session: drive, updatedAt: entry.updatedAt },
        },
      },
      'a stage the trip does not have': {
        ...good,
        entries: {
          ...good.entries,
          'learn:two-levels': { ...entry, trip: { ...entry.trip, stage: 'graded' } },
        },
      },
      'a phase the drive does not have': withDrive({ phase: 'graded' }),
      'a planning stage that does not exist': withPlan({ stage: 'assess' }),
      'a quarter turn that does not exist': withDrive({
        orientation: { turns: 4, reflected: false },
      }),
      'a place off the circle': withPlan({
        arcs: plan.arcs.map((arcs: object, i: number) =>
          i === 0 ? { ...arcs, placed: [8] } : arcs,
        ),
      }),
      'a word the circle does not use': withPlan({ frame: { ...plan.frame, top: 'cranial' } }),
      'a wrong-turn count below zero': withDrive({
        log: drive.log.map((line: object) => ({ ...line, wrongTurns: -1 })),
      }),
      'a pixel outside the image': withDrive({
        marks: [
          {
            mark: { slice: 372, pixel: [512, 10] },
            verdict: 'intended-lumen',
            ok: true,
            shown: false,
          },
          null,
        ],
      }),
      'not an object': [1, 2, 3],
    }
    // The unedited record reads; each edited one does not.
    storage.setItem(NAV_STORAGE_KEY, JSON.stringify(good))
    expect(readNavEntry('learn:two-levels', storage).status).toBe('saved')
    expect(readNavEntry('learn:nested-arcs', storage).entry!.trip).toEqual(planning)
    for (const [name, value] of Object.entries(variants)) {
      storage.setItem(NAV_STORAGE_KEY, JSON.stringify(value))
      expect([name, readNavEntry('learn:two-levels', storage)]).toEqual([
        name,
        { status: 'unreadable', entry: null },
      ])
    }
  })
})

describe('the record does not grow without bound', () => {
  test('more than the limit of writes keeps only the newest', () => {
    const storage = new MemoryStorage()
    const trip = fresh()
    const total = NAV_ENTRY_LIMIT + 6
    for (let i = 0; i < total; i++) {
      jest.setSystemTime(Date.UTC(2026, 9, 9, 12, i))
      expect(writeNavEntry(navKey('practice', `lesion-${i}`), { leg: 0, trip }, storage)).toBe(true)
      expect(savedNavKeys(storage)).toHaveLength(Math.min(i + 1, NAV_ENTRY_LIMIT))
    }
    const kept = savedNavKeys(storage)
    expect(kept).toHaveLength(NAV_ENTRY_LIMIT)
    expect([...kept].sort()).toEqual(
      Array.from({ length: NAV_ENTRY_LIMIT }, (_, i) => `practice:lesion-${total - 1 - i}`).sort(),
    )
    // The oldest are gone; the newest reads back whole.
    for (let i = 0; i < total - NAV_ENTRY_LIMIT; i++)
      expect(readNavEntry(`practice:lesion-${i}`, storage).entry).toBeNull()
    expect(readNavEntry(`practice:lesion-${total - 1}`, storage).entry!.trip).toEqual(trip)
    // Coming back to an old trip makes it the newest, so it is not the next to go.
    jest.setSystemTime(Date.UTC(2026, 9, 9, 13, 0))
    const oldest = `practice:lesion-${total - NAV_ENTRY_LIMIT}`
    writeNavEntry(oldest, { leg: 0, trip }, storage)
    jest.setSystemTime(Date.UTC(2026, 9, 9, 13, 1))
    writeNavEntry('practice:one-more', { leg: 0, trip }, storage)
    expect(savedNavKeys(storage)).toHaveLength(NAV_ENTRY_LIMIT)
    expect(savedNavKeys(storage)).toContain(oldest)
    expect(savedNavKeys(storage)).not.toContain(`practice:lesion-${total - NAV_ENTRY_LIMIT + 1}`)
  })
})

describe('what the learner has shown about turning the CT', () => {
  test('starts at nothing, and is shown after lesson 1 or after three first-try matches', () => {
    const storage = new MemoryStorage()
    expect(readOrientationProgress(storage)).toEqual(NO_PROGRESS)
    expect(orientationShown(NO_PROGRESS)).toBe(false)
    expect(
      orientationShown({ firstTryMatches: ORIENTATION_MATCHES - 1, lessonOneDone: false }),
    ).toBe(false)
    expect(orientationShown({ firstTryMatches: ORIENTATION_MATCHES, lessonOneDone: false })).toBe(
      true,
    )
    expect(orientationShown({ firstTryMatches: 0, lessonOneDone: true })).toBe(true)
    // A change that adds nothing writes nothing.
    expect(recordOrientationProgress({}, storage)).toBe(true)
    expect(recordOrientationProgress({ firstTryMatches: 0, lessonOneDone: false }, storage)).toBe(
      true,
    )
    expect(storage.length).toBe(0)
    // Matches add up across trips until the turn is the learner's choice.
    expect(recordOrientationProgress({ firstTryMatches: 2 }, storage)).toBe(true)
    expect(readOrientationProgress(storage)).toEqual({ firstTryMatches: 2, lessonOneDone: false })
    expect(orientationShown(readOrientationProgress(storage))).toBe(false)
    expect(recordOrientationProgress({ firstTryMatches: 1 }, storage)).toBe(true)
    expect(readOrientationProgress(storage)).toEqual({ firstTryMatches: 3, lessonOneDone: false })
    expect(orientationShown(readOrientationProgress(storage))).toBe(true)
    // Lesson 1 on its own is enough.
    const other = new MemoryStorage()
    expect(recordOrientationProgress({ lessonOneDone: true }, other)).toBe(true)
    expect(readOrientationProgress(other)).toEqual({ firstTryMatches: 0, lessonOneDone: true })
    expect(orientationShown(readOrientationProgress(other))).toBe(true)
  })

  test('never takes anything away, and stops counting at the schema’s ceiling', () => {
    const storage = new MemoryStorage()
    recordOrientationProgress({ firstTryMatches: 4, lessonOneDone: true }, storage)
    const before = storage.getItem(NAV_STORAGE_KEY)
    expect(recordOrientationProgress({ lessonOneDone: false }, storage)).toBe(true)
    expect(recordOrientationProgress({ firstTryMatches: 0 }, storage)).toBe(true)
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe(before)
    expect(readOrientationProgress(storage)).toEqual({ firstTryMatches: 4, lessonOneDone: true })
    expect(recordOrientationProgress({ firstTryMatches: 5000 }, storage)).toBe(true)
    expect(readOrientationProgress(storage)).toEqual({ firstTryMatches: 999, lessonOneDone: true })
    expect(readNavEntry('learn:two-levels', storage).status).toBe('saved')
  })

  test('writes of progress keep the entries, and writes of entries keep the progress', () => {
    const storage = new MemoryStorage()
    const trip = underway()
    writeNavEntry('learn:two-levels', { leg: 0, trip }, storage)
    expect(recordOrientationProgress({ firstTryMatches: 2 }, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage).entry).toEqual({
      leg: 0,
      trip,
      updatedAt: '2026-10-09T12:00:00.000Z',
    })
    writeNavEntry('practice:r-anterior-basal', { leg: 0, trip: fresh() }, storage)
    writeNavEntry('learn:two-levels', null, storage)
    expect(readOrientationProgress(storage)).toEqual({ firstTryMatches: 2, lessonOneDone: false })
    expect(savedNavKeys(storage)).toEqual(['practice:r-anterior-basal'])
    // The entry limit leaves the progress alone too.
    for (let i = 0; i < NAV_ENTRY_LIMIT + 2; i++) {
      jest.setSystemTime(Date.UTC(2026, 9, 9, 14, i))
      writeNavEntry(navKey('practice', `lesion-${i}`), { leg: 0, trip: fresh() }, storage)
    }
    expect(savedNavKeys(storage)).toHaveLength(NAV_ENTRY_LIMIT)
    expect(readOrientationProgress(storage)).toEqual({ firstTryMatches: 2, lessonOneDone: false })
  })

  test('an unreadable record reports no progress, and recording progress replaces it', () => {
    const storage = new MemoryStorage()
    storage.setItem(NAV_STORAGE_KEY, '{not json')
    expect(readOrientationProgress(storage)).toEqual(NO_PROGRESS)
    expect(recordOrientationProgress({ lessonOneDone: true }, storage)).toBe(true)
    expect(stored(storage)).toEqual({
      version: 2,
      entries: {},
      orientation: { firstTryMatches: 0, lessonOneDone: true },
    })
  })
})

describe('storage that is missing or refuses', () => {
  test('without storage nothing is read and nothing is written', () => {
    expect(readNavEntry('learn:two-levels', null)).toEqual({ status: 'unavailable', entry: null })
    expect(writeNavEntry('learn:two-levels', { leg: 0, trip: fresh() }, null)).toBe(false)
    expect(writeNavEntry('learn:two-levels', null, null)).toBe(false)
    expect(savedNavKeys(null)).toEqual([])
    expect(readOrientationProgress(null)).toEqual(NO_PROGRESS)
    expect(recordOrientationProgress({ lessonOneDone: true }, null)).toBe(false)
  })

  test('storage that throws on read is unavailable, and is not written to', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, trip: fresh() }, storage)
    const before = storage.getItem(NAV_STORAGE_KEY)
    storage.failReads = true
    expect(readNavEntry('learn:two-levels', storage)).toEqual({
      status: 'unavailable',
      entry: null,
    })
    expect(writeNavEntry('learn:two-levels', { leg: 1, trip: underway() }, storage)).toBe(false)
    expect(recordOrientationProgress({ lessonOneDone: true }, storage)).toBe(false)
    storage.failReads = false
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe(before)
  })

  test('storage that throws on write reports false and keeps what it had', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, trip: fresh() }, storage)
    const before = storage.getItem(NAV_STORAGE_KEY)
    storage.failWrites = true
    expect(writeNavEntry('learn:two-levels', { leg: 1, trip: underway() }, storage)).toBe(false)
    expect(recordOrientationProgress({ firstTryMatches: 1 }, storage)).toBe(false)
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe(before)
    expect(readNavEntry('learn:two-levels', storage).entry!.leg).toBe(0)
  })

  test('by default it uses the browser’s own storage', () => {
    window.localStorage.clear()
    const trip = fresh()
    expect(writeNavEntry('learn:carina-orientation', { leg: 0, trip })).toBe(true)
    expect(window.localStorage.getItem(NAV_STORAGE_KEY)).not.toBeNull()
    expect(readNavEntry('learn:carina-orientation').entry!.trip).toEqual(trip)
    expect(savedNavKeys()).toEqual(['learn:carina-orientation'])
    expect(recordOrientationProgress({ lessonOneDone: true })).toBe(true)
    expect(readOrientationProgress()).toEqual({ firstTryMatches: 0, lessonOneDone: true })
    window.localStorage.clear()
    expect(readNavEntry('learn:carina-orientation')).toEqual({ status: 'empty', entry: null })
    expect(readOrientationProgress()).toEqual(NO_PROGRESS)
  })
})
