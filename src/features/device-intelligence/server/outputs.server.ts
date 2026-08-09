import 'server-only'

import {
  buildDemoContext,
  resolveDemoScenario,
} from '@/features/preference-cards/data/demo-context.server'
import { expandEffectiveSlots } from '@/features/preference-cards/domain/effective-slots'
import { defaultSelectedModuleVersionIds } from '@/features/preference-cards/domain/expand-recipe-composition'
import { getCatalogStore } from '@/features/preference-cards/server/catalog'
import type { ResolvedCardItem } from '@/features/preference-cards/domain/types'

import { isExemplarProcedureCode } from '@/features/device-intelligence/domain/exemplars'
import type { ReadinessProjection } from '@/features/device-intelligence/domain/readiness'
import {
  buildReadinessProjection,
  getCoverageLadderForProcedure,
  type RealFormularySummary,
} from './procedures.server'

/**
 * The read-only output previews (vertical-slice-spec §5, outputs 2–5).
 *
 * All four projections are computed from ONE resolution of the scenario through the existing
 * resolver — the same `BuildContext`, the same `expandEffectiveSlots` path the preference-card
 * engine uses. Nothing here re-resolves, re-ranks, or persists; output 1 (the preference card
 * itself) stays in the existing builder, which the workspace links to.
 */

export interface OutputLine {
  itemId: string
  label: string
  roleCode: string
  quantityDisplay: string
  openHoldStatus: string
  sterileStatus: string | null
  responsibleRole: string | null
  setupZone: string
  proceduralPhase: string
  effectiveRequiredness: string
  resolutionState: string
  verificationState: string
  selectedDescription: string | null
  /** Authored clinician texts, quoted verbatim for the training view. */
  genericRequirement: string
  dependencyRule: string | null
  selectionGuidance: string | null
  requiresCurrentIfu: boolean
  notes: string | null
}

export interface GroupedOutput<Key extends string = string> {
  key: Key
  lines: OutputLine[]
}

export interface ProcedureOutputPreviews {
  procedureCode: string
  scenarioId: string
  modifierCodes: string[]
  generatedFrom: {
    recipeVersionId: string
    recipeName: string
    engineVersion: string
    readinessState: string
  }
  /** Output 2 — resolved requirements by setup zone, in setup sequence. */
  roomSetup: GroupedOutput[]
  /** Output 3 — resolved requirements by responsible role, then procedural phase. */
  nursing: { responsibleRole: string; phases: GroupedOutput[] }[]
  /** Output 5 — requirements in procedural-phase order quoting authored texts only. */
  training: GroupedOutput[]
  /** Output 4 — structural demo/readiness gap preview (not a procurement report). */
  gaps: {
    projection: ReadinessProjection
    proposalsOnlyRoles: string[]
    unmappedRoles: string[]
    nonSelectableOnlyRoles: string[]
    demoStandInRoles: string[]
    dimensionGapCount: number
    formularySummary: RealFormularySummary
  }
  suppressedItems: { itemId: string; label: string; roleCode: string; rationale: string | null }[]
}

const DIMENSION_FIELDS = [
  'diameter_mm',
  'french_size',
  'gauge',
  'length_mm',
  'working_length_cm',
  'min_working_channel_mm',
  'delivery_system_od_mm',
  'size_display',
] as const

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '')
}

