import { FakePreferenceCardTables } from '../__fixtures__/fake-preference-card-tables'
import { defaultBuildInput, getScenarioDefinition } from '../data/demo-context.server'
import { getCurrentReleaseBundleForScenario } from '../data/release-bundles.server'
import { printDocumentHash } from '../domain/print-document'
import { stableStringify } from '../domain/stable-hash'
import {
  BUILDER_INPUTS_SCHEMA_VERSION,
  saveCardRequestSchema,
  type SaveCardRequest,
} from '../schemas/saved-card'

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

const { supabaseServer } = jest.requireMock('@/lib/supabase/server') as {
  supabaseServer: jest.Mock
}

const { duplicateUserCard, renameUserCard, saveUserCard, setShareEnabled, loadUserCard } =
  jest.requireActual('../server/user-cards') as typeof import('../server/user-cards')

const { listCardRevisions, loadCardRevision, loadCurrentCardRevision } = jest.requireActual(
  '../server/card-revisions',
) as typeof import('../server/card-revisions')

const { reconcileSavedCard, resolutionAffectingChanges } = jest.requireActual(
  '../server/reconcile-card',
) as typeof import('../server/reconcile-card')

/**
 * Append-only revisions, and the read-only reconciliation built on them.
 *
 * The revision behaviour under test belongs to a database trigger, which the fake mirrors clause
 * for clause. That is a real limitation and worth naming: these assertions prove the *rules* are
 * the ones the module intends, not that Postgres runs them. What they do prove and what a live
 * database could not tell you more cheaply is that no application code writes a revision, that
 * every card writer produces one without knowing the table exists, and that reconciliation
 * writes nothing at all.
 */

const SCENARIO_ID = 'ebus-rose-molecular'
const OWNER = 'user-owner'
const OTHER_USER = 'user-other'

const tables = new FakePreferenceCardTables()

beforeEach(() => {
  tables.reset(OWNER)
  supabaseServer.mockResolvedValue(tables.client())
})

function cardRequest(overrides: Partial<SaveCardRequest> = {}): SaveCardRequest {
  const scenario = getScenarioDefinition(SCENARIO_ID)!
  const release = getCurrentReleaseBundleForScenario(SCENARIO_ID)
  expect(release).not.toBeNull()

  return saveCardRequestSchema.parse({
    schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
    releaseBundleId: release!.id,
    scenarioId: SCENARIO_ID,
    title: 'Dr Miller EBUS with ROSE',
    physicianName: 'R. Miller',
    status: 'draft',
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
    input: { ...defaultBuildInput(SCENARIO_ID), recipeVersionId: scenario.recipeVersionId },
    ...overrides,
  })
}

/**
 * The content version a card is currently at, as the editor would have loaded it.
 *
 * Overwriting requires stating the version the edit was built from; the concurrency tests below
 * pass a deliberately older one.
 */
function currentVersion(cardId: string): string {
  const row = tables.cards.find((candidate) => candidate.id === cardId)
  expect(row).toBeDefined()
  return row!.updated_at
}

/** Save an edit to an existing card at whatever version it is currently at. */
async function saveEdit(
  cardId: string,
  overrides: Partial<SaveCardRequest> = {},
): Promise<Awaited<ReturnType<typeof saveUserCard>>> {
  return saveUserCard(
    cardRequest({ cardId, expectedUpdatedAt: currentVersion(cardId), ...overrides }),
  )
}

async function saveNewCard(overrides: Partial<SaveCardRequest> = {}): Promise<string> {
  const result = await saveUserCard(cardRequest(overrides))
  expect(result.ok).toBe(true)
  return result.data as string
}

