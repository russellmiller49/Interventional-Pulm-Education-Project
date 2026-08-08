import { REQUIREMENT_COMPARED_FIELDS } from './release-bundle'
import { isCatalogPickItemId, productIdFromCatalogPickItemId } from './catalog-pick'
import { customIdFromItemId, isCustomItemId } from './custom-item'
import { equipmentSetIdFromItemId, isEquipmentSetItemId } from './equipment-set'
import { canonicalRoleCode } from './role-taxonomy'
import { familyPickId } from './size-at-procedure'
import { stableSnapshotHash, stableStringify } from './stable-hash'
import type { PreferenceCardReleaseBundle } from './release-bundle'
import type { UnhashedResolvedCard } from './card-hashes'
import type {
  ConditionalState,
  RecipeSlot,
  ResolvedCard,
  ResolvedCardItem,
  RuleMessage,
} from './types'
import type {
  BuilderInputs,
  EquipmentSetRef,
  ReleasePinnedBuilderInputs,
  ReviewedFamilyPickRef,
} from '../schemas/saved-card'

/**
 * Planning a rebuild: what one saved revision's selections mean under a different release.
 *
 * This is the deterministic half of Phase 4B.2. It reads an immutable source revision and an
 * explicitly-named target release and produces a *plan* — one structured decision per thing that
 * has to be decided — and the builder inputs that plan would produce. It decides nothing on the
 * physician's behalf beyond carrying forward what is provably the same, and it writes nothing.
 *
 * ## Why the requirement key is the only join
 *
 * A card's selections are addressed by **composed slot id**: `selectedHospitalItemIds` and
 * `conditionalStates` are keyed by it, and a waiver is keyed by a warning id built out of it. A
 * slot id is authored inside a module version. Republish the module, move the requirement into a
 * shared core, rename the slot — and every one of those keys stops matching, while the requirement
 * the physician chose for is unchanged. So a rebuild that carried selections by slot id would drop
 * exactly the selections a release move is most likely to touch.
 *
 * `requirementKey` is the module's reviewed semantic identity: two slots are the same requirement
 * only when a reviewed mapping file says so. It is therefore the only join here. Role code is never
 * sufficient — the same role legitimately appears more than once on a card — and label resemblance
 * is not a comparison at all. `card-reconciliation.ts` already matches on nothing else, and this
 * matches on nothing else for the same reason.
 *
 * ## Why selections are read from the snapshot and definitions from the composition
 *
 * Two sources, because they answer two different questions and neither can answer both.
 *
 * *What was chosen* comes from the revision's stored snapshot. That is what the physician saw
 * resolved, including the lines a modifier or a rescue module added and the ones a kit suppressed,
 * and including the requirements an older card left to the formulary's ranking rather than
 * recording. Reading the raw input map instead would carry a sparse record forward and let today's
 * ranking fill the gaps — the implicit behaviour `hospital-selection.ts` exists to remove.
 *
 * *What the requirement is* comes from the expanded composition on both sides, because a resolved
 * item does not carry `allowCustom`, `selectionMode`, `responsibleRole`, `sterileStatus`, or the
 * unformatted quantity expression, and four of those five decide whether a selection is still
 * allowed.
 *
 * ## What this does not do
 *
 * No fuzzy matching, no role-code fallback, no label similarity, no automatic waiver transfer, no
 * in-place upgrade of the source, no recommendation from patient characteristics, and no choosing
 * on behalf of the physician when a definition moved. A changed requirement produces a *suggestion*
 * that is not resolved until somebody confirms it — which is a different thing from a default, and
 * the difference is the whole point of the phase.
 */

/** Bumped when the *meaning* of a plan changes. Carried inside the plan hash. */
export const CARD_REBUILD_PLAN_VERSION = 'ip-cards-rebuild-plan/1'

/**
 * What happened to one decision.
 *
 * One vocabulary across every kind of decision rather than one per kind. For a requirement the
 * names read literally. For a module, a modifier, or a waiver, `new_requirement` means "the target
 * introduces this and the source revision had no counterpart" and `removed_requirement` means "the
 * source had it and the target does not offer it" — the same two facts, about a different thing.
 * Two vocabularies would have to be kept in step by hand, and the review gate reads all of them.
 */
export type RebuildDecisionState =
  | 'carried_unchanged'
  | 'carried_requires_review'
  | 'not_carried'
  | 'new_requirement'
  | 'removed_requirement'
  | 'unresolved'
  | 'incompatible'

export type RebuildDecisionKind = 'requirement' | 'module' | 'modifier' | 'waiver'

/**
 * Why a decision came out the way it did — a closed vocabulary, so a reader and a test can both
 * enumerate it. Prose belongs in the view; a reason code is what the plan hash covers.
 */
export type RebuildReasonCode =
  // Requirement identity and definition
  | 'requirement_unchanged'
  | 'requirement_definition_changed'
  | 'requirement_added_by_target'
  | 'requirement_removed_by_target'
  | 'requirement_key_absent_from_snapshot'
  | 'requirement_key_ambiguous'
  | 'provenance_only_module_move'
  // What was selected
  | 'selection_absent_in_source'
  | 'selection_deliberately_empty'
  | 'hospital_item_not_offered'
  | 'catalog_product_unavailable'
  | 'catalog_product_role_ineligible'
  | 'family_version_unavailable'
  | 'family_version_changed'
  | 'family_catalog_release_mismatch'
  | 'family_identity_not_reviewed'
  | 'family_role_not_covered'
  | 'custom_item_requires_review'
  | 'custom_not_allowed_by_target'
  | 'equipment_set_member_unavailable'
  | 'equipment_set_role_not_covered'
  | 'conditional_rule_changed'
  | 'compatibility_rejected'
  | 'resolution_unresolved'
  | 'room_capability_missing'
  | 'target_presence_changed'
  // Modules and modifiers
  | 'module_unchanged'
  | 'module_version_changed'
  | 'module_behavior_changed'
  | 'module_not_offered'
  | 'module_newly_offered_on_by_default'
  | 'module_required_by_target'
  | 'modifier_unchanged'
  | 'modifier_definition_changed'
  | 'modifier_not_offered'
  // Waivers
  | 'waiver_never_carries'
  | 'waiver_warning_absent_from_target'

/** Which channel a selection was recorded through. Derived from the hospital-item id namespace. */
export type RebuildSelectionKind =
  | 'none'
  | 'hospital_item'
  | 'catalog_product'
  | 'reviewed_family'
  | 'custom_item'
  | 'equipment_set'
  | 'unknown'

export type RebuildSelection =
  | { kind: 'none' }
  | { kind: 'hospital_item'; hospitalItemId: string }
  | { kind: 'catalog_product'; hospitalItemId: string; productId: string; roleCode: string }
  | {
      kind: 'reviewed_family'
      hospitalItemId: string
      productFamilyVersionId: string
      catalogReleaseId: string
      definitionHash: string
      roleCode: string
    }
  | { kind: 'custom_item'; hospitalItemId: string; customItemId: string; roleCode: string }
  | {
      kind: 'equipment_set'
      hospitalItemId: string
      setId: string
      selectedRoleCode: string
      coveredRoles: string[]
    }
  /** A namespaced id whose backing record is not in the revision's inputs. Never carried. */
  | { kind: 'unknown'; hospitalItemId: string }

export interface RebuildDecisionBase {
  /** Stable within a plan and across replans of the same inputs. What an acknowledgement names. */
  key: string
  kind: RebuildDecisionKind
  state: RebuildDecisionState
  /** Sorted, so two runs over the same facts produce the same bytes. */
  reasonCodes: RebuildReasonCode[]
  /**
   * Whether the physician has to say something about this before the new card may be created.
   *
   * Distinct from `blocking`: a suggestion carried from a requirement whose definition moved is
   * usable as it stands and still may not be accepted silently, while an unresolved required
   * requirement is not usable at all. Both stop a save; they stop it for different reasons and the
   * review says which.
   */
  requiresExplicitConfirmation: boolean
  /** Whether the plan cannot produce a usable card until this is dealt with. */
  blocking: boolean
}

export interface RebuildRequirementDecision extends RebuildDecisionBase {
  kind: 'requirement'
  requirementKey: string
  source: {
    slotId: string
    roleCode: string
    label: string
    presence: 'active' | 'suppressed'
    selection: RebuildSelection
    conditionalState: ConditionalState | null
  } | null
  target: {
    slotId: string
    roleCode: string
    label: string
    requiredness: RecipeSlot['requiredness']
    allowCustom: boolean
    dependencyRule: string | null
  } | null
  /** Which of the fifteen compared requirement fields moved. Empty when the definition held. */
  changedDefinitionFields: string[]
  /** What the plan proposes to write for this requirement. Null when nothing is carried. */
  carriedSelection: RebuildSelection | null
  carriedConditionalState: ConditionalState | null
}

export interface RebuildModuleDecision extends RebuildDecisionBase {
  kind: 'module'
  moduleCode: string
  source: { moduleVersionId: string; moduleVersion: string; selected: boolean } | null
  target: {
    moduleVersionId: string
    moduleVersion: string
    selectionBehavior: 'required' | 'default_on' | 'optional'
    definitionHashChanged: boolean
  } | null
  /** Whether the plan proposes to include this module in the new card's composition. */
  carriedSelected: boolean
}

export interface RebuildModifierDecision extends RebuildDecisionBase {
  kind: 'modifier'
  modifierCode: string
  source: { selected: boolean } | null
  target: { offered: boolean; definitionHashChanged: boolean } | null
  carriedSelected: boolean
}

/**
 * One waiver the source revision carried, and the target warning it would have to be entered
 * against.
 *
 * A waiver is never carried, so `carriedRationale` does not exist and the decision is always
 * `not_carried`. What the plan supplies is the prior rationale for reference and the *target*
 * warning identity a new waiver would be keyed to — which is a different id, because a warning id
 * is built from the composed slot id.
 */
export interface RebuildWaiverDecision extends RebuildDecisionBase {
  kind: 'waiver'
  /** The stable triple a warning is identified by, rather than its positional id. */
  warningCode: string
  warningSourceType: string
  warningSourceId: string | null
  requirementKey: string | null
  priorRationale: string
  /** The warning id on the target card a new waiver must be written against. Null when absent. */
  targetWarningId: string | null
}

export type RebuildDecision =
  | RebuildRequirementDecision
  | RebuildModuleDecision
  | RebuildModifierDecision
  | RebuildWaiverDecision

