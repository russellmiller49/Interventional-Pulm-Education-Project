import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogListItem } from '@/features/preference-cards/server/catalog'
import {
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '@/features/device-intelligence/domain/product-status'
import { deviceDetailHref } from '@/features/device-intelligence/domain/atlas-query'
import type { SpecSummaryEntry } from '@/features/device-intelligence/domain/device-display-config'
import { CompareButton, type CompareLabels } from './CompareSelection'
import { EvidenceBadge } from './EvidenceBadge'
import { ProductStatusBadges, type ProductStatusLabels } from './ProductStatus'
import { SaveDeviceButton, type SaveDeviceLabels } from './SavedDevicesProvider'

/** The identity columns the table reads; a full catalog list item always satisfies it. */
export type AtlasResultsTableItem = Pick<
  CatalogListItem,
  | 'productId'
  | 'productName'
  | 'manufacturerDisplay'
  | 'catalogNumber'
  | 'sizeDisplay'
  | 'verificationTier'
>

/** One semantic table becomes a compact card for each product on narrow screens.
 * Identity and material status stay together without a horizontal swipe. Explicit table
 * roles preserve semantics in browsers that flatten tables after a CSS display change.
 *
 * The same table lists individual models on the index, the pinned exact-identifier matches,
 * and the models inside a product-line card; `idPrefix` keeps header ids unique when several
 * render on one page, and `hideLineColumns` drops the two columns that are constant inside
 * one line. */
export function AtlasResultsTable({
  locale,
  items,
  statusByProductId,
  deviceTypeByProductId,
  statusLabels,
  labels,
  exactIdentifierMatchIds = [],
  saveLabels,
  compareLabels,
  specSummaryByProductId = {},
  specLabels = {},
  returnContext = null,
  idPrefix = 'atlas',
  hideLineColumns = false,
}: {
  locale: string
  exactIdentifierMatchIds?: string[]
  saveLabels?: SaveDeviceLabels
  compareLabels?: CompareLabels
  /** Category-aware recorded specifications per product; absent fields are simply omitted. */
  specSummaryByProductId?: Record<string, SpecSummaryEntry[]>
  /** Localized label per spec field key. */
  specLabels?: Record<string, string>
  /** Serialized search state carried to the device page so "back" restores this list. */
  returnContext?: string | null
  idPrefix?: string
  hideLineColumns?: boolean
  items: AtlasResultsTableItem[]
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
    /** Heading of the category-aware specification column. */
    keySpecs: string
    status: string
    notRecorded: string
    /** Accessible name for the scrollable region wrapping the table. */
    region: string
    exactMatch: string
    asOf: string
  }
}) {
  const columnId = (name: string) => `${idPrefix}-column-${name}`
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
        className={`block w-full border-collapse text-sm lg:table ${hideLineColumns ? 'lg:min-w-[720px]' : 'lg:min-w-[900px]'}`}
      >
        <thead role="rowgroup" className="sr-only lg:not-sr-only lg:table-header-group">
          <tr role="row" className="border-b border-border bg-muted/40 text-left">
            <th
              id={columnId('product')}
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.product}
            </th>
            {hideLineColumns ? null : (
              <>
                <th
                  id={columnId('manufacturer')}
                  role="columnheader"
                  scope="col"
                  className="px-3 py-2 font-semibold"
                >
                  {labels.manufacturer}
                </th>
                <th
                  id={columnId('deviceType')}
                  role="columnheader"
                  scope="col"
                  className="px-3 py-2 font-semibold"
                >
                  {labels.deviceType}
                </th>
              </>
            )}
            <th
              id={columnId('catalogNumber')}
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.catalogNumber}
            </th>
            <th
              id={columnId('size')}
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.size}
            </th>
            <th
              id={columnId('keySpecs')}
              role="columnheader"
              scope="col"
              className="px-3 py-2 font-semibold"
            >
              {labels.keySpecs}
            </th>
            <th
              id={columnId('status')}
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
                headers={columnId('product')}
                className="order-1 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <Link
                  href={deviceDetailHref(locale, item.productId, returnContext) as Route}
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
                {item.verificationTier !== 'verified' ? (
                  // Unreachable through the cohort store; derived from the row rather than
                  // asserted, so a non-cohort item could never pass as source-verified.
                  <span className="mt-1 block">
                    <EvidenceBadge state="unknown">{item.verificationTier}</EvidenceBadge>
                  </span>
                ) : null}
                {saveLabels || compareLabels ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {saveLabels ? (
                      <SaveDeviceButton
                        productId={item.productId}
                        productName={item.productName}
                        catalogNumber={item.catalogNumber}
                        labels={saveLabels}
                      />
                    ) : null}
                    {compareLabels ? (
                      <CompareButton
                        productId={item.productId}
                        productName={item.productName}
                        catalogNumber={item.catalogNumber}
                        labels={compareLabels}
                      />
                    ) : null}
                  </div>
                ) : null}
              </td>
              {hideLineColumns ? null : (
                <>
                  <td
                    role="cell"
                    headers={columnId('manufacturer')}
                    className="order-2 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
                  >
                    {item.manufacturerDisplay}
                  </td>
                  <td
                    role="cell"
                    headers={columnId('deviceType')}
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
                </>
              )}
              <td
                role="cell"
                headers={columnId('catalogNumber')}
                className="order-4 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block text-[11px] font-semibold text-muted-foreground lg:hidden"
                >
                  {labels.catalogNumber}
                </span>
                {item.catalogNumber ? (
                  // Its own element, so the exact identifier can be located as exact text.
                  <span data-catalog-number>{item.catalogNumber}</span>
                ) : (
                  <span className="font-sans italic text-muted-foreground">
                    {labels.notRecorded}
                  </span>
                )}
              </td>
              <td
                role="cell"
                headers={columnId('size')}
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
                headers={columnId('keySpecs')}
                className="order-7 col-span-2 min-w-0 break-words [overflow-wrap:anywhere] lg:table-cell lg:px-3 lg:py-3"
              >
                <span
                  aria-hidden="true"
                  className="mb-1 block text-[11px] font-semibold text-muted-foreground lg:hidden"
                >
                  {labels.keySpecs}
                </span>
                {(specSummaryByProductId[item.productId] ?? []).length > 0 ? (
                  <dl className="space-y-0.5 text-xs">
                    {specSummaryByProductId[item.productId].map((entry) => (
                      <div key={entry.key} className="flex flex-wrap gap-x-1.5">
                        <dt className="text-muted-foreground">
                          {specLabels[entry.key] ?? entry.key}
                        </dt>
                        <dd className="font-medium">{entry.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <span className="italic text-muted-foreground">{labels.notRecorded}</span>
                )}
              </td>
              <td
                role="cell"
                headers={columnId('status')}
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