describe('every saved state becomes a revision', () => {
  it('records revision 1 when a card is created', async () => {
    const cardId = await saveNewCard()
    const revisions = await listCardRevisions(cardId)

    expect(revisions).toHaveLength(1)
    expect(revisions[0].revisionNumber).toBe(1)
    expect(revisions[0].cardId).toBe(cardId)
    expect(revisions[0].createdBy).toBe(OWNER)
  })

  it('appends a revision when the card is edited, and leaves the earlier one alone', async () => {
    const cardId = await saveNewCard()
    const [first] = await listCardRevisions(cardId)

    await saveEdit(cardId, { status: 'final' })

    const revisions = await listCardRevisions(cardId)
    expect(revisions.map((revision) => revision.revisionNumber)).toEqual([2, 1])
    expect(revisions[0].status).toBe('final')

    const unchanged = revisions[1]
    expect(unchanged.id).toBe(first.id)
    expect(unchanged.status).toBe('draft')
    expect(unchanged.snapshotHash).toBe(first.snapshotHash)
    expect(unchanged.resolvedContentHash).toBe(first.resolvedContentHash)
  })

  it('appends a revision for a rename, because the printed document changed', async () => {
    const cardId = await saveNewCard()
    await renameUserCard(cardId, 'Renamed card', currentVersion(cardId), 'A. Colleague')

    const revisions = await listCardRevisions(cardId)
    expect(revisions).toHaveLength(2)
    expect(revisions[0].title).toBe('Renamed card')
    expect(revisions[0].physicianName).toBe('A. Colleague')
    // A rename does not re-resolve the card, so what it *says* is unchanged and the semantic
    // hash must not move. The document hash must.
    expect(revisions[0].resolvedContentHash).toBe(revisions[1].resolvedContentHash)
    expect(revisions[0].printDocumentHash).not.toBe(revisions[1].printDocumentHash)
  })

  it('appends nothing when only the share setting changes', async () => {
    const cardId = await saveNewCard()
    await setShareEnabled(cardId, true)
    await setShareEnabled(cardId, false)

    expect(await listCardRevisions(cardId)).toHaveLength(1)
  })

  it('gives a duplicate its own revision 1 rather than the original’s history', async () => {
    const cardId = await saveNewCard()
    await saveEdit(cardId, { status: 'final' })

    const duplicated = await duplicateUserCard(cardId, 'A copy')
    expect(duplicated.ok).toBe(true)
    const copyId = duplicated.data as string

    expect((await listCardRevisions(cardId)).map((r) => r.revisionNumber)).toEqual([2, 1])
    const copyRevisions = await listCardRevisions(copyId)
    expect(copyRevisions).toHaveLength(1)
    expect(copyRevisions[0].revisionNumber).toBe(1)
    expect(copyRevisions[0].cardId).toBe(copyId)
  })

  it('numbers revisions monotonically and lists them newest first', async () => {
    const cardId = await saveNewCard()
    await saveEdit(cardId, { title: 'Second' })
    await saveEdit(cardId, { title: 'Third' })

    const revisions = await listCardRevisions(cardId)
    expect(revisions.map((revision) => revision.revisionNumber)).toEqual([3, 2, 1])
    expect(revisions.map((revision) => revision.title)).toEqual([
      'Third',
      'Second',
      'Dr Miller EBUS with ROSE',
    ])
  })

  it('pins the release and catalogue release each state resolved through', async () => {
    const cardId = await saveNewCard()
    const [revision] = await listCardRevisions(cardId)
    const release = getCurrentReleaseBundleForScenario(SCENARIO_ID)!

    expect(revision.releaseBundleId).toBe(release.id)
    expect(revision.catalogReleaseId).toBe(release.catalogImportId)
  })
})

