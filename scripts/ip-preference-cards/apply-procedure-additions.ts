import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { normalizeSlotOptionVisibility, stableId, type CatalogRecord } from './catalog-utils'

/**
 * Adds reviewed procedures, procedure slots, and exact slot options that the protected
 * workbook does not carry.
 *
 * `seed/catalog-additions.json` can extend products, roles-links, manufacturers, and sources,
 * and the reviewed overlays can retarget an existing slot's role — but nothing could create a
 * procedure or a slot. Editing the xlsx is the wrong answer: it moves the protected workbook
 * hash, invalidates the `sourceWorkbookSha256` binding inside the completed-review artifact,
 * and buries the rationale inside a binary. This is the governed, greppable path instead.
 *
 * Every rule below is a hard import error rather than a silent skip, in the same spirit as
 * the reviewed remediation overlay: a stale or drifted addition must fail the import, never
 * degrade quietly into an unreachable slot.
 *
 * Roles the new slots need are authored here too. The reviewed-remediation overlay also has a
 * `rolesToAdd`, but it runs *after* this applicator so that review corrections can still
 * retarget slots added here; a slot could therefore never reference a role that overlay
 * introduces. Keeping the role beside the slot that needs it also keeps one reviewable unit.
 */

const SEED_FILE = 'data/ip-preference-cards/reviewed/procedure-additions.json'
const SECTION_MAP_FILE = 'data/ip-preference-cards/seed/section-zone-phase-map.json'
const SCENARIO_OVERRIDES_FILE = 'data/ip-preference-cards/seed/scenario-overrides.json'

const SLOT_ID_PATTERN = /^SLOT-[0-9A-F]{10}$/
const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

const REQUIREDNESS_VALUES = ['required', 'conditional', 'optional'] as const
const SELECTION_MODE_VALUES = ['single', 'multiple'] as const

/** The workbook's own vocabulary, so an added row reads the same as an imported one. */
const REQUIREDNESS_RAW: Record<(typeof REQUIREDNESS_VALUES)[number], string> = {
  required: 'Required',
  conditional: 'Conditional',
  optional: 'Optional',
}
const SELECTION_MODE_RAW: Record<(typeof SELECTION_MODE_VALUES)[number], string> = {
  single: 'Single select',
  multiple: 'Multiple',
}

export type SlotRequiredness = (typeof REQUIREDNESS_VALUES)[number]
export type SlotSelectionMode = (typeof SELECTION_MODE_VALUES)[number]

export interface ProcedureAdditionRole {
  role_code: string
  category: string
  role_name: string
  description: string
  selection_guidance: string
  requires_current_ifu: boolean
  reason: string
}

export interface ProcedureAdditionProcedure {
  procedure_code: string
  procedure_name: string
  template_version: string
  scope: string
  status: string
  clinical_owner: string | null
  notes: string | null
  reason: string
}

export interface ProcedureAdditionSlot {
  /** Must equal `stableId('SLOT', natural_key)`, so a rerun is idempotent by construction. */
  slot_id: string
  natural_key: string
  procedure_code: string
  section: string
  display_order: number
  role_code: string
  slot_label: string
  generic_requirement: string | null
  requiredness: SlotRequiredness
  default_qty: number
  selection_mode: SlotSelectionMode
  allow_custom: boolean
  dependency_rule: string | null
  notes: string | null
  reason: string
}

export interface ProcedureAdditionSlotOption {
  slot_id: string
  product_id: string
  role_code: string
  eligibility_status: string
  selectable: boolean
  visible_by_default: boolean
  reason: string
}

export interface ProcedureAdditionsFile {
  formatVersion: 1
  notes: string
  rolesToAdd: ProcedureAdditionRole[]
  proceduresToAdd: ProcedureAdditionProcedure[]
  slotsToAdd: ProcedureAdditionSlot[]
  slotOptionsToAdd: ProcedureAdditionSlotOption[]
}

/**
 * The seed files an added row is validated against. Passed in rather than read inside the
 * applicator so the whole validation surface stays pure and fixture-testable.
 */
