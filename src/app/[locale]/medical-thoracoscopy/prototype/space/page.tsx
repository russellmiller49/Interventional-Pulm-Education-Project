import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { SpacePrototype } from '@/features/medical-thoracoscopy/components/prototype/SpacePrototype'
import { MEDICAL_THORACOSCOPY_NAV_BASE } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Space prototype · Medical Thoracoscopy',
  description:
    'An engineering prototype of the pleural space the survey lesson will use. Not a lesson, not recorded and not clinically reviewed.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopySpacePrototypePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_NAV_BASE}>
      <SpacePrototype />
    </MedicalThoracoscopyModuleFrame>
  )
}
