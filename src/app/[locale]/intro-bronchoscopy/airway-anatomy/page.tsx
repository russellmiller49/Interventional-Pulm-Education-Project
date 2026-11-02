import {
  AirwayAnatomyLessonPage,
  airwayAnatomyLessonMetadata,
} from '@/features/intro-bronchoscopy/components/AirwayAnatomyLessonPage'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, airwayAnatomyLessonMetadata)
}

export default function AirwayAnatomyIntroPage() {
  return <AirwayAnatomyLessonPage showCourseLink />
}
