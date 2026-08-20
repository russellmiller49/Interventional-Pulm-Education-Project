import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CatalogRecord } from './catalog-utils'

/**
 * Merges curated catalog additions into the imported workbook data.
 *
 * The workbook stays the single source of truth for everything it covers; this file adds
 * products it does not carry (currently the Getinge/Atrium thoracic drainage line, built
 * from GUDID plus manufacturer product pages by build-catalog-additions.ts). Merging at
 * import time means every downstream generator and the explorer see one combined catalog.
 *
 * Additions are validated against the workbook's own vocabularies: role codes and source
 * ids must already exist, and product ids must not collide.
 */

const SEED_FILE = 'data/ip-preference-cards/seed/catalog-additions.json'

export interface CatalogAdditionsFile {
  format_version: string
  generated_by?: string
  notes: string
  manufacturers: CatalogRecord[]
  sources: CatalogRecord[]
  products: CatalogRecord[]
  product_roles: CatalogRecord[]
  product_sources: CatalogRecord[]
}

export interface AdditionsMergeReport {
  applied: boolean
  products_added: number
  product_roles_added: number
  product_sources_added: number
  manufacturers_added: number
  sources_added: number
  errors: string[]
}

export async function readCatalogAdditions(
  filePath = SEED_FILE,
): Promise<CatalogAdditionsFile | null> {
  try {
    return JSON.parse(await readFile(path.resolve(process.cwd(), filePath), 'utf8'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

function idsOf(records: CatalogRecord[], column: string): Set<string> {
  const ids = new Set<string>()
  for (const record of records) {
    const value = record[column]
    if (typeof value === 'string' && value.length > 0) ids.add(value)
  }
  return ids
}

type FieldKind =
  | 'string'
  | 'nullable-string'
  | 'nullable-number'
  | 'nullable-boolean'
  | 'nullable-object'

const ADDITION_FIELDS = {
  manufacturer: {
    manufacturer_id: 'string',
    manufacturer: 'string',
    default_distributor: 'nullable-string',
    website: 'nullable-string',
    notes: 'nullable-string',
  },
  source: {
    source_id: 'string',
    title: 'string',
    filename: 'nullable-string',
    source_type: 'nullable-string',
    publisher: 'nullable-string',
    revision_date: 'nullable-string',
    as_of_date: 'nullable-string',
    reliability_tier: 'nullable-string',
    use_policy: 'nullable-string',
    notes: 'nullable-string',
  },
  product: {
    product_id: 'string',
    manufacturer_id: 'string',
    manufacturer: 'nullable-string',
    distributor: 'nullable-string',
    brand_family: 'nullable-string',
    product_name: 'string',
    catalog_number: 'nullable-string',
    alternate_ids: 'nullable-string',
    gtin: 'nullable-string',
    primary_category: 'nullable-string',
    subcategory: 'nullable-string',
    product_kind: 'nullable-string',
    reuse_status: 'nullable-string',
    sterile_status: 'nullable-string',
    implantable: 'nullable-boolean',
    material: 'nullable-string',
    coverage: 'nullable-string',
    laser_type: 'nullable-string',
    placement_method: 'nullable-string',
    size_display: 'nullable-string',
    diameter_mm: 'nullable-number',
    length_mm: 'nullable-number',
    french_size: 'nullable-number',
    gauge: 'nullable-number',
    working_length_cm: 'nullable-number',
    min_working_channel_mm: 'nullable-number',
    delivery_system_od_mm: 'nullable-number',
    package_uom: 'nullable-string',
    adult_peds: 'nullable-string',
    description: 'nullable-string',
    compatibility_text: 'nullable-string',
    verification_status: 'nullable-string',
    live_dropdown_status: 'nullable-string',
    primary_source_id: 'nullable-string',
    primary_source_location: 'nullable-string',
    source_as_of: 'nullable-string',
    availability_note: 'nullable-string',
    notes: 'nullable-string',
    spec_json: 'nullable-object',
    global_part_number: 'nullable-string',
    reference_part_number: 'nullable-string',
    gtin_raw: 'nullable-string',
    spec_json_raw: 'nullable-string',
    visibility_state: 'nullable-string',
    verification_grade: 'nullable-string',
  },
  product_role: {
    product_id: 'string',
    role_code: 'string',
    role_fit: 'nullable-string',
    notes: 'nullable-string',
  },
  product_source: {
    product_id: 'string',
    source_id: 'string',
    source_location: 'nullable-string',
    claim_type: 'nullable-string',
    verification_status: 'nullable-string',
    notes: 'nullable-string',
  },
} as const satisfies Record<string, Record<string, FieldKind>>

function hasFieldKind(value: unknown, kind: FieldKind): boolean {
  if (value === null) return kind.startsWith('nullable-')
  if (kind === 'string' || kind === 'nullable-string') {
    return typeof value === 'string' && value.length > 0
  }
  if (kind === 'nullable-number') return typeof value === 'number' && Number.isFinite(value)
  if (kind === 'nullable-boolean') return typeof value === 'boolean'
  return typeof value === 'object' && !Array.isArray(value)
}

function validateRecordShape(
  record: CatalogRecord,
  expected: Record<string, FieldKind>,
  label: string,
  errors: string[],
  optionalFields: ReadonlySet<string> = new Set(),
): void {
  for (const key of Object.keys(record)) {
    if (!(key in expected)) errors.push(`${label} has unexpected field ${key}.`)
  }
  for (const [key, kind] of Object.entries(expected)) {
    if (!(key in record)) {
      if (!optionalFields.has(key)) errors.push(`${label} is missing required field ${key}.`)
      continue
    }
    if (!hasFieldKind(record[key], kind)) {
      errors.push(
        `${label}.${key} must be ${kind.replace('nullable-', '')}${kind.startsWith('nullable-') ? ' or null' : ''}.`,
      )
    }
  }
}

function reportDuplicateValues(
  records: CatalogRecord[],
  fields: string[],
  label: string,
  errors: string[],
): void {
  const seen = new Set<string>()
  for (const record of records) {
    const key = fields.map((field) => String(record[field] ?? '')).join('\u0000')
    if (seen.has(key))
      errors.push(
        `Addition contains duplicate ${label} ${fields.map((field) => String(record[field])).join(' / ')}.`,
      )
    seen.add(key)
  }
}

function normalizeIdentityPart(value: unknown): string {
  return typeof value === 'string'
    ? value
        .normalize('NFKC')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
    : ''
}

/**
 * Validate the reviewed-additions contract and all relationships before mutating normalized data.
 *
 * The seed is source-controlled, but a malformed generated row must still fail closed at import:
 * otherwise an unknown manufacturer or dangling source link can reach every downstream artifact.
 */
export function validateCatalogAdditions(
  normalized: Record<string, CatalogRecord[]>,
  additions: CatalogAdditionsFile,
): string[] {
  const errors: string[] = []
  const topLevelKeys = new Set([
    'format_version',
    'generated_by',
    'notes',
    'manufacturers',
    'sources',
    'products',
    'product_roles',
    'product_sources',
  ])
  for (const key of Object.keys(additions)) {
    if (!topLevelKeys.has(key))
      errors.push(`Catalog additions have unexpected top-level field ${key}.`)
  }
  if (additions.format_version !== '1.0') {
    errors.push(`Catalog additions format_version must be "1.0".`)
  }
  if (typeof additions.notes !== 'string') errors.push('Catalog additions notes must be a string.')
  if (additions.generated_by !== undefined && typeof additions.generated_by !== 'string') {
    errors.push('Catalog additions generated_by must be a string when present.')
  }

  const collections: [keyof CatalogAdditionsFile, CatalogRecord[]][] = [
    ['manufacturers', additions.manufacturers],
    ['sources', additions.sources],
    ['products', additions.products],
    ['product_roles', additions.product_roles],
    ['product_sources', additions.product_sources],
  ]
  for (const [key, value] of collections) {
    if (!Array.isArray(value)) errors.push(`Catalog additions ${key} must be an array.`)
  }
  if (errors.length > 0) return errors

  additions.manufacturers.forEach((record, index) =>
    validateRecordShape(record, ADDITION_FIELDS.manufacturer, `manufacturers[${index}]`, errors),
  )
  additions.sources.forEach((record, index) =>
    validateRecordShape(record, ADDITION_FIELDS.source, `sources[${index}]`, errors),
  )
  additions.products.forEach((record, index) =>
    validateRecordShape(
      record,
      ADDITION_FIELDS.product,
      `products[${index}]`,
      errors,
      new Set(['laser_type']),
    ),
  )
  additions.product_roles.forEach((record, index) =>
    validateRecordShape(record, ADDITION_FIELDS.product_role, `product_roles[${index}]`, errors),
  )
  additions.product_sources.forEach((record, index) =>
    validateRecordShape(
      record,
      ADDITION_FIELDS.product_source,
      `product_sources[${index}]`,
      errors,
    ),
  )

  reportDuplicateValues(additions.manufacturers, ['manufacturer_id'], 'manufacturer ID', errors)
  reportDuplicateValues(additions.sources, ['source_id'], 'source ID', errors)
  reportDuplicateValues(additions.products, ['product_id'], 'product ID', errors)
  reportDuplicateValues(
    additions.product_roles,
    ['product_id', 'role_code'],
    'product-role pair',
    errors,
  )
  reportDuplicateValues(
    additions.product_sources,
    ['product_id', 'source_id'],
    'product-source pair',
    errors,
  )

  const existingProductIds = idsOf(normalized.Products ?? [], 'product_id')
  const additionProductIds = idsOf(additions.products, 'product_id')
  const productIdsAfterMerge = new Set([...existingProductIds, ...additionProductIds])
  const manufacturerIdsAfterMerge = new Set([
    ...idsOf(normalized.Manufacturers ?? [], 'manufacturer_id'),
    ...idsOf(additions.manufacturers, 'manufacturer_id'),
  ])
  const sourceIdsAfterMerge = new Set([
    ...idsOf(normalized.Sources ?? [], 'source_id'),
    ...idsOf(additions.sources, 'source_id'),
  ])
  const knownRoleCodes = idsOf(normalized.Roles ?? [], 'role_code')

  for (const product of additions.products) {
    const productId = String(product.product_id)
    if (existingProductIds.has(productId)) {
      errors.push(`Addition product ${productId} collides with a workbook product.`)
    }
    if (!manufacturerIdsAfterMerge.has(String(product.manufacturer_id))) {
      errors.push(
        `Addition product ${productId} references unknown manufacturer ${String(product.manufacturer_id)}.`,
      )
    }
    if (
      product.primary_source_id !== null &&
      !sourceIdsAfterMerge.has(String(product.primary_source_id))
    ) {
      errors.push(
        `Addition product ${productId} references unknown primary source ${String(product.primary_source_id)}.`,
      )
    }
  }

  const existingIdentityKeys = new Map<string, string>()
  for (const product of normalized.Products ?? []) {
    const catalogNumber = normalizeIdentityPart(product.catalog_number)
    const manufacturerId = String(product.manufacturer_id ?? '')
    if (catalogNumber && manufacturerId) {
      existingIdentityKeys.set(
        `${manufacturerId}\u0000${catalogNumber}`,
        String(product.product_id),
      )
    }
  }
  const additionIdentityKeys = new Map<string, string>()
  for (const product of additions.products) {
    const catalogNumber = normalizeIdentityPart(product.catalog_number)
    if (!catalogNumber) continue
    const identity = `${String(product.manufacturer_id)}\u0000${catalogNumber}`
    const collision = existingIdentityKeys.get(identity) ?? additionIdentityKeys.get(identity)
    if (collision && collision !== product.product_id) {
      errors.push(
        `Addition product ${String(product.product_id)} duplicates manufacturer-scoped catalog identity held by ${collision}.`,
      )
    }
    additionIdentityKeys.set(identity, String(product.product_id))
  }

  for (const link of additions.product_roles) {
    const roleCode = String(link.role_code)
    if (!knownRoleCodes.has(roleCode)) {
      errors.push(`Addition product_role references unknown role ${roleCode}.`)
    }
    if (!additionProductIds.has(String(link.product_id))) {
      errors.push(
        `Addition product_role references unknown addition product ${String(link.product_id)}.`,
      )
    }
  }
  for (const link of additions.product_sources) {
    if (!productIdsAfterMerge.has(String(link.product_id))) {
      errors.push(`Addition product_source references unknown product ${String(link.product_id)}.`)
    }
    if (!sourceIdsAfterMerge.has(String(link.source_id))) {
      errors.push(`Addition product_source references unknown source ${String(link.source_id)}.`)
    }
  }

  const sourcePairs = new Set(
    additions.product_sources.map(
      (link) => `${String(link.product_id)}\u0000${String(link.source_id)}`,
    ),
  )
  for (const product of additions.products) {
    const primarySourceId = product.primary_source_id
    if (
      typeof primarySourceId !== 'string' ||
      !sourcePairs.has(`${String(product.product_id)}\u0000${primarySourceId}`)
    ) {
      errors.push(
        `Addition product ${String(product.product_id)} has no product-source relationship for its primary source.`,
      )
    }
  }

  return errors
}

/**
 * Appends the additions to the normalized sheet data in place and returns a report.
 * Any validation failure is reported rather than thrown so the importer can decide.
 */
export function mergeCatalogAdditions(
  normalized: Record<string, CatalogRecord[]>,
  additions: CatalogAdditionsFile | null,
): AdditionsMergeReport {
  const report: AdditionsMergeReport = {
    applied: false,
    products_added: 0,
    product_roles_added: 0,
    product_sources_added: 0,
    manufacturers_added: 0,
    sources_added: 0,
    errors: [],
  }
  if (!additions) return report

  report.errors.push(...validateCatalogAdditions(normalized, additions))
  if (report.errors.length > 0) return report

  const existingManufacturerIds = idsOf(normalized.Manufacturers ?? [], 'manufacturer_id')
  const existingSourceIds = idsOf(normalized.Sources ?? [], 'source_id')

  for (const manufacturer of additions.manufacturers) {
    if (existingManufacturerIds.has(manufacturer.manufacturer_id as string)) continue
    normalized.Manufacturers.push(manufacturer)
    report.manufacturers_added += 1
  }
  for (const source of additions.sources) {
    if (existingSourceIds.has(source.source_id as string)) continue
    normalized.Sources.push(source)
    report.sources_added += 1
  }
  normalized.Products.push(...additions.products)
  normalized.Product_Roles.push(...additions.product_roles)
  normalized.Product_Sources.push(...additions.product_sources)

  report.products_added = additions.products.length
  report.product_roles_added = additions.product_roles.length
  report.product_sources_added = additions.product_sources.length
  report.applied = true
  return report
}
