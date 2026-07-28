import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from '@/i18n/navigation'

import type { CatalogSearchQuery } from '../schemas/catalog-search'
import type { CatalogFacets } from '../server/catalog'

export interface CatalogSearchFormLabels {
  query: string
  queryPlaceholder: string
  search: string
  examples: string
  filters: string
  clear: string
  manufacturer: string
  category: string
  subcategory: string
  role: string
  procedure: string
  anyOption: string
  tier: string
  tierAll: string
  tierVerified: string
  tierUnverified: string
  diameterMin: string
  diameterMax: string
  lengthMin: string
  lengthMax: string
  channelMax: string
  channelMaxHelp: string
  sort: string
  sortRelevance: string
  sortName: string
  sortManufacturer: string
  sortDiameter: string
  sortLength: string
}

interface CatalogSearchFormProps {
  facets: CatalogFacets
  labels: CatalogSearchFormLabels
  locale: string
  query: CatalogSearchQuery
}

const searchExamples = ['silicone stent', 'cryoprobe', 'EBUS needle', 'chest tube']

const numberFieldClass =
  'h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const selectFieldClass =
  'h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function CatalogSearchForm({ facets, labels, locale, query }: CatalogSearchFormProps) {
  const hasActiveFilters =
    query.manufacturers.length > 0 ||
    Boolean(query.category || query.subcategory || query.role || query.procedure) ||
    query.tier !== 'all' ||
    query.diameterMin !== undefined ||
    query.diameterMax !== undefined ||
    query.lengthMin !== undefined ||
    query.lengthMax !== undefined ||
    query.channelMax !== undefined

  const subcategories =
    facets.categories.find((category) => category.name === query.category)?.subcategories ?? []

  return (
    <form action={`/${locale}/preference-cards/catalog`} method="get" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="catalog-query">
          {labels.query}
        </label>
        <Input
          id="catalog-query"
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder={labels.queryPlaceholder}
          leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          className="min-h-12 flex-1"
        />
        <Button type="submit" className="h-12 px-7">
          {labels.search}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{labels.examples}:</span>
        {searchExamples.map((example) => (
          <Link
            key={example}
            href={`/preference-cards/catalog?q=${encodeURIComponent(example)}`}
            className="rounded-full border border-border px-3 py-1 transition hover:border-primary hover:text-primary"
          >
            {example}
          </Link>
        ))}
      </div>

      <details
        open={hasActiveFilters}
        className="rounded-2xl border border-border/80 bg-muted/25 p-4"
      >
        <summary className="cursor-pointer font-semibold">{labels.filters}</summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2 text-sm font-medium" htmlFor="catalog-manufacturers">
            <span>{labels.manufacturer}</span>
            <select
              id="catalog-manufacturers"
              name="manufacturer"
              multiple
              size={7}
              defaultValue={query.manufacturers}
              className="min-h-44 w-full rounded-xl border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {facets.manufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={manufacturer.id}>
                  {manufacturer.displayName} ({manufacturer.productCount})
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-4">
            <label className="block space-y-2 text-sm font-medium" htmlFor="catalog-category">
              <span>{labels.category}</span>
              <select
                id="catalog-category"
                name="category"
                defaultValue={query.category ?? ''}
                className={selectFieldClass}
              >
                <option value="">{labels.anyOption}</option>
                {facets.categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name} ({category.productCount})
                  </option>
                ))}
              </select>
            </label>

            {subcategories.length > 0 ? (
              <label className="block space-y-2 text-sm font-medium" htmlFor="catalog-subcategory">
                <span>{labels.subcategory}</span>
                <select
                  id="catalog-subcategory"
                  name="subcategory"
                  defaultValue={query.subcategory ?? ''}
                  className={selectFieldClass}
                >
                  <option value="">{labels.anyOption}</option>
                  {subcategories.map((subcategory) => (
                    <option key={subcategory.name} value={subcategory.name}>
                      {subcategory.name} ({subcategory.productCount})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block space-y-2 text-sm font-medium" htmlFor="catalog-tier">
              <span>{labels.tier}</span>
              <select
                id="catalog-tier"
                name="tier"
                defaultValue={query.tier}
                className={selectFieldClass}
              >
                <option value="all">{labels.tierAll}</option>
                <option value="verified">{labels.tierVerified}</option>
                <option value="unverified">{labels.tierUnverified}</option>
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <label className="block space-y-2 text-sm font-medium" htmlFor="catalog-role">
              <span>{labels.role}</span>
              <select
                id="catalog-role"
                name="role"
                defaultValue={query.role ?? ''}
                className={selectFieldClass}
              >
                <option value="">{labels.anyOption}</option>
                {facets.roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium" htmlFor="catalog-procedure">
              <span>{labels.procedure}</span>
              <select
                id="catalog-procedure"
                name="procedure"
                defaultValue={query.procedure ?? ''}
                className={selectFieldClass}
              >
                <option value="">{labels.anyOption}</option>
                {facets.procedures.map((procedure) => (
                  <option key={procedure.code} value={procedure.code}>
                    {procedure.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm font-medium" htmlFor="catalog-sort">
              <span>{labels.sort}</span>
              <select
                id="catalog-sort"
                name="sort"
                defaultValue={query.sort}
                className={selectFieldClass}
              >
                <option value="relevance">{labels.sortRelevance}</option>
                <option value="name">{labels.sortName}</option>
                <option value="manufacturer">{labels.sortManufacturer}</option>
                <option value="diameter">{labels.sortDiameter}</option>
                <option value="length">{labels.sortLength}</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-3 xl:grid-cols-5">
            <label className="space-y-2 text-sm font-medium" htmlFor="catalog-diameter-min">
              <span>{labels.diameterMin}</span>
              <input
                id="catalog-diameter-min"
                name="diameterMin"
                type="number"
                step="0.1"
                min="0"
                max="60"
                defaultValue={query.diameterMin}
                className={numberFieldClass}
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="catalog-diameter-max">
              <span>{labels.diameterMax}</span>
              <input
                id="catalog-diameter-max"
                name="diameterMax"
                type="number"
                step="0.1"
                min="0"
                max="60"
                defaultValue={query.diameterMax}
                className={numberFieldClass}
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="catalog-length-min">
              <span>{labels.lengthMin}</span>
              <input
                id="catalog-length-min"
                name="lengthMin"
                type="number"
                step="1"
                min="0"
                max="1000"
                defaultValue={query.lengthMin}
                className={numberFieldClass}
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="catalog-length-max">
              <span>{labels.lengthMax}</span>
              <input
                id="catalog-length-max"
                name="lengthMax"
                type="number"
                step="1"
                min="0"
                max="1000"
                defaultValue={query.lengthMax}
                className={numberFieldClass}
              />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="catalog-channel-max">
              <span>{labels.channelMax}</span>
              <input
                id="catalog-channel-max"
                name="channelMax"
                type="number"
                step="0.1"
                min="0"
                max="6"
                defaultValue={query.channelMax}
                className={numberFieldClass}
              />
              <span className="block text-xs font-normal text-muted-foreground">
                {labels.channelMaxHelp}
              </span>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="submit" size="sm">
            {labels.search}
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/preference-cards/catalog">{labels.clear}</Link>
          </Button>
        </div>
      </details>
    </form>
  )
}
