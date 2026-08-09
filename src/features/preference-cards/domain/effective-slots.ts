import { expandRecipeComposition } from './expand-recipe-composition'
import { quantityExpressionSchema, recipeSlotSchema } from './schemas'
import type {
  BuildContext,
  IncludedRecipeModule,
  ModifierAction,
  OpenHoldStatus,
  ProceduralPhase,
  RecipeSlot,
  Requiredness,
  RuleMessage,
  RuleTraceEvent,
  SetupZone,
} from './types'

/**
 * The effective slot definitions a card resolves from — composition, then every modifier action,
 * then rescue modules — and nothing after that.
 *
 * This is step 1 to 4 of resolution, lifted out of `resolve-card.ts` unchanged so that two
 * callers can share one implementation rather than two approximations of it:
 *
 * - `resolveCard`, which continues from this state into overlays, selection, compatibility,
 *   suppression, quantities, and readiness; and
 * - the rebuild planner, which needs to know *which requirements the target release actually
 *   expresses* for a given composition and modifier selection, and nothing else.
 *
 * ## Why it was extracted rather than approximated
 *
 * The rebuild planner used to apply `add_slot` and `add_rescue_module` and skip the rest, on the
 * argument that the omissions failed safe. They did not. `TECH_CHEST_TUBE_SMALL_BORE` and
 * `TECH_CHEST_TUBE_LARGE_BORE` remove alternate technique slots and change requiredness, so the
 * plan described requirements the new card would not have. `DIGITAL_DRAINAGE` replaces
 * `GENERIC_DRAINAGE_UNIT`'s role with `DIGITAL_DRAINAGE_SYSTEM`, so a stored selection for the
 * digital role was tested against the generic one and declared role-ineligible — for a role the
 * target resolver was about to create. A plan that disagrees with the card it produces is worse
 * than no plan, because it is signed.
 *
 * So there is one transformation, and the planner and the resolver are the same two callers of
 * it. Anything that changes what requirements exist belongs here; anything that decides what
 * *fills* them stays in `resolve-card.ts`.
 *
 * Extracting this moved `resolverImplementationHash`, which is provenance rather than the support
 * boundary — see `PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION`. The contract is unchanged: the code
 * below is the code that was there, and `resolver-contract-v1.test.ts` and the golden scenario
 * hashes both pin that.
 */

/** Everything the slot-definition phase produces, before anything is selected for a requirement. */
export interface EffectiveSlotState {
  messages: RuleMessage[]
  trace: RuleTraceEvent[]
  slots: RecipeSlot[]
  rescueModuleCodes: string[]
  replacementBySlot: Map<string, string>
  includedModules: IncludedRecipeModule[]
}

function cloneSlot(slot: RecipeSlot): RecipeSlot {
  return {
    ...slot,
    quantityExpression: { ...slot.quantityExpression },
    ...(slot.sourceSlotAliases ? { sourceSlotAliases: [...slot.sourceSlotAliases] } : {}),
    ...(slot.sourceModuleVersionIds
      ? { sourceModuleVersionIds: [...slot.sourceModuleVersionIds] }
      : {}),
  }
}

function trace(
  state: EffectiveSlotState,
  event: Omit<RuleTraceEvent, 'id' | 'sequence'> & { id?: string },
) {
  state.trace.push({
    ...event,
    id: event.id ?? `trace-${state.trace.length + 1}`,
    sequence: state.trace.length + 1,
  })
}

function addMessage(
  state: EffectiveSlotState,
  message: Omit<RuleMessage, 'id' | 'acknowledged' | 'waiverReason'> & {
    id?: string
  },
) {
  state.messages.push({
    ...message,
    id: message.id ?? `message-${state.messages.length + 1}`,
    acknowledged: false,
    waiverReason: null,
  })
}

/**
 * A modifier authored before composition targets an imported slot id. Once that
 * requirement moves into a shared module the id it lives under changes, so the original id
 * is kept as a provenance alias and matched here — the modifier keeps working without
 * being rewritten.
 */
function matchingSlots(slots: RecipeSlot[], action: ModifierAction): RecipeSlot[] {
  if (action.targetRequirementKey) {
    return slots.filter((slot) => slot.requirementKey === action.targetRequirementKey)
  }
  if (action.targetSlotId) {
    const target = action.targetSlotId
    return slots.filter(
      (slot) =>
        slot.id === target ||
        slot.sourceSlotId === target ||
        (slot.sourceSlotAliases ?? []).includes(target),
    )
  }
  if (action.targetRoleCode) {
    return slots.filter((slot) => slot.roleCode === action.targetRoleCode)
  }
  return []
}

