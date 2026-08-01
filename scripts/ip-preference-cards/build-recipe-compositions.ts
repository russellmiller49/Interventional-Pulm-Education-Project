import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  procedureSlotToRecipeSlot,
  type ProcedureSlotRow,
  type SectionMapping,
} from '../../src/features/preference-cards/domain/procedure-slot-row'
import type {
  ProcedureCompositionAction,
  RecipeModuleReference,
  RecipeModuleVersion,
} from '../../src/features/preference-cards/domain/types'
import {
  operationalModifiers,
  rescueModules,
} from '../../src/features/preference-cards/seed/operational'

import { formatJson } from './format-json'

/**
 * Builds the runtime composition data from two reviewed seed files plus the imported
 * procedure slots, and reports what the migration did.
 *
 * Nothing here infers membership. A requirement is shared only because
 * `recipe-module-map.json` says so, and the script's job is to prove that what the seed
 * claims actually holds: every imported slot is accounted for exactly once, no two
 * requirements claim the same row, structural fields agree across the rows a shared
 * requirement absorbed, and every behavioural difference between them is addressed by an
 * explicit composition action rather than lost.
 *
 * Every rule below is a hard error, never a silent skip.
 */

const GENERATED_DIRECTORY = 'data/ip-preference-cards/generated'
const SEED_DIRECTORY = 'data/ip-preference-cards/seed'

interface ProcedureRow {
  procedure_code: string
  procedure_name: string
  template_version: string | null
  clinical_owner: string | null
}

/**
 * The scenario fields that are *recipe identity* rather than presentation.
 *
 * These used to be read at runtime, which quietly made `scenarios.json` — a file regenerated
 * from the workbook on every import — part of what a saved card resolves through. A retitled
 * scenario changed `recipeName`, `recipeName` lands in the resolved card, and the card's
 * snapshot hash moved underneath a pin that had not changed. Resolving them here and writing
 * them into the composition freezes them alongside everything else the composition authors.
 */
interface ScenarioIdentityRow {
  id: string
  recipeName: string
  recipeVersionId: string
  sourceProcedureCode: string
  templateVersion: string
  availableModifierCodes: string[]
}

interface SeedModuleRequirement {
  requirementKey: string
  definitionSourceSlotId: string
  sourceSlotAliases?: string[]
  sequence: number
  reason: string
}

interface SeedModule {
  code: string
  version: string
  name: string
  kind: 'core' | 'procedure_specific' | 'optional'
  governanceState: 'draft' | 'in_review' | 'approved' | 'retired'
  clinicalOwner: string | null
  operationalOwner: string | null
  description: string
  requirements?: SeedModuleRequirement[]
  remainingSlotsFromProcedure?: string
  reason?: string
}

interface SeedModuleMap {
  formatVersion: string
  modules: SeedModule[]
}

interface SeedModuleReference {
  moduleCode: string
  moduleVersion: string
  selectionBehavior: 'required' | 'default_on' | 'optional'
  sequence: number
}

interface SeedCompositionAction extends ProcedureCompositionAction {
  reason: string
}

interface SeedComposition {
  procedureCode: string
  /**
   * The recipe version id this composition publishes under, authored rather than derived.
   *
   * Deriving it from the scenario would mean a procedure can only ever have one composition,
   * because there would be exactly one string to derive. Authoring it is what allows a
   * superseded composition to be retained beside the one that replaced it — a released card
   * pins this string, and the pin is worth nothing if the only thing it can name is whatever
   * the procedure means now.
   */
  recipeVersionId: string
  recipeVersion: string
  version: string
  moduleReferences: SeedModuleReference[]
  compositionActions: SeedCompositionAction[]
}

interface SeedCompositionFile {
  formatVersion: string
  compositions: SeedComposition[]
}

export interface GeneratedProcedureComposition {
  /**
   * The recipe version this composition *is*, and the key the generated file is addressed by.
   *
   * A composition used to be looked up by procedure code, which made it a current singleton:
   * one procedure, one composition, no way for a superseded version to coexist with the one
   * that replaced it. A saved card pinning the old id had nothing to resolve against. Keying
   * on the recipe version is what lets a procedure retain more than one, which is the whole
   * basis for a pin outliving the release that created it.
   */
  recipeVersionId: string
  scenarioId: string
  procedureCode: string
  /** Composition-format version. Distinct from `recipeVersion`, which the card prints. */
  version: string
  /** Recipe identity, resolved once at build time so nothing reassembles it at read time. */
  recipeName: string
  recipeVersion: string
  sourceTemplateVersion: string
  governanceState: 'draft' | 'in_review' | 'approved' | 'retired'
  clinicalOwner: string | null
  /** Which modifiers this procedure offers. Frozen here so a release can pin the permission. */
  allowedModifierCodes: string[]
  moduleReferences: RecipeModuleReference[]
  compositionActions: ProcedureCompositionAction[]
  /**
   * The reviewed template's own setup order, keyed by `requirementKey`.
   *
   * Composition decides *what* is on the card; this decides *where*. Without it the card
   * would sort by whichever module contributed each line, which is an assembly detail no
   * clinician authored — see `effectiveSetupSequence` in the domain.
   */
  requirementSequences: Record<string, number>
}

