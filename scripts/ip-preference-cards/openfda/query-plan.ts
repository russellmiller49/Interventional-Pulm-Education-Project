import {
  displayIdentifier,
  exactIdentifierComparison,
  exactOpenFdaSearch,
  looseSearchValue,
  splitAlternateIdentifiers,
  stableUnique,
} from './normalize'
import type {
  CatalogProductInput,
  ManufacturerAliasGroup,
  OpenFdaQuery,
  OpenFdaRecord,
  VerificationBacklogInput,
} from './types'

const DEFAULT_QUERY_LIMIT = 100
const NON_DEVICE_IDENTIFIER =
  /^(?:custom[\s_-]*service|n\/?a|none|not[\s_-]*applicable|tbd|unknown|various)$/i

function usableDi(value: unknown): string | null {
  const display = displayIdentifier(value)
  if (!display || display.length < 6 || display.length > 80) return null
  return /^[\p{L}\p{N}()./+_-]+$/u.test(display) ? display : null
}

function recordHasIdentifier(record: OpenFdaRecord, value: string): boolean {
  const expected = exactIdentifierComparison(value)
  return Boolean(
    expected &&
    record.identifiers?.some((identifier) => exactIdentifierComparison(identifier.id) === expected),
  )
}

/**
 * openFDA quoted searches are analyzed searches, not guaranteed full-field equality.
 * Keep only records that satisfy the query stage under the pipeline's reviewed local
 * normalization rules before deduplication or classification.
 */
export function filterOpenFdaRecordsForQuery(
  records: OpenFdaRecord[],
  query: OpenFdaQuery,
): OpenFdaRecord[] {
  const expectedIdentifier = exactIdentifierComparison(query.sourceValue)
  const expectedBrand = looseSearchValue(query.sourceValue)
  return records.filter((record) => {
    switch (query.kind) {
      case 'primary_di':
        return recordHasIdentifier(record, query.sourceValue)
      case 'catalog_number':
      case 'catalog_number_company':
        return Boolean(
          expectedIdentifier &&
          exactIdentifierComparison(record.catalog_number) === expectedIdentifier,
        )
      case 'model_number':
      case 'alternate_identifier':
        return Boolean(
          expectedIdentifier &&
          exactIdentifierComparison(record.version_or_model_number) === expectedIdentifier,
        )
      case 'brand_fallback':
        return Boolean(expectedBrand && looseSearchValue(record.brand_name) === expectedBrand)
    }
  })
}

export function usableDeviceIdentifier(value: unknown): string | null {
  const display = displayIdentifier(value)
  if (!display || NON_DEVICE_IDENTIFIER.test(display)) return null
  return display
}

function query(
  kind: OpenFdaQuery['kind'],
  phase: OpenFdaQuery['phase'],
  field: string,
  value: string,
  reviewOnly: boolean,
  limit: number,
): OpenFdaQuery {
  return {
    kind,
    phase,
    search: exactOpenFdaSearch(field, value),
    limit,
    sourceValue: value,
    reviewOnly,
  }
}

export interface BuildQueryPlanOptions {
  backlog?: VerificationBacklogInput | null
  limit?: number
  includeBrandFallback?: boolean
}

export function buildOpenFdaQueryPlan(
  product: CatalogProductInput,
  aliasGroup: ManufacturerAliasGroup,
  {
    backlog = null,
    limit = DEFAULT_QUERY_LIMIT,
    includeBrandFallback = true,
  }: BuildQueryPlanOptions = {},
): OpenFdaQuery[] {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
  const plan: OpenFdaQuery[] = []

  const diCandidates = stableUnique(
    [product.gtin, backlog?.existing_gtin, backlog?.suggested_primary_di]
      .map(usableDi)
      .filter((value): value is string => Boolean(value)),
    (value) => exactIdentifierComparison(value) ?? value,
  )
  for (const candidate of diCandidates) {
    plan.push(query('primary_di', 1, 'identifiers.id', candidate, false, safeLimit))
  }

  const catalogNumber = usableDeviceIdentifier(product.catalog_number)
  if (catalogNumber) {
    plan.push(query('catalog_number', 2, 'catalog_number', catalogNumber, false, safeLimit))
    for (const alias of stableUnique(
      [aliasGroup.canonicalName, ...aliasGroup.aliases]
        .map(displayIdentifier)
        .filter((value): value is string => Boolean(value)),
      (value) => value.toLocaleLowerCase('en-US'),
    )) {
      plan.push({
        ...query('catalog_number_company', 3, 'catalog_number', catalogNumber, false, safeLimit),
        search: `${exactOpenFdaSearch('catalog_number', catalogNumber)} AND ${exactOpenFdaSearch(
          'company_name',
          alias,
        )}`,
      })
    }
  }

  const directModelCandidates = stableUnique(
    [product.catalog_number, product.global_part_number, product.reference_part_number]
      .map(usableDeviceIdentifier)
      .filter((value): value is string => Boolean(value)),
    (value) => exactIdentifierComparison(value) ?? value,
  )
  for (const candidate of directModelCandidates) {
    plan.push(query('model_number', 4, 'version_or_model_number', candidate, true, safeLimit))
  }

  for (const candidate of splitAlternateIdentifiers(product.alternate_ids).filter((value) =>
    usableDeviceIdentifier(value),
  )) {
    plan.push(
      query('alternate_identifier', 4, 'version_or_model_number', candidate, true, safeLimit),
    )
  }

  const brandFamily = displayIdentifier(product.brand_family)
  if (includeBrandFallback && brandFamily && brandFamily.length >= 3) {
    plan.push(query('brand_fallback', 5, 'brand_name', brandFamily, true, safeLimit))
  }

  return stableUnique(plan, (item) => item.search)
}
