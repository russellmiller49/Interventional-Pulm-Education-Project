import { resolveCard } from '../domain/resolve-card'
import { stableStringify } from '../domain/stable-hash'
import type { BuilderInputs } from '../schemas/saved-card'
import { FakePreferenceCardTables } from '../__fixtures__/fake-preference-card-tables'
import {
  ALPHA_RELEASE_ID,
  BRAVO_RELEASE_ID,
  CHARLIE_RELEASE_ID,
  FIXTURE_MODULE_V1_0,
  FIXTURE_MODULE_V1_1,
  FIXTURE_PROCEDURE_CODE,
  FIXTURE_RECIPE_V1_0,
  FIXTURE_SCENARIO_ID,
  REVISED_REQUIREMENT_KEY,
} from '../__fixtures__/release-bundle-fixtures'
import {
  FIXTURE_PRIMARY_ITEM_ID,
  FIXTURE_SCOPE,
  createRebuildFixtureWorld,
  fixtureScenario,
} from '../__fixtures__/rebuild-world'

/**
 * The rebuild server path, end to end, against the two real tables and the synthetic release world.
 *
 * The fake tables mirror the migration clause for clause — row-level security, the append-a-revision
 * trigger, the strictly advancing content version, and now the write-once provenance column — so a
 * test here proves the *rules*, not that Postgres runs them. Postgres running them is what
 * `supabase/verification/20260804013000_verify_ip_preference_card_rebuild_provenance.sql` is for,
 * and that file has not been run yet because the migration has not been applied.
 *
 * The release data is mocked, and it has to be: production has exactly one release per procedure
 * and every card is already pinned to it, so no real card can cross from one release to another.
 * The mock serves the same three-release fixture world the pure tests use, and everything below it
 * — composition expansion, resolution, hashing, the save-path resolver — runs for real.
 */

const world = createRebuildFixtureWorld()

jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))

jest.mock('../data/release-bundles.server', () => {
  const actual = jest.requireActual(
    '../__fixtures__/rebuild-world',
  ) as typeof import('../__fixtures__/rebuild-world')
  const fixtures = jest.requireActual(
    '../__fixtures__/release-bundle-fixtures',
  ) as typeof import('../__fixtures__/release-bundle-fixtures')
  const built = actual.createRebuildFixtureWorld()
  return {
    getReleaseBundle: (id: string) => built.world.bundleById.get(id) ?? null,
    getRetainedReleaseBundles: () => built.world.bundles,
    getReleasePointers: () => built.world.pointers,
    getCurrentReleaseBundle: (procedureCode: string) =>
      procedureCode === fixtures.FIXTURE_PROCEDURE_CODE ? built.bravo : null,
    resolveReleaseDefinitions: (id: string) => {
      const bundle = built.world.bundleById.get(id)
      if (!bundle) return { ok: false, code: 'release_unknown', message: `unknown release ${id}` }
      return { ok: true, bundle, sources: built.world.loadSources(bundle) }
    },
    buildReleaseContext: (id: string) => {
      const bundle = built.world.bundleById.get(id)
      if (!bundle) return { ok: false, code: 'release_unknown', message: `unknown release ${id}` }
      return {
        ok: true,
        bundle,
        scenario: actual.fixtureScenario(bundle.recipeVersionId),
        context: built.contextFor(id),
      }
    },
  }
})

jest.mock('../data/historical-catalog.server', () => ({
  // The fixture cards select hospital-local items rather than catalogue products, so the retained
  // catalogue is present and empty: reachable, so the rebuild does not fail on it, and unused, so
  // it cannot quietly become the reason something carried.
  getHistoricalCatalog: () => ({ ok: true, productById: new Map(), roleByProductId: new Map() }),
  resolveHistoricalCatalogPick: () => ({
    ok: false,
    code: 'unknown_product',
    productId: '',
    roleCode: '',
  }),
  historicalFamilyPick: () => ({ ok: false, message: 'no fixture catalogue' }),
}))

const { prepareCardRebuild, createRebuiltCard } = jest.requireActual(
  '../server/rebuild-card',
) as typeof import('../server/rebuild-card')

const { supabaseServer } = jest.requireMock('@/lib/supabase/server') as {
  supabaseServer: jest.Mock
}

const OWNER = 'user-owner'
const OTHER_USER = 'user-other'
const tables = new FakePreferenceCardTables()

const PRIMARY_SLOT = 'SLOT-FIXTURE-PRIMARY'
const BACKUP_SLOT = 'SLOT-FIXTURE-BACKUP'

