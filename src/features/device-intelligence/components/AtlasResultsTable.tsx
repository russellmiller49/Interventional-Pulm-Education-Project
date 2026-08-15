import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogListItem } from '@/features/preference-cards/server/catalog'
import {
  UNRESEARCHED_PRODUCT_STATUS,
  type ProductStatusView,
} from '@/features/device-intelligence/domain/product-status'
import { EvidenceBadge } from './EvidenceBadge'
import { ProductStatusBadges, type ProductStatusLabels } from './ProductStatus'

/**
 * Atlas results as an accessible table (card list on narrow screens via horizontal scroll
 * inside the container, never page overflow). Missing values render an explicit label —
 * thin data must not look like an empty shelf.
 *
 * D2B adds one compact market/safety column. It is deliberately the LAST column and made of
 * small badges: under the inclusion-first policy most rows carry an uncertainty label, and
 * uncertainty must not visually outweigh the product's name, manufacturer, kind, or catalog
 * number.
 */
export function AtlasResultsTable({
  locale,
  items,
  statusByProductId,
  statusLabels,
  labels,
}: {
  locale: string
  items: CatalogListItem[]
  statusByProductId: Record<string, ProductStatusView>
  statusLabels: ProductStatusLabels
  labels: {
    product: string
    manufacturer: string
    kind: string
    catalogNumber: string
    size: string
    evidence: string
    status: string
    notRecorded: string
    verifiedSource: string
    /** Accessible name for the scrollable region wrapping the table. */
    region: string
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
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.product}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.manufacturer}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.kind}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.catalogNumber}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.size}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.evidence}
            </th>
            <th scope="col" className="px-3 py-2 font-semibold">
              {labels.status}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.productId} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2">
                <Link
                  href={`/${locale}/devices/${item.productId}` as Route}
                  className="font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.productName}
                </Link>
              </td>
              <td className="px-3 py-2">{item.manufacturerDisplay}</td>
              <td className="px-3 py-2">
                {item.subcategory ?? item.primaryCategory ?? (
                  <span className="italic text-muted-foreground">{labels.notRecorded}</span>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {item.catalogNumber ?? (
                  <span className="font-sans italic text-muted-foreground">
                    {labels.notRecorded}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                {item.sizeDisplay ?? (
                  <span className="italic text-muted-foreground">{labels.notRecorded}</span>
                )}
              </td>
              <td className="px-3 py-2">
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
              <td className="px-3 py-2">
                <ProductStatusBadges
                  status={statusByProductId[item.productId] ?? UNRESEARCHED_PRODUCT_STATUS}
                  labels={statusLabels}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
