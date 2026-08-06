import { render, screen } from '@testing-library/react'

import type { CardRebuildPreparationResult } from '@/features/preference-cards/server/rebuild-card'

/**
 * The rebuild route, and the ways it refuses.
 *
 * The mirror image of the reconciliation route's central assertion. That page is proved to offer
 * *nothing* that could change a card; this one is proved to offer exactly one thing — a submit that
 * creates a separate new card — and to say in words that the original is untouched. A page that
 * grew a second write, or lost the sentence, would still pass every other test here.
 *
 * Ownership is not asserted by mocking an auth check, because there is not one: `/preference-cards`
 * is deliberately public-unlisted and row-level security inside the loader is what scopes a card to
 * its owner. What the route owes is that `not_found` becomes a 404, so a foreign card id and an
 * invented one are indistinguishable — which is what the 404 tests below pin.
 */

class NotFoundError extends Error {
  constructor() {
    super('NEXT_NOT_FOUND')
  }
}

jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundError()
  },
  redirect: jest.fn(),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/features/preference-cards/server/rebuild-card', () => ({
  prepareCardRebuild: jest.fn(),
}))

jest.mock('./actions', () => ({ createRebuiltCardAction: jest.fn() }))

const RebuildPreferenceCardPage = (jest.requireActual('./page') as typeof import('./page')).default

const { prepareCardRebuild } = jest.requireMock(
  '@/features/preference-cards/server/rebuild-card',
) as { prepareCardRebuild: jest.Mock }

const CARD_ID = '00000000-0000-4000-8000-000000000001'
const REVISION_ID = '00000000-0000-4000-9000-000000000001'