export function getProcedureOutputPreviews(
  procedureCode: string,
  scenarioId: string,
  formularySummary: RealFormularySummary,
): ProcedureOutputPreviews | null {
  if (!isExemplarProcedureCode(procedureCode)) return null
  const store = getCatalogStore()
  const resolved = resolveDemoScenario(scenarioId)
  const context = buildDemoContext(scenarioId)

  // The same expansion the resolver ran, re-derived to recover the slot fields the resolved
  // item does not carry (sterile status, responsible role). Same engine, same inputs — the
  // expansion is deterministic, so the join is exact by requirement id.
  const effective = expandEffectiveSlots(
    {
      selectedModuleVersionIds: defaultSelectedModuleVersionIds(context.recipe),
      modifierCodes: resolved.selectedModifiers,
    },
    context,
  )
  const slotById = new Map(effective.slots.map((slot) => [slot.id, slot]))

  const toLine = (item: ResolvedCardItem): OutputLine => {
    const slot = slotById.get(item.id)
    const role = store.roleByCode.get(item.roleCode)
    return {
      itemId: item.id,
      label: item.label,
      roleCode: item.roleCode,
      quantityDisplay: item.quantityDisplay,
      openHoldStatus: item.openHoldStatus,
      sterileStatus: slot?.sterileStatus ?? null,
      responsibleRole: slot?.responsibleRole ?? null,
      setupZone: item.setupZone,
      proceduralPhase: item.proceduralPhase,
      effectiveRequiredness: item.effectiveRequiredness,
      resolutionState: item.resolutionState,
      verificationState: item.verificationState,
      selectedDescription: item.selectedItemSnapshot?.localDescription ?? null,
      genericRequirement: item.genericRequirement,
      dependencyRule: item.dependencyRule,
      selectionGuidance: role?.selection_guidance ?? null,
      requiresCurrentIfu: role?.requires_current_ifu === true,
      notes: item.notes,
    }
  }

  const orderedItems = [...resolved.items].sort(
    (left, right) => left.setupSequence - right.setupSequence || left.id.localeCompare(right.id),
  )
  const lines = orderedItems.map(toLine)

  const groupBy = (values: OutputLine[], key: (line: OutputLine) => string): GroupedOutput[] => {
    const groups = new Map<string, OutputLine[]>()
    for (const line of values) {
      const groupKey = key(line)
      const existing = groups.get(groupKey)
      if (existing) existing.push(line)
      else groups.set(groupKey, [line])
    }
    return [...groups.entries()].map(([groupKey, groupLines]) => ({
      key: groupKey,
      lines: groupLines,
    }))
  }

  const nursingGroups = groupBy(lines, (line) => line.responsibleRole ?? 'unassigned').map(
    (group) => ({
      responsibleRole: group.key,
      phases: groupBy(group.lines, (line) => line.proceduralPhase),
    }),
  )

  const ladder = getCoverageLadderForProcedure(procedureCode)
  const projection = buildReadinessProjection(procedureCode, resolved, ladder)

  // Dimension gaps over the authored-option products of this procedure, matching the audit's
  // DIMENSION_FIELDS definition exactly.
  const procedureSlotIds = new Set(
    store.procedureSlots
      .filter((slot) => slot.procedure_code === procedureCode)
      .map((slot) => slot.slot_id),
  )
  const optionProductIds = new Set<string>()
  for (const [productId, options] of store.slotOptionsByProduct) {
    if (options.some((option) => procedureSlotIds.has(option.slot_id))) {
      optionProductIds.add(productId)
    }
  }
  let dimensionGapCount = 0
  for (const productId of optionProductIds) {
    const product = store.productById.get(productId)
    if (product && DIMENSION_FIELDS.every((field) => isBlank(product[field]))) {
      dimensionGapCount += 1
    }
  }

  return {
    procedureCode,
    scenarioId,
    modifierCodes: [...resolved.selectedModifiers],
    generatedFrom: {
      recipeVersionId: resolved.recipeVersionId,
      recipeName: resolved.recipeName,
      engineVersion: resolved.engineVersion,
      readinessState: resolved.readinessState,
    },
    roomSetup: groupBy(lines, (line) => line.setupZone),
    nursing: nursingGroups,
    training: groupBy(lines, (line) => line.proceduralPhase),
    gaps: {
      projection,
      proposalsOnlyRoles: ladder.roles
        .filter((role) => role.coverage === 'proposals_only')
        .map((role) => role.roleCode),
      unmappedRoles: ladder.roles
        .filter(
          (role) =>
            role.coverage === 'no_option_no_proposal_role_mapped' ||
            role.coverage === 'no_option_no_proposal_unmapped',
        )
        .map((role) => role.roleCode),
      nonSelectableOnlyRoles: ladder.roles
        .filter((role) => role.coverage === 'non_selectable_authored_only')
        .map((role) => role.roleCode),
      demoStandInRoles: ladder.roles
        .filter((role) => role.demoStandIn)
        .map((role) => role.roleCode),
      dimensionGapCount,
      formularySummary,
    },
    suppressedItems: resolved.suppressedItems.map((item) => ({
      itemId: item.id,
      label: item.label,
      roleCode: item.roleCode,
      rationale: item.rationale,
    })),
  }
}
