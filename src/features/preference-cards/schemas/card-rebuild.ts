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

/**
 * What a stored `rebuild_provenance` document may say, read back.
 *
 * Validated on read rather than trusted, for the same reason `builder_inputs` is: the column is
 * write-once and unwritable by any API role, which makes it *authentic*, not well-typed. A document
 * written by an older version of this code — or one that predates a field — must not make the card
 * page throw, and must not be rendered as though it said something it does not.
 *
 * Deliberately loose about the decision list's `state` and `reasonCodes`: those are closed
 * vocabularies *at the moment a card was created*, and a card created a year ago carries the
 * vocabulary of a year ago. Narrowing them here would make old, perfectly valid evidence
 * unreadable — which is the opposite of what a permanent record is for.
 */
export const storedRebuildProvenanceSchema = z.object({
  version: z.literal('ip-cards-rebuild/1'),
  sourceCardId: z.string().uuid(),
  sourceRevisionId: z.string().uuid(),
  sourceRevisionNumber: z.number().int().min(1),
  sourceReleaseBundleId: z.string().trim().min(1).max(120),
  sourceReleaseDefinitionHash: sha256Schema,
  sourceSnapshotHash: sha256Schema,
  sourceSnapshotIntegrityHash: sha256Schema.nullable(),
  sourceResolvedContentHash: sha256Schema.nullable(),
  sourcePrintDocumentHash: sha256Schema.nullable(),
  targetReleaseBundleId: z.string().trim().min(1).max(120),
  targetReleaseDefinitionHash: sha256Schema,
  targetCatalogReleaseId: z.string().trim().min(1).max(120),
  operationalReconciliationHash: sha256Schema,
  authoredReleaseDiffHash: sha256Schema,
  mappingPlanHash: sha256Schema,
  /** Absent on cards created before the allowed-state derivation existed. */
  allowedFinalStateHash: sha256Schema.optional(),
  decisions: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(200),
        kind: z.string().trim().min(1).max(40),
        state: z.string().trim().min(1).max(60),
        reasonCodes: z.array(z.string().trim().min(1).max(80)).max(40),
        acknowledgement: z.string().trim().min(1).max(40).nullable(),
      }),
    )
    .max(1000),
  createdAt: z.string().datetime({ offset: true }),
})

export type StoredRebuildProvenance = z.infer<typeof storedRebuildProvenanceSchema>
