import { FakePreferenceCardTables } from '../__fixtures__/fake-preference-card-tables'
import {
  buildDemoContext,
  defaultBuildInput,
  getComposedRecipeSlots,
  getScenarioDefinition,
} from '../data/demo-context.server'
import { getCurrentReleaseBundleForScenario } from '../data/release-bundles.server'
import { catalogPickItemId } from '../domain/catalog-pick'
import { customItemId } from '../domain/custom-item'
import { equipmentSetItemId } from '../domain/equipment-set'
import {
  BUILDER_INPUTS_SCHEMA_VERSION,
  builderInputsSchema,
  saveCardRequestSchema,
  type SaveCardRequest,
} from '../schemas/saved-card'
import { searchProductsForRole } from '../server/catalog'

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

const { supabaseServer } = jest.requireMock('@/lib/supabase/server') as {
  supabaseServer: jest.Mock
}

const {
  deleteUserCard,
  duplicateUserCard,
  loadEditableUserCard,
  loadUserCard,
  listUserCards,
  renameUserCard,
  resolveForSave,
  saveUserCard,
  setShareEnabled,
} = jest.requireActual('../server/user-cards') as typeof import('../server/user-cards')

/**
 * The saved-card edit lifecycle, against a table that behaves like the real one.
 *
 * The fake below enforces the property the production code leans on hardest: row-level
 * security means a statement simply does not see another user's rows. Emulating that rather
 * than stubbing "is this yours?" is what makes the authorization tests worth anything —
 * `user-cards.ts` deliberately contains no ownership check of its own, so a test that
 * mocked one would be testing the mock.
 */

const SCENARIO_ID = 'ebus-rose-molecular'
const FLEX_CORE = 'module-flex-bronch-core-v1-0'
const EBUS_SPECIFIC = 'module-ebus-tbna-specific-v1-0'
const FLUOROSCOPY = 'module-procedural-fluoroscopy-v1-0'
const OWNER = 'user-owner'
const OTHER_USER = 'user-other'

const tables = new FakePreferenceCardTables()

/**
 * The shared table fake, rather than an inline one.
 *
 * The inline version this replaces recorded only the *last* `.eq()` filter, so it could not
 * express a multi-column predicate at all — and the conditional update that gives a save its
 * stale-edit protection is exactly that. A fake that cannot represent the mechanism cannot test
 * it, and would have reported every guarded save as a miss.
 *
 * `FakePreferenceCardTables` also models the revision trigger and the content-versioned
 * `updated_at`, so there is now one model of these two tables instead of two that could disagree.
 */
beforeEach(() => {
  tables.reset(OWNER)
  supabaseServer.mockResolvedValue(tables.client())
})

/**
 * The content version a card is currently at.
 *
 * Every overwrite now has to state the version it was built from, so the tests state it the same
 * way the editor does: by reading what is stored right now. A test that wants to *be* stale passes
 * an older value deliberately.
 */
function currentVersion(cardId: string): string {
  const row = tables.cards.find((candidate) => candidate.id === cardId)
  expect(row).toBeDefined()
  return row!.updated_at
}

/** Every modifier code the merged definition set actually contains, offered or not. */
function buildDemoContextModifierCodes(): string[] {
  return getScenarioDefinition('flex-diagnostic')!.availableModifierCodes
}

function ebusProductPick(): { productId: string; roleCode: string } {
  const roleCode = 'EBUS_NEEDLE_FNA'
  const option = searchProductsForRole({ roleCode, limit: 1 })[0]
  expect(option).toBeDefined()
  return { productId: option.productId, roleCode }
}

/** Selections are keyed by the composed slot's id, not by its role. */
function slotIdForRole(roleCode: string): string {
  const slot = getComposedRecipeSlots(SCENARIO_ID).find(
    (candidate) => candidate.roleCode === roleCode,
  )
  expect(slot).toBeDefined()
  return slot!.id
}

/**
 * The end-to-end fixture: an EBUS card with something saved in every channel the builder
 * writes to, so "reopening restores everything" is a claim about all of them at once.
 */
