import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import type { ProcedureWorkspace } from '../server/procedures.server'
import { getProcedureReviewSummary } from '../server/procedure-review.server'

export async function ProcedureReviewPanel({
  locale,
  workspace,
  showWorksheetLink = true,
}: {
  locale: string
  workspace: ProcedureWorkspace
  showWorksheetLink?: boolean
}) {
  const t = await getTranslations('deviceIntelligence.procedureReview')
  const summary = getProcedureReviewSummary(workspace)
  return (
    <section className="space-y-3 rounded-2xl border border-border p-4" aria-label={t('title')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        {showWorksheetLink ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold hover:bg-muted"
            href={`/${locale}/procedures/${workspace.procedureCode}/setup` as Route}
          >
            {t('openWorksheet')}
          </Link>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{t('note')}</p>
      <ul className="list-inside list-disc space-y-1 text-sm">
        {summary.clinicalOwnerMissing ? <li>{t('ownerMissing')}</li> : null}
        {summary.requiredWithoutSelectableOption > 0 ? (
          <li>{t('requiredGaps', { count: summary.requiredWithoutSelectableOption })}</li>
        ) : null}
        {summary.currentIfuRequired > 0 ? (
          <li>{t('ifu', { count: summary.currentIfuRequired })}</li>
        ) : null}
        {summary.responsibleRoleMissing > 0 ? (
          <li>{t('roles', { count: summary.responsibleRoleMissing })}</li>
        ) : null}
        {summary.optionsMissingCatalogNumber > 0 ? (
          <li>{t('identifiers', { count: summary.optionsMissingCatalogNumber })}</li>
        ) : null}
        {summary.laserCoverageGap ? <li>{t('laser')}</li> : null}
        {summary.rescueAuthoringGap ? <li>{t('rescue')}</li> : null}
      </ul>
    </section>
  )
}
