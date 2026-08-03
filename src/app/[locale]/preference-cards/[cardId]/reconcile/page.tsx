import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { setRequestLocale, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardReconciliationView } from '@/features/preference-cards/components/CardReconciliationView'
import { CardRevisionHistory } from '@/features/preference-cards/components/CardRevisionHistory'
import { PrototypeBanner } from '@/features/preference-cards/components/PrototypeBanner'
import { cardIdSchema } from '@/features/preference-cards/schemas/saved-card'
import { listCardRevisions } from '@/features/preference-cards/server/card-revisions'
import { reconcileSavedCard } from '@/features/preference-cards/server/reconcile-card'

/**
 * Reviewing what has moved underneath a saved card.
 *
 * A read route in the strictest sense: it renders a report and offers no action. There is no
 * server action on this page, no form, and nothing that could write — which is the honest
 * shape for a phase whose whole point is that reviewing a change and acting on one are
 * different decisions, taken at different times, and the second one does not exist yet.
 */

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; cardId: string }>
}

export const metadata: Metadata = {
  title: 'Review changes to a preference card',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function ReconcilePreferenceCardPage({ params }: PageProps) {
  const { locale, cardId } = await params
  setRequestLocale(locale)
  if (!cardIdSchema.safeParse(cardId).success) notFound()

  // Row-level security scopes both reads to the caller's own cards, so someone else's id is a
  // 404 — the same answer an id that does not exist gets.
  const result = await reconcileSavedCard(cardId)
  if (!result.ok) notFound()

  const t = await getTranslations('preferenceCards')
  const revisions = await listCardRevisions(cardId)
  const cardHref = `/${locale}/preference-cards/${cardId}` as Route

  return (
    <div className="container space-y-6 py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={cardHref}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('reconcile.backToCard')}
          </Link>
        </Button>
      </div>

      <PrototypeBanner title={t('prototypeBanner')} disclaimer={t('disclaimer')} />

      <header>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          {t('reconcile.pageTitle', { title: result.reconciliation.record.title })}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t('reconcile.intro')}
        </p>
      </header>

      <CardReconciliationView reconciliation={result.reconciliation} />
      <CardRevisionHistory revisions={revisions} />
    </div>
  )
}
