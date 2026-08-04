import { z } from 'zod'

/**
 * What a rebuild request may say.
 *
 * Deliberately almost nothing. A client sends the source it is rebuilding from, the composition it
 * is planning against, the hash of the plan it was shown, and one answer per decision. It does not
 * send the plan, the release diff, the carried selections, the resolved card, or the provenance —
 * every one of those is recomputed server-side from authoritative definitions, and the plan hash is
 * what proves the recomputation matches the page the answers were given on.
 *
 * The alternative — trusting a submitted plan — would let a caller author the mapping its own card
 * was built from, which is the one thing the review gate exists to prevent.
 */

const sha256Schema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/)

export const rebuildAcknowledgementSchema = z.enum([
  'confirmed',
  'dropped',
  'acknowledged_unresolved',
])

/**
 * The composition the plan was computed for.
 *
 * An input rather than an answer, because turning a module off changes which requirements exist:
 * applied after planning it would leave the plan, its hash, and the card describing three different
 * compositions. Every id is re-checked against what the target release offers.
 */
export const rebuildSelectionSchema = z.object({
  moduleVersionIds: z.array(z.string().trim().min(1).max(120)).max(60),
  modifierCodes: z.array(z.string().trim().min(1).max(60)).max(30),
})

export const rebuildPlanRequestSchema = z.object({
  cardId: z.string().uuid(),
  revisionId: z.string().uuid(),
  selection: rebuildSelectionSchema,
})

export const createRebuiltCardRequestSchema = rebuildPlanRequestSchema.extend({
  /**
   * The hash of the plan the answers below were given against.
   *
   * The server recomputes the plan and compares. A mismatch means the page is stale or the payload
   * was edited, and both get the same refusal — the answers describe decisions that are not the
   * decisions this rebuild would make, so applying them would record a review that did not happen.
   */
  planHash: sha256Schema,
  acknowledgements: z
    .record(z.string().trim().min(1).max(200), rebuildAcknowledgementSchema)
    .refine((value) => Object.keys(value).length <= 400, {
      message: 'At most 400 rebuild decisions can be acknowledged.',
    }),
  title: z.string().trim().min(1).max(160),
  physicianName: z.string().trim().max(160).nullable().optional(),
})

export type RebuildPlanRequest = z.infer<typeof rebuildPlanRequestSchema>
export type CreateRebuiltCardRequest = z.infer<typeof createRebuiltCardRequestSchema>