/**
 * What the target release actually resolves the proposed inputs to.
 *
 * The plan used to stop at "this selection is still allowed", which is a statement about identity
 * and availability and says nothing about what the *card* does with it. A target release can keep
 * the requirement, keep the product, and still activate a compatibility rule that rejects the pair,
 * or lack a room capability a carried modifier requires, or suppress the line behind a kit. Those
 * are exactly the changes a physician needs to see, and the plan reported none of them: it said
 * `carried_unchanged`, required no answer, and the card was inserted blocked.
 *
 * So the proposed inputs are resolved through the canonical resolver during planning, projected to
 * stable codes, and hashed with the rest of the plan. Structured, never prose: this is compared and
 * hashed, and prose is localized.
 */
export interface RebuildTargetResolutionItem {
  requirementKey: string
  slotId: string
  roleCode: string
  presence: 'active' | 'suppressed'
  selectedHospitalItemId: string | null
  resolutionState: string
  compatibilityState: string
}

export interface RebuildTargetResolution {
  ok: boolean
  readinessState: string | null
  items: RebuildTargetResolutionItem[]
  /** Blocking and warning codes with their stable source identity, sorted. */
  warnings: Array<{ code: string; severity: string; sourceType: string; sourceId: string | null }>
}

/**
 * One structured difference between two projections of the same target world.
 *
 * Codes and identifiers only. This is hashed into the plan, compared byte-for-byte before the
 * write, and shown to a physician through translated labels, so anything localized or cosmetic in
 * here would make an identical card look changed.
 */
export interface RebuildProjectionFieldChange {
  requirementKey: string
  field:
    | 'presence'
    | 'slotId'
    | 'roleCode'
    | 'selectedHospitalItemId'
    | 'resolutionState'
    | 'compatibilityState'
  from: string | null
  to: string | null
}

/** Warnings are compared as a multiset of `code|severity|sourceType|sourceId` signatures. */
export interface RebuildProjectionDelta {
  /** The compared card does not resolve at all. Every other field is empty when this is true. */
  notResolvable: boolean
  addedRequirements: string[]
  removedRequirements: string[]
  changes: RebuildProjectionFieldChange[]
  addedWarnings: string[]
  removedWarnings: string[]
  readiness: { from: string | null; to: string | null } | null
}

/**
 * What one answer to one decision is permitted to change, and nothing else.
 *
 * The previous gate treated a single legitimate drop as a global causal explanation: one
 * `anyDropped` flag switched off the resolution, readiness, presence-lift, compatibility-relaxation
 * and nonblocking-warning comparisons for *every* requirement on the card. An independent probe
 * supplied one valid drop plus an unrelated suppression lift, an unrelated resolved-to-unresolved
 * move, an unrelated compatibility relaxation, a readiness change and a new warning, and the gate
 * returned no violations at all.
 *
 * An answer is not an explanation for arbitrary drift. So each answer's permitted effect is
 * measured, at review time, by actually resolving the counterfactual — the reviewed inputs with
 * that one answer applied and nothing else — through the same canonical resolver in the same
 * reviewed target world, and diffing it against the reviewed baseline. That exact delta is the
 * contract. If dropping `B` genuinely lifts a kit suppression on `C`, that precise `C` change is in
 * `B`'s contract and is authorized; every other `C` change is not.
 */
export interface RebuildAllowedOutcome {
  decisionKey: string
  answer: RebuildAcknowledgement
  delta: RebuildProjectionDelta
}

export interface CardRebuildPlan {
  version: typeof CARD_REBUILD_PLAN_VERSION
  source: {
    cardId: string
    revisionId: string
    revisionNumber: number
    schemaVersion: number
    releaseBundleId: string
    releaseDefinitionHash: string
    catalogReleaseId: string | null
    snapshotHash: string
    snapshotIntegrityHash: string | null
    resolvedContentHash: string | null
  }
  target: {
    releaseBundleId: string
    releaseDefinitionHash: string
    catalogReleaseId: string
    scenarioId: string
    recipeVersionId: string
    sourceProcedureCode: string
  }
  /**
   * The two read-only comparisons this review was taken against, by hash.
   *
   * Inside the hashed plan because they are written into the new card's provenance as *what was
   * compared*, and a provenance field outside the plan hash can move between the page rendering and
   * the form posting — recording a comparison nobody was shown. The operational half in particular
   * reads current hospital-local data, which is exactly the thing that changes underneath a card.
   */
  comparisons: {
    operationalHash: string
    releaseDiffHash: string
  }
  /**
   * The final resolution of `proposedInputs` under the target release, projected and hashed.
   *
   * Inside the plan because the review is only honest if it describes the card that will exist, and
   * because `createRebuiltCard` re-resolves immediately before writing and refuses when this no
   * longer matches — a card whose final state was never reviewed is not inserted.
   */
  targetResolution: RebuildTargetResolution
  /**
   * One entry per (decision, allowed answer), sorted by key then answer.
   *
   * Inside the hashed plan because it *is* the review: the physician is shown these consequences,
   * and the write is authorized against exactly these deltas. A contract computed after the answers
   * arrived would be the server explaining the card to itself.
   */
  allowedOutcomes: RebuildAllowedOutcome[]
  /** Sorted by key. Every decision the review gate reads, in one list. */
  decisions: RebuildDecision[]
  /**
   * The builder inputs this plan would create the new card from, before any review.
   *
   * Inside the hashed plan on purpose: the hash is meant to answer "is this the plan the server
   * computed", and a hash that covered the decisions but not their result would leave the one
   * thing that gets written outside it.
   */
  proposedInputs: BuilderInputs
  /** Whether the plan, as it stands, could produce a card at all. */
  blockingCount: number
  reviewCount: number
}

/**
 * Availability questions the plan cannot answer from domain data alone.
 *
 * Everything here is a lookup into retained catalog data or current hospital-local data, which the
 * server owns. Keeping them behind an interface is what makes the planner a pure function of its
 * inputs: the same probe answers give the same plan and the same hash, and a test can supply the
 * answers directly rather than standing up a catalog.
 */
export interface RebuildProbe {
  /** Whether current hospital-local data still offers this item for this role. */
  hospitalItemOffered(hospitalItemId: string, roleCode: string): boolean
  /** Whether the target's pinned catalog release still maps this product to this role. */
  catalogProductAvailable(productId: string, roleCode: string): boolean
  /**
   * Whether the reviewed family pin still resolves against the *target* release's catalog.
   *
   * `definitionHashChanged` is the reviewed membership having moved since the pick was made, which
   * is a review, not a failure. `ok: false` is the pin no longer resolving at all.
   *
   * The current `definitionHash` and `catalogReleaseId` come back because a carried pin has to be
   * re-pinned to them. A pin is verified by exact hash on every reconstruction, so writing the
   * source's hash onto a card resolved through a different catalog release would produce a card
   * that refuses to reopen the moment it is saved — the physician would have confirmed a change
   * and been handed a card that denies the change happened.
   */
  /**
   * Resolve the proposed inputs through the canonical resolver, under the target release.
   *
   * Null when they will not resolve at all. Supplied by the server rather than imported so the
   * planner stays pure: same inputs and same probe answers, same plan, same hash.
   */
  resolveTarget(inputs: BuilderInputs): UnhashedResolvedCard | null
  /**
   * Whether every member of a stored equipment set still resolves against the target catalogue.
   *
   * A set is atomic. Checking only its covered roles let a set whose members had gone missing be
   * recorded as carried unchanged, and the failure surfaced afterwards as a generic
   * `not_resolvable` — after the physician had answered the whole review.
   */
  equipmentSetMembersAvailable(setId: string): boolean
  reviewedFamilyAvailable(ref: ReviewedFamilyPickRef):
    | {
        ok: true
        definitionHashChanged: boolean
        definitionHash: string
        catalogReleaseId: string
      }
    | { ok: false; reason: RebuildReasonCode }
}

export interface RebuildPlanInput {
  source: {
    cardId: string
    revisionId: string
    revisionNumber: number
    inputs: ReleasePinnedBuilderInputs
    /** The revision's own immutable snapshot. What the physician reviewed. */
    card: ResolvedCard
    /** The source release's composition, expanded under the revision's own module selection. */
    slots: RecipeSlot[]
    releaseBundle: PreferenceCardReleaseBundle
    /** Definition hash per modifier code the source release offered. */
    modifierDefinitionHashes: Record<string, string>
  }
  target: {
    /** The target composition, expanded under the module selection this plan proposes. */
    slots: RecipeSlot[]
    releaseBundle: PreferenceCardReleaseBundle
    /** Every module the target recipe offers, with the behaviour it offers them at. */
    offeredModules: Array<{
      moduleVersionId: string
      moduleCode: string
      moduleVersion: string
      selectionBehavior: 'required' | 'default_on' | 'optional'
      definitionHash: string
    }>
    allowedModifierCodes: string[]
    /**
     * Definition hash per offered modifier code.
     *
     * Per code rather than per set, because a release pins the modifier set with a single hash and
     * that hash says nothing about which modifier moved. Attributing a set change to every carried
     * modifier would make one edited modifier put every other one on the review list; attributing
     * it to none would carry a changed modifier silently. So the caller hashes each definition and
     * the comparison is exact.
     */
    modifierDefinitionHashes: Record<string, string>
  }
  /**
   * Which modules and modifiers the plan is being computed for.
   *
   * A plan depends on its composition: turn a module off and the requirement list changes. So the
   * decisions the physician can move are an *input*, defaulted by `proposeRebuildDecisions` and
   * re-planned by the server when one changes — rather than a mutable overlay applied afterwards,
   * which would leave the plan and the plan hash describing different cards.
   */
  selection: {
    moduleVersionIds: string[]
    modifierCodes: string[]
  }
  /** Hashes of the operational and authored-release comparisons the caller computed. */
  comparisons: {
    operationalHash: string
    releaseDiffHash: string
  }
  probe: RebuildProbe
}

/**
 * Which modules a composed slot came from, named by code.
 *
 * A version id names one publication of a module; a code names the module. Provenance questions are
 * about the second, so this is where the translation happens. A version id the release does not pin
 * falls through as itself, which cannot silently match a code on the other side.
 */
function moduleCodesOf(slot: RecipeSlot, codeByVersionId: Map<string, string>): string[] {
  return [
    ...new Set((slot.sourceModuleVersionIds ?? []).map((id) => codeByVersionId.get(id) ?? id)),
  ].sort()
}

/** Module code per pinned module version id. */
function moduleCodesByVersionId(bundle: PreferenceCardReleaseBundle): Map<string, string> {
  return new Map(bundle.modulePins.map((pin) => [pin.moduleVersionId, pin.moduleCode]))
}

/** Definition hash per module code, from a release's pins. */
function moduleHashesByCode(bundle: PreferenceCardReleaseBundle): Map<string, string> {
  return new Map(bundle.modulePins.map((pin) => [pin.moduleCode, pin.definitionHash]))
}

