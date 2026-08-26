import { z } from 'zod'

import {
  D2D_SOURCE_KINDS,
  ISO_DATE_PATTERN,
  SHA256_PATTERN,
  d2dSourceProjectionSchema,
  d2dSourceReferenceSchema,
  pinnedArtifactSchema,
} from '../../../src/features/device-intelligence/domain/evidence-source-schema'
import { PRODUCT_ID_PATTERN } from '../../../src/features/device-intelligence/domain/product-id'
import {
  DESCRIPTION_SCOPES,
  D2D_CONFIDENCES,
  PROFILE_EVIDENCE_SCOPES,
  PROFILE_REVIEW_DECISIONS,
} from '../../../src/features/device-intelligence/domain/product-profile'
import {
  REGULATORY_MATCH_LEVELS,
  REGULATORY_REVIEW_DECISIONS,
} from '../../../src/features/device-intelligence/domain/product-regulatory'
import {
  profileClaimSchema,
  profileOverlayRowSchema,
  profileSpecificationSchema,
} from '../../../src/features/device-intelligence/domain/profile-overlay-schema'
import { regulatoryOverlayRowSchema } from '../../../src/features/device-intelligence/domain/regulatory-overlay-schema'
import { normalizeManufacturerName } from '../../ip-preference-cards/openfda/normalize'

const productIdSchema = z.string().regex(PRODUCT_ID_PATTERN)
const isoDateSchema = z.string().regex(ISO_DATE_PATTERN)
const sha256Schema = z.string().regex(SHA256_PATTERN)

export const D2D_ACQUISITION_DATASETS = [
  'udi',
  '510k',
  'pma',
  'classification',
  'registrationlisting',
] as const

export const d2dAcquisitionQuerySchema = z
  .object({
    query_id: z.string().regex(/^D2D-Q-[A-Z0-9-]{4,80}$/),
    dataset: z.enum(D2D_ACQUISITION_DATASETS),
    search: z.string().trim().min(1).max(600),
    purpose: z.enum(['exact_identity', 'premarket', 'classification', 'registration_listing']),
    expected_scope: z.enum(['exact', 'family', 'product_code']),
  })
  .strict()

export const pilotSourceBindingSchema = z
  .object({
    governed_source_id: z.string().regex(/^SRC\d{3}$/),
    manifest_evidence_id: z
      .string()
      .regex(/^EVID-SC-\d{3}$/)
      .nullable(),
    source_kind: z.enum(D2D_SOURCE_KINDS),
    evidence_scope: z.enum(PROFILE_EVIDENCE_SCOPES),
    locator: z.string().trim().min(1).max(500),
    supports: z
      .array(z.enum(['identity', 'configuration', 'function', 'specification', 'regulatory']))
      .min(1),
  })
  .strict()

export const pilotProductSchema = z
  .object({
    product_id: productIdSchema,
    proposed_description_scope: z.enum(DESCRIPTION_SCOPES),
    description_profile_group_id: z
      .string()
      .regex(/^DPG-[A-Z0-9-]{4,80}$/)
      .nullable(),
    ai_draft: z.boolean(),
    source_bindings: z.array(pilotSourceBindingSchema).min(1),
    acquisition_queries: z.array(d2dAcquisitionQuerySchema).min(1),
  })
  .strict()

export const descriptionProfileGroupProposalSchema = z
  .object({
    description_profile_group_id: z.string().regex(/^DPG-[A-Z0-9-]{4,80}$/),
    label: z.string().trim().min(1).max(200),
    member_product_ids: z.array(productIdSchema).min(1),
    proposed_family_narrative: z.string().trim().min(1).max(800),
    proposed_variant_template: z.string().trim().min(1).max(500),
    allowed_variant_fields: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,79}$/)).min(1),
    review_state: z.literal('pending_owner_review'),
  })
  .strict()

