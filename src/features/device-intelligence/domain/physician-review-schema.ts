import { z } from 'zod'
import { PRODUCT_ID_PATTERN } from './product-id'
import { safetyNoticeSchema } from './safety-notice-schema'

const hash = z.string().regex(/^[a-f0-9]{64}$/)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const citation = z
  .object({
    title: z.string().min(1).max(300),
    url: z
      .string()
      .url()
      .refine((value) => value.startsWith('https://')),
    locator: z.string().min(1).max(500),
  })
  .strict()
const evidence = {
  check_ids: z.array(z.string().min(1)).min(1),
  citations: z.array(citation).min(1),
}
const claim = z.object({ text: z.string().min(1).max(800), ...evidence }).strict()
const scalar = z.union([z.string(), z.number().finite(), z.null()])

export const physicianProductReviewSchema = z
  .object({
    product_id: z.string().regex(PRODUCT_ID_PATTERN),
    summary: claim.nullable(),
    configuration: claim.nullable(),
    specifications: z
      .array(
        z
          .object({
            key: z.string().regex(/^[a-z][a-z0-9_]+$/),
            label: z.string().min(1).max(120),
            value: z.union([z.string().min(1).max(300), z.number().finite(), z.boolean()]),
            unit: z.string().nullable(),
            evidence_scope: z.enum(['exact', 'configuration', 'family']),
            ...evidence,
          })
          .strict(),
      )
      .max(20),
    catalog_corrections: z.array(
      z
        .object({
          field: z.enum([
            'product_name',
            'catalog_number',
            'size_display',
            'gtin',
            'working_length_cm',
            'length_mm',
            'diameter_mm',
            'min_working_channel_mm',
            'french_size',
            'gauge',
            'reuse_status',
            'sterile_status',
            'package_uom',
            'compatibility_text',
          ]),
          before: scalar,
          after: scalar,
          ...evidence,
        })
        .strict(),
    ),
    udi_records: z.array(
      z
        .object({
          primary_di: z.string().regex(/^\d{14}$/),
          model: z.string().min(1),
          scope: z.enum(['exact', 'configuration_requires_label']),
          package_di: z
            .string()
            .regex(/^\d{14}$/)
            .nullable(),
          package_quantity: z.number().int().positive().nullable(),
          ...evidence,
        })
        .strict(),
    ),
    notes: z.array(
      z
        .object({
          kind: z.enum(['identity', 'labeling', 'safety', 'follow_up']),
          text: z.string().min(1).max(1000),
          ...evidence,
        })
        .strict(),
    ),
    unresolved_checks: z.array(z.object({ check_id: z.string(), title: z.string() }).strict()),
    excluded_recalls: z.array(
      z
        .object({
          recall_number: z.string().regex(/^Z-\d{4}-\d{4}$/),
          ...evidence,
        })
        .strict(),
    ),
    additional_notices: z.array(safetyNoticeSchema),
  })
  .strict()

export const physicianReviewOverlaySchema = z
  .object({
    format_version: z.literal(1),
    review_id: z.literal('physician-review-2026-09-17'),
    reviewed_on: date,
    products: z.array(physicianProductReviewSchema),
    procedures: z.array(
      z
        .object({
          code: z.enum(['EBUS_TBNA', 'THERAPEUTIC_BRONCH', 'CHEST_TUBE']),
          notes: z.array(z.string().min(1).max(1000)).min(1),
          unresolved_checks: z.array(z.string()).length(3),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((data, context) => {
    const ids = data.products.map((row) => row.product_id)
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', message: 'Duplicate product review' })
    for (const row of data.products) {
      const fields = row.catalog_corrections.map((correction) => correction.field)
      if (new Set(fields).size !== fields.length)
        context.addIssue({ code: 'custom', message: 'Duplicate catalog correction' })
      for (const correction of row.catalog_corrections) {
        const numeric = [
          'working_length_cm',
          'length_mm',
          'diameter_mm',
          'min_working_channel_mm',
          'french_size',
          'gauge',
        ].includes(correction.field)
        if (
          correction.after !== null &&
          typeof correction.after !== (numeric ? 'number' : 'string')
        ) {
          context.addIssue({ code: 'custom', message: 'Incorrect catalog correction value type' })
        }
        if (
          correction.field === 'product_name' &&
          (typeof correction.after !== 'string' || !correction.after.trim())
        ) {
          context.addIssue({ code: 'custom', message: 'Product name must remain nonempty' })
        }
      }
      const keys = row.specifications.map((spec) => spec.key)
      if (new Set(keys).size !== keys.length)
        context.addIssue({ code: 'custom', message: 'Duplicate specification' })
      if (
        row.additional_notices.some((notice) =>
          row.excluded_recalls.some((excluded) => excluded.recall_number === notice.recall_number),
        )
      ) {
        context.addIssue({ code: 'custom', message: 'Cannot add and exclude the same notice' })
      }
    }
  })

export const physicianReviewArtifactSchema = z
  .object({
    format_version: z.literal(1),
    reviewer: z.string().min(1),
    export_sha256: hash,
    packet_fingerprint: hash,
    review_items_sha256: hash,
    source_pins: z.record(z.string(), hash),
    decisions: z.array(
      z
        .object({
          check_id: z.string(),
          status: z.enum(['confirm', 'refute', 'needs_evidence']),
          comment_sha256: hash,
        })
        .strict(),
    ),
    safety_receipts: z.array(
      z.object({ recall_number: z.string(), response_sha256: hash }).strict(),
    ),
    overlay: physicianReviewOverlaySchema,
  })
  .strict()

export type PhysicianProductReview = z.infer<typeof physicianProductReviewSchema>
export type PhysicianReviewOverlay = z.infer<typeof physicianReviewOverlaySchema>