function moduleVersionsByCode(
  bundle: PreferenceCardReleaseBundle,
): Map<string, { moduleVersionId: string; moduleVersion: string }> {
  return new Map(
    bundle.modulePins.map((pin) => [
      pin.moduleCode,
      { moduleVersionId: pin.moduleVersionId, moduleVersion: pin.moduleVersion },
    ]),
  )
}

/**
 * What a resolved line was actually asking for, expressed as a stable identity.
 *
 * The item id namespaces are the discriminator — `catalog:`, `custom:`, `set:`, `family-version:`
 * — and each namespace is looked back up in the revision's own inputs, because the id alone does
 * not carry the four fields a reviewed family pin is verified by or the members a set is made of.
 * An id whose backing record is missing from the inputs is `unknown` rather than guessed at.
 */
function readSelection(
  item: Pick<ResolvedCardItem, 'selectedHospitalItemId' | 'roleCode'>,
  inputs: ReleasePinnedBuilderInputs,
): RebuildSelection {
  const hospitalItemId = item.selectedHospitalItemId
  if (!hospitalItemId) return { kind: 'none' }

  if (isCatalogPickItemId(hospitalItemId)) {
    const productId = productIdFromCatalogPickItemId(hospitalItemId)
    const pick = inputs.catalogPicks.find(
      (candidate) =>
        candidate.productId === productId &&
        canonicalRoleCode(candidate.roleCode) === canonicalRoleCode(item.roleCode),
    )
    if (!productId || !pick) return { kind: 'unknown', hospitalItemId }
    return {
      kind: 'catalog_product',
      hospitalItemId,
      productId,
      roleCode: canonicalRoleCode(pick.roleCode),
    }
  }

  if (isCustomItemId(hospitalItemId)) {
    const customId = customIdFromItemId(hospitalItemId)
    const custom = inputs.customItems.find((candidate) => candidate.id === customId)
    if (!customId || !custom) return { kind: 'unknown', hospitalItemId }
    return {
      kind: 'custom_item',
      hospitalItemId,
      customItemId: customId,
      roleCode: canonicalRoleCode(custom.roleCode),
    }
  }

  if (isEquipmentSetItemId(hospitalItemId)) {
    const setId = equipmentSetIdFromItemId(hospitalItemId)
    const set = setId ? inputs.equipmentSets.find((candidate) => candidate.id === setId) : undefined
    if (!setId || !set) return { kind: 'unknown', hospitalItemId }
    return {
      kind: 'equipment_set',
      hospitalItemId,
      setId,
      selectedRoleCode: canonicalRoleCode(set.selectedRoleCode),
      coveredRoles: storedSetCoveredRoles(set),
    }
  }

  // A reviewed family pick's hospital-item id is either `family-version:<id>` or, when one family
  // was picked for two roles, `family-version-role:<role>:<id>`. Both are reconstructed by matching
  // the pin's own id rather than by parsing the string, so the two shapes need no separate branch.
  const familyPick = inputs.familyPicks.find((candidate) => {
    if (!('productFamilyVersionId' in candidate)) return false
    return (
      familyPickId(candidate.productFamilyVersionId) === hospitalItemId ||
      familyPickId(candidate.productFamilyVersionId, candidate.roleCode) === hospitalItemId
    )
  })
  if (familyPick && 'productFamilyVersionId' in familyPick) {
    return {
      kind: 'reviewed_family',
      hospitalItemId,
      productFamilyVersionId: familyPick.productFamilyVersionId,
      catalogReleaseId: familyPick.catalogReleaseId,
      definitionHash: familyPick.definitionHash,
      roleCode: canonicalRoleCode(familyPick.roleCode),
    }
  }

  // Anything left is a seeded hospital-local item: no namespace, no backing record in the inputs,
  // and its identity is the id itself.
  return { kind: 'hospital_item', hospitalItemId }
}

/**
 * Every role a stored set satisfies: its members' roles plus the ones it covers without
 * contributing a product.
 *
 * The same rule `equipmentSetCoveredRoles` applies to a rebuilt set, over the *stored* shape —
 * which carries role codes and nothing else, so it cannot be handed to that function without
 * inventing the catalog fields a rebuilt member has. Role aliases are permanent, so both sides are
 * canonicalized or a pre-rename set would stop covering the requirement it was chosen for.
 */
function storedSetCoveredRoles(set: EquipmentSetRef): string[] {
  const roles = new Set<string>()
  for (const member of set.members) roles.add(canonicalRoleCode(member.roleCode))
  for (const role of set.additionalCoveredRoles) roles.add(canonicalRoleCode(role))
  return [...roles].sort()
}

/** Every requirement the source revision resolved, keyed by its reviewed identity. */
function sourceRequirementIndex(card: UnhashedResolvedCard) {
  const index = new Map<string, { item: ResolvedCardItem; presence: 'active' | 'suppressed' }>()
  for (const item of card.items) {
    if (item.requirementKey) index.set(item.requirementKey, { item, presence: 'active' })
  }
  for (const item of card.suppressedItems) {
    if (item.requirementKey) index.set(item.requirementKey, { item, presence: 'suppressed' })
  }
  return index
}

/**
 * Requirements by reviewed identity, and every key that more than one slot claims.
 *
 * `expandRecipeComposition` collapses or blocks a duplicated `requirementKey`, so on the composition
 * path the ambiguous set is always empty. A modifier-added or rescue-module slot does not pass
 * through that merge — both deduplicate by slot **id** — so a second slot claiming an existing key
 * reaches the card intact, and that is the route this exists for.
 *
 * **Any** duplicate is ambiguous, including one whose compared fields are identical. An earlier
 * version exempted those on the grounds that two identical expressions are one requirement said
 * twice, which is true of the *definition* and false of the *card*: the resolver emits both slots,
 * so collapsing them here would have meant one decision, one re-keyed selection, and a second
 * permanently empty line nobody reviewed. Collapsing only in the planner while the resolver emits
 * two is precisely the divergence this phase exists to remove.
 */
function slotIndex(slots: RecipeSlot[]): {
  byKey: Map<string, RecipeSlot>
  ambiguous: Set<string>
} {
  const byKey = new Map<string, RecipeSlot>()
  const ambiguous = new Set<string>()
  for (const slot of slots) {
    const existing = byKey.get(slot.requirementKey)
    if (!existing) {
      byKey.set(slot.requirementKey, slot)
      continue
    }
    // The same slot listed twice is not a duplicate requirement; two slot ids are.
    if (existing.id !== slot.id) ambiguous.add(slot.requirementKey)
  }
  return { byKey, ambiguous }
}

/**
 * Which of the fifteen compared requirement fields differ between two composed slots.
 *
 * The field list is imported from `release-bundle.ts` rather than restated. That list is already
 * this module's answer to "what makes two requirements different", used by the release diff a
 * reviewer reads before publishing; a second list here would drift, and the drift would show up as
 * a rebuild that carried a selection the release diff had reported as changed.
 */
function changedDefinitionFields(before: RecipeSlot, after: RecipeSlot): string[] {
  return REQUIREMENT_COMPARED_FIELDS.filter(
    (field) => stableStringify(before[field]) !== stableStringify(after[field]),
  )
}

interface SelectionVerdict {
  carried: RebuildSelection | null
  reasons: RebuildReasonCode[]
  /** True when the selection is unusable under the target rather than merely changed. */
  lost: boolean
}

/**
 * Whether one selection may cross to the target requirement, and on what terms.
 *
 * Every branch carries by *exact stable identity* and by nothing else. There is no substitution
 * anywhere in here: a product the target release prefers instead is not this card's product, and
 * silently swapping one for the other is the failure the whole module is built to avoid.
 */
function carrySelection(
  selection: RebuildSelection,
  target: RecipeSlot,
  probe: RebuildProbe,
): SelectionVerdict {
  const targetRole = canonicalRoleCode(target.roleCode)

  switch (selection.kind) {
    case 'none':
      // A deliberate blank is a decision, and it survives as one. It is not the same as a
      // requirement nobody has looked at, and flattening the two would lose the difference.
      return { carried: { kind: 'none' }, reasons: ['selection_deliberately_empty'], lost: false }

    case 'hospital_item':
      if (!probe.hospitalItemOffered(selection.hospitalItemId, targetRole)) {
        return { carried: null, reasons: ['hospital_item_not_offered'], lost: true }
      }
      return { carried: selection, reasons: [], lost: false }

    case 'catalog_product': {
      if (selection.roleCode !== targetRole) {
        return { carried: null, reasons: ['catalog_product_role_ineligible'], lost: true }
      }
      if (!probe.catalogProductAvailable(selection.productId, targetRole)) {
        return { carried: null, reasons: ['catalog_product_unavailable'], lost: true }
      }
      return { carried: selection, reasons: [], lost: false }
    }

    case 'reviewed_family': {
      if (selection.roleCode !== targetRole) {
        return { carried: null, reasons: ['catalog_product_role_ineligible'], lost: true }
      }
      const available = probe.reviewedFamilyAvailable({
        productFamilyVersionId: selection.productFamilyVersionId,
        catalogReleaseId: selection.catalogReleaseId,
        definitionHash: selection.definitionHash,
        roleCode: selection.roleCode,
      })
      if (!available.ok) return { carried: null, reasons: [available.reason], lost: true }
      // A moved membership is still the same reviewed line, so it is offered as a suggestion
      // rather than dropped — and it is never accepted without somebody saying so, because the set
      // of products the line stands for is not the set that was reviewed.
      return {
        carried: {
          ...selection,
          definitionHash: available.definitionHash,
          catalogReleaseId: available.catalogReleaseId,
        },
        reasons: available.definitionHashChanged ? ['family_version_changed'] : [],
        lost: false,
      }
    }

    case 'custom_item': {
      if (!target.allowCustom) {
        return { carried: null, reasons: ['custom_not_allowed_by_target'], lost: true }
      }
      if (selection.roleCode !== targetRole) {
        return { carried: null, reasons: ['custom_not_allowed_by_target'], lost: true }
      }
      // Free text has no catalog identity to re-verify, so nothing here can establish that it
      // still says the right thing. It carries and is always reviewed.
      return { carried: selection, reasons: ['custom_item_requires_review'], lost: false }
    }

    case 'equipment_set': {
      if (!selection.coveredRoles.includes(targetRole)) {
        return { carried: null, reasons: ['equipment_set_role_not_covered'], lost: true }
      }
      // Atomic: a set with one unavailable member is not carried at all. Binding the survivors
      // would hand the physician a tray that is missing a piece and say nothing about it.
      if (!probe.equipmentSetMembersAvailable(selection.setId)) {
        return { carried: null, reasons: ['equipment_set_member_unavailable'], lost: true }
      }
      return { carried: selection, reasons: [], lost: false }
    }

    case 'unknown':
      return { carried: null, reasons: ['selection_absent_in_source'], lost: true }
  }
}

