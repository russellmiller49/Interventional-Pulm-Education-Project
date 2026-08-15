import type { Metadata } from 'next'
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Database,
  FileQuestion,
  Search,
  Tags,
} from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { Input } from '@/components/ui/input'
import { LiteratureCapabilityNotice } from '@/features/literature/components/LiteratureCapabilityNotice'
import { flattenLiteratureTaxonomy, literatureQueryRegistry } from '@/features/literature/config'
import {
  literatureRelevanceStates,
  literatureSourceKinds,
  literatureVisibilityStates,
} from '@/features/literature/constants'
import {
  compactLiteratureAuthors,
  literatureCitationParts,
  literatureTopicLabel,
} from '@/features/literature/domain/display'
import {
  literatureReviewQueueInputFromUrl,
  literatureReviewQueueSchema,
} from '@/features/literature/schemas/search'
import {
  literaturePageSearchParamsToUrl,
  type LiteraturePageSearchParams,
} from '@/features/literature/search/page-params'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import { literatureOperationActivated } from '@/features/literature/server/database-client'
import {
  loadLiteratureAdminStats,
  loadLiteratureReviewQueue,
} from '@/features/literature/server/queries'
import {
  capabilityCarriesCounts,
  capabilityNotObserved,
  literatureCountDisplay,
} from '@/features/literature/server/runtime-capability'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

interface LiteratureAdminPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<LiteraturePageSearchParams>
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

function queuePageHref(values: ReturnType<typeof literatureReviewQueueSchema.parse>, page: number) {
  const params = new URLSearchParams()
  if (values.q) params.set('q', values.q)
  if (values.sourceKind) params.set('sourceKind', values.sourceKind)
  if (values.journalId) params.set('journal', values.journalId)
  if (values.year) params.set('year', String(values.year))
  if (values.abstractAvailability !== 'all') {
    params.set('abstract', values.abstractAvailability)
  }
  if (values.topicId) params.set('topic', values.topicId)
  if (values.relevanceState) {
    params.set('relevance', values.relevanceState)
  }
  if (values.visibilityState) {
    params.set('visibility', values.visibilityState)
  }
  if (page > 1) params.set('page', String(page))
  const serialized = params.toString()
  return `/admin/literature${serialized ? `?${serialized}` : ''}`
}

export async function generateMetadata({ params }: LiteratureAdminPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'literature.admin',
  })
  return {
    title: t('metadataTitle'),
    robots: { index: false, follow: false },
  }
}

