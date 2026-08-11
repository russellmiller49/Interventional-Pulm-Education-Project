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
  RUNTIME_RESOLVER_CONTRACT,
} from '../data/release-bundles.server'
import {
  HOSPITAL_LOCAL_CURRENT_CONTEXT_FIELDS,
  RELEASE_PINNED_CONTEXT_FIELDS,
  moduleDefinitionHash,
  recipeDefinitionHash,
  releaseBundleDefinitionHash,
  resolvePinnedRelease,
  validateReleaseBundles,
} from '../domain/release-bundle'
import { PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION } from '../domain/resolve-card'
import { RESOLVER_SOURCE_FILES } from '../../../../scripts/ip-preference-cards/resolver-release-id'

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
    // v1-1 → v1-2 with the P91-C1/P91-C2 corrections (2026-08-10): the custom composition's
    // current release now carries the authored per-slot actions from seed/custom-composition.json.
    expect(bundle!.recipeVersionId).toBe('recipe-custom-composition-v1-2')
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
      const sources = getReleaseDefinitionSources(bundle.recipeVersionId, RUNTIME_RESOLVER_CONTRACT)
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
      // Sources resolve through the candidate's own set pins, exactly as the runtime
      // loadSources does — so the only mismatch left to detect is the tampered module pin.
      (candidate) =>
        getReleaseDefinitionSources(candidate.recipeVersionId, RUNTIME_RESOLVER_CONTRACT, {
          modifierSetHash: candidate.modifierSetPin.definitionHash,
          rescueModuleSetHash: candidate.rescueModuleSetPin.definitionHash,
          compatibilityRuleSetHash: candidate.compatibilityRuleSetPin.definitionHash,
          roleTaxonomyHash: candidate.roleTaxonomyPin.definitionHash,
        }),
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
        getReleaseDefinitionSources(candidate.recipeVersionId, RUNTIME_RESOLVER_CONTRACT),
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
 * The resolver is code and cannot be retained, so a release records two different things
 * about it and they are checked differently.
 *
 * `resolverContractVersion` is the semantic boundary — what resolution *means* — and it is
 * asserted behaviourally in `resolver-contract.test.ts`, not by hashing anything. A refactor
 * that preserves the contract passes those tests and stays supported.
 *
 * `resolverImplementationHash` is provenance: which build produced a card. It moves on every
 * source edit including pure refactors, which is exactly why it must not be a support
 * boundary — a signal that fires on renames is a signal nobody reads.
 */
describe('the resolver contract and the build that implements it', () => {
  it('is declared, at the semantic version, by every published release', () => {
    for (const bundle of getRetainedReleaseBundles()) {
      expect(bundle.resolverContractVersion).toBe(PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION)
    }
  })

  it('records a provenance digest that matches the resolver sources on disk', () => {
    // Recomputed here the same way the build computes it, so the committed artifact cannot
    // drift from the code it claims to describe.
    const manifest = RESOLVER_SOURCE_FILES.map(
      (filename) =>
        `${createHash('sha256').update(readFileSync(filename)).digest('hex')}  ${filename}\n`,
    ).join('')
    const digest = createHash('sha256').update(manifest).digest('hex')

    expect(RUNTIME_RESOLVER_CONTRACT.implementationHash).toBe(digest)
  })

  it('treats a moved implementation digest as information, not as a broken release', () => {
    const bundles = getRetainedReleaseBundles().map((bundle) => ({
      ...bundle,
      resolverImplementationHash: 'refactored'.padEnd(64, '0'),
    }))
    const messages = validateReleaseBundles({
      bundles,
      pointers: getReleasePointers(),
      sourcesByBundleId: new Map(
        bundles.map((bundle) => [
          bundle.id,
          getReleaseDefinitionSources(bundle.recipeVersionId, RUNTIME_RESOLVER_CONTRACT, {
            modifierSetHash: bundle.modifierSetPin.definitionHash,
            rescueModuleSetHash: bundle.rescueModuleSetPin.definitionHash,
            compatibilityRuleSetHash: bundle.compatibilityRuleSetPin.definitionHash,
            roleTaxonomyHash: bundle.roleTaxonomyPin.definitionHash,
          }),
        ]),
      ),
    })

    // Reported, so the provenance difference is visible...
    expect(messages.map((message) => message.code)).toContain(
      'release_resolver_implementation_advanced',
    )
    // ...and never blocking, so a source-only refactor cannot make historical cards
    // unsupported. That separation is the whole point of splitting the two fields.
    expect(messages.filter((message) => message.severity === 'blocking')).toEqual([])
    for (const bundle of bundles) {
      expect(buildReleaseContext(bundle.id).ok).toBe(true)
    }
  })
})
