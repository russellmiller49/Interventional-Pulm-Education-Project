import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import type {
  BuildContext,
  HospitalItem,
  HospitalRoleOption,
  ModifierDefinition,
  RecipeSlot,
  ScenarioDefinition,
} from '../domain/types'
import type { PreferenceCardReleaseBundle } from '../domain/release-bundle'
import {
  ALPHA_RELEASE_ID,
  BRAVO_RELEASE_ID,
  FIXTURE_PROCEDURE_CODE,
  FIXTURE_SCENARIO_ID,
  createFixtureDefinitionStore,
  createFixtureReleaseWorld,
  fixtureSourcesFor,
} from './release-bundle-fixtures'

/**
 * The fixture release world, dressed up far enough to resolve a whole card.
 *
 * `release-bundle-fixtures.ts` gives three releases and their authored definitions, which is
 * everything the pure release machinery needs and not quite everything a *card* needs: resolution
 * also reads hospital-local data — what the room stocks and how the site ranks it — which is
 * current by design and therefore lives outside every release.
 *
 * Two hospital items exist here and both are deliberately ordinary. The rebuild tests are about
 * what crosses between releases, so the local formulary is arranged to be uninteresting: one
 * preferred item for the fixture role, one alternative, both active, neither restricted. A test
 * that wants an item to disappear removes it, and that removal is then the only thing that moved.
 */

export const FIXTURE_PRIMARY_ITEM_ID = 'fixture-item-primary'
export const FIXTURE_ALTERNATE_ITEM_ID = 'fixture-item-alternate'

/**
 * A modifier that pulls in a rescue module, mirroring the real `HIGH_BLEED_RISK`.
 *
 * It exists because a rescue module's requirements reach a resolved card without ever appearing in
 * `expandRecipeComposition` — the route by which the rebuild plan once reported them as removed by
 * the target release while the modifier that adds them carried forward untouched.
 *
 * Injected into the build *context* rather than into the definition store, deliberately: the three
 * fixture release bundles were hashed from the pristine store at world creation, and adding an
 * action to a modifier there would move `modifierSetPin` and every bundle `definitionHash` with it,
 * breaking release fixtures that have nothing to do with rebuilds.
 */
export const FIXTURE_RESCUE_MODIFIER_CODE = 'FIXTURE_ADDS_RESCUE'
export const FIXTURE_RESCUE_REQUIREMENT_KEY = 'FIXTURE_RESCUE_TRAY'
export const FIXTURE_RESCUE_SLOT_ID = 'SLOT-FIXTURE-RESCUE'

const rescueModifier: ModifierDefinition = {
  code: FIXTURE_RESCUE_MODIFIER_CODE,
  name: 'Fixture rescue-adding modifier',
  groupCode: 'risk_rescue',
  description: 'Synthetic; adds the fixture rescue module the way HIGH_BLEED_RISK does.',
  releaseState: 'mvp',
  active: true,
  appliesTo: FIXTURE_PROCEDURE_CODE,
  preview: ['Adds the fixture rescue module.'],
  conflictsWith: [],
  actions: [
    {
      id: 'fixture-adds-rescue',
      modifierCode: FIXTURE_RESCUE_MODIFIER_CODE,
      sequence: 10,
      actionType: 'add_rescue_module',
      payload: { code: 'FIXTURE_RESCUE' },
    },
  ],
}

/**
 * A modifier that pulls in a *rescue module* whose slot claims a key the composition already has.
 *
 * The same ambiguity as the two modifiers below, arriving by the other route. A rescue module's
 * slots are expanded in a later step than a modifier's `add_slot`, so a check written against one
 * path does not automatically cover the other — and the shared `expandEffectiveSlots` extraction is
 * exactly the thing that has to make it cover both.
 */
export const FIXTURE_DUPLICATE_RESCUE_MODIFIER = 'FIXTURE_DUPLICATE_RESCUE'
const FIXTURE_DUPLICATE_RESCUE_MODULE = 'FIXTURE_DUPLICATE_RESCUE_MODULE'

const duplicateRescueModifier: ModifierDefinition = {
  code: FIXTURE_DUPLICATE_RESCUE_MODIFIER,
  name: 'Fixture rescue-adding modifier, duplicating a base requirement',
  groupCode: 'risk_rescue',
  description: 'Synthetic; adds a rescue module whose slot claims a base requirement key.',
  releaseState: 'mvp',
  active: true,
  appliesTo: FIXTURE_PROCEDURE_CODE,
  preview: ['Adds a rescue module that duplicates a base requirement.'],
  conflictsWith: [],
  actions: [
    {
      id: 'fixture-adds-duplicate-rescue',
      modifierCode: FIXTURE_DUPLICATE_RESCUE_MODIFIER,
      sequence: 10,
      actionType: 'add_rescue_module',
      payload: { code: FIXTURE_DUPLICATE_RESCUE_MODULE },
    },
  ],
}

