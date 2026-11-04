import type { Metadata } from 'next'
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'

import { BoardNavigatorModuleFrame } from '@/features/board-navigator/components/BoardNavigatorModuleFrame'
import { KnowledgeMapScreen } from '@/features/board-navigator/components/KnowledgeMapScreen'
import { BOARD_NAVIGATOR_MAP_HREF } from '@/features/board-navigator/content/routes'
import { localizeHandoffServerValue } from '@/i18n/handoff-server'

const handoffMetadata: Metadata = {
  title: 'Knowledge map · IP Board Navigator',
  description: 'Every pilot objective on the AABIP blueprint, with the evidence behind its status.',
  robots: { index: false, follow: false, noarchive: true },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return localizeHandoffServerValue(locale, handoffMetadata)
}

export default async function BoardNavigatorMapPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <BoardNavigatorModuleFrame locale={locale} activeHref={BOARD_NAVIGATOR_MAP_HREF}>
      <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 py-10" aria-busy="true" />}>
        <KnowledgeMapScreen />
      </Suspense>
    </BoardNavigatorModuleFrame>
  )
}
