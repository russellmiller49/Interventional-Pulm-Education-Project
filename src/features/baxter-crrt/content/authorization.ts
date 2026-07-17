import {
  CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS,
  getCrrtArtifactClassification,
  hasUniqueCrrtReleaseArtifactIds,
  type CrrtReleaseArtifactId,
} from './artifactRegistry'
import { isBaxterCrrtExactCandidateIdentity } from './candidateIdentity'
import { isBaxterCrrtAttestationSha256, isBaxterCrrtIsoAttestationTime } from './reviewAttestation'

export const CRRT_PHASE_7_AUTHORIZED_DECISION = 'PHASE-7-AUTHORIZED-ONLY-AS-ITEMIZED-ABOVE' as const
export const CRRT_PHASE_8_AUTHORIZED_DECISION = 'PHASE-8-AUTHORIZED-ONLY-AS-ITEMIZED-ABOVE' as const
export const CRRT_PILOT_ACCEPTED_DECISION = 'PILOT-ACCEPTED-FOR-SEPARATE-PHASE-7-DECISION' as const
export const CRRT_PUBLICATION_AUTHORIZED_DECISION =
  'PUBLICATION-AUTHORIZED-ONLY-AS-ITEMIZED-ABOVE' as const

interface CrrtAuthorizationAttestationBase {
  readonly exactCandidateIdentity: string
  readonly candidateManifestSha256: string
  readonly findingsLedgerSha256: string
  readonly authorizationRecordId: string
  readonly authorizationRecordSha256: string
  readonly authorizedAt: string
  readonly authorizerSubjectId: string
  readonly attestationSystem: string
  readonly attestationReceiptId: string
  readonly attestationSha256: string
}

export interface CrrtPhase7AuthorizationAttestation extends CrrtAuthorizationAttestationBase {
  readonly kind: 'phase-7'
  readonly decision: typeof CRRT_PHASE_7_AUTHORIZED_DECISION
  readonly authorizationScopeSha256: string
  readonly authorizedArtifactIds: readonly CrrtReleaseArtifactId[]
  readonly acceptedPilotAuthorizationReference: CrrtPilotAcceptanceAuthorizationReference
}

export interface CrrtPhase8AuthorizationAttestation extends CrrtAuthorizationAttestationBase {
  readonly kind: 'phase-8'
  readonly decision: typeof CRRT_PHASE_8_AUTHORIZED_DECISION
  readonly authorizationScopeSha256: string
  readonly authorizedArtifactIds: readonly CrrtReleaseArtifactId[]
  readonly stablePrismaxCandidateIdentity: string
  readonly stablePrismaxCandidateManifestSha256: string
  readonly stablePrismaxFindingsLedgerSha256: string
  readonly prismaxActivationAuthorizationRecordId: string
  readonly prismaxActivationAuthorizationSha256: string
  readonly prismaxPublicationAuthorizationRecordId: string
  readonly prismaxPublicationAuthorizationSha256: string
}

export interface CrrtPhase8StablePrismaxPrerequisite {
  /**
   * Normalized output of the controlled external record resolver. Arbitrary
   * caller-constructed objects are not authenticated evidence. The resolver
   * must verify the referenced accepted activation and publication decisions,
   * their exact stable PrisMax scope/allowlists, and both record digests before
   * supplying this value to a gate.
   */
  readonly exactCandidateIdentity: string
  readonly candidateManifestSha256: string
  readonly findingsLedgerSha256: string
  readonly activationAuthorizationRecordId: string
  readonly activationAuthorizationSha256: string
  readonly publicationAuthorizationRecordId: string
  readonly publicationAuthorizationSha256: string
}

export interface CrrtPublicationAuthorizationAttestation extends CrrtAuthorizationAttestationBase {
  readonly kind: 'publication'
  readonly decision: typeof CRRT_PUBLICATION_AUTHORIZED_DECISION
  readonly publicationScopeSha256: string
  readonly authorizedArtifactIds: readonly CrrtReleaseArtifactId[]
  readonly deployableArtifactId: string
  readonly deployableArtifactSha256: string
  readonly pilotAcceptanceReference: CrrtPilotAcceptanceAuthorizationReference | null
  readonly phase7AuthorizationReference: CrrtCandidateBoundAuthorizationReference | null
  readonly phase8AuthorizationReference: CrrtCandidateBoundAuthorizationReference | null
}

