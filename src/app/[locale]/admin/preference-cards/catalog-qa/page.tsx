import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { CatalogVerificationQueue } from '@/features/preference-cards/components/CatalogVerificationQueue'
import {
  catalogVerificationFacets,
  catalogVerificationSignals,
  filterCatalogVerificationRows,
  getCatalogVerificationRows,
  summarizeCatalogVerificationRows,
  type CatalogVerificationFilters,
  type CatalogVerificationSignal,
} from '@/features/preference-cards/data/catalog-verification.server'

export const metadata: Metadata = {
  title: 'Preference-card catalog verification',
  robots: { index: false, follow: false, noarchive: true },
}

type SearchValue = string | string[] | undefined

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, SearchValue>>
}

const textFilterKeys = ['q', 'manufacturer', 'procedure', 'role', 'gudid', 'distribution'] as const

const allFilterKeys = [
  ...textFilterKeys,
  'priority',
  'workstream',
  'reviewStatus',
  'signal',
] as const

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 160) ?? ''
}

function signal(value: SearchValue): CatalogVerificationSignal | '' {
  const candidate = first(value)
  return catalogVerificationSignals.includes(candidate as CatalogVerificationSignal)
    ? (candidate as CatalogVerificationSignal)
    : ''
}

export default async function PreferenceCardCatalogQaPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const query = await searchParams
  const allRows = getCatalogVerificationRows()
  const facets = catalogVerificationFacets(allRows)
  const filters: CatalogVerificationFilters = {
    q: first(query.q),
    priority: first(query.priority),
    manufacturer: first(query.manufacturer),
    workstream: first(query.workstream),
    reviewStatus: first(query.reviewStatus),
    procedure: first(query.procedure),
    role: first(query.role),
    gudid: first(query.gudid),
    distribution: first(query.distribution),
    signal: signal(query.signal),
  }
  const filtered = filterCatalogVerificationRows(allRows, filters)
  const pageSize = 20
  const requestedPage = Number.parseInt(first(query.page), 10)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(
    pageCount,
    Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1),
  )
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageHref = (page: number) => {
    const hrefParams = new URLSearchParams()
    for (const key of allFilterKeys) {
      const value = first(query[key])
      if (value) hrefParams.set(key, value)
    }
    hrefParams.set('page', String(page))
    return `/${locale}/admin/preference-cards/catalog-qa?${hrefParams.toString()}` as Route
  }

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.catalogQaTitle')}</h1>
        <p className="max-w-4xl text-muted-foreground">
          {t('admin.verificationWorkflowDescription')}
        </p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <aside className="rounded-2xl border border-amber-400/60 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-bold">{t('admin.verificationSafetyTitle')}</p>
        <p className="mt-1">{t('admin.verificationSafety')}</p>
      </aside>

      <section
        aria-labelledby="full-catalog-clinical-use-heading"
        className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm"
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2">
              <FileSpreadsheet aria-hidden="true" className="h-5 w-5 text-primary" />
              <h2
                id="full-catalog-clinical-use-heading"
                className="text-xl font-bold tracking-tight"
              >
                {t('admin.clinicalUseReviewEntryTitle')}
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('admin.clinicalUseReviewEntryDescription')}
            </p>
          </div>
          <Button
            asChild
            className="h-auto min-h-10 w-full shrink-0 justify-center whitespace-normal text-center lg:w-auto"
          >
            <Link href={`/${locale}/admin/preference-cards/catalog-qa/clinical-use` as Route}>
              {t('admin.clinicalUseReviewEntryAction')}
            </Link>
          </Button>
        </div>
      </section>

      <form className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t('admin.filters')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-foreground sm:col-span-2">
            {t('admin.verificationSearch')}
            <input
              name="q"
              defaultValue={first(query.q)}
              placeholder={t('admin.verificationSearchPlaceholder')}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.priority')}
            <select
              name="priority"
              defaultValue={first(query.priority)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.verificationAllPriorities')}</option>
              {facets.priorities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.verificationSignal')}
            <select
              name="signal"
              defaultValue={signal(query.signal)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.verificationAllSignals')}</option>
              {catalogVerificationSignals.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.verificationSignal_${value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.workstream')}
            <select
              name="workstream"
              defaultValue={first(query.workstream)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.verificationAllWorkstreams')}</option>
              {facets.workstreams.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.reviewStatus')}
            <select
              name="reviewStatus"
              defaultValue={first(query.reviewStatus)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.verificationAllReviewStatuses')}</option>
              {facets.reviewStatuses.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          {(['manufacturer', 'procedure', 'role', 'gudid', 'distribution'] as const).map((key) => (
            <label key={key} className="text-xs font-semibold text-foreground">
              {t(`admin.${key}`)}
              <input
                name={key}
                defaultValue={first(query[key])}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {t('admin.applyFilters')}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/admin/preference-cards/catalog-qa` as Route}>
              {t('admin.clearFilters')}
            </Link>
          </Button>
        </div>
      </form>

      <CatalogVerificationQueue
        rows={rows}
        summary={summarizeCatalogVerificationRows(allRows)}
        locale={locale}
      />

      <div className="flex items-center justify-between gap-3">
        {currentPage <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            {t('admin.previous')}
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={pageHref(currentPage - 1)}>{t('admin.previous')}</Link>
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {t('admin.page', { page: currentPage, pages: pageCount })} · {filtered.length}
        </p>
        {currentPage >= pageCount ? (
          <Button variant="outline" size="sm" disabled>
            {t('admin.next')}
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={pageHref(currentPage + 1)}>{t('admin.next')}</Link>
          </Button>
        )}
      </div>
    </div>
  )
}
