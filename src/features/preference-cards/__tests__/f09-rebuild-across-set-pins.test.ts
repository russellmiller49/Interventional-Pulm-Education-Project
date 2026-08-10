import { allowedAcknowledgements } from '../domain/card-rebuild-plan'
import { resolveCard } from '../domain/resolve-card'
import { stableStringify } from '../domain/stable-hash'
import type { BuilderInputs } from '../schemas/saved-card'
import { FakePreferenceCardTables } from '../__fixtures__/fake-preference-card-tables'

/**
 * The reviewed rebuild across two releases with different definition-set pins — against the
 * REAL retained release data, not the synthetic fixture world.
 *
 * `card-rebuild.test.ts` mocks the release layer because, when it was written, production had
 * exactly one release per procedure and no card could cross between two. F-09 ended that:
 * `release-therapeutic-bronch-v1-1` pins the original modifier set (the ledger-retained one)
 * and `release-therapeutic-bronch-v1-2` pins the corrected one. A rebuild across that pair is
 * the first real cross-set-pin rebuild, and what it must NOT do is substitute either set for
 * the other: the source side expands the retained set (rigid applicator required), the target
 * side expands the live set (conditional), and the difference surfaces as a review rather
 * than being silently normalized.
 *
 * Only the persistence boundary is mocked (Supabase client, privileged writer). The release
 * bundles, the definition-set ledger, composition expansion, resolution, and planning all run
 * for real.
 */

jest.mock('@/lib/supabase/server', () => ({ supabaseServer: jest.fn() }))
jest.mock('../server/rebuild-writer.server', () => ({ writeRebuiltCard: jest.fn() }))

import { buildReleaseContext, getReleaseBundle } from '../data/release-bundles.server'
import { defaultBuildInput } from '../data/demo-context.server'
import { prepareCardRebuild, createRebuiltCard } from '../server/rebuild-card'

const { supabaseServer } = jest.requireMock('@/lib/supabase/server') as {
  supabaseServer: jest.Mock
}
const { writeRebuiltCard } = jest.requireMock('../server/rebuild-writer.server') as {
  writeRebuiltCard: jest.Mock
}

const OWNER = '00000000-0000-4000-a000-000000000001'
const OLD_RELEASE = 'release-therapeutic-bronch-v1-1'
const NEW_RELEASE = 'release-therapeutic-bronch-v1-2'
const SCENARIO_ID = 'central-airway-obstruction'
const REVISION_ID = '00000000-0000-4000-9000-000000000801'

const tables = new FakePreferenceCardTables()

/** A real card: the demo THERAPEUTIC_BRONCH selection, resolved under the OLD release. */
function seedOldReleaseCard() {
  const release = buildReleaseContext(OLD_RELEASE)
  if (!release.ok) throw new Error(`old release did not resolve: ${release.code}`)
  const input = defaultBuildInput(SCENARIO_ID)
  const card = resolveCard(
    { ...input, variables: { generated_at: '2026-08-01T00:00:00.000Z' } },
    release.context,
  )
  const inputs: BuilderInputs = {
    schemaVersion: 4,
    releaseBundleId: OLD_RELEASE,
    scenarioId: SCENARIO_ID,
    input: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      locationId: input.locationId,
      recipeVersionId: 'recipe-therapeutic-bronch-v0-2',
      selectedModuleVersionIds: input.selectedModuleVersionIds,
      modifierCodes: input.modifierCodes,
      variables: { generated_at: '2026-08-01T00:00:00.000Z' },
      selectionsAreExplicit: true,
      selectedHospitalItemIds: { ...input.selectedHospitalItemIds },
      conditionalStates: {},
    },
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
  } as BuilderInputs

  tables.cards.push({
    id: tables.cardId(800),
    user_id: OWNER,
    title: 'CAO card on the superseded release',
    physician_name: 'R. Miller',
    procedure_code: 'THERAPEUTIC_BRONCH',
    scenario_id: SCENARIO_ID,
    status: 'draft',
    builder_inputs: inputs,
    card_snapshot: card,
    snapshot_hash: card.snapshotHash,
    engine_version: card.engineVersion,
    catalog_import_id: card.catalogImportId,
    share_enabled: false,
    share_token: 'token-f09-source',
    rebuild_provenance: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  })
  tables.revisions.push({
    id: REVISION_ID,
    card_id: tables.cardId(800),
    user_id: OWNER,
    revision_number: 1,
    title: 'CAO card on the superseded release',
    physician_name: 'R. Miller',
    status: 'draft',
    procedure_code: 'THERAPEUTIC_BRONCH',
    scenario_id: SCENARIO_ID,
    builder_inputs: inputs,
    card_snapshot: card,
    snapshot_hash: card.snapshotHash,
    snapshot_integrity_hash: card.snapshotIntegrityHash,
    resolved_content_hash: card.resolvedContentHash,
    engine_version: card.engineVersion,
    release_bundle_id: OLD_RELEASE,
    catalog_release_id: card.resolutionProvenance.catalogReleaseId,
    created_at: '2026-08-01T00:00:00.000Z',
    created_by: OWNER,
  })
  return { cardId: tables.cardId(800), revisionId: REVISION_ID, sourceCard: card }
}

