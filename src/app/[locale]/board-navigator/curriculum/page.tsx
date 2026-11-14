import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'

import { BoardNavigatorModuleFrame } from '@/features/board-navigator/components/BoardNavigatorModuleFrame'
import { CurriculumExplorer } from '@/features/board-navigator/components/CurriculumExplorer'
import { BOARD_NAVIGATOR_CURRICULUM_HREF } from '@/features/board-navigator/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Curriculum · IP Board Navigator',
  description:
    'The whole AABIP blueprint, browsable: topics, objectives, linked modules, numbers and sources.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BoardNavigatorCurriculumPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BoardNavigatorModuleFrame locale={locale} activeHref={BOARD_NAVIGATOR_CURRICULUM_HREF}>
      <CurriculumExplorer />
    </BoardNavigatorModuleFrame>
  )
}