function ebusEditFixture(): SaveCardRequest {
  const scenario = getScenarioDefinition(SCENARIO_ID)!
  const base = defaultBuildInput(SCENARIO_ID)
  const pick = ebusProductPick()
  const needleSlot = slotIdForRole('EBUS_NEEDLE_FNA')
  const specimenSlot = slotIdForRole('GENERIC_SPECIMEN')
  // A slot that genuinely carries a dependency rule, so the conditional state is a real
  // clinical decision rather than an inert key.
  const balloonSlot = slotIdForRole('EBUS_BALLOON')

  const release = getCurrentReleaseBundleForScenario(SCENARIO_ID)
  expect(release).not.toBeNull()

  return saveCardRequestSchema.parse({
    // A card created today is release-pinned, so the fixture is one.
    schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
    releaseBundleId: release!.id,
    scenarioId: SCENARIO_ID,
    title: 'Dr Miller EBUS with ROSE',
    physicianName: 'R. Miller',
    status: 'final',
    catalogPicks: [pick],
    familyPicks: [],
    customItems: [
      {
        id: 'custom-ebus-1',
        roleCode: 'GENERIC_SPECIMEN',
        description: 'Locally printed node-station label sheet',
        itemNumber: 'LOC-4412',
        notes: 'Kept in the ROSE cart',
      },
    ],
    equipmentSets: [
      {
        id: 'set-ebus-tray',
        name: 'EBUS needle tray',
        description: 'Standing tray for the EBUS room',
        selectedRoleCode: pick.roleCode,
        additionalCoveredRoles: [],
        members: [pick],
      },
    ],
    input: {
      ...base,
      recipeVersionId: scenario.recipeVersionId,
      // Fluoroscopy is default-on and deliberately removed here.
      selectedModuleVersionIds: [FLEX_CORE, EBUS_SPECIFIC],
      modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
      conditionalStates: { [balloonSlot]: 'exclude' },
      selectedHospitalItemIds: {
        [needleSlot]: catalogPickItemId(pick.productId),
        [specimenSlot]: customItemId('custom-ebus-1'),
      },
    },
  })
}

async function saveFixture(): Promise<string> {
  const result = await saveUserCard(ebusEditFixture())
  expect(result.ok).toBe(true)
  return result.data!
}