describe('a revision is addressable and verified on the way out', () => {
  it('loads one by id and re-verifies its stored snapshot', async () => {
    const cardId = await saveNewCard()
    const [summary] = await listCardRevisions(cardId)

    const loaded = await loadCardRevision(cardId, summary.id)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    expect(loaded.revision.cardSnapshot.snapshotHash).toBe(summary.snapshotHash)
    expect(loaded.revision.builderInputs).not.toBeNull()
  })

  it('refuses a revision id that belongs to a different card', async () => {
    const firstCard = await saveNewCard()
    const secondCard = await saveNewCard({ title: 'Another card' })
    const [foreignRevision] = await listCardRevisions(secondCard)

    expect(await loadCardRevision(firstCard, foreignRevision.id)).toEqual({
      ok: false,
      code: 'not_found',
    })
  })

  it('reports a stored snapshot that no longer verifies rather than rendering it', async () => {
    const cardId = await saveNewCard()
    const [summary] = await listCardRevisions(cardId)

    const stored = tables.revisions.find((row) => row.id === summary.id)!
    ;(stored.card_snapshot as { readinessState: string }).readinessState = 'complete'
    ;(stored.card_snapshot as { snapshotHash: string }).snapshotHash = 'f'.repeat(64)

    expect(await loadCardRevision(cardId, summary.id)).toEqual({
      ok: false,
      code: 'snapshot_unverifiable',
    })
  })

  it('derives the print-document hash from the same function the card header uses', async () => {
    const cardId = await saveNewCard()
    const [revision] = await listCardRevisions(cardId)

    expect(revision.snapshotIntegrityHash).not.toBeNull()
    expect(revision.printDocumentHash).toBe(
      printDocumentHash({
        snapshotIntegrityHash: revision.snapshotIntegrityHash!,
        metadata: {
          cardId,
          title: revision.title,
          physicianName: revision.physicianName,
          status: revision.status,
          updatedAt: revision.createdAt,
        },
      }),
    )
  })

  it('shows another user nothing, the same as the card itself', async () => {
    const cardId = await saveNewCard()
    const [revision] = await listCardRevisions(cardId)

    tables.currentUserId = OTHER_USER
    expect(await listCardRevisions(cardId)).toEqual([])
    expect(await loadCardRevision(cardId, revision.id)).toEqual({ ok: false, code: 'not_found' })
    expect(await loadCurrentCardRevision(cardId)).toBeNull()
  })
})

describe('reconciliation reviews and changes nothing', () => {
  it('reports a freshly saved card as identical against current hospital-local data', async () => {
    const cardId = await saveNewCard()
    const result = await reconcileSavedCard(cardId)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { operational } = result.reconciliation
    expect(operational.ok).toBe(true)
    if (!operational.ok) return
    expect(operational.delta.identical).toBe(true)
  })

  it('holds the authored release fixed, so nothing outside hospital-local data can differ', async () => {
    const cardId = await saveNewCard()
    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { operational } = result.reconciliation
    expect(operational.ok).toBe(true)
    if (!operational.ok) return
    // The evidence, not the claim: release identity, recipe version, module manifest, scope, and
    // modifiers all live in this catch-all, and every one of them is pinned.
    expect(operational.delta.otherChangedProjectionKeys).toEqual([])
  })

  it('writes nothing at all', async () => {
    const cardId = await saveNewCard()
    const writesBefore = tables.writes.length
    const revisionsBefore = tables.revisions.length
    // Non-vacuous: saving the card did write, so an empty log would mean the fake records nothing.
    expect(writesBefore).toBeGreaterThan(0)

    await reconcileSavedCard(cardId)
    await listCardRevisions(cardId)

    expect(tables.writes).toHaveLength(writesBefore)
    expect(tables.revisions).toHaveLength(revisionsBefore)
  })

  it('leaves the stored card and its revisions byte-identical', async () => {
    const cardId = await saveNewCard()
    const storedBefore = stableStringify(tables.cards)
    const revisionsBefore = stableStringify(tables.revisions)

    await reconcileSavedCard(cardId)

    expect(stableStringify(tables.cards)).toBe(storedBefore)
    expect(stableStringify(tables.revisions)).toBe(revisionsBefore)
  })

  it('names the exact revision it reviewed, so a later rebuild can cite it', async () => {
    const cardId = await saveNewCard()
    await saveEdit(cardId, { status: 'final' })

    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const current = await loadCurrentCardRevision(cardId)
    expect(result.reconciliation.source.revisionId).toBe(current!.id)
    expect(result.reconciliation.source.revisionNumber).toBe(2)
    expect(result.reconciliation.source.snapshotHash).toBe(current!.snapshotHash)
    expect(result.reconciliation.source.releaseBundleId).toBe(current!.releaseBundleId)
  })

  it('reports a card already on its procedure’s current release as having nothing to compare', async () => {
    const cardId = await saveNewCard()
    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { release } = result.reconciliation
    expect(release.ok).toBe(true)
    if (!release.ok) return

    expect(release.onCurrentRelease).toBe(true)
    expect(release.pinnedReleaseBundleId).toBe(release.currentReleaseBundleId)
    // No diff is computed, and — the point of the phase — no context is built from any other
    // release, so nothing here could resolve the card against one.
    expect(release.impact).toBeNull()
    expect(release.affecting).toEqual([])
  })

  it('is a 404 for a card belonging to someone else, exactly as loading one is', async () => {
    const cardId = await saveNewCard()
    tables.currentUserId = OTHER_USER

    expect(await reconcileSavedCard(cardId)).toEqual({ ok: false, code: 'not_found' })
    expect(await loadUserCard(cardId)).toBeNull()
  })
})

