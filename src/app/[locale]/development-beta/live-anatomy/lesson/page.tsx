import {
  AirwayAnatomyLessonPage,
  airwayAnatomyLessonMetadata,
} from '@/features/intro-bronchoscopy/components/AirwayAnatomyLessonPage'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, airwayAnatomyLessonMetadata)
}

// The proxy requires a verified, registered account here, as for all of /development-beta. The
// course entitlement guards /intro-bronchoscopy, which this page deliberately sits outside.
export default function LiveAnatomyReviewPage() {
  return <AirwayAnatomyLessonPage showCourseLink={false} />
}
