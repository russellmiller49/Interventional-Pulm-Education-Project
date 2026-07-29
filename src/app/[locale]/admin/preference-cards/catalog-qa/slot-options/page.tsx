import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { ExactSlotReviewWorkbookControls } from '@/features/preference-cards/components/ExactSlotReviewWorkbookControls'
import { SlotOptionReviewQueue } from '@/features/preference-cards/components/SlotOptionReviewQueue'
import {
  filterSlotOptionReviewRows,
  getSlotOptionReviewArtifactSummary,
  getSlotOptionReviewRows,
  slotOptionReviewFacets,
  summarizeSlotOptionReviewRows,
  type SlotOptionReviewFilters,
} from '@/features/preference-cards/data/slot-option-proposals.server'

export const metadata: Metadata = {
  title: 'Exact-slot option proposal review',
  robots: { index: false, follow: false, noarchive: true },
}

type SearchValue = string | string[] | undefined

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, SearchValue>>
}

const filterKeys = [
  'q',
  'procedure',
  'role',
  'requiredness',
  'manufacturer',
  'distribution',
  'verification',
  'visibility',
] as const

function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 160) ?? ''
}

export default async function SlotOptionProposalReviewPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const query = await searchParams
  const allRows = getSlotOptionReviewRows()
  const facets = slotOptionReviewFacets(allRows)
  const filters: SlotOptionReviewFilters = Object.fromEntries(
    filterKeys.map((key) => [key, first(query[key])]),
  )
  const filtered = filterSlotOptionReviewRows(allRows, filters)
  const reviewSummary = summarizeSlotOptionReviewRows(allRows, getSlotOptionReviewArtifactSummary())
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
    for (const key of filterKeys) {
      const value = first(query[key])
      if (value) hrefParams.set(key, value)
    }
    hrefParams.set('page', String(page))
    return `/${locale}/admin/preference-cards/catalog-qa/slot-options?${hrefParams.toString()}` as Route
  }

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.slotReviewTitle')}</h1>
        <p className="max-w-4xl text-muted-foreground">{t('admin.slotReviewDescription')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <aside className="rounded-2xl border border-amber-400/60 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-bold">{t('admin.slotReviewSafetyTitle')}</p>
        <p className="mt-1">{t('admin.slotReviewSafety')}</p>
      </aside>

      <ExactSlotReviewWorkbookControls
        locale={locale}
        totalCount={allRows.length}
        filteredCount={filtered.length}
        requiredCount={reviewSummary.requiredProposals}
        filters={filters}
      />

      <form className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          {t('admin.filters')}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-foreground sm:col-span-2">
            {t('admin.slotReviewSearch')}
            <input
              name="q"
              defaultValue={first(query.q)}
              placeholder={t('admin.slotReviewSearchPlaceholder')}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.procedure')}
            <select
              name="procedure"
              defaultValue={first(query.procedure)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.slotReviewAllProcedures')}</option>
              {facets.procedures.map((procedure) => (
                <option key={procedure.code} value={procedure.code}>
                  {procedure.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.role')}
            <select
              name="role"
              defaultValue={first(query.role)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.slotReviewAllRoles')}</option>
              {facets.roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.slotReviewRequiredness')}
            <select
              name="requiredness"
              defaultValue={first(query.requiredness)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.slotReviewAllRequiredness')}</option>
              {facets.requiredness.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.manufacturer')}
            <input
              name="manufacturer"
              defaultValue={first(query.manufacturer)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.distribution')}
            <select
              name="distribution"
              defaultValue={first(query.distribution)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.slotReviewAllDistribution')}</option>
              <option value="in_distribution">{t('admin.verificationDistributionIn')}</option>
              <option value="not_in_distribution">{t('admin.verificationDistributionNot')}</option>
              <option value="conflicting">{t('admin.verificationDistributionConflict')}</option>
              <option value="unknown">{t('admin.verificationDistributionUnknown')}</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.verification')}
            <select
              name="verification"
              defaultValue={first(query.verification)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.slotReviewAllVerification')}</option>
              {facets.verificationGrades.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-foreground">
            {t('admin.verificationVisibility')}
            <select
              name="visibility"
              defaultValue={first(query.visibility)}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal"
            >
              <option value="">{t('admin.slotReviewAllVisibility')}</option>
              {facets.visibilityStates.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" size="sm">
            {t('admin.applyFilters')}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/admin/preference-cards/catalog-qa/slot-options` as Route}>
              {t('admin.clearFilters')}
            </Link>
          </Button>
        </div>
      </form>

      <SlotOptionReviewQueue rows={rows} summary={reviewSummary} locale={locale} />

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