function payloadString(action: ModifierAction, key: string): string | null {
  const value = action.payload[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function applyModifierAction(
  state: EffectiveSlotState,
  action: ModifierAction,
  context: BuildContext,
) {
  const affected = matchingSlots(state.slots, action)

  switch (action.actionType) {
    case 'add_slot': {
      const slot = recipeSlotSchema.parse(action.payload.slot)
      if (!state.slots.some((candidate) => candidate.id === slot.id)) {
        state.slots.push({ ...slot, includedBy: `Added by modifier ${action.modifierCode}` })
        trace(state, {
          kind: 'modifier',
          message: `${action.modifierCode} added ${slot.label}.`,
          sourceId: action.modifierCode,
          slotId: slot.id,
        })
      }
      return
    }
    case 'remove_slot': {
      const affectedIds = new Set(affected.map((slot) => slot.id))
      state.slots = state.slots.filter((slot) => !affectedIds.has(slot.id))
      for (const slot of affected) {
        trace(state, {
          kind: 'modifier',
          message: `${action.modifierCode} removed ${slot.label}.`,
          sourceId: action.modifierCode,
          slotId: slot.id,
        })
      }
      return
    }
    case 'replace_role': {
      const nextRole = payloadString(action, 'roleCode')
      if (!nextRole) return
      for (const slot of affected) {
        const previousReplacement = state.replacementBySlot.get(slot.id)
        if (previousReplacement && previousReplacement !== nextRole) {
          const message = `Modifier conflict: ${slot.label} cannot be replaced by both ${previousReplacement} and ${nextRole}.`
          addMessage(state, {
            id: `modifier-replacement-conflict-${slot.id}`,
            severity: 'blocking',
            code: 'modifier_action_collision',
            message,
            sourceType: 'modifier',
            sourceId: action.modifierCode,
          })
          trace(state, {
            kind: 'conflict',
            message,
            sourceId: action.modifierCode,
            slotId: slot.id,
          })
          continue
        }
        state.replacementBySlot.set(slot.id, nextRole)
        slot.roleCode = nextRole
        slot.label = payloadString(action, 'label') ?? slot.label
        slot.genericRequirement =
          payloadString(action, 'genericRequirement') ?? slot.genericRequirement
        trace(state, {
          kind: 'modifier',
          message: `${action.modifierCode} replaced ${slot.label} with role ${nextRole}.`,
          sourceId: action.modifierCode,
          slotId: slot.id,
        })
      }
      return
    }
    case 'set_requiredness': {
      const value = payloadString(action, 'value') as Requiredness | null
      if (!value) return
      for (const slot of affected) slot.requiredness = value
      break
    }
    case 'set_quantity': {
      const expression = quantityExpressionSchema.parse(action.payload.expression)
      for (const slot of affected) slot.quantityExpression = expression
      break
    }
    case 'set_setup_zone': {
      const value = payloadString(action, 'value') as SetupZone | null
      if (!value) return
      for (const slot of affected) slot.setupZone = value
      break
    }
    case 'set_procedural_phase': {
      const value = payloadString(action, 'value') as ProceduralPhase | null
      if (!value) return
      for (const slot of affected) slot.proceduralPhase = value
      break
    }
    case 'set_open_hold_status': {
      const value = payloadString(action, 'value') as OpenHoldStatus | null
      if (!value) return
      for (const slot of affected) slot.openHoldStatus = value
      break
    }
    case 'append_note': {
      const note = payloadString(action, 'note')
      if (!note) return
      for (const slot of affected) {
        slot.notes = [slot.notes, note].filter(Boolean).join(' ')
      }
      break
    }
    case 'require_room_capability': {
      const capability = payloadString(action, 'capability')
      if (!capability) return
      const available = context.locationCapabilities.includes(capability)
      const message = available
        ? `Room capability "${capability}" is available.`
        : `Required room capability "${capability}" is not mapped at this location.`
      trace(state, {
        kind: 'capability',
        message,
        sourceId: capability,
        slotId: null,
      })
      if (!available) {
        addMessage(state, {
          severity: 'blocking',
          code: 'room_capability_missing',
          message,
          sourceType: 'room_capability',
          sourceId: capability,
        })
      }
      return
    }
    case 'add_rescue_module': {
      const code = payloadString(action, 'code')
      if (code && !state.rescueModuleCodes.includes(code)) {
        state.rescueModuleCodes.push(code)
      }
      return
    }
    case 'validate_compatibility':
      return
    case 'raise_warning':
    case 'raise_blocking_error': {
      const message =
        payloadString(action, 'message') ?? `${action.modifierCode} raised a rule message.`
      addMessage(state, {
        severity: action.actionType === 'raise_blocking_error' ? 'blocking' : 'warning',
        code: payloadString(action, 'code') ?? action.actionType,
        message,
        sourceType: 'modifier',
        sourceId: action.modifierCode,
      })
      trace(state, {
        kind: 'modifier',
        message,
        sourceId: action.modifierCode,
        slotId: action.targetSlotId ?? null,
      })
      return
    }
    default: {
      const exhaustiveCheck: never = action.actionType
      return exhaustiveCheck
    }
  }

  for (const slot of affected) {
    trace(state, {
      kind: 'modifier',
      message: `${action.modifierCode} applied ${action.actionType} to ${slot.label}.`,
      sourceId: action.modifierCode,
      slotId: slot.id,
    })
  }
}

/**
 * Expand one composition and one modifier selection into the requirements a card will have.
 *
 * Deterministic and total: the same recipe, modules, module selection and modifier codes produce
 * byte-identical slots, messages and trace. Modifier actions run in one authored order — sequence,
 * then modifier code, then action id — because two modifiers touching one requirement must not
 * depend on which was listed first.
 */
export function expandEffectiveSlots(
  input: { selectedModuleVersionIds: string[]; modifierCodes: string[] },
  context: BuildContext,
): EffectiveSlotState {
  const expansion = expandRecipeComposition({
    recipe: context.recipe,
    modules: context.recipeModules,
    selectedModuleVersionIds: input.selectedModuleVersionIds,
    startSequence: 1,
  })
  const state: EffectiveSlotState = {
    slots: expansion.slots,
    messages: [...expansion.messages],
    trace: [...expansion.trace],
    rescueModuleCodes: [],
    replacementBySlot: new Map(),
    includedModules: expansion.includedModules,
  }
  trace(state, {
    kind: 'base_recipe',
    message: `${context.recipe.name} ${context.recipe.version} composed ${expansion.slots.length} requirements from ${expansion.includedModules.length} module(s).`,
    sourceId: context.recipe.id,
    slotId: null,
  })

  const selectedModifierCodes = [...new Set(input.modifierCodes)]
  const selectedModifiers = selectedModifierCodes.flatMap((code) => {
    const modifier = context.modifiers.find(
      (candidate) => candidate.code === code && candidate.active,
    )
    if (!modifier) {
      addMessage(state, {
        severity: 'blocking',
        code: 'unknown_modifier',
        message: `Modifier ${code} is unavailable or inactive.`,
        sourceType: 'modifier',
        sourceId: code,
      })
      return []
    }
    return [modifier]
  })

  const selectedSet = new Set(selectedModifierCodes)
  for (const modifier of selectedModifiers) {
    for (const conflict of modifier.conflictsWith) {
      if (!selectedSet.has(conflict) || modifier.code.localeCompare(conflict) > 0) continue
      const message = `${modifier.name} and ${
        context.modifiers.find((candidate) => candidate.code === conflict)?.name ?? conflict
      } are mutually exclusive.`
      addMessage(state, {
        id: `modifier-conflict-${modifier.code}-${conflict}`,
        severity: 'blocking',
        code: 'mutually_exclusive_modifiers',
        message,
        sourceType: 'modifier',
        sourceId: modifier.code,
      })
      trace(state, {
        kind: 'conflict',
        message,
        sourceId: modifier.code,
        slotId: null,
      })
    }
  }

  const actions = selectedModifiers
    .flatMap((modifier) => modifier.actions)
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.modifierCode.localeCompare(right.modifierCode) ||
        left.id.localeCompare(right.id),
    )
  for (const action of actions) applyModifierAction(state, action, context)

  for (const rescueCode of state.rescueModuleCodes) {
    const rescueModule = context.rescueModules.find((candidate) => candidate.code === rescueCode)
    if (!rescueModule) {
      addMessage(state, {
        severity: 'blocking',
        code: 'rescue_module_missing',
        message: `Rescue module ${rescueCode} is not available.`,
        sourceType: 'modifier',
        sourceId: rescueCode,
      })
      continue
    }
    for (const slot of rescueModule.slots) {
      if (state.slots.some((candidate) => candidate.id === slot.id)) continue
      state.slots.push({
        ...cloneSlot(slot),
        includedBy: `Added by rescue module ${rescueModule.code}`,
      })
      trace(state, {
        kind: 'rescue_module',
        message: `${rescueModule.code} added ${slot.label}.`,
        sourceId: rescueModule.code,
        slotId: slot.id,
      })
    }
  }

  return state
}

export { cloneSlot, trace, addMessage }
