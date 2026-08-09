import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogListItem } from '@/features/preference-cards/server/catalog'
import { EvidenceBadge } from './EvidenceBadge'

/**
 * Atlas results as an accessible table (card list on narrow screens via horizontal scroll
 * inside the container, never page overflow). Missing values render an explicit label —
 * thin data must not look like an empty shelf.
 */
export function AtlasResultsTable({
  locale,
  items,
  labels,
}: {
  locale: string
  items: CatalogListItem[]
  labels: {
    product: string
    manufacturer: string
    kind: string
    catalogNumber: string
    size: string
    evidence: string
    notRecorded: string
    verifiedSource: string
  }
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[760px] border-collapse text-sm">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
