import { z } from 'zod'

import { buildCardInputSchema } from '../domain/schemas'
import { MAX_CUSTOM_DESCRIPTION, MAX_CUSTOM_ITEMS, MAX_CUSTOM_NOTE } from '../domain/custom-item'

/**
 * Everything needed to rebuild a card in the wizard, and the shape stored in
 * `ip_user_preference_cards.builder_inputs`.
 *
 * Only identifiers cross the wire. Products, product lines, and equipment-set members are
 * rebuilt from the catalog server-side at save time, so a client can never write its own
 * product identity — or its own resolution — into a stored card.
 */

const productIdSchema = z
  .string()
  .trim()
  .regex(/^PRD-[A-Z0-9]{6,20}$/)
const roleCodeSchema = z.string().trim().min(1).max(80)

export const catalogPickRefSchema = z.object({
  productId: productIdSchema,
  roleCode: roleCodeSchema,
})

const sha256Schema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/)

/**
 * A product-line selection as versions 2 and 3 recorded it: a discovery grouping key.
 *
 * Read-only, forever. The key is `manufacturerGroup|familyName|productKind`, recomputed from
 * mutable labels on every request, and `familyName` falls back through `brand_family` →
 * `subcategory` → product name. Two sizes of one BD Safe-T-Centesis tray land under different keys
 * because only one of them carries a subcategory; nine Argyle chest tubes from 16 Fr to 40 Fr, plus
 * a right-angle, land under the same one. A card carrying such a key is not asking for a definite
 * set of products, so nothing here maps one to a reviewed family — see `product-family.ts`.
 */
export const legacyFamilyPickRefSchema = z.object({
  familyKey: z.string().trim().min(1).max(200),
  roleCode: roleCodeSchema,
})

/**
 * A product-line selection from version 4 on: a reviewed, versioned, hashed family identity.
 *
 * Four fields rather than one because each can independently be wrong in a way the others would
 * not catch — which family, which catalog its membership is true of, whether that membership has
 * moved since, and which requirement it was chosen for. All four are re-verified server-side
 * against the retained family ledger; a client that alters any of them gets a typed failure rather
 * than a card resolved against a membership nobody approved.
 */
export const reviewedFamilyPickRefSchema = z.object({
  productFamilyVersionId: z.string().trim().min(1).max(200),
  catalogReleaseId: sha256Schema,
  definitionHash: sha256Schema,
  roleCode: roleCodeSchema,
})

export const familyPickRefSchema = z.union([reviewedFamilyPickRefSchema, legacyFamilyPickRefSchema])

export type LegacyFamilyPickRef = z.infer<typeof legacyFamilyPickRefSchema>
export type ReviewedFamilyPickRef = z.infer<typeof reviewedFamilyPickRefSchema>
export type FamilyPickRef = z.infer<typeof familyPickRefSchema>

export function isReviewedFamilyPickRef(value: FamilyPickRef): value is ReviewedFamilyPickRef {
  return 'productFamilyVersionId' in value
}

export const equipmentSetRefSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).nullable().optional(),
  selectedRoleCode: roleCodeSchema,
  additionalCoveredRoles: z.array(roleCodeSchema).max(60).default([]),
  members: z.array(catalogPickRefSchema).max(60),
})

/**
 * Free-text lines carry no catalog identity to rebuild, so unlike every other pick their
 * content is stored verbatim — bounded, trimmed, and always presented as unverified.
 */
export const customItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  roleCode: roleCodeSchema,
  description: z.string().trim().min(1).max(MAX_CUSTOM_DESCRIPTION),
  itemNumber: z.string().trim().max(120).nullable().default(null),
  notes: z.string().trim().max(MAX_CUSTOM_NOTE).nullable().default(null),
})