describe('reopening a saved composed card', () => {
  it('restores every persisted selection and every piece of card metadata', async () => {
    const cardId = await saveFixture()

    const editable = await loadEditableUserCard(cardId)
    expect(editable.ok).toBe(true)
    if (!editable.ok) return

    const { record, builderInputs, rebuilt } = editable
    const pick = ebusProductPick()

    expect(record.title).toBe('Dr Miller EBUS with ROSE')
    expect(record.physicianName).toBe('R. Miller')
    expect(record.status).toBe('final')

    expect(builderInputs.schemaVersion).toBe(BUILDER_INPUTS_SCHEMA_VERSION)
    expect(builderInputs.input.selectedModuleVersionIds).toEqual([FLEX_CORE, EBUS_SPECIFIC])
    expect(builderInputs.input.modifierCodes).toEqual(['ROSE', 'SPEC_MOLECULAR'])
    expect(builderInputs.input.conditionalStates).toEqual({
      [slotIdForRole('EBUS_BALLOON')]: 'exclude',
    })
    expect(builderInputs.input.selectedHospitalItemIds).toEqual({
      [slotIdForRole('EBUS_NEEDLE_FNA')]: catalogPickItemId(pick.productId),
      [slotIdForRole('GENERIC_SPECIMEN')]: customItemId('custom-ebus-1'),
    })
    // The conditional decision reaches the resolved card, not just the stored input.
    expect(
      record.card.items.find((item) => item.roleCode === 'EBUS_BALLOON')?.conditionalState,
    ).toBe('exclude')
    expect(builderInputs.customItems).toHaveLength(1)
    expect(builderInputs.customItems[0]).toMatchObject({
      id: 'custom-ebus-1',
      itemNumber: 'LOC-4412',
      notes: 'Kept in the ROSE cart',
    })

    // Picks come back as whole catalog records, not the identifiers that were stored.
    expect(rebuilt.catalogPicks).toHaveLength(1)
    expect(rebuilt.catalogPicks[0].productId).toBe(pick.productId)
    expect(rebuilt.catalogPicks[0].productName).toBeTruthy()

    expect(rebuilt.equipmentSets).toHaveLength(1)
    expect(rebuilt.equipmentSets[0].name).toBe('EBUS needle tray')
    expect(rebuilt.equipmentSets[0].members[0].productId).toBe(pick.productId)
    expect(rebuilt.selectedRoleBySetId).toEqual({ 'set-ebus-tray': pick.roleCode })
  })

  it('keeps a removed default-on module removed and the required modules included', async () => {
    const cardId = await saveFixture()
    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')

    expect(editable.builderInputs.input.selectedModuleVersionIds).not.toContain(FLUOROSCOPY)
    const included = editable.record.card.includedModules ?? []
    expect(included.map((module) => module.moduleVersionId)).toEqual([FLEX_CORE, EBUS_SPECIFIC])
    expect(
      included.filter((module) => module.selectionBehavior === 'required').length,
    ).toBeGreaterThan(0)
  })

  it('reproduces the stored snapshot exactly when nothing is changed', async () => {
    const cardId = await saveFixture()
    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')

    // The card the builder would preview and the card a fresh save would store are the same
    // card. A divergence here is the failure the shared reconstruction exists to prevent.
    const fresh = resolveForSave(editable.builderInputs, '2099-01-01T00:00:00.000Z')
    expect(fresh.ok).toBe(true)
    if (!fresh.ok) return
    expect(fresh.card.snapshotHash).toBe(editable.record.card.snapshotHash)
  })

  it('survives a reload of the edit route with the same persisted state', async () => {
    const cardId = await saveFixture()
    const first = await loadEditableUserCard(cardId)
    const second = await loadEditableUserCard(cardId)
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(second.builderInputs).toEqual(first.builderInputs)
    expect(second.record.card.snapshotHash).toBe(first.record.card.snapshotHash)
  })
})

describe('saving an edited card', () => {
  it('updates the same row and leaves sharing, ownership, and creation untouched', async () => {
    const cardId = await saveFixture()
    const shared = await setShareEnabled(cardId, true)
    expect(shared.ok).toBe(true)
    const before = tables.cards.find((row) => row.id === cardId)!
    const beforeToken = before.share_token
    const beforeCreatedAt = before.created_at
    const beforeUpdatedAt = before.updated_at

    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')
    const edited = saveCardRequestSchema.parse({
      ...editable.builderInputs,
      cardId,
      expectedUpdatedAt: currentVersion(cardId),
      title: 'Dr Miller EBUS with ROSE (revised)',
      physicianName: 'R. Miller',
      status: editable.record.status,
      input: {
        ...editable.builderInputs.input,
        // Add the fluoroscopy module back — an ordinary edit.
        selectedModuleVersionIds: [FLEX_CORE, EBUS_SPECIFIC, FLUOROSCOPY],
      },
    })

    const result = await saveUserCard(edited)
    expect(result).toEqual({ ok: true, data: cardId })
    expect(tables.cards).toHaveLength(1)

    const after = tables.cards.find((row) => row.id === cardId)!
    expect(after.share_enabled).toBe(true)
    expect(after.share_token).toBe(beforeToken)
    expect(after.user_id).toBe(OWNER)
    expect(after.created_at).toBe(beforeCreatedAt)
    expect(after.updated_at).not.toBe(beforeUpdatedAt)
    expect(after.title).toBe('Dr Miller EBUS with ROSE (revised)')
    expect(after.snapshot_hash).not.toBe(before.snapshot_hash)

    const reloaded = await loadUserCard(cardId)
    expect(reloaded!.card.snapshotHash).toBe(after.snapshot_hash)
    expect(
      (reloaded!.card.includedModules ?? []).map((module) => module.moduleVersionId),
    ).toContain(FLUOROSCOPY)
  })

  it('does not churn the snapshot hash for a metadata-only edit', async () => {
    const cardId = await saveFixture()
    const before = tables.cards.find((row) => row.id === cardId)!.snapshot_hash

    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')
    await saveUserCard(
      saveCardRequestSchema.parse({
        ...editable.builderInputs,
        cardId,
        expectedUpdatedAt: currentVersion(cardId),
        title: 'Renamed in the builder',
        physicianName: 'R. Miller',
        status: editable.record.status,
      }),
    )

    const after = tables.cards.find((row) => row.id === cardId)!
    expect(after.snapshot_hash).toBe(before)
    expect(after.title).toBe('Renamed in the builder')
  })

  it('stores builder inputs at the current schema version', async () => {
    const cardId = await saveFixture()
    const stored = tables.cards.find((row) => row.id === cardId)!.builder_inputs as {
      schemaVersion: number
    }
    expect(stored.schemaVersion).toBe(BUILDER_INPUTS_SCHEMA_VERSION)
  })
})

