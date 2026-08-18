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
    const plan = buildOverlayPlan(set, REVIEWED_AT, 90, 'fresh')
    expect(plan.batches).toHaveLength(7)
    expect(plan.batches.at(-1)?.finalBatch).toBe(true)
    expect(plan.batches.filter((batch) => batch.finalBatch)).toHaveLength(1)
    expect(plan.batches[0]).toMatchObject({ startOrdinal: 1, endOrdinal: 90, recordCount: 90 })
    expect(plan.batches.at(-1)).toMatchObject({ startOrdinal: 541, endOrdinal: 630 })
  })

  it('refuses out-of-bounds batch limits and unknown request modes', () => {
    for (const bad of [0, -1, 251, 1.5, Number.NaN]) {
      expect(() => assertRecordBatchLimit(bad)).toThrow(/between 1 and 250/u)
    }
    for (const badMode of ['replayed', 'FRESH', '', null, undefined, 7]) {
      expect(() => buildOverlayPlan(set, REVIEWED_AT, 90, badMode as unknown as 'fresh')).toThrow(
        /exactly fresh or replay/u,
      )
    }
  })

  it('carries the causal mode into every descriptor and the request body', () => {
    const freshPlan = buildOverlayPlan(set, REVIEWED_AT, 250, 'fresh')
    const replayPlan = buildOverlayPlan(set, REVIEWED_AT, 250, 'replay')
    expect(freshPlan.batches.every((batch) => batch.requestMode === 'fresh')).toBe(true)
    expect(replayPlan.batches.every((batch) => batch.requestMode === 'replay')).toBe(true)

    const freshRequest = buildBatchRequest(set, REVIEWED_AT, freshPlan.batches[0]!)
    const replayRequest = buildBatchRequest(set, REVIEWED_AT, replayPlan.batches[0]!)
    expect(Object.keys(JSON.parse(freshRequest.body) as Record<string, unknown>)).toEqual([
      'p_operation',
      'p_records',
    ])
    expect(JSON.parse(freshRequest.body)).toMatchObject({
      p_operation: { causalMode: 'fresh' },
    })
    expect(JSON.parse(replayRequest.body)).toMatchObject({
      p_operation: { causalMode: 'replay' },
    })
    // The mode is part of the request identity: the same batch in the other causal context is
    // a different request with a different checksum.
    expect(freshRequest.checksum).not.toBe(replayRequest.checksum)
  })

  it('builds byte-identical requests for the same inputs', () => {
    const plan = buildOverlayPlan(set, REVIEWED_AT, 90, 'fresh')
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
        requestMode: 'fresh',
      }),
    ).toThrow(/does not tile/u)
    expect(() =>
      buildBatchRequest(set, REVIEWED_AT, {
        index: 0,
        startOrdinal: 1,
        endOrdinal: 90,
        recordCount: 90,
        finalBatch: true,
        requestMode: 'fresh',
      }),
    ).toThrow(/mislabels the final batch/u)
  })

  it('derives checkpoint batches whose checksums match rebuilt requests', () => {
    const plan = buildOverlayPlan(set, REVIEWED_AT, 250, 'fresh')
    const batches = checkpointBatchesForPlan(set, plan)
    expect(batches).toHaveLength(3)
    for (const batch of batches) {
      const rebuilt = buildBatchRequest(set, REVIEWED_AT, {
        index: batch.index,
        startOrdinal: batch.startOrdinal,
        endOrdinal: batch.endOrdinal,
        recordCount: batch.recordCount,
        finalBatch: batch.finalBatch,
        requestMode: batch.requestMode,
      })
      expect(rebuilt.checksum).toBe(batch.requestChecksum)
      expect(batch.stage.state).toBe('prepared')
      expect(batch.requestMode).toBe('fresh')
    }
  })
})

describe('acknowledgementMatches', () => {
  const expectation = {
    operationId: 'op',
    recordCount: 3,
    finalBatch: false,
    requestMode: 'fresh' as const,
  }
  const valid = {
    operationId: 'op',
    recordCount: 3,
    causalMode: 'fresh',
    applied: 3,
    alreadyApplied: 0,
    dispositions: ['applied', 'applied', 'applied'],
    operationStatus: 'started',
  }

  it('accepts an exact acknowledgement in its context', () => {
    expect(acknowledgementMatches(expectation, valid)).toEqual({
      matches: true,
      applied: 3,
      alreadyApplied: 0,
    })
  })

  it.each([
    ['not an object', 'nope', 'acknowledgement_not_object'],
    ['wrong operation', { ...valid, operationId: 'other' }, 'acknowledgement_operation_mismatch'],
    ['wrong count', { ...valid, recordCount: 4 }, 'acknowledgement_record_count_mismatch'],
    [
      'missing causal mode',
      (() => {
        const rest: Record<string, unknown> = { ...valid }
        delete rest.causalMode
        return rest
      })(),
      'acknowledgement_causal_mode_mismatch',
    ],
    [
      'opposite causal mode',
      { ...valid, causalMode: 'replay' },
      'acknowledgement_causal_mode_mismatch',
    ],
    ['invalid effects', { ...valid, applied: 4 }, 'acknowledgement_effect_counts_invalid'],
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
      { ...valid, dispositions: ['applied', 'applied', 'already_applied'] },
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

  it('refuses a fresh-context acknowledgement claiming already-applied records', () => {
    // A fresh submission only ever targets records the operator proved untouched, so an
    // already_applied answer is a causal contradiction — the exact vector that once let a
    // lost final acknowledgement be re-reported as a replay.
    expect(
      acknowledgementMatches(expectation, {
        ...valid,
        applied: 2,
        alreadyApplied: 1,
        dispositions: ['applied', 'applied', 'already_applied'],
      }),
    ).toEqual({ matches: false, reason: 'acknowledgement_fresh_records_already_applied' })
    expect(
      acknowledgementMatches(expectation, {
        ...valid,
        applied: 0,
        alreadyApplied: 3,
        dispositions: ['already_applied', 'already_applied', 'already_applied'],
        operationStatus: 'completed',
      }),
    ).toEqual({ matches: false, reason: 'acknowledgement_fresh_records_already_applied' })
  })

  it('binds the operation status to the batch context, not a generic either-or', () => {
    // A non-final fresh batch must not be acknowledged as completed…
    expect(acknowledgementMatches(expectation, { ...valid, operationStatus: 'completed' })).toEqual(
      { matches: false, reason: 'acknowledgement_operation_status_invalid' },
    )
    // …and the final fresh batch must not remain started.
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
    const replayExpectation = { ...expectation, requestMode: 'replay' as const }
    const replayAck = { ...valid, causalMode: 'replay' }
    expect(
      acknowledgementMatches(replayExpectation, { ...replayAck, operationStatus: 'completed' }),
    ).toEqual({ matches: false, reason: 'acknowledgement_replay_applied_fresh_records' })
    const pureReplay = {
      ...replayAck,
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
    // A replay expectation refuses an acknowledgement echoed in the fresh vocabulary.
    expect(
      acknowledgementMatches(replayExpectation, { ...pureReplay, causalMode: 'fresh' }),
    ).toEqual({ matches: false, reason: 'acknowledgement_causal_mode_mismatch' })
  })
})
