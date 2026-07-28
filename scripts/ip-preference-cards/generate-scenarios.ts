import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { calculateProcedureCoverage } from './coverage-metrics'
import { formatJson } from './format-json'

/**
 * Builds one card scenario per imported procedure, so adding a procedure to the workbook
 * is enough to make it buildable — no hand-written TypeScript.
 *
 * Everything here is derived from the generated catalog plus a small curated overrides
 * file. Output is sorted and deterministic: re-running without a re-import must leave
 * `git status` clean.
 */

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const SEED_DIRECTORY = 'data/ip-preference-cards/seed'

/** Modifiers hand-tuned in seed/operational.ts. Generated definitions never override these. */
const HAND_TUNED_MODIFIER_CODES = new Set([
  'ROSE',
  'SPEC_MOLECULAR',
  'RIGID_AIRWAY',
  'APC',
  'BALLOON_DILATION',
  'STENT_PLACE',
  'JET_VENT',
  'FLUOROSCOPY',
  'HIGH_BLEED_RISK',
  'TECH_CHEST_TUBE_SMALL_BORE',
  'TECH_CHEST_TUBE_LARGE_BORE',
  'DIGITAL_DRAINAGE',
])

interface ProcedureRow {
  procedure_code: string
  procedure_name: string
  template_version: string | null
  notes: string | null
}

interface ProcedureSlotRow {
  slot_id: string
  procedure_code: string
  role_code: string
  requiredness: string
  display_order: number
  allow_custom: boolean
}

interface ProductRow {
  product_id: string
}

interface ProductRoleRow {
  product_id: string
  role_code: string
}

interface SlotProductOptionRow {
  slot_id: string
  selectable: boolean | null
}

interface ModifierCatalogRow {
  modifier_code: string
  modifier_name: string
  applies_to: string
  adds_changes: string | null
  constraint_or_localization: string | null
  release_state: string
}

interface ScenarioOverride {
  id?: string
  title?: string
  recipeName?: string
  shortDescription?: string
  defaultModifierCodes?: string[]
  addModifiers?: string[]
  removeModifiers?: string[]
}

interface OverridesFile {
  procedureGroups: Record<string, string[]>
  appliesToProcedures: Record<string, string[]>
  modifierGroupCodes: Record<string, string>
  mutuallyExclusiveModifierGroups: string[][]
  scenarios: Record<string, ScenarioOverride>
}

async function readJson<T>(directory: string, filename: string): Promise<T> {
  return JSON.parse(await readFile(path.join(directory, filename), 'utf8')) as T
}

async function writeJsonWhenChanged(directory: string, filename: string, value: unknown) {
  const outputPath = path.join(directory, filename)
  try {
    const current = JSON.parse(await readFile(outputPath, 'utf8')) as unknown
    if (JSON.stringify(current) === JSON.stringify(value)) return
  } catch {
    // Missing or malformed output is replaced below.
  }
  await writeFile(outputPath, await formatJson(value), 'utf8')
}

function kebab(procedureCode: string): string {
  return procedureCode.toLowerCase().replace(/_/g, '-')
}

/** Expand "@groupName" references and "*" into concrete procedure codes. */
function expandProcedureRefs(
  refs: string[],
  groups: Record<string, string[]>,
  allProcedureCodes: string[],
): string[] {
  const expanded = new Set<string>()
  for (const ref of refs) {
    if (ref === '*') {
      allProcedureCodes.forEach((code) => expanded.add(code))
    } else if (ref.startsWith('@')) {
      for (const code of groups[ref.slice(1)] ?? []) expanded.add(code)
    } else {
      expanded.add(ref)
    }
  }
  return [...expanded].filter((code) => allProcedureCodes.includes(code)).sort()
}

export interface GeneratedScenario {
  id: string
  title: string
  recipeName: string
  shortDescription: string
  recipeVersionId: string
  sourceProcedureCode: string
  templateVersion: string
  defaultModifierCodes: string[]
  availableModifierCodes: string[]
  requiredCatalogCoverageCount: number
  requiredCatalogCoveragePercentage: number
  requiredSlotsWithoutCatalogProducts: string[]
  roleCodesWithoutCatalogProducts: string[]
  requiredDefaultOptionCoverageCount: number
  requiredDefaultOptionCoveragePercentage: number
  requiredSlotsWithoutDefaultOptions: string[]
  requiredCustomAllowedCount: number
  slotCount: number
  requiredSlotCount: number
  governanceState: 'draft'
  owner: null
}

