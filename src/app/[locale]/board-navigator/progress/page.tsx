import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BoardNavigatorModuleFrame } from '@/features/board-navigator/components/BoardNavigatorModuleFrame'
import { ProgressScreen } from '@/features/board-navigator/components/ProgressScreen'
import { BOARD_NAVIGATOR_PROGRESS_HREF } from '@/features/board-navigator/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Progress · IP Board Navigator',
  description:
    'Timeline, sampled and unassessed curriculum, review calendar, and your data controls.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BoardNavigatorProgressPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BoardNavigatorModuleFrame locale={locale} activeHref={BOARD_NAVIGATOR_PROGRESS_HREF}>
      <ProgressScreen />
    </BoardNavigatorModuleFrame>
  )
}
