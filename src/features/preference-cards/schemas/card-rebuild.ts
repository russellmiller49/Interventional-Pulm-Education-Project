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

/**
 * The canonical subset the runtime schema and the SQL validator both accept, exactly.
 *
 * These three helpers exist because "compatible bounds" is not parity. `z.string().trim().min(1)`
 * *accepts* `' x '` and parses it to `'x'`, so a document could be stored with bytes the reader
 * silently rewrites — and a SQL check written as `length(btrim(x)) between 1 and n` would agree to
 * store it while a check written as `length(x) between 1 and n` would not. Rather than pick which
 * side to loosen, both sides are narrowed to values that are already canonical: no leading or
 * trailing whitespace, so what is stored is what is read.
 *
 * `private.ip_validate_preference_card_rebuild_provenance_v1` mirrors each of these, and
 * `provenance-contract.test.ts` drives both from one table of examples.
 */
const canonicalText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((value) => value.length > 0 && value === value.trim(), {
      message: 'must be non-empty and carry no leading or trailing whitespace',
    })

/** Zod's own `.uuid()`, restated so the SQL regex can be pinned to the same shape. */
const CANONICAL_UUID =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/

const canonicalUuid = z.string().regex(CANONICAL_UUID)

/**
 * An instant, not a string that resembles one.
 *
 * `.datetime({ offset: true })` accepts several spellings of the same moment and — depending on the
 * version — an offset without a colon, which PostgreSQL's pattern would then have to guess at. One
 * spelling is required here, and the calendar is checked: `2026-99-99T00:00:00.000Z` matches every
 * shape rule and is not a date, which is exactly what the old prefix-only SQL check let through.
 */
const canonicalTimestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: 'must name a real instant',
  })

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
    sourceCardId: canonicalUuid,
    sourceRevisionId: canonicalUuid,
    /** From `auth.getUser()`, never the browser. Bound by the RPC to both source rows. */
    sourceOwnerId: canonicalUuid,
    sourceRevisionNumber: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    sourceReleaseBundleId: canonicalText(120),
    sourceReleaseDefinitionHash: sha256Schema,
    sourceSnapshotHash: sha256Schema,
    /** Null only where the source revision genuinely predates the split hashes. */
    sourceSnapshotIntegrityHash: sha256Schema.nullable(),
    sourceResolvedContentHash: sha256Schema.nullable(),
    /** Derived in TypeScript from the integrity hash and the printed columns; app-only. */
    sourcePrintDocumentHash: sha256Schema.nullable(),
    targetReleaseBundleId: canonicalText(120),
    targetReleaseDefinitionHash: sha256Schema,
    targetCatalogReleaseId: canonicalText(120),
    operationalReconciliationHash: sha256Schema,
    authoredReleaseDiffHash: sha256Schema,
    mappingPlanHash: sha256Schema,
    allowedFinalStateHash: sha256Schema,
    decisions: z
      .array(
        z
          .object({
            key: canonicalText(200),
            kind: canonicalText(40),
            state: canonicalText(60),
            reasonCodes: z.array(canonicalText(80)).max(40),
            acknowledgement: canonicalText(40).nullable(),
          })
          .strict(),
      )
      .max(1000),
    createdAt: canonicalTimestamp,
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
