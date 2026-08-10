import modifierCatalogJson from '../../../../data/ip-preference-cards/generated/modifier-catalog.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import proceduresJson from '../../../../data/ip-preference-cards/generated/procedures.json'
import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import scenariosJson from '../../../../data/ip-preference-cards/generated/scenarios.json'
import generatedModifiersJson from '../../../../data/ip-preference-cards/generated/modifier-definitions.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'
import slotsJson from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import overridesJson from '../../../../data/ip-preference-cards/seed/scenario-overrides.json'
import seedCompositionsJson from '../../../../data/ip-preference-cards/seed/procedure-compositions.json'

import { buildScenarios } from '../../../../scripts/ip-preference-cards/generate-scenarios'
import { buildDemoContext, getScenarioDefinitions } from '../data/demo-context.server'
import { expandDefaultRecipeComposition } from '../domain/expand-recipe-composition'
import { operationalModifiers } from '../seed/operational'

describe('scenario generator', () => {
  const result = buildScenarios({
    procedures: proceduresJson as never,
    slots: slotsJson as never,
    products: productsJson as never,
    productRoles: productRolesJson as never,
    slotProductOptions: slotProductOptionsJson as never,
    modifierCatalog: modifierCatalogJson as never,
    overrides: overridesJson as never,
    seedCompositions: seedCompositionsJson as never,
  })

  it('reproduces the committed scenarios.json exactly', () => {
    // Guards against a stale checked-in file after a workbook re-import.
    expect(result.scenarios).toEqual(JSON.parse(JSON.stringify(scenariosJson)))
  })

  it('reproduces the committed modifier-definitions.json exactly', () => {
    expect(result.modifierDefinitions).toEqual(JSON.parse(JSON.stringify(generatedModifiersJson)))
  })

  it('produces one scenario per imported procedure', () => {
    expect(result.scenarios).toHaveLength(proceduresJson.length)
  })

  it('preserves the three original golden scenario ids', () => {
    const ids = result.scenarios.map((scenario) => scenario.id)
    expect(ids).toEqual(
      expect.arrayContaining(['ebus-rose-molecular', 'central-airway-obstruction', 'chest-tube']),
    )
  })

  it('keeps the curated title for the central-airway scenario', () => {
    const scenario = result.scenarios.find((entry) => entry.id === 'central-airway-obstruction')
    expect(scenario?.title).toBe('Central airway obstruction / tumor debulking')
    expect(scenario?.recipeName).toBe('Central airway obstruction / tumor debulking')
  })

  it('never generates a definition that would shadow a hand-tuned modifier', () => {
    const handTuned = new Set(operationalModifiers.map((modifier) => modifier.code))
    for (const definition of result.modifierDefinitions) {
      expect(handTuned.has(definition.code)).toBe(false)
    }
  })

  it('ships generated modifiers as informational tags with no invented actions', () => {
    // The workbook records modifier effects only as prose, so synthesizing slot actions
    // would invent slot ids.
    for (const definition of result.modifierDefinitions) {
      expect(definition.actions).toEqual([])
      expect(definition.informational).toBe(true)
    }
  })

  it('reports required roles with no catalogued product for each procedure', () => {
    const rolesWithProducts = new Set(
      (productRolesJson as { role_code: string }[]).map((row) => row.role_code),
    )
    for (const scenario of result.scenarios) {
      for (const roleCode of scenario.roleCodesWithoutCatalogProducts) {
        expect(rolesWithProducts.has(roleCode)).toBe(false)
      }
      expect(scenario.requiredCatalogCoverageCount).toBeLessThanOrEqual(scenario.requiredSlotCount)
      expect(scenario.requiredDefaultOptionCoverageCount).toBeLessThanOrEqual(
        scenario.requiredSlotCount,
      )
    }
  })

  it('sorts output deterministically', () => {
    const codes = result.scenarios.map((scenario) => scenario.sourceProcedureCode)
    expect(codes).toEqual([...codes].sort())
    const modifierCodes = result.modifierDefinitions.map((definition) => definition.code)
    expect(modifierCodes).toEqual([...modifierCodes].sort())
  })
})

describe('scenario loader', () => {
  const scenarios = getScenarioDefinitions()

  it('exposes every imported procedure as a buildable scenario', () => {
    expect(scenarios).toHaveLength(proceduresJson.length)
    expect(scenarios.length).toBeGreaterThan(3)
  })

  it('resolves every available modifier code to a definition in the build context', () => {
    for (const scenario of scenarios) {
      const context = buildDemoContext(scenario.id)
      const known = new Set(context.modifiers.map((modifier) => modifier.code))
      for (const code of scenario.availableModifierCodes) {
        expect(known.has(code)).toBe(true)
      }
    }
  })

  it('builds a recipe with slots for every procedure', () => {
    for (const scenario of scenarios) {
      const context = buildDemoContext(scenario.id)
      expect(expandDefaultRecipeComposition(context).slots.length).toBeGreaterThan(0)
      expect(context.recipe.sourceProcedureCode).toBe(scenario.sourceProcedureCode)
    }
  })

  it('includes procedures that were unbuildable before scenarios became data-driven', () => {
    const codes = scenarios.map((scenario) => scenario.sourceProcedureCode)
    expect(codes).toEqual(
      expect.arrayContaining(['THORACENTESIS', 'MED_THORACOSCOPY', 'EBV', 'PERC_TRACH']),
    )
  })

  it('defaults every scenario to modifier codes it also offers', () => {
    for (const scenario of scenarios) {
      for (const code of scenario.defaultModifierCodes) {
        expect(scenario.availableModifierCodes).toContain(code)
      }
    }
  })
})
