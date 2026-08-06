import { expandEffectiveSlots } from '../domain/effective-slots'
import type {
  BuildContext,
  ModifierAction,
  ModifierDefinition,
  RecipeSlot,
  RescueModule,
} from '../domain/types'

/**
 * What each modifier action means, stated literally rather than observed through two callers.
 *
 * `effective-slots-equivalence.test.ts` proves the planner and the resolver are the *same* function
 * — which is the architecture — and therefore cannot prove what that function does. Both sides of
 * its equality run the code under test, so a change that quietly dropped `set_quantity`, garbled
 * `append_note`, or stopped honouring `set_open_hold_status` leaves it perfectly green. That is a
 * real gap: this module decides which requirements exist on a rebuilt card and what they say.
 *
 * So this file is the independent oracle. One minimal fixture per action, one expected slot written
 * out by hand, and no reference to the resolver at all. If the expectation and the implementation
 * disagree, exactly one of them is wrong and a human has to decide which — which is what an oracle
 * is for.
 */

const ROLE = 'ORACLE_ROLE'
const BASE_SLOT_ID = 'SLOT-ORACLE-BASE'
const SECOND_SLOT_ID = 'SLOT-ORACLE-SECOND'
const MODULE_VERSION_ID = 'module-oracle-v1'
const RECIPE_VERSION_ID = 'recipe-oracle-v1'

function slot(overrides: Partial<RecipeSlot> & Pick<RecipeSlot, 'id'>): RecipeSlot {
  return {
    sourceSlotId: overrides.id,
    requirementKey: 'ORACLE_BASE',
    roleCode: ROLE,
    label: 'Oracle requirement',
    genericRequirement: 'A requirement that exists only in this oracle fixture.',
    requiredness: 'required',
    dependencyRule: null,
    quantityExpression: { op: 'literal', value: 1 },
    selectionMode: 'single',
    setupZone: 'back_table',
    proceduralPhase: 'airway_access',
    setupSequence: 1,
    openHoldStatus: 'open_or_set_up_now',
    responsibleRole: null,
    sterileStatus: null,
    allowCustom: false,
    notes: null,
    includedBy: 'Oracle base module',
    ...overrides,
  }
}

function modifier(code: string, actions: Partial<ModifierAction>[]): ModifierDefinition {
  return {
    code,
    name: `Oracle modifier ${code}`,
    groupCode: 'risk_rescue',
    description: 'Synthetic.',
    releaseState: 'mvp',
    active: true,
    appliesTo: 'ORACLE_PROCEDURE',
    preview: [],
    conflictsWith: [],
    actions: actions.map((action, index) => ({
      id: `${code}-${index}`,
      modifierCode: code,
      sequence: index + 1,
      targetSlotId: null,
      targetRoleCode: null,
      targetRequirementKey: null,
      payload: {},
      ...action,
    })) as ModifierAction[],
  }
}

function context(overrides: {
  slots?: RecipeSlot[]
  modifiers?: ModifierDefinition[]
  rescueModules?: RescueModule[]
  locationCapabilities?: string[]
}): BuildContext {
  return {
    organizationName: 'Oracle Organization',
    siteName: 'Oracle Site',
    locationName: 'Oracle Location',
    locationCapabilities: overrides.locationCapabilities ?? [],
    releaseIdentity: {
      releaseBundleId: 'release-oracle-v1',
      releaseDefinitionHash: 'a'.repeat(64),
      catalogReleaseId: 'catalog-oracle-v1',
    },
    recipe: {
      id: 'recipe-oracle',
      name: 'Oracle procedure',
      version: '1.0',
      versionId: RECIPE_VERSION_ID,
      sourceProcedureCode: 'ORACLE_PROCEDURE',
      scenarioId: 'oracle-procedure',
      allowedModifierCodes: (overrides.modifiers ?? []).map((entry) => entry.code),
      moduleReferences: [
        { moduleVersionId: MODULE_VERSION_ID, selectionBehavior: 'required', displayOrder: 1 },
      ],
      compositionActions: [],
      slots: [],
    } as unknown as BuildContext['recipe'],
    recipeModules: [
      {
        // Keyed by `id`, which is the module *version* id in this model.
        id: MODULE_VERSION_ID,
        code: 'ORACLE_CORE',
        name: 'Oracle core',
        version: '1.0',
        versionId: MODULE_VERSION_ID,
        description: 'Synthetic.',
        slots: overrides.slots ?? [slot({ id: BASE_SLOT_ID })],
      } as unknown as BuildContext['recipeModules'][number],
    ],
    modifiers: overrides.modifiers ?? [],
    rescueModules: overrides.rescueModules ?? [],
    hospitalItems: [],
    hospitalRoleOptions: [],
    compatibilityRules: [],
    preferenceOverlays: [],
  } as unknown as BuildContext
}

