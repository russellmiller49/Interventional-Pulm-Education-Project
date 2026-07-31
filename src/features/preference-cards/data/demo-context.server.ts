import generatedModifiersJson from '../../../../data/ip-preference-cards/generated/modifier-definitions.json'
import generatedScenariosJson from '../../../../data/ip-preference-cards/generated/scenarios.json'
import recipeModulesJson from '../../../../data/ip-preference-cards/generated/recipe-modules.json'
import procedureCompositionsJson from '../../../../data/ip-preference-cards/generated/procedure-compositions.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import coverageJson from '../../../../data/ip-preference-cards/generated/coverage-report.json'
import importReportJson from '../../../../data/ip-preference-cards/generated/import-report.json'
import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import proceduresJson from '../../../../data/ip-preference-cards/generated/procedures.json'
import verificationBacklogJson from '../../../../data/ip-preference-cards/generated/verification-backlog.json'

import {
  defaultSelectedModuleVersionIds,
  expandDefaultRecipeComposition,
} from '../domain/expand-recipe-composition'
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

interface ProcedureRow {
  procedure_code: string
  procedure_name: string
  template_version: string
  clinical_owner: string | null
}

interface GeneratedProcedureComposition {
  procedureCode: string
  version: string
  moduleReferences: RecipeModuleReference[]
  compositionActions: ProcedureCompositionAction[]
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
const procedures = proceduresJson as ProcedureRow[]
const importReport = importReportJson as ImportReport
const coverageProcedures = (coverageJson as { procedures: CoverageProcedure[] }).procedures
const verificationBacklog = verificationBacklogJson as VerificationBacklogRow[]
const recipeModules = recipeModulesJson as unknown as RecipeModuleVersion[]
const recipeModuleById = new Map(recipeModules.map((module) => [module.id, module]))
const compositionByProcedure = new Map(
  (procedureCompositionsJson as unknown as GeneratedProcedureComposition[]).map((composition) => [
    composition.procedureCode,
    composition,
  ]),
)

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
    catalogImportId: importReport.workbook_sha256,
    slots: [],
    moduleReferences: recipeModules.map((version, index) => ({
      moduleVersionId: version.id,
      selectionBehavior: 'optional' as const,
      sequence: (index + 1) * 10,
    })),
    compositionActions: [],
  }
}

function recipeForScenario(scenario: ScenarioDefinition): RecipeVersion {
  if (scenario.id === CUSTOM_COMPOSITION_SCENARIO_ID) return customCompositionRecipe()
  const source = procedures.find(
    (procedure) => procedure.procedure_code === scenario.sourceProcedureCode,
  )
  if (!source) {
    throw new Error(
      `Source procedure ${scenario.sourceProcedureCode} is missing from generated data.`,
    )
  }
  const composition = compositionByProcedure.get(source.procedure_code)
  if (!composition) {
    throw new Error(
      `Procedure ${source.procedure_code} has no reviewed composition. Run "npm run ip-cards:compositions".`,
    )
  }
  return {
    id: scenario.recipeVersionId,
    sourceProcedureCode: source.procedure_code,
    sourceTemplateVersion: source.template_version,
    name: scenario.recipeName,
    version: '0.1',
    governanceState: 'draft',
    clinicalOwner: source.clinical_owner,
    operationalOwner: null,
    catalogImportId: importReport.workbook_sha256,
    // Every imported procedure is fully composed; direct slots stay available for the
    // unusual requirement that belongs to one procedure and nothing else.
    slots: [],
    moduleReferences: composition.moduleReferences.map((reference) => ({ ...reference })),
    compositionActions: composition.compositionActions.map((action) => ({
      ...action,
      payload: { ...action.payload },
    })),
  }
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
 * The effective requirement list a scenario starts from, before modifiers and resolution.
 *
 * This is what an administrator sees as the read-only effective preview of a composition:
 * the procedure's own requirements plus everything it inherits, each carrying the module
 * it came from.
 */
export function getComposedRecipeSlots(scenarioId: string): RecipeSlot[] {
  const context = buildDemoContext(scenarioId)
  return expandDefaultRecipeComposition(context).slots
}

/** Every authored module version, for the administrative composition overview. */
export function getRecipeModuleCatalog(): RecipeModuleVersion[] {
  return recipeModules.map(cloneModule)
}

export function getProcedureCompositions(): GeneratedProcedureComposition[] {
  return [...compositionByProcedure.values()].map((composition) => ({
    ...composition,
    moduleReferences: composition.moduleReferences.map((reference) => ({ ...reference })),
    compositionActions: composition.compositionActions.map((action) => ({
      ...action,
      payload: { ...action.payload },
    })),
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
  const recipe = recipeForScenario(scenario)
  return {
    organizationName: 'Demo IP Program',
    siteName: 'Demo Hospital',
    locationName: 'Bronchoscopy Suite 1',
    locationCapabilities: ['rigid_bronchoscopy', 'jet_ventilation', 'fluoroscopy'],
    recipe,
    recipeModules: modulesForRecipe(recipe),
    modifiers: allModifierDefinitions.map((modifier) => ({
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
  },
): BuildCardInput {
  const scenario = getScenarioDefinition(scenarioId)
  if (!scenario) throw new Error(`Unknown preference-card scenario "${scenarioId}".`)
  return {
    organizationId: DEMO_ORGANIZATION_ID,
    siteId: DEMO_SITE_ID,
    locationId: DEMO_LOCATION_ID,
    recipeVersionId: scenario.recipeVersionId,
    selectedModuleVersionIds:
      options?.selectedModuleVersionIds ??
      defaultSelectedModuleVersionIds(recipeForScenario(scenario)),
    modifierCodes: options?.modifierCodes ?? [...scenario.defaultModifierCodes],
    variables: {
      generated_at: options?.generatedAt ?? '2026-07-25T12:00:00.000Z',
    },
    conditionalStates: {},
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
