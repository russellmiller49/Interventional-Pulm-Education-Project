import {
  canonicalManufacturer,
  type ManufacturerIdentity,
} from '@/features/preference-cards/server/manufacturer-aliases'
import {
  catalogVerificationTier,
  isUsStatusPending,
  type CatalogVerificationTier,
} from '@/features/preference-cards/domain/verification'

/**
 * Pure indexing layer over the generated catalog JSON.
 *
 * Everything here is data-in/data-out so the query layer can be exercised against small
 * fixtures. `catalog.ts` owns the static JSON imports and the process-level singleton.
 */

export interface CatalogProductRecord {
  product_id: string
  manufacturer_id: string | null
  manufacturer: string | null
  distributor: string | null
  brand_family: string | null
  product_name: string
  catalog_number: string | null
  alternate_ids: string | null
  gtin: string | null
  gtin_raw: string | null
  global_part_number: string | null
  reference_part_number: string | null
  primary_category: string | null
  subcategory: string | null
  product_kind: string | null
  reuse_status: string | null
  sterile_status: string | null
  implantable: boolean | null
  material: string | null
  coverage: string | null
  placement_method: string | null
  size_display: string | null
  diameter_mm: number | null
  length_mm: number | null
  french_size: number | null
  gauge: number | null
  working_length_cm: number | null
  min_working_channel_mm: number | null
  delivery_system_od_mm: number | null
  package_uom: string | null
  adult_peds: string | null
  description: string | null
  compatibility_text: string | null
  verification_status: string | null
  live_dropdown_status: string | null
  primary_source_id: string | null
  primary_source_location: string | null
  source_as_of: string | null
  availability_note: string | null
  notes: string | null
  spec_json: Record<string, unknown> | null
  visibility_state: string | null
  verification_grade: string | null
}

export interface RoleRecord {
  role_code: string
  category: string | null
  role_name: string
  description: string | null
  selection_guidance: string | null
  requires_current_ifu: boolean | null
}

export interface ProductRoleRecord {
  product_id: string
  role_code: string
  role_fit: string | null
  notes: string | null
}

export interface ProcedureRecord {
  procedure_code: string
  procedure_name: string
  template_version: string | null
  scope: string | null
  status: string | null
  notes: string | null
}

export interface ProcedureSlotRecord {
  slot_id: string
  procedure_code: string
  section: string | null
  display_order: number
  role_code: string
  slot_label: string
  generic_requirement: string | null
  requiredness: string
  default_qty: number
  selection_mode: string
  allow_custom: boolean
  notes: string | null
}

export interface SlotProductOptionRecord {
  slot_id: string
  product_id: string
  role_code: string
  eligibility_status: string | null
  selectable: boolean | null
  reason?: string | null
  visible_by_default?: boolean | null
  product_visibility?: string | null
}

export interface SourceRecord {
  source_id: string
  title: string
  filename: string | null
  source_type: string | null
  publisher: string | null
  revision_date: string | null
  as_of_date: string | null
  reliability_tier: string | null
  use_policy: string | null
  notes: string | null
}

export interface ProductSourceRecord {
  product_id: string
  source_id: string
  source_location: string | null
  claim_type: string | null
  verification_status: string | null
  notes: string | null
}

export interface ManufacturerRecord {
  manufacturer_id: string
  manufacturer: string
  default_distributor: string | null
  website: string | null
  notes: string | null
}

/** A product plus the derived fields every query and view needs. */
export interface CatalogProduct extends CatalogProductRecord {
  manufacturerGroupId: string
  manufacturerDisplay: string
  verificationTier: CatalogVerificationTier
  usStatusPending: boolean
  /** Lowercased, punctuation-stripped identifiers for exact lookup. */
  searchableIds: string[]
  /**
   * Groups size variants of the same product line. A role such as
   * AIRWAY_STENT_SILICONE_STRAIGHT holds 105 products that are really four families of
   * Dumon stents in many diameters and lengths; the explorer and picker show the family and
   * expand to variants rather than listing every size.
   */
  familyKey: string
  familyName: string
}

export interface CatalogStoreInput {
  products: CatalogProductRecord[]
  roles: RoleRecord[]
  productRoles: ProductRoleRecord[]
  procedures: ProcedureRecord[]
  procedureSlots: ProcedureSlotRecord[]
  slotProductOptions: SlotProductOptionRecord[]
  sources: SourceRecord[]
  productSources: ProductSourceRecord[]
  manufacturers: ManufacturerRecord[]
}

