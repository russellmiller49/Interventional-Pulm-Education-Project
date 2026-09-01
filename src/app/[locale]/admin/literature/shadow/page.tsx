import type { Metadata } from 'next'
import { Bot, Database, ExternalLink, FlaskConical, ShieldCheck } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import sourceLock from '../../../../../../config/literature/shadow-atlas-v1.json'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LiteratureCapabilityNotice } from '@/features/literature/components/LiteratureCapabilityNotice'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import {
  literatureShadowRelevanceValues,
  literatureShadowZoneValues,
  loadLiteratureShadowOverview,
  type LiteratureShadowFilters,
  type LiteratureShadowRelevance,
  type LiteratureShadowZone,
} from '@/features/literature/server/shadow'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Literature AI/ML shadow',
  robots: { index: false, follow: false },
}

interface ShadowPageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function localeValue(value: string): ActiveLocale {
  return isActiveLocale(value) ? value : 'en'
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function parseFilters(
  values: Record<string, string | string[] | undefined>,
): LiteratureShadowFilters {
  const runValue = first(values.run)
  const pageValue = first(values.page)
  const relevanceValue = first(values.relevance)
  const zoneValue = first(values.zone)
  const runId = runValue && /^\d+$/.test(runValue) ? Number(runValue) : undefined
  const page = pageValue && /^\d+$/.test(pageValue) ? Math.max(1, Number(pageValue)) : 1
  const relevance = literatureShadowRelevanceValues.includes(
    relevanceValue as LiteratureShadowRelevance,
  )
    ? (relevanceValue as LiteratureShadowRelevance)
    : undefined
  const zone = literatureShadowZoneValues.includes(zoneValue as LiteratureShadowZone)
    ? (zoneValue as LiteratureShadowZone)
    : undefined
  return { runId, relevance, zone, page }
}

function pageHref(filters: LiteratureShadowFilters, page: number): string {
  const values = new URLSearchParams()
  if (filters.runId) values.set('run', String(filters.runId))
  if (filters.relevance) values.set('relevance', filters.relevance)
  if (filters.zone) values.set('zone', filters.zone)
  if (page > 1) values.set('page', String(page))
  const query = values.toString()
  return `/admin/literature/shadow${query ? `?${query}` : ''}`
}

function percent(value: number): string {
  return new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 }).format(value)
}

