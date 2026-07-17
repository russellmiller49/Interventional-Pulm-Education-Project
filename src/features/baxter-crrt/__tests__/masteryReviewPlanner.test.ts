import {
  BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS,
  baxterCrrtMasteryAvailable,
  baxterCrrtMasteryManifest,
  baxterCrrtMasteryReviewPlanner,
  createBaxterCrrtMasteryCompositionPreview,
} from '../content'
import {
  isCrrtMasteryCapstoneActivated,
  isCrrtMasteryRuntimeCaseActivated,
} from '../engine/outcomes'

function expectDeepFrozen(value: unknown): void {
  if (value === null || typeof value !== 'object') return
  expect(Object.isFrozen(value)).toBe(true)
  for (const nested of Object.values(value)) expectDeepFrozen(nested)
}

describe('Phase 7 Mastery review planner content', () => {
  it('registers only the seven authored reviewer cases as thematic inputs', () => {
    expect(BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS).toEqual([
      'CRRT-01',
      'CRRT-02',
      'CRRT-05',
      'CRRT-06',
      'CRRT-07',
      'CRRT-11',
      'CRRT-15',
    ])
    expect(
      baxterCrrtMasteryReviewPlanner.candidateCases.map((candidate) => candidate.caseId),
    ).toEqual(BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS)
    expect(
      baxterCrrtMasteryReviewPlanner.candidateCases.every(
        (candidate) =>
          candidate.reviewStatus === 'pending' &&
          candidate.candidateUse === 'thematic-review-input-only' &&
          candidate.masteryRuntimeCaseId === null,
      ),
    ).toBe(true)
    expect(
      new Set(baxterCrrtMasteryReviewPlanner.candidateCases.map((candidate) => candidate.title)),
    ).toHaveProperty('size', 7)
  })

  it('deep-freezes explicit reviewer-only, non-runtime metadata and candidate rules', () => {
    expect(baxterCrrtMasteryReviewPlanner).toMatchObject({
      audience: 'reviewer',
      activationState: 'draft-reviewer-only',
      reviewStatus: 'pending',
      exactCandidateIdentity: null,
      ruleSetApprovalState: 'unapproved-candidate-rules',
      learnerAvailable: false,
      capstoneRuntimeAvailable: false,
      sessionCreationAvailable: false,
      scoringAvailable: false,
      analyticsAvailable: false,
      progressPersistenceAvailable: false,
      competencyAvailable: false,
      sourceRecordIds: ['BRIEF-MASTERY-001'],
    })
    expect(baxterCrrtMasteryReviewPlanner.candidateRules.map((rule) => rule.label)).toEqual([
      'Unseen title before debrief',
      'No hints',
      'Clean initial state',
      'At least 2 problem domains',
      'Reassessment required',
      'Candidate score ≥ 80%',
      'Zero critical errors allowed',
    ])
    expect(
      baxterCrrtMasteryReviewPlanner.candidateRules.every(
        (rule) =>
          rule.approvalState === 'unapproved-candidate-rule' &&
          rule.sourceRecordIds.join() === 'BRIEF-MASTERY-001',
      ),
    ).toBe(true)
    expectDeepFrozen(baxterCrrtMasteryReviewPlanner)
    expectDeepFrozen(BAXTER_CRRT_MASTERY_REVIEW_CASE_IDS)
  })

  it('builds only a frozen thematic preview and never creates a capstone runtime', () => {
    const preview = createBaxterCrrtMasteryCompositionPreview(['CRRT-11', 'CRRT-01', 'CRRT-11'])

    expect(preview).toMatchObject({
      selectedCaseIds: ['CRRT-01', 'CRRT-11'],
      selectedProblemDomainIds: ['treatment-goal-framing', 'fluid-removal-tolerance'],
      selectedCaseCount: 2,
      selectedProblemDomainCount: 2,
      minimumProblemDomainsCandidate: 2,
      minimumProblemDomainsRepresented: true,
      reviewOnly: true,
      capstoneRuntimeCreated: false,
    })
    expectDeepFrozen(preview)
  })

  it('keeps one-domain and empty previews below the candidate composition minimum', () => {
    expect(createBaxterCrrtMasteryCompositionPreview([])).toMatchObject({
      selectedCaseCount: 0,
      selectedProblemDomainCount: 0,
      minimumProblemDomainsRepresented: false,
      capstoneRuntimeCreated: false,
    })
    expect(createBaxterCrrtMasteryCompositionPreview(['CRRT-07'])).toMatchObject({
      selectedCaseCount: 1,
      selectedProblemDomainCount: 1,
      minimumProblemDomainsRepresented: false,
      capstoneRuntimeCreated: false,
    })
  })

  it('fails closed for an unknown source case identifier', () => {
    expect(() => createBaxterCrrtMasteryCompositionPreview(['CRRT-04' as never])).toThrow(
      /Unknown Mastery review-planner case ID: CRRT-04/,
    )
  })

  it('does not alter the locked Mastery manifest or activation result', () => {
    expect(baxterCrrtMasteryManifest.runtimeCaseIds).toEqual([])
    expect(baxterCrrtMasteryManifest.activationState).toBe('manifest-only')
    expect(baxterCrrtMasteryAvailable).toBe(false)
    expect(isCrrtMasteryCapstoneActivated(baxterCrrtMasteryReviewPlanner.id)).toBe(false)
    expect(
      baxterCrrtMasteryReviewPlanner.candidateCases.map((candidate) =>
        isCrrtMasteryRuntimeCaseActivated({
          id: candidate.caseId,
          contentVersion: baxterCrrtMasteryReviewPlanner.contentVersion,
        }),
      ),
    ).toEqual([false, false, false, false, false, false, false])
  })
})
