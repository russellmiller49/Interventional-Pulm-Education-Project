import type { CrrtReviewerDomain } from '../content/activation'
import {
  CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS,
  CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS,
  CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS,
  getCrrtArtifactClassification,
  type CrrtReleaseArtifactId,
} from '../content/artifactRegistry'
import { BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX } from '../content/candidateIdentity'
import {
  CRRT_PHASE_7_AUTHORIZED_DECISION,
  CRRT_PHASE_8_AUTHORIZED_DECISION,
  CRRT_PILOT_ACCEPTED_DECISION,
  CRRT_PUBLICATION_AUTHORIZED_DECISION,
  type CrrtCandidateBoundAuthorizationReference,
  type CrrtPhase7AuthorizationAttestation,
  type CrrtPhase8AuthorizationAttestation,
  type CrrtPhase8StablePrismaxPrerequisite,
  type CrrtPilotAcceptanceAuthorizationReference,
} from '../content/authorization'
import {
  BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS,
  BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
  type BaxterCrrtPublicationConfiguration,
  baxterCrrtDeployableArtifactId,
  baxterCrrtDeployableArtifactSha256,
  baxterCrrtExpectedFindingsLedgerSha256,
  baxterCrrtExpectedPhase8StablePrismaxPrerequisite,
  baxterCrrtExpectedReviewScopeSha256ByDomain,
  baxterCrrtLocalConfigurationReviewStatus,
  baxterCrrtPhase7Authorization,
  baxterCrrtPhase7AuthorizationScopeSha256,
  baxterCrrtPhase8Authorization,
  baxterCrrtPhase8AuthorizationScopeSha256,
  baxterCrrtPilotAcceptanceReference,
  baxterCrrtPublicationAuthorization,
  baxterCrrtPublicationScopeSha256,
  baxterCrrtPublicationStatus,
  baxterCrrtReleaseArtifactIds,
  baxterCrrtReleaseCandidateIdentity,
  baxterCrrtReleaseCandidateManifestSha256,
  baxterCrrtReleaseReviews,
  initialBaxterCrrtDeviceId,
  prismaxDraftDeviceProfile,
  resolveBaxterCrrtPublicationStatus,
} from '../content/deviceProfiles'
import { baxterCrrtLearnerCases } from '../content/learnerRegistry'

const exactCandidateIdentity = `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'a'.repeat(64)}`
const candidateManifestSha256 = 'c'.repeat(64)
const findingsLedgerSha256 = '5'.repeat(64)
const publicationScopeSha256 = '1'.repeat(64)
const phase7ScopeSha256 = '2'.repeat(64)
const phase8ScopeSha256 = '3'.repeat(64)
const deployableArtifactId = 'CRRT-DEPLOYABLE-ARTIFACT-1'
const deployableArtifactSha256 = 'd'.repeat(64)
const protectedPilotReleaseArtifactIds = CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS
const stablePrismaxPrerequisite: CrrtPhase8StablePrismaxPrerequisite = Object.freeze({
  exactCandidateIdentity: `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'5'.repeat(64)}`,
  candidateManifestSha256: 'b'.repeat(64),
  findingsLedgerSha256: '3'.repeat(64),
  activationAuthorizationRecordId: 'CRRT-PRISMAX-ACTIVATION-1',
  activationAuthorizationSha256: 'e'.repeat(64),
  publicationAuthorizationRecordId: 'CRRT-PRISMAX-PUBLICATION-1',
  publicationAuthorizationSha256: 'f'.repeat(64),
})

function uniqueReviewSha256(index: number): string {
  return (index + 32).toString(16).padStart(64, '0')
}

function uniqueReviewScopeSha256(index: number): string {
  return (index + 96).toString(16).padStart(64, '0')
}

function expectedReviewScopeMap<
  T extends readonly { readonly domain: string; readonly reviewScopeSha256: string | null }[],
>(reviews: T) {
  return Object.freeze(
    Object.fromEntries(reviews.map((review) => [review.domain, review.reviewScopeSha256])),
  )
}

