import { FakePreferenceCardTables } from '../__fixtures__/fake-preference-card-tables'
import { FIXTURE_PRIMARY_ITEM_ID, createRebuildFixtureWorld } from '../__fixtures__/rebuild-world'
import {
  ALPHA_RELEASE_ID,
  FIXTURE_MODULE_V1_0,
  FIXTURE_PROCEDURE_CODE,
  FIXTURE_RECIPE_V1_0,
  FIXTURE_SCENARIO_ID,
} from '../__fixtures__/release-bundle-fixtures'
import { allowedAcknowledgements } from '../domain/card-rebuild-plan'
import { resolveCard } from '../domain/resolve-card'
import type { BuildContext, ResolvedCard } from '../domain/types'
import type { BuilderInputs } from '../schemas/saved-card'

/**
 * The world moving between the review and the submission, and the card that is never written.
 *
 * Two gaps this closes, both named by the independent review.
 *
 * The first is that the server tests hold the world still. Everything a rebuild depends on —
 * the release pointer, the target's authored definitions, the retained catalogue, current
 * hospital-local availability, the room's capabilities, the compatibility rules — is read at GET and
 * read again at POST, and *between those two reads is exactly when a release is published or a
 * product is retired*. A test suite where none of that can move proves the recomputation runs, not
 * that it notices anything.
 *
 * The second is that no test forced the final allowed-outcome gate to fail on the server and then
 * checked that the trusted writer was not called. A gate whose refusal is only ever observed as a
 * return value is one refactor away from returning that value *after* the write.
 *
 * So the mocks here are deliberately mutable, and every case asserts the same two things: the
 * documented stale result, and `writeRebuiltCard` with zero calls.
 */

const world = createRebuildFixtureWorld()

/**
 * Everything a test can move underneath an open review.
 *
 * Read on every access rather than captured, so flipping one of these between `prepareCardRebuild`
 * and `createRebuiltCard` is exactly what a real publication or retirement would do.
 */
const drift = {
  pointer: 'bravo' as 'bravo' | 'charlie' | 'none',
  targetDefinitionHash: null as string | null,
  catalogAvailable: true,
  hospitalItemActive: true,
  /** The seeded card selects a modifier that requires `fluoroscopy`; a test can take it away. */
  roomCapabilities: ['fluoroscopy'] as string[],
  compatibilityRules: null as unknown[] | null,
  /** After this many `resolveForSave` calls, mutate the resolved card. Null disables it. */
  mutateResolveAfter: null as number | null,
  mutateResolve: (card: ResolvedCard): ResolvedCard => card,
  /** When true, the resolve that follows `mutateResolveAfter` fails outright. */
  failFinalResolve: false,
  resolveCalls: 0,
}

function reset() {
  drift.pointer = 'bravo'
  drift.targetDefinitionHash = null
  drift.catalogAvailable = true
  drift.hospitalItemActive = true
  drift.roomCapabilities = ['fluoroscopy']
  drift.compatibilityRules = null
  drift.mutateResolveAfter = null
  drift.mutateResolve = (card) => card
  drift.failFinalResolve = false
  drift.resolveCalls = 0
}

jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))
jest.mock('../server/rebuild-writer.server', () => ({ writeRebuiltCard: jest.fn() }))