describe('exact version pinning', () => {
  it('resolves through the stored module ids rather than the composition defaults', async () => {
    const cardId = await saveFixture()
    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')

    // The composition still offers fluoroscopy as default-on. The reopened card does not
    // acquire it, because the card names its modules and the defaults are not consulted.
    const offered = editable.rebuilt.context.recipe.moduleReferences.map(
      (reference) => reference.moduleVersionId,
    )
    expect(offered).toContain(FLUOROSCOPY)
    expect(editable.builderInputs.input.selectedModuleVersionIds).not.toContain(FLUOROSCOPY)
  })

  it('reports a recipe version its pinned release does not publish', async () => {
    const cardId = await saveFixture()
    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = builderInputsSchema.parse(row.builder_inputs)
    row.builder_inputs = {
      ...inputs,
      input: { ...inputs.input, recipeVersionId: 'recipe-ebus-tbna-v9-9' },
    }

    const editable = await loadEditableUserCard(cardId)
    expect(editable.ok).toBe(false)
    if (editable.ok) return
    // A release-pinned card is checked against its release first, so the disagreement is
    // named as what it is rather than as a missing recipe. Either way nothing is substituted.
    expect(editable.code).toBe('release_recipe_mismatch')

    // The card itself is untouched and still views and prints.
    const viewed = await loadUserCard(cardId)
    expect(viewed).not.toBeNull()
    expect(viewed!.card.snapshotHash).toBe(row.snapshot_hash)
  })

  it('refuses to reopen a version-2 card, and leaves it fully usable as a document', async () => {
    const cardId = await saveFixture()
    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = builderInputsSchema.parse(row.builder_inputs)
    // A card written before release bundles pins its recipe and modules exactly and nothing
    // underneath them. Reopening it would re-resolve it against today's modifier set, rescue
    // modules, compatibility rules, and role table — so the builder is closed to it.
    const withoutPin: Record<string, unknown> = { ...inputs }
    delete withoutPin.releaseBundleId
    row.builder_inputs = { ...withoutPin, schemaVersion: 2 }

    const editable = await loadEditableUserCard(cardId)
    expect(editable.ok).toBe(false)
    if (editable.ok) return
    expect(editable.code).toBe('superseded_builder_inputs')

    // Nothing about the card itself changed: it still loads, still verifies, still lists,
    // and still duplicates. Only the edit control is withheld.
    const viewed = await loadUserCard(cardId)
    expect(viewed).not.toBeNull()
    expect(viewed!.card.snapshotHash).toBe(row.snapshot_hash)
    expect(viewed!.editable).toBe(false)
    expect((await listUserCards()).find((card) => card.id === cardId)?.editable).toBe(false)

    const copy = await duplicateUserCard(cardId, 'Copy of a version-2 card')
    expect(copy.ok).toBe(true)
    // A duplicate of a view-only card is also view-only. Duplication copies the stored
    // inputs verbatim; it is not a back door to an edit session.
    expect((await loadUserCard(copy.data!))!.editable).toBe(false)
  })

  it('refuses to write builder inputs at a superseded version', () => {
    const request = ebusEditFixture()
    const asVersionTwo: Record<string, unknown> = { ...request, schemaVersion: 2 }
    delete asVersionTwo.releaseBundleId

    // Enforced by the schema, so both writers — create and overwrite — are covered.
    expect(saveCardRequestSchema.safeParse(asVersionTwo).success).toBe(false)
  })

  it('reports a pinned module version the composition does not offer', async () => {
    const cardId = await saveFixture()
    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = builderInputsSchema.parse(row.builder_inputs)
    row.builder_inputs = {
      ...inputs,
      input: {
        ...inputs.input,
        selectedModuleVersionIds: [FLEX_CORE, 'module-flex-bronch-core-v9-9'],
      },
    }

    const editable = await loadEditableUserCard(cardId)
    expect(editable.ok).toBe(false)
    if (editable.ok) return
    expect(editable.code).toBe('module_not_offered')
  })

  it('rejects a crafted save that adds a module the composition never offered', async () => {
    const cardId = await saveFixture()
    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')

    const tampered = saveCardRequestSchema.parse({
      ...editable.builderInputs,
      cardId,
      expectedUpdatedAt: currentVersion(cardId),
      title: editable.record.title,
      status: editable.record.status,
      input: {
        ...editable.builderInputs.input,
        selectedModuleVersionIds: [
          ...editable.builderInputs.input.selectedModuleVersionIds,
          'module-pleural-procedure-core-v1-0',
        ],
      },
    })

    const result = await saveUserCard(tampered)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/is not part of this procedure composition/)
    // Nothing was written.
    expect(tables.cards.find((row) => row.id === cardId)!.title).toBe('Dr Miller EBUS with ROSE')
  })

  it('includes a required module even when the request omits it', async () => {
    const cardId = await saveFixture()
    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')

    const stripped = saveCardRequestSchema.parse({
      ...editable.builderInputs,
      cardId,
      expectedUpdatedAt: currentVersion(cardId),
      title: editable.record.title,
      status: editable.record.status,
      input: { ...editable.builderInputs.input, selectedModuleVersionIds: [] },
    })

    const result = await saveUserCard(stripped)
    expect(result.ok).toBe(true)
    const stored = await loadUserCard(cardId)
    const included = (stored!.card.includedModules ?? []).filter(
      (module) => module.selectionBehavior === 'required',
    )
    expect(included.length).toBeGreaterThan(0)
    expect(included.every((module) => module.selectionSource === 'required')).toBe(true)
  })
})

