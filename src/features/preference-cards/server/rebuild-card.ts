import { supabaseServer } from '@/lib/supabase/server'

import {
  getHistoricalCatalog,
  historicalFamilyPick,
  resolveHistoricalCatalogPick,
} from '../data/historical-catalog.server'
import { getReviewedProductFamilyVersion } from '../data/product-families.server'
import {
  buildReleaseContext,
  getCurrentReleaseBundle,
  resolveReleaseDefinitions,
} from '../data/release-bundles.server'
import {
  applyRebuildAcknowledgements,
  planCardRebuild,
  proposeRebuildSelection,
  rebuildPlanHash,
  reviewRebuildAcknowledgements,
  type CardRebuildPlan,
  type RebuildAcknowledgements,
  type RebuildProbe,
} from '../domain/card-rebuild-plan'
import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import {
  assertSelectableForNewCard,
  modifierSetDefinitionHash,
  type PreferenceCardReleaseBundle,
  type ReleaseDefinitionSources,
} from '../domain/release-bundle'
import { canonicalRoleCode } from '../domain/role-taxonomy'
import { stableSnapshotHash } from '../domain/stable-hash'
import type { BuildContext, RecipeSlot } from '../domain/types'
import {
  createRebuiltCardRequestSchema,
  type CreateRebuiltCardRequest,
} from '../schemas/card-rebuild'
import {
  carriesUnreconcilableFamilyIdentity,
  isReleasePinned,
  isSupersededBuilderInputsVersion,
  type ReleasePinnedBuilderInputs,
  type ReviewedFamilyPickRef,
} from '../schemas/saved-card'
import { isProductCurrentlyUnselectable } from './catalog'
import { loadCardRevision, type PreferenceCardRevision } from './card-revisions'
import {
  reconcileOperational,
  reconcileRelease,
  type OperationalReconciliationResult,
  type ReleaseReconciliationResult,
} from './reconcile-card'
import { loadUserCard, resolveForSave, type UserCardRecord } from './user-cards'

/**
 * Rebuilding a saved revision as a new card.
 *
 * One exact immutable revision, one explicitly-pointed-at target release, one deterministic plan,
 * one review, and one new draft card. The source card, its revision, its snapshot, its hashes, its
 * share token, and its release pin are all untouched by every path in this file — asserted by the
 * suite rather than intended in a comment.
 *
 * ## Why this is not an upgrade
 *
 * There is no code path here that writes to the source card. A rebuild does not move a card onto a
 * newer release; it produces a *different* card, on the release its procedure currently points at,
 * carrying only what the physician either did not have to look at or has explicitly confirmed. The
 * original stays exactly as it was saved, and stays the card that was printed and shared.
 *
 * That is why the review is a gate rather than a summary. A workflow that carried everything and
 * showed a report afterwards would be an automatic migration with a receipt.
 *
 * ## Why the target is only the pointer
 *
 * `getCurrentReleaseBundle` reads the explicit release pointer for the procedure and nothing else —
 * no version sorting, no newest `publishedAt`, no last entry. A rebuild is the one operation whose
 * whole purpose is to move a card between releases, so the one place it must not improvise is which
 * release it moves to.
 */

export type CardRebuildErrorCode =
  | 'not_found'
  | 'revision_snapshot_unverifiable'
  | 'builder_inputs_unavailable'
  | 'superseded_builder_inputs'
  | 'builder_inputs_not_release_pinned'
  | 'legacy_family_identity'
  | 'source_release_unavailable'
  | 'source_context_unavailable'
  | 'no_current_release'
  | 'already_on_current_release'
  | 'target_release_not_selectable'
  | 'target_release_unavailable'
  | 'target_context_unavailable'
  | 'target_catalog_unavailable'
  | 'module_not_offered'
  | 'modifier_not_offered'

