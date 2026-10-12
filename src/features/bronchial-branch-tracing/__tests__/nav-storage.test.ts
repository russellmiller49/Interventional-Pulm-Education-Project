import { routePlan } from '../content/nav-lessons'
import { navReducer, startSession, type NavAction, type NavSession } from '../engine/nav-session'
import {
  NAV_ENTRY_LIMIT,
  NAV_STORAGE_KEY,
  navKey,
  readNavEntry,
  savedNavKeys,
  writeNavEntry,
} from '../engine/nav-storage'
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

const trace = traceById('central-right')
const plan = routePlan(trace)
const fresh = () => startSession(trace, plan)
const after = (actions: NavAction[]) => actions.reduce(navReducer(trace, plan), fresh())
/** A trip a few steps in: matched after a miss, an opening declined, driven on one fork. */
const underway = (): NavSession =>
  after([
    { type: 'check-match' },
    { type: 'turn', operation: 'flip' },
    { type: 'check-match' },
    { type: 'choose', option: 1 },
    { type: 'choose', option: 0 },
    { type: 'drive' },
    { type: 'arrive' },
  ])
const stored = (storage: Storage) => JSON.parse(storage.getItem(NAV_STORAGE_KEY)!)

beforeEach(() => jest.useFakeTimers().setSystemTime(Date.parse('2026-10-09T12:00:00.000Z')))
afterEach(() => jest.useRealTimers())

describe('where a trip was left', () => {
  test('keys name the section and the lesson or lesion', () => {
    expect(NAV_STORAGE_KEY).toBe('branch-tracing.nav-v1')
    expect(NAV_STORAGE_KEY).not.toBe(SELF_PACED_STORAGE_KEY)
    expect(NAV_ENTRY_LIMIT).toBe(24)
    expect(navKey('learn', 'two-levels')).toBe('learn:two-levels')
    expect(navKey('practice', 'r-anterior-basal')).toBe('practice:r-anterior-basal')
    expect(navKey('assess', 'l-inferior-lingula')).toBe('assess:l-inferior-lingula')
  })

  test('an entry comes back exactly as it was written, under its own key', () => {
    const storage = new MemoryStorage()
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'empty', entry: null })
    expect(savedNavKeys(storage)).toEqual([])
    const session = underway()
    expect(session).toMatchObject({ station: 1, orientation: { turns: 0, reflected: true } })
    expect(writeNavEntry('learn:two-levels', { leg: 2, session }, storage)).toBe(true)
    const read = readNavEntry('learn:two-levels', storage)
    expect(read.status).toBe('saved')
    expect(read.entry).toEqual({ leg: 2, session, updatedAt: '2026-10-09T12:00:00.000Z' })
    expect(read.entry!.session.log).toEqual(session.log)
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
      version: 1,
      entries: {
        'learn:two-levels': { leg: 2, session, updatedAt: '2026-10-09T12:00:00.000Z' },
      },
    })
  })

  test('every phase of a trip, with its marks and verdicts, survives the round trip', () => {
    const storage = new MemoryStorage()
    const marking = {
      traceId: 'central-right',
      stations: [{ checkpointIndex: 0, steps: ['match', 'identify', 'choose'] as const }],
      arrive: true,
    }
    const reduce = navReducer(trace, marking)
    const plane = (option: number) => responsePlane(trace, 0, option)!
    const actions: NavAction[] = [
      { type: 'check-match' },
      { type: 'show-match' },
      { type: 'mark', mark: { slice: 372, pixel: plane(1).pixel } },
      { type: 'mark', mark: { slice: 372, pixel: plane(0).pixel } },
      { type: 'show-mark' },
      { type: 'choose', option: 1 },
      { type: 'show-choice' },
      { type: 'drive' },
      { type: 'arrive' },
    ]
    const phases: string[] = []
    let session = startSession(trace, marking)
    for (const action of [null, ...actions]) {
      if (action) session = reduce(session, action)
      phases.push(session.phase)
      expect(writeNavEntry('practice:r-middle-medial-b', { leg: 0, session }, storage)).toBe(true)
      const read = readNavEntry('practice:r-middle-medial-b', storage)
      expect([session.phase, read.status]).toEqual([session.phase, 'saved'])
      expect(read.entry!.session).toEqual(session)
    }
    expect(phases).toEqual([
      'match',
      'match',
      'identify',
      'identify',
      'identify',
      'choose',
      'choose',
      'ready',
      'drive',
      'arrived',
    ])
    expect(session.marks.map((mark) => [mark?.verdict, mark?.shown])).toEqual([
      ['intended-lumen', false],
      ['intended-lumen', true],
    ])
  })

  test('writing a key again replaces that entry and keeps the others', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, session: fresh() }, storage)
    writeNavEntry('practice:r-anterior-basal', { leg: 0, session: fresh() }, storage)
    jest.setSystemTime(Date.parse('2026-10-09T12:05:00.000Z'))
    const later = underway()
    expect(writeNavEntry('learn:two-levels', { leg: 1, session: later }, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage).entry).toEqual({
      leg: 1,
      session: later,
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
    writeNavEntry('learn:two-levels', { leg: 0, session: fresh() }, storage)
    writeNavEntry('practice:r-anterior-basal', { leg: 0, session: underway() }, storage)
    expect(writeNavEntry('learn:two-levels', null, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'saved', entry: null })
    expect(savedNavKeys(storage)).toEqual(['practice:r-anterior-basal'])
    expect(readNavEntry('practice:r-anterior-basal', storage).entry!.session).toEqual(underway())
    // Removing a key that was never saved is not an error.
    expect(writeNavEntry('assess:l-inferior-lingula', null, storage)).toBe(true)
    expect(savedNavKeys(storage)).toEqual(['practice:r-anterior-basal'])
  })
})

