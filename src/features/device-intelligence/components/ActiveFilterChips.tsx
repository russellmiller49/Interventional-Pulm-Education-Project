import type { Route } from 'next'
import Link from 'next/link'

import type { CatalogSearchQuery } from '@/features/preference-cards/schemas/catalog-search'
import {
  activeAtlasFilters,
  atlasIndexHref,
  withoutAtlasFilter,
  type ActiveAtlasFilter,
} from '@/features/device-intelligence/domain/atlas-query'

/**
 * The filters currently narrowing the results, each removable on its own. Every chip is a
 * link to the same search minus that one filter, so the others survive and the URL stays
 * shareable. No client JavaScript.
 */
export function ActiveFilterChips({
  locale,
  query,
  describe,
  labels,
}: {
  locale: string
  query: CatalogSearchQuery
  /** Human-readable text for one active filter (labels resolved by the page). */
  describe: (filter: ActiveAtlasFilter) => string
  labels: { heading: string; remove: string; clearAll: string }
}) {
  const filters = activeAtlasFilters(query)
  if (filters.length === 0) return null
  return (
    <section aria-label={labels.heading} className="flex flex-wrap items-center gap-2">
      <h2 className="sr-only">{labels.heading}</h2>
      <ul className="flex min-w-0 flex-wrap gap-2">
        {filters.map((filter) => {
          const text = describe(filter)
          return (
            <li key={filter.id}>
              <Link
                href={atlasIndexHref(locale, withoutAtlasFilter(query, filter.id)) as Route}
                data-filter-chip={filter.id}
                aria-label={`${labels.remove}: ${text}`}
                className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-3 pr-2 text-xs font-medium transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{text}</span>
                <span aria-hidden="true" className="text-base leading-none text-muted-foreground">
                  ×
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <Link
        href={`/${locale}/devices` as Route}
        className="inline-flex min-h-9 items-center rounded text-xs font-medium text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {labels.clearAll}
      </Link>
    </section>
  )
}
