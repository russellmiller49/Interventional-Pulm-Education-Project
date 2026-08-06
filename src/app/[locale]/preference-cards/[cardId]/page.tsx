import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'

import {
  CardRebuildProvenanceUnreadable,
  CardRebuildProvenanceView,
} from '@/features/preference-cards/components/CardRebuildProvenanceView'
import { GeneratedCardHeader } from '@/features/preference-cards/components/GeneratedCardHeader'
import { PreferenceCardTabs } from '@/features/preference-cards/components/PreferenceCardViews'
import { CardRowActions } from '@/features/preference-cards/components/CardRowActions'
import { cardIdSchema } from '@/features/preference-cards/schemas/saved-card'
import { loadCurrentCardRevision } from '@/features/preference-cards/server/card-revisions'
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

  // A rebuild cites a revision, never a card id — the card is a moving target and the reference
  // would point at a state nobody read. The current one is what the control offers; the whole
  // history is on the reconciliation page.
  const currentRevision = await loadCurrentCardRevision(cardId)

  // A rebuilt card says so, and says whether the revision it cites is still there. Deleting the
  // source is permitted and cascades its revisions, so the honest answer once it is gone is that
  // the record is a hash-addressed tombstone — not a link that 404s and not silence.
  //
  // A document that does not parse is its own state, never `none`: a row carrying rebuild evidence
  // this code cannot read must not be presented as a card that was never rebuilt.
  const provenance = record.rebuildProvenance
  const sourceAvailable =
    provenance.state === 'valid' &&
    (await loadUserCard(provenance.provenance.sourceCardId)) !== null

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
      <CardRowActions
        locale={locale}
        card={record}
        layout="page"
        currentRevisionId={currentRevision?.id ?? null}
      />
      {provenance.state === 'valid' ? (
        <CardRebuildProvenanceView
          provenance={provenance.provenance}
          locale={locale}
          sourceAvailable={sourceAvailable}
        />
      ) : null}
      {provenance.state === 'invalid' ? <CardRebuildProvenanceUnreadable /> : null}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <PreferenceCardTabs card={record.card} />
      </section>
    </div>
  )
}
