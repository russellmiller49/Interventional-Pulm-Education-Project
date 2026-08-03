'use client'

import { useTranslations } from 'next-intl'
import {
  AlertOctagon,
  AlertTriangle,
  Box,
  CheckSquare2,
  Clock3,
  Info,
  ListTree,
  PackageCheck,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/cn'

import { isCustomItemId } from '../domain/custom-item'
import {
  proceduralPhases,
  setupZones,
  type ProceduralPhase,
  type ResolvedCard,
  type ResolvedCardItem,
  type RuleMessage,
  type SetupZone,
} from '../domain/types'

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function stateTone(item: ResolvedCardItem) {
  if (item.resolutionState === 'blocking') {
    return 'border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/20'
  }
  if (item.openHoldStatus === 'emergency_pull' || item.requiredness === 'emergency_only') {
    return 'border-amber-400 border-dashed bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/20'
  }
  return 'border-border/80 bg-background/80'
}

function RequirementLine({ item }: { item: ResolvedCardItem }) {
  const t = useTranslations('preferenceCards')
  const product = item.selectedItemSnapshot?.catalogProduct
  const unverified = item.selectedItemSnapshot !== null && item.verificationState === 'unverified'
  // A line the author typed rather than chose: no manufacturer document behind it at all.
  const isCustom = isCustomItemId(item.selectedItemSnapshot?.id)
  return (
    <article
      className={cn('break-inside-avoid rounded-xl border px-4 py-3 shadow-sm', stateTone(item))}
    >
      <div className="flex items-start gap-3">
        <span
          aria-label={t('setupCheckboxLabel')}
          className="mt-0.5 flex h-5 w-5 shrink-0 rounded border-2 border-foreground/40 bg-background"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold leading-5 text-foreground">{item.label}</h4>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{item.roleCode}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" size="sm">
                {t('quantityValue', { quantity: item.quantityDisplay })}
              </Badge>
              <Badge
                variant={item.resolutionState === 'blocking' ? 'destructive' : 'outline'}
                size="sm"
              >
                {humanize(item.effectiveRequiredness)}
              </Badge>
              <Badge
                variant={item.openHoldStatus === 'emergency_pull' ? 'info' : 'outline'}
                size="sm"
              >
                {humanize(item.openHoldStatus)}
              </Badge>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-muted/45 px-3 py-2">
            <p className="text-sm font-medium text-foreground">
              {item.selectedItemSnapshot?.localDescription ?? t('unresolvedLocalItem')}
              {/*
                A dagger on every line that has not been confirmed against a manufacturer
                document, explained once in the footnote. The card is carried into a room; a
                reader has to be able to tell at a glance which lines still need checking.
              */}
              {unverified ? (
                <span
                  aria-label={t('printNotes.unverifiedMarkLabel')}
                  className="ml-1 font-bold text-foreground"
                >
                  †
                </span>
              ) : null}
            </p>
            {product ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {[product.manufacturer, product.catalogNumber].filter(Boolean).join(' · ')}
              </p>
            ) : null}
            {isCustom ? (
              <p className="mt-0.5 text-xs font-medium italic text-muted-foreground">
                {t('printNotes.customItemNote')}
              </p>
            ) : null}
            {item.selectedItemSnapshot?.localItemNumber ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('localNumberValue', {
                  number: item.selectedItemSnapshot.localItemNumber,
                })}
              </p>
            ) : null}
          </div>

          {item.dependencyRule ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t('condition')}: {item.dependencyRule} ·{' '}
              {humanize(item.conditionalState ?? 'undecided')}
            </p>
          ) : null}

          <details className="mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              {t('whyIncluded')}
            </summary>
            <ul className="mt-1 space-y-1 pl-4">
              {item.whyIncluded.map((reason) => (
                <li key={reason} className="list-disc">
                  {reason}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </article>
  )
}

function GroupedItems({ card, mode }: { card: ResolvedCard; mode: 'spatial' | 'chronological' }) {
  const t = useTranslations('preferenceCards')
  const orderedKeys = mode === 'spatial' ? setupZones : proceduralPhases
  const emergencyFirst = (items: ResolvedCardItem[]) =>
    [...items].sort(
      (left, right) =>
        Number(left.openHoldStatus !== 'emergency_pull') -
          Number(right.openHoldStatus !== 'emergency_pull') ||
        left.setupSequence - right.setupSequence,
    )

  return (
    <div className="space-y-6">
      {orderedKeys.map((key) => {
        const items = emergencyFirst(
          card.items.filter((item) =>
            mode === 'spatial'
              ? item.setupZone === (key as SetupZone)
              : item.proceduralPhase === (key as ProceduralPhase),
          ),
        )
        if (items.length === 0) return null
        const label =
          mode === 'spatial'
            ? t(`spatialZones.${key as SetupZone}`)
            : t(`phases.${key as ProceduralPhase}`)
        return (
          <section key={key} className="break-inside-avoid">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              {mode === 'spatial' ? (
                <Box aria-hidden="true" className="h-4 w-4 text-primary" />
              ) : (
                <Clock3 aria-hidden="true" className="h-4 w-4 text-primary" />
              )}
              <h3 className="text-base font-bold text-foreground">{label}</h3>
              <Badge variant="outline" size="sm">
                {items.length}
              </Badge>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {items.map((item) => (
                <RequirementLine key={item.id} item={item} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ExceptionLine({ warning }: { warning: RuleMessage }) {
  const t = useTranslations('preferenceCards')
  const Icon =
    warning.severity === 'blocking'
      ? AlertOctagon
      : warning.severity === 'warning'
        ? AlertTriangle
        : Info
  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        warning.severity === 'blocking'
          ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
          : warning.severity === 'warning'
            ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20'
            : 'border-sky-300 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/20',
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              warning.severity === 'blocking'
                ? 'destructive'
                : warning.severity === 'warning'
                  ? 'info'
                  : 'outline'
            }
            size="sm"
          >
            {humanize(warning.severity)}
          </Badge>
          <code className="text-[11px] text-muted-foreground">{warning.code}</code>
        </div>
        <p className="mt-1 text-sm leading-6 text-foreground">{warning.message}</p>
        {warning.waiverReason ? (
          <div className="mt-2 rounded-lg border border-current/20 bg-background/70 px-3 py-2 text-xs leading-5">
            <span className="font-semibold">{t('waiverRecorded')}:</span> {warning.waiverReason}
            <span className="mt-1 block text-muted-foreground">{t('waiverDoesNotClear')}</span>
          </div>
        ) : null}
      </div>
    </li>
  )
}

/**
 * One compact line naming the modules the card was assembled from.
 *
 * Deliberately not repeated on every printed requirement: the card is carried into a room
 * and read as a pull list, and per-line provenance belongs in the trace and the
 * why-included detail, not in the margin of every row. Renders nothing for a snapshot
 * written before composition.
 */
export function ComposedFromSummary({ card }: { card: ResolvedCard }) {
  const t = useTranslations('preferenceCards')
  const includedModules = card.includedModules ?? []
  if (includedModules.length === 0) return null
  return (
    <p className="break-inside-avoid text-xs leading-5 text-muted-foreground">
      <span className="font-semibold text-foreground">{t('modules.composedFrom')}:</span>{' '}
      {includedModules.map((module) => `${module.moduleName} v${module.moduleVersion}`).join(' · ')}
    </p>
  )
}

export function SpatialCardView({ card }: { card: ResolvedCard }) {
  return <GroupedItems card={card} mode="spatial" />
}

export function ChronologicalCardView({ card }: { card: ResolvedCard }) {
  return <GroupedItems card={card} mode="chronological" />
}

export function ExceptionsView({ card }: { card: ResolvedCard }) {
  const t = useTranslations('preferenceCards')
  if (card.warnings.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noExceptions')}</p>
  }
  return (
    <ul className="space-y-3">
      {[...card.warnings]
        .sort(
          (left, right) =>
            ({ blocking: 0, warning: 1, info: 2 })[left.severity] -
            { blocking: 0, warning: 1, info: 2 }[right.severity],
        )
        .map((warning) => (
          <ExceptionLine key={warning.id} warning={warning} />
        ))}
    </ul>
  )
}

export function RuleTraceView({ card }: { card: ResolvedCard }) {
  return (
    <ol className="relative ml-2 space-y-0 border-l border-border">
      {card.ruleTrace.map((event) => (
        <li key={event.id} className="relative pb-4 pl-6">
          <span className="absolute -left-2 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-primary/30 bg-background">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <p className="text-sm leading-6 text-foreground">{event.message}</p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {event.sequence} · {humanize(event.kind)}
          </p>
        </li>
      ))}
    </ol>
  )
}

export function PreferenceCardTabs({
  card,
  defaultTab = 'spatial',
}: {
  card: ResolvedCard
  defaultTab?: 'spatial' | 'chronological' | 'exceptions' | 'trace'
}) {
  const t = useTranslations('preferenceCards')
  return (
    <Tabs defaultValue={defaultTab}>
      <div className="mb-3">
        <ComposedFromSummary card={card} />
      </div>
      <TabsList className="no-print h-auto flex-wrap rounded-2xl">
        <TabsTrigger value="spatial" className="gap-2">
          <Box aria-hidden="true" className="h-4 w-4" />
          {t('tabs.spatial')}
        </TabsTrigger>
        <TabsTrigger value="chronological" className="gap-2">
          <Clock3 aria-hidden="true" className="h-4 w-4" />
          {t('tabs.chronological')}
        </TabsTrigger>
        <TabsTrigger value="exceptions" className="gap-2">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          {t('tabs.exceptions')} ({card.warnings.length})
        </TabsTrigger>
        <TabsTrigger value="trace" className="gap-2">
          <ListTree aria-hidden="true" className="h-4 w-4" />
          {t('tabs.trace')}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="spatial">
        <SpatialCardView card={card} />
      </TabsContent>
      <TabsContent value="chronological">
        <ChronologicalCardView card={card} />
      </TabsContent>
      <TabsContent value="exceptions">
        <ExceptionsView card={card} />
      </TabsContent>
      <TabsContent value="trace">
        <RuleTraceView card={card} />
      </TabsContent>
    </Tabs>
  )
}

export function PrintCardView({
  card,
  mode,
}: {
  card: ResolvedCard
  mode: 'spatial' | 'chronological'
}) {
  const t = useTranslations('preferenceCards')
  const unverifiedCount = card.items.filter(
    (item) => item.selectedItemSnapshot !== null && item.verificationState === 'unverified',
  ).length
  const customCount = card.items.filter((item) =>
    isCustomItemId(item.selectedItemSnapshot?.id),
  ).length

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {mode === 'spatial' ? (
          <PackageCheck aria-hidden="true" className="h-4 w-4" />
        ) : (
          <CheckSquare2 aria-hidden="true" className="h-4 w-4" />
        )}
        {mode === 'spatial' ? t('tabs.spatial') : t('tabs.chronological')}
      </div>
      <div className="mb-4">
        <ComposedFromSummary card={card} />
      </div>
      {mode === 'spatial' ? <SpatialCardView card={card} /> : <ChronologicalCardView card={card} />}

      {/* Prints on every page break, so the dagger is never orphaned from its meaning. */}
      <footer className="mt-6 break-inside-avoid border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        {unverifiedCount > 0 ? (
          <p>
            <span className="font-bold text-foreground">†</span>{' '}
            {t('printNotes.unverifiedFootnote', { count: unverifiedCount })}
          </p>
        ) : null}
        {customCount > 0 ? (
          <p className="mt-1">{t('printNotes.customFootnote', { count: customCount })}</p>
        ) : null}
        <p className="mt-1">{t('disclaimer')}</p>
      </footer>
    </div>
  )
}