describe('authorization', () => {
  it('hides another user’s card behind the same answer an unknown id gets', async () => {
    const cardId = await saveFixture()

    tables.currentUserId = OTHER_USER
    expect(await loadEditableUserCard(cardId)).toEqual({ ok: false, code: 'not_found' })
    expect(await loadEditableUserCard(tables.cardId(999))).toEqual({
      ok: false,
      code: 'not_found',
    })
    expect(await loadUserCard(cardId)).toBeNull()
    expect(await listUserCards()).toEqual([])
  })

  it('will not let another signed-in user overwrite a card by submitting its id', async () => {
    const cardId = await saveFixture()
    const editable = await loadEditableUserCard(cardId)
    if (!editable.ok) throw new Error('expected an editable card')
    const before = tables.cards.find((row) => row.id === cardId)!.title

    tables.currentUserId = OTHER_USER
    const result = await saveUserCard(
      saveCardRequestSchema.parse({
        ...editable.builderInputs,
        cardId,
        expectedUpdatedAt: currentVersion(cardId),
        title: 'Taken over',
        status: 'draft',
      }),
    )

    expect(result.ok).toBe(false)
    expect(tables.cards).toHaveLength(1)
    expect(tables.cards[0].title).toBe(before)
    expect(tables.cards[0].user_id).toBe(OWNER)
  })

  it('requires a signed-in account to save at all', async () => {
    tables.currentUserId = null
    const result = await saveUserCard(ebusEditFixture())
    expect(result).toEqual({ ok: false, error: 'Sign in to save a preference card.' })
    expect(tables.cards).toHaveLength(0)
  })
})

