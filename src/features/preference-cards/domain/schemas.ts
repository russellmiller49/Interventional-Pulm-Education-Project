import { z } from 'zod'

import { proceduralPhases, setupZones } from './types'

export const quantityExpressionSchema = z.object({
  op: z.literal('literal'),
  value: z.number().int().min(0).max(999),
})

export const buildCardInputSchema = z.object({
  organizationId: z.string().min(1),
  siteId: z.string().min(1),
  locationId: z.string().min(1),
  recipeVersionId: z.string().min(1),
  userId: z.string().min(1).optional(),
  /**
   * Required, deliberately. A builder input written before composition has no module
   * selection to restore, and filling one in from today's defaults would reinterpret a
   * saved card rather than reopen it — so such an input fails this schema and the card
   * stays viewable and printable from its snapshot instead.
   */
  selectedModuleVersionIds: z.array(z.string().min(1)).max(60),
  modifierCodes: z.array(z.string().min(1)).max(30),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  conditionalStates: z.record(z.string(), z.enum(['include', 'exclude', 'undecided'])).optional(),
  selectedHospitalItemIds: z
    .record(z.string(), z.string().min(1).nullable())
    .refine((value) => Object.keys(value).length <= 250, {
      message: 'At most 250 hospital-item selections are allowed.',
    })
    .optional(),
  /** See `BuildCardInput.selectionsAreExplicit`. Absent means the legacy fallback applies. */
  selectionsAreExplicit: z.boolean().optional(),
  waivers: z
    .record(z.string(), z.string().trim().min(10).max(500))
    .refine((value) => Object.keys(value).length <= 100, {
      message: 'At most 100 waivers are allowed.',
    })
    .optional(),
})

export const recipeSlotSchema = z.object({
  id: z.string().min(1),
  sourceSlotId: z.string().nullable(),
  requirementKey: z.string().min(1),
  sourceSlotAliases: z.array(z.string().min(1)).optional(),
  sourceModuleVersionIds: z.array(z.string().min(1)).optional(),
  roleCode: z.string().min(1),
  label: z.string().min(1),
  genericRequirement: z.string().min(1),
  requiredness: z.enum(['required', 'conditional', 'optional', 'backup', 'emergency_only']),
  dependencyRule: z.string().nullable(),
  quantityExpression: quantityExpressionSchema,
  selectionMode: z.enum(['single', 'multiple']),
  setupZone: z.enum(setupZones),
  proceduralPhase: z.enum(proceduralPhases),
  setupSequence: z.number().int().min(0),
  openHoldStatus: z.enum([
    'open_or_set_up_now',
    'have_in_room',
    'hold_unopened',
    'emergency_pull',
    'do_not_substitute',
  ]),
  responsibleRole: z.string().nullable(),
  sterileStatus: z.string().nullable(),
  allowCustom: z.boolean(),
  notes: z.string().nullable(),
  includedBy: z.string().min(1),
})

export const governanceStateSchema = z.enum(['draft', 'in_review', 'approved', 'retired'])

export const recipeModuleVersionSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  kind: z.enum(['core', 'procedure_specific', 'optional']),
  governanceState: governanceStateSchema,
  clinicalOwner: z.string().nullable(),
  operationalOwner: z.string().nullable(),
  catalogImportId: z.string().min(1),
  slots: z.array(recipeSlotSchema),
})

export const recipeModuleReferenceSchema = z.object({
  moduleVersionId: z.string().min(1),
  selectionBehavior: z.enum(['required', 'default_on', 'optional']),
  sequence: z.number().int().min(0),
})

export const procedureCompositionActionSchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().min(0),
  actionType: z.enum([
    'remove_slot',
    'set_requiredness',
    'set_quantity',
    'set_setup_zone',
    'set_procedural_phase',
    'set_open_hold_status',
    'append_note',
  ]),
  targetRequirementKey: z.string().min(1).optional(),
  targetSlotId: z.string().min(1).optional(),
  targetRoleCode: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()),
})

/**
 * `set_requiredness` carries the dependency rule with it. Requiredness and the condition
 * text a reader needs to act on it are one clinical statement; splitting them across two
 * action types is how a card ends up conditional with nothing saying on what.
 */
export const setRequirednessPayloadSchema = z.object({
  value: z.enum(['required', 'conditional', 'optional', 'backup', 'emergency_only']),
  dependencyRule: z.string().min(1).nullable().optional(),
})