export interface ManufacturerFacet {
  id: string
  displayName: string
  productCount: number
}

export interface CategoryFacet {
  name: string
  productCount: number
  subcategories: { name: string; productCount: number }[]
}

export interface CatalogStore {
  products: CatalogProduct[]
  productById: Map<string, CatalogProduct>
  /** role_code -> product ids, ordered by manufacturer then name. */
  productIdsByRole: Map<string, string[]>
  /** product_id -> its role links. */
  rolesByProduct: Map<string, ProductRoleRecord[]>
  roleByCode: Map<string, RoleRecord>
  roles: RoleRecord[]
  procedures: ProcedureRecord[]
  procedureByCode: Map<string, ProcedureRecord>
  procedureSlots: ProcedureSlotRecord[]
  slotsByProcedure: Map<string, ProcedureSlotRecord[]>
  /** role_code -> procedure codes that request it. */
  procedureCodesByRole: Map<string, string[]>
  /** role_code -> the slots that request it, for "used in" listings. */
  slotsByRole: Map<string, ProcedureSlotRecord[]>
  /** product_id -> the specific procedure slots that list it as an option. */
  slotOptionsByProduct: Map<string, SlotProductOptionRecord[]>
  sourceById: Map<string, SourceRecord>
  sourcesByProduct: Map<string, ProductSourceRecord[]>
  manufacturerFacets: ManufacturerFacet[]
  categoryFacets: CategoryFacet[]
}

