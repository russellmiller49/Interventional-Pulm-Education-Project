import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GeneratedCardHeader } from '@/features/preference-cards/components/GeneratedCardHeader'
import { PrintCardView } from '@/features/preference-cards/components/PreferenceCardViews'
import { PrintControls } from '@/features/preference-cards/components/PrintControls'
import { PrintModeLinks } from '@/features/preference-cards/components/PrintModeLinks'
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
  title: 'Print preference card',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function PrintPreferenceCardPage({ params, searchParams }: PageProps) {
  const { locale, cardId } = await params
  setRequestLocale(locale)
  const parsed = parsePreferenceCardSearch(await searchParams)
  const card = resolveDemoCardRequest(cardId, parsed) ?? (await loadPersistedResolvedCard(cardId))
  if (!card) notFound()

  return (
    <div className="ip-card-print mx-auto max-w-[1100px] space-y-6 bg-background px-5 py-6 print:max-w-none print:px-0 print:py-0">
      <GeneratedCardHeader card={card} cardId={cardId} printMode />
      <PrintModeLinks locale={locale} cardId={cardId} query={parsed.serialized} />
      <div className="no-print flex justify-end">
        <PrintControls />
      </div>
      <section className="rounded-3xl border border-border bg-card p-5 print:rounded-none print:border-0 print:p-0">
        <PrintCardView card={card} mode={parsed.mode} />
      </section>
    </div>
  )
}
