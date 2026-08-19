import 'server-only'

import taxonomyOverlayJson from '../../../../data/ip-device-intelligence/generated/product-taxonomy-overlay.json'
import enMessages from '../../../../messages/en.json'
import esMessages from '../../../../messages/es.json'
import zhCnMessages from '../../../../messages/zh-CN.json'

import {
  DEVICE_CLASS_CODES,
  UNCLASSIFIED_PRODUCT_TAXONOMY,
  isDeviceClassCode,
  type DeviceClassCode,
  type DeviceSubtypeCode,
  type ProductTaxonomyView,
} from '@/features/device-intelligence/domain/product-taxonomy'
import {
  taxonomyOverlayArtifactSchema,
  type TaxonomyOverlayArtifact,
} from '@/features/device-intelligence/domain/taxonomy-overlay-schema'
import type { CatalogStore } from '@/features/preference-cards/server/catalog-store'

/**
 * Runtime reader for the D2C taxonomy overlay.
 *
 * The overlay is generated (`npm run ip-intel:taxonomy-overlay`) from the reviewed rules
 * file and validated against the same closed schema on the way in, so classification
 * working notes and source-category copy never enter the application module graph — only
 * controlled codes do.
 *
 * `getProductTaxonomy` is TOTAL: every product id resolves. A cohort product somehow
 * missing a row (impossible today; asserted by tests) gets the honest `other_needs_review`
 * fallback and REMAINS fully visible — taxonomy must never become an atlas-visibility
 * gate, and an uncertain classification is review metadata, not a wall.
 */

let cachedArtifact: TaxonomyOverlayArtifact | null = null
let cachedRowIndex: Map<string, ProductTaxonomyView> | null = null

function getArtifact(): TaxonomyOverlayArtifact {
  if (!cachedArtifact) {
    cachedArtifact = taxonomyOverlayArtifactSchema.parse(taxonomyOverlayJson)
  }
  return cachedArtifact
}

function getRowIndex(): Map<string, ProductTaxonomyView> {
  if (!cachedRowIndex) {
    const index = new Map<string, ProductTaxonomyView>()
    for (const row of getArtifact().rows) {
      index.set(row.product_id, {
        deviceClassCode: row.device_class_code,
        deviceSubtypeCode: row.device_subtype_code as DeviceSubtypeCode,
        taxonomyConfidence: row.taxonomy_confidence,
        needsReview: row.needs_review,
      })
    }
    cachedRowIndex = index
  }
  return cachedRowIndex
}

export function getProductTaxonomy(productId: string): ProductTaxonomyView {
  return getRowIndex().get(productId) ?? UNCLASSIFIED_PRODUCT_TAXONOMY
}

/** Taxonomy for a list of products, as a plain serializable record for view models. */
export function getProductTaxonomyMap(
  productIds: readonly string[],
): Record<string, ProductTaxonomyView> {
  const map: Record<string, ProductTaxonomyView> = {}
  for (const productId of productIds) map[productId] = getProductTaxonomy(productId)
  return map
}

export interface DeviceClassFacet {
  code: DeviceClassCode
  productCount: number
}

/**
 * Device-class facet counts over a store's product population (the atlas cohort store in
 * production; fixtures in tests). Computed from the store rather than the overlay counts
 * so the facet can never promise a product the store then withholds. Classes with zero
 * products are omitted — including the `other_needs_review` fallback while it is empty.
 */
export function getDeviceClassFacets(store: CatalogStore): DeviceClassFacet[] {
  const counts = new Map<DeviceClassCode, number>()
  for (const product of store.products) {
    const taxonomy = getProductTaxonomy(product.product_id)
    counts.set(taxonomy.deviceClassCode, (counts.get(taxonomy.deviceClassCode) ?? 0) + 1)
  }
  return DEVICE_CLASS_CODES.filter((code) => (counts.get(code) ?? 0) > 0).map((code) => ({
    code,
    productCount: counts.get(code) ?? 0,
  }))
}

/** Product ids carrying the given normalized device class, scoped to a store. */
export function getProductIdsForDeviceClass(
  store: CatalogStore,
  deviceClass: string,
): ReadonlySet<string> {
  const ids = new Set<string>()
  if (!isDeviceClassCode(deviceClass)) return ids
  for (const product of store.products) {
    if (getProductTaxonomy(product.product_id).deviceClassCode === deviceClass) {
      ids.add(product.product_id)
    }
  }
  return ids
}

/**
 * Localized taxonomy labels, resolved directly from the message bundles. Every code has a
 * label in every locale (enforced by tests), so the maps below are total over the
 * vocabulary actually in use.
 */
interface TaxonomyMessages {
  classes: Record<string, string>
  subtypes: Record<string, string>
}

