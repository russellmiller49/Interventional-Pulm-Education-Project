'use client'

import {
  BadgeCheck,
  CircleHelp,
  FileSearch,
  FlaskConical,
  History,
  PackageX,
  ScrollText,
  TriangleAlert,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

import type { CatalogVerificationTier } from '../domain/verification'
import type { CatalogLifecycleContext, RegulatoryStatus } from '../server/catalog-store'
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
  regulatoryCleared510k: string
  regulatoryApprovedPma: string
  regulatoryGrantedDeNovo: string
  regulatoryBreakthroughInvestigational: string
  regulatoryBreakthroughPremarketReview: string
  regulatoryNotUsAuthorized: string
  regulatoryHelp: string
}

interface VerificationBadgeProps {
  tier: CatalogVerificationTier
  usStatusPending?: boolean
  /** FDA GUDID commercial-distribution status, when a confident match exists. */
  distributionStatus?: CatalogDistributionStatus | null
  catalogLifecycleContext?: CatalogLifecycleContext
  lifecycleNote?: string | null
  /** US marketing authorization, an axis of its own. `unknown` renders nothing. */
  regulatoryStatus?: RegulatoryStatus
  regulatoryNote?: string | null
  labels: VerificationBadgeLabels
  className?: string
}

/**
 * The regulatory badge, styled by what the status actually permits.
 *
 * A breakthrough designation is an agreement to review, not an authorization, so it renders
 * in the warning style rather than the reassuring one an approval gets.
 */
function regulatoryBadgeFor(
  status: RegulatoryStatus,
  labels: VerificationBadgeLabels,
): {
  label: string
  variant: 'success' | 'info' | 'warning' | 'outline'
  investigational: boolean
} | null {
  switch (status) {
    case 'us_cleared_510k':
      return { label: labels.regulatoryCleared510k, variant: 'info', investigational: false }
    case 'us_approved_pma':
      return { label: labels.regulatoryApprovedPma, variant: 'success', investigational: false }
    case 'us_granted_de_novo':
      return { label: labels.regulatoryGrantedDeNovo, variant: 'info', investigational: false }
    case 'breakthrough_designated_investigational':
      return {
        label: labels.regulatoryBreakthroughInvestigational,
        variant: 'warning',
        investigational: true,
      }
    case 'breakthrough_designated_premarket_review':
      return {
        label: labels.regulatoryBreakthroughPremarketReview,
        variant: 'warning',
        investigational: true,
      }
    case 'not_us_authorized':
      return { label: labels.regulatoryNotUsAuthorized, variant: 'warning', investigational: true }
    default:
      return null
  }
}

export function VerificationBadge({
  tier,
  usStatusPending = false,
  distributionStatus = null,
  catalogLifecycleContext = 'unknown',
  lifecycleNote = null,
  regulatoryStatus = 'unknown',
  regulatoryNote = null,
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
  const regulatory = regulatoryBadgeFor(regulatoryStatus, labels)
  const reviewedRegulatoryNote = regulatoryNote?.trim()
  const regulatoryHelp = reviewedRegulatoryNote
    ? `${labels.regulatoryHelp} ${reviewedRegulatoryNote}`
    : labels.regulatoryHelp

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
      {regulatory ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={regulatory.variant}
                size="sm"
                className="gap-1 normal-case tracking-normal"
                title={regulatoryHelp}
                aria-label={`${regulatory.label}. ${regulatoryHelp}`}
                tabIndex={0}
              >
                {regulatory.investigational ? (
                  <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <ScrollText aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {regulatory.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs normal-case tracking-normal">
              {regulatoryHelp}
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
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <dt className="sm:w-32 sm:shrink-0">
            <Badge
              variant="warning"
              size="sm"
              className="gap-1 normal-case tracking-normal"
              title={labels.regulatoryHelp}
            >
              <FlaskConical aria-hidden="true" className="h-3.5 w-3.5" />
              {labels.regulatoryBreakthroughInvestigational}
            </Badge>
          </dt>
          <dd className="text-muted-foreground">{labels.regulatoryHelp}</dd>
        </div>
      </dl>
    </div>
  )
}
