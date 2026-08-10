/**
 * Codex C-04 / C-04b — the SERVER integration path for formulary mismatch scoping.
 *
 * These tests do not hand the projection a precomputed eligibility value: they mock the
 * hospital-formulary staging artifact BEFORE the server module is imported (jest.mock is
 * hoisted above the import) and run `getProcedureReadinessView`, so the rows flow through
 * the real `procedures.server.ts` assembly — role-code parsing, the procedure-role
 * intersection, the per-role authored-selectable index built from this procedure's own
 * slots, and the projection — exactly as a request would.
 *
 * Fixture facts (real generated data, EBUS_TBNA):
 * - PRD-2302DA77DA is an authored SELECTABLE option for EBUS_NEEDLE_FNA slots and for no
 *   other EBUS role;
 * - GENERIC_SUCTION is an EBUS requirement role with no authored selectable option at all;
 * - TALC_VIAL is a real governed role that no EBUS_TBNA slot requests;
 * - PRD-CB1622624D is a `hidden` catalog product.
 *
 * C-04b reproduction (targeted verification on head 4f6c5695): with rows FORM-B-ONLY,
 * FORM-A-ONLY, FORM-A-AND-B, the `.some(...)` semantics returned mismatches =
 * ["FORM-B-ONLY"] — FORM-A-AND-B's matching EBUS_NEEDLE_FNA suppressed its GENERIC_SUCTION
 * mismatch. Correct semantics require ["FORM-A-AND-B", "FORM-B-ONLY"].
 */

jest.mock('../../../../data/ip-preference-cards/generated/hospital-formulary-staging.json', () => {
  // Defined inside the factory: jest hoists this mock above module scope, so the factory
  // may not close over file-level variables.
  const formularyRow = (formularyId: string, productId: string, roleCodes: string) => ({
    formulary_id: formularyId,
    product_id: productId,
    role_codes: roleCodes,
    hospital_carries: true,
    preferred: false,
    local_item_number: null,
    local_description: null,
    local_uom: null,
    storage_location: null,
    par_level: null,
    last_reviewed: null,
    local_notes: null,
  })
  return [
    formularyRow('FORM-B-ONLY', 'PRD-2302DA77DA', 'GENERIC_SUCTION'),
    formularyRow('FORM-A-ONLY', 'PRD-2302DA77DA', 'EBUS_NEEDLE_FNA'),
    formularyRow('FORM-A-AND-B', 'PRD-2302DA77DA', 'GENERIC_SUCTION; EBUS_NEEDLE_FNA'),
    // Multi-role row on a hidden product: hidden stays fail-closed whatever the roles say.
    formularyRow('FORM-HIDDEN-MULTI', 'PRD-CB1622624D', 'EBUS_NEEDLE_FNA; GENERIC_SUCTION'),
    // One matching EBUS role plus one real governed role that is NOT an EBUS_TBNA role: the
    // procedure-role intersection must drop TALC_VIAL instead of letting it fail the row.
    formularyRow('FORM-A-AND-NON-EBUS', 'PRD-2302DA77DA', 'EBUS_NEEDLE_FNA; TALC_VIAL'),
    // The same non-EBUS role beside a genuinely mismatching EBUS role: the diagnostic must
    // name only the relevant role, proving TALC_VIAL never survived into the assertion.
    formularyRow('FORM-B-AND-NON-EBUS', 'PRD-2302DA77DA', 'GENERIC_SUCTION; TALC_VIAL'),
  ]
})

import { getProcedureReadinessView } from '@/features/device-intelligence/server/procedures.server'

describe('C-04/C-04b — formulary mismatch scoped to every relevant role (server integration)', () => {
  const mismatches = () =>
    getProcedureReadinessView('EBUS_TBNA')!.projection.cardDiagnostics.filter(
      (diagnostic) => diagnostic.code === 'inventory_formulary_mismatch',
    )

  it('mismatches exactly the expected rows — a matching role never suppresses another relevant role', () => {
    const found = mismatches()
    expect(found.map((diagnostic) => diagnostic.sourceId).sort()).toEqual([
      'FORM-A-AND-B',
      'FORM-B-AND-NON-EBUS',
      'FORM-B-ONLY',
      'FORM-HIDDEN-MULTI',
    ])
    // FORM-A-ONLY and FORM-A-AND-NON-EBUS produce no mismatch (asserted by the exact list).
  })

  it('C-04b reproduction: FORM-A-AND-B mismatches and its diagnostic identifies GENERIC_SUCTION', () => {
    const partial = mismatches().find((diagnostic) => diagnostic.sourceId === 'FORM-A-AND-B')!
    expect(partial).toBeDefined()
    expect(partial.detail).toContain('PRD-2302DA77DA')
    expect(partial.detail).toContain('relevantRoles=EBUS_NEEDLE_FNA/GENERIC_SUCTION')
    expect(partial.detail).toContain('mismatchingRoles=GENERIC_SUCTION')
    expect(partial.detail).toContain('eligibleForAllRelevantRoles=false')
  })

  it('keeps hidden products fail-closed on multi-role rows', () => {
    const hidden = mismatches().find((diagnostic) => diagnostic.sourceId === 'FORM-HIDDEN-MULTI')!
    expect(hidden).toBeDefined()
    expect(hidden.detail).toContain('visibility=hidden')
  })

  it('drops non-procedure roles at the intersection instead of failing or widening the row', () => {
    // Negative half: the row pairing the matching EBUS_NEEDLE_FNA with non-EBUS TALC_VIAL
    // must NOT mismatch — a naive all-roles check over the RAW parsed codes would have
    // failed it on TALC_VIAL.
    expect(mismatches().some((diagnostic) => diagnostic.sourceId === 'FORM-A-AND-NON-EBUS')).toBe(
      false,
    )
    // Positive half: where the sibling row DOES mismatch, its diagnostic proves the raw
    // unrelated role never survived as a relevant role in the domain assertion.
    const withNonEbus = mismatches().find(
      (diagnostic) => diagnostic.sourceId === 'FORM-B-AND-NON-EBUS',
    )!
    expect(withNonEbus.detail).toContain('relevantRoles=GENERIC_SUCTION ')
    expect(withNonEbus.detail).not.toContain('TALC_VIAL')
  })

  it('counts every fixture row in the formulary summary the same view reports', () => {
    // All six rows intersect EBUS roles, so the mismatch asymmetry above cannot be an
    // artifact of rows being dropped upstream of the assertion assembly.
    const view = getProcedureReadinessView('EBUS_TBNA')!
    expect(view.formularySummary.rowsIntersectingProcedureRoles).toBe(6)
    expect(view.formularySummary.carriedRows).toBe(6)
  })
})