/** Builder inputs for a card pinned to ALPHA, with both requirements explicitly selected. */
function alphaInputs(): BuilderInputs {
  return {
    schemaVersion: 4,
    releaseBundleId: ALPHA_RELEASE_ID,
    scenarioId: FIXTURE_SCENARIO_ID,
    input: {
      ...FIXTURE_SCOPE,
      recipeVersionId: FIXTURE_RECIPE_V1_0,
      selectedModuleVersionIds: [FIXTURE_MODULE_V1_0],
      modifierCodes: [],
      variables: {},
      selectionsAreExplicit: true,
      selectedHospitalItemIds: {
        [PRIMARY_SLOT]: FIXTURE_PRIMARY_ITEM_ID,
        [BACKUP_SLOT]: FIXTURE_PRIMARY_ITEM_ID,
      },
    },
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
  } as BuilderInputs
}

/**
 * Seed a saved card pinned to ALPHA directly into the fake table.
 *
 * Written through the fake rather than through `saveUserCard`, because `saveUserCard` would resolve
 * against the mocked release world through its own import graph and the point here is to control
 * exactly what the *source revision* says. The revision the trigger appends is the real subject of
 * every test below.
 */
function seedAlphaCard(overrides: { inputs?: BuilderInputs; userId?: string } = {}) {
  const inputs = overrides.inputs ?? alphaInputs()
  const context = world.contextFor(ALPHA_RELEASE_ID)
  const card = resolveCard(
    { ...inputs.input, variables: { generated_at: '2026-01-01T00:00:00.000Z' } },
    context,
  )
  tables.cards.push({
    id: tables.cardId(900),
    user_id: overrides.userId ?? OWNER,
    title: 'Fixture card',
    physician_name: 'R. Miller',
    procedure_code: FIXTURE_PROCEDURE_CODE,
    scenario_id: FIXTURE_SCENARIO_ID,
    status: 'draft',
    builder_inputs: inputs,
    card_snapshot: card,
    snapshot_hash: card.snapshotHash,
    engine_version: card.engineVersion,
    catalog_import_id: card.catalogImportId,
    share_enabled: false,
    share_token: 'token-source',
    rebuild_provenance: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  })
  tables.revisions.push({
    id: '00000000-0000-4000-9000-000000000900',
    card_id: tables.cardId(900),
    user_id: overrides.userId ?? OWNER,
    revision_number: 1,
    title: 'Fixture card',
    physician_name: 'R. Miller',
    status: 'draft',
    procedure_code: FIXTURE_PROCEDURE_CODE,
    scenario_id: FIXTURE_SCENARIO_ID,
    builder_inputs: inputs,
    card_snapshot: card,
    snapshot_hash: card.snapshotHash,
    snapshot_integrity_hash: card.snapshotIntegrityHash,
    resolved_content_hash: card.resolvedContentHash,
    engine_version: card.engineVersion,
    release_bundle_id: ALPHA_RELEASE_ID,
    catalog_release_id: card.resolutionProvenance.catalogReleaseId,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: overrides.userId ?? OWNER,
  })
  return { cardId: tables.cardId(900), revisionId: '00000000-0000-4000-9000-000000000900' }
}

beforeEach(() => {
  tables.reset(OWNER)
  supabaseServer.mockResolvedValue(tables.client())
})

describe('a rebuild binds to one exact revision the caller owns', () => {
  it('prepares a plan from the pinned release onto the pointed-at one', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)

    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.preparation.sourceReleaseBundle.id).toBe(ALPHA_RELEASE_ID)
    // BRAVO, not CHARLIE — which is the highest version, the newest publication, and the last
    // entry in the array, and is not what the pointer says.
    expect(prepared.preparation.targetReleaseBundle.id).toBe(BRAVO_RELEASE_ID)
    expect(prepared.preparation.targetReleaseBundle.id).not.toBe(CHARLIE_RELEASE_ID)
  })

  it('is not found for a revision belonging to somebody else', async () => {
    const { cardId, revisionId } = seedAlphaCard({ userId: OTHER_USER })
    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared).toEqual({ ok: false, code: 'not_found' })
  })

  it('is not found for a revision that belongs to a different card', async () => {
    const { revisionId } = seedAlphaCard()
    const prepared = await prepareCardRebuild(tables.cardId(1), revisionId)
    expect(prepared).toEqual({ ok: false, code: 'not_found' })
  })

  it('refuses a revision written before releases pinned the rule set', async () => {
    const legacy = { ...alphaInputs(), schemaVersion: 2 } as BuilderInputs
    delete (legacy as { releaseBundleId?: string }).releaseBundleId
    const { cardId, revisionId } = seedAlphaCard()
    const revision = tables.revisions.find((row) => row.id === revisionId)!
    revision.builder_inputs = legacy

    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared.ok).toBe(false)
    expect(prepared.ok === false && prepared.code).toBe('superseded_builder_inputs')
  })

  it('refuses a revision whose product line is named by a catalogue-browsing key', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const revision = tables.revisions.find((row) => row.id === revisionId)!
    revision.builder_inputs = {
      ...alphaInputs(),
      schemaVersion: 3,
      familyPicks: [{ familyKey: 'MFR-X|surgical chest tube|candidate', roleCode: 'FIXTURE_ROLE' }],
    }

    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared.ok === false && prepared.code).toBe('legacy_family_identity')
  })

  it('refuses when the revision is already pinned to the release the pointer names', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const revision = tables.revisions.find((row) => row.id === revisionId)!
    revision.builder_inputs = { ...alphaInputs(), releaseBundleId: BRAVO_RELEASE_ID }

    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared.ok === false && prepared.code).toBe('already_on_current_release')
  })
})

