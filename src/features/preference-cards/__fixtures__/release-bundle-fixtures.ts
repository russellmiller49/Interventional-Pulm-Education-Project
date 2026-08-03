import {
  computeReleaseBundle,
  type PreferenceCardReleaseBundle,
  type ReleaseBundleAuthoredFields,
  type ReleaseDefinitionSources,
  type ReleasePointerMap,
  type RoleTaxonomySnapshot,
} from '../domain/release-bundle'
import type {
  ModifierDefinition,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
  RescueModule,
  TypedCompatibilityRule,
} from '../domain/types'

/**
 * A synthetic procedure with three published releases across two recipe versions.
 *
 * The production data has exactly one release per procedure, because no clinical content has
 * been revised since release bundles were introduced and inventing a revision to exercise the
 * machinery would put fabricated clinical content in the repository. So the multi-version
 * behaviour is proved here instead, on a procedure that does not exist, with a change that is
 * deliberately trivial and obviously synthetic — one requirement moving from `optional` to
 * `required`, which is enough to be visible in a resolved card and impossible to mistake for
 * a clinical statement about anything real.
 *
 * The shape is adversarial on purpose. Three releases:
 *
 * ```text
 *   ALPHA   v1-0   published 2026-01-01, later RETIRED   recipe v1.0, core module v1.0
 *   BRAVO   v1-1   published 2026-02-01, CURRENT          recipe v1.1, core module v1.1
 *   CHARLIE v9-9   published 2026-03-01, not current      recipe v1.1, core module v1.1
 * ```
 *
 * CHARLIE is simultaneously the highest version string, the newest `publishedAt`, and the
 * last entry in the array — every property a "just take the latest" implementation would
 * reach for. It is published and perfectly valid; the program simply has not switched to it.
 * The pointer says BRAVO, so BRAVO is current, and a test that gets CHARLIE has caught a
 * version-sorting shortcut that no reviewer authorised.
 */

export const FIXTURE_PROCEDURE_CODE = 'FIXTURE_PROCEDURE'
export const FIXTURE_SCENARIO_ID = 'fixture-procedure'

export const FIXTURE_RECIPE_V1_0 = 'recipe-fixture-procedure-v1-0'
export const FIXTURE_RECIPE_V1_1 = 'recipe-fixture-procedure-v1-1'
export const FIXTURE_MODULE_V1_0 = 'module-fixture-core-v1-0'
export const FIXTURE_MODULE_V1_1 = 'module-fixture-core-v1-1'

export const ALPHA_RELEASE_ID = 'release-fixture-procedure-v1-0'
export const BRAVO_RELEASE_ID = 'release-fixture-procedure-v1-1'
export const CHARLIE_RELEASE_ID = 'release-fixture-procedure-v9-9'

/** The requirement whose definition differs between the two module versions. */
export const REVISED_REQUIREMENT_KEY = 'FIXTURE_BACKUP_SCOPE'

const CATALOG_IMPORT_ID = 'fixture-catalog-import-0001'
const RESOLVER_CONTRACT = 'ip-cards-resolver-contract/1'
const RESOLVER_IMPLEMENTATION = 'fixture-resolver-build-0001'

function slot(
  overrides: Partial<RecipeSlot> & Pick<RecipeSlot, 'id' | 'requirementKey'>,
): RecipeSlot {
  return {
    sourceSlotId: overrides.id,
    roleCode: 'FIXTURE_ROLE',
    label: 'Fixture requirement',
    genericRequirement: 'A requirement that exists only in this fixture.',
    requiredness: 'required',
    dependencyRule: null,
    quantityExpression: { op: 'literal', value: 1 },
    selectionMode: 'single',
    setupZone: 'back_table',
    proceduralPhase: 'airway_access',
    setupSequence: 1,
    openHoldStatus: 'open_or_set_up_now',
    responsibleRole: null,
    sterileStatus: null,
    allowCustom: false,
    notes: null,
    includedBy: 'Included by Fixture Core v1.0',
    ...overrides,
  }
}

function coreModule(version: '1.0' | '1.1'): RecipeModuleVersion {
  return {
    id: version === '1.0' ? FIXTURE_MODULE_V1_0 : FIXTURE_MODULE_V1_1,
    code: 'FIXTURE_CORE',
    name: 'Fixture Core',
    description: 'A synthetic core module used only to prove release retention.',
    version,
    kind: 'core',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    catalogImportId: CATALOG_IMPORT_ID,
    slots: [
      slot({
        id: 'SLOT-FIXTURE-PRIMARY',
        requirementKey: 'FIXTURE_PRIMARY_SCOPE',
        setupSequence: 1,
      }),
      slot({
        id: 'SLOT-FIXTURE-BACKUP',
        requirementKey: REVISED_REQUIREMENT_KEY,
        label: 'Backup scope',
        setupSequence: 2,
        // The one difference between the versions, and the whole reason BRAVO exists.
        requiredness: version === '1.0' ? 'optional' : 'required',
        includedBy: `Included by Fixture Core v${version}`,
      }),
    ],
  }
}

