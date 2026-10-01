import type { Metadata } from 'next'

import { WOLF_PREVIEW_WORDS } from '@/features/medical-thoracoscopy/wolf-preview/paths'
import {
  previewScreen,
  type PreviewSearchParams,
} from '@/features/medical-thoracoscopy/wolf-preview/server/previewPage'
import { WolfPreviewHub } from '@/features/medical-thoracoscopy/wolf-preview/WolfPreviewHub'

/**
 * The private manufacturer review: a hub opening the device explorer and two presentation
 * demonstrations. Shut (not found) unless the host turns it on; otherwise every request needs a
 * valid preview session, checked on the server, or the review-code screen is all that renders.
 * Not indexed, not listed, not linked.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `${WOLF_PREVIEW_WORDS.title} · ${WOLF_PREVIEW_WORDS.course}`,
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default async function MedicalThoracoscopyWolfPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: PreviewSearchParams
}) {
  const { locale } = await params
  return (await previewScreen(locale, searchParams, null)) ?? <WolfPreviewHub locale={locale} />
}
