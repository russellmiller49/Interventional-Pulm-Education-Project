import generatedReleasesJson from '../../data/ip-preference-cards/generated/release-bundles.json'
import generatedImpactJson from '../../data/ip-preference-cards/generated/release-impact-report.json'
import seedReleasesJson from '../../data/ip-preference-cards/seed/release-bundles.json'
import { getReleaseDefinitionSources } from '../../src/features/preference-cards/data/demo-context.server'
import { PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION } from '../../src/features/preference-cards/domain/resolve-card'
import { RUNTIME_RESOLVER_CONTRACT } from '../../src/features/preference-cards/data/release-bundles.server'

import { buildReleaseBundles } from './build-release-bundles'

/**
 * The release build is the gate that makes "published definitions are immutable" true rather
 * than aspirational, so its own failure modes are pinned here.
 *
 * Every case below is a hard error in the build. If any of them became a warning, or wrote
 * output anyway, a mutated published release would land in the generated data looking exactly
 * like one that had always said that.
 */

const loadSources = (recipeVersionId: string) =>
  getReleaseDefinitionSources(recipeVersionId, RUNTIME_RESOLVER_CONTRACT)

const baseInput = () => ({
  seed: JSON.parse(JSON.stringify(seedReleasesJson)) as never,
  resolverContractVersion: PREFERENCE_CARD_RESOLVER_CONTRACT_VERSION,
  loadSources,
})

type SeedRelease = {
  id: string
  releaseState: string
  definitionHash?: string
  recipeVersionId: string
  supersedesReleaseBundleId: string | null
}

function seedReleases(input: ReturnType<typeof baseInput>): SeedRelease[] {
  return (input.seed as unknown as { releases: SeedRelease[] }).releases
}

describe('release bundle build', () => {
  it('reproduces the committed generated data exactly', () => {
    const result = buildReleaseBundles(baseInput())
    expect({ pointers: result.pointers, bundles: result.bundles }).toEqual(generatedReleasesJson)
    expect(result.impact).toEqual(generatedImpactJson)
  })

  it('is deterministic across repeated runs', () => {
    expect(JSON.stringify(buildReleaseBundles(baseInput()).bundles)).toBe(
      JSON.stringify(buildReleaseBundles(baseInput()).bundles),
    )
  })

  it('reports no blocking problems for the committed seed', () => {
    const result = buildReleaseBundles(baseInput())
    expect(result.messages.filter((message) => message.severity === 'blocking')).toEqual([])
  })

  it('rejects a published release whose definitions no longer hash to what it published', () => {
    const input = baseInput()
    // Exactly what an edit to a pinned module or compatibility rule looks like from here:
    // the recomputed closure no longer matches the frozen hash.
    seedReleases(input)[0].definitionHash = 'a'.repeat(64)

    const result = buildReleaseBundles(input)
    const blocking = result.messages.filter((message) => message.severity === 'blocking')
    expect(blocking.map((message) => message.code)).toContain('release_definition_mutated')
  })

  it('rejects a published release that records no frozen hash', () => {
    const input = baseInput()
    delete seedReleases(input)[0].definitionHash

    expect(() => buildReleaseBundles(input)).toThrow(/records no definition hash/)
  })

  it('rejects a draft that records a frozen hash', () => {
    const input = baseInput()
    seedReleases(input)[0].releaseState = 'draft'

    expect(() => buildReleaseBundles(input)).toThrow(/draft but records a frozen definition hash/)
  })

  it('rejects a release pinned to a recipe version the generated data no longer publishes', () => {
    const input = baseInput()
    seedReleases(input)[0].recipeVersionId = 'recipe-does-not-exist-v9-9'

    // Retention is the point: dropping the composition a release pins would leave every card
    // pinned to it unreconstructable, so the build refuses rather than writing the loss out.
    expect(() => buildReleaseBundles(input)).toThrow(/must stay reconstructable/)
  })

  it('rejects a pointer at a release that is not published', () => {
    const input = baseInput()
    const releases = seedReleases(input)
    releases[0].releaseState = 'retired'

    const result = buildReleaseBundles(input)
    expect(result.messages.map((message) => message.code)).toContain('release_pointer_retired')
  })

  it('keeps every retained release addressed by a unique id', () => {
    const ids = generatedReleasesJson.bundles.map((bundle) => bundle.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it('gives every retained release a current-release pointer for its procedure', () => {
    const pointers = generatedReleasesJson.pointers as Record<string, string>
    for (const bundle of generatedReleasesJson.bundles) {
      expect(pointers[bundle.sourceProcedureCode]).toBeDefined()
    }
  })

  it('fails the whole build rather than summarizing an unknown modifier action type (P91-C5)', () => {
    // Impact is computed inside buildReleaseBundles, before main() writes anything, so this
    // throw is what keeps a malformed release-impact report out of the generated data. The
    // poisoned action rides the *next* side of the med-thoracoscopy v1-1 → v1-2
    // supersession, on a modifier that recipe actually offers — everything else about the
    // build is the committed baseline.
    const poisonedLoad = (recipeVersionId: string) => {
      const sources = loadSources(recipeVersionId)
      if (!sources || recipeVersionId !== 'recipe-med-thoracoscopy-v0-3') return sources
      const offeredCode = sources.recipe.allowedModifierCodes[0]
      expect(offeredCode).toBeDefined()
      return {
        ...sources,
        modifiers: sources.modifiers.map((definition) =>
          definition.code === offeredCode
            ? {
                ...definition,
                actions: [
                  ...definition.actions,
                  {
                    id: 'poisoned-unknown-action',
                    modifierCode: definition.code,
                    sequence: 9_999,
                    actionType: 'future_unknown_action' as never,
                    payload: {},
                  },
                ],
              }
            : definition,
        ),
      }
    }
    expect(() => buildReleaseBundles({ ...baseInput(), loadSources: poisonedLoad })).toThrow(
      'Unknown modifier action type "future_unknown_action" in action "poisoned-unknown-action" ' +
        'while building release-impact evidence for modifier',
    )
  })
})
