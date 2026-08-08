import {
  buildDemoContext,
  defaultBuildInput,
  getScenarioDefinitions,
} from '../data/demo-context.server'
import { expandEffectiveSlots } from '../domain/effective-slots'
import { resolveCard } from '../domain/resolve-card'
import { stableStringify } from '../domain/stable-hash'
import type { BuildContext, RecipeSlot } from '../domain/types'

/**
 * The planner and the resolver see one requirement set, on real seeded data.
 *
 * This is the test the rebuild planner did not have, and its absence was the defect. The planner
 * used to apply `add_slot` and `add_rescue_module` and skip everything else, on the argument that
 * the omissions failed safe. On the seeded modifiers they do not:
 *
 * - `TECH_CHEST_TUBE_SMALL_BORE` / `_LARGE_BORE` **remove** the alternate technique's slots and
 *   change requiredness, so the plan described requirements the new card would not have;
 * - `DIGITAL_DRAINAGE` **replaces** `GENERIC_DRAINAGE_UNIT`'s role, so a stored selection for the
 *   digital role was tested against the generic one and could be called role-ineligible for a role
 *   the target resolver was about to create.
 *
 * `expandEffectiveSlots` is now the one implementation both use, so the assertion below is not
 * "these two agree today" but "these two are the same function". It is written against the real
 * catalogue rather than the synthetic fixture because the counterexamples are real modifiers.
 */

/** Every requirement the resolved card ended up with, active or suppressed by a kit. */
function resolvedRequirementKeys(context: BuildContext, scenarioId: string, modifiers: string[]) {
  const card = resolveCard({ ...defaultBuildInput(scenarioId), modifierCodes: modifiers }, context)
  return [...card.items, ...card.suppressedItems]
    .map((item) => item.requirementKey)
    .filter((key): key is string => typeof key === 'string')
    .sort()
}

function plannedRequirementKeys(context: BuildContext, scenarioId: string, modifiers: string[]) {
  return expandEffectiveSlots(
    {
      selectedModuleVersionIds: defaultBuildInput(scenarioId).selectedModuleVersionIds,
      modifierCodes: modifiers,
    },
    context,
  )
    .slots.map((slot) => slot.requirementKey)
    .sort()
}

function plannedSlots(context: BuildContext, scenarioId: string, modifiers: string[]) {
  return expandEffectiveSlots(
    {
      selectedModuleVersionIds: defaultBuildInput(scenarioId).selectedModuleVersionIds,
      modifierCodes: modifiers,
    },
    context,
  ).slots
}

function slotFor(slots: RecipeSlot[], requirementKey: string): RecipeSlot | undefined {
  return slots.find((slot) => slot.requirementKey === requirementKey)
}

/** Scenarios that actually offer the slot-affecting modifiers, discovered rather than assumed. */
function scenariosOffering(modifierCode: string) {
  return getScenarioDefinitions().filter((scenario) =>
    scenario.availableModifierCodes.includes(modifierCode),
  )
}

describe('the rebuild planner and the resolver expand the same requirement set', () => {
  it.each(getScenarioDefinitions().map((scenario) => [scenario.id] as const))(
    'agrees on %s with no modifiers',
    (scenarioId) => {
      const context = buildDemoContext(scenarioId)
      expect(plannedRequirementKeys(context, scenarioId, [])).toEqual(
        resolvedRequirementKeys(context, scenarioId, []),
      )
    },
  )

  it('agrees on every scenario with every modifier that scenario offers', () => {
    // Non-vacuity: this has to reach modifiers that remove, replace and re-require, or it proves
    // only that additive actions agree — which was never in doubt.
    let compared = 0
    for (const scenario of getScenarioDefinitions()) {
      const context = buildDemoContext(scenario.id)
      for (const modifierCode of scenario.availableModifierCodes) {
        expect(plannedRequirementKeys(context, scenario.id, [modifierCode])).toEqual(
          resolvedRequirementKeys(context, scenario.id, [modifierCode]),
        )
        compared += 1
      }
    }
    expect(compared).toBeGreaterThan(20)
  })

  it('agrees when every modifier a scenario offers is applied at once', () => {
    for (const scenario of getScenarioDefinitions()) {
      const context = buildDemoContext(scenario.id)
      // Conflicting modifiers are allowed to collide here; what is asserted is that both sides
      // collide identically, which is the property a plan needs.
      expect(plannedRequirementKeys(context, scenario.id, scenario.availableModifierCodes)).toEqual(
        resolvedRequirementKeys(context, scenario.id, scenario.availableModifierCodes),
      )
    }
  })
})