function requirementDecisionKey(requirementKey: string): string {
  return `requirement:${requirementKey}`
}

function sortReasons(reasons: RebuildReasonCode[]): RebuildReasonCode[] {
  return [...new Set(reasons)].sort()
}

/**
 * The conservative module selection to plan against, before the physician moves anything.
 *
 * Modules are matched by **code**, not by version id: a republished module is the same module, and
 * matching on the version id would report every module of every republished release as removed and
 * added. The version move is then reported as a change requiring review, which is the honest
 * reading — the requirements inside it may have moved.
 */
export function proposeRebuildSelection(input: {
  sourceInputs: ReleasePinnedBuilderInputs
  sourceBundle: PreferenceCardReleaseBundle
  target: RebuildPlanInput['target']
}): { moduleVersionIds: string[]; modifierCodes: string[] } {
  const sourceByVersionId = new Map(
    input.sourceBundle.modulePins.map((pin) => [pin.moduleVersionId, pin.moduleCode]),
  )
  /** Every module the source release *offered*, whether or not the card selected it. */
  const sourceModuleCodes = new Set(input.sourceBundle.modulePins.map((pin) => pin.moduleCode))
  const sourceSelectedCodes = new Set(
    input.sourceInputs.input.selectedModuleVersionIds
      .map((id) => sourceByVersionId.get(id))
      .filter((code): code is string => typeof code === 'string'),
  )

  const moduleVersionIds = input.target.offeredModules
    .filter((module) => {
      // Required is not a choice: the composition includes it whatever a card says.
      if (module.selectionBehavior === 'required') return true
      // The source's own answer wins wherever the target still offers the module, including a
      // default-on module the source deliberately removed — that removal is a decision, and the
      // target's default is not entitled to overturn it.
      if (sourceModuleCodes.has(module.moduleCode))
        return sourceSelectedCodes.has(module.moduleCode)
      // A module the target introduces arrives at the target's own default. It is proposed on and
      // reported as new, because it adds requirements the source card never carried.
      return module.selectionBehavior === 'default_on'
    })
    .map((module) => module.moduleVersionId)
    .sort()

  const modifierCodes = input.sourceInputs.input.modifierCodes
    .filter((code) => input.target.allowedModifierCodes.includes(code))
    .sort()

  return { moduleVersionIds, modifierCodes }
}

/**
 * Project a resolved target card to the stable facts a review is about.
 *
 * Display names, prose and ordering are deliberately absent: this is hashed, compared before the
 * write, and read by a physician through translated labels, so anything localized or cosmetic in it
 * would make an identical card look changed.
 */
function projectTargetResolution(card: UnhashedResolvedCard | null): RebuildTargetResolution {
  if (!card) return { ok: false, readinessState: null, items: [], warnings: [] }
  const items: RebuildTargetResolutionItem[] = [
    ...card.items.map((item) => ({ item, presence: 'active' as const })),
    ...card.suppressedItems.map((item) => ({ item, presence: 'suppressed' as const })),
  ]
    .filter((entry) => typeof entry.item.requirementKey === 'string')
    .map((entry) => ({
      requirementKey: entry.item.requirementKey as string,
      slotId: entry.item.id,
      roleCode: entry.item.roleCode,
      presence: entry.presence,
      selectedHospitalItemId: entry.item.selectedHospitalItemId,
      resolutionState: entry.item.resolutionState,
      compatibilityState: entry.item.compatibilityState,
    }))
    .sort((left, right) => left.requirementKey.localeCompare(right.requirementKey))

  const warnings = card.warnings
    .map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      sourceType: warning.sourceType,
      sourceId: warning.sourceId,
    }))
    .sort((left, right) =>
      `${left.code}|${left.sourceType}|${left.sourceId ?? ''}`.localeCompare(
        `${right.code}|${right.sourceType}|${right.sourceId ?? ''}`,
      ),
    )

  return { ok: true, readinessState: card.readinessState, items, warnings }
}

/**
 * Fold what the target actually resolved to back into the decisions.
 *
 * A carried selection may only stay `carried_unchanged` when the final card agrees about presence,
 * role, what was selected, and whether the pair is compatible and resolvable. Anything else becomes
 * a decision the physician answers — which is the whole difference between a plan and a receipt.
 */
function annotateWithTargetResolution(
  decisions: RebuildDecision[],
  resolution: RebuildTargetResolution,
): RebuildDecision[] {
  const byKey = new Map(resolution.items.map((item) => [item.requirementKey, item]))
  // A room capability a carried modifier requires, missing at this location. It belongs to the card
  // rather than to one requirement, so it is attached to the modifier decisions that could have
  // caused it rather than invented as a requirement.
  const capabilityMissing = resolution.warnings.some(
    (warning) => warning.code === 'room_capability_missing',
  )

  return decisions.map((decision) => {
    if (decision.kind === 'modifier') {
      if (!capabilityMissing || !decision.carriedSelected) return decision
      return {
        ...decision,
        state: 'carried_requires_review',
        reasonCodes: sortReasons([...decision.reasonCodes, 'room_capability_missing']),
        requiresExplicitConfirmation: true,
      }
    }
    if (decision.kind !== 'requirement') return decision
    if (!resolution.ok) return decision

    const resolved = byKey.get(decision.requirementKey)
    const reasons: RebuildReasonCode[] = []

    // The target resolved this requirement away, or never expressed it, while the plan carried a
    // selection onto it. Presence is a fact about the final card and outranks the mapping.
    if (decision.carriedSelection && !resolved) {
      reasons.push('resolution_unresolved')
    }
    if (resolved) {
      if (resolved.compatibilityState === 'fail') reasons.push('compatibility_rejected')
      if (
        decision.carriedSelection &&
        decision.carriedSelection.kind !== 'none' &&
        resolved.selectedHospitalItemId !== decision.carriedSelection.hospitalItemId
      ) {
        reasons.push('resolution_unresolved')
      }
      if (
        decision.carriedSelection &&
        decision.carriedSelection.kind !== 'none' &&
        (resolved.resolutionState === 'unresolved' || resolved.resolutionState === 'blocking')
      ) {
        reasons.push('resolution_unresolved')
      }
      // Presence, in *both* directions, and against the source rather than against a constant.
      //
      // The earlier version fired only on a final `presence === 'suppressed'`, so the reverse move
      // passed in silence: source equipment set A suppresses source requirement B; the target
      // cannot carry A because one member is gone; B therefore resolves active and carries B's
      // product. The physician was shown a card containing an active, selected requirement that
      // the reviewed source had suppressed, and was never asked about it. A change of presence is
      // a change to what gets pulled in the room, whichever way it goes.
      if (decision.source && resolved.presence !== decision.source.presence) {
        reasons.push('target_presence_changed')
      }
    }

    if (reasons.length === 0) return decision
    return {
      ...decision,
      state: reasons.includes('compatibility_rejected') ? 'incompatible' : decision.state,
      reasonCodes: sortReasons([...decision.reasonCodes, ...reasons]),
      // Answerable: the draft can be created with the problem recorded, and the builder is where a
      // different product is chosen. What is not allowed is passing silently.
      requiresExplicitConfirmation: true,
    }
  })
}

const EMPTY_DELTA: RebuildProjectionDelta = {
  notResolvable: false,
  addedRequirements: [],
  removedRequirements: [],
  changes: [],
  addedWarnings: [],
  removedWarnings: [],
  readiness: null,
}

function warningSignature(warning: RebuildTargetResolution['warnings'][number]): string {
  return `${warning.code}|${warning.severity}|${warning.sourceType}|${warning.sourceId ?? ''}`
}

/** Multiset difference: every occurrence in `left` that `right` does not also have. */
function missingOccurrences(left: string[], right: string[]): string[] {
  const remaining = new Map<string, number>()
  for (const value of right) remaining.set(value, (remaining.get(value) ?? 0) + 1)
  const out: string[] = []
  for (const value of left) {
    const count = remaining.get(value) ?? 0
    if (count > 0) remaining.set(value, count - 1)
    else out.push(value)
  }
  return out.sort()
}

const COMPARED_ITEM_FIELDS: RebuildProjectionFieldChange['field'][] = [
  'presence',
  'slotId',
  'roleCode',
  'selectedHospitalItemId',
  'resolutionState',
  'compatibilityState',
]

/**
 * Everything that differs between two projections of the same target world.
 *
 * Total and deterministic, so the same pair always produces the same bytes and the delta can be
 * hashed into the plan alongside the projection it was taken against.
 */
export function diffProjections(
  before: RebuildTargetResolution,
  after: RebuildTargetResolution,
): RebuildProjectionDelta {
  if (!after.ok) return { ...EMPTY_DELTA, notResolvable: true }

  const beforeByKey = new Map(before.items.map((item) => [item.requirementKey, item]))
  const afterByKey = new Map(after.items.map((item) => [item.requirementKey, item]))

  const addedRequirements = [...afterByKey.keys()].filter((key) => !beforeByKey.has(key)).sort()
  const removedRequirements = [...beforeByKey.keys()].filter((key) => !afterByKey.has(key)).sort()

  const changes: RebuildProjectionFieldChange[] = []
  for (const [requirementKey, was] of beforeByKey) {
    const now = afterByKey.get(requirementKey)
    if (!now) continue
    for (const field of COMPARED_ITEM_FIELDS) {
      if (was[field] === now[field]) continue
      changes.push({ requirementKey, field, from: was[field], to: now[field] })
    }
  }
  changes.sort((left, right) =>
    `${left.requirementKey}|${left.field}`.localeCompare(`${right.requirementKey}|${right.field}`),
  )

  const beforeWarnings = before.warnings.map(warningSignature)
  const afterWarnings = after.warnings.map(warningSignature)

  return {
    notResolvable: false,
    addedRequirements,
    removedRequirements,
    changes,
    addedWarnings: missingOccurrences(afterWarnings, beforeWarnings),
    removedWarnings: missingOccurrences(beforeWarnings, afterWarnings),
    readiness:
      before.readinessState === after.readinessState
        ? null
        : { from: before.readinessState, to: after.readinessState },
  }
}

