import { calculateProcedureCoverage } from './coverage-metrics'

function input() {
  return {
    products: [
      { product_id: 'PRD-CANDIDATE', verification_grade: 'candidate' },
      { product_id: 'PRD-VERIFIED', verification_grade: 'verified_source' },
    ],
    productRoles: [
      { product_id: 'PRD-CANDIDATE', role_code: 'ROLE_A' },
      { product_id: 'PRD-VERIFIED', role_code: 'ROLE_B' },
    ],
    procedures: [{ procedure_code: 'PROC' }],
    slots: [
      {
        slot_id: 'SLOT-A',
        procedure_code: 'PROC',
        role_code: 'ROLE_A',
        requiredness: 'required',
        display_order: 1,
        allow_custom: false,
      },
      {
        slot_id: 'SLOT-B',
        procedure_code: 'PROC',
        role_code: 'ROLE_B',
        requiredness: 'required',
        display_order: 2,
        allow_custom: true,
      },
      {
        slot_id: 'SLOT-C',
        procedure_code: 'PROC',
        role_code: 'ROLE_C',
        requiredness: 'required',
        display_order: 3,
        allow_custom: true,
      },
      {
        slot_id: 'SLOT-OPTIONAL',
        procedure_code: 'PROC',
        role_code: 'ROLE_C',
        requiredness: 'optional',
        display_order: 4,
        allow_custom: true,
      },
    ],
    slotProductOptions: [
      { slot_id: 'SLOT-A', selectable: true },
      // A nonselectable canonical row or an unreviewed proposal must not count as a default.
      { slot_id: 'SLOT-B', selectable: false },
    ],
  }
}

describe('procedure coverage metrics', () => {
  it('calculates catalog and curated-default coverage independently', () => {
    const [coverage] = calculateProcedureCoverage(input())

    expect(coverage).toMatchObject({
      procedureCode: 'PROC',
      requiredSlotCount: 3,
      requiredCatalogCoverageCount: 2,
      requiredCatalogCoveragePercentage: 66.7,
      requiredSlotsWithoutCatalogProducts: ['SLOT-C'],
      roleCodesWithoutCatalogProducts: ['ROLE_C'],
      requiredDefaultOptionCoverageCount: 1,
      requiredDefaultOptionCoveragePercentage: 33.3,
      requiredSlotsWithoutDefaultOptions: ['SLOT-B', 'SLOT-C'],
      requiredCustomAllowedCount: 2,
    })
  })

  it('counts candidate/unverified role products toward catalog discovery coverage', () => {
    const [coverage] = calculateProcedureCoverage(input())

    expect(coverage.requiredSlotsWithoutCatalogProducts).not.toContain('SLOT-A')
    expect(coverage.requiredCatalogCoverageCount).toBe(2)
  })

  it('does not count nonselectable or unreviewed rows toward curated defaults', () => {
    const [coverage] = calculateProcedureCoverage(input())

    expect(coverage.requiredSlotsWithoutDefaultOptions).toContain('SLOT-B')
    expect(coverage.requiredDefaultOptionCoveragePercentage).toBeLessThan(100)
  })

  it('ignores Product_Roles links whose product does not exist', () => {
    const value = input()
    value.productRoles.push({ product_id: 'PRD-MISSING', role_code: 'ROLE_C' })

    const [coverage] = calculateProcedureCoverage(value)

    expect(coverage.requiredSlotsWithoutCatalogProducts).toEqual(['SLOT-C'])
  })

  it('is deterministic under input reordering', () => {
    const forward = input()
    const reverse = input()
    reverse.products.reverse()
    reverse.productRoles.reverse()
    reverse.procedures.reverse()
    reverse.slots.reverse()
    reverse.slotProductOptions.reverse()

    expect(calculateProcedureCoverage(reverse)).toEqual(calculateProcedureCoverage(forward))
  })
})
