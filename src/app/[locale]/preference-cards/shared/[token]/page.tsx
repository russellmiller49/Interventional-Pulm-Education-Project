import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { GeneratedCardHeader } from '@/features/preference-cards/components/GeneratedCardHeader'
import { PreferenceCardTabs } from '@/features/preference-cards/components/PreferenceCardViews'
import { shareTokenSchema } from '@/features/preference-cards/schemas/saved-card'
import { loadSharedCard } from '@/features/preference-cards/server/user-cards'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; token: string }>
}

export const metadata: Metadata = {
  title: 'Shared preference card',
  robots: { index: false, follow: false, noarchive: true },
}

/**
 * A colleague's read-only view of a card its owner chose to share.
 *
 * The lookup runs through a security-definer RPC granted to signed-in accounts only, and it
 * returns nothing unless sharing is still switched on — so revoking a link takes effect
 * immediately and a leaked URL is useless to a signed-out visitor.
 */
export default async function SharedPreferenceCardPage({ params }: PageProps) {
  const { locale, token } = await params
  setRequestLocale(locale)
  if (!shareTokenSchema.safeParse(token).success) notFound()

  const shared = await loadSharedCard(token)
  if (!shared) notFound()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <GeneratedCardHeader
        card={shared.card}
        cardId={token}
        title={shared.title}
        physicianName={shared.physicianName}
        updatedAt={shared.updatedAt}
        shared
      />
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <PreferenceCardTabs card={shared.card} />
      </section>
    </div>
  )
}
