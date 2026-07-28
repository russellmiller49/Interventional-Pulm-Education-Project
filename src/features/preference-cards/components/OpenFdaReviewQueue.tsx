import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type {
  OpenFdaReviewData,
  OpenFdaReviewRow,
} from '@/features/preference-cards/data/openfda-proposals.server'

function classificationLabel(
  t: ReturnType<typeof useTranslations>,
  classification: OpenFdaReviewRow['classification'],
): string {
  const key = {
    high_confidence_candidate: 'admin.openfdaClassificationHigh',
    review_required: 'admin.openfdaClassificationReview',
    unmatched: 'admin.openfdaClassificationUnmatched',
    insufficient_identifiers: 'admin.openfdaClassificationInsufficient',
    query_error: 'admin.openfdaClassificationError',
  }[classification]
  return t(key)
}

export function OpenFdaReviewQueue({
  status,
  rows,
  counts,
}: Pick<OpenFdaReviewData, 'status' | 'rows' | 'counts'>) {
  const t = useTranslations('preferenceCards')
  if (status !== 'available') {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <h2 className="text-xl font-bold">{t('admin.openfdaEmptyTitle')}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
          {t('admin.openfdaEmptyBody')}
        </p>
      </section>
    )
  }

  const summaries = [
    ['admin.openfdaSummaryHigh', counts.high_confidence_candidate],
    ['admin.openfdaSummaryReview', counts.review_required],
    ['admin.openfdaSummaryUnmatched', counts.unmatched],
    ['admin.openfdaSummaryInsufficient', counts.insufficient_identifiers],
    ['admin.openfdaSummaryErrors', counts.query_error],
  ] as const

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaries.map(([label, count]) => (
          <section key={label} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t(label)}
            </p>
            <p className="mt-2 text-3xl font-black tabular-nums">{count}</p>
          </section>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[1650px] text-left text-xs">
          <thead className="bg-muted/70 uppercase tracking-wider text-muted-foreground">
            <tr>
              {[
                'product',
                'openfdaClassification',
                'openfdaCandidateDi',
                'openfdaCandidateCatalog',
                'openfdaCandidateManufacturer',
                'openfdaCandidateModel',
                'distribution',
                'openfdaReasonCodes',
                'openfdaBacklogComparison',
                'openfdaPublicVersionDate',
              ].map((column) => (
                <th key={column} className="px-3 py-3">
                  {t(`admin.${column}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.productId} className="align-top">
                <td className="max-w-80 px-3 py-3">
                  <p className="font-semibold">{row.productName}</p>
                  <p className="mt-1 text-muted-foreground">
                    {[row.manufacturer, row.catalogNumber].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {row.productId}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {[row.procedures, row.roles].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <Badge variant={row.classification === 'query_error' ? 'destructive' : 'outline'}>
                    {classificationLabel(t, row.classification)}
                  </Badge>
                </td>
                <td className="px-3 py-3 font-mono">{row.candidateDi ?? '—'}</td>
                <td className="px-3 py-3 font-mono">{row.candidateCatalogNumber ?? '—'}</td>
                <td className="max-w-56 px-3 py-3">{row.candidateManufacturer ?? '—'}</td>
                <td className="px-3 py-3 font-mono">{row.candidateModel ?? '—'}</td>
                <td className="max-w-48 px-3 py-3">{row.distributionStatus ?? '—'}</td>
                <td className="max-w-72 px-3 py-3">
                  {row.reasonCodes.map((reason) => reason.replaceAll('_', ' ')).join('; ') || '—'}
                </td>
                <td className="max-w-64 px-3 py-3">
                  <span className={row.backlogConflict ? 'font-bold text-destructive' : ''}>
                    {row.backlogComparison.replaceAll('_', ' ')}
                  </span>
                </td>
                <td className="px-3 py-3">{row.publicVersionDate ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            {t('admin.openfdaNoResults')}
          </p>
        ) : null}
      </div>
    </>
  )
}
