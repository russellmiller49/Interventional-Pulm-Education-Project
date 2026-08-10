import { expandRecipeComposition } from './expand-recipe-composition'
import { stableSnapshotHash, stableStringify } from './stable-hash'
import type {
  BuildContext,
  GovernanceState,
  ModifierAction,
  ModifierDefinition,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
  RescueModule,
  TypedCompatibilityRule,
} from './types'

/**
 * Immutable release bundles.
 *
 * A saved card pins `recipeVersionId` and `selectedModuleVersionIds`, which is exact as far
 * as it goes — but a recipe id is a *name*, and a name only pins content if something proves
 * the content behind it never moved. It also says nothing about the other authored inputs the
 * resolver reads: the modifier set, the rescue modules, the typed compatibility rules, and the
 * role alias table all reach `resolveCard` from unversioned module-level singletons. Editing
 * any of them changes what an already-saved card re-resolves to, with its pins untouched.
 *
 * A release bundle is the closure: the complete set of immutable authored definitions needed
 * to reconstruct one procedure's card, each addressed by a content hash. Publishing freezes
 * the hashes; a later edit to any pinned definition no longer matches, and the card that
 * pinned it reports that rather than silently resolving against the new content.
 *
 * Three things this deliberately is not:
 *
 * - **Not a "latest version" lookup.** Nothing here sorts version strings, reads array
 *   position, compares timestamps, or resolves a module code to whatever currently answers
 *   to it. Current selection comes from an explicit pointer and nowhere else — see
 *   `resolveCurrentRelease`.
 * - **Not a migration.** A newer release never reaches back into a saved card. A card pinned
 *   to a retired release still reconstructs from it; the retirement only removes it from what
 *   a *new* card may be built on.
 * - **Not an inference.** No content is matched, merged, or judged equivalent by resemblance.
 *   Two definitions are the same definition when their hashes are equal, and not otherwise.
 */

/**
 * The publication axis, deliberately separate from clinical `GovernanceState`.
 *
 * They answer different questions and this module needs both. `governanceState` is how far
 * the *clinical content* has got through review — every module in this prototype is still
 * `draft`, and a card assembled from one keeps its prototype watermark. `releaseState` is
 * whether the *definition set* is frozen. A release can be published-and-immutable while the
 * clinical content inside it is honestly still a draft, and folding the two into one enum
 * would force a choice between lying about the review status and never being able to freeze
 * anything.
 */
export type ReleaseState = 'draft' | 'published' | 'retired'

export interface DefinitionPin {
  id: string
  definitionHash: string
}

export interface ModulePin {
  moduleVersionId: string
  moduleCode: string
  moduleVersion: string
  definitionHash: string
}

export interface PreferenceCardReleaseBundle {
  id: string
  sourceProcedureCode: string
  scenarioId: string

  recipeVersionId: string
  recipeDefinitionHash: string

  modulePins: ModulePin[]

  modifierSetPin: DefinitionPin
  rescueModuleSetPin: DefinitionPin
  compatibilityRuleSetPin: DefinitionPin
  roleTaxonomyPin: DefinitionPin

  /**
   * The catalog release this bundle was published against. Independently versioned content:
   * the catalog moving is a governed event of its own, not a mutation of authored recipe
   * content, so it is recorded and drift is reported — but it is outside `definitionHash`.
   * See `RELEASE_BUNDLE_HASH_EXCLUSIONS`.
   */
  catalogImportId: string
  /**
   * The **semantic** resolver contract the bundle was published against. Outside
   * `definitionHash`. A move here means resolution means something different now, and every
   * release published under the old contract is reported.
   */
  resolverContractVersion: string
  /**
   * A digest of the resolver sources at publication — **provenance only**.
   *
   * Recorded so a card can be traced to the build that produced it, and deliberately not a
   * support boundary: a pure refactor moves this and changes nothing a card resolves to.
   * Reporting it as a contract change would make every historical card look unsupported for a
   * rename, so drift here is informational where a contract move is a warning.
   */
  resolverImplementationHash: string

  releaseState: ReleaseState
  /** Weakest clinical state across the pinned recipe and its modules. Derived from the pins. */
  governanceState: GovernanceState
  publishedAt: string | null
  retiredAt: string | null
  supersedesReleaseBundleId: string | null

  releaseNotes: string | null
  definitionHash: string
}

/**
 * An explicit current-release pointer, keyed by procedure.
 *
 * The entire reason this exists as authored data rather than a computation: there is no
 * expression over a set of bundles that yields "the current one" without encoding a policy
 * nobody reviewed. Highest version string, last array entry, newest `publishedAt` — each is
 * a guess that happens to be right until the day someone publishes a hotfix to an older
 * line, and then it silently promotes the wrong clinical content. Somebody advances this map,
 * and that act is the promotion.
 */
export type ReleasePointerMap = Readonly<Record<string, string>>

/**
 * Bumped when the *meaning* of a definition hash changes — a field added to a hashed payload,
 * a canonicalization rule altered. Every hash carries it, so a bundle published under older
 * semantics reports a mismatch loudly instead of comparing two incomparable digests and
 * concluding the content changed.
 */
export const RELEASE_BUNDLE_HASH_VERSION = 'ip-cards-release/1'

/**
 * What `definitionHash` deliberately does not cover, and why each one is out.
 *
 * Written down as data because "the hash covers the right things" is the load-bearing claim
 * of this whole module, and a reviewer should not have to reverse-engineer it from
 * `releaseBundleDefinitionHash`. `release-bundle.test.ts` asserts that changing each of these
 * leaves the hash alone, and that changing anything else moves it.
 */
export const RELEASE_BUNDLE_HASH_EXCLUSIONS: Readonly<Record<string, string>> = {
  releaseState:
    'Publishing and retiring are lifecycle acts, not content edits. A retired release must keep the hash it published with, or retiring a bundle would be indistinguishable from mutating it.',
  publishedAt: 'Lifecycle metadata. Same reason as releaseState.',
  retiredAt: 'Lifecycle metadata. Same reason as releaseState.',
  releaseNotes: 'Prose about the release, not an input the resolver reads.',
  governanceState:
    'Derived from the pinned recipe and modules, so it is already implied by the pins. Hashing it would add no detection power and would let a derived value look like an independent one.',
  catalogImportId:
    'Independently versioned external content. The catalog is re-imported on its own cadence; forcing every procedure to republish on each import would make republication routine and therefore meaningless. Drift is reported explicitly instead.',
  resolverContractVersion:
    'The resolver is code, not retained data. A contract change is surfaced as an explicit condition rather than pretending an older engine could be reconstituted.',
  resolverImplementationHash:
    'Provenance only. A pure refactor moves the source digest without changing what any card resolves to, and hashing it would turn every rename into a mutation.',
}

