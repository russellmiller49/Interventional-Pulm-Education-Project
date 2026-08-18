import type { Metadata } from 'next'
import { BookOpenCheck, Database, Layers3, Search, ShieldCheck, XCircle } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { CuratedLiteratureResultCard } from '@/features/literature/components/CuratedLiteratureResultCard'
import { LiteratureAdminCollectionNav } from '@/features/literature/components/LiteratureAdminCollectionNav'
import { LiteratureCapabilityNotice } from '@/features/literature/components/LiteratureCapabilityNotice'
import {
  literatureCuratedCollectionInputFromUrl,
  literatureCuratedCollectionSchema,
} from '@/features/literature/schemas/search'
import {
  literaturePageSearchParamsToUrl,
  type LiteraturePageSearchParams,
} from '@/features/literature/search/page-params'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import {
  loadLiteratureCuratedCollection,
  loadLiteratureCuratedStats,
} from '@/features/literature/server/queries'
import {
  capabilityCarriesCounts,
  capabilityNotObserved,
  literatureCountDisplay,
} from '@/features/literature/server/runtime-capability'
import { cn } from '@/lib/cn'
import { DEFAULT_LITERATURE_PAGE_SIZE } from '@/features/literature/constants'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

interface LiteratureCuratedPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<LiteraturePageSearchParams>
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

function curatedHref(
  filters: ReturnType<typeof literatureCuratedCollectionSchema.parse>,
  overrides: Partial<ReturnType<typeof literatureCuratedCollectionSchema.parse>> = {},
) {
  const values = { ...filters, ...overrides }
  const params = new URLSearchParams()
  if (values.q) params.set('q', values.q)
  if (values.reviewedClass !== 'all') params.set('class', values.reviewedClass)
  if (values.sort !== 'newest') params.set('sort', values.sort)
  if (values.page > 1) params.set('page', String(values.page))
  if (values.pageSize !== DEFAULT_LITERATURE_PAGE_SIZE) {
    params.set('pageSize', String(values.pageSize))
  }
  const serialized = params.toString()
  return `/admin/literature/curated${serialized ? `?${serialized}` : ''}`
}

export async function generateMetadata({ params }: LiteratureCuratedPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'literature.admin.curated' })
  return {
    title: t('metadataTitle'),
    robots: { index: false, follow: false },
  }
}

