import { z } from 'zod'

import {
  CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS,
  CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS,
  hasExactExpectedReviewScopeMap,
  hasUniqueCrrtReviewAttestationReceipts,
  requiredCrrtReviewerDomainsForArtifacts,
  type CrrtExpectedReviewScopeSha256ByDomain,
  type CrrtReviewRequirement,
} from './activation'
import {
  CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS,
  getCrrtArtifactClassification,
  hasUniqueCrrtReleaseArtifactIds,
  type CrrtReleaseArtifactId,
} from './artifactRegistry'
import {
  hasCompleteCrrtCandidateBoundAuthorizationReference,
  hasCompleteCrrtPhase7Authorization,
  hasCompleteCrrtPhase8Authorization,
  hasCompleteCrrtPublicationAuthorization,
  type CrrtCandidateBoundAuthorizationReference,
  type CrrtPhase7AuthorizationAttestation,
  type CrrtPhase8AuthorizationAttestation,
  type CrrtPhase8StablePrismaxPrerequisite,
  type CrrtPilotAcceptanceAuthorizationReference,
  type CrrtPublicationAuthorizationAttestation,
} from './authorization'
import { isBaxterCrrtExactCandidateIdentity } from './candidateIdentity'
import { hasCompleteBaxterCrrtReviewAttestationFields } from './reviewAttestation'
import type { BaxterCrrtReviewStatus } from './reviewStatus'

export type BaxterCrrtPublicationStatus = 'draft' | 'published'
export type { BaxterCrrtReviewStatus } from './reviewStatus'

export type BaxterCrrtDeviceId = 'prismax-aw8035-2xx' | 'prismaflex-g5036003-6xx'

export type BaxterCrrtFormulaGateId = 'CONFLICT-001' | 'CONFLICT-002'
export type BaxterCrrtFormulaConflictId = BaxterCrrtFormulaGateId | 'CONFLICT-010'

export interface BaxterCrrtReviewerCandidateMetadata {
  readonly status: 'reviewer-only'
  readonly learnerRuntimeEnabled: false
  readonly adapterRegistrationStatus: 'not-registered-in-learner-runtime'
  readonly targetConfigurationStatus: 'pending-local-configuration'
  readonly sourceDescribedTherapyFamilies: readonly string[]
  readonly sourceDescribedCrrtModes: readonly string[]
  readonly interfaceParadigm: readonly string[]
}

export interface BaxterCrrtFlowRateIncrement {
  readonly controlId: string
  readonly configurationContextId: string
  readonly rangeMinimumInclusive: number
  readonly rangeMaximumInclusive: number
  readonly increment: number
  readonly unit: string
  readonly sourceRecordIds: readonly string[]
}

export interface BaxterCrrtDraftDeviceProfile {
  readonly id: BaxterCrrtDeviceId
  readonly profileVersion: string
  readonly displayName: string
  readonly manufacturerDisclosure: string
  readonly manualNumber: string
  readonly manualRevision: string
  readonly sourceProgramFamily: string
  readonly marketConfiguration: string
  readonly availability: 'orientation-scaffold' | 'pilot-interface' | 'deferred'
  readonly publicationStatus: BaxterCrrtPublicationStatus
  readonly reviewerCandidateMetadata: Readonly<BaxterCrrtReviewerCandidateMetadata> | null
  readonly enabledTherapies: readonly string[]
  readonly enabledSetsAndAccessories: readonly string[]
  readonly pumpAndScaleInventory: Readonly<{
    status:
      | 'pending-local-configuration'
      | 'source-mapped-pilot-surface'
      | 'source-mapped-review-candidate'
      | 'deferred'
    items: readonly string[]
  }>
  readonly flowRateRanges: Readonly<{
    status: 'pending-set-and-configuration-review' | 'deferred'
    ranges: readonly string[]
  }>
  readonly flowRateIncrements: Readonly<{
    status: 'pending-set-and-configuration-review' | 'deferred'
    increments: readonly Readonly<BaxterCrrtFlowRateIncrement>[]
  }>
  readonly setupSequenceStatus:
    | 'phase-3-not-implemented'
    | 'phase-3-pilot-interface'
    | 'reviewer-only-source-mapped'
    | 'deferred'
  readonly screenVocabulary: readonly string[]
  readonly alarmBehaviorStatus:
    | 'pending-device-adapter'
    | 'phase-3-window-pending-mapping'
    | 'reviewer-only-generic-mapping-pending'
    | 'deferred'
  readonly pressureCalculationSourceIds: readonly string[]
  readonly fluidCalculationSourceIds: readonly string[]
  readonly unresolvedFormulaGates: readonly BaxterCrrtFormulaGateId[]
  readonly contextualFormulaConflicts: readonly BaxterCrrtFormulaConflictId[]
  readonly deviceReviewStatus: BaxterCrrtReviewStatus
  readonly clinicalReviewStatus: BaxterCrrtReviewStatus
  readonly sourceRecordIds: readonly string[]
  readonly excludedSurfaceGroups: readonly string[]
}

