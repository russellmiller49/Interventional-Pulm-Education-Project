import {
  ALPHA_RELEASE_ID,
  BRAVO_RELEASE_ID,
  CHARLIE_RELEASE_ID,
  FIXTURE_MODULE_V1_0,
  FIXTURE_PROCEDURE_CODE,
  REVISED_REQUIREMENT_KEY,
  createFixtureReleaseWorld,
} from '../__fixtures__/release-bundle-fixtures'
import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import {
  RELEASE_BUNDLE_HASH_EXCLUSIONS,
  assertSelectableForNewCard,
  diffReleaseBundles,
  releaseBundleDefinitionHash,
  resolveCurrentRelease,
  resolvePinnedRelease,
  validateReleaseBundles,
  type PreferenceCardReleaseBundle,
} from '../domain/release-bundle'

/**
 * The retention guarantee, proved on a synthetic procedure with three published releases.
 *
 * Every claim this module makes about version pinning is a claim about what happens *after*
 * a newer release exists, and the production data has no second release to demonstrate it —
 * see the fixture for why fabricating one was rejected. So the whole lifecycle is exercised
 * here: publish, supersede, advance the pointer, retire, and then try to break it.
 *
 * The destructive tests are the load-bearing ones. "A published release is immutable" is only
 * worth writing down if editing one is detected, and "historical versions are retained" is
 * only worth writing down if deleting one is.
 */

function requiredness(
  world: ReturnType<typeof createFixtureReleaseWorld>,
  releaseBundleId: string,
): string | undefined {
  const resolved = resolvePinnedRelease(releaseBundleId, world.bundleById, world.loadSources)
  if (!resolved.ok) throw new Error(`expected ${releaseBundleId} to resolve: ${resolved.message}`)
  const expansion = expandRecipeComposition({
    recipe: resolved.sources.recipe,
    modules: resolved.sources.modules,
    selectedModuleVersionIds: resolved.sources.modules.map((module) => module.id),
    startSequence: 1,
  })
  return expansion.slots.find((slot) => slot.requirementKey === REVISED_REQUIREMENT_KEY)
    ?.requiredness
}

function blockingCodes(world: ReturnType<typeof createFixtureReleaseWorld>): string[] {
  return validateReleaseBundles({
    bundles: world.bundles,
    pointers: world.pointers,
    sourcesByBundleId: world.sourcesByBundleId(),
  })
    .filter((message) => message.severity === 'blocking')
    .map((message) => message.code)
}

describe('a retained release set', () => {
  it('has no blocking problems while nothing has been tampered with', () => {
    expect(blockingCodes(createFixtureReleaseWorld())).toEqual([])
  })

  it('keeps a superseded release resolvable after a newer one becomes current', () => {
    const world = createFixtureReleaseWorld()
    // ALPHA is retired and two releases have been published since. It still reconstructs.
    const resolved = resolvePinnedRelease(ALPHA_RELEASE_ID, world.bundleById, world.loadSources)
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.sources.recipe.id).toBe(world.bundleById.get(ALPHA_RELEASE_ID)!.recipeVersionId)
  })

  it('resolves each release against its own definitions, not the newest ones', () => {
    const world = createFixtureReleaseWorld()
    // The single clinical difference between the two module versions, seen through the pin.
    expect(requiredness(world, ALPHA_RELEASE_ID)).toBe('optional')
    expect(requiredness(world, BRAVO_RELEASE_ID)).toBe('required')
  })
})

