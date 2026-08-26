import { z } from 'zod'

import { PRODUCT_ID_PATTERN } from './product-id'
import { D2D_CONFIDENCES } from './product-profile'
import {
  COMMERCIAL_DISTRIBUTION_STATES,
  DEVICE_CLASSES,
  REGULATORY_CONCLUSION_CODES,
  REGULATORY_EVIDENCE_SCOPES,
  REGULATORY_MATCH_LEVELS,
  REGULATORY_RESEARCH_STATES,
  deriveRegulatoryConclusionCodes,
} from './product-regulatory'
import {
  ISO_DATE_PATTERN,
  d2dSourceProjectionSchema,
  d2dSourceReferenceSchema,
  pinnedArtifactSchema,
} from './evidence-source-schema'

const nullableIsoDateSchema = z.string().regex(ISO_DATE_PATTERN).nullable()
const evidenceScopeSchema = z.enum(REGULATORY_EVIDENCE_SCOPES)
const sourceRefsSchema = z.array(d2dSourceReferenceSchema).min(1)

export const udiIdentitySchema = z
  .object({
    primary_di: z.string().regex(/^[A-Za-z0-9+./-]{4,80}$/),
    package_dis: z.array(z.string().regex(/^[A-Za-z0-9+./-]{4,80}$/)),
    issuing_agency: z.string().trim().min(1).max(80).nullable(),
    legal_manufacturer: z.string().trim().min(1).max(200),
    brand_name: z.string().trim().min(1).max(200).nullable(),
    model_catalog_number: z.string().trim().min(1).max(160).nullable(),
    publish_date: nullableIsoDateSchema,
    evidence_scope: evidenceScopeSchema,
    source_refs: sourceRefsSchema,
  })
  .strict()

export const regulatoryClassificationSchema = z
  .object({
    product_code: z.string().regex(/^[A-Z]{3}$/),
    device_class: z.enum(DEVICE_CLASSES),
    regulation_number: z
      .string()
      .regex(/^\d{3}\.\d{1,6}$/)
      .nullable(),
    classification_name: z.string().trim().min(1).max(240).nullable(),
    evidence_scope: evidenceScopeSchema,
    source_refs: sourceRefsSchema,
  })
  .strict()

const pathwayBase = {
  decision_date: nullableIsoDateSchema,
  evidence_scope: evidenceScopeSchema,
  source_refs: sourceRefsSchema,
}

export const regulatoryPathwaySchema = z.discriminatedUnion('pathway', [
  z
    .object({
      pathway: z.literal('510k'),
      submission_number: z.string().regex(/^K\d{6}$/),
      decision: z.enum([
        'substantially_equivalent',
        'not_substantially_equivalent',
        'withdrawn',
        'unknown',
      ]),
      ...pathwayBase,
    })
    .strict(),
  z
    .object({
      pathway: z.literal('pma'),
      submission_number: z.string().regex(/^P\d{6}$/),
      decision: z.enum(['approved', 'denied', 'withdrawn', 'unknown']),
      ...pathwayBase,
    })
    .strict(),
  z
    .object({
      pathway: z.literal('de_novo'),
      submission_number: z.string().regex(/^DEN\d{6}$/),
      decision: z.enum(['granted', 'declined', 'withdrawn', 'unknown']),
      ...pathwayBase,
    })
    .strict(),
  z
    .object({
      pathway: z.literal('hde'),
      submission_number: z.string().regex(/^H\d{6}$/),
      decision: z.enum(['approved', 'denied', 'withdrawn', 'unknown']),
      ...pathwayBase,
    })
    .strict(),
  z
    .object({
      pathway: z.literal('premarket_exempt'),
      submission_number: z.null(),
      decision: z.literal('exempt'),
      decision_date: z.null(),
      evidence_scope: evidenceScopeSchema,
      source_refs: sourceRefsSchema,
    })
    .strict(),
])

export const registrationListingSchema = z
  .object({
    establishment_registration_number: z.string().trim().min(1).max(80).nullable(),
    listing_number: z.string().trim().min(1).max(80).nullable(),
    proprietary_name: z.string().trim().min(1).max(240).nullable(),
    product_code: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    status: z.enum(['listed', 'not_found', 'unknown']),
    as_of_date: z.string().regex(ISO_DATE_PATTERN),
    evidence_scope: evidenceScopeSchema,
    source_refs: sourceRefsSchema,
  })
  .strict()

export const commercialDistributionEvidenceSchema = z
  .object({
    status: z.enum(COMMERCIAL_DISTRIBUTION_STATES),
    as_of_date: z.string().regex(ISO_DATE_PATTERN),
    evidence_scope: evidenceScopeSchema,
    source_refs: sourceRefsSchema,
  })
  .strict()