const prismaflexNonEmptyStringSchema = z.string().trim().min(1)
const prismaflexEmptyArraySchema = z.array(z.never()).length(0)

/**
 * Runtime authoring boundary for the isolated Prismaflex reviewer profile.
 * Safety-critical draft gates are literals so malformed content cannot activate
 * configuration, learner runtime, or review state by changing authored data.
 */
export const prismaflexReviewCandidateDeviceProfileSchema = z
  .object({
    id: z.literal('prismaflex-g5036003-6xx'),
    profileVersion: z.literal('prismaflex-g5036003-r05-6xx-review-candidate.1'),
    displayName: prismaflexNonEmptyStringSchema,
    manufacturerDisclosure: z.literal('Gambro Lundia AB'),
    manualNumber: z.literal('G5036003'),
    manualRevision: z.literal('Revision 05.2011'),
    sourceProgramFamily: z.literal('Manual for program 6.xx'),
    marketConfiguration: z.literal('Multi-market source; local configuration not established'),
    availability: z.literal('deferred'),
    publicationStatus: z.literal('draft'),
    reviewerCandidateMetadata: z
      .object({
        status: z.literal('reviewer-only'),
        learnerRuntimeEnabled: z.literal(false),
        adapterRegistrationStatus: z.literal('not-registered-in-learner-runtime'),
        targetConfigurationStatus: z.literal('pending-local-configuration'),
        sourceDescribedTherapyFamilies: z.tuple([
          z.literal('CRRT'),
          z.literal('HP'),
          z.literal('TPE'),
        ]),
        sourceDescribedCrrtModes: z.tuple([
          z.literal('SCUF'),
          z.literal('CVVH'),
          z.literal('CVVHD'),
          z.literal('CVVHDF'),
        ]),
        interfaceParadigm: z.array(prismaflexNonEmptyStringSchema).min(1),
      })
      .strict(),
    enabledTherapies: prismaflexEmptyArraySchema,
    enabledSetsAndAccessories: prismaflexEmptyArraySchema,
    pumpAndScaleInventory: z
      .object({
        status: z.literal('source-mapped-review-candidate'),
        items: z.array(prismaflexNonEmptyStringSchema).min(1),
      })
      .strict(),
    flowRateRanges: z
      .object({
        status: z.literal('pending-set-and-configuration-review'),
        ranges: prismaflexEmptyArraySchema,
      })
      .strict(),
    flowRateIncrements: z
      .object({
        status: z.literal('pending-set-and-configuration-review'),
        increments: prismaflexEmptyArraySchema,
      })
      .strict(),
    setupSequenceStatus: z.literal('reviewer-only-source-mapped'),
    screenVocabulary: z.array(prismaflexNonEmptyStringSchema).min(1),
    alarmBehaviorStatus: z.literal('reviewer-only-generic-mapping-pending'),
    pressureCalculationSourceIds: z.tuple([
      z.literal('DEV-PF-004'),
      z.literal('DEV-PF-005'),
      z.literal('DEV-PF-006'),
    ]),
    fluidCalculationSourceIds: z.tuple([z.literal('DEV-PF-006')]),
    unresolvedFormulaGates: prismaflexEmptyArraySchema,
    contextualFormulaConflicts: z.tuple([z.literal('CONFLICT-010')]),
    deviceReviewStatus: z.literal('pending'),
    clinicalReviewStatus: z.literal('pending'),
    sourceRecordIds: z.tuple([
      z.literal('DEV-PF-001'),
      z.literal('DEV-PF-002'),
      z.literal('DEV-PF-003'),
      z.literal('DEV-PF-004'),
      z.literal('DEV-PF-005'),
      z.literal('DEV-PF-006'),
      z.literal('DEV-PF-007'),
      z.literal('DEV-PF-008'),
    ]),
    excludedSurfaceGroups: z.array(prismaflexNonEmptyStringSchema).min(1),
  })
  .strict()