/** Normalize an identifier for exact matching: lowercase, strip anything non-alphanumeric. */
export function normalizeIdentifier(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function collectSearchableIds(product: CatalogProductRecord): string[] {
  const raw = [
    product.catalog_number,
    product.gtin,
    product.gtin_raw,
    product.global_part_number,
    product.reference_part_number,
    ...(product.alternate_ids ? product.alternate_ids.split(/[;,]/) : []),
  ]
  const ids = new Set<string>()
  for (const value of raw) {
    if (!value) continue
    const normalized = normalizeIdentifier(String(value))
    if (normalized.length >= 3) ids.add(normalized)
  }
  return [...ids]
}

/** Brand family when the catalog records one, else the subcategory, else the product name. */
export function productFamilyName(record: CatalogProductRecord): string {
  return record.brand_family?.trim() || record.subcategory?.trim() || record.product_name.trim()
}

export function decorateProduct(record: CatalogProductRecord): CatalogProduct {
  const identity: ManufacturerIdentity = canonicalManufacturer(
    record.manufacturer_id,
    record.manufacturer,
  )
  const familyName = productFamilyName(record)
  return {
    ...record,
    manufacturerGroupId: identity.manufacturerGroupId,
    manufacturerDisplay: identity.manufacturerDisplay,
    verificationTier: catalogVerificationTier(record),
    usStatusPending: isUsStatusPending(record),
    searchableIds: collectSearchableIds(record),
    familyName,
    familyKey: [
      identity.manufacturerGroupId,
      familyName.toLowerCase(),
      (record.product_kind ?? '').toLowerCase(),
    ].join('|'),
  }
}

function compareProducts(left: CatalogProduct, right: CatalogProduct): number {
  return (
    left.manufacturerDisplay.localeCompare(right.manufacturerDisplay) ||
    left.product_name.localeCompare(right.product_name) ||
    left.product_id.localeCompare(right.product_id)
  )
}

export function buildCatalogStore(input: CatalogStoreInput): CatalogStore {
  const products = input.products.map(decorateProduct).sort(compareProducts)
  const productById = new Map(products.map((product) => [product.product_id, product]))

  const rolesByProduct = new Map<string, ProductRoleRecord[]>()
  const productIdsByRole = new Map<string, string[]>()
  for (const link of input.productRoles) {
    if (!productById.has(link.product_id)) continue
    const forProduct = rolesByProduct.get(link.product_id)
    if (forProduct) forProduct.push(link)
    else rolesByProduct.set(link.product_id, [link])

    const forRole = productIdsByRole.get(link.role_code)
    if (forRole) forRole.push(link.product_id)
    else productIdsByRole.set(link.role_code, [link.product_id])
  }
  for (const [roleCode, productIds] of productIdsByRole) {
    const unique = [...new Set(productIds)]
    unique.sort((left, right) => {
      const leftProduct = productById.get(left)
      const rightProduct = productById.get(right)
      if (!leftProduct || !rightProduct) return left.localeCompare(right)
      return compareProducts(leftProduct, rightProduct)
    })
    productIdsByRole.set(roleCode, unique)
  }

  const slotsByProcedure = new Map<string, ProcedureSlotRecord[]>()
  const slotsByRole = new Map<string, ProcedureSlotRecord[]>()
  const procedureCodesByRole = new Map<string, Set<string>>()
  for (const slot of input.procedureSlots) {
    const forProcedure = slotsByProcedure.get(slot.procedure_code)
    if (forProcedure) forProcedure.push(slot)
    else slotsByProcedure.set(slot.procedure_code, [slot])

    const forRole = slotsByRole.get(slot.role_code)
    if (forRole) forRole.push(slot)
    else slotsByRole.set(slot.role_code, [slot])

    const procedureCodes = procedureCodesByRole.get(slot.role_code)
    if (procedureCodes) procedureCodes.add(slot.procedure_code)
    else procedureCodesByRole.set(slot.role_code, new Set([slot.procedure_code]))
  }
  for (const slots of slotsByProcedure.values()) {
    slots.sort((left, right) => left.display_order - right.display_order)
  }

  const slotOptionsByProduct = new Map<string, SlotProductOptionRecord[]>()
  for (const option of input.slotProductOptions) {
    if (!productById.has(option.product_id)) continue
    const existing = slotOptionsByProduct.get(option.product_id)
    if (existing) existing.push(option)
    else slotOptionsByProduct.set(option.product_id, [option])
  }

  const sourcesByProduct = new Map<string, ProductSourceRecord[]>()
  for (const link of input.productSources) {
    const existing = sourcesByProduct.get(link.product_id)
    if (existing) existing.push(link)
    else sourcesByProduct.set(link.product_id, [link])
  }

  const manufacturerCounts = new Map<string, ManufacturerFacet>()
  const categoryCounts = new Map<string, Map<string, number>>()
  for (const product of products) {
    const facet = manufacturerCounts.get(product.manufacturerGroupId)
    if (facet) facet.productCount += 1
    else
      manufacturerCounts.set(product.manufacturerGroupId, {
        id: product.manufacturerGroupId,
        displayName: product.manufacturerDisplay,
        productCount: 1,
      })

    const category = product.primary_category ?? 'Uncategorized'
    const subcategory = product.subcategory ?? ''
    const subcategoryCounts = categoryCounts.get(category) ?? new Map<string, number>()
    subcategoryCounts.set(subcategory, (subcategoryCounts.get(subcategory) ?? 0) + 1)
    categoryCounts.set(category, subcategoryCounts)
  }

  const manufacturerFacets = [...manufacturerCounts.values()].sort(
    (left, right) =>
      right.productCount - left.productCount || left.displayName.localeCompare(right.displayName),
  )

  const categoryFacets: CategoryFacet[] = [...categoryCounts.entries()]
    .map(([name, subcategoryCounts]) => ({
      name,
      productCount: [...subcategoryCounts.values()].reduce((total, count) => total + count, 0),
      subcategories: [...subcategoryCounts.entries()]
        .filter(([subcategory]) => subcategory.length > 0)
        .map(([subcategory, productCount]) => ({ name: subcategory, productCount }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

  return {
    products,
    productById,
    productIdsByRole,
    rolesByProduct,
    roleByCode: new Map(input.roles.map((role) => [role.role_code, role])),
    roles: [...input.roles].sort(
      (left, right) =>
        (left.category ?? '').localeCompare(right.category ?? '') ||
        left.role_name.localeCompare(right.role_name),
    ),
    procedures: [...input.procedures].sort((left, right) =>
      left.procedure_name.localeCompare(right.procedure_name),
    ),
    procedureByCode: new Map(
      input.procedures.map((procedure) => [procedure.procedure_code, procedure]),
    ),
    procedureSlots: input.procedureSlots,
    slotsByProcedure,
    procedureCodesByRole: new Map(
      [...procedureCodesByRole.entries()].map(([roleCode, codes]) => [roleCode, [...codes].sort()]),
    ),
    slotsByRole,
    slotOptionsByProduct,
    sourceById: new Map(input.sources.map((source) => [source.source_id, source])),
    sourcesByProduct,
    manufacturerFacets,
    categoryFacets,
  }
}
