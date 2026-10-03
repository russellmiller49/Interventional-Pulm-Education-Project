import type { Metadata } from 'next'

import { WOLF_PREVIEW_WORDS } from '@/features/medical-thoracoscopy/wolf-preview/paths'
import {
  previewScreen,
  type PreviewSearchParams,
} from '@/features/medical-thoracoscopy/wolf-preview/server/previewPage'
import { WolfPreviewExplorer } from '@/features/medical-thoracoscopy/wolf-preview/WolfPreviewExplorer'

/** The device explorer, opened from the private preview's hub; the same session guards it. */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: `Device Explorer · ${WOLF_PREVIEW_WORDS.course}`,
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default async function MedicalThoracoscopyWolfPreviewExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: PreviewSearchParams
}) {
  const { locale } = await params
  return (
    (await previewScreen(locale, searchParams, 'device-explorer')) ?? (
      <WolfPreviewExplorer locale={locale} />
    )
  )
}
