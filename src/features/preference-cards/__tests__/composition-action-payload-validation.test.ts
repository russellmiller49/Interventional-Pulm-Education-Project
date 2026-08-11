import { BLANK_AUTHORED_STRING_CASES } from '../__fixtures__/blank-authored-strings'
import { expandRecipeComposition } from '../domain/expand-recipe-composition'
import {
  parseProcedureCompositionActionPayload,
  procedureCompositionActionSchema,
} from '../domain/schemas'
import {
  openHoldStatuses,
  proceduralPhases,
  procedureCompositionActionTypes,
  requirednessValues,
  setupZones,
} from '../domain/types'
import type {
  ProcedureCompositionAction,
  ProcedureCompositionActionType,
  RecipeModuleVersion,
  RecipeSlot,
  RecipeVersion,
} from '../domain/types'

/**
 * P91-C4 — exhaustive composition-action payload validation.
 *
 * The Codex reproduction: `{ actionType: 'set_open_hold_status', payload: { value:
 * 'definitely_not_a_status' } }` loaded and propagated, because the loader validated payload
 * values for only four of the seven action types and the evaluator cast the raw string to
 * `OpenHoldStatus`. The correction is one canonical dispatch —
 * `parseProcedureCompositionActionPayload` — used by the seed loaders, the composition
 * generator, and the evaluator itself, over strict per-action payload schemas.
 *
 * This file is the contract for that dispatch: every supported action type, valid and
 * invalid, at the parse boundary and at the evaluator boundary (including in-memory objects
 * that never pass a loader), plus the doctored-seed proof that the real
 * `seed/custom-composition.json` load boundary refuses a bad value.
 */

interface PayloadCase {
  name: string
  payload: Record<string, unknown>
}

interface PayloadMatrixRow {
  actionType: ProcedureCompositionActionType
  valid: PayloadCase[]
  invalid: PayloadCase[]
}