interface CrrtCandidateBoundAuthorizationReferenceBase {
  readonly exactCandidateIdentity: string
  readonly candidateManifestSha256: string
  readonly findingsLedgerSha256: string
  readonly authorizationRecordId: string
  readonly authorizationRecordSha256: string
}

export interface CrrtPilotAcceptanceAuthorizationReference extends CrrtCandidateBoundAuthorizationReferenceBase {
  /** Produced only after the external attestation system authenticates the receipt and record. */
  readonly kind: 'pilot-acceptance'
  readonly decision: typeof CRRT_PILOT_ACCEPTED_DECISION
  readonly authorizationScopeSha256: string
  readonly authorizedArtifactIds: readonly CrrtReleaseArtifactId[]
}

export interface CrrtPhaseAuthorizationReference extends CrrtCandidateBoundAuthorizationReferenceBase {
  readonly kind: 'phase-7' | 'phase-8'
}

export type CrrtCandidateBoundAuthorizationReference =
  | CrrtPilotAcceptanceAuthorizationReference
  | CrrtPhaseAuthorizationReference
export type CrrtCandidateBoundAuthorizationKind = CrrtCandidateBoundAuthorizationReference['kind']

export type CrrtActivationAuthorizationAttestation =
  | CrrtPhase7AuthorizationAttestation
  | CrrtPhase8AuthorizationAttestation

/**
 * These validators enforce the normalized receipt shape and exact artifact
 * bindings consumed by runtime gates. Receipt authentication remains the
 * responsibility of the approved external attestation system. Expected
 * references and prerequisites must be resolved from that trusted immutable
 * record source; callers must never derive them from the attestation currently
 * being validated.
 */
function hasRecordedText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function hasCompleteBaseFields(
  authorization: CrrtAuthorizationAttestationBase,
  exactCandidateIdentity: string,
  candidateManifestSha256: string,
  expectedFindingsLedgerSha256: string,
): boolean {
  return (
    isBaxterCrrtExactCandidateIdentity(exactCandidateIdentity) &&
    authorization.exactCandidateIdentity === exactCandidateIdentity &&
    isBaxterCrrtAttestationSha256(candidateManifestSha256) &&
    authorization.candidateManifestSha256 === candidateManifestSha256 &&
    isBaxterCrrtAttestationSha256(authorization.candidateManifestSha256) &&
    isBaxterCrrtAttestationSha256(expectedFindingsLedgerSha256) &&
    authorization.findingsLedgerSha256 === expectedFindingsLedgerSha256 &&
    isBaxterCrrtAttestationSha256(authorization.findingsLedgerSha256) &&
    hasRecordedText(authorization.authorizationRecordId) &&
    isBaxterCrrtAttestationSha256(authorization.authorizationRecordSha256) &&
    isBaxterCrrtIsoAttestationTime(authorization.authorizedAt) &&
    hasRecordedText(authorization.authorizerSubjectId) &&
    hasRecordedText(authorization.attestationSystem) &&
    hasRecordedText(authorization.attestationReceiptId) &&
    isBaxterCrrtAttestationSha256(authorization.attestationSha256) &&
    authorization.authorizationRecordId !== authorization.attestationReceiptId &&
    authorization.authorizationRecordSha256 !== authorization.attestationSha256
  )
}

function hasAuthorizedArtifactCoverage(
  authorizedArtifactIds: readonly string[],
  requiredArtifactIds: readonly CrrtReleaseArtifactId[],
  requiredPhase: 'phase-7' | 'phase-8',
): boolean {
  return (
    hasUniqueCrrtReleaseArtifactIds(authorizedArtifactIds) &&
    authorizedArtifactIds.every(
      (artifactId) => getCrrtArtifactClassification(artifactId)?.phase === requiredPhase,
    ) &&
    requiredArtifactIds.length > 0 &&
    requiredArtifactIds.every((artifactId) => authorizedArtifactIds.includes(artifactId))
  )
}

function hasExactArtifactAllowlist(
  authorizedArtifactIds: readonly string[],
  expectedArtifactIds: readonly CrrtReleaseArtifactId[],
): boolean {
  return (
    hasUniqueCrrtReleaseArtifactIds(authorizedArtifactIds) &&
    hasUniqueCrrtReleaseArtifactIds(expectedArtifactIds) &&
    authorizedArtifactIds.length === expectedArtifactIds.length &&
    expectedArtifactIds.every((artifactId) => authorizedArtifactIds.includes(artifactId))
  )
}

