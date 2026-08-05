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
  unanswerableBlockingDecisions,
  unplannedBlockingConditions,
  type CardRebuildPlan,
  type RebuildAcknowledgements,
  type RebuildProbe,
} from '../domain/card-rebuild-plan'
import { expandEffectiveSlots } from '../domain/effective-slots'
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
import { writeRebuiltCard } from './rebuild-writer.server'
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

/**
 * Every requirement a release expresses for one composition and one modifier selection.
 *
 * `expandEffectiveSlots` is the resolver's own steps 1 to 4, shared rather than approximated — see
 * `domain/effective-slots.ts` for why the previous add-only approximation was wrong on real data.
 *
 * Nothing is deduplicated here. The resolver deduplicates *added* slots by slot id, not by
 * requirement key, so a modifier or rescue module can legitimately produce a second slot claiming a
 * key the composition already expresses. Collapsing that here — which the earlier "first
 * declaration wins" pass did — hid the one case the planner's ambiguity blocker exists to catch:
 * the plan saw one requirement and the card was built with two.
 */
function effectiveSlots(
  context: BuildContext,
  selectedModuleVersionIds: string[],
  modifierCodes: string[],
): RecipeSlot[] {
  return expandEffectiveSlots({ selectedModuleVersionIds, modifierCodes }, context).slots
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
  equipmentSets: readonly {
    id: string
    members: readonly { productId: string; roleCode: string }[]
  }[],
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
    resolveTarget(inputs) {
      // The same resolver the builder and the save path use, so the plan describes the card the
      // save would produce rather than a second opinion about it. `generatedAt` is fixed because
      // it is outside every projection and a clock here would make the plan hash unstable.
      const resolved = resolveForSave(inputs, '1970-01-01T00:00:00.000Z')
      return resolved.ok ? resolved.card : null
    },
    equipmentSetMembersAvailable(setId) {
      const set = equipmentSets.find((candidate) => candidate.id === setId)
      if (!set) return false
      // The same row-by-row check `rebuildBuilderContext` runs at save time, moved forward to
      // planning so the problem is a reviewable decision rather than a late failure.
      return set.members.every(
        (member) =>
          resolveHistoricalCatalogPick(
            historical,
            member.productId,
            member.roleCode,
            isProductCurrentlyUnselectable,
          ).ok,
      )
    },
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

  targetShape.slots = effectiveSlots(
    targetContext.context,
    effectiveSelection.moduleVersionIds,
    effectiveSelection.modifierCodes,
  )

  // The two read-only comparisons, asked of the *revision* rather than of the live card: this
  // review is of one exact state, and the card may have been edited since it was written.
  const revisionRecord = { builderInputs: revision.builderInputs }
  const operational = reconcileOperational(revisionRecord, revision.cardSnapshot)
  const release = reconcileRelease(revisionRecord, revision.cardSnapshot)
  const operationalHash = stableSnapshotHash({ kind: 'rebuild-operational', payload: operational })
  const releaseDiffHash = stableSnapshotHash({ kind: 'rebuild-release-diff', payload: release })

  const plan = planCardRebuild({
    source: {
      cardId,
      revisionId,
      revisionNumber: revision.revisionNumber,
      inputs: pinnedInputs,
      card: revision.cardSnapshot,
      // The source side gets the same treatment, and must: an asymmetric slot list would compare a
      // rescue requirement's definition against nothing and report it changed.
      slots: effectiveSlots(
        sourceContext.context,
        pinnedInputs.input.selectedModuleVersionIds,
        pinnedInputs.input.modifierCodes,
      ),
      releaseBundle: source.bundle,
      modifierDefinitionHashes: modifierDefinitionHashes(source.sources),
    },
    target: targetShape,
    selection: effectiveSelection,
    comparisons: { operationalHash, releaseDiffHash },
    probe: createProbe(targetContext.context, target, historical, pinnedInputs.equipmentSets),
  })

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
      operationalHash,
      releaseDiffHash,
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

const PLAN_MOVED_MESSAGE =
  'The rebuild plan has changed since this page was opened, so the decisions recorded on it describe choices this rebuild would no longer make. Reload to review the current plan.'

export type CreateRebuiltCardResult =
  | { ok: true; cardId: string }
  | {
      ok: false
      code:
        | CardRebuildErrorCode
        | 'plan_moved'
        | 'plan_blocked'
        | 'source_moved'
        | 'review_incomplete'
        | 'not_resolvable'
        | 'write_failed'
      message?: string
      /**
       * Which decisions the refusal is about — the ones still needing an answer on
       * `review_incomplete`, and the ones no answer can dispose of on `plan_blocked`.
       */
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
  if (!prepared.ok) {
    // A composition the target does not offer is `module_not_offered` on the GET path, where it
    // means "this request is malformed". On *submit* it means something else: the only composition
    // a client ever sends back is the one the server itself proposed, so a module that is no longer
    // offered is a target release that moved under an open review — and republishing a module
    // renumbers its version ids, which makes this the most likely shape of a pointer advance.
    // Reported as `plan_moved`, because that is what happened, and because the alternative was a
    // refusal the page rendered no message for: the physician's answers vanished and a fresh plan
    // appeared in their place with nothing saying why.
    // Every way the *target* can move under an open review reads the same to the physician: the
    // plan they answered is not the plan this rebuild would make now. Source-side and
    // authorization failures are deliberately not folded in — those must keep their own
    // nondisclosing answers.
    const movedUnderReview = (
      [
        'module_not_offered',
        'modifier_not_offered',
        'already_on_current_release',
        'no_current_release',
        'target_release_not_selectable',
        'target_release_unavailable',
        'target_context_unavailable',
        'target_catalog_unavailable',
      ] as CardRebuildErrorCode[]
    ).includes(prepared.code)
    return {
      ok: false,
      code: movedUnderReview ? 'plan_moved' : prepared.code,
      message: movedUnderReview ? PLAN_MOVED_MESSAGE : prepared.message,
    }
  }
  const { plan, revision, sourceReleaseBundle, targetReleaseBundle, preparation } = {
    ...prepared.preparation,
    preparation: prepared.preparation,
  }

  if (preparation.planHash !== planHash) {
    return { ok: false, code: 'plan_moved', message: PLAN_MOVED_MESSAGE }
  }

  // Blocking *and* unanswerable: an ambiguous requirement key, where two slots disagree about what
  // one requirement is. There is nothing to acknowledge and no honest card to create, so this is a
  // refusal rather than a decision — checked before the review gate, because a physician should not
  // be asked to answer thirty questions and then told the release itself is malformed.
  const unanswerable = unanswerableBlockingDecisions(plan)
  if (unanswerable.length > 0) {
    return {
      ok: false,
      code: 'plan_blocked',
      missing: unanswerable.map((decision) => decision.key),
      message:
        'This rebuild cannot be planned: the target release expresses a requirement in more than one way, so there is no single requirement to carry a selection onto. Nothing was created.',
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

  // The final invariant, over the card that is actually about to be written.
  //
  // Not a byte comparison against the plan's projection: that projection is of `proposedInputs`, and
  // `builderInputs` differs from it by exactly the physician's answers, so comparing them refused
  // every legitimate use of the drop control. Comparing a re-resolution of `proposedInputs` instead
  // fixed the false positive by comparing a pure function against itself, which could never fail.
  //
  // What must hold is narrower and actually load-bearing: the finished card may not carry a
  // **blocking** condition the review did not show. Answers may legitimately introduce warnings — a
  // dropped selection raises `required_role_unresolved`, which is a warning by design and was
  // acknowledged — but an unreviewed blocking condition means the card nobody read is the card that
  // would exist.
  const unplanned = unplannedBlockingConditions(plan, resolved.card)
  if (unplanned.length > 0) {
    return {
      ok: false,
      code: 'plan_moved',
      message: `${PLAN_MOVED_MESSAGE} (${unplanned.join(', ')})`,
    }
  }

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

  // The one privileged step, and the only write in this file. Everything above ran on the
  // authenticated cookie client under row-level security; this hands the finished, server-computed
  // card to a narrow RPC that re-derives the source facts from the database and refuses if they
  // have moved. `authenticated` cannot insert a provenance-bearing row at all, and a direct
  // `service_role` table insert is refused by a trigger — see the migration.
  const written = await writeRebuiltCard({
    ownerId: user.id,
    sourceCardId: cardId,
    sourceRevisionId: revisionId,
    sourceSnapshotHash: revision.snapshotHash,
    sourceReleaseBundleId: revision.releaseBundleId,
    title,
    physicianName: physicianName?.trim() ? physicianName.trim() : null,
    procedureCode: resolved.rebuilt.scenario.sourceProcedureCode,
    scenarioId: builderInputs.scenarioId,
    builderInputs: {
      schemaVersion: builderInputs.schemaVersion,
      releaseBundleId: builderInputs.releaseBundleId,
      scenarioId: builderInputs.scenarioId,
      input: builderInputs.input,
      catalogPicks: builderInputs.catalogPicks,
      familyPicks: builderInputs.familyPicks,
      customItems: builderInputs.customItems,
      equipmentSets: builderInputs.equipmentSets,
    },
    cardSnapshot: resolved.card,
    snapshotHash: resolved.card.snapshotHash,
    engineVersion: resolved.card.engineVersion,
    catalogImportId: resolved.card.catalogImportId,
    rebuildProvenance: provenance,
  })

  if (!written.ok) {
    return {
      ok: false,
      code: written.code === 'source_moved' ? 'source_moved' : 'write_failed',
      message: written.message,
    }
  }
  return { ok: true, cardId: written.cardId }
}
