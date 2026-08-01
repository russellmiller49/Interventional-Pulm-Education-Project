import catalogReleaseJson from '../../../../data/ip-preference-cards/generated/catalog-release.json'
import generatedModifiersJson from '../../../../data/ip-preference-cards/generated/modifier-definitions.json'
import generatedScenariosJson from '../../../../data/ip-preference-cards/generated/scenarios.json'
import moduleLedgerJson from '../../../../data/ip-preference-cards/generated/module-ledger.json'
import recipeModulesJson from '../../../../data/ip-preference-cards/generated/recipe-modules.json'
import procedureCompositionsJson from '../../../../data/ip-preference-cards/generated/procedure-compositions.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import coverageJson from '../../../../data/ip-preference-cards/generated/coverage-report.json'
import importReportJson from '../../../../data/ip-preference-cards/generated/import-report.json'
import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import verificationBacklogJson from '../../../../data/ip-preference-cards/generated/verification-backlog.json'

import {
  defaultSelectedModuleVersionIds,
  expandDefaultRecipeComposition,
} from '../domain/expand-recipe-composition'
import { selectionsFromResolvedCard } from '../domain/hospital-selection'
import { resolveRetainedModules, type ModuleLedger } from '../domain/module-ledger'
import type { ReleaseDefinitionSources } from '../domain/release-bundle'
import {
  LEGACY_ROLE_CATEGORY_MAP,
  ROLE_CATEGORIES,
  ROLE_CATEGORY_OVERRIDES,
  ROLE_CODE_ALIASES,
} from '../domain/role-taxonomy'
import {
  CUSTOM_COMPOSITION_PROCEDURE_CODE,
  CUSTOM_COMPOSITION_RECIPE_ID,
  CUSTOM_COMPOSITION_SCENARIO_ID,
} from './scenario-ids'
import { resolveCard } from '../domain/resolve-card'
import type {
  BuildCardInput,
  BuildContext,
  CatalogProductSummary,
  ModifierAction,
  ModifierDefinition,
  HospitalItem,
  HospitalRoleOption,
  ProcedureCompositionAction,
  RecipeModuleReference,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
  ResolvedCard,
  ScenarioDefinition,
} from '../domain/types'
import {
  DEMO_LOCATION_ID,
  DEMO_ORGANIZATION_ID,
  DEMO_SITE_ID,
  demoHospitalItemSeeds,
  operationalModifiers,
  rescueModules,
  typedCompatibilityRules,
} from '../seed/operational'

interface CatalogProductRow {
  product_id: string
  manufacturer: string | null
  product_name: string
  catalog_number: string | null
  gtin: string | null
  verification_status: string | null
  visibility_state: 'prototype_visible' | 'hidden'
  min_working_channel_mm: number | null
  delivery_system_od_mm: number | null
  primary_source_id: string | null
  primary_source_location: string | null
}

/**
 * A generated composition, addressed by the recipe version it publishes.
 *
 * It carries the recipe's whole identity — name, version, template version, owner — rather
 * than having the runtime reassemble it from `scenarios.json` and `procedures.json`. Those
 * are regenerated on every workbook import, and `recipeName` lands in the resolved card and
 * inside its snapshot hash, so reading them at resolution time made a scenario retitle able
 * to move a saved card's identity with its pin untouched.
 */
interface GeneratedProcedureComposition {
  recipeVersionId: string
  scenarioId: string
  procedureCode: string
  version: string
  recipeName: string
  recipeVersion: string
  sourceTemplateVersion: string
  governanceState: RecipeVersion['governanceState']
  clinicalOwner: string | null
  allowedModifierCodes: string[]
  moduleReferences: RecipeModuleReference[]
  compositionActions: ProcedureCompositionAction[]
  /** The reviewed template's setup order, keyed by `requirementKey`. */
  requirementSequences: Record<string, number>
}

interface ImportReport {
  workbook_sha256: string
}