/** Whether a delta says nothing changed. */
export function isEmptyDelta(delta: RebuildProjectionDelta): boolean {
  return (
    !delta.notResolvable &&
    delta.addedRequirements.length === 0 &&
    delta.removedRequirements.length === 0 &&
    delta.changes.length === 0 &&
    delta.addedWarnings.length === 0 &&
    delta.removedWarnings.length === 0 &&
    delta.readiness === null
  )
}

/**
 * The permitted consequence of each answer, measured rather than assumed.
 *
 * `confirmed` and `acknowledged_unresolved` change no input at all, so their counterfactual is the
 * baseline and their contract is empty — and that is *checked* by comparing the applied inputs
 * rather than asserted, because a future change to `applyAnswersToInputs` that made one of them
 * write something would otherwise silently acquire an empty contract. Only an answer that actually
 * moves the inputs costs a resolver call.
 */
function computeAllowedOutcomes(
  decisions: RebuildDecision[],
  proposedInputs: BuilderInputs,
  baseline: RebuildTargetResolution,
  probe: RebuildProbe,
): RebuildAllowedOutcome[] {
  const canonicalProposed = stableStringify(proposedInputs)
  const outcomes: RebuildAllowedOutcome[] = []

  for (const decision of decisions) {
    if (!decision.requiresExplicitConfirmation) continue
    for (const answer of allowedAcknowledgements(decision)) {
      const inputs = applyAnswersToInputs(decisions, proposedInputs, { [decision.key]: answer })
      const delta =
        stableStringify(inputs) === canonicalProposed
          ? EMPTY_DELTA
          : diffProjections(baseline, projectTargetResolution(probe.resolveTarget(inputs)))
      outcomes.push({ decisionKey: decision.key, answer, delta })
    }
  }

  return outcomes.sort((left, right) =>
    `${left.decisionKey}|${left.answer}`.localeCompare(`${right.decisionKey}|${right.answer}`),
  )
}

/**
 * The plan.
 *
 * Pure and total: the same inputs and the same probe answers produce byte-identical output, which
 * is what makes the plan hash worth checking. Nothing here reads a clock, a database, or a module
 * singleton.
 */