function pilotAcceptanceReference(
  candidateIdentity = exactCandidateIdentity,
  manifestSha256 = candidateManifestSha256,
): CrrtPilotAcceptanceAuthorizationReference {
  return {
    kind: 'pilot-acceptance',
    decision: CRRT_PILOT_ACCEPTED_DECISION,
    exactCandidateIdentity: candidateIdentity,
    candidateManifestSha256: manifestSha256,
    findingsLedgerSha256,
    authorizationScopeSha256: '0'.repeat(64),
    authorizedArtifactIds: protectedPilotReleaseArtifactIds,
    authorizationRecordId: 'CRRT-PILOT-ACCEPTANCE-1',
    authorizationRecordSha256: '4'.repeat(64),
  }
}

function phase7Authorization(
  authorizedArtifactIds: readonly CrrtReleaseArtifactId[],
  candidateIdentity = exactCandidateIdentity,
): CrrtPhase7AuthorizationAttestation {
  return {
    kind: 'phase-7',
    decision: CRRT_PHASE_7_AUTHORIZED_DECISION,
    exactCandidateIdentity: candidateIdentity,
    candidateManifestSha256,
    findingsLedgerSha256,
    authorizationRecordId: 'CRRT-PHASE-7-AUTHORIZATION-1',
    authorizationRecordSha256: '6'.repeat(64),
    authorizedAt: '2026-07-17T09:30:00-07:00',
    authorizerSubjectId: 'product-owner-subject-1',
    attestationSystem: 'approved-attestation-system',
    attestationReceiptId: 'CRRT-PHASE-7-RECEIPT-1',
    attestationSha256: '7'.repeat(64),
    authorizationScopeSha256: phase7ScopeSha256,
    authorizedArtifactIds,
    acceptedPilotAuthorizationReference: pilotAcceptanceReference(candidateIdentity),
  }
}