interface CoverageProcedure {
  procedureCode: string
  requiredCatalogCoverageCount: number
  requiredDefaultOptionCoverageCount: number
  requiredSlotCount: number
}

export interface VerificationBacklogRow {
  priority: string | null
  workstream: string | null
  review_status: string | null
  product_id: string
  manufacturer: string | null
  product_name: string | null
  catalog_number: string | null
  existing_gtin_audit: string | null
  roles: string | null
  procedures: string | null
  current_verification_status: string | null
  current_live_status: string | null
  gudid_result: string | null
  match_confidence: string | null
  suggested_primary_di: string | null
  distribution_status: string | null
  verification_remaining: string | null
  recommended_action: string | null
  decision: string | null
  evidence_url: string | null
  notes: string | null
}

interface ProductRoleRow {
  product_id: string
  role_code: string
  role_fit: string | null
  notes: string | null
}

const products = productsJson as CatalogProductRow[]
const productRoles = productRolesJson as ProductRoleRow[]
const importReport = importReportJson as ImportReport
const coverageProcedures = (coverageJson as { procedures: CoverageProcedure[] }).procedures
const verificationBacklog = verificationBacklogJson as VerificationBacklogRow[]
const recipeModules = recipeModulesJson as unknown as RecipeModuleVersion[]

/**
 * Every module version a pin can name: everything the current composition build produces, plus
 * everything the retention ledger froze when a release published it.
 *
 * The union is what lets a superseded module version outlive the composition that referenced
 * it. Preferring the live copy where both exist is safe only because the release build fails
 * when the two disagree — otherwise this would be a route for an edited definition to reach a
 * card that pinned the frozen one.
 */
const recipeModuleById = resolveRetainedModules(
  new Map(recipeModules.map((module) => [module.id, module])),
  moduleLedgerJson as unknown as ModuleLedger,
)
const generatedCompositions =
  procedureCompositionsJson as unknown as GeneratedProcedureComposition[]

/**
 * Every composition the generated data retains, keyed by the recipe version a card pins.
 *
 * A map keyed by *procedure* was the structural reason a superseded composition could not be
 * kept: one procedure, one entry, and republishing overwrote the definition a saved card was
 * pinned to. Keying on the recipe version lets a procedure retain as many as it has published,
 * and makes the id a card stores address exactly one of them. Uniqueness is asserted at load
 * rather than assumed — two entries claiming one version would make a pin ambiguous.
 */
const compositionByRecipeVersionId = (() => {
  const index = new Map<string, GeneratedProcedureComposition>()
  for (const composition of generatedCompositions) {
    const existing = index.get(composition.recipeVersionId)
    if (existing) {
      throw new Error(
        `Recipe version ${composition.recipeVersionId} is published by both the ${existing.procedureCode} and ${composition.procedureCode} compositions. A pinned recipe version must identify exactly one composition.`,
      )
    }
    index.set(composition.recipeVersionId, composition)
  }
  return index
})()

const productById = new Map(products.map((product) => [product.product_id, product]))
/**
 * Scenarios and the informational modifier tags are generated from the workbook by
 * `npm run ip-cards:scenarios`, so every imported procedure is buildable without a code
 * change. The twelve hand-tuned modifiers in seed/operational.ts carry real actions and
 * win on code collision.
 */
const scenarioDefinitions = generatedScenariosJson as unknown as ScenarioDefinition[]
const scenarioById = new Map(scenarioDefinitions.map((scenario) => [scenario.id, scenario]))

const generatedModifierDefinitions = generatedModifiersJson as unknown as ModifierDefinition[]
const handTunedModifierCodes = new Set(operationalModifiers.map((modifier) => modifier.code))
const allModifierDefinitions: ModifierDefinition[] = [
  ...operationalModifiers,
  ...generatedModifierDefinitions.filter((modifier) => !handTunedModifierCodes.has(modifier.code)),
].sort((left, right) => left.code.localeCompare(right.code))

