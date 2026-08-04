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
  | 'equipment_set_coverage_changed'
  | 'conditional_rule_changed'
  | 'compatibility_rejected'
  | 'resolution_unresolved'
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

function slotIndex(slots: RecipeSlot[]): Map<string, RecipeSlot> {
  const index = new Map<string, RecipeSlot>()
  for (const slot of slots) {
    if (!index.has(slot.requirementKey)) index.set(slot.requirementKey, slot)
  }
  return index
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
 * The plan.
 *
 * Pure and total: the same inputs and the same probe answers produce byte-identical output, which
 * is what makes the plan hash worth checking. Nothing here reads a clock, a database, or a module
 * singleton.
 */
export function planCardRebuild(input: RebuildPlanInput): CardRebuildPlan {
  const { source, target, probe, selection } = input

  const decisions: RebuildDecision[] = []
  const sourceItems = sourceRequirementIndex(source.card)
  const sourceSlots = slotIndex(source.slots)
  const targetSlots = slotIndex(target.slots)
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
    decisions,
    proposedInputs,
    blockingCount: decisions.filter((decision) => decision.blocking).length,
    reviewCount: decisions.filter((decision) => decision.requiresExplicitConfirmation).length,
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
    if (!decision.requiresExplicitConfirmation) continue
    if (answer === undefined) {
      missing.push(decision.key)
      continue
    }
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
  const inputs = plan.proposedInputs
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

  for (const decision of plan.decisions) {
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