export interface CardRebuildPreparation {
  /** The live card, for its title and for the link back. Never written by this module. */
  record: UserCardRecord
  revision: PreferenceCardRevision
  sourceReleaseBundle: PreferenceCardReleaseBundle
  targetReleaseBundle: PreferenceCardReleaseBundle
  /** The composition this plan was computed for. Echoed back so a replan can quote it. */
  selection: { moduleVersionIds: string[]; modifierCodes: string[] }
  plan: CardRebuildPlan
  planHash: string
  /**
   * The two comparisons the roadmap requires, computed by the reconciliation services rather than
   * re-derived: what today's hospital-local data does to the *revision*, and how the release it
   * pins differs from the one the procedure points at now.
   */
  operational: OperationalReconciliationResult
  release: ReleaseReconciliationResult
  /** Hashes of the two comparisons, recorded in the new card's provenance. */
  operationalHash: string
  releaseDiffHash: string
}

export type CardRebuildPreparationResult =
  | { ok: true; preparation: CardRebuildPreparation }
  | { ok: false; code: CardRebuildErrorCode; message?: string }

/**
 * Which modules the target release offers, with the behaviour it offers them at.
 *
 * Assembled from the recipe's own references joined to the release's pins, so a module the release
 * does not pin cannot reach the plan. `modulePins` and `moduleReferences` are asserted equal by
 * `release-bundle-integrity.test.ts`, and this join is written to survive them ever not being.
 */
function offeredModules(context: BuildContext, bundle: PreferenceCardReleaseBundle) {
  const pinByVersionId = new Map(bundle.modulePins.map((pin) => [pin.moduleVersionId, pin]))
  return context.recipe.moduleReferences
    .map((reference) => {
      const pin = pinByVersionId.get(reference.moduleVersionId)
      if (!pin) return null
      return {
        moduleVersionId: pin.moduleVersionId,
        moduleCode: pin.moduleCode,
        moduleVersion: pin.moduleVersion,
        selectionBehavior: reference.selectionBehavior,
        definitionHash: pin.definitionHash,
      }
    })
    .filter((module): module is NonNullable<typeof module> => module !== null)
    .sort((left, right) => left.moduleVersionId.localeCompare(right.moduleVersionId))
}

/**
 * A definition hash per modifier code.
 *
 * A release pins the modifier set with one hash, which cannot say *which* modifier moved. Hashing
 * each definition on its own through the same canonical set hash gives the per-code answer without
 * a second hashing implementation: a one-element set is exactly the definition of that one
 * modifier, canonicalized the way every other modifier hash in this module is.
 */
function modifierDefinitionHashes(sources: ReleaseDefinitionSources): Record<string, string> {
  return Object.fromEntries(
    sources.modifiers.map((modifier) => [modifier.code, modifierSetDefinitionHash([modifier])]),
  )
}

function composedSlots(context: BuildContext, selectedModuleVersionIds: string[]): RecipeSlot[] {
  return expandRecipeComposition({
    recipe: context.recipe,
    modules: context.recipeModules,
    selectedModuleVersionIds,
    startSequence: 1,
  }).slots
}

/**
 * The availability questions the planner cannot answer from domain data.
 *
 * Every one is asked of the **target** release's retained catalog and of current hospital-local
 * data — never of the source's. Answering from the source catalog would make availability mean
 * "was available when the card was saved", which is exactly the claim the rebuild is trying to
 * re-establish rather than assume.
 */