function fixtureRecipe(recipeVersionId: string, moduleVersionId: string): RecipeVersion {
  return {
    id: recipeVersionId,
    sourceProcedureCode: FIXTURE_PROCEDURE_CODE,
    sourceTemplateVersion: '1.0',
    name: 'Fixture procedure',
    version: recipeVersionId === FIXTURE_RECIPE_V1_0 ? '1.0' : '1.1',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    catalogImportId: CATALOG_IMPORT_ID,
    slots: [],
    allowedModifierCodes: ['FIXTURE_MODIFIER'],
    moduleReferences: [{ moduleVersionId, selectionBehavior: 'required', sequence: 10 }],
    compositionActions: [],
    requirementSequences: { FIXTURE_PRIMARY_SCOPE: 1, [REVISED_REQUIREMENT_KEY]: 2 },
  }
}

const fixtureModifier: ModifierDefinition = {
  code: 'FIXTURE_MODIFIER',
  name: 'Fixture modifier',
  groupCode: 'imaging_navigation',
  description: 'Synthetic.',
  releaseState: 'mvp',
  active: true,
  appliesTo: FIXTURE_PROCEDURE_CODE,
  preview: ['Adds nothing real.'],
  conflictsWith: [],
  actions: [
    {
      id: 'fixture-modifier-note',
      modifierCode: 'FIXTURE_MODIFIER',
      sequence: 10,
      actionType: 'append_note',
      targetRequirementKey: 'FIXTURE_PRIMARY_SCOPE',
      payload: { note: 'Fixture note.' },
    },
  ],
}

const fixtureRescueModule: RescueModule = {
  code: 'FIXTURE_RESCUE',
  name: 'Fixture rescue',
  description: 'Synthetic.',
  slots: [slot({ id: 'SLOT-FIXTURE-RESCUE', requirementKey: 'FIXTURE_RESCUE_TRAY' })],
}

const fixtureCompatibilityRule: TypedCompatibilityRule = {
  id: 'fixture-rule-1',
  sourceRoleCode: 'FIXTURE_ROLE',
  targetRoleCode: null,
  sourceAttribute: 'min_working_channel_mm',
  targetAttribute: null,
  operator: 'gte',
  expectedValue: 2,
  unit: 'mm',
  severity: 'warning',
  message: 'Fixture compatibility message.',
  missingValueMessage: 'Fixture missing-value message.',
  active: true,
  modifierCodes: [],
  evidenceSourceId: null,
}

const fixtureRoleTaxonomy: RoleTaxonomySnapshot = {
  categories: ['Fixture category'],
  legacyCategoryMap: { 'Old fixture category': 'Fixture category' },
  categoryOverrides: {},
  roleCodeAliases: { FIXTURE_OLD_ROLE: 'FIXTURE_ROLE' },
}

/**
 * A mutable copy of every definition the fixture releases pin.
 *
 * Mutable because the interesting tests are the destructive ones: edit a published module,
 * delete one, rewrite a compatibility rule, and assert that the release notices. A frozen
 * fixture could only prove the happy path, which is the path that was never in doubt.
 */
export interface FixtureDefinitionStore {
  recipes: Map<string, RecipeVersion>
  modules: Map<string, RecipeModuleVersion>
  modifiers: ModifierDefinition[]
  rescueModules: RescueModule[]
  compatibilityRules: TypedCompatibilityRule[]
  roleTaxonomy: RoleTaxonomySnapshot
  catalogImportId: string
  resolverContractVersion: string
  resolverImplementationHash: string
}

export function createFixtureDefinitionStore(): FixtureDefinitionStore {
  return {
    recipes: new Map([
      [FIXTURE_RECIPE_V1_0, fixtureRecipe(FIXTURE_RECIPE_V1_0, FIXTURE_MODULE_V1_0)],
      [FIXTURE_RECIPE_V1_1, fixtureRecipe(FIXTURE_RECIPE_V1_1, FIXTURE_MODULE_V1_1)],
    ]),
    modules: new Map([
      [FIXTURE_MODULE_V1_0, coreModule('1.0')],
      [FIXTURE_MODULE_V1_1, coreModule('1.1')],
    ]),
    modifiers: [fixtureModifier],
    rescueModules: [fixtureRescueModule],
    compatibilityRules: [fixtureCompatibilityRule],
    roleTaxonomy: fixtureRoleTaxonomy,
    catalogImportId: CATALOG_IMPORT_ID,
    resolverContractVersion: RESOLVER_CONTRACT,
    resolverImplementationHash: RESOLVER_IMPLEMENTATION,
  }
}