export const initialBaxterCrrtDeviceId: BaxterCrrtDeviceId = 'prismax-aw8035-2xx'

export interface BaxterCrrtPublicationConfiguration {
  readonly requestedStatus: BaxterCrrtPublicationStatus
  readonly exactCandidateIdentity: string | null
  readonly candidateManifestSha256: string | null
  readonly expectedFindingsLedgerSha256: string | null
  readonly expectedReviewScopeSha256ByDomain: CrrtExpectedReviewScopeSha256ByDomain | null
  readonly releaseArtifactIds: readonly CrrtReleaseArtifactId[]
  readonly publicationScopeSha256: string | null
  readonly deployableArtifactId: string | null
  readonly deployableArtifactSha256: string | null
  readonly localConfigurationReviewStatus: BaxterCrrtReviewStatus
  readonly releaseReviews: readonly CrrtReviewRequirement[]
  readonly pilotAcceptanceReference: CrrtPilotAcceptanceAuthorizationReference | null
  readonly phase7AuthorizationScopeSha256: string | null
  readonly phase7Authorization: CrrtPhase7AuthorizationAttestation | null
  readonly phase8AuthorizationScopeSha256: string | null
  readonly phase8Authorization: CrrtPhase8AuthorizationAttestation | null
  readonly expectedPhase8StablePrismaxPrerequisite: CrrtPhase8StablePrismaxPrerequisite | null
  readonly publicationAuthorization: CrrtPublicationAuthorizationAttestation | null
}

export const BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS =
  CRRT_REQUIRED_RELEASE_REVIEWER_DOMAINS

export const BAXTER_CRRT_PHASE_8_PUBLICATION_REVIEW_DOMAINS =
  CRRT_PHASE_8_CONDITIONAL_REVIEWER_DOMAINS

const BAXTER_CRRT_RELEASE_REVIEW_LABELS: Readonly<
  Record<(typeof BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS)[number], string>
> = Object.freeze({
  nephrology: 'Nephrology review',
  'critical-care': 'Critical-care review',
  'crrt-nurse-education': 'CRRT nursing review',
  'prismax-device': 'PrisMax device review',
  accessibility: 'Accessibility review',
  localization: 'Localization review',
  'privacy-data-governance': 'Privacy and data-governance review',
  'entitlement-security': 'Entitlement and security review',
  'product-owner': 'Product-owner review',
  'publication-approval': 'Publication approval',
})

export type BaxterCrrtReleaseReview = Readonly<
  CrrtReviewRequirement & {
    readonly label: string
  }
>

