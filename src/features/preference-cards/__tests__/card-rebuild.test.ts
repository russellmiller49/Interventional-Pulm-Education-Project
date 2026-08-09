import { allowedAcknowledgements, allowedFinalStateHash } from '../domain/card-rebuild-plan'
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
  FIXTURE_DUPLICATE_CONFLICTING_MODIFIER,
  FIXTURE_DUPLICATE_IDENTICAL_MODIFIER,
  FIXTURE_DUPLICATE_RESCUE_MODIFIER,
  FIXTURE_PRIMARY_ITEM_ID,
  FIXTURE_RESCUE_MODIFIER_CODE,
  FIXTURE_RESCUE_REQUIREMENT_KEY,
  FIXTURE_RESCUE_SLOT_ID,
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
 * `supabase/verification/20260804013000_verify_ip_preference_card_rebuild_provenance.sql` is for.
 * That file has been run twice as a rollback rehearsal — the migration executed in full both times —
 * but it has never passed: both runs stopped inside Part 1, so nothing below Part 1 has been
 * observed against a real server.
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

// The privileged writer is replaced by the fake's own model of the RPC, so the trusted path is
// exercised through the same recheck-then-insert the migration performs rather than stubbed out.
jest.mock('../server/rebuild-writer.server', () => ({
  writeRebuiltCard: jest.fn(),
}))

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

const { writeRebuiltCard } = jest.requireMock('../server/rebuild-writer.server') as {
  writeRebuiltCard: jest.Mock
}

// Uuid-shaped, because `auth.users.id` is one and version-1 provenance names the owner as a uuid.
const OWNER = '00000000-0000-4000-a000-000000000001'
const OTHER_USER = '00000000-0000-4000-a000-000000000002'
/** A real uuid that names nothing in the fixture. Used to make a document lie plausibly. */
const OTHER_CARD_UUID = '00000000-0000-4000-8000-000000000999'
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
  writeRebuiltCard.mockImplementation(
    async (write: Parameters<typeof tables.createRebuiltCard>[0]) => {
      const result = tables.createRebuiltCard(write)
      if (result.ok) return { ok: true, cardId: result.cardId }
      // The real RPC raises `no_data_found` for a source that moved and
      // `invalid_parameter_value` for a document that does not describe it; the writer maps the
      // first to `source_moved` and everything else to `write_failed`.
      if (result.code !== 'source_moved') {
        return { ok: false, code: 'write_failed', message: `provenance rejected: ${result.code}` }
      }
      return {
        ok: false,
        code: 'source_moved',
        message:
          'The card this rebuild was taken from has changed or been deleted, so nothing was created.',
      }
    },
  )
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
    // Whatever the decision actually allows, rather than a second opinion derived from its state.
    // Keying on `carried_requires_review === 'confirmed'` made every changed line answerable as a
    // confirmation, including a carried deliberate blank, which has no product to confirm.
    acknowledgements[decision.key] = allowedAcknowledgements(decision)[0]
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
    ).toEqual(
      expect.objectContaining({
        acknowledgement: allowedAcknowledgements(
          prepared.plan.decisions.find(
            (entry) => entry.key === `requirement:${REVISED_REQUIREMENT_KEY}`,
          )!,
        )[0],
      }),
    )
    // And the permission those answers selected, recomputed here from the plan and the recorded
    // answers alone — which is exactly what a later reader can do, and could not before the hash
    // existed.
    expect(provenance.allowedFinalStateHash).toBe(
      allowedFinalStateHash(prepared.plan, acknowledgements),
    )
    // The owner claim the document could not previously make at all.
    expect(provenance.sourceOwnerId).toBe(OWNER)
  })

  it('records a dropped answer as dropped, with the line cleared on the card', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    // The one changed requirement that carries a real product, answered by discarding it.
    const droppable = prepared.preparation.plan.decisions.find((entry) =>
      allowedAcknowledgements(entry).includes('dropped'),
    )
    expect(droppable).toBeDefined()
    const acknowledgements: Record<string, 'confirmed' | 'dropped' | 'acknowledged_unresolved'> = {}
    for (const entry of prepared.preparation.plan.decisions) {
      if (!entry.requiresExplicitConfirmation) continue
      acknowledgements[entry.key] =
        entry.key === droppable!.key ? 'dropped' : allowedAcknowledgements(entry)[0]
    }

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.preparation.selection,
      planHash: prepared.preparation.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })
    if (!result.ok) throw new Error(result.message)

    const created = tables.cards.find((row) => row.id === result.cardId)!
    const provenance = created.rebuild_provenance as {
      decisions: Array<{ key: string; acknowledgement: string | null }>
    }
    expect(provenance.decisions.find((entry) => entry.key === droppable!.key)).toEqual(
      expect.objectContaining({ acknowledgement: 'dropped' }),
    )
    const slotId = droppable!.kind === 'requirement' ? droppable!.target?.slotId : undefined
    const inputs = created.builder_inputs as BuilderInputs
    expect(inputs.input.selectedHospitalItemIds?.[slotId as string]).toBeNull()
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

    // On submit this is a target that moved under an open review, not a malformed request: the
    // only composition a client sends back is the one the server proposed. Reported as
    // `plan_moved` so the page can say so, instead of refusing with a code it renders nothing for.
    expect(result.ok === false && result.code).toBe('plan_moved')
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

    expect(result.ok === false && result.code).toBe('plan_moved')
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

