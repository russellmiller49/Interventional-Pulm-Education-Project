import { z } from 'zod'

import { PRODUCT_ID_PATTERN } from './product-id'
import {
  DESCRIPTION_SCOPES,
  D2D_CONFIDENCES,
  PROFILE_EVIDENCE_SCOPES,
  PROFILE_RUNTIME_STATES,
  descriptionScopeAllowsFamilyClaim,
} from './product-profile'
import {
  ISO_DATE_PATTERN,
  d2dSourceProjectionSchema,
  d2dSourceReferenceSchema,
  pinnedArtifactSchema,
} from './evidence-source-schema'

export const profileClaimSchema = z
  .object({
    text: z.string().trim().min(1).max(800),
    evidence_scope: z.enum(PROFILE_EVIDENCE_SCOPES),
    source_refs: z.array(d2dSourceReferenceSchema).min(1),
  })
  .strict()

export const profileSpecificationSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
    label: z.string().trim().min(1).max(120),
    value: z.union([z.string().trim().min(1).max(300), z.number().finite(), z.boolean()]),
    unit: z.string().trim().min(1).max(40).nullable(),
    evidence_scope: z.enum(PROFILE_EVIDENCE_SCOPES),
    source_refs: z.array(d2dSourceReferenceSchema).min(1),
  })
  .strict()

export const profileOverlayRowSchema = z
  .object({
    product_id: z.string().regex(PRODUCT_ID_PATTERN),
    content_locale: z.literal('en'),
    runtime_state: z.enum(PROFILE_RUNTIME_STATES),
    description_scope: z.enum(DESCRIPTION_SCOPES),
    summary_claims: z.array(profileClaimSchema).max(3),
    physical_device_type: profileClaimSchema.nullable(),
    intended_function: profileClaimSchema.nullable(),
    exact_configuration_summary: profileClaimSchema.nullable(),
    key_specifications: z.array(profileSpecificationSchema).max(20),
    confidence: z.enum(D2D_CONFIDENCES),
    as_of_date: z.string().regex(ISO_DATE_PATTERN),
    review_id: z.string().regex(/^D2D-PROFILE-REVIEW-[A-Z0-9-]{4,80}$/),
  })
  .strict()
  .superRefine((row, context) => {
    const claims = [
      ...row.summary_claims,
      row.physical_device_type,
      row.intended_function,
      row.exact_configuration_summary,
      ...row.key_specifications,
    ].filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))

    if (row.runtime_state === 'insufficient_evidence') {
      if (row.description_scope !== 'insufficient_evidence') {
        context.addIssue({
          code: 'custom',
          message: 'insufficient runtime state requires insufficient_evidence scope',
          path: ['description_scope'],
        })
      }
      if (claims.length > 0) {
        context.addIssue({
          code: 'custom',
          message: 'insufficient-evidence rows may not carry public claims',
          path: ['summary_claims'],
        })
      }
    } else if (row.description_scope === 'insufficient_evidence') {
      context.addIssue({
        code: 'custom',
        message: 'reviewed runtime rows cannot use insufficient_evidence scope',
        path: ['description_scope'],
      })
    }

    for (const [index, claim] of claims.entries()) {
      if (
        claim.evidence_scope === 'family' &&
        !descriptionScopeAllowsFamilyClaim(row.description_scope)
      ) {
        context.addIssue({
          code: 'custom',
          message: 'family evidence requires family_inherited or configuration_variant scope',
          path: ['claims', index, 'evidence_scope'],
        })
      }
    }
  })

export type ProfileOverlayRow = z.infer<typeof profileOverlayRowSchema>

export const profileOverlayArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('device_intelligence_product_profile_overlay'),
    method_version: z.literal('d2d-product-profile-overlay-v1'),
    row_scope: z.literal('reviewed_d2d_pilot_only'),
    source_artifacts: z
      .object({
        evidence_sources: pinnedArtifactSchema,
        description_reviews: pinnedArtifactSchema,
      })
      .strict(),
    counts: z
      .object({
        pilot_products: z.literal(10),
        rows: z.number().int().nonnegative(),
        reviewed: z.number().int().nonnegative(),
        insufficient_evidence: z.number().int().nonnegative(),
      })
      .strict(),
    sources: z.array(d2dSourceProjectionSchema),
    rows: z.array(profileOverlayRowSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const sourceIds = artifact.sources.map((source) => source.source_id)
    if (sourceIds.join('|') !== [...sourceIds].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'sources must be sorted', path: ['sources'] })
    }
    if (new Set(sourceIds).size !== sourceIds.length) {
      context.addIssue({ code: 'custom', message: 'duplicate source_id', path: ['sources'] })
    }
    const productIds = artifact.rows.map((row) => row.product_id)
    if (productIds.join('|') !== [...productIds].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'rows must be sorted', path: ['rows'] })
    }
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({ code: 'custom', message: 'duplicate product_id', path: ['rows'] })
    }

    const knownSources = new Set(sourceIds)
    const referencedSources = new Set<string>()
    for (const [rowIndex, row] of artifact.rows.entries()) {
      const claims = [
        ...row.summary_claims,
        row.physical_device_type,
        row.intended_function,
        row.exact_configuration_summary,
        ...row.key_specifications,
      ].filter((claim): claim is NonNullable<typeof claim> => Boolean(claim))
      for (const claim of claims) {
        for (const reference of claim.source_refs) {
          referencedSources.add(reference.source_id)
          if (!knownSources.has(reference.source_id)) {
            context.addIssue({
              code: 'custom',
              message: `unknown source reference ${reference.source_id}`,
              path: ['rows', rowIndex],
            })
          }
        }
      }
    }
    for (const [sourceIndex, sourceId] of sourceIds.entries()) {
      if (!referencedSources.has(sourceId)) {
        context.addIssue({
          code: 'custom',
          message: `unreferenced compact source ${sourceId}`,
          path: ['sources', sourceIndex],
        })
      }
    }
    if (artifact.counts.rows !== artifact.rows.length) {
      context.addIssue({
        code: 'custom',
        message: 'counts.rows mismatch',
        path: ['counts', 'rows'],
      })
    }
    if (
      artifact.counts.reviewed !==
      artifact.rows.filter((row) => row.runtime_state === 'reviewed').length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'counts.reviewed mismatch',
        path: ['counts', 'reviewed'],
      })
    }
    if (
      artifact.counts.insufficient_evidence !==
      artifact.rows.filter((row) => row.runtime_state === 'insufficient_evidence').length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'counts.insufficient_evidence mismatch',
        path: ['counts', 'insufficient_evidence'],
      })
    }
  })

export type ProfileOverlayArtifact = z.infer<typeof profileOverlayArtifactSchema>
