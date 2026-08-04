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
        ],
        proposedInputs: {} as never,
        blockingCount: 0,
        reviewCount: 1,
      },
      planHash: '1'.repeat(64),
      operational: { ok: true, delta: { identical: true } as never },
      release: { ok: false, code: 'release_unknown', message: 'not compared' },
      operationalHash: '2'.repeat(64),
      releaseDiffHash: '3'.repeat(64),
    },
  }
}

async function renderPage(
  searchParams: Record<string, string> = { revision: REVISION_ID },
  cardId = CARD_ID,
) {
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
  // One decision requires review and offers confirm-or-drop; the unchanged one asks nothing.
  expect(radios).toHaveLength(2)
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

it('shows why a submitted review was refused, and keeps the decisions on screen', async () => {
  await renderPage({
    revision: REVISION_ID,
    error: 'review_incomplete',
    unanswered: 'requirement:FIXTURE_BACKUP_SCOPE',
  })
  expect(
    screen.getByText(/has to be answered before a new card can be created/i),
  ).toBeInTheDocument()
  expect(screen.getByText('FIXTURE_BACKUP_SCOPE')).toBeInTheDocument()
})