/**
 * Two modifiers that add a slot claiming a requirement key the composition already expresses.
 *
 * The resolver deduplicates added slots by **slot id**, not by requirement key, so both of these
 * really do produce a second requirement on the card. That is the case the planner's ambiguity
 * blocker exists for, and the case a "first declaration wins" pre-deduplication in the rebuild
 * server hid: the plan saw one requirement, the card was built with two.
 *
 * `CONFLICTING` disagrees about role and requiredness and must block. `IDENTICAL` agrees on every
 * compared field and must not, because two byte-identical expressions of one requirement are one
 * requirement said twice.
 */
export const FIXTURE_DUPLICATE_CONFLICTING_MODIFIER = 'FIXTURE_DUPLICATE_CONFLICTING'
export const FIXTURE_DUPLICATE_IDENTICAL_MODIFIER = 'FIXTURE_DUPLICATE_IDENTICAL'

function duplicateSlot(id: string, overrides: Partial<RecipeSlot>): RecipeSlot {
  return {
    id,
    sourceSlotId: id,
    requirementKey: 'FIXTURE_PRIMARY_SCOPE',
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
    includedBy: 'Added by fixture modifier',
    ...overrides,
  }
}

function duplicateModifier(code: string, slot: RecipeSlot): ModifierDefinition {
  return {
    code,
    name: `Fixture duplicate-key modifier (${code})`,
    groupCode: 'imaging_navigation',
    description: 'Synthetic; adds a second slot claiming an existing requirement key.',
    releaseState: 'mvp',
    active: true,
    appliesTo: FIXTURE_PROCEDURE_CODE,
    preview: ['Adds a duplicate requirement key.'],
    conflictsWith: [],
    actions: [
      {
        id: `${code}-add-duplicate`,
        modifierCode: code,
        sequence: 20,
        actionType: 'add_slot',
        payload: { slot },
      },
    ],
  }
}

const conflictingDuplicateModifier = duplicateModifier(
  FIXTURE_DUPLICATE_CONFLICTING_MODIFIER,
  duplicateSlot('SLOT-FIXTURE-PRIMARY-CONFLICT', {
    roleCode: 'FIXTURE_OTHER_ROLE',
    requiredness: 'optional',
    label: 'Primary scope, expressed a second and different way',
  }),
)

/** Same requirement key, different slot id, and every compared field identical. */
const identicalDuplicateModifier = duplicateModifier(
  FIXTURE_DUPLICATE_IDENTICAL_MODIFIER,
  duplicateSlot('SLOT-FIXTURE-PRIMARY-ECHO', {}),
)

export const FIXTURE_SCOPE = {
  organizationId: 'fixture-org',
  siteId: 'fixture-site',
  locationId: 'fixture-location',
}

function hospitalItem(id: string, description: string): HospitalItem {
  return {
    id,
    organizationId: FIXTURE_SCOPE.organizationId,
    siteId: FIXTURE_SCOPE.siteId,
    locationId: FIXTURE_SCOPE.locationId,
    itemType: 'commercial_product',
    roleCode: 'FIXTURE_ROLE',
    catalogProduct: null,
    localItemNumber: null,
    localDescription: description,
    localUom: null,
    storageLocation: null,
    verificationState: 'locally_approved',
    active: true,
    notes: null,
    attributes: { min_working_channel_mm: 2.8 },
    kitComponents: [],
  }
}

function roleOption(id: string, hospitalItemId: string, rank: number): HospitalRoleOption {
  return {
    id,
    roleCode: 'FIXTURE_ROLE',
    hospitalItemId,
    preferenceRank: rank,
    substitutionClass: rank === 1 ? 'preferred' : 'acceptable',
    noSubstitute: false,
    active: true,
    rationale: null,
  }
}

export function fixtureScenario(recipeVersionId: string): ScenarioDefinition {
  return {
    id: FIXTURE_SCENARIO_ID,
    title: 'Fixture procedure',
    recipeName: 'Fixture procedure',
    shortDescription: 'A synthetic procedure that exists only in the fixtures.',
    recipeVersionId,
    sourceProcedureCode: FIXTURE_PROCEDURE_CODE,
    templateVersion: '1.0',
    defaultModifierCodes: [],
    availableModifierCodes: ['FIXTURE_MODIFIER'],
    requiredCatalogCoverageCount: 2,
    requiredCatalogCoveragePercentage: 100,
    requiredSlotsWithoutCatalogProducts: [],
    roleCodesWithoutCatalogProducts: [],
    requiredDefaultOptionCoverageCount: 2,
    requiredDefaultOptionCoveragePercentage: 100,
    requiredSlotsWithoutDefaultOptions: [],
    requiredCustomAllowedCount: 0,
    slotCount: 2,
    requiredSlotCount: 2,
    governanceState: 'draft',
    owner: null,
  }
}