function preparation(): CardRebuildPreparationResult {
  return {
    ok: true,
    preparation: {
      record: {
        id: CARD_ID,
        title: 'Fixture card',
        physicianName: 'R. Miller',
        procedureCode: 'FIXTURE_PROCEDURE',
        scenarioId: 'fixture-procedure',
        status: 'draft',
        readinessState: 'complete',
        shareEnabled: false,
        shareToken: 'token-source',
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        editable: true,
        card: {} as never,
        builderInputs: null,
        rebuildProvenance: null,
      },
      revision: {
        id: REVISION_ID,
        cardId: CARD_ID,
        revisionNumber: 1,
        title: 'Fixture card',
        physicianName: 'R. Miller',
        status: 'draft',
        procedureCode: 'FIXTURE_PROCEDURE',
        scenarioId: 'fixture-procedure',
        snapshotHash: 'a'.repeat(64),
        snapshotIntegrityHash: 'b'.repeat(64),
        resolvedContentHash: 'c'.repeat(64),
        printDocumentHash: 'd'.repeat(64),
        engineVersion: 'fixture',
        releaseBundleId: 'release-fixture-procedure-v1-0',
        catalogReleaseId: 'fixture-catalog-import-0001',
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'user-owner',
        cardSnapshot: {} as never,
        builderInputs: null,
      },
      sourceReleaseBundle: { id: 'release-fixture-procedure-v1-0' } as never,
      targetReleaseBundle: { id: 'release-fixture-procedure-v1-1' } as never,
      selection: { moduleVersionIds: ['module-fixture-core-v1-1'], modifierCodes: [] },
      plan: {
        version: 'ip-cards-rebuild-plan/1',
        source: {
          cardId: CARD_ID,
          revisionId: REVISION_ID,
          revisionNumber: 1,
          schemaVersion: 4,
          releaseBundleId: 'release-fixture-procedure-v1-0',
          releaseDefinitionHash: 'e'.repeat(64),
          catalogReleaseId: 'fixture-catalog-import-0001',
          snapshotHash: 'a'.repeat(64),
          snapshotIntegrityHash: 'b'.repeat(64),
          resolvedContentHash: 'c'.repeat(64),
        },
        target: {
          releaseBundleId: 'release-fixture-procedure-v1-1',
          releaseDefinitionHash: 'f'.repeat(64),
          catalogReleaseId: 'fixture-catalog-import-0001',
          scenarioId: 'fixture-procedure',
          recipeVersionId: 'recipe-fixture-procedure-v1-1',
          sourceProcedureCode: 'FIXTURE_PROCEDURE',
        },
        comparisons: { operationalHash: '2'.repeat(64), releaseDiffHash: '3'.repeat(64) },
        targetResolution: {
          ok: true,
          readinessState: 'complete_with_warnings',
          items: [],
          warnings: [
            {
              code: 'compatibility_failed',
              severity: 'blocking',
              sourceType: 'compatibility_rule',
              sourceId: 'rule-1',
            },
          ],
        },
        decisions: [
          {
            key: 'requirement:FIXTURE_BACKUP_SCOPE',
            kind: 'requirement',
            requirementKey: 'FIXTURE_BACKUP_SCOPE',
            state: 'carried_requires_review',
            reasonCodes: ['requirement_definition_changed'],
            requiresExplicitConfirmation: true,
            blocking: false,
            source: {
              slotId: 'SLOT-FIXTURE-BACKUP',
              roleCode: 'FIXTURE_ROLE',
              label: 'Backup scope',
              presence: 'active',
              selection: { kind: 'hospital_item', hospitalItemId: 'fixture-item-primary' },
              conditionalState: null,
            },
            target: {
              slotId: 'SLOT-FIXTURE-BACKUP',
              roleCode: 'FIXTURE_ROLE',
              label: 'Backup scope',
              requiredness: 'required',
              allowCustom: false,
              dependencyRule: null,
            },
            changedDefinitionFields: ['requiredness'],
            carriedSelection: { kind: 'hospital_item', hospitalItemId: 'fixture-item-primary' },
            carriedConditionalState: null,
          },
          {
            key: 'requirement:FIXTURE_PRIMARY_SCOPE',
            kind: 'requirement',
            requirementKey: 'FIXTURE_PRIMARY_SCOPE',
            state: 'carried_unchanged',
            reasonCodes: ['requirement_unchanged'],
            requiresExplicitConfirmation: false,
            blocking: false,
            source: null,
            target: {
              slotId: 'SLOT-FIXTURE-PRIMARY',
              roleCode: 'FIXTURE_ROLE',
              label: 'Primary scope',
              requiredness: 'required',
              allowCustom: false,
              dependencyRule: null,
            },
            changedDefinitionFields: [],
            carriedSelection: null,
            carriedConditionalState: null,
          },
          {
            key: 'waiver:unresolved-required-SLOT-FIXTURE-PRIMARY',
            kind: 'waiver',
            state: 'not_carried',
            reasonCodes: ['waiver_never_carries'],
            requiresExplicitConfirmation: true,
            blocking: false,
            warningCode: 'required_role_unresolved',
            warningSourceType: 'slot',
            warningSourceId: 'SLOT-FIXTURE-PRIMARY',
            requirementKey: 'FIXTURE_PRIMARY_SCOPE',
            priorRationale: 'Accepted for this case only.',
            targetWarningId: 'unresolved-required-SLOT-FIXTURE-PRIMARY',
          },
        ],
        proposedInputs: {} as never,
        blockingCount: 0,
        reviewCount: 2,
      },
      planHash: '1'.repeat(64),
      operational: {
        ok: true,
        delta: {
          identical: false,
          items: [
            {
              itemId: 'SLOT-FIXTURE-PRIMARY',
              requirementKey: 'FIXTURE_PRIMARY_SCOPE',
              roleCode: 'FIXTURE_ROLE',
              label: 'Primary scope line that moved',
              beforePresence: 'active',
              afterPresence: 'active',
              changedFields: ['selectedHospitalItemId'],
              before: null,
              after: null,
            },
          ],
          warnings: [],
          readinessState: null,
          governanceState: null,
          otherChangedProjectionKeys: [],
        } as never,
      },
      release: {
        ok: true,
        pinnedReleaseBundleId: 'release-fixture-procedure-v1-0',
        currentReleaseBundleId: 'release-fixture-procedure-v1-1',
        onCurrentRelease: false,
        impact: {
          previousReleaseBundleId: 'release-fixture-procedure-v1-0',
          nextReleaseBundleId: 'release-fixture-procedure-v1-1',
          sourceProcedureCode: 'FIXTURE_PROCEDURE',
          identical: false,
          pinChanges: [],
          requirementChanges: [],
          catalogImportChanged: false,
          resolverContractChanged: false,
        } as never,
        affecting: [
          {
            requirementKey: 'FIXTURE_BACKUP_SCOPE',
            kind: 'changed',
            moduleVersionIds: [],
            changedFields: ['requiredness'],
            onCard: true,
            presence: 'active',
            hasSelection: true,
            label: 'Backup scope',
          },
        ],
      },
      operationalHash: '2'.repeat(64),
      releaseDiffHash: '3'.repeat(64),
      blockers: [],
    },
  }
}

