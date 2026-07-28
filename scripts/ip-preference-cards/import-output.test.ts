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
      authored_canonical_options: 2080,
      generated_unreviewed_proposals: slotOptionProposals.proposals.length,
      excluded_proposal_pairs: 0,
      required_slots_with_catalog_coverage: 56,
      required_slots_with_curated_defaults: 41,
      authored_row_errors: 0,
      stale_exceptions: 0,
      proposal_generation_errors: 0,
    })
    expect(slotOptionProposals.proposals).toHaveLength(475)
    expect(
      slotOptionProposals.proposals.every(
        (proposal) =>
          proposal.proposal_status === 'unreviewed' &&
          proposal.selectable === false &&
          proposal.visible_by_default === false,
      ),
    ).toBe(true)
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
