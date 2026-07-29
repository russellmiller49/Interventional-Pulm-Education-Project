import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight, ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type {
  CatalogDistributionEvidence,
  CatalogIdentityEvidence,
  CatalogVerificationQueueRow,
  CatalogVerificationSummary,
} from '@/features/preference-cards/data/catalog-verification.server'

function identityLabel(
  t: ReturnType<typeof useTranslations>,
  evidence: CatalogIdentityEvidence,
): string {
  return t(
    {
      strong_candidate: 'admin.verificationIdentityStrong',
      weak_candidate_only: 'admin.verificationIdentityWeak',
      unmatched: 'admin.verificationIdentityUnmatched',
    }[evidence],
  )
}

function distributionLabel(
  t: ReturnType<typeof useTranslations>,
  evidence: CatalogDistributionEvidence,
): string {
  return t(
    {
      in_distribution: 'admin.verificationDistributionIn',
      not_in_distribution: 'admin.verificationDistributionNot',
      conflicting: 'admin.verificationDistributionConflict',
      unknown: 'admin.verificationDistributionUnknown',
    }[evidence],
  )
}

export function CatalogVerificationQueue({
  rows,
  summary,
  locale,
}: {
  rows: CatalogVerificationQueueRow[]
  summary: CatalogVerificationSummary
  locale: string
}) {
  const t = useTranslations('preferenceCards')
  const summaryCards = [
    ['admin.verificationSummaryTotal', summary.totalProducts],
    ['admin.verificationSummaryBacklog', summary.workbookBacklogProducts],
    ['admin.verificationSummaryAdditions', summary.additionsAfterWorkbook],
    ['admin.verificationSummaryP0', summary.p0Products],
    ['admin.verificationSummaryStrong', summary.strongIdentityCandidates],
    ['admin.verificationSummaryIdentityReview', summary.withoutStrongIdentityCandidate],
    ['admin.verificationSummaryDistribution', summary.distributionAlerts],
    ['admin.verificationSummaryGtin', summary.gtinConflicts],
  ] as const

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(([label, count]) => (
          <section key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t(label)}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums">{count}</p>
          </section>
        ))}
      </div>

      <section aria-label={t('admin.verificationQueueLabel')} className="space-y-4">
        {rows.map((row) => {
          const backlog = row.backlog
          const currentRoles =
            row.currentRoles
              .map((role) =>
                [role.roleName, role.roleFit, role.roleCode].filter(Boolean).join(' · '),
              )
              .join(', ') || t('catalog.missingValue')
          const authoredProcedures =
            row.authoredProcedures.map((procedure) => procedure.procedureName).join(', ') ||
            t('catalog.missingValue')
          const proposedProcedures =
            row.proposedProcedures.map((procedure) => procedure.procedureName).join(', ') ||
            t('catalog.missingValue')
          const flags = [
            row.hasGtinBackfillProposal ? t('admin.verificationFlagGtinBackfill') : null,
            row.hasGtinMismatchProposal || row.uniqueStrongGtinCount > 1
              ? t('admin.verificationFlagGtinConflict')
              : null,
            row.hasReleaseCandidateProposal ? t('admin.verificationFlagReleaseCandidate') : null,
            row.backlogDriftFields.length > 0 ? t('admin.verificationFlagBacklogDrift') : null,
            ['different_current_strong', 'no_current_strong'].includes(row.backlogGudidAlignment)
              ? t('admin.verificationFlagBacklogGudidDrift')
              : null,
          ].filter((value): value is string => Boolean(value))

          return (
            <Card key={row.productId}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {backlog?.priority ? (
                        <Badge variant={backlog.priority === 'P0' ? 'destructive' : 'outline'}>
                          {backlog.priority}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{t('admin.verificationNotInBacklog')}</Badge>
                      )}
                      <Badge
                        variant={row.identityEvidence === 'unmatched' ? 'destructive' : 'secondary'}
                      >
                        {identityLabel(t, row.identityEvidence)}
                      </Badge>
                      <Badge
                        variant={
                          ['not_in_distribution', 'conflicting'].includes(row.distributionEvidence)
                            ? 'destructive'
                            : 'outline'
                        }
                      >
                        {distributionLabel(t, row.distributionEvidence)}
                      </Badge>
                      {backlog?.review_status ? (
                        <Badge variant="outline">{backlog.review_status}</Badge>
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {row.manufacturer ?? t('catalog.missingValue')}
                      </p>
                      <h2 className="mt-1 text-xl font-bold tracking-tight">{row.productName}</h2>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {[row.catalogNumber, row.productId].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>

                  <Button asChild size="sm" className="shrink-0">
                    <Link
                      href={
                        `/${locale}/admin/preference-cards/catalog-qa/${row.productId}` as Route
                      }
                    >
                      {t('admin.verificationOpenWorkspace')}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>

                <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin.workstream')}
                    </dt>
                    <dd className="mt-1">{backlog?.workstream ?? t('catalog.missingValue')}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin.verificationEvidenceCounts')}
                    </dt>
                    <dd className="mt-1">
                      {row.strongMatchCount} {t('admin.verificationStrongShort')} ·{' '}
                      {row.weakMatchCount} {t('admin.verificationWeakShort')} · {row.sourceCount}{' '}
                      {t('admin.verificationSourcesShort')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin.verificationCurrentProcedureImpact')}
                    </dt>
                    <dd className="mt-1 space-y-1">
                      <span className="block">
                        {t('admin.verificationAuthoredShort')}: {authoredProcedures}
                      </span>
                      <span className="block">
                        {t('admin.verificationProposedShort')}: {proposedProcedures}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin.verificationCurrentRoles')}
                    </dt>
                    <dd className="mt-1">{currentRoles}</dd>
                  </div>
                </dl>

                {flags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {flags.map((flag) => (
                      <Badge key={flag} variant="outline">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                {backlog?.recommended_action ? (
                  <div className="rounded-xl bg-muted/60 p-3 text-sm leading-6">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {t('admin.action')}
                    </p>
                    <p className="mt-1">{backlog.recommended_action}</p>
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                    {t('admin.verificationAdditionNote')}
                  </p>
                )}

                {backlog?.evidence_url?.startsWith('https://') ? (
                  <a
                    href={backlog.evidence_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    {t('admin.evidence')}
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                ) : null}
              </CardContent>
            </Card>
          )
        })}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <p className="font-semibold">{t('admin.noResults')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.verificationNoResultsHelp')}
            </p>
          </div>
        ) : null}
      </section>
    </>
  )
}
