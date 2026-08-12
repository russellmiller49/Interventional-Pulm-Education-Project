import {
  appendClaimReview,
  appendImplementationStatus,
  appendReleaseImpactAssessment,
  createResearchCandidate,
  transitionGovernedClaim,
  type ClaimEvidence,
  type GovernedClaim,
  type PersonReference,
  type PhysicianOwner,
} from '@/features/device-intelligence/domain/governed-claims'

/**
 * Deliberately fictional identifiers and statements. These fixtures prove governance mechanics;
 * they are not product evidence, clinical guidance, or approvals for repository runtime data.
 */

export const FICTIONAL_CLAIM_ID = 'FICT-CLAIM-COMPATIBILITY-001'
export const FICTIONAL_PRODUCT_ID = 'FICT-PRODUCT-MODEL-X'
export const FICTIONAL_RELEASE_ID = 'release-fictional-training-v1'

export const fictionalResearcher: PersonReference = {
  personId: 'FICT-PERSON-RESEARCHER',
  displayName: 'Fictional Researcher',
}

export const fictionalPhysicianOwner: PhysicianOwner = {
  personId: 'FICT-PERSON-PHYSICIAN-OWNER',
  displayName: 'Dr Fictional Physician Owner',
  qualification: 'physician',
}

export const fictionalReleaseReviewer: PersonReference = {
  personId: 'FICT-PERSON-RELEASE-REVIEWER',
  displayName: 'Fictional Release Reviewer',
}

export interface FictionalClaimOptions {
  claimId?: string
  supersedesClaimIds?: string[]
  releaseBundleId?: string
}

export function fictionalPrimaryEvidence(): ClaimEvidence {
  return {
    evidenceId: 'FICT-EVIDENCE-IFU-001',
    sourceIdentity: {
      sourceId: 'FICT-SOURCE-MANUFACTURER-IFU',
      publisher: 'Fictional Airway Devices, Inc.',
      title: 'Fictional Model X Accessory Instructions',
      documentIdentifier: 'FICT-IFU-MODEL-X',
      sourceUrl: null,
    },
    sourceRevision: {
      revisionId: 'Rev A (fictional)',
      issuedAt: '2026-01-15T00:00:00.000Z',
      accessedAt: '2026-02-01T00:00:00.000Z',
    },
    jurisdiction: {
      code: 'FICTIONAL-MANUFACTURER-GLOBAL',
      label: 'Fictional manufacturer labeling scope',
      level: 'manufacturer_global',
    },
    locator: 'Fictional section 4.2, accessory connection table',
    sourceType: 'manufacturer_ifu',
    evidenceClass: 'primary',
    decisionUse: 'primary_claim_support',
    applicability: { kind: 'exact_model', productId: FICTIONAL_PRODUCT_ID },
  }
}

export function createFictionalResearchCandidate(
  options: FictionalClaimOptions = {},
): GovernedClaim {
  const claimId = options.claimId ?? FICTIONAL_CLAIM_ID
  return createResearchCandidate({
    claimId,
    claimStatement:
      'In this fictional fixture, Model X uses Connector A only under the configuration explicitly described by its fictional instructions.',
    claimType: 'compatibility',
    targets: {
      affectedProductIds: [FICTIONAL_PRODUCT_ID],
      affectedRoleCodes: ['FICT_AIRWAY_CONNECTOR'],
      affectedProcedureCodes: ['FICT_TRAINING_PROCEDURE'],
    },
    scope: {
      kind: 'exact_model',
      productId: FICTIONAL_PRODUCT_ID,
      manufacturer: 'Fictional Airway Devices, Inc.',
      modelName: 'Model X (fictional)',
      catalogNumber: 'FICT-X-001',
    },
    evidence: [fictionalPrimaryEvidence()],
    evidenceConflicts: [],
    stalenessPolicy: {
      thresholdDays: 365,
      basis: 'latest_physician_approval',
      rationale:
        'Fictional local policy for exercising deterministic staleness; no external source establishes this interval.',
    },
    physicianOwner: fictionalPhysicianOwner,
    supersedesClaimIds: options.supersedesClaimIds,
    historicalRetentionRationale:
      'Retain every fictional lifecycle state so tests can reconstruct the reviewed record.',
    createdAt: '2026-02-02T00:00:00.000Z',
    createdBy: fictionalResearcher,
    creationRationale: 'Fictional research candidate created only to test the governance contract.',
  })
}

export function createFictionalApprovedClaim(options: FictionalClaimOptions = {}): GovernedClaim {
  let claim = transitionGovernedClaim(createFictionalResearchCandidate(options), {
    toState: 'physician_review_required',
    occurredAt: '2026-02-03T00:00:00.000Z',
    actor: fictionalResearcher,
    rationale: 'Fictional evidence packet is ready for physician review.',
  })
  claim = appendClaimReview(claim, {
    reviewId: `${claim.claimId}:review:physician:1`,
    reviewer: {
      personId: fictionalPhysicianOwner.personId,
      displayName: fictionalPhysicianOwner.displayName,
      reviewerRole: 'physician',
    },
    reviewedAt: '2026-02-04T00:00:00.000Z',
    decision: 'approved',
    rationale:
      'Fictional approval used only to prove exact claim-content and evidence-set binding.',
  })
  return transitionGovernedClaim(claim, {
    toState: 'approved_for_governed_authoring',
    occurredAt: '2026-02-05T00:00:00.000Z',
    actor: fictionalPhysicianOwner,
    rationale: 'Fictional claim may enter fictional governed authoring.',
  })
}

export function createFictionalPublishedClaim(options: FictionalClaimOptions = {}): GovernedClaim {
  const releaseBundleId = options.releaseBundleId ?? FICTIONAL_RELEASE_ID
  let claim = createFictionalApprovedClaim(options)
  claim = appendImplementationStatus(claim, {
    status: 'governed_authoring_ready',
    recordedAt: '2026-02-06T00:00:00.000Z',
    recordedBy: fictionalReleaseReviewer,
    releaseBundleId: null,
    artifactPaths: [],
    rationale: 'Fictional authoring handoff recorded.',
  })
  claim = appendImplementationStatus(claim, {
    status: 'implemented_in_draft',
    recordedAt: '2026-02-07T00:00:00.000Z',
    recordedBy: fictionalReleaseReviewer,
    releaseBundleId,
    artifactPaths: ['fictional://governed-authoring/example'],
    rationale: 'Fictional draft implementation recorded without touching runtime data.',
  })
  claim = appendReleaseImpactAssessment(claim, {
    assessmentId: 'FICT-IMPACT-001',
    releaseBundleId,
    relationship: 'published_forward_release',
    impact: 'content_change_required',
    assessedAt: '2026-02-08T00:00:00.000Z',
    assessedBy: fictionalReleaseReviewer,
    rationale: 'Fictional release impact used only by domain tests.',
  })
  claim = appendImplementationStatus(claim, {
    status: 'verified_in_forward_release',
    recordedAt: '2026-02-09T00:00:00.000Z',
    recordedBy: fictionalReleaseReviewer,
    releaseBundleId,
    artifactPaths: ['fictional://governed-authoring/example'],
    rationale: 'Fictional forward-release verification used only by domain tests.',
  })
  return transitionGovernedClaim(claim, {
    toState: 'published_in_forward_release',
    occurredAt: '2026-02-10T00:00:00.000Z',
    actor: fictionalReleaseReviewer,
    releaseBundleId,
    rationale: 'Fictional publication transition used only by domain tests.',
  })
}
