import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { InPreparation } from '@/features/medical-thoracoscopy/components/InPreparation'
import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { MEDICAL_THORACOSCOPY_REFERENCE_HREF } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Reference · Medical Thoracoscopy',
  description:
    'Tables, a glossary and the sources, gathered from the sections as they are written.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopyReferencePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame
      locale={locale}
      activeHref={MEDICAL_THORACOSCOPY_REFERENCE_HREF}
    >
      <InPreparation heading="Reference">
        <p>
          Tables, a glossary and the sources, gathered from the sections as they are written. None
          is written yet.
        </p>
      </InPreparation>
    </MedicalThoracoscopyModuleFrame>
  )
}