describe('a requirement a modifier adds is not mistaken for one the release removed', () => {
  /** A card that selects the rescue-adding modifier, so the rescue requirement is on its snapshot. */
  function seedRescueCard() {
    const base = alphaInputs()
    return seedAlphaCard({
      inputs: {
        ...base,
        input: {
          ...base.input,
          modifierCodes: [FIXTURE_RESCUE_MODIFIER_CODE],
          selectedHospitalItemIds: {
            ...base.input.selectedHospitalItemIds,
            [FIXTURE_RESCUE_SLOT_ID]: FIXTURE_PRIMARY_ITEM_ID,
          },
        },
      } as BuilderInputs,
    })
  }

  it('puts the rescue requirement on the source snapshot in the first place', () => {
    const { cardId } = seedRescueCard()
    const card = tables.cards.find((row) => row.id === cardId)!.card_snapshot as {
      items: Array<{ requirementKey?: string }>
    }
    expect(card.items.map((entry) => entry.requirementKey)).toContain(
      FIXTURE_RESCUE_REQUIREMENT_KEY,
    )
  })

  it('carries it instead of reporting it removed by the target release', async () => {
    const { cardId, revisionId } = seedRescueCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const rescue = prepared.preparation.plan.decisions.find(
      (entry) => entry.key === `requirement:${FIXTURE_RESCUE_REQUIREMENT_KEY}`,
    )
    expect(rescue).toBeDefined()
    // A rescue module's requirements reach a resolved card without ever appearing in
    // `expandRecipeComposition`. Before the effective-slot fix each was reported removed and its
    // selection dropped, while the modifier that adds them carried forward untouched — so the new
    // card asked for a line the review had just said was gone.
    expect(rescue!.state).not.toBe('removed_requirement')
    expect(rescue!.reasonCodes).not.toContain('requirement_removed_by_target')
    expect(prepared.preparation.plan.proposedInputs.input.selectedHospitalItemIds).toEqual(
      expect.objectContaining({ [FIXTURE_RESCUE_SLOT_ID]: FIXTURE_PRIMARY_ITEM_ID }),
    )
  })

  it('keeps the selection on the created card', async () => {
    const { cardId, revisionId } = seedRescueCard()
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
    expect(inputs.input.modifierCodes).toContain(FIXTURE_RESCUE_MODIFIER_CODE)
    expect(inputs.input.selectedHospitalItemIds?.[FIXTURE_RESCUE_SLOT_ID]).toBe(
      FIXTURE_PRIMARY_ITEM_ID,
    )
  })
})

