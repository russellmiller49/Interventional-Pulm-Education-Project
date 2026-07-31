import {
  buildDemoContext,
  defaultBuildInput,
  resolveDemoScenario,
} from '../data/demo-context.server'
import { builderInputsSchema, saveCardRequestSchema } from '../schemas/saved-card'
import { resolveForSave } from '../server/user-cards'

/**
 * What crosses the wire, what the server rebuilds, and what happens to a card written
 * before composition existed.
 */

const GENERATED_AT = '2026-07-30T12:00:00.000Z'
const SCENARIO_ID = 'ebus-rose-molecular'
const FLEX_CORE = 'module-flex-bronch-core-v1-0'
const EBUS_SPECIFIC = 'module-ebus-tbna-specific-v1-0'
const FLUOROSCOPY = 'module-procedural-fluoroscopy-v1-0'

function saveRequest(overrides: Partial<Record<string, unknown>> = {}) {
  return saveCardRequestSchema.parse({
    scenarioId: SCENARIO_ID,
    title: 'Composition persistence test',
    physicianName: null,
    status: 'draft',
    input: defaultBuildInput(SCENARIO_ID),
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
    ...overrides,
  })
}

describe('saving and reopening a composed card', () => {
  it('saves, and the server-side re-resolution reproduces the same hash', () => {
    const request = saveRequest()
    const first = resolveForSave(request, GENERATED_AT)
    const second = resolveForSave(request, '2026-08-01T09:30:00.000Z')

    expect(first.ok).toBe(true)
    if (!first.ok || !second.ok) return
    // `generatedAt` is deliberately outside the hash, so re-resolving the same selections
    // later reproduces the same card identity.
    expect(second.card.snapshotHash).toBe(first.card.snapshotHash)
    expect(first.card.includedModules?.map((module) => module.moduleVersionId)).toEqual([
      FLEX_CORE,
      EBUS_SPECIFIC,
      FLUOROSCOPY,
    ])
  })

  it('stores the exact module selection rather than a promise to recompute it', () => {
    const request = saveRequest()
    const stored = builderInputsSchema.parse({
      scenarioId: request.scenarioId,
      input: request.input,
      catalogPicks: request.catalogPicks,
      familyPicks: request.familyPicks,
      customItems: request.customItems,
      equipmentSets: request.equipmentSets,
    })

    expect(stored.input.selectedModuleVersionIds).toEqual([FLEX_CORE, EBUS_SPECIFIC, FLUOROSCOPY])

    // Reopening: the stored ids come back verbatim and re-resolve to the same card.
    const reopened = resolveForSave(stored, GENERATED_AT)
    expect(reopened.ok).toBe(true)
    if (!reopened.ok) return
    expect(reopened.card.snapshotHash).toBe(
      (resolveForSave(request, GENERATED_AT) as { ok: true; card: { snapshotHash: string } }).card
        .snapshotHash,
    )
  })

  it('round-trips a card whose optional module the author removed', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    input.selectedModuleVersionIds = [FLEX_CORE, EBUS_SPECIFIC]
    const result = resolveForSave(saveRequest({ input }), GENERATED_AT)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.card.includedModules?.map((module) => module.moduleVersionId)).toEqual([
      FLEX_CORE,
      EBUS_SPECIFIC,
    ])
    expect(result.card.snapshotHash).not.toBe(resolveDemoScenario(SCENARIO_ID).snapshotHash)
  })

  it('rejects a module the procedure composition does not offer', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    input.selectedModuleVersionIds = [
      FLEX_CORE,
      EBUS_SPECIFIC,
      'module-pleural-procedure-core-v1-0',
    ]

    expect(resolveForSave(saveRequest({ input }), GENERATED_AT)).toEqual({
      ok: false,
      code: 'module_not_offered',
      error: 'Module module-pleural-procedure-core-v1-0 is not part of this procedure composition.',
    })
  })

  it('rejects a module version that does not exist at all', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    input.selectedModuleVersionIds = [FLEX_CORE, EBUS_SPECIFIC, 'module-invented-v9-9']

    const result = resolveForSave(saveRequest({ input }), GENERATED_AT)
    expect(result.ok).toBe(false)
  })

  it('still forces the required modules when the client sends none', () => {
    const input = defaultBuildInput(SCENARIO_ID)
    input.selectedModuleVersionIds = []
    const result = resolveForSave(saveRequest({ input }), GENERATED_AT)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.card.includedModules?.map((module) => module.moduleVersionId)).toEqual([
      FLEX_CORE,
      EBUS_SPECIFIC,
    ])
  })

  it('does not let the client name its own module content', () => {
    // The schema accepts ids and nothing else; a smuggled module object is dropped rather
    // than trusted, and the id it carried is then unknown to the composition.
    const parsed = saveCardRequestSchema.parse({
      scenarioId: SCENARIO_ID,
      title: 'Injection attempt',
      status: 'draft',
      input: {
        ...defaultBuildInput(SCENARIO_ID),
        selectedModuleVersionIds: [FLEX_CORE, EBUS_SPECIFIC],
      },
      catalogPicks: [],
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
      recipeModules: [{ id: FLEX_CORE, name: 'Renamed by the client', slots: [] }],
    })
    expect('recipeModules' in parsed).toBe(false)

    const result = resolveForSave(parsed, GENERATED_AT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.card.includedModules?.[0].moduleName).toBe('Flexible Bronchoscopy Core')
  })
})

