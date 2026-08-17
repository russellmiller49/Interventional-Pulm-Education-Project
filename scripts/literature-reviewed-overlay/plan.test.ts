/** @jest-environment node */

import { collectCohort } from './projection'
import { buildFixtureTruth } from './rehearsal-fixtures'
import { buildReviewedSet, type ReviewedSet } from './reviewed-set'
import {
  acknowledgementMatches,
  assertRecordBatchLimit,
  buildBatchRequest,
  buildOverlayPlan,
  checkpointBatchesForPlan,
} from './plan'

const REVIEWED_AT = '2026-08-17T00:00:00.000Z'

function fixtureSet(): ReviewedSet {
  const truth = buildFixtureTruth()
  return buildReviewedSet(collectCohort(truth.cohortPayloads), truth.artifact)
}

describe('overlay planning', () => {
  const set = fixtureSet()

  it('tiles 630 records into bounded batches with one final batch', () => {
    const plan = buildOverlayPlan(set, REVIEWED_AT, 90)
    expect(plan.batches).toHaveLength(7)
    expect(plan.batches.at(-1)?.finalBatch).toBe(true)
    expect(plan.batches.filter((batch) => batch.finalBatch)).toHaveLength(1)
    expect(plan.batches[0]).toMatchObject({ startOrdinal: 1, endOrdinal: 90, recordCount: 90 })
    expect(plan.batches.at(-1)).toMatchObject({ startOrdinal: 541, endOrdinal: 630 })
  })

  it('refuses out-of-bounds batch limits', () => {
    for (const bad of [0, -1, 251, 1.5, Number.NaN]) {
      expect(() => assertRecordBatchLimit(bad)).toThrow(/between 1 and 250/u)
    }
  })

  it('builds byte-identical requests for the same inputs', () => {
    const plan = buildOverlayPlan(set, REVIEWED_AT, 90)
    const first = buildBatchRequest(set, REVIEWED_AT, plan.batches[2]!)
    const second = buildBatchRequest(set, REVIEWED_AT, plan.batches[2]!)
    expect(first.checksum).toBe(second.checksum)
    expect(first.body).toBe(second.body)
    const differentTimestamp = buildBatchRequest(set, '2026-08-17T00:00:01.000Z', plan.batches[2]!)
    expect(differentTimestamp.checksum).not.toBe(first.checksum)
  })

  it('refuses a descriptor that does not tile the set or mislabels the final batch', () => {
    expect(() =>
      buildBatchRequest(set, REVIEWED_AT, {
        index: 0,
        startOrdinal: 1,
        endOrdinal: 90,
        recordCount: 89,
        finalBatch: false,
      }),
    ).toThrow(/does not tile/u)
    expect(() =>
      buildBatchRequest(set, REVIEWED_AT, {
        index: 0,
        startOrdinal: 1,
        endOrdinal: 90,
        recordCount: 90,
        finalBatch: true,
      }),
    ).toThrow(/mislabels the final batch/u)
  })

  it('derives checkpoint batches whose checksums match rebuilt requests', () => {
    const plan = buildOverlayPlan(set, REVIEWED_AT, 250)
    const batches = checkpointBatchesForPlan(set, plan)
    expect(batches).toHaveLength(3)
    for (const batch of batches) {
      const rebuilt = buildBatchRequest(set, REVIEWED_AT, {
        index: batch.index,
        startOrdinal: batch.startOrdinal,
        endOrdinal: batch.endOrdinal,
        recordCount: batch.recordCount,
        finalBatch: batch.finalBatch,
      })
      expect(rebuilt.checksum).toBe(batch.requestChecksum)
      expect(batch.stage.state).toBe('prepared')
    }
  })
})

describe('acknowledgementMatches', () => {
  const expectation = {
    operationId: 'op',
    recordCount: 3,
    finalBatch: false,
    mode: 'in_progress' as const,
  }
  const valid = {
    operationId: 'op',
    recordCount: 3,
    applied: 2,
    alreadyApplied: 1,
    dispositions: ['applied', 'applied', 'already_applied'],
    operationStatus: 'started',
  }

  it('accepts an exact acknowledgement in its context', () => {
    expect(acknowledgementMatches(expectation, valid)).toEqual({
      matches: true,
      applied: 2,
      alreadyApplied: 1,
    })
  })

  it.each([
    ['not an object', 'nope', 'acknowledgement_not_object'],
    ['wrong operation', { ...valid, operationId: 'other' }, 'acknowledgement_operation_mismatch'],
    ['wrong count', { ...valid, recordCount: 4 }, 'acknowledgement_record_count_mismatch'],
    ['invalid effects', { ...valid, applied: 3 }, 'acknowledgement_effect_counts_invalid'],
    [
      'short dispositions',
      { ...valid, dispositions: ['applied', 'applied'] },
      'acknowledgement_dispositions_invalid',
    ],
    [
      'unknown disposition',
      { ...valid, dispositions: ['applied', 'applied', 'skipped'] },
      'acknowledgement_disposition_unknown',
    ],
    [
      'totals mismatch',
      { ...valid, dispositions: ['applied', 'already_applied', 'already_applied'] },
      'acknowledgement_disposition_totals_mismatch',
    ],
    [
      'bad status',
      { ...valid, operationStatus: 'done' },
      'acknowledgement_operation_status_invalid',
    ],
  ])('rejects %s as ambiguous', (_label, body, reason) => {
    expect(acknowledgementMatches(expectation, body)).toEqual({ matches: false, reason })
  })

  it('binds the operation status to the batch context, not a generic either-or', () => {
    // A non-final in-progress batch must not be acknowledged as completed…
    expect(acknowledgementMatches(expectation, { ...valid, operationStatus: 'completed' })).toEqual(
      { matches: false, reason: 'acknowledgement_operation_status_invalid' },
    )
    // …and the final in-progress batch must not remain started.
    expect(
      acknowledgementMatches(
        { ...expectation, finalBatch: true },
        { ...valid, operationStatus: 'started' },
      ),
    ).toEqual({ matches: false, reason: 'acknowledgement_operation_status_invalid' })
    expect(
      acknowledgementMatches(
        { ...expectation, finalBatch: true },
        { ...valid, operationStatus: 'completed' },
      ),
    ).toMatchObject({ matches: true })
  })

  it('requires a completed-operation replay to apply nothing and stay completed', () => {
    const replayExpectation = { ...expectation, mode: 'replay_completed' as const }
    expect(
      acknowledgementMatches(replayExpectation, { ...valid, operationStatus: 'completed' }),
    ).toEqual({ matches: false, reason: 'acknowledgement_replay_applied_fresh_records' })
    const pureReplay = {
      ...valid,
      applied: 0,
      alreadyApplied: 3,
      dispositions: ['already_applied', 'already_applied', 'already_applied'],
      operationStatus: 'completed',
    }
    expect(acknowledgementMatches(replayExpectation, pureReplay)).toEqual({
      matches: true,
      applied: 0,
      alreadyApplied: 3,
    })
    expect(
      acknowledgementMatches(replayExpectation, { ...pureReplay, operationStatus: 'started' }),
    ).toEqual({ matches: false, reason: 'acknowledgement_replay_status_invalid' })
  })
})
