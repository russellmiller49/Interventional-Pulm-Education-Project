import { render, screen } from '@testing-library/react'

import {
  defaultBuildInput,
  getScenarioDefinition,
} from '@/features/preference-cards/data/demo-context.server'
import { builderInputsSchema } from '@/features/preference-cards/schemas/saved-card'
import { rebuildBuilderContext } from '@/features/preference-cards/server/rebuild-builder-context'
import type {
  EditableUserCardResult,
  UserCardRecord,
} from '@/features/preference-cards/server/user-cards'

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

jest.mock('@/features/preference-cards/server/user-cards', () => ({
  loadEditableUserCard: jest.fn(),
}))

jest.mock('@/app/[locale]/preference-cards/new/actions', () => ({
  saveUserCardAction: jest.fn(),
}))

const { loadEditableUserCard } = jest.requireMock(
  '@/features/preference-cards/server/user-cards',
) as { loadEditableUserCard: jest.Mock }

const EditPreferenceCardPage = (jest.requireActual('./page') as typeof import('./page')).default

/**
 * The edit route's own decisions, which no other test covers: what is a 404, what is an
 * explanation, and what actually reaches the builder.
 *
 * The distinction that matters most is the first one — a card belonging to someone else and
 * a card that does not exist have to be indistinguishable, or an id becomes a probe.
 */

const SCENARIO_ID = 'ebus-rose-molecular'
const CARD_ID = '00000000-0000-4000-8000-000000000001'

async function renderPage(cardId = CARD_ID) {
  const ui = await EditPreferenceCardPage({
    params: Promise.resolve({ locale: 'en', cardId }),
  })
  return render(ui)
}

function editableFixture(): EditableUserCardResult {
  const scenario = getScenarioDefinition(SCENARIO_ID)!
  const builderInputs = builderInputsSchema.parse({
    scenarioId: SCENARIO_ID,
    input: { ...defaultBuildInput(SCENARIO_ID), recipeVersionId: scenario.recipeVersionId },
    catalogPicks: [],
    familyPicks: [],
    customItems: [],
    equipmentSets: [],
  })
  const rebuilt = rebuildBuilderContext(builderInputs, '2026-07-30T12:00:00.000Z')
  if (!rebuilt.ok) throw new Error('fixture did not rebuild')

  return {
    ok: true,
    record: {
      id: CARD_ID,
      title: 'Dr Miller EBUS',
      physicianName: 'R. Miller',
      status: 'draft',
      editable: true,
    } as unknown as UserCardRecord,
    builderInputs,
    rebuilt,
  }
}

beforeEach(() => {
  loadEditableUserCard.mockReset()
})

describe('the edit route', () => {
  it('404s a malformed id without looking anything up', async () => {
    await expect(renderPage('not-a-uuid')).rejects.toThrow('NEXT_NOT_FOUND')
    expect(loadEditableUserCard).not.toHaveBeenCalled()
  })

  it('404s a card that is not the caller’s, the same as one that does not exist', async () => {
    loadEditableUserCard.mockResolvedValue({ ok: false, code: 'not_found' })
    await expect(renderPage()).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('explains a legacy card rather than failing it', async () => {
    loadEditableUserCard.mockResolvedValue({ ok: false, code: 'legacy_builder_inputs' })
    await renderPage()

    expect(screen.getByText('This card cannot be reopened in the builder')).toBeInTheDocument()
    expect(screen.getByText(/created with an earlier builder version/)).toBeInTheDocument()
    // Nothing here suggests the card is damaged.
    expect(screen.getByText(/saved card itself is unchanged/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to card' })).toHaveAttribute(
      'href',
      `/en/preference-cards/${CARD_ID}`,
    )
  })

  it.each([
    ['recipe_version_unavailable', /pinned to a recipe version that is no longer published/],
    ['recipe_module_unavailable', /no longer published at the version the card recorded/],
    ['module_not_offered', /no longer published at the version the card recorded/],
    ['unknown_scenario', /procedure this card was built for is no longer published/],
    ['catalog_pick_unavailable', /can no longer be reconstructed from the catalog/],
    ['product_family_unavailable', /can no longer be reconstructed from the catalog/],
    ['equipment_set_unavailable', /can no longer be reconstructed from the catalog/],
    ['scenario_recipe_mismatch', /pinned to a recipe version that is no longer published/],
  ])('explains %s without offering the builder', async (code, expected) => {
    loadEditableUserCard.mockResolvedValue({ ok: false, code, message: 'diagnostic detail' })
    await renderPage()

    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(screen.getByText('diagnostic detail')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
  })

  it('mounts the builder in edit mode against the pinned recipe version', async () => {
    loadEditableUserCard.mockResolvedValue(editableFixture())
    await renderPage()

    expect(screen.getByText(/Editing/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cancel and return to card' })).toHaveAttribute(
      'href',
      `/en/preference-cards/${CARD_ID}`,
    )
    // The procedure picker is replaced, not merely hidden.
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument()
  })
})