describe('legacy cards', () => {
  /** A card written before module selection existed: no `selectedModuleVersionIds`. */
  async function seedLegacyCard(): Promise<string> {
    const cardId = await saveFixture()
    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = builderInputsSchema.parse(row.builder_inputs)
    const legacyInput: Record<string, unknown> = { ...inputs.input }
    delete legacyInput.selectedModuleVersionIds
    row.builder_inputs = {
      scenarioId: inputs.scenarioId,
      input: legacyInput,
      catalogPicks: inputs.catalogPicks,
      familyPicks: inputs.familyPicks,
      customItems: inputs.customItems,
      equipmentSets: inputs.equipmentSets,
    }
    return cardId
  }

  it('still loads, still verifies, and is not offered for editing', async () => {
    const cardId = await seedLegacyCard()
    const before = { ...tables.cards.find((row) => row.id === cardId)! }

    const record = await loadUserCard(cardId)
    expect(record).not.toBeNull()
    expect(record!.builderInputs).toBeNull()
    expect(record!.editable).toBe(false)
    expect(record!.card.snapshotHash).toBe(before.snapshot_hash)

    const listed = await listUserCards()
    expect(listed).toHaveLength(1)
    expect(listed[0].editable).toBe(false)

    const editable = await loadEditableUserCard(cardId)
    expect(editable).toEqual({ ok: false, code: 'legacy_builder_inputs' })
  })

  it('does not offer Edit on a card whose snapshot no longer verifies', async () => {
    const cardId = await saveFixture()
    const row = tables.cards.find((card) => card.id === cardId)!
    row.snapshot_hash = 'f'.repeat(64)

    // The card cannot be opened at all, so the dashboard must not link to its editor.
    expect(await loadUserCard(cardId)).toBeNull()
    const listed = await listUserCards()
    expect(listed).toHaveLength(1)
    expect(listed[0].editable).toBe(false)
    expect(await loadEditableUserCard(cardId)).toEqual({ ok: false, code: 'not_found' })
  })

  it('is not converted, recomputed, or rewritten by being viewed', async () => {
    const cardId = await seedLegacyCard()
    const before = JSON.stringify(tables.cards.find((row) => row.id === cardId))

    await loadUserCard(cardId)
    await loadEditableUserCard(cardId)
    await listUserCards()

    expect(JSON.stringify(tables.cards.find((row) => row.id === cardId))).toBe(before)
  })

  it('keeps rename, duplicate, sharing, and delete working', async () => {
    const cardId = await seedLegacyCard()
    const hash = tables.cards.find((row) => row.id === cardId)!.snapshot_hash

    const legacyVersion = tables.cards.find((row) => row.id === cardId)!.updated_at
    expect(await renameUserCard(cardId, 'Renamed legacy card', legacyVersion)).toEqual({
      ok: true,
      data: null,
    })
    expect(tables.cards.find((row) => row.id === cardId)!.snapshot_hash).toBe(hash)

    const copy = await duplicateUserCard(cardId, 'Copy of legacy card')
    expect(copy.ok).toBe(true)
    const copied = tables.cards.find((row) => row.id === copy.data)!
    // A copy of a legacy card is still legacy: duplicating does not make it editable.
    expect(copied.share_enabled).toBe(false)
    const copiedRecord = await loadUserCard(copy.data!)
    expect(copiedRecord!.editable).toBe(false)

    expect((await setShareEnabled(cardId, true)).ok).toBe(true)
    expect(tables.cards.find((row) => row.id === cardId)!.share_enabled).toBe(true)

    expect(await deleteUserCard(cardId)).toEqual({ ok: true, data: null })
    expect(tables.cards.some((row) => row.id === cardId)).toBe(false)
  })
})

