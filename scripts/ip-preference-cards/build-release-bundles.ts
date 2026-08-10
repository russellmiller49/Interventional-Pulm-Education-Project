import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  getLiveDefinitionSets,
  getLiveRecipeVersions,
  getReleaseDefinitionSources,
  type ReleaseDefinitionSetPins,
} from '../../src/features/preference-cards/data/demo-context.server'
import {
  emptyCompositionLedger,
  validateCompositionLedger,
  withPublishedRecipes,
  type CompositionLedger,
} from '../../src/features/preference-cards/domain/composition-ledger'
import {
  emptyDefinitionSetLedger,
  validateDefinitionSetLedger,
  withPublishedDefinitionSets,
  COMPATIBILITY_RULE_SET_DEFINITION_ID as COMPAT_SET_ID,
  MODIFIER_SET_DEFINITION_ID as MODIFIER_SET_ID,
  RESCUE_MODULE_SET_DEFINITION_ID as RESCUE_SET_ID,
  ROLE_TAXONOMY_DEFINITION_ID as TAXONOMY_SET_ID,
  type DefinitionSetContent,
  type DefinitionSetLedger,
} from '../../src/features/preference-cards/domain/definition-set-ledger'
import {
  computeReleaseBundle,
  diffReleaseBundles,
  validateReleaseBundles,
  type PreferenceCardReleaseBundle,
  type ReleaseBundleAuthoredFields,
  type ReleaseDefinitionSources,
  type ReleaseImpactReport,
  type ReleasePointerMap,
  type ReleaseState,
  type ReleaseValidationMessage,
} from '../../src/features/preference-cards/domain/release-bundle'
import type { RecipeModuleVersion } from '../../src/features/preference-cards/domain/types'
import {
  validateModuleLedger,
  withPublishedModules,
  type ModuleLedger,
} from '../../src/features/preference-cards/domain/module-ledger'
import {
  emptyHistoricalCatalogReleaseFile,
  emptyHistoricalCatalogRowStore,
  validateHistoricalCatalog,
  withRetainedCatalogRelease,
  withRetainedCatalogRows,
  type HistoricalCatalogReleaseFile,
  type HistoricalCatalogRowStore,
} from '../../src/features/preference-cards/domain/historical-catalog'
import {
  emptyProductFamilyLedger,
  validateProductFamilyLedger,
  type ProductFamilyLedger,
  type ReviewedProductFamilyVersion,
} from '../../src/features/preference-cards/domain/product-family'
import { PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION } from '../../src/features/preference-cards/domain/resolve-card'
import type {
  CatalogProductRecord,
  ProductGovernanceRecord,
  ProductRoleRecord,
  RoleRecord,
} from '../../src/features/preference-cards/server/catalog-store'

import { computeCatalogRelease } from './catalog-release-id'
import { deriveCatalogRetention } from './catalog-retention'
import {
  deriveReviewedProductFamilyVersion,
  productFamilyVersionIdFor,
  type SeedProductFamilyFile,
} from './product-family-derivation'
import { computeResolverRelease } from './resolver-release-id'
import { formatJson } from './format-json'

/**
 * Builds the immutable release bundles from the authored release seed, and refuses to write
 * anything if a published release no longer describes the definitions it published.
 *
 * The division of labour is the whole point. An author writes down *lifecycle* facts — this
 * release exists, it supersedes that one, it is published, it is retired, here is what
 * changed and why. This script computes the *closure* — which recipe, which module versions,
 * which modifier set, which rescue modules, which compatibility rules, which role table — and
 * hashes every one. Nobody hand-writes a pin, because a hand-written pin is a claim about
 * content that nothing checked.
 *
 * Publication is the act of freezing a computed hash into the seed. After that the hash is a
 * standing assertion: edit any pinned definition and this script fails with the list of what
 * moved, and the only way forward is to publish a new release. That is the mechanism behind
 * "published definitions are immutable" — not a convention, a build failure.
 */

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const SEED_DIRECTORY = 'data/ip-preference-cards/seed'
const REVIEWED_DIRECTORY = 'data/ip-preference-cards/reviewed'