export interface ProcedureAdditionsContext {
  /** Keys of `seed/section-zone-phase-map.json`. An unmapped section degrades to `unassigned`. */
  knownSections: ReadonlySet<string>
  /** Procedure codes named by `seed/scenario-overrides.json → procedureGroups`. */
  groupedProcedureCodes: ReadonlySet<string>
  /**
   * The closed role-category vocabulary. Optional so this applicator can ship before the
   * taxonomy module exists; once supplied, an unknown category is a hard error.
   */
  knownRoleCategories?: ReadonlySet<string>
}

export interface ProcedureAdditionsReport {
  applied: boolean
  roles_added: number
  procedures_added: number
  slots_added: number
  slot_options_added: number
  /** Authored visibility that a hidden product forced back down, mirroring the workbook path. */
  visibility_conflicts: {
    slot_id: string
    product_id: string
    authored_visible_by_default: boolean
    authored_selectable: boolean
    product_visibility: 'prototype_visible' | 'hidden'
  }[]
  details: {
    added_roles: string[]
    added_procedures: string[]
    added_slots: string[]
    added_slot_options: string[]
  }
  errors: string[]
}

function emptyReport(): ProcedureAdditionsReport {
  return {
    applied: false,
    roles_added: 0,
    procedures_added: 0,
    slots_added: 0,
    slot_options_added: 0,
    visibility_conflicts: [],
    details: { added_roles: [], added_procedures: [], added_slots: [], added_slot_options: [] },
    errors: [],
  }
}

