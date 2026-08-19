import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Card, CardContent } from '@/components/ui/card'
import { CatalogPagination } from '@/features/preference-cards/components/CatalogPagination'
import {
  catalogPageSearchParamsToUrl,
  catalogSearchInputFromUrl,
  catalogSearchSchema,
  type CatalogPageSearchParams,
} from '@/features/preference-cards/schemas/catalog-search'
import { AtlasResultsTable } from '@/features/device-intelligence/components/AtlasResultsTable'
import { AtlasSearchForm } from '@/features/device-intelligence/components/AtlasSearchForm'
import { EvidenceBadge } from '@/features/device-intelligence/components/EvidenceBadge'
import {
  getAtlasFacets,
  getAtlasOverview,
  searchAtlas,
  validateAtlasFilters,
} from '@/features/device-intelligence/server/atlas.server'
import { getTaxonomyLabels } from '@/features/device-intelligence/server/product-taxonomy.server'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<CatalogPageSearchParams>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.devices' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function DevicesIndexPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.devices')
  const tCommon = await getTranslations('deviceIntelligence.common')

  const urlSearchParams = catalogPageSearchParamsToUrl(await searchParams)
  const parsed = catalogSearchSchema.safeParse(catalogSearchInputFromUrl(urlSearchParams))
  const query = parsed.success ? parsed.data : catalogSearchSchema.parse({})
  const unknownFilter = parsed.success ? validateAtlasFilters(query) : null
  // D2C: a stale bookmark can still carry the retired `category` filter. It is reported
  // honestly and never applied — the normalized Device class facet replaced it.
  const legacyCategoryRequested = Boolean(query.category)

  const facets = getAtlasFacets()
  const overview = getAtlasOverview()
  const results = unknownFilter ? null : searchAtlas(query)
  const statusLabels = await getProductStatusLabels(locale)
  const taxonomyLabels = getTaxonomyLabels(locale)
  const deviceTypeByProductId = Object.fromEntries(
    Object.entries(results?.taxonomyByProductId ?? {}).map(([productId, taxonomy]) => [
      productId,
      taxonomyLabels.subtypes[taxonomy.deviceSubtypeCode] ??
        taxonomyLabels.classes[taxonomy.deviceClassCode],
    ]),
  )

  return (
    <div className="container space-y-6 py-8 md:py-10">
      <header className="max-w-4xl space-y-3">
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{t('intro')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge state="verified_source_fact">
            {t('cohortBadge', { count: overview.productCount })}
          </EvidenceBadge>
          <p className="text-xs text-muted-foreground">{t('cohortRule')}</p>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t('exclusionNote')}</p>
        {/* D2B: the atlas now includes products whose current availability is unestablished,
            so the index says up front what the market/safety labels do and do not mean. */}
        <p className="text-xs leading-5 text-muted-foreground">{t('statusNote')}</p>
      </header>

      <Card>
        <CardContent className="p-4">
          <AtlasSearchForm
            locale={locale}
            query={query}
            facets={facets}
            deviceClassLabels={taxonomyLabels.classes}
            labels={{
              search: t('form.search'),
              searchPlaceholder: t('form.searchPlaceholder'),
              manufacturer: t('form.manufacturer'),
              deviceClass: t('form.deviceClass'),
              role: t('form.role'),
              procedure: t('form.procedure'),
              any: t('form.any'),
              apply: t('form.apply'),
              clear: t('form.clear'),
            }}
          />
        </CardContent>
      </Card>

      {unknownFilter ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            {t('unknownFilter', { filter: unknownFilter })}{' '}
            <Link href={`/${locale}/devices` as Route} className="underline">
              {t('form.clear')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {legacyCategoryRequested ? (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">
            {t('legacyCategoryNotice')}{' '}
            <Link href={`/${locale}/devices` as Route} className="underline">
              {t('form.clear')}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {results ? (
        <section aria-label={t('resultsHeading')} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t('resultCount', { count: results.total })}</h2>
            {results.excludedMissingSpecCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('excludedMissingSpec', { count: results.excludedMissingSpecCount })}
              </p>
            ) : null}
          </div>
          {results.items.length > 0 ? (
            <AtlasResultsTable
              locale={locale}
              items={results.items}
              statusByProductId={results.statusByProductId}
              deviceTypeByProductId={deviceTypeByProductId}
              statusLabels={statusLabels}
              labels={{
                product: t('table.product'),
                manufacturer: t('table.manufacturer'),
                deviceType: t('table.deviceType'),
                catalogNumber: t('table.catalogNumber'),
                size: t('table.size'),
                evidence: t('table.evidence'),
                status: t('table.status'),
                notRecorded: tCommon('notRecorded'),
                verifiedSource: tCommon('badges.verifiedSource'),
                region: t('resultsRegionLabel'),
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                {t('noResults')}
              </CardContent>
            </Card>
          )}
          <CatalogPagination
            labels={{
              next: t('pagination.next'),
              page: t('pagination.page'),
              previous: t('pagination.previous'),
            }}
            pageCount={results.pageCount}
            page={results.page}
            query={query}
            basePath="/devices"
          />
        </section>
      ) : null}

      <p className="border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
      </p>
    </div>
  )
}
