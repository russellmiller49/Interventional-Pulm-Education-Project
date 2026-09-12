import 'server-only'
import artifactJson from '../../../../data/ip-device-intelligence/generated/product-safety-evidence.json'
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
  return byProductId.get(productId) ?? null
}