describe('an answer that had no effect cannot appear in the record as though it did', () => {
  it('rejects an out-of-vocabulary answer on a decision that required none', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const quiet = prepared.plan.decisions.filter(
      (decision) => !decision.requiresExplicitConfirmation,
    )
    // Non-vacuity: there has to be a decision that asks nothing for this to test anything.
    expect(quiet.length).toBeGreaterThan(0)

    const cardsBefore = tables.cards.length
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      // `dropped` on a `carried_unchanged` requirement changes nothing —
      // `applyRebuildAcknowledgements` only drops what required confirmation — and was still
      // written verbatim into provenance, recording a decision to discard a selection the card in
      // fact carries. Provenance is evidence; an answer with no effect must not appear in it.
      acknowledgements: Object.fromEntries([
        ...Object.entries(acknowledgements),
        ...quiet.map((decision) => [decision.key, 'dropped' as const]),
      ]),
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('review_incomplete')
    expect(result.ok === false && result.missing).toEqual(
      expect.arrayContaining(quiet.map((decision) => decision.key)),
    )
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it.each(['confirmed', 'dropped', 'acknowledged_unresolved'] as const)(
    'rejects a forged %s on a decision that required no answer',
    async (answer) => {
      const { cardId, revisionId } = seedAlphaCard()
      const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
      const quiet = prepared.plan.decisions.filter(
        (decision) => !decision.requiresExplicitConfirmation,
      )
      expect(quiet.length).toBeGreaterThan(0)
      const cardsBefore = tables.cards.length

      const result = await createRebuiltCard({
        cardId,
        revisionId,
        selection: prepared.selection,
        planHash: prepared.planHash,
        acknowledgements: Object.fromEntries([
          ...Object.entries(acknowledgements),
          ...quiet.map((decision) => [decision.key, answer]),
        ]),
        title: 'Fixture card (rebuilt)',
      })

      expect(result.ok === false && result.code).toBe('review_incomplete')
      expect(tables.cards).toHaveLength(cardsBefore)
    },
  )

  it('records null for every quiet decision on a valid submission', async () => {
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

    const provenance = tables.cards.find((row) => row.id === result.cardId)!.rebuild_provenance as {
      decisions: Array<{ key: string; acknowledgement: string | null }>
    }
    const quietKeys = new Set(
      prepared.plan.decisions
        .filter((decision) => !decision.requiresExplicitConfirmation)
        .map((decision) => decision.key),
    )
    expect(quietKeys.size).toBeGreaterThan(0)
    for (const entry of provenance.decisions) {
      if (!quietKeys.has(entry.key)) continue
      expect(entry.acknowledgement).toBeNull()
    }
  })
})

describe('a target that moves under an open review is reported, not silently discarded', () => {
  it('still names the composition problem precisely when the review page is being built', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    // The GET path keeps the typed code: there, an un-offered module really is a malformed request
    // rather than a release that moved, and the route renders an explanation for it.
    const prepared = await prepareCardRebuild(cardId, revisionId, {
      moduleVersionIds: ['module-fixture-core-v9-9'],
      modifierCodes: [],
    })
    expect(prepared.ok === false && prepared.code).toBe('module_not_offered')

    const modifier = await prepareCardRebuild(cardId, revisionId, {
      moduleVersionIds: [FIXTURE_MODULE_V1_1],
      modifierCodes: ['MODIFIER_NOBODY_OFFERS'],
    })
    expect(modifier.ok === false && modifier.code).toBe('modifier_not_offered')
  })

  it('reports a composition the target no longer offers as a moved plan', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const cardsBefore = tables.cards.length

    // Exactly the shape a pointer advance takes: the page's hidden module id is one the target no
    // longer pins, because republishing a module renumbers its version id.
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: { ...prepared.selection, moduleVersionIds: ['module-fixture-core-v9-9'] },
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('plan_moved')
    expect(result.ok === false && result.message).toMatch(/Reload to review the current plan/i)
    expect(tables.cards).toHaveLength(cardsBefore)
  })
})

