import {
  FICTIONAL_CLAIM_ID,
  FICTIONAL_PRODUCT_ID,
  FICTIONAL_RELEASE_ID,
  createFictionalApprovedClaim,
  createFictionalPublishedClaim,
  createFictionalResearchCandidate,
  fictionalPhysicianOwner,
  fictionalResearcher,
} from '@/features/device-intelligence/__fixtures__/governed-claims'
import {
  GOVERNED_CLAIM_FORMAT_VERSION,
  appendClaimReview,
  appendImplementationStatus,
  appendReleaseImpactAssessment,
  assessGovernedClaimStaleness,
  assessRuntimeIngestionEligibility,
  buildGovernedClaimImpactReport,
  compatibilityEligiblePrimarySourceTypes,
  governedClaimContentHash,
  governedClaimEvidenceSetHash,
  transitionGovernedClaim,
  validateGovernedClaim,
  validateGovernedClaimLedger,
  validateGovernedClaimMutation,
  type ClaimEvidence,
  type EvidenceConflict,
  type GovernedClaim,
} from '@/features/device-intelligence/domain/governed-claims'

function cloneClaim(claim: GovernedClaim): GovernedClaim {
  return JSON.parse(JSON.stringify(claim)) as GovernedClaim
}

/** Simulate a complete new evidence review so a scope gate is tested, not a stale hash. */
function rebindEvidence(
  claim: GovernedClaim,
  evidence: ClaimEvidence[],
  evidenceConflicts: EvidenceConflict[] = claim.evidenceConflicts,
): GovernedClaim {
  const evidenceSetHash = governedClaimEvidenceSetHash(evidence, evidenceConflicts)
  return {
    ...claim,
    evidence,
    evidenceConflicts,
    evidenceSetHash,
    reviews: claim.reviews.map((review) => ({ ...review, evidenceSetHash })),
    transitions: claim.transitions.map((transition) => ({ ...transition, evidenceSetHash })),
  }
}

/** Simulate a fresh content signoff so prose rules are tested, not stale hashes. */
function rebindClaimStatement(claim: GovernedClaim, claimStatement: string): GovernedClaim {
  const rebound = { ...claim, claimStatement }
  const claimContentHash = governedClaimContentHash(rebound)
  return {
    ...rebound,
    claimContentHash,
    reviews: rebound.reviews.map((review) => ({ ...review, claimContentHash })),
    transitions: rebound.transitions.map((transition) => ({ ...transition, claimContentHash })),
  }
}

function codes(claim: unknown): string[] {
  return validateGovernedClaim(claim).map((entry) => entry.code)
}