export function planCardRebuild(input: RebuildPlanInput): CardRebuildPlan {
  const { source, target, probe, selection, comparisons } = input

  const decisions: RebuildDecision[] = []
  const sourceItems = sourceRequirementIndex(source.card)
  const sourceIndex = slotIndex(source.slots)
  const targetIndex = slotIndex(target.slots)
  const sourceSlots = sourceIndex.byKey
  const targetSlots = targetIndex.byKey
  const ambiguousKeys = new Set([...sourceIndex.ambiguous, ...targetIndex.ambiguous])
  const sourceModuleCodeByVersionId = moduleCodesByVersionId(source.releaseBundle)
  const targetModuleCodeByVersionId = moduleCodesByVersionId(target.releaseBundle)

  const carriedHospitalItemIds: Record<string, string | null> = {}
  const carriedConditionalStates: Record<string, ConditionalState> = {}
  const carriedCatalogPicks = new Map<string, { productId: string; roleCode: string }>()
  const carriedFamilyPicks = new Map<string, ReviewedFamilyPickRef>()
  const carriedCustomIds = new Set<string>()
  const carriedSetIds = new Set<string>()

  // ---- Requirements -------------------------------------------------------------------------

  const requirementKeys = [...new Set([...sourceItems.keys(), ...targetSlots.keys()])].sort()

  for (const requirementKey of requirementKeys) {
    const sourceEntry = sourceItems.get(requirementKey)
    const sourceSlot = sourceSlots.get(requirementKey)
    const targetSlot = targetSlots.get(requirementKey)

    // Two slots on one side disagree about what this requirement is. There is no answer to "which
    // one did the physician choose for", so the plan refuses to have one: nothing is carried and
    // the rebuild is blocked until the release is fixed. Picking either would be a coin toss
    // recorded as a reviewed decision.
    if (ambiguousKeys.has(requirementKey)) {
      decisions.push({
        key: requirementDecisionKey(requirementKey),
        kind: 'requirement',
        requirementKey,
        state: 'incompatible',
        reasonCodes: ['requirement_key_ambiguous'],
        requiresExplicitConfirmation: false,
        blocking: true,
        source: sourceEntry
          ? {
              slotId: sourceEntry.item.id,
              roleCode: sourceEntry.item.roleCode,
              label: sourceEntry.item.label,
              presence: sourceEntry.presence,
              selection: readSelection(sourceEntry.item, source.inputs),
              conditionalState: sourceEntry.item.conditionalState,
            }
          : null,
        target: targetSlot
          ? {
              slotId: targetSlot.id,
              roleCode: targetSlot.roleCode,
              label: targetSlot.label,
              requiredness: targetSlot.requiredness,
              allowCustom: targetSlot.allowCustom,
              dependencyRule: targetSlot.dependencyRule,
            }
          : null,
        changedDefinitionFields: [],
        carriedSelection: null,
        carriedConditionalState: null,
      })
      continue
    }

    if (!targetSlot) {
      // The target release does not express this requirement. Nothing is carried and nothing is
      // guessed at: the card simply no longer asks for it, and the review says so.
      decisions.push({
        key: requirementDecisionKey(requirementKey),
        kind: 'requirement',
        requirementKey,
        state: 'removed_requirement',
        reasonCodes: ['requirement_removed_by_target'],
        requiresExplicitConfirmation: Boolean(sourceEntry?.item.selectedHospitalItemId),
        blocking: false,
        source: sourceEntry
          ? {
              slotId: sourceEntry.item.id,
              roleCode: sourceEntry.item.roleCode,
              label: sourceEntry.item.label,
              presence: sourceEntry.presence,
              selection: readSelection(sourceEntry.item, source.inputs),
              conditionalState: sourceEntry.item.conditionalState,
            }
          : null,
        target: null,
        changedDefinitionFields: [],
        carriedSelection: null,
        carriedConditionalState: null,
      })
      continue
    }

    const targetView = {
      slotId: targetSlot.id,
      roleCode: targetSlot.roleCode,
      label: targetSlot.label,
      requiredness: targetSlot.requiredness,
      allowCustom: targetSlot.allowCustom,
      dependencyRule: targetSlot.dependencyRule,
    }

    if (!sourceEntry) {
      // A requirement the target adds. It begins unresolved: there is no authored default
      // selection anywhere in this model — a default would come from the local formulary's current
      // ranking, and materializing one here would be choosing a product on the physician's behalf
      // and calling it carried.
      const required = targetSlot.requiredness === 'required'
      decisions.push({
        key: requirementDecisionKey(requirementKey),
        kind: 'requirement',
        requirementKey,
        state: 'new_requirement',
        reasonCodes: sortReasons([
          'requirement_added_by_target',
          ...(sourceSlot ? (['requirement_key_absent_from_snapshot'] as const) : []),
        ]),
        requiresExplicitConfirmation: true,
        blocking: required,
        source: null,
        target: targetView,
        changedDefinitionFields: [],
        carriedSelection: null,
        carriedConditionalState: null,
      })
      continue
    }

    const definitionFields = sourceSlot ? changedDefinitionFields(sourceSlot, targetSlot) : []
    const definitionChanged = definitionFields.length > 0
    const sourceSelection = readSelection(sourceEntry.item, source.inputs)
    const verdict = carrySelection(sourceSelection, targetSlot, probe)

    // A requirement that moved between modules without changing any compared field is the same
    // requirement in a different place. Saying so explicitly matters: without it, a release that
    // did nothing but move a requirement into a shared core would read as a clinical change on
    // every card that carries it.
    //
    // Compared by module *code*, not by module version id. Every release that republishes a module
    // pins a new version id, so comparing ids would report a provenance move for every requirement
    // in every module of every release — which would make the annotation meaningless exactly when
    // it is most needed.
    const provenanceOnly =
      !definitionChanged &&
      sourceSlot !== undefined &&
      stableStringify(moduleCodesOf(sourceSlot, sourceModuleCodeByVersionId)) !==
        stableStringify(moduleCodesOf(targetSlot, targetModuleCodeByVersionId))

    // A dependency rule is what a conditional include/exclude was decided against. If the rule
    // moved, the earlier answer was to a different question, so it resets to undecided.
    const conditionalRuleChanged =
      stableStringify(sourceSlot?.dependencyRule ?? sourceEntry.item.dependencyRule) !==
      stableStringify(targetSlot.dependencyRule)
    const carriedConditional =
      sourceEntry.item.conditionalState && !conditionalRuleChanged
        ? sourceEntry.item.conditionalState
        : null

    const reasons: RebuildReasonCode[] = [...verdict.reasons]
    if (definitionChanged) reasons.push('requirement_definition_changed')
    if (provenanceOnly) reasons.push('provenance_only_module_move')
    if (!definitionChanged && !provenanceOnly && verdict.reasons.length === 0) {
      reasons.push('requirement_unchanged')
    }
    if (conditionalRuleChanged && sourceEntry.item.conditionalState) {
      reasons.push('conditional_rule_changed')
    }
    if (!sourceSlot) reasons.push('requirement_key_absent_from_snapshot')

    let state: RebuildDecisionState
    if (verdict.lost) {
      state = 'not_carried'
    } else if (
      definitionChanged ||
      conditionalRuleChanged ||
      verdict.reasons.some((reason) =>
        (['family_version_changed', 'custom_item_requires_review'] as RebuildReasonCode[]).includes(
          reason,
        ),
      )
    ) {
      state = 'carried_requires_review'
    } else {
      state = 'carried_unchanged'
    }

    // A requirement whose selection was lost and which the target still requires cannot produce a
    // usable card; one that was optional simply comes across empty.
    const blocking = verdict.lost && targetSlot.requiredness === 'required'

    if (verdict.carried) {
      carriedHospitalItemIds[targetSlot.id] =
        verdict.carried.kind === 'none' ? null : verdict.carried.hospitalItemId
      if (verdict.carried.kind === 'catalog_product') {
        carriedCatalogPicks.set(`${verdict.carried.productId}:${verdict.carried.roleCode}`, {
          productId: verdict.carried.productId,
          roleCode: verdict.carried.roleCode,
        })
      }
      if (verdict.carried.kind === 'reviewed_family') {
        carriedFamilyPicks.set(
          `${verdict.carried.productFamilyVersionId}:${verdict.carried.roleCode}`,
          {
            productFamilyVersionId: verdict.carried.productFamilyVersionId,
            catalogReleaseId: verdict.carried.catalogReleaseId,
            definitionHash: verdict.carried.definitionHash,
            roleCode: verdict.carried.roleCode,
          },
        )
      }
      if (verdict.carried.kind === 'custom_item') carriedCustomIds.add(verdict.carried.customItemId)
      if (verdict.carried.kind === 'equipment_set') carriedSetIds.add(verdict.carried.setId)
    }
    if (carriedConditional) carriedConditionalStates[targetSlot.id] = carriedConditional

    decisions.push({
      key: requirementDecisionKey(requirementKey),
      kind: 'requirement',
      requirementKey,
      state,
      reasonCodes: sortReasons(reasons),
      requiresExplicitConfirmation: state !== 'carried_unchanged',
      blocking,
      source: {
        slotId: sourceEntry.item.id,
        roleCode: sourceEntry.item.roleCode,
        label: sourceEntry.item.label,
        presence: sourceEntry.presence,
        selection: sourceSelection,
        conditionalState: sourceEntry.item.conditionalState,
      },
      target: targetView,
      changedDefinitionFields: definitionFields,
      carriedSelection: verdict.carried,
      carriedConditionalState: carriedConditional,
    })
  }

  // ---- Modules ------------------------------------------------------------------------------

  const sourceModuleHashes = moduleHashesByCode(source.releaseBundle)
  const sourceModuleVersions = moduleVersionsByCode(source.releaseBundle)
  const sourceSelectedVersionIds = new Set(source.inputs.input.selectedModuleVersionIds)
  const sourceSelectedCodes = new Set(
    source.releaseBundle.modulePins
      .filter((pin) => sourceSelectedVersionIds.has(pin.moduleVersionId))
      .map((pin) => pin.moduleCode),
  )
  const selectedTargetVersionIds = new Set(selection.moduleVersionIds)
  const targetModuleCodes = new Set(target.offeredModules.map((module) => module.moduleCode))

  for (const offered of [...target.offeredModules].sort((left, right) =>
    left.moduleCode.localeCompare(right.moduleCode),
  )) {
    const sourceHash = sourceModuleHashes.get(offered.moduleCode)
    const sourceVersion = sourceModuleVersions.get(offered.moduleCode)
    const wasSelected = sourceSelectedCodes.has(offered.moduleCode)
    const isSelected = selectedTargetVersionIds.has(offered.moduleVersionId)
    const versionChanged =
      Boolean(sourceVersion) && sourceVersion?.moduleVersionId !== offered.moduleVersionId
    const definitionHashChanged = sourceHash !== undefined && sourceHash !== offered.definitionHash

    const reasons: RebuildReasonCode[] = []
    let state: RebuildDecisionState
    if (!sourceVersion) {
      reasons.push(
        offered.selectionBehavior === 'required'
          ? 'module_required_by_target'
          : 'module_newly_offered_on_by_default',
      )
      state = 'new_requirement'
    } else if (versionChanged || definitionHashChanged) {
      reasons.push('module_version_changed')
      state = 'carried_requires_review'
    } else {
      reasons.push('module_unchanged')
      state = 'carried_unchanged'
    }

    decisions.push({
      key: `module:${offered.moduleCode}`,
      kind: 'module',
      moduleCode: offered.moduleCode,
      state,
      reasonCodes: sortReasons(reasons),
      // A required module is not a decision — the composition includes it whatever anyone says —
      // so it is reported and not asked about.
      requiresExplicitConfirmation:
        offered.selectionBehavior !== 'required' && state !== 'carried_unchanged',
      blocking: false,
      source: sourceVersion
        ? {
            moduleVersionId: sourceVersion.moduleVersionId,
            moduleVersion: sourceVersion.moduleVersion,
            selected: wasSelected,
          }
        : null,
      target: {
        moduleVersionId: offered.moduleVersionId,
        moduleVersion: offered.moduleVersion,
        selectionBehavior: offered.selectionBehavior,
        definitionHashChanged,
      },
      carriedSelected: isSelected,
    })
  }

  for (const code of [...sourceSelectedCodes].sort()) {
    if (targetModuleCodes.has(code)) continue
    const sourceVersion = sourceModuleVersions.get(code)
    decisions.push({
      key: `module:${code}`,
      kind: 'module',
      moduleCode: code,
      state: 'removed_requirement',
      reasonCodes: ['module_not_offered'],
      requiresExplicitConfirmation: true,
      blocking: false,
      source: sourceVersion
        ? {
            moduleVersionId: sourceVersion.moduleVersionId,
            moduleVersion: sourceVersion.moduleVersion,
            selected: true,
          }
        : null,
      target: null,
      carriedSelected: false,
    })
  }

  // ---- Modifiers ----------------------------------------------------------------------------

  const sourceModifiers = new Set(source.inputs.input.modifierCodes)
  const selectedModifiers = new Set(selection.modifierCodes)

  for (const code of [...new Set([...sourceModifiers, ...selectedModifiers])].sort()) {
    const offered = target.allowedModifierCodes.includes(code)
    const sourceHash = source.modifierDefinitionHashes[code]
    const targetHash = target.modifierDefinitionHashes[code]
    // Unknown on either side counts as changed. A modifier the caller could not hash is one whose
    // definition cannot be shown to have held, and "cannot be shown to have held" is exactly the
    // case that has to be reviewed rather than assumed.
    const definitionHashChanged =
      sourceHash === undefined || targetHash === undefined || sourceHash !== targetHash

    if (!offered) {
      decisions.push({
        key: `modifier:${code}`,
        kind: 'modifier',
        modifierCode: code,
        state: 'removed_requirement',
        reasonCodes: ['modifier_not_offered'],
        requiresExplicitConfirmation: true,
        blocking: false,
        source: { selected: sourceModifiers.has(code) },
        target: { offered: false, definitionHashChanged: false },
        carriedSelected: false,
      })
      continue
    }

    decisions.push({
      key: `modifier:${code}`,
      kind: 'modifier',
      modifierCode: code,
      state: definitionHashChanged ? 'carried_requires_review' : 'carried_unchanged',
      reasonCodes: definitionHashChanged ? ['modifier_definition_changed'] : ['modifier_unchanged'],
      requiresExplicitConfirmation: definitionHashChanged,
      blocking: false,
      source: { selected: sourceModifiers.has(code) },
      target: { offered: true, definitionHashChanged },
      carriedSelected: selectedModifiers.has(code),
    })
  }

  // ---- Waivers ------------------------------------------------------------------------------

  for (const decision of waiverDecisions(source.card, source.inputs, sourceItems, targetSlots)) {
    decisions.push(decision)
  }

  decisions.sort((left, right) => left.key.localeCompare(right.key))

  const proposedInputs: BuilderInputs = {
    schemaVersion: 4,
    releaseBundleId: target.releaseBundle.id,
    scenarioId: target.releaseBundle.scenarioId,
    input: {
      organizationId: source.inputs.input.organizationId,
      siteId: source.inputs.input.siteId,
      locationId: source.inputs.input.locationId,
      recipeVersionId: target.releaseBundle.recipeVersionId,
      ...(source.inputs.input.userId ? { userId: source.inputs.input.userId } : {}),
      selectedModuleVersionIds: [...selection.moduleVersionIds].sort(),
      modifierCodes: [...selection.modifierCodes].sort(),
      variables: { ...source.inputs.input.variables },
      conditionalStates: carriedConditionalStates,
      selectedHospitalItemIds: carriedHospitalItemIds,
      // Every carried selection is written down, so an absent key means "not chosen" rather than
      // "fall back to whatever the formulary ranks first". A rebuild that left the fallback open
      // would let a re-ranked formulary choose the products a physician had not reviewed — on the
      // one card whose whole purpose is that every changed choice was reviewed.
      selectionsAreExplicit: true,
      // Never carried, ever. A waiver is a judgement about a specific warning under a specific
      // release; the target's warnings are not those warnings even where they share a code.
      waivers: {},
    },
    catalogPicks: [...carriedCatalogPicks.values()].sort((left, right) =>
      `${left.productId}:${left.roleCode}`.localeCompare(`${right.productId}:${right.roleCode}`),
    ),
    familyPicks: [...carriedFamilyPicks.values()].sort((left, right) =>
      left.productFamilyVersionId.localeCompare(right.productFamilyVersionId),
    ),
    customItems: source.inputs.customItems
      .filter((item) => carriedCustomIds.has(item.id))
      .map((item) => ({ ...item, roleCode: canonicalRoleCode(item.roleCode) })),
    equipmentSets: source.inputs.equipmentSets
      .filter((set) => carriedSetIds.has(set.id))
      .map(
        (set): EquipmentSetRef => ({
          ...set,
          selectedRoleCode: canonicalRoleCode(set.selectedRoleCode),
          additionalCoveredRoles: set.additionalCoveredRoles.map(canonicalRoleCode),
        }),
      ),
  }

  const targetResolution = projectTargetResolution(probe.resolveTarget(proposedInputs))
  const annotated = annotateWithTargetResolution(decisions, targetResolution)
  // Measured against the annotated decisions, because promotion by the final-resolution pass is
  // what decides whether a decision is asked about at all — and only asked decisions have answers.
  const allowedOutcomes = computeAllowedOutcomes(annotated, proposedInputs, targetResolution, probe)

  return {
    version: CARD_REBUILD_PLAN_VERSION,
    source: {
      cardId: source.cardId,
      revisionId: source.revisionId,
      revisionNumber: source.revisionNumber,
      schemaVersion: source.inputs.schemaVersion,
      releaseBundleId: source.releaseBundle.id,
      releaseDefinitionHash: source.releaseBundle.definitionHash,
      catalogReleaseId: source.card.resolutionProvenance.catalogReleaseId,
      snapshotHash: source.card.snapshotHash ?? '',
      snapshotIntegrityHash: source.card.snapshotIntegrityHash ?? null,
      resolvedContentHash: source.card.resolvedContentHash ?? null,
    },
    target: {
      releaseBundleId: target.releaseBundle.id,
      releaseDefinitionHash: target.releaseBundle.definitionHash,
      catalogReleaseId: target.releaseBundle.catalogImportId,
      scenarioId: target.releaseBundle.scenarioId,
      recipeVersionId: target.releaseBundle.recipeVersionId,
      sourceProcedureCode: target.releaseBundle.sourceProcedureCode,
    },
    comparisons,
    targetResolution,
    allowedOutcomes,
    decisions: annotated,
    proposedInputs,
    blockingCount: annotated.filter((decision) => decision.blocking).length,
    reviewCount: annotated.filter((decision) => decision.requiresExplicitConfirmation).length,
  }
}

/**
 * One decision per waiver the source revision held.
 *
 * The prior rationale is carried as *reference text only*, and the decision is `not_carried` in
 * every case — there is no branch in which a waiver comes across. A waiver says a named person
 * accepted a named risk under a named set of definitions; under a different release the definitions
 * are different, so the acceptance is not the same acceptance even when the warning code matches.
 */
