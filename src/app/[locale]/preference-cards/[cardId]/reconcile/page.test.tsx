import { render, screen } from '@testing-library/react'

import { FakePreferenceCardTables } from '@/features/preference-cards/__fixtures__/fake-preference-card-tables'
import {
  defaultBuildInput,
  getScenarioDefinition,
} from '@/features/preference-cards/data/demo-context.server'
import { getCurrentReleaseBundleForScenario } from '@/features/preference-cards/data/release-bundles.server'
import {
  BUILDER_INPUTS_SCHEMA_VERSION,
  saveCardRequestSchema,
} from '@/features/preference-cards/schemas/saved-card'
import { saveUserCard } from '@/features/preference-cards/server/user-cards'

class NotFoundError extends Error {
  constructor() {
    super('NEXT_NOT_FOUND')
  }
}

jest.mock('next/navigation', () => ({
  notFound: () => {
    throw new NotFoundError()
  },
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/lib/supabase/server', () => ({
  supabaseServer: jest.fn(),
}))

const { supabaseServer } = jest.requireMock('@/lib/supabase/server') as {
  supabaseServer: jest.Mock
}

const ReconcilePreferenceCardPage = (jest.requireActual('./page') as typeof import('./page'))
  .default

/**
 * The reconciliation route, rendered.
 *
 * It sits behind the signed-in preference-cards layout, so this is the verification that
 * actually runs it — the page is a server component and `render(await Page(...))` is how this
 * repository exercises those.
 *
 * The assertion that matters most is the last one: the page offers no control that could change
 * the card. A review page that grew an "apply" button would still pass every other test here.
 */

const SCENARIO_ID = 'ebus-rose-molecular'
const OWNER = 'user-owner'
const OTHER_USER = 'user-other'

const tables = new FakePreferenceCardTables()

beforeEach(() => {
  tables.reset(OWNER)
  supabaseServer.mockResolvedValue(tables.client())
})

async function saveCard(): Promise<string> {
  const scenario = getScenarioDefinition(SCENARIO_ID)!
  const release = getCurrentReleaseBundleForScenario(SCENARIO_ID)!
  const result = await saveUserCard(
    saveCardRequestSchema.parse({
      schemaVersion: BUILDER_INPUTS_SCHEMA_VERSION,
      releaseBundleId: release.id,
      scenarioId: SCENARIO_ID,
      title: 'Dr Miller EBUS with ROSE',
      physicianName: 'R. Miller',
      status: 'draft',
      catalogPicks: [],
      familyPicks: [],
      customItems: [],
      equipmentSets: [],
      input: { ...defaultBuildInput(SCENARIO_ID), recipeVersionId: scenario.recipeVersionId },
    }),
  )
  expect(result.ok).toBe(true)
  return result.data as string
}

async function renderPage(cardId: string) {
  const ui = await ReconcilePreferenceCardPage({
    params: Promise.resolve({ locale: 'en', cardId }),
  })
  return render(ui)
}

it('renders the review for a card the caller owns', async () => {
  const cardId = await saveCard()
  await renderPage(cardId)

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dr Miller EBUS with ROSE')
  expect(screen.getByText(/read-only review/i)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /the state being reviewed/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /current hospital-local data/i })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: /authored release/i })).toBeInTheDocument()
})

it('names the revision it reviewed and lists the card’s saved states', async () => {
  const cardId = await saveCard()
  await renderPage(cardId)

  expect(screen.getByRole('heading', { name: /saved states/i })).toBeInTheDocument()
  expect(screen.getByText('Revision 1')).toBeInTheDocument()
  expect(screen.getByText('Current')).toBeInTheDocument()
})

it('reports a freshly saved card as unchanged on both axes', async () => {
  const cardId = await saveCard()
  await renderPage(cardId)

  expect(screen.getByText(/produces the card you saved/i)).toBeInTheDocument()
  expect(
    screen.getByText(/pinned to the release this procedure currently points at/i),
  ).toBeInTheDocument()
})

it('offers nothing that could change the card', async () => {
  const cardId = await saveCard()
  const { container } = await renderPage(cardId)

  // No form, so no server action; no submit control, so nothing to press. The one link on the
  // page goes back to the card. This is the phase's central constraint expressed as markup.
  expect(container.querySelector('form')).toBeNull()
  expect(screen.queryAllByRole('button')).toHaveLength(0)
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    `/en/preference-cards/${cardId}`,
  ])
  expect(screen.getByText(/does not rebuild this card/i)).toBeInTheDocument()
})

it('is a 404 for a card belonging to someone else', async () => {
  const cardId = await saveCard()
  tables.currentUserId = OTHER_USER

  await expect(renderPage(cardId)).rejects.toThrow(NotFoundError)
})

it('is a 404 for a malformed card id, without reaching the database', async () => {
  await expect(renderPage('not-a-uuid')).rejects.toThrow(NotFoundError)
})