describe('governed claim lifecycle foundation', () => {
  it('keeps every fixture identity explicitly fictional and starts outside runtime', () => {
    const candidate = createFictionalResearchCandidate()
    expect(candidate.claimId).toBe(FICTIONAL_CLAIM_ID)
    expect(candidate.claimId).toMatch(/^FICT-/u)
    expect(candidate.targets.affectedProductIds).toEqual([FICTIONAL_PRODUCT_ID])
    expect(candidate.lifecycleState).toBe('research_candidate')
    expect(validateGovernedClaim(candidate)).toEqual([])
    expect(assessRuntimeIngestionEligibility(candidate, '2026-03-01T00:00:00.000Z')).toEqual({
      eligible: false,
      code: 'research_candidate_not_runtime_eligible',
    })
  })

  it('allows only the next append-only lifecycle state', () => {
    const candidate = createFictionalResearchCandidate()
    expect(() =>
      transitionGovernedClaim(candidate, {
        toState: 'approved_for_governed_authoring',
        occurredAt: '2026-02-03T00:00:00.000Z',
        actor: fictionalResearcher,
        rationale: 'Deliberately invalid skipped state.',
      }),
    ).toThrow('the next append-only state is physician_review_required')

    const reviewRequired = transitionGovernedClaim(candidate, {
      toState: 'physician_review_required',
      occurredAt: '2026-02-03T00:00:00.000Z',
      actor: fictionalResearcher,
      rationale: 'Fictional packet ready for review.',
    })
    expect(reviewRequired.transitions.map((entry) => entry.toState)).toEqual([
      'research_candidate',
      'physician_review_required',
    ])
    expect(validateGovernedClaim(reviewRequired)).toEqual([])
  })

  it('binds physician review to the exact claim content and evidence set', () => {
    let claim = transitionGovernedClaim(createFictionalResearchCandidate(), {
      toState: 'physician_review_required',
      occurredAt: '2026-02-03T00:00:00.000Z',
      actor: fictionalResearcher,
      rationale: 'Fictional packet ready for review.',
    })
    claim = appendClaimReview(claim, {
      reviewId: 'FICT-REVIEW-BINDING',
      reviewer: {
        personId: fictionalPhysicianOwner.personId,
        displayName: fictionalPhysicianOwner.displayName,
        reviewerRole: 'physician',
      },
      reviewedAt: '2026-02-04T00:00:00.000Z',
      decision: 'approved',
      rationale: 'Fictional exact-binding review.',
    })
    expect(claim.reviews[0]).toEqual(
      expect.objectContaining({
        claimId: claim.claimId,
        claimContentHash: claim.claimContentHash,
        evidenceSetHash: claim.evidenceSetHash,
      }),
    )

    const approved = transitionGovernedClaim(claim, {
      toState: 'approved_for_governed_authoring',
      occurredAt: '2026-02-05T00:00:00.000Z',
      actor: fictionalPhysicianOwner,
      rationale: 'Fictional authoring approval.',
    })
    const tampered = cloneClaim(approved)
    tampered.reviews[0].claimContentHash = '0'.repeat(64)
    expect(codes(tampered)).toContain('approval_signoff_binding_mismatch')
  })

  it('rejects an approved state without a named physician owner', () => {
    const claim = cloneClaim(createFictionalApprovedClaim())
    claim.physicianOwner = null
    expect(codes(claim)).toContain('approved_without_named_physician_owner')
  })

  it('rejects governed and published states without retained evidence', () => {
    const approved = rebindEvidence(createFictionalApprovedClaim(), [])
    expect(codes(approved)).toContain('governed_state_without_evidence')

    const published = rebindEvidence(createFictionalPublishedClaim(), [])
    expect(codes(published)).toContain('governed_state_without_evidence')
  })

  it('rejects exact-model approval based on unqualified family evidence', () => {
    const approved = createFictionalApprovedClaim()
    const unqualified: ClaimEvidence = {
      ...approved.evidence[0],
      applicability: {
        kind: 'family_evidence',
        productFamilyVersionId: 'FICT-FAMILY-V1',
        qualification: null,
      },
    }
    expect(codes(rebindEvidence(approved, [unqualified]))).toContain(
      'model_approval_from_unqualified_family_evidence',
    )
  })

  it('rejects compatibility approval without explicit applicable primary evidence', () => {
    const approved = createFictionalApprovedClaim()
    for (const evidenceClass of ['secondary', 'contextual'] as const) {
      const nonPrimary: ClaimEvidence = {
        ...approved.evidence[0],
        evidenceClass,
      }
      expect(codes(rebindEvidence(approved, [nonPrimary]))).toContain(
        'compatibility_approval_without_primary_evidence',
      )
    }
  })

  it('allows only explicit exact-model primary source types to support compatibility approval', () => {
    expect(compatibilityEligiblePrimarySourceTypes).toEqual([
      'manufacturer_labeling',
      'manufacturer_ifu',
      'manufacturer_manual',
      'regulator_record',
    ])

    const approved = createFictionalApprovedClaim()
    for (const sourceType of compatibilityEligiblePrimarySourceTypes) {
      const eligibleExactModelEvidence: ClaimEvidence = {
        ...approved.evidence[0],
        sourceType,
      }
      expect(codes(rebindEvidence(approved, [eligibleExactModelEvidence]))).not.toContain(
        'compatibility_approval_without_primary_evidence',
      )
    }
    for (const sourceType of [
      'professional_society_guidance',
      'regulator_guidance',
      'peer_reviewed_literature',
      'internal_review_record',
    ] as const) {
      const relabeledGuidance: ClaimEvidence = {
        ...approved.evidence[0],
        sourceType,
        evidenceClass: 'primary',
        decisionUse: 'primary_claim_support',
      }
      expect(codes(rebindEvidence(approved, [relabeledGuidance]))).toContain(
        'compatibility_approval_without_primary_evidence',
      )
    }
  })

  it('requires exact product/model scope for primary compatibility evidence', () => {
    const approved = createFictionalApprovedClaim()
    const wrongModel: ClaimEvidence = {
      ...approved.evidence[0],
      applicability: { kind: 'exact_model', productId: 'FICT-PRODUCT-MODEL-Y' },
    }
    expect(codes(rebindEvidence(approved, [wrongModel]))).toContain(
      'compatibility_approval_without_primary_evidence',
    )

    const qualifiedFamilyOnly: ClaimEvidence = {
      ...approved.evidence[0],
      applicability: {
        kind: 'family_evidence',
        productFamilyVersionId: 'FICT-FAMILY-V1',
        qualification: {
          qualifiedProductIds: [FICTIONAL_PRODUCT_ID],
          basis: 'Fictional reviewer qualification for the model-approval gate only.',
          reviewedBy: {
            personId: fictionalPhysicianOwner.personId,
            displayName: fictionalPhysicianOwner.displayName,
          },
          reviewedAt: '2026-02-02T12:00:00.000Z',
        },
      },
    }
    expect(codes(rebindEvidence(approved, [qualifiedFamilyOnly]))).toContain(
      'compatibility_approval_without_primary_evidence',
    )
  })

  it('rejects generic relationship-decision claim types', () => {
    for (const claimType of [
      'generic_equivalence',
      'substitution',
      'interchangeability',
      'replacement',
      'alternative_product',
    ]) {
      const raw = { ...createFictionalResearchCandidate(), claimType }
      expect(codes(raw)).toContain('generic_equivalence_or_substitution_claim_type')
    }
  })

  it.each([
    'Fictional Model X is clinically equivalent to Fictional Model Y.',
    'Fictional Model X can be substituted for Fictional Model Y.',
    'Fictional Model X is interchangeable with Fictional Model Y.',
    'Fictional Model X is a replacement for Fictional Model Y.',
    'Fictional Model X is an alternative product to Fictional Model Y.',
    'Fictional Model X may be used interchangeably with Fictional Model Y.',
    'Fictional Model X may be used as an alternative product to Fictional Model Y.',
    'Fictional Model X is a replacement device for Fictional Model Y.',
    'Fictional Model X is a viable alternative to Fictional Model Y.',
  ])('rejects forbidden relationship decisions in claim prose: %s', (claimStatement) => {
    const claim = rebindClaimStatement(createFictionalResearchCandidate(), claimStatement)
    expect(codes(claim)).toContain('forbidden_relationship_decision_language')
  })

  it('rejects forbidden relationship decisions hidden in decision-bearing rationale', () => {
    const claim = cloneClaim(createFictionalApprovedClaim())
    claim.reviews[0].rationale = 'Fictional Model X is clinically equivalent to Fictional Model Y.'
    expect(codes(claim)).toContain('forbidden_relationship_decision_language')
  })

  it('rejects forbidden relationship decisions hidden in an evidence-conflict summary', () => {
    const candidate = createFictionalResearchCandidate()
    const secondEvidence: ClaimEvidence = {
      ...candidate.evidence[0],
      evidenceId: 'FICT-EVIDENCE-SECOND-002',
    }
    const claim = rebindEvidence(
      candidate,
      [candidate.evidence[0], secondEvidence],
      [
        {
          conflictId: 'FICT-CONFLICT-DECISION-001',
          evidenceIds: [candidate.evidence[0].evidenceId, secondEvidence.evidenceId],
          summary: 'Fictional Model X is interchangeable with Fictional Model Y.',
          status: 'unresolved',
          resolutionRationale: null,
          resolvedByReviewId: null,
        },
      ],
    )
    expect(codes(claim)).toContain('forbidden_relationship_decision_language')
  })

  it.each([
    'This claim does not establish equivalence, substitution, interchangeability, replacement, or an alternative-product relationship.',
    'There is no evidence that Fictional Model X is equivalent to Fictional Model Y.',
    'Whether Fictional Model X is interchangeable with Fictional Model Y remains unresolved.',
    'Fictional Model X must not be treated as clinically equivalent to Fictional Model Y.',
    'Replacement connector packaging must remain sealed during this fictional setup.',
  ])('does not reject explicit limitations or incidental terminology: %s', (claimStatement) => {
    const claim = rebindClaimStatement(createFictionalResearchCandidate(), claimStatement)
    expect(codes(claim)).not.toContain('forbidden_relationship_decision_language')
  })

  it('enforces the cross-history partial order on retained records', () => {
    const reviewRequiredBeforeCreation = cloneClaim(createFictionalApprovedClaim())
    reviewRequiredBeforeCreation.transitions[1].occurredAt = '2000-01-01T00:00:00.000Z'
    expect(codes(reviewRequiredBeforeCreation)).toContain('history_partial_order_invalid')

    const reviewBeforeClaim = cloneClaim(createFictionalApprovedClaim())
    reviewBeforeClaim.reviews[0].reviewedAt = '2000-01-01T00:00:00.000Z'
    expect(codes(reviewBeforeClaim)).toContain('history_partial_order_invalid')

    const reviewAfterApproval = cloneClaim(createFictionalApprovedClaim())
    reviewAfterApproval.reviews[0].reviewedAt = '2030-01-01T00:00:00.000Z'
    expect(codes(reviewAfterApproval)).toContain('history_partial_order_invalid')

    const approved = createFictionalApprovedClaim()
    const futureEvidence: ClaimEvidence = {
      ...approved.evidence[0],
      sourceRevision: {
        ...approved.evidence[0].sourceRevision,
        accessedAt: '2030-01-01T00:00:00.000Z',
      },
    }
    expect(codes(rebindEvidence(approved, [futureEvidence]))).toContain(
      'history_partial_order_invalid',
    )

    const implementationBeforeClaim = cloneClaim(createFictionalPublishedClaim())
    implementationBeforeClaim.implementationHistory[1].recordedAt = '2000-01-01T00:00:00.000Z'
    expect(codes(implementationBeforeClaim)).toContain('history_partial_order_invalid')

    const initialImplementationBeforeClaim = cloneClaim(createFictionalResearchCandidate())
    initialImplementationBeforeClaim.implementationHistory[0].recordedAt =
      '2000-01-01T00:00:00.000Z'
    expect(codes(initialImplementationBeforeClaim)).toContain('history_partial_order_invalid')

    const impactBeforeClaim = cloneClaim(createFictionalPublishedClaim())
    impactBeforeClaim.affectedReleaseAssessments[0].assessedAt = '2000-01-01T00:00:00.000Z'
    expect(codes(impactBeforeClaim)).toContain('history_partial_order_invalid')

    const verificationAfterPublication = cloneClaim(createFictionalPublishedClaim())
    verificationAfterPublication.implementationHistory[3].recordedAt = '2030-01-01T00:00:00.000Z'
    expect(codes(verificationAfterPublication)).toContain('history_partial_order_invalid')

    const publicationAssessmentAfterPublication = cloneClaim(createFictionalPublishedClaim())
    publicationAssessmentAfterPublication.affectedReleaseAssessments[0].assessedAt =
      '2030-01-01T00:00:00.000Z'
    expect(codes(publicationAssessmentAfterPublication)).toContain('history_partial_order_invalid')
  })

  it('refuses append operations that would violate the cross-history partial order', () => {
    expect(() =>
      transitionGovernedClaim(createFictionalResearchCandidate(), {
        toState: 'physician_review_required',
        occurredAt: '2000-01-01T00:00:00.000Z',
        actor: fictionalResearcher,
        rationale: 'Deliberately invalid fictional review-required transition time.',
      }),
    ).toThrow('history_partial_order_invalid')

    const reviewRequired = transitionGovernedClaim(createFictionalResearchCandidate(), {
      toState: 'physician_review_required',
      occurredAt: '2026-02-03T00:00:00.000Z',
      actor: fictionalResearcher,
      rationale: 'Fictional packet ready for review.',
    })
    expect(() =>
      appendClaimReview(reviewRequired, {
        reviewId: 'FICT-REVIEW-BEFORE-CREATION',
        reviewer: {
          personId: fictionalPhysicianOwner.personId,
          displayName: fictionalPhysicianOwner.displayName,
          reviewerRole: 'physician',
        },
        reviewedAt: '2000-01-01T00:00:00.000Z',
        decision: 'approved',
        rationale: 'Deliberately invalid fictional review time.',
      }),
    ).toThrow('history_partial_order_invalid')

    const futureEvidence: ClaimEvidence = {
      ...reviewRequired.evidence[0],
      sourceRevision: {
        ...reviewRequired.evidence[0].sourceRevision,
        accessedAt: '2030-01-01T00:00:00.000Z',
      },
    }
    const reviewRequiredWithFutureEvidence = rebindEvidence(reviewRequired, [futureEvidence])
    expect(() =>
      appendClaimReview(reviewRequiredWithFutureEvidence, {
        reviewId: 'FICT-REVIEW-BEFORE-EVIDENCE-ACCESS',
        reviewer: {
          personId: fictionalPhysicianOwner.personId,
          displayName: fictionalPhysicianOwner.displayName,
          reviewerRole: 'physician',
        },
        reviewedAt: '2026-02-04T00:00:00.000Z',
        decision: 'approved',
        rationale: 'Deliberately invalid fictional evidence-access order.',
      }),
    ).toThrow('history_partial_order_invalid')

    const approved = createFictionalApprovedClaim()
    expect(() =>
      appendImplementationStatus(approved, {
        status: 'governed_authoring_ready',
        recordedAt: '2000-01-01T00:00:00.000Z',
        recordedBy: fictionalResearcher,
        releaseBundleId: null,
        artifactPaths: [],
        rationale: 'Deliberately invalid fictional implementation time.',
      }),
    ).toThrow('history_partial_order_invalid')
    expect(() =>
      appendReleaseImpactAssessment(approved, {
        assessmentId: 'FICT-IMPACT-BEFORE-CREATION',
        releaseBundleId: FICTIONAL_RELEASE_ID,
        relationship: 'planned_forward_release',
        impact: 'review_only',
        assessedAt: '2000-01-01T00:00:00.000Z',
        assessedBy: fictionalResearcher,
        rationale: 'Deliberately invalid fictional release-impact time.',
      }),
    ).toThrow('history_partial_order_invalid')
  })

  it('retains unresolved evidence conflicts and blocks approval', () => {
    const approved = createFictionalApprovedClaim()
    const corroborating: ClaimEvidence = {
      ...approved.evidence[0],
      evidenceId: 'FICT-EVIDENCE-CONFLICTING-002',
      decisionUse: 'conflicting',
      evidenceClass: 'secondary',
    }
    const conflicts: EvidenceConflict[] = [
      {
        conflictId: 'FICT-CONFLICT-001',
        evidenceIds: [approved.evidence[0].evidenceId, corroborating.evidenceId],
        summary: 'Fictional sources disagree.',
        status: 'unresolved',
        resolutionRationale: null,
        resolvedByReviewId: null,
      },
    ]
    const rebound = rebindEvidence(approved, [approved.evidence[0], corroborating], conflicts)
    expect(codes(rebound)).toContain('approved_with_unresolved_evidence_conflict')
  })

  it('rejects source revision loss and rewritten append-only history', () => {
    const previous = createFictionalResearchCandidate()
    const revised = cloneClaim(previous)
    revised.evidence[0].sourceRevision.revisionId = 'Rev B (attempted in-place rewrite)'
    revised.evidenceSetHash = governedClaimEvidenceSetHash(
      revised.evidence,
      revised.evidenceConflicts,
    )
    revised.transitions[0].evidenceSetHash = revised.evidenceSetHash
    expect(validateGovernedClaimMutation(previous, revised).map((entry) => entry.code)).toContain(
      'source_revision_loss',
    )

    const advanced = transitionGovernedClaim(previous, {
      toState: 'physician_review_required',
      occurredAt: '2026-02-03T00:00:00.000Z',
      actor: fictionalResearcher,
      rationale: 'Fictional packet ready for review.',
    })
    advanced.transitions.reverse()
    expect(validateGovernedClaimMutation(previous, advanced).map((entry) => entry.code)).toContain(
      'append_only_history_rewritten',
    )
  })

  it('rejects historical deletion and ledger removal against a baseline', () => {
    const claim = createFictionalResearchCandidate()
    expect(validateGovernedClaimMutation(claim, null).map((entry) => entry.code)).toEqual([
      'historical_deletion_forbidden',
    ])
    const baseline = { formatVersion: GOVERNED_CLAIM_FORMAT_VERSION, claims: [claim] }
    const next = { formatVersion: GOVERNED_CLAIM_FORMAT_VERSION, claims: [] }
    expect(
      validateGovernedClaimLedger(next, { baselineLedger: baseline }).map((entry) => entry.code),
    ).toContain('historical_deletion_forbidden')
  })

  it('requires an explicit superseding claim id and preserves the historical record', () => {
    const published = createFictionalPublishedClaim()
    expect(() =>
      transitionGovernedClaim(published, {
        toState: 'superseded',
        occurredAt: '2026-03-01T00:00:00.000Z',
        actor: fictionalPhysicianOwner,
        rationale: 'Deliberately silent supersession.',
      }),
    ).toThrow('silent supersession is forbidden')

    const superseded = transitionGovernedClaim(published, {
      toState: 'superseded',
      occurredAt: '2026-03-01T00:00:00.000Z',
      actor: fictionalPhysicianOwner,
      supersedingClaimId: 'FICT-CLAIM-COMPATIBILITY-002',
      rationale: 'Fictional claim explicitly superseded by a named successor.',
    })
    const retained = transitionGovernedClaim(superseded, {
      toState: 'historical_retained',
      occurredAt: '2026-03-02T00:00:00.000Z',
      actor: fictionalPhysicianOwner,
      rationale: 'Fictional superseded record retained for reconstruction.',
    })
    expect(retained.historicalRetention).toEqual(
      expect.objectContaining({
        policy: 'append_only_indefinite',
        retainedAt: '2026-03-02T00:00:00.000Z',
      }),
    )
    expect(validateGovernedClaim(retained)).toEqual([])
  })

  it('requires a retained, published successor and explicit bidirectional ledger links', () => {
    const successorId = 'FICT-CLAIM-COMPATIBILITY-002'
    const successor = createFictionalPublishedClaim({
      claimId: successorId,
      supersedesClaimIds: [FICTIONAL_CLAIM_ID],
      releaseBundleId: 'release-fictional-training-v2',
    })
    const predecessor = transitionGovernedClaim(createFictionalPublishedClaim(), {
      toState: 'superseded',
      occurredAt: '2026-03-01T00:00:00.000Z',
      actor: fictionalPhysicianOwner,
      supersedingClaimId: successorId,
      rationale: 'Fictional predecessor explicitly names its published successor.',
    })
    expect(
      validateGovernedClaimLedger({
        formatVersion: GOVERNED_CLAIM_FORMAT_VERSION,
        claims: [predecessor, successor],
      }),
    ).toEqual([])

    const candidateSuccessor = createFictionalResearchCandidate({
      claimId: successorId,
      supersedesClaimIds: [FICTIONAL_CLAIM_ID],
    })
    expect(
      validateGovernedClaimLedger({
        formatVersion: GOVERNED_CLAIM_FORMAT_VERSION,
        claims: [predecessor, candidateSuccessor],
      }).map((entry) => entry.code),
    ).toContain('superseding_claim_not_published')
  })

  it('requires publication, matching release evidence, current review, and verified implementation for runtime', () => {
    const published = createFictionalPublishedClaim()
    expect(validateGovernedClaim(published)).toEqual([])
    expect(published.transitions.at(-1)?.releaseBundleId).toBe(FICTIONAL_RELEASE_ID)
    expect(assessRuntimeIngestionEligibility(published, '2026-06-01T00:00:00.000Z')).toEqual({
      eligible: true,
      code: 'published_current_and_verified',
    })
    expect(assessGovernedClaimStaleness(published, '2027-02-04T00:00:00.000Z').state).toBe('stale')
    expect(assessRuntimeIngestionEligibility(published, '2027-02-04T00:00:00.000Z')).toEqual({
      eligible: false,
      code: 'staleness_not_current',
    })
  })

  it('builds a byte-stable descriptive impact report from explicit inputs', () => {
    const claim = createFictionalPublishedClaim()
    const first = buildGovernedClaimImpactReport(claim, '2026-06-01T00:00:00.000Z')
    const second = buildGovernedClaimImpactReport(cloneClaim(claim), '2026-06-01T00:00:00.000Z')
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first).toEqual(
      expect.objectContaining({
        claimId: FICTIONAL_CLAIM_ID,
        lifecycleState: 'published_in_forward_release',
        blockingValidationCodes: [],
      }),
    )
    expect(first.reportHash).toMatch(/^[a-f0-9]{64}$/u)
    expect(first.affectedReleaseAssessments.map((entry) => entry.releaseBundleId)).toEqual([
      FICTIONAL_RELEASE_ID,
    ])
  })
})
