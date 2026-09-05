/**
 * The one table, run against the engine.
 *
 * Every row carries the claim behind it as a setup, a change and a set of directions. Each is
 * run through the real reducer from the device's default state, so a row cannot say a direction
 * the simulation does not produce. The copy carries no magnitudes; the claims here carry the
 * smallest change that counts, so a row that has gone quiet is caught too.
 */
import { createInitialMcsState, mcsReducer } from '../engine'
import type { McsDerivedMetrics, McsSimulationState } from '../engine/types'
import { mcsSectionSpecs } from '../content/sectionSpecs'
import {
  MCS_SUPPORT_GRAMMAR,
  mcsGrammarRowIds,
  mcsGrammarRowsFor,
  validateMcsSupportGrammar,
  type McsGrammarEngineClaim,
} from '../content/supportGrammar'

function settle(state: McsSimulationState, seconds = 5): McsSimulationState {
  let next = state
  for (let index = 0; index < seconds * 4; index += 1) {
    next = mcsReducer(next, { type: 'TICK', seconds: 0.25 })
  }
  return next
}

function runClaim(claim: McsGrammarEngineClaim): {
  before: McsSimulationState
  after: McsSimulationState
} {
  let state = createInitialMcsState('learn', claim.device)
  for (const action of claim.setup) state = mcsReducer(state, action)
  const before = settle(state)
  let changed = before
  for (const action of claim.change) changed = mcsReducer(changed, action)
  return { before, after: settle(changed) }
}

function metric(metrics: McsDerivedMetrics, key: keyof McsDerivedMetrics): number {
  const value = metrics[key]
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return Number.NaN
}

const claims = MCS_SUPPORT_GRAMMAR.rows.flatMap((row) =>
  row.engineClaims.map((claim) => [`${row.id}: ${claim.label}`, claim] as const),
)

describe('the one table', () => {
  it('is a valid registry with every declared row present', () => {
    expect(validateMcsSupportGrammar()).toEqual([])
    expect(MCS_SUPPORT_GRAMMAR.rows.map((row) => row.id)).toEqual([...mcsGrammarRowIds])
  })

  it('is highlighted by at least one section per row, and only by sections that exist', () => {
    const sectionIds = new Set(mcsSectionSpecs.map((spec) => spec.sectionId))
    for (const row of MCS_SUPPORT_GRAMMAR.rows) {
      expect(row.taughtIn.length).toBeGreaterThan(0)
      for (const id of row.taughtIn) expect(sectionIds.has(id)).toBe(true)
      for (const id of row.taughtIn) {
        expect(mcsGrammarRowsFor(id).map((candidate) => candidate.id)).toContain(row.id)
      }
    }
  })

  it.each(claims)('%s holds in the engine', (_label, claim) => {
    const { before, after } = runClaim(claim)
    for (const expectation of claim.expect) {
      const delta =
        metric(after.metrics, expectation.metric) - metric(before.metrics, expectation.metric)
      const by = expectation.by ?? 0
      if (expectation.direction === 'up') {
        expect({ metric: expectation.metric, delta }).toEqual(
          expect.objectContaining({ delta: expect.any(Number) }),
        )
        expect(delta).toBeGreaterThanOrEqual(by)
      } else if (expectation.direction === 'down') {
        expect(delta).toBeLessThanOrEqual(-by)
      } else {
        expect(Math.abs(delta)).toBeLessThanOrEqual(by)
      }
    }
    for (const alarmId of claim.alarmsActive ?? []) {
      expect(after.alarms.some((alarm) => alarm.id === alarmId && alarm.active)).toBe(true)
    }
    for (const alarmId of claim.alarmsInactive ?? []) {
      expect(after.alarms.some((alarm) => alarm.id === alarmId && alarm.active)).toBe(false)
    }
  })

  it('says a stiffer circulation lowers both pumps’ displayed flow while the pressure rises, in both engines', () => {
    const row = MCS_SUPPORT_GRAMMAR.rows.find(
      (candidate) => candidate.id === 'downstream-afterload',
    )!
    for (const claim of row.engineClaims) {
      const { before, after } = runClaim(claim)
      expect(after.metrics.mapMmHg).toBeGreaterThan(before.metrics.mapMmHg)
      expect(after.metrics.effectiveSystemicFlowLMin).toBeLessThan(
        before.metrics.effectiveSystemicFlowLMin,
      )
    }
  })

  it('never adds the right-sided pump to the systemic device signal', () => {
    const row = MCS_SUPPORT_GRAMMAR.rows.find((candidate) => candidate.id === 'serial-not-a-sum')!
    const { after } = runClaim(row.engineClaims[0])
    expect(after.metrics.rightDeviceFlowLMin).toBeGreaterThan(1)
    expect(after.metrics.deviceFlowLMin).toBeCloseTo(after.metrics.leftDeviceFlowLMin, 5)
    expect(after.metrics.effectiveSystemicFlowLMin).toBeLessThan(
      after.metrics.leftDeviceFlowLMin +
        after.metrics.rightDeviceFlowLMin +
        after.metrics.nativeFlowLMin,
    )
  })

  it('carries no number in the copy the learner reads', () => {
    for (const row of MCS_SUPPORT_GRAMMAR.rows) {
      expect(row.whatMoved).not.toMatch(/\d/)
      expect(row.whereTheConstraintLives).not.toMatch(/\d/)
      for (const item of row.shortlist) expect(item).not.toMatch(/\d/)
    }
    expect(MCS_SUPPORT_GRAMMAR.trendRule).not.toMatch(/\d/)
  })

  it('refuses a row with no engine claim and a row nobody teaches', () => {
    const rows = MCS_SUPPORT_GRAMMAR.rows.map((row) => ({ ...row }))
    rows[0] = { ...rows[0], engineClaims: [] }
    rows[1] = { ...rows[1], taughtIn: [] }
    const errors = validateMcsSupportGrammar({ ...MCS_SUPPORT_GRAMMAR, rows })
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('carries no engine claim'),
        expect.stringContaining('no section highlights this row'),
      ]),
    )
  })
})