function waiverDecisions(
  card: UnhashedResolvedCard,
  inputs: ReleasePinnedBuilderInputs,
  sourceItems: Map<string, { item: ResolvedCardItem; presence: 'active' | 'suppressed' }>,
  targetSlots: Map<string, RecipeSlot>,
): RebuildWaiverDecision[] {
  const waivers = inputs.input.waivers ?? {}
  const warningsById = new Map<string, RuleMessage>(
    card.warnings.map((warning) => [warning.id, warning]),
  )
  const requirementKeyBySlotId = new Map<string, string>()
  for (const [requirementKey, entry] of sourceItems) {
    requirementKeyBySlotId.set(entry.item.id, requirementKey)
  }

  const decisions: RebuildWaiverDecision[] = []
  for (const warningId of Object.keys(waivers).sort()) {
    const rationale = waivers[warningId]
    const warning = warningsById.get(warningId)
    // A warning id ends in the composed slot id for every generic case (`unresolved-required-<id>`,
    // `hidden-product-<id>`), which is what lets the prior waiver be shown beside the requirement
    // it was about rather than as a bare id.
    const requirementKey =
      [...requirementKeyBySlotId.entries()].find(([slotId]) => warningId.endsWith(slotId))?.[1] ??
      null
    const stillExpressed = requirementKey !== null && targetSlots.has(requirementKey)

    decisions.push({
      key: `waiver:${warningId}`,
      kind: 'waiver',
      state: 'not_carried',
      reasonCodes: sortReasons([
        'waiver_never_carries',
        ...(stillExpressed ? [] : (['waiver_warning_absent_from_target'] as const)),
      ]),
      // Only a waiver whose requirement the target still expresses is something the physician has
      // to decide again. One whose requirement is gone has nothing to be entered against.
      requiresExplicitConfirmation: stillExpressed,
      blocking: false,
      warningCode: warning?.code ?? 'unknown',
      warningSourceType: warning?.sourceType ?? 'slot',
      warningSourceId: warning?.sourceId ?? null,
      requirementKey,
      priorRationale: rationale,
      targetWarningId:
        stillExpressed && requirementKey
          ? warningId.replace(
              sourceItems.get(requirementKey)?.item.id ?? '',
              targetSlots.get(requirementKey)?.id ?? '',
            )
          : null,
    })
  }
  return decisions
}

/**
 * The plan's identity.
 *
 * Over the canonical structured plan and nothing else — never over rendered prose, which is
 * localized and would make the same plan hash differently in Spanish. The server recomputes the
 * plan on save and compares this; a client that edited a decision, a carried selection, or the
 * proposed inputs produces a different hash and is refused.
 */
export function rebuildPlanHash(plan: CardRebuildPlan): string {
  return stableSnapshotHash({ v: CARD_REBUILD_PLAN_VERSION, kind: 'rebuild-plan', payload: plan })
}

/** Every decision the physician must answer before the new card may be created. */
export function decisionsAwaitingReview(plan: CardRebuildPlan): RebuildDecision[] {
  return plan.decisions.filter((decision) => decision.requiresExplicitConfirmation)
}

/** Every decision that stops the plan producing a usable card at all. */
export function blockingDecisions(plan: CardRebuildPlan): RebuildDecision[] {
  return plan.decisions.filter((decision) => decision.blocking)
}

/**
 * Blocking decisions that no answer can dispose of.
 *
 * Most blocking decisions *are* answerable: a required requirement the target adds cannot be filled
 * in here, so it is acknowledged and the draft carries the gap into the builder. That is the
 * designed path and it is not an error.
 *
 * An ambiguous requirement key is different in kind. Two slots disagree about what one requirement
 * is, so there is no selection to acknowledge and no draft that could be honest about it — the
 * release itself has to be fixed. Those decisions are blocking *and* carry no answer, and
 * `createRebuiltCard` refuses outright rather than creating a card nobody could interpret.
 */
/**
 * The exact contracts the physician's answers selected, and nothing else.
 *
 * This gate took five attempts. A byte comparison against the plan's projection refused every
 * legitimate drop, because the two differ by exactly the answers. Re-resolving `proposedInputs` and
 * comparing that instead removed the false positive by comparing a pure function against itself,
 * which could never fail. A third compared only blocking warning signatures, which accepts a card
 * whose requirement set, roles, presences and readiness have all moved. A fourth derived the
 * expected state from the plan plus the answers — better, but it relaxed whole comparison axes
 * behind one global `anyDropped` flag, so a single legitimate drop authorized unrelated drift
 * anywhere on the card.
 *
 * The mistake in all four was treating an answer as a *global* explanation. An answer explains
 * exactly what it causes, and what it causes was measured at review time by resolving the
 * counterfactual. So the union below is a union of specific, pre-reviewed deltas, never a set of
 * disabled checks.
 */
export function selectedAllowedOutcomes(
  plan: CardRebuildPlan,
  acknowledgements: RebuildAcknowledgements,
): { outcomes: RebuildAllowedOutcome[]; unmatched: string[] } {
  const byKeyAnswer = new Map(
    plan.allowedOutcomes.map((outcome) => [`${outcome.decisionKey}|${outcome.answer}`, outcome]),
  )
  const outcomes: RebuildAllowedOutcome[] = []
  const unmatched: string[] = []

  for (const decision of plan.decisions) {
    if (!decision.requiresExplicitConfirmation) continue
    const answer = acknowledgements[decision.key]
    if (answer === undefined) continue
    const outcome = byKeyAnswer.get(`${decision.key}|${answer}`)
    // A decision the review gate accepted but the plan measured no contract for cannot be
    // authorized by anything, so it fails closed rather than contributing an empty permission.
    if (!outcome) unmatched.push(decision.key)
    else outcomes.push(outcome)
  }

  return {
    outcomes: outcomes.sort((left, right) => left.decisionKey.localeCompare(right.decisionKey)),
    unmatched,
  }
}

/**
 * The identity of the state those contracts authorize.
 *
 * Over the reviewed baseline and the selected contracts, so it names the *permission* rather than
 * the outcome — a later reader can recompute it from the plan and the recorded answers and get the
 * same value. Required in version-1 provenance.
 */
export function allowedFinalStateHash(
  plan: CardRebuildPlan,
  acknowledgements: RebuildAcknowledgements,
): string {
  const { outcomes } = selectedAllowedOutcomes(plan, acknowledgements)
  return stableSnapshotHash({
    v: CARD_REBUILD_PLAN_VERSION,
    kind: 'rebuild-allowed-final-state',
    payload: { baseline: plan.targetResolution, selected: outcomes },
  })
}

function fieldViolationCode(field: RebuildProjectionFieldChange['field']): string {
  switch (field) {
    case 'presence':
      return 'presence_changed'
    case 'slotId':
      return 'slot_changed'
    case 'roleCode':
      return 'role_changed'
    case 'selectedHospitalItemId':
      return 'selection_changed'
    case 'resolutionState':
      return 'resolution_changed'
    case 'compatibilityState':
      return 'compatibility_changed'
  }
}

/**
 * Every way the card about to be written departs from what the answers authorized.
 *
 * Empty is the pass condition. The actual delta from the reviewed baseline must be a *subset* of
 * the union of the selected contracts — subset rather than equality, because two answers can
 * legitimately overlap (both remove the same warning) or supersede one another (dropping a
 * selection that a second answer would have left unresolved). An effect the physician was told
 * would happen and which then did not is not a safety failure; an effect nobody was told about is.
 *
 * Two answers whose *combined* result is not the union of their separate results therefore fail
 * closed here rather than widening anything: the combination was never reviewed.
 */
export function unauthorizedFinalState(
  plan: CardRebuildPlan,
  acknowledgements: RebuildAcknowledgements,
  resolved: UnhashedResolvedCard | null,
): string[] {
  const { outcomes, unmatched } = selectedAllowedOutcomes(plan, acknowledgements)
  const violations = unmatched.map((key) => `unreviewed_answer:${key}`)

  const final = projectTargetResolution(resolved)
  const actual = diffProjections(plan.targetResolution, final)
  if (actual.notResolvable) return [...violations, 'not_resolvable'].sort()

  // Some answers *command* an effect rather than merely permitting one, and a permitted effect
  // that simply failed to happen is not a safety failure — so the subset rule below cannot express
  // this. Dropping a selection and then finding it on the written card produces an empty delta from
  // the baseline, which is a subset of everything: the physician discarded a product and the card
  // kept it, and nothing in the containment check would ever notice.
  const finalByKey = new Map(final.items.map((item) => [item.requirementKey, item]))
  for (const decision of plan.decisions) {
    if (decision.kind !== 'requirement' || !decision.requiresExplicitConfirmation) continue
    const answer = acknowledgements[decision.key]
    if (answer !== 'dropped' && answer !== 'acknowledged_unresolved') continue
    // `acknowledged_unresolved` is only ever offered where there is nothing to carry, so both
    // answers have the same post-condition: this line ends up with no selection.
    if (answer === 'acknowledged_unresolved' && decision.carriedSelection?.kind !== 'none') continue
    const item = finalByKey.get(decision.requirementKey)
    if (item && item.selectedHospitalItemId !== null) {
      violations.push(
        answer === 'dropped'
          ? `selection_not_cleared:${decision.requirementKey}`
          : `unresolved_line_acquired_a_selection:${decision.requirementKey}`,
      )
    }
  }

  const allowed = outcomes.map((outcome) => outcome.delta)
  const allowedAdded = allowed.flatMap((delta) => delta.addedRequirements)
  const allowedRemoved = allowed.flatMap((delta) => delta.removedRequirements)
  const allowedChanges = new Set(
    allowed.flatMap((delta) =>
      delta.changes.map(
        (change) =>
          `${change.requirementKey}|${change.field}|${change.from ?? ''}|${change.to ?? ''}`,
      ),
    ),
  )
  const allowedAddedWarnings = allowed.flatMap((delta) => delta.addedWarnings)
  const allowedRemovedWarnings = allowed.flatMap((delta) => delta.removedWarnings)
  const allowedReadiness = new Set(
    allowed
      .filter((delta) => delta.readiness !== null)
      .map((delta) => `${delta.readiness?.from ?? ''}|${delta.readiness?.to ?? ''}`),
  )

  for (const key of missingOccurrences(actual.addedRequirements, allowedAdded)) {
    violations.push(`requirement_outside_plan:${key}`)
  }
  for (const key of missingOccurrences(actual.removedRequirements, allowedRemoved)) {
    violations.push(`requirement_missing:${key}`)
  }
  for (const change of actual.changes) {
    const signature = `${change.requirementKey}|${change.field}|${change.from ?? ''}|${change.to ?? ''}`
    if (allowedChanges.has(signature)) continue
    violations.push(`${fieldViolationCode(change.field)}:${change.requirementKey}`)
  }
  for (const signature of missingOccurrences(actual.addedWarnings, allowedAddedWarnings)) {
    const [code, severity] = signature.split('|')
    violations.push(
      severity === 'blocking'
        ? `unreviewed_blocking_warning:${code}`
        : `unreviewed_warning:${code}`,
    )
  }
  for (const signature of missingOccurrences(actual.removedWarnings, allowedRemovedWarnings)) {
    violations.push(`warning_disappeared:${signature.split('|')[0]}`)
  }
  if (
    actual.readiness &&
    !allowedReadiness.has(`${actual.readiness.from ?? ''}|${actual.readiness.to ?? ''}`)
  ) {
    violations.push('readiness_changed')
  }

  return [...new Set(violations)].sort()
}

