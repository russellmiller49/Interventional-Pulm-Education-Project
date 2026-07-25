import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { getFormularyRoleRows } from '@/features/preference-cards/data/demo-context.server'

import { saveHospitalMappingAction } from './actions'

export const metadata: Metadata = {
  title: 'Preference-card formulary mapping',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ unresolved?: string | string[] }>
}

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
        <p className="max-w-3xl text-muted-foreground">{t('admin.mappingSeedNote')}</p>
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
          <form
            action={saveHospitalMappingAction}
            key={row.roleCode}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="roleCode" value={row.roleCode} />
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
              <Button type="submit" size="sm">
                {t('admin.saveMapping')}
              </Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-foreground md:col-span-2">
                {t('admin.product')}
                <select
                  name="catalogProductId"
                  defaultValue={row.selectedItem?.catalogProduct?.productId ?? ''}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">{t('admin.genericLocalResource')}</option>
                  {row.eligibleProducts.map((product) => (
                    <option key={product.productId} value={product.productId}>
                      {[product.manufacturer, product.productName, product.catalogNumber]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-foreground md:col-span-2">
                {t('admin.localItem')}
                <input
                  name="localDescription"
                  required
                  maxLength={240}
                  defaultValue={row.selectedItem?.localDescription ?? ''}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                {t('admin.localItemNumber')}
                <input
                  name="localItemNumber"
                  maxLength={120}
                  defaultValue={row.selectedItem?.localItemNumber ?? ''}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                {t('admin.uom')}
                <input
                  name="localUom"
                  maxLength={80}
                  defaultValue={row.selectedItem?.localUom ?? ''}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                {t('admin.storage')}
                <input
                  name="storageLocation"
                  maxLength={160}
                  defaultValue={row.selectedItem?.storageLocation ?? ''}
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-foreground">
                {t('admin.semantics')}
                <select
                  name="substitutionClass"
                  defaultValue="preferred"
                  className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {[
                    'preferred',
                    'acceptable',
                    'shortage_substitute',
                    'backup',
                    'emergency_only',
                    'no_substitute',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {row.selectedItem?.verificationState ?? 'unverified'} · {t('admin.mappingPrototype')}
            </p>
          </form>
        ))}
      </div>
    </div>
  )
}
