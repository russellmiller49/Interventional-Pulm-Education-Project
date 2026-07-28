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

  const existingProductIds = idsOf(normalized.Products ?? [], 'product_id')
  const existingManufacturerIds = idsOf(normalized.Manufacturers ?? [], 'manufacturer_id')
  const existingSourceIds = idsOf(normalized.Sources ?? [], 'source_id')
  const knownRoleCodes = idsOf(normalized.Roles ?? [], 'role_code')

  for (const product of additions.products) {
    const productId = product.product_id as string
    if (existingProductIds.has(productId)) {
      report.errors.push(`Addition product ${productId} collides with a workbook product.`)
    }
  }

  const additionProductIds = idsOf(additions.products, 'product_id')
  const sourceIdsAfterMerge = new Set([
    ...existingSourceIds,
    ...idsOf(additions.sources, 'source_id'),
  ])

  for (const link of additions.product_roles) {
    const roleCode = link.role_code as string
    if (!knownRoleCodes.has(roleCode)) {
      report.errors.push(`Addition product_role references unknown role ${roleCode}.`)
    }
    if (!additionProductIds.has(link.product_id as string)) {
      report.errors.push(
        `Addition product_role references unknown product ${String(link.product_id)}.`,
      )
    }
  }
  for (const link of additions.product_sources) {
    if (!sourceIdsAfterMerge.has(link.source_id as string)) {
      report.errors.push(
        `Addition product_source references unknown source ${String(link.source_id)}.`,
      )
    }
  }

  if (report.errors.length > 0) return report

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