function candidateBoundReferenceForAuthorization(
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

export function resolveBaxterCrrtPublicationStatus(
  configuration: BaxterCrrtPublicationConfiguration,
): BaxterCrrtPublicationStatus {
  if (configuration.requestedStatus !== 'published') return 'draft'

  const exactCandidateIdentity = configuration.exactCandidateIdentity
  const candidateManifestSha256 = configuration.candidateManifestSha256 ?? ''
  const expectedFindingsLedgerSha256 = configuration.expectedFindingsLedgerSha256 ?? ''
  const expectedReviewScopes = configuration.expectedReviewScopeSha256ByDomain
  const releaseArtifactIds = configuration.releaseArtifactIds
  if (!hasUniqueCrrtReleaseArtifactIds(releaseArtifactIds)) {
    throw new Error(
      'Baxter CRRT publication requires a nonempty, unique allowlist of known release artifact IDs.',
    )
  }
  const classifications = releaseArtifactIds.map(getCrrtArtifactClassification)
  const requiredReviewDomains = requiredCrrtReviewerDomainsForArtifacts(releaseArtifactIds)
  if (
    classifications.some((classification) => classification === null) ||
    requiredReviewDomains === null
  ) {
    throw new Error('Baxter CRRT publication scope contains an unknown release artifact.')
  }

  const phase7ArtifactIds = releaseArtifactIds.filter(
    (artifactId) => getCrrtArtifactClassification(artifactId)?.phase === 'phase-7',
  )
  const phase8ArtifactIds = releaseArtifactIds.filter(
    (artifactId) => getCrrtArtifactClassification(artifactId)?.phase === 'phase-8',
  )
  const phase7AuthorizationRequired = phase7ArtifactIds.length > 0
  const phase8AuthorizationRequired = phase8ArtifactIds.length > 0
  const suppliedReviewDomains = configuration.releaseReviews.map((review) => review.domain)
  const everyRequiredDomainIsUniqueAndPresent =
    new Set(suppliedReviewDomains).size === suppliedReviewDomains.length &&
    suppliedReviewDomains.length === requiredReviewDomains.length &&
    requiredReviewDomains.every((domain) => suppliedReviewDomains.includes(domain))
  const everySuppliedReviewHasAnExactCandidateAttestation =
    isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity) &&
    hasExactExpectedReviewScopeMap(expectedReviewScopes, requiredReviewDomains) &&
    hasUniqueCrrtReviewAttestationReceipts(configuration.releaseReviews) &&
    configuration.releaseReviews.every((review) =>
      hasCompleteBaxterCrrtReviewAttestationFields(
        review,
        exactCandidateIdentity,
        candidateManifestSha256,
        expectedFindingsLedgerSha256,
        expectedReviewScopes[review.domain] ?? null,
      ),
    )

  if (
    !isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity) ||
    configuration.localConfigurationReviewStatus !== 'approved' ||
    !everyRequiredDomainIsUniqueAndPresent ||
    !everySuppliedReviewHasAnExactCandidateAttestation
  ) {
    throw new Error(
      'Baxter CRRT cannot be published without an exact frozen candidate ID in the v2 Baxter CRRT format, approved local configuration, and complete candidate-bound attestations for every mandatory publication-review domain.',
    )
  }

  const pilotAcceptanceReference = configuration.pilotAcceptanceReference
  if (
    pilotAcceptanceReference === null ||
    !hasCompleteCrrtCandidateBoundAuthorizationReference(
      pilotAcceptanceReference,
      'pilot-acceptance',
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
    )
  ) {
    throw new Error(
      'Baxter CRRT publication requires a candidate-bound pilot-acceptance authorization reference.',
    )
  }

  if (
    phase7AuthorizationRequired &&
    (!hasCompleteCrrtPhase7Authorization(
      configuration.phase7Authorization,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
      configuration.phase7AuthorizationScopeSha256 ?? '',
      phase7ArtifactIds,
      pilotAcceptanceReference,
    ) ||
      configuration.phase7Authorization?.acceptedPilotAuthorizationReference
        .authorizationRecordId !== pilotAcceptanceReference.authorizationRecordId ||
      configuration.phase7Authorization.acceptedPilotAuthorizationReference
        .authorizationRecordSha256 !== pilotAcceptanceReference.authorizationRecordSha256)
  ) {
    throw new Error(
      'Baxter CRRT publication scope requires a matching candidate-bound Phase 7 authorization and accepted-pilot reference.',
    )
  }

  if (
    phase8AuthorizationRequired &&
    !hasCompleteCrrtPhase8Authorization(
      configuration.phase8Authorization,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
      configuration.phase8AuthorizationScopeSha256 ?? '',
      phase8ArtifactIds,
      configuration.expectedPhase8StablePrismaxPrerequisite,
    )
  ) {
    throw new Error(
      'Baxter CRRT Phase 8 publication requires a separate exact-candidate Phase 8 authorization bound to the stable PrisMax candidate and prerequisite activation/publication records.',
    )
  }

  const phase7AuthorizationReference =
    phase7AuthorizationRequired && configuration.phase7Authorization !== null
      ? candidateBoundReferenceForAuthorization('phase-7', configuration.phase7Authorization)
      : null
  const phase8AuthorizationReference =
    phase8AuthorizationRequired && configuration.phase8Authorization !== null
      ? candidateBoundReferenceForAuthorization('phase-8', configuration.phase8Authorization)
      : null

  if (
    !hasCompleteCrrtPublicationAuthorization(
      configuration.publicationAuthorization,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
      configuration.publicationScopeSha256 ?? '',
      releaseArtifactIds,
      configuration.deployableArtifactId ?? '',
      configuration.deployableArtifactSha256 ?? '',
      pilotAcceptanceReference,
      phase7AuthorizationReference,
      phase8AuthorizationReference,
      phase8AuthorizationRequired ? configuration.phase8Authorization : null,
    )
  ) {
    throw new Error(
      'Baxter CRRT cannot be published without a separate exact-candidate publication authorization bound to the requested deployable artifact.',
    )
  }

  if (
    releaseArtifactIds.length !== CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS.length ||
    !CRRT_CURRENT_LEARNER_RELEASE_ARTIFACT_IDS.every((artifactId) =>
      releaseArtifactIds.includes(artifactId),
    )
  ) {
    throw new Error(
      'Baxter CRRT publication requires the exact closed artifact composition exposed by the current learner runtime.',
    )
  }

  return 'published'
}