/**
 * The format version of `builder_inputs`, so a future migration can tell persisted shapes
 * apart instead of guessing from which fields happen to be present.
 *
 * - **1 — pre-composition (flat).** Recorded no module selection at all, because there were
 *   no modules. Never written with an explicit version, and never converted: reconstructing
 *   one would mean choosing modules on the physician's behalf, and a card that says which
 *   modules it was built from is the whole basis for reopening it safely. These cards stay
 *   viewable, printable, shareable, and duplicable from their immutable snapshot; only the
 *   builder is closed to them. They fail this schema on `selectedModuleVersionIds` alone —
 *   the version field is not what excludes them.
 * - **2 — composed. Read, never written.** Carries exact module versions and every pick as an
 *   identifier. Its recipe and module pins are exact, but the modifier set, rescue modules,
 *   compatibility rules, and role alias table it also resolves through are **not** pinned,
 *   because nothing pinned them when it was written. Re-saving such a card would re-resolve it
 *   against whatever those are *now* and store the result as the physician's card — so it is
 *   view-only. See `SUPERSEDED_BUILDER_INPUTS_SCHEMA_VERSIONS`.
 * - **3 — release-pinned. Read, and written only when re-saving an existing card.** Adds
 *   `releaseBundleId`: the whole authored dependency set, hashed. Its product-line selections are
 *   still recorded as discovery grouping keys, which is why a version-3 card that carries one is
 *   refused an edit session — see `carriesUnreconcilableFamilyIdentity`. One that carries none is
 *   fully editable, because there is nothing ambiguous about it.
 * - **4 — reviewed family identity.** Product-line selections name a reviewed family version, the
 *   catalog release its membership is true of, and that membership's hash.
 *
 * **No version is ever upgraded in place.** Version 2 is not converted to version 3 on save,
 * on read, or anywhere else. Stamping the current release onto one would move a saved card to a
 * release its author never selected, silently — nothing on the card would say the pin was the
 * system's choice rather than the physician's. Moving a version-2 card forward is reserved for
 * an explicit "rebuild as a new version-3 card" workflow that produces a *new* card and leaves
 * the original intact. That workflow does not exist yet, and its absence is why version 2 is
 * view-only rather than quietly re-saved.
 *
 * Absent is normalized to 2: the only writer that ever omitted it is the composition work
 * that introduced module selections, so an input that satisfies this schema without naming
 * a version is a version-2 input by construction. An input declaring any *other* version is
 * rejected rather than coerced — a format this code does not know is not one it can read.
 */
export const BUILDER_INPUTS_SCHEMA_VERSION = 4

/**
 * Every accepted persisted format. A card is read at the version it was written at; nothing
 * is rewritten on read, and nothing is upgraded on save.
 */
export const READABLE_BUILDER_INPUTS_SCHEMA_VERSIONS = [2, 3, 4] as const

/**
 * Formats that still parse but can no longer back an edit session.
 *
 * Being able to *read* a stored input and being entitled to *re-resolve and overwrite the card
 * from it* are different rights, and version 2 has the first without the second. Its recipe and
 * module pins are exact, but the four whole-set dependencies underneath them are read from
 * whatever is current — so saving a reopened version-2 card would silently replace the
 * physician's stored card with one resolved against a modifier set, rescue module set,
 * compatibility rule set, and role table that may all have moved since. The card is intact and
 * stays fully usable as a document; only the builder is closed to it.
 */
export const SUPERSEDED_BUILDER_INPUTS_SCHEMA_VERSIONS: readonly number[] = [2]

export function isSupersededBuilderInputsVersion(schemaVersion: number): boolean {
  return SUPERSEDED_BUILDER_INPUTS_SCHEMA_VERSIONS.includes(schemaVersion)
}

const builderInputsObject = z.object({
  schemaVersion: z
    .union([z.literal(2), z.literal(3), z.literal(4)])
    // Absent means 2 — see the note above. A version this code does not know is rejected
    // rather than coerced: a format we cannot read is not one we may guess at.
    .default(2),
  /**
   * The immutable release bundle this card resolves through — present from version 3.
   *
   * `recipeVersionId` alone pins a name; this pins the whole authored dependency set behind
   * it, hash by hash. Without it a card is still exact about its recipe and modules while the
   * modifier set, rescue modules, compatibility rules, and role alias table it also resolves
   * through are read from whatever is current.
   */
  releaseBundleId: z.string().trim().min(1).max(120).optional(),
  scenarioId: z.string().trim().min(1).max(100),
  input: buildCardInputSchema,
  catalogPicks: z.array(catalogPickRefSchema).max(100).default([]),
  familyPicks: z.array(familyPickRefSchema).max(60).default([]),
  customItems: z.array(customItemSchema).max(MAX_CUSTOM_ITEMS).default([]),
  equipmentSets: z.array(equipmentSetRefSchema).max(20).default([]),
})