interface SeedRelease {
  id: string
  sourceProcedureCode: string
  scenarioId: string
  recipeVersionId: string
  releaseState: ReleaseState
  publishedAt: string | null
  retiredAt: string | null
  supersedesReleaseBundleId: string | null
  releaseNotes: string | null
  /**
   * The frozen hash of everything this release pins. Required once published, forbidden while
   * still a draft — a draft that carried one would be claiming to be frozen while its
   * definitions are still moving.
   */
  definitionHash?: string
  /** Independently versioned context, frozen at publication. Required once published. */
  catalogImportId?: string
  resolverContractVersion?: string
  resolverImplementationHash?: string
}

interface SeedReleaseFile {
  formatVersion: string
  /**
   * Which release a *new* card for each procedure is built on. The one and only answer to
   * "which version is current" — see `resolveCurrentRelease`, which has no fallback.
   */
  pointers: Record<string, string>
  releases: SeedRelease[]
}

/** The shape of the previously generated bundle file, read back as the record of pins. */
interface GeneratedReleaseFile {
  pointers: Record<string, string>
  bundles: PreferenceCardReleaseBundle[]
}

export interface BuildReleaseBundlesResult {
  bundles: PreferenceCardReleaseBundle[]
  pointers: ReleasePointerMap
  impact: ReleaseImpactReport[]
  messages: ReleaseValidationMessage[]
}

/** A bundle's four whole-set pins, in the shape `getReleaseDefinitionSources` resolves. */
export function setPinsOfBundle(bundle: PreferenceCardReleaseBundle): ReleaseDefinitionSetPins {
  return {
    modifierSetHash: bundle.modifierSetPin.definitionHash,
    rescueModuleSetHash: bundle.rescueModuleSetPin.definitionHash,
    compatibilityRuleSetHash: bundle.compatibilityRuleSetPin.definitionHash,
    roleTaxonomyHash: bundle.roleTaxonomyPin.definitionHash,
  }
}

function fail(message: string): never {
  throw new Error(message)
}

/**
 * Compute every bundle the seed declares, then check the whole retained set at once.
 *
 * Exported so `build-release-bundles.test.ts` can feed it a mutated seed and assert the
 * failure rather than trusting that the failure exists.
 *
 * `recordedSetPinsByReleaseId` carries the four whole-set pins each frozen release recorded
 * in the previously generated bundles. A frozen release resolves its sets through those
 * pins — live content when the hash still matches, the retention ledger otherwise — so
 * editing a live definition set moves only the releases that have not yet been frozen. The
 * frozen `definitionHash` still guards the pins themselves: recorded pins that disagree with
 * what was frozen recompute to a different bundle hash and fail as `release_definition_mutated`.
 */