export const baxterCrrtReleaseReviews: readonly BaxterCrrtReleaseReview[] = Object.freeze(
  BAXTER_CRRT_REQUIRED_PUBLICATION_REVIEW_DOMAINS.map((domain) =>
    Object.freeze({
      domain,
      label: BAXTER_CRRT_RELEASE_REVIEW_LABELS[domain],
      reviewer: null,
      reviewStatus: 'pending' as const,
      exactCandidateIdentity: null,
      exactVersionDisposition: null,
      candidateManifestSha256: null,
      findingsLedgerSha256: null,
      reviewScopeSha256: null,
      attestedAt: null,
      attestationArtifactId: null,
      attestationSha256: null,
    }),
  ),
)

export const prismaxDraftDeviceProfile: Readonly<BaxterCrrtDraftDeviceProfile> = Object.freeze({
  id: 'prismax-aw8035-2xx',
  profileVersion: 'prismax-aw8035-rb-2xx-draft.2',
  displayName: 'PrisMax educational profile',
  manufacturerDisclosure: 'Baxter',
  manualNumber: 'AW8035',
  manualRevision: 'Rev B · JUN2019',
  sourceProgramFamily: 'Manual for program 2.XX',
  marketConfiguration: 'Not established from supplied copy',
  availability: 'pilot-interface',
  publicationStatus: 'draft',
  reviewerCandidateMetadata: null,
  enabledTherapies: Object.freeze(['CVVHD pilot interface (configuration review pending)']),
  enabledSetsAndAccessories: Object.freeze([]),
  pumpAndScaleInventory: Object.freeze({
    status: 'source-mapped-pilot-surface',
    items: Object.freeze([
      'Blood pump',
      'PBP pump (inactive in pilot)',
      'Dialysate/replacement 2 pump',
      'Replacement pump (inactive in pilot)',
      'Syringe pump (inactive in pilot)',
      'Effluent pump',
      'Effluent, PBP, dialysate, and replacement scale positions',
    ]),
  }),
  flowRateRanges: Object.freeze({
    status: 'pending-set-and-configuration-review',
    ranges: Object.freeze([]),
  }),
  flowRateIncrements: Object.freeze({
    status: 'pending-set-and-configuration-review',
    increments: Object.freeze([]),
  }),
  setupSequenceStatus: 'phase-3-pilot-interface',
  screenVocabulary: Object.freeze([
    'Start',
    'Procedure',
    'Patient',
    'Therapy',
    'Prescription',
    'Sets',
    'Fluids',
    'Prime',
    'Review',
    'Connect Patient',
    'Operations',
    'Alarm window',
  ]),
  alarmBehaviorStatus: 'phase-3-window-pending-mapping',
  pressureCalculationSourceIds: Object.freeze(['DEV-PM-009', 'DEV-PM-010', 'MATH-PM-002']),
  fluidCalculationSourceIds: Object.freeze([
    'MATH-PM-001',
    'MATH-PM-003',
    'MATH-PM-005',
    'FLUID-PM-001',
    'FLUID-PM-002',
    'DOSE-PM-001',
    'DEV-PM-013',
  ]),
  unresolvedFormulaGates: Object.freeze(['CONFLICT-001', 'CONFLICT-002'] as const),
  contextualFormulaConflicts: Object.freeze([]),
  deviceReviewStatus: 'pending',
  clinicalReviewStatus: 'pending',
  sourceRecordIds: Object.freeze([
    'DEV-PM-001',
    'DEV-PM-002',
    'DEV-PM-003',
    'DEV-PM-005',
    'DEV-PM-006',
    'DEV-PM-007',
    'DEV-PM-008',
    'DEV-PM-009',
    'DEV-PM-010',
    'DEV-PM-011',
    'DEV-PM-012',
    'DEV-PM-013',
    'DEV-PM-014',
  ]),
  excludedSurfaceGroups: Object.freeze([
    'Set-specific flow ranges, increments, compatibility, and solution selection',
    'Exact alarm names, priorities, thresholds, and automatic reactions',
    'Administrator and service configuration',
    'Citrate and calcium dosing',
    'Return-blood and recirculation decisions',
    'Unreviewed clinical targets, competency decisions, Mastery, and cases beyond the three-case pilot',
    'Therapies beyond the CVVHD pilot surface',
    'Auto Effluent and optional regional features',
  ]),
})