export interface RebuildFixtureWorld {
  world: ReturnType<typeof createFixtureReleaseWorld>
  alpha: PreferenceCardReleaseBundle
  bravo: PreferenceCardReleaseBundle
  /** Mutable, so a test can make an item vanish and nothing else move. */
  hospitalItems: HospitalItem[]
  hospitalRoleOptions: HospitalRoleOption[]
  contextFor: (releaseBundleId: string) => BuildContext
  composedSlotsFor: (releaseBundleId: string) => ReturnType<typeof expandRecipeComposition>['slots']
}

export function createRebuildFixtureWorld(): RebuildFixtureWorld {
  const world = createFixtureReleaseWorld()
  const alpha = world.bundleById.get(ALPHA_RELEASE_ID)!
  const bravo = world.bundleById.get(BRAVO_RELEASE_ID)!
  const store = createFixtureDefinitionStore()

  const hospitalItems = [
    hospitalItem(FIXTURE_PRIMARY_ITEM_ID, 'Fixture primary scope'),
    hospitalItem(FIXTURE_ALTERNATE_ITEM_ID, 'Fixture alternate scope'),
  ]
  const hospitalRoleOptions = [
    roleOption('fixture-option-primary', FIXTURE_PRIMARY_ITEM_ID, 1),
    roleOption('fixture-option-alternate', FIXTURE_ALTERNATE_ITEM_ID, 2),
  ]

  const contextFor = (releaseBundleId: string): BuildContext => {
    const bundle = world.bundleById.get(releaseBundleId)!
    const sources = fixtureSourcesFor(store, bundle.recipeVersionId)!
    return {
      organizationName: 'Fixture Organization',
      siteName: 'Fixture Site',
      locationName: 'Fixture Location',
      locationCapabilities: [],
      releaseIdentity: {
        releaseBundleId: bundle.id,
        releaseDefinitionHash: bundle.definitionHash,
        catalogReleaseId: bundle.catalogImportId,
      },
      // The rescue-adding modifier is offered as well as defined, or `prepareCardRebuild` would
      // refuse a request that names it.
      recipe: {
        ...sources.recipe,
        allowedModifierCodes: [
          ...sources.recipe.allowedModifierCodes,
          FIXTURE_RESCUE_MODIFIER_CODE,
          FIXTURE_DUPLICATE_RESCUE_MODIFIER,
          FIXTURE_DUPLICATE_CONFLICTING_MODIFIER,
          FIXTURE_DUPLICATE_IDENTICAL_MODIFIER,
        ],
      },
      recipeModules: sources.modules,
      modifiers: [
        ...sources.modifiers,
        rescueModifier,
        duplicateRescueModifier,
        conflictingDuplicateModifier,
        identicalDuplicateModifier,
      ],
      rescueModules: [
        ...sources.rescueModules,
        {
          code: FIXTURE_DUPLICATE_RESCUE_MODULE,
          name: 'Fixture rescue that duplicates a base requirement',
          description: 'Synthetic.',
          slots: [
            duplicateSlot('SLOT-FIXTURE-RESCUE-DUPLICATE', {
              label: 'Primary scope, arriving through a rescue module',
            }),
          ],
        },
      ],
      // Deliberately shared references: hospital-local data is *current* on both sides of a
      // rebuild, and giving the two releases different formularies would smuggle an operational
      // change into a comparison that is supposed to isolate authored ones.
      hospitalItems,
      hospitalRoleOptions,
      compatibilityRules: sources.compatibilityRules,
      roleCodeAliases: sources.roleTaxonomy.roleCodeAliases,
      preferenceOverlays: [],
    }
  }

  const composedSlotsFor = (releaseBundleId: string) => {
    const context = contextFor(releaseBundleId)
    return expandRecipeComposition({
      recipe: context.recipe,
      modules: context.recipeModules,
      selectedModuleVersionIds: context.recipe.moduleReferences.map(
        (reference) => reference.moduleVersionId,
      ),
      startSequence: 1,
    }).slots
  }

  return { world, alpha, bravo, hospitalItems, hospitalRoleOptions, contextFor, composedSlotsFor }
}