function createProbe(
  targetContext: BuildContext,
  targetBundle: PreferenceCardReleaseBundle,
  historical: ReturnType<typeof getHistoricalCatalog> & { ok: true },
): RebuildProbe {
  const activeItemIds = new Set(
    targetContext.hospitalItems.filter((item) => item.active).map((item) => item.id),
  )
  const offeredByRole = new Map<string, Set<string>>()
  for (const option of targetContext.hospitalRoleOptions) {
    if (!option.active) continue
    const roleCode = canonicalRoleCode(option.roleCode)
    const set = offeredByRole.get(roleCode) ?? new Set<string>()
    set.add(option.hospitalItemId)
    offeredByRole.set(roleCode, set)
  }

  return {
    hospitalItemOffered(hospitalItemId, roleCode) {
      if (!activeItemIds.has(hospitalItemId)) return false
      return offeredByRole.get(canonicalRoleCode(roleCode))?.has(hospitalItemId) ?? false
    },
    catalogProductAvailable(productId, roleCode) {
      return resolveHistoricalCatalogPick(
        historical,
        productId,
        roleCode,
        isProductCurrentlyUnselectable,
      ).ok
    },
    reviewedFamilyAvailable(ref: ReviewedFamilyPickRef) {
      // Looked up by version id rather than through `resolveProductFamilyPin`, which verifies the
      // pinned hash and therefore cannot tell "the membership moved" from "the family is gone".
      // Those are a review and a failure respectively, and collapsing them would drop a selection
      // the physician could perfectly well have confirmed.
      const version = getReviewedProductFamilyVersion(ref.productFamilyVersionId)
      if (!version) return { ok: false, reason: 'family_version_unavailable' }
      if (version.governanceState === 'draft') {
        return { ok: false, reason: 'family_identity_not_reviewed' }
      }
      if (version.catalogReleaseId !== targetBundle.catalogImportId) {
        return { ok: false, reason: 'family_catalog_release_mismatch' }
      }
      const wanted = canonicalRoleCode(ref.roleCode)
      if (!version.roleCodes.some((role) => canonicalRoleCode(role) === wanted)) {
        return { ok: false, reason: 'family_role_not_covered' }
      }
      if (!historicalFamilyPick(historical, version, ref.roleCode).ok) {
        return { ok: false, reason: 'family_version_unavailable' }
      }
      return {
        ok: true,
        definitionHashChanged: version.definitionHash !== ref.definitionHash,
        definitionHash: version.definitionHash,
        catalogReleaseId: version.catalogReleaseId,
      }
    },
  }
}

/**
 * Everything the rebuild review needs, for one exact revision the caller owns.
 *
 * Row-level security scopes both reads, so a revision that is not the caller's is `not_found` —
 * the same answer an id that does not exist gets, here as everywhere else in this module. The
 * revision is also loaded through `loadCardRevision(cardId, revisionId)`, which refuses a revision
 * whose `card_id` disagrees, so one of the owner's own cards cannot be rebuilt through another's
 * route.
 */
