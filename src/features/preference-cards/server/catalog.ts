import Fuse from 'fuse.js'

import gudidConfirmationsJson from '../../../../data/ip-preference-cards/generated/gudid-confirmations.json'
import manufacturersJson from '../../../../data/ip-preference-cards/generated/manufacturers.json'
import procedureSlotsJson from '../../../../data/ip-preference-cards/generated/procedure-slots.json'
import proceduresJson from '../../../../data/ip-preference-cards/generated/procedures.json'
import productRolesJson from '../../../../data/ip-preference-cards/generated/product-roles.json'
import productSourcesJson from '../../../../data/ip-preference-cards/generated/product-sources.json'
import productsJson from '../../../../data/ip-preference-cards/generated/catalog-products.json'
import rolesJson from '../../../../data/ip-preference-cards/generated/roles.json'
import slotProductOptionsJson from '../../../../data/ip-preference-cards/generated/slot-product-options.json'
import sourcesJson from '../../../../data/ip-preference-cards/generated/sources.json'
import externalReviewCorrectionsJson from '../../../../data/ip-preference-cards/reviewed/external-review-corrections.json'

import {
  buildCatalogStore,
  normalizeIdentifier,
  type CatalogLifecycleContext,
  type CatalogProduct,
  type CatalogProductRecord,
  type CatalogStore,
  type ManufacturerRecord,
  type ProcedureRecord,
  type ProcedureSlotRecord,
  type ProductRoleRecord,
  type ProductGovernanceRecord,
  type ProductSourceRecord,
  type RoleRecord,
  type SlottingScope,
  type SlotProductOptionRecord,
  type SourceRecord,
} from '@/features/preference-cards/server/catalog-store'
import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import type { CatalogVerificationTier } from '@/features/preference-cards/domain/verification'
import type { CatalogPick } from '@/features/preference-cards/domain/catalog-pick'
import type { FamilyPick, FamilySpecRange } from '@/features/preference-cards/domain/family-pick'

/**
 * Server-only catalog queries.
 *
 * The generated JSON is statically imported so it ships inside the standalone build; the
 * store and the Fuse index are built lazily once per server process. Only page-sized,
 * trimmed rows ever cross to the client — the 1,221-product array never does.
 */

export type CatalogDistributionStatus = 'in_distribution' | 'not_in_distribution' | 'conflicting'

export interface GudidDistributionConfirmation {
  product_id: string
  match_strength: string
  gudid_distribution_status: string
}

function normalizedDistributionStatus(
  value: string,
): Exclude<CatalogDistributionStatus, 'conflicting'> | null {
  if (/^In Commercial Distribution$/i.test(value.trim())) return 'in_distribution'
  if (/^Not in Commercial Distribution$/i.test(value.trim())) return 'not_in_distribution'
  return null
}

/**
 * FDA GUDID distribution evidence per product, from strong manufacturer-and-catalog matches.
 *
 * Package rows can disagree. A conflict remains a conflict instead of being collapsed to
 * whichever row happens to say "in distribution." Weak matches never contribute. This map is
 * distribution evidence only: it does not derive lifecycle, visibility, or orderability.
 */
export function buildDistributionMap(
  confirmations: readonly GudidDistributionConfirmation[],
): Map<string, CatalogDistributionStatus> {
  const statuses = new Map<
    string,
    {
      recognized: Set<Exclude<CatalogDistributionStatus, 'conflicting'>>
      hasUnrecognized: boolean
    }
  >()
  for (const row of confirmations) {
    if (row.match_strength !== 'manufacturer_and_catalog_number') continue
    const status = normalizedDistributionStatus(row.gudid_distribution_status)
    const existing = statuses.get(row.product_id) ?? {
      recognized: new Set<Exclude<CatalogDistributionStatus, 'conflicting'>>(),
      hasUnrecognized: false,
    }
    if (status) existing.recognized.add(status)
    else existing.hasUnrecognized = true
    statuses.set(row.product_id, existing)
  }
  const result = new Map<string, CatalogDistributionStatus>()
  for (const [productId, value] of statuses) {
    if (value.recognized.size > 1 || (value.recognized.size > 0 && value.hasUnrecognized)) {
      result.set(productId, 'conflicting')
      continue
    }
    const status = value.recognized.values().next().value
    if (status) result.set(productId, status)
  }
  return result
}

const gudidReport = gudidConfirmationsJson as unknown as {
  confirmations: GudidDistributionConfirmation[]
}

let cachedDistribution: Map<string, CatalogDistributionStatus> | null = null

function getDistributionMap() {
  if (!cachedDistribution) cachedDistribution = buildDistributionMap(gudidReport.confirmations)
  return cachedDistribution
}

let cachedStore: CatalogStore | null = null
let cachedFuse: Fuse<CatalogProduct> | null = null

export function getCatalogStore(): CatalogStore {
  if (!cachedStore) {
    cachedStore = buildCatalogStore({
      products: productsJson as unknown as CatalogProductRecord[],
      productGovernance: (
        externalReviewCorrectionsJson as unknown as {
          productGovernance: ProductGovernanceRecord[]
        }
      ).productGovernance,
      roles: rolesJson as unknown as RoleRecord[],
      productRoles: productRolesJson as unknown as ProductRoleRecord[],
      procedures: proceduresJson as unknown as ProcedureRecord[],
      procedureSlots: procedureSlotsJson as unknown as ProcedureSlotRecord[],
      slotProductOptions: slotProductOptionsJson as unknown as SlotProductOptionRecord[],
      sources: sourcesJson as unknown as SourceRecord[],
      productSources: productSourcesJson as unknown as ProductSourceRecord[],
      manufacturers: manufacturersJson as unknown as ManufacturerRecord[],
    })
  }
  return cachedStore
}