jest.mock('../data/release-bundles.server', () => {
  const actual = jest.requireActual(
    '../__fixtures__/rebuild-world',
  ) as typeof import('../__fixtures__/rebuild-world')
  const built = actual.createRebuildFixtureWorld()

  /** The target bundle as the *current* world describes it, definition hash included. */
  const targetBundle = () => {
    const state = (globalThis as { __ipDrift?: typeof drift }).__ipDrift!
    if (state.targetDefinitionHash === null) return built.bravo
    return { ...built.bravo, definitionHash: state.targetDefinitionHash }
  }

  const bundleFor = (id: string) => {
    if (id === built.bravo.id) return targetBundle()
    return built.world.bundleById.get(id) ?? null
  }

  return {
    getReleaseBundle: (id: string) => bundleFor(id),
    getRetainedReleaseBundles: () => built.world.bundles,
    getReleasePointers: () => built.world.pointers,
    getCurrentReleaseBundle: (procedureCode: string) => {
      const state = (globalThis as { __ipDrift?: typeof drift }).__ipDrift!
      if (procedureCode !== 'FIXTURE_PROCEDURE') return null
      if (state.pointer === 'none') return null
      if (state.pointer === 'charlie') {
        const fixtures = jest.requireActual(
          '../__fixtures__/release-bundle-fixtures',
        ) as typeof import('../__fixtures__/release-bundle-fixtures')
        return built.world.bundleById.get(fixtures.CHARLIE_RELEASE_ID) ?? null
      }
      return targetBundle()
    },
    resolveReleaseDefinitions: (id: string) => {
      const bundle = bundleFor(id)
      if (!bundle) return { ok: false, code: 'release_unknown', message: `unknown release ${id}` }
      return { ok: true, bundle, sources: built.world.loadSources(bundle) }
    },
    buildReleaseContext: (id: string) => {
      const state = (globalThis as { __ipDrift?: typeof drift }).__ipDrift!
      const bundle = bundleFor(id)
      if (!bundle) return { ok: false, code: 'release_unknown', message: `unknown release ${id}` }
      const base = built.contextFor(id) as BuildContext
      // A modifier that depends on the room, so "the room changed" is a thing this world can
      // express at all. Without one, changing `locationCapabilities` moves nothing and the drift
      // case would pass for the wrong reason.
      const capabilityModifier = {
        code: 'DRIFT_NEEDS_FLUORO',
        name: 'Drift fixture: needs fluoroscopy',
        groupCode: 'drift',
        description: 'Synthetic.',
        releaseState: 'mvp',
        active: true,
        appliesTo: 'FIXTURE_PROCEDURE',
        preview: [],
        conflictsWith: [],
        actions: [
          {
            id: 'drift-needs-fluoro',
            modifierCode: 'DRIFT_NEEDS_FLUORO',
            sequence: 10,
            targetSlotId: null,
            targetRoleCode: null,
            targetRequirementKey: null,
            actionType: 'require_room_capability',
            payload: { capability: 'fluoroscopy' },
          },
        ],
      }
      const context: BuildContext = {
        ...base,
        recipe: {
          ...base.recipe,
          allowedModifierCodes: [...base.recipe.allowedModifierCodes, 'DRIFT_NEEDS_FLUORO'],
        },
        modifiers: [
          ...base.modifiers,
          capabilityModifier as unknown as BuildContext['modifiers'][number],
        ],
        locationCapabilities: state.roomCapabilities,
        hospitalItems: base.hospitalItems.map((item) => ({
          ...item,
          active: state.hospitalItemActive ? item.active : false,
        })),
        compatibilityRules: (state.compatibilityRules ??
          base.compatibilityRules) as BuildContext['compatibilityRules'],
      }
      return {
        ok: true,
        bundle,
        scenario: actual.fixtureScenario(bundle.recipeVersionId),
        context,
      }
    },
  }
})

jest.mock('../data/historical-catalog.server', () => ({
  getHistoricalCatalog: () => {
    const state = (globalThis as { __ipDrift?: typeof drift }).__ipDrift!
    return state.catalogAvailable
      ? { ok: true, productById: new Map(), roleByProductId: new Map() }
      : { ok: false, message: 'the retained catalogue release is no longer available' }
  },
  resolveHistoricalCatalogPick: () => ({
    ok: false,
    code: 'unknown_product',
    productId: '',
    roleCode: '',
  }),
  historicalFamilyPick: () => ({ ok: false, message: 'no fixture catalogue' }),
}))