export async function prepareCardRebuild(
  cardId: string,
  revisionId: string,
  requestedSelection?: { moduleVersionIds: string[]; modifierCodes: string[] },
): Promise<CardRebuildPreparationResult> {
  const record = await loadUserCard(cardId)
  if (!record) return { ok: false, code: 'not_found' }

  const revisionResult = await loadCardRevision(cardId, revisionId)
  if (!revisionResult.ok) {
    return {
      ok: false,
      code:
        revisionResult.code === 'snapshot_unverifiable'
          ? 'revision_snapshot_unverifiable'
          : 'not_found',
    }
  }
  const revision = revisionResult.revision

  const inputs = revision.builderInputs
  if (!inputs) return { ok: false, code: 'builder_inputs_unavailable' }
  // A version-2 input predates release pinning entirely; a version-3 one that named a product line
  // named it by a catalogue-browsing key. Neither can be mapped forward without deciding what the
  // physician meant, so neither is offered an automated rebuild.
  if (isSupersededBuilderInputsVersion(inputs.schemaVersion)) {
    return { ok: false, code: 'superseded_builder_inputs' }
  }
  if (!isReleasePinned(inputs)) return { ok: false, code: 'builder_inputs_not_release_pinned' }
  if (carriesUnreconcilableFamilyIdentity(inputs)) {
    return { ok: false, code: 'legacy_family_identity' }
  }
  const pinnedInputs: ReleasePinnedBuilderInputs = inputs

  const source = resolveReleaseDefinitions(pinnedInputs.releaseBundleId)
  if (!source.ok) {
    return { ok: false, code: 'source_release_unavailable', message: source.message }
  }

  const target = getCurrentReleaseBundle(source.bundle.sourceProcedureCode)
  if (!target) return { ok: false, code: 'no_current_release' }
  if (target.id === source.bundle.id) return { ok: false, code: 'already_on_current_release' }
  // `getCurrentReleaseBundle` already refuses a pointer at a draft or retired release, so this is
  // the same check applied where the target is *used*. It is written out because it is the one that
  // still holds if the pointer resolver is ever widened.
  const selectable = assertSelectableForNewCard(target)
  if (!selectable.ok) {
    return { ok: false, code: 'target_release_not_selectable', message: selectable.message }
  }

  const targetDefinitions = resolveReleaseDefinitions(target.id)
  if (!targetDefinitions.ok) {
    return { ok: false, code: 'target_release_unavailable', message: targetDefinitions.message }
  }

  const sourceContext = buildReleaseContext(source.bundle.id, {
    scenarioId: pinnedInputs.scenarioId,
    recipeVersionId: pinnedInputs.input.recipeVersionId,
  })
  if (!sourceContext.ok) {
    return { ok: false, code: 'source_context_unavailable', message: sourceContext.message }
  }

  const targetContext = buildReleaseContext(target.id, {
    scenarioId: target.scenarioId,
    recipeVersionId: target.recipeVersionId,
  })
  if (!targetContext.ok) {
    return { ok: false, code: 'target_context_unavailable', message: targetContext.message }
  }

  const historical = getHistoricalCatalog(target.catalogImportId)
  if (!historical.ok) {
    return { ok: false, code: 'target_catalog_unavailable', message: historical.message }
  }

  const modules = offeredModules(targetContext.context, target)
  const targetShape = {
    slots: [] as RecipeSlot[],
    releaseBundle: target,
    offeredModules: modules,
    allowedModifierCodes: targetContext.context.recipe.allowedModifierCodes,
    modifierDefinitionHashes: modifierDefinitionHashes(targetDefinitions.sources),
  }

  const proposed = proposeRebuildSelection({
    sourceInputs: pinnedInputs,
    sourceBundle: source.bundle,
    target: targetShape,
  })

  // A requested composition is validated against what the target *offers* before it is planned
  // against. The picker hiding a control has never been a security boundary here, and a rebuild
  // is no exception: a module the release does not pin, or a modifier the recipe does not allow,
  // is refused rather than resolved.
  const selection = requestedSelection ?? proposed
  const offeredVersionIds = new Set(modules.map((module) => module.moduleVersionId))
  const requiredVersionIds = modules
    .filter((module) => module.selectionBehavior === 'required')
    .map((module) => module.moduleVersionId)
  for (const moduleVersionId of selection.moduleVersionIds) {
    if (!offeredVersionIds.has(moduleVersionId)) {
      return {
        ok: false,
        code: 'module_not_offered',
        message: `Module ${moduleVersionId} is not part of the target procedure composition.`,
      }
    }
  }
  for (const modifierCode of selection.modifierCodes) {
    if (targetShape.allowedModifierCodes.includes(modifierCode)) continue
    return {
      ok: false,
      code: 'modifier_not_offered',
      message: `Modifier ${modifierCode} is not offered by the target release.`,
    }
  }
  // Required modules are in the composition whatever a request says, so they are added rather than
  // rejected — refusing a request that merely omitted one would be refusing it for a field it is
  // not entitled to decide.
  const effectiveSelection = {
    moduleVersionIds: [...new Set([...selection.moduleVersionIds, ...requiredVersionIds])].sort(),
    modifierCodes: [...new Set(selection.modifierCodes)].sort(),
  }

  targetShape.slots = composedSlots(targetContext.context, effectiveSelection.moduleVersionIds)

  const plan = planCardRebuild({
    source: {
      cardId,
      revisionId,
      revisionNumber: revision.revisionNumber,
      inputs: pinnedInputs,
      card: revision.cardSnapshot,
      slots: composedSlots(sourceContext.context, pinnedInputs.input.selectedModuleVersionIds),
      releaseBundle: source.bundle,
      modifierDefinitionHashes: modifierDefinitionHashes(source.sources),
    },
    target: targetShape,
    selection: effectiveSelection,
    probe: createProbe(targetContext.context, target, historical),
  })

  // The two read-only comparisons, asked of the *revision* rather than of the live card: this
  // review is of one exact state, and the card may have been edited since it was written.
  const revisionRecord = { builderInputs: revision.builderInputs }
  const operational = reconcileOperational(revisionRecord, revision.cardSnapshot)
  const release = reconcileRelease(revisionRecord, revision.cardSnapshot)

  return {
    ok: true,
    preparation: {
      record,
      revision,
      sourceReleaseBundle: source.bundle,
      targetReleaseBundle: target,
      selection: effectiveSelection,
      plan,
      planHash: rebuildPlanHash(plan),
      operational,
      release,
      operationalHash: stableSnapshotHash({ kind: 'rebuild-operational', payload: operational }),
      releaseDiffHash: stableSnapshotHash({ kind: 'rebuild-release-diff', payload: release }),
    },
  }
}