describe('preparing a rebuild writes nothing', () => {
  it('leaves both tables byte-identical', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    // Non-vacuity: the log has to be live, or "nothing was written" means nothing.
    tables.writes.push({ table: 'ip_user_preference_cards', operation: 'insert' })
    const writesBefore = tables.writes.length
    const cardsBefore = stableStringify(tables.cards)
    const revisionsBefore = stableStringify(tables.revisions)

    await prepareCardRebuild(cardId, revisionId)

    expect(tables.writes).toHaveLength(writesBefore)
    expect(stableStringify(tables.cards)).toBe(cardsBefore)
    expect(stableStringify(tables.revisions)).toBe(revisionsBefore)
  })
})

/** Answer every decision the plan requires, so only the behaviour under test is being measured. */
async function answerEverything(cardId: string, revisionId: string) {
  const prepared = await prepareCardRebuild(cardId, revisionId)
  if (!prepared.ok) throw new Error(`preparation failed: ${prepared.code}`)
  const acknowledgements: Record<string, 'confirmed' | 'dropped' | 'acknowledged_unresolved'> = {}
  for (const decision of prepared.preparation.plan.decisions) {
    if (!decision.requiresExplicitConfirmation) continue
    acknowledgements[decision.key] =
      decision.state === 'carried_requires_review' ? 'confirmed' : 'acknowledged_unresolved'
  }
  return { prepared: prepared.preparation, acknowledgements }
}

describe('creating the new card', () => {
  it('creates a separate draft and leaves the source exactly as it was', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const sourceCardBefore = stableStringify(tables.cards.find((row) => row.id === cardId))
    const sourceRevisionsBefore = stableStringify(
      tables.revisions.filter((row) => row.card_id === cardId),
    )

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
      physicianName: 'R. Miller',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.cardId).not.toBe(cardId)

    // The source is untouched — the card row, its snapshot, its hashes, its share token, and every
    // revision it already had.
    expect(stableStringify(tables.cards.find((row) => row.id === cardId))).toBe(sourceCardBefore)
    expect(stableStringify(tables.revisions.filter((row) => row.card_id === cardId))).toBe(
      sourceRevisionsBefore,
    )

    const created = tables.cards.find((row) => row.id === result.cardId)!
    expect(created.status).toBe('draft')
    expect(created.share_enabled).toBe(false)
    expect(created.share_token).not.toBe('token-source')
    // The trigger wrote revision 1 for it, and only for it.
    const createdRevisions = tables.revisions.filter((row) => row.card_id === result.cardId)
    expect(createdRevisions.map((row) => row.revision_number)).toEqual([1])
  })

  it('pins the new card to the target release at schema version 4', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })
    if (!result.ok) throw new Error(result.message)

    const created = tables.cards.find((row) => row.id === result.cardId)!
    const inputs = created.builder_inputs as BuilderInputs
    expect(inputs.releaseBundleId).toBe(BRAVO_RELEASE_ID)
    expect(inputs.schemaVersion).toBe(4)
    expect(inputs.input.selectedModuleVersionIds).toEqual([FIXTURE_MODULE_V1_1])
    // Re-keyed onto the target composition and written down explicitly.
    expect(inputs.input.selectionsAreExplicit).toBe(true)
    expect(inputs.input.selectedHospitalItemIds?.[PRIMARY_SLOT]).toBe(FIXTURE_PRIMARY_ITEM_ID)
  })

  it('records exact provenance pointing back at the revision it was built from', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })
    if (!result.ok) throw new Error(result.message)

    const created = tables.cards.find((row) => row.id === result.cardId)!
    const provenance = created.rebuild_provenance as Record<string, unknown>
    expect(provenance).toMatchObject({
      version: 'ip-cards-rebuild/1',
      sourceCardId: cardId,
      sourceRevisionId: revisionId,
      sourceRevisionNumber: 1,
      sourceReleaseBundleId: ALPHA_RELEASE_ID,
      targetReleaseBundleId: BRAVO_RELEASE_ID,
      mappingPlanHash: prepared.planHash,
    })
    // One entry per decision, each carrying the answer it actually got.
    const decisions = provenance.decisions as Array<{ key: string; acknowledgement: string | null }>
    expect(decisions).toHaveLength(prepared.plan.decisions.length)
    expect(
      decisions.find((entry) => entry.key === `requirement:${REVISED_REQUIREMENT_KEY}`),
    ).toEqual(expect.objectContaining({ acknowledgement: 'confirmed' }))
  })

  it('does not mark the source card superseded or touch its sharing', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const source = tables.cards.find((row) => row.id === cardId)!
    source.share_enabled = true
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)

    await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(tables.cards.find((row) => row.id === cardId)!.share_enabled).toBe(true)
    expect(tables.cards.find((row) => row.id === cardId)!.status).toBe('draft')
  })
})