function getFuse(store: CatalogStore): Fuse<CatalogProduct> {
  if (!cachedFuse) {
    cachedFuse = new Fuse(store.products, {
      keys: [
        { name: 'product_name', weight: 0.35 },
        { name: 'brand_family', weight: 0.2 },
        { name: 'manufacturerDisplay', weight: 0.15 },
        { name: 'catalog_number', weight: 0.1 },
        { name: 'description', weight: 0.1 },
        { name: 'subcategory', weight: 0.05 },
        { name: 'primary_category', weight: 0.05 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
    })
  }
  return cachedFuse
}

/** Spec fields worth comparing, in the order they should appear as columns. */
export const specColumnPriority = [
  'diameter_mm',
  'length_mm',
  'french_size',
  'gauge',
  'working_length_cm',
  'min_working_channel_mm',
  'delivery_system_od_mm',
  'material',
  'coverage',
] as const

export type SpecColumnKey = (typeof specColumnPriority)[number]

export interface CatalogListItem {
  productId: string
  productName: string
  manufacturerDisplay: string
  manufacturerGroupId: string
  brandFamily: string | null
  catalogNumber: string | null
  gtin: string | null
  primaryCategory: string | null
  subcategory: string | null
  sizeDisplay: string | null
  diameterMm: number | null
  lengthMm: number | null
  frenchSize: number | null
  gauge: number | null
  workingLengthCm: number | null
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  material: string | null
  coverage: string | null
  verificationTier: CatalogVerificationTier
  usStatusPending: boolean
  /** FDA GUDID commercial-distribution status, when a confident match exists. */
  distributionStatus: CatalogDistributionStatus | null
  catalogLifecycleContext: CatalogLifecycleContext
  slottingScope: SlottingScope
  preferredNewPurchase: boolean | null
  lifecycleNote: string | null
  roleFit?: string | null
}

function toListItem(product: CatalogProduct): CatalogListItem {
  return {
    productId: product.product_id,
    productName: product.product_name,
    manufacturerDisplay: product.manufacturerDisplay,
    manufacturerGroupId: product.manufacturerGroupId,
    brandFamily: product.brand_family,
    catalogNumber: product.catalog_number,
    gtin: product.gtin,
    primaryCategory: product.primary_category,
    subcategory: product.subcategory,
    sizeDisplay: product.size_display,
    diameterMm: product.diameter_mm,
    lengthMm: product.length_mm,
    frenchSize: product.french_size,
    gauge: product.gauge,
    workingLengthCm: product.working_length_cm,
    minWorkingChannelMm: product.min_working_channel_mm,
    deliverySystemOdMm: product.delivery_system_od_mm,
    material: product.material,
    coverage: product.coverage,
    verificationTier: product.verificationTier,
    usStatusPending: product.usStatusPending,
    distributionStatus: getDistributionMap().get(product.product_id) ?? null,
    catalogLifecycleContext: product.catalogLifecycleContext,
    slottingScope: product.slottingScope,
    preferredNewPurchase: product.preferredNewPurchase,
    lifecycleNote: product.lifecycleNote,
  }
}

export function specValue(item: CatalogListItem, key: SpecColumnKey): string | number | null {
  switch (key) {
    case 'diameter_mm':
      return item.diameterMm
    case 'length_mm':
      return item.lengthMm
    case 'french_size':
      return item.frenchSize
    case 'gauge':
      return item.gauge
    case 'working_length_cm':
      return item.workingLengthCm
    case 'min_working_channel_mm':
      return item.minWorkingChannelMm
    case 'delivery_system_od_mm':
      return item.deliverySystemOdMm
    case 'material':
      return item.material
    case 'coverage':
      return item.coverage
    default:
      return null
  }
}

/** Include a spec column only when at least one product in the set actually has it. */
export function activeSpecColumns(items: CatalogListItem[]): SpecColumnKey[] {
  return specColumnPriority.filter((key) =>
    items.some((item) => {
      const value = specValue(item, key)
      return value !== null && value !== undefined && value !== ''
    }),
  )
}

function matchesTier(product: CatalogProduct, tier: CatalogSearchQuery['tier']): boolean {
  if (tier === 'all') return true
  if (tier === 'verified') return product.verificationTier === 'verified'
  return product.verificationTier !== 'verified'
}

interface SpecFilterOutcome {
  keep: boolean
  /** True when the product was dropped only because the spec is not cataloged for it. */
  excludedForMissingSpec: boolean
}

function applySpecFilters(product: CatalogProduct, query: CatalogSearchQuery): SpecFilterOutcome {
  let excludedForMissingSpec = false

  const rangeChecks: { min?: number; max?: number; value: number | null }[] = [
    { min: query.diameterMin, max: query.diameterMax, value: product.diameter_mm },
    { min: query.lengthMin, max: query.lengthMax, value: product.length_mm },
  ]
  for (const check of rangeChecks) {
    if (check.min === undefined && check.max === undefined) continue
    if (check.value === null || check.value === undefined) {
      excludedForMissingSpec = true
      continue
    }
    if (check.min !== undefined && check.value < check.min)
      return { keep: false, excludedForMissingSpec: false }
    if (check.max !== undefined && check.value > check.max)
      return { keep: false, excludedForMissingSpec: false }
  }

  if (query.channelMax !== undefined) {
    if (product.min_working_channel_mm === null || product.min_working_channel_mm === undefined) {
      excludedForMissingSpec = true
    } else if (product.min_working_channel_mm > query.channelMax) {
      return { keep: false, excludedForMissingSpec: false }
    }
  }

  return { keep: !excludedForMissingSpec, excludedForMissingSpec }
}

export interface CatalogSearchResponse {
  items: CatalogListItem[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  /**
   * Products dropped *only* because a spec-range filter was applied and that spec is
   * not recorded for them. Surfaced in the UI so a thin data field never silently
   * looks like an empty shelf.
   */
  excludedMissingSpecCount: number
}

export function searchCatalog(
  query: CatalogSearchQuery,
  store: CatalogStore = getCatalogStore(),
): CatalogSearchResponse {
  let candidates: CatalogProduct[]

  const trimmedQuery = query.q.trim()
  if (trimmedQuery.length > 0) {
    const normalized = normalizeIdentifier(trimmedQuery)
    const exactMatches: CatalogProduct[] = []
    const exactMatchIds = new Set<string>()
    if (normalized.length >= 3) {
      for (const product of store.products) {
        if (product.searchableIds.some((id) => id === normalized || id.startsWith(normalized))) {
          exactMatches.push(product)
          exactMatchIds.add(product.product_id)
        }
      }
    }
    const fuzzy = getFuse(store)
      .search(trimmedQuery)
      .map((result) => result.item)
      .filter((product) => !exactMatchIds.has(product.product_id))
    candidates = [...exactMatches, ...fuzzy]
  } else {
    candidates = store.products
  }

  const roleProductIds = query.role ? new Set(store.productIdsByRole.get(query.role) ?? []) : null
  const procedureRoleCodes = query.procedure
    ? new Set((store.slotsByProcedure.get(query.procedure) ?? []).map((slot) => slot.role_code))
    : null
  const manufacturerFilter = query.manufacturers.length > 0 ? new Set(query.manufacturers) : null

  const filtered: CatalogProduct[] = []
  let excludedMissingSpecCount = 0

  for (const product of candidates) {
    if (manufacturerFilter && !manufacturerFilter.has(product.manufacturerGroupId)) continue
    if (query.category && product.primary_category !== query.category) continue
    if (query.subcategory && product.subcategory !== query.subcategory) continue
    if (roleProductIds && !roleProductIds.has(product.product_id)) continue
    if (procedureRoleCodes) {
      const productRoles = store.rolesByProduct.get(product.product_id) ?? []
      if (!productRoles.some((link) => procedureRoleCodes.has(link.role_code))) continue
    }
    if (!matchesTier(product, query.tier)) continue

    const specOutcome = applySpecFilters(product, query)
    if (!specOutcome.keep) {
      if (specOutcome.excludedForMissingSpec) excludedMissingSpecCount += 1
      continue
    }
    filtered.push(product)
  }

  const sorted = sortProducts(filtered, query.sort, trimmedQuery.length > 0)
  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize))
  const page = Math.min(query.page, pageCount)
  const start = (page - 1) * query.pageSize

  return {
    items: sorted.slice(start, start + query.pageSize).map(toListItem),
    total,
    page,
    pageSize: query.pageSize,
    pageCount,
    excludedMissingSpecCount,
  }
}

function sortProducts(
  products: CatalogProduct[],
  sort: CatalogSearchQuery['sort'],
  hasQuery: boolean,
): CatalogProduct[] {
  if (sort === 'relevance') {
    // Fuse already ordered the candidates; without a query there is nothing to rank by,
    // so fall back to the store's stable manufacturer/name ordering.
    return hasQuery ? products : [...products]
  }
  const sorted = [...products]
  const byNumber = (value: number | null) =>
    value === null || value === undefined ? Infinity : value
  switch (sort) {
    case 'name':
      sorted.sort((left, right) => left.product_name.localeCompare(right.product_name))
      break
    case 'manufacturer':
      sorted.sort(
        (left, right) =>
          left.manufacturerDisplay.localeCompare(right.manufacturerDisplay) ||
          left.product_name.localeCompare(right.product_name),
      )
      break
    case 'diameter':
      sorted.sort(
        (left, right) =>
          byNumber(left.diameter_mm) - byNumber(right.diameter_mm) ||
          left.product_name.localeCompare(right.product_name),
      )
      break
    case 'length':
      sorted.sort(
        (left, right) =>
          byNumber(left.length_mm) - byNumber(right.length_mm) ||
          left.product_name.localeCompare(right.product_name),
      )
      break
  }
  return sorted
}

export interface UseIndexEntry {
  roleCode: string
  roleName: string
  category: string
  description: string | null
  productCount: number
  verifiedCount: number
  manufacturerCount: number
  /** Present only when the index is scoped to a procedure. */
  slotLabel?: string
  requiredness?: string
  displayOrder?: number
}

export interface UseIndexGroup {
  category: string
  entries: UseIndexEntry[]
}

export function getUseIndex(
  options: { procedureCode?: string } = {},
  store: CatalogStore = getCatalogStore(),
): UseIndexGroup[] {
  const scopedSlots = options.procedureCode
    ? (store.slotsByProcedure.get(options.procedureCode) ?? [])
    : null
  const slotByRole = new Map<string, ProcedureSlotRecord>()
  if (scopedSlots) {
    for (const slot of scopedSlots) {
      if (!slotByRole.has(slot.role_code)) slotByRole.set(slot.role_code, slot)
    }
  }

  const roles = scopedSlots
    ? [...slotByRole.keys()]
        .map((roleCode) => store.roleByCode.get(roleCode))
        .filter((role): role is RoleRecord => Boolean(role))
    : store.roles

  const entries: UseIndexEntry[] = roles.map((role) => {
    const productIds = store.productIdsByRole.get(role.role_code) ?? []
    const manufacturers = new Set<string>()
    let verifiedCount = 0
    for (const productId of productIds) {
      const product = store.productById.get(productId)
      if (!product) continue
      manufacturers.add(product.manufacturerGroupId)
      if (product.verificationTier === 'verified') verifiedCount += 1
    }
    const slot = slotByRole.get(role.role_code)
    return {
      roleCode: role.role_code,
      roleName: role.role_name,
      category: role.category ?? 'Other',
      description: role.description,
      productCount: productIds.length,
      verifiedCount,
      manufacturerCount: manufacturers.size,
      ...(slot
        ? {
            slotLabel: slot.slot_label,
            requiredness: slot.requiredness,
            displayOrder: slot.display_order,
          }
        : {}),
    }
  })

  if (scopedSlots) {
    entries.sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    return [{ category: 'procedure', entries }]
  }

  const grouped = new Map<string, UseIndexEntry[]>()
  for (const entry of entries) {
    const existing = grouped.get(entry.category)
    if (existing) existing.push(entry)
    else grouped.set(entry.category, [entry])
  }
  return [...grouped.entries()]
    .map(([category, groupEntries]) => ({
      category,
      entries: groupEntries.sort((left, right) => left.roleName.localeCompare(right.roleName)),
    }))
    .sort((left, right) => left.category.localeCompare(right.category))
}

export interface UseDetailProcedureLink {
  procedureCode: string
  procedureName: string
  slotLabel: string
  requiredness: string
}

export interface SpecRange {
  key: SpecColumnKey
  min: number
  max: number
}

export interface ProductFamily {
  familyKey: string
  familyName: string
  manufacturerGroupId: string
  manufacturerDisplay: string
  variants: CatalogListItem[]
  verifiedCount: number
  /** Numeric spec ranges across the variants, for the collapsed summary line. */
  specRanges: SpecRange[]
  /** Distinct non-numeric distinguishers, e.g. straight vs right angle. */
  placementMethods: string[]
  /**
   * Family-level evidence is shown only when every variant agrees. A signal from one package
   * or model must never be presented as a conclusion about its siblings.
   */
  distributionStatus: CatalogDistributionStatus | null
  catalogLifecycleContext: CatalogLifecycleContext | null
}

export interface UseDetailManufacturerGroup {
  manufacturerGroupId: string
  manufacturerDisplay: string
  verifiedCount: number
  items: CatalogListItem[]
}

export interface UseDetail {
  role: RoleRecord
  totalProducts: number
  verifiedCount: number
  manufacturerGroups: UseDetailManufacturerGroup[]
  specColumns: SpecColumnKey[]
  procedures: UseDetailProcedureLink[]
  /** Variants collapsed into product lines; the default view for a crowded role. */
  families: ProductFamily[]
}

const NUMERIC_SPEC_KEYS: SpecColumnKey[] = [
  'diameter_mm',
  'length_mm',
  'french_size',
  'gauge',
  'working_length_cm',
  'min_working_channel_mm',
  'delivery_system_od_mm',
]

function unanimousFamilyValue<T>(values: readonly (T | null)[]): T | null {
  if (values.length === 0 || values[0] === null) return null
  const first = values[0]
  return values.every((value) => value === first) ? first : null
}

/** Collapse size variants of the same product line into families. */
export function buildProductFamilies(
  items: CatalogListItem[],
  store: CatalogStore,
): ProductFamily[] {
  const groups = new Map<string, CatalogListItem[]>()
  for (const item of items) {
    const product = store.productById.get(item.productId)
    if (!product) continue
    const existing = groups.get(product.familyKey)
    if (existing) existing.push(item)
    else groups.set(product.familyKey, [item])
  }

  const families: ProductFamily[] = []
  for (const [familyKey, variants] of groups) {
    const first = store.productById.get(variants[0].productId)!
    const specRanges: SpecRange[] = []
    for (const key of NUMERIC_SPEC_KEYS) {
      const values = variants
        .map((variant) => specValue(variant, key))
        .filter((value): value is number => typeof value === 'number')
      if (values.length === 0) continue
      specRanges.push({ key, min: Math.min(...values), max: Math.max(...values) })
    }
    families.push({
      familyKey,
      familyName: first.familyName,
      manufacturerGroupId: first.manufacturerGroupId,
      manufacturerDisplay: first.manufacturerDisplay,
      variants: variants.sort(
        (left, right) =>
          ((specValue(left, 'diameter_mm') as number) ?? 0) -
            ((specValue(right, 'diameter_mm') as number) ?? 0) ||
          ((specValue(left, 'french_size') as number) ?? 0) -
            ((specValue(right, 'french_size') as number) ?? 0) ||
          left.productName.localeCompare(right.productName),
      ),
      verifiedCount: variants.filter((variant) => variant.verificationTier === 'verified').length,
      specRanges,
      placementMethods: [
        ...new Set(
          variants
            .map((variant) => store.productById.get(variant.productId)?.placement_method)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
      distributionStatus: unanimousFamilyValue(
        variants.map((variant) => variant.distributionStatus),
      ),
      catalogLifecycleContext: unanimousFamilyValue(
        variants.map((variant) => variant.catalogLifecycleContext),
      ),
    })
  }

  return families.sort(
    (left, right) =>
      left.manufacturerDisplay.localeCompare(right.manufacturerDisplay) ||
      right.variants.length - left.variants.length ||
      left.familyName.localeCompare(right.familyName),
  )
}

export function getUseDetail(
  roleCode: string,
  store: CatalogStore = getCatalogStore(),
): UseDetail | null {
  const role = store.roleByCode.get(roleCode)
  if (!role) return null

  const roleFitByProduct = new Map<string, string | null>()
  const productIds = store.productIdsByRole.get(roleCode) ?? []
  for (const productId of productIds) {
    const link = (store.rolesByProduct.get(productId) ?? []).find(
      (candidate) => candidate.role_code === roleCode,
    )
    roleFitByProduct.set(productId, link?.role_fit ?? null)
  }

  const items: CatalogListItem[] = []
  for (const productId of productIds) {
    const product = store.productById.get(productId)
    if (!product) continue
    items.push({ ...toListItem(product), roleFit: roleFitByProduct.get(productId) ?? null })
  }

  const groups = new Map<string, UseDetailManufacturerGroup>()
  for (const item of items) {
    const group = groups.get(item.manufacturerGroupId)
    if (group) {
      group.items.push(item)
      if (item.verificationTier === 'verified') group.verifiedCount += 1
    } else {
      groups.set(item.manufacturerGroupId, {
        manufacturerGroupId: item.manufacturerGroupId,
        manufacturerDisplay: item.manufacturerDisplay,
        verifiedCount: item.verificationTier === 'verified' ? 1 : 0,
        items: [item],
      })
    }
  }

  const procedures: UseDetailProcedureLink[] = []
  const seenProcedures = new Set<string>()
  for (const slot of store.slotsByRole.get(roleCode) ?? []) {
    if (seenProcedures.has(slot.procedure_code)) continue
    seenProcedures.add(slot.procedure_code)
    const procedure = store.procedureByCode.get(slot.procedure_code)
    procedures.push({
      procedureCode: slot.procedure_code,
      procedureName: procedure?.procedure_name ?? slot.procedure_code,
      slotLabel: slot.slot_label,
      requiredness: slot.requiredness,
    })
  }

  return {
    role,
    totalProducts: items.length,
    verifiedCount: items.filter((item) => item.verificationTier === 'verified').length,
    manufacturerGroups: [...groups.values()].sort(
      (left, right) =>
        right.items.length - left.items.length ||
        left.manufacturerDisplay.localeCompare(right.manufacturerDisplay),
    ),
    specColumns: activeSpecColumns(items),
    procedures: procedures.sort((left, right) =>
      left.procedureName.localeCompare(right.procedureName),
    ),
    families: buildProductFamilies(items, store),
  }
}

export interface ProductSourceDetail {
  sourceId: string
  title: string
  filename: string | null
  publisher: string | null
  sourceType: string | null
  reliabilityTier: string | null
  claimType: string | null
  sourceLocation: string | null
  revisionDate: string | null
  asOfDate: string | null
  verificationStatus: string | null
  usePolicy: string | null
  sourceNotes: string | null
  linkNotes: string | null
}

export interface ProductRoleDetail {
  roleCode: string
  roleName: string
  roleFit: string | null
  notes: string | null
}

export interface ProductSlotDetail {
  slotId: string
  procedureCode: string
  procedureName: string
  slotLabel: string
  requiredness: string
  eligibilityStatus: string | null
  selectable: boolean | null
}

export interface ProductDetail {
  product: CatalogProduct
  distributionStatus: CatalogDistributionStatus | null
  roles: ProductRoleDetail[]
  slots: ProductSlotDetail[]
  sources: ProductSourceDetail[]
  otherManufacturers: CatalogListItem[]
}

export function getProductDetail(
  productId: string,
  store: CatalogStore = getCatalogStore(),
): ProductDetail | null {
  const product = store.productById.get(productId)
  if (!product) return null

  const roleLinks = store.rolesByProduct.get(productId) ?? []
  const roles: ProductRoleDetail[] = roleLinks.map((link) => ({
    roleCode: link.role_code,
    roleName: store.roleByCode.get(link.role_code)?.role_name ?? link.role_code,
    roleFit: link.role_fit,
    notes: link.notes,
  }))

  const slots: ProductSlotDetail[] = []
  const seenSlots = new Set<string>()
  for (const option of store.slotOptionsByProduct.get(productId) ?? []) {
    if (seenSlots.has(option.slot_id)) continue
    seenSlots.add(option.slot_id)
    const slot = store.procedureSlots.find((candidate) => candidate.slot_id === option.slot_id)
    if (!slot) continue
    slots.push({
      slotId: slot.slot_id,
      procedureCode: slot.procedure_code,
      procedureName:
        store.procedureByCode.get(slot.procedure_code)?.procedure_name ?? slot.procedure_code,
      slotLabel: slot.slot_label,
      requiredness: slot.requiredness,
      eligibilityStatus: option.eligibility_status,
      selectable: option.selectable,
    })
  }

  const sources: ProductSourceDetail[] = (store.sourcesByProduct.get(productId) ?? []).map(
    (link) => {
      const source = store.sourceById.get(link.source_id)
      return {
        sourceId: link.source_id,
        title: source?.title ?? link.source_id,
        filename: source?.filename ?? null,
        publisher: source?.publisher ?? null,
        sourceType: source?.source_type ?? null,
        reliabilityTier: source?.reliability_tier ?? null,
        claimType: link.claim_type,
        sourceLocation: link.source_location,
        revisionDate: source?.revision_date ?? null,
        asOfDate: source?.as_of_date ?? null,
        verificationStatus: link.verification_status,
        usePolicy: source?.use_policy ?? null,
        sourceNotes: source?.notes ?? null,
        linkNotes: link.notes,
      }
    },
  )

  // Cross-manufacturer discovery: same primary use, different vendor.
  const primaryRole = roleLinks.find((link) => link.role_fit === 'Primary') ?? roleLinks[0]
  const otherManufacturers: CatalogListItem[] = []
  if (primaryRole) {
    const seenGroups = new Set<string>([product.manufacturerGroupId])
    for (const candidateId of store.productIdsByRole.get(primaryRole.role_code) ?? []) {
      if (otherManufacturers.length >= 6) break
      const candidate = store.productById.get(candidateId)
      if (!candidate || seenGroups.has(candidate.manufacturerGroupId)) continue
      seenGroups.add(candidate.manufacturerGroupId)
      otherManufacturers.push(toListItem(candidate))
    }
  }

  return {
    product,
    distributionStatus: getDistributionMap().get(productId) ?? null,
    roles,
    slots,
    sources,
    otherManufacturers,
  }
}

export interface RolePickerOption {
  productId: string
  manufacturerDisplay: string
  productName: string
  catalogNumber: string | null
  gtin: string | null
  sizeDisplay: string | null
  subcategory: string | null
  verificationTier: CatalogVerificationTier
  usStatusPending: boolean
  distributionStatus: CatalogDistributionStatus | null
  catalogLifecycleContext: CatalogLifecycleContext
  slottingScope: SlottingScope
  preferredNewPurchase: boolean | null
  lifecycleNote: string | null
  roleFit: string | null
  minWorkingChannelMm: number | null
  deliverySystemOdMm: number | null
  sourceId: string | null
  sourceLocation: string | null
}

/** Role-scoped product ordering shared by the flat and family-grouped pickers. */
function orderedRoleProducts(
  params: { roleCode: string; q?: string },
  store: CatalogStore,
): CatalogProduct[] {
  const productIds = store.productIdsByRole.get(params.roleCode) ?? []
  if (productIds.length === 0) return []

  const trimmed = (params.q ?? '').trim()
  if (trimmed.length === 0) {
    return productIds
      .map((productId) => store.productById.get(productId))
      .filter((product): product is CatalogProduct => Boolean(product))
  }

  const roleProductIds = new Set(productIds)
  const normalized = normalizeIdentifier(trimmed)
  const exact: CatalogProduct[] = []
  const exactIds = new Set<string>()
  if (normalized.length >= 3) {
    for (const productId of productIds) {
      const product = store.productById.get(productId)
      if (!product) continue
      if (product.searchableIds.some((id) => id === normalized || id.startsWith(normalized))) {
        exact.push(product)
        exactIds.add(product.product_id)
      }
    }
  }
  const fuzzy = getFuse(store)
    .search(trimmed)
    .map((result) => result.item)
    .filter(
      (product) => roleProductIds.has(product.product_id) && !exactIds.has(product.product_id),
    )
  return [...exact, ...fuzzy]
}

function toRolePickerOption(
  product: CatalogProduct,
  roleCode: string,
  store: CatalogStore,
): RolePickerOption {
  const link = (store.rolesByProduct.get(product.product_id) ?? []).find(
    (candidate) => candidate.role_code === roleCode,
  )
  return {
    productId: product.product_id,
    manufacturerDisplay: product.manufacturerDisplay,
    productName: product.product_name,
    catalogNumber: product.catalog_number,
    gtin: product.gtin,
    sizeDisplay: product.size_display,
    subcategory: product.subcategory,
    verificationTier: product.verificationTier,
    usStatusPending: product.usStatusPending,
    distributionStatus: getDistributionMap().get(product.product_id) ?? null,
    catalogLifecycleContext: product.catalogLifecycleContext,
    slottingScope: product.slottingScope,
    preferredNewPurchase: product.preferredNewPurchase,
    lifecycleNote: product.lifecycleNote,
    roleFit: link?.role_fit ?? null,
    minWorkingChannelMm: product.min_working_channel_mm,
    deliverySystemOdMm: product.delivery_system_od_mm,
    sourceId: product.primary_source_id,
    sourceLocation: product.primary_source_location,
  }
}

/**
 * Role-scoped product search backing the preference-card wizard picker.
 * Includes unverified products — they are badged, not withheld.
 */
export function searchProductsForRole(
  params: { roleCode: string; q?: string; limit?: number },
  store: CatalogStore = getCatalogStore(),
): RolePickerOption[] {
  const limit = params.limit ?? 30
  return orderedRoleProducts(params, store)
    .slice(0, limit)
    .map((product) => toRolePickerOption(product, params.roleCode, store))
}

const NUMERIC_SPEC_ACCESSORS: { key: SpecColumnKey; read: (p: CatalogProduct) => number | null }[] =
  [
    { key: 'diameter_mm', read: (product) => product.diameter_mm },
    { key: 'length_mm', read: (product) => product.length_mm },
    { key: 'french_size', read: (product) => product.french_size },
    { key: 'gauge', read: (product) => product.gauge },
    { key: 'working_length_cm', read: (product) => product.working_length_cm },
    { key: 'min_working_channel_mm', read: (product) => product.min_working_channel_mm },
    { key: 'delivery_system_od_mm', read: (product) => product.delivery_system_od_mm },
  ]

function familySpecRanges(products: CatalogProduct[]): FamilySpecRange[] {
  const ranges: FamilySpecRange[] = []
  for (const accessor of NUMERIC_SPEC_ACCESSORS) {
    const values = products
      .map(accessor.read)
      .filter((value): value is number => typeof value === 'number')
    if (values.length === 0) continue
    ranges.push({ key: accessor.key, min: Math.min(...values), max: Math.max(...values) })
  }
  return ranges
}

export interface RoleFamilyOption {
  familyKey: string
  familyName: string
  manufacturerDisplay: string
  manufacturerGroupId: string
  variantCount: number
  verifiedCount: number
  /** The weakest variant's tier: a line is only as confirmed as its least-confirmed size. */
  verificationTier: CatalogVerificationTier
  usStatusPending: boolean
  /** Present only when every variant has the same product-level distribution evidence. */
  distributionStatus: CatalogDistributionStatus | null
  /** Present only when every variant has the same reviewed lifecycle context. */
  catalogLifecycleContext: CatalogLifecycleContext | null
  specRanges: FamilySpecRange[]
  placementMethods: string[]
  sourceId: string | null
  sourceLocation: string | null
  /** Every size in the line, so choosing line → size needs no second request. */
  variants: RolePickerOption[]
}

/**
 * The same role-scoped search, collapsed into product lines.
 *
 * A flat list is unusable for a crowded role — silicone straight stents alone hold 105
 * products that are really four Dumon families in many diameters and lengths. Variants ride
 * along on each family so the picker can drill from line to size without a second request;
 * the largest role in the catalog today is 142 products, so the payload stays small.
 */
export function searchProductFamiliesForRole(
  params: { roleCode: string; q?: string; limit?: number },
  store: CatalogStore = getCatalogStore(),
): RoleFamilyOption[] {
  const limit = params.limit ?? 40
  const ordered = orderedRoleProducts(params, store)
  if (ordered.length === 0) return []

  // Insertion order follows the search ranking, so the best-matching line stays first.
  const grouped = new Map<string, CatalogProduct[]>()
  for (const product of ordered) {
    const existing = grouped.get(product.familyKey)
    if (existing) existing.push(product)
    else grouped.set(product.familyKey, [product])
  }

  // A text query can match only one model in a larger line. Summarize governance and
  // distribution across the complete role-scoped family, never just the matching subset.
  const completeFamilies = new Map<string, CatalogProduct[]>()
  for (const productId of store.productIdsByRole.get(params.roleCode) ?? []) {
    const product = store.productById.get(productId)
    if (!product) continue
    const existing = completeFamilies.get(product.familyKey)
    if (existing) existing.push(product)
    else completeFamilies.set(product.familyKey, [product])
  }

  const distribution = getDistributionMap()
  const families: RoleFamilyOption[] = []
  for (const [familyKey, variants] of grouped) {
    if (families.length >= limit) break
    const first = variants[0]
    const completeFamily = completeFamilies.get(familyKey) ?? variants
    const sorted = [...variants].sort(
      (left, right) =>
        (left.diameter_mm ?? 0) - (right.diameter_mm ?? 0) ||
        (left.length_mm ?? 0) - (right.length_mm ?? 0) ||
        (left.french_size ?? 0) - (right.french_size ?? 0) ||
        left.product_name.localeCompare(right.product_name),
    )
    families.push({
      familyKey,
      familyName: first.familyName,
      manufacturerDisplay: first.manufacturerDisplay,
      manufacturerGroupId: first.manufacturerGroupId,
      variantCount: variants.length,
      verifiedCount: variants.filter((variant) => variant.verificationTier === 'verified').length,
      verificationTier: variants.every((variant) => variant.verificationTier === 'verified')
        ? 'verified'
        : 'candidate',
      usStatusPending: variants.some((variant) => variant.usStatusPending),
      distributionStatus: unanimousFamilyValue(
        completeFamily.map((variant) => distribution.get(variant.product_id) ?? null),
      ),
      catalogLifecycleContext: unanimousFamilyValue(
        completeFamily.map((variant) => variant.catalogLifecycleContext),
      ),
      specRanges: familySpecRanges(variants),
      placementMethods: [
        ...new Set(
          variants
            .map((variant) => variant.placement_method)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
      sourceId: first.primary_source_id,
      sourceLocation: first.primary_source_location,
      variants: sorted.map((variant) => toRolePickerOption(variant, params.roleCode, store)),
    })
  }
  return families
}

/**
 * Rebuild a family pick from its key alone, the family-level twin of {@link getCatalogPick}.
 * The wizard sends only the key on save, so the line's identity always comes from the
 * catalog. Scoped to the role so a family that does not serve the requirement cannot be
 * attached to it.
 */
export function getFamilyPick(
  familyKey: string,
  roleCode: string,
  store: CatalogStore = getCatalogStore(),
): FamilyPick | null {
  const variants = (store.productIdsByRole.get(roleCode) ?? [])
    .map((productId) => store.productById.get(productId))
    .filter((product): product is CatalogProduct => Boolean(product))
    .filter((product) => product.familyKey === familyKey)
  if (variants.length === 0) return null

  const first = variants[0]
  return {
    familyKey,
    roleCode,
    familyName: first.familyName,
    manufacturerDisplay: first.manufacturerDisplay,
    variantCount: variants.length,
    specRanges: familySpecRanges(variants),
    verificationTier: variants.every((variant) => variant.verificationTier === 'verified')
      ? 'verified'
      : 'candidate',
    usStatusPending: variants.some((variant) => variant.usStatusPending),
    sourceId: first.primary_source_id,
    sourceLocation: first.primary_source_location,
  }
}

export interface CatalogFacets {
  manufacturers: { id: string; displayName: string; productCount: number }[]
  categories: {
    name: string
    productCount: number
    subcategories: { name: string; productCount: number }[]
  }[]
  procedures: { code: string; name: string }[]
  roles: { code: string; name: string; category: string }[]
}

export function getCatalogFacets(store: CatalogStore = getCatalogStore()): CatalogFacets {
  return {
    manufacturers: store.manufacturerFacets,
    categories: store.categoryFacets,
    procedures: store.procedures.map((procedure) => ({
      code: procedure.procedure_code,
      name: procedure.procedure_name,
    })),
    roles: store.roles.map((role) => ({
      code: role.role_code,
      name: role.role_name,
      category: role.category ?? 'Other',
    })),
  }
}

export interface CatalogOverview {
  productCount: number
  manufacturerCount: number
  roleCount: number
  procedureCount: number
  verifiedCount: number
}

export function getCatalogOverview(store: CatalogStore = getCatalogStore()): CatalogOverview {
  return {
    productCount: store.products.length,
    manufacturerCount: store.manufacturerFacets.length,
    roleCount: store.roles.length,
    procedureCount: store.procedures.length,
    verifiedCount: store.products.filter((product) => product.verificationTier === 'verified')
      .length,
  }
}

/** Guard for user-supplied filter values so a bad URL is a friendly no-op, not a crash. */
export function validateKnownCatalogFilters(
  query: CatalogSearchQuery,
  store: CatalogStore = getCatalogStore(),
): string | null {
  if (query.role && !store.roleByCode.has(query.role)) return 'role'
  if (query.procedure && !store.procedureByCode.has(query.procedure)) return 'procedure'
  const knownManufacturers = new Set(store.manufacturerFacets.map((facet) => facet.id))
  if (query.manufacturers.some((id) => !knownManufacturers.has(id))) return 'manufacturer'
  return null
}

export type CatalogPickLookupErrorCode =
  | 'unknown_product'
  | 'unknown_role'
  | 'product_role_mismatch'

export type CatalogPickLookupResult =
  | { ok: true; pick: CatalogPick }
  | {
      ok: false
      code: CatalogPickLookupErrorCode
      productId: string
      roleCode: string
    }

/**
 * Authoritative server-side reconstruction for a catalog pick.
 *
 * Product identity and its requested role both come from generated catalog relationships.
 * A browser picker is role-scoped too, but save-time callers are untrusted and must prove the
 * exact Product_Roles pair again.
 */
export function resolveCatalogPick(
  productId: string,
  roleCode: string,
  store: CatalogStore = getCatalogStore(),
): CatalogPickLookupResult {
  const product = store.productById.get(productId)
  if (!product) return { ok: false, code: 'unknown_product', productId, roleCode }
  if (!store.roleByCode.has(roleCode)) {
    return { ok: false, code: 'unknown_role', productId, roleCode }
  }
  const carriesRole = (store.rolesByProduct.get(productId) ?? []).some(
    (relationship) => relationship.role_code === roleCode,
  )
  if (!carriesRole) {
    return { ok: false, code: 'product_role_mismatch', productId, roleCode }
  }
  return {
    ok: true,
    pick: {
      productId: product.product_id,
      roleCode,
      manufacturerDisplay: product.manufacturerDisplay,
      productName: product.product_name,
      catalogNumber: product.catalog_number,
      gtin: product.gtin,
      sizeDisplay: product.size_display,
      verificationTier: product.verificationTier,
      usStatusPending: product.usStatusPending,
      minWorkingChannelMm: product.min_working_channel_mm,
      deliverySystemOdMm: product.delivery_system_od_mm,
      sourceId: product.primary_source_id,
      sourceLocation: product.primary_source_location,
    },
  }
}

/**
 * Nullable compatibility wrapper for server views and tests.
 *
 * Unlike the former implementation, this returns null for an unknown role or a product that
 * does not carry the requested role; it never copies an arbitrary caller-provided role.
 */
export function getCatalogPick(
  productId: string,
  roleCode: string,
  store: CatalogStore = getCatalogStore(),
): CatalogPick | null {
  const result = resolveCatalogPick(productId, roleCode, store)
  return result.ok ? result.pick : null
}
