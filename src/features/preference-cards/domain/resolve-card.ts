import { evaluateCompatibilityRules } from './evaluate-compatibility'
import { effectiveGovernanceState, expandRecipeComposition } from './expand-recipe-composition'
import { suppressKitDuplicates } from './kit-suppression'
import { evaluateQuantityExpression } from './quantity-expression'
import { buildCardInputSchema, quantityExpressionSchema, recipeSlotSchema } from './schemas'
import { familyKeyFromPickId, isLegacyFamilyPickId } from './size-at-procedure'
import { stableSnapshotHash } from './stable-hash'
import type {
  BuildCardInput,
  BuildContext,
  ConditionalState,
  HospitalItem,
  IncludedRecipeModule,
  ModifierAction,
  OpenHoldStatus,
  ProceduralPhase,
  ReadinessState,
  RecipeSlot,
  Requiredness,
  ResolvedCard,
  ResolvedCardItem,
  RuleMessage,
  RuleTraceEvent,
  SetupZone,
  VerificationState,
} from './types'

/**
 * 0.2.0 — composition. The hashable domain output gained `includedModules` and every item
 * gained its requirement key and source modules, so snapshots written by 0.1.0 hash
 * differently by construction and the version records why.
 *
 * Stamped onto every resolved card and inside its content hash, so it describes the *output
 * shape* a snapshot was written in. That is a narrower thing than the resolver contract below.
 */
export const PREFERENCE_CARD_ENGINE_VERSION = 'ip-cards-resolver/0.2.0'

/**
 * The **semantic** resolver contract: what resolution means, independent of how it is written.
 *
 * A release records the contract it was published against, and a card pinned to that release
 * is only reconstructable while the contract holds. So the thing recorded has to be the thing
 * that actually matters, and a source digest is not it — renaming a local variable, extracting
 * a helper, or reformatting a file all move a digest while changing nothing a card resolves
 * to. Treating that as "the contract moved" would mark every historical card unsupported for a
 * refactor, which trains everyone to ignore the signal.
 *
 * So this version is bumped by a human, deliberately, when resolution *semantics* change —
 * ordering, deduplication, governance folding, kit suppression, conditional handling, and the
 * rest of the invariants enumerated in `resolver-contract.test.ts`. Those tests are what give
 * the string meaning: they assert the contract behaviourally, so a refactor that preserves it
 * passes and a change that breaks it fails whether or not anyone remembered to bump this.
 *
 * The source digest still exists — see `resolverImplementationHash` on a release bundle — but
 * it is provenance ("which build produced this"), never a support boundary.
 */
export const PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION = 'ip-cards-resolver-contract/1'