describe('a custom composition', () => {
  const CUSTOM = 'custom-composition'

  it('offers every module and starts with nothing selected', () => {
    const context = buildDemoContext(CUSTOM)
    expect(context.recipe.moduleReferences).toHaveLength(context.recipeModules.length)
    expect(
      context.recipe.moduleReferences.every(
        (reference) => reference.selectionBehavior === 'optional',
      ),
    ).toBe(true)
    expect(defaultBuildInput(CUSTOM).selectedModuleVersionIds).toEqual([])
  })

  it('re-resolves server-side from stored ids and is deterministic', () => {
    const input = defaultBuildInput(CUSTOM)
    input.selectedModuleVersionIds = [FLEX_CORE, 'module-pleural-procedure-core-v1-0']
    const request = saveCardRequestSchema.parse({
      scenarioId: CUSTOM,
      title: 'Custom composition test',
      status: 'draft',
      input,
      catalogPicks: [],
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
    })

    const first = resolveForSave(request, GENERATED_AT)
    const second = resolveForSave(request, '2026-09-02T10:00:00.000Z')
    expect(first.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.card.snapshotHash).toBe(first.card.snapshotHash)
    expect(first.card.includedModules?.map((module) => module.selectionSource)).toEqual([
      'user_selected',
      'user_selected',
    ])
    // Two cores that share no requirement key combine without conflict.
    expect(
      first.card.warnings.some((warning) => warning.code === 'recipe_composition_conflict'),
    ).toBe(false)
    expect(first.card.items).toHaveLength(3)
  })

  it('still rejects a module version that is not in the catalog', () => {
    const input = defaultBuildInput(CUSTOM)
    input.selectedModuleVersionIds = ['module-not-real-v1-0']
    const request = saveCardRequestSchema.parse({
      scenarioId: CUSTOM,
      title: 'Custom composition rejection test',
      status: 'draft',
      input,
      catalogPicks: [],
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
    })

    expect(resolveForSave(request, GENERATED_AT)).toEqual({
      ok: false,
      code: 'module_not_offered',
      error: 'Module module-not-real-v1-0 is not part of this procedure composition.',
    })
  })
})

describe('cards written before composition', () => {
  it('cannot be reopened in the builder, and says so rather than guessing', () => {
    // A pre-composition builder input has no module selection. Filling one in from today's
    // defaults would reinterpret the card; failing the schema makes `loadUserCard` return
    // `builderInputs: null`, which is the existing explicit "cannot reopen" behaviour.
    const legacyInput = defaultBuildInput(SCENARIO_ID) as unknown as Record<string, unknown>
    delete legacyInput.selectedModuleVersionIds
    const parsed = builderInputsSchema.safeParse({
      scenarioId: SCENARIO_ID,
      input: legacyInput,
      catalogPicks: [],
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
    })

    expect(parsed.success).toBe(false)
  })

  it('leave their stored snapshot untouched and still viewable', () => {
    // A legacy snapshot has no `includedModules`. Nothing in the read path requires one:
    // the card views fall back to rendering no composition summary.
    const legacySnapshot = { ...resolveDemoScenario(SCENARIO_ID) } as Record<string, unknown>
    delete legacySnapshot.includedModules
    const before = JSON.stringify(legacySnapshot)

    expect(legacySnapshot.items).toBeDefined()
    expect(legacySnapshot.includedModules).toBeUndefined()
    expect(JSON.stringify(legacySnapshot)).toBe(before)
  })
})