export async function readProcedureAdditions(
  filePath = SEED_FILE,
): Promise<ProcedureAdditionsFile | null> {
  try {
    return JSON.parse(
      await readFile(path.resolve(process.cwd(), filePath), 'utf8'),
    ) as ProcedureAdditionsFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** Loads the two seed files an addition is validated against. */
export async function readProcedureAdditionsContext(options?: {
  sectionMapFile?: string
  scenarioOverridesFile?: string
  knownRoleCategories?: ReadonlySet<string>
}): Promise<ProcedureAdditionsContext> {
  const [sectionMapText, overridesText] = await Promise.all([
    readFile(path.resolve(process.cwd(), options?.sectionMapFile ?? SECTION_MAP_FILE), 'utf8'),
    readFile(
      path.resolve(process.cwd(), options?.scenarioOverridesFile ?? SCENARIO_OVERRIDES_FILE),
      'utf8',
    ),
  ])
  const sectionMap = JSON.parse(sectionMapText) as Record<string, unknown>
  const overrides = JSON.parse(overridesText) as { procedureGroups?: Record<string, string[]> }

  return {
    knownSections: new Set(Object.keys(sectionMap)),
    groupedProcedureCodes: new Set(Object.values(overrides.procedureGroups ?? {}).flat()),
    knownRoleCategories: options?.knownRoleCategories,
  }
}

function idsOf(records: CatalogRecord[], column: string): Set<string> {
  const ids = new Set<string>()
  for (const record of records) {
    const value = record[column]
    if (typeof value === 'string' && value.length > 0) ids.add(value)
  }
  return ids
}

function requireReason(label: string, reason: unknown, errors: string[]): reason is string {
  if (typeof reason === 'string' && reason.trim().length > 0) return true
  errors.push(`${label} is missing a reason; every authored addition must record why it exists.`)
  return false
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

/**
 * Registers the roles the additions declare, before any product or slot can claim one.
 *
 * Vocabulary has to exist before content references it: `seed/catalog-additions.json` maps
 * products onto roles and is merged earlier in the pipeline, so a role introduced alongside
 * the slot that needs it would not yet exist when the product merge validates against it.
 * Splitting this out is what lets one reviewed file own both halves.
 */
export function applyProcedureAdditionRoles(
  normalized: Record<string, CatalogRecord[]>,
  additions: ProcedureAdditionsFile | null,
  knownRoleCategories?: ReadonlySet<string>,
): ProcedureAdditionsReport {
  const report = emptyReport()
  if (!additions) return report
  const errors = report.errors

  if (additions.formatVersion !== 1) {
    errors.push(
      `Procedure additions declare unsupported formatVersion ${String(additions.formatVersion)}; expected 1.`,
    )
    return report
  }

  const roles = additions.rolesToAdd ?? []
  const existingRoleCodes = idsOf(normalized.Roles ?? [], 'role_code')
  const addedRoleCodes = new Set<string>()

  for (const role of roles) {
    const label = `Added role ${role.role_code || '(unnamed)'}`
    requireReason(label, role.reason, errors)
    if (!CODE_PATTERN.test(role.role_code ?? '')) {
      errors.push(`${label} is not an UPPER_SNAKE_CASE role code.`)
      continue
    }
    if (existingRoleCodes.has(role.role_code)) {
      errors.push(`${label} collides with an existing role.`)
      continue
    }
    if (addedRoleCodes.has(role.role_code)) {
      errors.push(`${label} is declared twice in the additions file.`)
      continue
    }
    if (knownRoleCategories && !knownRoleCategories.has(role.category)) {
      errors.push(
        `${label} uses category "${role.category}", which is outside the closed role-category vocabulary.`,
      )
    }
    if (!role.role_name || !role.description || !role.selection_guidance) {
      errors.push(`${label} must carry a role_name, description, and selection_guidance.`)
    }
    addedRoleCodes.add(role.role_code)
  }

  if (errors.length > 0) return report

  for (const role of roles) {
    normalized.Roles.push({
      role_code: role.role_code,
      category: role.category,
      role_name: role.role_name,
      description: role.description,
      selection_guidance: role.selection_guidance,
      requires_current_ifu: role.requires_current_ifu,
    })
    report.details.added_roles.push(role.role_code)
  }
  report.roles_added = roles.length
  report.applied = true
  return report
}

/**
 * Appends the additions to the normalized sheet data in place and returns a report.
 * Nothing is mutated unless every rule passes, so a rejected file leaves the import
 * byte-identical to a run without it.
 */
export function applyProcedureAdditions(
  normalized: Record<string, CatalogRecord[]>,
  additions: ProcedureAdditionsFile | null,
  context: ProcedureAdditionsContext,
): ProcedureAdditionsReport {
  const report = emptyReport()
  if (!additions) return report

  const errors = report.errors

  if (additions.formatVersion !== 1) {
    errors.push(
      `Procedure additions declare unsupported formatVersion ${String(additions.formatVersion)}; expected 1.`,
    )
    return report
  }

  const procedures = additions.proceduresToAdd ?? []
  const slots = additions.slotsToAdd ?? []
  const slotOptions = additions.slotOptionsToAdd ?? []

  const existingRoleCodes = idsOf(normalized.Roles ?? [], 'role_code')
  const existingProcedureCodes = idsOf(normalized.Procedures ?? [], 'procedure_code')
  const existingSlotIds = idsOf(normalized.Procedure_Slots ?? [], 'slot_id')
  const existingProductIds = idsOf(normalized.Products ?? [], 'product_id')

  // ---- procedures -----------------------------------------------------------------------
  const addedProcedureCodes = new Set<string>()
  for (const procedure of procedures) {
    const label = `Added procedure ${procedure.procedure_code || '(unnamed)'}`
    requireReason(label, procedure.reason, errors)
    if (!CODE_PATTERN.test(procedure.procedure_code ?? '')) {
      errors.push(`${label} is not an UPPER_SNAKE_CASE procedure code.`)
      continue
    }
    if (existingProcedureCodes.has(procedure.procedure_code)) {
      errors.push(`${label} collides with an existing procedure.`)
      continue
    }
    if (addedProcedureCodes.has(procedure.procedure_code)) {
      errors.push(`${label} is declared twice in the additions file.`)
      continue
    }
    if (!procedure.procedure_name) {
      errors.push(`${label} must carry a procedure_name.`)
    }
    // A procedure absent from every group silently receives only the "All" modifiers and can
    // never be targeted by a group-scoped one. That is a content mistake, not a design choice.
    if (!context.groupedProcedureCodes.has(procedure.procedure_code)) {
      errors.push(
        `${label} is not listed in any seed/scenario-overrides.json procedureGroups entry, so no group-scoped modifier could ever reach it.`,
      )
    }
    addedProcedureCodes.add(procedure.procedure_code)
  }

  const procedureCodesAfterMerge = new Set([...existingProcedureCodes, ...addedProcedureCodes])
  // Roles were registered by applyProcedureAdditionRoles before the product merge, so the
  // sheet already carries them; a slot that names an unregistered role fails below.
  const roleCodesAfterMerge = existingRoleCodes

  // ---- slots ----------------------------------------------------------------------------
  const addedSlotsById = new Map<string, ProcedureAdditionSlot>()
  const seenDisplayOrders = new Set<string>()
  for (const slot of slots) {
    const label = `Added slot ${slot.slot_id || '(unnamed)'}`
    requireReason(label, slot.reason, errors)

    if (!slot.natural_key) {
      errors.push(`${label} must declare a natural_key its slot_id is derived from.`)
      continue
    }
    if (!SLOT_ID_PATTERN.test(slot.slot_id ?? '')) {
      errors.push(`${label} does not match the SLOT-XXXXXXXXXX identifier shape.`)
      continue
    }
    const derived = stableId('SLOT', slot.natural_key)
    if (slot.slot_id !== derived) {
      errors.push(
        `${label} is not the deterministic id for its natural key "${slot.natural_key}"; expected ${derived}.`,
      )
      continue
    }
    if (existingSlotIds.has(slot.slot_id)) {
      errors.push(`${label} collides with an existing procedure slot.`)
      continue
    }
    if (addedSlotsById.has(slot.slot_id)) {
      errors.push(`${label} is declared twice in the additions file.`)
      continue
    }
    if (!procedureCodesAfterMerge.has(slot.procedure_code)) {
      errors.push(`${label} references unknown procedure ${String(slot.procedure_code)}.`)
    }
    if (!roleCodesAfterMerge.has(slot.role_code)) {
      errors.push(`${label} references unknown role ${String(slot.role_code)}.`)
    }
    // An unmapped section is not a crash; it quietly degrades the slot to an unassigned setup
    // zone and phase in the demo context, which reads as a data gap nobody authored.
    if (!context.knownSections.has(slot.section)) {
      errors.push(
        `${label} uses section "${String(slot.section)}", which has no entry in seed/section-zone-phase-map.json.`,
      )
    }
    if (!REQUIREDNESS_VALUES.includes(slot.requiredness)) {
      errors.push(`${label} has requiredness "${String(slot.requiredness)}".`)
    }
    if (!SELECTION_MODE_VALUES.includes(slot.selection_mode)) {
      errors.push(`${label} has selection_mode "${String(slot.selection_mode)}".`)
    }
    if (!Number.isInteger(slot.display_order) || slot.display_order < 0) {
      errors.push(`${label} must carry a non-negative integer display_order.`)
    }
    if (!isPositiveInteger(slot.default_qty)) {
      errors.push(`${label} must carry a positive integer default_qty.`)
    }
    if (typeof slot.allow_custom !== 'boolean') {
      errors.push(`${label} must declare allow_custom as a boolean.`)
    }
    if (!slot.slot_label) {
      errors.push(`${label} must carry a slot_label.`)
    }
    const orderKey = `${slot.procedure_code} ${String(slot.display_order)}`
    if (seenDisplayOrders.has(orderKey)) {
      errors.push(
        `${label} reuses display_order ${String(slot.display_order)} within ${slot.procedure_code}; ordering would be arbitrary.`,
      )
    }
    seenDisplayOrders.add(orderKey)

    addedSlotsById.set(slot.slot_id, slot)
  }

  // ---- slot options ---------------------------------------------------------------------
  const existingSlotRoles = new Map<string, string>()
  for (const record of normalized.Procedure_Slots ?? []) {
    const slotId = record.slot_id
    const roleCode = record.role_code
    if (typeof slotId === 'string' && typeof roleCode === 'string') {
      existingSlotRoles.set(slotId, roleCode)
    }
  }
  for (const [slotId, slot] of addedSlotsById) existingSlotRoles.set(slotId, slot.role_code)

  const productRoleKeys = new Set<string>()
  for (const record of normalized.Product_Roles ?? []) {
    if (typeof record.product_id === 'string' && typeof record.role_code === 'string') {
      productRoleKeys.add(`${record.product_id} ${record.role_code}`)
    }
  }
  const productVisibility = new Map<string, unknown>()
  for (const record of normalized.Products ?? []) {
    if (typeof record.product_id === 'string') {
      productVisibility.set(record.product_id, record.visibility_state)
    }
  }
  const existingOptionPairs = new Set<string>()
  for (const record of normalized.Slot_Product_Options ?? []) {
    if (typeof record.slot_id === 'string' && typeof record.product_id === 'string') {
      existingOptionPairs.add(`${record.slot_id} ${record.product_id}`)
    }
  }

  const normalizedOptions: CatalogRecord[] = []
  const seenOptionPairs = new Set<string>()
  for (const option of slotOptions) {
    const label = `Added slot option ${String(option.slot_id)} × ${String(option.product_id)}`
    requireReason(label, option.reason, errors)

    const slotRole = existingSlotRoles.get(option.slot_id)
    if (!slotRole) {
      errors.push(`${label} references unknown slot ${String(option.slot_id)}.`)
      continue
    }
    if (!existingProductIds.has(option.product_id)) {
      errors.push(`${label} references unknown product ${String(option.product_id)}.`)
      continue
    }
    // The exact rule catalog-role-and-slot-semantics.md enforces for authored options: the
    // option's role is the slot's role, and the product must genuinely carry it.
    if (option.role_code !== slotRole) {
      errors.push(
        `${label} declares role ${String(option.role_code)} but its slot requests ${slotRole}.`,
      )
      continue
    }
    if (!productRoleKeys.has(`${option.product_id} ${option.role_code}`)) {
      errors.push(
        `${label} attaches a product that does not carry ${option.role_code} in Product_Roles.`,
      )
      continue
    }
    const pairKey = `${option.slot_id} ${option.product_id}`
    if (existingOptionPairs.has(pairKey)) {
      errors.push(`${label} collides with an existing slot option.`)
      continue
    }
    if (seenOptionPairs.has(pairKey)) {
      errors.push(`${label} is declared twice in the additions file.`)
      continue
    }
    if (!option.eligibility_status) {
      errors.push(`${label} must carry an eligibility_status.`)
    }
    seenOptionPairs.add(pairKey)

    const visibility = normalizeSlotOptionVisibility(
      productVisibility.get(option.product_id),
      option.visible_by_default === true,
      option.selectable === true,
    )
    if (visibility.authoredVisibilityConflict) {
      report.visibility_conflicts.push({
        slot_id: option.slot_id,
        product_id: option.product_id,
        authored_visible_by_default: option.visible_by_default === true,
        authored_selectable: option.selectable === true,
        product_visibility: visibility.productVisibility,
      })
    }
    normalizedOptions.push({
      slot_id: option.slot_id,
      product_id: option.product_id,
      role_code: option.role_code,
      eligibility_status: option.eligibility_status,
      visible_by_default: visibility.visibleByDefault,
      reason: option.reason,
      product_visibility: visibility.productVisibility,
      selectable: visibility.selectable,
    })
  }

  if (errors.length > 0) return report

  for (const procedure of procedures) {
    normalized.Procedures.push({
      procedure_code: procedure.procedure_code,
      procedure_name: procedure.procedure_name,
      template_version: procedure.template_version,
      scope: procedure.scope,
      status: procedure.status,
      clinical_owner: procedure.clinical_owner,
      notes: procedure.notes,
    })
    report.details.added_procedures.push(procedure.procedure_code)
  }
  for (const slot of addedSlotsById.values()) {
    normalized.Procedure_Slots.push({
      slot_id: slot.slot_id,
      procedure_code: slot.procedure_code,
      section: slot.section,
      display_order: slot.display_order,
      role_code: slot.role_code,
      slot_label: slot.slot_label,
      generic_requirement: slot.generic_requirement,
      requiredness: slot.requiredness,
      default_qty: slot.default_qty,
      selection_mode: slot.selection_mode,
      allow_custom: slot.allow_custom,
      dependency_rule: slot.dependency_rule,
      notes: slot.notes,
      selection_mode_raw: SELECTION_MODE_RAW[slot.selection_mode],
      requiredness_raw: REQUIREDNESS_RAW[slot.requiredness],
    })
    report.details.added_slots.push(slot.slot_id)
  }
  for (const option of normalizedOptions) {
    normalized.Slot_Product_Options.push(option)
    report.details.added_slot_options.push(
      `${String(option.slot_id)} × ${String(option.product_id)}`,
    )
  }

  report.procedures_added = procedures.length
  report.slots_added = addedSlotsById.size
  report.slot_options_added = normalizedOptions.length
  report.applied = true
  return report
}
