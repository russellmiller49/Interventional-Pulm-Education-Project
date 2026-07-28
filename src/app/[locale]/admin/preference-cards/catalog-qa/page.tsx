import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import {
  getVerificationBacklog,
  type VerificationBacklogRow,
} from '@/features/preference-cards/data/demo-context.server'

export const metadata: Metadata = {
  title: 'Preference-card catalog QA',
  robots: { index: false, follow: false, noarchive: true },
}

type SearchValue = string | string[] | undefined

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, SearchValue>>
}

const filterFields = [
  ['priority', 'priority'],
  ['manufacturer', 'manufacturer'],
  ['workstream', 'workstream'],
  ['reviewStatus', 'review_status'],
  ['procedure', 'procedures'],
  ['role', 'roles'],
  ['gudid', 'gudid_result'],
  ['distribution', 'distribution_status'],
] as const satisfies ReadonlyArray<readonly [string, keyof VerificationBacklogRow]>

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 160) ?? ''
}

export default async function PreferenceCardCatalogQaPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const query = await searchParams
  const filters = new Map(
    filterFields.map(([queryKey, dataKey]) => [
      dataKey,
      first(query[queryKey]).toLocaleLowerCase(),
    ]),
  )
  const filtered = getVerificationBacklog().filter((row) =>
    [...filters.entries()].every(([key, value]) => {
      if (!value) return true
      return String(row[key] ?? '')
        .toLocaleLowerCase()
        .includes(value)
    }),
  )
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
    for (const [key] of filterFields) {
      const value = first(query[key])
      if (value) params.set(key, value)
    }
    params.set('page', String(page))
    return `/${locale}/admin/preference-cards/catalog-qa?${params.toString()}` as Route
  }

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.catalogQaTitle')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('admin.catalogReadOnly')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <form className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t('admin.filters')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {filterFields.map(([queryKey]) => (
            <label key={queryKey} className="text-xs font-semibold text-foreground">
              {t(`admin.${queryKey}`)}
              <input
                name={queryKey}
                defaultValue={first(query[queryKey])}
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

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[1450px] text-left text-xs">
          <thead className="bg-muted/70 uppercase tracking-wider text-muted-foreground">
            <tr>
              {[
                'priority',
                'manufacturer',
                'product',
                'catalogNumber',
                'workstream',
                'reviewStatus',
                'procedure',
                'role',
                'gudid',
                'distribution',
                'action',
                'evidence',
              ].map((column) => (
                <th key={column} className="px-3 py-3">
                  {t(`admin.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.product_id} className="align-top">
                <td className="px-3 py-3">{row.priority ?? '—'}</td>
                <td className="px-3 py-3">{row.manufacturer ?? '—'}</td>
                <td className="max-w-56 px-3 py-3 font-medium">
                  {row.product_name ?? row.product_id}
                </td>
                <td className="px-3 py-3 font-mono">{row.catalog_number ?? '—'}</td>
                <td className="px-3 py-3">{row.workstream ?? '—'}</td>
                <td className="px-3 py-3">{row.review_status ?? '—'}</td>
                <td className="max-w-56 px-3 py-3">{row.procedures ?? '—'}</td>
                <td className="max-w-56 px-3 py-3">{row.roles ?? '—'}</td>
                <td className="px-3 py-3">{row.gudid_result ?? '—'}</td>
                <td className="px-3 py-3">{row.distribution_status ?? '—'}</td>
                <td className="max-w-72 px-3 py-3">{row.recommended_action ?? '—'}</td>
                <td className="px-3 py-3">
                  {row.evidence_url?.startsWith('https://') ? (
                    <a
                      href={row.evidence_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                    >
                      {t('admin.evidence')}
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t('admin.noResults')}
          </p>
        ) : null}
      </div>

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
