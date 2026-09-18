import {
  safetyDisplayIsMaterialOnCards,
  type MarketStatus,
  type ProductStatusView,
} from './product-status'
import type { DeviceClassCode, DeviceSubtypeCode } from './product-taxonomy'

/**
 * Family-first presentation for Device Atlas results.
 *
 * A "family" here is a MANUFACTURER PRODUCT LINE used purely to fold catalog configurations
 * of one line into one result. It is a display grouping and nothing more: membership never
 * implies that two models are compatible, interchangeable, or clinically equivalent.
 *
 * Two rules keep the grouping honest:
 *
 *  1. FILTER FIRST, GROUP SECOND. The caller passes only the models that already matched the
 *     search and every filter. A family is built from those models alone, so a card can never
 *     show a model that did not match, and its counts and summaries describe matches only.
 *
 *  2. A LINE NEVER SPANS DEVICE TYPES. The catalog store's `familyKey` is
 *     manufacturer + brand family + catalog kind, and a brand family such as a manufacturer's
 *     whole thoracic instrument range covers a dozen physically different device classes. The
 *     grouping key therefore adds the normalized subtype: forceps and telescopes from the same
 *     brand range are two lines, not one.
 *
 * Model-level facts stay model-level. Safety notices are counted and pointed at the affected
 * models, never restated as a family finding; market status is shown for the line only when
 * every listed model agrees.
 */

export interface AtlasFamilyMember<TItem> {
  item: TItem
  productId: string
  productName: string
  familyKey: string
  familyName: string
  /** False when the catalog records no brand family and the name fell back to a category. */
  hasBrandFamily: boolean
  manufacturerGroupId: string
  manufacturerDisplay: string
  deviceClassCode: DeviceClassCode
  deviceSubtypeCode: DeviceSubtypeCode
  status: ProductStatusView
  /** Ordering only: smaller configurations first, exactly like the role pages. */
  diameterMm: number | null
  frenchSize: number | null
}

export interface AtlasFamilyGroup<TItem> {
  /** `familyKey` + subtype: unique per rendered card. */
  groupKey: string
  /** The store's product-line key, usable as the `family` URL filter. */
  familyKey: string
  familyName: string
  nameBasis: 'brand_family' | 'catalog_grouping'
  manufacturerGroupId: string
  manufacturerDisplay: string
  deviceClassCode: DeviceClassCode
  deviceSubtypeCode: DeviceSubtypeCode
  /** Matching models only, smallest configuration first. */
  models: TItem[]
  modelIds: string[]
  /** Models whose own status carries a matched safety action. Never a family-wide claim. */
  safetyNoticeModelIds: string[]
  /** The line's market status only when unanimous across the listed models. */
  unanimousMarketStatus: MarketStatus | null
}

/**
 * Group already-filtered models into product lines. Families keep the order in which their
 * first model appears, so the caller's sort (relevance, name, manufacturer, size) carries
 * through to the family list unchanged.
 */
export function groupAtlasFamilies<TItem>(
  members: readonly AtlasFamilyMember<TItem>[],
): AtlasFamilyGroup<TItem>[] {
  const groups = new Map<string, AtlasFamilyMember<TItem>[]>()
  for (const member of members) {
    const groupKey = `${member.familyKey}|${member.deviceSubtypeCode}`
    const existing = groups.get(groupKey)
    if (existing) existing.push(member)
    else groups.set(groupKey, [member])
  }

  return [...groups.entries()].map(([groupKey, groupMembers]) => {
    const first = groupMembers[0]
    const ordered = [...groupMembers].sort(
      (left, right) =>
        (left.diameterMm ?? 0) - (right.diameterMm ?? 0) ||
        (left.frenchSize ?? 0) - (right.frenchSize ?? 0) ||
        left.productName.localeCompare(right.productName),
    )
    const marketStatuses = new Set(ordered.map((member) => member.status.marketStatus))
    return {
      groupKey,
      familyKey: first.familyKey,
      familyName: first.familyName,
      nameBasis: first.hasBrandFamily ? 'brand_family' : 'catalog_grouping',
      manufacturerGroupId: first.manufacturerGroupId,
      manufacturerDisplay: first.manufacturerDisplay,
      deviceClassCode: first.deviceClassCode,
      deviceSubtypeCode: first.deviceSubtypeCode,
      models: ordered.map((member) => member.item),
      modelIds: ordered.map((member) => member.productId),
      safetyNoticeModelIds: ordered
        .filter((member) => safetyDisplayIsMaterialOnCards(member.status.safetyDisplay))
        .map((member) => member.productId),
      unanimousMarketStatus: marketStatuses.size === 1 ? first.status.marketStatus : null,
    }
  })
}
