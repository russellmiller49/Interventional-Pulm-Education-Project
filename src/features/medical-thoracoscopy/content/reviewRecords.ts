import { z } from 'zod'

/**
 * The words every register in this module uses for where an item stands, and the shape of a
 * review decision. Both come from the revised build plan (v2 §1.2, §2.4).
 *
 * A decision belongs to a named person and to the revision they looked at. An empty decision is
 * not approval, and nothing here lets one be recorded without a reviewer.
 */
export const STATUS_WORDS = [
  'retained decision',
  'proposed change',
  'unresolved input',
  'review pending',
  'accepted with attributable approval',
] as const

export type StatusWord = (typeof STATUS_WORDS)[number]

export const statusWordSchema = z.enum(STATUS_WORDS)

export const CLAIM_CATEGORIES = [
  'clinical evidence',
  'device fact',
  'derived measurement',
  'authored simulation assumption',
] as const

export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number]

export const claimCategorySchema = z.enum(CLAIM_CATEGORIES)

export const REVIEW_DECISIONS = [
  'NOT REVIEWED',
  'accepted',
  'accepted with changes',
  'rejected',
  'held',
] as const

export type ReviewDecisionValue = (typeof REVIEW_DECISIONS)[number]

/** A reviewer is a person. These names are refused wherever a reviewer is recorded. */
export const NOT_A_REVIEWER = /claude|codex|gpt|gemini|copilot|\bai\b|assistant|\bllm\b|\bbot\b/i

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export const reviewDecisionSchema = z
  .object({
    decision: z.enum(REVIEW_DECISIONS),
    reviewer: z.string().min(1).nullable(),
    role: z.string().min(1).nullable(),
    date: z.string().regex(isoDate).nullable(),
    reviewedRevision: z.string().min(1).nullable(),
    limits: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((record, context) => {
    const recorded = [record.reviewer, record.role, record.date, record.reviewedRevision]

    if (record.decision === 'NOT REVIEWED') {
      if (recorded.some((value) => value !== null)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'NOT REVIEWED carries no reviewer, role, date or reviewed revision',
        })
      }
      return
    }

    if (recorded.some((value) => value === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'a decision needs a reviewer, a role, a date and the revision reviewed',
      })
    }
    if (record.reviewer !== null && NOT_A_REVIEWER.test(record.reviewer)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'a reviewer is a named person',
      })
    }
  })

export type ReviewDecision = z.infer<typeof reviewDecisionSchema>

/** True once a named person has accepted the item, with or without changes. */
export function isAccepted(record: ReviewDecision): boolean {
  return record.decision === 'accepted' || record.decision === 'accepted with changes'
}
