import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { AdminPreferenceCardNav } from '@/features/preference-cards/components/AdminPreferenceCardNav'
import { CatalogVerificationWorkspace } from '@/features/preference-cards/components/CatalogVerificationWorkspace'
import { getCatalogVerificationDetail } from '@/features/preference-cards/data/catalog-verification.server'
import { getSlotOptionProposalsForProduct } from '@/features/preference-cards/data/slot-option-proposals.server'

const PRODUCT_ID_PATTERN = /^PRD-[A-Z0-9]{6,20}$/

interface PageProps {
  params: Promise<{ locale: string; productId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { productId } = await params
  const detail = PRODUCT_ID_PATTERN.test(productId) ? getCatalogVerificationDetail(productId) : null
  return {
    title: detail
      ? `${detail.queueRow.productName} — catalog verification`
      : 'Catalog verification record',
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function CatalogVerificationProductPage({ params }: PageProps) {
  const { locale, productId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards')

  if (!PRODUCT_ID_PATTERN.test(productId)) notFound()
  const detail = getCatalogVerificationDetail(productId)
  if (!detail) notFound()

  return (
    <div className="container space-y-7 py-8 md:py-12">
      <header className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <AdminPreferenceCardNav locale={locale} />
      </header>
      <CatalogVerificationWorkspace
        detail={detail}
        slotProposals={getSlotOptionProposalsForProduct(productId)}
        locale={locale}
      />
    </div>
  )
}