export function hasCompleteCrrtCandidateBoundAuthorizationReference(
  reference: CrrtCandidateBoundAuthorizationReference | null,
  expectedKind: CrrtCandidateBoundAuthorizationKind,
  exactCandidateIdentity: string,
  candidateManifestSha256: string,
  expectedFindingsLedgerSha256: string,
): boolean {
  const hasCompleteBaseReference =
    reference !== null &&
    reference.kind === expectedKind &&
    reference.exactCandidateIdentity === exactCandidateIdentity &&
    reference.candidateManifestSha256 === candidateManifestSha256 &&
    reference.findingsLedgerSha256 === expectedFindingsLedgerSha256 &&
    isBaxterCrrtExactCandidateIdentity(reference.exactCandidateIdentity) &&
    isBaxterCrrtAttestationSha256(reference.candidateManifestSha256) &&
    isBaxterCrrtAttestationSha256(reference.findingsLedgerSha256) &&
    hasRecordedText(reference.authorizationRecordId) &&
    isBaxterCrrtAttestationSha256(reference.authorizationRecordSha256)
  if (!hasCompleteBaseReference) return false
  if (expectedKind !== 'pilot-acceptance') return true
  return (
    reference.kind === 'pilot-acceptance' &&
    reference.decision === CRRT_PILOT_ACCEPTED_DECISION &&
    isBaxterCrrtAttestationSha256(reference.authorizationScopeSha256) &&
    hasExactArtifactAllowlist(
      reference.authorizedArtifactIds,
      CRRT_PROTECTED_PILOT_RELEASE_ARTIFACT_IDS,
    )
  )
}

function hasExactAuthorizationReference(
  actual: CrrtCandidateBoundAuthorizationReference | null,
  expected: CrrtCandidateBoundAuthorizationReference | null,
): boolean {
  if (expected === null) return actual === null
  return (
    actual !== null &&
    hasCompleteCrrtCandidateBoundAuthorizationReference(
      actual,
      expected.kind,
      expected.exactCandidateIdentity,
      expected.candidateManifestSha256,
      expected.findingsLedgerSha256,
    ) &&
    actual.authorizationRecordId === expected.authorizationRecordId &&
    actual.authorizationRecordSha256 === expected.authorizationRecordSha256 &&
    (expected.kind !== 'pilot-acceptance' ||
      (actual.kind === 'pilot-acceptance' &&
        actual.decision === expected.decision &&
        actual.authorizationScopeSha256 === expected.authorizationScopeSha256 &&
        hasExactArtifactAllowlist(actual.authorizedArtifactIds, expected.authorizedArtifactIds)))
  )
}

function hasDistinctPublicationAuthorizationReferences(
  publicationAuthorization: CrrtPublicationAuthorizationAttestation,
  references: readonly (CrrtCandidateBoundAuthorizationReference | null)[],
  phase8Authorization: CrrtPhase8AuthorizationAttestation | null,
): boolean {
  const presentReferences = references.filter(
    (reference): reference is CrrtCandidateBoundAuthorizationReference => reference !== null,
  )
  const recordIds = [
    publicationAuthorization.authorizationRecordId,
    publicationAuthorization.attestationReceiptId,
    ...presentReferences.map((reference) => reference.authorizationRecordId),
    ...(phase8Authorization === null
      ? []
      : [
          phase8Authorization.prismaxActivationAuthorizationRecordId,
          phase8Authorization.prismaxPublicationAuthorizationRecordId,
        ]),
  ]
  const recordSha256Digests = [
    publicationAuthorization.authorizationRecordSha256,
    publicationAuthorization.attestationSha256,
    ...presentReferences.map((reference) => reference.authorizationRecordSha256),
    ...(phase8Authorization === null
      ? []
      : [
          phase8Authorization.prismaxActivationAuthorizationSha256,
          phase8Authorization.prismaxPublicationAuthorizationSha256,
        ]),
  ]
  return (
    new Set(recordIds).size === recordIds.length &&
    new Set(recordSha256Digests).size === recordSha256Digests.length
  )
}