const PAYLOAD_MATRIX: PayloadMatrixRow[] = [
  {
    actionType: 'remove_slot',
    // The evaluator consumes no payload value, which is exactly why anything authored
    // inside one is a typo to refuse rather than content to ignore.
    valid: [{ name: 'the empty object', payload: {} }],
    invalid: [
      { name: 'any authored key', payload: { value: 'anything' } },
      { name: 'a note-like key', payload: { note: 'x' } },
    ],
  },
  {
    actionType: 'set_requiredness',
    valid: [
      ...requirednessValues.map((value) => ({ name: `value ${value}`, payload: { value } })),
      {
        name: 'conditional with a dependency rule',
        payload: { value: 'conditional', dependencyRule: 'Rigid system in use' },
      },
      {
        // Padded but not whitespace-only: valid, and preserved byte-for-byte (proven below).
        name: 'a dependency rule with deliberate spacing',
        payload: { value: 'conditional', dependencyRule: '  Rigid system in use  ' },
      },
      {
        name: 'required clearing the rule with null',
        payload: { value: 'required', dependencyRule: null },
      },
    ],
    invalid: [
      { name: 'an invented requiredness', payload: { value: 'mandatory' } },
      // The whole whitespace corpus, not one literal — `.min(1)` passed everything here
      // except the empty string (P91-C4b).
      ...BLANK_AUTHORED_STRING_CASES.map(({ name, value }) => ({
        name: `a dependency rule of ${name}`,
        payload: { value: 'conditional', dependencyRule: value },
      })),
      {
        name: 'a non-string dependency rule',
        payload: { value: 'conditional', dependencyRule: 42 },
      },
      { name: 'a missing value', payload: {} },
      { name: 'a misspelled extra field', payload: { value: 'required', dependancyRule: 'typo' } },
    ],
  },
  {
    actionType: 'set_quantity',
    valid: [{ name: 'a literal expression', payload: { expression: { op: 'literal', value: 2 } } }],
    invalid: [
      { name: 'a missing expression', payload: {} },
      { name: 'an unknown op', payload: { expression: { op: 'sum', value: 2 } } },
      { name: 'a non-numeric value', payload: { expression: { op: 'literal', value: 'two' } } },
      { name: 'a negative value', payload: { expression: { op: 'literal', value: -1 } } },
      {
        name: 'a stray key inside the expression',
        payload: { expression: { op: 'literal', value: 2, unit: 'each' } },
      },
      {
        name: 'a stray key beside the expression',
        payload: { expression: { op: 'literal', value: 2 }, value: 2 },
      },
    ],
  },
  {
    actionType: 'set_setup_zone',
    valid: setupZones.map((value) => ({ name: `zone ${value}`, payload: { value } })),
    invalid: [
      { name: 'a typo zone', payload: { value: 'backtable' } },
      { name: 'a missing value', payload: {} },
      {
        name: 'an extra key beside a valid value',
        payload: { value: 'back_table', zone: 'back_table' },
      },
    ],
  },
  {
    actionType: 'set_procedural_phase',
    valid: proceduralPhases.map((value) => ({ name: `phase ${value}`, payload: { value } })),
    invalid: [
      { name: 'a typo phase', payload: { value: 'diagnostc' } },
      { name: 'a missing value', payload: {} },
      {
        name: 'an extra key beside a valid value',
        payload: { value: 'diagnostic', phase: 'diagnostic' },
      },
    ],
  },
  {
    actionType: 'set_open_hold_status',
    valid: openHoldStatuses.map((value) => ({ name: `status ${value}`, payload: { value } })),
    invalid: [
      // The Codex reproduction, verbatim.
      { name: 'an invented status', payload: { value: 'definitely_not_a_status' } },
      { name: 'a missing value', payload: {} },
      {
        name: 'an extra key beside a valid value',
        payload: { value: 'have_in_room', status: 'have_in_room' },
      },
    ],
  },
  {
    actionType: 'append_note',
    valid: [
      { name: 'a plain note', payload: { note: 'Sterile cover for pleural access.' } },
      // Padded but not whitespace-only: valid, and applied verbatim (proven below).
      { name: 'a note with deliberate spacing', payload: { note: '  padded  note  ' } },
    ],
    invalid: [
      ...BLANK_AUTHORED_STRING_CASES.map(({ name, value }) => ({
        name: `a note of ${name}`,
        payload: { note: value },
      })),
      { name: 'a missing note', payload: {} },
      { name: 'a non-string note', payload: { note: 42 } },
      { name: 'an extra key beside a valid note', payload: { note: 'x', reason: 'y' } },
    ],
  },
]

const PARSE_CONTEXT = { operation: 'exercising the payload contract' }

function action(
  actionType: ProcedureCompositionActionType,
  payload: Record<string, unknown>,
  overrides: Partial<ProcedureCompositionAction> = {},
): ProcedureCompositionAction {
  return {
    id: `matrix-${actionType}`,
    sequence: 10,
    actionType,
    targetSlotId: 'SLOT-MATRIX-1',
    payload,
    ...overrides,
  }
}

