import {
  catalogReleaseManifestHash,
  catalogRowHash,
  type HistoricalCatalogReleaseManifest,
  type HistoricalCatalogRow,
  type HistoricalProductRoleRow,
  type HistoricalProductRow,
  type HistoricalRoleRow,
} from '../../src/features/preference-cards/domain/historical-catalog'
import type {
  CatalogProductRecord,
  ProductRoleRecord,
  RoleRecord,
} from '../../src/features/preference-cards/server/catalog-store'

import type { CatalogRelease } from './catalog-release-id'

/**
 * Derive one catalog release's retained rows and manifest from the generated catalog.
 *
 * The projection here is the only place raw catalog columns become retained rows, so the closure
 * rule from `historical-catalog.ts` is checkable in one function: every value below is read from
 * `catalog-products.json`, `product-roles.json`, or `roles.json`, which are exactly the three files
 * `catalogReleaseId` is computed over. Nothing is decorated, canonicalized, or overlaid on the way
 * in — decoration is current code applied on the way out, and baking one build's decoration into
 * retained data would freeze an interpretation rather than the facts.
 *
 * Deterministic by construction: rows are emitted in sorted key order and the manifest sorts the
 * hash lists, so a rerun over unchanged inputs produces byte-identical output.
 */

function nullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function toHistoricalProductRow(record: CatalogProductRecord): HistoricalProductRow {
  return {
    kind: 'product',
    productId: record.product_id,
    manufacturerId: nullableString(record.manufacturer_id),
    manufacturerName: nullableString(record.manufacturer),
    productName: record.product_name,
    catalogNumber: nullableString(record.catalog_number),
    gtin: nullableString(record.gtin),
    sizeDisplay: nullableString(record.size_display),
    brandFamily: nullableString(record.brand_family),
    subcategory: nullableString(record.subcategory),
    productKind: nullableString(record.product_kind),
    verificationGrade: nullableString(record.verification_grade),
    visibilityState: nullableString(record.visibility_state),
    diameterMm: nullableNumber(record.diameter_mm),
    lengthMm: nullableNumber(record.length_mm),
    frenchSize: nullableNumber(record.french_size),
    gauge: nullableNumber(record.gauge),
    workingLengthCm: nullableNumber(record.working_length_cm),
    minWorkingChannelMm: nullableNumber(record.min_working_channel_mm),
    deliverySystemOdMm: nullableNumber(record.delivery_system_od_mm),
    primarySourceId: nullableString(record.primary_source_id),
    primarySourceLocation: nullableString(record.primary_source_location),
  }
}

export function toHistoricalRoleRow(record: RoleRecord): HistoricalRoleRow {
  return {
    kind: 'role',
    roleCode: record.role_code,
    roleName: record.role_name,
    category: nullableString(record.category),
    requiresCurrentIfu:
      typeof record.requires_current_ifu === 'boolean' ? record.requires_current_ifu : null,
  }
}

export function toHistoricalProductRoleRow(record: ProductRoleRecord): HistoricalProductRoleRow {
  return {
    kind: 'product-role',
    productId: record.product_id,
    roleCode: record.role_code,
    roleFit: nullableString(record.role_fit),
  }
}

export interface DerivedCatalogRetention {
  rows: HistoricalCatalogRow[]
  manifest: HistoricalCatalogReleaseManifest
}

export function deriveCatalogRetention(input: {
  release: CatalogRelease
  products: CatalogProductRecord[]
  roles: RoleRecord[]
  productRoles: ProductRoleRecord[]
}): DerivedCatalogRetention {
  const rows: HistoricalCatalogRow[] = []
  const productRowHashes: string[] = []
  const roleRowHashes: string[] = []
  const productRoleRowHashes: string[] = []

  // Sorted by natural key before hashing, so the manifest's row order reflects the catalog's own
  // identity rather than the order a JSON file happens to list things in. A re-import that emits
  // the same rows in a different order then produces the same manifest.
  const collect = (row: HistoricalCatalogRow, into: string[]) => {
    rows.push(row)
    into.push(catalogRowHash(row))
  }

  for (const record of [...input.products].sort((left, right) =>
    left.product_id.localeCompare(right.product_id),
  )) {
    collect(toHistoricalProductRow(record), productRowHashes)
  }
  for (const record of [...input.roles].sort((left, right) =>
    left.role_code.localeCompare(right.role_code),
  )) {
    collect(toHistoricalRoleRow(record), roleRowHashes)
  }
  const retainedProductIds = new Set(input.products.map((product) => product.product_id))
  for (const record of [...input.productRoles].sort(
    (left, right) =>
      left.product_id.localeCompare(right.product_id) ||
      left.role_code.localeCompare(right.role_code),
  )) {
    // A product-role link whose product is not in the catalog is dropped, matching
    // `buildCatalogStore`, which ignores links to unknown products. Retaining a link to a product
    // the release does not contain would produce a manifest describing a catalog that never was.
    if (!retainedProductIds.has(record.product_id)) continue
    collect(toHistoricalProductRoleRow(record), productRoleRowHashes)
  }

  const withoutHash: Omit<HistoricalCatalogReleaseManifest, 'manifestHash'> = {
    catalogReleaseId: input.release.catalogReleaseId,
    workbookSha256: input.release.workbookSha256,
    inputs: input.release.inputs,
    productRowHashes: [...productRowHashes].sort(),
    roleRowHashes: [...roleRowHashes].sort(),
    productRoleRowHashes: [...productRoleRowHashes].sort(),
  }

  return {
    rows,
    manifest: { ...withoutHash, manifestHash: catalogReleaseManifestHash(withoutHash) },
  }
}
