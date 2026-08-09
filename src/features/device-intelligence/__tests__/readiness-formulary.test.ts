/**
 * Codex C-04 — the SERVER integration path for formulary mismatch scoping.
 *
 * These tests do not hand the projection a precomputed eligibility value: they mock the
 * hospital-formulary staging artifact and run `getProcedureReadinessView`, so the rows flow
 * through the real `procedures.server.ts` assembly — role-code parsing, the per-role
 * authored-selectable index built from this procedure's own slots, and the projection —
 * exactly as a request would.
 *
 * Fixture facts (real generated data, EBUS_TBNA):
 * - PRD-2302DA77DA is an authored SELECTABLE option for EBUS_NEEDLE_FNA slots and for no
 *   other EBUS role;
 * - GENERIC_SUCTION is an EBUS requirement role with no authored selectable option at all.
 */

jest.mock('../../../../data/ip-preference-cards/generated/hospital-formulary-staging.json', () => [
  {
    formulary_id: 'FORM-C04-ROLE-MISMATCH',
    product_id: 'PRD-2302DA77DA',
    role_codes: 'GENERIC_SUCTION',
    hospital_carries: true,
    preferred: false,
    local_item_number: null,
    local_description: null,
    local_uom: null,
    storage_location: null,
    par_level: null,
    last_reviewed: null,
    local_notes: null,
  },
  {
    formulary_id: 'FORM-C04-ROLE-MATCH',
    product_id: 'PRD-2302DA77DA',
    role_codes: 'EBUS_NEEDLE_FNA',
    hospital_carries: true,
    preferred: false,
    local_item_number: null,
    local_description: null,
    local_uom: null,
    storage_location: null,
    par_level: null,
    last_reviewed: null,
    local_notes: null,
  },
])

import { getProcedureReadinessView } from '@/features/device-intelligence/server/procedures.server'

describe('C-04 — formulary mismatch is scoped to the row’s own role/slot (server integration)', () => {
  it('fires for a carried product mapped to a role where it is not selectable, and only there', () => {
    const view = getProcedureReadinessView('EBUS_TBNA')!
    const mismatches = view.projection.cardDiagnostics.filter(
      (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
    )

    // Row 1: the product IS selectable somewhere in this procedure (EBUS_NEEDLE_FNA), so the
    // pre-correction procedure-wide boolean would have suppressed this. The row maps it to
    // GENERIC_SUCTION, where nothing selectable is authored — it must mismatch.
    expect(mismatches.map((diagnostic) => diagnostic.sourceId)).toEqual(['FORM-C04-ROLE-MISMATCH'])
    expect(mismatches[0].detail).toContain('PRD-2302DA77DA')
    expect(mismatches[0].detail).toContain('GENERIC_SUCTION')

    // Row 2: identical product, mapped to the role that actually authors it as selectable —
    // no mismatch may fire for it (asserted by the exact single-element list above).
  })

  it('counts both fixture rows in the formulary summary the same view reports', () => {
    // The rows really flowed through the shared row filter (both intersect EBUS roles), so
    // the mismatch asymmetry above cannot be an artifact of one row being dropped upstream.
    const view = getProcedureReadinessView('EBUS_TBNA')!
    expect(view.formularySummary.rowsIntersectingProcedureRoles).toBe(2)
    expect(view.formularySummary.carriedRows).toBe(2)
  })
})
