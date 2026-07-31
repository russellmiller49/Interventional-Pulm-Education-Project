import {
  applyProcedureAdditionRoles,
  applyProcedureAdditions,
  readProcedureAdditions,
  readProcedureAdditionsContext,
  type ProcedureAdditionsContext,
  type ProcedureAdditionsFile,
} from './apply-procedure-additions'
import { stableId, type CatalogRecord } from './catalog-utils'
import { ROLE_CATEGORY_SET } from '@/features/preference-cards/domain/role-taxonomy'

/**
 * The governed procedure/slot additions path.
 *
 * Every rule here is a hard import failure by design: a stale or drifted addition must stop
 * the pipeline, never degrade into a slot no requirement can reach or an option attached to a
 * product that does not serve the role.
 */

const NATURAL_KEY = 'TEST_PROCEDURE|Energy|10|ENERGY_PLATFORM'
const SLOT_ID = stableId('SLOT', NATURAL_KEY)

function baseline(): Record<string, CatalogRecord[]> {
  return {
    Products: [
      { product_id: 'PRD-VISIBLE', visibility_state: 'prototype_visible' },
      { product_id: 'PRD-HIDDEN', visibility_state: 'hidden' },
    ],
    Product_Roles: [
      { product_id: 'PRD-VISIBLE', role_code: 'ENERGY_PLATFORM' },
      { product_id: 'PRD-HIDDEN', role_code: 'ENERGY_PLATFORM' },
    ],
    Procedures: [{ procedure_code: 'RIGID_BRONCH', procedure_name: 'Rigid bronchoscopy' }],
    Procedure_Slots: [
      { slot_id: 'SLOT-AAAAAAAAAA', procedure_code: 'RIGID_BRONCH', role_code: 'RIGID_FORCEPS' },
    ],
    Slot_Product_Options: [],
    Roles: [
      { role_code: 'ENERGY_PLATFORM', category: 'Energy platforms' },
      { role_code: 'RIGID_FORCEPS', category: 'Rigid bronchoscopy' },
    ],
  }
}

function context(overrides?: Partial<ProcedureAdditionsContext>): ProcedureAdditionsContext {
  return {
    knownSections: new Set(['Energy', 'Platform']),
    groupedProcedureCodes: new Set(['RIGID_BRONCH', 'TEST_PROCEDURE']),
    knownRoleCategories: ROLE_CATEGORY_SET,
    ...overrides,
  }
}

function validSlot(overrides?: Partial<ProcedureAdditionsFile['slotsToAdd'][number]>) {
  return {
    slot_id: SLOT_ID,
    natural_key: NATURAL_KEY,
    procedure_code: 'TEST_PROCEDURE',
    section: 'Energy',
    display_order: 10,
    role_code: 'ENERGY_PLATFORM',
    slot_label: 'Electrosurgical generator',
    generic_requirement: 'Electrosurgical or argon plasma generator for the planned energy modes.',
    requiredness: 'required' as const,
    default_qty: 1,
    selection_mode: 'single' as const,
    allow_custom: true,
    dependency_rule: null,
    notes: null,
    reason: 'The procedure has no energy requirement without it.',
    ...overrides,
  }
}

function validProcedure() {
  return {
    procedure_code: 'TEST_PROCEDURE',
    procedure_name: 'Test procedure',
    template_version: '0.1',
    scope: 'Adult draft',
    status: 'Draft - clinician review required',
    clinical_owner: null,
    notes: null,
    reason: 'Fixture procedure.',
  }
}

function file(overrides?: Partial<ProcedureAdditionsFile>): ProcedureAdditionsFile {
  return {
    formatVersion: 1,
    notes: 'fixture',
    rolesToAdd: [],
    proceduresToAdd: [validProcedure()],
    slotsToAdd: [validSlot()],
    slotOptionsToAdd: [],
    ...overrides,
  }
}

