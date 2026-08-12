import {
  getHistoricalCatalog,
  historicalFamilyPick,
  resolveHistoricalCatalogPick,
  type HistoricalPickResult,
} from '../data/historical-catalog.server'
import { resolveProductFamilyPin } from '../data/product-families.server'
import { buildReleaseContext, type ReleaseContextErrorCode } from '../data/release-bundles.server'
import { withCatalogPicks, type CatalogPick } from '../domain/catalog-pick'
import { withCustomItems } from '../domain/custom-item'
import { withEquipmentSets, type EquipmentSet } from '../domain/equipment-set'
import { withFamilyPicks, type FamilyPick } from '../domain/family-pick'
import type { HistoricalCatalog } from '../domain/historical-catalog'
import { LEGACY_FAMILY_IDENTITY_MESSAGE } from '../domain/product-family'
import { roleCanonicalizerFor } from '../domain/role-taxonomy'
import type { BuildContext, ScenarioDefinition } from '../domain/types'
import {
  carriesUnreconcilableFamilyIdentity,
  isReleasePinned,
  isReviewedFamilyPickRef,
  type BuilderInputs,
} from '../schemas/saved-card'
import type { PreferenceCardReleaseBundle } from '../domain/release-bundle'
import { isProductCurrentlyUnselectable } from './catalog'

/**
 * Rebuilding a card's build context from its stored selections.
 *
 * There is exactly one of these, used by both paths that need it — loading a saved card
 * into the builder and re-resolving one on save. Two copies would be two chances for the
 * card a physician *sees* while editing to differ from the card that gets stored, and a
 * preview that disagrees with the saved output is the failure this module exists to
 * prevent.
 *
 * Nothing here trusts the caller for content. Builder inputs carry identifiers only, and
 * every one of them is looked up in authoritative retained data: a product that is not mapped
 * to the role it claims, a product held out of preference-card selection, a product family
 * whose reviewed membership has moved, or a module the composition does not offer is an error,
 * not a line on the card.
 *
 * ## Where "authoritative" now points
 *
 * Product and role identity come from the **pinned catalog release**, not from today's catalog.
 * That is the Phase 4A.1 change and it is the difference between a release bundle that *detects* a
 * catalog move and one that survives it: a product discontinued and dropped from the workbook used
 * to take the identity of every saved pick that named it. Nothing falls back to current catalog
 * data — a retained release that cannot be reconstructed produces a typed failure and a view-only
 * card, because a card silently rebuilt against a product its author never saw is worse than one
 * that will not open.
 *
 * Hospital-local operational state stays current, deliberately and as before: what the room stocks,
 * how the site ranks it, what the location can do. A physician reopening a card should see the
 * requirements they reviewed and the equipment the room has today.
 */

export type RehydratedBuilderErrorCode =
  | 'unknown_scenario'
  | 'builder_inputs_not_release_pinned'
  | 'legacy_family_identity'
  | 'scenario_recipe_mismatch'
  | 'module_not_offered'
  | 'modifier_not_offered'
  | 'historical_catalog_unavailable'
  | 'catalog_pick_unavailable'
  | 'product_family_unavailable'
  | 'equipment_set_unavailable'
  | ReleaseContextErrorCode

export interface RehydratedBuilderContext {
  ok: true
  scenario: ScenarioDefinition
  /**
   * The release this card resolves through. Never null: reconstruction requires a release
   * pin, so an input that does not carry one is refused rather than resolved by a weaker
   * route — see the guard in `rebuildBuilderContext`.
   */
  releaseBundle: PreferenceCardReleaseBundle
  /** The retained catalog the card's product identity was reconstructed from. */
  historicalCatalog: HistoricalCatalog
  /** The pinned composition's context, before any of this card's own picks. */
  context: BuildContext
  /** The same context with every stored pick, custom line, and set folded in. */
  resolveContext: BuildContext
  catalogPicks: CatalogPick[]
  familyPicks: FamilyPick[]
  equipmentSets: EquipmentSet[]
  selectedRoleBySetId: Record<string, string>
  normalizedInputs: BuilderInputs
}

export type RehydratedBuilderContextResult =
  | RehydratedBuilderContext
  | { ok: false; code: RehydratedBuilderErrorCode; message: string }

