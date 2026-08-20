import coverageReport from '../../data/ip-preference-cards/generated/coverage-report.json'
import importReport from '../../data/ip-preference-cards/generated/import-report.json'
import products from '../../data/ip-preference-cards/generated/catalog-products.json'
import procedureSlots from '../../data/ip-preference-cards/generated/procedure-slots.json'
import slotOptionProposals from '../../data/ip-preference-cards/generated/slot-product-option-proposals.json'

describe('generated IP preference-card import contract', () => {
  it('records workbook provenance, row offsets, counts, and a stable hash', () => {
    expect(importReport).toMatchObject({
      header_row: 4,
      data_start_row: 5,
      workbook_sha256: 'fb25b24e4abb1a5225e76d0499f870f680c9cb07633491f1f63e63e2394b5abf',
      counts: {
        Products: 1221,
        Roles: 98,
        Procedures: 13,
        Procedure_Slots: 174,
        Slot_Product_Options: 2080,
        Compatibility: 179,
      },
    })
  })

  it('reports no duplicate identifiers or strict foreign-key failures', () => {
    expect(importReport.duplicate_ids).toEqual({})
    expect(importReport.foreign_key_errors).toEqual([])
  })

  it('reports authored options and unreviewed proposals with accurate names', () => {
    expect(importReport.slot_option_proposals).toEqual({
      authored_canonical_options: 2035,
      generated_unreviewed_proposals: slotOptionProposals.proposals.length,
      excluded_proposal_pairs: 0,
      required_slots_with_catalog_coverage: 82,
      required_slots_with_curated_defaults: 44,
      authored_row_errors: 0,
      stale_exceptions: 0,
      proposal_generation_errors: 0,
    })
    expect(slotOptionProposals.proposals).toHaveLength(1485)
    expect(
      slotOptionProposals.proposals.every(
        (proposal) =>
          proposal.proposal_status === 'unreviewed' &&
          proposal.selectable === false &&
          proposal.visible_by_default === false,
      ),
    ).toBe(true)
  })

  it('records the governed external-review overlay as fully applied', () => {
    expect(importReport.external_review_remediation).toMatchObject({
      applied: true,
      review_id: 'external-review-remediation-v0.1',
      adds: {
        roles: 13,
        slot_product_options: 10,
        compatibility_rules: 1,
      },
      removes: { slot_product_options: 31 },
      updates: {
        product_roles: 57,
        procedure_slots: 6,
        slot_product_options: 13,
      },
      product_governance_entries: 21,
      errors: [],
    })
  })

  it('records the completed workbook decisions as a separately guarded implementation layer', () => {
    expect(importReport.external_review_completed_implementation).toMatchObject({
      applied: true,
      implementation_id: 'external-review-remediation-v0.1-completed',
      review_id: 'external-review-remediation-v0.1',
      source_workbook_sha256: '78b112baa0cd84f213eef0c1f014c438e811ac7bafe3e5004c7b4e51dd119b4e',
      proposal_corrections_sha256:
        '589bd1488027c570dbc674605c8a8cd1b1b7744c348afcf1a22d2b7b707a18d9',
      adds: {
        roles: 5,
        product_roles: 1,
        slot_product_options: 18,
        compatibility_rules: 7,
      },
      removes: {
        slot_product_options: 4,
      },
      updates: {
        product_roles: 6,
      },
      verified_absent_slot_product_options: 4,
      decision_evidence: {
        referenced_review_keys: 24,
        normalized_decisions: 97,
        errors: 0,
        warnings: 6,
      },
      errors: [],
    })
  })

  it('normalizes booleans, numeric dimensions, blanks, and spec JSON', () => {
    const product = products.find((candidate) => candidate.product_id === 'PRD-00C13A59AA')
    expect(product).toMatchObject({
      implantable: false,
      diameter_mm: 19.3,
      gtin: null,
      spec_json: {
        inner_diameter_mm: 17.1,
        outer_diameter_mm: 19.3,
        working_length_mm: 330,
      },
    })
    expect(importReport.malformed_spec_json).toEqual([])
  })

  it('normalizes every procedure selection mode to the closed vocabulary', () => {
    expect(new Set(procedureSlots.map((slot) => slot.selection_mode))).toEqual(
      new Set(['single', 'multiple']),
    )
  })

  it('reports restrictive visibility conflicts without making them selectable', () => {
    expect(importReport.visibility_conflicts).toHaveLength(2)
    for (const conflict of importReport.visibility_conflicts) {
      expect(conflict.product_visibility).toBe('hidden')
    }
  })

  it('names every required slot without a curated default in the coverage report', () => {
    const procedures = coverageReport.procedures
    const namedRequiredGaps = procedures.flatMap((procedure) =>
      procedure.slotCoverage.filter(
        (slot) => slot.requiredness === 'required' && !slot.hasCuratedDefault,
      ),
    )
    expect(namedRequiredGaps).toHaveLength(
      procedures.reduce(
        (sum, procedure) => sum + procedure.requiredSlotsWithoutDefaultOptions.length,
        0,
      ),
    )
    expect(namedRequiredGaps.every((slot) => Boolean(slot.slotId && slot.roleCode))).toBe(true)
  })

  it('never reports full curated-default coverage while required default gaps remain', () => {
    for (const procedure of coverageReport.procedures) {
      if (procedure.requiredSlotsWithoutDefaultOptions.length > 0) {
        expect(procedure.requiredDefaultOptionCoveragePercentage).toBeLessThan(100)
      }
    }
  })
})