export interface GeneratedModifierDefinition {
  code: string
  name: string
  groupCode: string
  description: string
  releaseState: string
  active: boolean
  appliesTo: string
  preview: string[]
  conflictsWith: string[]
  /**
   * Empty by design. The workbook records modifier effects only as prose
   * (`adds_changes`), with no structured modifier-to-slot links, so synthesizing
   * add_slot actions would invent slot ids. These ship as informational tags that
   * print on the card; the twelve hand-tuned modifiers in seed/operational.ts keep
   * their real actions.
   */
  actions: never[]
  informational: true
}

export interface GenerateScenariosResult {
  scenarios: GeneratedScenario[]
  modifierDefinitions: GeneratedModifierDefinition[]
}

export function buildScenarios(input: {
  procedures: ProcedureRow[]
  slots: ProcedureSlotRow[]
  products: ProductRow[]
  productRoles: ProductRoleRow[]
  slotProductOptions: SlotProductOptionRow[]
  modifierCatalog: ModifierCatalogRow[]
  overrides: OverridesFile
}): GenerateScenariosResult {
  const {
    procedures,
    slots,
    products,
    productRoles,
    slotProductOptions,
    modifierCatalog,
    overrides,
  } = input

  const allProcedureCodes = procedures.map((procedure) => procedure.procedure_code).sort()
  const coverageByProcedure = new Map(
    calculateProcedureCoverage({
      products,
      productRoles,
      procedures,
      slots,
      slotProductOptions,
    }).map((coverage) => [coverage.procedureCode, coverage]),
  )

  const slotsByProcedure = new Map<string, ProcedureSlotRow[]>()
  for (const slot of slots) {
    const existing = slotsByProcedure.get(slot.procedure_code)
    if (existing) existing.push(slot)
    else slotsByProcedure.set(slot.procedure_code, [slot])
  }

  // modifier code -> procedures it applies to
  const modifiersByProcedure = new Map<string, Set<string>>()
  for (const procedureCode of allProcedureCodes) {
    modifiersByProcedure.set(procedureCode, new Set())
  }
  for (const modifier of modifierCatalog) {
    const refs = overrides.appliesToProcedures[modifier.applies_to]
    if (!refs) {
      throw new Error(
        `Unmapped modifier applies_to value "${modifier.applies_to}" (modifier ${modifier.modifier_code}). Add it to appliesToProcedures in scenario-overrides.json.`,
      )
    }
    for (const procedureCode of expandProcedureRefs(
      refs,
      overrides.procedureGroups,
      allProcedureCodes,
    )) {
      modifiersByProcedure.get(procedureCode)?.add(modifier.modifier_code)
    }
  }

  const scenarios: GeneratedScenario[] = procedures
    .map((procedure) => {
      const override = overrides.scenarios[procedure.procedure_code] ?? {}
      const procedureSlots = slotsByProcedure.get(procedure.procedure_code) ?? []
      const coverage = coverageByProcedure.get(procedure.procedure_code)
      if (!coverage) {
        throw new Error(`Coverage metrics are missing for ${procedure.procedure_code}.`)
      }

      const available = new Set(modifiersByProcedure.get(procedure.procedure_code) ?? [])
      for (const code of override.addModifiers ?? []) available.add(code)
      for (const code of override.removeModifiers ?? []) available.delete(code)

      const title = override.title ?? procedure.procedure_name
      return {
        id: override.id ?? kebab(procedure.procedure_code),
        title,
        recipeName: override.recipeName ?? procedure.procedure_name,
        shortDescription:
          override.shortDescription ??
          `Equipment and room setup for ${procedure.procedure_name.toLowerCase()}.`,
        recipeVersionId: `recipe-${kebab(procedure.procedure_code)}-v0-1`,
        sourceProcedureCode: procedure.procedure_code,
        templateVersion: procedure.template_version ?? '0.1',
        defaultModifierCodes: [...(override.defaultModifierCodes ?? [])].sort(),
        availableModifierCodes: [...available].sort(),
        requiredCatalogCoverageCount: coverage.requiredCatalogCoverageCount,
        requiredCatalogCoveragePercentage: coverage.requiredCatalogCoveragePercentage,
        requiredSlotsWithoutCatalogProducts: coverage.requiredSlotsWithoutCatalogProducts,
        roleCodesWithoutCatalogProducts: coverage.roleCodesWithoutCatalogProducts,
        requiredDefaultOptionCoverageCount: coverage.requiredDefaultOptionCoverageCount,
        requiredDefaultOptionCoveragePercentage: coverage.requiredDefaultOptionCoveragePercentage,
        requiredSlotsWithoutDefaultOptions: coverage.requiredSlotsWithoutDefaultOptions,
        requiredCustomAllowedCount: coverage.requiredCustomAllowedCount,
        slotCount: procedureSlots.length,
        requiredSlotCount: coverage.requiredSlotCount,
        governanceState: 'draft' as const,
        owner: null,
      }
    })
    .sort((left, right) => left.sourceProcedureCode.localeCompare(right.sourceProcedureCode))

  const conflictsByCode = new Map<string, Set<string>>()
  for (const group of overrides.mutuallyExclusiveModifierGroups) {
    for (const code of group) {
      const conflicts = conflictsByCode.get(code) ?? new Set<string>()
      group.filter((other) => other !== code).forEach((other) => conflicts.add(other))
      conflictsByCode.set(code, conflicts)
    }
  }

  const modifierDefinitions: GeneratedModifierDefinition[] = modifierCatalog
    .filter((modifier) => !HAND_TUNED_MODIFIER_CODES.has(modifier.modifier_code))
    .map((modifier) => ({
      code: modifier.modifier_code,
      name: modifier.modifier_name,
      groupCode: overrides.modifierGroupCodes[modifier.modifier_code] ?? 'therapeutic',
      description: [modifier.adds_changes, modifier.constraint_or_localization]
        .filter(Boolean)
        .join(' — '),
      releaseState: modifier.release_state,
      active: true,
      appliesTo: modifier.applies_to,
      preview: modifier.adds_changes ? [modifier.adds_changes] : [],
      conflictsWith: [...(conflictsByCode.get(modifier.modifier_code) ?? [])].sort(),
      actions: [] as never[],
      informational: true as const,
    }))
    .sort((left, right) => left.code.localeCompare(right.code))

  return { scenarios, modifierDefinitions }
}

