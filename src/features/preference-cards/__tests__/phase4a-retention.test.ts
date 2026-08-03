import {
  ALPHA_RELEASE_ID,
  BRAVO_RELEASE_ID,
  FIXTURE_MODULE_V1_0,
  FIXTURE_MODULE_V1_1,
  FIXTURE_PROCEDURE_CODE,
  REVISED_REQUIREMENT_KEY,
  createFixtureReleaseWorld,
} from '../__fixtures__/release-bundle-fixtures'
import {
  buildDemoContext,
  defaultBuildInput,
  getComposedRecipeSlots,
  getScenarioDefinition,
} from '../data/demo-context.server'
import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import { selectionsFromResolvedCard } from '../domain/hospital-selection'
import {
  resolveRetainedModules,
  validateModuleLedger,
  withPublishedModules,
  type ModuleLedger,
} from '../domain/module-ledger'
import { resolveCurrentRelease, resolvePinnedRelease } from '../domain/release-bundle'
import { resolveCard } from '../domain/resolve-card'
import type { RecipeModuleVersion } from '../domain/types'

/**
 * Phase 4A's retention guarantees, end to end.
 *
 * The claim under test is narrow and load-bearing: a card pinned to an older release keeps
 * resolving to what it always resolved to, after newer module and procedure releases become
 * current, and *without* being quietly steered by anything that is not part of its pin —
 * modifier availability, local option ranking, or a fallback.
 */

const SCENARIO_ID = 'ebus-rose-molecular'

function ledgerFor(modules: RecipeModuleVersion[], releaseBundleId: string): ModuleLedger {
  return withPublishedModules(
    { formatVersion: '1.0', entries: [] },
    modules.map((moduleVersion) => ({ moduleVersion, releaseBundleId })),
  )
}

function requirednessThrough(
  world: ReturnType<typeof createFixtureReleaseWorld>,
  releaseBundleId: string,
  modules: ReadonlyMap<string, RecipeModuleVersion>,
): string | undefined {
  const resolved = resolvePinnedRelease(releaseBundleId, world.bundleById, (bundle) => {
    const sources = world.loadSources(bundle)
    if (!sources) return null
    // Resolve the pinned module versions out of the retention map rather than the live one —
    // the whole point being that the live one may no longer produce them.
    const pinned = sources.recipe.moduleReferences
      .map((reference) => modules.get(reference.moduleVersionId))
      .filter((moduleVersion): moduleVersion is RecipeModuleVersion => Boolean(moduleVersion))
    return pinned.length === sources.recipe.moduleReferences.length
      ? { ...sources, modules: pinned }
      : null
  })
  if (!resolved.ok) throw new Error(`expected ${releaseBundleId} to resolve: ${resolved.message}`)
  return expandRecipeComposition({
    recipe: resolved.sources.recipe,
    modules: resolved.sources.modules,
    selectedModuleVersionIds: resolved.sources.modules.map((moduleVersion) => moduleVersion.id),
    startSequence: 1,
  }).slots.find((slot) => slot.requirementKey === REVISED_REQUIREMENT_KEY)?.requiredness
}

describe('an old card after a newer module and release become current', () => {
  it('still opens against Release 1 and Module v1.0', () => {
    const world = createFixtureReleaseWorld()
    const modules = resolveRetainedModules(
      new Map(),
      ledgerFor([...world.store.modules.values()], ALPHA_RELEASE_ID),
    )

    expect(requirednessThrough(world, ALPHA_RELEASE_ID, modules)).toBe('optional')
  })

  it('is unaffected by the current pointer, wherever it points', () => {
    const world = createFixtureReleaseWorld()
    const modules = resolveRetainedModules(new Map(world.store.modules), {
      formatVersion: '1.0',
      entries: [],
    })

    const before = requirednessThrough(world, ALPHA_RELEASE_ID, modules)
    // Advancing, and then retreating, the pointer. The old card reads the same each time
    // because nothing about it consults the pointer at all.
    const pointerStates: Array<Record<string, string>> = [
      { [FIXTURE_PROCEDURE_CODE]: BRAVO_RELEASE_ID },
      { [FIXTURE_PROCEDURE_CODE]: ALPHA_RELEASE_ID },
      {},
    ]
    for (const pointers of pointerStates) {
      resolveCurrentRelease(FIXTURE_PROCEDURE_CODE, pointers, world.bundleById)
      expect(requirednessThrough(world, ALPHA_RELEASE_ID, modules)).toBe(before)
    }
  })

  it('gives a new card Release 2 and Module v1.1', () => {
    const world = createFixtureReleaseWorld()
    const modules = resolveRetainedModules(new Map(world.store.modules), {
      formatVersion: '1.0',
      entries: [],
    })
    const current = resolveCurrentRelease(FIXTURE_PROCEDURE_CODE, world.pointers, world.bundleById)

    expect(current?.id).toBe(BRAVO_RELEASE_ID)
    expect(current!.modulePins.map((pin) => pin.moduleVersionId)).toEqual([FIXTURE_MODULE_V1_1])
    expect(requirednessThrough(world, BRAVO_RELEASE_ID, modules)).toBe('required')
  })
})