export default async function LiteratureShadowPage({ params, searchParams }: ShadowPageProps) {
  const { locale: rawLocale } = await params
  const locale = localeValue(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, '/admin/literature/shadow')
  const capabilityT = await getTranslations('literature.capability')
  const filters = parseFilters((await searchParams) ?? {})
  const result = await loadLiteratureShadowOverview(filters)
  const data = result.data
  const selected = data?.selectedRun ?? null
  const ml = sourceLock.screeningModel

  return (
    <div className="container space-y-8 py-10 md:py-14">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/literature">← Back to Literature administration</Link>
        </Button>
      </div>

      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl space-y-3">
          <Badge variant="info">Administrator-only research shadow</Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Literature AI/ML shadow
          </h1>
          <p className="text-base leading-7 text-muted-foreground">
            Compare versioned conference classifications and screening-model output without changing
            canonical articles, physician-reviewed fields, or the public Literature Explorer.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={sourceLock.repository} target="_blank" rel="noreferrer">
            Private source repository <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      </section>

      <Card className="border-amber-500/40 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Non-clinical, non-authoritative output
          </CardTitle>
          <CardDescription className="leading-6 text-foreground/80">
            These machine labels prioritize research review. They are not physician review,
            evidence-quality grades, guideline recommendations, or patient-care guidance. No shadow
            value overrides a reviewed field.
          </CardDescription>
        </CardHeader>
      </Card>

      <LiteratureCapabilityNotice
        capability={result.capability}
        title={capabilityT('bannerTitle')}
        description={capabilityT(`state.${result.capability.state}`)}
        projectLabel={capabilityT('projectLabel')}
        reasonLabel={capabilityT('reason')}
      />

      <section
        className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Pinned source summary"
      >
        <Card>
          <CardContent className="space-y-2 p-5">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Conference corpus</p>
            <p className="text-2xl font-semibold">
              {sourceLock.conferenceProjection.articleCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Pinned SQLite runtime</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Screening ROC-AUC</p>
            <p className="text-2xl font-semibold">{ml.rocAuc.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">Held-out test set, n={ml.testRows}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <FlaskConical className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Retained include recall</p>
            <p className="text-2xl font-semibold">{percent(ml.testZones.retainedRecall)}</p>
            <p className="text-xs text-muted-foreground">At the auto-exclude boundary</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Review-zone test records</p>
            <p className="text-2xl font-semibold">{ml.testZones.review.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Thresholds {ml.lowThreshold.toFixed(3)}–{ml.highThreshold.toFixed(3)}
            </p>
          </CardContent>
        </Card>
      </section>

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Shadow run browser</CardTitle>
              <CardDescription>
                Only isolated shadow tables are queried. Filters never mutate or publish data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-4" method="get">
                <label className="space-y-2 text-sm font-medium">
                  Run
                  <select
                    name="run"
                    defaultValue={selected?.id ?? ''}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {data.runs.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.runKey}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Predicted relevance
                  <select
                    name="relevance"
                    defaultValue={filters.relevance ?? ''}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All classes</option>
                    {literatureShadowRelevanceValues.map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                  Decision zone
                  <select
                    name="zone"
                    defaultValue={filters.zone ?? ''}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">All zones</option>
                    {literatureShadowZoneValues.map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <Button type="submit">Apply</Button>
                  <Button asChild type="button" variant="outline">
                    <Link href="/admin/literature/shadow">Clear</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {selected ? (
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Selected run">
              {[
                ['Classifications', selected.classificationCount],
                ['Enhancements', selected.enhancementCount],
                ['Normalized terms', selected.termCount],
                ['Filtered results', data.total],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-semibold">{Number(value).toLocaleString()}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          ) : null}

          <section className="space-y-4">
            <div>
              <h2 className="text-2xl font-semibold">Shadow classifications</h2>
              <p className="text-sm text-muted-foreground">
                {data.total.toLocaleString()} filtered records · page {data.page} of{' '}
                {Math.max(1, data.pageCount)}
              </p>
            </div>
            {data.items.length ? (
              <div className="space-y-3">
                {data.items.map((item) => (
                  <Card key={`${selected?.id ?? 'run'}-${item.pmid}`}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="max-w-4xl space-y-1">
                          <a
                            href={`https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold hover:underline"
                          >
                            {item.title}
                          </a>
                          <p className="text-sm text-muted-foreground">
                            PMID {item.pmid}
                            {item.journal ? ` · ${item.journal}` : ''}
                            {item.publicationYear ? ` · ${item.publicationYear}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">
                            {item.predictedRelevance.replaceAll('_', ' ')}
                          </Badge>
                          <Badge variant={item.decisionZone === 'review' ? 'warning' : 'secondary'}>
                            {item.decisionZone.replaceAll('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      {item.displaySummary ? (
                        <p className="text-sm leading-6 text-muted-foreground">
                          {item.displaySummary}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                        {item.inclusionProbability !== null ? (
                          <span>Include probability {percent(item.inclusionProbability)}</span>
                        ) : null}
                        {item.predictedConfidence ? (
                          <span>Model confidence {item.predictedConfidence}</span>
                        ) : null}
                        {item.predictedCategory ? (
                          <span>Category {item.predictedCategory}</span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No shadow classifications match these filters.
                </CardContent>
              </Card>
            )}
            {data.pageCount > 1 ? (
              <nav className="flex items-center justify-between" aria-label="Shadow result pages">
                {data.page <= 1 ? (
                  <Button variant="outline" disabled>
                    Previous
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link href={pageHref(filters, data.page - 1)}>Previous</Link>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {data.page} of {data.pageCount}
                </span>
                {data.page >= data.pageCount ? (
                  <Button variant="outline" disabled>
                    Next
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link href={pageHref(filters, data.page + 1)}>Next</Link>
                  </Button>
                )}
              </nav>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  )
}
