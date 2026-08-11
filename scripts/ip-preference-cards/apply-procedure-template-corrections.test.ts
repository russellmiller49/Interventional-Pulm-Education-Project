import {
  applyProcedureTemplateCorrections,
  type ProcedureTemplateCorrectionsFile,
} from './apply-procedure-template-corrections'
import type { CatalogRecord } from './catalog-utils'

/**
 * The governed slot-removal path (owner review F-06 introduced it).
 *
 * Every rule is a hard import failure and every failure is transactional: a rejected file
 * must leave the sheet data byte-identical to a run without it, because a partial removal is
 * a template nobody authored.
 */

function baseline(): Record<string, CatalogRecord[]> {
  return {
    Procedure_Slots: [
      {
        slot_id: 'SLOT-AAAAAAAAAA',
        procedure_code: 'CHEST_TUBE',
        role_code: 'IPC_INSERTION_KIT',
        section: 'Long-term drainage',
      },
      {
        slot_id: 'SLOT-BBBBBBBBBB',
        procedure_code: 'CHEST_TUBE',
        role_code: 'GENERIC_DRAINAGE_UNIT',
        section: 'Drainage',
      },
      {
        slot_id: 'SLOT-CCCCCCCCCC',
        procedure_code: 'IPC_PLACEMENT',
        role_code: 'IPC_INSERTION_KIT',
        section: 'Catheter system',
      },
    ],
    Slot_Product_Options: [
      { slot_id: 'SLOT-AAAAAAAAAA', product_id: 'PRD-1' },
      { slot_id: 'SLOT-AAAAAAAAAA', product_id: 'PRD-2' },
      { slot_id: 'SLOT-BBBBBBBBBB', product_id: 'PRD-3' },
    ],
  }
}

function removal(
  overrides?: Partial<ProcedureTemplateCorrectionsFile['slotRemovals'][number]>,
): ProcedureTemplateCorrectionsFile['slotRemovals'][number] {
  return {
    slot_id: 'SLOT-AAAAAAAAAA',
    expect: {
      procedure_code: 'CHEST_TUBE',
      role_code: 'IPC_INSERTION_KIT',
      section: 'Long-term drainage',
    },
    reason: 'Owner review F-06: the IPC pathway belongs to IPC_PLACEMENT.',
    ...overrides,
  }
}

function file(
  removals: ProcedureTemplateCorrectionsFile['slotRemovals'],
): ProcedureTemplateCorrectionsFile {
  return { formatVersion: 1, notes: 'test', slotRemovals: removals }
}

describe('applyProcedureTemplateCorrections', () => {
  it('removes the slot row and its authored options, and reports both', () => {
    const normalized = baseline()
    const report = applyProcedureTemplateCorrections(normalized, file([removal()]))
    expect(report.errors).toEqual([])
    expect(report.applied).toBe(true)
    expect(report.slots_removed).toBe(1)
    expect(report.slot_options_removed).toBe(2)
    expect(report.details.removed_slots).toEqual(['SLOT-AAAAAAAAAA'])
    expect(normalized.Procedure_Slots.map((row) => row.slot_id)).toEqual([
      'SLOT-BBBBBBBBBB',
      'SLOT-CCCCCCCCCC',
    ])
    expect(normalized.Slot_Product_Options).toEqual([
      { slot_id: 'SLOT-BBBBBBBBBB', product_id: 'PRD-3' },
    ])
  })

  it('is a no-op without a corrections file', () => {
    const normalized = baseline()
    const before = JSON.stringify(normalized)
    const report = applyProcedureTemplateCorrections(normalized, null)
    expect(report.applied).toBe(false)
    expect(JSON.stringify(normalized)).toBe(before)
  })

  it('rejects an unknown slot id', () => {
    const normalized = baseline()
    const report = applyProcedureTemplateCorrections(
      normalized,
      file([removal({ slot_id: 'SLOT-0123456789' })]),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('names a slot the import does not carry'),
    ])
    expect(report.applied).toBe(false)
  })

  it('rejects a removal whose stated identity has drifted, naming the field', () => {
    const normalized = baseline()
    const before = JSON.stringify(normalized)
    const report = applyProcedureTemplateCorrections(
      normalized,
      file([
        removal({
          expect: {
            procedure_code: 'CHEST_TUBE',
            role_code: 'IPC_DRAINAGE_KIT',
            section: 'Long-term drainage',
          },
        }),
      ]),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('expected role_code "IPC_DRAINAGE_KIT" but the row carries'),
    ])
    // Transactional: the drifted expectation must leave everything untouched.
    expect(JSON.stringify(normalized)).toBe(before)
  })

  it('rejects a duplicate removal of the same slot', () => {
    const normalized = baseline()
    const report = applyProcedureTemplateCorrections(normalized, file([removal(), removal()]))
    expect(report.errors).toEqual([expect.stringContaining('declared twice')])
    expect(report.applied).toBe(false)
  })

  it('rejects a removal with no reason, and applies nothing else in the same file', () => {
    const normalized = baseline()
    const before = JSON.stringify(normalized)
    const report = applyProcedureTemplateCorrections(
      normalized,
      file([
        removal(),
        removal({
          slot_id: 'SLOT-BBBBBBBBBB',
          expect: {
            procedure_code: 'CHEST_TUBE',
            role_code: 'GENERIC_DRAINAGE_UNIT',
            section: 'Drainage',
          },
          reason: '',
        }),
      ]),
    )
    expect(report.errors).toContainEqual(expect.stringContaining('missing a reason'))
    expect(JSON.stringify(normalized)).toBe(before)
  })

  it('refuses to empty a procedure template entirely', () => {
    const normalized: Record<string, CatalogRecord[]> = {
      Procedure_Slots: [
        {
          slot_id: 'SLOT-DDDDDDDDDD',
          procedure_code: 'SOLO',
          role_code: 'ONLY_ROLE',
          section: 'Platform',
        },
      ],
      Slot_Product_Options: [],
    }
    const report = applyProcedureTemplateCorrections(
      normalized,
      file([
        removal({
          slot_id: 'SLOT-DDDDDDDDDD',
          expect: { procedure_code: 'SOLO', role_code: 'ONLY_ROLE', section: 'Platform' },
        }),
      ]),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('would leave procedure SOLO with no slots at all'),
    ])
    expect(normalized.Procedure_Slots).toHaveLength(1)
  })

  it('rejects an unsupported format version', () => {
    const normalized = baseline()
    const report = applyProcedureTemplateCorrections(normalized, {
      formatVersion: 2 as unknown as 1,
      notes: '',
      slotRemovals: [removal()],
    })
    expect(report.errors).toEqual([expect.stringContaining('unsupported formatVersion')])
    expect(report.applied).toBe(false)
  })
})
