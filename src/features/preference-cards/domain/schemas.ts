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
  modifierCodes: z.array(z.string().min(1)).max(30),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  conditionalStates: z.record(z.string(), z.enum(['include', 'exclude', 'undecided'])).optional(),
  selectedHospitalItemIds: z
    .record(z.string(), z.string().min(1).nullable())
    .refine((value) => Object.keys(value).length <= 250, {
      message: 'At most 250 hospital-item selections are allowed.',
    })
    .optional(),
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