function taxonomyMessagesOf(messages: unknown): TaxonomyMessages {
  return (messages as { deviceIntelligence: { taxonomy: TaxonomyMessages } }).deviceIntelligence
    .taxonomy
}

const TAXONOMY_MESSAGES_BY_LOCALE: Record<string, TaxonomyMessages> = {
  en: taxonomyMessagesOf(enMessages),
  es: taxonomyMessagesOf(esMessages),
  'zh-CN': taxonomyMessagesOf(zhCnMessages),
}

export function getTaxonomyLabels(locale: string): TaxonomyMessages {
  return TAXONOMY_MESSAGES_BY_LOCALE[locale] ?? TAXONOMY_MESSAGES_BY_LOCALE.en
}

const tokensOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)

/**
 * Deterministic label matching for atlas search: a class or subtype matches a query when
 * the query's tokens all appear among the label's tokens (so "sizing device" finds
 * "Sizing or measuring device"), or the label contains the query verbatim (which is what
 * makes CJK queries work — Chinese labels have no token boundaries). Checked against
 * every locale's labels so a Spanish or Chinese search behaves like the English one.
 * Matching NEVER restricts results; it only adds the matched cohort to the candidates.
 */
function labelMatchesQuery(label: string, normalizedQuery: string, queryTokens: string[]): boolean {
  const normalizedLabel = label.toLowerCase()
  if (normalizedLabel.includes(normalizedQuery)) return true
  if (queryTokens.length === 0) return false
  const labelTokens = new Set(tokensOf(normalizedLabel))
  return queryTokens.every((token) => labelTokens.has(token))
}

export interface TaxonomyQueryMatch {
  classCodes: Set<DeviceClassCode>
  subtypeCodes: Set<DeviceSubtypeCode>
}

export function matchTaxonomyCodesForQuery(query: string): TaxonomyQueryMatch {
  const match: TaxonomyQueryMatch = { classCodes: new Set(), subtypeCodes: new Set() }
  const normalizedQuery = query.trim().toLowerCase()
  const isCjkQuery = /[㐀-鿿]/.test(normalizedQuery)
  if (normalizedQuery.length < (isCjkQuery ? 2 : 3)) return match
  // Exact class-label precedence (D2C-REV-004): when the query IS a controlled class
  // label in any locale, taxonomy expansion adds that class only — never the subtype
  // cohorts whose labels merely CONTAIN it ("支气管镜" must mean the Bronchoscope class,
  // not every accessory whose subtype label mentions bronchoscopes). Ordinary product-name
  // matching and exact catalog-number ordering are untouched either way; a non-exact
  // phrase keeps the additive class+subtype expansion below.
  for (const messages of Object.values(TAXONOMY_MESSAGES_BY_LOCALE)) {
    for (const [code, label] of Object.entries(messages.classes)) {
      if (label.trim().toLowerCase() === normalizedQuery) {
        match.classCodes.add(code as DeviceClassCode)
      }
    }
  }
  if (match.classCodes.size > 0) return match
  const queryTokens = tokensOf(normalizedQuery)
  for (const messages of Object.values(TAXONOMY_MESSAGES_BY_LOCALE)) {
    for (const [code, label] of Object.entries(messages.classes)) {
      if (labelMatchesQuery(label, normalizedQuery, queryTokens)) {
        match.classCodes.add(code as DeviceClassCode)
      }
    }
    for (const [code, label] of Object.entries(messages.subtypes)) {
      if (labelMatchesQuery(label, normalizedQuery, queryTokens)) {
        match.subtypeCodes.add(code as DeviceSubtypeCode)
      }
    }
  }
  return match
}

/**
 * Product ids whose normalized class or subtype label matches the text query, scoped to a
 * store. Fed into `searchCatalog` as ADDITIONAL text-match candidates only — never as a
 * restriction, and never touching exact catalog-number matching, which stays first.
 */
export function getTaxonomyTextMatchIds(store: CatalogStore, query: string): ReadonlySet<string> {
  const { classCodes, subtypeCodes } = matchTaxonomyCodesForQuery(query)
  const ids = new Set<string>()
  if (classCodes.size === 0 && subtypeCodes.size === 0) return ids
  for (const product of store.products) {
    const taxonomy = getProductTaxonomy(product.product_id)
    if (classCodes.has(taxonomy.deviceClassCode) || subtypeCodes.has(taxonomy.deviceSubtypeCode)) {
      ids.add(product.product_id)
    }
  }
  return ids
}

/** Provenance for tests and documentation: which rules snapshot produced the overlay. */
export function getTaxonomyOverlayProvenance(): {
  sourceRulesSha256: string
  rowCount: number
  needsReviewCount: number
} {
  const artifact = getArtifact()
  return {
    sourceRulesSha256: artifact.source_rules.sha256,
    rowCount: artifact.rows.length,
    needsReviewCount: artifact.counts.needs_review,
  }
}