// `resolveForSave` is the one function both the plan's counterfactual probe and the final pre-write
// resolve go through, which is what makes a call count a usable discriminator between them.
jest.mock('../server/user-cards', () => {
  const actual = jest.requireActual('../server/user-cards') as typeof import('../server/user-cards')
  return {
    ...actual,
    resolveForSave: (...args: Parameters<typeof actual.resolveForSave>) => {
      const state = (globalThis as { __ipDrift?: typeof drift }).__ipDrift!
      state.resolveCalls += 1
      const result = actual.resolveForSave(...args)
      if (
        !result.ok ||
        state.mutateResolveAfter === null ||
        state.resolveCalls <= state.mutateResolveAfter
      ) {
        return result
      }
      if (state.failFinalResolve) {
        return {
          ok: false as const,
          error: 'the answered inputs do not resolve into a card',
          code: 'not_resolvable' as const,
        }
      }
      return { ...result, card: state.mutateResolve(result.card) }
    },
  }
})

const { prepareCardRebuild, createRebuiltCard } = jest.requireActual(
  '../server/rebuild-card',
) as typeof import('../server/rebuild-card')

const { supabaseServer } = jest.requireMock('@/lib/supabase/server') as {
  supabaseServer: jest.Mock
}
const { writeRebuiltCard } = jest.requireMock('../server/rebuild-writer.server') as {
  writeRebuiltCard: jest.Mock
}

const OWNER = '00000000-0000-4000-a000-000000000001'
const PRIMARY_SLOT = 'SLOT-FIXTURE-PRIMARY'
const tables = new FakePreferenceCardTables()

;(globalThis as { __ipDrift?: typeof drift }).__ipDrift = drift

function seedCard() {
  const context = world.contextFor(ALPHA_RELEASE_ID)
  const inputs: BuilderInputs = {
    schemaVersion: 4,
    releaseBundleId: ALPHA_RELEASE_ID,
    scenarioId: FIXTURE_SCENARIO_ID,
    input: {
      organizationId: 'org',
      siteId: 'site',
      locationId: 'location',
      recipeVersionId: FIXTURE_RECIPE_V1_0,
      selectedModuleVersionIds: [FIXTURE_MODULE_V1_0],
      modifierCodes: ['DRIFT_NEEDS_FLUORO'],
      variables: {},
      conditionalStates: {},
      selectedHospitalItemIds: { [PRIMARY_SLOT]: FIXTURE_PRIMARY_ITEM_ID },
      selectionsAreExplicit: true,
      waivers: {},
    },
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
  }
  const card = resolveCard(
    { ...inputs.input, variables: { generated_at: '2026-01-01T00:00:00.000Z' } },
    context,
  )
  const cardId = tables.cardId(900)
  const revisionId = '00000000-0000-4000-9000-000000000900'
  tables.cards.push({
    id: cardId,
    user_id: OWNER,
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
    id: revisionId,
    card_id: cardId,
    user_id: OWNER,
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
    created_by: OWNER,
  })
  return { cardId, revisionId }
}

async function reviewed(cardId: string, revisionId: string) {
  const prepared = await prepareCardRebuild(cardId, revisionId)
  if (!prepared.ok) throw new Error(`preparation failed: ${prepared.code}`)
  const acknowledgements: Record<string, 'confirmed' | 'dropped' | 'acknowledged_unresolved'> = {}
  for (const decision of prepared.preparation.plan.decisions) {
    if (!decision.requiresExplicitConfirmation) continue
    acknowledgements[decision.key] = allowedAcknowledgements(decision)[0]
  }
  return { prepared: prepared.preparation, acknowledgements }
}

function submit(
  cardId: string,
  revisionId: string,
  prepared: Awaited<ReturnType<typeof reviewed>>['prepared'],
  acknowledgements: Record<string, 'confirmed' | 'dropped' | 'acknowledged_unresolved'>,
) {
  return createRebuiltCard({
    cardId,
    revisionId,
    selection: prepared.selection,
    planHash: prepared.planHash,
    acknowledgements,
    title: 'Fixture card (rebuilt)',
  })
}

beforeEach(() => {
  reset()
  tables.reset(OWNER)
  supabaseServer.mockResolvedValue(tables.client())
  writeRebuiltCard.mockResolvedValue({ ok: true, cardId: 'never-reached' })
})

