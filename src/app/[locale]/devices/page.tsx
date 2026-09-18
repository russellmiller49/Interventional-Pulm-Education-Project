import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Card, CardContent } from '@/components/ui/card'
import { CatalogPagination } from '@/features/preference-cards/components/CatalogPagination'
import {
  catalogPageSearchParamsToUrl,
  catalogSearchInputFromUrl,
  catalogSearchSchema,
  catalogSortValues,
  type CatalogPageSearchParams,
  type CatalogViewValue,
} from '@/features/preference-cards/schemas/catalog-search'
import { ActiveFilterChips } from '@/features/device-intelligence/components/ActiveFilterChips'
import { AtlasFamilyList } from '@/features/device-intelligence/components/AtlasFamilyList'
import { AtlasResultsControls } from '@/features/device-intelligence/components/AtlasResultsControls'
import { AtlasResultsTable } from '@/features/device-intelligence/components/AtlasResultsTable'
import { AtlasSearchForm } from '@/features/device-intelligence/components/AtlasSearchForm'
import { DeviceTaskNav } from '@/features/device-intelligence/components/DeviceTaskNav'
import { DeviceTypeBrowser } from '@/features/device-intelligence/components/DeviceTypeBrowser'
import { EvidenceBadge } from '@/features/device-intelligence/components/EvidenceBadge'
import {
  atlasIndexHref,
  encodeReturnContext,
  hasActiveSpecFilter,
  normalizeAtlasQuery,
  type ActiveAtlasFilter,
} from '@/features/device-intelligence/domain/atlas-query'
import {
  ATLAS_SPEC_FIELDS,
  ATLAS_SPEC_FILTERS,
  modelSpecSummary,
  type AtlasSpecFieldKey,
  type AtlasSpecFilterKey,
} from '@/features/device-intelligence/domain/device-display-config'
import {
  getAtlasFacets,
  getAtlasFamilyName,
  getAtlasOverview,
  getAtlasEvidenceCoverage,
  getAtlasSubtypeFacets,
  searchAtlas,
  validateAtlasFilters,
} from '@/features/device-intelligence/server/atlas.server'
import { getTaxonomyLabels } from '@/features/device-intelligence/server/product-taxonomy.server'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'
import {
  getCompareLabels,
  getSaveDeviceLabels,
} from '@/features/device-intelligence/server/reference-labels.server'

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

/**
 * The index default. Discovery browses product lines; an exact identifier is still pinned
 * above them, and the model view is one link away. The query layer's own default stays
 * `models`, so this is purely the page's presentation choice.
 */
const INDEX_DEFAULT_VIEW: CatalogViewValue = 'families'

const SPEC_FIELD_KEYS = Object.keys(ATLAS_SPEC_FIELDS) as AtlasSpecFieldKey[]
const SPEC_FILTER_KEYS = Object.keys(ATLAS_SPEC_FILTERS) as AtlasSpecFilterKey[]