describe('a card the builder will not reopen still reviews what it can', () => {
  /**
   * A version-2 card: exact about its recipe and modules, silent about the four whole-set
   * dependencies underneath them. It cannot be re-resolved and has no release to compare — and
   * both halves must say so in their own words rather than one failure hiding the other.
   */
  it('reports both halves as unavailable for a superseded builder input version', async () => {
    const cardId = await saveNewCard()
    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = row.builder_inputs as Record<string, unknown>
    row.builder_inputs = { ...inputs, schemaVersion: 2, releaseBundleId: undefined }
    delete (row.builder_inputs as Record<string, unknown>).releaseBundleId

    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { operational, release } = result.reconciliation
    expect(operational.ok).toBe(false)
    expect(release.ok).toBe(false)
    if (operational.ok || release.ok) return
    expect(operational.code).toBe('builder_inputs_not_release_pinned')
    expect(release.code).toBe('builder_inputs_not_release_pinned')
  })

  it('still compares releases for a card whose product line cannot be reconstructed', async () => {
    const cardId = await saveNewCard()
    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = row.builder_inputs as Record<string, unknown>
    // A version-3 card that named a product line by a catalogue-browsing key. It can never be
    // re-resolved; its release is nonetheless perfectly comparable.
    row.builder_inputs = {
      ...inputs,
      schemaVersion: 3,
      familyPicks: [
        { familyKey: 'MFR-X|surgical chest tube|candidate', roleCode: 'GENERIC_SPECIMEN' },
      ],
    }

    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const { operational, release } = result.reconciliation
    expect(operational.ok).toBe(false)
    if (operational.ok) return
    expect(operational.code).toBe('legacy_family_identity')

    expect(release.ok).toBe(true)
    if (!release.ok) return
    expect(release.pinnedReleaseBundleId).toBe(getCurrentReleaseBundleForScenario(SCENARIO_ID)!.id)
  })
})

describe('the operational review actually detects a difference', () => {
  /**
   * The tests above assert that a freshly saved card reconciles to *identical*, which is worth
   * very little on its own — a comparison that always returned "no changes" would pass every one
   * of them. This is the other half: a card whose re-resolution genuinely differs from its stored
   * snapshot must be reported, line by line, with the field that moved named.
   *
   * The divergence is introduced by repointing a stored requirement at a local item the room no
   * longer stocks, which is the exact drift this review exists to surface — a saved card naming
   * something the formulary has since retired. The path exercised is the production one end to
   * end: re-resolve from stored inputs against current hospital-local data, diff against the
   * stored snapshot, report.
   */
  it('names the line and the field when re-resolution disagrees with the stored snapshot', async () => {
    const cardId = await saveNewCard()

    const record = await loadUserCard(cardId)
    const line = record!.card.items.find((item) => item.selectedHospitalItemId !== null)
    expect(line).toBeDefined()

    const row = tables.cards.find((card) => card.id === cardId)!
    const inputs = row.builder_inputs as {
      input: { selectedHospitalItemIds: Record<string, string | null> }
    }
    // The shape of the drift this review exists to surface: the card names a local item the room
    // no longer stocks. Resolution finds nothing behind the id and the line stops resolving.
    row.builder_inputs = {
      ...inputs,
      input: {
        ...inputs.input,
        selectedHospitalItemIds: {
          ...inputs.input.selectedHospitalItemIds,
          [line!.id]: 'demo-item-retired-from-the-formulary',
        },
      },
    }

    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { operational } = result.reconciliation
    expect(operational.ok).toBe(true)
    if (!operational.ok) return

    expect(operational.delta.identical).toBe(false)
    const change = operational.delta.items.find((item) => item.itemId === line!.id)
    expect(change).toBeDefined()
    expect(change!.changedFields).toContain('selectedHospitalItemId')
    expect(change!.before?.selectedHospitalItemId).toBe(line!.selectedHospitalItemId)
    expect(change!.after?.selectedHospitalItemId).toBeNull()
    // And it is surfaced as resolution-affecting, which is what puts it at the top of the review.
    expect(resolutionAffectingChanges(operational.delta).map((item) => item.itemId)).toContain(
      line!.id,
    )

    // Still nothing but hospital-local resolution moved: the release is held fixed throughout.
    expect(operational.delta.otherChangedProjectionKeys).toEqual([])
  })
})