async function main() {
  const generatedDirectory = process.argv[2] ?? GENERATED_DIRECTORY
  const seedDirectory = process.argv[3] ?? SEED_DIRECTORY

  const [
    procedures,
    slots,
    products,
    productRoles,
    slotProductOptions,
    modifierCatalog,
    overrides,
  ] = await Promise.all([
    readJson<ProcedureRow[]>(generatedDirectory, 'procedures.json'),
    readJson<ProcedureSlotRow[]>(generatedDirectory, 'procedure-slots.json'),
    readJson<ProductRow[]>(generatedDirectory, 'catalog-products.json'),
    readJson<ProductRoleRow[]>(generatedDirectory, 'product-roles.json'),
    readJson<SlotProductOptionRow[]>(generatedDirectory, 'slot-product-options.json'),
    readJson<ModifierCatalogRow[]>(generatedDirectory, 'modifier-catalog.json'),
    readJson<OverridesFile>(seedDirectory, 'scenario-overrides.json'),
  ])

  const result = buildScenarios({
    procedures,
    slots,
    products,
    productRoles,
    slotProductOptions,
    modifierCatalog,
    overrides,
  })

  await writeJsonWhenChanged(generatedDirectory, 'scenarios.json', result.scenarios)
  await writeJsonWhenChanged(
    generatedDirectory,
    'modifier-definitions.json',
    result.modifierDefinitions,
  )

  const buildable = result.scenarios.filter(
    (scenario) => scenario.requiredCatalogCoverageCount > 0,
  ).length
  console.log(
    `Wrote ${result.scenarios.length} scenarios (${buildable} with at least one catalogued required role) and ${result.modifierDefinitions.length} generated modifier definitions.`,
  )
  for (const scenario of result.scenarios) {
    console.log(
      `  ${scenario.sourceProcedureCode.padEnd(20)} catalog ${scenario.requiredCatalogCoverageCount}/${scenario.requiredSlotCount} · defaults ${scenario.requiredDefaultOptionCoverageCount}/${scenario.requiredSlotCount} · ${scenario.slotCount} slots · ${scenario.availableModifierCodes.length} modifiers`,
    )
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