/**
 * The structured record of how a card came to exist.
 *
 * Written once, at creation, and never again. It names the exact state that was rebuilt, the exact
 * definitions on both sides, the hashes of everything that was compared, and one entry per decision
 * the physician answered — so "this card was reviewed" is a thing a later reader can check rather
 * than a thing the interface said at the time.
 */
export interface CardRebuildProvenance {
  version: 'ip-cards-rebuild/1'
  sourceCardId: string
  sourceRevisionId: string
  sourceRevisionNumber: number
  sourceReleaseBundleId: string
  sourceReleaseDefinitionHash: string
  sourceSnapshotHash: string
  sourceSnapshotIntegrityHash: string | null
  sourceResolvedContentHash: string | null
  sourcePrintDocumentHash: string | null
  targetReleaseBundleId: string
  targetReleaseDefinitionHash: string
  targetCatalogReleaseId: string
  operationalReconciliationHash: string
  authoredReleaseDiffHash: string
  mappingPlanHash: string
  decisions: Array<{
    key: string
    kind: string
    state: string
    reasonCodes: string[]
    acknowledgement: string | null
  }>
  createdAt: string
}

export type CreateRebuiltCardResult =
  | { ok: true; cardId: string }
  | {
      ok: false
      code:
        | CardRebuildErrorCode
        | 'plan_moved'
        | 'review_incomplete'
        | 'not_resolvable'
        | 'write_failed'
      message?: string
      /** Present on `review_incomplete`, so the page can say which decisions still need an answer. */
      missing?: string[]
    }

/**
 * Create the new draft card.
 *
 * Everything is recomputed. The request carries a plan hash and a set of answers; the server
 * re-derives the plan from the source revision and the target release, refuses if the hash moved,
 * refuses if any decision requiring an answer did not get one, derives the builder inputs from the
 * plan and the answers, re-resolves through the ordinary save path's resolver, and only then
 * writes. Nothing the client sent describes the card that gets stored.
 */
