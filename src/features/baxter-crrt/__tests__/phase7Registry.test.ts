import {
  baxterCrrtCaseCatalog,
  baxterCrrtLearnerCases,
  baxterCrrtPhase7LearnerRegistrations,
  baxterCrrtReviewerCases,
  baxterCrrtMasteryAvailable,
  baxterCrrtMasteryManifest,
  baxterCrrtInstructionalToolManifest,
  baxterCrrtPhase7EvidenceRequirements,
  baxterCrrtPilotCases,
  baxterCrrtPilotSourceReferences,
  baxterCrrtPhase7SourceReferences,
  baxterCrrtRapidDrillManifest,
  baxterCrrtEngineSourceRecords,
  baxterCrrtSourceRecords,
  canActivateCrrtRecord,
  BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX,
  BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
  CRRT_PHASE_7_AUTHORIZED_DECISION,
  CRRT_PHASE_8_AUTHORIZED_DECISION,
  CRRT_PILOT_ACCEPTED_DECISION,
  CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS,
  CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
  CRRT_ALL_CASE_IDS,
  CRRT_INSTRUCTIONAL_TOOL_IDS,
  CRRT_PILOT_CASE_IDS,
  CRRT_PROTOCOL_GATED_CASE_IDS,
  CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS,
  CRRT_RAPID_DRILL_IDS,
  buildBaxterCrrtLearnerCaseRegistry,
  getBaxterCrrtCaseCatalogEntry,
  hasCompleteBaxterCrrtReviewAttestation,
  hasCompleteCrrtReview,
  isBaxterCrrtAttestationSha256,
  isBaxterCrrtExactCandidateIdentity,
  isBaxterCrrtIsoAttestationTime,
  pendingReviewRequirements,
  type CrrtActivationRecord,
  type CrrtReleaseArtifactId,
} from '../content'

const candidateManifestSha256 = '1'.repeat(64)
const phase7FindingsLedgerSha256 = '2'.repeat(64)
const phase8FindingsLedgerSha256 = '6'.repeat(64)
const phase7ScopeSha256 = '4'.repeat(64)
const phase8ScopeSha256 = '8'.repeat(64)
const stablePrismaxPrerequisite = Object.freeze({
  exactCandidateIdentity: `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'9'.repeat(64)}`,
  candidateManifestSha256: 'a'.repeat(64),
  findingsLedgerSha256: 'f'.repeat(64),
  activationAuthorizationRecordId: 'CRRT-PRISMAX-ACTIVATION-1',
  activationAuthorizationSha256: 'b'.repeat(64),
  publicationAuthorizationRecordId: 'CRRT-PRISMAX-PUBLICATION-1',
  publicationAuthorizationSha256: 'c'.repeat(64),
})

function uniqueReviewSha256(index: number): string {
  return (index + 16).toString(16).padStart(64, '0')
}

function uniqueReviewScopeSha256(index: number): string {
  return (index + 64).toString(16).padStart(64, '0')
}

function expectedReviewScopeMap<
  T extends readonly { readonly domain: string; readonly reviewScopeSha256: string | null }[],
>(reviews: T) {
  return Object.freeze(
    Object.fromEntries(reviews.map((review) => [review.domain, review.reviewScopeSha256])),
  )
}

function phase7Authorization(
  exactCandidateIdentity: string,
  authorizedArtifactIds: readonly CrrtReleaseArtifactId[] = ['CRRT-01'],
) {
  return {
    kind: 'phase-7' as const,
    decision: CRRT_PHASE_7_AUTHORIZED_DECISION,
    exactCandidateIdentity,
    candidateManifestSha256,
    findingsLedgerSha256: phase7FindingsLedgerSha256,
    authorizationRecordId: 'CRRT-PHASE-7-AUTHORIZATION-1',
    authorizationRecordSha256: 'd'.repeat(64),
    authorizedAt: '2026-07-17T16:30:00Z',
    authorizerSubjectId: 'product-owner-subject-1',
    attestationSystem: 'approved-attestation-system',
    attestationReceiptId: 'CRRT-PHASE-7-ATTESTATION-1',
    attestationSha256: '3'.repeat(64),
    authorizationScopeSha256: phase7ScopeSha256,
    authorizedArtifactIds,
    acceptedPilotAuthorizationReference: {
      kind: 'pilot-acceptance' as const,
      decision: CRRT_PILOT_ACCEPTED_DECISION,
      exactCandidateIdentity,
      candidateManifestSha256,
      findingsLedgerSha256: phase7FindingsLedgerSha256,
      authorizationScopeSha256: '0'.repeat(64),
      authorizedArtifactIds: CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS,
      authorizationRecordId: 'CRRT-PILOT-AUTHORIZATION-1',
      authorizationRecordSha256: '5'.repeat(64),
    },
  }
}

