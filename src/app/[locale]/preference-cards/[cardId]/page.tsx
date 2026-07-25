import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GeneratedCardHeader } from '@/features/preference-cards/components/GeneratedCardHeader'
import { PreferenceCardTabs } from '@/features/preference-cards/components/PreferenceCardViews'
import { resolveDemoCardRequest } from '@/features/preference-cards/data/demo-context.server'
import {
  parsePreferenceCardSearch,
  type PreferenceCardSearchParams,
} from '@/features/preference-cards/data/request-options'
import { loadPersistedResolvedCard } from '@/features/preference-cards/server/load-card'

interface PageProps {
  params: Promise<{ locale: string; cardId: string }>
  searchParams: Promise<PreferenceCardSearchParams>
}

export const metadata: Metadata = {
  title: 'Generated preference card',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function GeneratedPreferenceCardPage({ params, searchParams }: PageProps) {
  const { locale, cardId } = await params
  setRequestLocale(locale)
  const parsed = parsePreferenceCardSearch(await searchParams)
  const card = resolveDemoCardRequest(cardId, parsed) ?? (await loadPersistedResolvedCard(cardId))
  if (!card) notFound()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <GeneratedCardHeader card={card} cardId={cardId} printQuery={parsed.serialized} />
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <PreferenceCardTabs card={card} />
      </section>
    </div>
  )
}
