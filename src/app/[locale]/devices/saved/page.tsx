import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { SavedDevicesWorkspace } from '@/features/device-intelligence/components/SavedDevicesWorkspace'
import { getSaveDeviceLabels } from '@/features/device-intelligence/server/reference-labels.server'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'
import { getTaxonomyLabels } from '@/features/device-intelligence/server/product-taxonomy.server'

export const metadata: Metadata = {
  title: 'Saved devices',
  robots: { index: false, follow: false, noarchive: true },
}
export const dynamic = 'force-dynamic'

export default async function SavedDevicesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.savedDevices')
  const keys = [
    'loading',
    'empty',
    'find',
    'failed',
    'retry',
    'remove',
    'select',
    'compare',
    'selectionNote',
    'unavailable',
    'removeUnavailable',
    'safety',
    'snapshot',
  ] as const
  const labels = Object.fromEntries(keys.map((key) => [key, t(key)])) as Record<
    (typeof keys)[number],
    string
  >
  return (
    <div className="container space-y-5 py-8">
      <Link
        className="inline-flex min-h-11 items-center text-sm underline"
        href={`/${locale}/devices` as Route}
      >
        {t('find')}
      </Link>
      <header className="max-w-3xl space-y-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{t('note')}</p>
      </header>
      <SavedDevicesWorkspace
        locale={locale}
        labels={labels}
        saveLabels={await getSaveDeviceLabels(locale)}
        statusLabels={await getProductStatusLabels(locale)}
        typeLabels={getTaxonomyLabels(locale).subtypes}
      />
    </div>
  )
}
