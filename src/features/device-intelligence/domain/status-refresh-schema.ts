import { z } from 'zod'
import { MARKET_CONFIDENCES, MARKET_STATUSES } from './product-status'
import { PRODUCT_ID_PATTERN } from './product-id'
import { safetyEvidenceRowSchema } from './safety-notice-schema'

export const MARKET_EVIDENCE_BASES = [
  'active_udi',
  'corroborated_current',
  'mixed_distribution',
  'ended_udi_only',
  'identity_unresolved',
  'incomplete_search',
  'manufacturer_restriction',
] as const
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const marketEvidenceSchema = z
  .object({
    basis: z.enum(MARKET_EVIDENCE_BASES),
    checked_on: date,
    udi_dataset_as_of: date.nullable(),
    listing_dataset_as_of: date.nullable(),
    records: z.array(
      z
        .object({
          primary_di: z.string().min(1).max(80),
          distribution_status: z.enum([
            'In Commercial Distribution',
            'Not in Commercial Distribution',
            'Unknown',
          ]),
        })
        .strict(),
    ),
    manufacturer_sources: z.array(
      z.object({ title: z.string().max(120), url: z.string().url() }).strict(),
    ),
    listing_sources: z.array(
      z.string().url().startsWith('https://api.fda.gov/device/registrationlisting.json?'),
    ),
  })
  .strict()
export const statusRefreshRowSchema = z
  .object({
    product_id: z.string().regex(PRODUCT_ID_PATTERN),
    market_status: z.enum(MARKET_STATUSES).nullable(),
    market_confidence: z.enum(MARKET_CONFIDENCES).nullable(),
    market_evidence: marketEvidenceSchema,
    safety: safetyEvidenceRowSchema,
    safety_identity_review_required: z.boolean(),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (row.product_id !== row.safety.product_id)
      ctx.addIssue({ code: 'custom', message: 'Safety product differs' })
    if (
      ['confirmed_current_us', 'likely_current_us'].includes(row.market_status ?? '') &&
      !row.market_evidence.records.length
    )
      ctx.addIssue({ code: 'custom', message: 'Current distribution requires exact UDI evidence' })
  })
export const statusRefreshSchema = z
  .object({
    format_version: z.literal(1),
    method: z.literal('exact-identity-fda-status-refresh-v1'),
    checked_on: date,
    research_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    rows: z.array(statusRefreshRowSchema),
  })
  .strict()
  .superRefine((artifact, ctx) => {
    const ids = artifact.rows.map((r) => r.product_id)
    if (new Set(ids).size !== ids.length || ids.join() !== [...ids].sort().join())
      ctx.addIssue({ code: 'custom', message: 'Refresh rows must be unique and sorted' })
  })
export type MarketEvidence = z.infer<typeof marketEvidenceSchema>
export type StatusRefreshRow = z.infer<typeof statusRefreshRowSchema>