export async function createRebuiltCard(
  request: CreateRebuiltCardRequest,
): Promise<CreateRebuiltCardResult> {
  const parsed = createRebuiltCardRequestSchema.safeParse(request)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'review_incomplete',
      message: parsed.error.issues[0]?.message ?? 'The rebuild request is invalid.',
    }
  }
  const { cardId, revisionId, selection, planHash, acknowledgements, title, physicianName } =
    parsed.data

  const prepared = await prepareCardRebuild(cardId, revisionId, selection)
  if (!prepared.ok) return { ok: false, code: prepared.code, message: prepared.message }
  const { plan, revision, sourceReleaseBundle, targetReleaseBundle, preparation } = {
    ...prepared.preparation,
    preparation: prepared.preparation,
  }

  if (preparation.planHash !== planHash) {
    return {
      ok: false,
      code: 'plan_moved',
      message:
        'The rebuild plan has changed since this page was opened, so the decisions recorded on it describe choices this rebuild would no longer make. Reload to review the current plan.',
    }
  }

  const review = reviewRebuildAcknowledgements(plan, acknowledgements as RebuildAcknowledgements)
  if (!review.ok) {
    return {
      ok: false,
      code: 'review_incomplete',
      missing: [...review.missing, ...review.invalid, ...review.unknown],
      message:
        'Every changed or unresolved decision has to be answered before a new card can be created.',
    }
  }

  const builderInputs = applyRebuildAcknowledgements(
    plan,
    acknowledgements as RebuildAcknowledgements,
  )

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, code: 'not_found' }

  const generatedAt = new Date().toISOString()
  // The same resolver the builder and the save path use. A rebuild that resolved through anything
  // else would be a second answer to what this card says, and the one place the two disagreed would
  // be the one place it mattered.
  const resolved = resolveForSave(builderInputs, generatedAt)
  if (!resolved.ok) return { ok: false, code: 'not_resolvable', message: resolved.error }

  const provenance: CardRebuildProvenance = {
    version: 'ip-cards-rebuild/1',
    sourceCardId: cardId,
    sourceRevisionId: revisionId,
    sourceRevisionNumber: revision.revisionNumber,
    sourceReleaseBundleId: sourceReleaseBundle.id,
    sourceReleaseDefinitionHash: sourceReleaseBundle.definitionHash,
    sourceSnapshotHash: revision.snapshotHash,
    sourceSnapshotIntegrityHash: revision.snapshotIntegrityHash,
    sourceResolvedContentHash: revision.resolvedContentHash,
    sourcePrintDocumentHash: revision.printDocumentHash,
    targetReleaseBundleId: targetReleaseBundle.id,
    targetReleaseDefinitionHash: targetReleaseBundle.definitionHash,
    targetCatalogReleaseId: targetReleaseBundle.catalogImportId,
    operationalReconciliationHash: preparation.operationalHash,
    authoredReleaseDiffHash: preparation.releaseDiffHash,
    mappingPlanHash: preparation.planHash,
    decisions: plan.decisions.map((decision) => ({
      key: decision.key,
      kind: decision.kind,
      state: decision.state,
      reasonCodes: decision.reasonCodes,
      acknowledgement: acknowledgements[decision.key] ?? null,
    })),
    createdAt: generatedAt,
  }

  // A create, not an overwrite: no id, no share token, no `share_enabled`, no timestamps. Every one
  // comes from a column default, so the new card gets its own identity and its own sharing state
  // and cannot inherit the source's. The revision trigger writes its revision 1.
  const { data, error } = await supabase
    .from('ip_user_preference_cards')
    .insert({
      user_id: user.id,
      title,
      physician_name: physicianName?.trim() ? physicianName.trim() : null,
      procedure_code: resolved.rebuilt.scenario.sourceProcedureCode,
      scenario_id: builderInputs.scenarioId,
      status: 'draft',
      builder_inputs: {
        schemaVersion: builderInputs.schemaVersion,
        releaseBundleId: builderInputs.releaseBundleId,
        scenarioId: builderInputs.scenarioId,
        input: builderInputs.input,
        catalogPicks: builderInputs.catalogPicks,
        familyPicks: builderInputs.familyPicks,
        customItems: builderInputs.customItems,
        equipmentSets: builderInputs.equipmentSets,
      },
      card_snapshot: resolved.card,
      snapshot_hash: resolved.card.snapshotHash,
      engine_version: resolved.card.engineVersion,
      catalog_import_id: resolved.card.catalogImportId,
      rebuild_provenance: provenance,
    })
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, code: 'write_failed', message: error.message }
  if (!data)
    return {
      ok: false,
      code: 'write_failed',
      message: 'The database did not return a card identifier.',
    }
  return { ok: true, cardId: data.id as string }
}
