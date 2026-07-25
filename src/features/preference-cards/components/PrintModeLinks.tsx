import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'

export async function PrintModeLinks({
  locale,
  cardId,
  query,
}: {
  locale: string
  cardId: string
  query: string
}) {
  const t = await getTranslations('preferenceCards')
  const suffix = query ? `&${query}` : ''
  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="mr-auto text-sm text-muted-foreground">{t('printNote')}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={`/${locale}/preference-cards/${cardId}/print?mode=spatial${suffix}` as Route}>
          {t('printSpatial')}
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link
          href={`/${locale}/preference-cards/${cardId}/print?mode=chronological${suffix}` as Route}
        >
          {t('printChronological')}
        </Link>
      </Button>
    </div>
  )
}
