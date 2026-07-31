import Link from 'next/link'
import type { Route } from 'next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

import { VerificationBadge, type VerificationBadgeLabels } from './VerificationBadge'
import type { SpecColumnLabels } from './RoleComparisonTable'
import type { CatalogListItem, ProductFamily, SpecColumnKey } from '../server/catalog'

export interface ProductFamilyLabels extends VerificationBadgeLabels {
  family: string
  sizes: string
  showSizes: string
  product: string
  catalogNumber: string
  size: string
  verification: string
  missingValue: string
}

interface ProductFamilyTableProps {
  families: ProductFamily[]
  /**
   * Variant count per family, formatted by the caller so plural rules stay inside
   * next-intl rather than being faked with string replacement.
   */
  variantCounts: Record<string, string>
  specLabels: SpecColumnLabels
  labels: ProductFamilyLabels
  locale: string
  className?: string
}

function formatRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`
}

function assertNoMissingVariantSpec(key: never): null {
  void key
  return null
}

function variantSpec(item: CatalogListItem, key: SpecColumnKey): string | null {
  const value = (() => {
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
      case 'laser_type':
        return item.laserType
      case 'material':
        return item.material
      case 'coverage':
        return item.coverage
      default:
        // Exhaustive by construction, for the same reason as RoleComparisonTable: this had
        // been silently dropping the text spec columns, so the header rendered with nothing
        // under it. A missing case is now a compile error.
        return assertNoMissingVariantSpec(key)
    }
  })()
  return value === null || value === undefined || value === '' ? null : String(value)
}

/**
 * One row per product line, expanding to its size variants.
 *
 * A crowded role is unreadable as a flat list — silicone straight stents alone hold 105
 * products that are really four Dumon families in many diameters and lengths. The collapsed
 * row carries the size range so the family can be compared without expanding, and the
 * variant table underneath carries the individual catalog numbers to order.
 *
 * Expansion uses `<details>`, so this stays a server component with no client JavaScript.
 */
export function ProductFamilyTable({
  families,
  variantCounts,
  specLabels,
  labels,
  locale,
  className,
}: ProductFamilyTableProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {families.map((family) => (
        <details
          key={family.familyKey}
          className="group rounded-xl border border-border bg-background"
        >
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{family.manufacturerDisplay}</p>
              <p className="font-medium text-foreground">{family.familyName}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {family.specRanges.map((range) => (
                  <span key={range.key} className="mr-3 whitespace-nowrap">
                    {specLabels[range.key]} {formatRange(range.min, range.max)}
                  </span>
                ))}
                {family.placementMethods.length > 0 ? (
                  <span className="mr-3">{family.placementMethods.join(' · ')}</span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" size="sm" className="normal-case tracking-normal">
                {variantCounts[family.familyKey] ?? ''}
              </Badge>
              <VerificationBadge
                tier={family.verifiedCount === family.variants.length ? 'verified' : 'candidate'}
                distributionStatus={family.distributionStatus}
                catalogLifecycleContext={family.catalogLifecycleContext ?? 'unknown'}
                regulatoryStatus={family.regulatoryStatus ?? 'unknown'}
                labels={labels}
              />
              <span className="text-xs text-muted-foreground group-open:hidden">
                {labels.showSizes}
              </span>
            </div>
          </summary>

          <div className="overflow-x-auto border-t border-border">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-muted/30 text-left">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {labels.product}
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {labels.catalogNumber}
                  </th>
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {labels.size}
                  </th>
                  {family.specRanges.map((range) => (
                    <th
                      key={range.key}
                      scope="col"
                      className="whitespace-nowrap px-4 py-2 font-semibold"
                    >
                      {specLabels[range.key]}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2 font-semibold">
                    {labels.verification}
                  </th>
                </tr>
              </thead>
              <tbody>
                {family.variants.map((variant) => (
                  <tr key={variant.productId} className="border-t border-border/60">
                    <td className="px-4 py-2">
                      <Link
                        href={
                          `/${locale}/preference-cards/catalog/product/${variant.productId}` as Route
                        }
                        className="text-foreground hover:text-primary hover:underline"
                      >
                        {variant.productName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {variant.catalogNumber ?? labels.missingValue}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {variant.sizeDisplay ?? labels.missingValue}
                    </td>
                    {family.specRanges.map((range) => (
                      <td key={range.key} className="whitespace-nowrap px-4 py-2 tabular-nums">
                        {variantSpec(variant, range.key) ?? (
                          <span className="text-muted-foreground">{labels.missingValue}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2">
                      <VerificationBadge
                        tier={variant.verificationTier}
                        usStatusPending={variant.usStatusPending}
                        distributionStatus={variant.distributionStatus}
                        catalogLifecycleContext={variant.catalogLifecycleContext}
                        lifecycleNote={variant.lifecycleNote}
                        regulatoryStatus={variant.regulatoryStatus}
                        regulatoryNote={variant.regulatoryNote}
                        labels={labels}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  )
}
