import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MedicalThoracoscopyHub } from '@/features/medical-thoracoscopy/components/hub/MedicalThoracoscopyHub'
import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { MEDICAL_THORACOSCOPY_NAV_BASE } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Medical Thoracoscopy',
  description:
    'A guided course in single-port medical thoracoscopy on one chest model: deciding when to look, the instrument and the port, a systematic survey of the pleural space, biopsy, pleurodesis and finishing safely.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopyPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_NAV_BASE}>
      <MedicalThoracoscopyHub />
    </MedicalThoracoscopyModuleFrame>
  )
}