describe('the real slot-removing and role-replacing modifiers', () => {
  it('removes the alternate technique slots, in the plan as well as the card', () => {
    const scenarios = scenariosOffering('TECH_CHEST_TUBE_SMALL_BORE')
    expect(scenarios.length).toBeGreaterThan(0)

    for (const scenario of scenarios) {
      const context = buildDemoContext(scenario.id)
      const withoutModifier = plannedRequirementKeys(context, scenario.id, [])
      const withSmallBore = plannedRequirementKeys(context, scenario.id, [
        'TECH_CHEST_TUBE_SMALL_BORE',
      ])
      // Something really is removed, or the counterexample has moved and this test is asleep.
      expect(withSmallBore.length).toBeLessThan(withoutModifier.length)
      // And the card agrees, which is the whole point.
      expect(withSmallBore).toEqual(
        resolvedRequirementKeys(context, scenario.id, ['TECH_CHEST_TUBE_SMALL_BORE']),
      )
    }
  })

  it('applies the digital-drainage role replacement before anything tests eligibility', () => {
    const scenarios = scenariosOffering('DIGITAL_DRAINAGE')
    expect(scenarios.length).toBeGreaterThan(0)

    for (const scenario of scenarios) {
      const context = buildDemoContext(scenario.id)
      const base = slotFor(plannedSlots(context, scenario.id, []), 'GENERIC_DRAINAGE_UNIT')
      const replaced = slotFor(
        plannedSlots(context, scenario.id, ['DIGITAL_DRAINAGE']),
        'GENERIC_DRAINAGE_UNIT',
      )
      if (!base || !replaced) continue

      // The planner now sees the role the resolver will use. Testing a stored digital-role
      // selection against the generic role was how a real selection got called ineligible.
      expect(replaced.roleCode).not.toBe(base.roleCode)
      expect(replaced.roleCode).toBe('DIGITAL_DRAINAGE_SYSTEM')

      const resolved = resolveCard(
        { ...defaultBuildInput(scenario.id), modifierCodes: ['DIGITAL_DRAINAGE'] },
        context,
      )
      const resolvedLine = [...resolved.items, ...resolved.suppressedItems].find(
        (item) => item.requirementKey === 'GENERIC_DRAINAGE_UNIT',
      )
      expect(resolvedLine?.roleCode).toBe(replaced.roleCode)
    }
  })

  it('carries a changed requiredness into the plan, because blocking turns on it', () => {
    const scenarios = scenariosOffering('TECH_CHEST_TUBE_SMALL_BORE')
    let sawRequirednessChange = false

    for (const scenario of scenarios) {
      const context = buildDemoContext(scenario.id)
      const before = plannedSlots(context, scenario.id, [])
      const after = plannedSlots(context, scenario.id, ['TECH_CHEST_TUBE_SMALL_BORE'])
      for (const slot of after) {
        const original = slotFor(before, slot.requirementKey)
        if (!original || original.requiredness === slot.requiredness) continue
        sawRequirednessChange = true
        const resolved = resolveCard(
          { ...defaultBuildInput(scenario.id), modifierCodes: ['TECH_CHEST_TUBE_SMALL_BORE'] },
          context,
        )
        const line = [...resolved.items, ...resolved.suppressedItems].find(
          (item) => item.requirementKey === slot.requirementKey,
        )
        expect(line?.requiredness).toBe(slot.requiredness)
      }
    }
    expect(sawRequirednessChange).toBe(true)
  })

  it('adds the bleeding rescue requirements on both sides', () => {
    const scenarios = scenariosOffering('HIGH_BLEED_RISK')
    expect(scenarios.length).toBeGreaterThan(0)

    for (const scenario of scenarios) {
      const context = buildDemoContext(scenario.id)
      const base = plannedRequirementKeys(context, scenario.id, [])
      const withRescue = plannedRequirementKeys(context, scenario.id, ['HIGH_BLEED_RISK'])
      expect(withRescue.length).toBeGreaterThan(base.length)
      expect(withRescue).toEqual(resolvedRequirementKeys(context, scenario.id, ['HIGH_BLEED_RISK']))
    }
  })
})

describe('extraction changed no behaviour', () => {
  it('produces the same slots the composition-plus-modifier phase always produced', () => {
    // A card resolved through the public entry point is the reference. If the extraction had
    // altered ordering, ids, trace numbering or message numbering, the golden scenario hashes in
    // `resolve-card.test.ts` would have moved; this asserts the narrower slot-level fact directly
    // so a failure here says *what* moved rather than only that a digest did.
    for (const scenario of getScenarioDefinitions()) {
      const context = buildDemoContext(scenario.id)
      const planned = plannedSlots(context, scenario.id, scenario.defaultModifierCodes)
      const resolved = resolveCard(
        { ...defaultBuildInput(scenario.id), modifierCodes: scenario.defaultModifierCodes },
        context,
      )
      const resolvedIds = [...resolved.items, ...resolved.suppressedItems].map((item) => item.id)
      expect(stableStringify([...planned.map((slot) => slot.id)].sort())).toBe(
        stableStringify([...resolvedIds].sort()),
      )
    }
  })
})
