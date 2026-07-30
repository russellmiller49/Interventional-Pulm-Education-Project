'use client'

import { BadgeCheck, CircleHelp, FileSearch, History, PackageX, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

import type { CatalogVerificationTier } from '../domain/verification'
import type { CatalogLifecycleContext } from '../server/catalog-store'
import type { CatalogDistributionStatus } from '../server/catalog'

export interface VerificationBadgeLabels {
  verified: string
  candidate: string
  unknown: string
  usPending: string
  notDistributed: string
  conflictingDistribution: string
  legacyInstalledBase: string
  legacyInstalledBaseHelp: string
}

interface VerificationBadgeProps {
  tier: CatalogVerificationTier
  usStatusPending?: boolean
  /** FDA GUDID commercial-distribution status, when a confident match exists. */
  distributionStatus?: CatalogDistributionStatus | null
  catalogLifecycleContext?: CatalogLifecycleContext
  lifecycleNote?: string | null
  labels: VerificationBadgeLabels
  className?: string
}

export function VerificationBadge({
  tier,
  usStatusPending = false,
  distributionStatus = null,
  catalogLifecycleContext = 'unknown',
  lifecycleNote = null,
  labels,
  className,
}: VerificationBadgeProps) {
  const Icon = tier === 'verified' ? BadgeCheck : tier === 'candidate' ? FileSearch : CircleHelp
  const label =
    tier === 'verified' ? labels.verified : tier === 'candidate' ? labels.candidate : labels.unknown
  const reviewedLifecycleNote = lifecycleNote?.trim()
  const lifecycleHelp = reviewedLifecycleNote
    ? `${labels.legacyInstalledBaseHelp} ${reviewedLifecycleNote}`
    : labels.legacyInstalledBaseHelp

  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1.5', className)}>
      <Badge
        variant={tier === 'verified' ? 'success' : tier === 'candidate' ? 'info' : 'outline'}
        size="sm"
        className="gap-1 normal-case tracking-normal"
      >
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {label}
      </Badge>
      {catalogLifecycleContext === 'legacy_active_installed_base' ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                size="sm"
                className="gap-1 normal-case tracking-normal"
                title={lifecycleHelp}
                aria-label={`${labels.legacyInstalledBase}. ${lifecycleHelp}`}
                tabIndex={0}
              >
                <History aria-hidden="true" className="h-3.5 w-3.5" />
                {labels.legacyInstalledBase}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs normal-case tracking-normal">
              {lifecycleHelp}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
      {distributionStatus === 'not_in_distribution' ? (
        <Badge variant="destructive" size="sm" className="gap-1 normal-case tracking-normal">
          <PackageX aria-hidden="true" className="h-3.5 w-3.5" />
          {labels.notDistributed}
        </Badge>
      ) : null}
      {distributionStatus === 'conflicting' ? (
        <Badge variant="destructive" size="sm" className="gap-1 normal-case tracking-normal">
          <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
          {labels.conflictingDistribution}
        </Badge>
      ) : null}
      {usStatusPending && distributionStatus !== 'not_in_distribution' ? (
        <Badge variant="outline" size="sm" className="normal-case tracking-normal">
          {labels.usPending}
        </Badge>
      ) : null}
    </span>
  )
}

export interface VerificationLegendLabels extends VerificationBadgeLabels {
  legendTitle: string
  verifiedHelp: string
  candidateHelp: string
  usPendingHelp: string
  notDistributedHelp: string
  conflictingDistributionHelp: string
}

export function VerificationLegend({
  labels,
  className,
}: {
  labels: VerificationLegendLabels
  className?: string
}) {
  const rows = [
    { tier: 'verified' as const, label: labels.verified, help: labels.verifiedHelp },
    { tier: 'candidate' as const, label: labels.candidate, help: labels.candidateHelp },
  ]
  return (
    <div className={cn('rounded-xl border border-border/70 bg-muted/30 p-4 text-sm', className)}>
      <p className="font-semibold text-foreground">{labels.legendTitle}</p>
      <dl className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.tier} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
            <dt className="sm:w-32 sm:shrink-0">
              <VerificationBadge tier={row.tier} labels={labels} />
            </dt>
            <dd className="text-muted-foreground">{row.help}</dd>
          </div>
        ))}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <dt className="sm:w-32 sm:shrink-0">
            <Badge variant="outline" size="sm" className="normal-case tracking-normal">
              {labels.usPending}
            </Badge>
          </dt>
          <dd className="text-muted-foreground">{labels.usPendingHelp}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <dt className="sm:w-32 sm:shrink-0">
            <Badge variant="destructive" size="sm" className="gap-1 normal-case tracking-normal">
              <PackageX aria-hidden="true" className="h-3.5 w-3.5" />
              {labels.notDistributed}
            </Badge>
          </dt>
          <dd className="text-muted-foreground">{labels.notDistributedHelp}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <dt className="sm:w-32 sm:shrink-0">
            <Badge variant="destructive" size="sm" className="gap-1 normal-case tracking-normal">
              <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
              {labels.conflictingDistribution}
            </Badge>
          </dt>
          <dd className="text-muted-foreground">{labels.conflictingDistributionHelp}</dd>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <dt className="sm:w-32 sm:shrink-0">
            <Badge
              variant="secondary"
              size="sm"
              className="gap-1 normal-case tracking-normal"
              title={labels.legacyInstalledBaseHelp}
            >
              <History aria-hidden="true" className="h-3.5 w-3.5" />
              {labels.legacyInstalledBase}
            </Badge>
          </dt>
          <dd className="text-muted-foreground">{labels.legacyInstalledBaseHelp}</dd>
        </div>
      </dl>
    </div>
  )
}