/**
 * The boundary, written down.
 *
 * Half of a `BuildContext` is immutable authored clinical content that a release pins, and
 * half is hospital-local operational content that is *supposed* to be current — the room's
 * capabilities, the local formulary, which item the site actually stocks. Both halves reach
 * the resolver and both change what a card says, so the difference between them is a clinical
 * distinction rather than an implementation detail: a physician who reopens a card should see
 * the requirements they reviewed and the equipment the room has today.
 *
 * `locationCapabilities` sits on the hospital-local side while being unambiguously
 * rule-bearing — it produces blocking `require_room_capability` messages. That is deliberate.
 * Whether the room has fluoroscopy is a fact about the room, not a clause in a reviewed
 * recipe, and pinning it would freeze a card to a capability the site may since have lost.
 *
 * The two lists are exhaustive over `BuildContext` at the type level, so adding a field
 * without deciding which side it belongs on does not compile.
 */
export const RELEASE_PINNED_CONTEXT_FIELDS = [
  // Not a definition the release pins — it *is* the release. Classified here because it names the
  // immutable set the other five came from, and because a context assembled from current data has
  // no honest value for it and carries null.
  'releaseIdentity',
  'recipe',
  'recipeModules',
  'modifiers',
  'rescueModules',
  'compatibilityRules',
] as const

export const HOSPITAL_LOCAL_CURRENT_CONTEXT_FIELDS = [
  'organizationName',
  'siteName',
  'locationName',
  'locationCapabilities',
  'hospitalItems',
  'hospitalRoleOptions',
  'preferenceOverlays',
] as const

type ClassifiedContextField =
  | (typeof RELEASE_PINNED_CONTEXT_FIELDS)[number]
  | (typeof HOSPITAL_LOCAL_CURRENT_CONTEXT_FIELDS)[number]

// Both directions: every context field is classified, and nothing is classified that is not
// a context field. A one-way check would let a stale entry linger after a rename.
type _EveryContextFieldIsClassified =
  Exclude<keyof BuildContext, ClassifiedContextField> extends never
    ? true
    : ['unclassified BuildContext field', Exclude<keyof BuildContext, ClassifiedContextField>]
type _EveryClassificationIsAContextField =
  Exclude<ClassifiedContextField, keyof BuildContext> extends never
    ? true
    : [
        'classified field that BuildContext does not have',
        Exclude<ClassifiedContextField, keyof BuildContext>,
      ]

const _contextFieldsAreExhaustive: [
  _EveryContextFieldIsClassified,
  _EveryClassificationIsAContextField,
] = [true, true]
void _contextFieldsAreExhaustive

/** The role-code and category tables, as the resolver-visible snapshot a bundle pins. */
export interface RoleTaxonomySnapshot {
  categories: readonly string[]
  legacyCategoryMap: Readonly<Record<string, string>>
  categoryOverrides: Readonly<Record<string, string>>
  roleCodeAliases: Readonly<Record<string, string>>
}

/**
 * The live authored definitions a bundle's pins are computed from and checked against.
 *
 * `modifiers` is the *effective merged set* the resolver actually sees, not the hand-tuned
 * seed alone: `demo-context.server.ts` merges the twelve authored modifiers over the
 * generated ones and hands the union to `resolveCard`, so the union is what a card's
 * behaviour depends on and the union is what has to be pinned.
 */
export interface ReleaseDefinitionSources {
  recipe: RecipeVersion
  /** Every module version the recipe references, whether or not a given card selects it. */
  modules: RecipeModuleVersion[]
  modifiers: ModifierDefinition[]
  rescueModules: RescueModule[]
  compatibilityRules: TypedCompatibilityRule[]
  roleTaxonomy: RoleTaxonomySnapshot
  catalogImportId: string
  resolverContractVersion: string
  resolverImplementationHash: string
}

function hash(kind: string, payload: unknown): string {
  return stableSnapshotHash({ v: RELEASE_BUNDLE_HASH_VERSION, kind, payload })
}

/**
 * `catalogImportId` is stripped from the recipe and module payloads below.
 *
 * Both are stamped with whatever catalog import was current when the generated data was
 * written, so leaving the field in would make a catalog refresh read as every recipe and every
 * module mutating at once — see `RELEASE_BUNDLE_HASH_EXCLUSIONS.catalogImportId`. The catalog
 * release is recorded on the bundle instead.
 */
function withoutCatalogImportId<T extends { catalogImportId: string }>(
  value: T,
): Omit<T, 'catalogImportId'> {
  const copy: Record<string, unknown> = { ...value }
  delete copy.catalogImportId
  return copy as Omit<T, 'catalogImportId'>
}

/**
 * The recipe's authored content.
 *
 * `catalogImportId` is stripped: `recipeForScenario` stamps whatever import is current onto
 * every recipe it builds, so leaving it in would make a catalog refresh read as fifteen
 * simultaneous recipe mutations. Everything else is in, including `name` and
 * `sourceTemplateVersion` — both come from generated data outside the composition seed
 * (`scenarios.json` and `procedures.json`), both land in the resolved card, and `recipeName`
 * is inside the snapshot hash, so a scenario retitle really does change what a card resolves
 * to and really should require a new release.
 */
export function recipeDefinitionHash(recipe: RecipeVersion): string {
  return hash('recipe', {
    ...withoutCatalogImportId(recipe),
    slots: [...recipe.slots].sort((left, right) => left.id.localeCompare(right.id)),
    moduleReferences: [...recipe.moduleReferences].sort((left, right) =>
      left.moduleVersionId.localeCompare(right.moduleVersionId),
    ),
    compositionActions: [...recipe.compositionActions].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    requirementSequences: recipe.requirementSequences ?? {},
  })
}

/** A module version's authored content. `catalogImportId` is stripped for the same reason. */
export function moduleDefinitionHash(moduleVersion: RecipeModuleVersion): string {
  return hash('module', {
    ...withoutCatalogImportId(moduleVersion),
    slots: [...moduleVersion.slots].sort((left, right) => left.id.localeCompare(right.id)),
  })
}

export function modifierSetDefinitionHash(modifiers: ModifierDefinition[]): string {
  return hash(
    'modifier-set',
    [...modifiers]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((modifier) => ({
        ...modifier,
        preview: [...modifier.preview],
        conflictsWith: [...modifier.conflictsWith].sort(),
        actions: [...modifier.actions].sort((left, right) => left.id.localeCompare(right.id)),
      })),
  )
}

export function rescueModuleSetDefinitionHash(rescueModules: RescueModule[]): string {
  return hash(
    'rescue-module-set',
    [...rescueModules]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((module) => ({
        ...module,
        slots: [...module.slots].sort((left, right) => left.id.localeCompare(right.id)),
      })),
  )
}

