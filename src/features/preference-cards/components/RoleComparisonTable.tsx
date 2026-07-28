import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

import { VerificationBadge, type VerificationBadgeLabels } from './VerificationBadge'
import type { CatalogListItem, SpecColumnKey, UseDetailManufacturerGroup } from '../server/catalog'

export type SpecColumnLabels = Record<SpecColumnKey, string>

export interface RoleComparisonLabels extends VerificationBadgeLabels {
  product: string
  catalogNumber: string
  size: string
  fit: string
  verification: string
  missingValue: string
}

interface RoleComparisonTableProps {
  groups: UseDetailManufacturerGroup[]
  specColumns: SpecColumnKey[]
  specLabels: SpecColumnLabels
  labels: RoleComparisonLabels
  /**
   * Per-manufacturer summary line, keyed by manufacturerGroupId. Formatted by the caller
   * so plural and number formatting stay inside next-intl rather than string replacement.
   */
  groupSummaries: Record<string, string>
  locale: string
  className?: string
}

function readSpec(item: CatalogListItem, key: SpecColumnKey): string | null {
  const raw = (() => {
    switch (key) {
      case 'diameter_mm':
        return item.diameterMm
      case 'length_mm':
        return item.lengthMm
      case 'french_size':
        return item.frenchSize
      case 'gauge':
        return item.gauge
      case 'working_length_cm':
        return item.workingLengthCm
      case 'min_working_channel_mm':
        return item.minWorkingChannelMm
      case 'delivery_system_od_mm':
        return item.deliverySystemOdMm
      case 'material':
        return item.material
      case 'coverage':
        return item.coverage
      default:
        return null
    }
  })()
  if (raw === null || raw === undefined || raw === '') return null
  return String(raw)
}

/**
 * Cross-manufacturer comparison for one clinical use. Grouped by manufacturer so the
 * "who else makes this" question is answered by scanning the group headers.
 */
export function RoleComparisonTable({
  groups,
  specColumns,
  specLabels,
  labels,
  groupSummaries,
  locale,
  className,
}: RoleComparisonTableProps) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border', className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.product}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.catalogNumber}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.size}
            </th>
            {specColumns.map((key) => (
              <th key={key} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                {specLabels[key]}
              </th>
            ))}
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.fit}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              {labels.verification}
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.manufacturerGroupId}>
            <tr className="border-b border-border bg-muted/20">
              <th
                scope="colgroup"
                colSpan={5 + specColumns.length}
                className="px-4 py-2.5 text-left"
              >
                <span className="font-bold text-foreground">{group.manufacturerDisplay}</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {groupSummaries[group.manufacturerGroupId] ?? ''}
                </span>
              </th>
            </tr>
            {group.items.map((item) => (
              <tr key={item.productId} className="border-b border-border/60">
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
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {item.catalogNumber ?? labels.missingValue}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {item.sizeDisplay ?? labels.missingValue}
                </td>
                {specColumns.map((key) => (
                  <td key={key} className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {readSpec(item, key) ?? (
                      <span className="text-muted-foreground">{labels.missingValue}</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3">
                  {item.roleFit ? (
                    <Badge variant="outline" size="sm" className="normal-case tracking-normal">
                      {item.roleFit}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{labels.missingValue}</span>
                  )}
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
        ))}
      </table>
    </div>
  )
}
