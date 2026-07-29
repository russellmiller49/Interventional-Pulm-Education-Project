import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { ClinicalUseReviewImportWorkbench } from '@/features/preference-cards/components/ClinicalUseReviewImportWorkbench'

export const metadata: Metadata = {
  title: 'Import full-catalog clinical-use review',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function ClinicalUseReviewImportPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">
          {t('admin.clinicalUseReviewImportPageTitle')}
        </h1>
        <p className="max-w-4xl text-muted-foreground">
          {t('admin.clinicalUseReviewImportPageDescription')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/admin/preference-cards/catalog-qa/clinical-use` as Route}>
              {t('admin.clinicalUseReviewBackToReview')}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/admin/preference-cards/catalog-qa` as Route}>
              {t('admin.verificationBackToQueue')}
            </Link>
          </Button>
        </div>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <ClinicalUseReviewImportWorkbench locale={locale} />
    </div>
  )
}
