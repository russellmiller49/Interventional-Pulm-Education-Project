import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { literatureQueryRegistry } from '@/features/literature/config'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import { loadLiteratureAdminStats } from '@/features/literature/server/queries'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'

export const dynamic = 'force-dynamic'

interface LiteratureMethodsPageProps {
  params: Promise<{ locale: string }>
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

export async function generateMetadata({ params }: LiteratureMethodsPageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({
    locale,
    namespace: 'literature.methods',
  })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false },
  }
}

export default async function LiteratureMethodsPage({ params }: LiteratureMethodsPageProps) {
  const { locale: rawLocale } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, '/literature/methods')
  const t = await getTranslations('literature.methods')
  const stats = await loadLiteratureAdminStats()
  const included = stats.data?.relevanceCounts.included ?? 0

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <section className="max-w-4xl space-y-4">
        <Badge variant="info">{t('eyebrow')}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{t('heading')}</h1>
        <p className="text-base leading-7 text-muted-foreground md:text-lg">{t('description')}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('totalIndexed')}</p>
            <p className="text-3xl font-semibold">{stats.data?.totalArticles ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('included')}</p>
            <p className="text-3xl font-semibold">{stats.data ? included : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{t('lastImport')}</p>
            <p className="mt-1 text-sm font-semibold">
              {stats.data?.lastSuccessfulImport?.completed_at
                ? new Date(stats.data.lastSuccessfulImport.completed_at).toLocaleString(locale)
                : t('notAvailable')}
            </p>
          </CardContent>
        </Card>
      </section>

      {stats.error ? (
        <p
          role="status"
          className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm"
        >
          {t('liveCountsUnavailable')}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('layersTitle')}</CardTitle>
            <CardDescription>{t('layersDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm leading-6">
              <li>
                <strong>1. {t('coreLayerTitle')}</strong>
                <p className="text-muted-foreground">{t('coreLayerBody')}</p>
              </li>
              <li>
                <strong>2. {t('expandedLayerTitle')}</strong>
                <p className="text-muted-foreground">{t('expandedLayerBody')}</p>
              </li>
              <li>
                <strong>3. {t('allPubMedLayerTitle')}</strong>
                <p className="text-muted-foreground">{t('allPubMedLayerBody')}</p>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('registryTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="font-medium">{t('registryVersion')}</dt>
              <dd>{literatureQueryRegistry.registry_version}</dd>
              <dt className="font-medium">{t('preparedDate')}</dt>
              <dd>{literatureQueryRegistry.prepared_date}</dd>
              <dt className="font-medium">{t('dateCoverage')}</dt>
              <dd>{literatureQueryRegistry.date_filter}</dd>
              <dt className="font-medium">{t('coreJournals')}</dt>
              <dd>{literatureQueryRegistry.core_journals.length}</dd>
              <dt className="font-medium">{t('expandedJournals')}</dt>
              <dd>{literatureQueryRegistry.expanded_journals.length}</dd>
              <dt className="font-medium">{t('discoveryQueries')}</dt>
              <dd>{literatureQueryRegistry.discovery_queries.length}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('classificationTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            <p>{t('classificationBody')}</p>
            <p>{t('humanReviewBody')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('limitationsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>{t('limitationCurated')}</li>
              <li>{t('limitationCoverage')}</li>
              <li>{t('limitationNonPubMed')}</li>
              <li>{t('limitationAbstracts')}</li>
              <li>{t('limitationClassification')}</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('disclaimer')}
      </p>
    </div>
  )
}
