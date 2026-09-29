import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { CasesLanding } from '@/features/medical-thoracoscopy/components/hub/CasesLanding'
import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { MEDICAL_THORACOSCOPY_CASES_HREF } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Cases · Medical Thoracoscopy',
  description: 'Four cases that run across the whole procedure.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopyCasesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_CASES_HREF}>
      <CasesLanding />
    </MedicalThoracoscopyModuleFrame>
  )
}