function phase8Authorization(
  exactCandidateIdentity: string,
  authorizedArtifactIds: readonly CrrtReleaseArtifactId[] = ['TRANSFER-PRISMAX-PRISMAFLEX-01'],
) {
  return {
    kind: 'phase-8' as const,
    decision: CRRT_PHASE_8_AUTHORIZED_DECISION,
    exactCandidateIdentity,
    candidateManifestSha256,
    findingsLedgerSha256: phase8FindingsLedgerSha256,
    authorizationRecordId: 'CRRT-PHASE-8-AUTHORIZATION-1',
    authorizationRecordSha256: 'e'.repeat(64),
    authorizedAt: '2026-07-17T16:30:00Z',
    authorizerSubjectId: 'product-owner-subject-1',
    attestationSystem: 'approved-attestation-system',
    attestationReceiptId: 'CRRT-PHASE-8-ATTESTATION-1',
    attestationSha256: '7'.repeat(64),
    authorizationScopeSha256: phase8ScopeSha256,
    authorizedArtifactIds,
    stablePrismaxCandidateIdentity: stablePrismaxPrerequisite.exactCandidateIdentity,
    stablePrismaxCandidateManifestSha256: stablePrismaxPrerequisite.candidateManifestSha256,
    stablePrismaxFindingsLedgerSha256: stablePrismaxPrerequisite.findingsLedgerSha256,
    prismaxActivationAuthorizationRecordId:
      stablePrismaxPrerequisite.activationAuthorizationRecordId,
    prismaxActivationAuthorizationSha256: stablePrismaxPrerequisite.activationAuthorizationSha256,
    prismaxPublicationAuthorizationRecordId:
      stablePrismaxPrerequisite.publicationAuthorizationRecordId,
    prismaxPublicationAuthorizationSha256: stablePrismaxPrerequisite.publicationAuthorizationSha256,
  }
}