/**
 * The modifier definitions a recipe permits, in the merged set's own order.
 *
 * `allowedModifierCodes` is authored clinical governance frozen into the composition and
 * pinned by `recipeDefinitionHash`, so this filter is the release's permission being applied
 * rather than a convenience.
 */
function allowedModifiers(recipe: RecipeVersion): ModifierDefinition[] {
  const allowed = new Set(recipe.allowedModifierCodes)
  return allModifierDefinitions.filter((modifier) => allowed.has(modifier.code))
}

function catalogProductSummary(productId: string | undefined): CatalogProductSummary | null {
  if (!productId) return null
  const product = productById.get(productId)
  if (!product) {
    throw new Error(`Demo hospital item references missing product ${productId}.`)
  }
  return {
    productId: product.product_id,
    manufacturer: product.manufacturer,
    productName: product.product_name,
    catalogNumber: product.catalog_number,
    gtin: product.gtin,
    verificationStatus: product.verification_status,
    visibilityState: product.visibility_state,
    minWorkingChannelMm: product.min_working_channel_mm,
    deliverySystemOdMm: product.delivery_system_od_mm,
    sourceId: product.primary_source_id,
    sourceLocation: product.primary_source_location,
  }
}

function hospitalItems(): HospitalItem[] {
  return demoHospitalItemSeeds.map((seed) => {
    const catalogProduct = catalogProductSummary(seed.catalogProductId)
    return {
      id: seed.id,
      organizationId: DEMO_ORGANIZATION_ID,
      siteId: DEMO_SITE_ID,
      locationId: DEMO_LOCATION_ID,
      itemType: seed.itemType,
      roleCode: seed.roleCode,
      catalogProduct,
      localItemNumber: seed.localItemNumber ?? null,
      localDescription: seed.localDescription,
      localUom: seed.localUom ?? null,
      storageLocation: seed.storageLocation ?? null,
      // A product the workbook holds out of dropdowns is shown as unverified rather than
      // withheld; the card flags it instead of blocking on it.
      verificationState:
        catalogProduct?.visibilityState === 'hidden' ? 'unverified' : seed.verificationState,
      active: true,
      notes: seed.rationale,
      attributes: {
        ...(seed.attributes ?? {}),
        delivery_system_od_mm: catalogProduct?.deliverySystemOdMm ?? null,
        min_working_channel_mm: catalogProduct?.minWorkingChannelMm ?? null,
      },
      kitComponents: seed.kitComponents?.map((component) => ({ ...component })) ?? [],
    }
  })
}

