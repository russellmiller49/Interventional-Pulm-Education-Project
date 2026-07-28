import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { AlertOctagon, Boxes, CirclePlus, FileClock, Layers, MapPinOff, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { CardRowActions } from '@/features/preference-cards/components/CardRowActions'
import { PrototypeBanner } from '@/features/preference-cards/components/PrototypeBanner'
import { ReadinessBadge } from '@/features/preference-cards/components/ReadinessBadge'
import { getDashboardMetrics } from '@/features/preference-cards/data/demo-context.server'
import { getCatalogOverview } from '@/features/preference-cards/server/catalog'
import { listUserCards } from '@/features/preference-cards/server/user-cards'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function PreferenceCardsDashboard({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const tCatalog = await getTranslations('preferenceCards.catalog')
  const tSets = await getTranslations('preferenceCards.sets')
  const metrics = getDashboardMetrics()
  const catalogOverview = getCatalogOverview()
  const savedCards = await listUserCards()
  const metricCards = [
    {
      label: t('unresolvedRequired'),
      value: metrics.totals.unresolvedRequiredRoles,
      icon: Boxes,
    },
    {
      label: t('unassigned'),
      value: metrics.totals.unassignedItems,
      icon: MapPinOff,
    },
    {
      label: t('blockingConflicts'),
      value: metrics.totals.blockingCompatibilityConflicts,
      icon: AlertOctagon,
    },
  ]

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <PrototypeBanner title={t('prototypeBanner')} disclaimer={t('disclaimer')} />

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {t('eyebrow')}
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground md:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg" elevated>
            <Link href={`/${locale}/preference-cards/new` as Route}>
              <CirclePlus aria-hidden="true" className="h-5 w-5" />
              {t('createNewCard')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}/preference-cards/catalog` as Route}>
              <Search aria-hidden="true" className="h-5 w-5" />
              {tCatalog('browseCatalogCta')}
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={`/${locale}/preference-cards/sets` as Route}>
              <Layers aria-hidden="true" className="h-5 w-5" />
              {tSets('title')}
            </Link>
          </Button>
        </div>
      </header>

      <section aria-label={tCatalog('heading')} className="grid gap-4 md:grid-cols-2">
        <Link
          href={`/${locale}/preference-cards/catalog` as Route}
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full transition hover:border-primary hover:shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search aria-hidden="true" className="h-5 w-5 text-primary" />
                {tCatalog('heading')}
              </CardTitle>
              <CardDescription>{tCatalog('description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="normal-case tracking-normal">
                {tCatalog('overviewCounts', {
                  products: catalogOverview.productCount,
                  manufacturers: catalogOverview.manufacturerCount,
                  uses: catalogOverview.roleCount,
                })}
              </Badge>
            </CardContent>
          </Card>
        </Link>
        <Link
          href={`/${locale}/preference-cards/catalog/uses` as Route}
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="h-full transition hover:border-primary hover:shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers aria-hidden="true" className="h-5 w-5 text-primary" />
                {tCatalog('uses.heading')}
              </CardTitle>
              <CardDescription>{tCatalog('uses.description')}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </section>

      <section aria-label={t('dashboard')} className="grid gap-4 sm:grid-cols-3">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="hover:shadow-sm">
            <CardContent className="flex-row items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <p className="text-3xl font-black text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t('goldenScenarios')}
          </h2>
          <Badge variant="outline">{metrics.scenarios.length}</Badge>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {metrics.scenarios.map((scenario) => (
            <Card key={scenario.id}>
              <CardHeader>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline">{scenario.governanceState}</Badge>
                  <ReadinessBadge
                    state={scenario.readinessState}
                    label={t(`readiness.${scenario.readinessState}`)}
                  />
                </div>
                <CardTitle>{scenario.title}</CardTitle>
                <CardDescription>{scenario.shortDescription}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('sourceRecipe')}</dt>
                    <dd className="mt-1 font-mono text-xs font-semibold">
                      {scenario.sourceProcedureCode}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('owner')}</dt>
                    <dd className="mt-1 font-semibold">
                      {scenario.owner ?? t('ownerNotAssigned')}
                    </dd>
                  </div>
                </dl>
                <div className="rounded-xl bg-muted/60 p-3">
                  <p className="font-semibold text-foreground">
                    {t('mapped', {
                      percent: scenario.requiredRoleMappingPercentage,
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {scenario.unresolvedRequiredRoles} {t('unresolvedRequired')} ·{' '}
                    {scenario.unassignedItems} {t('unassigned')}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex-wrap">
                <Button asChild size="sm">
                  <Link href={`/${locale}/preference-cards/new?scenario=${scenario.id}` as Route}>
                    {t('launchScenario')}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <FileClock aria-hidden="true" className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">{t('recentCards')}</h2>
          <Badge variant="outline">{savedCards.length}</Badge>
        </div>
        {savedCards.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            {t('noRecentCards')}
          </p>
        ) : (
          <div className="space-y-3">
            {savedCards.map((savedCard) => (
              <div
                key={savedCard.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{savedCard.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[
                        savedCard.physicianName,
                        savedCard.procedureCode,
                        new Date(savedCard.updatedAt).toLocaleString(),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{t(`status.${savedCard.status}`)}</Badge>
                    <ReadinessBadge
                      state={savedCard.readinessState}
                      label={t(`readiness.${savedCard.readinessState}`)}
                    />
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/${locale}/preference-cards/${savedCard.id}` as Route}>
                        {t('openCard')}
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="border-t border-border px-3 pb-3">
                  <CardRowActions locale={locale} card={savedCard} layout="row" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
