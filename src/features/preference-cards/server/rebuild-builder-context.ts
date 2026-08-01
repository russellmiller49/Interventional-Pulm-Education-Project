import { buildPinnedContext } from '../data/demo-context.server'
import { buildReleaseContext, type ReleaseContextErrorCode } from '../data/release-bundles.server'
import { withCatalogPicks, type CatalogPick } from '../domain/catalog-pick'
import { withCustomItems } from '../domain/custom-item'
import { withEquipmentSets, type EquipmentSet } from '../domain/equipment-set'
import { withFamilyPicks, type FamilyPick } from '../domain/family-pick'
import { canonicalRoleCode } from '../domain/role-taxonomy'
import type { BuildContext, ScenarioDefinition } from '../domain/types'
import { isReleasePinned, type BuilderInputs } from '../schemas/saved-card'
import type { PreferenceCardReleaseBundle } from '../domain/release-bundle'
import { getFamilyPick, resolveCatalogPick, type CatalogPickLookupResult } from './catalog'

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
 * every one of them is looked up in the authoritative catalog and the pinned composition:
 * a product that is not mapped to the role it claims, a product held out of preference-card
 * selection, a product line that no longer exists, or a module the composition does not
 * offer is an error, not a line on the card.
 */

export type RehydratedBuilderErrorCode =
  | 'unknown_scenario'
  | 'recipe_version_unavailable'
  | 'recipe_module_unavailable'
  | 'scenario_recipe_mismatch'
  | 'module_not_offered'
  | 'catalog_pick_unavailable'
  | 'product_family_unavailable'
  | 'equipment_set_unavailable'
  | ReleaseContextErrorCode

export interface RehydratedBuilderContext {
  ok: true
  scenario: ScenarioDefinition
  /**
   * The release this card resolves through, when it pins one. Null for a version-2 card,
   * which is exact about its recipe and modules and unpinned below that — see
   * `BUILDER_INPUTS_SCHEMA_VERSION`.
   */
  releaseBundle: PreferenceCardReleaseBundle | null
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
  result: Exclude<CatalogPickLookupResult, { ok: true }>,
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
  // The exact definitions the card was built from, never "whatever this procedure means
  // today". A release whose pinned definitions have moved leaves the card view-only rather
  // than quietly re-resolving it against content its author never saw.
  //
  // Two paths, because there are two persisted formats and neither is converted into the
  // other. A version-3 card verifies the whole hashed dependency set; a version-2 card
  // verifies its recipe version and module versions, which is everything it recorded.
  let scenario: ScenarioDefinition
  let context: BuildContext
  let releaseBundle: PreferenceCardReleaseBundle | null = null

  if (isReleasePinned(inputs)) {
    const released = buildReleaseContext(inputs.releaseBundleId, {
      scenarioId: inputs.scenarioId,
      recipeVersionId: inputs.input.recipeVersionId,
    })
    if (!released.ok) return released
    scenario = released.scenario
    context = released.context
    releaseBundle = released.bundle
  } else {
    const pinned = buildPinnedContext(inputs.scenarioId, inputs.input.recipeVersionId)
    if (!pinned.ok) return pinned
    scenario = pinned.scenario
    context = pinned.context
  }

  if (context.recipe.id !== inputs.input.recipeVersionId) {
    return {
      ok: false,
      code: 'scenario_recipe_mismatch',
      message: 'The scenario and recipe do not match.',
    }
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

  const catalogPicks: CatalogPick[] = []
  for (const requested of inputs.catalogPicks) {
    const result = resolveCatalogPick(requested.productId, requested.roleCode)
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
    const pick = getFamilyPick(requested.familyKey, requested.roleCode)
    if (!pick) {
      return {
        ok: false,
        code: 'product_family_unavailable',
        message: `Unknown product line ${requested.familyKey}.`,
      }
    }
    familyPicks.push(pick)
  }

  // The card's own copy of each set it uses. Every member is re-checked against the catalog
  // here rather than taken on the card's word — a set is stored as identifiers for the same
  // reason every other pick is.
  const equipmentSets: EquipmentSet[] = []
  const selectedRoleBySetId: Record<string, string> = {}
  for (const requested of inputs.equipmentSets) {
    const members: CatalogPick[] = []
    for (const member of requested.members) {
      const result = resolveCatalogPick(member.productId, member.roleCode)
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
  // been renamed. `resolveCatalogPick` and `getFamilyPick` canonicalize on the way in, so
  // picks were already covered; a custom line and a set's covered roles carry a role code
  // without going through either, and would otherwise stop matching their requirement —
  // the line would simply vanish from a reopened pre-rename card.
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
    context,
    resolveContext,
    catalogPicks,
    familyPicks,
    equipmentSets,
    selectedRoleBySetId,
    normalizedInputs: inputs,
  }
}
