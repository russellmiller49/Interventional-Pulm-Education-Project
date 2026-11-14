import { mgOf, mlOf, maxMg, ledgerState } from '../engine/lidocaineLedger'
import {
  EMPTY_SCOPE_HISTORY,
  scopeGoalHint,
  scopeGoalMet,
  scopeGoalsMet,
  withScopeEntry,
  type ScopeGoal,
  type ScopeHistory,
} from '../engine/scopeGoals'
import { drillReducer, initialDrillState, currentDrillTarget } from '../engine/branchDrill'
import { passageToTarget, drillTierOf, DOLPHIN_DRILL_SETS } from '../content/branchDrillSets'
import {
  createEmptyDolphinProgress,
  parseDolphinProgress,
  withLocation,
  withReviewLater,
  withSectionReviewed,
} from '../engine/selfPacedProgress'
import { recommendedDolphinSection } from '../content/pathwayResolver'
import { dolphinSectionIds } from '../content/pathway'

const drive = (...abbrs: (string | [string, 'open' | 'closed'])[]): ScopeHistory =>
  abbrs.reduce<ScopeHistory>(
    (history, step) =>
      typeof step === 'string'
        ? withScopeEntry(history, step, null)
        : withScopeEntry(history, step[0], step[1]),
    EMPTY_SCOPE_HISTORY,
  )

describe('lidocaine ledger arithmetic', () => {
  it('works the NMMP example: 181 kg at 4 mg/kg is 724 mg, 72.4 mL of 1% or 36.2 mL of 2%', () => {
    expect(maxMg(181, 4)).toBe(724)
    expect(mlOf(724, 1)).toBe(72.4)
    expect(mlOf(724, 2)).toBe(36.2)
  })
  it('counts every route against the one maximum', () => {
    expect(mgOf(10, 1)).toBe(100)
    const state = ledgerState(181, 4, [
      { volumeMl: 10, percent: 1 },
      { volumeMl: 5, percent: 1 },
    ])
    expect(state).toEqual({ maxMg: 724, givenMg: 150, remainingMg: 574, over: false })
    expect(mlOf(state.remainingMg, 2)).toBe(28.7)
    expect(ledgerState(100, 4, [{ volumeMl: 25, percent: 2 }]).over).toBe(true)
  })
})

describe('scope goals', () => {
  const toSpout: ScopeGoal = { kind: 'reach-in-order', abbrs: ['LNP', 'NPX', 'LS'], label: '' }
  const fornix: ScopeGoal = { kind: 'avoid', abbr: 'NPF', label: '', hint: 'fornix' }
  const hold: ScopeGoal = {
    kind: 'hold-at',
    abbr: 'NPX',
    thenAbbr: 'LS',
    untilCue: 'glottis-open',
    label: '',
    hint: 'closed',
  }

  it('meets an ordered reach only in order, and an avoid only once backed out', () => {
    expect(scopeGoalMet(toSpout, drive('LNP', 'LS', 'NPX'))).toBe(false)
    expect(scopeGoalMet(toSpout, drive('LNP', 'NPX', 'NPF', 'NPX', 'LS'))).toBe(true)
    expect(scopeGoalHint([toSpout, fornix], drive('LNP', 'NPX', 'NPF'))).toBe('fornix')
    expect(scopeGoalsMet([toSpout, fornix], drive('LNP', 'NPX', 'LS'))).toBe(true)
    expect(scopeGoalsMet([fornix], drive('LNP'))).toBe(false)
  })

  it('meets a hold only when the glottis is entered on an open cue', () => {
    expect(scopeGoalMet(hold, drive('LNP', ['NPX', 'closed'], ['LS', 'closed']))).toBe(false)
    expect(scopeGoalHint([hold], drive('LNP', ['NPX', 'closed'], ['LS', 'closed']))).toBe('closed')
    expect(
      scopeGoalMet(
        hold,
        drive(['NPX', 'closed'], ['LS', 'closed'], ['NPX', 'open'], ['LS', 'open']),
      ),
    ).toBe(true)
  })
})

describe('the find-the-branch drill', () => {
  const reducer = drillReducer(passageToTarget)

  it('arrives by driving, hints on a turn off the passage, and never counts', () => {
    let state = initialDrillState(['RB4', 'LB3'])
    state = reducer(state, { type: 'LOCATION', abbr: 'TRA', pathAbbrs: [] })
    expect(state.hint).toBeNull()
    state = reducer(state, { type: 'LOCATION', abbr: 'LMB', pathAbbrs: [] })
    expect(state.hint).toMatch(/You turned into LMB, off the way to RB4/)
    state = reducer(state, { type: 'LOCATION', abbr: 'RB4', pathAbbrs: [] })
    expect(currentDrillTarget(state)).toBe('LB3')
    state = reducer(state, { type: 'SKIP' })
    expect(state.done).toBe(true)
    expect(state.arrived).toEqual(['RB4'])
    expect(Object.keys(state).join(' ')).not.toMatch(/score|points|stars|best|time/i)
  })

  it('tiers every label except the fornix', () => {
    expect(drillTierOf('NPF')).toBeNull()
    expect(drillTierOf('LS')).toBe('passage')
    expect(drillTierOf('RT2')).toBe('landmark')
    expect(drillTierOf('LB5')).toBe('near-branch')
    expect(drillTierOf('RB13')).toBe('far-branch')
    for (const set of DOLPHIN_DRILL_SETS)
      for (const t of set.targets) expect(drillTierOf(t)).not.toBeNull()
  })
})

describe('the self-paced record', () => {
  it('stores places and reviewed marks only, and parses back', () => {
    let progress = createEmptyDolphinProgress()
    progress = withLocation(progress, { kind: 'section', id: 'lavage' }, 't1')
    progress = withLocation(progress, { kind: 'frame-drill', id: 'where-is-the-tip' }, 't2')
    progress = withSectionReviewed(progress, 'lavage', 't3')
    progress = withReviewLater(progress, 'lavage', true, 't4')
    const serialized = JSON.stringify(progress)
    expect(serialized).not.toMatch(/choice|correct|attempt|answer|arrived|score/i)
    expect(parseDolphinProgress(serialized)).toEqual(progress)
    expect(parseDolphinProgress('{"version":2}')).toBeNull()
  })

  it('recommends the first section, then the unfinished one the learner left', () => {
    const empty = createEmptyDolphinProgress()
    expect(recommendedDolphinSection(empty)?.section.id).toBe(dolphinSectionIds[0])
    const left = withLocation(empty, { kind: 'section', id: 'lavage' }, 't')
    expect(recommendedDolphinSection(left)).toMatchObject({
      resumed: true,
      section: { id: 'lavage' },
    })
  })
})
