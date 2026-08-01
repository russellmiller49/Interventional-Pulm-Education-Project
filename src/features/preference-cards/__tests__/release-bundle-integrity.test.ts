import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  buildContextForRecipe,
  getReleaseDefinitionSources,
  getScenarioDefinitions,
  recipeForRecipeVersionId,
} from '../data/demo-context.server'
import {
  buildReleaseContext,
  getCurrentReleaseBundleForScenario,
  getReleaseBundle,
  getReleaseImpactReports,
  getReleasePointers,
  getRetainedReleaseBundles,
  validateRetainedReleases,
} from '../data/release-bundles.server'
import {
  HOSPITAL_LOCAL_CURRENT_CONTEXT_FIELDS,
  RELEASE_PINNED_CONTEXT_FIELDS,
  moduleDefinitionHash,
  recipeDefinitionHash,
  releaseBundleDefinitionHash,
  resolvePinnedRelease,
} from '../domain/release-bundle'
import { PREFERENCE_CARD_ENGINE_VERSION } from '../domain/resolve-card'

/**
 * The retained release set as it is actually committed, checked on every CI run.
 *
 * `release-bundle.test.ts` proves the mechanism on a synthetic fixture. This proves the real
 * data satisfies it — that a commit which edits a pinned definition, deletes a retained
 * release, or points at a retired one fails here rather than shipping and being discovered
 * later by a physician whose card will not reopen.
 */

describe('the committed release set', () => {
  it('has no blocking problems', () => {
    const blocking = validateRetainedReleases().filter((message) => message.severity === 'blocking')
    expect(blocking.map((message) => `${message.code}: ${message.message}`)).toEqual([])
  })

  it('gives every scenario in the picker a current, published release', () => {
    for (const scenario of getScenarioDefinitions()) {
      const bundle = getCurrentReleaseBundleForScenario(scenario.id)
      expect(bundle).not.toBeNull()
      expect(bundle!.releaseState).toBe('published')
      expect(bundle!.scenarioId).toBe(scenario.id)
      expect(bundle!.recipeVersionId).toBe(scenario.recipeVersionId)
    }
  })

  it('gives the custom module composition a release too, so a custom card is pinned like any other', () => {
    const bundle = getCurrentReleaseBundleForScenario('custom-composition')
    expect(bundle).not.toBeNull()
    expect(bundle!.recipeVersionId).toBe('recipe-custom-composition-v1-0')
  })

  it('reconstructs every retained release from the definitions it pins', () => {
    for (const bundle of getRetainedReleaseBundles()) {
      const result = buildReleaseContext(bundle.id)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.context.recipe.id).toBe(bundle.recipeVersionId)
    }
  })

  it('points only at releases that belong to the procedure named', () => {
    for (const [procedureCode, releaseBundleId] of Object.entries(getReleasePointers())) {
      const bundle = getReleaseBundle(releaseBundleId)
      expect(bundle).not.toBeNull()
      expect(bundle!.sourceProcedureCode).toBe(procedureCode)
    }
  })

  it('records the hash each release published with, not a hash recomputed on read', () => {
    // If the build wrote back a freshly computed hash, this file would always agree with
    // itself and a mutated definition would be recorded rather than rejected.
    for (const bundle of getRetainedReleaseBundles()) {
      expect(releaseBundleDefinitionHash(bundle)).toBe(bundle.definitionHash)
    }
  })

  it('pins the exact module versions each recipe references, and hashes their content', () => {
    for (const bundle of getRetainedReleaseBundles()) {
      const sources = getReleaseDefinitionSources(
        bundle.recipeVersionId,
        PREFERENCE_CARD_ENGINE_VERSION,
      )
      expect(sources).not.toBeNull()
      expect(bundle.recipeDefinitionHash).toBe(recipeDefinitionHash(sources!.recipe))
      expect(bundle.modulePins.map((pin) => pin.moduleVersionId).sort()).toEqual(
        sources!.recipe.moduleReferences.map((reference) => reference.moduleVersionId).sort(),
      )
      for (const pin of bundle.modulePins) {
        const moduleVersion = sources!.modules.find((module) => module.id === pin.moduleVersionId)!
        expect(pin.definitionHash).toBe(moduleDefinitionHash(moduleVersion))
      }
    }
  })

  it('carries an impact report for every retained release', () => {
    const reports = getReleaseImpactReports()
    expect(reports.map((report) => report.nextReleaseBundleId).sort()).toEqual(
      getRetainedReleaseBundles()
        .map((bundle) => bundle.id)
        .sort(),
    )
  })
})

