import exclusionsJson from '../../../../data/ip-device-intelligence/reviewed/atlas-visibility-exclusions.json'

import { isWellFormedProductId } from './product-id'

/**
 * The explicit owner-exclusion overlay — the ONLY mechanism that removes an otherwise
 * `verified_source` product from the Device Atlas under the D2B inclusion-first policy.
 *
 * It is deliberately tiny and reviewable: a product id, a controlled reason code, and an
 * optional internal note that is never emitted publicly. There is no general denylist based
 * on market status, recall status, or availability — those are overlays, not gates
 * (see `product-status.ts`).
 *
 * The file ships EMPTY. It is populated only when the owner establishes a specific
 * data-quality defect or an explicit exclusion decision, one row at a time, and any row is
 * reversed by deleting it.
 */

/** Controlled exclusion reasons. Anything else fails validation at load. */
export const EXCLUSION_REASON_CODES = [
  'confirmed_duplicate',
  'wrong_source_product_match',
  'malformed_canonical_identity',
  'owner_excluded',
] as const
export type ExclusionReasonCode = (typeof EXCLUSION_REASON_CODES)[number]

export interface AtlasVisibilityExclusion {
  productId: string
  reasonCode: ExclusionReasonCode
}

interface RawExclusionFile {
  format_version?: unknown
  artifact_kind?: unknown
  exclusions?: unknown
}

interface RawExclusionRow {
  product_id?: unknown
  reason_code?: unknown
  /** Internal-only reviewer note. Read for validation, never exported or rendered. */
  internal_note?: unknown
}

function parse(file: RawExclusionFile): Map<string, ExclusionReasonCode> {
  if (file.format_version !== 1) {
    throw new Error('atlas-visibility-exclusions.json: format_version must be 1')
  }
  if (file.artifact_kind !== 'device_intelligence_atlas_visibility_exclusions') {
    throw new Error(
      'atlas-visibility-exclusions.json: artifact_kind must be device_intelligence_atlas_visibility_exclusions',
    )
  }
  if (!Array.isArray(file.exclusions)) {
    throw new Error('atlas-visibility-exclusions.json: exclusions must be an array')
  }
  const byProductId = new Map<string, ExclusionReasonCode>()
  for (const entry of file.exclusions as RawExclusionRow[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('atlas-visibility-exclusions.json: every exclusion must be an object')
    }
    const extraKeys = Object.keys(entry).filter(
      (key) => !['product_id', 'reason_code', 'internal_note'].includes(key),
    )
    if (extraKeys.length > 0) {
      throw new Error(
        `atlas-visibility-exclusions.json: unexpected field(s) ${extraKeys.sort().join(', ')}`,
      )
    }
    const { product_id: productId, reason_code: reasonCode, internal_note: internalNote } = entry
    // A malformed id can never enter the exclusion set: it would be an unreviewable no-op
    // that silently claims to exclude something.
    if (typeof productId !== 'string' || !isWellFormedProductId(productId)) {
      throw new Error(
        `atlas-visibility-exclusions.json: "${String(productId)}" is not a well-formed product id`,
      )
    }
    if (
      typeof reasonCode !== 'string' ||
      !(EXCLUSION_REASON_CODES as readonly string[]).includes(reasonCode)
    ) {
      throw new Error(
        `atlas-visibility-exclusions.json: ${productId} has unknown reason_code "${String(reasonCode)}"`,
      )
    }
    if (internalNote !== undefined && typeof internalNote !== 'string') {
      throw new Error(
        `atlas-visibility-exclusions.json: ${productId} internal_note must be a string`,
      )
    }
    if (byProductId.has(productId)) {
      throw new Error(`atlas-visibility-exclusions.json: duplicate entry for ${productId}`)
    }
    byProductId.set(productId, reasonCode as ExclusionReasonCode)
  }
  return byProductId
}

const exclusionsByProductId: ReadonlyMap<string, ExclusionReasonCode> = parse(
  exclusionsJson as RawExclusionFile,
)

/** Exported for tests and for the store's "every exclusion resolves" assertion. */
export function getAtlasVisibilityExclusions(): ReadonlyMap<string, ExclusionReasonCode> {
  return exclusionsByProductId
}

export function isOwnerExcludedFromAtlas(productId: string | null | undefined): boolean {
  return typeof productId === 'string' && exclusionsByProductId.has(productId)
}

/**
 * Re-parse an arbitrary file body under the same rules — the validation path tests exercise
 * without writing to the committed overlay.
 */
export function parseAtlasVisibilityExclusions(file: unknown): Map<string, ExclusionReasonCode> {
  return parse(file as RawExclusionFile)
}

/**
 * Every excluded id must name a real catalog product. Checked where the catalog is already
 * loaded (the atlas store), because an exclusion pointing at a nonexistent id is an
 * unreviewable claim, not a safe no-op.
 */
export function assertExclusionsResolve(knownProductIds: ReadonlySet<string>): void {
  const unresolved = [...exclusionsByProductId.keys()]
    .filter((productId) => !knownProductIds.has(productId))
    .sort()
  if (unresolved.length > 0) {
    throw new Error(
      `atlas-visibility-exclusions.json names product id(s) absent from the catalog: ${unresolved.join(', ')}`,
    )
  }
}
