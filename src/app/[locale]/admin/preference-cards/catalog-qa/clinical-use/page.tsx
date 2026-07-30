import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { ClinicalUseReviewWorkbookControls } from '@/features/preference-cards/components/ClinicalUseReviewWorkbookControls'
import { getClinicalUseReviewCounts } from '@/features/preference-cards/data/clinical-use-review.server'

export const metadata: Metadata = {
  title: 'Full-catalog clinical-use audit',
  robots: { index: false, follow: false, noarchive: true },
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export default async function ClinicalUseReviewPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')
  const counts = getClinicalUseReviewCounts()

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight">{t('admin.clinicalUseReviewTitle')}</h1>
        <p className="max-w-4xl text-muted-foreground">{t('admin.clinicalUseReviewDescription')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>

      <aside className="space-y-1 rounded-2xl border border-amber-400/60 bg-amber-50 p-5 text-sm leading-6 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-bold">{t('admin.clinicalUseReviewSafetyTitle')}</p>
        <p>{t('admin.clinicalUseReviewSafety')}</p>
        <p className="font-semibold">{t('admin.clinicalUseReviewPhiWarning')}</p>
      </aside>

      <ClinicalUseReviewWorkbookControls
        locale={locale}
        productCount={counts.catalogProducts}
        productRoleCount={counts.productRoles}
        currentSlotCount={counts.currentSlots}
      />
    </div>
  )
}