describe('choosing the current release', () => {
  it('takes the pointer, not the highest version, the newest date, or the last entry', () => {
    const world = createFixtureReleaseWorld()
    const charlie = world.bundleById.get(CHARLIE_RELEASE_ID)!

    // CHARLIE is all three of the things a "latest" shortcut would pick, and is published.
    expect(charlie.releaseState).toBe('published')
    expect(charlie.id > BRAVO_RELEASE_ID).toBe(true)
    expect(charlie.publishedAt! > world.bundleById.get(BRAVO_RELEASE_ID)!.publishedAt!).toBe(true)
    expect(world.bundles.at(-1)!.id).toBe(CHARLIE_RELEASE_ID)

    expect(
      resolveCurrentRelease(FIXTURE_PROCEDURE_CODE, world.pointers, world.bundleById)?.id,
    ).toBe(BRAVO_RELEASE_ID)
  })

  it('returns nothing at all when no pointer names a release', () => {
    const world = createFixtureReleaseWorld()
    // No fallback. Three published releases are available and none of them is chosen,
    // because choosing one would mean inventing the policy that picked it.
    expect(resolveCurrentRelease(FIXTURE_PROCEDURE_CODE, {}, world.bundleById)).toBeNull()
  })

  it('refuses a pointer at a retired release, and refuses to start a card on one', () => {
    const world = createFixtureReleaseWorld()
    const alpha = world.bundleById.get(ALPHA_RELEASE_ID)!

    expect(assertSelectableForNewCard(alpha).ok).toBe(false)
    expect(
      resolveCurrentRelease(
        FIXTURE_PROCEDURE_CODE,
        { [FIXTURE_PROCEDURE_CODE]: ALPHA_RELEASE_ID },
        world.bundleById,
      ),
    ).toBeNull()

    const messages = validateReleaseBundles({
      bundles: world.bundles,
      pointers: { [FIXTURE_PROCEDURE_CODE]: ALPHA_RELEASE_ID },
      sourcesByBundleId: world.sourcesByBundleId(),
    })
    expect(messages.map((message) => message.code)).toContain('release_pointer_retired')
  })

  it('still reconstructs a card pinned to the retired release', () => {
    const world = createFixtureReleaseWorld()
    // Retirement governs what a *new* card may be built on. A card already pinned to ALPHA
    // reopens exactly as before, or "retired but retained" would mean nothing.
    expect(requiredness(world, ALPHA_RELEASE_ID)).toBe('optional')
  })
})

describe('mutating a published definition', () => {
  it('is detected when a pinned module is edited, and names which pin moved', () => {
    const world = createFixtureReleaseWorld()
    const edited = world.store.modules.get(FIXTURE_MODULE_V1_0)!
    edited.slots = edited.slots.map((slot) =>
      slot.requirementKey === REVISED_REQUIREMENT_KEY
        ? { ...slot, requiredness: 'required' as const }
        : slot,
    )

    const resolved = resolvePinnedRelease(ALPHA_RELEASE_ID, world.bundleById, world.loadSources)
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.code).toBe('release_definition_mutated')
    expect(resolved.changedPins).toEqual([`module:${FIXTURE_MODULE_V1_0}`])

    // And it fails validation, so it cannot land in a commit that passes CI.
    expect(blockingCodes(world)).toContain('release_pin_hash_mismatch')
  })

  it('is detected when the recipe itself is edited', () => {
    const world = createFixtureReleaseWorld()
    const recipe = world.store.recipes.get(world.bundleById.get(ALPHA_RELEASE_ID)!.recipeVersionId)!
    recipe.requirementSequences = { ...recipe.requirementSequences, FIXTURE_PRIMARY_SCOPE: 99 }

    const resolved = resolvePinnedRelease(ALPHA_RELEASE_ID, world.bundleById, world.loadSources)
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.changedPins).toEqual([`recipe:${recipe.id}`])
  })

  it('is detected when a whole-set dependency changes, across every release that pins it', () => {
    const world = createFixtureReleaseWorld()
    // A typed compatibility rule reaches the resolver from a module-level constant with no
    // version of its own. Editing one used to change what every saved card re-resolved to,
    // with every recipe and module pin untouched. It is now a pinned definition.
    world.store.compatibilityRules[0].severity = 'blocking'

    for (const releaseId of [ALPHA_RELEASE_ID, BRAVO_RELEASE_ID, CHARLIE_RELEASE_ID]) {
      const resolved = resolvePinnedRelease(releaseId, world.bundleById, world.loadSources)
      expect(resolved.ok).toBe(false)
      if (resolved.ok) continue
      expect(resolved.code).toBe('release_definition_mutated')
      expect(resolved.changedPins).toContain('definition-set-compatibility-rules')
    }
  })

  it.each([
    [
      'modifier actions',
      (world: ReturnType<typeof createFixtureReleaseWorld>) => {
        world.store.modifiers[0].actions[0].payload = { note: 'Edited after publication.' }
      },
      'definition-set-modifiers',
    ],
    [
      'rescue module slots',
      (world: ReturnType<typeof createFixtureReleaseWorld>) => {
        world.store.rescueModules[0].slots[0].requiredness = 'optional'
      },
      'definition-set-rescue-modules',
    ],
    [
      'a role alias',
      (world: ReturnType<typeof createFixtureReleaseWorld>) => {
        world.store.roleTaxonomy = {
          ...world.store.roleTaxonomy,
          roleCodeAliases: { FIXTURE_OLD_ROLE: 'FIXTURE_DIFFERENT_ROLE' },
        }
      },
      'definition-set-role-taxonomy',
    ],
  ])('is detected when %s change', (_label, mutate, expectedPin) => {
    const world = createFixtureReleaseWorld()
    mutate(world)

    const resolved = resolvePinnedRelease(BRAVO_RELEASE_ID, world.bundleById, world.loadSources)
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.changedPins).toContain(expectedPin)
  })
})