/**
 * The version, the release pin, and the family-selection shape have to agree, in every direction.
 *
 * A version-3-or-later input without a pin would claim a guarantee it cannot deliver. A version-2
 * input *with* one is the more dangerous shape: it looks pinned, and a reader that trusted the
 * field would resolve a card through a release its author never selected. The family rules are the
 * same argument applied to product lines — a version-4 input carrying a discovery key looks
 * reviewed and is not, and a version-3 input carrying a reviewed pin claims a guarantee its own
 * writer could not have produced.
 */
function requireVersionPinAgreement(
  value: {
    schemaVersion: number
    releaseBundleId?: string
    familyPicks?: FamilyPickRef[]
  },
  ctx: z.RefinementCtx,
) {
  if (value.schemaVersion >= 3 && !value.releaseBundleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['releaseBundleId'],
      message: `A version-${value.schemaVersion} builder input must name the release bundle it was built from.`,
    })
  }
  if (value.schemaVersion === 2 && value.releaseBundleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['releaseBundleId'],
      message: 'A version-2 builder input predates release bundles and cannot name one.',
    })
  }

  for (const [index, pick] of (value.familyPicks ?? []).entries()) {
    const reviewed = isReviewedFamilyPickRef(pick)
    if (value.schemaVersion >= 4 && !reviewed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['familyPicks', index],
        message:
          'A version-4 builder input records product lines as reviewed family versions, not as catalog-browsing keys.',
      })
    }
    if (value.schemaVersion < 4 && reviewed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['familyPicks', index],
        message: `A version-${value.schemaVersion} builder input predates reviewed product families and cannot name one.`,
      })
    }
  }
}

/**
 * Whether stored inputs record a product line by a key nothing can turn back into a membership.
 *
 * True only for a version-2 or version-3 card that actually selected a line. The distinction
 * matters: most version-3 cards select no product line at all, and closing the builder to those
 * would be punishing them for a field they never used. One that did select a line cannot be
 * reopened, because reopening means re-resolving, and re-resolving means deciding which products
 * `MFR-X|surgical chest tube|candidate` stands for today.
 */
export function carriesUnreconcilableFamilyIdentity(inputs: {
  schemaVersion: number
  familyPicks?: FamilyPickRef[]
}): boolean {
  if (inputs.schemaVersion >= 4) return false
  return (inputs.familyPicks ?? []).length > 0
}

export const builderInputsSchema = builderInputsObject.superRefine(requireVersionPinAgreement)

export type BuilderInputs = z.infer<typeof builderInputsSchema>

/** A card that pins a release bundle, narrowed so the pin is not optional at the type level. */
export type ReleasePinnedBuilderInputs = BuilderInputs & {
  schemaVersion: 3 | 4
  releaseBundleId: string
}

export function isReleasePinned(inputs: BuilderInputs): inputs is ReleasePinnedBuilderInputs {
  return inputs.schemaVersion >= 3 && typeof inputs.releaseBundleId === 'string'
}

export const saveCardRequestSchema = builderInputsObject
  .extend({
    /** Absent for a new card; present when overwriting one the caller owns. */
    cardId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(160),
    physicianName: z.string().trim().max(160).nullable().optional(),
    status: z.enum(['draft', 'final']).default('draft'),
  })
  .superRefine(requireVersionPinAgreement)
  .superRefine((value, ctx) => {
    // Nothing may be *written* at a superseded version, which is what makes version 2
    // view-only rather than merely discouraged. Enforced in the schema rather than at the
    // call site because there are two writers — create and overwrite — and a rule that lives
    // in one of them is a rule the other can forget.
    if (!isSupersededBuilderInputsVersion(value.schemaVersion)) return
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['schemaVersion'],
      message: `Builder inputs at version ${value.schemaVersion} are read-only. Saving would re-resolve the card against definitions it never pinned.`,
    })
  })

export type SaveCardRequest = z.infer<typeof saveCardRequestSchema>

export const cardIdSchema = z.string().uuid()
export const shareTokenSchema = z.string().uuid()
