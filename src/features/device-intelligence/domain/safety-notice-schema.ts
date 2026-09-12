import { z } from 'zod'
import { PRODUCT_ID_PATTERN } from './product-id'
import { SAFETY_ACTION_SCOPES } from './product-status'
import { RECALL_NUMBER_PATTERN } from './status-overlay-schema'

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Invalid calendar date')
const recallNumber = z.string().regex(RECALL_NUMBER_PATTERN)
const system = z.enum(['device_recall', 'device_enforcement'])
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const pin = z.object({ path: z.string().min(1), sha256: hash }).strict()

/** Identifier-only receipt. Downloading it does not reverify product matches or recall lifecycle. */
export const safetyRecordLinksSchema = z
  .object({
    format_version: z.literal(1),
    purpose: z.literal('exact_recall_record_links_only'),
    records: z.array(
      z
        .object({
          recall_number: recallNumber,
          event_id: z.string().regex(/^\d+$/),
          cfres_id: z.string().regex(/^\d+$/),
          dataset_as_of: date.nullable(),
          retrieved_at: z.string().datetime(),
          response_sha256: hash,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((artifact, context) => {
    if (new Set(artifact.records.map((r) => r.recall_number)).size !== artifact.records.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate recall link' })
    }
  })

export const safetySourceCheckSchema = z
  .object({
    system,
    dataset_as_of: date.nullable(),
    has_undated_responses: z.boolean(),
    retrieved_on: date,
  })
  .strict()

export const safetyNoticeSchema = z
  .object({
    recall_number: recallNumber,
    event_id: z.string().regex(/^\d+$/).nullable(),
    match_scope: z.literal('exact_product'),
    recorded_state: z.enum(['active', 'historical', 'conflicted', 'unknown']),
    scope: z.enum(SAFETY_ACTION_SCOPES),
    matched_identifiers: z.array(z.string().min(1).max(120)).min(1).max(50),
    reason_for_recall: z.string().min(1).max(2000).nullable(),
    initiated_on: date.nullable(),
    reports: z
      .array(
        z
          .object({
            system,
            recorded_status: z.string().min(1).max(80),
            classification: z
              .enum(['Class I', 'Class II', 'Class III', 'Not Yet Classified'])
              .nullable(),
            dataset_as_of: date.nullable(),
            retrieved_on: date,
          })
          .strict(),
      )
      .min(1)
      .max(2),
    official_record_url: z
      .string()
      .regex(
        /^https:\/\/www\.accessdata\.fda\.gov\/scripts\/cdrh\/cfdocs\/cfres\/res\.cfm\?id=\d+$/,
      )
      .nullable(),
  })
  .strict()

export const safetyEvidenceRowSchema = z
  .object({
    product_id: z.string().regex(PRODUCT_ID_PATTERN),
    search_status: z.enum(['searched', 'not_searched', 'query_error']),
    source_checks: z.array(safetySourceCheckSchema),
    notices: z.array(safetyNoticeSchema),
  })
  .strict()
  .superRefine((row, context) => {
    if (new Set(row.notices.map((n) => n.recall_number)).size !== row.notices.length) {
      context.addIssue({ code: 'custom', message: 'Duplicate notice on product' })
    }
  })

/** The sole public prose allowance is the dated, source-reported recall reason. No raw query,
 * rationale, clipped lot list, or generated action/clinical recommendation can enter runtime. */
export const safetyEvidenceArtifactSchema = z
  .object({
    format_version: z.literal(1),
    artifact_kind: z.literal('device_intelligence_safety_evidence'),
    source_artifacts: z.object({ research: pin, status: pin, links: pin }).strict(),
    rows: z.array(safetyEvidenceRowSchema),
  })
  .strict()
  .superRefine((artifact, context) => {
    const ids = artifact.rows.map((row) => row.product_id)
    if (new Set(ids).size !== ids.length || ids.join() !== [...ids].sort().join()) {
      context.addIssue({ code: 'custom', message: 'Product rows must be unique and sorted' })
    }
  })

export type SafetyEvidenceRow = z.infer<typeof safetyEvidenceRowSchema>
export type SafetyNotice = z.infer<typeof safetyNoticeSchema>
export type SafetyEvidenceArtifact = z.infer<typeof safetyEvidenceArtifactSchema>