export const baxterCrrtReleaseCandidateIdentity: string | null = null
export const baxterCrrtReleaseCandidateManifestSha256: string | null = null
export const baxterCrrtExpectedFindingsLedgerSha256: string | null = null
export const baxterCrrtExpectedReviewScopeSha256ByDomain: CrrtExpectedReviewScopeSha256ByDomain | null =
  null
export const baxterCrrtReleaseArtifactIds: readonly CrrtReleaseArtifactId[] = Object.freeze([])
export const baxterCrrtPublicationScopeSha256: string | null = null
export const baxterCrrtDeployableArtifactId: string | null = null
export const baxterCrrtDeployableArtifactSha256: string | null = null
export const baxterCrrtPilotAcceptanceReference: CrrtPilotAcceptanceAuthorizationReference | null =
  null
export const baxterCrrtPhase7AuthorizationScopeSha256: string | null = null
export const baxterCrrtPhase7Authorization: CrrtPhase7AuthorizationAttestation | null = null
export const baxterCrrtPhase8AuthorizationScopeSha256: string | null = null
export const baxterCrrtPhase8Authorization: CrrtPhase8AuthorizationAttestation | null = null
export const baxterCrrtExpectedPhase8StablePrismaxPrerequisite: CrrtPhase8StablePrismaxPrerequisite | null =
  null
export const baxterCrrtPublicationAuthorization: CrrtPublicationAuthorizationAttestation | null =
  null
export const baxterCrrtLocalConfigurationReviewStatus: BaxterCrrtReviewStatus = 'pending'
const baxterCrrtRequestedPublicationStatus: BaxterCrrtPublicationStatus = 'draft'

export const baxterCrrtPublicationStatus = resolveBaxterCrrtPublicationStatus({
  requestedStatus: baxterCrrtRequestedPublicationStatus,
  exactCandidateIdentity: baxterCrrtReleaseCandidateIdentity,
  candidateManifestSha256: baxterCrrtReleaseCandidateManifestSha256,
  expectedFindingsLedgerSha256: baxterCrrtExpectedFindingsLedgerSha256,
  expectedReviewScopeSha256ByDomain: baxterCrrtExpectedReviewScopeSha256ByDomain,
  releaseArtifactIds: baxterCrrtReleaseArtifactIds,
  publicationScopeSha256: baxterCrrtPublicationScopeSha256,
  deployableArtifactId: baxterCrrtDeployableArtifactId,
  deployableArtifactSha256: baxterCrrtDeployableArtifactSha256,
  localConfigurationReviewStatus: baxterCrrtLocalConfigurationReviewStatus,
  releaseReviews: baxterCrrtReleaseReviews,
  pilotAcceptanceReference: baxterCrrtPilotAcceptanceReference,
  phase7AuthorizationScopeSha256: baxterCrrtPhase7AuthorizationScopeSha256,
  phase7Authorization: baxterCrrtPhase7Authorization,
  phase8AuthorizationScopeSha256: baxterCrrtPhase8AuthorizationScopeSha256,
  phase8Authorization: baxterCrrtPhase8Authorization,
  expectedPhase8StablePrismaxPrerequisite: baxterCrrtExpectedPhase8StablePrismaxPrerequisite,
  publicationAuthorization: baxterCrrtPublicationAuthorization,
})