describe('the canonical payload dispatch covers every composition action type', () => {
  it('the matrix enumerates every ProcedureCompositionActionType exactly once', () => {
    // Fail-closed completeness: a new action type cannot ship until it has matrix rows.
    expect(PAYLOAD_MATRIX.map((row) => row.actionType).sort()).toEqual(
      [...procedureCompositionActionTypes].sort(),
    )
  })

  describe.each(PAYLOAD_MATRIX)('$actionType', ({ actionType, valid, invalid }) => {
    it.each(valid)('accepts $name', ({ payload }) => {
      const parsed = parseProcedureCompositionActionPayload(
        action(actionType, payload),
        PARSE_CONTEXT,
      )
      expect(parsed.actionType).toBe(actionType)
    })

    it.each(invalid)('rejects $name', ({ payload }) => {
      expect(() =>
        parseProcedureCompositionActionPayload(action(actionType, payload), PARSE_CONTEXT),
      ).toThrow(
        new RegExp(`Invalid ${actionType} payload on composition action "matrix-${actionType}"`),
      )
    })
  })

  it('preserves authored note text verbatim rather than trimming it', () => {
    const parsed = parseProcedureCompositionActionPayload(
      action('append_note', { note: '  padded  note  ' }),
      PARSE_CONTEXT,
    )
    expect(parsed).toEqual({ actionType: 'append_note', note: '  padded  note  ' })
  })

  it('preserves an authored dependency rule verbatim rather than trimming it (P91-C4b)', () => {
    // Meaningful-string validation refuses meaningless text; it never edits meaningful text.
    const parsed = parseProcedureCompositionActionPayload(
      action('set_requiredness', {
        value: 'conditional',
        dependencyRule: '  Rigid system in use  ',
      }),
      PARSE_CONTEXT,
    )
    expect(parsed).toEqual({
      actionType: 'set_requiredness',
      value: 'conditional',
      dependencyRule: '  Rigid system in use  ',
    })
  })

  it('rejects the P91-C4b Codex reproduction with the field and the contract named', () => {
    // { value: "conditional", dependencyRule: "   " } passed `.min(1)`, generated, and
    // expanded — a conditional requirement whose condition nobody can read.
    expect(() =>
      parseProcedureCompositionActionPayload(
        action('set_requiredness', { value: 'conditional', dependencyRule: '   ' }),
        PARSE_CONTEXT,
      ),
    ).toThrow(
      'Invalid set_requiredness payload on composition action "matrix-set_requiredness" ' +
        'while exercising the payload contract: dependencyRule: Authored text must contain ' +
        'at least one non-whitespace character.',
    )
  })

  it('throws descriptively on an action type the union has never heard of', () => {
    expect(() =>
      parseProcedureCompositionActionPayload(
        action('future_unknown_action' as ProcedureCompositionActionType, {}),
        { operation: 'exercising the unknown-type contract' },
      ),
    ).toThrow(
      'Unknown composition action type "future_unknown_action" on composition action ' +
        '"matrix-future_unknown_action" while exercising the unknown-type contract. ' +
        `Supported types: ${procedureCompositionActionTypes.join(', ')}.`,
    )
  })

  it('rejects an unknown action type at the schema boundary the loaders parse first', () => {
    expect(() =>
      procedureCompositionActionSchema.parse({
        id: 'schema-unknown',
        sequence: 1,
        actionType: 'future_unknown_action',
        targetSlotId: 'SLOT-MATRIX-1',
        payload: {},
      }),
    ).toThrow(/future_unknown_action/)
  })

  it("keeps tolerating the governed seeds' top-level reason field (non-strict action object)", () => {
    const parsed = procedureCompositionActionSchema.parse({
      id: 'seed-shaped',
      sequence: 1,
      actionType: 'remove_slot',
      targetSlotId: 'SLOT-MATRIX-1',
      reason: 'Authoring rationale the loaders read before this schema runs.',
      payload: {},
    })
    expect('reason' in parsed).toBe(false)
  })
})