export function compatibilityRuleSetDefinitionHash(rules: TypedCompatibilityRule[]): string {
  return hash(
    'compatibility-rule-set',
    [...rules]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((rule) => ({ ...rule, modifierCodes: [...rule.modifierCodes].sort() })),
  )
}

export function roleTaxonomyDefinitionHash(taxonomy: RoleTaxonomySnapshot): string {
  return hash('role-taxonomy', {
    categories: [...taxonomy.categories],
    legacyCategoryMap: { ...taxonomy.legacyCategoryMap },
    categoryOverrides: { ...taxonomy.categoryOverrides },
    roleCodeAliases: { ...taxonomy.roleCodeAliases },
  })
}

/** Stable identifiers for the four whole-set pins, so a pin names what it addresses. */
export const MODIFIER_SET_DEFINITION_ID = 'definition-set-modifiers'
export const RESCUE_MODULE_SET_DEFINITION_ID = 'definition-set-rescue-modules'
export const COMPATIBILITY_RULE_SET_DEFINITION_ID = 'definition-set-compatibility-rules'
export const ROLE_TAXONOMY_DEFINITION_ID = 'definition-set-role-taxonomy'

/** Everything a bundle's `definitionHash` addresses, in one place, in canonical order. */
function definitionHashPayload(
  bundle: Omit<PreferenceCardReleaseBundle, 'definitionHash'>,
): unknown {
  return {
    id: bundle.id,
    sourceProcedureCode: bundle.sourceProcedureCode,
    scenarioId: bundle.scenarioId,
    recipeVersionId: bundle.recipeVersionId,
    recipeDefinitionHash: bundle.recipeDefinitionHash,
    modulePins: [...bundle.modulePins].sort((left, right) =>
      left.moduleVersionId.localeCompare(right.moduleVersionId),
    ),
    modifierSetPin: bundle.modifierSetPin,
    rescueModuleSetPin: bundle.rescueModuleSetPin,
    compatibilityRuleSetPin: bundle.compatibilityRuleSetPin,
    roleTaxonomyPin: bundle.roleTaxonomyPin,
    supersedesReleaseBundleId: bundle.supersedesReleaseBundleId,
  }
}

export function releaseBundleDefinitionHash(
  bundle: Omit<PreferenceCardReleaseBundle, 'definitionHash'>,
): string {
  return hash('release-bundle', definitionHashPayload(bundle))
}

const governanceRank: Record<GovernanceState, number> = {
  retired: 0,
  draft: 1,
  in_review: 2,
  approved: 3,
}

/** Weakest clinical state across everything the bundle pins, matching how a card folds it. */
function bundleGovernanceState(sources: ReleaseDefinitionSources): GovernanceState {
  return [
    sources.recipe.governanceState,
    ...sources.modules.map((module) => module.governanceState),
  ].reduce(
    (weakest, candidate) =>
      governanceRank[candidate] < governanceRank[weakest] ? candidate : weakest,
    sources.recipe.governanceState,
  )
}

/** The lifecycle facts an author writes down; every pin below is computed, never authored. */
export interface ReleaseBundleAuthoredFields {
  id: string
  sourceProcedureCode: string
  scenarioId: string
  releaseState: ReleaseState
  publishedAt: string | null
  retiredAt: string | null
  supersedesReleaseBundleId: string | null
  releaseNotes: string | null
  /**
   * The independently versioned context frozen at publication, so a published bundle keeps
   * saying which catalog import and resolver contract it was reviewed against even after both
   * have moved. Absent on a draft, which takes whatever is current. Neither is inside
   * `definitionHash`, so recording them cannot make a release look mutated.
   */
  publishedCatalogImportId?: string | null
  publishedResolverContractVersion?: string | null
  publishedResolverImplementationHash?: string | null
}

/**
 * Compute the bundle a set of live definitions currently describes.
 *
 * This is the only place a bundle's pins come from. An author never writes a hash by hand and
 * never writes a pin by hand: they write the lifecycle facts, this computes the closure, and
 * publication is the act of freezing the computed hash into the seed. A hand-authored pin
 * would be a claim about content nobody verified.
 */
export function computeReleaseBundle(
  authored: ReleaseBundleAuthoredFields,
  sources: ReleaseDefinitionSources,
): PreferenceCardReleaseBundle {
  const withoutHash: Omit<PreferenceCardReleaseBundle, 'definitionHash'> = {
    id: authored.id,
    sourceProcedureCode: authored.sourceProcedureCode,
    scenarioId: authored.scenarioId,
    recipeVersionId: sources.recipe.id,
    recipeDefinitionHash: recipeDefinitionHash(sources.recipe),
    modulePins: [...sources.modules]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((moduleVersion) => ({
        moduleVersionId: moduleVersion.id,
        moduleCode: moduleVersion.code,
        moduleVersion: moduleVersion.version,
        definitionHash: moduleDefinitionHash(moduleVersion),
      })),
    modifierSetPin: {
      id: MODIFIER_SET_DEFINITION_ID,
      definitionHash: modifierSetDefinitionHash(sources.modifiers),
    },
    rescueModuleSetPin: {
      id: RESCUE_MODULE_SET_DEFINITION_ID,
      definitionHash: rescueModuleSetDefinitionHash(sources.rescueModules),
    },
    compatibilityRuleSetPin: {
      id: COMPATIBILITY_RULE_SET_DEFINITION_ID,
      definitionHash: compatibilityRuleSetDefinitionHash(sources.compatibilityRules),
    },
    roleTaxonomyPin: {
      id: ROLE_TAXONOMY_DEFINITION_ID,
      definitionHash: roleTaxonomyDefinitionHash(sources.roleTaxonomy),
    },
    catalogImportId: authored.publishedCatalogImportId ?? sources.catalogImportId,
    resolverContractVersion:
      authored.publishedResolverContractVersion ?? sources.resolverContractVersion,
    resolverImplementationHash:
      authored.publishedResolverImplementationHash ?? sources.resolverImplementationHash,
    releaseState: authored.releaseState,
    governanceState: bundleGovernanceState(sources),
    publishedAt: authored.publishedAt,
    retiredAt: authored.retiredAt,
    supersedesReleaseBundleId: authored.supersedesReleaseBundleId,
    releaseNotes: authored.releaseNotes,
  }
  return { ...withoutHash, definitionHash: releaseBundleDefinitionHash(withoutHash) }
}