export function buildReleaseBundles(input: {
  seed: SeedReleaseFile
  resolverContractVersion: string
  loadSources: (
    recipeVersionId: string,
    setPins?: ReleaseDefinitionSetPins,
  ) => ReleaseDefinitionSources | null
  recordedSetPinsByReleaseId?: ReadonlyMap<string, ReleaseDefinitionSetPins>
}): BuildReleaseBundlesResult {
  const { seed, loadSources } = input
  const recordedSetPins = input.recordedSetPinsByReleaseId ?? new Map<string, never>()

  const bundles: PreferenceCardReleaseBundle[] = []
  const sourcesByBundleId = new Map<string, ReleaseDefinitionSources | null>()

  for (const release of seed.releases) {
    const frozen = release.releaseState !== 'draft'
    if (frozen && !release.definitionHash) {
      fail(
        `Release ${release.id} is ${release.releaseState} but records no definition hash. Run this script while it is a draft, then freeze the hash it reports.`,
      )
    }
    if (!frozen && release.definitionHash) {
      fail(
        `Release ${release.id} is a draft but records a frozen definition hash. A draft's definitions are still moving; freeze the hash when publishing it.`,
      )
    }
    if (
      frozen &&
      (!release.catalogImportId ||
        !release.resolverContractVersion ||
        !release.resolverImplementationHash)
    ) {
      fail(
        `Release ${release.id} is ${release.releaseState} but does not record the catalog release, resolver contract, and resolver build it was published against.`,
      )
    }

    // A frozen release resolves through the whole-set pins it recorded when generated; a
    // draft resolves the live sets, because a draft's pins are still being computed.
    const sources = loadSources(release.recipeVersionId, recordedSetPins.get(release.id))
    if (!sources) {
      fail(
        `Release ${release.id} pins definitions the generated data no longer supplies — the recipe version ${release.recipeVersionId} is not retained, or a pinned definition set is in neither the live sources nor the definition-set ledger. A retained release must stay reconstructable.`,
      )
    }

    const authored: ReleaseBundleAuthoredFields = {
      id: release.id,
      sourceProcedureCode: release.sourceProcedureCode,
      scenarioId: release.scenarioId,
      releaseState: release.releaseState,
      publishedAt: release.publishedAt,
      retiredAt: release.retiredAt,
      supersedesReleaseBundleId: release.supersedesReleaseBundleId,
      releaseNotes: release.releaseNotes,
      publishedCatalogImportId: release.catalogImportId ?? null,
      publishedResolverContractVersion: release.resolverContractVersion ?? null,
      publishedResolverImplementationHash: release.resolverImplementationHash ?? null,
    }

    const computed = computeReleaseBundle(authored, sources)
    // A frozen release keeps the hash it published with. Writing the recomputed one would
    // turn the guard into a rubber stamp: the file would always agree with itself and a
    // mutated definition would be recorded as if it had always been that way.
    bundles.push(
      frozen ? { ...computed, definitionHash: release.definitionHash as string } : computed,
    )
    sourcesByBundleId.set(release.id, sources)
  }

  bundles.sort((left, right) => left.id.localeCompare(right.id))

  const pointers: ReleasePointerMap = Object.fromEntries(
    Object.entries(seed.pointers).sort(([left], [right]) => left.localeCompare(right)),
  )

  const messages = validateReleaseBundles({ bundles, pointers, sourcesByBundleId })

  // The impact of each release against the one it supersedes: what a reviewer reads before
  // deciding whether the pointer should advance. Computed for every release, not only drafts,
  // so the record of what each published release changed stays in the repository.
  const byId = new Map(bundles.map((bundle) => [bundle.id, bundle]))
  const impact: ReleaseImpactReport[] = bundles.map((bundle) => {
    const sources = sourcesByBundleId.get(bundle.id) as ReleaseDefinitionSources
    const previousBundle = bundle.supersedesReleaseBundleId
      ? byId.get(bundle.supersedesReleaseBundleId)
      : undefined
    const previousSources = previousBundle
      ? (sourcesByBundleId.get(previousBundle.id) as ReleaseDefinitionSources)
      : null
    return diffReleaseBundles(
      previousBundle && previousSources
        ? { bundle: previousBundle, sources: previousSources }
        : null,
      { bundle, sources },
    )
  })

  return { bundles, pointers, impact, messages }
}

async function readJson<T>(directory: string, filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(directory, filename), 'utf8')) as T
}

/** The ledger starts empty on the first run; after that it is only ever added to. */
async function readJsonOrDefault<T>(directory: string, filename: string, fallback: T): Promise<T> {
  try {
    return await readJson<T>(directory, filename)
  } catch {
    return fallback
  }
}

async function writeJsonWhenChanged(directory: string, filename: string, value: unknown) {
  const outputPath = path.join(directory, filename)
  try {
    const current = JSON.parse(await readFile(outputPath, 'utf8')) as unknown
    if (JSON.stringify(current) === JSON.stringify(value)) return
  } catch {
    // Missing or malformed output is replaced below.
  }
  await writeFile(outputPath, await formatJson(value), 'utf8')
}

