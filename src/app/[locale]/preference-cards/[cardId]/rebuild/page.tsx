import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardRebuildReview } from '@/features/preference-cards/components/CardRebuildReview'
import { PrototypeBanner } from '@/features/preference-cards/components/PrototypeBanner'
import { cardIdSchema } from '@/features/preference-cards/schemas/saved-card'
import {
  prepareCardRebuild,
  type CardRebuildErrorCode,
} from '@/features/preference-cards/server/rebuild-card'

import { createRebuiltCardAction } from './actions'

/**
 * Reviewing a rebuild, and creating the new card.
 *
 * Owner-only, and owner-only by the same mechanism as every other page in this feature: there is no
 * route-level auth gate, `/preference-cards` is public-unlisted, and what scopes this to the caller
 * is row-level security inside the loader. A card that is not theirs and a card that does not exist
 * both reach `not_found`, and both 404 — distinguishing them would turn a card id into a probe for
 * whether it is real.
 *
 * The revision is addressed explicitly, in the query string, because a rebuild is of one exact
 * saved state and a card id names a moving target. `loadCardRevision` additionally refuses a
 * revision whose card is not this one, so the owner's own two cards cannot be confused either.
 */

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; cardId: string }>
  searchParams: Promise<{ revision?: string; error?: string; unanswered?: string }>
}

export const metadata: Metadata = {
  title: 'Rebuild a preference card',
  robots: { index: false, follow: false, noarchive: true },
}

/**
 * Why a rebuild is not available, in the physician's terms.
 *
 * Every one of these is a refusal to guess, not a fault in the card: the source stays viewable,
 * printable, shareable, and — where its inputs allow — editable. `not_found` never reaches here.
 */
const explanationKeyByCode: Record<Exclude<CardRebuildErrorCode, 'not_found'>, string> = {
  // The revision's stored snapshot no longer hashes to what it was written with. An append-only row
  // that fails its own integrity check is the one case where showing it anyway would be showing
  // something nobody wrote.
  revision_snapshot_unverifiable: 'rebuild.unavailableRevisionUnverifiable',
  builder_inputs_unavailable: 'rebuild.unavailableLegacy',
  superseded_builder_inputs: 'rebuild.unavailableSuperseded',
  builder_inputs_not_release_pinned: 'rebuild.unavailableSuperseded',
  legacy_family_identity: 'rebuild.unavailableLegacyFamily',
  source_release_unavailable: 'rebuild.unavailableSourceRelease',
  source_context_unavailable: 'rebuild.unavailableSourceRelease',
  // Nothing points at a release for this procedure, so there is no target. Inferring one from
  // version order or publication date is the one thing the pointer exists to prevent.
  no_current_release: 'rebuild.unavailableNoCurrentRelease',
  already_on_current_release: 'rebuild.unavailableAlreadyCurrent',
  target_release_not_selectable: 'rebuild.unavailableTargetNotSelectable',
  target_release_unavailable: 'rebuild.unavailableTargetRelease',
  target_context_unavailable: 'rebuild.unavailableTargetRelease',
  target_catalog_unavailable: 'rebuild.unavailableTargetCatalog',
  module_not_offered: 'rebuild.unavailableComposition',
  modifier_not_offered: 'rebuild.unavailableComposition',
}

export default async function RebuildPreferenceCardPage({ params, searchParams }: PageProps) {
  const { locale, cardId } = await params
  setRequestLocale(locale)
  if (!cardIdSchema.safeParse(cardId).success) notFound()

  const { revision, error, unanswered } = await searchParams
  if (!revision || !cardIdSchema.safeParse(revision).success) notFound()

  const t = await getTranslations('preferenceCards')
  const prepared = await prepareCardRebuild(cardId, revision)
  const cardHref = `/${locale}/preference-cards/${cardId}` as Route

  if (!prepared.ok) {
    if (prepared.code === 'not_found') notFound()
    return (
      <div className="container max-w-3xl space-y-6 py-8 md:py-12">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h1 className="text-xl font-bold text-foreground">{t('rebuild.unavailableTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t(explanationKeyByCode[prepared.code])}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t('rebuild.unavailableSourceIntact')}
          </p>
          {prepared.message ? (
            <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3 font-mono text-xs text-muted-foreground">
              {prepared.message}
            </p>
          ) : null}
          <div className="mt-6">
            <Button asChild>
              <Link href={cardHref}>{t('rebuild.backToCard')}</Link>
            </Button>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="container space-y-6 py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={cardHref}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('rebuild.backToCard')}
          </Link>
        </Button>
      </div>

      <PrototypeBanner title={t('prototypeBanner')} disclaimer={t('disclaimer')} />

      <header>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          {t('rebuild.pageTitle', { title: prepared.preparation.record.title })}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t('rebuild.intro')}
        </p>
      </header>

      <CardRebuildReview
        preparation={prepared.preparation}
        locale={locale}
        createAction={createRebuiltCardAction}
        error={
          error
            ? {
                message: t(`rebuild.error.${error}` as 'rebuild.error.review_incomplete'),
                unanswered: unanswered ? unanswered.split(',').filter(Boolean) : [],
              }
            : null
        }
      />
    </div>
  )
}
