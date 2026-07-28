import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { getFormularyRoleRows } from '@/features/preference-cards/data/demo-context.server'

export const metadata: Metadata = {
  title: 'Preference-card formulary coverage',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ unresolved?: string | string[] }>
}

/**
 * Read-only coverage view: which procedure requirements resolve to a seeded item and which
 * do not.
 *
 * This page used to write hospital-local mappings into an organization/site/room schema that
 * was never applied and has since been dropped in favour of per-user cards. Cards now carry
 * their own product choices, made from the catalog in the wizard, so there is no shared
 * formulary to edit — what remains useful is seeing where the seed data is thin.
 */
export default async function PreferenceCardFormularyPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const query = await searchParams
  const unresolvedOnly =
    (Array.isArray(query.unresolved) ? query.unresolved[0] : query.unresolved) === '1'
  const allRows = getFormularyRoleRows()
  const rows = unresolvedOnly
    ? allRows.filter((row) => row.resolutionState === 'blocking')
    : allRows

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.formularyTitle')}</h1>
        <p className="max-w-3xl text-muted-foreground">{t('admin.formularyReadOnlyNote')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {rows.length} / {allRows.length}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link
            href={
              (unresolvedOnly
                ? `/${locale}/admin/preference-cards/formulary`
                : `/${locale}/admin/preference-cards/formulary?unresolved=1`) as Route
            }
          >
            {unresolvedOnly ? t('admin.showAllRoles') : t('admin.filterUnresolved')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-5">
        {rows.map((row) => (
          <section
            key={row.roleCode}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{row.label}</h2>
                  <Badge variant="outline">{row.requiredness}</Badge>
                  <Badge variant={row.resolutionState === 'blocking' ? 'destructive' : 'outline'}>
                    {row.resolutionState}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {row.roleCode} · {row.scenarioTitle}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/${locale}/preference-cards/catalog/uses/${row.roleCode}` as Route}>
                  {t('admin.viewCatalogUse')}
                </Link>
              </Button>
            </div>

            <dl className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-foreground">{t('admin.localItem')}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {row.selectedItem?.localDescription ?? t('unresolvedLocalItem')}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-sm font-medium text-foreground">{t('admin.product')}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {[
                    row.selectedItem?.catalogProduct?.manufacturer,
                    row.selectedItem?.catalogProduct?.productName,
                    row.selectedItem?.catalogProduct?.catalogNumber,
                  ]
                    .filter(Boolean)
                    .join(' · ') || t('admin.genericLocalResource')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">
                  {t('admin.localItemNumber')}
                </dt>
                <dd className="mt-1 font-mono text-sm text-muted-foreground">
                  {row.selectedItem?.localItemNumber ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">{t('admin.uom')}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {row.selectedItem?.localUom ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">{t('admin.storage')}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {row.selectedItem?.storageLocation ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">{t('columns.verification')}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {row.selectedItem?.verificationState ?? 'unverified'}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              {t('admin.eligibleProductCount', { count: row.eligibleProducts.length })}
            </p>
          </section>
        ))}
      </div>
    </div>
  )
}
