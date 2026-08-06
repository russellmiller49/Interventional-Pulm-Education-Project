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
 * The exact version-1 `rebuild_provenance` document — the one shape four places must agree on.
 *
 * The database, this schema, the TypeScript writer and the SQL verifier previously agreed on a
 * *subset*: the RPC bound eight source fields and accepted any document containing them, the
 * verifier used that eight-field object as its "complete" positive fixture, and this schema then
 * required rather more on read. A document the database happily stored therefore failed to parse
 * back, and `loadUserCard` turned it into `null` — presenting a row that carries rebuild evidence
 * as an ordinary card.
 *
 * So there is one shape, it is strict in both directions, and `provenance-contract.test.ts` proves
 * the SQL key list, this schema and the verifier fixture describe it identically.
 *
 * `.strict()` on purpose: an unknown top-level key is a document this code cannot interpret, and
 * silently ignoring it would let a future writer smuggle claims past every reader. A genuinely
 * different shape gets a new `version`, never a weakened version 1 — and since the migration has
 * never been applied there is no deployed card that predates any field here.
 *
 * Deliberately loose about each decision's `state` and `reasonCodes`: those are closed vocabularies
 * *at the moment a card was created*, and a card created a year from now carries that year's
 * vocabulary. Narrowing them here would make valid permanent evidence unreadable, which is the
 * opposite of what a permanent record is for.
 */
export const storedRebuildProvenanceSchema = z
  .object({
    version: z.literal('ip-cards-rebuild/1'),
    sourceCardId: z.string().uuid(),
    sourceRevisionId: z.string().uuid(),
    /** From `auth.getUser()`, never the browser. Bound by the RPC to both source rows. */
    sourceOwnerId: z.string().uuid(),
    sourceRevisionNumber: z.number().int().min(1),
    sourceReleaseBundleId: z.string().trim().min(1).max(120),
    sourceReleaseDefinitionHash: sha256Schema,
    sourceSnapshotHash: sha256Schema,
    /** Null only where the source revision genuinely predates the split hashes. */
    sourceSnapshotIntegrityHash: sha256Schema.nullable(),
    sourceResolvedContentHash: sha256Schema.nullable(),
    /** Derived in TypeScript from the integrity hash and the printed columns; app-only. */
    sourcePrintDocumentHash: sha256Schema.nullable(),
    targetReleaseBundleId: z.string().trim().min(1).max(120),
    targetReleaseDefinitionHash: sha256Schema,
    targetCatalogReleaseId: z.string().trim().min(1).max(120),
    operationalReconciliationHash: sha256Schema,
    authoredReleaseDiffHash: sha256Schema,
    mappingPlanHash: sha256Schema,
    allowedFinalStateHash: sha256Schema,
    decisions: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(200),
            kind: z.string().trim().min(1).max(40),
            state: z.string().trim().min(1).max(60),
            reasonCodes: z.array(z.string().trim().min(1).max(80)).max(40),
            acknowledgement: z.string().trim().min(1).max(40).nullable(),
          })
          .strict(),
      )
      .max(1000),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict()

export type StoredRebuildProvenance = z.infer<typeof storedRebuildProvenanceSchema>

/**
 * The exact top-level key set, in schema order.
 *
 * Exported so the SQL validation function's key list and the verifier's positive fixture can be
 * checked against it rather than maintained beside it.
 */
export const REBUILD_PROVENANCE_V1_KEYS = Object.keys(
  storedRebuildProvenanceSchema.shape,
) as ReadonlyArray<keyof StoredRebuildProvenance>

/** The keys whose value may be JSON null. Every other key must carry a value. */
export const REBUILD_PROVENANCE_V1_NULLABLE_KEYS = [
  'sourcePrintDocumentHash',
  'sourceResolvedContentHash',
  'sourceSnapshotIntegrityHash',
] as const

/** The exact key set of one entry in `decisions`. */
export const REBUILD_PROVENANCE_V1_DECISION_KEYS = [
  'acknowledgement',
  'key',
  'kind',
  'reasonCodes',
  'state',
] as const
