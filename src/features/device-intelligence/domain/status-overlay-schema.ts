import { z } from 'zod'

import {
  MARKET_CONFIDENCES,
  MARKET_STATUSES,
  SAFETY_ACTION_SCOPES,
  SAFETY_DISPLAYS,
  STATUS_RECOMMENDATION_GATES,
} from './product-status'
import { PRODUCT_ID_PATTERN } from './product-id'

/**
 * The compact Device Intelligence status overlay
 * (`data/ip-device-intelligence/generated/product-status-overlay.json`).
 *
 * This schema is the contract between the deterministic generator and the runtime reader,
 * and it is deliberately CLOSED (`.strict()` everywhere): the 14 MB research proposal
 * artifact carries rationale prose, unresolved-question prose, manufacturer and FDA response
 * text, source URLs, raw cache references, API query strings, and free-text conflict
 * descriptions — none of which may reach application runtime code or a client bundle. A
 * strict schema makes "someone added a prose field later" a build failure rather than a
 * silent leak.
 *
 * Every value in a row is drawn from a controlled vocabulary except the FDA recall number,
 * which is a regulatory identifier with a fixed shape, and the ISO snapshot date.
 */

/** FDA device-enforcement recall numbers, e.g. `Z-1357-2023`. Identifier, never prose. */
export const RECALL_NUMBER_PATTERN = /^[A-Z]{1,4}-\d{3,5}-\d{4}$/

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO calendar date')
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/, 'must be a lowercase sha-256 hex digest')

export const statusOverlayRowSchema = z
  .object({
    product_id: z.string().regex(PRODUCT_ID_PATTERN),
    research_snapshot_date: isoDateSchema,
    market_status: z.enum(MARKET_STATUSES),
    market_confidence: z.enum(MARKET_CONFIDENCES).nullable(),
    safety_display: z.enum(SAFETY_DISPLAYS),
    safety_action_scope: z.enum(SAFETY_ACTION_SCOPES).nullable(),
    safety_reference_codes: z.array(z.string().regex(RECALL_NUMBER_PATTERN)),
    status_recommendation_gate: z.enum(STATUS_RECOMMENDATION_GATES),
  })
  .strict()

export type StatusOverlayRow = z.infer<typeof statusOverlayRowSchema>

const countsSchema = z.record(z.string(), z.number().int().nonnegative())

export const statusOverlayArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('device_intelligence_product_status_overlay'),
    method_version: z.literal('d2b-status-overlay-v1'),
    /** The as-of date of the research package this overlay projects. */
    research_as_of_date: isoDateSchema,
    /** The pinned source proposal artifact: path plus sha-256 of its exact bytes. */
    source_artifact: z
      .object({
        path: z.string().min(1),
        sha256: sha256Schema,
      })
      .strict(),
    /** Which catalog products the overlay covers, stated rather than implied. */
    row_scope: z.literal('research_cohort_verification_grade_verified_source'),
    counts: z
      .object({
        rows: z.number().int().nonnegative(),
        research_products_considered: z.number().int().nonnegative(),
        market_status: countsSchema,
        safety_display: countsSchema,
        status_recommendation_gate: countsSchema,
      })
      .strict(),
    rows: z.array(statusOverlayRowSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const seen = new Set<string>()
    for (const [index, row] of artifact.rows.entries()) {
      if (seen.has(row.product_id)) {
        context.addIssue({
          code: 'custom',
          message: `duplicate product_id ${row.product_id}`,
          path: ['rows', index, 'product_id'],
        })
      }
      seen.add(row.product_id)
      if (row.research_snapshot_date !== artifact.research_as_of_date) {
        context.addIssue({
          code: 'custom',
          message: 'every row must carry the artifact research_as_of_date',
          path: ['rows', index, 'research_snapshot_date'],
        })
      }
    }
    const sorted = [...artifact.rows].map((row) => row.product_id).sort()
    if (artifact.rows.map((row) => row.product_id).join('|') !== sorted.join('|')) {
      context.addIssue({
        code: 'custom',
        message: 'rows must be sorted by product_id so generation is byte-deterministic',
        path: ['rows'],
      })
    }
    if (artifact.counts.rows !== artifact.rows.length) {
      context.addIssue({
        code: 'custom',
        message: 'counts.rows must equal rows.length',
        path: ['counts', 'rows'],
      })
    }
  })

export type StatusOverlayArtifact = z.infer<typeof statusOverlayArtifactSchema>