beforeEach(() => {
  tables.reset(OWNER)
  supabaseServer.mockResolvedValue(tables.client())
  writeRebuiltCard.mockImplementation(
    async (write: Parameters<typeof tables.createRebuiltCard>[0]) => {
      const result = tables.createRebuiltCard(write)
      if (result.ok) return { ok: true, cardId: result.cardId }
      if (result.code !== 'source_moved') {
        return { ok: false, code: 'write_failed', message: `provenance rejected: ${result.code}` }
      }
      return { ok: false, code: 'source_moved', message: 'source moved' }
    },
  )
})

describe('rebuilding a card from the old modifier set onto the new one', () => {
  it('plans from the pinned source release onto the pointer target, both resolving', async () => {
    const { cardId, revisionId } = seedOldReleaseCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.preparation.sourceReleaseBundle.id).toBe(OLD_RELEASE)
    expect(prepared.preparation.targetReleaseBundle.id).toBe(NEW_RELEASE)
    // The two releases really do pin different modifier sets — the point of this suite.
    expect(getReleaseBundle(OLD_RELEASE)!.modifierSetPin.definitionHash).not.toBe(
      getReleaseBundle(NEW_RELEASE)!.modifierSetPin.definitionHash,
    )
  })

  it('surfaces the APC change for review rather than silently normalizing either set', async () => {
    const { cardId, revisionId } = seedOldReleaseCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(`preparation failed: ${prepared.code}`)

    const apcRequirementDecision = prepared.preparation.plan.decisions.find(
      (decision) => decision.kind === 'requirement' && decision.requirementKey === 'OPS-APC-RIGID',
    )
    expect(apcRequirementDecision).toBeDefined()
    if (apcRequirementDecision?.kind !== 'requirement') return
    // The source expansion said required (retained set); the target says conditional with the
    // new dependency rule (live set). That is a definition change the physician reviews.
    expect(apcRequirementDecision.changedDefinitionFields).toEqual(
      expect.arrayContaining(['requiredness', 'dependencyRule']),
    )
    expect(apcRequirementDecision.state).toBe('carried_requires_review')
  })

  it('creates a separate draft pinned to the new release and leaves the source untouched', async () => {
    const { cardId, revisionId } = seedOldReleaseCard()
    const prepared = await prepareCardRebuild(cardId, revisionId)
    if (!prepared.ok) throw new Error(`preparation failed: ${prepared.code}`)
    const acknowledgements: Record<string, 'confirmed' | 'dropped' | 'acknowledged_unresolved'> = {}
    for (const decision of prepared.preparation.plan.decisions) {
      if (!decision.requiresExplicitConfirmation) continue
      acknowledgements[decision.key] = allowedAcknowledgements(decision)[0]
    }

    const sourceCardBefore = stableStringify(tables.cards.find((row) => row.id === cardId))
    const sourceRevisionsBefore = stableStringify(
      tables.revisions.filter((row) => row.card_id === cardId),
    )

    const result = await createRebuiltCard({
      cardId,
      revisionId,
      selection: prepared.preparation.selection,
      planHash: prepared.preparation.planHash,
      acknowledgements,
      title: 'CAO card (rebuilt onto v1-2)',
      physicianName: 'R. Miller',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(stableStringify(tables.cards.find((row) => row.id === cardId))).toBe(sourceCardBefore)
    expect(stableStringify(tables.revisions.filter((row) => row.card_id === cardId))).toBe(
      sourceRevisionsBefore,
    )

    const created = tables.cards.find((row) => row.id === result.cardId)!
    const createdInputs = created.builder_inputs as BuilderInputs
    expect(createdInputs.releaseBundleId).toBe(NEW_RELEASE)
    expect(createdInputs.schemaVersion).toBe(4)
    expect(created.status).toBe('draft')
    const provenance = created.rebuild_provenance as Record<string, unknown>
    expect(provenance.sourceReleaseBundleId).toBe(OLD_RELEASE)
    expect(provenance.targetReleaseBundleId).toBe(NEW_RELEASE)

    // The created card resolves under the new release with the corrected semantics.
    const snapshot = created.card_snapshot as {
      items: Array<{ id: string; requiredness: string; dependencyRule: string | null }>
    }
    const rigidApplicator = snapshot.items.find((item) => item.id === 'OPS-APC-RIGID')!
    expect(rigidApplicator.requiredness).toBe('conditional')
    expect(rigidApplicator.dependencyRule).toBe('Rigid system in use')
  })
})