/** Build the sources a release pins, from whatever the store currently holds. */
export function fixtureSourcesFor(
  store: FixtureDefinitionStore,
  recipeVersionId: string,
): ReleaseDefinitionSources | null {
  const recipe = store.recipes.get(recipeVersionId)
  if (!recipe) return null
  const modules: RecipeModuleVersion[] = []
  for (const reference of recipe.moduleReferences) {
    const moduleVersion = store.modules.get(reference.moduleVersionId)
    if (!moduleVersion) return null
    modules.push(moduleVersion)
  }
  return {
    recipe,
    modules,
    modifiers: store.modifiers,
    rescueModules: store.rescueModules,
    compatibilityRules: store.compatibilityRules,
    roleTaxonomy: store.roleTaxonomy,
    catalogImportId: store.catalogImportId,
    resolverContractVersion: store.resolverContractVersion,
    resolverImplementationHash: store.resolverImplementationHash,
  }
}

const authoredReleases: Array<ReleaseBundleAuthoredFields & { recipeVersionId: string }> = [
  {
    id: ALPHA_RELEASE_ID,
    sourceProcedureCode: FIXTURE_PROCEDURE_CODE,
    scenarioId: FIXTURE_SCENARIO_ID,
    recipeVersionId: FIXTURE_RECIPE_V1_0,
    // Published first, retired once BRAVO took over. Retained, because cards are pinned to it.
    releaseState: 'retired',
    publishedAt: '2026-01-01T00:00:00.000Z',
    retiredAt: '2026-02-01T00:00:00.000Z',
    supersedesReleaseBundleId: null,
    releaseNotes: 'Initial synthetic release.',
    publishedCatalogImportId: CATALOG_IMPORT_ID,
    publishedResolverContractVersion: RESOLVER_CONTRACT,
    publishedResolverImplementationHash: RESOLVER_IMPLEMENTATION,
  },
  {
    id: BRAVO_RELEASE_ID,
    sourceProcedureCode: FIXTURE_PROCEDURE_CODE,
    scenarioId: FIXTURE_SCENARIO_ID,
    recipeVersionId: FIXTURE_RECIPE_V1_1,
    releaseState: 'published',
    publishedAt: '2026-02-01T00:00:00.000Z',
    retiredAt: null,
    supersedesReleaseBundleId: ALPHA_RELEASE_ID,
    releaseNotes: 'Backup scope becomes required.',
    publishedCatalogImportId: CATALOG_IMPORT_ID,
    publishedResolverContractVersion: RESOLVER_CONTRACT,
    publishedResolverImplementationHash: RESOLVER_IMPLEMENTATION,
  },
  {
    id: CHARLIE_RELEASE_ID,
    sourceProcedureCode: FIXTURE_PROCEDURE_CODE,
    scenarioId: FIXTURE_SCENARIO_ID,
    recipeVersionId: FIXTURE_RECIPE_V1_1,
    // Published and valid, and deliberately not current. Highest version, newest date, last
    // in the array — everything a "latest" heuristic would pick, and none of it decides.
    releaseState: 'published',
    publishedAt: '2026-03-01T00:00:00.000Z',
    retiredAt: null,
    supersedesReleaseBundleId: BRAVO_RELEASE_ID,
    releaseNotes: 'Published for review; the pointer has not been advanced to it.',
    publishedCatalogImportId: CATALOG_IMPORT_ID,
    publishedResolverContractVersion: RESOLVER_CONTRACT,
    publishedResolverImplementationHash: RESOLVER_IMPLEMENTATION,
  },
]

export interface FixtureReleaseWorld {
  store: FixtureDefinitionStore
  bundles: PreferenceCardReleaseBundle[]
  bundleById: Map<string, PreferenceCardReleaseBundle>
  pointers: ReleasePointerMap
  /** Sources as the store currently stands — recomputed on each call so mutations show up. */
  loadSources: (bundle: PreferenceCardReleaseBundle) => ReleaseDefinitionSources | null
  sourcesByBundleId: () => Map<string, ReleaseDefinitionSources | null>
}

/**
 * The three releases, computed and frozen exactly as publication would have frozen them.
 *
 * Hashes are computed from the pristine store and then held, so a test that mutates the store
 * is reproducing precisely the situation this whole mechanism exists to catch: a published
 * definition edited after the fact.
 */
export function createFixtureReleaseWorld(): FixtureReleaseWorld {
  const pristine = createFixtureDefinitionStore()
  const bundles = authoredReleases.map((authored) => {
    const sources = fixtureSourcesFor(pristine, authored.recipeVersionId)
    if (!sources) throw new Error(`fixture release ${authored.id} has no sources`)
    return computeReleaseBundle(authored, sources)
  })

  const store = createFixtureDefinitionStore()
  const recipeVersionByBundleId = new Map(
    authoredReleases.map((authored) => [authored.id, authored.recipeVersionId]),
  )
  const loadSources = (bundle: PreferenceCardReleaseBundle) =>
    fixtureSourcesFor(store, recipeVersionByBundleId.get(bundle.id) ?? bundle.recipeVersionId)

  return {
    store,
    bundles,
    bundleById: new Map(bundles.map((bundle) => [bundle.id, bundle])),
    pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID },
    loadSources,
    sourcesByBundleId: () => new Map(bundles.map((bundle) => [bundle.id, loadSources(bundle)])),
  }
}
