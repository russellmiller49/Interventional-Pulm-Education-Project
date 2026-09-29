import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { ToolContactPrototype } from '@/features/medical-thoracoscopy/components/prototype/ToolContactPrototype'
import { MEDICAL_THORACOSCOPY_NAV_BASE } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Tool contact prototype · Medical Thoracoscopy',
  description:
    'An engineering prototype of the table of contact: the forceps in the channel and one illustrative nodule. Not a biopsy lesson, not recorded and not clinically reviewed.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopyToolContactPrototypePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_NAV_BASE}>
      <ToolContactPrototype />
    </MedicalThoracoscopyModuleFrame>
  )
}