/** Deep-merges nothing; callers replace whole branches, which is all these tests need. */
function preparationWith(
  patch: (base: Extract<CardRebuildPreparationResult, { ok: true }>['preparation']) => void,
): CardRebuildPreparationResult {
  const built = preparation()
  if (!built.ok) throw new Error('fixture must be ok')
  patch(built.preparation)
  return built
}

async function renderPage(
  searchParams: Record<string, string> = { revision: REVISION_ID },
  cardId = CARD_ID,
  prepared?: CardRebuildPreparationResult,
) {
  if (prepared) prepareCardRebuild.mockResolvedValue(prepared)
  const ui = await RebuildPreferenceCardPage({
    params: Promise.resolve({ locale: 'en', cardId }),
    searchParams: Promise.resolve(searchParams),
  })
  return render(ui)
}

beforeEach(() => {
  prepareCardRebuild.mockResolvedValue(preparation())
})

it('renders the review for an owned revision', async () => {
  await renderPage()
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Fixture card/)
  expect(prepareCardRebuild).toHaveBeenCalledWith(CARD_ID, REVISION_ID)
})

it('says in words that the original card is not changed', async () => {
  await renderPage()
  // The claim the whole phase rests on, stated rather than left to be inferred from the absence
  // of a control that edits the source.
  expect(screen.getByText(/not changed, not upgraded, and not re-saved/i)).toBeInTheDocument()
  expect(screen.getByText(/Nothing on this page can change the original card/i)).toBeInTheDocument()
})

it('offers exactly one thing that writes, and it creates a separate card', async () => {
  const { container } = await renderPage()
  expect(container.querySelectorAll('form')).toHaveLength(1)
  const buttons = screen.getAllByRole('button')
  expect(buttons).toHaveLength(1)
  expect(buttons[0]).toHaveAttribute('type', 'submit')
  expect(buttons[0]).toHaveTextContent(/Create the new draft card/i)
})

it('requires an answer for every decision that needs one, and asks for none otherwise', async () => {
  const { container } = await renderPage()
  const radios = container.querySelectorAll('input[type="radio"]')
  // Three: confirm-or-drop for the requirement whose definition moved, and one acknowledgement for
  // the prior waiver. The `carried_unchanged` requirement asks nothing.
  expect(radios).toHaveLength(3)
  for (const radio of radios) expect(radio).toHaveAttribute('required')
  expect(
    container.querySelector('input[name="decision:requirement:FIXTURE_PRIMARY_SCOPE"]'),
  ).toBeNull()
})

it('offers no control that would dispose of every decision at once', async () => {
  await renderPage()
  expect(screen.queryByText(/accept all/i)).toBeNull()
  expect(screen.queryByText(/confirm all/i)).toBeNull()
})

it('quotes the plan hash back so a stale review cannot be applied', async () => {
  const { container } = await renderPage()
  expect(container.querySelector('input[name="planHash"]')).toHaveAttribute('value', '1'.repeat(64))
})