export const pilotCohortArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_pilot_cohort'),
    method_version: z.literal('d2d-pilot-v1'),
    snapshot_date: isoDateSchema,
    owner_defaults: z
      .object({
        pilot: z.literal('accepted_as_planned'),
        reviewer_policy: z.literal('one_accountable_physician_owner'),
        ai_draft_product_ids: z.array(productIdSchema).length(2),
      })
      .strict(),
    manufacturer_aliases: z.array(
      z
        .object({
          manufacturer_id: z.string().regex(/^MFR-[A-Z0-9]{6,20}$/),
          canonical_name: z.string().trim().min(1).max(200),
          aliases: z.array(z.string().trim().min(1).max(200)).min(1),
        })
        .strict(),
    ),
    profile_groups: z.array(descriptionProfileGroupProposalSchema),
    products: z.array(pilotProductSchema).length(10),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = artifact.products.map((product) => product.product_id)
    if (ids.join('|') !== [...ids].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'products must be sorted', path: ['products'] })
    }
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate product_id', path: ['products'] })
    }
    const queryIds = artifact.products.flatMap((product) =>
      product.acquisition_queries.map((query) => query.query_id),
    )
    if (new Set(queryIds).size !== queryIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'query ids must be globally unique',
        path: ['products'],
      })
    }
    const aliasManufacturerIds = artifact.manufacturer_aliases.map((entry) => entry.manufacturer_id)
    if (new Set(aliasManufacturerIds).size !== aliasManufacturerIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'manufacturer alias rows must be unique',
        path: ['manufacturer_aliases'],
      })
    }
    const aliasOwner = new Map<string, string>()
    for (const [aliasIndex, entry] of artifact.manufacturer_aliases.entries()) {
      for (const value of [entry.canonical_name, ...entry.aliases]) {
        const normalized = normalizeManufacturerName(value)
        if (!normalized) continue
        const existing = aliasOwner.get(normalized)
        if (existing && existing !== entry.manufacturer_id) {
          context.addIssue({
            code: 'custom',
            message: `manufacturer alias ${value} is assigned to multiple manufacturers`,
            path: ['manufacturer_aliases', aliasIndex, 'aliases'],
          })
        }
        aliasOwner.set(normalized, entry.manufacturer_id)
      }
    }
    const aiIds = artifact.products
      .filter((product) => product.ai_draft)
      .map((product) => product.product_id)
    if (
      aiIds.sort().join('|') !== [...artifact.owner_defaults.ai_draft_product_ids].sort().join('|')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'ai_draft flags must equal owner-default product ids',
        path: ['owner_defaults', 'ai_draft_product_ids'],
      })
    }
    const productIds = new Set(ids)
    const groupIds = artifact.profile_groups.map((group) => group.description_profile_group_id)
    if (new Set(groupIds).size !== groupIds.length) {
      context.addIssue({
        code: 'custom',
        message: 'duplicate profile group id',
        path: ['profile_groups'],
      })
    }
    const groupById = new Map(
      artifact.profile_groups.map((group) => [group.description_profile_group_id, group]),
    )
    for (const [groupIndex, group] of artifact.profile_groups.entries()) {
      if (new Set(group.member_product_ids).size !== group.member_product_ids.length) {
        context.addIssue({
          code: 'custom',
          message: 'profile group member ids must be unique',
          path: ['profile_groups', groupIndex, 'member_product_ids'],
        })
      }
      for (const member of group.member_product_ids) {
        if (!productIds.has(member)) {
          context.addIssue({
            code: 'custom',
            message: `profile group member ${member} is outside the pilot`,
            path: ['profile_groups', groupIndex, 'member_product_ids'],
          })
        }
        const product = artifact.products.find((candidate) => candidate.product_id === member)
        if (
          product &&
          product.description_profile_group_id !== group.description_profile_group_id
        ) {
          context.addIssue({
            code: 'custom',
            message: `profile group member ${member} does not point back to ${group.description_profile_group_id}`,
            path: ['profile_groups', groupIndex, 'member_product_ids'],
          })
        }
      }
    }
    for (const [productIndex, product] of artifact.products.entries()) {
      if (!product.description_profile_group_id) continue
      const group = groupById.get(product.description_profile_group_id)
      if (!group || !group.member_product_ids.includes(product.product_id)) {
        context.addIssue({
          code: 'custom',
          message: `product ${product.product_id} points to an absent or non-member profile group`,
          path: ['products', productIndex, 'description_profile_group_id'],
        })
      }
    }
  })