describe('builder-input schema versioning', () => {
  it('normalizes an unversioned composed input to version 2, not to the current version', () => {
    const request = ebusEditFixture()
    const unversioned = {
      scenarioId: request.scenarioId,
      input: request.input,
      catalogPicks: request.catalogPicks,
      familyPicks: request.familyPicks,
      customItems: request.customItems,
      equipmentSets: request.equipmentSets,
    }

    // The absent version means "written before versions were recorded", which is version 2 —
    // it does not mean "whatever the current version happens to be". Normalizing it forward
    // would claim a release pin the card never had.
    const parsed = builderInputsSchema.safeParse(unversioned)
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.schemaVersion).toBe(2)
    expect(parsed.success && parsed.data.releaseBundleId).toBeUndefined()
  })

  it('refuses a format it does not know rather than coercing it', () => {
    const request = ebusEditFixture()
    const parsed = builderInputsSchema.safeParse({ ...request, schemaVersion: 5 })
    expect(parsed.success).toBe(false)
  })

  it('refuses a version-3 input that names no release bundle', () => {
    const request = ebusEditFixture()
    const withoutPin: Record<string, unknown> = { ...request, schemaVersion: 3 }
    delete withoutPin.releaseBundleId

    const parsed = builderInputsSchema.safeParse(withoutPin)
    expect(parsed.success).toBe(false)
  })

  it('refuses a version-2 input that names a release bundle it could not have had', () => {
    const request = ebusEditFixture()
    const parsed = builderInputsSchema.safeParse({
      ...request,
      schemaVersion: 2,
      releaseBundleId: request.releaseBundleId,
    })
    expect(parsed.success).toBe(false)
  })

  it('refuses a pre-composition input on its missing module selection alone', () => {
    const request = ebusEditFixture()
    const legacyInput: Record<string, unknown> = { ...request.input }
    delete legacyInput.selectedModuleVersionIds

    const parsed = builderInputsSchema.safeParse({
      schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
      releaseBundleId: request.releaseBundleId,
      scenarioId: request.scenarioId,
      input: legacyInput,
      catalogPicks: [],
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
    })
    expect(parsed.success).toBe(false)
  })
})

describe('role renames on a reopened card', () => {
  /**
   * Role aliases are permanent because a saved card stores role codes, and taxonomy v2
   * renamed eight of them. Picks were already canonicalized by `resolveCatalogPick` and
   * `getFamilyPick`; a custom line and a set's covered roles reach the resolver without
   * touching either, so they needed their own pass — otherwise a pre-rename card reopens
   * with the line silently missing.
   */
  it('canonicalizes a pre-rename role on a custom line so it still lands on its requirement', () => {
    const scenario = getScenarioDefinition('med-thoracoscopy')!
    const slot = getComposedRecipeSlots('med-thoracoscopy').find(
      (candidate) => candidate.roleCode === 'THORACOSCOPE_SEMIRIGID',
    )
    expect(slot).toBeDefined()

    const inputs = builderInputsSchema.parse({
      schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
      releaseBundleId: getCurrentReleaseBundleForScenario('med-thoracoscopy')!.id,
      scenarioId: 'med-thoracoscopy',
      input: {
        ...defaultBuildInput('med-thoracoscopy'),
        recipeVersionId: scenario.recipeVersionId,
        selectedHospitalItemIds: { [slot!.id]: customItemId('custom-pleuroscope') },
      },
      catalogPicks: [],
      familyPicks: [],
      customItems: [
        {
          id: 'custom-pleuroscope',
          // The pre-taxonomy-v2 code for THORACOSCOPE_SEMIRIGID.
          roleCode: 'PLEUROSCOPE',
          description: 'Ward-stocked semirigid pleuroscope',
          itemNumber: null,
          notes: null,
        },
      ],
      equipmentSets: [],
    })

    const resolved = resolveForSave(inputs, '2026-07-30T12:00:00.000Z')
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(
      resolved.card.items.find((item) => item.roleCode === 'THORACOSCOPE_SEMIRIGID')
        ?.selectedItemSnapshot?.localDescription,
    ).toBe('Ward-stocked semirigid pleuroscope')
  })
})

