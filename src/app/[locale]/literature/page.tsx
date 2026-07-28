import type { Metadata } from 'next'
import { SlidersHorizontal } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { flattenLiteratureTaxonomy, literatureQueryRegistry } from '@/features/literature/config'
import { literatureTopicLabel } from '@/features/literature/domain/display'
import { LiteraturePagination } from '@/features/literature/components/LiteraturePagination'
import { LiteratureResultCard } from '@/features/literature/components/LiteratureResultCard'
import { LiteratureSearchForm } from '@/features/literature/components/LiteratureSearchForm'
import {
  literatureSearchInputFromUrl,
  literatureSearchSchema,
  type LiteratureSearchQuery,
} from '@/features/literature/schemas/search'
import {
  literaturePageSearchParamsToUrl,
  type LiteraturePageSearchParams,
} from '@/features/literature/search/page-params'
import { serializeLiteratureSearchQuery } from '@/features/literature/search/url'
import { searchLiterature } from '@/features/literature/server/queries'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

interface LiteratureSearchPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<LiteraturePageSearchParams>
}

interface ActiveFilter {
  href: string
  key: string
  label: string
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

function queryHref(query: LiteratureSearchQuery) {
  const value = serializeLiteratureSearchQuery(query, {
    includeAdminPreview: true,
  })
  return `/literature${value ? `?${value}` : ''}`
}

export async function generateMetadata({ params }: LiteratureSearchPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'literature.search',
  })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false },
  }
}

