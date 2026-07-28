import Link from 'next/link'
import type { Route } from 'next'

import { cn } from '@/lib/cn'

import { VerificationBadge, type VerificationBadgeLabels } from './VerificationBadge'
import type { CatalogListItem } from '../server/catalog'

export interface CatalogResultsLabels extends VerificationBadgeLabels {
  product: string
  manufacturer: string
  catalogNumber: string
  category: string
  size: string
  verification: string
  missingValue: string
}

interface CatalogResultsTableProps {
  items: CatalogListItem[]
  labels: CatalogResultsLabels
  locale: string
  className?: string
}

export function CatalogResultsTable({
  items,
  labels,
  locale,
  className,
}: CatalogResultsTableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border', className)}>
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.product}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.manufacturer}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.catalogNumber}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.size}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.category}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.verification}
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.productId} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3">
                <Link
                  href={`/${locale}/preference-cards/catalog/product/${item.productId}` as Route}
                  className="font-medium text-foreground hover:text-primary hover:underline"
                >
                  {item.productName}
                </Link>
                {item.brandFamily ? (
                  <span className="block text-xs text-muted-foreground">{item.brandFamily}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">{item.manufacturerDisplay}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {item.catalogNumber ?? labels.missingValue}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {item.sizeDisplay ?? labels.missingValue}
              </td>
              <td className="px-4 py-3 text-xs">
                {item.primaryCategory ?? labels.missingValue}
                {item.subcategory ? (
                  <span className="block text-muted-foreground">{item.subcategory}</span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <VerificationBadge
                  tier={item.verificationTier}
                  usStatusPending={item.usStatusPending}
                  distributionStatus={item.distributionStatus}
                  labels={labels}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
