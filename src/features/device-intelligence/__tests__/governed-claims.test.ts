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
  assessGovernedClaimStaleness,
  assessRuntimeIngestionEligibility,
  buildGovernedClaimImpactReport,
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
    const secondary: ClaimEvidence = {
      ...approved.evidence[0],
      evidenceClass: 'secondary',
    }
    expect(codes(rebindEvidence(approved, [secondary]))).toContain(
      'compatibility_approval_without_primary_evidence',
    )
  })

  it('rejects generic equivalence, substitution, and interchangeability claim types', () => {
    for (const claimType of ['generic_equivalence', 'substitution', 'interchangeability']) {
      const raw = { ...createFictionalResearchCandidate(), claimType }
      expect(codes(raw)).toContain('generic_equivalence_or_substitution_claim_type')
    }
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
