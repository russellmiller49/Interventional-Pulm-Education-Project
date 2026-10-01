import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { wolfPreviewDemo } from '@/features/medical-thoracoscopy/wolf-preview/demos'
import { WOLF_PREVIEW_WORDS } from '@/features/medical-thoracoscopy/wolf-preview/paths'
import {
  previewScreen,
  type PreviewSearchParams,
} from '@/features/medical-thoracoscopy/wolf-preview/server/previewPage'
import { WolfPreviewDemoPage } from '@/features/medical-thoracoscopy/wolf-preview/WolfPreviewDemoPage'

/**
 * A presentation demonstration opened from the private preview's hub (the pleural-model progress
 * demonstration or the portable-trainer concept); the same session guards it. Any other name is
 * not found.
 */
export const dynamic = 'force-dynamic'

const ROBOTS = { index: false, follow: false, noarchive: true, nocache: true }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ demo: string }>
}): Promise<Metadata> {
  const demo = wolfPreviewDemo((await params).demo)
  return {
    title: `${demo?.title ?? WOLF_PREVIEW_WORDS.title} · ${WOLF_PREVIEW_WORDS.course}`,
    robots: ROBOTS,
  }
}

export default async function MedicalThoracoscopyWolfPreviewDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; demo: string }>
  searchParams: PreviewSearchParams
}) {
  const { locale, demo: name } = await params
  const demo = wolfPreviewDemo(name)
  if (!demo) notFound()
  return (
    (await previewScreen(locale, searchParams, demo.id)) ?? (
      <WolfPreviewDemoPage locale={locale} demo={demo} />
    )
  )
}