describe('removing a published definition', () => {
  it('is detected when a pinned module version is deleted', () => {
    const world = createFixtureReleaseWorld()
    world.store.modules.delete(FIXTURE_MODULE_V1_0)

    const resolved = resolvePinnedRelease(ALPHA_RELEASE_ID, world.bundleById, world.loadSources)
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    // Not swapped for v1.1, which exists, shares the module code, and would resolve happily.
    expect(resolved.code).toBe('release_pin_missing')
    expect(blockingCodes(world)).toContain('release_pin_missing')
  })

  it('is detected when a superseded release is dropped from the retained set', () => {
    const world = createFixtureReleaseWorld()
    const withoutAlpha = world.bundles.filter((bundle) => bundle.id !== ALPHA_RELEASE_ID)

    const codes = validateReleaseBundles({
      bundles: withoutAlpha,
      pointers: world.pointers,
      sourcesByBundleId: world.sourcesByBundleId(),
    }).map((message) => message.code)
    expect(codes).toContain('release_supersedes_missing')
  })

  it('leaves a card pinned to a missing release view-only rather than substituting one', () => {
    const world = createFixtureReleaseWorld()
    const withoutAlpha = new Map([...world.bundleById].filter(([id]) => id !== ALPHA_RELEASE_ID))

    const resolved = resolvePinnedRelease(ALPHA_RELEASE_ID, withoutAlpha, world.loadSources)
    expect(resolved.ok).toBe(false)
    if (resolved.ok) return
    expect(resolved.code).toBe('release_unknown')
  })
})

describe('what the definition hash addresses', () => {
  const world = createFixtureReleaseWorld()
  const bravo = world.bundleById.get(BRAVO_RELEASE_ID)!

  it.each(Object.keys(RELEASE_BUNDLE_HASH_EXCLUSIONS))('does not move when %s changes', (field) => {
    const changed: Record<string, unknown> = {
      releaseState: 'retired',
      publishedAt: '2030-01-01T00:00:00.000Z',
      retiredAt: '2030-06-01T00:00:00.000Z',
      releaseNotes: 'Rewritten after the fact.',
      governanceState: 'approved',
      catalogImportId: 'a-completely-different-catalog',
      resolverContractVersion: 'ip-cards-resolver/9.9.9',
    }
    const mutated = { ...bravo, [field]: changed[field] } as PreferenceCardReleaseBundle
    expect(releaseBundleDefinitionHash(mutated)).toBe(bravo.definitionHash)
  })

  it('moves when any pinned definition changes', () => {
    const alpha = world.bundleById.get(ALPHA_RELEASE_ID)!
    for (const patch of [
      { recipeDefinitionHash: 'x'.repeat(64) },
      { modulePins: alpha.modulePins },
      { modifierSetPin: { ...bravo.modifierSetPin, definitionHash: 'y'.repeat(64) } },
      { roleTaxonomyPin: { ...bravo.roleTaxonomyPin, definitionHash: 'z'.repeat(64) } },
      { supersedesReleaseBundleId: null },
    ]) {
      expect(releaseBundleDefinitionHash({ ...bravo, ...patch })).not.toBe(bravo.definitionHash)
    }
  })

  it('retiring a release does not make it look mutated', () => {
    const retired = {
      ...bravo,
      releaseState: 'retired' as const,
      retiredAt: '2030-01-01T00:00:00.000Z',
    }
    const codes = validateReleaseBundles({
      bundles: [world.bundleById.get(ALPHA_RELEASE_ID)!, retired],
      // The pointer has to move off a retired release; that is a separate obligation.
      pointers: { [FIXTURE_PROCEDURE_CODE]: ALPHA_RELEASE_ID },
      sourcesByBundleId: world.sourcesByBundleId(),
    }).map((message) => message.code)
    expect(codes).not.toContain('release_definition_mutated')
  })
})