function roleOptions(): HospitalRoleOption[] {
  return demoHospitalItemSeeds.map((seed, index) => ({
    id: `demo-role-option-${String(index + 1).padStart(3, '0')}`,
    roleCode: seed.roleCode,
    hospitalItemId: seed.id,
    preferenceRank: seed.preferenceRank ?? 1,
    substitutionClass: seed.substitutionClass ?? 'preferred',
    noSubstitute: seed.substitutionClass === 'no_substitute',
    active: true,
    rationale: seed.rationale,
  }))
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

function cloneModule(version: RecipeModuleVersion): RecipeModuleVersion {
  return { ...version, slots: version.slots.map(cloneSlot) }
}

/**
 * The "build a card from modules yourself" entry point. It is a real composition like any
 * other — every module offered as `optional`, nothing required — so the server validates a
 * custom selection through exactly the same wall as a standard procedure, and a custom card
 * re-resolves from its stored module ids with no special case.
 */
const customCompositionScenario: ScenarioDefinition = {
  id: CUSTOM_COMPOSITION_SCENARIO_ID,
  title: 'Custom card from modules',
  recipeName: 'Custom module composition',
  shortDescription:
    'Assemble a card from reusable setup modules yourself. Nothing is suggested for you — the module descriptions are what the reviewers wrote.',
  recipeVersionId: CUSTOM_COMPOSITION_RECIPE_ID,
  sourceProcedureCode: CUSTOM_COMPOSITION_PROCEDURE_CODE,
  templateVersion: '1.0',
  defaultModifierCodes: [],
  // Modifiers target slots authored by a specific procedure template. Offering them on a
  // free-form module selection would let a modifier land somewhere nobody reviewed.
  availableModifierCodes: [],
  requiredCatalogCoverageCount: 0,
  requiredCatalogCoveragePercentage: 0,
  requiredSlotsWithoutCatalogProducts: [],
  roleCodesWithoutCatalogProducts: [],
  requiredDefaultOptionCoverageCount: 0,
  requiredDefaultOptionCoveragePercentage: 0,
  requiredSlotsWithoutDefaultOptions: [],
  requiredCustomAllowedCount: 0,
  slotCount: 0,
  requiredSlotCount: 0,
  governanceState: 'draft',
  owner: null,
}

function customCompositionRecipe(): RecipeVersion {
  return {
    id: CUSTOM_COMPOSITION_RECIPE_ID,
    sourceProcedureCode: CUSTOM_COMPOSITION_PROCEDURE_CODE,
    sourceTemplateVersion: '1.0',
    name: customCompositionScenario.recipeName,
    version: '1.0',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    // Modifiers target slots authored by a specific procedure template, so a free-form module
    // selection offers none. Same statement as `availableModifierCodes` on the scenario, now
    // in the place the server actually enforces.
    allowedModifierCodes: [],
    catalogImportId: importReport.workbook_sha256,
    slots: [],
    moduleReferences: recipeModules.map((version, index) => ({
      moduleVersionId: version.id,
      selectionBehavior: 'optional' as const,
      sequence: (index + 1) * 10,
    })),
    compositionActions: [],
    // No procedure template authored this card, so nothing has a reviewed position and
    // every line falls back to the module band. That is the honest ordering for a card
    // the builder assembled: grouped by module, in the order the modules were offered.
    requirementSequences: {},
  }
}

/**
 * The recipe a composition publishes, built from the composition and nothing else.
 *
 * `catalogImportId` is the one field taken from ambient state, and deliberately so: the
 * catalog is independently versioned content on its own cadence, and a release bundle records
 * which import it was published against rather than pretending the recipe owns it.
 */
function recipeForComposition(composition: GeneratedProcedureComposition): RecipeVersion {
  return {
    id: composition.recipeVersionId,
    sourceProcedureCode: composition.procedureCode,
    sourceTemplateVersion: composition.sourceTemplateVersion,
    name: composition.recipeName,
    version: composition.recipeVersion,
    governanceState: composition.governanceState,
    clinicalOwner: composition.clinicalOwner,
    operationalOwner: null,
    allowedModifierCodes: [...composition.allowedModifierCodes],
    catalogImportId: importReport.workbook_sha256,
    // Every imported procedure is fully composed; direct slots stay available for the
    // unusual requirement that belongs to one procedure and nothing else.
    slots: [],
    moduleReferences: composition.moduleReferences.map((reference) => ({ ...reference })),
    compositionActions: composition.compositionActions.map((action) => ({
      ...action,
      payload: { ...action.payload },
    })),
    requirementSequences: { ...composition.requirementSequences },
  }
}

/**
 * The recipe for an exact recipe version id. Null when that version is not retained — never
 * a newer publication of the same procedure.
 */
export function recipeForRecipeVersionId(recipeVersionId: string): RecipeVersion | null {
  if (recipeVersionId === CUSTOM_COMPOSITION_RECIPE_ID) return customCompositionRecipe()
  const composition = compositionByRecipeVersionId.get(recipeVersionId)
  return composition ? recipeForComposition(composition) : null
}

/** The recipe version a scenario currently publishes. Used to *start* a card, never to reopen one. */
function recipeForScenario(scenario: ScenarioDefinition): RecipeVersion {
  const recipe = recipeForRecipeVersionId(scenario.recipeVersionId)
  if (!recipe) {
    throw new Error(
      `Scenario "${scenario.id}" names recipe version ${scenario.recipeVersionId}, which has no reviewed composition. Run "npm run ip-cards:compositions".`,
    )
  }
  return recipe
}

function modulesForRecipe(recipe: RecipeVersion): RecipeModuleVersion[] {
  return recipe.moduleReferences.map((reference) => {
    const moduleVersion = recipeModuleById.get(reference.moduleVersionId)
    if (!moduleVersion) {
      throw new Error(
        `Recipe ${recipe.id} references module version ${reference.moduleVersionId}, which is missing from generated data.`,
      )
    }
    return cloneModule(moduleVersion)
  })
}

export function getScenarioDefinition(id: string): ScenarioDefinition | null {
  if (id === CUSTOM_COMPOSITION_SCENARIO_ID) {
    return {
      ...customCompositionScenario,
      defaultModifierCodes: [],
      availableModifierCodes: [],
      requiredSlotsWithoutCatalogProducts: [],
      roleCodesWithoutCatalogProducts: [],
      requiredSlotsWithoutDefaultOptions: [],
    }
  }
  return scenarioById.get(id) ?? null
}

/**
 * Every retained composition names a scenario that exists.
 *
 * Asserted at module load rather than discovered when someone reopens a card: a composition
 * whose scenario has been removed cannot be presented, and finding that out at read time would
 * mean finding it out one card at a time.
 */
;(() => {
  for (const composition of generatedCompositions) {
    if (scenarioById.has(composition.scenarioId)) continue
    throw new Error(
      `Composition ${composition.recipeVersionId} names scenario "${composition.scenarioId}", which the generated scenarios do not define.`,
    )
  }
})()

/**
 * The effective requirement list a scenario starts from, before modifiers and resolution.
 *
 * This is what an administrator sees as the read-only effective preview of a composition:
 * the procedure's own requirements plus everything it inherits, each carrying the module
 * it came from.
 */
export function getComposedRecipeSlots(scenarioId: string): RecipeSlot[] {
  const context = buildDemoContext(scenarioId)
  // Sorted the way the resolver sorts, so the administrative preview is the order a card
  // actually prints in. Expansion returns slots in the order it added them — by module —
  // and showing that would be showing an assembly detail as if it were the setup order.
  return expandDefaultRecipeComposition(context).slots.sort(
    (left, right) => left.setupSequence - right.setupSequence || left.id.localeCompare(right.id),
  )
}

/** Every authored module version, for the administrative composition overview. */
export function getRecipeModuleCatalog(): RecipeModuleVersion[] {
  return recipeModules.map(cloneModule)
}

/**
 * The catalog release the generated data currently is, as a content digest.
 *
 * Not `import-report.json`'s `workbook_sha256`, which identifies the source workbook rather
 * than the catalog: the additions, override, taxonomy, and remediation passes all rewrite
 * product identity, role mappings, and slotting governance downstream of the import, and each
 * of those can change whether a saved card's pick still resolves — while the workbook digest
 * does not move at all. See `scripts/ip-preference-cards/catalog-release-id.ts`.
 *
 * `RecipeVersion.catalogImportId` deliberately keeps carrying the workbook digest. The two
 * answer different questions: that one is provenance ("which workbook did this come from"),
 * printed on the card; this one is a release identity ("which catalog is this").
 */
export function getCatalogReleaseId(): string {
  return (catalogReleaseJson as { catalogReleaseId: string }).catalogReleaseId
}

/**
 * The complete set of immutable authored definitions a release bundle pins for one recipe
 * version — the dependency closure of everything a card resolves through that is *not*
 * hospital-local-current and *not* purely presentational.
 *
 * `modifiers` is the merged effective set rather than the hand-tuned seed alone, because the
 * merge is what `resolveCard` sees. The four whole-set dependencies below it — modifiers,
 * rescue modules, typed compatibility rules, and the role alias table — reach the resolver
 * from module-level constants with no version of their own, which is exactly why a release
 * has to hash them: editing a compatibility rule changes what an already-saved card
 * re-resolves to while its recipe and module pins sit untouched.
 *
 * Returns null when the recipe version is not retained. It never falls back to another one.
 */
export function getReleaseDefinitionSources(
  recipeVersionId: string,
  /**
   * Passed in rather than read here, because the release build recomputes the implementation
   * digest from source in the same process that writes it. Reading a generated file at module
   * load would hand the build a value one run out of date and freeze it into a bundle.
   */
  resolverContract: { version: string; implementationHash: string },
): ReleaseDefinitionSources | null {
  const recipe = recipeForRecipeVersionId(recipeVersionId)
  if (!recipe) return null

  const modules: RecipeModuleVersion[] = []
  for (const reference of recipe.moduleReferences) {
    const moduleVersion = recipeModuleById.get(reference.moduleVersionId)
    // A missing module version is reported by the caller as a broken pin, never swapped for
    // a newer publication of the same module code.
    if (!moduleVersion) return null
    modules.push(cloneModule(moduleVersion))
  }

  return {
    recipe,
    modules,
    modifiers: allModifierDefinitions,
    rescueModules,
    compatibilityRules: typedCompatibilityRules,
    roleTaxonomy: {
      categories: ROLE_CATEGORIES,
      legacyCategoryMap: LEGACY_ROLE_CATEGORY_MAP,
      categoryOverrides: ROLE_CATEGORY_OVERRIDES,
      roleCodeAliases: ROLE_CODE_ALIASES,
    },
    catalogImportId: getCatalogReleaseId(),
    resolverContractVersion: resolverContract.version,
    resolverImplementationHash: resolverContract.implementationHash,
  }
}

export function getProcedureCompositions(): GeneratedProcedureComposition[] {
  return [...compositionByRecipeVersionId.values()].map((composition) => ({
    ...composition,
    moduleReferences: composition.moduleReferences.map((reference) => ({ ...reference })),
    compositionActions: composition.compositionActions.map((action) => ({
      ...action,
      payload: { ...action.payload },
    })),
    requirementSequences: { ...composition.requirementSequences },
  }))
}

export function getScenarioDefinitions(): ScenarioDefinition[] {
  // Catalog coverage and curated-default coverage are generated from one shared pure helper.
  // Neither metric is a resolved-card readiness state.
  return scenarioDefinitions.map((scenario) => ({
    ...scenario,
    defaultModifierCodes: [...scenario.defaultModifierCodes],
    availableModifierCodes: [...scenario.availableModifierCodes],
    requiredSlotsWithoutCatalogProducts: [...scenario.requiredSlotsWithoutCatalogProducts],
    roleCodesWithoutCatalogProducts: [...scenario.roleCodesWithoutCatalogProducts],
    requiredSlotsWithoutDefaultOptions: [...scenario.requiredSlotsWithoutDefaultOptions],
  }))
}

export function buildDemoContext(scenarioId: string): BuildContext {
  const scenario = getScenarioDefinition(scenarioId)
  if (!scenario) throw new Error(`Unknown preference-card scenario "${scenarioId}".`)
  return buildContextForRecipe(recipeForScenario(scenario))
}

/**
 * The build context for an exact recipe version.
 *
 * Everything below the recipe is either immutable authored content pinned by a release
 * bundle (`recipeModules`, `modifiers`, `rescueModules`, `compatibilityRules`) or
 * intentionally current hospital-local content (`hospitalItems`, `hospitalRoleOptions`,
 * `locationCapabilities`, the organization/site/location names, `preferenceOverlays`). That
 * split is not incidental and is asserted by `release-bundle.test.ts`: a card must
 * reconstruct against the clinical content its author reviewed, and against the equipment
 * the room actually has today.
 */
export function buildContextForRecipe(
  recipe: RecipeVersion,
  /**
   * The release this context is being assembled for, when there is one.
   *
   * Passed in rather than looked up: the release index lives in `release-bundles.server.ts`, which
   * imports this module, and reaching back for it here would close the cycle. Absent for the demo
   * scenarios, the administrative composition preview, and the generated fixtures — all of which
   * resolve honestly with null provenance rather than borrowing a release nobody selected.
   */
  releaseIdentity: BuildContext['releaseIdentity'] = null,
): BuildContext {
  return {
    organizationName: 'Demo IP Program',
    siteName: 'Demo Hospital',
    locationName: 'Bronchoscopy Suite 1',
    locationCapabilities: ['rigid_bronchoscopy', 'jet_ventilation', 'fluoroscopy'],
    releaseIdentity,
    recipe,
    recipeModules: modulesForRecipe(recipe),
    // Only the modifiers this recipe offers reach the resolver. The picker already hid the
    // rest, but hiding a control is not authorization — a crafted request naming a real
    // modifier the procedure never offered used to be applied and stored, because the
    // resolver looked codes up in the whole merged set. Now the permission the release pinned
    // is what builds the context, so an unauthorized code has nothing to resolve against.
    modifiers: allowedModifiers(recipe).map((modifier) => ({
      ...modifier,
      preview: [...modifier.preview],
      conflictsWith: [...modifier.conflictsWith],
      actions: modifier.actions.map((action: ModifierAction) => ({
        ...action,
        payload: { ...action.payload },
      })),
    })),
    rescueModules: rescueModules.map((module) => ({
      ...module,
      slots: module.slots.map((slot) => ({
        ...slot,
        quantityExpression: { ...slot.quantityExpression },
      })),
    })),
    hospitalItems: hospitalItems(),
    hospitalRoleOptions: roleOptions(),
    compatibilityRules: typedCompatibilityRules.map((rule) => ({
      ...rule,
      modifierCodes: [...rule.modifierCodes],
    })),
    preferenceOverlays: [],
  }
}

export function defaultBuildInput(
  scenarioId: string,
  options?: {
    modifierCodes?: string[]
    generatedAt?: string
    selectedModuleVersionIds?: string[]
    selectedHospitalItemIds?: Record<string, string | null>
  },
): BuildCardInput {
  const scenario = getScenarioDefinition(scenarioId)
  if (!scenario) throw new Error(`Unknown preference-card scenario "${scenarioId}".`)
  const recipe = recipeForScenario(scenario)
  const selectedModuleVersionIds =
    options?.selectedModuleVersionIds ?? defaultSelectedModuleVersionIds(recipe)
  const modifierCodes = options?.modifierCodes ?? [...scenario.defaultModifierCodes]

  const input: BuildCardInput = {
    organizationId: DEMO_ORGANIZATION_ID,
    siteId: DEMO_SITE_ID,
    locationId: DEMO_LOCATION_ID,
    recipeVersionId: scenario.recipeVersionId,
    selectedModuleVersionIds,
    modifierCodes,
    variables: {
      generated_at: options?.generatedAt ?? '2026-07-25T12:00:00.000Z',
    },
    conditionalStates: {},
  }

  if (options?.selectedHospitalItemIds) {
    input.selectedHospitalItemIds = { ...options.selectedHospitalItemIds }
  }

  // Resolve once with the formulary's own ranking still in play, then record what that
  // actually chose. Densifying from the composition instead would miss every requirement a
  // modifier or rescue module adds, leaving exactly those lines on the implicit fallback this
  // replaces — so the pass has to run over the resolved card.
  const resolved = resolveCard(input, buildContextForRecipe(recipe))
  return {
    ...input,
    selectedHospitalItemIds: {
      ...selectionsFromResolvedCard(resolved),
      ...(options?.selectedHospitalItemIds ?? {}),
    },
    selectionsAreExplicit: true,
  }
}

export function resolveDemoScenario(
  scenarioId: string,
  options?: {
    modifierCodes?: string[]
    generatedAt?: string
    selectedModuleVersionIds?: string[]
    conditionalStates?: BuildCardInput['conditionalStates']
    selectedHospitalItemIds?: BuildCardInput['selectedHospitalItemIds']
    waivers?: BuildCardInput['waivers']
  },
): ResolvedCard {
  const input = defaultBuildInput(scenarioId, options)
  if (options?.conditionalStates) {
    input.conditionalStates = { ...options.conditionalStates }
  }
  if (options?.selectedHospitalItemIds) {
    input.selectedHospitalItemIds = { ...options.selectedHospitalItemIds }
  }
  if (options?.waivers) input.waivers = { ...options.waivers }
  return resolveCard(input, buildDemoContext(scenarioId))
}

export function getDashboardMetrics() {
  const resolved = getScenarioDefinitions().map((scenario) => ({
    scenario,
    card: resolveDemoScenario(scenario.id),
  }))
  return {
    scenarios: resolved.map(({ scenario, card }) => ({
      ...scenario,
      unresolvedRequiredRoles: card.items.filter((item) => item.resolutionState === 'blocking')
        .length,
      unassignedItems: card.items.filter(
        (item) => item.setupZone === 'unassigned' || item.proceduralPhase === 'unassigned',
      ).length,
      blockingConflicts: card.warnings.filter(
        (warning) => warning.severity === 'blocking' && warning.code.includes('compatibility'),
      ).length,
      readinessState: card.readinessState,
    })),
    totals: {
      unresolvedRequiredRoles: resolved.reduce(
        (total, { card }) =>
          total + card.items.filter((item) => item.resolutionState === 'blocking').length,
        0,
      ),
      unassignedItems: resolved.reduce(
        (total, { card }) =>
          total +
          card.items.filter(
            (item) => item.setupZone === 'unassigned' || item.proceduralPhase === 'unassigned',
          ).length,
        0,
      ),
      blockingCompatibilityConflicts: resolved.reduce(
        (total, { card }) =>
          total +
          card.warnings.filter(
            (warning) => warning.severity === 'blocking' && warning.code === 'compatibility_failed',
          ).length,
        0,
      ),
    },
  }
}

export function getVerificationBacklog(): VerificationBacklogRow[] {
  return verificationBacklog.map((row) => ({ ...row }))
}

export function getCoverageSummary() {
  return coverageProcedures.map((procedure) => ({ ...procedure }))
}

export function getEligibleCatalogProductsForRole(roleCode: string) {
  const matchingProductIds = new Set(
    productRoles.filter((row) => row.role_code === roleCode).map((row) => row.product_id),
  )
  return products
    .filter((product) => matchingProductIds.has(product.product_id))
    .sort(
      (left, right) =>
        (left.manufacturer ?? '').localeCompare(right.manufacturer ?? '') ||
        left.product_name.localeCompare(right.product_name) ||
        left.product_id.localeCompare(right.product_id),
    )
    .map((product) => ({
      productId: product.product_id,
      manufacturer: product.manufacturer,
      productName: product.product_name,
      catalogNumber: product.catalog_number,
      verificationStatus: product.verification_status,
      // Unverified products are listed and badged rather than filtered out.
      verified: product.visibility_state === 'prototype_visible',
    }))
}

export function getFormularyRoleRows() {
  const seen = new Set<string>()
  return getScenarioDefinitions()
    .flatMap((scenario) => {
      const card = resolveDemoScenario(scenario.id)
      return card.items.map((item) => ({
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        roleCode: item.roleCode,
        label: item.label,
        requiredness: item.effectiveRequiredness,
        resolutionState: item.resolutionState,
        selectedItem: item.selectedItemSnapshot,
      }))
    })
    .filter((row) => {
      if (seen.has(row.roleCode)) return false
      seen.add(row.roleCode)
      return true
    })
    .map((row) => ({
      ...row,
      eligibleProducts: getEligibleCatalogProductsForRole(row.roleCode).slice(0, 12),
    }))
    .sort(
      (left, right) =>
        Number(left.resolutionState !== 'blocking') -
          Number(right.resolutionState !== 'blocking') ||
        left.roleCode.localeCompare(right.roleCode),
    )
}
