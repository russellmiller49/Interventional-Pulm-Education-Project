import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'

import {
  previewConfig,
  sessionCookie,
  verifySession,
} from '@/features/medical-thoracoscopy/wolf-preview/server/access'
import { storageConfigured } from '@/features/medical-thoracoscopy/wolf-preview/server/models'
import { reviewState, WOLF_PREVIEW_WORDS } from '@/features/medical-thoracoscopy/wolf-preview/paths'
import { WolfPreviewExplorer } from '@/features/medical-thoracoscopy/wolf-preview/WolfPreviewExplorer'
import {
  WolfPreviewGate,
  WolfPreviewUnavailable,
} from '@/features/medical-thoracoscopy/wolf-preview/WolfPreviewGate'

/**
 * The private manufacturer review of the device explorer. Shut (not found) unless the host turns
 * it on; otherwise every request needs a valid preview session, checked here on the server, or
 * the review-code screen is all that renders. Not indexed, not listed, not linked.
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
  searchParams: Promise<{ review?: string | string[] }>
}) {
  const config = previewConfig()
  if (!config) notFound()
  const { locale } = await params
  setRequestLocale(locale)
  const jar = await cookies()
  const reviewer = verifySession(config, jar.get(sessionCookie().name)?.value)
  if (!reviewer) {
    const { review } = await searchParams
    return <WolfPreviewGate locale={locale} state={reviewState(review)} />
  }
  if (!storageConfigured()) return <WolfPreviewUnavailable />
  return <WolfPreviewExplorer locale={locale} />
}