describe('tampering with the committed release set', () => {
  it('refuses a release whose recorded pin hash does not match the definition', () => {
    const bundle = getCurrentReleaseBundleForScenario('ebus-rose-molecular')!
    const tampered = {
      ...bundle,
      modulePins: bundle.modulePins.map((pin, index) =>
        index === 0 ? { ...pin, definitionHash: 'f'.repeat(64) } : pin,
      ),
    }

    const result = resolvePinnedRelease(
      tampered.id,
      new Map([[tampered.id, tampered]]),
      (candidate) =>
        getReleaseDefinitionSources(candidate.recipeVersionId, PREFERENCE_CARD_ENGINE_VERSION),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('release_definition_mutated')
    expect(result.changedPins).toEqual([`module:${bundle.modulePins[0].moduleVersionId}`])
  })

  it('refuses a release pinned to a recipe version the generated data does not publish', () => {
    expect(recipeForRecipeVersionId('recipe-ebus-tbna-v9-9')).toBeNull()
    const bundle = getCurrentReleaseBundleForScenario('ebus-rose-molecular')!
    const tampered = { ...bundle, recipeVersionId: 'recipe-ebus-tbna-v9-9' }

    const result = resolvePinnedRelease(
      tampered.id,
      new Map([[tampered.id, tampered]]),
      (candidate) =>
        getReleaseDefinitionSources(candidate.recipeVersionId, PREFERENCE_CARD_ENGINE_VERSION),
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('release_pin_missing')
  })
})

describe('the pinned / hospital-local boundary', () => {
  it('classifies every field of a real build context exactly once', () => {
    const recipe = recipeForRecipeVersionId('recipe-ebus-tbna-v0-1')!
    const context = buildContextForRecipe(recipe)

    const classified = [
      ...RELEASE_PINNED_CONTEXT_FIELDS,
      ...HOSPITAL_LOCAL_CURRENT_CONTEXT_FIELDS,
    ].sort()
    expect(classified).toEqual([...new Set(classified)])
    expect(Object.keys(context).sort()).toEqual(classified)
  })

  it('keeps the hospital-local half out of every release pin', () => {
    const bundle = getCurrentReleaseBundleForScenario('ebus-rose-molecular')!
    const serialized = JSON.stringify(bundle)
    // A release must not freeze the local formulary or the room's capabilities: a reopened
    // card is meant to show the requirements its author reviewed against the equipment the
    // room has today.
    for (const marker of [
      'Demo Hospital',
      'Bronchoscopy Suite 1',
      'demo-item',
      'jet_ventilation',
    ]) {
      expect(serialized).not.toContain(marker)
    }
  })
})

/**
 * The resolver is code, so it cannot be retained the way authored data can. What *can* be
 * retained is the promise that its version string means something: this fails when the
 * resolution semantics move without `PREFERENCE_CARD_ENGINE_VERSION` moving with them.
 *
 * Raising the baseline is the deliberate act. When it fails, read the diff and decide whether
 * the change alters what an existing card resolves to. If it does, bump the engine version
 * and republish the affected releases; if it does not, record the new digest here and say so.
 */
const RESOLVER_CONTRACT_SOURCES = [
  'src/features/preference-cards/domain/resolve-card.ts',
  'src/features/preference-cards/domain/expand-recipe-composition.ts',
  'src/features/preference-cards/domain/evaluate-compatibility.ts',
  'src/features/preference-cards/domain/kit-suppression.ts',
  'src/features/preference-cards/domain/quantity-expression.ts',
  'src/features/preference-cards/domain/size-at-procedure.ts',
  'src/features/preference-cards/domain/verification.ts',
  'src/features/preference-cards/domain/stable-hash.ts',
] as const

describe('the resolver contract', () => {
  it('is declared by every published release', () => {
    for (const bundle of getRetainedReleaseBundles()) {
      expect(bundle.resolverContractVersion).toBe(PREFERENCE_CARD_ENGINE_VERSION)
    }
  })

  it('has not changed without its version changing', () => {
    const manifest = RESOLVER_CONTRACT_SOURCES.map(
      (filename) =>
        `${createHash('sha256').update(readFileSync(filename)).digest('hex')}  ${filename}\n`,
    ).join('')
    const digest = createHash('sha256').update(manifest).digest('hex')

    expect({ version: PREFERENCE_CARD_ENGINE_VERSION, digest }).toEqual({
      version: 'ip-cards-resolver/0.2.0',
      digest: '1a7b780a3f1c78519756732241bac6c4c65a9ea8aa709faa14c5448629bd640a',
    })
  })
})