function phase8Authorization(
  authorizedArtifactIds: readonly CrrtReleaseArtifactId[],
  candidateIdentity = exactCandidateIdentity,
): CrrtPhase8AuthorizationAttestation {
  return {
    kind: 'phase-8',
    decision: CRRT_PHASE_8_AUTHORIZED_DECISION,
    exactCandidateIdentity: candidateIdentity,
    candidateManifestSha256,
    findingsLedgerSha256,
    authorizationRecordId: 'CRRT-PHASE-8-AUTHORIZATION-1',
    authorizationRecordSha256: '9'.repeat(64),
    authorizedAt: '2026-07-17T09:30:00-07:00',
    authorizerSubjectId: 'product-owner-subject-1',
    attestationSystem: 'approved-attestation-system',
    attestationReceiptId: 'CRRT-PHASE-8-RECEIPT-1',
    attestationSha256: 'a'.repeat(64),
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

function authorizationReference(
  kind: 'phase-7' | 'phase-8',
  authorization: CrrtPhase7AuthorizationAttestation | CrrtPhase8AuthorizationAttestation,
): CrrtCandidateBoundAuthorizationReference {
  return {
    kind,
    exactCandidateIdentity: authorization.exactCandidateIdentity,
    candidateManifestSha256: authorization.candidateManifestSha256,
    findingsLedgerSha256: authorization.findingsLedgerSha256,
    authorizationRecordId: authorization.authorizationRecordId,
    authorizationRecordSha256: authorization.authorizationRecordSha256,
  }
}

function publicationAuthorizationFor(
  configuration: BaxterCrrtPublicationConfiguration,
): NonNullable<BaxterCrrtPublicationConfiguration['publicationAuthorization']> {
  return {
    kind: 'publication',
    decision: CRRT_PUBLICATION_AUTHORIZED_DECISION,
    exactCandidateIdentity: configuration.exactCandidateIdentity ?? '',
    candidateManifestSha256: configuration.candidateManifestSha256 ?? '',
    findingsLedgerSha256,
    authorizationRecordId: 'CRRT-PUBLICATION-AUTHORIZATION-1',
    authorizationRecordSha256: '1'.repeat(64),
    authorizedAt: '2026-07-17T09:30:00-07:00',
    authorizerSubjectId: 'publication-approver-subject-1',
    attestationSystem: 'approved-attestation-system',
    attestationReceiptId: 'CRRT-PUBLICATION-RECEIPT-1',
    attestationSha256: '2'.repeat(64),
    publicationScopeSha256: configuration.publicationScopeSha256 ?? '',
    authorizedArtifactIds: configuration.releaseArtifactIds,
    deployableArtifactId: configuration.deployableArtifactId ?? '',
    deployableArtifactSha256: configuration.deployableArtifactSha256 ?? '',
    pilotAcceptanceReference: configuration.pilotAcceptanceReference,
    phase7AuthorizationReference:
      configuration.phase7Authorization === null
        ? null
        : authorizationReference('phase-7', configuration.phase7Authorization),
    phase8AuthorizationReference:
      configuration.phase8Authorization === null
        ? null
        : authorizationReference('phase-8', configuration.phase8Authorization),
  }
}

function approvedReview(
  domain: CrrtReviewerDomain,
  index: number,
  candidateIdentity = exactCandidateIdentity,
) {
  return {
    domain,
    reviewer: `Named reviewer ${index + 1}`,
    reviewStatus: 'approved' as const,
    exactCandidateIdentity: candidateIdentity,
    candidateManifestSha256,
    findingsLedgerSha256,
    reviewScopeSha256: uniqueReviewScopeSha256(index),
    exactVersionDisposition: 'accepted' as const,
    attestedAt: '2026-07-17T09:15:30-07:00',
    attestationArtifactId: `CRRT-ATTESTATION-${index + 1}`,
    attestationSha256: uniqueReviewSha256(index),
  }
}

function approvedReviews(
  domains: readonly CrrtReviewerDomain[],
  candidateIdentity = exactCandidateIdentity,
) {
  return domains.map((domain, index) => approvedReview(domain, index, candidateIdentity))
}

function publishConfiguration(
  overrides: Partial<BaxterCrrtPublicationConfiguration> = {},
): BaxterCrrtPublicationConfiguration {
  const releaseReviews =
    overrides.releaseReviews ?? approvedReviews(BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS)
  const expectedReviewScopeSha256ByDomain = Object.prototype.hasOwnProperty.call(
    overrides,
    'expectedReviewScopeSha256ByDomain',
  )
    ? (overrides.expectedReviewScopeSha256ByDomain ?? null)
    : expectedReviewScopeMap(releaseReviews)
  const configuration: BaxterCrrtPublicationConfiguration = {
    requestedStatus: 'published',
    exactCandidateIdentity,
    candidateManifestSha256,
    expectedFindingsLedgerSha256: findingsLedgerSha256,
    expectedReviewScopeSha256ByDomain,
    releaseArtifactIds: protectedPilotReleaseArtifactIds,
    publicationScopeSha256,
    deployableArtifactId,
    deployableArtifactSha256,
    localConfigurationReviewStatus: 'approved',
    releaseReviews,
    pilotAcceptanceReference: pilotAcceptanceReference(),
    phase7AuthorizationScopeSha256: null,
    phase7Authorization: null,
    phase8AuthorizationScopeSha256: null,
    phase8Authorization: null,
    expectedPhase8StablePrismaxPrerequisite: null,
    publicationAuthorization: null,
    ...overrides,
  }
  if (Object.prototype.hasOwnProperty.call(overrides, 'publicationAuthorization')) {
    return configuration
  }
  return { ...configuration, publicationAuthorization: publicationAuthorizationFor(configuration) }
}

describe('Baxter CRRT fail-closed publication gate', () => {
  it('classifies the protected PrisMax base and every separately releasable Phase 8 surface', () => {
    expect(CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS).toEqual([
      'CRRT-04',
      'CRRT-10',
      'CRRT-13',
      'prismax-aw8035-2xx',
    ])
    expect(
      CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS.every(
        (artifactId) => getCrrtArtifactClassification(artifactId)?.phase === 'protected-pilot',
      ),
    ).toBe(true)
    expect(getCrrtArtifactClassification('CRRT-01')?.phase).toBe('phase-7')
    expect(getCrrtArtifactClassification('prismax-aw8035-2xx')?.phase).toBe('protected-pilot')
    expect(CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS).toEqual([
      'PRISMAFLEX-CALCULATION-ADAPTER',
      'PRISMAFLEX-SETUP-NAVIGATION-WORKFLOW',
      'PRISMAFLEX-ALARM-HELP-WORKFLOW',
      'PRISMAFLEX-STOP-END-BLOOD-DISPOSITION-WORKFLOW',
      'PRISMAFLEX-LEARNER-INTERFACE',
      'TRANSFER-DOMAIN-SETUP-NAVIGATION',
      'TRANSFER-DOMAIN-PRESCRIPTION-DISPLAY',
      'TRANSFER-DOMAIN-PRESSURE-TRANSLATION',
      'TRANSFER-DOMAIN-FLUID-ACCOUNTING',
      'TRANSFER-DOMAIN-ALARM-TAXONOMY',
    ])
    expect(
      CRRT_PHASE_8_SURFACE_RELEASE_ARTIFACT_IDS.every(
        (artifactId) => getCrrtArtifactClassification(artifactId)?.phase === 'phase-8',
      ),
    ).toBe(true)
  })

  it('binds the closed learner-release composition to the learner case registry and active profile', () => {
    expect(initialBaxterCrrtDeviceId).toBe(prismaxDraftDeviceProfile.id)
    expect(CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS).toEqual([
      ...baxterCrrtLearnerCases.map((caseDefinition) => caseDefinition.id),
      initialBaxterCrrtDeviceId,
    ])
    expect(Object.isFrozen(CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS)).toBe(true)
  })

  it('keeps every live release and authorization input empty, pending, and draft', () => {
    expect(baxterCrrtPublicationStatus).toBe('draft')
    expect(baxterCrrtReleaseCandidateIdentity).toBeNull()
    expect(baxterCrrtReleaseCandidateManifestSha256).toBeNull()
    expect(baxterCrrtExpectedFindingsLedgerSha256).toBeNull()
    expect(baxterCrrtExpectedReviewScopeSha256ByDomain).toBeNull()
    expect(baxterCrrtReleaseArtifactIds).toEqual([])
    expect(Object.isFrozen(baxterCrrtReleaseArtifactIds)).toBe(true)
    expect(baxterCrrtPublicationScopeSha256).toBeNull()
    expect(baxterCrrtDeployableArtifactId).toBeNull()
    expect(baxterCrrtDeployableArtifactSha256).toBeNull()
    expect(baxterCrrtPilotAcceptanceReference).toBeNull()
    expect(baxterCrrtPhase7AuthorizationScopeSha256).toBeNull()
    expect(baxterCrrtPhase7Authorization).toBeNull()
    expect(baxterCrrtPhase8AuthorizationScopeSha256).toBeNull()
    expect(baxterCrrtPhase8Authorization).toBeNull()
    expect(baxterCrrtExpectedPhase8StablePrismaxPrerequisite).toBeNull()
    expect(baxterCrrtPublicationAuthorization).toBeNull()
    expect(baxterCrrtLocalConfigurationReviewStatus).toBe('pending')
    expect(prismaxDraftDeviceProfile.deviceReviewStatus).toBe('pending')
    expect(prismaxDraftDeviceProfile.clinicalReviewStatus).toBe('pending')
    expect(BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS).toHaveLength(10)
    expect(
      baxterCrrtReleaseReviews.every(
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
  })

  it('permits only an exact, authorized protected-pilot release candidate', () => {
    expect(resolveBaxterCrrtPublicationStatus(publishConfiguration())).toBe('published')
  })

  it('rejects status-only publication and reused domain receipts', () => {
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseReviews: baxterCrrtReleaseReviews,
          publicationAuthorization: null,
        }),
      ),
    ).toThrow(/complete candidate-bound attestations/i)

    const reviews = approvedReviews(BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS)
    for (const duplicateField of ['attestationArtifactId', 'attestationSha256'] as const) {
      const duplicated = reviews.map((review, index) =>
        index === 1 ? { ...review, [duplicateField]: reviews[0][duplicateField] } : review,
      )
      expect(() =>
        resolveBaxterCrrtPublicationStatus(
          publishConfiguration({ releaseReviews: duplicated, publicationAuthorization: null }),
        ),
      ).toThrow(/complete candidate-bound attestations/i)
    }
  })

  it('rejects stale manifest, findings-ledger, and swapped domain-scope reviews', () => {
    const valid = publishConfiguration()
    for (const staleBinding of [
      { candidateManifestSha256: '8'.repeat(64) },
      { findingsLedgerSha256: '8'.repeat(64) },
    ]) {
      expect(() =>
        resolveBaxterCrrtPublicationStatus({
          ...valid,
          releaseReviews: valid.releaseReviews.map((review, index) =>
            index === 0 ? { ...review, ...staleBinding } : review,
          ),
        }),
      ).toThrow(/complete candidate-bound attestations/i)
    }
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        releaseReviews: valid.releaseReviews.map((review, index) =>
          index === 0
            ? { ...review, reviewScopeSha256: valid.releaseReviews[1].reviewScopeSha256 }
            : index === 1
              ? { ...review, reviewScopeSha256: valid.releaseReviews[0].reviewScopeSha256 }
              : review,
        ),
      }),
    ).toThrow(/complete candidate-bound attestations/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        expectedReviewScopeSha256ByDomain: {
          ...valid.expectedReviewScopeSha256ByDomain,
          pharmacy: '8'.repeat(64),
        },
      }),
    ).toThrow(/complete candidate-bound attestations/i)
  })

  it.each([
    ['an arbitrary identifier', 'commit:abc123|engine:reviewed|content:reviewed'],
    ['the legacy prefix', `baxter-crrt-rc-sha256-${'a'.repeat(64)}`],
    ['an uppercase digest', `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'A'.repeat(64)}`],
  ])('rejects %s instead of an exact v2 candidate', (_, candidateIdentity) => {
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          exactCandidateIdentity: candidateIdentity,
          releaseReviews: approvedReviews(
            BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
            candidateIdentity,
          ),
        }),
      ),
    ).toThrow(/exact frozen candidate/i)
  })

  it('rejects unknown, duplicate, subset, or superset release artifacts and exact-scope mismatches', () => {
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...publishConfiguration(),
        releaseArtifactIds: [
          'UNKNOWN-CRRT-ARTIFACT',
        ] as unknown as readonly CrrtReleaseArtifactId[],
      }),
    ).toThrow(/known release artifact IDs/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...publishConfiguration(),
        releaseArtifactIds: ['CRRT-04', 'CRRT-04'],
      }),
    ).toThrow(/unique allowlist/i)

    const valid = publishConfiguration()
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        publicationScopeSha256: 'f'.repeat(64),
      }),
    ).toThrow(/publication authorization bound/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        releaseArtifactIds: ['CRRT-04'],
        publicationAuthorization: publicationAuthorizationFor(
          publishConfiguration({ releaseArtifactIds: ['CRRT-04'], publicationAuthorization: null }),
        ),
      }),
    ).toThrow(/exact closed artifact composition/i)

    const supersetArtifactIds = [...protectedPilotReleaseArtifactIds, 'CRRT-01'] as const
    const phase7 = phase7Authorization(['CRRT-01'])
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseArtifactIds: supersetArtifactIds,
          phase7AuthorizationScopeSha256: phase7ScopeSha256,
          phase7Authorization: phase7,
        }),
      ),
    ).toThrow(/exact closed artifact composition/i)
  })

  it('derives Phase 7 and conditional protocol/pharmacy review requirements from artifacts', () => {
    const releaseArtifactIds = ['CRRT-17'] as const
    const phase7 = phase7Authorization(releaseArtifactIds)
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseArtifactIds,
          phase7AuthorizationScopeSha256: phase7ScopeSha256,
          phase7Authorization: phase7,
        }),
      ),
    ).toThrow(/mandatory publication-review domain/i)

    const requiredDomains = [
      ...BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
      'protocol-owner',
      'pharmacy',
    ] as const
    const valid = publishConfiguration({
      releaseArtifactIds,
      releaseReviews: approvedReviews(requiredDomains),
      phase7AuthorizationScopeSha256: phase7ScopeSha256,
      phase7Authorization: phase7,
    })
    expect(() => resolveBaxterCrrtPublicationStatus(valid)).toThrow(
      /exact closed artifact composition/i,
    )
    expect(() =>
      resolveBaxterCrrtPublicationStatus({ ...valid, phase7Authorization: null }),
    ).toThrow(/Phase 7 authorization/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        phase7Authorization: phase7Authorization(['CRRT-01']),
      }),
    ).toThrow(/Phase 7 authorization/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        phase7AuthorizationScopeSha256: 'f'.repeat(64),
      }),
    ).toThrow(/Phase 7 authorization/i)
  })

  it('derives Phase 8 requirements even when a legacy boolean is suppressed', () => {
    const releaseArtifactIds = ['prismaflex-g5036003-6xx', 'PRISMAFLEX-LEARNER-INTERFACE'] as const
    const phase8Reviews = approvedReviews([
      ...BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
      ...BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS,
    ])
    const suppressedLegacyConfiguration = {
      ...publishConfiguration({ releaseArtifactIds, publicationAuthorization: null }),
      phase8Activated: false,
    } as BaxterCrrtPublicationConfiguration & { readonly phase8Activated: false }
    expect(() => resolveBaxterCrrtPublicationStatus(suppressedLegacyConfiguration)).toThrow(
      /mandatory publication-review domain/i,
    )

    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({ releaseArtifactIds, releaseReviews: phase8Reviews }),
      ),
    ).toThrow(/Phase 8 authorization/i)

    const phase8 = phase8Authorization(releaseArtifactIds)
    const valid = publishConfiguration({
      releaseArtifactIds,
      releaseReviews: phase8Reviews,
      phase8AuthorizationScopeSha256: phase8ScopeSha256,
      phase8Authorization: phase8,
      expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
    })
    expect(() => resolveBaxterCrrtPublicationStatus(valid)).toThrow(
      /exact closed artifact composition/i,
    )

    for (const missingDomain of BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS) {
      expect(() =>
        resolveBaxterCrrtPublicationStatus({
          ...valid,
          releaseReviews: phase8Reviews.filter((review) => review.domain !== missingDomain),
        }),
      ).toThrow(/mandatory publication-review domain/i)
    }
  })

  it('rejects duplicate Phase 8 prerequisites and missing publication authorization references', () => {
    const releaseArtifactIds = ['prismaflex-g5036003-6xx'] as const
    const releaseReviews = approvedReviews([
      ...BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
      ...BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS,
    ])
    const duplicatedPrerequisite = {
      ...phase8Authorization(releaseArtifactIds),
      prismaxPublicationAuthorizationRecordId: 'CRRT-PRISMAX-ACTIVATION-1',
    }
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseArtifactIds,
          releaseReviews,
          phase8AuthorizationScopeSha256: phase8ScopeSha256,
          phase8Authorization: duplicatedPrerequisite,
          expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
        }),
      ),
    ).toThrow(/Phase 8 authorization/i)

    const valid = publishConfiguration({
      releaseArtifactIds,
      releaseReviews,
      phase8AuthorizationScopeSha256: phase8ScopeSha256,
      phase8Authorization: phase8Authorization(releaseArtifactIds),
      expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
    })
    for (const phase8AuthorizationOverride of [
      { prismaxActivationAuthorizationRecordId: 'CRRT-PILOT-ACCEPTANCE-1' },
      { prismaxActivationAuthorizationSha256: '4'.repeat(64) },
    ]) {
      expect(() =>
        resolveBaxterCrrtPublicationStatus(
          publishConfiguration({
            releaseArtifactIds,
            releaseReviews,
            phase8AuthorizationScopeSha256: phase8ScopeSha256,
            phase8Authorization: {
              ...phase8Authorization(releaseArtifactIds),
              ...phase8AuthorizationOverride,
            },
            expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
          }),
        ),
      ).toThrow(/Phase 8 authorization/i)
    }
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        publicationAuthorization: {
          ...valid.publicationAuthorization!,
          phase8AuthorizationReference: null,
        },
      }),
    ).toThrow(/publication authorization bound/i)
  })

  it('requires an exact candidate-bound pilot reference and separate publication authorization', () => {
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({ pilotAcceptanceReference: null, publicationAuthorization: null }),
      ),
    ).toThrow(/pilot-acceptance authorization reference/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus(publishConfiguration({ publicationAuthorization: null })),
    ).toThrow(/separate exact-candidate publication authorization/i)

    const valid = publishConfiguration()
    for (const publicationAuthorizationOverride of [
      { attestationReceiptId: 'CRRT-PILOT-ACCEPTANCE-1' },
      { attestationSha256: '4'.repeat(64) },
    ]) {
      expect(() =>
        resolveBaxterCrrtPublicationStatus({
          ...valid,
          publicationAuthorization: {
            ...valid.publicationAuthorization!,
            ...publicationAuthorizationOverride,
          },
        }),
      ).toThrow(/publication authorization bound/i)
    }
  })

  it('requires one candidate-bound findings ledger across every applicable authorization', () => {
    const valid = publishConfiguration()
    for (const expectedFindingsLedgerSha256 of [null, '8'.repeat(64)]) {
      expect(() =>
        resolveBaxterCrrtPublicationStatus({
          ...valid,
          expectedFindingsLedgerSha256,
        }),
      ).toThrow(/complete candidate-bound attestations/i)
    }
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        pilotAcceptanceReference: {
          ...valid.pilotAcceptanceReference!,
          findingsLedgerSha256: '8'.repeat(64),
        },
      }),
    ).toThrow(/pilot-acceptance authorization reference/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...valid,
        publicationAuthorization: {
          ...valid.publicationAuthorization!,
          findingsLedgerSha256: '8'.repeat(64),
        },
      }),
    ).toThrow(/publication authorization bound/i)

    const phase7ArtifactIds = ['CRRT-01'] as const
    const phase7 = phase7Authorization(phase7ArtifactIds)
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseArtifactIds: phase7ArtifactIds,
          phase7AuthorizationScopeSha256: phase7ScopeSha256,
          phase7Authorization: { ...phase7, findingsLedgerSha256: '8'.repeat(64) },
        }),
      ),
    ).toThrow(/Phase 7 authorization/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseArtifactIds: phase7ArtifactIds,
          phase7AuthorizationScopeSha256: phase7ScopeSha256,
          phase7Authorization: {
            ...phase7,
            acceptedPilotAuthorizationReference: {
              ...phase7.acceptedPilotAuthorizationReference,
              exactCandidateIdentity: `${BAXTER_CRRT_REVIEW_CANDIDATE_PREFIX}${'d'.repeat(64)}`,
            },
          },
        }),
      ),
    ).toThrow(/Phase 7 authorization/i)

    const phase8ArtifactIds = ['prismaflex-g5036003-6xx'] as const
    const phase8Reviews = approvedReviews([
      ...BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
      ...BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS,
    ])
    expect(() =>
      resolveBaxterCrrtPublicationStatus(
        publishConfiguration({
          releaseArtifactIds: phase8ArtifactIds,
          releaseReviews: phase8Reviews,
          phase8AuthorizationScopeSha256: phase8ScopeSha256,
          phase8Authorization: {
            ...phase8Authorization(phase8ArtifactIds),
            findingsLedgerSha256: '8'.repeat(64),
          },
          expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
        }),
      ),
    ).toThrow(/Phase 8 authorization/i)
  })

  it('rejects authorizer-invented or mismatched stable PrisMax Phase 8 prerequisites', () => {
    const releaseArtifactIds = ['prismaflex-g5036003-6xx'] as const
    const releaseReviews = approvedReviews([
      ...BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS,
      ...BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS,
    ])
    const base = publishConfiguration({
      releaseArtifactIds,
      releaseReviews,
      phase8AuthorizationScopeSha256: phase8ScopeSha256,
      phase8Authorization: phase8Authorization(releaseArtifactIds),
      expectedPhase8StablePrismaxPrerequisite: stablePrismaxPrerequisite,
    })
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...base,
        expectedPhase8StablePrismaxPrerequisite: null,
      }),
    ).toThrow(/Phase 8 authorization/i)
    expect(() =>
      resolveBaxterCrrtPublicationStatus({
        ...base,
        expectedPhase8StablePrismaxPrerequisite: {
          ...stablePrismaxPrerequisite,
          activationAuthorizationRecordId: 'INVENTED-STABLE-PRISMAX-ACTIVATION',
        },
      }),
    ).toThrow(/Phase 8 authorization/i)
  })

  it('keeps draft requests draft with every release field empty', () => {
    expect(
      resolveBaxterCrrtPublicationStatus({
        requestedStatus: 'draft',
        exactCandidateIdentity: null,
        candidateManifestSha256: null,
        expectedFindingsLedgerSha256: null,
        expectedReviewScopeSha256ByDomain: null,
        releaseArtifactIds: [],
        publicationScopeSha256: null,
        deployableArtifactId: null,
        deployableArtifactSha256: null,
        localConfigurationReviewStatus: 'pending',
        releaseReviews: baxterCrrtReleaseReviews,
        pilotAcceptanceReference: null,
        phase7AuthorizationScopeSha256: null,
        phase7Authorization: null,
        phase8AuthorizationScopeSha256: null,
        phase8Authorization: null,
        expectedPhase8StablePrismaxPrerequisite: null,
        publicationAuthorization: null,
      }),
    ).toBe('draft')
  })
})