interface MutableResolution {
  messages: RuleMessage[]
  trace: RuleTraceEvent[]
  slots: RecipeSlot[]
  rescueModuleCodes: string[]
  replacementBySlot: Map<string, string>
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

function cloneHospitalItem(item: HospitalItem): HospitalItem {
  return {
    ...item,
    attributes: { ...item.attributes },
    kitComponents: item.kitComponents.map((component) => ({ ...component })),
    catalogProduct: item.catalogProduct ? { ...item.catalogProduct } : null,
  }
}

function trace(
  state: MutableResolution,
  event: Omit<RuleTraceEvent, 'id' | 'sequence'> & { id?: string },
) {
  state.trace.push({
    ...event,
    id: event.id ?? `trace-${state.trace.length + 1}`,
    sequence: state.trace.length + 1,
  })
}

function addMessage(
  state: MutableResolution,
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
  state: MutableResolution,
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

function conditionalStateFor(slot: RecipeSlot, input: BuildCardInput): ConditionalState | null {
  if (slot.requiredness !== 'conditional') return null
  return input.conditionalStates?.[slot.id] ?? 'undecided'
}

function itemResolution(
  slot: RecipeSlot,
  input: BuildCardInput,
  context: BuildContext,
  selectedItemOverride: string | null | undefined,
  state: MutableResolution,
): ResolvedCardItem {
  const conditionalState = conditionalStateFor(slot, input)
  const effectiveRequiredness =
    slot.requiredness === 'conditional' && conditionalState === 'include'
      ? 'required'
      : slot.requiredness
  const options = context.hospitalRoleOptions
    .filter((option) => option.active && option.roleCode === slot.roleCode)
    .sort(
      (left, right) =>
        left.preferenceRank - right.preferenceRank || left.id.localeCompare(right.id),
    )
  const selectedOption =
    selectedItemOverride === undefined
      ? // A card whose selections are explicit has already recorded a decision for every
        // requirement it knows about, so an absent key means "not chosen" rather than "use
        // whatever the formulary ranks first today". Falling back here is what let a
        // re-ranked local formulary change which product a saved card asked for, with nothing
        // about the stored card having moved.
        input.selectionsAreExplicit
        ? undefined
        : options[0]
      : selectedItemOverride === null
        ? undefined
        : options.find(
            (option) =>
              option.hospitalItemId === selectedItemOverride ||
              (isLegacyFamilyPickId(selectedItemOverride) &&
                familyKeyFromPickId(option.hospitalItemId) ===
                  familyKeyFromPickId(selectedItemOverride)),
          )
  const selectedItem = selectedOption
    ? (context.hospitalItems.find((item) => item.id === selectedOption.hospitalItemId) ?? null)
    : null
  const whyIncluded = [slot.includedBy]

  let resolutionState: ResolvedCardItem['resolutionState'] = 'unresolved'
  let verificationState: VerificationState = selectedItem?.verificationState ?? 'unverified'
  const rationale = selectedOption?.rationale ?? null

  if (!selectedItem) {
    if (effectiveRequiredness === 'required') {
      // A required role with nothing chosen yet is an unfinished card, not a conflict.
      // Blocking here would make most procedures unbuildable, since many roles have no
      // catalogued product and are covered by a custom line item instead.
      resolutionState = 'warning'
      const message = `No product is selected yet for required role ${slot.roleCode} (${slot.label}).`
      addMessage(state, {
        id: `unresolved-required-${slot.id}`,
        severity: 'warning',
        code: 'required_role_unresolved',
        message,
        sourceType: 'slot',
        sourceId: slot.id,
      })
      whyIncluded.push('No product selected yet; add one or enter a custom item.')
    } else {
      whyIncluded.push('No active hospital-local mapping is selected.')
    }
  } else if (selectedItem.verificationState === 'hidden') {
    resolutionState = 'blocking'
    verificationState = 'hidden'
    const message = `${selectedItem.localDescription} is hidden and cannot be selected in the builder.`
    addMessage(state, {
      id: `hidden-product-${slot.id}`,
      severity: 'blocking',
      code: 'hidden_product_selected',
      message,
      sourceType: 'hospital_item',
      sourceId: selectedItem.id,
    })
    whyIncluded.push(message)
  } else if (selectedItem.verificationState === 'unverified') {
    // Unverified products are usable and badged, not withheld. Info severity keeps the
    // card "complete" while still printing a confirm-before-use flag on every such line.
    //
    // The row is resolved: something is chosen and the snapshot carries it. Leaving this at
    // the initial 'unresolved' made every unverified selection — 158 candidate-tier catalog
    // products and every custom line — read as an empty requirement in the builder.
    resolutionState = 'resolved'
    const message = `${selectedItem.localDescription} is not verified against a current catalog — confirm availability and IFU.`
    addMessage(state, {
      id: `unverified-product-${slot.id}`,
      severity: 'info',
      code: 'unverified_product',
      message,
      sourceType: 'hospital_item',
      sourceId: selectedItem.id,
    })
    verificationState = 'unverified'
    whyIncluded.push(`Resolved to ${selectedItem.localDescription}.`)
  } else if (selectedItem.verificationState === 'demo_only') {
    resolutionState = 'warning'
    const message = `${selectedItem.localDescription} is demo-only and cannot support production readiness.`
    addMessage(state, {
      id: `demo-only-${slot.id}`,
      severity: 'warning',
      code: 'demo_only_mapping',
      message,
      sourceType: 'hospital_item',
      sourceId: selectedItem.id,
    })
    whyIncluded.push(`Resolved to ${selectedItem.localDescription} for prototype layout only.`)
  } else if (selectedItem.verificationState === 'prototype_visible') {
    resolutionState = 'warning'
    const message = `${selectedItem.localDescription} is prototype-visible and requires current local verification.`
    addMessage(state, {
      id: `prototype-visible-${slot.id}`,
      severity: 'warning',
      code: 'prototype_product_requires_verification',
      message,
      sourceType: 'hospital_item',
      sourceId: selectedItem.id,
    })
    whyIncluded.push(`Resolved to ${selectedItem.localDescription}.`)
  } else if (selectedItem.itemType === 'commercial_product') {
    resolutionState = 'resolved'
    whyIncluded.push(`Resolved to ${selectedItem.localDescription}.`)
  } else {
    resolutionState = 'generic_local'
    whyIncluded.push(`Resolved to local resource ${selectedItem.localDescription}.`)
  }

  trace(state, {
    kind: 'resolution',
    message: selectedItem
      ? `${slot.roleCode} resolved to ${selectedItem.localDescription}.`
      : `${slot.roleCode} remains unresolved.`,
    sourceId: selectedItem?.id ?? null,
    slotId: slot.id,
  })

  const quantity = evaluateQuantityExpression(slot.quantityExpression)
  trace(state, {
    kind: 'quantity',
    message: `${slot.label} quantity resolved to ${quantity}.`,
    sourceId: null,
    slotId: slot.id,
  })

  // A physical item or family can be mapped to more than one role. The role option proves
  // which relationship was selected for this exact slot; snapshot that effective role
  // rather than retaining whichever role happened to create the shared item first.
  const selectedItemSnapshot = selectedItem
    ? { ...cloneHospitalItem(selectedItem), roleCode: slot.roleCode }
    : null

  return {
    id: slot.id,
    sourceSlotId: slot.sourceSlotId,
    requirementKey: slot.requirementKey,
    ...(slot.sourceModuleVersionIds && slot.sourceModuleVersionIds.length > 0
      ? { sourceModuleVersionIds: [...slot.sourceModuleVersionIds] }
      : {}),
    roleCode: slot.roleCode,
    label: slot.label,
    genericRequirement: slot.genericRequirement,
    requiredness: slot.requiredness,
    effectiveRequiredness,
    dependencyRule: slot.dependencyRule,
    conditionalState,
    quantityDisplay: String(quantity),
    setupZone: slot.setupZone,
    proceduralPhase: slot.proceduralPhase,
    setupSequence: slot.setupSequence,
    openHoldStatus: slot.openHoldStatus,
    selectedHospitalItemId: selectedItem?.id ?? null,
    selectedCatalogProductId: selectedItem?.catalogProduct?.productId ?? null,
    selectedItemSnapshot,
    resolutionState,
    verificationState,
    compatibilityState: 'not_evaluated',
    rationale,
    whyIncluded,
    notes: slot.notes,
  }
}

function readinessFromMessages(messages: RuleMessage[]): ReadinessState {
  if (messages.some((message) => message.severity === 'blocking')) return 'blocked'
  if (messages.some((message) => message.severity === 'warning')) {
    return 'complete_with_warnings'
  }
  return 'complete'
}

function snapshotPayload(card: Omit<ResolvedCard, 'snapshotHash'>) {
  const waivers = card.warnings
    .filter((warning) => warning.waiverReason)
    .map((warning) => ({
      id: warning.id,
      waiverReason: warning.waiverReason,
    }))
  // The hash addresses card *content*, so re-saving an unchanged card keeps its identity.
  // When it was generated is carried by the row's timestamps, not the hash.
  const hashableCard: Omit<ResolvedCard, 'snapshotHash' | 'generatedAt'> & {
    generatedAt?: string
  } = { ...card }
  delete hashableCard.generatedAt
  return {
    ...hashableCard,
    warnings: card.warnings.map((warning) => {
      const stableWarning: Partial<RuleMessage> = { ...warning }
      delete stableWarning.acknowledged
      delete stableWarning.waiverReason
      return stableWarning
    }),
    ...(waivers.length > 0 ? { waivers } : {}),
  }
}

export function resolveCard(inputValue: BuildCardInput, context: BuildContext): ResolvedCard {
  const input = buildCardInputSchema.parse(inputValue)
  if (input.recipeVersionId !== context.recipe.id) {
    throw new Error(
      `Recipe ${input.recipeVersionId} does not match loaded context ${context.recipe.id}.`,
    )
  }

  // Steps 1-3 of the resolution order: expand the selected modules, add the procedure's
  // own direct slots, and apply the explicit composition actions. Everything below this
  // point sees one flat effective recipe and does not know composition exists.
  const expansion = expandRecipeComposition({
    recipe: context.recipe,
    modules: context.recipeModules,
    selectedModuleVersionIds: input.selectedModuleVersionIds,
    startSequence: 1,
  })
  const state: MutableResolution = {
    slots: expansion.slots,
    messages: [...expansion.messages],
    trace: [...expansion.trace],
    rescueModuleCodes: [],
    replacementBySlot: new Map(),
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

  const overlayItemBySlot = new Map<string, string>()
  for (const overlay of context.preferenceOverlays) {
    const targets = state.slots.filter(
      (slot) =>
        (overlay.slotId && slot.id === overlay.slotId) ||
        (overlay.roleCode && slot.roleCode === overlay.roleCode),
    )
    for (const slot of targets) {
      const { hospitalItemId, ...slotOverride } = overlay.override
      Object.assign(slot, slotOverride)
      if (hospitalItemId) overlayItemBySlot.set(slot.id, hospitalItemId)
      trace(state, {
        kind: 'overlay',
        message: `Preference overlay ${overlay.id} changed ${slot.label}.`,
        sourceId: overlay.id,
        slotId: slot.id,
      })
    }
  }

  let items = state.slots
    .sort(
      (left, right) => left.setupSequence - right.setupSequence || left.id.localeCompare(right.id),
    )
    .map((slot) => {
      const hasBuilderSelection = Object.prototype.hasOwnProperty.call(
        input.selectedHospitalItemIds ?? {},
        slot.id,
      )
      const selectedItemOverride = hasBuilderSelection
        ? (input.selectedHospitalItemIds?.[slot.id] ?? null)
        : overlayItemBySlot.get(slot.id)
      return itemResolution(slot, input, context, selectedItemOverride, state)
    })

  const kitResult = suppressKitDuplicates(items, state.trace.length + 1)
  items = kitResult.items
  state.trace.push(...kitResult.trace)

  const compatibility = evaluateCompatibilityRules(
    context.compatibilityRules,
    items,
    selectedModifierCodes,
    state.trace.length + 1,
  )
  const compatibilityByItem = new Map<string, 'pass' | 'fail' | 'unknown'>()
  for (const result of compatibility) {
    if (result.sourceItemId) compatibilityByItem.set(result.sourceItemId, result.state)
    if (result.targetItemId) compatibilityByItem.set(result.targetItemId, result.state)
    if (result.message) state.messages.push(result.message)
    state.trace.push(result.trace)
  }
  items = items.map((item) => ({
    ...item,
    compatibilityState: item.selectedHospitalItemId
      ? (compatibilityByItem.get(item.selectedHospitalItemId) ?? 'not_evaluated')
      : 'not_evaluated',
  }))

  // No standing draft-governance warning: every recipe is a draft, so the message was on
  // every card forever and only duplicated the page-level reference-only banner. The
  // `prototype` flag below still records it.

  for (const message of state.messages) {
    const reason = input.waivers?.[message.id]?.trim()
    if (!reason) continue
    message.acknowledged = true
    message.waiverReason = reason
    trace(state, {
      kind: 'waiver',
      message: `Administrative waiver recorded for ${message.code}; severity and readiness impact remain unchanged.`,
      sourceId: message.id,
      slotId: message.sourceType === 'slot' ? message.sourceId : null,
    })
  }

  const includedModules: IncludedRecipeModule[] = expansion.includedModules
  // Nothing composed can present as stronger than its weakest part.
  const governanceState = effectiveGovernanceState(context.recipe.governanceState, includedModules)

  const readinessState = readinessFromMessages(state.messages)
  trace(state, {
    kind: 'readiness',
    message: `Card readiness resolved to ${readinessState}.`,
    sourceId: null,
    slotId: null,
  })

  const generatedAtValue = input.variables.generated_at
  const generatedAt =
    typeof generatedAtValue === 'string' && !Number.isNaN(Date.parse(generatedAtValue))
      ? new Date(generatedAtValue).toISOString()
      : '1970-01-01T00:00:00.000Z'
  const cardWithoutHash: Omit<ResolvedCard, 'snapshotHash'> = {
    recipeVersionId: context.recipe.id,
    recipeName: context.recipe.name,
    recipeVersion: context.recipe.version,
    sourceProcedureCode: context.recipe.sourceProcedureCode,
    organizationName: context.organizationName,
    siteName: context.siteName,
    locationName: context.locationName,
    selectedModifiers: selectedModifierCodes,
    includedModules,
    items,
    suppressedItems: kitResult.suppressedItems,
    warnings: state.messages,
    readinessState,
    governanceState,
    ruleTrace: state.trace,
    engineVersion: PREFERENCE_CARD_ENGINE_VERSION,
    catalogImportId: context.recipe.catalogImportId,
    generatedAt,
    prototype:
      governanceState !== 'approved' ||
      items.some(
        (item) =>
          item.verificationState === 'demo_only' || item.verificationState === 'prototype_visible',
      ),
  }
  return {
    ...cardWithoutHash,
    snapshotHash: stableSnapshotHash(snapshotPayload(cardWithoutHash)),
  }
}
