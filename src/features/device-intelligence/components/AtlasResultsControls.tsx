import type { Route } from 'next'

import {
  catalogSortValues,
  serializeCatalogSearchQuery,
  type CatalogSearchQuery,
  type CatalogViewValue,
} from '@/features/preference-cards/schemas/catalog-search'
import { atlasIndexHref } from '@/features/device-intelligence/domain/atlas-query'
import { AutoSubmitSelect } from './AutoSubmitSelect'
import { LinkTabs } from './LinkTabs'

/**
 * View and sort controls for the results. Both are URL state: the view toggle is a pair of
 * links, and sort is a tiny GET form that re-submits the current search with a new `sort`.
 */
export function AtlasResultsControls({
  locale,
  query,
  view,
  labels,
}: {
  locale: string
  query: CatalogSearchQuery
  /** The view actually rendered (the page's default applies when the URL names none). */
  view: CatalogViewValue
  labels: {
    viewLabel: string
    families: string
    models: string
    sort: string
    applySort: string
    sortOptions: Record<(typeof catalogSortValues)[number], string>
  }
}) {
  // Everything except sort and page, re-submitted as hidden fields.
  const carried = [
    ...new URLSearchParams(
      serializeCatalogSearchQuery({ ...query, sort: 'relevance', page: 1 }),
    ).entries(),
  ]
  return (
    <div className="flex flex-wrap items-end gap-3">
      <LinkTabs
        label={labels.viewLabel}
        tabs={[
          {
            key: 'families',
            label: labels.families,
            // Families is the index default, so its link carries no `view` parameter.
            href: atlasIndexHref(locale, { ...query, view: undefined, page: 1 }) as Route,
            active: view === 'families',
          },
          {
            key: 'models',
            label: labels.models,
            href: atlasIndexHref(locale, { ...query, view: 'models', page: 1 }) as Route,
            active: view === 'models',
          },
        ]}
      />
      <form action={`/${locale}/devices`} method="get" className="flex items-end gap-2">
        {carried.map(([name, value], index) => (
          <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
        ))}
        <div className="flex flex-col gap-1">
          <label htmlFor="atlas-sort" className="text-xs font-semibold text-muted-foreground">
            {labels.sort}
          </label>
          <AutoSubmitSelect
            id="atlas-sort"
            name="sort"
            defaultValue={query.sort}
            className="h-10 rounded-lg border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {catalogSortValues.map((value) => (
              <option key={value} value={value}>
                {labels.sortOptions[value]}
              </option>
            ))}
          </AutoSubmitSelect>
        </div>
        <noscript>
          <button
            type="submit"
            className="h-10 rounded-lg border border-border px-3 text-sm font-semibold"
          >
            {labels.applySort}
          </button>
        </noscript>
      </form>
    </div>
  )
}
