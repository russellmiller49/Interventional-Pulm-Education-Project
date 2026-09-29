import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { LearnLanding } from '@/features/medical-thoracoscopy/components/hub/LearnLanding'
import { SectionLesson } from '@/features/medical-thoracoscopy/components/lesson/SectionLesson'
import { curriculumSection } from '@/features/medical-thoracoscopy/content/curriculum'
import { isOpenable } from '@/features/medical-thoracoscopy/content/pathwayResolver'
import { isThoracoscopySectionId } from '@/features/medical-thoracoscopy/content/sectionIds'
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

type SearchParams = Record<string, string | string[] | undefined>

export default async function MedicalThoracoscopyLearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<SearchParams>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const query = (await searchParams) ?? {}
  const requested = Array.isArray(query.section) ? query.section[0] : query.section
  // A section opens as its lesson only once it is written and its lesson exists; anything else is
  // the landing, which says what the address is.
  const section = isThoracoscopySectionId(requested) ? curriculumSection(requested) : null
  return (
    <MedicalThoracoscopyModuleFrame locale={locale} activeHref={MEDICAL_THORACOSCOPY_LEARN_HREF}>
      {section && isOpenable(section) ? (
        <SectionLesson key={section.id} sectionId={section.id} />
      ) : (
        <LearnLanding requestedSection={requested} />
      )}
    </MedicalThoracoscopyModuleFrame>
  )
}