export type PilotCohortArtifact = z.infer<typeof pilotCohortArtifactSchema>

export const reviewedEvidenceSourceSchema = d2dSourceProjectionSchema
  .extend({
    manifest_evidence_id: z
      .string()
      .regex(/^EVID-SC-\d{3}$/)
      .nullable(),
    page_count: z.number().int().positive().nullable(),
    use_policy: z.string().trim().min(1).max(1000),
    review_state: z.enum(['governed_existing_source', 'acquired_official_source']),
  })
  .strict()

export const evidenceSourceArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_reviewed_evidence_sources'),
    method_version: z.literal('d2d-evidence-sources-v1'),
    source_artifacts: z
      .object({
        governed_sources: pinnedArtifactSchema,
        source_completeness_manifest: pinnedArtifactSchema,
        pilot_cohort: pinnedArtifactSchema,
        acquisition_manifest: pinnedArtifactSchema,
      })
      .strict(),
    sources: z.array(reviewedEvidenceSourceSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = artifact.sources.map((source) => source.source_id)
    if (ids.join('|') !== [...ids].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'sources must be sorted', path: ['sources'] })
    }
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate source_id', path: ['sources'] })
    }
  })

export type EvidenceSourceArtifact = z.infer<typeof evidenceSourceArtifactSchema>

const canonicalIdentitySchema = z
  .object({
    product_id: productIdSchema,
    manufacturer_id: z.string().min(1),
    manufacturer: z.string().min(1),
    product_name: z.string().min(1),
    catalog_number: z.string().nullable(),
    brand_family: z.string().nullable(),
    gtin: z.string().nullable(),
    product_kind: z.string().nullable(),
    catalog_description: z.string().nullable(),
  })
  .strict()

export const productEvidenceBindingSchema = z
  .object({
    ...d2dSourceReferenceSchema.shape,
    evidence_scope: z.enum(PROFILE_EVIDENCE_SCOPES),
    supports: z
      .array(z.enum(['identity', 'configuration', 'function', 'specification', 'regulatory']))
      .min(1),
  })
  .strict()

export const productProfileEvidenceRowSchema = z
  .object({
    product_id: productIdSchema,
    canonical_identity: canonicalIdentitySchema,
    canonical_identity_sha256: sha256Schema,
    description_profile_group_id: z
      .string()
      .regex(/^DPG-[A-Z0-9-]{4,80}$/)
      .nullable(),
    proposed_description_scope: z.enum(DESCRIPTION_SCOPES),
    source_bindings: z.array(productEvidenceBindingSchema).min(1),
    configuration_values: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
    evidence_snapshot_date: isoDateSchema,
    evidence_review_state: z.literal('pending_owner_review'),
  })
  .strict()

export const productProfileEvidenceArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_product_profile_evidence'),
    method_version: z.literal('d2d-product-profile-evidence-v1'),
    source_artifacts: z
      .object({
        pilot_cohort: pinnedArtifactSchema,
        catalog: pinnedArtifactSchema,
        evidence_sources: pinnedArtifactSchema,
      })
      .strict(),
    profile_groups: z.array(descriptionProfileGroupProposalSchema),
    rows: z.array(productProfileEvidenceRowSchema).length(10),
  })
  .strict()

export type ProductProfileEvidenceArtifact = z.infer<typeof productProfileEvidenceArtifactSchema>