export const regulatoryOverlayRowSchema = z
  .object({
    product_id: z.string().regex(PRODUCT_ID_PATTERN),
    research_state: z.enum(REGULATORY_RESEARCH_STATES),
    research_as_of_date: z.string().regex(ISO_DATE_PATTERN),
    match_level: z.enum(REGULATORY_MATCH_LEVELS),
    confidence: z.enum(D2D_CONFIDENCES),
    canonical_manufacturer: z.string().trim().min(1).max(200),
    evidence_legal_manufacturer: z.string().trim().min(1).max(200).nullable(),
    canonical_catalog_number: z.string().trim().min(1).max(160).nullable(),
    evidence_model_catalog_number: z.string().trim().min(1).max(160).nullable(),
    conflict_state: z.enum([
      'none',
      'conflicting_exact_records',
      'manufacturer_mismatch',
      'model_mismatch',
      'insufficient_identifiers',
    ]),
    udi_identities: z.array(udiIdentitySchema),
    classifications: z.array(regulatoryClassificationSchema),
    pathways: z.array(regulatoryPathwaySchema),
    registration_listing_evidence: z.array(registrationListingSchema),
    commercial_distribution_evidence: z.array(commercialDistributionEvidenceSchema),
    conclusion_codes: z.array(z.enum(REGULATORY_CONCLUSION_CODES)),
    review_id: z.string().regex(/^D2D-REG-REVIEW-[A-Z0-9-]{4,80}$/),
  })
  .strict()
  .superRefine((row, context) => {
    const exactListingFound = row.registration_listing_evidence.some(
      (record) => record.status === 'listed' && record.evidence_scope === 'exact',
    )
    const expected = deriveRegulatoryConclusionCodes({
      researchState: row.research_state,
      matchLevel: row.match_level,
      pathways: row.pathways,
      exactListingFound,
    })
    if (row.conclusion_codes.join('|') !== expected.join('|')) {
      context.addIssue({
        code: 'custom',
        message: `conclusion_codes must equal controlled derivation (${expected.join(', ')})`,
        path: ['conclusion_codes'],
      })
    }
    if (row.conflict_state !== 'none' && row.match_level !== 'ambiguous') {
      context.addIssue({
        code: 'custom',
        message: 'material conflicts require ambiguous match_level',
        path: ['match_level'],
      })
    }
  })

export type RegulatoryOverlayRow = z.infer<typeof regulatoryOverlayRowSchema>

export const regulatoryOverlayArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('device_intelligence_product_regulatory_overlay'),
    method_version: z.literal('d2d-product-regulatory-overlay-v1'),
    row_scope: z.literal('reviewed_d2d_pilot_only'),
    source_artifacts: z
      .object({
        evidence_sources: pinnedArtifactSchema,
        regulatory_reviews: pinnedArtifactSchema,
      })
      .strict(),
    counts: z
      .object({
        pilot_products: z.literal(10),
        rows: z.number().int().nonnegative(),
        reviewed: z.number().int().nonnegative(),
        unresolved: z.number().int().nonnegative(),
      })
      .strict(),
    sources: z.array(d2dSourceProjectionSchema),
    rows: z.array(regulatoryOverlayRowSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const sourceIds = artifact.sources.map((source) => source.source_id)
    const productIds = artifact.rows.map((row) => row.product_id)
    if (sourceIds.join('|') !== [...sourceIds].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'sources must be sorted', path: ['sources'] })
    }
    if (new Set(sourceIds).size !== sourceIds.length) {
      context.addIssue({ code: 'custom', message: 'duplicate source_id', path: ['sources'] })
    }
    if (productIds.join('|') !== [...productIds].sort().join('|')) {
      context.addIssue({ code: 'custom', message: 'rows must be sorted', path: ['rows'] })
    }
    if (new Set(productIds).size !== productIds.length) {
      context.addIssue({ code: 'custom', message: 'duplicate product_id', path: ['rows'] })
    }
    const knownSources = new Set(sourceIds)
    const referencedSources = new Set<string>()
    for (const [rowIndex, row] of artifact.rows.entries()) {
      const records = [
        ...row.udi_identities,
        ...row.classifications,
        ...row.pathways,
        ...row.registration_listing_evidence,
        ...row.commercial_distribution_evidence,
      ]
      for (const record of records) {
        for (const reference of record.source_refs) {
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
      artifact.rows.filter((row) => row.research_state === 'reviewed').length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'counts.reviewed mismatch',
        path: ['counts', 'reviewed'],
      })
    }
    if (
      artifact.counts.unresolved !==
      artifact.rows.filter((row) => row.research_state === 'unresolved').length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'counts.unresolved mismatch',
        path: ['counts', 'unresolved'],
      })
    }
  })

export type RegulatoryOverlayArtifact = z.infer<typeof regulatoryOverlayArtifactSchema>