/**
 * Retain the current catalog release as immutable, content-addressed rows.
 *
 * Returns everything the caller needs to decide whether to write: the merged artifacts, the
 * problems found, and the membership index the family build checks against. Nothing is written
 * here — a generated file that disagreed with a failed validation would be a record of the
 * mutation rather than a barrier to it.
 */
async function retainCatalog(input: {
  generatedDirectory: string
  catalogRelease: Awaited<ReturnType<typeof computeCatalogRelease>>
  products: CatalogProductRecord[]
  roles: RoleRecord[]
  productRoles: ProductRoleRecord[]
  pinnedCatalogReleaseIds: ReadonlySet<string>
}) {
  const derived = deriveCatalogRetention({
    release: input.catalogRelease,
    products: input.products,
    roles: input.roles,
    productRoles: input.productRoles,
  })

  const storeBefore = await readJsonOrDefault<HistoricalCatalogRowStore>(
    input.generatedDirectory,
    'catalog-rows.json',
    emptyHistoricalCatalogRowStore(),
  )
  const releasesBefore = await readJsonOrDefault<HistoricalCatalogReleaseFile>(
    input.generatedDirectory,
    'catalog-release-manifests.json',
    emptyHistoricalCatalogReleaseFile(),
  )

  const store = withRetainedCatalogRows(storeBefore, derived.rows)
  const releases = withRetainedCatalogRelease(releasesBefore, derived.manifest)

  const problems = validateHistoricalCatalog({
    store,
    releases,
    rederived: new Map([[derived.manifest.catalogReleaseId, derived.manifest]]),
    pinnedCatalogReleaseIds: input.pinnedCatalogReleaseIds,
  })

  return { store, releases, manifest: derived.manifest, problems }
}

/**
 * Materialize the reviewed product families the seed declares, and freeze them.
 *
 * Same division of labour as releases: the seed carries lifecycle facts and the authoritative
 * basis, this computes the membership and the hash, and approval is the act of freezing the
 * computed hash into the seed. Nobody hand-writes a member list, because a hand-written member
 * list is a claim about which products a physician is asking the room for that nothing checked.
 */
function buildProductFamilies(input: {
  seed: SeedProductFamilyFile
  catalogReleaseId: string
  products: CatalogProductRecord[]
  productRoles: ProductRoleRecord[]
  unselectableProductIds: ReadonlySet<string>
}): { versions: ReviewedProductFamilyVersion[]; failures: string[] } {
  const versions: ReviewedProductFamilyVersion[] = []
  const failures: string[] = []

  for (const family of input.seed.families) {
    const versionId = productFamilyVersionIdFor(family.productFamilyCode, family.version)
    const frozen = family.governanceState !== 'draft'
    if (frozen && !family.definitionHash) {
      failures.push(
        `Product family ${versionId} is ${family.governanceState} but records no definition hash. Run this while it is a draft, then freeze the hash it reports.`,
      )
    }
    if (!frozen && family.definitionHash) {
      failures.push(
        `Product family ${versionId} is a draft but records a frozen definition hash. A draft's membership is still moving; freeze the hash when approving it.`,
      )
    }
    if (frozen && !family.catalogReleaseId) {
      failures.push(
        `Product family ${versionId} is ${family.governanceState} but does not record the catalog release its membership was reviewed against.`,
      )
    }

    // Membership is derived against the catalog release the family was reviewed against. For an
    // already-approved family that is a historical release, and re-deriving it from the *current*
    // catalog would be checking a frozen statement against data it never described.
    const derived = deriveReviewedProductFamilyVersion({
      seed: family,
      catalogReleaseId: family.catalogReleaseId ?? input.catalogReleaseId,
      products: input.products,
      productRoles: input.productRoles,
      unselectableProductIds: input.unselectableProductIds,
    })
    if (!derived.ok) {
      failures.push(derived.message)
      continue
    }
    // An approved family keeps the hash it was approved with. Writing the recomputed one would
    // turn the guard into a rubber stamp.
    versions.push(
      frozen && family.definitionHash
        ? { ...derived.version, definitionHash: family.definitionHash }
        : derived.version,
    )
  }

  versions.sort((left, right) =>
    left.productFamilyVersionId.localeCompare(right.productFamilyVersionId),
  )
  return { versions, failures }
}

