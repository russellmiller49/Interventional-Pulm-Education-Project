import {
  BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX,
  isBaxterCrrtExactCandidateIdentity,
} from './candidateIdentity'
import {
  hasCompleteCrrtPhase7Authorization,
  hasCompleteCrrtPhase8Authorization,
  type CrrtActivationAuthorizationAttestation,
  type CrrtPilotAcceptanceAuthorizationReference,
  type CrrtPhase8StablePrismaxPrerequisite,
} from './authorization'
import {
  getCrrtArtifactClassification,
  isCrrtActivatableArtifactId,
  type CrrtActivatableArtifactId,
  type CrrtArtifactReviewScope,
  type CrrtReleaseArtifactId,
} from './artifactRegistry'
import {
  CRRT_EXACT_VERSION_DISPOSITIONS,
  hasCompleteBaxterCrrtReviewAttestationFields,
  isBaxterCrrtAttestationSha256,
  isBaxterCrrtIsoAttestationTime,
  type BaxterCrrtReviewAttestationFields,
  type CrrtExactVersionDisposition,
} from './reviewAttestation'
import type { BaxterCrrtReviewStatus } from './reviewStatus'

export { BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX, isBaxterCrrtExactCandidateIdentity }
export {
  CRRT_EXACT_VERSION_DISPOSITIONS,
  isBaxterCrrtAttestationSha256,
  isBaxterCrrtIsoAttestationTime,
}
export type { CrrtExactVersionDisposition }

/**
 * Availability is deliberately separate from review status. A record may be
 * technically complete yet still unavailable because a local protocol,
 * device configuration, or publication decision is missing.
 */
export type CrrtActivationState =
  | 'protected-pilot-active'
  | 'manifest-only'
  | 'draft-reviewer-only'
  | 'protocol-blocked'
  | 'policy-blocked'
  | 'learner-active'

export type CrrtReviewerDomain =
  | 'nephrology'
  | 'critical-care'
  | 'crrt-nurse-education'
  | 'prismax-device'
  | 'prismaflex-device'
  | 'cross-device-equivalence'
  | 'pharmacy'
  | 'nutrition'
  | 'accessibility'
  | 'localization'
  | 'privacy-data-governance'
  | 'entitlement-security'
  | 'product-owner'
  | 'publication-approval'
  | 'protocol-owner'

export const CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS = Object.freeze([
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
] as const satisfies readonly CrrtReviewerDomain[])

export const CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS = Object.freeze([
  'prismaflex-device',
  'cross-device-equivalence',
] as const satisfies readonly CrrtReviewerDomain[])

export type CrrtActivationReviewScope = CrrtArtifactReviewScope

export type CrrtExpectedReviewScopeSha256ByDomain = Readonly<
  Partial<Record<CrrtReviewerDomain, string>>
>

export interface CrrtReviewRequirement extends BaxterCrrtReviewAttestationFields {
  readonly domain: CrrtReviewerDomain
}

export interface CrrtActivationRecord {
  readonly id: CrrtActivatableArtifactId
  readonly exactCandidateIdentity: string | null
  readonly candidateManifestSha256: string | null
  readonly expectedFindingsLedgerSha256: string | null
  readonly expectedAuthorizationScopeSha256: string | null
  readonly expectedReviewScopeSha256ByDomain: CrrtExpectedReviewScopeSha256ByDomain | null
  readonly expectedPilotAcceptanceReference: CrrtPilotAcceptanceAuthorizationReference | null
  readonly expectedPhase8StablePrismaxPrerequisite: CrrtPhase8StablePrismaxPrerequisite | null
  readonly reviewScope: CrrtActivationReviewScope
  readonly activationAuthorization: CrrtActivationAuthorizationAttestation | null
  readonly activationState: CrrtActivationState
  readonly reviewStatus: BaxterCrrtReviewStatus
  readonly requiredReviews: readonly CrrtReviewRequirement[]
  readonly blockingInputs: readonly string[]
}

export function hasCompleteBaxterCrrtReviewAttestation(
  review: CrrtReviewRequirement,
  exactCandidateIdentity: string | null,
  candidateManifestSha256: string | null,
  findingsLedgerSha256: string | null,
  expectedReviewScopeSha256: string | null,
): boolean {
  return hasCompleteBaxterCrrtReviewAttestationFields(
    review,
    exactCandidateIdentity,
    candidateManifestSha256,
    findingsLedgerSha256,
    expectedReviewScopeSha256,
  )
}

function hasRequiredUniqueDomains(
  reviews: readonly CrrtReviewRequirement[],
  requiredDomains: readonly CrrtReviewerDomain[],
): boolean {
  const domains = reviews.map((review) => review.domain)
  const domainSet = new Set(domains)
  return (
    domainSet.size === domains.length &&
    domainSet.size === requiredDomains.length &&
    hasUniqueCrrtReviewAttestationReceipts(reviews) &&
    requiredDomains.every((domain) => domainSet.has(domain))
  )
}

export function hasExactExpectedReviewScopeMap(
  expectedScopes: CrrtExpectedReviewScopeSha256ByDomain | null,
  requiredDomains: readonly CrrtReviewerDomain[],
): expectedScopes is CrrtExpectedReviewScopeSha256ByDomain {
  if (expectedScopes === null) return false
  const suppliedDomains = Object.keys(expectedScopes)
  return (
    suppliedDomains.length === requiredDomains.length &&
    requiredDomains.every(
      (domain) =>
        suppliedDomains.includes(domain) &&
        isBaxterCrrtAttestationSha256(expectedScopes[domain] ?? null),
    )
  )
}

