import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { InPreparation } from '@/features/medical-thoracoscopy/components/InPreparation'
import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { MEDICAL_THORACOSCOPY_PRACTICE_HREF } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Practice · Medical Thoracoscopy',
  description: 'Short scenarios, each paired with the Learn section it rehearses.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopyPracticePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_PRACTICE_HREF}>
      <InPreparation heading="Practice">
        <p>
          Seven short scenarios, each paired with the Learn section it rehearses. None is written
          yet.
        </p>
      </InPreparation>
    </MedicalThoracoscopyModuleFrame>
  )
}