export function hasCompleteCrrtPhase7Authorization(
  authorization: CrrtPhase7AuthorizationAttestation | null,
  exactCandidateIdentity: string,
  candidateManifestSha256: string,
  expectedFindingsLedgerSha256: string,
  expectedAuthorizationScopeSha256: string,
  requiredArtifactIds: readonly CrrtReleaseArtifactId[],
  expectedPilotAcceptanceReference: CrrtCandidateBoundAuthorizationReference | null,
): boolean {
  return (
    authorization !== null &&
    authorization.kind === 'phase-7' &&
    authorization.decision === CRRT_PHASE_7_AUTHORIZED_DECISION &&
    hasCompleteBaseFields(
      authorization,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
    ) &&
    isBaxterCrrtAttestationSha256(expectedAuthorizationScopeSha256) &&
    authorization.authorizationScopeSha256 === expectedAuthorizationScopeSha256 &&
    isBaxterCrrtAttestationSha256(authorization.authorizationScopeSha256) &&
    hasAuthorizedArtifactCoverage(
      authorization.authorizedArtifactIds,
      requiredArtifactIds,
      'phase-7',
    ) &&
    hasCompleteCrrtCandidateBoundAuthorizationReference(
      expectedPilotAcceptanceReference,
      'pilot-acceptance',
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
    ) &&
    hasExactAuthorizationReference(
      authorization.acceptedPilotAuthorizationReference,
      expectedPilotAcceptanceReference,
    ) &&
    authorization.acceptedPilotAuthorizationReference.authorizationRecordId !==
      authorization.authorizationRecordId &&
    authorization.acceptedPilotAuthorizationReference.authorizationRecordId !==
      authorization.attestationReceiptId &&
    authorization.acceptedPilotAuthorizationReference.authorizationRecordSha256 !==
      authorization.authorizationRecordSha256 &&
    authorization.acceptedPilotAuthorizationReference.authorizationRecordSha256 !==
      authorization.attestationSha256
  )
}

export function hasCompleteCrrtPhase8Authorization(
  authorization: CrrtPhase8AuthorizationAttestation | null,
  exactCandidateIdentity: string,
  candidateManifestSha256: string,
  expectedFindingsLedgerSha256: string,
  expectedAuthorizationScopeSha256: string,
  requiredArtifactIds: readonly CrrtReleaseArtifactId[],
  expectedStablePrismaxPrerequisite: CrrtPhase8StablePrismaxPrerequisite | null,
): boolean {
  return (
    authorization !== null &&
    authorization.kind === 'phase-8' &&
    authorization.decision === CRRT_PHASE_8_AUTHORIZED_DECISION &&
    hasCompleteBaseFields(
      authorization,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
    ) &&
    isBaxterCrrtAttestationSha256(expectedAuthorizationScopeSha256) &&
    authorization.authorizationScopeSha256 === expectedAuthorizationScopeSha256 &&
    isBaxterCrrtAttestationSha256(authorization.authorizationScopeSha256) &&
    hasAuthorizedArtifactCoverage(
      authorization.authorizedArtifactIds,
      requiredArtifactIds,
      'phase-8',
    ) &&
    isBaxterCrrtExactCandidateIdentity(authorization.stablePrismaxCandidateIdentity) &&
    authorization.stablePrismaxCandidateIdentity !== exactCandidateIdentity &&
    isBaxterCrrtAttestationSha256(authorization.stablePrismaxCandidateManifestSha256) &&
    authorization.stablePrismaxCandidateManifestSha256 !== candidateManifestSha256 &&
    isBaxterCrrtAttestationSha256(authorization.stablePrismaxFindingsLedgerSha256) &&
    expectedStablePrismaxPrerequisite !== null &&
    isBaxterCrrtExactCandidateIdentity(expectedStablePrismaxPrerequisite.exactCandidateIdentity) &&
    isBaxterCrrtAttestationSha256(expectedStablePrismaxPrerequisite.candidateManifestSha256) &&
    isBaxterCrrtAttestationSha256(expectedStablePrismaxPrerequisite.findingsLedgerSha256) &&
    hasRecordedText(expectedStablePrismaxPrerequisite.activationAuthorizationRecordId) &&
    isBaxterCrrtAttestationSha256(
      expectedStablePrismaxPrerequisite.activationAuthorizationSha256,
    ) &&
    hasRecordedText(expectedStablePrismaxPrerequisite.publicationAuthorizationRecordId) &&
    isBaxterCrrtAttestationSha256(
      expectedStablePrismaxPrerequisite.publicationAuthorizationSha256,
    ) &&
    authorization.stablePrismaxCandidateIdentity ===
      expectedStablePrismaxPrerequisite.exactCandidateIdentity &&
    authorization.stablePrismaxCandidateManifestSha256 ===
      expectedStablePrismaxPrerequisite.candidateManifestSha256 &&
    authorization.stablePrismaxFindingsLedgerSha256 ===
      expectedStablePrismaxPrerequisite.findingsLedgerSha256 &&
    authorization.prismaxActivationAuthorizationRecordId ===
      expectedStablePrismaxPrerequisite.activationAuthorizationRecordId &&
    authorization.prismaxActivationAuthorizationSha256 ===
      expectedStablePrismaxPrerequisite.activationAuthorizationSha256 &&
    authorization.prismaxPublicationAuthorizationRecordId ===
      expectedStablePrismaxPrerequisite.publicationAuthorizationRecordId &&
    authorization.prismaxPublicationAuthorizationSha256 ===
      expectedStablePrismaxPrerequisite.publicationAuthorizationSha256 &&
    hasRecordedText(authorization.prismaxActivationAuthorizationRecordId) &&
    isBaxterCrrtAttestationSha256(authorization.prismaxActivationAuthorizationSha256) &&
    hasRecordedText(authorization.prismaxPublicationAuthorizationRecordId) &&
    isBaxterCrrtAttestationSha256(authorization.prismaxPublicationAuthorizationSha256) &&
    authorization.prismaxActivationAuthorizationRecordId !== authorization.authorizationRecordId &&
    authorization.prismaxPublicationAuthorizationRecordId !== authorization.authorizationRecordId &&
    authorization.prismaxActivationAuthorizationRecordId !== authorization.attestationReceiptId &&
    authorization.prismaxPublicationAuthorizationRecordId !== authorization.attestationReceiptId &&
    authorization.prismaxActivationAuthorizationRecordId !==
      authorization.prismaxPublicationAuthorizationRecordId &&
    authorization.prismaxActivationAuthorizationSha256 !==
      authorization.authorizationRecordSha256 &&
    authorization.prismaxPublicationAuthorizationSha256 !==
      authorization.authorizationRecordSha256 &&
    authorization.prismaxActivationAuthorizationSha256 !== authorization.attestationSha256 &&
    authorization.prismaxPublicationAuthorizationSha256 !== authorization.attestationSha256 &&
    authorization.prismaxActivationAuthorizationSha256 !==
      authorization.prismaxPublicationAuthorizationSha256
  )
}

