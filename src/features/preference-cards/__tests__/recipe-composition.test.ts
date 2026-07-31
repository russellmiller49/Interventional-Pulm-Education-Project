import {
  defaultSelectedModuleVersionIds,
  effectiveGovernanceState,
  expandRecipeComposition,
} from '../domain/expand-recipe-composition'
import { resolveCard } from '../domain/resolve-card'
import type {
  BuildCardInput,
  BuildContext,
  GovernanceState,
  ModuleSelectionBehavior,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
} from '../domain/types'

/**
 * The composition engine on synthetic modules.
 *
 * Everything here is hand-built rather than loaded from the catalog, because the properties
 * under test — a crafted selection cannot drop a required module, two modules that disagree
 * block instead of one silently winning — are exactly the cases the reviewed seed data is
 * validated never to contain.
 */

function slot(
  overrides: Partial<RecipeSlot> & Pick<RecipeSlot, 'id' | 'requirementKey'>,
): RecipeSlot {
  return {
    sourceSlotId: overrides.id,
    roleCode: 'TEST_ROLE',
    label: `Label ${overrides.id}`,
    genericRequirement: 'A generic requirement.',
    requiredness: 'required',
    dependencyRule: null,
    quantityExpression: { op: 'literal', value: 1 },
    selectionMode: 'single',
    setupZone: 'back_table',
    proceduralPhase: 'diagnostic',
    setupSequence: 1,
    openHoldStatus: 'have_in_room',
    responsibleRole: null,
    sterileStatus: null,
    allowCustom: true,
    notes: null,
    includedBy: 'test',
    ...overrides,
  }
}

function module(
  id: string,
  slots: RecipeSlot[],
  overrides: Partial<RecipeModuleVersion> = {},
): RecipeModuleVersion {
  return {
    id,
    code: id.toUpperCase(),
    name: `Module ${id}`,
    description: `Description for ${id}`,
    version: '1.0',
    kind: 'core',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    catalogImportId: 'test-import',
    slots,
    ...overrides,
  }
}

function recipe(
  references: {
    moduleVersionId: string
    selectionBehavior: ModuleSelectionBehavior
    sequence: number
  }[],
  overrides: Partial<RecipeVersion> = {},
): RecipeVersion {
  return {
    id: 'recipe-test',
    sourceProcedureCode: 'TEST',
    sourceTemplateVersion: '1.0',
    name: 'Test recipe',
    version: '1.0',
    governanceState: 'draft',
    clinicalOwner: null,
    operationalOwner: null,
    catalogImportId: 'test-import',
    slots: [],
    moduleReferences: references,
    compositionActions: [],
    ...overrides,
  }
}

function expand(
  recipeVersion: RecipeVersion,
  modules: RecipeModuleVersion[],
  selectedModuleVersionIds: string[],
) {
  return expandRecipeComposition({
    recipe: recipeVersion,
    modules,
    selectedModuleVersionIds,
    startSequence: 1,
  })
}

