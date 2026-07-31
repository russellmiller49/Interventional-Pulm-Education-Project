import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  PreferenceCardWizard,
  type PreferenceCardBuilderInitialState,
} from '../components/PreferenceCardWizard'
import {
  defaultBuildInput,
  getComposedRecipeSlots,
  getScenarioDefinition,
} from '../data/demo-context.server'
import { catalogPickItemId } from '../domain/catalog-pick'
import { customItemId } from '../domain/custom-item'
import { equipmentSetItemId } from '../domain/equipment-set'
import { EQUIPMENT_SETS_STORAGE_KEY } from '../domain/equipment-set'
import { builderInputsSchema } from '../schemas/saved-card'
import { searchProductsForRole } from '../server/catalog'
import { rebuildBuilderContext } from '../server/rebuild-builder-context'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/app/[locale]/preference-cards/new/actions', () => ({
  saveUserCardAction: jest.fn(),
}))

const { saveUserCardAction } = jest.requireMock('@/app/[locale]/preference-cards/new/actions') as {
  saveUserCardAction: jest.Mock
}

/**
 * Reopening a saved card in the builder.
 *
 * These assert on the controls a physician actually sees, because "the state was hydrated"
 * and "the card looks like the one I saved" are different claims and only the second one
 * matters. The rendering here is the same wizard the create flow uses, driven from a
 * server reconstruction built by the same helper the save path runs.
 */

const SCENARIO_ID = 'ebus-rose-molecular'
const CARD_ID = '00000000-0000-4000-8000-000000000001'
const FLEX_CORE = 'module-flex-bronch-core-v1-0'
const EBUS_SPECIFIC = 'module-ebus-tbna-specific-v1-0'
const REBUILT_AT = '2026-07-30T12:00:00.000Z'

function slotIdForRole(roleCode: string): string {
  const slot = getComposedRecipeSlots(SCENARIO_ID).find(
    (candidate) => candidate.roleCode === roleCode,
  )
  if (!slot) throw new Error(`No composed slot for ${roleCode}`)
  return slot.id
}

function needlePick() {
  const roleCode = 'EBUS_NEEDLE_FNA'
  const option = searchProductsForRole({ roleCode, limit: 1 })[0]
  return { productId: option.productId, roleCode }
}

function savedBuilderInputs() {
  const scenario = getScenarioDefinition(SCENARIO_ID)!
  const pick = needlePick()
  return builderInputsSchema.parse({
    scenarioId: SCENARIO_ID,
    input: {
      ...defaultBuildInput(SCENARIO_ID),
      recipeVersionId: scenario.recipeVersionId,
      // Procedural Fluoroscopy is default-on for EBUS and was removed on this card.
      selectedModuleVersionIds: [FLEX_CORE, EBUS_SPECIFIC],
      modifierCodes: ['ROSE', 'SPEC_MOLECULAR'],
      conditionalStates: { [slotIdForRole('EBUS_BALLOON')]: 'exclude' },
      selectedHospitalItemIds: {
        [slotIdForRole('EBUS_NEEDLE_FNA')]: equipmentSetItemId('set-ebus-tray'),
        [slotIdForRole('GENERIC_SPECIMEN')]: customItemId('custom-ebus-1'),
        [slotIdForRole('ULTRASOUND_PROCESSOR')]: catalogPickItemId(pick.productId),
      },
    },
    catalogPicks: [pick],
    familyPicks: [],
    customItems: [
      {
        id: 'custom-ebus-1',
        roleCode: 'GENERIC_SPECIMEN',
        description: 'Locally printed node-station label sheet',
        itemNumber: 'LOC-4412',
        notes: null,
      },
    ],
    equipmentSets: [
      {
        id: 'set-ebus-tray',
        name: 'EBUS needle tray',
        description: 'Standing tray for the EBUS room',
        selectedRoleCode: pick.roleCode,
        additionalCoveredRoles: [],
        members: [pick],
      },
    ],
  })
}

function renderEditWizard(): PreferenceCardBuilderInitialState {
  const builderInputs = savedBuilderInputs()
  // The server's own reconstruction, so the component test cannot pass itself picks the
  // server would have rejected.
  const rebuilt = rebuildBuilderContext(builderInputs, REBUILT_AT)
  if (!rebuilt.ok) throw new Error(`fixture did not rebuild: ${rebuilt.message}`)

  const initialState: PreferenceCardBuilderInitialState = {
    cardId: CARD_ID,
    title: 'Dr Miller EBUS with ROSE',
    physicianName: 'R. Miller',
    status: 'final',
    builderInputs,
    catalogPicks: rebuilt.catalogPicks,
    familyPicks: rebuilt.familyPicks,
    equipmentSets: rebuilt.equipmentSets,
  }

  render(
    <PreferenceCardWizard
      mode="edit"
      scenarios={[]}
      bundle={{
        definition: rebuilt.scenario,
        context: rebuilt.context,
        availableModifierCodes: rebuilt.scenario.availableModifierCodes,
      }}
      initialScenarioId={SCENARIO_ID}
      initialState={initialState}
    />,
  )
  return initialState
}

