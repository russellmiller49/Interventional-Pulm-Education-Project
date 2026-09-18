import 'server-only'
import artifactJson from '../../../../data/ip-device-intelligence/generated/product-safety-evidence.json'
import { applyPhysicianSafetyReview } from './physician-review.server'
import { getStatusRefresh } from './status-refresh.server'
import { mergeSafetyRefresh } from '../domain/apply-status-refresh'
import {
  safetyEvidenceArtifactSchema,
  type SafetyEvidenceRow,
} from '../domain/safety-notice-schema'

function freeze<Value>(value: Value): Value {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

const artifact = safetyEvidenceArtifactSchema.parse(artifactJson)
const byProductId = new Map(artifact.rows.map((row) => [row.product_id, freeze(row)]))

/** Public rows only. Research prose, source hashes, query receipts and caches stay server-side. */
export function getSafetyEvidence(productId: string): SafetyEvidenceRow | null {
  const previous = byProductId.get(productId) ?? null
  const refresh = getStatusRefresh(productId)
  return applyPhysicianSafetyReview(
    productId,
    refresh ? freeze(mergeSafetyRefresh(previous, refresh)) : previous,
  )
}