export function hasUniqueCrrtReviewAttestationReceipts(
  reviews: readonly CrrtReviewRequirement[],
): boolean {
  const attestationArtifactIds = reviews.map((review) => review.attestationArtifactId)
  const attestationSha256Digests = reviews.map((review) => review.attestationSha256)
  return (
    new Set(attestationArtifactIds).size === attestationArtifactIds.length &&
    new Set(attestationSha256Digests).size === attestationSha256Digests.length
  )
}

export function requiredCrrtReviewerDomainsForArtifacts(
  artifactIds: readonly CrrtReleaseArtifactId[],
): readonly CrrtReviewerDomain[] | null {
  if (artifactIds.length === 0 || new Set(artifactIds).size !== artifactIds.length) return null

  const classifications = artifactIds.map(getCrrtArtifactClassification)
  if (classifications.some((classification) => classification === null)) return null

  const requiredDomains = new Set<CrrtReviewerDomain>(CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS)
  for (const classification of classifications) {
    if (classification === null) return null
    if (classification.phase === 'phase-8') {
      for (const domain of CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS) {
        requiredDomains.add(domain)
      }
    }
    for (const domain of classification.requiredConditionalReviewerDomains) {
      requiredDomains.add(domain)
    }
  }
  return Object.freeze([...requiredDomains])
}

export function hasCompleteCrrtReview(record: CrrtActivationRecord): boolean {
  const exactCandidateIdentity = record.exactCandidateIdentity
  const candidateManifestSha256 = record.candidateManifestSha256
  const findingsLedgerSha256 = record.expectedFindingsLedgerSha256
  const expectedReviewScopes = record.expectedReviewScopeSha256ByDomain
  const classification = getCrrtArtifactClassification(record.id)
  const requiredDomains = requiredCrrtReviewerDomainsForArtifacts([record.id])
  return (
    classification !== null &&
    classification.reviewScope === record.reviewScope &&
    requiredDomains !== null &&
    isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity) &&
    record.reviewStatus === 'approved' &&
    record.blockingInputs.length === 0 &&
    hasRequiredUniqueDomains(record.requiredReviews, requiredDomains) &&
    hasExactExpectedReviewScopeMap(expectedReviewScopes, requiredDomains) &&
    record.requiredReviews.every((review) =>
      hasCompleteBaxterCrrtReviewAttestation(
        review,
        exactCandidateIdentity,
        candidateManifestSha256,
        findingsLedgerSha256,
        expectedReviewScopes[review.domain] ?? null,
      ),
    )
  )
}

export function canActivateCrrtRecord(record: CrrtActivationRecord): boolean {
  if (!isCrrtActivatableArtifactId(record.id)) return false

  const exactCandidateIdentity = record.exactCandidateIdentity
  const candidateManifestSha256 = record.candidateManifestSha256
  const expectedFindingsLedgerSha256 = record.expectedFindingsLedgerSha256
  const expectedAuthorizationScopeSha256 = record.expectedAuthorizationScopeSha256
  const classification = getCrrtArtifactClassification(record.id)
  if (
    classification === null ||
    classification.phase === 'protected-pilot' ||
    classification.reviewScope !== record.reviewScope ||
    record.activationState !== 'learner-active' ||
    !hasCompleteCrrtReview(record) ||
    !isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity) ||
    !isBaxterCrrtAttestationSha256(candidateManifestSha256) ||
    !isBaxterCrrtAttestationSha256(expectedFindingsLedgerSha256) ||
    !isBaxterCrrtAttestationSha256(expectedAuthorizationScopeSha256)
  ) {
    return false
  }

  if (classification.phase === 'phase-7') {
    return hasCompleteCrrtPhase7Authorization(
      record.activationAuthorization?.kind === 'phase-7' ? record.activationAuthorization : null,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
      expectedAuthorizationScopeSha256,
      [record.id],
      record.expectedPilotAcceptanceReference,
    )
  }

  if (classification.phase === 'phase-8') {
    return hasCompleteCrrtPhase8Authorization(
      record.activationAuthorization?.kind === 'phase-8' ? record.activationAuthorization : null,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
      expectedAuthorizationScopeSha256,
      [record.id],
      record.expectedPhase8StablePrismaxPrerequisite,
    )
  }

  return false
}

export function pendingReviewRequirements(
  domains: readonly CrrtReviewerDomain[],
): readonly CrrtReviewRequirement[] {
  const uniqueDomains = new Set(domains)
  if (uniqueDomains.size !== domains.length) {
    throw new Error('CRRT review requirements cannot contain duplicate reviewer domains.')
  }
  const missingDomains = CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS.filter(
    (domain) => !uniqueDomains.has(domain),
  )
  if (missingDomains.length > 0) {
    throw new Error(
      `CRRT review requirements are missing mandatory release domains: ${missingDomains.join(', ')}.`,
    )
  }
  return Object.freeze(
    domains.map((domain) =>
      Object.freeze({
        domain,
        reviewer: null,
        reviewStatus: 'pending' as const,
        exactCandidateIdentity: null,
        candidateManifestSha256: null,
        findingsLedgerSha256: null,
        reviewScopeSha256: null,
        exactVersionDisposition: null,
        attestedAt: null,
        attestationArtifactId: null,
        attestationSha256: null,
      }),
    ),
  )
}
