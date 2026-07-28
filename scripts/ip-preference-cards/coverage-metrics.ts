export interface CoverageProductRow {
  product_id: string
}

export interface CoverageProductRoleRow {
  product_id: string
  role_code: string
}

export interface CoverageProcedureRow {
  procedure_code: string
}

export interface CoverageSlotRow {
  slot_id: string
  procedure_code: string
  role_code: string
  requiredness: string
  display_order?: number
  allow_custom?: boolean
}

export interface CoverageSlotOptionRow {
  slot_id: string
  selectable: boolean | null
}

export interface ProcedureCoverageMetrics {
  procedureCode: string
  requiredSlotCount: number
  requiredCatalogCoverageCount: number
  requiredCatalogCoveragePercentage: number
  requiredSlotsWithoutCatalogProducts: string[]
  roleCodesWithoutCatalogProducts: string[]
  requiredDefaultOptionCoverageCount: number
  requiredDefaultOptionCoveragePercentage: number
  requiredSlotsWithoutDefaultOptions: string[]
  requiredCustomAllowedCount: number
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function percentage(covered: number, total: number): number {
  return total === 0 ? 100 : Math.round((covered / total) * 1000) / 10
}

/**
 * Calculate source-data coverage without making a readiness or approval claim.
 *
 * Catalog coverage uses only existing Product_Roles pairs, including candidate/unverified
 * products. Curated-default coverage uses only selectable canonical Slot_Product_Options.
 * Proposal rows are deliberately not an input.
 */
export function calculateProcedureCoverage(input: {
  products: CoverageProductRow[]
  productRoles: CoverageProductRoleRow[]
  procedures?: CoverageProcedureRow[]
  slots: CoverageSlotRow[]
  slotProductOptions: CoverageSlotOptionRow[]
}): ProcedureCoverageMetrics[] {
  const productIds = new Set(input.products.map((product) => product.product_id))
  const rolesWithCatalogProducts = new Set(
    input.productRoles.flatMap((relationship) =>
      productIds.has(relationship.product_id) ? [relationship.role_code] : [],
    ),
  )
  const slotsWithSelectableDefaults = new Set(
    input.slotProductOptions.flatMap((option) =>
      option.selectable === true ? [option.slot_id] : [],
    ),
  )

  const procedureCodes = new Set(
    (input.procedures ?? []).map((procedure) => procedure.procedure_code),
  )
  for (const slot of input.slots) procedureCodes.add(slot.procedure_code)

  return [...procedureCodes].sort(compareText).map((procedureCode): ProcedureCoverageMetrics => {
    const requiredSlots = input.slots
      .filter((slot) => slot.procedure_code === procedureCode && slot.requiredness === 'required')
      .sort(
        (left, right) =>
          (left.display_order ?? 0) - (right.display_order ?? 0) ||
          compareText(left.slot_id, right.slot_id),
      )
    const requiredSlotsWithoutCatalogProducts = requiredSlots
      .filter((slot) => !rolesWithCatalogProducts.has(slot.role_code))
      .map((slot) => slot.slot_id)
    const requiredSlotsWithoutDefaultOptions = requiredSlots
      .filter((slot) => !slotsWithSelectableDefaults.has(slot.slot_id))
      .map((slot) => slot.slot_id)
    const requiredCatalogCoverageCount =
      requiredSlots.length - requiredSlotsWithoutCatalogProducts.length
    const requiredDefaultOptionCoverageCount =
      requiredSlots.length - requiredSlotsWithoutDefaultOptions.length

    return {
      procedureCode,
      requiredSlotCount: requiredSlots.length,
      requiredCatalogCoverageCount,
      requiredCatalogCoveragePercentage: percentage(
        requiredCatalogCoverageCount,
        requiredSlots.length,
      ),
      requiredSlotsWithoutCatalogProducts,
      roleCodesWithoutCatalogProducts: [
        ...new Set(
          requiredSlots
            .filter((slot) => !rolesWithCatalogProducts.has(slot.role_code))
            .map((slot) => slot.role_code),
        ),
      ].sort(compareText),
      requiredDefaultOptionCoverageCount,
      requiredDefaultOptionCoveragePercentage: percentage(
        requiredDefaultOptionCoverageCount,
        requiredSlots.length,
      ),
      requiredSlotsWithoutDefaultOptions,
      requiredCustomAllowedCount: requiredSlots.filter((slot) => slot.allow_custom === true).length,
    }
  })
}