describe('the world moving between the review and the submission', () => {
  it('is a review that could be created before anything moved', async () => {
    // The control. Without it every case below could be passing because the fixture never worked.
    const { cardId, revisionId } = seedCard()
    const { prepared, acknowledgements } = await reviewed(cardId, revisionId)
    expect((await submit(cardId, revisionId, prepared, acknowledgements)).ok).toBe(true)
    expect(writeRebuiltCard).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the release pointer moved to another release', () => (drift.pointer = 'charlie')],
    ['the release pointer was removed', () => (drift.pointer = 'none')],
    [
      "the target release's authored definitions moved",
      () => (drift.targetDefinitionHash = '9'.repeat(64)),
    ],
    ['the retained catalogue release went away', () => (drift.catalogAvailable = false)],
    ['current hospital-local availability changed', () => (drift.hospitalItemActive = false)],
    ['the room lost a capability the card depends on', () => (drift.roomCapabilities = [])],
    ['the compatibility rules changed', () => (drift.compatibilityRules = [])],
  ])('refuses and writes nothing when %s', async (_label, move) => {
    const { cardId, revisionId } = seedCard()
    const { prepared, acknowledgements } = await reviewed(cardId, revisionId)

    move()

    const result = await submit(cardId, revisionId, prepared, acknowledgements)
    expect(result.ok).toBe(false)
    // Every target-side movement reads the same to the physician: the plan they answered is not
    // the plan this rebuild would make now.
    expect(result.ok === false && result.code).toBe('plan_moved')
    expect(writeRebuiltCard).not.toHaveBeenCalled()
    expect(tables.cards).toHaveLength(1)
    expect(tables.revisions).toHaveLength(1)
  })
})