it('404s for a card the caller does not own, exactly as for one that does not exist', async () => {
  prepareCardRebuild.mockResolvedValue({ ok: false, code: 'not_found' })
  await expect(renderPage()).rejects.toThrow(NotFoundError)
})

it('404s before touching the database when the ids are malformed', async () => {
  prepareCardRebuild.mockClear()
  await expect(renderPage({ revision: REVISION_ID }, 'not-a-uuid')).rejects.toThrow(NotFoundError)
  await expect(renderPage({ revision: 'not-a-uuid' })).rejects.toThrow(NotFoundError)
  await expect(renderPage({})).rejects.toThrow(NotFoundError)
  expect(prepareCardRebuild).not.toHaveBeenCalled()
})

it.each([
  ['superseded_builder_inputs', /predates release pinning/i],
  ['legacy_family_identity', /catalogue-browsing key/i],
  ['no_current_release', /Nothing currently points at a release/i],
  ['already_on_current_release', /already pinned to the release/i],
  ['target_release_not_selectable', /draft or has been retired/i],
  ['revision_snapshot_unverifiable', /no longer matches the hash/i],
])('explains why a rebuild is unavailable: %s', async (code, expected) => {
  prepareCardRebuild.mockResolvedValue({ ok: false, code })
  await renderPage()
  expect(screen.getByText(expected)).toBeInTheDocument()
  // An unavailable rebuild offers nothing that writes, and says the source is intact.
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.getByText(/The card itself is unaffected/i)).toBeInTheDocument()
})

it('renders the prior waiver in its own group rather than among removed requirements', async () => {
  const { container } = await renderPage()
  // Every waiver decision is `not_carried` by construction, so a group filtered on
  // `state !== 'not_carried'` matched nothing and the rationale fell into the removed-requirements
  // list, where it read as equipment rather than as a judgement somebody has to make again.
  expect(screen.getByText(/Accepted for this case only/i)).toBeInTheDocument()
  // The group's own help text plus the decision's reason line — the point is that both render at
  // all, which they did not when the group filtered on a state no waiver can have.
  expect(screen.getAllByText(/A waiver is never carried/i).length).toBeGreaterThan(0)
  expect(
    container.querySelector(
      'input[name="decision:waiver:unresolved-required-SLOT-FIXTURE-PRIMARY"]',
    ),
  ).not.toBeNull()
})

it('shows the comparisons its provenance will record', async () => {
  await renderPage()
  expect(screen.getByText(/Hospital-local comparison/i)).toBeInTheDocument()
  expect(screen.getByText(/Authored-release comparison/i)).toBeInTheDocument()
})

it('renders the comparisons themselves, not only their digests', async () => {
  await renderPage()
  // MEDIUM 7: the page used to show sixteen hex characters and call that the comparison, while the
  // card recorded those digests as evidence of what was reviewed.
  expect(screen.getByText(/Primary scope line that moved/i)).toBeInTheDocument()
  // It appears in the authored-release comparison and again as a decision, which is the point.
  expect(screen.getAllByText(/FIXTURE_BACKUP_SCOPE/).length).toBeGreaterThan(1)
  // And the digests remain, as identifiers.
  expect(screen.getByText(/Hospital-local comparison/i)).toBeInTheDocument()
})

it('shows what the new card would resolve to, including a blocking rule', async () => {
  await renderPage()
  expect(screen.getByText(/compatibility_failed/)).toBeInTheDocument()
  expect(screen.getByText(/Readiness of the card this rebuild would create/i)).toBeInTheDocument()
})

it('shows why a submitted review was refused, and keeps the decisions on screen', async () => {
  await renderPage({
    revision: REVISION_ID,
    error: 'review_incomplete',
    unanswered: 'requirement:FIXTURE_BACKUP_SCOPE',
  })
  expect(
    screen.getByText(/has to be answered before a new card can be created/i),
  ).toBeInTheDocument()
  expect(screen.getAllByText('FIXTURE_BACKUP_SCOPE').length).toBeGreaterThan(0)
})