interface FieldReconciliation {
  requirementKey: string
  moduleCode: string
  field: string
  definitionValue: string | null
  aliasSlotId: string
  aliasProcedureCode: string
  aliasValue: string | null
}

export interface RecipeCompositionReport {
  generatedFrom: {
    procedures: number
    procedureSlots: number
    modules: number
    /** Imported rows folded into a shared requirement defined by another procedure. */
    duplicateRequirementsRemoved: number
  }
  procedures: {
    procedureCode: string
    originalSlotCount: number
    coreModuleSlotCount: number
    optionalModuleSlotCount: number
    procedureSpecificSlotCount: number
    defaultComposedSlotCount: number
    duplicateRequirementsRemoved: number
    moduleCodes: string[]
    hasReviewedCoreMapping: boolean
  }[]
  sharedRequirements: {
    requirementKey: string
    moduleCode: string
    definitionSourceSlotId: string
    absorbedSlotIds: string[]
    procedureCodes: string[]
  }[]
  reconciliations: FieldReconciliation[]
  unmappedProcedures: { procedureCode: string; moduleCode: string; reason: string }[]
  modifierTargetAliasMigrations: {
    modifierCode: string
    actionId: string
    targetSlotId: string
    resolvedThrough: 'alias'
    requirementKey: string
    moduleCode: string
  }[]
}

export interface BuildRecipeCompositionsResult {
  modules: RecipeModuleVersion[]
  compositions: GeneratedProcedureComposition[]
  report: RecipeCompositionReport
}

function fail(message: string): never {
  throw new Error(message)
}

