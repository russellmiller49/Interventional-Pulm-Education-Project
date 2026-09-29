import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { InPreparation } from '@/features/medical-thoracoscopy/components/InPreparation'
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
      <InPreparation heading="This course is being built">
        <p>
          It takes you from deciding whether looking inside the chest will help, through the
          instrument, the port and a systematic survey of the pleural space, to biopsy, pleurodesis
          and finishing safely. Sections open here as they are written.
        </p>
        <p>Nothing in the course has been clinically reviewed yet.</p>
      </InPreparation>
    </MedicalThoracoscopyModuleFrame>
  )
}
