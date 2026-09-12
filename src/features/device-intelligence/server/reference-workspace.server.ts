import 'server-only'

import { getAtlasCatalogStore } from './atlas-store.server'
import { getAtlasProductDetail, type AtlasProductDetail } from './atlas.server'
import { getProductStatus } from './product-status.server'
import { getProductTaxonomy } from './product-taxonomy.server'
import { getSafetyEvidence } from './safety-evidence.server'
import { safetyEvidenceFreshness, type SafetyFreshness } from '../domain/evidence-freshness'
import {
  COMPARISON_FIELDS,
  comparisonFieldsForClass,
  type ComparisonField,
} from '../domain/comparison'
import { MAX_COMPARISON_DEVICES, MAX_SAVED_DEVICES, parseDeviceIds } from '../domain/saved-devices'
import type { ProductStatusView } from '../domain/product-status'
import type { ProductTaxonomyView } from '../domain/product-taxonomy'

export interface SavedDeviceCard {
  productId: string
  productName: string
  manufacturer: string
  catalogNumber: string | null
  size: string | null
  taxonomy: ProductTaxonomyView
  status: ProductStatusView
  freshness: SafetyFreshness
}

/** This allowlist never serializes the catalog store, institutional data or research artifacts. */
export function getSavedDeviceCards(ids: string[], today = new Date().toISOString().slice(0, 10)) {
  if (!parseDeviceIds(ids.join(','), MAX_SAVED_DEVICES)) throw new Error('Invalid device IDs')
  const store = getAtlasCatalogStore()
  const unique = [...new Set(ids)]
  const devices: SavedDeviceCard[] = unique.flatMap((id) => {
    const product = store.productById.get(id)
    if (!product) return []
    return [
      {
        productId: id,
        productName: product.product_name,
        manufacturer: product.manufacturerDisplay,
        catalogNumber: product.catalog_number,
        size: product.size_display,
        taxonomy: getProductTaxonomy(id),
        status: getProductStatus(id),
        freshness: safetyEvidenceFreshness(getSafetyEvidence(id), today),
      },
    ]
  })
  // Unknown/retired/non-cohort identities never ride along in a response.
  return { devices, unavailableCount: unique.length - devices.length }
}

export interface ComparisonCitation {
  title: string
  url: string | null
  locator: string
  asOf: string
}
export interface ComparisonValue {
  value: string | number | boolean | null
  unit: string | null
  origin: 'reviewed' | 'catalog' | 'missing'
  scope: 'exact' | 'family' | 'configuration' | null
  citations: ComparisonCitation[]
}

export function comparisonValue(
  detail: AtlasProductDetail,
  field: ComparisonField,
): ComparisonValue {
  const definition = COMPARISON_FIELDS[field]
  const missing: ComparisonValue = {
    value: null,
    unit: definition.unit,
    origin: 'missing',
    scope: null,
    citations: [],
  }
  if (detail.profile?.runtime_state === 'insufficient_evidence') return missing
  const specification = detail.profile?.key_specifications.find((spec) =>
    (definition.reviewedKeys as readonly string[]).includes(spec.key),
  )
  if (specification) {
    return {
      value: specification.value,
      unit: specification.unit,
      origin: 'reviewed',
      scope: specification.evidence_scope,
      citations: specification.source_refs.map((ref) => {
        const source = detail.profile!.sources.find((item) => item.source_id === ref.source_id)
        if (!source) throw new Error('Missing reviewed comparison source')
        return {
          title: source.title,
          url: source.official_url,
          locator: ref.locator,
          asOf: source.snapshot_date,
        }
      }),
    }
  }
  if (!('catalogKey' in definition)) return missing
  const value = detail.product[definition.catalogKey]
  return value === null || value === undefined || String(value).trim() === ''
    ? missing
    : {
        value,
        unit: definition.unit,
        origin: 'catalog',
        scope: null,
        citations: [],
      }
}

export function getDeviceComparison(ids: string[]) {
  if (!parseDeviceIds(ids.join(','), MAX_COMPARISON_DEVICES))
    throw new Error('Invalid comparison IDs')
  const unique = [...new Set(ids)]
  const devices = unique.flatMap((id) => {
    const detail = getAtlasProductDetail(id)
    return detail ? [detail] : []
  })
  const classes = new Set(devices.map((detail) => detail.taxonomy.deviceClassCode))
  return {
    devices,
    fields: classes.size === 1 ? comparisonFieldsForClass(devices[0].taxonomy.deviceClassCode) : [],
    mixedClasses: classes.size > 1,
    unavailableCount: unique.length - devices.length,
  }
}