describe('the final allowed-outcome gate, on the server, writes nothing when it refuses', () => {
  /**
   * Arm the mutation for the final resolve only.
   *
   * `createRebuiltCard` re-runs the whole preparation before it resolves the card it is about to
   * write, so the plan's own resolver calls come first and in the same number. Counting them once
   * gives the exact index of the final call, which is the one this gate is about — and leaves the
   * plan hash matching, so the refusal can only be coming from the final comparison.
   */
  async function armFinalMutation(
    cardId: string,
    revisionId: string,
    mutate: (card: ResolvedCard) => ResolvedCard,
  ) {
    const { prepared, acknowledgements } = await reviewed(cardId, revisionId)
    const planCalls = drift.resolveCalls
    drift.resolveCalls = 0
    drift.mutateResolveAfter = planCalls
    drift.mutateResolve = mutate
    return { prepared, acknowledgements }
  }

  const item = (card: ResolvedCard) => card.items[0]

  it.each([
    [
      'selection',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        items: [
          { ...item(card), selectedHospitalItemId: 'something-else' },
          ...card.items.slice(1),
        ],
      }),
    ],
    [
      'slot',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        items: [{ ...item(card), id: 'slot-renamed' }, ...card.items.slice(1)],
      }),
    ],
    [
      'role',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        items: [{ ...item(card), roleCode: 'INVENTED_ROLE' }, ...card.items.slice(1)],
      }),
    ],
    [
      'requirement set',
      (card: ResolvedCard): ResolvedCard => ({ ...card, items: card.items.slice(1) }),
    ],
    [
      'presence',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        items: card.items.slice(1),
        suppressedItems: [...card.suppressedItems, item(card)],
      }),
    ],
    [
      'compatibility',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        items: [{ ...item(card), compatibilityState: 'fail' }, ...card.items.slice(1)],
      }),
    ],
    [
      'resolution',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        items: [{ ...item(card), resolutionState: 'unresolved' }, ...card.items.slice(1)],
      }),
    ],
    ['readiness', (card: ResolvedCard): ResolvedCard => ({ ...card, readinessState: 'blocked' })],
    [
      'warning signature',
      (card: ResolvedCard): ResolvedCard => ({
        ...card,
        warnings: [
          ...card.warnings,
          {
            id: 'invented-1',
            severity: 'warning',
            code: 'invented_warning',
            message: 'Nobody reviewed this.',
            sourceType: 'slot',
            sourceId: PRIMARY_SLOT,
            acknowledged: false,
            waiverReason: null,
          },
        ],
      }),
    ],
  ])(
    'refuses a card whose %s moved after the review, and calls the writer zero times',
    async (_axis, mutate) => {
      const { cardId, revisionId } = seedCard()
      const { prepared, acknowledgements } = await armFinalMutation(cardId, revisionId, mutate)

      const result = await submit(cardId, revisionId, prepared, acknowledgements)

      expect(result.ok).toBe(false)
      expect(result.ok === false && result.code).toBe('plan_moved')
      // The refusal names what moved rather than only that something did.
      expect(result.ok === false && result.message).toMatch(/\(.+\)/)
      expect(writeRebuiltCard).not.toHaveBeenCalled()
      expect(tables.cards).toHaveLength(1)
      expect(tables.revisions).toHaveLength(1)
    },
  )

  it('refuses and writes nothing when the answered inputs no longer resolve at all', async () => {
    // The `notResolvable` axis, which the projection models as its own state rather than as a delta.
    // It surfaces as the documented `not_resolvable` result, not `plan_moved` — and either way the
    // writer must not be reached.
    const { cardId, revisionId } = seedCard()
    const { prepared, acknowledgements } = await armFinalMutation(
      cardId,
      revisionId,
      (card) => card,
    )
    drift.failFinalResolve = true

    const result = await submit(cardId, revisionId, prepared, acknowledgements)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.code).toBe('not_resolvable')
    expect(writeRebuiltCard).not.toHaveBeenCalled()
    expect(tables.cards).toHaveLength(1)
    expect(tables.revisions).toHaveLength(1)
  })

  it('refuses a requirement the finished card gained, and writes nothing', async () => {
    // The added-requirement direction. The matrix above only ever removed one.
    const { cardId, revisionId } = seedCard()
    const { prepared, acknowledgements } = await armFinalMutation(cardId, revisionId, (card) => ({
      ...card,
      items: [
        ...card.items,
        { ...card.items[0], id: 'slot-invented', requirementKey: 'INVENTED_REQUIREMENT' },
      ],
    }))

    const result = await submit(cardId, revisionId, prepared, acknowledgements)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toMatch(/requirement_outside_plan/)
    expect(writeRebuiltCard).not.toHaveBeenCalled()
    expect(tables.cards).toHaveLength(1)
  })

  it('refuses a reviewed warning the finished card lost, and writes nothing', async () => {
    // The removed-warning direction. A warning quietly disappearing is a changed card just as much
    // as one appearing — and the physician read the version that had it.
    const { cardId, revisionId } = seedCard()
    // Start from a world where the room capability is missing, so the reviewed projection carries a
    // warning there is something to lose.
    drift.roomCapabilities = []
    const { prepared, acknowledgements } = await armFinalMutation(cardId, revisionId, (card) => ({
      ...card,
      warnings: [],
    }))
    expect(prepared.plan.targetResolution.warnings.length).toBeGreaterThan(0)

    const result = await submit(cardId, revisionId, prepared, acknowledgements)

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toMatch(/warning_disappeared/)
    expect(writeRebuiltCard).not.toHaveBeenCalled()
    expect(tables.cards).toHaveLength(1)
  })

  it('writes when the final card is exactly the one the review authorized', async () => {
    // The control for the matrix above: the same arming, mutating nothing.
    const { cardId, revisionId } = seedCard()
    const { prepared, acknowledgements } = await armFinalMutation(
      cardId,
      revisionId,
      (card) => card,
    )
    expect((await submit(cardId, revisionId, prepared, acknowledgements)).ok).toBe(true)
    expect(writeRebuiltCard).toHaveBeenCalledTimes(1)
  })
})
