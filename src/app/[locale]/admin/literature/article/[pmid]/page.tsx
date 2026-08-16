import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { flattenLiteratureTaxonomy } from '@/features/literature/config'
import { LiteratureCapabilityNotice } from '@/features/literature/components/LiteratureCapabilityNotice'
import { LiteratureReviewForm } from '@/features/literature/components/LiteratureReviewForm'
import {
  compactLiteratureAuthors,
  literatureCitationParts,
  literatureTopicLabel,
} from '@/features/literature/domain/display'
import { pmidSchema } from '@/features/literature/schemas/search'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import { literatureOperationActivated } from '@/features/literature/server/database-client'
import { getLiteratureArticle } from '@/features/literature/server/queries'
import { capabilityForWithheldOperation } from '@/features/literature/server/runtime-capability'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

interface LiteratureAdminArticlePageProps {
  params: Promise<{ locale: string; pmid: string }>
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

export async function generateMetadata({
  params,
}: LiteratureAdminArticlePageProps): Promise<Metadata> {
  const { locale, pmid } = await params
  const t = await getTranslations({
    locale,
    namespace: 'literature.admin.article',
  })
  return {
    title: t('metadataTitle', { pmid }),
    robots: { index: false, follow: false },
  }
}

export default async function LiteratureAdminArticlePage({
  params,
}: LiteratureAdminArticlePageProps) {
  const { locale: rawLocale, pmid: rawPmid } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, `/admin/literature/article/${rawPmid}`)
  const t = await getTranslations('literature.admin.article')
  const workflowT = await getTranslations('literature.workflow')
  const capabilityT = await getTranslations('literature.capability')
  const pmid = pmidSchema.safeParse(rawPmid)
  if (!pmid.success) {
    notFound()
  }
  const detail = await getLiteratureArticle(pmid.data)
  if (detail.error) {
    // Which failure it was matters here: a missing foundation, an unconfigured deployment, and a
    // transient outage all reach this branch and have different remedies.
    return (
      <div className="container max-w-3xl space-y-6 py-12">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{t('loadError')}</CardTitle>
          </CardHeader>
          <CardContent>
            <LiteratureCapabilityNotice
              capability={detail.capability}
              title={capabilityT('bannerTitle')}
              description={capabilityT(`state.${detail.capability.state}`)}
              projectLabel={capabilityT('projectLabel')}
              reasonLabel={capabilityT('reason')}
            />
          </CardContent>
        </Card>
      </div>
    )
  }
  if (!detail.data) {
    notFound()
  }
  const article = detail.data
  const curationAvailable = literatureOperationActivated('article_curation')
  const authors = compactLiteratureAuthors(article.authors, article.collectiveAuthors)
  const citation = literatureCitationParts(article)

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <Link
        href="/admin/literature"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('back')}
      </Link>

      <header className="max-w-5xl space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{workflowT(`relevance.${article.relevanceState}`)}</Badge>
          <Badge variant="outline">{workflowT(`visibility.${article.visibilityState}`)}</Badge>
          {article.isLandmark ? <Badge variant="success">{t('landmark')}</Badge> : null}
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          {article.title}
        </h1>
        {authors ? <p className="text-muted-foreground">{authors}</p> : null}
        {citation ? <p className="font-medium">{citation}</p> : null}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <span>PMID {article.pmid}</span>
          {article.doi ? <span>DOI {article.doi}</span> : null}
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            {t('openPubMed')}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('curationTitle')}</CardTitle>
            <CardDescription>
              {curationAvailable ? t('curationDescription') : capabilityT('curation.body')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {curationAvailable ? (
              <LiteratureReviewForm
                article={article}
                locale={locale}
                topics={flattenLiteratureTaxonomy()}
              />
            ) : (
              /*
               * The form is withheld rather than disabled-in-place.
               * `article_curation` is not on the activated allowlist, so every submission would
               * reach `curateLiteratureArticle`, be refused before the payload is even validated,
               * and surface as a generic save error — an admin would reasonably read that as data
               * loss or a bug. Saying so up front is the honest presentation.
               */
              <LiteratureCapabilityNotice
                capability={capabilityForWithheldOperation(
                  detail.capability.projectRef,
                  'write_capability_withheld',
                  capabilityT('curation.body'),
                )}
                title={capabilityT('curation.title')}
                description={capabilityT('state.write_capability_withheld')}
                projectLabel={capabilityT('projectLabel')}
                reasonLabel={capabilityT('reason')}
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('abstractTitle')}</CardTitle>
              <CardDescription>
                {t('abstractPolicy', {
                  policy: workflowT(`abstractPolicy.${article.abstractDisplayPolicy}`),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {article.abstract ?? t('abstractUnavailable')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('topicsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {article.topics.length > 0 ? (
                <ul className="space-y-3 text-sm">
                  {article.topics.map((topic) => (
                    <li key={`${topic.id}:${topic.assignmentSource}:${topic.modelOrRuleVersion}`}>
                      <p className="font-medium">{literatureTopicLabel(topic, locale)}</p>
                      <p className="text-xs text-muted-foreground">
                        {workflowT(`assignmentSource.${topic.assignmentSource}`)} ·{' '}
                        {workflowT(`assignmentState.${topic.assignmentState}`)} ·{' '}
                        {topic.modelOrRuleVersion}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noTopics')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('sourcesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {article.sources.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4">{t('sourceKind')}</th>
                    <th className="py-2 pr-4">{t('sourceId')}</th>
                    <th className="py-2 pr-4">{t('queryId')}</th>
                    <th className="py-2">{t('filename')}</th>
                  </tr>
                </thead>
                <tbody>
                  {article.sources.map((source) => (
                    <tr
                      key={`${source.batchId}-${source.sourceFilename}`}
                      className="border-b border-border/60"
                    >
                      <td className="py-2 pr-4">{workflowT(`sourceKind.${source.sourceKind}`)}</td>
                      <td className="py-2 pr-4">{source.sourceId ?? '—'}</td>
                      <td className="py-2 pr-4">{source.queryId ?? '—'}</td>
                      <td className="py-2">{source.sourceFilename}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noSources')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('auditTitle')}</CardTitle>
          <CardDescription>{t('auditDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {article.curationEvents.length > 0 ? (
            <ol className="space-y-4">
              {article.curationEvents.map((event) => (
                <li key={event.id} className="rounded-xl border border-border/70 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{workflowT(`eventType.${event.eventType}`)}</strong>
                    <time dateTime={event.createdAt} className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString(locale)}
                    </time>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {event.actorEmail ?? t('unknownActor')}
                  </p>
                  {event.reason ? <p className="mt-2">{event.reason}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noAudit')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
