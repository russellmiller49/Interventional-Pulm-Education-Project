import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { InPreparation } from '@/features/medical-thoracoscopy/components/InPreparation'
import { MedicalThoracoscopyModuleFrame } from '@/features/medical-thoracoscopy/components/MedicalThoracoscopyModuleFrame'
import { MEDICAL_THORACOSCOPY_LEARN_HREF } from '@/features/medical-thoracoscopy/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Learn · Medical Thoracoscopy',
  description:
    'Nineteen sections in five chapters, from deciding when to look to what completing the course means.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function MedicalThoracoscopyLearnPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_LEARN_HREF}>
      <InPreparation heading="Learn">
        <p>
          Nineteen sections in five chapters: deciding to look, the equipment and the anatomy,
          access and orientation, the survey and what you do with it, and finishing safely. None is
          open yet.
        </p>
      </InPreparation>
    </MedicalThoracoscopyModuleFrame>
  )
}