describe('the module retention ledger', () => {
  it('lets two versions of one module code coexist, addressed by exact version id', () => {
    const world = createFixtureReleaseWorld()
    const modules = resolveRetainedModules(new Map(world.store.modules), {
      formatVersion: '1.0',
      entries: [],
    })

    const v10 = modules.get(FIXTURE_MODULE_V1_0)!
    const v11 = modules.get(FIXTURE_MODULE_V1_1)!
    expect(v10.code).toBe(v11.code)
    expect(v10.version).not.toBe(v11.version)
    // Lookup is by version id, never by code — a code resolves to nothing.
    expect(modules.get(v10.code)).toBeUndefined()
  })

  it('keeps an old module resolvable after the live map stops producing it', () => {
    const world = createFixtureReleaseWorld()
    const ledger = ledgerFor([world.store.modules.get(FIXTURE_MODULE_V1_0)!], ALPHA_RELEASE_ID)
    // The current composition build has moved on and only emits v1.1.
    const liveOnlyV11 = new Map([
      [FIXTURE_MODULE_V1_1, world.store.modules.get(FIXTURE_MODULE_V1_1)!],
    ])

    const modules = resolveRetainedModules(liveOnlyV11, ledger)
    expect(modules.has(FIXTURE_MODULE_V1_0)).toBe(true)
    expect(requirednessThrough(world, ALPHA_RELEASE_ID, modules)).toBe('optional')
  })

  it('fails validation when a ledger-listed module is mutated', () => {
    const world = createFixtureReleaseWorld()
    const ledger = ledgerFor([world.store.modules.get(FIXTURE_MODULE_V1_0)!], ALPHA_RELEASE_ID)
    // Editing the frozen definition in place — the entry no longer hashes to what it published.
    ledger.entries[0].definition = {
      ...ledger.entries[0].definition,
      slots: ledger.entries[0].definition.slots.map((slot) => ({
        ...slot,
        requiredness: 'required' as const,
      })),
    }

    const messages = validateModuleLedger({
      ledger,
      liveModules: new Map(),
      pinnedModuleVersionIds: new Set([FIXTURE_MODULE_V1_0]),
    })
    expect(messages.map((message) => message.code)).toContain('module_ledger_entry_mutated')
  })

  it('fails validation when the live map contradicts a published definition', () => {
    const world = createFixtureReleaseWorld()
    const ledger = ledgerFor([world.store.modules.get(FIXTURE_MODULE_V1_0)!], ALPHA_RELEASE_ID)
    const contradicting = new Map([
      [
        FIXTURE_MODULE_V1_0,
        { ...world.store.modules.get(FIXTURE_MODULE_V1_0)!, description: 'edited upstream' },
      ],
    ])

    const messages = validateModuleLedger({
      ledger,
      liveModules: contradicting,
      pinnedModuleVersionIds: new Set([FIXTURE_MODULE_V1_0]),
    })
    expect(messages.map((message) => message.code)).toContain('module_ledger_diverged_from_live')
  })

  it('fails validation when a pinned module is deleted from both the ledger and the live map', () => {
    const messages = validateModuleLedger({
      ledger: { formatVersion: '1.0', entries: [] },
      liveModules: new Map(),
      pinnedModuleVersionIds: new Set([FIXTURE_MODULE_V1_0]),
    })
    expect(messages.map((message) => message.code)).toContain('module_ledger_entry_missing')
  })

  it('never rewrites an entry it already holds', () => {
    const world = createFixtureReleaseWorld()
    const first = ledgerFor([world.store.modules.get(FIXTURE_MODULE_V1_0)!], ALPHA_RELEASE_ID)
    const edited = {
      ...world.store.modules.get(FIXTURE_MODULE_V1_0)!,
      description: 'changed after publication',
    }

    // Append-only: folding in a *different* definition under a known id leaves the original.
    const second = withPublishedModules(first, [
      { moduleVersion: edited, releaseBundleId: BRAVO_RELEASE_ID },
    ])
    expect(second.entries).toHaveLength(1)
    expect(second.entries[0].definition.description).toBe(first.entries[0].definition.description)
    expect(second.entries[0].firstPublishedByReleaseBundleId).toBe(ALPHA_RELEASE_ID)
  })
})