export type ReleaseValidationCode =
  /* Structural */
  | 'release_duplicate_id'
  | 'release_scenario_recipe_mismatch'
  | 'release_supersedes_missing'
  | 'release_supersedes_procedure_mismatch'
  /* Immutability */
  | 'release_definition_mutated'
  | 'release_pin_missing'
  | 'release_pin_hash_mismatch'
  | 'release_frozen_hash_absent'
  | 'release_draft_frozen_hash'
  /* Pointer */
  | 'release_pointer_unknown'
  | 'release_pointer_not_published'
  | 'release_pointer_retired'
  | 'release_pointer_procedure_mismatch'
  | 'release_pointer_missing'
  /* Independently versioned context */
  | 'release_catalog_import_advanced'
  | 'release_resolver_contract_advanced'
  | 'release_resolver_implementation_advanced'

export interface ReleaseValidationMessage {
  code: ReleaseValidationCode
  severity: 'blocking' | 'warning' | 'info'
  releaseBundleId: string | null
  message: string
  /** Which pinned definitions differ, when the code is about a hash. */
  changedPins?: string[]
}

export interface ReleaseValidationInput {
  /** Every bundle the repository retains, published, draft, and retired alike. */
  bundles: PreferenceCardReleaseBundle[]
  pointers: ReleasePointerMap
  /**
   * The live definitions each bundle claims to pin, keyed by bundle id. A bundle with no
   * entry is one whose definitions are no longer loadable at all; that is `release_pin_missing`
   * rather than a silent pass.
   */
  sourcesByBundleId: Map<string, ReleaseDefinitionSources | null>
}

function pinDiff(
  bundle: PreferenceCardReleaseBundle,
  sources: ReleaseDefinitionSources,
): { missing: string[]; mismatched: string[] } {
  const missing: string[] = []
  const mismatched: string[] = []

  if (sources.recipe.id !== bundle.recipeVersionId) {
    missing.push(`recipe:${bundle.recipeVersionId}`)
  } else if (recipeDefinitionHash(sources.recipe) !== bundle.recipeDefinitionHash) {
    mismatched.push(`recipe:${bundle.recipeVersionId}`)
  }

  const moduleById = new Map(
    sources.modules.map((moduleVersion) => [moduleVersion.id, moduleVersion]),
  )
  for (const pin of bundle.modulePins) {
    const moduleVersion = moduleById.get(pin.moduleVersionId)
    if (!moduleVersion) {
      missing.push(`module:${pin.moduleVersionId}`)
      continue
    }
    if (moduleDefinitionHash(moduleVersion) !== pin.definitionHash) {
      mismatched.push(`module:${pin.moduleVersionId}`)
    }
  }

  const setChecks: Array<[DefinitionPin, string]> = [
    [bundle.modifierSetPin, modifierSetDefinitionHash(sources.modifiers)],
    [bundle.rescueModuleSetPin, rescueModuleSetDefinitionHash(sources.rescueModules)],
    [
      bundle.compatibilityRuleSetPin,
      compatibilityRuleSetDefinitionHash(sources.compatibilityRules),
    ],
    [bundle.roleTaxonomyPin, roleTaxonomyDefinitionHash(sources.roleTaxonomy)],
  ]
  for (const [pin, current] of setChecks) {
    if (pin.definitionHash !== current) mismatched.push(pin.id)
  }

  return { missing, mismatched }
}

/**
 * Every way a retained release set can be wrong, checked in one pass.
 *
 * Run by the build script as a hard gate and by `release-bundle.test.ts` as a standing check,
 * so a pinned definition cannot be edited or deleted in a commit that still passes CI. The
 * two "advanced" codes are warnings rather than errors on purpose: an external catalog moving
 * and the resolver contract moving are real events with their own governance, and treating
 * them as mutations of authored clinical content would flood the signal that matters.
 */