describe('recipe composition expansion', () => {
  it('includes a required module even when the submitted selection omits it', () => {
    const modules = [module('core', [slot({ id: 'S1', requirementKey: 'K1' })])]
    const result = expand(
      recipe([{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }]),
      modules,
      [],
    )

    expect(result.includedModules.map((entry) => entry.moduleVersionId)).toEqual(['core'])
    expect(result.includedModules[0].selectionSource).toBe('required')
    expect(result.slots.map((entry) => entry.requirementKey)).toEqual(['K1'])
  })

  it('cannot be talked out of a required module by a crafted selection', () => {
    const modules = [
      module('core', [slot({ id: 'S1', requirementKey: 'K1' })]),
      module('extra', [slot({ id: 'S2', requirementKey: 'K2' })]),
    ]
    const composition = recipe([
      { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
      { moduleVersionId: 'extra', selectionBehavior: 'optional', sequence: 20 },
    ])

    // Selecting only the optional module must not drop the required one.
    const result = expand(composition, modules, ['extra'])
    expect(result.includedModules.map((entry) => entry.moduleVersionId).sort()).toEqual([
      'core',
      'extra',
    ])
  })

  it('honours default-on and optional selection behaviour', () => {
    const modules = [
      module('core', [slot({ id: 'S1', requirementKey: 'K1' })]),
      module('default', [slot({ id: 'S2', requirementKey: 'K2' })]),
      module('opt', [slot({ id: 'S3', requirementKey: 'K3' })]),
    ]
    const composition = recipe([
      { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
      { moduleVersionId: 'default', selectionBehavior: 'default_on', sequence: 20 },
      { moduleVersionId: 'opt', selectionBehavior: 'optional', sequence: 30 },
    ])

    expect(defaultSelectedModuleVersionIds(composition)).toEqual(['core', 'default'])

    const withDefaults = expand(composition, modules, defaultSelectedModuleVersionIds(composition))
    expect(withDefaults.slots.map((entry) => entry.requirementKey)).toEqual(['K1', 'K2'])
    expect(
      withDefaults.includedModules.map(
        (entry) => `${entry.moduleVersionId}:${entry.selectionSource}`,
      ),
    ).toEqual(['core:required', 'default:default'])

    const defaultRemoved = expand(composition, modules, ['core'])
    expect(defaultRemoved.slots.map((entry) => entry.requirementKey)).toEqual(['K1'])

    const optionalAdded = expand(composition, modules, ['core', 'opt'])
    expect(optionalAdded.slots.map((entry) => entry.requirementKey)).toEqual(['K1', 'K3'])
    expect(optionalAdded.includedModules[1].selectionSource).toBe('user_selected')
  })

  it('rejects a module the composition does not offer', () => {
    const modules = [module('core', [slot({ id: 'S1', requirementKey: 'K1' })])]
    const result = expand(
      recipe([{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }]),
      modules,
      ['core', 'smuggled'],
    )

    expect(
      result.messages.find((message) => message.code === 'recipe_composition_unknown_module'),
    ).toMatchObject({ severity: 'blocking', sourceId: 'smuggled' })
    expect(result.slots.map((entry) => entry.requirementKey)).toEqual(['K1'])
  })

  it('blocks when a referenced module version is not loaded', () => {
    const result = expand(
      recipe([{ moduleVersionId: 'missing', selectionBehavior: 'required', sequence: 10 }]),
      [],
      ['missing'],
    )
    expect(
      result.messages.find((message) => message.code === 'recipe_composition_module_missing'),
    ).toMatchObject({ severity: 'blocking' })
  })

  it('orders modules by authored sequence and then by id, whatever order they arrive in', () => {
    const modules = [
      module('bravo', [slot({ id: 'S2', requirementKey: 'K2' })]),
      module('alpha', [slot({ id: 'S1', requirementKey: 'K1' })]),
      module('charlie', [slot({ id: 'S3', requirementKey: 'K3' })]),
    ]
    // bravo and charlie share a sequence, so the id decides.
    const composition = recipe([
      { moduleVersionId: 'charlie', selectionBehavior: 'required', sequence: 20 },
      { moduleVersionId: 'alpha', selectionBehavior: 'required', sequence: 30 },
      { moduleVersionId: 'bravo', selectionBehavior: 'required', sequence: 20 },
    ])

    const forward = expand(composition, modules, [])
    const reversed = expand(composition, [...modules].reverse(), [])

    expect(forward.includedModules.map((entry) => entry.moduleVersionId)).toEqual([
      'bravo',
      'charlie',
      'alpha',
    ])
    expect(reversed.includedModules).toEqual(forward.includedModules)
    expect(reversed.slots).toEqual(forward.slots)
  })

  it('combines module slots and direct procedure slots deterministically', () => {
    const modules = [module('core', [slot({ id: 'S1', requirementKey: 'K1' })])]
    const composition = recipe(
      [{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }],
      { slots: [slot({ id: 'DIRECT', requirementKey: 'KD', setupSequence: 5 })] },
    )
    const result = expand(composition, modules, [])

    expect(result.slots.map((entry) => entry.requirementKey)).toEqual(['K1', 'KD'])
    expect(result.slots[0].sourceModuleVersionIds).toEqual(['core'])
    expect(result.slots[1].sourceModuleVersionIds).toBeUndefined()
    expect(result.slots[1].includedBy).toBe('Included by base recipe Test recipe 1.0')
  })

  it('collapses an identically-authored duplicate requirement key and keeps both provenances', () => {
    const shared = {
      requirementKey: 'SHARED',
      roleCode: 'SHARED_ROLE',
      label: 'Identically authored requirement',
    }
    const modules = [
      module('left', [slot({ id: 'L1', ...shared, setupSequence: 4 })]),
      module('right', [slot({ id: 'R1', ...shared, setupSequence: 9 })]),
    ]
    const result = expand(
      recipe([
        { moduleVersionId: 'left', selectionBehavior: 'required', sequence: 10 },
        { moduleVersionId: 'right', selectionBehavior: 'required', sequence: 10 },
      ]),
      modules,
      [],
    )

    expect(result.slots).toHaveLength(1)
    expect(result.slots[0].sourceModuleVersionIds).toEqual(['left', 'right'])
    expect(result.slots[0].sourceSlotAliases).toEqual(['R1'])
    expect(result.slots[0].includedBy).toBe('Included by Module left v1.0 and Module right v1.0')
    expect(result.messages).toHaveLength(0)
  })

  it('blocks rather than choosing when two modules define one requirement differently', () => {
    const modules = [
      module('left', [slot({ id: 'L1', requirementKey: 'SHARED', label: 'Left label' })]),
      module('right', [slot({ id: 'R1', requirementKey: 'SHARED', label: 'Right label' })]),
    ]
    const result = expand(
      recipe([
        { moduleVersionId: 'left', selectionBehavior: 'required', sequence: 10 },
        { moduleVersionId: 'right', selectionBehavior: 'required', sequence: 20 },
      ]),
      modules,
      [],
    )

    const conflict = result.messages.find(
      (message) => message.code === 'recipe_composition_conflict',
    )
    expect(conflict).toMatchObject({ severity: 'blocking' })
    expect(conflict?.message).toContain('label')
    // The earlier module's definition stands, and nothing pretends the disagreement is settled.
    expect(result.slots).toHaveLength(1)
    expect(result.slots[0].label).toBe('Left label')
  })

  it('never merges on role code alone', () => {
    const modules = [
      module('left', [slot({ id: 'L1', requirementKey: 'FIRST', roleCode: 'SAME_ROLE' })]),
      module('right', [slot({ id: 'R1', requirementKey: 'SECOND', roleCode: 'SAME_ROLE' })]),
    ]
    const result = expand(
      recipe([
        { moduleVersionId: 'left', selectionBehavior: 'required', sequence: 10 },
        { moduleVersionId: 'right', selectionBehavior: 'required', sequence: 20 },
      ]),
      modules,
      [],
    )

    expect(result.slots).toHaveLength(2)
    expect(result.messages).toHaveLength(0)
  })

  it('applies composition actions in authored order against every target form', () => {
    const modules = [
      module('core', [
        slot({ id: 'S1', requirementKey: 'K1', sourceSlotAliases: ['LEGACY-1'] }),
        slot({ id: 'S2', requirementKey: 'K2', roleCode: 'OTHER_ROLE' }),
        slot({ id: 'S3', requirementKey: 'K3' }),
      ]),
    ]
    const composition = recipe(
      [{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }],
      {
        compositionActions: [
          {
            id: 'a2',
            sequence: 20,
            actionType: 'append_note',
            targetRequirementKey: 'K1',
            payload: { note: 'second' },
          },
          {
            id: 'a1',
            sequence: 10,
            actionType: 'append_note',
            targetSlotId: 'LEGACY-1',
            payload: { note: 'first' },
          },
          {
            id: 'a3',
            sequence: 30,
            actionType: 'set_requiredness',
            targetRoleCode: 'OTHER_ROLE',
            payload: { value: 'conditional', dependencyRule: 'Only when indicated' },
          },
          {
            id: 'a4',
            sequence: 40,
            actionType: 'remove_slot',
            targetRequirementKey: 'K3',
            payload: {},
          },
        ],
      },
    )

    const result = expand(composition, modules, [])
    const first = result.slots.find((entry) => entry.requirementKey === 'K1')
    const second = result.slots.find((entry) => entry.requirementKey === 'K2')

    expect(first?.notes).toBe('first second')
    expect(first?.includedBy).toContain('Modified by Test recipe composition')
    expect(second).toMatchObject({
      requiredness: 'conditional',
      dependencyRule: 'Only when indicated',
    })
    expect(result.slots.some((entry) => entry.requirementKey === 'K3')).toBe(false)
  })

  it('warns when a composition action matches nothing', () => {
    const modules = [module('core', [slot({ id: 'S1', requirementKey: 'K1' })])]
    const result = expand(
      recipe([{ moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 }], {
        compositionActions: [
          {
            id: 'orphan',
            sequence: 10,
            actionType: 'append_note',
            targetRequirementKey: 'NOT_THERE',
            payload: { note: 'x' },
          },
        ],
      }),
      modules,
      [],
    )

    expect(
      result.messages.find((message) => message.code === 'recipe_composition_action_unmatched'),
    ).toMatchObject({ severity: 'warning' })
  })

  it('lays requirements out in bands so a module keeps its own internal order', () => {
    const modules = [
      module('core', [
        slot({ id: 'S1', requirementKey: 'K1', setupSequence: 9 }),
        slot({ id: 'S2', requirementKey: 'K2', setupSequence: 1 }),
      ]),
      module('specific', [slot({ id: 'S3', requirementKey: 'K3', setupSequence: 1 })]),
    ]
    const result = expand(
      recipe([
        { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
        { moduleVersionId: 'specific', selectionBehavior: 'required', sequence: 20 },
      ]),
      modules,
      [],
    )

    expect(result.slots.map((entry) => entry.setupSequence)).toEqual([10009, 10001, 20001])
    expect(
      [...result.slots]
        .sort((a, b) => a.setupSequence - b.setupSequence)
        .map((s) => s.requirementKey),
    ).toEqual(['K2', 'K1', 'K3'])
  })
})

describe('effective governance state', () => {
  const included = (state: GovernanceState) => [
    {
      moduleVersionId: 'm',
      moduleCode: 'M',
      moduleName: 'M',
      moduleVersion: '1.0',
      kind: 'core' as const,
      selectionBehavior: 'required' as const,
      selectionSource: 'required' as const,
      governanceState: state,
      requirementCount: 1,
    },
  ]

  it('never reads stronger than the weakest component', () => {
    expect(effectiveGovernanceState('approved', included('draft'))).toBe('draft')
    expect(effectiveGovernanceState('approved', included('in_review'))).toBe('in_review')
    expect(effectiveGovernanceState('approved', included('approved'))).toBe('approved')
    expect(effectiveGovernanceState('draft', included('approved'))).toBe('draft')
    expect(effectiveGovernanceState('approved', included('retired'))).toBe('retired')
  })

  it('blocks a card that includes a retired module', () => {
    const modules = [
      module('retired-module', [slot({ id: 'S1', requirementKey: 'K1' })], {
        governanceState: 'retired',
      }),
    ]
    const result = expand(
      recipe([{ moduleVersionId: 'retired-module', selectionBehavior: 'required', sequence: 10 }]),
      modules,
      [],
    )
    expect(
      result.messages.find((message) => message.code === 'retired_module_selected'),
    ).toMatchObject({ severity: 'blocking' })
  })
})

describe('the composition manifest is part of the card identity', () => {
  const modules = [
    module('core', [slot({ id: 'S1', requirementKey: 'K1' })]),
    module('opt', [slot({ id: 'S2', requirementKey: 'K2' })]),
    module('unrelated', [slot({ id: 'S3', requirementKey: 'K3' })]),
  ]
  const composition = recipe([
    { moduleVersionId: 'core', selectionBehavior: 'required', sequence: 10 },
    { moduleVersionId: 'opt', selectionBehavior: 'optional', sequence: 20 },
    { moduleVersionId: 'unrelated', selectionBehavior: 'optional', sequence: 30 },
  ])

  function context(overrideModules: RecipeModuleVersion[] = modules): BuildContext {
    return {
      organizationName: 'Org',
      siteName: 'Site',
      locationName: 'Room',
      locationCapabilities: [],
      recipe: composition,
      recipeModules: overrideModules,
      modifiers: [],
      rescueModules: [],
      hospitalItems: [],
      hospitalRoleOptions: [],
      compatibilityRules: [],
      preferenceOverlays: [],
    }
  }

  function input(selectedModuleVersionIds: string[]): BuildCardInput {
    return {
      organizationId: 'org',
      siteId: 'site',
      locationId: 'room',
      recipeVersionId: composition.id,
      selectedModuleVersionIds,
      modifierCodes: [],
      variables: {},
    }
  }

  it('carries the manifest on the resolved card', () => {
    const card = resolveCard(input(['core']), context())
    expect(card.includedModules).toEqual([
      expect.objectContaining({ moduleVersionId: 'core', selectionSource: 'required' }),
    ])
  })

  it('changes the hash when a different module is selected', () => {
    const base = resolveCard(input(['core']), context())
    const withOptional = resolveCard(input(['core', 'opt']), context())
    expect(withOptional.snapshotHash).not.toBe(base.snapshotHash)
  })

  it('changes the hash when the pinned version of a selected module changes', () => {
    const base = resolveCard(input(['core']), context())
    const republished = modules.map((entry) =>
      entry.id === 'core' ? { ...entry, version: '1.1' } : entry,
    )
    const bumped = resolveCard(input(['core']), context(republished))
    expect(bumped.snapshotHash).not.toBe(base.snapshotHash)
  })

  it('leaves the hash alone when an unselected module changes', () => {
    const base = resolveCard(input(['core']), context())
    const changedElsewhere = modules.map((entry) =>
      entry.id === 'unrelated'
        ? { ...entry, version: '9.9', slots: [slot({ id: 'S9', requirementKey: 'K9' })] }
        : entry,
    )
    const after = resolveCard(input(['core']), context(changedElsewhere))
    expect(after.snapshotHash).toBe(base.snapshotHash)
  })

  it('is deterministic for the same inputs', () => {
    expect(resolveCard(input(['core', 'opt']), context()).snapshotHash).toBe(
      resolveCard(input(['core', 'opt']), context()).snapshotHash,
    )
  })
})