describe('a record that cannot be read', () => {
  test('a value that is not JSON is reported as unreadable, and the next write replaces it', () => {
    const storage = new MemoryStorage()
    storage.setItem(NAV_STORAGE_KEY, '{not json')
    expect(readNavEntry('learn:two-levels', storage)).toEqual({ status: 'unreadable', entry: null })
    expect(savedNavKeys(storage)).toEqual([])
    // Reading never repairs or removes it.
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe('{not json')
    const session = underway()
    expect(writeNavEntry('learn:two-levels', { leg: 0, session }, storage)).toBe(true)
    expect(readNavEntry('learn:two-levels', storage)).toEqual({
      status: 'saved',
      entry: { leg: 0, session, updatedAt: '2026-10-09T12:00:00.000Z' },
    })
    expect(Object.keys(stored(storage).entries)).toEqual(['learn:two-levels'])
  })

  test('a field the record does not declare, at any depth, fails the strict schema', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, session: underway() }, storage)
    const good = stored(storage)
    const entry = good.entries['learn:two-levels']
    const variants: Record<string, unknown> = {
      'extra field on the record': { ...good, score: 3 },
      'extra field on the entry': {
        ...good,
        entries: { 'learn:two-levels': { ...entry, result: 'pass' } },
      },
      'extra field on the session': {
        ...good,
        entries: { 'learn:two-levels': { ...entry, session: { ...entry.session, hints: 2 } } },
      },
      'extra field on the display': {
        ...good,
        entries: {
          'learn:two-levels': {
            ...entry,
            session: { ...entry.session, orientation: { ...entry.session.orientation, zoom: 2 } },
          },
        },
      },
      'extra field on a log line': {
        ...good,
        entries: {
          'learn:two-levels': {
            ...entry,
            session: {
              ...entry.session,
              log: entry.session.log.map((line: object) => ({ ...line, seconds: 40 })),
            },
          },
        },
      },
      'another version': { ...good, version: 2 },
      'a phase the trip does not have': {
        ...good,
        entries: {
          'learn:two-levels': { ...entry, session: { ...entry.session, phase: 'graded' } },
        },
      },
      'a quarter turn that does not exist': {
        ...good,
        entries: {
          'learn:two-levels': {
            ...entry,
            session: { ...entry.session, orientation: { turns: 4, reflected: false } },
          },
        },
      },
      'a pixel outside the image': {
        ...good,
        entries: {
          'learn:two-levels': {
            ...entry,
            session: {
              ...entry.session,
              marks: [
                {
                  mark: { slice: 372, pixel: [512, 10] },
                  verdict: 'intended-lumen',
                  ok: true,
                  shown: false,
                },
                null,
              ],
            },
          },
        },
      },
      'not an object': [1, 2, 3],
    }
    // The unedited record reads; each edited one does not.
    storage.setItem(NAV_STORAGE_KEY, JSON.stringify(good))
    expect(readNavEntry('learn:two-levels', storage).status).toBe('saved')
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
    const session = fresh()
    const total = NAV_ENTRY_LIMIT + 6
    for (let i = 0; i < total; i++) {
      jest.setSystemTime(Date.UTC(2026, 9, 9, 12, i))
      expect(writeNavEntry(navKey('practice', `lesion-${i}`), { leg: 0, session }, storage)).toBe(
        true,
      )
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
    expect(readNavEntry(`practice:lesion-${total - 1}`, storage).entry!.session).toEqual(session)
    // Coming back to an old trip makes it the newest, so it is not the next to go.
    jest.setSystemTime(Date.UTC(2026, 9, 9, 13, 0))
    const oldest = `practice:lesion-${total - NAV_ENTRY_LIMIT}`
    writeNavEntry(oldest, { leg: 0, session }, storage)
    jest.setSystemTime(Date.UTC(2026, 9, 9, 13, 1))
    writeNavEntry('practice:one-more', { leg: 0, session }, storage)
    expect(savedNavKeys(storage)).toHaveLength(NAV_ENTRY_LIMIT)
    expect(savedNavKeys(storage)).toContain(oldest)
    expect(savedNavKeys(storage)).not.toContain(`practice:lesion-${total - NAV_ENTRY_LIMIT + 1}`)
  })
})