function catalogPickLookupError(
  result: Exclude<HistoricalPickResult, { ok: true }>,
  location?: string,
): string {
  const suffix = location ? ` ${location}` : ''
  switch (result.code) {
    case 'unknown_product':
      return `Unknown catalog product ${result.productId}${suffix}.`
    case 'unknown_role':
      return `Unknown catalog role ${result.roleCode}${suffix}.`
    case 'product_role_mismatch':
      return `Catalog product ${result.productId} is not mapped to role ${result.roleCode}${suffix}.`
    case 'product_not_slottable':
      return `Catalog product ${result.productId} is not available for preference-card selection${suffix}; it is recorded for reference only.`
  }
}

export function rebuildBuilderContext(
  inputs: BuilderInputs,
  /** Stamped onto rebuilt equipment sets. Not part of what the snapshot hash addresses. */
  timestamp: string,
): RehydratedBuilderContextResult {
  // Reconstruction requires a release pin, and there is no second route.
  //
  // There used to be one: a version-2 card resolved through its recipe version and module
  // versions alone, which is exact as far as it goes and says nothing about the modifier set,
  // rescue modules, compatibility rules, or role table the same card also resolves through.
  // Keeping that route once version 2 became view-only would have left a weaker reconstruction
  // path in the codebase that nothing could reach on purpose and something could reach by
  // accident. Refusing here means both callers — reopening and saving — get the invariant.
  if (!isReleasePinned(inputs)) {
    return {
      ok: false,
      code: 'builder_inputs_not_release_pinned',
      message:
        'This card was built before releases pinned the full rule set, so it cannot be rebuilt without resolving it against definitions it never recorded.',
    }
  }

  // A version-3 card that selected a product line names it by a discovery grouping key. Turning
  // one into a reviewed family would mean deciding which products that key stands for today — by
  // label, by manufacturer-plus-role, or by resemblance — and each of those is a guess about what
  // a physician is asking the room for. The card keeps viewing and printing from its snapshot.
  if (carriesUnreconcilableFamilyIdentity(inputs)) {
    return {
      ok: false,
      code: 'legacy_family_identity',
      message: LEGACY_FAMILY_IDENTITY_MESSAGE,
    }
  }

  const released = buildReleaseContext(inputs.releaseBundleId, {
    scenarioId: inputs.scenarioId,
    recipeVersionId: inputs.input.recipeVersionId,
  })
  if (!released.ok) return released
  const { scenario, context, bundle: releaseBundle } = released

  // Every role code below — stored picks, family pins, set members, custom lines — is
  // canonicalized with the *release's* resolved alias table, carried on the context it was
  // built from. The live table never participates: a role's meaning inside this card is part
  // of what its release pin froze (P92-C1).
  const canonicalRoleCode = roleCanonicalizerFor(context.roleCodeAliases)

  if (context.recipe.id !== inputs.input.recipeVersionId) {
    return {
      ok: false,
      code: 'scenario_recipe_mismatch',
      message: 'The scenario and recipe do not match.',
    }
  }

  // The catalog the card was saved against, verified row by row. A failure here is typed and
  // final: there is no fallback to the current catalog, because substituting it is exactly the
  // silent behaviour the pin exists to prevent.
  const historical = getHistoricalCatalog(releaseBundle.catalogImportId)
  if (!historical.ok) {
    return { ok: false, code: 'historical_catalog_unavailable', message: historical.message }
  }

  // The client sends module *ids*; the authored modules are reloaded from the pinned
  // composition and re-expanded, so a caller can never write its own module names,
  // versions, or slot contents into a stored card. A module the composition does not offer
  // is rejected before resolution rather than surfaced as a card warning.
  const offeredModuleVersionIds = new Set(
    context.recipe.moduleReferences.map((reference) => reference.moduleVersionId),
  )
  for (const moduleVersionId of inputs.input.selectedModuleVersionIds) {
    if (offeredModuleVersionIds.has(moduleVersionId)) continue
    return {
      ok: false,
      code: 'module_not_offered',
      message: `Module ${moduleVersionId} is not part of this procedure composition.`,
    }
  }

  // The same wall the modules go through. A modifier code is a permission the release
  // granted, so a code the pinned recipe does not offer is rejected before resolution rather
  // than surfaced as a card warning — and rejected on the server, because the picker hiding a
  // control has never been a security boundary.
  const offeredModifierCodes = new Set(context.recipe.allowedModifierCodes)
  for (const modifierCode of inputs.input.modifierCodes) {
    if (offeredModifierCodes.has(modifierCode)) continue
    return {
      ok: false,
      code: 'modifier_not_offered',
      message: `Modifier ${modifierCode} is not offered by this procedure release.`,
    }
  }

  const catalogPicks: CatalogPick[] = []
  for (const requested of inputs.catalogPicks) {
    const result = resolveHistoricalCatalogPick(
      historical,
      requested.productId,
      requested.roleCode,
      isProductCurrentlyUnselectable,
      canonicalRoleCode,
    )
    if (!result.ok) {
      return {
        ok: false,
        code: 'catalog_pick_unavailable',
        message: catalogPickLookupError(result),
      }
    }
    catalogPicks.push(result.pick)
  }

  const familyPicks: FamilyPick[] = []
  for (const requested of inputs.familyPicks) {
    // The schema already rejects a discovery key at version 4; this is the type-level twin, and
    // it is here rather than assumed because `familyPicks` is a union and a future reader should
    // not have to prove the refinement ran.
    if (!isReviewedFamilyPickRef(requested)) {
      return { ok: false, code: 'legacy_family_identity', message: LEGACY_FAMILY_IDENTITY_MESSAGE }
    }
    // Every part of the pin is re-verified: which family, which catalog release, which membership
    // hash, which role. A client that altered any of them gets this, not a card.
    const resolved = resolveProductFamilyPin(requested, canonicalRoleCode)
    if (!resolved.ok) {
      return { ok: false, code: 'product_family_unavailable', message: resolved.message }
    }
    // Retired families still reconstruct — retirement governs what a *new* card may select, which
    // the create path checks — but the card's membership must come from the catalog release the
    // family was reviewed against, and the card must be pinned to that same release.
    if (resolved.version.catalogReleaseId !== releaseBundle.catalogImportId) {
      return {
        ok: false,
        code: 'product_family_unavailable',
        message: `Product family ${resolved.version.productFamilyVersionId} was reviewed against catalog release ${resolved.version.catalogReleaseId}, which is not the release ${releaseBundle.id} pins.`,
      }
    }
    const pick = historicalFamilyPick(
      historical,
      resolved.version,
      requested.roleCode,
      canonicalRoleCode,
    )
    if (!pick.ok) {
      return { ok: false, code: 'product_family_unavailable', message: pick.message }
    }
    familyPicks.push(pick.pick)
  }

  // The card's own copy of each set it uses. Every member is re-checked against the pinned
  // catalog release here rather than taken on the card's word — a set is stored as identifiers
  // for the same reason every other pick is.
  const equipmentSets: EquipmentSet[] = []
  const selectedRoleBySetId: Record<string, string> = {}
  for (const requested of inputs.equipmentSets) {
    const members: CatalogPick[] = []
    for (const member of requested.members) {
      const result = resolveHistoricalCatalogPick(
        historical,
        member.productId,
        member.roleCode,
        isProductCurrentlyUnselectable,
        canonicalRoleCode,
      )
      if (!result.ok) {
        return {
          ok: false,
          code: 'equipment_set_unavailable',
          message: catalogPickLookupError(result, `in set "${requested.name}"`),
        }
      }
      members.push(result.pick)
    }
    equipmentSets.push({
      id: requested.id,
      name: requested.name,
      description: requested.description ?? null,
      members,
      additionalCoveredRoles: requested.additionalCoveredRoles.map(canonicalRoleCode),
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    selectedRoleBySetId[requested.id] = canonicalRoleCode(requested.selectedRoleCode)
  }

  // Role aliases are permanent, and a stored card can name a role by a code that has since
  // been renamed. The pick resolvers canonicalize on the way in, so picks were already covered;
  // a custom line and a set's covered roles carry a role code without going through one, and
  // would otherwise stop matching their requirement — the line would simply vanish from a
  // reopened pre-rename card.
  const customItems = inputs.customItems.map((item) => ({
    ...item,
    roleCode: canonicalRoleCode(item.roleCode),
  }))

  const resolveContext = withEquipmentSets(
    withCustomItems(
      withFamilyPicks(withCatalogPicks(context, catalogPicks), familyPicks),
      customItems,
    ),
    equipmentSets,
    selectedRoleBySetId,
  )

  return {
    ok: true,
    scenario,
    releaseBundle,
    historicalCatalog: historical,
    context,
    resolveContext,
    catalogPicks,
    familyPicks,
    equipmentSets,
    selectedRoleBySetId,
    normalizedInputs: inputs,
  }
}