export default async function LiteratureAdminPage({
  params,
  searchParams,
}: LiteratureAdminPageProps) {
  const { locale: rawLocale } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, '/admin/literature')
  const t = await getTranslations('literature.admin')
  const workflowT = await getTranslations('literature.workflow')
  const capabilityT = await getTranslations('literature.capability')
  const rawParams = literaturePageSearchParamsToUrl(await searchParams)
  const parsed = literatureReviewQueueSchema.safeParse(literatureReviewQueueInputFromUrl(rawParams))
  const filters = parsed.success ? parsed.data : literatureReviewQueueSchema.parse({})

  const [stats, queue] = await Promise.all([
    loadLiteratureAdminStats(),
    parsed.success
      ? loadLiteratureReviewQueue(filters)
      : Promise.resolve({
          data: null,
          error: t('invalidFilters'),
          capability: capabilityNotObserved(
            null,
            'The review-queue filters were rejected before the database was queried.',
          ),
        } as const),
  ])
  const topics = flattenLiteratureTaxonomy()
  const journals = [
    ...literatureQueryRegistry.core_journals,
    ...literatureQueryRegistry.optional_continuity_journals,
    ...literatureQueryRegistry.expanded_journals,
    ...literatureQueryRegistry.non_pubmed_sources,
  ]

  /*
   * Every count on this page is rendered through `statValue`.
   *
   * The defect it replaces was a family of `?? 0` fallbacks: when the statistics RPC failed,
   * `stats.data` was null, the maps below defaulted to `{}`, and the page reported a corpus of
   * exactly zero articles in every category — indistinguishable from a freshly migrated, genuinely
   * empty project. That is the single most consequential thing this page can get wrong during a
   * bring-up, because "empty" and "unreadable" call for opposite responses.
   *
   * So the capability decides first. When it does not carry counts, no number is rendered at all;
   * when it does, `stats.data` is present and a missing key really is zero.
   */
  const countsAreReal = capabilityCarriesCounts(stats.capability.state)
  const unavailableValue = capabilityT('unavailableValue')
  const statValue = (value: number | undefined) =>
    literatureCountDisplay(stats.capability.state, value, unavailableValue)

  const relevance = stats.data?.relevanceCounts ?? {}
  const visibility = stats.data?.visibilityCounts ?? {}
  const journalCounts = Object.entries(stats.data?.journalCounts ?? {}).sort(
    ([leftLabel, leftCount], [rightLabel, rightCount]) =>
      rightCount - leftCount || leftLabel.localeCompare(rightLabel),
  )
  const visibleJournalCounts = journalCounts.slice(0, 12)
  const remainingJournalCount = journalCounts
    .slice(12)
    .reduce((total, [, count]) => total + count, 0)

  // The gold-set workflow's migrations are deferred, so this build does not carry the operation.
  // Hiding the entry point is the honest presentation: the alternative is a button whose only
  // possible outcome is an error page.
  const goldWorkflowAvailable = literatureOperationActivated('gold_set_read')

  const summaryCards = [
    {
      label: t('stats.total'),
      value: statValue(stats.data?.totalArticles),
      icon: Database,
    },
    {
      label: t('stats.withAbstract'),
      value: statValue(stats.data?.withAbstract),
      icon: BookOpenCheck,
    },
    {
      label: t('stats.withoutAbstract'),
      value: statValue(stats.data?.withoutAbstract),
      icon: FileQuestion,
    },
    {
      label: t('stats.unreviewed'),
      value: statValue(relevance.unreviewed),
      icon: AlertTriangle,
    },
    {
      label: t('stats.included'),
      value: statValue(relevance.included),
      icon: CheckCircle2,
    },
    {
      label: t('stats.suggestions'),
      value: statValue(stats.data?.topicSuggestionCount),
      icon: Tags,
    },
  ]

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-4xl space-y-3">
          <Badge variant="info">{t('eyebrow')}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{t('heading')}</h1>
          <p className="text-base leading-7 text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {goldWorkflowAvailable ? (
            <Button asChild>
              <Link href="/admin/literature/gold-set">Open gold-set review</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href="/literature?adminPreview=1">{t('openPreview')}</Link>
          </Button>
        </div>
      </section>

      <LiteratureCapabilityNotice
        capability={stats.capability}
        title={capabilityT('bannerTitle')}
        description={capabilityT(`state.${stats.capability.state}`)}
        projectLabel={capabilityT('projectLabel')}
      />

      <section
        aria-label={t('stats.label')}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        {summaryCards.map((summary) => {
          const Icon = summary.icon
          return (
            <Card key={summary.label}>
              <CardContent className="gap-2 p-4">
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <p className="text-xs text-muted-foreground">{summary.label}</p>
                <p
                  className={cn(
                    'font-semibold',
                    countsAreReal ? 'text-2xl' : 'text-base text-muted-foreground',
                  )}
                  title={countsAreReal ? undefined : capabilityT('unavailableHint')}
                >
                  {summary.value}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.reviewStates')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {literatureRelevanceStates.map((state) => (
                <div key={state}>
                  <dt className="text-muted-foreground">{workflowT(`relevance.${state}`)}</dt>
                  <dd className="text-xl font-semibold">{statValue(relevance[state])}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.visibilityStates')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              {literatureVisibilityStates.map((state) => (
                <div key={state}>
                  <dt className="text-muted-foreground">{workflowT(`visibility.${state}`)}</dt>
                  <dd className="text-xl font-semibold">{statValue(visibility[state])}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.sourceBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {literatureSourceKinds.map((sourceKind) => (
                <div key={sourceKind} className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">{workflowT(`sourceKind.${sourceKind}`)}</dt>
                  <dd className="font-semibold">
                    {statValue(stats.data?.sourceKindCounts[sourceKind])}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.journalBreakdown')}</CardTitle>
            <CardDescription>{t('stats.journalBreakdownHelp')}</CardDescription>
          </CardHeader>
          <CardContent>
            {visibleJournalCounts.length > 0 ? (
              <dl className="grid gap-2 text-sm">
                {visibleJournalCounts.map(([journal, count]) => (
                  <div key={journal} className="flex items-center justify-between gap-4">
                    <dt className="truncate text-muted-foreground" title={journal}>
                      {journal}
                    </dt>
                    <dd className="font-semibold">{count}</dd>
                  </div>
                ))}
                {remainingJournalCount > 0 ? (
                  <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-2">
                    <dt className="text-muted-foreground">{t('stats.otherJournals')}</dt>
                    <dd className="font-semibold">{remainingJournalCount}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                {countsAreReal ? t('stats.none') : unavailableValue}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('imports.title')}</CardTitle>
          <CardDescription>
            {stats.data?.lastImport
              ? t('imports.lastBatch', {
                  file: stats.data.lastImport.source_filename,
                  status: workflowT(`importStatus.${stats.data.lastImport.status}`),
                })
              : countsAreReal
                ? t('imports.noBatch')
                : capabilityT(`state.${stats.capability.state}`)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t('imports.errors')}</dt>
              <dd className="text-xl font-semibold">{statValue(stats.data?.importErrorCount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('imports.unmapped')}</dt>
              <dd className="text-xl font-semibold">{statValue(stats.data?.unmappedFileCount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('imports.records')}</dt>
              <dd className="text-xl font-semibold">
                {countsAreReal ? (stats.data?.lastImport?.records_read ?? '—') : unavailableValue}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('imports.batchErrors')}</dt>
              <dd className="text-xl font-semibold">
                {countsAreReal ? (stats.data?.lastImport?.error_count ?? '—') : unavailableValue}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t('queue.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('queue.description')}</p>
        </div>

        <form
          action={`/${locale}/admin/literature`}
          method="get"
          className="grid gap-3 rounded-2xl border border-border/80 bg-muted/25 p-4 md:grid-cols-3 xl:grid-cols-5"
        >
          <label className="md:col-span-2 xl:col-span-2">
            <span className="sr-only">{t('filters.query')}</span>
            <Input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder={t('filters.query')}
              leadingIcon={<Search className="h-4 w-4" aria-hidden="true" />}
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.source')}</span>
            <select
              name="sourceKind"
              defaultValue={filters.sourceKind ?? ''}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all')}</option>
              {literatureSourceKinds.map((value) => (
                <option key={value} value={value}>
                  {workflowT(`sourceKind.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.journal')}</span>
            <select
              name="journal"
              defaultValue={filters.journalId ?? ''}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all')}</option>
              {journals.map((journal) => (
                <option key={journal.id} value={journal.id}>
                  {journal.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.year')}</span>
            <input
              name="year"
              type="number"
              min="1800"
              max="3000"
              defaultValue={filters.year}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.abstract')}</span>
            <select
              name="abstract"
              defaultValue={filters.abstractAvailability}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t('filters.all')}</option>
              <option value="with">{t('filters.withAbstract')}</option>
              <option value="without">{t('filters.withoutAbstract')}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.topic')}</span>
            <select
              name="topic"
              defaultValue={filters.topicId ?? ''}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all')}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.parentId ? '— ' : ''}
                  {literatureTopicLabel(topic, locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.relevance')}</span>
            <select
              name="relevance"
              defaultValue={filters.relevanceState ?? ''}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all')}</option>
              {literatureRelevanceStates.map((value) => (
                <option key={value} value={value}>
                  {workflowT(`relevance.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium">
            <span>{t('filters.visibility')}</span>
            <select
              name="visibility"
              defaultValue={filters.visibilityState ?? ''}
              className="h-10 w-full rounded-full border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('filters.all')}</option>
              {literatureVisibilityStates.map((value) => (
                <option key={value} value={value}>
                  {workflowT(`visibility.${value}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
              {t('filters.apply')}
            </Button>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href="/admin/literature">{t('filters.clear')}</Link>
            </Button>
          </div>
        </form>

        {queue.error ? (
          <Card className="border-destructive/40">
            <CardContent className="p-6 text-sm">{t('queue.unavailable')}</CardContent>
          </Card>
        ) : queue.data ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t('queue.resultCount', { count: queue.data.total })}
            </p>
            {queue.data.items.length > 0 ? (
              <div className="grid gap-4">
                {queue.data.items.map((article) => {
                  const authors = compactLiteratureAuthors(article.authors)
                  const citation = literatureCitationParts(article)
                  return (
                    <Card key={article.pmid}>
                      <CardContent className="gap-4 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {workflowT(`relevance.${article.relevanceState}`)}
                          </Badge>
                          <Badge variant="outline">
                            {workflowT(`visibility.${article.visibilityState}`)}
                          </Badge>
                          {article.isLandmark ? (
                            <Badge variant="success">{t('queue.landmark')}</Badge>
                          ) : null}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">
                            <Link
                              href={`/admin/literature/article/${article.pmid}`}
                              className="hover:text-primary"
                            >
                              {article.title}
                            </Link>
                          </h3>
                          {authors ? (
                            <p className="mt-1 text-sm text-muted-foreground">{authors}</p>
                          ) : null}
                          {citation ? <p className="mt-1 text-sm font-medium">{citation}</p> : null}
                        </div>
                        <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {article.abstractSnippet ?? t('queue.abstractUnavailable')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {article.topics.map((topic) => (
                            <Badge
                              key={`${topic.id}:${topic.assignmentSource}:${topic.modelOrRuleVersion}`}
                              variant={
                                topic.assignmentState === 'confirmed' ? 'default' : 'outline'
                              }
                              className="normal-case tracking-normal"
                            >
                              {literatureTopicLabel(topic, locale)} ·{' '}
                              {workflowT(`assignmentState.${topic.assignmentState}`)} ·{' '}
                              {workflowT(`assignmentSource.${topic.assignmentSource}`)}
                              {topic.confidence === null
                                ? ''
                                : ` · ${Math.round(topic.confidence * 100)}%`}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <strong>{t('queue.sources')}:</strong>{' '}
                          {article.sources.length > 0
                            ? article.sources
                                .map(
                                  (source) =>
                                    `${workflowT(
                                      `sourceKind.${source.sourceKind}`,
                                    )}: ${source.sourceFilename}`,
                                )
                                .join(' · ')
                            : t('queue.noSources')}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  {t('queue.empty')}
                </CardContent>
              </Card>
            )}
            {queue.data.pageCount > 1 ? (
              <nav className="flex items-center justify-between gap-3">
                {queue.data.page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={queuePageHref(filters, queue.data.page - 1)}>
                      {t('queue.previous')}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  {t('queue.page', {
                    page: queue.data.page,
                    pages: queue.data.pageCount,
                  })}
                </span>
                {queue.data.page < queue.data.pageCount ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={queuePageHref(filters, queue.data.page + 1)}>
                      {t('queue.next')}
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
    </div>
  )
}
