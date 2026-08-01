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

export const familyPickRefSchema = z.object({
  familyKey: z.string().trim().min(1).max(200),
  roleCode: roleCodeSchema,
})

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
 * - **2 — composed.** Carries the exact module versions and every pick as an identifier. Still
 *   read, still re-saved as version 2. Its recipe and module pins are exact; the modifier set,
 *   rescue modules, compatibility rules, and role alias table it also resolves through are not
 *   pinned, because when it was written nothing pinned them. That is a stated limitation of
 *   these cards rather than a defect introduced by version 3.
 * - **3 — release-pinned.** Adds `releaseBundleId`: the whole authored dependency set, hashed.
 *
 * **No version is ever upgraded in place.** A version-2 card that is edited and saved is
 * written back as version 2. Stamping the current release onto it would be moving a saved card
 * to a release its author never selected, which is the automatic migration this phase
 * deliberately does not do — and it would be a *silent* one, since nothing about the card
 * would say the pin was chosen by the system rather than the physician.
 *
 * Absent is normalized to 2: the only writer that ever omitted it is the composition work
 * that introduced module selections, so an input that satisfies this schema without naming
 * a version is a version-2 input by construction. An input declaring any *other* version is
 * rejected rather than coerced — a format this code does not know is not one it can read.
 */
export const BUILDER_INPUTS_SCHEMA_VERSION = 3

/**
 * Every accepted persisted format. A card is read at the version it was written at; nothing
 * is rewritten on read, and nothing is upgraded on save.
 */
export const READABLE_BUILDER_INPUTS_SCHEMA_VERSIONS = [2, 3] as const

const builderInputsObject = z.object({
  schemaVersion: z
    .union([z.literal(2), z.literal(3)])
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
 * The version and the release pin have to agree, in both directions.
 *
 * A version-3 input without a pin would claim a guarantee it cannot deliver. A version-2
 * input *with* one is the more dangerous shape: it looks pinned, and a reader that trusted
 * the field would resolve a card through a release its author never selected.
 */
function requireVersionPinAgreement(
  value: { schemaVersion: number; releaseBundleId?: string },
  ctx: z.RefinementCtx,
) {
  if (value.schemaVersion === 3 && !value.releaseBundleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['releaseBundleId'],
      message: 'A version-3 builder input must name the release bundle it was built from.',
    })
  }
  if (value.schemaVersion === 2 && value.releaseBundleId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['releaseBundleId'],
      message: 'A version-2 builder input predates release bundles and cannot name one.',
    })
  }
}

export const builderInputsSchema = builderInputsObject.superRefine(requireVersionPinAgreement)

export type BuilderInputs = z.infer<typeof builderInputsSchema>

/** A card that pins a release bundle, narrowed so the pin is not optional at the type level. */
export type ReleasePinnedBuilderInputs = BuilderInputs & {
  schemaVersion: 3
  releaseBundleId: string
}

export function isReleasePinned(inputs: BuilderInputs): inputs is ReleasePinnedBuilderInputs {
  return inputs.schemaVersion === 3 && typeof inputs.releaseBundleId === 'string'
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

export type SaveCardRequest = z.infer<typeof saveCardRequestSchema>

export const cardIdSchema = z.string().uuid()
export const shareTokenSchema = z.string().uuid()