describe('Baxter CRRT Phase 7 fail-closed registries', () => {
  it('registers all 18 curriculum cases in canonical order without expanding the learner runtime', () => {
    expect(baxterCrrtCaseCatalog.map((entry) => entry.id)).toEqual([...CRRT_ALL_CASE_IDS])
    expect(baxterCrrtCaseCatalog).toHaveLength(18)
    expect(baxterCrrtLearnerCases).toBe(baxterCrrtPilotCases)
    expect(baxterCrrtPhase7LearnerRegistrations).toEqual([])
    expect(Object.isFrozen(baxterCrrtPhase7LearnerRegistrations)).toBe(true)
    expect(baxterCrrtLearnerCases.map((entry) => entry.id)).toEqual([...CRRT_PILOT_CASE_IDS])
    expect(baxterCrrtReviewerCases.map((entry) => entry.id)).toEqual([
      'CRRT-01',
      'CRRT-02',
      'CRRT-05',
      'CRRT-06',
      'CRRT-07',
      'CRRT-11',
      'CRRT-15',
    ])

    for (const entry of baxterCrrtCaseCatalog) {
      expect(entry.contentVersion).toBe(BAXTER_CRRT_PHASE_7_CONTENT_VERSION)
      expect(entry.reviewStatus).toBe('pending')
      expect(entry.exactCandidateIdentity).toBeNull()
      expect(entry.candidateManifestSha256).toBeNull()
      expect(entry.expectedFindingsLedgerSha256).toBeNull()
      expect(entry.expectedAuthorizationScopeSha256).toBeNull()
      expect(entry.expectedReviewScopeSha256ByDomain).toBeNull()
      expect(entry.expectedPilotAcceptanceReference).toBeNull()
      expect(entry.expectedPhase8StablePrismaxPrerequisite).toBeNull()
      expect(entry.activationAuthorization).toBeNull()
      expect(entry.requiredReviews.every((review) => review.reviewer === null)).toBe(true)
      expect(entry.requiredReviews.every((review) => review.exactCandidateIdentity === null)).toBe(
        true,
      )
      expect(
        entry.requiredReviews.every(
          (review) =>
            review.exactVersionDisposition === null &&
            review.candidateManifestSha256 === null &&
            review.findingsLedgerSha256 === null &&
            review.reviewScopeSha256 === null &&
            review.attestedAt === null &&
            review.attestationArtifactId === null &&
            review.attestationSha256 === null,
        ),
      ).toBe(true)
      const domains = entry.requiredReviews.map((review) => review.domain)
      expect(new Set(domains).size).toBe(domains.length)
      expect(
        CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS.every((domain) => domains.includes(domain)),
      ).toBe(true)
      expect(canActivateCrrtRecord(entry)).toBe(false)
      expect(entry.runtimeAvailable).toBe(
        (CRRT_PILOT_CASE_IDS as readonly string[]).includes(entry.id),
      )
      expect(entry.reviewerRuntimeAvailable).toBe(
        ['CRRT-01', 'CRRT-02', 'CRRT-05', 'CRRT-06', 'CRRT-07', 'CRRT-11', 'CRRT-15'].includes(
          entry.id,
        ),
      )
    }
  })

  it('rejects pending, mismatched, or duplicate future learner registrations', () => {
    const reviewerDefinition = baxterCrrtReviewerCases.find(({ id }) => id === 'CRRT-01')
    expect(reviewerDefinition).toBeDefined()
    if (!reviewerDefinition) return
    const pendingActivationRecord = getBaxterCrrtCaseCatalogEntry('CRRT-01')
    expect(() =>
      buildBaxterCrrtLearnerCaseRegistry(baxterCrrtPilotCases, [
        { definition: reviewerDefinition, activationRecord: pendingActivationRecord },
      ]),
    ).toThrow(/lacks complete exact-candidate activation evidence/i)

    expect(() =>
      buildBaxterCrrtLearnerCaseRegistry(baxterCrrtPilotCases, [
        {
          definition: reviewerDefinition,
          activationRecord: {
            ...pendingActivationRecord,
            id: 'CRRT-02',
          },
        },
      ]),
    ).toThrow(/IDs must match/i)

    const pilotDefinition = baxterCrrtPilotCases.find(({ id }) => id === 'CRRT-04')
    expect(pilotDefinition).toBeDefined()
    if (!pilotDefinition) return
    const pilotRecord = getBaxterCrrtCaseCatalogEntry('CRRT-04')
    expect(() =>
      buildBaxterCrrtLearnerCaseRegistry(baxterCrrtPilotCases, [
        {
          definition: pilotDefinition,
          activationRecord: {
            ...pilotRecord,
            contentVersion: pilotDefinition.contentVersion,
          },
        },
      ]),
    ).toThrow(/Duplicate CRRT learner registration/i)
  })

  it('keeps anticoagulation and citrate cases protocol-blocked and non-runnable', () => {
    for (const caseId of CRRT_PROTOCOL_GATED_CASE_IDS) {
      expect(getBaxterCrrtCaseCatalogEntry(caseId)).toMatchObject({
        activationState: 'protocol-blocked',
        runtimeAvailable: false,
        reviewStatus: 'pending',
      })
    }
    expect(getBaxterCrrtCaseCatalogEntry('CRRT-17').focus).toMatch(/no dosing/i)
  })

  it('requires the exact candidate and every unique mandatory exact-version review', () => {
    const exactCandidateIdentity = `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'a'.repeat(64)}`
    const approvedReviews = CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS.map((domain, index) =>
      Object.freeze({
        domain,
        reviewer: 'Example reviewer',
        reviewStatus: 'approved' as const,
        exactCandidateIdentity,
        candidateManifestSha256,
        findingsLedgerSha256: phase7FindingsLedgerSha256,
        reviewScopeSha256: uniqueReviewScopeSha256(index),
        exactVersionDisposition: 'accepted' as const,
        attestedAt: '2026-07-17T09:15:30-07:00',
        attestationArtifactId: `CRRT-REVIEW-RECEIPT-${index + 1}`,
        attestationSha256: uniqueReviewSha256(index),
      }),
    )
    const completeButInactive = {
      id: 'CRRT-01' as const,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256: phase7FindingsLedgerSha256,
      expectedAuthorizationScopeSha256: phase7ScopeSha256,
      expectedReviewScopeSha256ByDomain: expectedReviewScopeMap(approvedReviews),
      expectedPilotAcceptanceReference:
        phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
      expectedPhase8StablePrismaxPrerequisite: null,
      reviewScope: 'prismax' as const,
      activationAuthorization: phase7Authorization(exactCandidateIdentity),
      activationState: 'draft-reviewer-only' as const,
      reviewStatus: 'approved' as const,
      requiredReviews: approvedReviews,
      blockingInputs: [],
    }
    expect(hasCompleteCrrtReview(completeButInactive)).toBe(true)
    expect(
      hasCompleteBaxterCrrtReviewAttestation(
        approvedReviews[0],
        exactCandidateIdentity,
        candidateManifestSha256,
        phase7FindingsLedgerSha256,
        approvedReviews[0].reviewScopeSha256,
      ),
    ).toBe(true)
    for (const staleBinding of [
      { candidateManifestSha256: '0'.repeat(64) },
      { findingsLedgerSha256: '0'.repeat(64) },
    ]) {
      expect(
        hasCompleteCrrtReview({
          ...completeButInactive,
          requiredReviews: approvedReviews.map((review, index) =>
            index === 0 ? { ...review, ...staleBinding } : review,
          ),
        }),
      ).toBe(false)
    }
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0
            ? { ...review, reviewScopeSha256: approvedReviews[1].reviewScopeSha256 }
            : index === 1
              ? { ...review, reviewScopeSha256: approvedReviews[0].reviewScopeSha256 }
              : review,
        ),
      }),
    ).toBe(false)
    expect(canActivateCrrtRecord(completeButInactive)).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: null,
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        expectedPilotAcceptanceReference: null,
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        expectedPilotAcceptanceReference: {
          ...completeButInactive.expectedPilotAcceptanceReference,
          authorizationRecordId: 'INVENTED-PILOT-ACCEPTANCE',
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          attestationReceiptId: 'CRRT-PHASE-7-AUTHORIZATION-1',
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          attestationSha256: 'd'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          acceptedPilotAuthorizationReference: {
            ...phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
            authorizationRecordId: 'CRRT-PHASE-7-ATTESTATION-1',
          },
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          acceptedPilotAuthorizationReference: {
            ...phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
            authorizationRecordSha256: '3'.repeat(64),
          },
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          acceptedPilotAuthorizationReference: {
            ...phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
            authorizationRecordId: 'CRRT-PHASE-7-AUTHORIZATION-1',
          },
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          acceptedPilotAuthorizationReference: {
            ...phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
            authorizationRecordSha256: 'd'.repeat(64),
          },
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({ ...completeButInactive, activationState: 'learner-active' }),
    ).toBe(true)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        id: 'CRRT-02',
        activationState: 'learner-active',
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        expectedAuthorizationScopeSha256: '6'.repeat(64),
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        expectedFindingsLedgerSha256: null,
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        expectedFindingsLedgerSha256: '6'.repeat(64),
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        reviewScope: 'phase8-cross-device',
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        candidateManifestSha256: '9'.repeat(64),
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: phase8Authorization(exactCandidateIdentity),
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          acceptedPilotAuthorizationReference: {
            ...phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
            authorizationRecordId: '   ',
          },
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...completeButInactive,
        activationState: 'learner-active',
        activationAuthorization: {
          ...phase7Authorization(exactCandidateIdentity),
          acceptedPilotAuthorizationReference: {
            ...phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
            exactCandidateIdentity: `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'b'.repeat(64)}`,
          },
        },
      }),
    ).toBe(false)
    expect(
      baxterCrrtPhase7EvidenceRequirements.find((record) => record.id === 'CLIN-001'),
    ).toMatchObject({
      evidenceState: 'candidate-authoritative-sources-pending-review',
      activationAllowed: false,
      reviewer: null,
      reviewStatus: 'pending',
    })
    expect(
      baxterCrrtPhase7SourceReferences.every(
        (record) => record.reviewer === null && record.reviewStatus === 'pending',
      ),
    ).toBe(true)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        exactCandidateIdentity: `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'A'.repeat(64)}`,
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 1
            ? { ...review, attestationArtifactId: approvedReviews[0].attestationArtifactId }
            : review,
        ),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 1
            ? { ...review, attestationSha256: approvedReviews[0].attestationSha256 }
            : review,
        ),
      }),
    ).toBe(false)
    expect(isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity)).toBe(true)
    expect(isBaxterCrrtExactCandidateIdentity(`${exactCandidateIdentity}0`)).toBe(false)
    expect(isBaxterCrrtIsoAttestationTime('2026-07-17T09:15:30-07:00')).toBe(true)
    expect(isBaxterCrrtIsoAttestationTime('2026-02-29T09:15:30Z')).toBe(false)
    expect(isBaxterCrrtIsoAttestationTime('2026-07-17T09:15:30+14:01')).toBe(false)
    expect(isBaxterCrrtAttestationSha256('b'.repeat(64))).toBe(true)
    expect(isBaxterCrrtAttestationSha256('B'.repeat(64))).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0 ? { ...review, exactCandidateIdentity: 'different-candidate' } : review,
        ),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.slice(1),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: [...approvedReviews, approvedReviews[0]],
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0 ? { ...review, reviewer: '   ' } : review,
        ),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0
            ? { ...review, exactVersionDisposition: 'changes-required' as const }
            : review,
        ),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0 ? { ...review, attestedAt: '2026-02-29T09:15:30Z' } : review,
        ),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0 ? { ...review, attestationArtifactId: '   ' } : review,
        ),
      }),
    ).toBe(false)
    expect(
      hasCompleteCrrtReview({
        ...completeButInactive,
        requiredReviews: approvedReviews.map((review, index) =>
          index === 0 ? { ...review, attestationSha256: 'B'.repeat(64) } : review,
        ),
      }),
    ).toBe(false)
    expect(() => pendingReviewRequirements(['critical-care'])).toThrow(/mandatory release domains/i)
    expect(() =>
      pendingReviewRequirements([...CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS, 'critical-care']),
    ).toThrow(/duplicate reviewer domains/i)
  })

  it('keeps governance approvals separate and supports conditional reviewer domains', () => {
    expect(CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS).toEqual([
      'nephrology',
      'critical-care',
      'crrt-nurse-education',
      'prismax-device',
      'accessibility',
      'localization',
      'privacy-data-governance',
      'entitlement-security',
      'product-owner',
      'publication-approval',
    ])

    const conditionalDomains = [
      'prismaflex-device',
      'cross-device-equivalence',
      'pharmacy',
      'nutrition',
      'protocol-owner',
    ] as const
    const pending = pendingReviewRequirements([
      ...CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
      ...conditionalDomains,
    ])
    expect(pending.map((review) => review.domain)).toEqual([
      ...CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
      ...conditionalDomains,
    ])
    expect(
      pending.every(
        (review) =>
          review.reviewStatus === 'pending' &&
          review.reviewer === null &&
          review.exactCandidateIdentity === null &&
          review.candidateManifestSha256 === null &&
          review.findingsLedgerSha256 === null &&
          review.reviewScopeSha256 === null &&
          review.exactVersionDisposition === null &&
          review.attestedAt === null &&
          review.attestationArtifactId === null &&
          review.attestationSha256 === null,
      ),
    ).toBe(true)

    const exactCandidateIdentity = `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'c'.repeat(64)}`
    const approvedReviews = pending.map((review, index) => ({
      ...review,
      reviewer: `Named reviewer ${index + 1}`,
      reviewStatus: 'approved' as const,
      exactCandidateIdentity,
      candidateManifestSha256,
      findingsLedgerSha256: phase7FindingsLedgerSha256,
      reviewScopeSha256: uniqueReviewScopeSha256(index),
      exactVersionDisposition: 'accepted' as const,
      attestedAt: '2026-07-17T16:15:30Z',
      attestationArtifactId: `CRRT-CONDITIONAL-RECEIPT-${index + 1}`,
      attestationSha256: uniqueReviewSha256(index),
    }))
    const exactRequiredReviews = approvedReviews.filter((review) =>
      CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS.includes(
        review.domain as (typeof CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS)[number],
      ),
    )
    const completeWithConditionalReviews = {
      id: 'CRRT-01' as const,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256: phase7FindingsLedgerSha256,
      expectedAuthorizationScopeSha256: phase7ScopeSha256,
      expectedReviewScopeSha256ByDomain: expectedReviewScopeMap(exactRequiredReviews),
      expectedPilotAcceptanceReference:
        phase7Authorization(exactCandidateIdentity).acceptedPilotAuthorizationReference,
      expectedPhase8StablePrismaxPrerequisite: null,
      reviewScope: 'prismax' as const,
      activationAuthorization: phase7Authorization(exactCandidateIdentity),
      activationState: 'learner-active' as const,
      reviewStatus: 'approved' as const,
      requiredReviews: exactRequiredReviews,
      blockingInputs: [],
    }
    expect(hasCompleteCrrtReview(completeWithConditionalReviews)).toBe(true)
    expect(canActivateCrrtRecord(completeWithConditionalReviews)).toBe(true)
    expect(
      hasCompleteCrrtReview({
        ...completeWithConditionalReviews,
        requiredReviews: exactRequiredReviews.map((review) =>
          review.domain === 'critical-care'
            ? { ...review, exactVersionDisposition: 'rejected' as const }
            : review,
        ),
      }),
    ).toBe(false)
  })

  it('requires both Phase 8 conditional domains before a cross-device runtime can activate', () => {
    expect(CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS).toEqual([
      'prismaflex-device',
      'cross-device-equivalence',
    ])

    const exactCandidateIdentity = `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'e'.repeat(64)}`
    const requiredDomains = [
      ...CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
      ...CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS,
    ]
    const approvedReviews = requiredDomains.map((domain, index) => ({
      domain,
      reviewer: `Named Phase 8 reviewer ${index + 1}`,
      reviewStatus: 'approved' as const,
      exactCandidateIdentity,
      candidateManifestSha256,
      findingsLedgerSha256: phase8FindingsLedgerSha256,
      reviewScopeSha256: uniqueReviewScopeSha256(index + 32),
      exactVersionDisposition: 'accepted' as const,
      attestedAt: '2026-07-17T16:15:30Z',
      attestationArtifactId: `CRRT-PHASE-8-RECEIPT-${index + 1}`,
      attestationSha256: uniqueReviewSha256(index),
    }))
    const phase8Record = {
      id: 'TRANSFER-PRISMAX-PRISMAFLEX-01' as const,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256: phase8FindingsLedgerSha256,
      expectedAuthorizationScopeSha256: phase8ScopeSha256,
      expectedReviewScopeSha256ByDomain: expectedReviewScopeMap(approvedReviews),
      expectedPilotAcceptanceReference: null,
      expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
      reviewScope: 'phase8-cross-device' as const,
      activationAuthorization: phase8Authorization(exactCandidateIdentity),
      activationState: 'learner-active' as const,
      reviewStatus: 'approved' as const,
      requiredReviews: approvedReviews,
      blockingInputs: [],
    }

    expect(hasCompleteCrrtReview(phase8Record)).toBe(true)
    expect(canActivateCrrtRecord({ ...phase8Record, activationAuthorization: null })).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        expectedPhase8StablePrismaxPrerequisite: null,
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        expectedPhase8StablePrismaxPrerequisite: {
          ...stablePrismaxPrerequisite,
          publicationAuthorizationSha256: '0'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          stablePrismaxCandidateManifestSha256: '0'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          stablePrismaxCandidateManifestSha256: 'A'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          prismaxActivationAuthorizationRecordId: 'CRRT-PHASE-8-AUTHORIZATION-1',
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          prismaxPublicationAuthorizationSha256: 'e'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          prismaxActivationAuthorizationRecordId: 'CRRT-PHASE-8-ATTESTATION-1',
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          prismaxPublicationAuthorizationSha256: '7'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          stablePrismaxCandidateIdentity: exactCandidateIdentity,
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          stablePrismaxCandidateManifestSha256: candidateManifestSha256,
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          prismaxPublicationAuthorizationRecordId: 'CRRT-PRISMAX-ACTIVATION-1',
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: {
          ...phase8Authorization(exactCandidateIdentity),
          prismaxPublicationAuthorizationSha256: 'b'.repeat(64),
        },
      }),
    ).toBe(false)
    expect(
      canActivateCrrtRecord({
        ...phase8Record,
        activationAuthorization: phase8Authorization(exactCandidateIdentity, [
          'TRANSFER-PRISMAX-PRISMAFLEX-01',
          'TRANSFER-PRISMAX-PRISMAFLEX-01',
        ]),
      }),
    ).toBe(false)
    expect(canActivateCrrtRecord(phase8Record)).toBe(true)
    for (const releaseOnlyArtifactId of [
      'PRISMAFLEX-LEARNER-INTERFACE',
      'prismaflex-g5036003-6xx',
    ] as const) {
      const forgedReleaseOnlyActivationRecord = {
        ...phase8Record,
        id: releaseOnlyArtifactId,
        activationAuthorization: phase8Authorization(exactCandidateIdentity, [
          releaseOnlyArtifactId,
        ]),
      } as unknown as CrrtActivationRecord
      expect(canActivateCrrtRecord(forgedReleaseOnlyActivationRecord)).toBe(false)
    }
    for (const missingDomain of CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS) {
      const missingConditionalReview = {
        ...phase8Record,
        requiredReviews: approvedReviews.filter((review) => review.domain !== missingDomain),
      }
      expect(hasCompleteCrrtReview(missingConditionalReview)).toBe(false)
      expect(canActivateCrrtRecord(missingConditionalReview)).toBe(false)
    }
  })

  it('requires specialty and protocol owners in addition to every release reviewer', () => {
    for (const caseId of ['CRRT-09', 'CRRT-16', 'CRRT-17', 'CRRT-18'] as const) {
      expect(
        getBaxterCrrtCaseCatalogEntry(caseId).requiredReviews.map((review) => review.domain),
      ).toContain('protocol-owner')
    }
    expect(
      getBaxterCrrtCaseCatalogEntry('CRRT-12').requiredReviews.map((review) => review.domain),
    ).toEqual(expect.arrayContaining(['pharmacy', 'nutrition']))
    for (const caseId of ['CRRT-09', 'CRRT-16', 'CRRT-17'] as const) {
      expect(
        getBaxterCrrtCaseCatalogEntry(caseId).requiredReviews.map((review) => review.domain),
      ).toContain('pharmacy')
    }
    expect(
      baxterCrrtRapidDrillManifest
        .find((drill) => drill.id === 'DRILL-WRONG-SOLUTION')
        ?.requiredReviews.map((review) => review.domain),
    ).toEqual(expect.arrayContaining(['protocol-owner', 'pharmacy']))
    expect(
      baxterCrrtInstructionalToolManifest
        .find((tool) => tool.id === 'LAB-CITRATE-DASHBOARD')
        ?.requiredReviews.map((review) => review.domain),
    ).toEqual(expect.arrayContaining(['protocol-owner', 'pharmacy']))
  })

  it('materializes all seven rapid-drill plans without an actionable response path', () => {
    expect(baxterCrrtRapidDrillManifest.map((drill) => drill.id)).toEqual([...CRRT_RAPID_DRILL_IDS])
    for (const drill of baxterCrrtRapidDrillManifest) {
      expect(drill.contentVersion).toBe(BAXTER_CRRT_PHASE_7_CONTENT_VERSION)
      expect(drill.exactCandidateIdentity).toBeNull()
      expect(drill.candidateManifestSha256).toBeNull()
      expect(drill.expectedFindingsLedgerSha256).toBeNull()
      expect(drill.expectedAuthorizationScopeSha256).toBeNull()
      expect(drill.expectedReviewScopeSha256ByDomain).toBeNull()
      expect(drill.expectedPilotAcceptanceReference).toBeNull()
      expect(drill.expectedPhase8StablePrismaxPrerequisite).toBeNull()
      expect(drill.activationAuthorization).toBeNull()
      expect(drill.runnable).toBe(false)
      expect(drill.reviewStatus).toBe('pending')
      expect(drill.blockingInputs.length).toBeGreaterThan(0)
      const domains = drill.requiredReviews.map((review) => review.domain)
      expect(new Set(domains).size).toBe(domains.length)
      expect(
        CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS.every((domain) => domains.includes(domain)),
      ).toBe(true)
      expect(canActivateCrrtRecord(drill)).toBe(false)
    }
    expect(
      baxterCrrtRapidDrillManifest.find((drill) => drill.id === 'DRILL-WRONG-SOLUTION'),
    ).toMatchObject({ activationState: 'policy-blocked', engineFaultIds: [] })
    for (const drillId of ['DRILL-WRONG-SOLUTION', 'DRILL-BLOOD-RETURN'] as const) {
      expect(
        baxterCrrtRapidDrillManifest
          .find((drill) => drill.id === drillId)
          ?.requiredReviews.map((review) => review.domain),
      ).toContain('protocol-owner')
    }
  })

  it('registers all instructional tools while exposing only bounded reviewer runtimes', () => {
    expect(baxterCrrtInstructionalToolManifest.map((tool) => tool.id)).toEqual([
      ...CRRT_INSTRUCTIONAL_TOOL_IDS,
    ])
    for (const tool of baxterCrrtInstructionalToolManifest) {
      expect(tool).toMatchObject({
        contentVersion: BAXTER_CRRT_PHASE_7_CONTENT_VERSION,
        exactCandidateIdentity: null,
        candidateManifestSha256: null,
        expectedFindingsLedgerSha256: null,
        expectedAuthorizationScopeSha256: null,
        expectedReviewScopeSha256ByDomain: null,
        expectedPilotAcceptanceReference: null,
        expectedPhase8StablePrismaxPrerequisite: null,
        activationAuthorization: null,
        reviewStatus: 'pending',
        learnerAvailable: false,
        scoringAvailable: false,
        progressPersistenceAvailable: false,
      })
      expect(canActivateCrrtRecord(tool)).toBe(false)
    }
    expect(
      baxterCrrtInstructionalToolManifest
        .filter((tool) => tool.reviewerRuntimeAvailable)
        .map((tool) => tool.id),
    ).toEqual([
      'LAB-TRANSPORT',
      'LAB-PRESCRIPTION',
      'LAB-PREPOST-DILUTION',
      'LAB-PRESSURE-LOCALIZATION',
      'LAB-FLUID-LEDGER',
      'LAB-CITRATE-DASHBOARD',
    ])
    expect(
      baxterCrrtInstructionalToolManifest.find((tool) => tool.id === 'LAB-PRESSURE-LOCALIZATION'),
    ).toMatchObject({
      activationState: 'draft-reviewer-only',
      reviewerRuntimeAvailable: true,
      learnerAvailable: false,
      scoringAvailable: false,
      progressPersistenceAvailable: false,
      reviewStatus: 'pending',
    })
    expect(
      baxterCrrtInstructionalToolManifest.find((tool) => tool.id === 'LAB-CITRATE-DASHBOARD'),
    ).toMatchObject({ activationState: 'protocol-blocked', reviewerRuntimeAvailable: true })
  })

  it('scaffolds Mastery rules while keeping capstone content and activation absent', () => {
    expect(baxterCrrtMasteryManifest).toMatchObject({
      activationState: 'manifest-only',
      reviewStatus: 'pending',
      learnerTitleBeforeDebrief: 'Unseen PrisMax capstone',
      revealingTitle: null,
      minimumProblemDomains: 2,
      minimumScoreCandidate: 80,
      minimumScoreReviewer: null,
      hintsAllowed: false,
      cleanStateRequired: true,
      criticalErrorsAllowed: 0,
      reassessmentRequired: true,
      runtimeCaseIds: [],
      exactCandidateIdentity: null,
      candidateManifestSha256: null,
      expectedFindingsLedgerSha256: null,
      expectedAuthorizationScopeSha256: null,
      expectedReviewScopeSha256ByDomain: null,
      expectedPilotAcceptanceReference: null,
      expectedPhase8StablePrismaxPrerequisite: null,
      activationAuthorization: null,
    })
    expect(baxterCrrtMasteryManifest.requiredReviews.map((review) => review.domain)).toEqual([
      ...CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
    ])
    expect(baxterCrrtMasteryAvailable).toBe(false)
  })

  it('represents missing evidence and reviewer assignments explicitly', () => {
    const ids = new Set(baxterCrrtPhase7EvidenceRequirements.map((record) => record.id))
    expect(ids).toEqual(
      new Set([
        'CLIN-001',
        'PROTO-001',
        'BRIEF-MASTERY-001',
        'SAFETY-001',
        'SAFETY-002',
        'SAFETY-003',
        'SAFETY-005',
        'SAFETY-006',
        'SAFETY-007',
        'SAFETY-009',
        'SAFETY-010',
        'SAFETY-011',
        'SAFETY-012',
        'SAFETY-013',
      ]),
    )
    expect(
      baxterCrrtPhase7EvidenceRequirements.every(
        (record) =>
          record.contentVersion === BAXTER_CRRT_PHASE_7_CONTENT_VERSION &&
          record.reviewStatus === 'pending' &&
          record.reviewer === null &&
          record.activationAllowed === false,
      ),
    ).toBe(true)
  })

  it('resolves every catalog, drill, and Mastery evidence ID to a materialized record', () => {
    const knownIds = new Set([
      ...baxterCrrtSourceRecords.map((record) => record.id),
      ...baxterCrrtEngineSourceRecords.map((record) => record.id),
      ...baxterCrrtPilotSourceReferences.map((record) => record.id),
      ...baxterCrrtPhase7SourceReferences.map((record) => record.id),
      ...baxterCrrtPhase7EvidenceRequirements.map((record) => record.id),
    ])
    const referencedIds = [
      ...baxterCrrtCaseCatalog.flatMap((entry) => entry.sourceRecordIds),
      ...baxterCrrtRapidDrillManifest.flatMap((drill) => drill.sourceRecordIds),
      ...baxterCrrtInstructionalToolManifest.flatMap((tool) => tool.sourceRecordIds),
      baxterCrrtMasteryManifest.minimumScoreSourceId,
    ]
    expect([...new Set(referencedIds)].filter((id) => !knownIds.has(id))).toEqual([])
  })
})
