import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogListItem } from '@/features/preference-cards/server/catalog'
import {
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '@/features/device-intelligence/domain/product-status'
import { EvidenceBadge } from './EvidenceBadge'
import { ProductStatusBadges, type ProductStatusLabels } from './ProductStatus'
import { SaveDeviceButton, type SaveDeviceLabels } from './SavedDevicesProvider'

/** One semantic table becomes a compact card for each product on narrow screens.
 * Identity and material status stay together without a horizontal swipe. Explicit table
 * roles preserve semantics in browsers that flatten tables after a CSS display change. */
export function AtlasResultsTable({
  locale,
  items,
  statusByProductId,
  deviceTypeByProductId,
  statusLabels,
  labels,
  exactIdentifierMatchIds = [],
  saveLabels,
}: {
  locale: string
  exactIdentifierMatchIds?: string[]
  saveLabels?: SaveDeviceLabels
  items: CatalogListItem[]
  statusByProductId: Record<string, ProductStatusView>
  /**
   * D2C: the localized normalized device-subtype label per product. The column shows the
   * normalized physical type, never canonical primary_category/subcategory and never an
   * internal taxonomy code.
   */
  deviceTypeByProductId: Record<string, string>
  statusLabels: ProductStatusLabels
  labels: {
    product: string
    manufacturer: string
    deviceType: string
    catalogNumber: string
    size: string
    evidence: string
    status: string
    notRecorded: string
    verifiedSource: string
    /** Accessible name for the scrollable region wrapping the table. */
    region: string
    exactMatch: string
    asOf: string
  }
}) {
  return (
    <div
      // Keyboard-scrollable region (WCAG 2.1.1, owner-review F-32).
      tabIndex={0}
      role="region"
      aria-label={labels.region}
      className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <table
        role="table"
        className="block w-full border-collapse text-sm lg:table lg:min-w-[900px]"
      >
        <thead role="rowgroup" className="sr-only lg:not-sr-only lg:table-header-group">
          <tr role="row" className="border-b border-border bg-muted/40 text-left">
            <th
              id="atlas-column-product"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.product}
            </th>
            <th
              id="atlas-column-manufacturer"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.manufacturer}
            </th>
            <th
              id="atlas-column-deviceType"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.deviceType}
            </th>
            <th
              id="atlas-column-catalogNumber"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.catalogNumber}
            </th>
            <th
              id="atlas-column-size"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.size}
            </th>
            <th
              id="atlas-column-evidence"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.evidence}
            </th>
            <th
              id="atlas-column-status"
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.status}
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block lg:table-row-group">
          {items.map((item) => (
            <tr
              role="row"
              key={item.productId}
              data-product-id={item.productId}
              className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border/60 p-4 last:border-0 lg:table-row lg:p-0"
            >
              <td
                role="cell"
                headers="atlas-column-product"
                className="order-1 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <Link
                  href={`/${locale}/devices/${item.productId}` as Route}
                  className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.productName}
                </Link>
                {exactIdentifierMatchIds.includes(item.productId) ? (
                  <span
                    data-exact-identifier-match
                    className="mt-1 block text-xs font-semibold text-primary"
                  >
                    {labels.exactMatch}
                  </span>
                ) : null}
                {saveLabels ? (
                  <div className="mt-2">
                    <SaveDeviceButton
                      productId={item.productId}
                      productName={item.productName}
                      catalogNumber={item.catalogNumber}
                      labels={saveLabels}
                    />
                  </div>
                ) : null}
              </td>
              <td
                role="cell"
                headers="atlas-column-manufacturer"
                className="order-2 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                {item.manufacturerDisplay}
              </td>
              <td
                role="cell"
                headers="atlas-column-deviceType"
                className="order-6 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block text-[11px] font-semibold text-muted-foreground lg:hidden"
                >
                  {labels.deviceType}
                </span>
                {deviceTypeByProductId[item.productId] ?? (
                  <span className="italic text-muted-foreground">{labels.notRecorded}</span>
                )}
              </td>
              <td
                role="cell"
                headers="atlas-column-catalogNumber"
                className="order-4 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block text-[11px] font-semibold text-muted-foreground lg:hidden"
                >
                  {labels.catalogNumber}
                </span>
                {item.catalogNumber ?? (
                  <span className="font-sans italic text-muted-foreground">
                    {labels.notRecorded}
                  </span>
                )}
              </td>
              <td
                role="cell"
                headers="atlas-column-size"
                className="order-5 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block text-[11px] font-semibold text-muted-foreground lg:hidden"
                >
                  {labels.size}
                </span>
                {item.sizeDisplay ?? (
                  <span className="italic text-muted-foreground">{labels.notRecorded}</span>
                )}
              </td>
              <td
                role="cell"
                headers="atlas-column-evidence"
                className="order-7 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block text-[11px] font-semibold text-muted-foreground lg:hidden"
                >
                  {labels.evidence}
                </span>
                {item.verificationTier === 'verified' ? (
                  <EvidenceBadge state="verified_source_fact">
                    {labels.verifiedSource}
                  </EvidenceBadge>
                ) : (
                  // Unreachable through the cohort store; derived from the row rather than
                  // asserted, so a non-cohort item could never wear a false badge.
                  <EvidenceBadge state="unknown">{item.verificationTier}</EvidenceBadge>
                )}
              </td>
              <td
                role="cell"
                headers="atlas-column-status"
                className="order-3 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <ProductStatusBadges
                  status={statusByProductId[item.productId] ?? UNRESEARCHED_PRODUCT_STATUS}
                  labels={statusLabels}
                />
                {statusByProductId[item.productId]?.researchSnapshotDate ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {labels.asOf} {statusByProductId[item.productId].researchSnapshotDate}
                  </p>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
