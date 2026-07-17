import {
  baxterCrrtPhase7SourceReferences,
  baxterCrrtRapidDrillManifest,
  baxterCrrtReviewerRapidDrills,
  CRRT_CAUSE_FIRST_STEP_IDS,
  CRRT_CAUSE_FIRST_STEPS,
  CRRT_RAPID_DRILL_IDS,
  CRRT_REVIEWER_RAPID_DRILL_IDS,
  createCrrtRapidDrillReviewState,
  reduceCrrtRapidDrillReview,
} from '../content'

const syntheticSourceIds = [
  'SYNTH-DRILL-AIR-001',
  'SYNTH-DRILL-BLOOD-LEAK-001',
  'SYNTH-DRILL-GAIN-LOSS-001',
  'SYNTH-DRILL-BAG-SCALE-001',
  'SYNTH-DRILL-POWER-001',
] as const

describe('Phase 7 reviewer-only rapid-drill previews', () => {
  it('exposes only the five bounded previews while every drill remains learner-locked', () => {
    expect(baxterCrrtRapidDrillManifest.map((drill) => drill.id)).toEqual([...CRRT_RAPID_DRILL_IDS])
    expect(
      baxterCrrtRapidDrillManifest
        .filter((drill) => drill.reviewerPreviewAvailable)
        .map((drill) => drill.id),
    ).toEqual([...CRRT_REVIEWER_RAPID_DRILL_IDS])
    expect(baxterCrrtReviewerRapidDrills.map((drill) => drill.id)).toEqual([
      ...CRRT_REVIEWER_RAPID_DRILL_IDS,
    ])

    for (const drill of baxterCrrtRapidDrillManifest) {
      expect(drill).toMatchObject({
        reviewStatus: 'pending',
        runnable: false,
        scoringAvailable: false,
        analyticsAvailable: false,
        progressPersistenceAvailable: false,
        competencyAvailable: false,
      })
      expect(drill.exactCandidateIdentity).toBeNull()
    }

    for (const drillId of ['DRILL-WRONG-SOLUTION', 'DRILL-BLOOD-RETURN'] as const) {
      expect(baxterCrrtRapidDrillManifest.find((drill) => drill.id === drillId)).toMatchObject({
        activationState: 'policy-blocked',
        reviewerPreviewAvailable: false,
        runnable: false,
      })
      expect(baxterCrrtReviewerRapidDrills.some((drill) => drill.id === (drillId as string))).toBe(
        false,
      )
    }
  })

  it('keeps definitions, source links, and the safe sequence deeply frozen and pending', () => {
    expect(CRRT_CAUSE_FIRST_STEPS.map((step) => step.id)).toEqual([...CRRT_CAUSE_FIRST_STEP_IDS])
    expect(Object.isFrozen(CRRT_REVIEWER_RAPID_DRILL_IDS)).toBe(true)
    expect(Object.isFrozen(CRRT_CAUSE_FIRST_STEP_IDS)).toBe(true)
    expect(Object.isFrozen(CRRT_CAUSE_FIRST_STEPS)).toBe(true)
    expect(CRRT_CAUSE_FIRST_STEPS.every(Object.isFrozen)).toBe(true)
    expect(Object.isFrozen(baxterCrrtReviewerRapidDrills)).toBe(true)

    for (const drill of baxterCrrtReviewerRapidDrills) {
      expect(drill).toMatchObject({
        reviewStatus: 'pending',
        learnerRunnable: false,
        scoringAvailable: false,
        analyticsAvailable: false,
        progressPersistenceAvailable: false,
        competencyAvailable: false,
      })
      expect(Object.isFrozen(drill)).toBe(true)
      expect(Object.isFrozen(drill.engineFaultIds)).toBe(true)
      expect(Object.isFrozen(drill.predictionOptions)).toBe(true)
      expect(drill.predictionOptions.every(Object.isFrozen)).toBe(true)
      expect(Object.isFrozen(drill.sourceRecordIds)).toBe(true)
    }

    const sourceRecords = baxterCrrtPhase7SourceReferences.filter((record) =>
      syntheticSourceIds.includes(record.id as (typeof syntheticSourceIds)[number]),
    )
    expect(sourceRecords.map((record) => record.id)).toEqual([...syntheticSourceIds])
    expect(
      sourceRecords.every(
        (record) =>
          record.reviewStatus === 'pending' &&
          record.reviewer === null &&
          record.sourceType === 'synthetic-calibration' &&
          Object.isFrozen(record),
      ),
    ).toBe(true)
  })

  it('requires a valid committed prediction before reveal or any review action', () => {
    const initial = createCrrtRapidDrillReviewState()
    expect(Object.isFrozen(initial)).toBe(true)
    expect(Object.isFrozen(initial.completedStepIds)).toBe(true)

    expect(reduceCrrtRapidDrillReview(initial, { type: 'ACKNOWLEDGE_SIGNAL' })).toBe(initial)
    expect(reduceCrrtRapidDrillReview(initial, { type: 'COMPLETE_NEXT_STEP' })).toBe(initial)
    expect(
      reduceCrrtRapidDrillReview(initial, {
        type: 'COMMIT_PREDICTION',
        optionId: 'not-a-candidate-option',
      }),
    ).toBe(initial)

    const revealed = reduceCrrtRapidDrillReview(initial, {
      type: 'COMMIT_PREDICTION',
      optionId: 'air-return-path',
    })
    expect(revealed).toMatchObject({
      predictionOptionId: 'air-return-path',
      faultRevealed: true,
      acknowledged: false,
      correctionVerified: false,
    })
    expect(Object.isFrozen(revealed)).toBe(true)
    expect(
      reduceCrrtRapidDrillReview(revealed, {
        type: 'COMMIT_PREDICTION',
        optionId: 'air-acknowledge-only',
      }),
    ).toBe(revealed)
  })

  it('keeps acknowledgement separate from correction and completes gates sequentially', () => {
    let state = reduceCrrtRapidDrillReview(createCrrtRapidDrillReviewState(), {
      type: 'COMMIT_PREDICTION',
      optionId: 'air-return-path',
    })
    state = reduceCrrtRapidDrillReview(state, { type: 'ACKNOWLEDGE_SIGNAL' })

    expect(state.acknowledged).toBe(true)
    expect(state.correctionVerified).toBe(false)
    expect(state.completedStepIds).toEqual([])

    for (const [index, expectedStepId] of CRRT_CAUSE_FIRST_STEP_IDS.entries()) {
      state = reduceCrrtRapidDrillReview(state, { type: 'COMPLETE_NEXT_STEP' })
      expect(state.completedStepIds).toEqual(CRRT_CAUSE_FIRST_STEP_IDS.slice(0, index + 1))
      expect(state.correctionVerified).toBe(index >= 3)
      expect(state.completedStepIds[index]).toBe(expectedStepId)
      expect(Object.isFrozen(state.completedStepIds)).toBe(true)
    }

    expect(reduceCrrtRapidDrillReview(state, { type: 'COMPLETE_NEXT_STEP' })).toBe(state)

    const reset = reduceCrrtRapidDrillReview(state, { type: 'RESET' })
    expect(reset).toEqual(createCrrtRapidDrillReviewState('DRILL-AIR'))
    expect(Object.isFrozen(reset)).toBe(true)
  })
})