describe('storage that is missing or refuses', () => {
  test('without storage nothing is read and nothing is written', () => {
    expect(readNavEntry('learn:two-levels', null)).toEqual({ status: 'unavailable', entry: null })
    expect(writeNavEntry('learn:two-levels', { leg: 0, session: fresh() }, null)).toBe(false)
    expect(writeNavEntry('learn:two-levels', null, null)).toBe(false)
    expect(savedNavKeys(null)).toEqual([])
  })

  test('storage that throws on read is unavailable, and is not written to', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, session: fresh() }, storage)
    const before = storage.getItem(NAV_STORAGE_KEY)
    storage.failReads = true
    expect(readNavEntry('learn:two-levels', storage)).toEqual({
      status: 'unavailable',
      entry: null,
    })
    expect(writeNavEntry('learn:two-levels', { leg: 1, session: underway() }, storage)).toBe(false)
    storage.failReads = false
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe(before)
  })

  test('storage that throws on write reports false and keeps what it had', () => {
    const storage = new MemoryStorage()
    writeNavEntry('learn:two-levels', { leg: 0, session: fresh() }, storage)
    const before = storage.getItem(NAV_STORAGE_KEY)
    storage.failWrites = true
    expect(writeNavEntry('learn:two-levels', { leg: 1, session: underway() }, storage)).toBe(false)
    expect(storage.getItem(NAV_STORAGE_KEY)).toBe(before)
    expect(readNavEntry('learn:two-levels', storage).entry!.leg).toBe(0)
  })

  test('by default it uses the browser’s own storage', () => {
    window.localStorage.clear()
    const session = fresh()
    expect(writeNavEntry('learn:carina-orientation', { leg: 0, session })).toBe(true)
    expect(window.localStorage.getItem(NAV_STORAGE_KEY)).not.toBeNull()
    expect(readNavEntry('learn:carina-orientation').entry!.session).toEqual(session)
    expect(savedNavKeys()).toEqual(['learn:carina-orientation'])
    window.localStorage.clear()
    expect(readNavEntry('learn:carina-orientation')).toEqual({ status: 'empty', entry: null })
  })
})