describe('optimistic concurrency: a stale edit cannot overwrite a newer save', () => {
  /**
   * Two editors, one card.
   *
   * This is the failure the revision-number unique index does *not* prevent and was never meant
   * to: that index stops two rows calling themselves revision 3, which is a different problem.
   * Nothing about it stops an editor that loaded revision 1 from saving over revision 2 — the
   * insert would simply become revision 3 and the intervening state would survive only as
   * history, having been silently overwritten as the current card.
   *
   * The mechanism under test is the conditional update: `id = ? and updated_at = ?` in one
   * statement. The fake models it by applying every `.eq()` filter, so a mismatch here is a real
   * predicate miss rather than a canned answer.
   */
  it('rejects B’s save when A saved first, and changes nothing', async () => {
    const cardId = await saveNewCard()

    // Both sessions open the same content version.
    const sessionA = currentVersion(cardId)
    const sessionB = currentVersion(cardId)
    expect(sessionA).toBe(sessionB)

    const first = await saveUserCard(
      cardRequest({ cardId, expectedUpdatedAt: sessionA, title: 'Saved by A' }),
    )
    expect(first.ok).toBe(true)

    const cardAfterA = { ...tables.cards.find((row) => row.id === cardId)! }
    const revisionsAfterA = tables.revisions.length

    const second = await saveUserCard(
      cardRequest({ cardId, expectedUpdatedAt: sessionB, title: 'Saved by B' }),
    )

    expect(second.ok).toBe(false)
    expect(second.code).toBe('stale_edit')

    // B did not become the current card...
    const cardAfterB = tables.cards.find((row) => row.id === cardId)!
    expect(cardAfterB.title).toBe('Saved by A')
    expect(stableStringify(cardAfterB)).toBe(stableStringify(cardAfterA))
    // ...and left no revision behind either. A refused write writes nothing at all.
    expect(tables.revisions).toHaveLength(revisionsAfterA)
    expect(tables.revisions.map((revision) => revision.title)).not.toContain('Saved by B')
  })

  it('appends only A’s revision', async () => {
    const cardId = await saveNewCard()
    const shared = currentVersion(cardId)

    await saveUserCard(cardRequest({ cardId, expectedUpdatedAt: shared, title: 'Saved by A' }))
    await saveUserCard(cardRequest({ cardId, expectedUpdatedAt: shared, title: 'Saved by B' }))

    const revisions = await listCardRevisions(cardId)
    expect(revisions.map((revision) => revision.revisionNumber)).toEqual([2, 1])
    expect(revisions[0].title).toBe('Saved by A')
  })

  it('lets B succeed once it reloads the current content version', async () => {
    const cardId = await saveNewCard()
    const shared = currentVersion(cardId)

    await saveUserCard(cardRequest({ cardId, expectedUpdatedAt: shared, title: 'Saved by A' }))
    const stale = await saveUserCard(
      cardRequest({ cardId, expectedUpdatedAt: shared, title: 'Saved by B' }),
    )
    expect(stale.code).toBe('stale_edit')

    // Reloading the editor is the whole remedy, and it has to actually work.
    const reloaded = await loadUserCard(cardId)
    expect(reloaded!.updatedAt).not.toBe(shared)

    const retried = await saveUserCard(
      cardRequest({ cardId, expectedUpdatedAt: reloaded!.updatedAt, title: 'Saved by B' }),
    )
    expect(retried.ok).toBe(true)
    expect(tables.cards.find((row) => row.id === cardId)!.title).toBe('Saved by B')
    expect((await listCardRevisions(cardId)).map((r) => r.revisionNumber)).toEqual([3, 2, 1])
  })

  it('rejects a stale rename the same way', async () => {
    const cardId = await saveNewCard()
    const stale = currentVersion(cardId)

    await saveUserCard(cardRequest({ cardId, expectedUpdatedAt: stale, title: 'Saved by A' }))

    const result = await renameUserCard(cardId, 'Renamed from a stale page', stale, null)
    expect(result.ok).toBe(false)
    expect(result.code).toBe('stale_edit')
    expect(tables.cards.find((row) => row.id === cardId)!.title).toBe('Saved by A')
  })

  it('does not invalidate an open edit session when only sharing changed', async () => {
    const cardId = await saveNewCard()
    const opened = currentVersion(cardId)

    // A colleague shares the card while the editor sits open. Nothing the card *says* moved, so
    // the content version must not move either — otherwise every share toggle would eject every
    // open editor, and `updated_at` would be tracking row activity rather than content.
    expect((await setShareEnabled(cardId, true)).ok).toBe(true)
    expect(currentVersion(cardId)).toBe(opened)

    const saved = await saveUserCard(
      cardRequest({ cardId, expectedUpdatedAt: opened, title: 'Still saves fine' }),
    )
    expect(saved.ok).toBe(true)
    expect(tables.cards.find((row) => row.id === cardId)!.share_enabled).toBe(true)
  })

  it('does invalidate an open edit session when the content genuinely changed', async () => {
    const cardId = await saveNewCard()
    const opened = currentVersion(cardId)

    await renameUserCard(cardId, 'Renamed by a colleague', opened, null)
    expect(currentVersion(cardId)).not.toBe(opened)

    const saved = await saveUserCard(
      cardRequest({ cardId, expectedUpdatedAt: opened, title: 'Built before the rename' }),
    )
    expect(saved.ok).toBe(false)
    expect(saved.code).toBe('stale_edit')
  })

  it('says the same thing about an unknown card and a foreign one', async () => {
    const cardId = await saveNewCard()
    const version = currentVersion(cardId)
    const unknownId = tables.cardId(999)

    const unknown = await saveUserCard(
      cardRequest({ cardId: unknownId, expectedUpdatedAt: version }),
    )
    expect(unknown).toEqual(
      expect.objectContaining({ ok: false, code: 'not_found', error: expect.any(String) }),
    )

    // The same card, seen by somebody it does not belong to. Row-level security makes it
    // invisible, so it must be reported exactly as an id that never existed — a different answer
    // here would turn a save into a probe for whether a card id is real.
    tables.currentUserId = OTHER_USER
    const foreign = await saveUserCard(cardRequest({ cardId, expectedUpdatedAt: version }))
    expect(foreign.code).toBe('not_found')
    expect(foreign.error).toBe(unknown.error)

    const foreignRename = await renameUserCard(cardId, 'Renamed by a stranger', version, null)
    const unknownRename = await renameUserCard(unknownId, 'Renamed by a stranger', version, null)
    expect(foreignRename.code).toBe('not_found')
    expect(foreignRename.error).toBe(unknownRename.error)
  })

  it('refuses at the schema to overwrite a card without stating a version', async () => {
    const cardId = await saveNewCard()
    // The last line of defence, and the one that makes the guard non-optional: a caller that
    // simply omits the token cannot reach the update at all.
    expect(() => cardRequest({ cardId })).toThrow(/content version/i)
  })
})

describe('a revision records the card’s full identity', () => {
  it('carries the procedure and scenario, not just the editable metadata', async () => {
    const cardId = await saveNewCard()
    const [revision] = await listCardRevisions(cardId)
    const card = tables.cards.find((row) => row.id === cardId)!

    expect(revision.procedureCode).toBe(card.procedure_code)
    expect(revision.scenarioId).toBe(card.scenario_id)
    expect(revision.scenarioId).toBe(SCENARIO_ID)
  })

  it('reports them as the reviewed revision’s own, in the reconciliation source', async () => {
    const cardId = await saveNewCard()
    const result = await reconcileSavedCard(cardId)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const [revision] = await listCardRevisions(cardId)
    expect(result.reconciliation.source.procedureCode).toBe(revision.procedureCode)
    expect(result.reconciliation.source.scenarioId).toBe(revision.scenarioId)
  })
})
