import { quantityExpressionSchema, setRequirednessPayloadSchema } from './schemas'
import { stableStringify } from './stable-hash'
import type {
  IncludedRecipeModule,
  ModuleSelectionSource,
  OpenHoldStatus,
  ProceduralPhase,
  ProcedureCompositionAction,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
  RuleMessage,
  RuleTraceEvent,
  SetupZone,
} from './types'

/**
 * Composition expansion.
 *
 * A procedure is not a recipe that inherits from a parent recipe; it is a manifest naming
 * the exact module *versions* it is assembled from. This function turns that manifest into
 * the effective slot list, before any modifier, rescue module, or resolution rule runs.
 *
 * Three properties matter more than anything else here:
 *
 * - **Deterministic.** Same recipe, same modules, same selection → byte-identical output.
 *   Module order comes from an authored sequence with the module-version id as tiebreak;
 *   nothing depends on array order or object-key order.
 * - **No last-write-wins.** When two selected modules author the same requirement, either
 *   their clinical definitions match and the requirement appears once carrying provenance
 *   from both, or they differ and the card is blocked. A later module never quietly
 *   overwrites an earlier one.
 * - **No inferred equivalence.** Two slots are the same requirement only when a reviewed
 *   mapping gave them the same `requirementKey`. Matching role codes prove nothing: the
 *   same role legitimately appears twice on a card, and two procedures can want the same
 *   role in materially different ways.
 */

/**
 * Width of each module's setup-order band. A module reference at sequence 20 lays its
 * requirements out from 20 000; anything a modifier or rescue module adds later starts
 * above every band (see `OPERATIONAL_SLOT_SEQUENCE_BASE` in the operational seed) so
 * contingency lines still land at the end of the card.
 */
export const MODULE_SEQUENCE_BAND = 1000

export interface ExpandRecipeCompositionInput {
  recipe: RecipeVersion
  modules: RecipeModuleVersion[]
  selectedModuleVersionIds: string[]
  /** Trace sequence to continue from, so composition events lead the card's trace. */
  startSequence: number
}

export interface ExpandedRecipeResult {
  slots: RecipeSlot[]
  includedModules: IncludedRecipeModule[]
  trace: RuleTraceEvent[]
  messages: RuleMessage[]
}

/**
 * The fields that decide whether two slots are *clinically* the same requirement.
 *
 * Deliberately excluded: `id`, `sourceSlotId`, `sourceSlotAliases`, `sourceModuleVersionIds`
 * and `includedBy` (identity and provenance, not content), and `setupSequence` — where a
 * requirement sits in the setup order is presentation, and a merge takes the earlier of the
 * two so a line needed sooner by either module is ready by the sooner time.
 */
const clinicalFields = [
  'roleCode',
  'label',
  'genericRequirement',
  'requiredness',
  'dependencyRule',
  'quantityExpression',
  'selectionMode',
  'setupZone',
  'proceduralPhase',
  'openHoldStatus',
  'responsibleRole',
  'sterileStatus',
  'allowCustom',
  'notes',
] as const satisfies readonly (keyof RecipeSlot)[]

function clinicalFingerprint(slot: RecipeSlot): string {
  return stableStringify(
    Object.fromEntries(clinicalFields.map((field) => [field, slot[field]])) as Record<
      string,
      unknown
    >,
  )
}