async function main() {
  const generatedDirectory = process.argv[2] ?? GENERATED_DIRECTORY
  const seedDirectory = process.argv[3] ?? SEED_DIRECTORY
  const reviewedDirectory = process.argv[4] ?? REVIEWED_DIRECTORY

  // Recomputed before anything else reads it, so the runtime's notion of "which catalog
  // release is current" is never staler than the catalog itself.
  const importReport = await readJson<{ workbook_sha256: string }>(
    generatedDirectory,
    'import-report.json',
  )
  const catalogRelease = await computeCatalogRelease(
    generatedDirectory,
    importReport.workbook_sha256,
  )
  await writeJsonWhenChanged(generatedDirectory, 'catalog-release.json', catalogRelease)

  // Recomputed from source here rather than read back from the generated file, so a bundle
  // published in this run records the build that is actually producing it.
  const resolverRelease = await computeResolverRelease(PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION)
  await writeJsonWhenChanged(generatedDirectory, 'resolver-release.json', resolverRelease)
  const resolverContract = {
    version: resolverRelease.resolverContractVersion,
    implementationHash: resolverRelease.resolverImplementationHash,
  }

  const seed = await readJson<SeedReleaseFile>(seedDirectory, 'release-bundles.json')

  // The whole-set pins each already-generated bundle recorded, keyed by release id — the
  // retained record that lets a frozen release keep resolving the sets it actually pinned
  // after the live sources move on. Absent on the very first generation, in which case every
  // release resolves the live sets, exactly as before retention existed.
  const generatedBefore = await readJsonOrDefault<GeneratedReleaseFile | null>(
    generatedDirectory,
    'release-bundles.json',
    null,
  )
  const recordedSetPinsByReleaseId = new Map<string, ReleaseDefinitionSetPins>(
    (generatedBefore?.bundles ?? []).map((bundle) => [bundle.id, setPinsOfBundle(bundle)]),
  )

  const result = buildReleaseBundles({
    seed,
    resolverContractVersion: resolverContract.version,
    loadSources: (recipeVersionId, setPins) =>
      getReleaseDefinitionSources(recipeVersionId, resolverContract, setPins),
    recordedSetPinsByReleaseId,
  })

  // Every module version a published release pins is copied into the retention ledger, once,
  // verbatim. That is what lets the composition build stop producing a version without taking
  // the cards pinned to it down — see `module-ledger.ts`.
  const ledgerBefore = await readJsonOrDefault<ModuleLedger>(
    generatedDirectory,
    'module-ledger.json',
    { formatVersion: '1.0', entries: [] },
  )
  const publishedModules: Array<{ moduleVersion: RecipeModuleVersion; releaseBundleId: string }> =
    []
  const pinnedModuleVersionIds = new Set<string>()
  // The recipe versions published releases pin are retained the same way — see
  // `composition-ledger.ts` for why the seed cannot keep producing a superseded composition.
  const publishedRecipes: Array<{
    recipe: NonNullable<ReturnType<typeof getReleaseDefinitionSources>>['recipe']
    releaseBundleId: string
  }> = []
  const pinnedRecipeVersionIds = new Set<string>()
  // Every whole set a published release pins, retained the same way — see
  // `definition-set-ledger.ts` for why the sets need a ledger of their own.
  const publishedDefinitionSets: Array<{
    content: DefinitionSetContent
    releaseBundleId: string
  }> = []
  const pinnedSetHashes = new Map<string, Set<string>>()
  for (const bundle of result.bundles) {
    if (bundle.releaseState === 'draft') continue
    const sources = getReleaseDefinitionSources(
      bundle.recipeVersionId,
      resolverContract,
      setPinsOfBundle(bundle),
    )
    for (const moduleVersion of sources?.modules ?? []) {
      pinnedModuleVersionIds.add(moduleVersion.id)
      publishedModules.push({ moduleVersion, releaseBundleId: bundle.id })
    }
    pinnedRecipeVersionIds.add(bundle.recipeVersionId)
    if (sources) {
      publishedRecipes.push({ recipe: sources.recipe, releaseBundleId: bundle.id })
      publishedDefinitionSets.push(
        {
          content: { definitionSetId: MODIFIER_SET_ID, definition: sources.modifiers },
          releaseBundleId: bundle.id,
        },
        {
          content: { definitionSetId: RESCUE_SET_ID, definition: sources.rescueModules },
          releaseBundleId: bundle.id,
        },
        {
          content: { definitionSetId: COMPAT_SET_ID, definition: sources.compatibilityRules },
          releaseBundleId: bundle.id,
        },
        {
          content: { definitionSetId: TAXONOMY_SET_ID, definition: sources.roleTaxonomy },
          releaseBundleId: bundle.id,
        },
      )
    }
    for (const [setId, hash] of [
      [bundle.modifierSetPin.id, bundle.modifierSetPin.definitionHash],
      [bundle.rescueModuleSetPin.id, bundle.rescueModuleSetPin.definitionHash],
      [bundle.compatibilityRuleSetPin.id, bundle.compatibilityRuleSetPin.definitionHash],
      [bundle.roleTaxonomyPin.id, bundle.roleTaxonomyPin.definitionHash],
    ] as const) {
      const existing = pinnedSetHashes.get(setId) ?? new Set<string>()
      existing.add(hash)
      pinnedSetHashes.set(setId, existing)
    }
  }
  const ledger = withPublishedModules(ledgerBefore, publishedModules)

  const definitionSetLedgerBefore = await readJsonOrDefault<DefinitionSetLedger>(
    generatedDirectory,
    'definition-set-ledger.json',
    emptyDefinitionSetLedger(),
  )
  const definitionSetLedger = withPublishedDefinitionSets(
    definitionSetLedgerBefore,
    publishedDefinitionSets,
  )
  const definitionSetLedgerProblems = validateDefinitionSetLedger({
    ledger: definitionSetLedger,
    pinnedSetHashes,
    live: getLiveDefinitionSets(),
  })

  const compositionLedgerBefore = await readJsonOrDefault<CompositionLedger>(
    generatedDirectory,
    'composition-ledger.json',
    emptyCompositionLedger(),
  )
  const compositionLedger = withPublishedRecipes(compositionLedgerBefore, publishedRecipes)
  const compositionLedgerProblems = validateCompositionLedger({
    ledger: compositionLedger,
    liveRecipes: getLiveRecipeVersions(),
    pinnedRecipeVersionIds,
  })

  const liveModules = new Map(
    (await readJson<RecipeModuleVersion[]>(generatedDirectory, 'recipe-modules.json')).map(
      (moduleVersion) => [moduleVersion.id, moduleVersion],
    ),
  )
  const ledgerProblems = validateModuleLedger({ ledger, liveModules, pinnedModuleVersionIds })

  // The catalog release every published bundle pins has to stay retrievable, or the cards pinned
  // to those bundles lose the product and role identity they were saved against.
  const pinnedCatalogReleaseIds = new Set(
    result.bundles
      .filter((bundle) => bundle.releaseState !== 'draft')
      .map((bundle) => bundle.catalogImportId),
  )
  const products = await readJson<CatalogProductRecord[]>(
    generatedDirectory,
    'catalog-products.json',
  )
  const roles = await readJson<RoleRecord[]>(generatedDirectory, 'roles.json')
  const productRoles = await readJson<ProductRoleRecord[]>(generatedDirectory, 'product-roles.json')
  const retained = await retainCatalog({
    generatedDirectory,
    catalogRelease,
    products,
    roles,
    productRoles,
    pinnedCatalogReleaseIds,
  })

  const productGovernance = (
    await readJson<{ productGovernance: ProductGovernanceRecord[] }>(
      reviewedDirectory,
      'external-review-corrections.json',
    )
  ).productGovernance
  const unselectableProductIds = new Set(
    productGovernance
      .filter((entry) => entry.slottingScope === 'not_applicable')
      .map((entry) => entry.productId),
  )

  const familySeed = await readJsonOrDefault<SeedProductFamilyFile>(
    seedDirectory,
    'product-families.json',
    { formatVersion: '1.0', families: [] },
  )
  const families = buildProductFamilies({
    seed: familySeed,
    catalogReleaseId: catalogRelease.catalogReleaseId,
    products,
    productRoles,
    unselectableProductIds,
  })
  const familyLedger: ProductFamilyLedger = {
    ...emptyProductFamilyLedger(),
    versions: families.versions,
  }
  const familyProblems = validateProductFamilyLedger({
    ledger: familyLedger,
    catalogReleaseMembership: new Map([
      [
        catalogRelease.catalogReleaseId,
        {
          productIds: new Set(products.map((product) => product.product_id)),
          rolesByProductId: productRoles.reduce((index, link) => {
            const existing = index.get(link.product_id) ?? new Set<string>()
            existing.add(link.role_code)
            index.set(link.product_id, existing)
            return index
          }, new Map<string, Set<string>>()),
        },
      ],
    ]),
  })

  const blocking = result.messages.filter((message) => message.severity === 'blocking')
  const warnings = result.messages.filter((message) => message.severity === 'warning')

  console.log(`${result.bundles.length} retained release bundles.`)
  console.log('')
  console.log('release                                      state      procedure            hash')
  for (const bundle of result.bundles) {
    const current = result.pointers[bundle.sourceProcedureCode] === bundle.id ? ' ←current' : ''
    console.log(
      `  ${bundle.id.padEnd(42)} ${bundle.releaseState.padEnd(10)} ${bundle.sourceProcedureCode.padEnd(20)} ${bundle.definitionHash.slice(0, 16)}${current}`,
    )
  }

  const catalogProblems = retained.problems.filter((problem) => problem.severity === 'blocking')
  const catalogNotes = retained.problems.filter((problem) => problem.severity === 'info')

  console.log('')
  console.log(
    `Catalog release ${retained.manifest.catalogReleaseId.slice(0, 16)} retains ${retained.manifest.productRowHashes.length} product, ${retained.manifest.roleRowHashes.length} role, and ${retained.manifest.productRoleRowHashes.length} product-role row(s); the store holds ${Object.keys(retained.store.rows).length} across ${retained.releases.releases.length} release(s).`,
  )
  console.log(
    `${families.versions.length} reviewed product family version(s): ${families.versions.filter((version) => version.governanceState === 'approved').length} approved, ${families.versions.filter((version) => version.governanceState === 'draft').length} draft, ${families.versions.filter((version) => version.governanceState === 'retired').length} retired.`,
  )
  console.log(
    `Definition-set ledger retains ${definitionSetLedger.entries.length} set(s): ${(
      [
        [MODIFIER_SET_ID, 'modifier'],
        [RESCUE_SET_ID, 'rescue-module'],
        [COMPAT_SET_ID, 'compatibility-rule'],
        [TAXONOMY_SET_ID, 'role-taxonomy'],
      ] as const
    )
      .map(
        ([setId, label]) =>
          `${definitionSetLedger.entries.filter((entry) => entry.definitionSetId === setId).length} ${label}`,
      )
      .join(', ')}.`,
  )
  for (const version of families.versions.filter(
    (candidate) => candidate.governanceState === 'draft',
  )) {
    console.log(
      `  draft ${version.productFamilyVersionId} — ${version.memberProductIds.length} member(s), hash ${version.definitionHash}`,
    )
  }

  if (warnings.length > 0) {
    console.log('')
    console.log(`${warnings.length} advisory condition(s):`)
    for (const message of warnings) console.log(`  · ${message.code}: ${message.message}`)
  }
  for (const note of catalogNotes) console.log(`  · ${note.code}: ${note.message}`)

  if (ledgerProblems.length > 0) {
    console.log('')
    console.error(`${ledgerProblems.length} module retention problem(s):`)
    for (const problem of ledgerProblems) console.error(`  ✗ ${problem.code}: ${problem.message}`)
    process.exitCode = 1
    return
  }

  if (compositionLedgerProblems.length > 0) {
    console.log('')
    console.error(`${compositionLedgerProblems.length} composition retention problem(s):`)
    for (const problem of compositionLedgerProblems) {
      console.error(`  ✗ ${problem.code}: ${problem.message}`)
    }
    process.exitCode = 1
    return
  }

  if (definitionSetLedgerProblems.length > 0) {
    console.log('')
    console.error(`${definitionSetLedgerProblems.length} definition-set retention problem(s):`)
    for (const problem of definitionSetLedgerProblems) {
      console.error(`  ✗ ${problem.code}: ${problem.message}`)
    }
    process.exitCode = 1
    return
  }

  if (catalogProblems.length > 0) {
    console.log('')
    console.error(`${catalogProblems.length} catalog retention problem(s):`)
    for (const problem of catalogProblems) console.error(`  ✗ ${problem.code}: ${problem.message}`)
    process.exitCode = 1
    return
  }

  if (families.failures.length > 0 || familyProblems.length > 0) {
    console.log('')
    console.error(`${families.failures.length + familyProblems.length} product family problem(s):`)
    for (const failure of families.failures) console.error(`  ✗ ${failure}`)
    for (const problem of familyProblems) console.error(`  ✗ ${problem.code}: ${problem.message}`)
    process.exitCode = 1
    return
  }

  if (blocking.length > 0) {
    console.log('')
    console.error(`${blocking.length} blocking problem(s):`)
    for (const message of blocking) console.error(`  ✗ ${message.code}: ${message.message}`)
    // Nothing is written. A generated file that disagreed with a failed validation would be
    // a record of the mutation rather than a barrier to it.
    process.exitCode = 1
    return
  }

  await writeJsonWhenChanged(generatedDirectory, 'catalog-rows.json', retained.store)
  await writeJsonWhenChanged(
    generatedDirectory,
    'catalog-release-manifests.json',
    retained.releases,
  )
  await writeJsonWhenChanged(generatedDirectory, 'product-family-versions.json', familyLedger)
  await writeJsonWhenChanged(generatedDirectory, 'module-ledger.json', ledger)
  await writeJsonWhenChanged(generatedDirectory, 'composition-ledger.json', compositionLedger)
  await writeJsonWhenChanged(generatedDirectory, 'definition-set-ledger.json', definitionSetLedger)
  await writeJsonWhenChanged(generatedDirectory, 'release-bundles.json', {
    pointers: result.pointers,
    bundles: result.bundles,
  })
  await writeJsonWhenChanged(generatedDirectory, 'release-impact-report.json', result.impact)

  // An initial release has no predecessor, so every requirement reads as "added". True, and
  // useless to a reviewer — release impact is a comparison, and there is nothing to compare
  // it to. Only supersessions get the line-by-line treatment.
  const supersessions = result.impact.filter(
    (report) => report.previousReleaseBundleId !== null && !report.identical,
  )
  const initial = result.impact.filter((report) => report.previousReleaseBundleId === null)
  console.log('')
  console.log(
    `Wrote ${result.bundles.length} bundles and ${result.impact.length} impact report(s): ${initial.length} initial, ${supersessions.length} superseding an earlier release.`,
  )
  for (const report of supersessions) {
    console.log(
      `  ${report.nextReleaseBundleId}: ${report.pinChanges.length} pin change(s), ${report.requirementChanges.length} requirement change(s) against ${report.previousReleaseBundleId ?? 'no predecessor'}`,
    )
    for (const requirement of report.requirementChanges) {
      console.log(
        `    ${requirement.kind.padEnd(8)} ${requirement.requirementKey}${
          requirement.changedFields.length > 0 ? ` (${requirement.changedFields.join(', ')})` : ''
        }`,
      )
    }
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
