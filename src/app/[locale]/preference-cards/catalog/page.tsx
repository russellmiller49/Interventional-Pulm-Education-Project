import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Layers, SlidersHorizontal } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CatalogPagination } from '@/features/preference-cards/components/CatalogPagination'
import { CatalogResultsTable } from '@/features/preference-cards/components/CatalogResultsTable'
import { CatalogSearchForm } from '@/features/preference-cards/components/CatalogSearchForm'
import { VerificationLegend } from '@/features/preference-cards/components/VerificationBadge'
import {
  catalogPageSearchParamsToUrl,
  catalogSearchInputFromUrl,
  catalogSearchSchema,
  serializeCatalogSearchQuery,
  type CatalogPageSearchParams,
  type CatalogSearchQuery,
} from '@/features/preference-cards/schemas/catalog-search'
import {
  getCatalogFacets,
  getCatalogOverview,
  searchCatalog,
  validateKnownCatalogFilters,
} from '@/features/preference-cards/server/catalog'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<CatalogPageSearchParams>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards.catalog' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function CatalogSearchPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards.catalog')

  const urlSearchParams = catalogPageSearchParamsToUrl(await searchParams)
  const parsed = catalogSearchSchema.safeParse(catalogSearchInputFromUrl(urlSearchParams))
  const query = parsed.success ? parsed.data : catalogSearchSchema.parse({})
  const unknownFilter = parsed.success ? validateKnownCatalogFilters(query) : null

  const facets = getCatalogFacets()
  const overview = getCatalogOverview()
  const results = unknownFilter ? null : searchCatalog(query)

  const queryHref = (next: CatalogSearchQuery) => {
    const serialized = serializeCatalogSearchQuery(next)
    return `/${locale}/preference-cards/catalog${serialized ? `?${serialized}` : ''}` as Route
  }

  const activeFilters: { key: string; label: string; href: Route }[] = []
  for (const manufacturerId of query.manufacturers) {
    const manufacturer = facets.manufacturers.find((entry) => entry.id === manufacturerId)
    activeFilters.push({
      key: `manufacturer-${manufacturerId}`,
      label: manufacturer?.displayName ?? manufacturerId,
      href: queryHref({
        ...query,
        manufacturers: query.manufacturers.filter((id) => id !== manufacturerId),
        page: 1,
      }),
    })
  }
  if (query.category) {
    activeFilters.push({
      key: 'category',
      label: query.category,
      href: queryHref({ ...query, category: undefined, subcategory: undefined, page: 1 }),
    })
  }
  if (query.subcategory) {
    activeFilters.push({
      key: 'subcategory',
      label: query.subcategory,
      href: queryHref({ ...query, subcategory: undefined, page: 1 }),
    })
  }
  if (query.role) {
    const role = facets.roles.find((entry) => entry.code === query.role)
    activeFilters.push({
      key: 'role',
      label: role?.name ?? query.role,
      href: queryHref({ ...query, role: undefined, page: 1 }),
    })
  }
  if (query.procedure) {
    const procedure = facets.procedures.find((entry) => entry.code === query.procedure)
    activeFilters.push({
      key: 'procedure',
      label: procedure?.name ?? query.procedure,
      href: queryHref({ ...query, procedure: undefined, page: 1 }),
    })
  }
  if (query.tier !== 'all') {
    activeFilters.push({
      key: 'tier',
      label: query.tier === 'verified' ? t('form.tierVerified') : t('form.tierUnverified'),
      href: queryHref({ ...query, tier: 'all', page: 1 }),
    })
  }
  if (query.diameterMin !== undefined || query.diameterMax !== undefined) {
    activeFilters.push({
      key: 'diameter',
      label: `${t('specs.diameter_mm')} ${query.diameterMin ?? '…'}–${query.diameterMax ?? '…'}`,
      href: queryHref({ ...query, diameterMin: undefined, diameterMax: undefined, page: 1 }),
    })
  }
  if (query.lengthMin !== undefined || query.lengthMax !== undefined) {
    activeFilters.push({
      key: 'length',
      label: `${t('specs.length_mm')} ${query.lengthMin ?? '…'}–${query.lengthMax ?? '…'}`,
      href: queryHref({ ...query, lengthMin: undefined, lengthMax: undefined, page: 1 }),
    })
  }
  if (query.channelMax !== undefined) {
    activeFilters.push({
      key: 'channel',
      label: `${t('form.channelMax')} ≤ ${query.channelMax}`,
      href: queryHref({ ...query, channelMax: undefined, page: 1 }),
    })
  }

  const verificationLabels = {
    verified: t('verification.verified'),
    candidate: t('verification.candidate'),
    unknown: t('verification.unknown'),
    usPending: t('verification.usPending'),
    notDistributed: t('verification.notDistributed'),
    conflictingDistribution: t('verification.conflictingDistribution'),
    legacyInstalledBase: t('verification.legacyInstalledBase'),
    legacyInstalledBaseHelp: t('verification.legacyInstalledBaseHelp'),
    legendTitle: t('verification.legendTitle'),
    verifiedHelp: t('verification.verifiedHelp'),
    candidateHelp: t('verification.candidateHelp'),
    usPendingHelp: t('verification.usPendingHelp'),
    notDistributedHelp: t('verification.notDistributedHelp'),
    conflictingDistributionHelp: t('verification.conflictingDistributionHelp'),
  }

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <header className="max-w-4xl space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
          {t('heading')}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{t('description')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" size="lg" className="normal-case tracking-normal">
            {t('overviewCounts', {
              products: overview.productCount,
              manufacturers: overview.manufacturerCount,
              uses: overview.roleCount,
            })}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/preference-cards/catalog/uses` as Route}>
              <Layers aria-hidden="true" className="h-4 w-4" />
              {t('browseByUse')}
            </Link>
          </Button>
        </div>
      </header>

      <CatalogSearchForm
        facets={facets}
        locale={locale}
        query={query}
        labels={{
          query: t('form.query'),
          queryPlaceholder: t('form.queryPlaceholder'),
          search: t('form.search'),
          examples: t('form.examples'),
          filters: t('form.filters'),
          clear: t('form.clear'),
          manufacturer: t('form.manufacturer'),
          category: t('form.category'),
          subcategory: t('form.subcategory'),
          role: t('form.role'),
          procedure: t('form.procedure'),
          anyOption: t('form.anyOption'),
          tier: t('form.tier'),
          tierAll: t('form.tierAll'),
          tierVerified: t('form.tierVerified'),
          tierUnverified: t('form.tierUnverified'),
          diameterMin: t('form.diameterMin'),
          diameterMax: t('form.diameterMax'),
          lengthMin: t('form.lengthMin'),
          lengthMax: t('form.lengthMax'),
          channelMax: t('form.channelMax'),
          channelMaxHelp: t('form.channelMaxHelp'),
          sort: t('form.sort'),
          sortRelevance: t('form.sortRelevance'),
          sortName: t('form.sortName'),
          sortManufacturer: t('form.sortManufacturer'),
          sortDiameter: t('form.sortDiameter'),
          sortLength: t('form.sortLength'),
        }}
      />

      {activeFilters.length > 0 ? (
        <section aria-label={t('activeFilters')} className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-medium">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {t('activeFilters')}
          </span>
          {activeFilters.map((filter) => (
            <Link
              key={filter.key}
              href={filter.href}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:border-primary hover:text-primary"
              aria-label={t('removeFilter', { filter: filter.label })}
            >
              {filter.label} ×
            </Link>
          ))}
        </section>
      ) : null}

      <section className="space-y-4" aria-live="polite">
        {unknownFilter ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-6 text-sm">
              <h2 className="font-semibold">{t('invalidFilterTitle')}</h2>
              <p className="mt-1 text-muted-foreground">
                {t('invalidFilterBody', { filter: unknownFilter })}
              </p>
            </CardContent>
          </Card>
        ) : results ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{t('resultsHeading')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('resultCount', { count: results.total })}
                </p>
              </div>
              {results.excludedMissingSpecCount > 0 ? (
                <p className="max-w-md text-xs text-muted-foreground">
                  {t('excludedMissingSpec', { count: results.excludedMissingSpecCount })}
                </p>
              ) : null}
            </div>

            {results.items.length > 0 ? (
              <CatalogResultsTable
                items={results.items}
                locale={locale}
                labels={{
                  product: t('columns.product'),
                  manufacturer: t('columns.manufacturer'),
                  catalogNumber: t('columns.catalogNumber'),
                  category: t('columns.category'),
                  size: t('columns.size'),
                  verification: t('columns.verification'),
                  missingValue: t('missingValue'),
                  verified: t('verification.verified'),
                  candidate: t('verification.candidate'),
                  unknown: t('verification.unknown'),
                  usPending: t('verification.usPending'),
                  notDistributed: t('verification.notDistributed'),
                  conflictingDistribution: t('verification.conflictingDistribution'),
                  legacyInstalledBase: t('verification.legacyInstalledBase'),
                  legacyInstalledBaseHelp: t('verification.legacyInstalledBaseHelp'),
                }}
              />
            ) : (
              <Card className="bg-muted/30">
                <CardContent className="p-8 text-center">
                  <h2 className="font-semibold">{t('noResultsTitle')}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('noResultsBody')}</p>
                </CardContent>
              </Card>
            )}

            <CatalogPagination
              labels={{
                next: t('pagination.next'),
                page: t('pagination.page'),
                previous: t('pagination.previous'),
              }}
              page={results.page}
              pageCount={results.pageCount}
              query={query}
            />
          </>
        ) : null}
      </section>

      <VerificationLegend labels={verificationLabels} />

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('dataLanguageNote')} {t('disclaimer')}
      </p>
    </div>
  )
}
