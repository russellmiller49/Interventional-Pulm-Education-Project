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

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)

/**
 * The canonical subset the runtime schema and the SQL validator both accept, byte for byte.
 *
 * "Compatible bounds" is not parity, and the gap was storable evidence. Two operations that look
 * equivalent are not:
 *
 * - PostgreSQL's `btrim` strips spaces; ECMAScript `trim()` strips the whole WhiteSpace and
 *   LineTerminator set. `"\tx\t"` passed a `btrim` equality check and failed Zod.
 * - PostgreSQL `length(text)` counts characters; JavaScript `.length` counts UTF-16 code units.
 *   `"😀".repeat(61)` is 61 characters and 122 code units, so it passed a 120-character SQL bound
 *   and failed a 120-unit Zod bound.
 *
 * Either way a direct service-role RPC could store a document `loadUserCard` then reports as
 * invalid — the exact failure the validator exists to prevent.
 *
 * So version 1 fixes the alphabet instead of trying to reconcile two whitespace definitions:
 * **printable ASCII, no leading or trailing space, no control characters**. Inside that alphabet
 * character count and code-unit count are the same number, and "no padding" has one meaning. The
 * regex below and the one in `private.ip_validate_preference_card_rebuild_provenance_v1` are the
 * same expression.
 *
 * This is a contract about *identifiers and codes*, not prose, and every committed producer already
 * satisfies it: release and catalog ids, requirement keys, role codes and slot ids all come from
 * generated release data (checked: no value outside this range), and a decision's `kind`, `state`,
 * `acknowledgement` and `reasonCodes` are closed TypeScript unions of ASCII identifiers. A future
 * field that genuinely needs more than ASCII needs a new provenance version, and a length rule whose
 * two implementations can be shown to agree.
 */
const CANONICAL_TEXT = /^[!-~]([ -~]*[!-~])?$/

const canonicalText = (max: number) =>
  z.string().max(max).regex(CANONICAL_TEXT, {
    message: 'must be printable ASCII with no leading or trailing space and no control characters',
  })

/** Zod's own `.uuid()`, restated so the SQL regex can be pinned to the same shape. */
const CANONICAL_UUID =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$/

const canonicalUuid = z.string().regex(CANONICAL_UUID)

/**
 * One spelling of one instant: `YYYY-MM-DDTHH:mm:ss.sssZ`, UTC, millisecond precision.
 *
 * The previous refine accepted anything `Date.parse` did not return `NaN` for, and `Date.parse`
 * *normalizes*: `2026-02-29T00:00:00.000Z` (2026 is not a leap year) and `2026-02-30T00:00:00.000Z`
 * both parse, both become March, and both were accepted as provenance. A timestamp that silently
 * becomes a different day is not a record of when anything happened.
 *
 * Round-tripping through `toISOString()` is what makes the calendar check exact: a date the calendar
 * does not have re-serializes as a different string and is refused. It also pins the spelling, so
 * one instant has one representation and a stored value and a read value are the same bytes.
 * `new Date().toISOString()` — which is what the writer emits — is already exactly this form.
 */
/**
 * Years `0001` through `9999`, stated rather than inherited.
 *
 * JavaScript's proleptic Gregorian calendar has a year zero and PostgreSQL does not: `0000-02-29`
 * round-trips through `toISOString()` and is rejected by `::timestamptz`. SQL being the stricter
 * side meant no unreadable document could be stored, so this was never a hole — but the two
 * implementations did not describe the same set, and "the same set" is the property being claimed.
 * The four-digit shape already caps the domain at 9999; the negative lookahead removes year zero.
 */
const CANONICAL_TIMESTAMP = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const canonicalTimestamp = z
  .string()
  .regex(CANONICAL_TIMESTAMP)
  .refine(
    (value) => {
      const parsed = new Date(value)
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value
    },
    { message: 'must name a real instant in canonical UTC form' },
  )

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