/** The expanded slots for one modifier selection, sorted so an assertion reads positionally. */
function expand(ctx: BuildContext, modifierCodes: string[] = []) {
  return expandEffectiveSlots({ selectedModuleVersionIds: [MODULE_VERSION_ID], modifierCodes }, ctx)
}

function only(ctx: BuildContext, modifierCodes: string[] = []): RecipeSlot {
  const { slots } = expand(ctx, modifierCodes)
  expect(slots).toHaveLength(1)
  return slots[0]
}

describe('every effective-slot action, against a literal expectation', () => {
  it('composes the base module with nothing applied', () => {
    // The control. Without it, an action test that produced the base slot unchanged would pass for
    // the wrong reason — because the action did nothing at all.
    const base = only(context({}))
    expect(base.id).toBe(BASE_SLOT_ID)
    expect(base.requirementKey).toBe('ORACLE_BASE')
    expect(base.roleCode).toBe(ROLE)
    expect(base.requiredness).toBe('required')
    expect(base.quantityExpression).toEqual({ op: 'literal', value: 1 })
    expect(base.setupZone).toBe('back_table')
    expect(base.proceduralPhase).toBe('airway_access')
    expect(base.openHoldStatus).toBe('open_or_set_up_now')
    expect(base.notes).toBeNull()
  })

  it('add_slot introduces exactly the authored slot, marked as modifier-added', () => {
    const added = slot({
      id: SECOND_SLOT_ID,
      requirementKey: 'ORACLE_ADDED',
      label: 'Added by the oracle modifier',
      setupSequence: 2,
    })
    const ctx = context({
      modifiers: [modifier('ADDS', [{ actionType: 'add_slot', payload: { slot: added } }])],
    })
    const { slots } = expand(ctx, ['ADDS'])

    expect(slots.map((entry) => entry.id)).toEqual([BASE_SLOT_ID, SECOND_SLOT_ID])
    const introduced = slots[1]
    expect(introduced.requirementKey).toBe('ORACLE_ADDED')
    expect(introduced.label).toBe('Added by the oracle modifier')
    expect(introduced.includedBy).toBe('Added by modifier ADDS')
  })

  it('add_slot is idempotent by slot id, not by requirement key', () => {
    // Two ids claiming one key really do both reach the card — which is why the rebuild planner
    // treats that as ambiguity rather than collapsing it.
    const duplicate = slot({ id: SECOND_SLOT_ID, requirementKey: 'ORACLE_BASE' })
    const ctx = context({
      modifiers: [
        modifier('ADDS', [{ actionType: 'add_slot', payload: { slot: duplicate } }]),
        modifier('ADDS_AGAIN', [{ actionType: 'add_slot', payload: { slot: duplicate } }]),
      ],
    })
    const { slots } = expand(ctx, ['ADDS', 'ADDS_AGAIN'])
    expect(slots.map((entry) => entry.id)).toEqual([BASE_SLOT_ID, SECOND_SLOT_ID])
    expect(slots.map((entry) => entry.requirementKey)).toEqual(['ORACLE_BASE', 'ORACLE_BASE'])
  })

  it('remove_slot removes only the slots the action targets', () => {
    const ctx = context({
      slots: [slot({ id: BASE_SLOT_ID }), slot({ id: SECOND_SLOT_ID, requirementKey: 'OTHER' })],
      modifiers: [
        modifier('REMOVES', [{ actionType: 'remove_slot', targetSlotId: SECOND_SLOT_ID }]),
      ],
    })
    expect(expand(ctx, []).slots.map((entry) => entry.id)).toEqual([BASE_SLOT_ID, SECOND_SLOT_ID])
    expect(expand(ctx, ['REMOVES']).slots.map((entry) => entry.id)).toEqual([BASE_SLOT_ID])
  })

  it('replace_role rewrites the role, the label, and the generic requirement', () => {
    const ctx = context({
      modifiers: [
        modifier('REPLACES', [
          {
            actionType: 'replace_role',
            targetRoleCode: ROLE,
            payload: {
              roleCode: 'ORACLE_REPLACEMENT_ROLE',
              label: 'Replaced label',
              genericRequirement: 'Replaced requirement.',
            },
          },
        ]),
      ],
    })
    const replaced = only(ctx, ['REPLACES'])
    expect(replaced.roleCode).toBe('ORACLE_REPLACEMENT_ROLE')
    expect(replaced.label).toBe('Replaced label')
    expect(replaced.genericRequirement).toBe('Replaced requirement.')
    // The slot keeps its identity: a replaced role is the same requirement, differently met.
    expect(replaced.id).toBe(BASE_SLOT_ID)
    expect(replaced.requirementKey).toBe('ORACLE_BASE')
  })

  it('replace_role refuses two different replacements for one slot rather than picking one', () => {
    const ctx = context({
      modifiers: [
        modifier('REPLACES_A', [
          { actionType: 'replace_role', targetRoleCode: ROLE, payload: { roleCode: 'ROLE_A' } },
        ]),
        modifier('REPLACES_B', [
          {
            actionType: 'replace_role',
            targetSlotId: BASE_SLOT_ID,
            payload: { roleCode: 'ROLE_B' },
          },
        ]),
      ],
    })
    const { slots, messages } = expand(ctx, ['REPLACES_A', 'REPLACES_B'])
    expect(slots[0].roleCode).toBe('ROLE_A')
    expect(messages.map((message) => message.code)).toContain('modifier_action_collision')
    expect(messages.some((message) => message.severity === 'blocking')).toBe(true)
  })

  it('set_requiredness writes the named value', () => {
    const ctx = context({
      modifiers: [
        modifier('OPTIONAL', [
          {
            actionType: 'set_requiredness',
            targetSlotId: BASE_SLOT_ID,
            payload: { value: 'optional' },
          },
        ]),
      ],
    })
    expect(only(ctx, ['OPTIONAL']).requiredness).toBe('optional')
  })

  it('set_quantity replaces the whole expression, not one of its fields', () => {
    const ctx = context({
      modifiers: [
        modifier('QUANTITY', [
          {
            actionType: 'set_quantity',
            targetSlotId: BASE_SLOT_ID,
            payload: { expression: { op: 'literal', value: 4 } },
          },
        ]),
      ],
    })
    expect(only(ctx, ['QUANTITY']).quantityExpression).toEqual({ op: 'literal', value: 4 })
  })

  it('set_setup_zone writes the named zone', () => {
    const ctx = context({
      modifiers: [
        modifier('ZONE', [
          {
            actionType: 'set_setup_zone',
            targetSlotId: BASE_SLOT_ID,
            payload: { value: 'in_room' },
          },
        ]),
      ],
    })
    expect(only(ctx, ['ZONE']).setupZone).toBe('in_room')
  })

  it('set_procedural_phase writes the named phase', () => {
    const ctx = context({
      modifiers: [
        modifier('PHASE', [
          {
            actionType: 'set_procedural_phase',
            targetSlotId: BASE_SLOT_ID,
            payload: { value: 'closure' },
          },
        ]),
      ],
    })
    expect(only(ctx, ['PHASE']).proceduralPhase).toBe('closure')
  })

  it('set_open_hold_status writes the named status', () => {
    const ctx = context({
      modifiers: [
        modifier('HOLD', [
          {
            actionType: 'set_open_hold_status',
            targetSlotId: BASE_SLOT_ID,
            payload: { value: 'hold_unopened' },
          },
        ]),
      ],
    })
    expect(only(ctx, ['HOLD']).openHoldStatus).toBe('hold_unopened')
  })

  it('append_note appends rather than replaces, and joins with a single space', () => {
    const ctx = context({
      slots: [slot({ id: BASE_SLOT_ID, notes: 'Existing note.' })],
      modifiers: [
        modifier('NOTE', [
          {
            actionType: 'append_note',
            targetSlotId: BASE_SLOT_ID,
            payload: { note: 'Appended note.' },
          },
        ]),
      ],
    })
    expect(only(ctx, ['NOTE']).notes).toBe('Existing note. Appended note.')
    // And onto an empty note, without a leading space.
    const empty = context({
      modifiers: [
        modifier('NOTE', [
          {
            actionType: 'append_note',
            targetSlotId: BASE_SLOT_ID,
            payload: { note: 'Appended note.' },
          },
        ]),
      ],
    })
    expect(only(empty, ['NOTE']).notes).toBe('Appended note.')
  })

  it('require_room_capability is quiet where the location has it and blocking where it does not', () => {
    const modifiers = [
      modifier('CAPABILITY', [
        { actionType: 'require_room_capability', payload: { capability: 'fluoroscopy' } },
      ]),
    ]
    const present = expand(context({ modifiers, locationCapabilities: ['fluoroscopy'] }), [
      'CAPABILITY',
    ])
    expect(present.messages.map((message) => message.code)).not.toContain('room_capability_missing')

    const missing = expand(context({ modifiers, locationCapabilities: [] }), ['CAPABILITY'])
    const raised = missing.messages.find((message) => message.code === 'room_capability_missing')
    expect(raised).toBeDefined()
    expect(raised?.sourceId).toBe('fluoroscopy')
  })

  it('add_rescue_module expands the named module’s slots, marked as rescue-added', () => {
    const ctx = context({
      modifiers: [
        modifier('RESCUE', [
          { actionType: 'add_rescue_module', payload: { code: 'ORACLE_RESCUE' } },
        ]),
      ],
      rescueModules: [
        {
          code: 'ORACLE_RESCUE',
          name: 'Oracle rescue',
          description: 'Synthetic.',
          slots: [slot({ id: 'SLOT-ORACLE-RESCUE', requirementKey: 'ORACLE_RESCUE_TRAY' })],
        },
      ],
    })
    const { slots } = expand(ctx, ['RESCUE'])
    expect(slots.map((entry) => entry.requirementKey)).toEqual([
      'ORACLE_BASE',
      'ORACLE_RESCUE_TRAY',
    ])
    expect(slots[1].includedBy).toBe('Added by rescue module ORACLE_RESCUE')
  })

  it('add_rescue_module names a module it cannot find rather than silently expanding nothing', () => {
    const ctx = context({
      modifiers: [
        modifier('RESCUE', [{ actionType: 'add_rescue_module', payload: { code: 'ABSENT' } }]),
      ],
    })
    const { slots, messages } = expand(ctx, ['RESCUE'])
    expect(slots).toHaveLength(1)
    const raised = messages.find((message) => message.code === 'rescue_module_missing')
    expect(raised?.severity).toBe('blocking')
    expect(raised?.sourceId).toBe('ABSENT')
  })

  it('raise_warning and raise_blocking_error carry their own code and severity', () => {
    const ctx = context({
      modifiers: [
        modifier('MESSAGES', [
          { actionType: 'raise_warning', payload: { code: 'oracle_warning', message: 'Careful.' } },
          {
            actionType: 'raise_blocking_error',
            payload: { code: 'oracle_blocker', message: 'Stop.' },
          },
        ]),
      ],
    })
    const { messages } = expand(ctx, ['MESSAGES'])
    expect(messages.find((message) => message.code === 'oracle_warning')?.severity).toBe('warning')
    expect(messages.find((message) => message.code === 'oracle_blocker')?.severity).toBe('blocking')
  })

  it('names a modifier it cannot resolve rather than ignoring it', () => {
    const { messages } = expand(context({}), ['NOT_DEFINED'])
    const raised = messages.find((message) => message.code === 'unknown_modifier')
    expect(raised?.severity).toBe('blocking')
    expect(raised?.sourceId).toBe('NOT_DEFINED')
  })

  it('applies actions in authored sequence, so the last write wins deterministically', () => {
    const ctx = context({
      modifiers: [
        modifier('ORDERED', [
          {
            actionType: 'set_setup_zone',
            targetSlotId: BASE_SLOT_ID,
            payload: { value: 'in_room' },
          },
          {
            actionType: 'set_setup_zone',
            targetSlotId: BASE_SLOT_ID,
            payload: { value: 'sterile_field' },
          },
        ]),
      ],
    })
    expect(only(ctx, ['ORDERED']).setupZone).toBe('sterile_field')
  })
})