describe('the evaluator applies exactly the validated values', () => {
  const MODULE_ID = 'module-matrix-v1-0'

  function matrixSlot(overrides: Partial<RecipeSlot> = {}): RecipeSlot {
    return {
      id: 'SLOT-MATRIX-1',
      sourceSlotId: 'SLOT-MATRIX-1',
      requirementKey: 'SLOT-MATRIX-1',
      roleCode: 'MATRIX_ROLE',
      label: 'Matrix requirement',
      genericRequirement: 'Synthetic.',
      requiredness: 'required',
      dependencyRule: 'Existing rule',
      quantityExpression: { op: 'literal', value: 1 },
      selectionMode: 'single',
      setupZone: 'back_table',
      proceduralPhase: 'diagnostic',
      setupSequence: 1,
      openHoldStatus: 'open_or_set_up_now',
      responsibleRole: null,
      sterileStatus: null,
      allowCustom: false,
      notes: null,
      includedBy: 'Included by Matrix module v1.0',
      ...overrides,
    }
  }

  function expand(actions: ProcedureCompositionAction[], slotOverrides: Partial<RecipeSlot> = {}) {
    const moduleVersion: RecipeModuleVersion = {
      id: MODULE_ID,
      code: 'MATRIX_MODULE',
      name: 'Matrix module',
      description: 'Synthetic.',
      version: '1.0',
      kind: 'procedure_specific',
      governanceState: 'draft',
      clinicalOwner: null,
      operationalOwner: null,
      catalogImportId: 'matrix',
      slots: [matrixSlot(slotOverrides)],
    }
    const recipe: RecipeVersion = {
      id: 'recipe-matrix-v1-0',
      sourceProcedureCode: 'MATRIX',
      sourceTemplateVersion: '1.0',
      name: 'Matrix recipe',
      version: '1.0',
      governanceState: 'draft',
      clinicalOwner: null,
      operationalOwner: null,
      allowedModifierCodes: [],
      catalogImportId: 'matrix',
      slots: [],
      moduleReferences: [
        { moduleVersionId: MODULE_ID, selectionBehavior: 'required', sequence: 10 },
      ],
      compositionActions: actions,
      requirementSequences: {},
    }
    return expandRecipeComposition({
      recipe,
      modules: [moduleVersion],
      selectedModuleVersionIds: [MODULE_ID],
      startSequence: 1,
    })
  }

  function onlySlot(
    actions: ProcedureCompositionAction[],
    slotOverrides: Partial<RecipeSlot> = {},
  ) {
    const result = expand(actions, slotOverrides)
    expect(result.messages).toEqual([])
    expect(result.slots).toHaveLength(1)
    return result.slots[0]
  }

  it('remove_slot removes the requirement', () => {
    const result = expand([action('remove_slot', {})])
    expect(result.messages).toEqual([])
    expect(result.slots).toEqual([])
  })

  it.each(requirednessValues.map((value) => [value]))(
    'set_requiredness applies %s and leaves the dependency rule alone when the payload omits it',
    (value) => {
      const slot = onlySlot([action('set_requiredness', { value })])
      expect(slot.requiredness).toBe(value)
      expect(slot.dependencyRule).toBe('Existing rule')
    },
  )

  it('set_requiredness carries a dependency rule and clears one with null', () => {
    const withRule = onlySlot([
      action('set_requiredness', { value: 'conditional', dependencyRule: 'Only when indicated' }),
    ])
    expect(withRule.requiredness).toBe('conditional')
    expect(withRule.dependencyRule).toBe('Only when indicated')

    const cleared = onlySlot([
      action('set_requiredness', { value: 'required', dependencyRule: null }),
    ])
    expect(cleared.requiredness).toBe('required')
    expect(cleared.dependencyRule).toBeNull()
  })

  it('set_requiredness applies a padded dependency rule byte-for-byte (P91-C4b)', () => {
    const slot = onlySlot([
      action('set_requiredness', {
        value: 'conditional',
        dependencyRule: '  Rigid system in use  ',
      }),
    ])
    expect(slot.requiredness).toBe('conditional')
    expect(slot.dependencyRule).toBe('  Rigid system in use  ')
  })

  it('set_quantity replaces the expression with the validated literal', () => {
    const slot = onlySlot([action('set_quantity', { expression: { op: 'literal', value: 4 } })])
    expect(slot.quantityExpression).toEqual({ op: 'literal', value: 4 })
  })

  it.each(setupZones.map((value) => [value]))('set_setup_zone applies %s', (value) => {
    expect(onlySlot([action('set_setup_zone', { value })]).setupZone).toBe(value)
  })

  it.each(proceduralPhases.map((value) => [value]))('set_procedural_phase applies %s', (value) => {
    expect(onlySlot([action('set_procedural_phase', { value })]).proceduralPhase).toBe(value)
  })

  it.each(openHoldStatuses.map((value) => [value]))('set_open_hold_status applies %s', (value) => {
    const slot = onlySlot([action('set_open_hold_status', { value })])
    expect(slot.openHoldStatus).toBe(value)
    expect(openHoldStatuses).toContain(slot.openHoldStatus)
  })

  it('append_note starts the note verbatim on a slot with none, spacing and all', () => {
    expect(onlySlot([action('append_note', { note: '  padded  note  ' })]).notes).toBe(
      '  padded  note  ',
    )
  })

  it('append_note appends after an existing note', () => {
    const slot = onlySlot([action('append_note', { note: 'Second statement.' })], {
      notes: 'First statement.',
    })
    expect(slot.notes).toBe('First statement. Second statement.')
  })

  describe('invalid payloads throw at the evaluator even when the object never passed a loader', () => {
    it.each(PAYLOAD_MATRIX.map((row) => [row.actionType, row.invalid[0]] as const))(
      '%s rejects %o',
      (actionType, invalidCase) => {
        expect(() => expand([action(actionType, invalidCase.payload)])).toThrow(
          new RegExp(`Invalid ${actionType} payload on composition action "matrix-${actionType}"`),
        )
      },
    )

    it('the Codex reproduction: an invented open/hold status never reaches an expanded slot', () => {
      expect(() =>
        expand([action('set_open_hold_status', { value: 'definitely_not_a_status' })]),
      ).toThrow(
        /Invalid set_open_hold_status payload on composition action "matrix-set_open_hold_status" while expanding the Matrix recipe composition \(recipe-matrix-v1-0\)/,
      )
    })

    it.each([...BLANK_AUTHORED_STRING_CASES])(
      'a note of $name throws instead of silently skipping',
      ({ value }) => {
        expect(() => expand([action('append_note', { note: value })])).toThrow(
          /Invalid append_note payload/,
        )
      },
    )

    it.each([...BLANK_AUTHORED_STRING_CASES])(
      'a dependency rule of $name never reaches an expanded slot (P91-C4b)',
      ({ value }) => {
        // The Codex reproduction ran exactly this in-memory cast through
        // `expandRecipeComposition` and the expanded requirement kept the blank condition.
        // The evaluator boundary must refuse it even for an action no loader ever saw.
        expect(() =>
          expand([action('set_requiredness', { value: 'conditional', dependencyRule: value })]),
        ).toThrow(
          /Invalid set_requiredness payload on composition action "matrix-set_requiredness" while expanding the Matrix recipe composition \(recipe-matrix-v1-0\): dependencyRule: Authored text must contain at least one non-whitespace character\./,
        )
      },
    )

    it('a payload authored on remove_slot throws instead of being silently ignored', () => {
      expect(() => expand([action('remove_slot', { value: 'anything' })])).toThrow(
        /Invalid remove_slot payload/,
      )
    })

    it('validates the payload even when the target is not in the selected composition', () => {
      // The evaluator is the enforcement boundary for generated and ledger-retained recipes
      // that never pass a seed loader, so a bad payload fails the expansion whether or not
      // its target is present — including on an optional-target action.
      expect(() =>
        expand([
          action(
            'set_open_hold_status',
            { value: 'definitely_not_a_status' },
            { targetSlotId: 'SLOT-NOT-COMPOSED', optionalTarget: true },
          ),
        ]),
      ).toThrow(/Invalid set_open_hold_status payload/)
    })

    it('a valid optional-target action whose target is absent is still silently inapplicable', () => {
      // Guard the P91-C1 semantics: validation happens, application does not.
      const result = expand([
        action(
          'set_open_hold_status',
          { value: 'have_in_room' },
          { targetSlotId: 'SLOT-NOT-COMPOSED', optionalTarget: true },
        ),
      ])
      expect(result.messages).toEqual([])
      expect(result.slots[0].openHoldStatus).toBe('open_or_set_up_now')
    })

    it('an unknown action type throws from the evaluator with the action and recipe named', () => {
      expect(() =>
        expand([action('future_unknown_action' as ProcedureCompositionActionType, { value: 'x' })]),
      ).toThrow(
        /Unknown composition action type "future_unknown_action" on composition action "matrix-future_unknown_action" while expanding the Matrix recipe composition \(recipe-matrix-v1-0\)/,
      )
    })
  })
})

