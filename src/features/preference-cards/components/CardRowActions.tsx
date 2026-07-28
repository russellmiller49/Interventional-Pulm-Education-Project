import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Copy, Link2, Link2Off, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  deleteCardAction,
  duplicateCardAction,
  renameCardAction,
  setCardShareAction,
} from '@/app/[locale]/preference-cards/actions'

import type { UserCardSummary } from '../server/user-cards'

interface CardRowActionsProps {
  locale: string
  card: UserCardSummary
  /** `page` shows the rename form expanded; `row` keeps the dashboard list compact. */
  layout: 'page' | 'row'
}

/**
 * Rename, duplicate, share, and delete for one saved card.
 *
 * Plain server-action forms rather than a client component: each action is a single
 * round-trip with nothing to keep in sync, and the controls keep working without JavaScript.
 */
export async function CardRowActions({ locale, card, layout }: CardRowActionsProps) {
  const t = await getTranslations('preferenceCards')
  const shareHref = `/${locale}/preference-cards/shared/${card.shareToken}` as Route

  return (
    <div className="no-print rounded-2xl border border-border bg-card p-4">
      {layout === 'page' ? (
        <form action={renameCardAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="cardId" value={card.id} />
          <label className="min-w-56 flex-1 text-xs font-semibold text-foreground">
            {t('cardTitleLabel')}
            <input
              name="title"
              required
              maxLength={160}
              defaultValue={card.title}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="min-w-56 flex-1 text-xs font-semibold text-foreground">
            {t('physicianLabel')}
            <input
              name="physicianName"
              maxLength={160}
              defaultValue={card.physicianName ?? ''}
              className="mt-1 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" size="sm" variant="outline">
            {t('renameCard')}
          </Button>
        </form>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 first:mt-0 first:border-0 first:pt-0">
        <form action={duplicateCardAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="cardId" value={card.id} />
          <input
            type="hidden"
            name="title"
            value={t('duplicateTitle', { title: card.title }).slice(0, 160)}
          />
          <Button type="submit" size="sm" variant="outline">
            <Copy aria-hidden="true" className="h-3.5 w-3.5" />
            {t('duplicateCard')}
          </Button>
        </form>

        <form action={setCardShareAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="cardId" value={card.id} />
          <input type="hidden" name="enabled" value={card.shareEnabled ? '0' : '1'} />
          <Button type="submit" size="sm" variant="outline">
            {card.shareEnabled ? (
              <>
                <Link2Off aria-hidden="true" className="h-3.5 w-3.5" />
                {t('stopSharing')}
              </>
            ) : (
              <>
                <Link2 aria-hidden="true" className="h-3.5 w-3.5" />
                {t('shareCard')}
              </>
            )}
          </Button>
        </form>

        {card.shareEnabled ? (
          <>
            <Badge variant="secondary" className="normal-case tracking-normal">
              {t('sharedBadge')}
            </Badge>
            <Link
              href={shareHref}
              className="font-mono text-xs text-primary underline-offset-2 hover:underline"
            >
              {shareHref}
            </Link>
          </>
        ) : null}

        <form action={deleteCardAction} className="ml-auto">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="cardId" value={card.id} />
          {layout === 'page' ? <input type="hidden" name="returnToDashboard" value="1" /> : null}
          <Button type="submit" size="sm" variant="ghost" className="text-destructive">
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            {t('deleteCard')}
          </Button>
        </form>
      </div>

      {card.shareEnabled ? (
        <p className="mt-2 text-xs text-muted-foreground">{t('shareRequiresAccount')}</p>
      ) : null}
    </div>
  )
}
