import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CatalogRecord } from './catalog-utils'

/**
 * Removes reviewed procedure-slot rows that the protected workbook carries in the wrong
 * template.
 *
 * `reviewed/procedure-additions.json` can add procedures, slots, and options, and the
 * reviewed overlays can retarget an existing slot's role — but nothing could take a slot row
 * *out* of a procedure template. The first owner data review needed exactly that:
 * physician-owner finding F-06 (2026-08-09) moved the four indwelling-pleural-catheter
 * requirements out of CHEST_TUBE, whose template had carried equipment belonging to the
 * separate IPC_PLACEMENT procedure. Editing the xlsx is the wrong answer for the same reasons
 * recorded in `apply-procedure-additions.ts`; this is the governed, greppable path instead.
 *
 * A removal is deliberately narrow and heavily guarded:
 *
 * - Every removal names the slot id *and* restates the row's procedure, role, and section.
 *   A drifted workbook — one where the id now means something else — fails the import rather
 *   than deleting whatever the id happens to point at now.
 * - The slot's authored options are removed with it, and counted, so nothing dangles.
 * - Everything is transactional: nothing is mutated unless every rule passes, so a rejected
 *   file leaves the import byte-identical to a run without it.
 *
 * Removing a row here does not erase history. The procedure's previously published module,
 * recipe, and release versions retain the row verbatim in the module and composition ledgers;
 * this overlay changes only what the *current* template produces going forward.
 */

const SEED_FILE = 'data/ip-preference-cards/reviewed/procedure-template-corrections.json'

const SLOT_ID_PATTERN = /^SLOT-[0-9A-F]{10}$/

export interface ProcedureTemplateSlotRemoval {
  slot_id: string
  /**
   * What the author believes the row is. All three must match the live row exactly, so a
   * removal can never silently land on a row that has since been retargeted or reshaped.
   */
  expect: {
    procedure_code: string
    role_code: string
    section: string
  }
  reason: string
}

export interface ProcedureTemplateCorrectionsFile {
  formatVersion: 1
  notes: string
  slotRemovals: ProcedureTemplateSlotRemoval[]
}

export interface ProcedureTemplateCorrectionsReport {
  applied: boolean
  slots_removed: number
  slot_options_removed: number
  details: {
    removed_slots: string[]
    removed_slot_options: string[]
  }
  errors: string[]
}

function emptyReport(): ProcedureTemplateCorrectionsReport {
  return {
    applied: false,
    slots_removed: 0,
    slot_options_removed: 0,
    details: { removed_slots: [], removed_slot_options: [] },
    errors: [],
  }
}

export async function readProcedureTemplateCorrections(
  filePath = SEED_FILE,
): Promise<ProcedureTemplateCorrectionsFile | null> {
  try {
    return JSON.parse(
      await readFile(path.resolve(process.cwd(), filePath), 'utf8'),
    ) as ProcedureTemplateCorrectionsFile
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * Removes the corrected rows from the normalized sheet data in place and returns a report.
 * Nothing is mutated unless every rule passes.
 */
export function applyProcedureTemplateCorrections(
  normalized: Record<string, CatalogRecord[]>,
  corrections: ProcedureTemplateCorrectionsFile | null,
): ProcedureTemplateCorrectionsReport {
  const report = emptyReport()
  if (!corrections) return report

  const errors = report.errors

  if (corrections.formatVersion !== 1) {
    errors.push(
      `Procedure template corrections declare unsupported formatVersion ${String(corrections.formatVersion)}; expected 1.`,
    )
    return report
  }

  const removals = corrections.slotRemovals ?? []
  const slotRows = new Map<string, CatalogRecord>()
  for (const record of normalized.Procedure_Slots ?? []) {
    if (typeof record.slot_id === 'string') slotRows.set(record.slot_id, record)
  }

  const removalIds = new Set<string>()
  for (const removal of removals) {
    const label = `Slot removal ${removal.slot_id || '(unnamed)'}`
    if (typeof removal.reason !== 'string' || removal.reason.trim().length === 0) {
      errors.push(`${label} is missing a reason; every reviewed correction must record why.`)
    }
    if (!SLOT_ID_PATTERN.test(removal.slot_id ?? '')) {
      errors.push(`${label} does not match the SLOT-XXXXXXXXXX identifier shape.`)
      continue
    }
    if (removalIds.has(removal.slot_id)) {
      errors.push(`${label} is declared twice in the corrections file.`)
      continue
    }
    removalIds.add(removal.slot_id)

    const row = slotRows.get(removal.slot_id)
    if (!row) {
      errors.push(`${label} names a slot the import does not carry.`)
      continue
    }
    const expect = removal.expect ?? ({} as ProcedureTemplateSlotRemoval['expect'])
    for (const field of ['procedure_code', 'role_code', 'section'] as const) {
      if (typeof expect[field] !== 'string' || expect[field].length === 0) {
        errors.push(`${label} must restate the row's ${field} in expect.${field}.`)
        continue
      }
      if (row[field] !== expect[field]) {
        errors.push(
          `${label} expected ${field} "${expect[field]}" but the row carries "${String(row[field])}". The workbook has drifted; re-review before removing.`,
        )
      }
    }
  }

  // A correction must not empty a procedure's template: a procedure with zero slots is not a
  // leaner template, it is a broken one, and nothing downstream authored that.
  const remainingByProcedure = new Map<string, number>()
  for (const record of normalized.Procedure_Slots ?? []) {
    const code = typeof record.procedure_code === 'string' ? record.procedure_code : null
    if (!code) continue
    const slotId = typeof record.slot_id === 'string' ? record.slot_id : null
    if (slotId && removalIds.has(slotId)) continue
    remainingByProcedure.set(code, (remainingByProcedure.get(code) ?? 0) + 1)
  }
  for (const removal of removals) {
    const row = slotRows.get(removal.slot_id)
    const code = row && typeof row.procedure_code === 'string' ? row.procedure_code : null
    if (code && !remainingByProcedure.has(code)) {
      errors.push(
        `Slot removal ${removal.slot_id} would leave procedure ${code} with no slots at all.`,
      )
    }
  }

  if (errors.length > 0) return report

  const slots = normalized.Procedure_Slots ?? []
  for (let index = slots.length - 1; index >= 0; index -= 1) {
    const slotId = slots[index].slot_id
    if (typeof slotId === 'string' && removalIds.has(slotId)) {
      slots.splice(index, 1)
      report.details.removed_slots.push(slotId)
    }
  }
  const options = normalized.Slot_Product_Options ?? []
  for (let index = options.length - 1; index >= 0; index -= 1) {
    const option = options[index]
    const slotId = option.slot_id
    if (typeof slotId === 'string' && removalIds.has(slotId)) {
      options.splice(index, 1)
      report.details.removed_slot_options.push(`${slotId} × ${String(option.product_id)}`)
    }
  }

  report.details.removed_slots.sort()
  report.details.removed_slot_options.sort()
  report.slots_removed = report.details.removed_slots.length
  report.slot_options_removed = report.details.removed_slot_options.length
  report.applied = true
  return report
}