function kebab(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function moduleVersionId(code: string, version: string): string {
  return `module-${kebab(code)}-v${kebab(version)}`
}

/**
 * Fields that must be identical across every imported row a shared requirement absorbs.
 * A difference here is structural — what the card asks for changes — so it is an error
 * rather than something a composition action can paper over.
 */
const structuralFields = ['selection_mode', 'default_qty', 'allow_custom', 'section'] as const

/**
 * Fields that may differ between absorbed rows. Requiredness and the dependency rule are
 * behavioural and must be restored by a composition action; the rest are wording and are
 * reported so a reviewer can see exactly what the shared line now says.
 */
const behaviouralFields = ['requiredness', 'dependency_rule'] as const
const wordingFields = ['slot_label', 'generic_requirement', 'notes'] as const

function fieldValue(row: ProcedureSlotRow, field: string): string | null {
  const value = (row as unknown as Record<string, unknown>)[field]
  return value === null || value === undefined ? null : String(value)
}

export function buildRecipeCompositions(input: {
  procedures: ProcedureRow[]
  scenarios: ScenarioIdentityRow[]
  /**
   * Module versions kept alive because a published release pins them, even though no current
   * composition references them any more. Supplied by the caller from the retention ledger.
   */
  retainedModuleVersionIds?: ReadonlySet<string>
  slots: ProcedureSlotRow[]
  sectionMap: Record<string, SectionMapping>
  catalogImportId: string
  moduleMap: SeedModuleMap
  compositionFile: SeedCompositionFile
  modifierTargets: { modifierCode: string; actionId: string; targetSlotId: string }[]
}): BuildRecipeCompositionsResult {
  const { procedures, scenarios, slots, sectionMap, catalogImportId, moduleMap, compositionFile } =
    input

  const slotById = new Map(slots.map((slot) => [slot.slot_id, slot]))
  const procedureCodes = new Set(procedures.map((procedure) => procedure.procedure_code))
  const procedureByCode = new Map(
    procedures.map((procedure) => [procedure.procedure_code, procedure]),
  )
  // One scenario per procedure today. Asserted rather than assumed: a second scenario naming
  // the same procedure would make "which recipe identity does this composition carry" a
  // question with two answers, and picking either would be picking one at random.
  const scenarioByProcedure = new Map<string, ScenarioIdentityRow>()
  for (const scenario of scenarios) {
    const existing = scenarioByProcedure.get(scenario.sourceProcedureCode)
    if (existing) {
      fail(
        `Procedure ${scenario.sourceProcedureCode} is claimed by scenarios "${existing.id}" and "${scenario.id}". Recipe identity would be ambiguous.`,
      )
    }
    scenarioByProcedure.set(scenario.sourceProcedureCode, scenario)
  }
  const slotsByProcedure = new Map<string, ProcedureSlotRow[]>()
  for (const slot of slots) {
    const existing = slotsByProcedure.get(slot.procedure_code)
    if (existing) existing.push(slot)
    else slotsByProcedure.set(slot.procedure_code, [slot])
  }

  // --- module identity ------------------------------------------------------------
  const seenModuleKeys = new Set<string>()
  for (const seedModule of moduleMap.modules) {
    const key = `${seedModule.code}@${seedModule.version}`
    if (seenModuleKeys.has(key)) fail(`Module ${key} is declared more than once.`)
    seenModuleKeys.add(key)
    if (!seedModule.requirements && !seedModule.remainingSlotsFromProcedure) {
      fail(`Module ${key} declares neither requirements nor remainingSlotsFromProcedure.`)
    }
    if (
      seedModule.remainingSlotsFromProcedure &&
      !procedureCodes.has(seedModule.remainingSlotsFromProcedure)
    ) {
      fail(`Module ${key} names unknown procedure ${seedModule.remainingSlotsFromProcedure}.`)
    }
    if (seedModule.remainingSlotsFromProcedure && !seedModule.reason) {
      fail(`Module ${key} assigns the remaining slots of a procedure without a reason.`)
    }
  }

  // --- explicit requirement claims ------------------------------------------------
  // Every imported slot id may be claimed by exactly one requirement, as its definition or
  // as an alias. That is what makes "each imported row is represented exactly once" a
  // provable property rather than a hope.
  const claimedBy = new Map<string, { moduleCode: string; requirementKey: string }>()
  const requirementOwner = new Map<string, string>()
  const reconciliations: FieldReconciliation[] = []
  const sharedRequirements: RecipeCompositionReport['sharedRequirements'] = []

  // Pass one registers every claim across every module, so "this row is claimed twice" is
  // reported as itself rather than surfacing later as whichever field happens to differ.
  const pendingRequirements: {
    seedModule: SeedModule
    requirement: SeedModuleRequirement
    aliases: string[]
  }[] = []
  for (const seedModule of moduleMap.modules) {
    for (const requirement of seedModule.requirements ?? []) {
      if (!requirement.reason) {
        fail(`Requirement ${requirement.requirementKey} in ${seedModule.code} has no reason.`)
      }
      const existingOwner = requirementOwner.get(requirement.requirementKey)
      if (existingOwner) {
        fail(
          `Requirement key ${requirement.requirementKey} is defined by both ${existingOwner} and ${seedModule.code}. A key belongs to one module.`,
        )
      }
      requirementOwner.set(requirement.requirementKey, seedModule.code)

      if (!slotById.has(requirement.definitionSourceSlotId)) {
        fail(
          `Requirement ${requirement.requirementKey} names unknown definition slot ${requirement.definitionSourceSlotId}.`,
        )
      }
      const aliases = [...(requirement.sourceSlotAliases ?? [])].sort()
      for (const slotId of [requirement.definitionSourceSlotId, ...aliases]) {
        const existing = claimedBy.get(slotId)
        if (existing) {
          fail(
            `Imported slot ${slotId} is claimed by both ${existing.moduleCode}/${existing.requirementKey} and ${seedModule.code}/${requirement.requirementKey}.`,
          )
        }
        claimedBy.set(slotId, {
          moduleCode: seedModule.code,
          requirementKey: requirement.requirementKey,
        })
      }
      pendingRequirements.push({ seedModule, requirement, aliases })
    }
  }

  // Pass two compares each absorbed row against the definition it is folding into.
  for (const { seedModule, requirement, aliases } of pendingRequirements) {
    {
      const definition = slotById.get(requirement.definitionSourceSlotId) as ProcedureSlotRow

      const aliasRows = aliases.map((slotId) => {
        const row = slotById.get(slotId)
        if (!row)
          fail(`Requirement ${requirement.requirementKey} names unknown alias slot ${slotId}.`)
        return row
      })

      for (const aliasRow of aliasRows) {
        for (const field of structuralFields) {
          if (fieldValue(definition, field) !== fieldValue(aliasRow, field)) {
            fail(
              `Requirement ${requirement.requirementKey} cannot absorb ${aliasRow.slot_id} (${aliasRow.procedure_code}): ${field} differs (${fieldValue(definition, field)} vs ${fieldValue(aliasRow, field)}). A structural difference is not a wording difference.`,
            )
          }
        }
        for (const field of [...behaviouralFields, ...wordingFields]) {
          if (fieldValue(definition, field) === fieldValue(aliasRow, field)) continue
          reconciliations.push({
            requirementKey: requirement.requirementKey,
            moduleCode: seedModule.code,
            field,
            definitionValue: fieldValue(definition, field),
            aliasSlotId: aliasRow.slot_id,
            aliasProcedureCode: aliasRow.procedure_code,
            aliasValue: fieldValue(aliasRow, field),
          })
        }
      }

      if (aliasRows.length > 0) {
        sharedRequirements.push({
          requirementKey: requirement.requirementKey,
          moduleCode: seedModule.code,
          definitionSourceSlotId: requirement.definitionSourceSlotId,
          absorbedSlotIds: aliases,
          procedureCodes: [
            ...new Set([definition.procedure_code, ...aliasRows.map((row) => row.procedure_code)]),
          ].sort(),
        })
      }
    }
  }

  // --- build the module versions ---------------------------------------------------
  const modules: RecipeModuleVersion[] = moduleMap.modules
    .map((seedModule) => {
      const id = moduleVersionId(seedModule.code, seedModule.version)
      const includedBy = `Included by ${seedModule.name} v${seedModule.version}`
      const explicit = (seedModule.requirements ?? []).map((requirement) =>
        procedureSlotToRecipeSlot({
          row: slotById.get(requirement.definitionSourceSlotId) as ProcedureSlotRow,
          sectionMap,
          requirementKey: requirement.requirementKey,
          sourceSlotAliases: requirement.sourceSlotAliases,
          setupSequence: requirement.sequence,
          includedBy,
        }),
      )
      const remaining = seedModule.remainingSlotsFromProcedure
        ? (slotsByProcedure.get(seedModule.remainingSlotsFromProcedure) ?? [])
            .filter((row) => !claimedBy.has(row.slot_id))
            .sort((left, right) => left.display_order - right.display_order)
            .map((row) =>
              procedureSlotToRecipeSlot({
                row,
                sectionMap,
                // The identity mapping: a slot that no reviewed core claims keys on its own
                // imported id, so it can never merge with anything else.
                requirementKey: row.slot_id,
                setupSequence: row.display_order,
                includedBy,
              }),
            )
        : []
      const slotsForModule = [...explicit, ...remaining].sort(
        (left, right) =>
          left.setupSequence - right.setupSequence || left.id.localeCompare(right.id),
      )
      return {
        id,
        code: seedModule.code,
        name: seedModule.name,
        description: seedModule.description,
        version: seedModule.version,
        kind: seedModule.kind,
        governanceState: seedModule.governanceState,
        clinicalOwner: seedModule.clinicalOwner,
        operationalOwner: seedModule.operationalOwner,
        catalogImportId,
        slots: slotsForModule,
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))

  const moduleByCodeVersion = new Map(
    modules.map((version) => [`${version.code}@${version.version}`, version]),
  )
  const usedModuleIds = new Set<string>()

  // --- compositions -----------------------------------------------------------------
  const compositions: GeneratedProcedureComposition[] = compositionFile.compositions
    .map((composition) => {
      if (!procedureCodes.has(composition.procedureCode)) {
        fail(`Composition names unknown procedure ${composition.procedureCode}.`)
      }
      const seenSequences = new Set<number>()
      const references: RecipeModuleReference[] = composition.moduleReferences.map((reference) => {
        const moduleVersion = moduleByCodeVersion.get(
          `${reference.moduleCode}@${reference.moduleVersion}`,
        )
        if (!moduleVersion) {
          fail(
            `Composition ${composition.procedureCode} references unknown module ${reference.moduleCode}@${reference.moduleVersion}.`,
          )
        }
        if (seenSequences.has(reference.sequence)) {
          fail(
            `Composition ${composition.procedureCode} reuses module sequence ${reference.sequence}.`,
          )
        }
        seenSequences.add(reference.sequence)
        usedModuleIds.add(moduleVersion.id)
        return {
          moduleVersionId: moduleVersion.id,
          selectionBehavior: reference.selectionBehavior,
          sequence: reference.sequence,
        }
      })
      if (references.length === 0) {
        fail(`Composition ${composition.procedureCode} references no modules.`)
      }
      const seenActionIds = new Set<string>()
      for (const action of composition.compositionActions) {
        if (!action.reason) fail(`Composition action ${action.id} has no reason.`)
        if (seenActionIds.has(action.id)) fail(`Composition action id ${action.id} is reused.`)
        seenActionIds.add(action.id)
      }
      // Where this procedure wants each requirement, taken from the reviewed template it
      // was imported from. A row absorbed into a shared requirement contributes its own
      // procedure's position, which is exactly the point: the core owns the definition,
      // the procedure owns the sequence. `min` settles the rare case of one procedure
      // contributing two rows to one requirement — the earlier need wins, matching how a
      // merge takes the earlier sequence.
      const requirementSequences: Record<string, number> = {}
      for (const row of slotsByProcedure.get(composition.procedureCode) ?? []) {
        const requirementKey = claimedBy.get(row.slot_id)?.requirementKey ?? row.slot_id
        const existing = requirementSequences[requirementKey]
        requirementSequences[requirementKey] =
          existing === undefined ? row.display_order : Math.min(existing, row.display_order)
      }

      const scenario = scenarioByProcedure.get(composition.procedureCode)
      if (!scenario) {
        fail(
          `Composition ${composition.procedureCode} has no scenario, so its recipe has no identity. Run "npm run ip-cards:scenarios" first.`,
        )
      }
      // The seed authors the version it publishes under; the scenario says what that
      // procedure's recipe version currently is. They agreeing is what keeps a saved card's
      // pin and the composition it resolves through describing the same thing.
      if (scenario.recipeVersionId !== composition.recipeVersionId) {
        fail(
          `Composition ${composition.procedureCode} publishes recipe version ${composition.recipeVersionId}, but scenario "${scenario.id}" names ${scenario.recipeVersionId}.`,
        )
      }
      const procedure = procedureByCode.get(composition.procedureCode) as ProcedureRow

      return {
        recipeVersionId: composition.recipeVersionId,
        scenarioId: scenario.id,
        procedureCode: composition.procedureCode,
        version: composition.version,
        recipeName: scenario.recipeName,
        recipeVersion: composition.recipeVersion,
        sourceTemplateVersion: procedure.template_version ?? '0.1',
        // Every composition in this prototype is draft content published under an immutable
        // release. The two axes are independent: see `ReleaseState` in domain/release-bundle.
        governanceState: 'draft' as const,
        clinicalOwner: procedure.clinical_owner,
        allowedModifierCodes: [...scenario.availableModifierCodes].sort(),
        requirementSequences: Object.fromEntries(
          Object.entries(requirementSequences).sort(([left], [right]) => left.localeCompare(right)),
        ),
        moduleReferences: references.sort(
          (left, right) =>
            left.sequence - right.sequence ||
            left.moduleVersionId.localeCompare(right.moduleVersionId),
        ),
        // The seed's `reason` is authoring rationale, not runtime data, so it is dropped
        // by naming what the runtime keeps rather than by subtracting a field.
        compositionActions: composition.compositionActions
          .map((action) => ({
            id: action.id,
            sequence: action.sequence,
            actionType: action.actionType,
            ...(action.targetRequirementKey
              ? { targetRequirementKey: action.targetRequirementKey }
              : {}),
            ...(action.targetSlotId ? { targetSlotId: action.targetSlotId } : {}),
            ...(action.targetRoleCode ? { targetRoleCode: action.targetRoleCode } : {}),
            payload: action.payload,
          }))
          .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id)),
      }
    })
    .sort((left, right) => left.recipeVersionId.localeCompare(right.recipeVersionId))

  // The generated file is addressed by recipe version, so two entries claiming one version
  // would make a pinned lookup ambiguous — the one thing a pin cannot be.
  const seenRecipeVersionIds = new Set<string>()
  for (const composition of compositions) {
    if (seenRecipeVersionIds.has(composition.recipeVersionId)) {
      fail(
        `Recipe version ${composition.recipeVersionId} is published by more than one composition. A pinned recipe version must identify exactly one composition.`,
      )
    }
    seenRecipeVersionIds.add(composition.recipeVersionId)
  }

  const composedProcedures = new Set(compositions.map((composition) => composition.procedureCode))
  for (const procedureCode of procedureCodes) {
    if (!composedProcedures.has(procedureCode)) {
      fail(
        `Procedure ${procedureCode} has no composition. Every imported procedure must stay buildable.`,
      )
    }
  }
  for (const version of modules) {
    if (usedModuleIds.has(version.id)) continue
    // "Declared but unused" and "retained because a published release pins it" are different
    // situations that used to be indistinguishable, and treating both as an error is what made
    // a superseded module version impossible to keep: the moment the last composition moved to
    // v1.1, v1.0 became unreferenced and the build rejected it — taking every card pinned to
    // it with it. A module the retention ledger lists is deliberately kept.
    if (input.retainedModuleVersionIds?.has(version.id)) continue
    fail(
      `Module ${version.code}@${version.version} is declared but referenced by no composition and retained by no published release.`,
    )
  }

  // --- migration safety: every imported row is composed exactly once ------------------
  const moduleById = new Map(modules.map((version) => [version.id, version]))
  const reportProcedures: RecipeCompositionReport['procedures'] = []

  for (const composition of compositions) {
    const original = (slotsByProcedure.get(composition.procedureCode) ?? []).map(
      (row) => row.slot_id,
    )
    const originalSet = new Set(original)
    const defaultModules = composition.moduleReferences
      .filter((reference) => reference.selectionBehavior !== 'optional')
      .map((reference) => moduleById.get(reference.moduleVersionId) as RecipeModuleVersion)

    const covered = new Set<string>()
    let coreSlots = 0
    let optionalSlots = 0
    let specificSlots = 0
    let absorbed = 0
    for (const version of defaultModules) {
      for (const slot of version.slots) {
        const ownIds = [slot.sourceSlotId, ...(slot.sourceSlotAliases ?? [])].filter(
          (value): value is string => typeof value === 'string',
        )
        const hits = ownIds.filter((slotId) => originalSet.has(slotId))
        if (hits.length === 0) continue
        if (hits.length > 1) {
          fail(
            `Requirement ${slot.requirementKey} covers ${hits.length} rows of ${composition.procedureCode}; a shared requirement may absorb at most one row per procedure.`,
          )
        }
        if (covered.has(hits[0])) {
          fail(`Imported slot ${hits[0]} is composed twice into ${composition.procedureCode}.`)
        }
        covered.add(hits[0])
        // "Removed" means this procedure's own imported row was folded into a requirement
        // another procedure's row defines. The procedure that supplies the definition lost
        // nothing, so it is not counted here.
        if (slot.sourceSlotId !== hits[0]) absorbed += 1
        if (version.kind === 'core') coreSlots += 1
        else if (version.kind === 'optional') optionalSlots += 1
        else specificSlots += 1
      }
    }

    const missing = original.filter((slotId) => !covered.has(slotId))
    if (missing.length > 0) {
      fail(
        `Composition ${composition.procedureCode} drops imported slots ${missing.join(', ')}. Default selection must reproduce the imported template exactly.`,
      )
    }

    const defaultComposedSlotCount = defaultModules.reduce(
      (total, version) => total + version.slots.length,
      0,
    )
    const gained = defaultComposedSlotCount - covered.size
    if (gained !== 0) {
      fail(
        `Composition ${composition.procedureCode} adds ${gained} requirement(s) its imported template never had. A core contributes to every procedure that references it, so it may only hold the intersection.`,
      )
    }

    reportProcedures.push({
      procedureCode: composition.procedureCode,
      originalSlotCount: original.length,
      coreModuleSlotCount: coreSlots,
      optionalModuleSlotCount: optionalSlots,
      procedureSpecificSlotCount: specificSlots,
      defaultComposedSlotCount,
      duplicateRequirementsRemoved: absorbed,
      moduleCodes: composition.moduleReferences.map(
        (reference) => (moduleById.get(reference.moduleVersionId) as RecipeModuleVersion).code,
      ),
      hasReviewedCoreMapping: coreSlots > 0,
    })

    // Every composition action must land on something, and a behavioural difference the
    // seed declared must actually be addressed.
    const targets = new Set<string>()
    for (const version of defaultModules) {
      for (const slot of version.slots) {
        targets.add(`key:${slot.requirementKey}`)
        targets.add(`slot:${slot.id}`)
        if (slot.sourceSlotId) targets.add(`slot:${slot.sourceSlotId}`)
        for (const alias of slot.sourceSlotAliases ?? []) targets.add(`slot:${alias}`)
        targets.add(`role:${slot.roleCode}`)
      }
    }
    for (const action of composition.compositionActions) {
      const matched =
        (action.targetRequirementKey && targets.has(`key:${action.targetRequirementKey}`)) ||
        (action.targetSlotId && targets.has(`slot:${action.targetSlotId}`)) ||
        (action.targetRoleCode && targets.has(`role:${action.targetRoleCode}`))
      if (!matched) {
        fail(
          `Composition action ${action.id} on ${composition.procedureCode} matches no requirement in the default composition.`,
        )
      }
    }
  }

  // A requiredness or dependency difference between absorbed rows changes what the card
  // asks of the reader. It has to be restored explicitly, or it is data loss.
  const actionsByProcedure = new Map(
    compositionFile.compositions.map((composition) => [
      composition.procedureCode,
      composition.compositionActions,
    ]),
  )
  for (const reconciliation of reconciliations) {
    if (!(behaviouralFields as readonly string[]).includes(reconciliation.field)) continue
    const actions = actionsByProcedure.get(reconciliation.aliasProcedureCode) ?? []
    const restored = actions.some(
      (action) =>
        action.actionType === 'set_requiredness' &&
        (action.targetRequirementKey === reconciliation.requirementKey ||
          action.targetSlotId === reconciliation.aliasSlotId),
    )
    if (!restored) {
      fail(
        `${reconciliation.aliasProcedureCode} loses ${reconciliation.field} on ${reconciliation.requirementKey} (imported "${reconciliation.aliasValue}", shared "${reconciliation.definitionValue}") and no set_requiredness composition action restores it.`,
      )
    }
  }

  // --- modifier targets that now resolve through an alias ----------------------------
  const aliasIndex = new Map<string, { requirementKey: string; moduleCode: string }>()
  for (const version of modules) {
    for (const slot of version.slots) {
      for (const alias of slot.sourceSlotAliases ?? []) {
        aliasIndex.set(alias, { requirementKey: slot.requirementKey, moduleCode: version.code })
      }
    }
  }
  const modifierTargetAliasMigrations = input.modifierTargets
    .flatMap((target) => {
      const hit = aliasIndex.get(target.targetSlotId)
      if (!hit) return []
      return [
        {
          modifierCode: target.modifierCode,
          actionId: target.actionId,
          targetSlotId: target.targetSlotId,
          resolvedThrough: 'alias' as const,
          requirementKey: hit.requirementKey,
          moduleCode: hit.moduleCode,
        },
      ]
    })
    .sort(
      (left, right) =>
        left.modifierCode.localeCompare(right.modifierCode) ||
        left.actionId.localeCompare(right.actionId),
    )

  const unmappedProcedures = moduleMap.modules
    .filter((seedModule) => seedModule.remainingSlotsFromProcedure && seedModule.reason)
    .flatMap((seedModule) => {
      const entry = reportProcedures.find(
        (candidate) => candidate.procedureCode === seedModule.remainingSlotsFromProcedure,
      )
      if (!entry || entry.hasReviewedCoreMapping) return []
      return [
        {
          procedureCode: seedModule.remainingSlotsFromProcedure as string,
          moduleCode: seedModule.code,
          reason: seedModule.reason as string,
        },
      ]
    })
    .sort((left, right) => left.procedureCode.localeCompare(right.procedureCode))

  return {
    modules,
    compositions,
    report: {
      generatedFrom: {
        procedures: procedures.length,
        procedureSlots: slots.length,
        modules: modules.length,
        duplicateRequirementsRemoved: reportProcedures.reduce(
          (total, entry) => total + entry.duplicateRequirementsRemoved,
          0,
        ),
      },
      procedures: reportProcedures.sort((left, right) =>
        left.procedureCode.localeCompare(right.procedureCode),
      ),
      sharedRequirements: sharedRequirements.sort((left, right) =>
        left.requirementKey.localeCompare(right.requirementKey),
      ),
      reconciliations: reconciliations.sort(
        (left, right) =>
          left.requirementKey.localeCompare(right.requirementKey) ||
          left.aliasSlotId.localeCompare(right.aliasSlotId) ||
          left.field.localeCompare(right.field),
      ),
      unmappedProcedures,
      modifierTargetAliasMigrations,
    },
  }
}