describe('local preference ranking', () => {
  const COMPETING_ITEM_ID = 'demo-newly-preferred-suction'

  /**
   * A better-ranked local option appears for a role the card already resolved.
   *
   * This is the realistic event — the site stocks something new and ranks it first — and it is
   * the one that used to rewrite saved cards, because `options[0]` was recomputed on every
   * resolution. Re-ranking the demo seed would prove nothing: every role there has exactly one
   * option, all at rank 1.
   */
  function withBetterRankedOption(context: ReturnType<typeof buildDemoContext>) {
    const displaced = context.hospitalRoleOptions.find((option) => option.active)!
    const template = context.hospitalItems.find((item) => item.id === displaced.hospitalItemId)!
    return {
      ...context,
      hospitalItems: [...context.hospitalItems, { ...template, id: COMPETING_ITEM_ID }],
      hospitalRoleOptions: [
        ...context.hospitalRoleOptions,
        {
          ...displaced,
          id: 'demo-role-option-newly-preferred',
          hospitalItemId: COMPETING_ITEM_ID,
          // Ranked ahead of everything the card was built against.
          preferenceRank: 0,
        },
      ],
      displacedRoleCode: displaced.roleCode,
    }
  }

  it('does not change what a saved card selected', () => {
    const context = buildDemoContext(SCENARIO_ID)
    const saved = defaultBuildInput(SCENARIO_ID)
    const before = resolveCard(saved, context)

    const reRanked = withBetterRankedOption(context)
    const after = resolveCard(saved, reRanked)

    expect(selectionsFromResolvedCard(after)).toEqual(selectionsFromResolvedCard(before))
    expect(after.snapshotHash).toBe(before.snapshotHash)
    // And specifically: the newcomer did not take over any line.
    expect(after.items.some((item) => item.selectedHospitalItemId === COMPETING_ITEM_ID)).toBe(
      false,
    )
  })

  it('would have changed it before selections were explicit', () => {
    const context = buildDemoContext(SCENARIO_ID)
    const implicit = { ...defaultBuildInput(SCENARIO_ID) }
    // Exactly the pre-Phase-4A shape: no recorded selections, so every line falls back to
    // whatever the formulary currently ranks first.
    delete implicit.selectedHospitalItemIds
    delete implicit.selectionsAreExplicit

    const { displacedRoleCode, ...reRanked } = withBetterRankedOption(context)
    const before = resolveCard(implicit, context)
    const after = resolveCard(implicit, reRanked)

    // The newcomer silently takes the line over — the behaviour explicit selections remove.
    expect(
      after.items.find((item) => item.roleCode === displacedRoleCode)?.selectedHospitalItemId,
    ).toBe(COMPETING_ITEM_ID)
    expect(after.snapshotHash).not.toBe(before.snapshotHash)
  })

  it('records a selection for every requirement the card resolved, including suppressed ones', () => {
    const input = defaultBuildInput('chest-tube')
    const card = resolveCard(input, buildDemoContext('chest-tube'))

    expect(input.selectionsAreExplicit).toBe(true)
    for (const item of [...card.items, ...card.suppressedItems]) {
      expect(input.selectedHospitalItemIds).toHaveProperty(item.id)
    }
  })

  it('keeps an intentional non-selection rather than re-defaulting it', () => {
    const slot = getComposedRecipeSlots(SCENARIO_ID).find(
      (candidate) => candidate.requiredness === 'required',
    )!
    const input = defaultBuildInput(SCENARIO_ID, { selectedHospitalItemIds: { [slot.id]: null } })
    const card = resolveCard(input, buildDemoContext(SCENARIO_ID))

    // null is a decision, and reopening must not undo it.
    expect(input.selectedHospitalItemIds?.[slot.id]).toBeNull()
    expect(card.items.find((item) => item.id === slot.id)?.selectedHospitalItemId).toBeNull()
  })
})

describe('repeated generation', () => {
  it('is byte-identical for the same inputs', () => {
    const context = buildDemoContext(SCENARIO_ID)
    const input = defaultBuildInput(SCENARIO_ID)
    expect(JSON.stringify(resolveCard(input, context))).toBe(
      JSON.stringify(resolveCard(input, context)),
    )
  })

  it('produces the same explicit selections every time defaults are materialized', () => {
    expect(defaultBuildInput(SCENARIO_ID)).toEqual(defaultBuildInput(SCENARIO_ID))
  })

  it('resolves a card identically through a rebuilt context', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    expect(resolveCard(input, buildDemoContext(SCENARIO_ID)).snapshotHash).toBe(
      resolveCard(input, buildDemoContext(SCENARIO_ID)).snapshotHash,
    )
  })
})

describe('modifier availability is a permission, not a hint', () => {
  it('is pinned by the release rather than read from the current scenario', () => {
    const scenario = getScenarioDefinition(SCENARIO_ID)!
    const context = buildDemoContext(SCENARIO_ID)
    expect(context.recipe.allowedModifierCodes).toEqual([...scenario.availableModifierCodes].sort())
  })

  it('offers nothing on a composition that authored no modifier targets', () => {
    // The custom composition has no reviewed template, so a modifier would land somewhere
    // nobody reviewed. That was previously enforced only by not rendering the controls.
    expect(buildDemoContext('custom-composition').recipe.allowedModifierCodes).toEqual([])
    expect(buildDemoContext('custom-composition').modifiers).toEqual([])
  })
})