export function hasCompleteCrrtPublicationAuthorization(
  authorization: CrrtPublicationAuthorizationAttestation | null,
  exactCandidateIdentity: string,
  candidateManifestSha256: string,
  expectedFindingsLedgerSha256: string,
  expectedPublicationScopeSha256: string,
  expectedArtifactIds: readonly CrrtReleaseArtifactId[],
  deployableArtifactId: string,
  deployableArtifactSha256: string,
  pilotAcceptanceReference: CrrtPilotAcceptanceAuthorizationReference | null,
  phase7AuthorizationReference: CrrtCandidateBoundAuthorizationReference | null,
  phase8AuthorizationReference: CrrtCandidateBoundAuthorizationReference | null,
  phase8Authorization: CrrtPhase8AuthorizationAttestation | null,
): boolean {
  return (
    authorization !== null &&
    authorization.kind === 'publication' &&
    authorization.decision === CRRT_PUBLICATION_AUTHORIZED_DECISION &&
    hasCompleteBaseFields(
      authorization,
      exactCandidateIdentity,
      candidateManifestSha256,
      expectedFindingsLedgerSha256,
    ) &&
    isBaxterCrrtAttestationSha256(expectedPublicationScopeSha256) &&
    authorization.publicationScopeSha256 === expectedPublicationScopeSha256 &&
    isBaxterCrrtAttestationSha256(authorization.publicationScopeSha256) &&
    hasExactArtifactAllowlist(authorization.authorizedArtifactIds, expectedArtifactIds) &&
    hasRecordedText(deployableArtifactId) &&
    authorization.deployableArtifactId === deployableArtifactId &&
    isBaxterCrrtAttestationSha256(deployableArtifactSha256) &&
    authorization.deployableArtifactSha256 === deployableArtifactSha256 &&
    isBaxterCrrtAttestationSha256(authorization.deployableArtifactSha256) &&
    hasExactAuthorizationReference(
      authorization.pilotAcceptanceReference,
      pilotAcceptanceReference,
    ) &&
    hasExactAuthorizationReference(
      authorization.phase7AuthorizationReference,
      phase7AuthorizationReference,
    ) &&
    hasExactAuthorizationReference(
      authorization.phase8AuthorizationReference,
      phase8AuthorizationReference,
    ) &&
    hasDistinctPublicationAuthorizationReferences(
      authorization,
      [pilotAcceptanceReference, phase7AuthorizationReference, phase8AuthorizationReference],
      phase8Authorization,
    )
  )
}
