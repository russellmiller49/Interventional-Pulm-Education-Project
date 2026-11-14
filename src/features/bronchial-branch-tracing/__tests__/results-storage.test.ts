import {
  RESULTS_STORAGE_KEY,
  everyStepFirst,
  readResults,
  recordResult,
  resultOf,
} from '../engine/results-storage'
import { replayMarks, replayRows } from '../engine/route-replay'
import { routePlan } from '../content/nav-lessons'
import { targetById, traceForTarget } from '../content/targets'
import { mappedForks } from '../engine/arc-map'
import {
  navReducer,
  routeOption,
  startSession,
  summarize,
  type NavAction,
} from '../engine/nav-session'
import { astrayPath } from '../geometry/astray'

class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  failWrites = false
  get length() {
    return this.items.size
  }
  clear() {
    this.items.clear()
  }
  getItem(key: string) {
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

const step = (misses = 0, shown = false, asked = true) => ({ asked, misses, shown })
const clean = {
  plan: { lesion: step(), segment: step(), frame: step(), arcs: { asked: 3, firstTry: 3 } },
  drive: { choose: { asked: 4, firstTry: 4 }, wrongTurns: 0, backedOut: 0 },
}

/** What happened the last time each whole lesion was reached, on this device only. */
describe('the record of lesions reached', () => {
  test('nothing kept, or no storage, reads as nothing reached', () => {
    expect(readResults(new MemoryStorage())).toEqual({ status: 'empty', results: {} })
    expect(readResults(null)).toEqual({ status: 'unavailable', results: {} })
    expect(recordResult('practice:x', clean, null)).toBe(false)
  })

  test('a reached lesion is kept under the module’s own key, and a second run counts', () => {
    const storage = new MemoryStorage()
    expect(recordResult('practice:r-anterior-basal', clean, storage)).toBe(true)
    expect(storage.length).toBe(1)
    expect(storage.key(0)).toBe(RESULTS_STORAGE_KEY)
    const first = readResults(storage).results['practice:r-anterior-basal']
    expect(first).toMatchObject({ ...clean, runs: 1 })
    expect(Number.isNaN(Date.parse(first.reachedAt))).toBe(false)
    const rough = { ...clean, drive: { ...clean.drive, wrongTurns: 1, backedOut: 1 } }
    expect(recordResult('practice:r-anterior-basal', rough, storage)).toBe(true)
    expect(recordResult('assess:r-anterior-basal', clean, storage)).toBe(true)
    const { status, results } = readResults(storage)
    expect(status).toBe('saved')
    // The latest run replaces the one before it; the closing set keeps its own line.
    expect(results['practice:r-anterior-basal']).toMatchObject({ ...rough, runs: 2 })
    expect(results['assess:r-anterior-basal']).toMatchObject({ ...clean, runs: 1 })
  })

  test('a record that does not parse is reported and left as it is', () => {
    const storage = new MemoryStorage()
    for (const raw of [
      '{not json',
      '{"version":2,"results":{}}',
      '{"version":1,"results":{"a":{}}}',
    ]) {
      storage.setItem(RESULTS_STORAGE_KEY, raw)
      expect(readResults(storage)).toEqual({ status: 'unreadable', results: {} })
      expect(recordResult('practice:x', clean, storage)).toBe(false)
      expect(storage.getItem(RESULTS_STORAGE_KEY)).toBe(raw)
    }
  })

  test('a write the device refuses is reported, not thrown', () => {
    const storage = new MemoryStorage()
    storage.failWrites = true
    expect(recordResult('practice:x', clean, storage)).toBe(false)
  })

  test('every step first: nothing missed, nothing shown, no branch that led away', () => {
    expect(everyStepFirst(clean)).toBe(true)
    expect(everyStepFirst({ plan: null, drive: null })).toBe(true)
    // A step that was not asked does not count against it.
    expect(
      everyStepFirst({ ...clean, plan: { ...clean.plan, frame: step(0, false, false) } }),
    ).toBe(true)
    expect(everyStepFirst({ ...clean, plan: { ...clean.plan, segment: step(1) } })).toBe(false)
    expect(everyStepFirst({ ...clean, plan: { ...clean.plan, lesion: step(0, true) } })).toBe(false)
    expect(
      everyStepFirst({ ...clean, plan: { ...clean.plan, arcs: { asked: 3, firstTry: 2 } } }),
    ).toBe(false)
    expect(
      everyStepFirst({ ...clean, drive: { ...clean.drive, choose: { asked: 4, firstTry: 3 } } }),
    ).toBe(false)
    expect(everyStepFirst({ ...clean, drive: { ...clean.drive, wrongTurns: 1 } })).toBe(false)
  })
})

/** The drive read back at arrival, from the same log the closing counts come from. */
describe('the route read back', () => {
  const target = targetById('r-apical-anterior')!
  const trace = traceForTarget(target.id)
  const plan = routePlan(trace, { matchOptional: true, cruise: true })
  const forks = mappedForks(trace, target)
  const reduce = navReducer(trace, plan)
  const run = (actions: NavAction[]) => actions.reduce(reduce, startSession(trace, plan))

  /** Drives the whole route; at `astrayAt` (a station) the other opening is entered first. */
  function drive(astrayAt: number | null, shownAt: number | null = null) {
    let session = startSession(trace, plan)
    const act = (action: NavAction) => {
      session = reduce(session, action)
    }
    for (let guard = 0; guard < 200 && session.phase !== 'arrived'; guard++) {
      if (session.phase === 'drive') act({ type: 'arrive' })
      else if (session.phase === 'ready') act({ type: 'drive' })
      else if (session.phase === 'choose') {
        const ci = plan.stations[session.station].checkpointIndex
        const route = routeOption(trace, ci)
        if (session.station === shownAt) act({ type: 'show-choice' })
        else if (session.station === astrayAt && !session.declined.length) {
          act({ type: 'choose', option: 1 - route })
          // The reducer has moved the session on; the narrowed type above no longer holds.
          if ((session.phase as string) === 'astray-in') {
            act({ type: 'astray-arrive' })
            act({ type: 'back-out' })
            act({ type: 'astray-return' })
          }
        } else act({ type: 'choose', option: route })
      } else throw new Error(`unexpected phase ${session.phase}`)
    }
    return session
  }
  const firstStop = plan.stations.findIndex((station) => !station.cruise)

  test('nothing is read back before the scope has chosen anywhere', () => {
    expect(replayRows(plan, run([]), forks)).toEqual([])
  })

  test('a clean drive reads back every fork chosen at, each as a first choice', () => {
    const session = drive(null)
    expect(session.phase).toBe('arrived')
    const rows = replayRows(plan, session, forks)
    expect(rows).toHaveLength(plan.stations.length - firstStop)
    expect(rows.every((row) => row.result === 'first' && !row.away.length && !row.refused)).toBe(
      true,
    )
    // The forks the scope flew through are not read back: nothing was asked there.
    expect(rows[0].station).toBe(firstStop)
    // The first stop gives off the segmental bronchus, above the map; the rest are its divisions.
    expect(rows.map((row) => row.division)).toEqual([null, ...forks.map((_, i) => i)])
    expect(replayMarks(rows, forks.length)).toEqual(forks.map(() => 'first'))
    expect(summarize(session).choose).toEqual({ asked: rows.length, firstTry: rows.length })
  })

  test('a branch that led away is read back at its fork, with the opening that was entered', () => {
    const at = firstStop + 1
    const ci = plan.stations[at].checkpointIndex
    const other = 1 - routeOption(trace, ci)
    const session = drive(at)
    const row = replayRows(plan, session, forks).find((r) => r.station === at)!
    expect(row.result).toBe('later')
    if (astrayPath(trace, ci, other)) {
      expect(row.away).toEqual([other])
      expect(row.refused).toBe(0)
      expect(session.log[at].away).toEqual([other])
    } else {
      expect(row.away).toEqual([])
      expect(row.refused).toBe(1)
    }
    expect(replayMarks(replayRows(plan, session, forks), forks.length)[row.division!]).toBe('later')
  })

  test('an opening the bench showed is read back as shown', () => {
    const at = firstStop + 2
    const rows = replayRows(plan, drive(null, at), forks)
    expect(rows.find((row) => row.station === at)!.result).toBe('shown')
  })

  test('the summaries are copied into the record, not shared with the session', () => {
    const session = drive(firstStop + 1)
    const summary = summarize(session)
    const kept = resultOf(null, summary)
    expect(kept.plan).toBeNull()
    expect(kept.drive).toEqual({
      choose: summary.choose,
      wrongTurns: summary.wrongTurns,
      backedOut: summary.backedOut,
    })
    expect(kept.drive!.choose).not.toBe(summary.choose)
  })
})