export const normalizedAcquisitionCandidateSchema = z
  .object({
    record_key: z.string().nullable(),
    primary_di: z.string().nullable(),
    package_dis: z.array(z.string()),
    company_name: z.string().nullable(),
    brand_name: z.string().nullable(),
    catalog_number: z.string().nullable(),
    model_number: z.string().nullable(),
    device_name: z.string().nullable(),
    k_number: z.string().nullable(),
    pma_number: z.string().nullable(),
    decision_code: z.string().nullable(),
    decision_date: z.string().nullable(),
    product_code: z.string().nullable(),
    regulation_number: z.string().nullable(),
    commercial_distribution_status: z.string().nullable(),
    publish_date: z.string().nullable(),
  })
  .strict()

export const acquisitionResultSchema = z
  .object({
    query_id: z.string().regex(/^D2D-Q-[A-Z0-9-]{4,80}$/),
    product_id: productIdSchema,
    dataset: z.enum(D2D_ACQUISITION_DATASETS),
    endpoint: z.string().url(),
    api_schema_version: z.string().min(1),
    normalization_method_version: z.literal('d2d-acquisition-candidate-normalization-v1'),
    response_content_type: z.literal('application/json'),
    query: z.string().min(1),
    purpose: z.enum(['exact_identity', 'premarket', 'classification', 'registration_listing']),
    expected_scope: z.enum(['exact', 'family', 'product_code']),
    dataset_last_updated: z.string().nullable(),
    retrieved_at: z.array(z.string().datetime()),
    response_sha256s: z.array(sha256Schema),
    raw_cache_references: z.array(
      z
        .string()
        .regex(
          /^local-data\/ip-device-intelligence\/d2d\/\d{4}-\d{2}-\d{2}\/openfda\/[a-z0-9]+\/[a-f0-9]{64}\.json$/,
        ),
    ),
    result_total: z.number().int().nonnegative().nullable(),
    result_count: z.number().int().nonnegative(),
    complete: z.boolean(),
    http_statuses: z.array(z.number().int()),
    pages: z.array(
      z
        .object({
          request_url: z.string().url(),
          request_limit: z.number().int().min(1).max(100),
          request_skip: z.number().int().nonnegative(),
          retrieved_at: z.string().datetime(),
          http_status: z.number().int(),
          response_sha256: sha256Schema,
          raw_cache_reference: z
            .string()
            .regex(
              /^local-data\/ip-device-intelligence\/d2d\/\d{4}-\d{2}-\d{2}\/openfda\/[a-z0-9]+\/[a-f0-9]{64}\.json$/,
            ),
        })
        .strict(),
    ),
    candidates: z.array(normalizedAcquisitionCandidateSchema),
  })
  .strict()

export const acquisitionManifestSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_acquisition_manifest'),
    method_version: z.literal('d2d-evidence-acquisition-v1'),
    snapshot_date: isoDateSchema,
    source_organization: z.literal('U.S. Food and Drug Administration / NLM'),
    pilot_cohort: pinnedArtifactSchema,
    results: z.array(acquisitionResultSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = artifact.results.map((result) => result.query_id)
    if (ids.join('|') !== [...ids].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'results must be sorted', path: ['results'] })
    }
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'duplicate query_id', path: ['results'] })
    }
  })

export type AcquisitionManifest = z.infer<typeof acquisitionManifestSchema>

