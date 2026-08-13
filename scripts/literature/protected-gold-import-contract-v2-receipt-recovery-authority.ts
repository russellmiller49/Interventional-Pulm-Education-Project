import {
  PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256,
  buildProtectedV2ReceiptRecoveryAmendment,
  buildProtectedV2ReceiptRecoveryIncidentAmendment,
  canonicalProtectedV2ReceiptRecoveryJson,
  type ProtectedV2ReceiptRecoveryAmendment,
  type ProtectedV2ReceiptRecoveryAmendmentContent,
  type ProtectedV2ReceiptRecoveryBundle,
} from './protected-gold-import-contract-v2-receipt-recovery-amendment'

export const PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_SCHEMA_VERSION =
  'literature-gold-protected-v2-receipt-recovery-incident-authority/1.0.0' as const

export const PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_PATH =
  'scripts/literature/contracts/protected-v2-receipt-recovery-incident-authority-v1.json' as const

export const PROTECTED_V2_RECEIPT_RECOVERY_COMMITTED_AMENDMENT_PATH =
  'scripts/literature/contracts/protected-v2-receipt-recovery-amendment-v1.json' as const

const SHA256_PATTERN = /^[a-f0-9]{64}$/u

export type ProtectedV2ReceiptRecoveryIncidentAuthorityContent = Omit<
  ProtectedV2ReceiptRecoveryAmendmentContent,
  'correctedRecoveryToolBundle' | 'correctedTransitionPolicyIdentitySha256'
>

export interface ProtectedV2ReceiptRecoveryIncidentAuthority extends ProtectedV2ReceiptRecoveryIncidentAuthorityContent {
  authoritySchemaVersion: typeof PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_SCHEMA_VERSION
}

function parseCanonicalJson(bytes: string): unknown {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes) as unknown
  } catch (error) {
    throw new Error(
      `Protected V2 recovery incident authority is invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  if (canonicalProtectedV2ReceiptRecoveryJson(parsed) !== bytes) {
    throw new Error('Protected V2 recovery incident authority must be canonical JSON.')
  }
  return parsed
}

function immutableIncidentAuthorityFromReviewedSource(input: {
  correctedRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
}): ProtectedV2ReceiptRecoveryIncidentAuthorityContent {
  const reviewed = buildProtectedV2ReceiptRecoveryIncidentAmendment({
    correctedRecoveryToolBundle: input.correctedRecoveryToolBundle,
    correctedTransitionPolicyIdentitySha256:
      PROTECTED_V2_RECEIPT_RECOVERY_TRANSITION_POLICY_IDENTITY_SHA256,
  })
  const immutableAuthority = { ...reviewed } as Partial<ProtectedV2ReceiptRecoveryAmendment>
  delete immutableAuthority.amendmentIdentitySha256
  delete immutableAuthority.correctedRecoveryToolBundle
  delete immutableAuthority.correctedTransitionPolicyIdentitySha256
  return immutableAuthority as ProtectedV2ReceiptRecoveryIncidentAuthorityContent
}

/**
 * Parses the committed incident facts without embedding either changing input:
 * the reviewed current policy identity or the complete current recovery-tool bundle.
 * Both changing inputs are bound into the resulting amendment and therefore its
 * externally confirmed identity.
 */
export function buildProtectedV2ReceiptRecoveryAmendmentFromAuthority(input: {
  authorityBytes: string
  correctedRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
  correctedTransitionPolicyIdentitySha256: string
}): {
  amendment: ProtectedV2ReceiptRecoveryAmendment
  authority: ProtectedV2ReceiptRecoveryIncidentAuthority
} {
  if (!SHA256_PATTERN.test(input.correctedTransitionPolicyIdentitySha256)) {
    throw new Error('Current recovery transition-policy identity must be an exact SHA-256.')
  }
  const parsed = parseCanonicalJson(input.authorityBytes)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Protected V2 recovery incident authority must be an object.')
  }
  const authority = parsed as ProtectedV2ReceiptRecoveryIncidentAuthority
  const { authoritySchemaVersion, ...immutableAuthority } = authority
  if (
    authoritySchemaVersion !== PROTECTED_V2_RECEIPT_RECOVERY_INCIDENT_AUTHORITY_SCHEMA_VERSION ||
    canonicalProtectedV2ReceiptRecoveryJson(immutableAuthority) !==
      canonicalProtectedV2ReceiptRecoveryJson(
        immutableIncidentAuthorityFromReviewedSource({
          correctedRecoveryToolBundle: input.correctedRecoveryToolBundle,
        }),
      )
  ) {
    throw new Error(
      'Protected V2 recovery incident authority differs from the reviewed one-incident scope.',
    )
  }

  return {
    amendment: buildProtectedV2ReceiptRecoveryAmendment({
      ...immutableAuthority,
      correctedRecoveryToolBundle: input.correctedRecoveryToolBundle,
      correctedTransitionPolicyIdentitySha256: input.correctedTransitionPolicyIdentitySha256,
    }),
    authority,
  }
}

export function parseProtectedV2ReceiptRecoveryCommittedAmendment(input: {
  amendmentBytes: string
  authorityBytes: string
  correctedRecoveryToolBundle: ProtectedV2ReceiptRecoveryBundle
  correctedTransitionPolicyIdentitySha256: string
}): ProtectedV2ReceiptRecoveryAmendment {
  const committed = parseImmutableProtectedV2ReceiptRecoveryCommittedAmendment({
    amendmentBytes: input.amendmentBytes,
    authorityBytes: input.authorityBytes,
  })
  const expected = buildProtectedV2ReceiptRecoveryAmendmentFromAuthority(input).amendment
  if (
    canonicalProtectedV2ReceiptRecoveryJson(committed) !==
    canonicalProtectedV2ReceiptRecoveryJson(expected)
  ) {
    throw new Error(
      'Committed Protected V2 recovery amendment does not bind the exact current policy and recovery-tool bundle.',
    )
  }
  return expected
}

/**
 * Downstream receipt consumers authenticate the exact historical amendment bytes without
 * rebuilding today's recovery runtime. Recovery execution still uses the stricter current-runtime
 * parser above; this capability-free parser cannot authorize or execute receipt recovery.
 */
export function parseImmutableProtectedV2ReceiptRecoveryCommittedAmendment(input: {
  amendmentBytes: string
  authorityBytes: string
}): ProtectedV2ReceiptRecoveryAmendment {
  const parsed = parseCanonicalJson(input.amendmentBytes)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Committed Protected V2 recovery amendment must be an object.')
  }
  const candidate = parsed as ProtectedV2ReceiptRecoveryAmendment
  const expected = buildProtectedV2ReceiptRecoveryAmendmentFromAuthority({
    authorityBytes: input.authorityBytes,
    correctedRecoveryToolBundle: candidate.correctedRecoveryToolBundle,
    correctedTransitionPolicyIdentitySha256: candidate.correctedTransitionPolicyIdentitySha256,
  }).amendment
  if (
    canonicalProtectedV2ReceiptRecoveryJson(candidate) !==
    canonicalProtectedV2ReceiptRecoveryJson(expected)
  ) {
    throw new Error(
      'Committed Protected V2 recovery amendment does not match its immutable historical authority.',
    )
  }
  return expected
}