export const prismaflexReviewCandidateDeviceProfile: Readonly<BaxterCrrtDraftDeviceProfile> =
  Object.freeze({
    id: 'prismaflex-g5036003-6xx',
    profileVersion: 'prismaflex-g5036003-r05-6xx-review-candidate.1',
    displayName: 'Prismaflex reviewer-only core profile',
    manufacturerDisclosure: 'Gambro Lundia AB',
    manualNumber: 'G5036003',
    manualRevision: 'Revision 05.2011',
    sourceProgramFamily: 'Manual for program 6.xx',
    marketConfiguration: 'Multi-market source; local configuration not established',
    availability: 'deferred',
    publicationStatus: 'draft',
    reviewerCandidateMetadata: Object.freeze({
      status: 'reviewer-only',
      learnerRuntimeEnabled: false,
      adapterRegistrationStatus: 'not-registered-in-learner-runtime',
      targetConfigurationStatus: 'pending-local-configuration',
      sourceDescribedTherapyFamilies: Object.freeze(['CRRT', 'HP', 'TPE']),
      sourceDescribedCrrtModes: Object.freeze(['SCUF', 'CVVH', 'CVVHD', 'CVVHDF']),
      interfaceParadigm: Object.freeze([
        'Color touch-screen display',
        'Context-dependent softkeys',
        'Arrow controls for settings and history navigation',
      ]),
    }),
    enabledTherapies: Object.freeze([]),
    enabledSetsAndAccessories: Object.freeze([]),
    pumpAndScaleInventory: Object.freeze({
      status: 'source-mapped-review-candidate',
      items: Object.freeze([
        'Four occlusive peristaltic fluid pumps with therapy-dependent functions',
        'Four scales with therapy-dependent fluid and effluent assignments',
      ]),
    }),
    flowRateRanges: Object.freeze({
      status: 'pending-set-and-configuration-review',
      ranges: Object.freeze([]),
    }),
    flowRateIncrements: Object.freeze({
      status: 'pending-set-and-configuration-review',
      increments: Object.freeze([]),
    }),
    setupSequenceStatus: 'reviewer-only-source-mapped',
    screenVocabulary: Object.freeze([
      'Choose Patient',
      'Enter Patient Information',
      'Choose Therapy',
      'Choose Anticoagulation Method',
      'Load Set',
      'Prepare and Connect Solutions',
      'Verify Setup',
      'Prime',
      'Prime Test',
      'Enter Treatment Settings',
      'Enter Flow Settings',
      'Enter Anticoagulation Settings',
      'Review Prescription',
      'Connect Patient',
      'Verify Patient Connection',
      'Start Treatment',
      'Status',
      'History',
      'Stop',
      'Treatment Complete',
    ]),
    alarmBehaviorStatus: 'reviewer-only-generic-mapping-pending',
    pressureCalculationSourceIds: Object.freeze(['DEV-PF-004', 'DEV-PF-005', 'DEV-PF-006']),
    fluidCalculationSourceIds: Object.freeze(['DEV-PF-006']),
    unresolvedFormulaGates: Object.freeze([]),
    contextualFormulaConflicts: Object.freeze(['CONFLICT-010'] as const),
    deviceReviewStatus: 'pending',
    clinicalReviewStatus: 'pending',
    sourceRecordIds: Object.freeze([
      'DEV-PF-001',
      'DEV-PF-002',
      'DEV-PF-003',
      'DEV-PF-004',
      'DEV-PF-005',
      'DEV-PF-006',
      'DEV-PF-007',
      'DEV-PF-008',
    ]),
    excludedSurfaceGroups: Object.freeze([
      'All learner-facing device controls',
      'All runnable setup, alarm, and end-treatment workflows',
      'All clinical cases and cross-device transfer exercises',
      'Set-specific flow ranges, increments, compatibility, and solution selection',
      'Exact alarm labels, categories, automatic reactions, correction steps, and escalation rules',
      'Citrate, calcium, and actionable anticoagulation controls',
    ]),
  })

prismaflexReviewCandidateDeviceProfileSchema.parse(prismaflexReviewCandidateDeviceProfile)

/**
 * Backward-compatible name used by the learner/runtime fail-closed gate. The
 * profile now has reviewer metadata, but its learner availability stays deferred.
 */
export const prismaflexDeferredDeviceProfile = prismaflexReviewCandidateDeviceProfile
