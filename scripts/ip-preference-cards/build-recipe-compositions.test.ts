import generatedCompositionsJson from '../../data/ip-preference-cards/generated/procedure-compositions.json'
import generatedModulesJson from '../../data/ip-preference-cards/generated/recipe-modules.json'
import generatedReportJson from '../../data/ip-preference-cards/generated/recipe-composition-report.json'
import importReportJson from '../../data/ip-preference-cards/generated/import-report.json'
import proceduresJson from '../../data/ip-preference-cards/generated/procedures.json'
import scenariosJson from '../../data/ip-preference-cards/generated/scenarios.json'
import slotsJson from '../../data/ip-preference-cards/generated/procedure-slots.json'
import moduleMapJson from '../../data/ip-preference-cards/seed/recipe-module-map.json'
import compositionsJson from '../../data/ip-preference-cards/seed/procedure-compositions.json'
import sectionMapJson from '../../data/ip-preference-cards/seed/section-zone-phase-map.json'

import { buildRecipeCompositions, collectModifierTargets } from './build-recipe-compositions'

/**
 * The build is the migration's proof, so its own failure modes are pinned here: every rule
 * that would let a requirement silently move, disappear, or be claimed twice must be a hard
 * error rather than a quiet skip.
 */

const baseInput = () => ({
  procedures: proceduresJson as never,
  scenarios: scenariosJson as never,
  slots: slotsJson as never,
  sectionMap: sectionMapJson as never,
  catalogImportId: (importReportJson as { workbook_sha256: string }).workbook_sha256,
  moduleMap: JSON.parse(JSON.stringify(moduleMapJson)) as never,
  compositionFile: JSON.parse(JSON.stringify(compositionsJson)) as never,
  modifierTargets: collectModifierTargets(),
})