export const profileDraftSchema = z
  .object({
    draft_id: z.string().regex(/^D2D-PROFILE-DRAFT-[A-Z0-9-]{4,80}$/),
    product_id: productIdSchema,
    generation: z
      .object({
        model_or_generation_method: z.string().min(1).max(120),
        prompt_version: z.string().min(1).max(120).nullable(),
        generated_at: z.string().datetime().nullable(),
        snapshot_date: isoDateSchema,
        ordered_sources: z
          .array(
            z
              .object({
                source_id: z.string().regex(/^D2D-SRC-[A-Z0-9-]{4,100}$/),
                sha256: sha256Schema,
              })
              .strict(),
          )
          .min(1),
        draft_sha256: sha256Schema,
      })
      .strict(),
    proposed_description_scope: z.enum(DESCRIPTION_SCOPES),
    summary_claims: z.array(profileClaimSchema).max(3),
    physical_device_type: profileClaimSchema.nullable(),
    intended_function: profileClaimSchema.nullable(),
    exact_configuration_summary: profileClaimSchema.nullable(),
    key_specifications: z.array(profileSpecificationSchema).max(20),
    confidence: z.enum(D2D_CONFIDENCES),
    review_state: z.literal('pending_owner_review'),
  })
  .strict()

export const profileDraftArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_product_profile_drafts'),
    method_version: z.literal('d2d-profile-draft-v1'),
    source_artifacts: z
      .object({
        profile_evidence: pinnedArtifactSchema,
        evidence_sources: pinnedArtifactSchema,
      })
      .strict(),
    drafts: z.array(profileDraftSchema).length(10),
  })
  .strict()

export type ProfileDraftArtifact = z.infer<typeof profileDraftArtifactSchema>

export const regulatoryMatchProposalSchema = z
  .object({
    match_level: z.enum(REGULATORY_MATCH_LEVELS),
    confidence: z.enum(D2D_CONFIDENCES),
    conflict_state: z.enum([
      'none',
      'conflicting_exact_records',
      'manufacturer_mismatch',
      'model_mismatch',
      'insufficient_identifiers',
    ]),
    reason_codes: z.array(z.string().regex(/^[a-z][a-z0-9_]{2,100}$/)).min(1),
    query_ids: z.array(z.string().regex(/^D2D-Q-[A-Z0-9-]{4,80}$/)).min(1),
    candidate_count: z.number().int().nonnegative(),
  })
  .strict()

export const regulatoryEvidenceCandidateSchema = normalizedAcquisitionCandidateSchema
  .extend({
    query_id: z.string().regex(/^D2D-Q-[A-Z0-9-]{4,80}$/),
    dataset: z.enum(D2D_ACQUISITION_DATASETS),
    source_refs: z.array(d2dSourceReferenceSchema).min(1),
  })
  .strict()

export const evidenceProposalRowSchema = z
  .object({
    product_id: productIdSchema,
    profile_draft_id: z.string().regex(/^D2D-PROFILE-DRAFT-[A-Z0-9-]{4,80}$/),
    regulatory_proposal_id: z.string().regex(/^D2D-REG-PROPOSAL-[A-Z0-9-]{4,80}$/),
    regulatory_match: regulatoryMatchProposalSchema,
    regulatory_evidence_candidates: z.array(regulatoryEvidenceCandidateSchema),
    source_refs: z.array(d2dSourceReferenceSchema).min(1),
    proposal_state: z.literal('pending_owner_review'),
  })
  .strict()

export const evidenceProposalArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_evidence_proposals'),
    method_version: z.literal('d2d-evidence-proposal-v1'),
    source_artifacts: z
      .object({
        pilot_cohort: pinnedArtifactSchema,
        profile_evidence: pinnedArtifactSchema,
        acquisition_manifest: pinnedArtifactSchema,
      })
      .strict(),
    rows: z.array(evidenceProposalRowSchema).length(10),
  })
  .strict()

export type EvidenceProposalArtifact = z.infer<typeof evidenceProposalArtifactSchema>

