import type { Route } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type {
  SlotOptionReviewRow,
  SlotOptionReviewSummary,
} from '@/features/preference-cards/data/slot-option-proposals.server'

export function SlotOptionReviewQueue({
  rows,
  summary,
  locale,
}: {
  rows: SlotOptionReviewRow[]
  summary: SlotOptionReviewSummary
  locale: string
}) {
  const t = useTranslations('preferenceCards')
  const summaryCards = [
    ['admin.slotReviewSummaryProposals', summary.totalProposals],
    ['admin.slotReviewSummaryProducts', summary.affectedProducts],
    ['admin.slotReviewSummarySlots', summary.affectedSlots],
    ['admin.slotReviewSummaryRequired', summary.requiredProposals],
    ['admin.slotReviewSummaryNotDistributed', summary.notInDistribution],
    ['admin.slotReviewSummaryConflictingDistribution', summary.conflictingDistribution],
    ['admin.slotReviewSummaryUnknownDistribution', summary.unknownDistribution],
  ] as const

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {summaryCards.map(([label, count]) => (
          <section key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t(label)}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums">{count}</p>
          </section>
        ))}
      </div>

      <section aria-label={t('admin.slotReviewQueueLabel')} className="space-y-4">
        {rows.map((row) => (
          <Card key={`${row.slot_id}-${row.product_id}`}>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={row.requiredness === 'required' ? 'destructive' : 'outline'}>
                      {row.requiredness}
                    </Badge>
                    <Badge variant="secondary">{t('admin.slotReviewUnreviewed')}</Badge>
                    <Badge variant="outline">
                      {row.product_verification_grade ?? t('catalog.missingValue')}
                    </Badge>
                    <Badge
                      variant={
                        ['not_in_distribution', 'conflicting'].includes(row.distributionEvidence)
                          ? 'destructive'
                          : 'outline'
                      }
                    >
                      {row.distributionEvidence === 'in_distribution'
                        ? t('admin.verificationDistributionIn')
                        : row.distributionEvidence === 'not_in_distribution'
                          ? t('admin.verificationDistributionNot')
                          : row.distributionEvidence === 'conflicting'
                            ? t('admin.verificationDistributionConflict')
                            : t('admin.verificationDistributionUnknown')}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {row.procedureName}
                  </p>
                  <h2 className="text-xl font-bold tracking-tight">{row.slot_label}</h2>
                  <p className="text-sm text-muted-foreground">
                    {row.roleName} · {t('admin.verificationRoleFit')}:{' '}
                    {row.role_fit ?? t('catalog.missingValue')} ·{' '}
                    <span className="font-mono text-xs">{row.role_code}</span>
                  </p>
                </div>

                <Button asChild size="sm" className="shrink-0">
                  <Link
                    href={`/${locale}/admin/preference-cards/catalog-qa/${row.product_id}` as Route}
                  >
                    {t('admin.verificationOpenWorkspace')}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="rounded-xl bg-muted/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('admin.product')}
                  </p>
                  <p className="mt-1 font-semibold">{row.product_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.manufacturer ?? t('catalog.missingValue')} ·{' '}
                    <span className="font-mono">
                      {row.catalog_number ?? t('catalog.missingValue')}
                    </span>
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {row.product_id}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('admin.slotReviewSourceContext')}
                  </p>
                  <p className="mt-1 text-sm">
                    {[
                      row.source_identifiers.primary_source_id,
                      row.source_identifiers.primary_source_location,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('catalog.missingValue')}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{row.slot_id}</p>
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{row.reason}</p>

              <aside className="rounded-xl border border-amber-400/50 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
                {t('admin.slotReviewRowSafety')}
              </aside>
            </CardContent>
          </Card>
        ))}

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <p className="font-semibold">{t('admin.slotReviewNoResults')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('admin.slotReviewNoResultsHelp')}
            </p>
          </div>
        ) : null}
      </section>
    </>
  )
}
