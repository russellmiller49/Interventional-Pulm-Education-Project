import { resolvedContentHash, snapshotIntegrityHash } from './card-hashes'
import { evaluateCompatibilityRules } from './evaluate-compatibility'
import { addMessage, expandEffectiveSlots, trace } from './effective-slots'
import type { EffectiveSlotState } from './effective-slots'
import { effectiveGovernanceState } from './expand-recipe-composition'
import { suppressKitDuplicates } from './kit-suppression'
import { evaluateQuantityExpression } from './quantity-expression'
import { buildCardInputSchema } from './schemas'
import { familyKeyFromPickId, isUnqualifiedLegacyFamilyPickId } from './size-at-procedure'
import { stableSnapshotHash } from './stable-hash'
import type {
  BuildCardInput,
  BuildContext,
  ConditionalState,
  HospitalItem,
  IncludedRecipeModule,
  ReadinessState,
  RecipeSlot,
  ResolvedCard,
  ResolvedCardItem,
  RuleMessage,
  VerificationState,
} from './types'

/**
 * 0.3.0 — hash separation and resolution provenance. The hashable domain output gained
 * `scope`, `resolutionProvenance`, `snapshotIntegrityHash`, and `resolvedContentHash`, so
 * snapshots written by 0.2.0 hash differently by construction and the version records why.
 *
 * 0.2.0 — composition. The output gained `includedModules` and every item gained its
 * requirement key and source modules.
 *
 * Stamped onto every resolved card and inside its content hash, so it describes the *output
 * shape* a snapshot was written in. That is a narrower thing than the resolver contract below:
 * the shape of the record changed here, and what resolution *means* did not.
 */
export const PREFERENCE_CARD_ENGINE_VERSION = 'ip-cards-resolver/0.3.0'

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

function cloneHospitalItem(item: HospitalItem): HospitalItem {
  return {
    ...item,
    attributes: { ...item.attributes },
    kitComponents: item.kitComponents.map((component) => ({ ...component })),
    catalogProduct: item.catalogProduct ? { ...item.catalogProduct } : null,
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
  state: EffectiveSlotState,
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
              // Only the *unqualified* legacy form widens the match: `family:{key}` predates role
              // scoping and has to find the role-scoped option the rebuilt context now produces.
              // A `family-role:` id already names its role, and matching it on key alone would let
              // a selection for one requirement satisfy a different one.
              (isUnqualifiedLegacyFamilyPickId(selectedItemOverride) &&
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

type UnhashedCard = Omit<
  ResolvedCard,
  'snapshotHash' | 'snapshotIntegrityHash' | 'resolvedContentHash'
>

/**
 * The *storage identity* payload — deliberately unchanged in construction.
 *
 * This is what the `snapshot_hash` column has always held: a digest of card content that stays put
 * when the same card is re-saved, so re-saving is a no-op and a share link keeps verifying. It
 * excludes `generatedAt` for that reason, which also means it never detected an edited timestamp —
 * the job `snapshotIntegrityHash` now does, over the complete stored snapshot.
 *
 * It is *not* the semantic comparison either; `resolvedContentHash` is. Three hashes because there
 * were three questions, and the single hash could only answer one of them well.
 */
function snapshotPayload(card: UnhashedCard) {
  const waivers = card.warnings
    .filter((warning) => warning.waiverReason)
    .map((warning) => ({
      id: warning.id,
      waiverReason: warning.waiverReason,
    }))
  const hashableCard: Omit<UnhashedCard, 'generatedAt'> & {
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

  // Steps 1 to 4 of the resolution order — composition, then every modifier action in authored
  // order, then rescue modules — now live in `effective-slots.ts` so the rebuild planner can ask
  // exactly this question and get exactly this answer. Everything below sees one flat effective
  // recipe and does not know composition or modifiers exist.
  const state = expandEffectiveSlots(input, context)
  // The deduplicated codes the modifier phase actually applied, and the modules the composition
  // included. Both are read below by compatibility evaluation and by the card's own manifest.
  const selectedModifierCodes = [...new Set(input.modifierCodes)]

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

  const includedModules: IncludedRecipeModule[] = state.includedModules
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
  const cardWithoutHash: UnhashedCard = {
    recipeVersionId: context.recipe.id,
    recipeName: context.recipe.name,
    recipeVersion: context.recipe.version,
    sourceProcedureCode: context.recipe.sourceProcedureCode,
    organizationName: context.organizationName,
    siteName: context.siteName,
    locationName: context.locationName,
    scope: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      locationId: input.locationId,
    },
    // Taken from the context, never from the input: a client that could name its own release
    // would be writing provenance for a resolution it did not perform.
    resolutionProvenance: {
      releaseBundleId: context.releaseIdentity?.releaseBundleId ?? null,
      releaseDefinitionHash: context.releaseIdentity?.releaseDefinitionHash ?? null,
      catalogReleaseId: context.releaseIdentity?.catalogReleaseId ?? null,
      resolverContractVersion: PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION,
    },
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
  // Ordered so each hash can cover the ones computed before it. Storage identity and semantic
  // content are independent projections of the same card; integrity then covers the whole stored
  // snapshot *including* both of them, so neither can be edited to agree with a doctored payload.
  const snapshotHash = stableSnapshotHash(snapshotPayload(cardWithoutHash))
  const withContentHashes = {
    ...cardWithoutHash,
    snapshotHash,
    resolvedContentHash: resolvedContentHash(cardWithoutHash),
  }
  return {
    ...withContentHashes,
    snapshotIntegrityHash: snapshotIntegrityHash(withContentHashes),
  }
}