function differingClinicalFields(left: RecipeSlot, right: RecipeSlot): string[] {
  return clinicalFields.filter(
    (field) => stableStringify(left[field]) !== stableStringify(right[field]),
  )
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

function moduleLabel(version: RecipeModuleVersion): string {
  return `${version.name} v${version.version}`
}

/** Union preserving first-seen order, so provenance lists are stable. */
function union(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  const result: string[] = []
  for (const value of [...(left ?? []), ...(right ?? [])]) {
    if (!result.includes(value)) result.push(value)
  }
  return result
}

function payloadString(action: ProcedureCompositionAction, key: string): string | null {
  const value = action.payload[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function matchingSlots(slots: RecipeSlot[], action: ProcedureCompositionAction): RecipeSlot[] {
  if (action.targetRequirementKey) {
    return slots.filter((slot) => slot.requirementKey === action.targetRequirementKey)
  }
  if (action.targetSlotId) {
    return slots.filter(
      (slot) =>
        slot.id === action.targetSlotId ||
        slot.sourceSlotId === action.targetSlotId ||
        (slot.sourceSlotAliases ?? []).includes(action.targetSlotId as string),
    )
  }
  if (action.targetRoleCode) {
    return slots.filter((slot) => slot.roleCode === action.targetRoleCode)
  }
  return []
}

interface Emitter {
  trace: RuleTraceEvent[]
  messages: RuleMessage[]
  nextSequence: number
}

function emitTrace(
  emitter: Emitter,
  message: string,
  sourceId: string | null,
  slotId: string | null,
) {
  emitter.trace.push({
    id: `trace-${emitter.nextSequence}`,
    sequence: emitter.nextSequence,
    kind: 'composition',
    message,
    sourceId,
    slotId,
  })
  emitter.nextSequence += 1
}

function emitMessage(
  emitter: Emitter,
  message: Omit<RuleMessage, 'acknowledged' | 'waiverReason'>,
) {
  emitter.messages.push({ ...message, acknowledged: false, waiverReason: null })
}

export function expandRecipeComposition(input: ExpandRecipeCompositionInput): ExpandedRecipeResult {
  const { recipe, modules, selectedModuleVersionIds } = input
  const emitter: Emitter = { trace: [], messages: [], nextSequence: input.startSequence }
  const moduleById = new Map(modules.map((module) => [module.id, module]))

  // 1 — validate the composition itself before anything reads from it.
  const seenReferences = new Set<string>()
  const references = recipe.moduleReferences.filter((reference) => {
    if (seenReferences.has(reference.moduleVersionId)) {
      emitMessage(emitter, {
        id: `composition-duplicate-reference-${reference.moduleVersionId}`,
        severity: 'blocking',
        code: 'recipe_composition_invalid',
        message: `Recipe ${recipe.name} references module version ${reference.moduleVersionId} more than once.`,
        sourceType: 'recipe',
        sourceId: recipe.id,
      })
      return false
    }
    seenReferences.add(reference.moduleVersionId)
    return true
  })

  // 2 — every referenced module version has to exist.
  const resolvedReferences = references.flatMap((reference) => {
    const moduleVersion = moduleById.get(reference.moduleVersionId)
    if (!moduleVersion) {
      emitMessage(emitter, {
        id: `composition-missing-module-${reference.moduleVersionId}`,
        severity: 'blocking',
        code: 'recipe_composition_module_missing',
        message: `Module version ${reference.moduleVersionId} is referenced by ${recipe.name} but was not loaded.`,
        sourceType: 'recipe_module',
        sourceId: reference.moduleVersionId,
      })
      return []
    }
    return [{ reference, module: moduleVersion }]
  })

  // 3-5 — selection. Required modules are included whether or not the caller asked for
  // them, and an id the composition does not offer is rejected rather than honoured.
  const selected = new Set(selectedModuleVersionIds)
  for (const moduleVersionId of selected) {
    if (seenReferences.has(moduleVersionId)) continue
    emitMessage(emitter, {
      id: `composition-unknown-module-${moduleVersionId}`,
      severity: 'blocking',
      code: 'recipe_composition_unknown_module',
      message: `Module version ${moduleVersionId} is not part of the ${recipe.name} composition and cannot be selected.`,
      sourceType: 'recipe_module',
      sourceId: moduleVersionId,
    })
  }

  interface IncludedEntry {
    module: RecipeModuleVersion
    manifest: IncludedRecipeModule
    sequence: number
  }
  const included: IncludedEntry[] = []
  for (const { reference, module: moduleVersion } of resolvedReferences) {
    let selectionSource: ModuleSelectionSource | null = null
    if (reference.selectionBehavior === 'required') {
      selectionSource = 'required'
      if (!selected.has(moduleVersion.id)) {
        emitTrace(
          emitter,
          `${moduleLabel(moduleVersion)} is required by ${recipe.name} and was included regardless of the submitted selection.`,
          moduleVersion.id,
          null,
        )
      }
    } else if (selected.has(moduleVersion.id)) {
      selectionSource = reference.selectionBehavior === 'default_on' ? 'default' : 'user_selected'
    }
    // A module that was not selected leaves no trace on purpose. Naming it would put its
    // name and version inside the card's trace, and the trace is hashed — republishing an
    // unrelated module nobody chose would then move a card's identity.
    if (!selectionSource) continue
    included.push({
      module: moduleVersion,
      manifest: {
        moduleVersionId: moduleVersion.id,
        moduleCode: moduleVersion.code,
        moduleName: moduleVersion.name,
        moduleVersion: moduleVersion.version,
        kind: moduleVersion.kind,
        selectionBehavior: reference.selectionBehavior,
        selectionSource,
        governanceState: moduleVersion.governanceState,
        requirementCount: moduleVersion.slots.length,
      },
      // 6 — explicit sequence, module-version id as the stable tiebreak.
      sequence: reference.sequence,
    })
  }

  const orderedIncluded = included.sort(
    (left, right) =>
      left.sequence - right.sequence || left.module.id.localeCompare(right.module.id),
  )

  // 7-9 — clone module slots, then direct procedure slots, keying every requirement by its
  // reviewed `requirementKey` so a genuine duplicate is either merged or blocked.
  const slots: RecipeSlot[] = []
  const byRequirementKey = new Map<string, RecipeSlot>()

  const addSlot = (candidate: RecipeSlot, origin: string) => {
    const existing = byRequirementKey.get(candidate.requirementKey)
    if (!existing) {
      byRequirementKey.set(candidate.requirementKey, candidate)
      slots.push(candidate)
      emitTrace(
        emitter,
        `${candidate.label} was included by ${origin}.`,
        candidate.sourceModuleVersionIds?.[0] ?? null,
        candidate.id,
      )
      return
    }

    if (clinicalFingerprint(existing) !== clinicalFingerprint(candidate)) {
      const fields = differingClinicalFields(existing, candidate).join(', ')
      const message = `Requirement ${candidate.requirementKey} is defined differently by ${existing.includedBy.replace(/^Included by /, '')} and ${origin} (${fields}).`
      emitMessage(emitter, {
        id: `composition-conflict-${candidate.requirementKey}`,
        severity: 'blocking',
        code: 'recipe_composition_conflict',
        message,
        sourceType: 'recipe_module',
        sourceId: candidate.sourceModuleVersionIds?.[0] ?? null,
      })
      emitTrace(emitter, message, candidate.sourceModuleVersionIds?.[0] ?? null, existing.id)
      return
    }

    // Equivalent definitions collapse to one effective requirement that carries both
    // provenances, so a modifier or audit trail written against either source still lands.
    existing.sourceSlotAliases = union(
      union(existing.sourceSlotAliases, candidate.sourceSlotAliases),
      [candidate.sourceSlotId, candidate.id].filter(
        (value): value is string => typeof value === 'string' && value !== existing.id,
      ),
    )
    if (existing.sourceSlotAliases.length === 0) delete existing.sourceSlotAliases
    const mergedModules = union(existing.sourceModuleVersionIds, candidate.sourceModuleVersionIds)
    if (mergedModules.length > 0) existing.sourceModuleVersionIds = mergedModules
    existing.setupSequence = Math.min(existing.setupSequence, candidate.setupSequence)
    existing.includedBy = `${existing.includedBy} and ${origin}`
    emitTrace(
      emitter,
      `${candidate.label} is authored identically by ${origin}; it appears once and records both sources.`,
      candidate.sourceModuleVersionIds?.[0] ?? null,
      existing.id,
    )
  }

  for (const { module: moduleVersion, sequence } of orderedIncluded) {
    for (const slot of moduleVersion.slots) {
      addSlot(
        {
          ...cloneSlot(slot),
          // A module authors the order of its own requirements; the composition authors the
          // order of its modules. Banding them keeps a card grouped by where each line came
          // from, and keeps a shared module's internal order intact in every procedure that
          // uses it — a module slot's own sequence means nothing outside its band.
          setupSequence: sequence * MODULE_SEQUENCE_BAND + slot.setupSequence,
          sourceModuleVersionIds: [moduleVersion.id],
          includedBy: `Included by ${moduleLabel(moduleVersion)}`,
        },
        moduleLabel(moduleVersion),
      )
    }
  }

  const directOrigin = `base recipe ${recipe.name} ${recipe.version}`
  for (const slot of recipe.slots) {
    const direct = cloneSlot(slot)
    delete direct.sourceModuleVersionIds
    addSlot({ ...direct, includedBy: `Included by ${directOrigin}` }, directOrigin)
  }

  // 10 — explicit composition actions, in authored order.
  const actions = [...recipe.compositionActions].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  )
  for (const action of actions) {
    const affected = matchingSlots(slots, action)
    if (affected.length === 0) {
      emitMessage(emitter, {
        id: `composition-action-unmatched-${action.id}`,
        severity: 'warning',
        code: 'recipe_composition_action_unmatched',
        message: `Composition action ${action.id} on ${recipe.name} matched no requirement.`,
        sourceType: 'recipe',
        sourceId: recipe.id,
      })
      continue
    }

    switch (action.actionType) {
      case 'remove_slot': {
        const removedIds = new Set(affected.map((slot) => slot.id))
        for (const slot of affected) byRequirementKey.delete(slot.requirementKey)
        for (let index = slots.length - 1; index >= 0; index -= 1) {
          if (removedIds.has(slots[index].id)) slots.splice(index, 1)
        }
        break
      }
      case 'set_requiredness': {
        const payload = setRequirednessPayloadSchema.parse(action.payload)
        for (const slot of affected) {
          slot.requiredness = payload.value
          if (payload.dependencyRule !== undefined) slot.dependencyRule = payload.dependencyRule
        }
        break
      }
      case 'set_quantity': {
        const expression = quantityExpressionSchema.parse(action.payload.expression)
        for (const slot of affected) slot.quantityExpression = { ...expression }
        break
      }
      case 'set_setup_zone': {
        const value = payloadString(action, 'value') as SetupZone | null
        if (!value) break
        for (const slot of affected) slot.setupZone = value
        break
      }
      case 'set_procedural_phase': {
        const value = payloadString(action, 'value') as ProceduralPhase | null
        if (!value) break
        for (const slot of affected) slot.proceduralPhase = value
        break
      }
      case 'set_open_hold_status': {
        const value = payloadString(action, 'value') as OpenHoldStatus | null
        if (!value) break
        for (const slot of affected) slot.openHoldStatus = value
        break
      }
      case 'append_note': {
        const note = payloadString(action, 'note')
        if (!note) break
        for (const slot of affected) {
          slot.notes = [slot.notes, note].filter(Boolean).join(' ')
        }
        break
      }
      default: {
        const exhaustiveCheck: never = action.actionType
        return exhaustiveCheck
      }
    }

    for (const slot of affected) {
      slot.includedBy = `${slot.includedBy} · Modified by ${recipe.name} composition`
      emitTrace(
        emitter,
        `${recipe.name} composition applied ${action.actionType} to ${slot.label}.`,
        action.id,
        slot.id,
      )
    }
  }

  // A withdrawn module is not a style question: nothing on a card should be assembled from
  // one, and the card says so rather than quietly carrying it.
  for (const { manifest } of orderedIncluded) {
    if (manifest.governanceState !== 'retired') continue
    emitMessage(emitter, {
      id: `composition-retired-module-${manifest.moduleVersionId}`,
      severity: 'blocking',
      code: 'retired_module_selected',
      message: `${manifest.moduleName} v${manifest.moduleVersion} is retired and cannot be used to build a card.`,
      sourceType: 'recipe_module',
      sourceId: manifest.moduleVersionId,
    })
  }

  return {
    slots,
    includedModules: orderedIncluded.map(({ manifest }) => manifest),
    trace: emitter.trace,
    messages: emitter.messages,
  }
}

/**
 * The effective recipe a card starts from before any user choice: every required and
 * default-on module, expanded. Used by the administrative effective-preview and anywhere
 * the composed slot list is wanted without resolving a whole card.
 */
export function expandDefaultRecipeComposition(context: {
  recipe: RecipeVersion
  recipeModules: RecipeModuleVersion[]
}): ExpandedRecipeResult {
  return expandRecipeComposition({
    recipe: context.recipe,
    modules: context.recipeModules,
    selectedModuleVersionIds: defaultSelectedModuleVersionIds(context.recipe),
    startSequence: 1,
  })
}

/**
 * What the builder starts with: every required module plus every default-on module. The
 * builder then stores the resulting ids verbatim, so a later change to what is default-on
 * cannot reach back into a saved card.
 */
export function defaultSelectedModuleVersionIds(recipe: RecipeVersion): string[] {
  return [...recipe.moduleReferences]
    .filter((reference) => reference.selectionBehavior !== 'optional')
    .sort(
      (left, right) =>
        left.sequence - right.sequence || left.moduleVersionId.localeCompare(right.moduleVersionId),
    )
    .map((reference) => reference.moduleVersionId)
}

export function requiredModuleVersionIds(recipe: RecipeVersion): string[] {
  return recipe.moduleReferences
    .filter((reference) => reference.selectionBehavior === 'required')
    .map((reference) => reference.moduleVersionId)
}

const governanceRank: Record<string, number> = {
  retired: 0,
  draft: 1,
  in_review: 2,
  approved: 3,
}

/**
 * The composed output is never represented as stronger than its weakest component: one
 * draft module keeps the whole card draft, and a retired module drags it to retired.
 */
export function effectiveGovernanceState(
  recipeState: RecipeVersion['governanceState'],
  includedModules: IncludedRecipeModule[],
): RecipeVersion['governanceState'] {
  return [recipeState, ...includedModules.map((module) => module.governanceState)].reduce(
    (weakest, candidate) =>
      governanceRank[candidate] < governanceRank[weakest] ? candidate : weakest,
    recipeState,
  )
}