describe('procedure additions applicator', () => {
  it('adds a procedure, its slot, and an exact option, normalizing the workbook vocabulary', () => {
    const normalized = baseline()
    const report = applyProcedureAdditions(
      normalized,
      file({
        slotOptionsToAdd: [
          {
            slot_id: SLOT_ID,
            product_id: 'PRD-VISIBLE',
            role_code: 'ENERGY_PLATFORM',
            eligibility_status: 'Clinician-reviewed catalog option',
            selectable: true,
            visible_by_default: false,
            reason: 'Reviewed generator option.',
          },
        ],
      }),
      context(),
    )

    expect(report.errors).toEqual([])
    expect(report.applied).toBe(true)
    expect(report.procedures_added).toBe(1)
    expect(report.slots_added).toBe(1)
    expect(report.slot_options_added).toBe(1)

    expect(normalized.Procedures).toHaveLength(2)
    expect(normalized.Procedure_Slots.at(-1)).toMatchObject({
      slot_id: SLOT_ID,
      requiredness: 'required',
      requiredness_raw: 'Required',
      selection_mode: 'single',
      selection_mode_raw: 'Single select',
    })
    expect(normalized.Slot_Product_Options.at(-1)).toMatchObject({
      selectable: true,
      visible_by_default: false,
      product_visibility: 'prototype_visible',
    })
  })

  it('applies nothing when any rule fails', () => {
    const normalized = baseline()
    const report = applyProcedureAdditions(
      normalized,
      file({ slotsToAdd: [validSlot({ section: 'Not a mapped section' })] }),
      context(),
    )

    expect(report.applied).toBe(false)
    expect(normalized.Procedures).toHaveLength(1)
    expect(normalized.Procedure_Slots).toHaveLength(1)
  })

  it('rejects a procedure code that collides with an existing procedure', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({
        proceduresToAdd: [{ ...validProcedure(), procedure_code: 'RIGID_BRONCH' }],
        slotsToAdd: [],
      }),
      context(),
    )
    expect(report.errors).toEqual([expect.stringContaining('collides with an existing procedure')])
  })

  it('rejects a procedure that no scenario-overrides procedure group names', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({ slotsToAdd: [] }),
      context({ groupedProcedureCodes: new Set(['RIGID_BRONCH']) }),
    )
    expect(report.errors).toEqual([expect.stringContaining('procedureGroups')])
  })

  it('rejects a slot id that collides with an existing slot', () => {
    const naturalKey = 'collision'
    const report = applyProcedureAdditions(
      { ...baseline(), Procedure_Slots: [{ slot_id: stableId('SLOT', naturalKey) }] },
      file({
        slotsToAdd: [validSlot({ slot_id: stableId('SLOT', naturalKey), natural_key: naturalKey })],
      }),
      context(),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('collides with an existing procedure slot'),
    ])
  })

  it('rejects a slot id that is not the deterministic id for its natural key', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({ slotsToAdd: [validSlot({ natural_key: 'a different key' })] }),
      context(),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('is not the deterministic id for its natural key'),
    ])
  })

  it('rejects a slot whose role does not exist', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({ slotsToAdd: [validSlot({ role_code: 'LASER_CONSOLE' })] }),
      context(),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('references unknown role LASER_CONSOLE'),
    ])
  })

  it('rejects a slot whose section has no setup-zone and phase mapping', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({ slotsToAdd: [validSlot({ section: 'Laser' })] }),
      context(),
    )
    expect(report.errors).toEqual([expect.stringContaining('section-zone-phase-map.json')])
  })

  it('rejects two slots that reuse a display order within one procedure', () => {
    const secondKey = `${NATURAL_KEY}|second`
    const report = applyProcedureAdditions(
      baseline(),
      file({
        slotsToAdd: [
          validSlot(),
          validSlot({ slot_id: stableId('SLOT', secondKey), natural_key: secondKey }),
        ],
      }),
      context(),
    )
    expect(report.errors).toEqual([expect.stringContaining('reuses display_order 10')])
  })

  it('rejects an option whose role differs from its slot', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({
        slotOptionsToAdd: [
          {
            slot_id: SLOT_ID,
            product_id: 'PRD-VISIBLE',
            role_code: 'RIGID_FORCEPS',
            eligibility_status: 'Clinician-reviewed catalog option',
            selectable: true,
            visible_by_default: false,
            reason: 'Mismatched fixture.',
          },
        ],
      }),
      context(),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('but its slot requests ENERGY_PLATFORM'),
    ])
  })

  it('rejects an option whose product does not carry the role', () => {
    const normalized = baseline()
    normalized.Product_Roles = [{ product_id: 'PRD-VISIBLE', role_code: 'RIGID_FORCEPS' }]
    const report = applyProcedureAdditions(
      normalized,
      file({
        slotOptionsToAdd: [
          {
            slot_id: SLOT_ID,
            product_id: 'PRD-VISIBLE',
            role_code: 'ENERGY_PLATFORM',
            eligibility_status: 'Clinician-reviewed catalog option',
            selectable: true,
            visible_by_default: false,
            reason: 'Product does not serve this role.',
          },
        ],
      }),
      context(),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('does not carry ENERGY_PLATFORM in Product_Roles'),
    ])
  })

  it('rejects an option referencing a product the catalog does not have', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({
        slotOptionsToAdd: [
          {
            slot_id: SLOT_ID,
            product_id: 'PRD-MISSING',
            role_code: 'ENERGY_PLATFORM',
            eligibility_status: 'Clinician-reviewed catalog option',
            selectable: true,
            visible_by_default: false,
            reason: 'Missing product.',
          },
        ],
      }),
      context(),
    )
    expect(report.errors).toEqual([
      expect.stringContaining('references unknown product PRD-MISSING'),
    ])
  })

  it('rejects an added role whose category is outside the closed vocabulary', () => {
    const report = applyProcedureAdditionRoles(
      baseline(),
      file({
        rolesToAdd: [
          {
            role_code: 'LASER_CONSOLE',
            category: 'Laser platform',
            role_name: 'Laser console',
            description: 'Surgical laser generator.',
            selection_guidance: 'Match wavelength, power, and fibre.',
            requires_current_ifu: true,
            reason: 'Fixture.',
          },
        ],
        slotsToAdd: [],
      }),
      ROLE_CATEGORY_SET,
    )
    expect(report.errors).toEqual([
      expect.stringContaining('outside the closed role-category vocabulary'),
    ])
  })

  it('registers a valid role before any product or slot could claim it', () => {
    const normalized = baseline()
    const report = applyProcedureAdditionRoles(
      normalized,
      file({
        rolesToAdd: [
          {
            role_code: 'LASER_CONSOLE',
            category: 'Laser',
            role_name: 'Surgical laser console',
            description: 'Laser generator used for endobronchial work.',
            selection_guidance: 'Match wavelength to the intended tissue effect.',
            requires_current_ifu: true,
            reason: 'Laser had no role of any kind.',
          },
        ],
        slotsToAdd: [],
      }),
      ROLE_CATEGORY_SET,
    )
    expect(report.errors).toEqual([])
    expect(report.roles_added).toBe(1)
    expect(normalized.Roles.at(-1)).toMatchObject({ role_code: 'LASER_CONSOLE', category: 'Laser' })
  })

  it('rejects an added role that collides with an existing one', () => {
    const report = applyProcedureAdditionRoles(
      baseline(),
      file({
        rolesToAdd: [
          {
            role_code: 'RIGID_FORCEPS',
            category: 'Rigid bronchoscopy',
            role_name: 'Rigid forceps',
            description: 'Duplicate.',
            selection_guidance: 'Duplicate.',
            requires_current_ifu: true,
            reason: 'Fixture.',
          },
        ],
        slotsToAdd: [],
      }),
      ROLE_CATEGORY_SET,
    )
    expect(report.errors).toEqual([expect.stringContaining('collides with an existing role')])
  })

  it('rejects any entry that does not record why it exists', () => {
    const report = applyProcedureAdditions(
      baseline(),
      file({ slotsToAdd: [validSlot({ reason: '  ' })] }),
      context(),
    )
    expect(report.errors).toEqual([expect.stringContaining('is missing a reason')])
  })

  it('forces a hidden product back to non-selectable rather than trusting the authored flag', () => {
    const normalized = baseline()
    const report = applyProcedureAdditions(
      normalized,
      file({
        slotOptionsToAdd: [
          {
            slot_id: SLOT_ID,
            product_id: 'PRD-HIDDEN',
            role_code: 'ENERGY_PLATFORM',
            eligibility_status: 'Unverified candidate',
            selectable: true,
            visible_by_default: true,
            reason: 'Authored optimistically; the product is hidden.',
          },
        ],
      }),
      context(),
    )

    expect(report.applied).toBe(true)
    expect(normalized.Slot_Product_Options.at(-1)).toMatchObject({
      selectable: false,
      visible_by_default: false,
      product_visibility: 'hidden',
    })
    expect(report.visibility_conflicts).toHaveLength(1)
  })

  it('rejects an unsupported format version outright', () => {
    const report = applyProcedureAdditions(
      baseline(),
      { ...file(), formatVersion: 2 as unknown as 1 },
      context(),
    )
    expect(report.errors).toEqual([expect.stringContaining('unsupported formatVersion')])
  })

  it('is a no-op when the additions file is absent', () => {
    const normalized = baseline()
    const report = applyProcedureAdditions(normalized, null, context())
    expect(report.applied).toBe(false)
    expect(report.errors).toEqual([])
    expect(normalized.Procedures).toHaveLength(1)
  })

  it('accepts the checked-in additions file against the real seed context', async () => {
    const [additions, realContext] = await Promise.all([
      readProcedureAdditions(),
      readProcedureAdditionsContext({ knownRoleCategories: ROLE_CATEGORY_SET }),
    ])
    expect(additions).not.toBeNull()
    expect(additions!.formatVersion).toBe(1)
    expect(realContext.knownSections.size).toBeGreaterThan(0)
    expect(realContext.groupedProcedureCodes.size).toBeGreaterThan(0)
  })
})
