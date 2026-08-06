import { render, screen } from '@testing-library/react'

import type { StoredRebuildProvenance } from '@/features/preference-cards/schemas/card-rebuild'
import type { UserCardRecord } from '@/features/preference-cards/server/user-cards'

/**
 * What a rebuilt card says about itself.
 *
 * `reviewed-rebuild.md` promised that the card page identifies a rebuilt card, shows the source
 * identifiers and hashes and the reviewed decisions, and says when the source revision is no longer
 * available. None of it existed: the card loader did not select `rebuild_provenance` at all, so the
 * page could not tell a rebuilt card from an ordinary one. The documented behaviour and the code
 * disagreed, and only the tests could have caught that — the existing coverage inspected raw
 * fake-table JSON after a deletion and never rendered anything.
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
}))

jest.mock('@/features/preference-cards/server/user-cards', () => ({ loadUserCard: jest.fn() }))
jest.mock('@/features/preference-cards/server/card-revisions', () => ({
  loadCurrentCardRevision: jest.fn(),
}))
jest.mock('@/features/preference-cards/components/PreferenceCardViews', () => ({
  PreferenceCardTabs: () => null,
}))
jest.mock('@/features/preference-cards/components/GeneratedCardHeader', () => ({
  GeneratedCardHeader: () => null,
}))
jest.mock('@/features/preference-cards/components/CardRowActions', () => ({
  CardRowActions: () => null,
}))

const GeneratedPreferenceCardPage = (jest.requireActual('./page') as typeof import('./page'))
  .default

const { loadUserCard } = jest.requireMock('@/features/preference-cards/server/user-cards') as {
  loadUserCard: jest.Mock
}
const { loadCurrentCardRevision } = jest.requireMock(
  '@/features/preference-cards/server/card-revisions',
) as { loadCurrentCardRevision: jest.Mock }

const CARD_ID = '00000000-0000-4000-8000-000000000002'
const SOURCE_CARD_ID = '00000000-0000-4000-8000-000000000001'
const SOURCE_REVISION_ID = '00000000-0000-4000-9000-000000000001'
const OWNER_ID = '00000000-0000-4000-a000-000000000001'

const PROVENANCE: StoredRebuildProvenance = {
  version: 'ip-cards-rebuild/1',
  sourceCardId: SOURCE_CARD_ID,
  sourceRevisionId: SOURCE_REVISION_ID,
  sourceOwnerId: OWNER_ID,
  sourceRevisionNumber: 3,
  sourceReleaseBundleId: 'release-fixture-procedure-v1-0',
  sourceReleaseDefinitionHash: 'e'.repeat(64),
  sourceSnapshotHash: 'a'.repeat(64),
  sourceSnapshotIntegrityHash: 'b'.repeat(64),
  sourceResolvedContentHash: 'c'.repeat(64),
  sourcePrintDocumentHash: 'd'.repeat(64),
  targetReleaseBundleId: 'release-fixture-procedure-v1-1',
  targetReleaseDefinitionHash: 'f'.repeat(64),
  targetCatalogReleaseId: 'fixture-catalog-import-0001',
  operationalReconciliationHash: '2'.repeat(64),
  authoredReleaseDiffHash: '3'.repeat(64),
  mappingPlanHash: '1'.repeat(64),
  allowedFinalStateHash: '4'.repeat(64),
  decisions: [
    {
      key: 'requirement:FIXTURE_BACKUP_SCOPE',
      kind: 'requirement',
      state: 'carried_requires_review',
      reasonCodes: ['requirement_definition_changed'],
      acknowledgement: 'confirmed',
    },
    {
      key: 'requirement:FIXTURE_PRIMARY_SCOPE',
      kind: 'requirement',
      state: 'carried_unchanged',
      reasonCodes: ['requirement_unchanged'],
      acknowledgement: null,
    },
  ],
  createdAt: '2026-02-01T00:00:00.000Z',
}

function record(overrides: Partial<UserCardRecord> = {}): UserCardRecord {
  return {
    id: CARD_ID,
    title: 'Fixture card (rebuilt)',
    physicianName: 'R. Miller',
    procedureCode: 'FIXTURE_PROCEDURE',
    scenarioId: 'fixture-procedure',
    status: 'draft',
    readinessState: 'complete',
    shareEnabled: false,
    shareToken: 'token-rebuilt',
    updatedAt: '2026-02-01T00:00:00.000Z',
    createdAt: '2026-02-01T00:00:00.000Z',
    editable: true,
    card: {} as never,
    builderInputs: null,
    rebuildProvenance: { state: 'none' },
    ...overrides,
  }
}

async function renderPage() {
  const ui = await GeneratedPreferenceCardPage({
    params: Promise.resolve({ locale: 'en', cardId: CARD_ID }),
  })
  return render(ui)
}

beforeEach(() => {
  loadCurrentCardRevision.mockResolvedValue(null)
})

it('says nothing about a rebuild on a card that was not one', async () => {
  loadUserCard.mockResolvedValue(record())
  await renderPage()
  expect(screen.queryByText(/How this card was created/i)).toBeNull()
})

it('identifies a rebuilt card and links back while the source is there', async () => {
  loadUserCard.mockImplementation(async (id: string) =>
    id === CARD_ID
      ? record({ rebuildProvenance: { state: 'valid', provenance: PROVENANCE } })
      : record({ id: SOURCE_CARD_ID }),
  )
  const { container } = await renderPage()

  expect(screen.getByText(/How this card was created/i)).toBeInTheDocument()
  expect(
    screen.getByText(/Built from revision 3 of a card that is still here/i),
  ).toBeInTheDocument()
  expect(
    container.querySelector(`a[href="/en/preference-cards/${SOURCE_CARD_ID}/reconcile"]`),
  ).not.toBeNull()
  // The hashes it was reviewed against, and the answers that were given.
  expect(screen.getByText('1'.repeat(64))).toBeInTheDocument()
  expect(screen.getByText('requirement:FIXTURE_BACKUP_SCOPE')).toBeInTheDocument()
  expect(screen.getByText('confirmed')).toBeInTheDocument()
  // A decision nobody had to answer is not listed as though somebody did.
  expect(screen.queryByText('requirement:FIXTURE_PRIMARY_SCOPE')).toBeNull()
})

it('says the revision is gone once the source card is deleted, and claims nothing more', async () => {
  loadUserCard.mockImplementation(async (id: string) =>
    id === CARD_ID
      ? record({ rebuildProvenance: { state: 'valid', provenance: PROVENANCE } })
      : null,
  )
  const { container } = await renderPage()

  expect(screen.getByText(/has since been deleted/i)).toBeInTheDocument()
  expect(screen.getByText(/cannot be recovered from this record/i)).toBeInTheDocument()
  // No link, because there is nothing behind it. A 404 is not an explanation.
  expect(
    container.querySelector(`a[href="/en/preference-cards/${SOURCE_CARD_ID}/reconcile"]`),
  ).toBeNull()
  // The tombstone still says exactly what was reviewed.
  expect(screen.getByText('1'.repeat(64))).toBeInTheDocument()
  expect(screen.getByText('a'.repeat(64))).toBeInTheDocument()
  expect(screen.getByText('requirement:FIXTURE_BACKUP_SCOPE')).toBeInTheDocument()
})

it('says a rebuild record it cannot read is unreadable, never that there is none', async () => {
  // The two used to share a representation: a failed parse became `null`, which is the exact value
  // an ordinary card carries. A row holding the strongest claim in the schema was then presented as
  // a card that was never rebuilt — evidence that cannot be read silently becoming no evidence.
  loadUserCard.mockResolvedValue(
    record({ rebuildProvenance: { state: 'invalid', issues: ['sourceOwnerId: invalid_type'] } }),
  )
  await renderPage()
  expect(screen.getByText(/rebuild record cannot be read/i)).toBeInTheDocument()
  expect(screen.getByText(/remains fully usable/i)).toBeInTheDocument()
  // And no decoded claim from a document that did not parse.
  expect(screen.queryByText(/How this card was created/i)).toBeNull()
})