describe('an unresolved required requirement stays unresolved on the new card', () => {
  /**
   * A card whose required backup line resolved to nothing.
   *
   * The stored input names an item the formulary does not have, so the *snapshot* — which is what
   * the plan reads, because it is what the physician actually saw — records no selection for that
   * line. The rebuild carries the blank forward as a blank, which is the whole point: it is a
   * decision, not a gap nobody has looked at.
   */
  function seedUnresolvedRequiredCard() {
    const base = alphaInputs()
    return seedAlphaCard({
      inputs: {
        ...base,
        input: {
          ...base.input,
          selectedHospitalItemIds: {
            ...base.input.selectedHospitalItemIds,
            [BACKUP_SLOT]: 'fixture-item-retired-from-the-formulary',
          },
        },
      } as BuilderInputs,
    })
  }

  it('carries the blank as a blank, and asks about it because the requirement changed', async () => {
    const { cardId, revisionId } = seedUnresolvedRequiredCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    const backup = prepared.preparation.plan.decisions.find(
      (entry) => entry.key === `requirement:${REVISED_REQUIREMENT_KEY}`,
    )!
    expect(backup.reasonCodes).toContain('selection_deliberately_empty')
    // BRAVO makes this requirement required where ALPHA had it optional, so the physician is asked
    // — the line they left empty is not the line they left empty any more.
    expect(backup.state).toBe('carried_requires_review')
    expect(backup.kind === 'requirement' && backup.carriedSelection).toEqual({ kind: 'none' })
  })

  it('creates a draft that reports the gap rather than resolving it', async () => {
    const { cardId, revisionId } = seedUnresolvedRequiredCard()
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
    const snapshotOut = created.card_snapshot as {
      readinessState: string
      warnings: Array<{ code: string }>
      items: Array<{
        requirementKey?: string
        resolutionState: string
        selectedHospitalItemId: string | null
      }>
    }

    // Acknowledgement is not resolution. Confirming the decision recorded that the physician read
    // it; it chose no product, because the rebuild has no picker and does not pretend to.
    const line = snapshotOut.items.find(
      (entry) => entry.requirementKey === REVISED_REQUIREMENT_KEY,
    )!
    expect(line.selectedHospitalItemId).toBeNull()
    expect(line.resolutionState).not.toBe('resolved')
    expect(snapshotOut.warnings.map((warning) => warning.code)).toContain(
      'required_role_unresolved',
    )

    // The documented limitation, pinned so it cannot drift silently: `resolve-card.ts` deliberately
    // raises a *warning* rather than a blocking message for a required role with nothing chosen,
    // because many roles have no catalogued product and are met by a custom line. So the card is
    // `complete_with_warnings`, not `blocked`. What matters here is that it is never `complete`.
    expect(snapshotOut.readinessState).toBe('complete_with_warnings')
    expect(snapshotOut.readinessState).not.toBe('complete')
    expect(created.status).toBe('draft')
  })

  it('leaves the card reopenable, so the builder is where the gap gets filled', async () => {
    const { cardId, revisionId } = seedUnresolvedRequiredCard()
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

    const inputs = tables.cards.find((row) => row.id === result.cardId)!
      .builder_inputs as BuilderInputs
    // Version 4, release-pinned, no legacy family key: everything `inputsCanBackAnEdit` requires,
    // so the Edit control is offered and the canonical builder is the next step.
    expect(inputs.schemaVersion).toBe(4)
    expect(inputs.releaseBundleId).toBe(BRAVO_RELEASE_ID)
    expect(inputs.familyPicks).toEqual([])
  })
})

describe('duplicate requirement keys survive the integration path to the blocker', () => {
  function seedWithModifier(modifierCode: string) {
    const base = alphaInputs()
    return seedAlphaCard({
      inputs: {
        ...base,
        input: { ...base.input, modifierCodes: [modifierCode] },
      } as BuilderInputs,
    })
  }

  it('blocks when a modifier adds a conflicting second expression of a key', async () => {
    const { cardId, revisionId } = seedWithModifier(FIXTURE_DUPLICATE_CONFLICTING_MODIFIER)
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    const primary = prepared.preparation.plan.decisions.find(
      (entry) => entry.key === 'requirement:FIXTURE_PRIMARY_SCOPE',
    )!
    // The server used to collapse this before the planner ever saw it, so the plan described one
    // requirement and the resolver built two.
    expect(primary.state).toBe('incompatible')
    expect(primary.reasonCodes).toContain('requirement_key_ambiguous')
    expect(primary.blocking).toBe(true)
  })

  it('refuses to create the card, with no answer able to dispose of it', async () => {
    const { cardId, revisionId } = seedWithModifier(FIXTURE_DUPLICATE_CONFLICTING_MODIFIER)
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const cardsBefore = tables.cards.length

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('plan_blocked')
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('blocks a rescue module that duplicates a base requirement key', async () => {
    // The other route into the same ambiguity. A rescue module's slots are expanded in a later step
    // than a modifier's `add_slot`, so covering one path does not cover this one — which is the
    // reason the planner and the resolver had to end up sharing `expandEffectiveSlots` rather than
    // each keeping its own idea of what a composition expands to.
    const { cardId, revisionId } = seedWithModifier(FIXTURE_DUPLICATE_RESCUE_MODIFIER)
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    const primary = prepared.preparation.plan.decisions.find(
      (entry) => entry.key === 'requirement:FIXTURE_PRIMARY_SCOPE',
    )!
    expect(primary.state).toBe('incompatible')
    expect(primary.reasonCodes).toContain('requirement_key_ambiguous')
    expect(primary.blocking).toBe(true)

    const { acknowledgements } = await answerEverything(cardId, revisionId)
    const cardsBefore = tables.cards.length
    const revisionsBefore = tables.revisions.length
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.preparation.selection,
      planHash: prepared.preparation.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })
    expect(result.ok === false && result.code).toBe('plan_blocked')
    expect(tables.cards).toHaveLength(cardsBefore)
    expect(tables.revisions).toHaveLength(revisionsBefore)
  })

  it('blocks an identical duplicate too, because the resolver emits both slots', async () => {
    const { cardId, revisionId } = seedWithModifier(FIXTURE_DUPLICATE_IDENTICAL_MODIFIER)
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    const primary = prepared.preparation.plan.decisions.find(
      (entry) => entry.key === 'requirement:FIXTURE_PRIMARY_SCOPE',
    )!
    expect(primary.state).toBe('incompatible')
    expect(primary.reasonCodes).toContain('requirement_key_ambiguous')
  })
})