it('gives every promoted decision a control, whatever its state', async () => {
  // The deadlock this test exists for: the final-resolution pass promotes a decision the target
  // rejected, its state stays `carried_unchanged` (or becomes a nonblocking `incompatible`), and
  // the page grouped by state — so neither appeared anywhere with a control. The form submitted
  // without the answer, came back `review_incomplete`, and re-rendered with nothing to answer.
  const { container } = await renderPage(
    { revision: REVISION_ID },
    CARD_ID,
    preparationWith((preparation) => {
      const promoted = preparation.plan.decisions.find(
        (decision) => decision.key === 'requirement:FIXTURE_PRIMARY_SCOPE',
      )!
      if (promoted.kind !== 'requirement') throw new Error('fixture moved')
      promoted.requiresExplicitConfirmation = true
      promoted.reasonCodes = ['target_presence_changed']
      promoted.source = {
        slotId: 'SLOT-FIXTURE-PRIMARY',
        roleCode: 'FIXTURE_ROLE',
        label: 'Primary scope',
        presence: 'suppressed',
        selection: { kind: 'hospital_item', hospitalItemId: 'fixture-item-primary' },
        conditionalState: null,
      }
      promoted.carriedSelection = { kind: 'hospital_item', hospitalItemId: 'fixture-item-primary' }
      preparation.plan.targetResolution.items = [
        {
          requirementKey: 'FIXTURE_PRIMARY_SCOPE',
          slotId: 'SLOT-FIXTURE-PRIMARY',
          roleCode: 'FIXTURE_ROLE',
          presence: 'active',
          selectedHospitalItemId: 'fixture-item-primary',
          resolutionState: 'resolved',
          compatibilityState: 'not_evaluated',
        },
      ]
    }),
  )

  const confirm = container.querySelector(
    'input[name="decision:requirement:FIXTURE_PRIMARY_SCOPE"][value="confirmed"]',
  )
  const drop = container.querySelector(
    'input[name="decision:requirement:FIXTURE_PRIMARY_SCOPE"][value="dropped"]',
  )
  expect(confirm).not.toBeNull()
  expect(drop).not.toBeNull()
  // Exactly once. A decision rendered in two groups would submit two values for one name.
  expect(
    container.querySelectorAll('input[name="decision:requirement:FIXTURE_PRIMARY_SCOPE"]'),
  ).toHaveLength(2)
  // And the reason it is being asked about is on the page, as a concrete transition rather than a
  // readiness word: this line was covered by a kit in the source and is pulled on the new card.
  expect(screen.getByText(/moves from covered by a kit to pulled/i)).toBeInTheDocument()
})

it('renders every decision that needs an answer exactly once, and no quiet one', async () => {
  const { container } = await renderPage()
  const named = [...container.querySelectorAll('input[type="radio"]')].map((input) =>
    input.getAttribute('name'),
  )
  const asked = new Set(named)
  const expected = preparation()
  if (!expected.ok) throw new Error('fixture must be ok')
  for (const decision of expected.preparation.plan.decisions) {
    const name = `decision:${decision.key}`
    expect(asked.has(name)).toBe(decision.requiresExplicitConfirmation)
  }
})

it.each([
  ['operational_comparison_unavailable', /hospital-local data does to this revision/i],
  ['release_comparison_unavailable', /pinned release and the current one/i],
  ['target_projection_unavailable', /could not be resolved under the target release/i],
])('refuses to offer the rebuild when %s', async (blocker, explanation) => {
  // The error was visible and the create button was still under it; a failed comparison hashes
  // deterministically, so the plan hash matched on submit and a card was written citing a
  // comparison nobody could read.
  await renderPage(
    { revision: REVISION_ID },
    CARD_ID,
    preparationWith((preparation) => {
      preparation.blockers = [blocker as never]
    }),
  )
  expect(screen.getByText(/This rebuild cannot be offered right now/i)).toBeInTheDocument()
  expect(screen.getByText(explanation)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Create the new draft card/i })).toBeNull()
})
