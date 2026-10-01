import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import type { ReactElement } from 'react'

import { reviewState, type WolfPreviewItem } from '../paths'
import { WolfPreviewGate, WolfPreviewUnavailable } from '../WolfPreviewGate'
import { previewConfig, sessionCookie, verifySession } from './access'
import { storageConfigured } from './models'

export type PreviewSearchParams = Promise<{ review?: string | string[] }>

/**
 * What every preview page shows instead of its own content: not found while the preview is shut
 * or not fully configured, the review-code screen without a valid session (checked here, on the
 * server), and the unavailable notice while storage is not configured. Null: the reviewer may see
 * the page.
 */
export async function previewScreen(
  locale: string,
  searchParams: PreviewSearchParams,
  item: WolfPreviewItem | null,
): Promise<ReactElement | null> {
  const config = previewConfig()
  if (!config) notFound()
  setRequestLocale(locale)
  const jar = await cookies()
  if (!verifySession(config, jar.get(sessionCookie().name)?.value)) {
    const { review } = await searchParams
    return <WolfPreviewGate locale={locale} state={reviewState(review)} item={item} />
  }
  if (!storageConfigured()) return <WolfPreviewUnavailable />
  return null
}