export default async function DevicesIndexPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.devices')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const tDevice = await getTranslations('deviceIntelligence.device')
  const tReference = await getTranslations('deviceIntelligence.reference')

  const urlSearchParams = catalogPageSearchParamsToUrl(await searchParams)
  const parsed = catalogSearchSchema.safeParse(catalogSearchInputFromUrl(urlSearchParams))
  const normalized = normalizeAtlasQuery(
    parsed.success ? parsed.data : catalogSearchSchema.parse({}),
  )
  const query = normalized.query
  const unknownFilter = parsed.success ? validateAtlasFilters(query) : null
  // D2C: a stale bookmark can still carry the retired `category` or `subcategory`
  // filter. Both are reported honestly and never applied — the normalized Device class
  // facet replaced that axis (searchAtlas strips both before querying).
  const legacyCategoryRequested = Boolean(query.category || query.subcategory)

  const view = query.view ?? INDEX_DEFAULT_VIEW
  const facets = getAtlasFacets()
  const overview = getAtlasOverview()
  const coverage = getAtlasEvidenceCoverage()
  const results = unknownFilter ? null : searchAtlas({ ...query, view })
  const statusLabels = await getProductStatusLabels(locale)
  const saveLabels = await getSaveDeviceLabels(locale)
  const compareLabels = await getCompareLabels(locale)
  const taxonomyLabels = getTaxonomyLabels(locale)
  const deviceTypeByProductId = Object.fromEntries(
    Object.entries(results?.taxonomyByProductId ?? {}).map(([productId, taxonomy]) => [
      productId,
      taxonomyLabels.subtypes[taxonomy.deviceSubtypeCode] ??
        taxonomyLabels.classes[taxonomy.deviceClassCode],
    ]),
  )

  const classes = facets.deviceClasses.map((facet) => ({
    code: facet.code as string,
    label: taxonomyLabels.classes[facet.code] ?? facet.code,
    productCount: facet.productCount,
  }))
  const subtypes =
    query.deviceClass && !unknownFilter
      ? getAtlasSubtypeFacets(query.deviceClass).map((facet) => ({
          code: facet.code as string,
          label: taxonomyLabels.subtypes[facet.code] ?? facet.code,
          productCount: facet.productCount,
        }))
      : []
  const selectedClassLabel = query.deviceClass ? taxonomyLabels.classes[query.deviceClass] : null

  const specLabels = Object.fromEntries(
    SPEC_FIELD_KEYS.map((key) => [key, t(`specs.${key}`)]),
  ) as Record<AtlasSpecFieldKey, string>
  const specFilterLabels = Object.fromEntries(
    SPEC_FILTER_KEYS.map((key) => [key, t(`specFilters.${key}`)]),
  ) as Record<AtlasSpecFilterKey, string>
  const activeSpecFilterNames = SPEC_FILTER_KEYS.filter((key) => {
    const definition = ATLAS_SPEC_FILTERS[key]
    return definition.kind === 'range'
      ? query[definition.minParam] !== undefined || query[definition.maxParam] !== undefined
      : query[definition.param] !== undefined
    // Named by the recorded field ("Gauge"), not by the filter ("Recorded gauge").
  }).map((key) => specLabels[key === 'channelMax' ? 'minWorkingChannel' : key])

  const rangeText = (filter: ActiveAtlasFilter, unit: string) =>
    filter.min !== undefined && filter.max !== undefined
      ? `${filter.min}–${filter.max} ${unit}`
      : filter.min !== undefined
        ? `≥ ${filter.min} ${unit}`
        : `≤ ${filter.max} ${unit}`
  const describeFilter = (filter: ActiveAtlasFilter): string => {
    if (filter.id.startsWith('manufacturer:')) {
      return (
        facets.manufacturers.find((entry) => entry.id === filter.value)?.displayName ?? filter.value
      )
    }
    switch (filter.id) {
      case 'q':
        return t('chips.search', { query: filter.value })
      case 'deviceClass':
        return taxonomyLabels.classes[filter.value] ?? filter.value
      case 'deviceSubtype':
        return taxonomyLabels.subtypes[filter.value] ?? filter.value
      case 'family':
        return t('chips.family', { name: getAtlasFamilyName(filter.value) ?? filter.value })
      case 'role':
        return facets.roles.find((entry) => entry.code === filter.value)?.name ?? filter.value
      case 'procedure':
        return t('chips.procedure', {
          name:
            facets.procedures.find((entry) => entry.code === filter.value)?.name ?? filter.value,
        })
      case 'channelMax':
        return `${specFilterLabels.channelMax}: ${rangeText(filter, 'mm')}`
      case 'gauge':
        return `${specFilterLabels.gauge}: ${filter.value}G`
      case 'specUnknown':
        return t('chips.specUnknown')
      case 'diameter':
      case 'length':
      case 'french':
      case 'workingLength':
        return `${specFilterLabels[filter.id]}: ${rangeText(filter, ATLAS_SPEC_FILTERS[filter.id].unit)}`
      default:
        return filter.value
    }
  }

  // The search state a device page needs to link back here, in canonical form.
  const returnContext = encodeReturnContext(query) || null
  const tableLabels = {
    product: t('table.product'),
    manufacturer: t('table.manufacturer'),
    deviceType: t('table.deviceType'),
    catalogNumber: t('table.catalogNumber'),
    size: t('table.size'),
    keySpecs: t('table.keySpecs'),
    status: t('table.status'),
    notRecorded: tCommon('notRecorded'),
    region: t('resultsRegionLabel'),
    exactMatch: t('exactIdentifierMatch'),
    asOf: t('statusAsOf'),
  }
  const specSummaryFor = (productIds: string[]) =>
    Object.fromEntries(
      (results?.items ?? [])
        .filter((item) => productIds.includes(item.productId))
        .map((item) => [
          item.productId,
          modelSpecSummary(results?.taxonomyByProductId[item.productId]?.deviceClassCode, {
            ...item,
            reuseStatus: results?.extrasByProductId[item.productId]?.reuseStatus ?? null,
          }),
        ]),
    )
  const showUnknownOnly = query.specUnknown === 'only'
  const pinnedExact =
    results && view === 'families' && results.page === 1 ? results.exactMatches : []

  return (
    <div className="container space-y-6 py-8 md:py-10">
      <DeviceTaskNav
        locale={locale}
        active="find"
        labels={{
          navigation: t('navigationLabel'),
          find: t('findDevice'),
          procedures: t('prepareProcedure'),
          saved: tReference('savedDevices'),
          compare: compareLabels.navCompare,
        }}
      />
      <header className="max-w-4xl space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{t('intro')}</p>
      </header>

      <Card>
        <CardContent className="p-4">
          <AtlasSearchForm
            locale={locale}
            query={query}
            facets={facets}
            deviceClassLabels={taxonomyLabels.classes}
            subtypeOptions={subtypes}
            labels={{
              search: t('form.search'),
              searchPlaceholder: t('form.searchPlaceholder'),
              manufacturer: t('form.manufacturer'),
              deviceClass: t('form.deviceClass'),
              deviceSubtype: t('form.deviceSubtype'),
              subtypeNeedsClass: t('form.subtypeNeedsClass'),
              role: t('form.role'),
              procedure: t('form.procedure'),
              any: t('form.any'),
              apply: t('form.apply'),
              moreFilters: t('form.moreFilters'),
              specHeading: t('form.specHeading'),
              specNote: t('form.specNote'),
              min: t('form.min'),
              max: t('form.max'),
              specFilters: specFilterLabels,
              channelMaxHelp: t('form.channelMaxHelp'),
            }}
          />
        </CardContent>
      </Card>

      <DeviceTypeBrowser
        locale={locale}
        query={query}
        classes={classes}
        subtypes={subtypes}
        labels={{
          heading: t('browse.heading'),
          allTypes: t('browse.allTypes'),
          moreTypes: t('browse.moreTypes', { count: classes.length }),
          subtypeHeading: t('browse.subtypeHeading', { deviceClass: selectedClassLabel ?? '' }),
          allOfClass: t('browse.allOfClass'),
          count: (count) => t('browse.productCount', { count }),
        }}
      />

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

      {normalized.subtypeDroppedForClassMismatch ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('subtypeMismatchNotice')}
        </p>
      ) : null}

      {results ? (
        <section aria-labelledby="atlas-results-heading" className="space-y-4">
          <ActiveFilterChips
            locale={locale}
            query={query}
            describe={describeFilter}
            labels={{
              heading: t('chips.heading'),
              remove: t('chips.remove'),
              clearAll: t('chips.clearAll'),
            }}
          />

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h2 id="atlas-results-heading" className="text-lg font-semibold">
                {view === 'families' && results.familyTotal !== null
                  ? t('familyResultCount', {
                      families: results.familyTotal,
                      count: results.total,
                    })
                  : t('resultCount', { count: results.total })}
              </h2>
              {query.procedure ? (
                // Procedure filtering is role-based DISCOVERY, not authored slot membership.
                <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
                  {t('procedureDiscoveryNote')}{' '}
                  <Link
                    href={`/${locale}/procedures` as Route}
                    className="font-medium underline underline-offset-2"
                  >
                    {t('prepareProcedure')}
                  </Link>
                </p>
              ) : null}
            </div>
            <AtlasResultsControls
              locale={locale}
              query={query}
              view={view}
              labels={{
                viewLabel: t('view.label'),
                families: t('view.families'),
                models: t('view.models'),
                sort: t('sort.label'),
                applySort: t('sort.apply'),
                sortOptions: Object.fromEntries(
                  catalogSortValues.map((value) => [value, t(`sort.options.${value}`)]),
                ) as Record<(typeof catalogSortValues)[number], string>,
              }}
            />
          </div>

          {hasActiveSpecFilter(query) ? (
            // A value that is not recorded was never tested against the requirement. It is
            // reported apart from the matches and can be listed on its own — never folded in
            // with the products that met the recorded requirement, and never worded as a
            // failure.
            <div
              role="status"
              data-missing-spec-notice
              className="space-y-1 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm leading-6"
            >
              {showUnknownOnly ? (
                <p>
                  {t('specUnknownOnly', {
                    count: results.total,
                    fields: activeSpecFilterNames.join(', '),
                  })}{' '}
                  <Link
                    href={
                      atlasIndexHref(locale, { ...query, specUnknown: 'exclude', page: 1 }) as Route
                    }
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    {t('specUnknownBack')}
                  </Link>
                </p>
              ) : (
                <>
                  <p>{t('specMatched', { count: results.total })}</p>
                  {results.excludedMissingSpecCount > 0 ? (
                    <p>
                      {t('specNotEvaluated', {
                        count: results.excludedMissingSpecCount,
                        fields: activeSpecFilterNames.join(', '),
                      })}{' '}
                      <Link
                        href={
                          atlasIndexHref(locale, {
                            ...query,
                            specUnknown: 'only',
                            page: 1,
                          }) as Route
                        }
                        data-show-unknown-spec
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        {t('specShowUnknown')}
                      </Link>
                    </p>
                  ) : null}
                </>
              )}
              <p className="text-xs text-muted-foreground">{t('specMatchBoundary')}</p>
            </div>
          ) : null}

          {pinnedExact.length > 0 ? (
            <section
              aria-labelledby="atlas-exact-heading"
              data-exact-match-section
              className="space-y-2 rounded-2xl border border-primary/50 bg-primary/5 p-3"
            >
              <h3 id="atlas-exact-heading" className="text-sm font-bold">
                {t('exactMatchHeading', { count: pinnedExact.length })}
              </h3>
              <AtlasResultsTable
                locale={locale}
                idPrefix="exact"
                items={pinnedExact}
                exactIdentifierMatchIds={results.exactIdentifierMatchIds}
                statusByProductId={results.statusByProductId}
                deviceTypeByProductId={deviceTypeByProductId}
                statusLabels={statusLabels}
                saveLabels={saveLabels}
                compareLabels={compareLabels}
                specLabels={specLabels}
                specSummaryByProductId={specSummaryFor(pinnedExact.map((item) => item.productId))}
                returnContext={returnContext}
                labels={{ ...tableLabels, region: t('exactMatchRegionLabel') }}
              />
            </section>
          ) : null}

          {results.total === 0 ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                {t('noResults')}
              </CardContent>
            </Card>
          ) : view === 'families' ? (
            <>
              <p className="text-xs leading-5 text-muted-foreground">
                {t('familyGroupingNote')} {tDevice('displayOnlyGroupingNote')}
              </p>
              <AtlasFamilyList
                locale={locale}
                query={query}
                families={results.families}
                statusByProductId={results.statusByProductId}
                extrasByProductId={results.extrasByProductId}
                exactIdentifierMatchIds={results.exactIdentifierMatchIds}
                subtypeLabels={taxonomyLabels.subtypes}
                statusLabels={statusLabels}
                saveLabels={saveLabels}
                compareLabels={compareLabels}
                specLabels={specLabels}
                tableLabels={tableLabels}
                returnContext={returnContext}
                labels={{
                  modelCount: (count) => t('family.modelCount', { count }),
                  viewModels: (count) => t('family.viewModels', { count }),
                  viewAllModels: (count) => t('family.viewAllModels', { count }),
                  previewNote: (shown, total) => t('family.previewNote', { shown, total }),
                  safetyNotice: (affected, total) => t('family.safetyNotice', { affected, total }),
                  marketVaries: t('family.marketVaries'),
                  catalogGrouping: t('family.catalogGrouping'),
                  recordedFor: (recorded, total) => t('family.recordedFor', { recorded, total }),
                  exactMatch: t('exactIdentifierMatch'),
                  catalogNumber: t('table.catalogNumber'),
                  notRecorded: tCommon('notRecorded'),
                }}
              />
            </>
          ) : (
            <AtlasResultsTable
              locale={locale}
              items={results.items}
              exactIdentifierMatchIds={results.exactIdentifierMatchIds}
              statusByProductId={results.statusByProductId}
              deviceTypeByProductId={deviceTypeByProductId}
              statusLabels={statusLabels}
              saveLabels={saveLabels}
              compareLabels={compareLabels}
              specLabels={specLabels}
              specSummaryByProductId={specSummaryFor(results.items.map((item) => item.productId))}
              returnContext={returnContext}
              labels={tableLabels}
            />
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

      <footer className="space-y-2 border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <EvidenceBadge state="verified_source_fact">
            {t('cohortBadge', { count: overview.productCount })}
          </EvidenceBadge>
          <span>
            {t('coverage', {
              researchedCount: coverage.researched,
              totalCount: overview.productCount,
              reviewedCount: coverage.reviewedProfiles,
            })}
          </span>
        </div>
        <details>
          <summary className="cursor-pointer rounded font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t('evidenceGuide')}
          </summary>
          <div className="mt-2 space-y-2">
            <p>{t('cohortRule')}</p>
            <p>{t('exclusionNote')}</p>
            <p>{t('statusNote')}</p>
          </div>
        </details>
        <p>
          {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
        </p>
      </footer>
    </div>
  )
}