describe('the review gate is enforced on the server', () => {
  it('refuses a submission that leaves a decision unanswered', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared } = await answerEverything(cardId, revisionId)
    const cardsBefore = tables.cards.length

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements: {},
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('review_incomplete')
    expect(result.ok === false && result.missing).toContain(
      `requirement:${REVISED_REQUIREMENT_KEY}`,
    )
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('refuses a plan hash that does not match the plan the server recomputes', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const cardsBefore = tables.cards.length

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: '0'.repeat(64),
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('plan_moved')
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('refuses an answer naming a decision the recomputed plan does not contain', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements: { ...acknowledgements, 'requirement:INVENTED_BY_THE_CLIENT': 'confirmed' },
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('review_incomplete')
    expect(result.ok === false && result.missing).toContain('requirement:INVENTED_BY_THE_CLIENT')
  })

  it('refuses a composition the target release does not offer', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: { moduleVersionIds: ['module-nobody-published'], modifierCodes: [] },
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('module_not_offered')
  })

  it('refuses a modifier the target release does not offer', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: { ...prepared.selection, modifierCodes: ['MODIFIER_NOBODY_OFFERS'] },
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('modifier_not_offered')
  })
})

describe('rebuild provenance is write-once', () => {
  it('cannot be edited after the card exists', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })
    if (!result.ok) throw new Error(result.message)

    const supabase = tables.client()
    // `.eq()` on the fake resolves immediately for a delete, so the chain's type is a union; the
    // update path is the builder half of it.
    const rewrite = supabase
      .from('ip_user_preference_cards')
      .update({ rebuild_provenance: { version: 'forged' } })
      .eq('id', result.cardId) as { maybeSingle: () => Promise<unknown> }
    expect(() => rewrite.maybeSingle()).toThrow(/write-once/)
    // And the value that is there is still the one the rebuild recorded.
    expect(
      (
        tables.cards.find((row) => row.id === result.cardId)!.rebuild_provenance as {
          version: string
        }
      ).version,
    ).toBe('ip-cards-rebuild/1')
  })

  it('is not something a card that was never rebuilt can be given', async () => {
    const { cardId } = seedAlphaCard()
    const supabase = tables.client()
    const rewrite = supabase
      .from('ip_user_preference_cards')
      .update({ rebuild_provenance: { version: 'ip-cards-rebuild/1' } })
      .eq('id', cardId) as { maybeSingle: () => Promise<unknown> }
    expect(() => rewrite.maybeSingle()).toThrow(/write-once/)
    expect(tables.cards.find((row) => row.id === cardId)!.rebuild_provenance).toBeNull()
  })

  it('does not travel to a duplicate, which is a copy rather than a rebuild', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })
    if (!result.ok) throw new Error(result.message)

    const { duplicateUserCard } = jest.requireActual(
      '../server/user-cards',
    ) as typeof import('../server/user-cards')
    const duplicated = await duplicateUserCard(result.cardId, 'A copy of the rebuilt card')
    expect(duplicated.ok).toBe(true)

    // `duplicateUserCard` selects the columns it copies by name, and provenance is not one of
    // them. A duplicate did not come from a reviewed rebuild and must not claim to have.
    const copy = tables.cards.find((row) => row.id === duplicated.data)!
    expect(copy.rebuild_provenance).toBeNull()
  })
})

describe('the fixture world is the one the pointer describes', () => {
  it('does not treat the highest-numbered published release as current', () => {
    expect(world.world.pointers[FIXTURE_PROCEDURE_CODE]).toBe(BRAVO_RELEASE_ID)
    expect(world.world.bundleById.get(CHARLIE_RELEASE_ID)?.releaseState).toBe('published')
  })

  it('still resolves the retired release a card is pinned to', () => {
    expect(world.alpha.releaseState).toBe('retired')
    expect(world.contextFor(ALPHA_RELEASE_ID).recipe.id).toBe(FIXTURE_RECIPE_V1_0)
  })

  it('gives the fixture scenario the recipe version its release pins', () => {
    expect(fixtureScenario(FIXTURE_RECIPE_V1_0).recipeVersionId).toBe(FIXTURE_RECIPE_V1_0)
  })
})