describe('provenance can only be written by the trusted rebuild writer', () => {
  /** A payload an ordinary card insert would carry, plus a forged provenance object. */
  function forgedInsert() {
    return {
      user_id: OWNER,
      title: 'Forged',
      physician_name: null,
      procedure_code: FIXTURE_PROCEDURE_CODE,
      scenario_id: FIXTURE_SCENARIO_ID,
      status: 'draft' as const,
      builder_inputs: {},
      card_snapshot: { resolutionProvenance: {} },
      snapshot_hash: 'f'.repeat(64),
      engine_version: 'forged',
      catalog_import_id: 'forged',
      rebuild_provenance: { version: 'ip-cards-rebuild/1', sourceCardId: 'invented' },
    }
  }

  it('refuses a forged provenance insert from an authenticated caller', () => {
    // BLOCKER 1. `authenticated` holds INSERT on this table and the old policy checked only
    // ownership, so this exact statement used to succeed — and the write-once update trigger then
    // froze the forgery into something indistinguishable from reviewed evidence.
    tables.role = 'authenticated'
    const cardsBefore = tables.cards.length
    expect(() =>
      tables
        .client()
        .from('ip_user_preference_cards')
        .insert(forgedInsert())
        .select('id')
        .maybeSingle(),
    ).toThrow(/may only be written by public\.ip_create_rebuilt_preference_card/)
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('refuses a forged provenance insert from the service role', () => {
    // `service_role` has bypassrls, so no policy can stop it. The before-insert trigger can, and
    // does: holding the key is not evidence that a review happened.
    tables.role = 'service_role'
    const cardsBefore = tables.cards.length
    expect(() =>
      tables
        .client()
        .from('ip_user_preference_cards')
        .insert(forgedInsert())
        .select('id')
        .maybeSingle(),
    ).toThrow(/may only be written by public\.ip_create_rebuilt_preference_card/)
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('still lets an ordinary authenticated card insert through', async () => {
    tables.role = 'authenticated'
    const ordinary = { ...forgedInsert() }
    delete (ordinary as { rebuild_provenance?: unknown }).rebuild_provenance
    const result = await tables
      .client()
      .from('ip_user_preference_cards')
      .insert(ordinary)
      .select('id')
      .maybeSingle()
    expect(result.data).not.toBeNull()
    expect(tables.cards.at(-1)!.rebuild_provenance).toBeNull()
  })

  it('creates the card through the trusted writer, and only there', async () => {
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

    expect(writeRebuiltCard).toHaveBeenCalledTimes(1)
    const created = tables.cards.find((row) => row.id === result.cardId)!
    expect(created.rebuild_provenance).not.toBeNull()
    expect(created.status).toBe('draft')
    expect(created.share_enabled).toBe(false)
    expect(created.share_token).not.toBe('token-source')
    expect(tables.revisions.filter((row) => row.card_id === result.cardId)).toHaveLength(1)
  })
})

describe('the source is re-derived at write time, not trusted from the review', () => {
  it('creates nothing when the source revision was deleted after the review', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)

    // The race the RPC closes: validated, then deleted, then submitted.
    tables.cards = tables.cards.filter((row) => row.id !== cardId)
    tables.revisions = tables.revisions.filter((row) => row.card_id !== cardId)
    const cardsBefore = tables.cards.length

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok).toBe(false)
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  /** The complete version-1 document, agreeing with the seeded revision. Cases mutate one fact. */
  function writeFor(cardId: string, revisionId: string, overrides: Record<string, unknown> = {}) {
    const revision = tables.revisions.find((row) => row.id === revisionId)!
    const base = {
      ownerId: OWNER,
      sourceCardId: cardId,
      sourceRevisionId: revisionId,
      sourceSnapshotHash: revision.snapshot_hash,
      sourceReleaseBundleId: revision.release_bundle_id,
      title: 'Fixture card (rebuilt)',
      physicianName: null,
      procedureCode: FIXTURE_PROCEDURE_CODE,
      scenarioId: FIXTURE_SCENARIO_ID,
      builderInputs: {},
      cardSnapshot: {},
      snapshotHash: 'a'.repeat(64),
      engineVersion: 'fixture',
      catalogImportId: 'fixture',
      ...overrides,
    }
    return {
      ...base,
      rebuildProvenance: {
        version: 'ip-cards-rebuild/1',
        sourceCardId: base.sourceCardId,
        sourceRevisionId: base.sourceRevisionId,
        sourceOwnerId: base.ownerId,
        sourceRevisionNumber: revision.revision_number,
        sourceReleaseBundleId: base.sourceReleaseBundleId,
        sourceReleaseDefinitionHash: 'b'.repeat(64),
        sourceSnapshotHash: base.sourceSnapshotHash,
        sourceSnapshotIntegrityHash: revision.snapshot_integrity_hash ?? null,
        sourceResolvedContentHash: revision.resolved_content_hash ?? null,
        sourcePrintDocumentHash: null,
        targetReleaseBundleId: BRAVO_RELEASE_ID,
        targetReleaseDefinitionHash: 'c'.repeat(64),
        targetCatalogReleaseId: 'fixture-catalog',
        operationalReconciliationHash: 'd'.repeat(64),
        authoredReleaseDiffHash: 'e'.repeat(64),
        mappingPlanHash: 'f'.repeat(64),
        allowedFinalStateHash: '0'.repeat(64),
        decisions: [],
        createdAt: '2026-02-01T00:00:00.000Z',
        ...((overrides.rebuildProvenance as Record<string, unknown>) ?? {}),
      },
    }
  }

  it('creates nothing when the payload disagrees with the stored revision', () => {
    const { cardId, revisionId } = seedAlphaCard()
    const cardsBefore = tables.cards.length

    // Driven at the writer directly, because that is the only place this can be observed: the
    // application re-reads the revision immediately before writing, so a change to the database
    // moves the payload with it. The RPC's predicate is what protects the window *after* that read
    // — a source edited or deleted between validation and insert — and it compares the payload it
    // was handed against the row as it stands at insert time.
    const stale = tables.createRebuiltCard(
      writeFor(cardId, revisionId, {
        sourceSnapshotHash: '0'.repeat(64),
        rebuildProvenance: { sourceSnapshotHash: '0'.repeat(64) },
      }),
    )

    expect(stale).toEqual({ ok: false, code: 'source_moved' })
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('creates nothing when the owner named by the payload does not own the revision', () => {
    const { cardId, revisionId } = seedAlphaCard()
    const cardsBefore = tables.cards.length

    const foreign = tables.createRebuiltCard(
      writeFor(cardId, revisionId, {
        ownerId: OTHER_USER,
        rebuildProvenance: { sourceOwnerId: OTHER_USER },
      }),
    )

    expect(foreign).toEqual({ ok: false, code: 'source_moved' })
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('accepts a fully consistent payload, so the negative cases are not passing vacuously', () => {
    const { cardId, revisionId } = seedAlphaCard()
    expect(tables.createRebuiltCard(writeFor(cardId, revisionId)).ok).toBe(true)
  })

  it.each([
    ['sourceRevisionNumber', 99],
    ['sourceSnapshotIntegrityHash', 'f'.repeat(64)],
    ['sourceResolvedContentHash', 'f'.repeat(64)],
  ])('refuses a document that fabricates %s', (field, value) => {
    const { cardId, revisionId } = seedAlphaCard()
    const cardsBefore = tables.cards.length

    // Each of these is a column the revision row knows. Binding only the call's arguments
    // authenticated the *call* and not the evidence: one real tuple satisfied the join while a
    // fabricated revision number or hash was frozen into a write-once column.
    const result = tables.createRebuiltCard(
      writeFor(cardId, revisionId, { rebuildProvenance: { [field]: value } }),
    )

    expect(result.ok).toBe(false)
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it.each([
    ['a document at an unknown version', { version: 'ip-cards-rebuild/2' }],
    ['a document with no version at all', { version: undefined }],
    ['a revision number sent as a string', { sourceRevisionNumber: '1' }],
    ['an omitted nullable integrity hash', { sourceSnapshotIntegrityHash: undefined }],
    ['an omitted nullable content hash', { sourceResolvedContentHash: undefined }],
    ['an omitted print-document hash', { sourcePrintDocumentHash: undefined }],
    ['an omitted owner', { sourceOwnerId: undefined }],
    ['an omitted allowed-final-state hash', { allowedFinalStateHash: undefined }],
    ['an omitted decision list', { decisions: undefined }],
    ['an omitted createdAt', { createdAt: undefined }],
    ['an omitted target release', { targetReleaseBundleId: undefined }],
    ['a key version 1 does not define', { invented: true }],
    ['a non-nullable field stated as null', { mappingPlanHash: null }],
    ['a malformed decision entry', { decisions: [{ key: 'x' }] }],
    ['a uuid field that is not a uuid', { sourceOwnerId: 'not-a-uuid' }],
    ['a hash field that is not a digest', { allowedFinalStateHash: 'nope' }],
  ])('refuses %s', (_label, override) => {
    const { cardId, revisionId } = seedAlphaCard()
    const cardsBefore = tables.cards.length

    // An absent key is not the same claim as an explicit JSON null: absent would compare
    // null-to-null against a null column and be read as agreement about a fact never made.
    const write = writeFor(cardId, revisionId)
    const provenance = { ...write.rebuildProvenance, ...override } as Record<string, unknown>
    for (const [key, value] of Object.entries(override)) {
      if (value === undefined) delete provenance[key]
    }

    expect(tables.createRebuiltCard({ ...write, rebuildProvenance: provenance })).toEqual({
      ok: false,
      code: 'provenance_malformed',
    })
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it.each([
    'sourceCardId',
    'sourceRevisionId',
    'sourceOwnerId',
    'sourceSnapshotHash',
    'sourceReleaseBundleId',
  ])('refuses a document whose %s disagrees with the argument it was checked against', (field) => {
    const { cardId, revisionId } = seedAlphaCard()
    const cardsBefore = tables.cards.length

    // A well-formed value of the right type that names something else: the shape check passes
    // and the binding check is what refuses it.
    // Well-formed for its own field type, so the shape check passes and the *binding* check is
    // what refuses it — a malformed value would prove only that the validator rejects garbage.
    const invented =
      field === 'sourceReleaseBundleId'
        ? 'release-invented'
        : field === 'sourceSnapshotHash'
          ? '9'.repeat(64)
          : OTHER_CARD_UUID
    const result = tables.createRebuiltCard(
      writeFor(cardId, revisionId, { rebuildProvenance: { [field]: invented } }),
    )

    expect(result).toEqual({ ok: false, code: 'provenance_mismatch' })
    expect(tables.cards).toHaveLength(cardsBefore)
  })

  it('leaves the rebuilt card standing as a tombstone when the source is deleted afterwards', async () => {
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

    // Deleting the source is still allowed, and takes its revisions with it under the cascade.
    await tables.client().from('ip_user_preference_cards').delete().eq('id', cardId)
    expect(tables.revisions.filter((row) => row.card_id === cardId)).toHaveLength(0)

    // The rebuilt card survives with its provenance intact: hash-addressed evidence of a review,
    // pointing at ids that no longer resolve. That is the documented policy, not an accident.
    const rebuilt = tables.cards.find((row) => row.id === result.cardId)!
    const provenance = rebuilt.rebuild_provenance as Record<string, unknown>
    expect(provenance.sourceCardId).toBe(cardId)
    expect(provenance.sourceRevisionId).toBe(revisionId)
    expect(provenance.sourceSnapshotHash).toEqual(expect.any(String))
  })
})

describe('the pre-write drift check does not punish the physician for answering', () => {
  it('creates the card when a changed requirement is dropped', async () => {
    const { cardId, revisionId } = seedAlphaCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    const acknowledgements: Record<string, 'confirmed' | 'dropped' | 'acknowledged_unresolved'> = {}
    let droppedSomething = false
    for (const decision of prepared.preparation.plan.decisions) {
      if (!decision.requiresExplicitConfirmation) continue
      if (decision.kind === 'requirement' && decision.state === 'carried_requires_review') {
        acknowledgements[decision.key] = 'dropped'
        droppedSomething = true
        continue
      }
      acknowledgements[decision.key] =
        decision.state === 'carried_requires_review' ? 'confirmed' : 'acknowledged_unresolved'
    }
    // Non-vacuity: there has to be something droppable for this to test anything.
    expect(droppedSomething).toBe(true)

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.preparation.selection,
      planHash: prepared.preparation.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    // The drift check compares a re-resolution of the plan's own proposed inputs, not the answered
    // ones. Comparing the answered inputs would have made every use of the drop control read as a
    // moved plan — the control would have been unusable.
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const created = tables.cards.find((row) => row.id === result.cardId)!
    const inputs = created.builder_inputs as BuilderInputs
    expect(inputs.input.selectedHospitalItemIds?.[BACKUP_SLOT]).toBeNull()
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

describe('a review whose inputs could not be computed is not offered', () => {
  /**
   * A card whose stored equipment set cannot be rebuilt from the retained catalogue.
   *
   * The fixture catalogue is deliberately empty, so any set member fails to resolve — which is
   * exactly what makes the operational comparison, and only the operational comparison, fail.
   */
  function seedCardWithUnresolvableSet(overrides: { duplicateId?: boolean } = {}) {
    const base = seedAlphaCard()
    const revision = tables.revisions.find((row) => row.id === base.revisionId)!
    const inputs = revision.builder_inputs as BuilderInputs
    const set = {
      id: 'set-fixture-1',
      name: 'Fixture tray',
      selectedRoleCode: 'FIXTURE_ROLE',
      additionalCoveredRoles: [],
      members: [{ productId: 'PRD-MISSING', roleCode: 'FIXTURE_ROLE' }],
    }
    const equipmentSets = overrides.duplicateId
      ? [
          { ...set, members: [] },
          { ...set, name: 'Fixture tray, said twice' },
        ]
      : [set]
    revision.builder_inputs = { ...inputs, equipmentSets }
    return base
  }

  it('reports the failed comparison as a blocker rather than hashing it into evidence', async () => {
    const { cardId, revisionId } = seedCardWithUnresolvableSet()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(prepared.code)

    expect(prepared.preparation.operational.ok).toBe(false)
    expect(prepared.preparation.blockers).toContain('operational_comparison_unavailable')
  })

  it('refuses a direct submission, and writes nothing', async () => {
    const { cardId, revisionId } = seedCardWithUnresolvableSet()
    const { prepared, acknowledgements } = await answerEverything(cardId, revisionId)
    const cardsBefore = tables.cards.length
    const revisionsBefore = tables.revisions.length

    // The page hiding the control has never been the boundary here. A failed comparison hashes
    // deterministically, so the plan hash still matches and the request is otherwise well formed.
    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.selection,
      planHash: prepared.planHash,
      acknowledgements,
      title: 'Fixture card (rebuilt)',
    })

    expect(result.ok === false && result.code).toBe('review_unavailable')
    expect(result.ok === false && result.missing).toContain('operational_comparison_unavailable')
    expect(tables.cards).toHaveLength(cardsBefore)
    expect(tables.revisions).toHaveLength(revisionsBefore)
  })

  it('refuses a card whose stored equipment sets share an id, before any review', async () => {
    // Two schema-valid records claiming one id made "the set this requirement chose" a question
    // with two answers: `.find()` validated the first and offered the set as carried, and the save
    // path iterated both and failed on the second's missing member — after the whole review had
    // been answered.
    const { cardId, revisionId } = seedCardWithUnresolvableSet({ duplicateId: true })
    const cardsBefore = tables.cards.length

    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared.ok).toBe(false)
    expect(prepared.ok === false && prepared.code).toBe('builder_inputs_unavailable')

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: { moduleVersionIds: [], modifierCodes: [] },
      planHash: '0'.repeat(64),
      acknowledgements: {},
      title: 'Fixture card (rebuilt)',
    })
    expect(result.ok).toBe(false)
    expect(tables.cards).toHaveLength(cardsBefore)
  })
})