beforeEach(() => {
  saveUserCardAction.mockReset()
  saveUserCardAction.mockResolvedValue({ ok: true, cardId: CARD_ID })
  window.localStorage.clear()
})

describe('edit mode context', () => {
  it('says which card is being edited and offers a way out without saving', () => {
    renderEditWizard()

    expect(screen.getByText(/Editing/)).toBeInTheDocument()
    const cancel = screen.getByRole('link', { name: 'Cancel and return to card' })
    expect(cancel).toHaveAttribute('href', `/en/preference-cards/${CARD_ID}`)
  })

  it('shows the pinned procedure instead of a procedure picker', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 1 of 5/ }))

    expect(screen.getByText('Procedure (locked)')).toBeInTheDocument()
    expect(screen.getByText('recipe-ebus-tbna-v0-1')).toBeInTheDocument()
    // Nothing here can change what the card is.
    expect(screen.queryByRole('button', { name: 'Select' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start a custom card' })).not.toBeInTheDocument()
  })
})

describe('restoring saved selections', () => {
  it('restores the exact module selection, including a default-on module that was removed', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 2 of 5/ }))

    const fluoroscopy = screen
      .getByRole('heading', { name: 'Procedural Fluoroscopy' })
      .closest('article')!
    // Default-on, but this card removed it — so it reopens offering to add it back.
    expect(within(fluoroscopy).getByRole('button', { name: 'Add module' })).toBeInTheDocument()

    const core = screen
      .getByRole('heading', { name: 'Flexible Bronchoscopy Core' })
      .closest('article')!
    expect(
      within(core).getByText('Required by this procedure and cannot be removed.'),
    ).toBeInTheDocument()
  })

  it('restores the saved modifiers rather than the scenario defaults', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 3 of 5/ }))

    const pressed = screen
      .getAllByRole('button', { pressed: true })
      .map((button) => button.textContent ?? '')
    expect(pressed.some((label) => label.includes('ROSE'))).toBe(true)
    expect(pressed.some((label) => label.includes('SPEC_MOLECULAR'))).toBe(true)
  })

  it('restores the conditional decision, the catalog pick, the custom line, and the set', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 4 of 5/ }))

    const conditionals = screen.getAllByLabelText('Conditional decision') as HTMLSelectElement[]
    expect(conditionals.some((select) => select.value === 'exclude')).toBe(true)

    // The custom line the card recorded is selected on its requirement.
    const specimenSelect = screen.getByLabelText(
      /Select a local option for Slides, cell-block/,
    ) as HTMLSelectElement
    expect(specimenSelect.value).toBe(customItemId('custom-ebus-1'))

    // The set reopens from the card's own copy — localStorage is empty in this test.
    expect(window.localStorage.getItem(EQUIPMENT_SETS_STORAGE_KEY)).toBeNull()
    const needleSelect = screen.getByLabelText(
      /Select a local option for EBUS-TBNA FNA needle/,
    ) as HTMLSelectElement
    expect(needleSelect.value).toBe(equipmentSetItemId('set-ebus-tray'))
  })

  it('restores the title, physician, and draft/final status', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))

    expect(screen.getByLabelText('Card name')).toHaveValue('Dr Miller EBUS with ROSE')
    expect(screen.getByLabelText('Physician')).toHaveValue('R. Miller')
    expect(screen.getByLabelText('Status')).toHaveValue('final')
  })
})