export default async function LiteratureCuratedPage({
  params,
  searchParams,
}: LiteratureCuratedPageProps) {
  const { locale: rawLocale } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, '/admin/literature/curated')

  const t = await getTranslations('literature.admin.curated')
  const capabilityT = await getTranslations('literature.capability')
  const workflowT = await getTranslations('literature.workflow')
  const rawParams = literaturePageSearchParamsToUrl(await searchParams)
  const parsed = literatureCuratedCollectionSchema.safeParse(
    literatureCuratedCollectionInputFromUrl(rawParams),
  )
  const filters = parsed.success ? parsed.data : literatureCuratedCollectionSchema.parse({})

  const [stats, collection] = await Promise.all([
    loadLiteratureCuratedStats(),
    parsed.success
      ? loadLiteratureCuratedCollection(filters)
      : Promise.resolve({
          data: null,
          error: t('invalidFilters'),
          capability: capabilityNotObserved(
            null,
            'The Curated Literature filters were rejected before the database was queried.',
          ),
        } as const),
  ])

  const countsAreReal = capabilityCarriesCounts(stats.capability.state)
  const unavailableValue = capabilityT('unavailableValue')
  const numberFormat = new Intl.NumberFormat(locale)
  const statValue = (value: number | undefined) => {
    const display = literatureCountDisplay(stats.capability.state, value, unavailableValue)
    return typeof display === 'number' ? numberFormat.format(display) : display
  }

  const summaryCards = [
    {
      label: t('stats.fullCorpus'),
      description: t('stats.fullCorpusHelp'),
      value: statValue(stats.data?.fullCorpus),
      icon: Database,
    },
    {
      label: t('stats.physicianReviewed'),
      description: t('stats.physicianReviewedHelp'),
      value: statValue(stats.data?.physicianReviewed),
      icon: ShieldCheck,
    },
    {
      label: t('stats.curated'),
      description: t('stats.curatedHelp'),
      value: statValue(stats.data?.curated),
      icon: BookOpenCheck,
    },
    {
      label: t('stats.core'),
      description: t('stats.coreHelp'),
      value: statValue(stats.data?.core),
      icon: Layers3,
    },
    {
      label: t('stats.adjacent'),
      description: t('stats.adjacentHelp'),
      value: statValue(stats.data?.adjacent),
      icon: Layers3,
    },
    {
      label: t('stats.exclusions'),
      description: t('stats.exclusionsHelp'),
      value: statValue(stats.data?.reviewedExclusions),
      icon: XCircle,
    },
  ]

  const resultLabels = {
    abstractUnavailable: t('results.abstractUnavailable'),
    adjacent: t('classes.adjacent'),
    conferenceAbstract: t('results.conferenceAbstract'),
    core: t('classes.core'),
    correction: t('results.correction'),
    doi: t('results.doi'),
    physicianReviewed: t('results.physicianReviewed'),
    pmid: t('results.pmid'),
    provenance: {
      physician_confirmed: t('provenance.physician_confirmed'),
      physician_modified: t('provenance.physician_modified'),
      qc_accepted: t('provenance.qc_accepted'),
    },
    pubMed: t('results.pubMed'),
    retracted: t('results.retracted'),
    reviewedOn: t('results.reviewedOn'),
    visibility: {
      draft: workflowT('visibility.draft'),
      published: workflowT('visibility.published'),
      hidden: workflowT('visibility.hidden'),
    },
  }

  return (
    <div className="container min-w-0 space-y-8 py-10 md:py-14">
      <header className="space-y-5">
        <LiteratureAdminCollectionNav
          active="curated"
          labels={{
            all: t('navigation.all'),
            curated: t('navigation.curated'),
            navigation: t('navigation.label'),
          }}
        />
        <div className="max-w-5xl space-y-3">
          <Badge variant="info">{t('eyebrow')}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{t('heading')}</h1>
          <p className="max-w-4xl text-base leading-7 text-muted-foreground">{t('description')}</p>
        </div>
      </header>

      <LiteratureCapabilityNotice
        capability={stats.capability}
        title={capabilityT('bannerTitle')}
        description={capabilityT(`state.${stats.capability.state}`)}
        projectLabel={capabilityT('projectLabel')}
        reasonLabel={capabilityT('reason')}
      />

      <section aria-labelledby="curated-statistics-heading" className="space-y-4">
        <div>
          <h2 id="curated-statistics-heading" className="text-2xl font-semibold tracking-tight">
            {t('stats.heading')}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('stats.description')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((summary) => {
            const Icon = summary.icon
            return (
              <Card key={summary.label} className="min-w-0">
                <CardContent className="gap-2 p-4">
                  <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium">{summary.label}</p>
                  <p
                    className={cn(
                      'font-semibold tabular-nums',
                      countsAreReal ? 'text-2xl' : 'text-base text-muted-foreground',
                    )}
                    title={countsAreReal ? undefined : capabilityT('unavailableHint')}
                  >
                    {summary.value}
                  </p>
                  <p className="text-xs leading-5 text-muted-foreground">{summary.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="curated-search-heading" className="space-y-5">
        <div>
          <h2 id="curated-search-heading" className="text-2xl font-semibold tracking-tight">
            {t('search.heading')}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('search.description')}</p>
        </div>

        <nav aria-label={t('filters.classLabel')} className="flex flex-wrap gap-2">
          {(['all', 'core', 'adjacent'] as const).map((reviewedClass) => (
            <Button
              key={reviewedClass}
              asChild
              size="sm"
              variant={filters.reviewedClass === reviewedClass ? 'default' : 'outline'}
            >
              <Link
                href={curatedHref(filters, { reviewedClass, page: 1 })}
                aria-current={filters.reviewedClass === reviewedClass ? 'page' : undefined}
              >
                {t(`filters.${reviewedClass}`)}
              </Link>
            </Button>
          ))}
        </nav>

        <form
          action={`/${locale}/admin/literature/curated`}
          method="get"
          className="grid gap-3 rounded-2xl border border-border/80 bg-muted/25 p-4 md:grid-cols-[minmax(0,1fr)_13rem_auto]"
        >
          {filters.reviewedClass !== 'all' ? (
            <input type="hidden" name="class" value={filters.reviewedClass} />
          ) : null}
          {filters.pageSize !== DEFAULT_LITERATURE_PAGE_SIZE ? (
            <input type="hidden" name="pageSize" value={filters.pageSize} />
          ) : null}
          <label>
            <span className="sr-only">{t('filters.query')}</span>
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder={t('filters.queryPlaceholder')}
              leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.sort')}</span>
            <select
              name="sort"
              defaultValue={filters.sort}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="newest">{t('filters.sortNewest')}</option>
              <option value="oldest">{t('filters.sortOldest')}</option>
              <option value="title">{t('filters.sortTitle')}</option>
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit" size="sm">
              {t('filters.apply')}
            </Button>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href="/admin/literature/curated">{t('filters.clear')}</Link>
            </Button>
          </div>
        </form>

        {collection.error ? (
          <LiteratureCapabilityNotice
            capability={collection.capability}
            title={t('results.unavailable')}
            description={capabilityT(`state.${collection.capability.state}`)}
            projectLabel={capabilityT('projectLabel')}
            reasonLabel={capabilityT('reason')}
          />
        ) : collection.data ? (
          <>
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {t('results.count', { count: collection.data.total })}
            </p>
            {collection.data.items.length > 0 ? (
              <div className="grid min-w-0 gap-4">
                {collection.data.items.map((article) => (
                  <CuratedLiteratureResultCard
                    key={article.pmid}
                    labels={resultLabels}
                    locale={locale}
                    result={article}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  {t('results.empty')}
                </CardContent>
              </Card>
            )}
            {collection.data.pageCount > 1 ? (
              <nav
                aria-label={t('pagination.label')}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                {collection.data.page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={curatedHref(filters, { page: collection.data.page - 1 })}>
                      {t('pagination.previous')}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  {t('pagination.page', {
                    page: collection.data.page,
                    pages: collection.data.pageCount,
                  })}
                </span>
                {collection.data.page < collection.data.pageCount ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={curatedHref(filters, { page: collection.data.page + 1 })}>
                      {t('pagination.next')}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : null}
      </section>

      <section aria-labelledby="curated-methods-heading" className="space-y-3">
        <h2 id="curated-methods-heading" className="text-2xl font-semibold tracking-tight">
          {t('methods.heading')}
        </h2>
        <details className="rounded-2xl border border-border/80 bg-card shadow-sm">
          <summary className="cursor-pointer rounded-2xl px-5 py-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            {t('methods.summary')}
          </summary>
          <div className="space-y-4 border-t border-border/70 px-5 py-5 text-sm leading-6 text-muted-foreground">
            {stats.data ? (
              <p>
                {t('methods.currentCounts', {
                  fullCorpus: stats.data.fullCorpus,
                  physicianReviewed: stats.data.physicianReviewed,
                  curated: stats.data.curated,
                  core: stats.data.core,
                  adjacent: stats.data.adjacent,
                  exclusions: stats.data.reviewedExclusions,
                })}
              </p>
            ) : (
              <p>{t('methods.countsUnavailable')}</p>
            )}
            <ul className="list-disc space-y-2 pl-5">
              <li>{t('methods.classDistinction')}</li>
              <li>{t('methods.exclusions')}</li>
              <li>
                {stats.data && stats.data.draftArticles === stats.data.fullCorpus
                  ? t('methods.allDraft')
                  : stats.data
                    ? t('methods.draftCount', {
                        draft: stats.data.draftArticles,
                        fullCorpus: stats.data.fullCorpus,
                      })
                    : t('methods.draftUnavailable')}
              </li>
              <li>{t('methods.aiBoundary')}</li>
              <li>{t('methods.completeness')}</li>
              <li>{t('methods.releaseBoundary')}</li>
            </ul>
          </div>
        </details>
      </section>
    </div>
  )
}