export function collectModifierTargets() {
  const targets: { modifierCode: string; actionId: string; targetSlotId: string }[] = []
  for (const modifier of operationalModifiers) {
    for (const action of modifier.actions) {
      if (action.targetSlotId) {
        targets.push({
          modifierCode: modifier.code,
          actionId: action.id,
          targetSlotId: action.targetSlotId,
        })
      }
    }
  }
  for (const rescue of rescueModules) {
    for (const slot of rescue.slots) {
      targets.push({
        modifierCode: rescue.code,
        actionId: `rescue-slot-${slot.id}`,
        targetSlotId: slot.id,
      })
    }
  }
  return targets
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

async function main() {
  const generatedDirectory = process.argv[2] ?? GENERATED_DIRECTORY
  const seedDirectory = process.argv[3] ?? SEED_DIRECTORY

  const ledger = await readJson<{ entries: { moduleVersionId: string }[] }>(
    generatedDirectory,
    'module-ledger.json',
  ).catch(() => ({ entries: [] as { moduleVersionId: string }[] }))

  const [procedures, scenarios, slots, sectionMap, importReport, moduleMap, compositionFile] =
    await Promise.all([
      readJson<ProcedureRow[]>(generatedDirectory, 'procedures.json'),
      readJson<ScenarioIdentityRow[]>(generatedDirectory, 'scenarios.json'),
      readJson<ProcedureSlotRow[]>(generatedDirectory, 'procedure-slots.json'),
      readJson<Record<string, SectionMapping>>(seedDirectory, 'section-zone-phase-map.json'),
      readJson<{ workbook_sha256: string }>(generatedDirectory, 'import-report.json'),
      readJson<SeedModuleMap>(seedDirectory, 'recipe-module-map.json'),
      readJson<SeedCompositionFile>(seedDirectory, 'procedure-compositions.json'),
    ])

  const result = buildRecipeCompositions({
    procedures,
    scenarios,
    // A module version a published release pins stays declarable after the last composition
    // stops referencing it. Without this the build would reject the very versions the
    // retention ledger exists to keep.
    retainedModuleVersionIds: new Set(ledger.entries.map((entry) => entry.moduleVersionId)),
    slots,
    sectionMap,
    catalogImportId: importReport.workbook_sha256,
    moduleMap,
    compositionFile,
    modifierTargets: collectModifierTargets(),
  })

  await writeJsonWhenChanged(generatedDirectory, 'recipe-modules.json', result.modules)
  await writeJsonWhenChanged(generatedDirectory, 'procedure-compositions.json', result.compositions)
  await writeJsonWhenChanged(generatedDirectory, 'recipe-composition-report.json', result.report)

  const { report } = result
  console.log(
    `Wrote ${result.modules.length} recipe module versions and ${result.compositions.length} procedure compositions.`,
  )
  console.log('')
  console.log(
    'procedure            original  core  optional  specific  composed  absorbed  modules',
  )
  for (const entry of report.procedures) {
    console.log(
      `  ${entry.procedureCode.padEnd(20)} ${String(entry.originalSlotCount).padStart(6)} ${String(
        entry.coreModuleSlotCount,
      ).padStart(5)} ${String(entry.optionalModuleSlotCount).padStart(9)} ${String(
        entry.procedureSpecificSlotCount,
      ).padStart(9)} ${String(entry.defaultComposedSlotCount).padStart(9)} ${String(
        entry.duplicateRequirementsRemoved,
      ).padStart(9)}  ${entry.moduleCodes.join(', ')}`,
    )
  }
  console.log('')
  console.log(`Shared requirements: ${report.sharedRequirements.length}`)
  for (const shared of report.sharedRequirements) {
    console.log(
      `  ${shared.requirementKey.padEnd(36)} ${shared.procedureCodes.join(', ')} (absorbed ${shared.absorbedSlotIds.length})`,
    )
  }
  console.log('')
  console.log(`Wording and requiredness reconciliations: ${report.reconciliations.length}`)
  for (const reconciliation of report.reconciliations) {
    console.log(
      `  ${reconciliation.requirementKey} · ${reconciliation.field} · ${reconciliation.aliasProcedureCode}: "${reconciliation.aliasValue}" -> "${reconciliation.definitionValue}"`,
    )
  }
  console.log('')
  console.log(`Procedures left for clinical review: ${report.unmappedProcedures.length}`)
  for (const unmapped of report.unmappedProcedures) {
    console.log(`  ${unmapped.procedureCode.padEnd(22)} ${unmapped.reason}`)
  }
  console.log('')
  console.log(
    `Modifier targets now resolved through a provenance alias: ${report.modifierTargetAliasMigrations.length}`,
  )
  for (const migration of report.modifierTargetAliasMigrations) {
    console.log(
      `  ${migration.modifierCode} ${migration.actionId} -> ${migration.requirementKey} (${migration.moduleCode})`,
    )
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