export const descriptionReviewRowSchema = z
  .object({
    review_id: z.string().regex(/^D2D-PROFILE-REVIEW-[A-Z0-9-]{4,80}$/),
    product_id: productIdSchema,
    draft_id: z.string().regex(/^D2D-PROFILE-DRAFT-[A-Z0-9-]{4,80}$/),
    decision: z.enum(PROFILE_REVIEW_DECISIONS),
    reviewer_id: z.string().min(1).max(120).nullable(),
    reviewer_role: z.literal('physician_owner').nullable(),
    reviewed_at: z.string().datetime().nullable(),
    rationale: z.string().trim().min(1).max(2000).nullable(),
    supersedes_review_id: z.string().nullable(),
    final_profile: profileOverlayRowSchema.nullable(),
  })
  .strict()
  .superRefine((row, context) => {
    const finalDecision = row.decision === 'approved' || row.decision === 'insufficient_evidence'
    if (
      finalDecision &&
      (!row.reviewer_id ||
        !row.reviewer_role ||
        !row.reviewed_at ||
        !row.rationale ||
        !row.final_profile)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'final decisions require reviewer, rationale, date, and final profile',
      })
    }
    if (!finalDecision && row.final_profile !== null) {
      context.addIssue({
        code: 'custom',
        message: 'non-final decisions may not carry a runtime profile',
        path: ['final_profile'],
      })
    }
    if (
      row.final_profile &&
      (row.final_profile.product_id !== row.product_id ||
        row.final_profile.review_id !== row.review_id)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'final profile identity must match review row',
        path: ['final_profile'],
      })
    }
  })

export const descriptionReviewArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_product_description_reviews'),
    method_version: z.literal('d2d-description-review-v1'),
    source_proposals: pinnedArtifactSchema,
    review_policy: z.literal('one_accountable_physician_owner'),
    correction_pass_limit: z.literal(1),
    rows: z.array(descriptionReviewRowSchema).length(10),
  })
  .strict()

export type DescriptionReviewArtifact = z.infer<typeof descriptionReviewArtifactSchema>

export const regulatoryReviewRowSchema = z
  .object({
    review_id: z.string().regex(/^D2D-REG-REVIEW-[A-Z0-9-]{4,80}$/),
    product_id: productIdSchema,
    proposal_id: z.string().regex(/^D2D-REG-PROPOSAL-[A-Z0-9-]{4,80}$/),
    decision: z.enum(REGULATORY_REVIEW_DECISIONS),
    reviewer_id: z.string().min(1).max(120).nullable(),
    reviewer_role: z.literal('physician_owner').nullable(),
    reviewed_at: z.string().datetime().nullable(),
    rationale: z.string().trim().min(1).max(2000).nullable(),
    supersedes_review_id: z.string().nullable(),
    final_regulatory_record: regulatoryOverlayRowSchema.nullable(),
  })
  .strict()
  .superRefine((row, context) => {
    const finalDecision = row.decision === 'approved' || row.decision === 'unresolved'
    if (
      finalDecision &&
      (!row.reviewer_id ||
        !row.reviewer_role ||
        !row.reviewed_at ||
        !row.rationale ||
        !row.final_regulatory_record)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'final decisions require reviewer, rationale, date, and final record',
      })
    }
    if (!finalDecision && row.final_regulatory_record !== null) {
      context.addIssue({
        code: 'custom',
        message: 'non-final decisions may not carry a runtime record',
        path: ['final_regulatory_record'],
      })
    }
    if (
      row.final_regulatory_record &&
      (row.final_regulatory_record.product_id !== row.product_id ||
        row.final_regulatory_record.review_id !== row.review_id)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'final regulatory identity must match review row',
        path: ['final_regulatory_record'],
      })
    }
  })

export const regulatoryReviewArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('d2d_product_regulatory_matches'),
    method_version: z.literal('d2d-regulatory-review-v1'),
    source_proposals: pinnedArtifactSchema,
    review_policy: z.literal('one_accountable_physician_owner'),
    correction_pass_limit: z.literal(1),
    rows: z.array(regulatoryReviewRowSchema).length(10),
  })
  .strict()

export type RegulatoryReviewArtifact = z.infer<typeof regulatoryReviewArtifactSchema>