export function validateReleaseBundles(input: ReleaseValidationInput): ReleaseValidationMessage[] {
  const messages: ReleaseValidationMessage[] = []
  const byId = new Map<string, PreferenceCardReleaseBundle>()

  for (const bundle of input.bundles) {
    if (byId.has(bundle.id)) {
      messages.push({
        code: 'release_duplicate_id',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} is defined more than once. A release id must identify exactly one immutable definition set.`,
      })
      continue
    }
    byId.set(bundle.id, bundle)
  }

  for (const bundle of byId.values()) {
    const frozen = bundle.releaseState !== 'draft'
    const recomputed = releaseBundleDefinitionHash(bundle)

    if (frozen && !bundle.definitionHash) {
      messages.push({
        code: 'release_frozen_hash_absent',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} is ${bundle.releaseState} but carries no frozen definition hash. Publishing is the act of recording one.`,
      })
    } else if (frozen && recomputed !== bundle.definitionHash) {
      messages.push({
        code: 'release_definition_mutated',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} is ${bundle.releaseState} and its pinned definition set no longer hashes to what was published (${bundle.definitionHash} → ${recomputed}). A published release is immutable: publish a new release instead of editing this one.`,
      })
    }

    if (bundle.supersedesReleaseBundleId) {
      const superseded = byId.get(bundle.supersedesReleaseBundleId)
      if (!superseded) {
        messages.push({
          code: 'release_supersedes_missing',
          severity: 'blocking',
          releaseBundleId: bundle.id,
          message: `Release ${bundle.id} supersedes ${bundle.supersedesReleaseBundleId}, which is not retained. A superseded release stays available so the cards pinned to it can still be reconstructed.`,
        })
      } else if (superseded.sourceProcedureCode !== bundle.sourceProcedureCode) {
        messages.push({
          code: 'release_supersedes_procedure_mismatch',
          severity: 'blocking',
          releaseBundleId: bundle.id,
          message: `Release ${bundle.id} (${bundle.sourceProcedureCode}) supersedes ${superseded.id}, which belongs to ${superseded.sourceProcedureCode}.`,
        })
      }
    }

    const sources = input.sourcesByBundleId.get(bundle.id) ?? null
    if (!sources) {
      messages.push({
        code: 'release_pin_missing',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} pins definitions that are no longer loadable. A retained release must stay reconstructable.`,
      })
      continue
    }

    if (sources.recipe.sourceProcedureCode !== bundle.sourceProcedureCode) {
      messages.push({
        code: 'release_scenario_recipe_mismatch',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} claims procedure ${bundle.sourceProcedureCode} but its pinned recipe belongs to ${sources.recipe.sourceProcedureCode}.`,
      })
    }

    const { missing, mismatched } = pinDiff(bundle, sources)
    if (missing.length > 0) {
      messages.push({
        code: 'release_pin_missing',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        changedPins: missing,
        message: `Release ${bundle.id} pins ${missing.length} definition(s) that no longer exist: ${missing.join(', ')}. Retained releases must keep every definition they pin.`,
      })
    }
    if (mismatched.length > 0 && frozen) {
      messages.push({
        code: 'release_pin_hash_mismatch',
        severity: 'blocking',
        releaseBundleId: bundle.id,
        changedPins: mismatched,
        message: `Release ${bundle.id} is ${bundle.releaseState} and ${mismatched.length} pinned definition(s) have changed since publication: ${mismatched.join(', ')}. Publish a new release rather than editing a published one.`,
      })
    }

    if (frozen && sources.catalogImportId !== bundle.catalogImportId) {
      messages.push({
        code: 'release_catalog_import_advanced',
        severity: 'warning',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} was published against catalog import ${bundle.catalogImportId}; the current import is ${sources.catalogImportId}. Product identity and local formulary state are intentionally current, so this is recorded rather than blocking.`,
      })
    }
    if (frozen && sources.resolverContractVersion !== bundle.resolverContractVersion) {
      messages.push({
        code: 'release_resolver_contract_advanced',
        severity: 'warning',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} was published against resolver contract ${bundle.resolverContractVersion}; the current contract is ${sources.resolverContractVersion}. The resolver is code and is not retained, so a contract change is surfaced rather than pinned.`,
      })
    }
    // Provenance drift, not a support boundary. A refactor that preserves the contract lands
    // here and nowhere else — which is the whole point of separating the two.
    if (frozen && sources.resolverImplementationHash !== bundle.resolverImplementationHash) {
      messages.push({
        code: 'release_resolver_implementation_advanced',
        severity: 'info',
        releaseBundleId: bundle.id,
        message: `Release ${bundle.id} was published by resolver build ${bundle.resolverImplementationHash.slice(0, 12)}; the current build is ${sources.resolverImplementationHash.slice(0, 12)}. The semantic contract ${bundle.resolverContractVersion} is unchanged, so cards pinned to this release are unaffected.`,
      })
    }
  }

  const proceduresWithBundles = new Set(
    [...byId.values()].map((bundle) => bundle.sourceProcedureCode),
  )
  for (const [procedureCode, releaseBundleId] of Object.entries(input.pointers)) {
    const target = byId.get(releaseBundleId)
    if (!target) {
      messages.push({
        code: 'release_pointer_unknown',
        severity: 'blocking',
        releaseBundleId,
        message: `The current-release pointer for ${procedureCode} names ${releaseBundleId}, which is not a retained release.`,
      })
      continue
    }
    if (target.sourceProcedureCode !== procedureCode) {
      messages.push({
        code: 'release_pointer_procedure_mismatch',
        severity: 'blocking',
        releaseBundleId,
        message: `The current-release pointer for ${procedureCode} names ${releaseBundleId}, which belongs to ${target.sourceProcedureCode}.`,
      })
    }
    if (target.releaseState === 'retired') {
      messages.push({
        code: 'release_pointer_retired',
        severity: 'blocking',
        releaseBundleId,
        message: `The current-release pointer for ${procedureCode} names retired release ${releaseBundleId}. A retired release stays available for the cards pinned to it and cannot be used for new ones.`,
      })
    } else if (target.releaseState !== 'published') {
      messages.push({
        code: 'release_pointer_not_published',
        severity: 'blocking',
        releaseBundleId,
        message: `The current-release pointer for ${procedureCode} names ${releaseBundleId}, which is still a draft. Only a published release may be current.`,
      })
    }
  }

  for (const procedureCode of [...proceduresWithBundles].sort()) {
    if (input.pointers[procedureCode]) continue
    messages.push({
      code: 'release_pointer_missing',
      severity: 'blocking',
      releaseBundleId: null,
      message: `Procedure ${procedureCode} has retained releases but no current-release pointer, so nothing says which one a new card should use. Current selection is never inferred.`,
    })
  }

  return messages
}

export type ReleaseResolutionErrorCode =
  | 'release_unknown'
  | 'release_definition_mutated'
  | 'release_pin_missing'
  | 'release_not_selectable'

export type ReleaseResolutionResult =
  | { ok: true; bundle: PreferenceCardReleaseBundle; sources: ReleaseDefinitionSources }
  | { ok: false; code: ReleaseResolutionErrorCode; message: string; changedPins?: string[] }

/**
 * Resolve a pinned release for reconstruction, verifying every pin before handing it back.
 *
 * A card whose release is gone, or whose pinned definitions no longer hash to what was
 * published, gets a typed failure that the caller turns into a view-only card. It never
 * receives a different release: substituting one is precisely the silent behaviour the pin
 * exists to prevent, and a card that quietly resolves against content its author never saw is
 * worse than a card that will not open.
 *
 * Retired releases resolve. Retirement governs what a *new* card may be built on, checked
 * separately by `assertSelectableForNewCard`; a card already pinned to a retired release must
 * still reconstruct or the retention guarantee is empty.
 */
export function resolvePinnedRelease(
  releaseBundleId: string,
  bundles: ReadonlyMap<string, PreferenceCardReleaseBundle>,
  loadSources: (bundle: PreferenceCardReleaseBundle) => ReleaseDefinitionSources | null,
): ReleaseResolutionResult {
  const bundle = bundles.get(releaseBundleId)
  if (!bundle) {
    return {
      ok: false,
      code: 'release_unknown',
      message: `This card is pinned to release ${releaseBundleId}, which is no longer retained.`,
    }
  }

  const sources = loadSources(bundle)
  if (!sources) {
    return {
      ok: false,
      code: 'release_pin_missing',
      message: `Release ${releaseBundleId} pins definitions that are no longer available.`,
    }
  }

  const { missing, mismatched } = pinDiff(bundle, sources)
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'release_pin_missing',
      changedPins: missing,
      message: `Release ${releaseBundleId} pins definitions that are no longer available: ${missing.join(', ')}.`,
    }
  }
  if (mismatched.length > 0) {
    return {
      ok: false,
      code: 'release_definition_mutated',
      changedPins: mismatched,
      message: `Release ${releaseBundleId} pins definitions that have changed since it was published: ${mismatched.join(', ')}. This card is shown as it was saved rather than rebuilt from content its author never reviewed.`,
    }
  }

  return { ok: true, bundle, sources }
}

/** Whether a release may back a *new* card. Retired releases reconstruct but do not originate. */
export function assertSelectableForNewCard(
  bundle: PreferenceCardReleaseBundle,
): { ok: true } | { ok: false; code: 'release_not_selectable'; message: string } {
  if (bundle.releaseState === 'published') return { ok: true }
  return {
    ok: false,
    code: 'release_not_selectable',
    message:
      bundle.releaseState === 'retired'
        ? `Release ${bundle.id} is retired. It remains available for the cards already pinned to it and cannot be used to build a new one.`
        : `Release ${bundle.id} is a draft and cannot be used to build a card.`,
  }
}

/**
 * The current release for a procedure — read from the pointer, and only from the pointer.
 *
 * There is no fallback. "No pointer" returns null rather than reaching for a bundle that
 * looks current, because every rule for picking one without being told encodes an unreviewed
 * policy: `bundles.at(-1)` promotes whatever a merge happened to append, sorting by
 * `publishedAt` promotes a backported fix over the line it was backported from, and comparing
 * version strings promotes `v1-10-0` or `v1-2-0` depending on whose comparator wins.
 */
export function resolveCurrentRelease(
  sourceProcedureCode: string,
  pointers: ReleasePointerMap,
  bundles: ReadonlyMap<string, PreferenceCardReleaseBundle>,
): PreferenceCardReleaseBundle | null {
  const pointed = pointers[sourceProcedureCode]
  if (!pointed) return null
  const bundle = bundles.get(pointed)
  if (!bundle || bundle.sourceProcedureCode !== sourceProcedureCode) return null
  return assertSelectableForNewCard(bundle).ok ? bundle : null
}

export interface ReleaseImpactPinChange {
  pin: string
  kind: 'added' | 'removed' | 'changed'
  previousHash: string | null
  nextHash: string | null
}

export interface ReleaseRequirementChange {
  requirementKey: string
  kind: 'added' | 'removed' | 'changed'
  moduleVersionIds: string[]
  changedFields: string[]
}

/**
 * A change to the **authored effect of selecting a modifier** this procedure offers.
 *
 * Not a statement that the modifier is selected in any scenario: the base requirement diff
 * (`requirementChanges`) covers what every card starts from, and this covers what selecting
 * the named modifier *would do* — a distinction the report keeps explicit so a reader cannot
 * mistake a conditional pathway change for a default-card change. Without this layer, a
 * release whose only difference is the modifier set reads as "a set pin moved, zero
 * requirement changes" while, for example, a modifier-added requirement silently went from
 * required to conditional — a clinically meaningful change the release review exists to
 * catch.
 */
export interface ReleaseModifierEffectChange {
  sourceKind: 'modifier'
  modifierCode: string
  /** The authored action this row describes; null for a modifier-level field change. */
  actionId: string | null
  actionType: string | null
  /** The action's authored application order, where an action is being described. */
  sequence: number | null
  kind: 'added' | 'removed' | 'changed'
  /**
   * The requirement identity the action adds or targets — the added slot's requirement key
   * for `add_slot`, otherwise the authored target. Null for modifier-level changes.
   */
  requirementKey: string | null
  changedFields: string[]
  /** The authored effect before/after, at the field level a reviewer reads. */
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface ReleaseImpactReport {
  previousReleaseBundleId: string | null
  nextReleaseBundleId: string
  sourceProcedureCode: string
  /** True when nothing a card resolves from differs; publishing would be a no-op. */
  identical: boolean
  pinChanges: ReleaseImpactPinChange[]
  /**
   * Changes to the effective requirement definitions — the exact pinned recipes and modules
   * expanded through the canonical action evaluator over the release's full authored surface
   * (every referenced module, optional ones included). Not merely the default card: an
   * optional module a card may select is diffable content too.
   */
  requirementChanges: ReleaseRequirementChange[]
  /** Changes to the authored effect of selecting a modifier this procedure offers. */
  modifierEffectChanges: ReleaseModifierEffectChange[]
  catalogImportChanged: boolean
  resolverContractChanged: boolean
}

/**
 * What makes two authored requirements different.
 *
 * Exported because the rebuild planner compares composed slots across two releases and must use
 * exactly this list. A second list would drift, and the drift would surface as a rebuild carrying
 * a selection forward unchanged on a requirement this diff had already reported as changed to the
 * reviewer who published the release.
 *
 * `release-bundle.ts` is deliberately outside `RESOLVER_SOURCE_FILES`, so exporting from here does
 * not move `resolverImplementationHash` and no release artifact needs rebuilding.
 */
export const REQUIREMENT_COMPARED_FIELDS = [
  'roleCode',
  'label',
  'genericRequirement',
  'requiredness',
  'dependencyRule',
  'quantityExpression',
  'selectionMode',
  'setupZone',
  'proceduralPhase',
  'setupSequence',
  'openHoldStatus',
  'responsibleRole',
  'sterileStatus',
  'allowCustom',
  'notes',
] as const satisfies readonly (keyof RecipeSlot)[]

/**
 * The **effective** requirement definitions a release expresses, keyed by requirement key.
 *
 * Expanded through the canonical action evaluator rather than read off the raw module slots,
 * because the raw slots are inputs, not the release's semantics: a per-slot
 * `set_setup_zone` / `set_procedural_phase` / `set_requiredness` composition action changes
 * what every consuming card says while every module slot sits untouched. Diffing the raw
 * slots is how the six F-04 sampling-instrument corrections shipped without a single
 * requirement-level line in the canonical impact report (P91-C3, 2026-08-10) — the change
 * was real, reviewed, and invisible at exactly the boundary the release review reads.
 *
 * Expanded with **every module the recipe references**, not the default selection: an
 * optional module a card may select is part of the release's authored surface, and its
 * requirements must be diffable — and the custom module composition offers every module as
 * optional, so a default expansion of it would be empty. Requirement keys are globally
 * unique across modules (the composition build fails otherwise), so the full selection
 * cannot manufacture a conflict that a real card could not hit.
 */
function effectiveRequirementIndex(sources: ReleaseDefinitionSources) {
  const expansion = expandRecipeComposition({
    recipe: sources.recipe,
    modules: sources.modules,
    selectedModuleVersionIds: sources.recipe.moduleReferences.map(
      (reference) => reference.moduleVersionId,
    ),
    startSequence: 1,
  })
  const blocking = expansion.messages.filter((message) => message.severity === 'blocking')
  if (blocking.length > 0) {
    // A diff over a failed expansion would under-report the change — the one failure mode a
    // release-review artifact must not have — so this is an error, never a partial answer.
    throw new Error(
      `Release impact cannot be computed for ${sources.recipe.id}: expanding its full composition raised ${blocking.length} blocking message(s) (${[...new Set(blocking.map((message) => message.code))].sort().join(', ')}).`,
    )
  }
  const index = new Map<string, { slot: Record<string, unknown>; moduleVersionIds: string[] }>()
  for (const slot of expansion.slots) {
    index.set(slot.requirementKey, {
      slot: slot as unknown as Record<string, unknown>,
      moduleVersionIds: [...(slot.sourceModuleVersionIds ?? [])],
    })
  }
  return index
}

/**
 * What an authored modifier action *does*, summarized at the field level a reviewer reads.
 *
 * `add_slot` summarizes the added requirement itself — the same authored fields the base
 * requirement diff compares (`REQUIREMENT_COMPARED_FIELDS`) plus the slot's `id`, which the
 * runtime dedupes and targets by; the targeted action types summarize their target identity
 * plus the specific effect field their payload carries, so a `set_requiredness` change reads
 * as `requiredness` rather than as an opaque `payload`.
 *
 * A summary must never claim an effect the modifier engine does not apply: the modifier
 * evaluator's `set_requiredness` reads only `payload.value` (unlike the composition
 * evaluator, which also carries the dependency rule), so any other authored payload keys are
 * surfaced under `unappliedPayload` — visible when they change, never presented as an
 * effect.
 */
function modifierActionEffectSummary(action: ModifierAction): Record<string, unknown> {
  const base: Record<string, unknown> = {
    actionType: action.actionType,
    sequence: action.sequence,
    targetSlotId: action.targetSlotId ?? null,
    targetRequirementKey: action.targetRequirementKey ?? null,
    targetRoleCode: action.targetRoleCode ?? null,
  }
  const payload = action.payload
  const withUnapplied = (
    summary: Record<string, unknown>,
    appliedKeys: readonly string[],
  ): Record<string, unknown> => {
    const rest = Object.fromEntries(
      Object.entries(payload).filter(([key]) => !appliedKeys.includes(key)),
    )
    return Object.keys(rest).length > 0 ? { ...summary, unappliedPayload: rest } : summary
  }
  switch (action.actionType) {
    case 'add_slot': {
      const slot = (payload.slot ?? {}) as Record<string, unknown>
      const summarized = [
        'id',
        'requirementKey',
        'roleCode',
        'label',
        'genericRequirement',
        'requiredness',
        'dependencyRule',
        'quantityExpression',
        'selectionMode',
        'setupZone',
        'proceduralPhase',
        'setupSequence',
        'openHoldStatus',
        'responsibleRole',
        'sterileStatus',
        'allowCustom',
        'notes',
      ] as const
      return {
        ...base,
        ...Object.fromEntries(summarized.map((field) => [field, slot[field] ?? null])),
      }
    }
    case 'set_requiredness':
      return withUnapplied({ ...base, requiredness: payload.value ?? null }, ['value'])
    case 'set_setup_zone':
      return withUnapplied({ ...base, setupZone: payload.value ?? null }, ['value'])
    case 'set_procedural_phase':
      return withUnapplied({ ...base, proceduralPhase: payload.value ?? null }, ['value'])
    case 'set_open_hold_status':
      return withUnapplied({ ...base, openHoldStatus: payload.value ?? null }, ['value'])
    case 'set_quantity':
      return withUnapplied({ ...base, quantityExpression: payload.expression ?? null }, [
        'expression',
      ])
    case 'append_note':
      return withUnapplied({ ...base, notes: payload.note ?? null }, ['note'])
    case 'replace_role':
      return withUnapplied(
        {
          ...base,
          roleCode: payload.roleCode ?? null,
          label: payload.label ?? null,
          genericRequirement: payload.genericRequirement ?? null,
        },
        ['roleCode', 'label', 'genericRequirement'],
      )
    case 'remove_slot':
      return withUnapplied(base, [])
    case 'require_room_capability':
      return withUnapplied({ ...base, capability: payload.capability ?? null }, ['capability'])
    case 'add_rescue_module':
      return withUnapplied({ ...base, rescueModuleCode: payload.code ?? null }, ['code'])
    case 'validate_compatibility':
    case 'raise_warning':
    case 'raise_blocking_error':
      return { ...base, payload: { ...payload } }
    default: {
      const exhaustiveCheck: never = action.actionType
      return exhaustiveCheck
    }
  }
}

/** The requirement identity an action adds or targets, for the report row. */
function modifierActionRequirementKey(action: ModifierAction): string | null {
  if (action.actionType === 'add_slot') {
    const slot = (action.payload.slot ?? {}) as Record<string, unknown>
    const key = slot.requirementKey ?? slot.id
    return typeof key === 'string' ? key : null
  }
  return action.targetRequirementKey ?? action.targetSlotId ?? action.targetRoleCode ?? null
}

function summaryChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((field) => stableStringify(before[field]) !== stableStringify(after[field]))
    .sort()
}

/**
 * The authored-modifier-effect diff between two releases' definition sets.
 *
 * Scoped to the modifiers either release's recipe **offers** (`allowedModifierCodes`): a
 * change to a modifier no card of this procedure may select cannot change any of its cards,
 * and reporting it on every procedure would repeat one global edit sixteen times. Within
 * scope, a modifier entering or leaving the selectable offer reports a first-class
 * modifier-level row (`changedFields: ["offered"]`) — without it, withdrawing a
 * **zero-action** modifier would read as a bare pin move, and withdrawing an acting one
 * would read as its actions being deleted; actions are then compared by authored id; and a
 * modifier-level change to `conflictsWith` or `active` reports as its own row, because
 * mutual exclusion and selectability are part of the authored effect.
 */
function diffModifierEffects(
  previous: ReleaseDefinitionSources,
  next: ReleaseDefinitionSources,
): ReleaseModifierEffectChange[] {
  const scope = new Set([
    ...previous.recipe.allowedModifierCodes,
    ...next.recipe.allowedModifierCodes,
  ])
  const changes: ReleaseModifierEffectChange[] = []

  const offeredBefore = new Set(previous.recipe.allowedModifierCodes)
  const offeredAfter = new Set(next.recipe.allowedModifierCodes)
  const definitionBefore = new Map(previous.modifiers.map((modifier) => [modifier.code, modifier]))
  const definitionAfter = new Map(next.modifiers.map((modifier) => [modifier.code, modifier]))

  for (const modifierCode of [...scope].sort()) {
    // A modifier participates on a side only when that side both offers it and defines it —
    // an offered code with no definition cannot be selected, and a defined code the recipe
    // does not offer cannot be selected either.
    const before = offeredBefore.has(modifierCode) ? definitionBefore.get(modifierCode) : undefined
    const after = offeredAfter.has(modifierCode) ? definitionAfter.get(modifierCode) : undefined
    if (!before && !after) continue

    if (!before || !after) {
      // The modifier entered or left this procedure's selectable offer. First-class row, so
      // a zero-action modifier's withdrawal is never a bare pin move and an acting one's
      // withdrawal is not misread as its actions being deleted from the set.
      const present = (before ?? after) as ModifierDefinition
      changes.push({
        sourceKind: 'modifier',
        modifierCode,
        actionId: null,
        actionType: null,
        sequence: null,
        kind: after ? 'added' : 'removed',
        requirementKey: null,
        changedFields: ['offered'],
        before: before ? { offered: true, actionCount: present.actions.length } : null,
        after: after ? { offered: true, actionCount: present.actions.length } : null,
      })
    }

    const actionsBefore = new Map((before?.actions ?? []).map((action) => [action.id, action]))
    const actionsAfter = new Map((after?.actions ?? []).map((action) => [action.id, action]))
    for (const actionId of [...new Set([...actionsBefore.keys(), ...actionsAfter.keys()])].sort()) {
      const actionBefore = actionsBefore.get(actionId)
      const actionAfter = actionsAfter.get(actionId)
      const summaryBefore = actionBefore ? modifierActionEffectSummary(actionBefore) : null
      const summaryAfter = actionAfter ? modifierActionEffectSummary(actionAfter) : null
      if (summaryBefore && summaryAfter) {
        const changedFields = summaryChangedFields(summaryBefore, summaryAfter)
        if (changedFields.length === 0) continue
        changes.push({
          sourceKind: 'modifier',
          modifierCode,
          actionId,
          actionType: (actionAfter as ModifierAction).actionType,
          sequence: (actionAfter as ModifierAction).sequence,
          kind: 'changed',
          requirementKey: modifierActionRequirementKey(actionAfter as ModifierAction),
          changedFields,
          before: summaryBefore,
          after: summaryAfter,
        })
        continue
      }
      const present = (actionBefore ?? actionAfter) as ModifierAction
      changes.push({
        sourceKind: 'modifier',
        modifierCode,
        actionId,
        actionType: present.actionType,
        sequence: present.sequence,
        kind: actionAfter ? 'added' : 'removed',
        requirementKey: modifierActionRequirementKey(present),
        changedFields: [],
        before: summaryBefore,
        after: summaryAfter,
      })
    }

    if (before && after) {
      const levelBefore = {
        conflictsWith: [...before.conflictsWith].sort(),
        active: before.active,
      }
      const levelAfter = { conflictsWith: [...after.conflictsWith].sort(), active: after.active }
      const changedFields = summaryChangedFields(levelBefore, levelAfter)
      if (changedFields.length > 0) {
        changes.push({
          sourceKind: 'modifier',
          modifierCode,
          actionId: null,
          actionType: null,
          sequence: null,
          kind: 'changed',
          requirementKey: null,
          changedFields,
          before: levelBefore,
          after: levelAfter,
        })
      }
    }
  }

  return changes
}

/**
 * What advancing from one release to another would change, at the level a reviewer reads.
 *
 * Three layers, because a pin diff alone is not reviewable: "the compatibility rule set hash
 * moved" tells a clinician nothing, while "AIRWAY_RETRIEVAL_FORCEPS changed from required to
 * backup" is the sentence they can approve or reject. The pin layer proves *what* is
 * different; the requirement layer says what that means on the **base effective recipe** —
 * the exact old and new pinned recipes and modules, expanded through the canonical action
 * evaluator, so an action-borne change is a first-class requirement change rather than an
 * invisible recipe-pin move; and the modifier layer says what changed about the **authored
 * effect of selecting a modifier** the procedure offers, without implying any scenario
 * selects it.
 *
 * Deliberately not a recommendation. It does not score the change, gate it, or decide whether
 * the pointer should advance — a person reads it and decides.
 */
export function diffReleaseBundles(
  previous: { bundle: PreferenceCardReleaseBundle; sources: ReleaseDefinitionSources } | null,
  next: { bundle: PreferenceCardReleaseBundle; sources: ReleaseDefinitionSources },
): ReleaseImpactReport {
  const pinChanges: ReleaseImpactPinChange[] = []

  const previousPins = new Map<string, string>()
  const nextPins = new Map<string, string>()
  const collect = (
    target: Map<string, string>,
    bundle: PreferenceCardReleaseBundle | undefined,
  ) => {
    if (!bundle) return
    target.set(`recipe:${bundle.recipeVersionId}`, bundle.recipeDefinitionHash)
    for (const pin of bundle.modulePins) {
      target.set(`module:${pin.moduleVersionId}`, pin.definitionHash)
    }
    for (const pin of [
      bundle.modifierSetPin,
      bundle.rescueModuleSetPin,
      bundle.compatibilityRuleSetPin,
      bundle.roleTaxonomyPin,
    ]) {
      target.set(pin.id, pin.definitionHash)
    }
  }
  collect(previousPins, previous?.bundle)
  collect(nextPins, next.bundle)

  for (const key of [...new Set([...previousPins.keys(), ...nextPins.keys()])].sort()) {
    const before = previousPins.get(key) ?? null
    const after = nextPins.get(key) ?? null
    if (before === after) continue
    pinChanges.push({
      pin: key,
      kind: before === null ? 'added' : after === null ? 'removed' : 'changed',
      previousHash: before,
      nextHash: after,
    })
  }

  const requirementChanges: ReleaseRequirementChange[] = []
  const beforeRequirements = previous ? effectiveRequirementIndex(previous.sources) : new Map()
  const afterRequirements = effectiveRequirementIndex(next.sources)
  const keys = [
    ...new Set([...beforeRequirements.keys(), ...afterRequirements.keys()]),
  ].sort() as string[]

  for (const requirementKey of keys) {
    const before = beforeRequirements.get(requirementKey)
    const after = afterRequirements.get(requirementKey)
    if (before && !after) {
      requirementChanges.push({
        requirementKey,
        kind: 'removed',
        moduleVersionIds: before.moduleVersionIds,
        changedFields: [],
      })
      continue
    }
    if (!before && after) {
      requirementChanges.push({
        requirementKey,
        kind: 'added',
        moduleVersionIds: after.moduleVersionIds,
        changedFields: [],
      })
      continue
    }
    if (!before || !after) continue
    const changedFields = REQUIREMENT_COMPARED_FIELDS.filter(
      (field) => stableStringify(before.slot[field]) !== stableStringify(after.slot[field]),
    )
    if (changedFields.length === 0) continue
    requirementChanges.push({
      requirementKey,
      kind: 'changed',
      moduleVersionIds: after.moduleVersionIds,
      changedFields: [...changedFields],
    })
  }

  // A comparison needs two sides: an initial release has no "authored effect it changed",
  // so its modifier layer is empty rather than a dump of every offered modifier's actions.
  const modifierEffectChanges = previous ? diffModifierEffects(previous.sources, next.sources) : []

  return {
    previousReleaseBundleId: previous?.bundle.id ?? null,
    nextReleaseBundleId: next.bundle.id,
    sourceProcedureCode: next.bundle.sourceProcedureCode,
    identical:
      pinChanges.length === 0 &&
      requirementChanges.length === 0 &&
      modifierEffectChanges.length === 0,
    pinChanges,
    requirementChanges,
    modifierEffectChanges,
    catalogImportChanged: previous
      ? previous.bundle.catalogImportId !== next.bundle.catalogImportId
      : false,
    resolverContractChanged: previous
      ? previous.bundle.resolverContractVersion !== next.bundle.resolverContractVersion
      : false,
  }
}
