import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Landmark, TriangleAlert } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  compactLiteratureAuthors,
  literatureCitationParts,
  literatureTopicLabel,
} from '@/features/literature/domain/display'
import { pmidSchema } from '@/features/literature/schemas/search'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import { getLiteratureArticle } from '@/features/literature/server/queries'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

interface LiteratureArticlePageProps {
  params: Promise<{ locale: string; pmid: string }>
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

export async function generateMetadata({ params }: LiteratureArticlePageProps): Promise<Metadata> {
  const { locale, pmid } = await params
  const t = await getTranslations({
    locale,
    namespace: 'literature.article',
  })
  return {
    title: t('metadataTitle', { pmid }),
    robots: { index: false, follow: false },
  }
}

export default async function LiteratureArticlePage({ params }: LiteratureArticlePageProps) {
  const { locale: rawLocale, pmid: rawPmid } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  const t = await getTranslations('literature.article')
  const workflowT = await getTranslations('literature.workflow')
  await requireLiteratureSiteAdminPage(locale, `/literature/article/${rawPmid}`)

  const pmid = pmidSchema.safeParse(rawPmid)
  if (!pmid.success) {
    notFound()
  }
  const result = await getLiteratureArticle(pmid.data)
  if (result.error) {
    return (
      <div className="container py-12">
        <Card className="border-destructive/40">
          <CardContent className="p-6">{t('loadError')}</CardContent>
        </Card>
      </div>
    )
  }
  if (!result.data) {
    notFound()
  }

  const article = result.data
  const authors = compactLiteratureAuthors(article.authors, article.collectiveAuthors)
  const citation = literatureCitationParts(article)
  const abstractText =
    article.abstractDisplayPolicy === 'full_allowed'
      ? article.abstract
      : article.abstractDisplayPolicy === 'snippet_only'
        ? (article.abstract?.slice(0, 600) ?? null)
        : null

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <Link
        href="/literature"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('back')}
      </Link>

      <article className="space-y-8">
        <header className="max-w-5xl space-y-4">
          <div className="flex flex-wrap gap-2">
            {article.isLandmark ? (
              <Badge variant="success" className="gap-1">
                <Landmark className="h-3 w-3" aria-hidden="true" />
                {t('landmark')}
              </Badge>
            ) : null}
            <Badge variant="outline">{workflowT(`relevance.${article.relevanceState}`)}</Badge>
            <Badge variant="outline">{workflowT(`visibility.${article.visibilityState}`)}</Badge>
          </div>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
            {article.title}
          </h1>
          {authors ? <p className="text-base text-muted-foreground">{authors}</p> : null}
          {citation ? <p className="font-medium text-foreground/80">{citation}</p> : null}
          <div className="flex flex-wrap gap-2">
            {article.topics
              .filter((topic) => topic.assignmentState === 'confirmed')
              .map((topic) => (
                <Badge
                  key={`${topic.id}:${topic.assignmentSource}:${topic.modelOrRuleVersion}`}
                  className="normal-case tracking-normal"
                >
                  {literatureTopicLabel(topic, locale)}
                </Badge>
              ))}
            {article.publicationTypes.map((publicationType) => (
              <Badge
                key={publicationType}
                variant="secondary"
                className="normal-case tracking-normal"
              >
                {publicationType}
              </Badge>
            ))}
          </div>
        </header>

        {article.isRetracted || article.isCorrection || article.isConferenceAbstract ? (
          <section
            aria-label={t('warnings')}
            className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5"
          >
            <h2 className="flex items-center gap-2 font-semibold">
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
              {t('warnings')}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {article.isRetracted ? <li>{t('retracted')}</li> : null}
              {article.isCorrection ? <li>{t('correction')}</li> : null}
              {article.isConferenceAbstract ? <li>{t('conferenceAbstract')}</li> : null}
            </ul>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('abstract')}</CardTitle>
              <CardDescription>
                {article.abstractDisplayPolicy === 'full_allowed'
                  ? t('fullAbstractPolicy')
                  : article.abstractDisplayPolicy === 'snippet_only'
                    ? t('snippetPolicy')
                    : t('hiddenPolicy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                {abstractText ?? t('abstractUnavailable')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('identifiers')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                <dt className="font-medium">{t('pmid')}</dt>
                <dd>{article.pmid}</dd>
                <dt className="font-medium">{t('doi')}</dt>
                <dd className="break-all">{article.doi ?? '—'}</dd>
                <dt className="font-medium">PMCID</dt>
                <dd>{article.pmcid ?? '—'}</dd>
              </dl>
              <div className="mt-4 flex flex-col items-start gap-2">
                <a
                  href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  {t('openPubMed')}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                {article.doi ? (
                  <a
                    href={`https://doi.org/${encodeURIComponent(article.doi)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    {t('openDoi')}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('retrievalSources')}</CardTitle>
            <CardDescription>{t('retrievalSourcesBody')}</CardDescription>
          </CardHeader>
          <CardContent>
            {article.sources.length > 0 ? (
              <ul className="divide-y divide-border/70 text-sm">
                {article.sources.map((source) => (
                  <li
                    key={`${source.batchId}-${source.sourceFilename}`}
                    className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]"
                  >
                    <span className="font-medium">
                      {workflowT(`sourceKind.${source.sourceKind}`)}
                    </span>
                    <span className="text-muted-foreground">
                      {source.sourceFilename}
                      {source.queryId ? ` · ${source.queryId}` : ''}
                      {source.sourceId ? ` · ${source.sourceId}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t('noRetrievalSources')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>{t('relatedArticles')}</CardTitle>
            <CardDescription>{t('relatedArticlesPlaceholder')}</CardDescription>
          </CardHeader>
        </Card>
      </article>

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('disclaimer')}
      </p>
    </div>
  )
}