describe('the governed custom-composition seed refuses a doctored action at module load', () => {
  const SEED_PATH = '../../../../data/ip-preference-cards/seed/custom-composition.json'

  /**
   * Load `demo-context.server` in an isolated registry with a doctored copy of the real
   * governed seed. The doctored action targets a real slot (`SLOT-1AF4BEFE3B`) with an
   * action type it does not already carry, so every other load-time check would pass — the
   * failure has to come from the contract under test. On a successful load the module is
   * returned too, so an acceptance test can inspect what actually loaded.
   */
  async function loadWithDoctoredSeed(
    doctorAction: Record<string, unknown>,
  ): Promise<{ caught: unknown; loaded: typeof import('../data/demo-context.server') | null }> {
    let caught: unknown = null
    let loaded: typeof import('../data/demo-context.server') | null = null
    await jest.isolateModulesAsync(async () => {
      const actual = jest.requireActual(SEED_PATH) as {
        compositionActions: Array<Record<string, unknown>>
      }
      const doctored = JSON.parse(JSON.stringify(actual)) as typeof actual
      doctored.compositionActions.push({
        id: 'doctored-action',
        sequence: 9910,
        optionalTarget: true,
        targetSlotId: 'SLOT-1AF4BEFE3B',
        reason: 'Doctored by the P91-C4 regression.',
        ...doctorAction,
      })
      jest.doMock(SEED_PATH, () => doctored)
      try {
        loaded = await import('../data/demo-context.server')
      } catch (error) {
        caught = error
      }
    })
    jest.dontMock(SEED_PATH)
    return { caught, loaded }
  }

  it('refuses the Codex reproduction: an invented open/hold status value', async () => {
    const { caught } = await loadWithDoctoredSeed({
      actionType: 'set_open_hold_status',
      payload: { value: 'definitely_not_a_status' },
    })
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(
      /Invalid set_open_hold_status payload on composition action "doctored-action" while validating seed\/custom-composition\.json/,
    )
  })

  it('refuses an action type the schema does not know', async () => {
    const { caught } = await loadWithDoctoredSeed({
      actionType: 'future_unknown_action',
      payload: {},
    })
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/future_unknown_action/)
  })

  it('refuses an empty note and a payload on remove_slot', async () => {
    const { caught: emptyNote } = await loadWithDoctoredSeed({
      actionType: 'append_note',
      payload: { note: '   ' },
    })
    expect((emptyNote as Error).message).toMatch(/Invalid append_note payload/)

    const { caught: removeWithPayload } = await loadWithDoctoredSeed({
      actionType: 'remove_slot',
      payload: { value: 'anything' },
    })
    expect((removeWithPayload as Error).message).toMatch(/Invalid remove_slot payload/)
  })

  it.each([...BLANK_AUTHORED_STRING_CASES])(
    'refuses a dependency rule of $name at the real seed-load boundary (P91-C4b)',
    async (blankCase) => {
      // The Codex reproduction, run against the same governed load path a real seed edit
      // would take: { value: "conditional", dependencyRule: "   " } and every other
      // whitespace class must refuse to load, not surface later on someone's card.
      const { caught } = await loadWithDoctoredSeed({
        actionType: 'set_requiredness',
        payload: { value: 'conditional', dependencyRule: blankCase.value },
      })
      expect(caught).toBeInstanceOf(Error)
      expect((caught as Error).message).toMatch(
        /Invalid set_requiredness payload on composition action "doctored-action" while validating seed\/custom-composition\.json for recipe-custom-composition-v1-2: dependencyRule: Authored text must contain at least one non-whitespace character\./,
      )
    },
  )

  it('accepts a padded but meaningful dependency rule and preserves it byte-for-byte', async () => {
    // The counterpart guard: the loader must not start refusing — or trimming — authored
    // text that says something just because it carries deliberate spacing.
    const { caught, loaded } = await loadWithDoctoredSeed({
      actionType: 'set_requiredness',
      payload: { value: 'conditional', dependencyRule: '  Rigid system in use  ' },
    })
    expect(caught).toBeNull()
    const recipe = loaded!.getLiveRecipeVersions().get('recipe-custom-composition-v1-2')
    const doctored = recipe?.compositionActions.find((entry) => entry.id === 'doctored-action')
    expect(doctored?.payload).toEqual({
      value: 'conditional',
      dependencyRule: '  Rigid system in use  ',
    })
  })
})