export function unanswerableBlockingDecisions(plan: CardRebuildPlan): RebuildDecision[] {
  return plan.decisions.filter(
    (decision) => decision.blocking && !decision.requiresExplicitConfirmation,
  )
}

/**
 * What a physician may say about one decision.
 *
 * Three answers, and deliberately no fourth that means "all of the above". There is no
 * accept-everything control anywhere in this workflow: a single click that disposed of every
 * changed requirement at once would be indistinguishable, in the record it leaves, from a rebuild
 * nobody read — and the record is the point.
 *
 * - `confirmed` — carry the suggestion exactly as the plan proposes it.
 * - `dropped` — do not carry it. The requirement comes across with no selection.
 * - `acknowledged_unresolved` — for a requirement the target adds, removes, or will not carry: the
 *   new card will not have it, and that has been read.
 */
export type RebuildAcknowledgement = 'confirmed' | 'dropped' | 'acknowledged_unresolved'

export type RebuildAcknowledgements = Record<string, RebuildAcknowledgement>

/**
 * Which answers are meaningful for a decision.
 *
 * `dropped` is offered on requirements and on nothing else, because a requirement's selection is
 * the only thing an answer can actually change here. Turning a module off or removing a modifier
 * changes which requirements exist, which changes the plan — so it is an input to planning, and
 * offering it as an answer would be offering a control that quietly did nothing. The composition of
 * the new draft is changed in the builder, where changing a composition is what the interface is
 * for.
 */
export function allowedAcknowledgements(
  decision: RebuildDecision,
): readonly RebuildAcknowledgement[] {
  // A decision the workflow never asked about accepts nothing at all. Returning `['confirmed']` for
  // a quiet `carried_unchanged` requirement let a direct caller attach an answer the UI had emitted
  // no control for; it changed nothing, and was still written verbatim into immutable provenance as
  // an acknowledgement — evidence of a confirmation that was never required or displayed.
  if (!decision.requiresExplicitConfirmation) return []
  // A requirement that carries a selection can always be dropped once it is being asked about,
  // whatever put it on the list. Keying this on `state` alone meant a `carried_unchanged` decision
  // promoted by the final-resolution pass — its selection rejected by the target — could only be
  // "confirmed", so the physician was asked to affirm a line they had just been told does not work
  // and given no way to clear it.
  if (decision.kind === 'requirement' && decision.carriedSelection) {
    // A carried *deliberate blank* is not a selection. There is no product to confirm and none to
    // drop, so offering those two asked the physician to affirm or discard something that does not
    // exist — and whichever they picked went into immutable provenance as the answer they gave.
    // What they are actually being asked is whether they have read that this line is still empty.
    if (decision.carriedSelection.kind === 'none') return ['acknowledged_unresolved']
    return ['confirmed', 'dropped']
  }
  switch (decision.state) {
    case 'carried_requires_review':
      return decision.kind === 'requirement' ? ['confirmed', 'dropped'] : ['confirmed']
    case 'new_requirement':
    case 'removed_requirement':
    case 'not_carried':
    case 'unresolved':
    case 'incompatible':
      return ['acknowledged_unresolved']
    case 'carried_unchanged':
      return ['confirmed']
  }
}

export type RebuildReviewResult =
  | { ok: true }
  | {
      ok: false
      /** Decisions that require an answer and did not get one. */
      missing: string[]
      /** Decisions answered with something that is not meaningful for their state. */
      invalid: string[]
      /** Answers naming a decision this plan does not contain. */
      unknown: string[]
    }

/**
 * Whether the review gate is satisfied.
 *
 * Every decision that requires confirmation must carry one, every answer must be one the decision's
 * state allows, and an answer naming a decision the plan does not contain is rejected rather than
 * ignored — a stale review page whose plan has moved underneath it must fail loudly, not silently
 * apply yesterday's answers to today's decisions.
 */
export function reviewRebuildAcknowledgements(
  plan: CardRebuildPlan,
  acknowledgements: RebuildAcknowledgements,
): RebuildReviewResult {
  const byKey = new Map(plan.decisions.map((decision) => [decision.key, decision]))
  const missing: string[] = []
  const invalid: string[] = []
  const unknown: string[] = []

  for (const key of Object.keys(acknowledgements).sort()) {
    if (!byKey.has(key)) unknown.push(key)
  }

  for (const decision of plan.decisions) {
    const answer = acknowledgements[decision.key]
    if (answer === undefined) {
      if (decision.requiresExplicitConfirmation) missing.push(decision.key)
      continue
    }
    // Every *supplied* answer is checked, including one on a decision that required none. Skipping
    // those let a caller attach `dropped` to a `carried_unchanged` requirement: the answer changed
    // nothing, because `applyRebuildAcknowledgements` only drops what required confirmation — and
    // it was still written verbatim into the card's provenance, which would then record a decision
    // to discard a selection the card in fact carries. Provenance is evidence; an answer that had
    // no effect must not be able to appear in it as though it did.
    if (!allowedAcknowledgements(decision).includes(answer)) invalid.push(decision.key)
  }

  if (missing.length === 0 && invalid.length === 0 && unknown.length === 0) return { ok: true }
  return { ok: false, missing: missing.sort(), invalid: invalid.sort(), unknown: unknown.sort() }
}

/**
 * The builder inputs a reviewed plan produces.
 *
 * Derived from the plan and the answers, never sent by a client: the server recomputes the plan,
 * applies the answers here, and stores the result. `dropped` clears the requirement's selection to
 * an explicit `null` rather than removing the key, because the two are different statements — an
 * absent key on a card whose selections are explicit means nobody has looked, and somebody has.
 *
 * Modules and modifiers are not adjusted here. Turning a module off changes which requirements
 * exist, so it is an input to planning rather than an answer applied afterwards; the plan and its
 * hash would otherwise describe a composition the card does not have.
 */
export function applyRebuildAcknowledgements(
  plan: CardRebuildPlan,
  acknowledgements: RebuildAcknowledgements,
): BuilderInputs {
  return applyAnswersToInputs(plan.decisions, plan.proposedInputs, acknowledgements)
}

/**
 * The same transformation, over the two things it actually needs.
 *
 * Split out so the counterfactual measurement above and the write path below cannot diverge: a
 * contract measured with one notion of "apply this answer" and a card written with another would
 * be a permission for a state that never gets produced, which is exactly the kind of second answer
 * this module exists to avoid.
 */
function applyAnswersToInputs(
  decisions: RebuildDecision[],
  proposedInputs: BuilderInputs,
  acknowledgements: RebuildAcknowledgements,
): BuilderInputs {
  const inputs = proposedInputs
  const selectedHospitalItemIds = { ...(inputs.input.selectedHospitalItemIds ?? {}) }
  const conditionalStates = { ...(inputs.input.conditionalStates ?? {}) }
  const droppedCatalogProductKeys = new Set<string>()
  const droppedFamilyKeys = new Set<string>()
  const droppedCustomIds = new Set<string>()
  const droppedSetIds = new Set<string>()
  const keptCatalogProductKeys = new Set<string>()
  const keptFamilyKeys = new Set<string>()
  const keptCustomIds = new Set<string>()
  const keptSetIds = new Set<string>()

  for (const decision of decisions) {
    if (decision.kind !== 'requirement') continue
    const carried = decision.carriedSelection
    if (!carried || !decision.target) continue
    const answer = acknowledgements[decision.key]
    const dropped = decision.requiresExplicitConfirmation && answer === 'dropped'

    if (dropped) {
      selectedHospitalItemIds[decision.target.slotId] = null
      delete conditionalStates[decision.target.slotId]
    }
    const bucket = dropped ? 'dropped' : 'kept'
    if (carried.kind === 'catalog_product') {
      const key = `${carried.productId}:${carried.roleCode}`
      ;(bucket === 'dropped' ? droppedCatalogProductKeys : keptCatalogProductKeys).add(key)
    }
    if (carried.kind === 'reviewed_family') {
      const key = `${carried.productFamilyVersionId}:${carried.roleCode}`
      ;(bucket === 'dropped' ? droppedFamilyKeys : keptFamilyKeys).add(key)
    }
    if (carried.kind === 'custom_item') {
      ;(bucket === 'dropped' ? droppedCustomIds : keptCustomIds).add(carried.customItemId)
    }
    if (carried.kind === 'equipment_set') {
      ;(bucket === 'dropped' ? droppedSetIds : keptSetIds).add(carried.setId)
    }
  }

  // A pick, a custom line, or a set is dropped only when *every* requirement that carried it was
  // dropped. One product legitimately serves two requirements, and clearing one of them must not
  // take the record the other still points at with it.
  const dropPick = (key: string, kept: Set<string>, dropped: Set<string>) =>
    dropped.has(key) && !kept.has(key)

  return {
    ...inputs,
    input: { ...inputs.input, selectedHospitalItemIds, conditionalStates },
    catalogPicks: inputs.catalogPicks.filter(
      (pick) =>
        !dropPick(
          `${pick.productId}:${canonicalRoleCode(pick.roleCode)}`,
          keptCatalogProductKeys,
          droppedCatalogProductKeys,
        ),
    ),
    familyPicks: inputs.familyPicks.filter((pick) => {
      if (!('productFamilyVersionId' in pick)) return true
      return !dropPick(
        `${pick.productFamilyVersionId}:${canonicalRoleCode(pick.roleCode)}`,
        keptFamilyKeys,
        droppedFamilyKeys,
      )
    }),
    customItems: inputs.customItems.filter(
      (item) => !dropPick(item.id, keptCustomIds, droppedCustomIds),
    ),
    equipmentSets: inputs.equipmentSets.filter(
      (set) => !dropPick(set.id, keptSetIds, droppedSetIds),
    ),
  }
}
