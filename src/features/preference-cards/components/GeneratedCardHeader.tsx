'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowLeft, FileDown } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { ResolvedCard } from '../domain/types'
import { PrototypeBanner } from './PrototypeBanner'
import { ReadinessBadge } from './ReadinessBadge'

interface GeneratedCardHeaderProps {
  card: ResolvedCard
  cardId: string
  generatedBy?: string
  printMode?: boolean
  printQuery?: string
}

export function GeneratedCardHeader({
  card,
  cardId,
  generatedBy,
  printMode = false,
  printQuery,
}: GeneratedCardHeaderProps) {
  const t = useTranslations('preferenceCards')
  const locale = useLocale()
  const dashboardHref = `/${locale}/preference-cards` as Route
  const printHref = `/${locale}/preference-cards/${cardId}/print` as Route
  const printSearch = new URLSearchParams(printQuery)
  printSearch.set('mode', 'spatial')

  const metadata = [
    [t('cardMetadata.organization'), card.organizationName],
    [t('cardMetadata.site'), card.siteName],
    [t('cardMetadata.location'), card.locationName],
    [t('cardMetadata.recipe'), card.recipeName],
    [t('cardMetadata.modifiers'), card.selectedModifiers.join(' · ') || '—'],
    [t('cardMetadata.recipeVersion'), card.recipeVersion],
    [t('cardMetadata.catalogVersion'), card.catalogImportId.slice(0, 12)],
    [t('cardMetadata.generatedAt'), new Date(card.generatedAt).toLocaleString()],
    [t('generatedBy'), generatedBy ?? t('demoGeneratedBy')],
    [t('cardMetadata.governance'), card.governanceState],
    [t('cardMetadata.snapshot'), card.snapshotHash.slice(0, 20)],
    [t('cardMetadata.engine'), card.engineVersion],
  ] as const

  return (
    <header className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href={dashboardHref}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('backToDashboard')}
          </Link>
        </Button>
        {!printMode ? (
          <Button asChild size="sm">
            <Link href={`${printHref}?${printSearch.toString()}` as Route}>
              <FileDown aria-hidden="true" className="h-4 w-4" />
              {t('print')}
            </Link>
          </Button>
        ) : null}
      </div>

      <PrototypeBanner title={t('prototypeBanner')} disclaimer={t('disclaimer')} />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('immutableSnapshot')}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
              {card.recipeName}
            </h1>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{card.snapshotHash}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{card.governanceState}</Badge>
            <ReadinessBadge
              state={card.readinessState}
              label={t(`readiness.${card.readinessState}`)}
            />
          </div>
        </div>

        <dl className="mt-6 grid gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-4">
          {metadata.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}
