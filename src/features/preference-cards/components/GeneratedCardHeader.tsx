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
  /** The owner's own name for this card, which is what the heading shows. */
  title: string
  physicianName?: string | null
  status?: 'draft' | 'final'
  updatedAt?: string
  printMode?: boolean
  /** Read-only share view: no dashboard link and no print action. */
  shared?: boolean
}

export function GeneratedCardHeader({
  card,
  cardId,
  title,
  physicianName,
  status,
  updatedAt,
  printMode = false,
  shared = false,
}: GeneratedCardHeaderProps) {
  const t = useTranslations('preferenceCards')
  const locale = useLocale()
  const dashboardHref = `/${locale}/preference-cards` as Route
  const printHref = `/${locale}/preference-cards/${cardId}/print?mode=spatial` as Route

  // A personal card names a physician and a procedure. Organization, site, and room came
  // from the abandoned hospital-governance model and said "demo" on every card.
  const metadata = [
    [t('cardMetadata.physician'), physicianName || t('cardMetadata.physicianNotSet')],
    [t('cardMetadata.recipe'), card.recipeName],
    [t('cardMetadata.modifiers'), card.selectedModifiers.join(' · ') || '—'],
    [t('cardMetadata.recipeVersion'), card.recipeVersion],
    [t('cardMetadata.catalogVersion'), card.catalogImportId.slice(0, 12)],
    [t('cardMetadata.generatedAt'), new Date(card.generatedAt).toLocaleString()],
    ...(updatedAt
      ? ([[t('cardMetadata.updatedAt'), new Date(updatedAt).toLocaleString()]] as const)
      : []),
    [t('cardMetadata.snapshot'), card.snapshotHash.slice(0, 20)],
    [t('cardMetadata.engine'), card.engineVersion],
  ] as const

  return (
    <header className="space-y-5">
      {shared ? null : (
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={dashboardHref}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {t('backToDashboard')}
            </Link>
          </Button>
          {!printMode ? (
            <Button asChild size="sm">
              <Link href={printHref}>
                <FileDown aria-hidden="true" className="h-4 w-4" />
                {t('print')}
              </Link>
            </Button>
          ) : null}
        </div>
      )}

      <PrototypeBanner title={t('prototypeBanner')} disclaimer={t('disclaimer')} />

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('immutableSnapshot')}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">{title}</h1>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{card.snapshotHash}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {status ? <Badge variant="outline">{t(`status.${status}`)}</Badge> : null}
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
