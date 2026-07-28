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

export const builderInputsSchema = z.object({
  scenarioId: z.string().trim().min(1).max(100),
  input: buildCardInputSchema,
  catalogPicks: z.array(catalogPickRefSchema).max(100).default([]),
  familyPicks: z.array(familyPickRefSchema).max(60).default([]),
  customItems: z.array(customItemSchema).max(MAX_CUSTOM_ITEMS).default([]),
  equipmentSets: z.array(equipmentSetRefSchema).max(20).default([]),
})

export type BuilderInputs = z.infer<typeof builderInputsSchema>

export const saveCardRequestSchema = builderInputsSchema.extend({
  /** Absent for a new card; present when overwriting one the caller owns. */
  cardId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(160),
  physicianName: z.string().trim().max(160).nullable().optional(),
  status: z.enum(['draft', 'final']).default('draft'),
})

export type SaveCardRequest = z.infer<typeof saveCardRequestSchema>

export const cardIdSchema = z.string().uuid()
export const shareTokenSchema = z.string().uuid()
