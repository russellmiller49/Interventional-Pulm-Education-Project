import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BoardNavigatorModuleFrame } from '@/features/board-navigator/components/BoardNavigatorModuleFrame'
import { TodayScreen } from '@/features/board-navigator/components/TodayScreen'
import { BOARD_NAVIGATOR_NAV_BASE } from '@/features/board-navigator/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'IP Board Navigator',
  description:
    'A personalized learning navigator for interventional pulmonology board preparation: find the concept you are missing, repair it in a short interactive lab, and show that it holds.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BoardNavigatorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BoardNavigatorModuleFrame locale={locale} activeHref={BOARD_NAVIGATOR_NAV_BASE}>
      <TodayScreen />
    </BoardNavigatorModuleFrame>
  )
}
