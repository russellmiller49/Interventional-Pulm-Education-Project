import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { OpenFdaReviewQueue } from '@/features/preference-cards/components/OpenFdaReviewQueue'
import {
  getOpenFdaReviewData,
  type OpenFdaReviewRow,
} from '@/features/preference-cards/data/openfda-proposals.server'

export const metadata: Metadata = {
  title: 'openFDA UDI candidate review',
  robots: { index: false, follow: false, noarchive: true },
}

type SearchValue = string | string[] | undefined

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, SearchValue>>
}

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 160) ?? ''
}

const filterKeys = [
  'classification',
  'manufacturer',
  'procedure',
  'role',
  'backlogConflict',
  'distribution',
] as const

function filterOpenFdaReviewRows(
  rows: OpenFdaReviewRow[],
  query: Record<string, SearchValue>,
): OpenFdaReviewRow[] {
  const classification = first(query.classification)
  const manufacturer = first(query.manufacturer).toLocaleLowerCase()
  const procedure = first(query.procedure).toLocaleLowerCase()
  const role = first(query.role).toLocaleLowerCase()
  const backlogConflict = first(query.backlogConflict)
  const distribution = first(query.distribution).toLocaleLowerCase()
  return rows.filter(
    (row) =>
      (!classification || row.classification === classification) &&
      (!manufacturer ||
        row.manufacturer?.toLocaleLowerCase().includes(manufacturer) ||
        row.candidateManufacturer?.toLocaleLowerCase().includes(manufacturer)) &&
      (!procedure || row.procedures?.toLocaleLowerCase().includes(procedure)) &&
      (!role || row.roles?.toLocaleLowerCase().includes(role)) &&
      (!backlogConflict || row.backlogConflict === (backlogConflict === 'conflict')) &&
      (!distribution || row.distributionStatus?.toLocaleLowerCase().includes(distribution)),
  )
}

export default async function OpenFdaCatalogQaPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const query = await searchParams
  const reviewData = await getOpenFdaReviewData()
  const filtered =
    reviewData.status === 'available' ? filterOpenFdaReviewRows(reviewData.rows, query) : []
  const pageSize = 25
  const requestedPage = Number.parseInt(first(query.page), 10)
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(
    pageCount,
    Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1),
  )
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const pageHref = (page: number) => {
    const params = new URLSearchParams()
    for (const key of filterKeys) {
      const value = first(query[key])
      if (value) params.set(key, value)
    }
    params.set('page', String(page))
    return `/${locale}/admin/preference-cards/catalog-qa/openfda?${params.toString()}` as Route
  }

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.openfdaTitle')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('admin.openfdaDescription')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <aside className="rounded-2xl border border-amber-400/60 bg-amber-50 p-5 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        {t('admin.openfdaSafety')}
      </aside>

      {reviewData.status === 'available' ? (
        <form className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {t('admin.filters')}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-foreground">
              {t('admin.openfdaClassification')}
              <select
                name="classification"
                defaultValue={first(query.classification)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="">{t('admin.openfdaAllClassifications')}</option>
                <option value="high_confidence_candidate">
                  {t('admin.openfdaClassificationHigh')}
                </option>
                <option value="review_required">{t('admin.openfdaClassificationReview')}</option>
                <option value="unmatched">{t('admin.openfdaClassificationUnmatched')}</option>
                <option value="insufficient_identifiers">
                  {t('admin.openfdaClassificationInsufficient')}
                </option>
                <option value="query_error">{t('admin.openfdaClassificationError')}</option>
              </select>
            </label>
            {(['manufacturer', 'procedure', 'role', 'distribution'] as const).map((key) => (
              <label key={key} className="text-xs font-semibold text-foreground">
                {t(`admin.${key}`)}
                <input
                  name={key}
                  defaultValue={first(query[key])}
                  className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
                />
              </label>
            ))}
            <label className="text-xs font-semibold text-foreground">
              {t('admin.openfdaBacklogConflict')}
              <select
                name="backlogConflict"
                defaultValue={first(query.backlogConflict)}
                className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
              >
                <option value="">{t('admin.openfdaAllBacklogComparisons')}</option>
                <option value="conflict">{t('admin.openfdaConflictOnly')}</option>
                <option value="no-conflict">{t('admin.openfdaNoConflictOnly')}</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              {t('admin.applyFilters')}
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/admin/preference-cards/catalog-qa/openfda` as Route}>
                {t('admin.clearFilters')}
              </Link>
            </Button>
          </div>
        </form>
      ) : null}

      <OpenFdaReviewQueue status={reviewData.status} rows={rows} counts={reviewData.counts} />

      {reviewData.status === 'available' ? (
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
      ) : null}
    </div>
  )
}
