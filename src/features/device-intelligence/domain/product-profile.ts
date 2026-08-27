/**
 * Phase D2D product-profile controlled vocabulary.
 *
 * Product profiles are an editorial evidence layer. They never alter canonical identity,
 * taxonomy, roles, visibility, selectability, releases, or the preference-card product-family
 * model. All prose reaching runtime must first pass through the reviewed D2D artifacts and the
 * compact overlay schema.
 */

export const DESCRIPTION_SCOPES = [
  'exact_product',
  'family_inherited',
  'configuration_variant',
  'minimal_identity',
  'insufficient_evidence',
] as const
export type DescriptionScope = (typeof DESCRIPTION_SCOPES)[number]

export const PROFILE_EVIDENCE_SCOPES = ['exact', 'family', 'configuration'] as const
export type ProfileEvidenceScope = (typeof PROFILE_EVIDENCE_SCOPES)[number]

export const D2D_CONFIDENCES = ['high', 'moderate', 'low', 'unresolved'] as const
export type D2dConfidence = (typeof D2D_CONFIDENCES)[number]

export const PROFILE_REVIEW_DECISIONS = [
  'pending_owner_review',
  'approved',
  'insufficient_evidence',
  'rejected',
  'needs_revision',
] as const
export type ProfileReviewDecision = (typeof PROFILE_REVIEW_DECISIONS)[number]

export const PROFILE_RUNTIME_STATES = ['reviewed', 'insufficient_evidence'] as const
export type ProfileRuntimeState = (typeof PROFILE_RUNTIME_STATES)[number]

export interface ProfileSourceReference {
  source_id: string
  locator: string
}

export interface ProfileClaim {
  text: string
  evidence_scope: ProfileEvidenceScope
  source_refs: ProfileSourceReference[]
}

export interface ProfileSpecification {
  key: string
  label: string
  value: string | number | boolean
  unit: string | null
  evidence_scope: ProfileEvidenceScope
  source_refs: ProfileSourceReference[]
}

/** Exact-product claims may never be projected from family-only evidence. */
export function evidenceScopeSupportsExactClaim(scope: ProfileEvidenceScope): boolean {
  return scope === 'exact' || scope === 'configuration'
}

/** Family-level prose is allowed only on rows that disclose the inheritance boundary. */
export function descriptionScopeAllowsFamilyClaim(scope: DescriptionScope): boolean {
  return scope === 'family_inherited' || scope === 'configuration_variant'
}
