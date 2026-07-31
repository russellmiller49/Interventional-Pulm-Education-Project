import type { ProceduralPhase, RecipeSlot, SetupZone } from './types'

/**
 * The imported `procedure-slots.json` row shape and the one place it becomes a `RecipeSlot`.
 *
 * Both the runtime loader and the composition build script go through this function, so a
 * module's stored slot and a directly-loaded slot can never drift in how a section maps to
 * a setup zone or how the needs-review note is worded.
 */
export interface ProcedureSlotRow {
  slot_id: string
  procedure_code: string
  section: string
  display_order: number
  role_code: string
  slot_label: string
  generic_requirement: string
  requiredness: 'required' | 'conditional' | 'optional'
  default_qty: number
  selection_mode: 'single' | 'multiple'
  allow_custom: boolean
  dependency_rule: string | null
  notes: string | null
}

export interface SectionMapping {
  setup_zone: SetupZone
  procedural_phase: ProceduralPhase
  needs_review: boolean
}

export interface ProcedureSlotToRecipeSlotInput {
  row: ProcedureSlotRow
  sectionMap: Record<string, SectionMapping>
  /** Reviewed stable identity. Never derived from the label or the role code. */
  requirementKey: string
  /** Imported slot ids this requirement absorbed when it moved into a shared module. */
  sourceSlotAliases?: string[]
  setupSequence: number
  includedBy: string
}

export function procedureSlotToRecipeSlot({
  row,
  sectionMap,
  requirementKey,
  sourceSlotAliases,
  setupSequence,
  includedBy,
}: ProcedureSlotToRecipeSlotInput): RecipeSlot {
  const mapping = sectionMap[row.section]
  const needsReview = !mapping || mapping.needs_review
  return {
    id: row.slot_id,
    sourceSlotId: row.slot_id,
    requirementKey,
    ...(sourceSlotAliases && sourceSlotAliases.length > 0
      ? { sourceSlotAliases: [...sourceSlotAliases].sort() }
      : {}),
    roleCode: row.role_code,
    label: row.slot_label,
    genericRequirement: row.generic_requirement,
    requiredness: row.requiredness,
    dependencyRule: row.dependency_rule,
    quantityExpression: { op: 'literal', value: row.default_qty },
    selectionMode: row.selection_mode,
    setupZone: needsReview ? 'unassigned' : mapping.setup_zone,
    proceduralPhase: needsReview ? 'unassigned' : mapping.procedural_phase,
    setupSequence,
    openHoldStatus: 'have_in_room',
    responsibleRole: null,
    sterileStatus: null,
    allowCustom: row.allow_custom,
    notes:
      [
        row.notes,
        needsReview ? `Source section "${row.section}" needs setup-zone and phase review.` : null,
      ]
        .filter(Boolean)
        .join(' ') || null,
    includedBy,
  }
}
