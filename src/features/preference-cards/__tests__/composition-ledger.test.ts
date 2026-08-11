import {
  emptyCompositionLedger,
  retainedRecipeById,
  validateCompositionLedger,
  withPublishedRecipes,
  type CompositionLedger,
} from '../domain/composition-ledger'
import { recipeDefinitionHash } from '../domain/release-bundle'
import type { RecipeVersion } from '../domain/types'

/**
 * The recipe retention ledger — the mechanism that lets a published release outlive the seed
 * composition that produced it, exactly as `module-ledger.ts` does for module versions.
 */

function recipe(overrides?: Partial<RecipeVersion>): RecipeVersion {
  return {
    id: 'recipe-test-v0-1',
    sourceProcedureCode: 'TEST',
    sourceTemplateVersion: '0.1',
    name: 'Test recipe',
    version: '0.1',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    allowedModifierCodes: [],
    catalogImportId: 'workbook-digest',
    slots: [],
    moduleReferences: [
      { moduleVersionId: 'module-test-v1-0', selectionBehavior: 'required', sequence: 10 },
    ],
    compositionActions: [],
    requirementSequences: {},
    ...overrides,
  }
}

function ledgerWith(recipeVersion: RecipeVersion): CompositionLedger {
  return withPublishedRecipes(emptyCompositionLedger(), [
    { recipe: recipeVersion, releaseBundleId: 'release-test-v1-0' },
  ])
}

describe('withPublishedRecipes', () => {
  it('appends a newly published recipe verbatim with its hash and provenance', () => {
    const ledger = ledgerWith(recipe())
    expect(ledger.entries).toHaveLength(1)
    expect(ledger.entries[0]).toMatchObject({
      recipeVersionId: 'recipe-test-v0-1',
      sourceProcedureCode: 'TEST',
      firstPublishedByReleaseBundleId: 'release-test-v1-0',
      definitionHash: recipeDefinitionHash(recipe()),
    })
    expect(ledger.entries[0].definition).toEqual(recipe())
  })

  it('never rewrites an existing entry, even when the published content now differs', () => {
    const ledger = ledgerWith(recipe())
    const mutated = recipe({ name: 'Renamed after publication' })
    const after = withPublishedRecipes(ledger, [
      { recipe: mutated, releaseBundleId: 'release-test-v1-1' },
    ])
    expect(after.entries).toHaveLength(1)
    expect(after.entries[0].definition.name).toBe('Test recipe')
    expect(after.entries[0].firstPublishedByReleaseBundleId).toBe('release-test-v1-0')
  })
})

describe('validateCompositionLedger', () => {
  it('accepts a coherent ledger', () => {
    const ledger = ledgerWith(recipe())
    const messages = validateCompositionLedger({
      ledger,
      liveRecipes: new Map([['recipe-test-v0-1', recipe()]]),
      pinnedRecipeVersionIds: new Set(['recipe-test-v0-1']),
    })
    expect(messages).toEqual([])
  })

  it('detects an entry edited in place', () => {
    const ledger = ledgerWith(recipe())
    ledger.entries[0].definition.name = 'Edited in place'
    const messages = validateCompositionLedger({
      ledger,
      liveRecipes: new Map(),
      pinnedRecipeVersionIds: new Set(['recipe-test-v0-1']),
    })
    expect(messages.map((message) => message.code)).toEqual(['composition_ledger_entry_mutated'])
  })

  it('detects the live build producing different content under a published id', () => {
    const ledger = ledgerWith(recipe())
    const messages = validateCompositionLedger({
      ledger,
      liveRecipes: new Map([['recipe-test-v0-1', recipe({ name: 'Diverged live' })]]),
      pinnedRecipeVersionIds: new Set(['recipe-test-v0-1']),
    })
    expect(messages.map((message) => message.code)).toEqual([
      'composition_ledger_diverged_from_live',
    ])
  })

  it('ignores catalogImportId drift, matching what recipe pins cover', () => {
    const ledger = ledgerWith(recipe())
    const messages = validateCompositionLedger({
      ledger,
      liveRecipes: new Map([
        ['recipe-test-v0-1', recipe({ catalogImportId: 'a-newer-workbook-digest' })],
      ]),
      pinnedRecipeVersionIds: new Set(['recipe-test-v0-1']),
    })
    expect(messages).toEqual([])
  })

  it('reports a pinned recipe version that is neither live nor retained', () => {
    const messages = validateCompositionLedger({
      ledger: emptyCompositionLedger(),
      liveRecipes: new Map(),
      pinnedRecipeVersionIds: new Set(['recipe-gone-v0-1']),
    })
    expect(messages.map((message) => message.code)).toEqual(['composition_ledger_entry_missing'])
  })

  it('reports a duplicate entry', () => {
    const ledger = ledgerWith(recipe())
    ledger.entries.push({ ...ledger.entries[0] })
    const messages = validateCompositionLedger({
      ledger,
      liveRecipes: new Map(),
      pinnedRecipeVersionIds: new Set(),
    })
    expect(messages.map((message) => message.code)).toEqual(['composition_ledger_duplicate_entry'])
  })
})

describe('retainedRecipeById', () => {
  it('exposes the frozen definitions by recipe version id', () => {
    const ledger = ledgerWith(recipe())
    const retained = retainedRecipeById(ledger)
    expect(retained.get('recipe-test-v0-1')?.name).toBe('Test recipe')
  })
})
