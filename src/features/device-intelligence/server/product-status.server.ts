import 'server-only'

import statusOverlayJson from '../../../../data/ip-device-intelligence/generated/product-status-overlay.json'

import {
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '@/features/device-intelligence/domain/product-status'
import {
  statusOverlayArtifactSchema,
  type StatusOverlayArtifact,
} from '@/features/device-intelligence/domain/status-overlay-schema'

/**
 * The runtime reader for the compact D2B market-status / safety overlay.
 *
 * The overlay is generated (`npm run ip-intel:status-overlay`) from the merged PR #105
 * research package and validated against the same closed schema on the way in, so the 14 MB
 * evidence artifact — rationale prose, source URLs, API query strings, cached FDA response
 * text — never enters the application module graph. Only this small controlled projection
 * does.
 *
 * `getProductStatus` is TOTAL: every product id resolves, and a product with no row gets the
 * honest unresearched default rather than an implied clean bill of health. That matters
 * because D2B admits 578 products the 2026-08-13 snapshot researched plus 753 it never
 * covered, and none of the 753 may be presented as availability-verified or recall-free.
 */

let cachedRowIndex: Map<string, ProductStatusView> | null = null
let cachedArtifact: StatusOverlayArtifact | null = null

function getArtifact(): StatusOverlayArtifact {
  if (!cachedArtifact) {
    cachedArtifact = statusOverlayArtifactSchema.parse(statusOverlayJson)
  }
  return cachedArtifact
}

function getRowIndex(): Map<string, ProductStatusView> {
  if (!cachedRowIndex) {
    const index = new Map<string, ProductStatusView>()
    for (const row of getArtifact().rows) {
      index.set(row.product_id, {
        researched: true,
        researchSnapshotDate: row.research_snapshot_date,
        marketStatus: row.market_status,
        marketConfidence: row.market_confidence,
        safetyDisplay: row.safety_display,
        safetyActionScope: row.safety_action_scope,
        safetyReferenceCodes: row.safety_reference_codes,
        statusRecommendationGate: row.status_recommendation_gate,
      })
    }
    cachedRowIndex = index
  }
  return cachedRowIndex
}

export function getProductStatus(productId: string): ProductStatusView {
  return getRowIndex().get(productId) ?? UNRESEARCHED_PRODUCT_STATUS
}

/** Status for a list of products, as a plain serializable record for view models. */
export function getProductStatusMap(
  productIds: readonly string[],
): Record<string, ProductStatusView> {
  const map: Record<string, ProductStatusView> = {}
  for (const productId of productIds) map[productId] = getProductStatus(productId)
  return map
}

/** Provenance for the product-detail panel and for tests: which snapshot produced the labels. */
export function getStatusOverlayProvenance(): {
  researchAsOfDate: string
  sourceSha256: string
  rowCount: number
} {
  const artifact = getArtifact()
  return {
    researchAsOfDate: artifact.research_as_of_date,
    sourceSha256: artifact.source_artifact.sha256,
    rowCount: artifact.rows.length,
  }
}
