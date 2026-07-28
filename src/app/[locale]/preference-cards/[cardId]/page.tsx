import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GeneratedCardHeader } from '@/features/preference-cards/components/GeneratedCardHeader'
import { PreferenceCardTabs } from '@/features/preference-cards/components/PreferenceCardViews'
import { CardRowActions } from '@/features/preference-cards/components/CardRowActions'
import { cardIdSchema } from '@/features/preference-cards/schemas/saved-card'
import { loadUserCard } from '@/features/preference-cards/server/user-cards'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; cardId: string }>
}

export const metadata: Metadata = {
  title: 'Generated preference card',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function GeneratedPreferenceCardPage({ params }: PageProps) {
  const { locale, cardId } = await params
  setRequestLocale(locale)
  if (!cardIdSchema.safeParse(cardId).success) notFound()

  // Row-level security scopes this to the caller's own cards, so someone else's id is a 404.
  const record = await loadUserCard(cardId)
  if (!record) notFound()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <GeneratedCardHeader
        card={record.card}
        cardId={cardId}
        title={record.title}
        physicianName={record.physicianName}
        status={record.status}
        updatedAt={record.updatedAt}
      />
      <CardRowActions locale={locale} card={record} layout="page" />
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <PreferenceCardTabs card={record.card} />
      </section>
    </div>
  )
}
