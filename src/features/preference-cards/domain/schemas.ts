import { z } from 'zod'

import {
  openHoldStatuses,
  proceduralPhases,
  procedureCompositionActionTypes,
  requirednessValues,
  setupZones,
} from './types'
import type { ProcedureCompositionAction } from './types'

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
  requiredness: z.enum(requirednessValues),
  dependencyRule: z.string().nullable(),
  quantityExpression: quantityExpressionSchema,
  selectionMode: z.enum(['single', 'multiple']),
  setupZone: z.enum(setupZones),
  proceduralPhase: z.enum(proceduralPhases),
  setupSequence: z.number().int().min(0),
  openHoldStatus: z.enum(openHoldStatuses),
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

/**
 * Deliberately non-strict at the top level: the governed seeds carry an authoring-rationale
 * `reason` alongside every action, read by the loaders before this schema runs and dropped
 * from what the runtime keeps. The *payloads* are strict — see the per-action schemas below.
 */
export const procedureCompositionActionSchema = z.object({
  id: z.string().min(1),
  sequence: z.number().int().min(0),
  actionType: z.enum(procedureCompositionActionTypes),
  targetRequirementKey: z.string().min(1).optional(),
  targetSlotId: z.string().min(1).optional(),
  targetRoleCode: z.string().min(1).optional(),
  // See `ProcedureCompositionAction.optionalTarget`: matching nothing is expected for a
  // composition whose modules are chosen per card, and matching two requirements blocks.
  optionalTarget: z.boolean().optional(),
  payload: z.record(z.string(), z.unknown()),
})

/**
 * Canonical payload contracts for every `ProcedureCompositionActionType` (P91-C4).
 *
 * All strict: an unknown payload key is a typo becoming inert authored content, so it is
 * refused rather than carried. The strictness is scoped to the payloads — the action object
 * itself stays non-strict for the governed seeds' top-level `reason` field.
 */

/**
 * `remove_slot` consumes no payload value, and that is exactly why the payload is pinned to
 * the empty object: anything authored inside it would be a statement the evaluator ignores.
 */
export const removeSlotPayloadSchema = z.object({}).strict()

/**
 * `set_requiredness` carries the dependency rule with it. Requiredness and the condition
 * text a reader needs to act on it are one clinical statement; splitting them across two
 * action types is how a card ends up conditional with nothing saying on what.
 */
export const setRequirednessPayloadSchema = z
  .object({
    value: z.enum(requirednessValues),
    dependencyRule: z.string().min(1).nullable().optional(),
  })
  .strict()

export const setQuantityPayloadSchema = z
  .object({
    // Strict here rather than on the shared expression schema: a stray key inside a slot's
    // stored expression is tolerated on read, but authoring one on an action is a typo.
    expression: quantityExpressionSchema.strict(),
  })
  .strict()

/**
 * Zone and phase values a composition action may assign. Enumerated for the same reason
 * `set_requiredness` is: an arbitrary string here would flow into the workspace's zone/phase
 * grouping and its i18n lookups, and nothing downstream re-validates it.
 */
export const setSetupZonePayloadSchema = z
  .object({
    value: z.enum(setupZones),
  })
  .strict()

export const setProceduralPhasePayloadSchema = z
  .object({
    value: z.enum(proceduralPhases),
  })
  .strict()

export const setOpenHoldStatusPayloadSchema = z
  .object({
    value: z.enum(openHoldStatuses),
  })
  .strict()

/**
 * The note must say something — empty and whitespace-only notes are refused — but a valid
 * note is appended verbatim, never trimmed: the authored text is reviewed content.
 */
export const appendNotePayloadSchema = z
  .object({
    note: z.string().refine((note) => note.trim().length > 0, {
      message: 'append_note requires a note that is not empty or whitespace-only.',
    }),
  })
  .strict()

export interface CompositionActionParseContext {
  /**
   * What the caller is doing and for which recipe/composition, so a failure names its
   * source — e.g. `expanding the Medical thoracoscopy composition (recipe-med-thoracoscopy-v0-3)`.
   */
  operation: string
}

export type ParsedProcedureCompositionActionPayload =
  | ({ actionType: 'remove_slot' } & z.infer<typeof removeSlotPayloadSchema>)
  | ({ actionType: 'set_requiredness' } & z.infer<typeof setRequirednessPayloadSchema>)
  | ({ actionType: 'set_quantity' } & z.infer<typeof setQuantityPayloadSchema>)
  | ({ actionType: 'set_setup_zone' } & z.infer<typeof setSetupZonePayloadSchema>)
  | ({ actionType: 'set_procedural_phase' } & z.infer<typeof setProceduralPhasePayloadSchema>)
  | ({ actionType: 'set_open_hold_status' } & z.infer<typeof setOpenHoldStatusPayloadSchema>)
  | ({ actionType: 'append_note' } & z.infer<typeof appendNotePayloadSchema>)

/**
 * The one place a composition action's payload is interpreted (P91-C4).
 *
 * Every boundary that accepts an action — the governed-seed loaders, the composition
 * generator, and the evaluator itself — dispatches through this function, so the schemas
 * above cannot drift apart from the evaluator's reading of them and no boundary can accept
 * a value another would refuse. An action type the union has never heard of throws rather
 * than passing through: the compile-time `never` binding keeps the switch exhaustive when
 * the union grows, and the throw keeps it exhaustive against untrusted runtime data.
 */
export function parseProcedureCompositionActionPayload(
  action: Pick<ProcedureCompositionAction, 'actionType' | 'payload'> & { id?: string },
  context: CompositionActionParseContext,
): ParsedProcedureCompositionActionPayload {
  const actionId = action.id ?? '<no id>'
  const parsePayload = <Schema extends z.ZodTypeAny>(schema: Schema): z.infer<Schema> => {
    try {
      return schema.parse(action.payload) as z.infer<Schema>
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `${issue.path.join('.') || '(payload)'}: ${issue.message}`)
          .join('; ')
        throw new Error(
          `Invalid ${action.actionType} payload on composition action "${actionId}" while ${context.operation}: ${issues}`,
          { cause: error },
        )
      }
      throw error
    }
  }

  switch (action.actionType) {
    case 'remove_slot':
      parsePayload(removeSlotPayloadSchema)
      return { actionType: 'remove_slot' }
    case 'set_requiredness':
      return { actionType: 'set_requiredness', ...parsePayload(setRequirednessPayloadSchema) }
    case 'set_quantity':
      return { actionType: 'set_quantity', ...parsePayload(setQuantityPayloadSchema) }
    case 'set_setup_zone':
      return { actionType: 'set_setup_zone', ...parsePayload(setSetupZonePayloadSchema) }
    case 'set_procedural_phase':
      return {
        actionType: 'set_procedural_phase',
        ...parsePayload(setProceduralPhasePayloadSchema),
      }
    case 'set_open_hold_status':
      return { actionType: 'set_open_hold_status', ...parsePayload(setOpenHoldStatusPayloadSchema) }
    case 'append_note':
      return { actionType: 'append_note', ...parsePayload(appendNotePayloadSchema) }
    default: {
      const exhaustiveCheck: never = action.actionType
      throw new Error(
        `Unknown composition action type "${String(exhaustiveCheck)}" on composition action "${actionId}" while ${context.operation}. Supported types: ${procedureCompositionActionTypes.join(', ')}.`,
      )
    }
  }
}