export default async function LiteratureSearchPage({
  params,
  searchParams,
}: LiteratureSearchPageProps) {
  const { locale: rawLocale } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  const t = await getTranslations('literature.search')
  const workflowT = await getTranslations('literature.workflow')
  const urlSearchParams = literaturePageSearchParamsToUrl(await searchParams)
  const parsed = literatureSearchSchema.safeParse(literatureSearchInputFromUrl(urlSearchParams))
  const query = parsed.success ? parsed.data : literatureSearchSchema.parse({})

  const topics = flattenLiteratureTaxonomy()
  const journals = [
    ...literatureQueryRegistry.core_journals,
    ...literatureQueryRegistry.optional_continuity_journals,
    ...literatureQueryRegistry.expanded_journals,
    ...literatureQueryRegistry.non_pubmed_sources,
  ].map((journal) => ({
    id: journal.id,
    displayName: journal.display_name,
  }))
  const topicById = new Map(topics.map((topic) => [topic.id, topic]))
  const journalById = new Map(journals.map((journal) => [journal.id, journal.displayName]))

  const searchResult = parsed.success
    ? await searchLiterature(query)
    : { data: null, error: t('invalidSearch') }

  const activeFilters: ActiveFilter[] = []
  for (const topicId of query.topicIds) {
    const topic = topicById.get(topicId)
    activeFilters.push({
      key: `topic-${topicId}`,
      label: topic ? literatureTopicLabel(topic, locale) : topicId,
      href: queryHref({
        ...query,
        topicIds: query.topicIds.filter((id) => id !== topicId),
        page: 1,
      }),
    })
  }
  for (const journalId of query.journalIds) {
    activeFilters.push({
      key: `journal-${journalId}`,
      label: journalById.get(journalId) ?? journalId,
      href: queryHref({
        ...query,
        journalIds: query.journalIds.filter((id) => id !== journalId),
        page: 1,
      }),
    })
  }
  for (const publicationType of query.publicationTypes) {
    activeFilters.push({
      key: `publication-${publicationType}`,
      label: publicationType,
      href: queryHref({
        ...query,
        publicationTypes: query.publicationTypes.filter((value) => value !== publicationType),
        page: 1,
      }),
    })
  }
  if (query.yearFrom) {
    activeFilters.push({
      key: 'year-from',
      label: `${t('form.yearFrom')}: ${query.yearFrom}`,
      href: queryHref({ ...query, yearFrom: undefined, page: 1 }),
    })
  }
  if (query.yearTo) {
    activeFilters.push({
      key: 'year-to',
      label: `${t('form.yearTo')}: ${query.yearTo}`,
      href: queryHref({ ...query, yearTo: undefined, page: 1 }),
    })
  }
  if (query.landmarkOnly) {
    activeFilters.push({
      key: 'landmark',
      label: t('form.landmark'),
      href: queryHref({ ...query, landmarkOnly: false, page: 1 }),
    })
  }

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <section className="max-w-4xl space-y-4">
        <Badge variant="info">{t('eyebrow')}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{t('heading')}</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
          {t('description')}
        </p>
      </section>

      {query.adminPreview ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm text-foreground"
        >
          <strong>{t('previewTitle')}</strong> {t('previewBody')}
        </div>
      ) : null}

      <LiteratureSearchForm
        journals={journals}
        labels={{
          adminPreview: t('form.adminPreview'),
          adminPreviewHelp: t('form.adminPreviewHelp'),
          clear: t('form.clear'),
          examples: t('form.examples'),
          filters: t('form.filters'),
          journal: t('form.journal'),
          landmark: t('form.landmark'),
          publicationType: t('form.publicationType'),
          query: t('form.query'),
          queryPlaceholder: t('form.queryPlaceholder'),
          search: t('form.search'),
          sort: t('form.sort'),
          sortJournal: t('form.sortJournal'),
          sortNewest: t('form.sortNewest'),
          sortOldest: t('form.sortOldest'),
          sortRelevance: t('form.sortRelevance'),
          topic: t('form.topic'),
          yearFrom: t('form.yearFrom'),
          yearTo: t('form.yearTo'),
        }}
        locale={locale}
        query={query}
        topics={topics}
      />

      {activeFilters.length > 0 ? (
        <section aria-label={t('activeFilters')} className="flex flex-wrap gap-2">
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
        {searchResult.error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="p-6 text-sm">
              <h2 className="font-semibold">{t('errorTitle')}</h2>
              <p className="mt-1 text-muted-foreground">{t('errorBody')}</p>
            </CardContent>
          </Card>
        ) : searchResult.data ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{t('resultsHeading')}</h2>
                <p className="text-sm text-muted-foreground">
                  {t('resultCount', { count: searchResult.data.total })}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{t('plainTextNotice')}</p>
            </div>

            {searchResult.data.items.length > 0 ? (
              <div className="grid gap-4">
                {searchResult.data.items.map((result) => (
                  <LiteratureResultCard
                    key={result.pmid}
                    adminPreview={query.adminPreview}
                    labels={{
                      abstractUnavailable: t('result.abstractUnavailable'),
                      correction: workflowT('warning.correction'),
                      confirmedTopic: t('result.confirmedTopic'),
                      doi: t('result.doi'),
                      landmark: t('result.landmark'),
                      matchedBy: t('result.matchedBy'),
                      matchedFields: {
                        abstract: workflowT('matchedField.abstract'),
                        doi: workflowT('matchedField.doi'),
                        pmid: workflowT('matchedField.pmid'),
                        subject_terms: workflowT('matchedField.subjectTerms'),
                        title: workflowT('matchedField.title'),
                      },
                      pmid: t('result.pmid'),
                      pubMed: t('result.pubMed'),
                      relevanceStates: {
                        candidate: workflowT('relevance.candidate'),
                        excluded: workflowT('relevance.excluded'),
                        included: workflowT('relevance.included'),
                        unreviewed: workflowT('relevance.unreviewed'),
                      },
                      retracted: workflowT('warning.retracted'),
                      suggestedTopic: t('result.suggestedTopic'),
                      visibilityStates: {
                        draft: workflowT('visibility.draft'),
                        hidden: workflowT('visibility.hidden'),
                        published: workflowT('visibility.published'),
                      },
                    }}
                    locale={locale}
                    result={result}
                  />
                ))}
              </div>
            ) : (
              <Card className="bg-muted/30">
                <CardContent className="p-8 text-center">
                  <h2 className="font-semibold">{t('noResultsTitle')}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t('noResultsBody')}</p>
                </CardContent>
              </Card>
            )}

            <LiteraturePagination
              labels={{
                next: t('pagination.next'),
                page: t('pagination.page'),
                previous: t('pagination.previous'),
              }}
              pageCount={searchResult.data.pageCount}
              query={query}
            />
          </>
        ) : null}
      </section>

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('disclaimer')}
      </p>
    </div>
  )
}