describe('recipe composition build', () => {
  it('reproduces the committed generated data exactly', () => {
    const result = buildRecipeCompositions(baseInput())
    expect(result.modules).toEqual(generatedModulesJson)
    expect(result.compositions).toEqual(generatedCompositionsJson)
    expect(result.report).toEqual(generatedReportJson)
  })

  it('is deterministic across repeated runs', () => {
    expect(JSON.stringify(buildRecipeCompositions(baseInput()))).toBe(
      JSON.stringify(buildRecipeCompositions(baseInput())),
    )
  })

  it('composes every imported slot of every procedure exactly once', () => {
    const result = buildRecipeCompositions(baseInput())
    for (const entry of result.report.procedures) {
      expect(entry.defaultComposedSlotCount).toBe(entry.originalSlotCount)
    }
    expect(result.report.procedures).toHaveLength(15)
  })

  it('extracts a reviewed core for EBUS, therapeutic bronchoscopy, and the pleural procedures', () => {
    const result = buildRecipeCompositions(baseInput())
    const withCore = result.report.procedures.filter((entry) => entry.hasReviewedCoreMapping)
    expect(withCore.map((entry) => entry.procedureCode).sort()).toEqual([
      'CHEST_TUBE',
      'EBUS_TBNA',
      'EBV',
      'IPC_PLACEMENT',
      'MED_THORACOSCOPY',
      'THERAPEUTIC_BRONCH',
      'THORACENTESIS',
    ])
  })

  it('rejects a requirement that names a slot the import does not have', () => {
    const input = baseInput()
    const moduleMap = input.moduleMap as unknown as {
      modules: { code: string; requirements?: { definitionSourceSlotId: string }[] }[]
    }
    const core = moduleMap.modules.find((module) => module.code === 'FLEX_BRONCH_CORE')!
    core.requirements![0].definitionSourceSlotId = 'SLOT-DOESNOTEXIST'

    expect(() => buildRecipeCompositions(input)).toThrow(/unknown definition slot/)
  })

  it('rejects two requirements claiming the same imported slot', () => {
    const input = baseInput()
    const moduleMap = input.moduleMap as unknown as {
      modules: { code: string; requirements?: { sourceSlotAliases?: string[] }[] }[]
    }
    const pleural = moduleMap.modules.find((module) => module.code === 'PLEURAL_PROCEDURE_CORE')!
    const flex = moduleMap.modules.find((module) => module.code === 'FLEX_BRONCH_CORE')!
    flex.requirements![0].sourceSlotAliases = [
      ...(flex.requirements![0].sourceSlotAliases ?? []),
      pleural.requirements![0].sourceSlotAliases![0],
    ]

    expect(() => buildRecipeCompositions(input)).toThrow(/is claimed by both/)
  })

  it('rejects absorbing a row whose selection mode differs', () => {
    const input = baseInput()
    const moduleMap = input.moduleMap as unknown as {
      modules: { code: string; requirements?: { sourceSlotAliases?: string[] }[] }[]
    }
    const flex = moduleMap.modules.find((module) => module.code === 'FLEX_BRONCH_CORE')!
    // The diagnostic-bronchoscopy suction row is single-select where the core's is multiple.
    flex.requirements![1].sourceSlotAliases = [
      ...(flex.requirements![1].sourceSlotAliases ?? []),
      'SLOT-49853F1B39',
    ]

    expect(() => buildRecipeCompositions(input)).toThrow(/selection_mode differs/)
  })

  it('rejects a behavioural difference no composition action restores', () => {
    const input = baseInput()
    const compositionFile = input.compositionFile as unknown as {
      compositions: { procedureCode: string; compositionActions: unknown[] }[]
    }
    const chestTube = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'CHEST_TUBE',
    )!
    chestTube.compositionActions = []

    expect(() => buildRecipeCompositions(input)).toThrow(/no set_requiredness composition action/)
  })

  it('rejects a composition action that matches nothing', () => {
    const input = baseInput()
    const compositionFile = input.compositionFile as unknown as {
      compositions: {
        procedureCode: string
        compositionActions: Record<string, unknown>[]
      }[]
    }
    const thoracentesis = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'THORACENTESIS',
    )!
    thoracentesis.compositionActions = [
      {
        id: 'orphan-action',
        sequence: 10,
        actionType: 'append_note',
        targetRequirementKey: 'NOT_A_REQUIREMENT',
        payload: { note: 'x' },
        reason: 'test',
      },
    ]

    expect(() => buildRecipeCompositions(input)).toThrow(/matches no requirement/)
  })

  it('rejects a composition that would drop an imported slot', () => {
    const input = baseInput()
    const compositionFile = input.compositionFile as unknown as {
      compositions: { procedureCode: string; moduleReferences: { moduleCode: string }[] }[]
    }
    const ebus = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'EBUS_TBNA',
    )!
    ebus.moduleReferences = ebus.moduleReferences.filter(
      (reference) => reference.moduleCode !== 'FLEX_BRONCH_CORE',
    )

    expect(() => buildRecipeCompositions(input)).toThrow(/drops imported slots/)
  })

  it('rejects a composition that would add a requirement the template never had', () => {
    const input = baseInput()
    const compositionFile = input.compositionFile as unknown as {
      compositions: {
        procedureCode: string
        moduleReferences: {
          moduleCode: string
          moduleVersion: string
          selectionBehavior: string
          sequence: number
        }[]
      }[]
    }
    const thoracentesis = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'THORACENTESIS',
    )!
    thoracentesis.moduleReferences.push({
      moduleCode: 'FLEX_BRONCH_CORE',
      moduleVersion: '1.1',
      selectionBehavior: 'required',
      sequence: 30,
    })

    expect(() => buildRecipeCompositions(input)).toThrow(/requirement\(s\) its imported template/)
  })

  it('rejects a procedure with no composition', () => {
    const input = baseInput()
    const compositionFile = input.compositionFile as unknown as {
      compositions: { procedureCode: string }[]
    }
    compositionFile.compositions = compositionFile.compositions.filter(
      (composition) => composition.procedureCode !== 'WLL',
    )

    expect(() => buildRecipeCompositions(input)).toThrow(/WLL has no composition/)
  })

  it('rejects a requirement key defined by two modules', () => {
    const input = baseInput()
    const moduleMap = input.moduleMap as unknown as {
      modules: { code: string; requirements?: { requirementKey: string }[] }[]
    }
    const pleural = moduleMap.modules.find((module) => module.code === 'PLEURAL_PROCEDURE_CORE')!
    const flex = moduleMap.modules.find((module) => module.code === 'FLEX_BRONCH_CORE')!
    pleural.requirements![0].requirementKey = flex.requirements![0].requirementKey

    expect(() => buildRecipeCompositions(input)).toThrow(/belongs to one module/)
  })

  it('rejects a module nothing references', () => {
    const input = baseInput()
    const compositionFile = input.compositionFile as unknown as {
      compositions: {
        procedureCode: string
        moduleReferences: { moduleCode: string }[]
      }[]
    }
    const ebv = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'EBV',
    )!
    ebv.moduleReferences = ebv.moduleReferences.filter(
      (reference) => reference.moduleCode !== 'PROCEDURAL_FLUOROSCOPY',
    )
    const ebus = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'EBUS_TBNA',
    )!
    ebus.moduleReferences = ebus.moduleReferences.filter(
      (reference) => reference.moduleCode !== 'PROCEDURAL_FLUOROSCOPY',
    )
    const therapeutic = compositionFile.compositions.find(
      (composition) => composition.procedureCode === 'THERAPEUTIC_BRONCH',
    )!
    therapeutic.moduleReferences = therapeutic.moduleReferences.filter(
      (reference) => reference.moduleCode !== 'PROCEDURAL_FLUOROSCOPY',
    )

    expect(() => buildRecipeCompositions(input)).toThrow(/referenced by no composition/)
  })
})