describe('saving changes', () => {
  it('offers nothing to save until something actually changes', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))

    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    expect(screen.getByText('No changes to save yet.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Card name'), ' v2')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })

  it('does not read a selection toggled off and back on as an unsaved change', async () => {
    const user = userEvent.setup()
    renderEditWizard()

    // A module first: adding the removed fluoroscopy module is a real change, and taking it
    // back out returns the card to exactly what was saved.
    // Re-queried each time: leaving the step unmounts the card, so a node held across a
    // step change is detached and clicking it does nothing.
    const fluoroscopyAction = (name: string) =>
      within(
        screen.getByRole('heading', { name: 'Procedural Fluoroscopy' }).closest('article')!,
      ).getByRole('button', { name })

    await user.click(screen.getByRole('button', { name: /Step 2 of 5/ }))
    await user.click(fluoroscopyAction('Add module'))
    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: /Step 2 of 5/ }))
    await user.click(fluoroscopyAction('Remove module'))
    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    // Then a modifier, which is the case that actually reorders the stored array: removing
    // ROSE and re-adding it appends it after SPEC_MOLECULAR. Same card, different order.
    await user.click(screen.getByRole('button', { name: /Step 3 of 5/ }))
    const rose = screen
      .getAllByRole('button', { pressed: true })
      .find((button) => button.textContent?.includes('ROSE'))
    expect(rose).toBeDefined()
    await user.click(rose!)
    await user.click(rose!)

    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('sends the card id so the save overwrites this card instead of creating one', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    await user.type(screen.getByLabelText('Card name'), ' v2')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(saveUserCardAction).toHaveBeenCalledTimes(1)
    const request = saveUserCardAction.mock.calls[0][0]
    expect(request.cardId).toBe(CARD_ID)
    expect(request.schemaVersion).toBe(2)
    expect(request.title).toBe('Dr Miller EBUS with ROSE v2')
    expect(request.status).toBe('final')
    expect(request.input.selectedModuleVersionIds).toEqual([FLEX_CORE, EBUS_SPECIFIC])
    expect(request.input.modifierCodes).toEqual(['ROSE', 'SPEC_MOLECULAR'])
    // The card's own set is resubmitted with the role it was chosen for, even though this
    // browser has no copy of it.
    expect(request.equipmentSets).toEqual([
      expect.objectContaining({ id: 'set-ebus-tray', selectedRoleCode: 'EBUS_NEEDLE_FNA' }),
    ])
    expect(request.customItems).toEqual([expect.objectContaining({ id: 'custom-ebus-1' })])
  })

  /**
   * The saved set list is derived from what the previewed card resolved to, not from a
   * role binding. These are the two ways that used to diverge.
   */
  it('drops a set the physician moved away from, instead of saving it invisibly', async () => {
    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 4 of 5/ }))

    const needleSelect = screen.getByLabelText(
      /Select a local option for EBUS-TBNA FNA needle/,
    ) as HTMLSelectElement
    expect(needleSelect.value).toBe(equipmentSetItemId('set-ebus-tray'))

    // Choose anything that is not the set.
    const other = [...needleSelect.options].find(
      (option) => option.value && option.value !== equipmentSetItemId('set-ebus-tray'),
    )
    expect(other).toBeDefined()
    await user.selectOptions(needleSelect, other!.value)

    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // The set is no longer on the card, so it is no longer saved — otherwise it would keep
    // suppressing the requirements it covers.
    expect(saveUserCardAction.mock.calls[0][0].equipmentSets).toEqual([])
  })

  it('does not save a browser-stored set the card never used', async () => {
    // A reusable set sitting in this browser, offered on the same role the card's own set
    // covers. It may appear as an option; it must not ride along into the saved card.
    window.localStorage.setItem(
      EQUIPMENT_SETS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        sets: [
          {
            id: 'set-someone-elses-tray',
            name: 'Unrelated tray',
            description: null,
            members: [needlePick()],
            additionalCoveredRoles: [],
            createdAt: REBUILT_AT,
            updatedAt: REBUILT_AT,
          },
        ],
      }),
    )

    const user = userEvent.setup()
    renderEditWizard()
    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    await user.type(screen.getByLabelText('Card name'), ' v2')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const saved = saveUserCardAction.mock.calls[0][0].equipmentSets as { id: string }[]
    expect(saved.map((set) => set.id)).toEqual(['set-ebus-tray'])
  })

  it('never sends a card id from the create flow', async () => {
    const user = userEvent.setup()
    const definition = getScenarioDefinition(SCENARIO_ID)!
    const rebuilt = rebuildBuilderContext(savedBuilderInputs(), REBUILT_AT)
    if (!rebuilt.ok) throw new Error('fixture did not rebuild')
    render(
      <PreferenceCardWizard
        scenarios={[definition]}
        bundle={{
          definition,
          context: rebuilt.context,
          availableModifierCodes: definition.availableModifierCodes,
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Step 5 of 5/ }))
    await user.click(screen.getByRole('button', { name: /Generate immutable draft snapshot/ }))

    expect(saveUserCardAction).toHaveBeenCalledTimes(1)
    expect(saveUserCardAction.mock.calls[0][0].cardId).toBeUndefined()
  })
})