describe('equipment sets on a reopened card', () => {
  it('rebuilds the card’s own set and its selected role from stored identifiers', async () => {
    const pick = ebusProductPick()
    const request = saveCardRequestSchema.parse({
      ...ebusEditFixture(),
      input: {
        ...ebusEditFixture().input,
        selectedHospitalItemIds: {
          [slotIdForRole('EBUS_NEEDLE_FNA')]: equipmentSetItemId('set-ebus-tray'),
        },
      },
    })
    const saved = await saveUserCard(request)
    expect(saved.ok).toBe(true)

    const editable = await loadEditableUserCard(saved.data!)
    if (!editable.ok) throw new Error('expected an editable card')

    const [set] = editable.rebuilt.equipmentSets
    expect(set.id).toBe('set-ebus-tray')
    expect(set.members[0]).toMatchObject({ productId: pick.productId, roleCode: pick.roleCode })
    // The member arrives as a full catalog record, so it never depended on this browser.
    expect(set.members[0].productName).toBeTruthy()
    expect(editable.rebuilt.selectedRoleBySetId['set-ebus-tray']).toBe(pick.roleCode)
    expect(
      editable.record.card.items.find((item) => item.roleCode === pick.roleCode)
        ?.selectedHospitalItemId,
    ).toBe(equipmentSetItemId('set-ebus-tray'))
  })

  it('refuses two sets claiming one id, on both the save and the read path', () => {
    // A set is addressed by id everywhere it is used, and every lookup is a `.find()`. Two records
    // sharing an id therefore make "the set this requirement chose" a question with two answers,
    // and `.find()` silently returns whichever was written first — so a second record with a
    // missing member passed validation and failed at save, after the review.
    const fixture = ebusEditFixture()
    const duplicated = {
      ...fixture,
      equipmentSets: [
        fixture.equipmentSets[0],
        { ...fixture.equipmentSets[0], name: 'The same tray, said twice', members: [] },
      ],
    }

    const saveParsed = saveCardRequestSchema.safeParse(duplicated)
    expect(saveParsed.success).toBe(false)
    if (!saveParsed.success) {
      expect(saveParsed.error.issues[0]?.message).toMatch(/share the id set-ebus-tray/)
    }
    // And on the read path, so a card that reached storage before this rule cannot be re-resolved
    // into a new one either. It stays viewable and printable from its own snapshot.
    expect(builderInputsSchema.safeParse(duplicated).success).toBe(false)
  })
})

describe('modifier authorization', () => {
  /**
   * The picker only ever offered the modifiers a procedure lists, and the server used to take
   * the client's word for it: `resolveCard` looked a submitted code up in the whole merged
   * modifier set, so a crafted request naming a real modifier the procedure never offered was
   * applied and stored. Hiding a control is not authorization.
   */
  function unofferedButRealModifierCode(): string {
    const scenario = getScenarioDefinition(SCENARIO_ID)!
    const offered = new Set(scenario.availableModifierCodes)
    // A code that genuinely exists — the point is that it is real and simply not granted here.
    const code = buildDemoContextModifierCodes().find((candidate) => !offered.has(candidate))
    expect(code).toBeDefined()
    return code!
  }

  it('rejects a modifier the pinned release does not offer, even from a crafted request', () => {
    const code = unofferedButRealModifierCode()
    const request = ebusEditFixture()
    const crafted = saveCardRequestSchema.parse({
      ...request,
      input: { ...request.input, modifierCodes: [...request.input.modifierCodes, code] },
    })

    const result = resolveForSave(crafted, '2026-07-30T12:00:00.000Z')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('modifier_not_offered')
    expect(result.error).toContain(code)
  })

  it('builds the resolver context from only the modifiers the release granted', () => {
    const scenario = getScenarioDefinition(SCENARIO_ID)!
    const context = buildDemoContext(SCENARIO_ID)
    // Not "every modifier that exists, and we trust the caller to pick a legal one".
    expect(context.modifiers.map((modifier) => modifier.code).sort()).toEqual(
      [...scenario.availableModifierCodes].sort(),
    )
    expect(context.recipe.allowedModifierCodes).toEqual([...scenario.availableModifierCodes].sort())
  })

  it('still accepts every modifier the release does offer', () => {
    const request = ebusEditFixture()
    expect(resolveForSave(request, '2026-07-30T12:00:00.000Z').ok).toBe(true)
  })
})