describe('release impact review', () => {
  it('reports the requirement that changed, not only that a hash moved', () => {
    const world = createFixtureReleaseWorld()
    const previous = resolvePinnedRelease(ALPHA_RELEASE_ID, world.bundleById, world.loadSources)
    const next = resolvePinnedRelease(BRAVO_RELEASE_ID, world.bundleById, world.loadSources)
    if (!previous.ok || !next.ok) throw new Error('fixture releases did not resolve')

    const report = diffReleaseBundles(
      { bundle: previous.bundle, sources: previous.sources },
      { bundle: next.bundle, sources: next.sources },
    )

    expect(report.identical).toBe(false)
    expect(report.previousReleaseBundleId).toBe(ALPHA_RELEASE_ID)
    // A hash diff alone is unreviewable. This is the sentence a clinician can approve.
    expect(report.requirementChanges).toEqual([
      {
        requirementKey: REVISED_REQUIREMENT_KEY,
        kind: 'changed',
        moduleVersionIds: [next.sources.modules[0].id],
        changedFields: ['requiredness'],
      },
    ])
    expect(report.pinChanges.map((change) => change.kind).sort()).toEqual([
      'added',
      'added',
      'removed',
      'removed',
    ])
  })

  it('reports no change when a release pins exactly the same definitions', () => {
    const world = createFixtureReleaseWorld()
    const bravo = resolvePinnedRelease(BRAVO_RELEASE_ID, world.bundleById, world.loadSources)
    const charlie = resolvePinnedRelease(CHARLIE_RELEASE_ID, world.bundleById, world.loadSources)
    if (!bravo.ok || !charlie.ok) throw new Error('fixture releases did not resolve')

    // CHARLIE republishes BRAVO's exact definitions, so advancing to it changes nothing a
    // card resolves from. Worth being able to say plainly before advancing a pointer.
    const report = diffReleaseBundles(
      { bundle: bravo.bundle, sources: bravo.sources },
      { bundle: charlie.bundle, sources: charlie.sources },
    )
    expect(report.identical).toBe(true)
  })
})

describe('publication bookkeeping', () => {
  it('rejects a frozen release that records no hash, and a draft that records one', () => {
    const world = createFixtureReleaseWorld()
    const bravo = world.bundleById.get(BRAVO_RELEASE_ID)!

    const noHash = validateReleaseBundles({
      bundles: [{ ...bravo, definitionHash: '' }],
      pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID },
      sourcesByBundleId: world.sourcesByBundleId(),
    })
    expect(noHash.map((message) => message.code)).toContain('release_frozen_hash_absent')

    const draftPointer = validateReleaseBundles({
      bundles: [{ ...bravo, releaseState: 'draft' }],
      pointers: { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID },
      sourcesByBundleId: world.sourcesByBundleId(),
    })
    expect(draftPointer.map((message) => message.code)).toContain('release_pointer_not_published')
  })

  it('reports a procedure that has releases but nothing designating a current one', () => {
    const world = createFixtureReleaseWorld()
    const codes = validateReleaseBundles({
      bundles: world.bundles,
      pointers: {},
      sourcesByBundleId: world.sourcesByBundleId(),
    }).map((message) => message.code)
    expect(codes).toContain('release_pointer_missing')
  })

  it('reports a pointer at a release that is not retained', () => {
    const world = createFixtureReleaseWorld()
    const codes = validateReleaseBundles({
      bundles: world.bundles,
      pointers: { [FIXTURE_PROCEDURE_CODE]: 'release-that-never-existed' },
      sourcesByBundleId: world.sourcesByBundleId(),
    }).map((message) => message.code)
    expect(codes).toContain('release_pointer_unknown')
  })
})

describe('independently versioned context', () => {
  it('records catalog and resolver drift as advisory rather than as mutation', () => {
    const world = createFixtureReleaseWorld()
    world.store.catalogImportId = 'a-later-catalog-import'
    world.store.resolverContractVersion = 'ip-cards-resolver/0.3.0'

    const messages = validateReleaseBundles({
      bundles: world.bundles,
      pointers: world.pointers,
      sourcesByBundleId: world.sourcesByBundleId(),
    })
    const codes = messages.map((message) => message.code)
    expect(codes).toContain('release_catalog_import_advanced')
    expect(codes).toContain('release_resolver_contract_advanced')
    // Both are warnings: the catalog and the engine are governed separately, and treating
    // their movement as a mutation of authored clinical content would drown the real signal.
    expect(messages.filter((message) => message.severity === 'blocking')).toEqual([])

    // And a card pinned to any of them still reopens.
    expect(resolvePinnedRelease(ALPHA_RELEASE_ID, world.bundleById, world.loadSources).ok).toBe(
      true,
    )
  })
})
