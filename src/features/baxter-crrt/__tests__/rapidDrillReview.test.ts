import {
  baxterCrrtRapidDrillManifest,
  CRRT_CAUSE_FIRST_STEP_IDS,
  CRRT_CAUSE_FIRST_STEPS,
  CRRT_RAPID_DRILL_IDS,
  createCrrtRapidDrillReviewState,
  reduceCrrtRapidDrillReview,
} from '../content'

describe('runnable cause-first rapid drills', () => {
  it('registers exactly five runnable drills with every required decision path', () => {
    expect(baxterCrrtRapidDrillManifest.map((drill) => drill.id)).toEqual([...CRRT_RAPID_DRILL_IDS])
    expect(baxterCrrtRapidDrillManifest).toHaveLength(5)

    for (const drill of baxterCrrtRapidDrillManifest) {
      expect(drill).toMatchObject({
        learnerRunnable: true,
        runnable: true,
        scoringAvailable: true,
        analyticsAvailable: true,
        progressPersistenceAvailable: true,
        competencyAvailable: false,
      })
      expect(drill.predictionOptions.map((option) => option.disposition)).toEqual([
        'safe',
        'accepted-alternative',
        'unsafe',
      ])
      expect(drill.criticalErrorCandidate.length).toBeGreaterThan(0)
      expect(drill.reassessmentDomain.length).toBeGreaterThan(0)
      expect(Object.isFrozen(drill)).toBe(true)
      expect(Object.isFrozen(drill.predictionOptions)).toBe(true)
    }
  })

  it('keys the wrong-solution drill on stopping the fluid and teaches the correction', () => {
    const wrongSolution = baxterCrrtRapidDrillManifest.find(
      (drill) => drill.id === 'DRILL-WRONG-SOLUTION',
    )!
    const safe = wrongSolution.predictionOptions.find(
      (option) => option.id === wrongSolution.candidateCauseOptionId,
    )!
    expect(safe.disposition).toBe('safe')
    expect(safe.label).toMatch(/^Stop that fluid/)
    expect(safe.label).not.toMatch(/escalat/i)
    expect(wrongSolution.correctionBoundary.length).toBeGreaterThan(0)
    expect(wrongSolution.correctionBoundary).not.toMatch(
      /local (policy|mismatch procedure)|does not (teach|recommend)/i,
    )
  })

  it.each(baxterCrrtRapidDrillManifest)(
    '$id deterministically supports safe, accepted-alternative, and critical-error outcomes',
    (drill) => {
      const finish = (optionId: string) => {
        let state = createCrrtRapidDrillReviewState(drill.id, 42)
        state = reduceCrrtRapidDrillReview(state, {
          type: 'COMMIT_PREDICTION',
          optionId,
        })
        state = reduceCrrtRapidDrillReview(state, { type: 'ACKNOWLEDGE_SIGNAL' })
        for (let index = 0; index < CRRT_CAUSE_FIRST_STEP_IDS.length; index += 1) {
          state = reduceCrrtRapidDrillReview(state, { type: 'COMPLETE_NEXT_STEP' })
        }
        return state
      }

      const safe = finish(drill.candidateCauseOptionId)
      const replay = finish(drill.candidateCauseOptionId)
      const alternative = finish(drill.acceptedAlternativeOptionId)
      const critical = finish(drill.unsafeOptionId)

      expect(safe).toEqual(replay)
      expect(safe).toMatchObject({
        seed: 42,
        outcome: 'safe',
        correctionVerified: true,
        reassessmentCompleted: true,
      })
      expect(alternative.outcome).toBe('accepted-alternative')
      expect(critical.outcome).toBe('critical-error')
      expect(safe.completedStepIds).toEqual(CRRT_CAUSE_FIRST_STEP_IDS)
    },
  )

  it('uses the ordered six-step cause-first sequence', () => {
    expect(CRRT_CAUSE_FIRST_STEPS.map((step) => step.id)).toEqual(CRRT_CAUSE_FIRST_STEP_IDS)
    expect(CRRT_CAUSE_FIRST_STEP_IDS.at(-1)).toBe('reassess-delivery-and-patient')
    expect(CRRT_CAUSE_FIRST_STEPS.every(Object.isFrozen)).toBe(true)
  })
})
