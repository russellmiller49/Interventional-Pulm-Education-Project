import { isWellFormedProductId } from './product-id'
import { MAX_COMPARISON_DEVICES } from './saved-devices'

/**
 * The comparison selection: the exact devices a reader has lined up to compare right now.
 *
 * Deliberately separate from saved devices. Saving keeps a device for later; comparing
 * inspects recorded differences now. The two lists use different storage keys and never write
 * to each other, so adding a device to a comparison does not save it and removing a saved
 * device does not change a comparison.
 *
 * Same storage contract as saved devices: identifiers only, versioned, validated on every
 * read, and bounded by the comparison page's own maximum. Product facts always come from the
 * server.
 */
export const COMPARE_SELECTION_KEY = 'device-intelligence.compare-selection.v1'

export function parseCompareSelection(raw: string | null): string[] {
  if (raw === null) return []
  if (raw.length > 1_000) throw new Error('Invalid comparison selection')
  const value: unknown = JSON.parse(raw)
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    value.version !== 1 ||
    !('productIds' in value) ||
    !Array.isArray(value.productIds) ||
    value.productIds.length > MAX_COMPARISON_DEVICES ||
    value.productIds.some((id) => typeof id !== 'string' || !isWellFormedProductId(id))
  )
    throw new Error('Invalid comparison selection')
  return [...new Set(value.productIds as string[])]
}

export function serializeCompareSelection(productIds: string[]): string {
  const raw = JSON.stringify({ version: 1, productIds })
  parseCompareSelection(raw)
  return raw
}

export type CompareToggleResult =
  | { ok: true; ids: string[] }
  | { ok: false; reason: 'limit' | 'invalid' }

/** Add or remove one device. A full selection refuses the addition; it never drops another. */
export function toggleCompareSelection(current: string[], productId: string): CompareToggleResult {
  if (!isWellFormedProductId(productId)) return { ok: false, reason: 'invalid' }
  if (current.includes(productId)) {
    return { ok: true, ids: current.filter((id) => id !== productId) }
  }
  if (current.length >= MAX_COMPARISON_DEVICES) return { ok: false, reason: 'limit' }
  return { ok: true, ids: [...current, productId] }
}
