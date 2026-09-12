import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getProcedureWorkspace } from '@/features/device-intelligence/server/procedures.server'
import { getProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import { PrintControls } from '@/features/preference-cards/components/PrintControls'
import { ProcedureReviewPanel } from '@/features/device-intelligence/components/ProcedureReviewPanel'
import { openHoldStatuses, requirednessValues } from '@/features/preference-cards/domain/types'
import styles from '@/features/device-intelligence/components/ReferencePrint.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Draft setup review worksheet',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function ProcedureSetupPage({
  params,
}: {
  params: Promise<{ locale: string; procedureCode: string }>
}) {
  const { locale, procedureCode } = await params
  setRequestLocale(locale)
  const workspace = getProcedureWorkspace(procedureCode)
  if (!workspace) notFound()
  const outputs = getProcedureOutputPreviews(
    procedureCode,
    workspace.scenarioId,
    workspace.formularySummary,
  )
  if (!outputs) notFound()
  const t = await getTranslations('deviceIntelligence.setupWorksheet')
  const tWorkspace = await getTranslations('deviceIntelligence.workspace')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const requirednessLabels = Object.fromEntries(
    requirednessValues.map((value) => [value, t(`requiredness.${value}`)]),
  )
  const openHoldLabels = Object.fromEntries(
    openHoldStatuses.map((value) => [value, t(`openHold.${value}`)]),
  )
  const cellClass = 'border-t border-border p-3 align-top text-sm [overflow-wrap:anywhere]'
  const reviewPanel = await ProcedureReviewPanel({ locale, workspace, showWorksheetLink: false })
  return (
    <div className={`device-reference-output container space-y-5 py-8 ${styles.output}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          className="text-sm underline"
          href={`/${locale}/procedures/${procedureCode}` as Route}
        >
          {t('back')}
        </Link>
        <PrintControls />
      </div>
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">
          {workspace.procedureName} — {t('title')}
        </h1>
        <p className="text-xs">
          {t('prepared', {
            date: new Date().toISOString().slice(0, 10),
            version: workspace.templateVersion ?? tCommon('notRecorded'),
          })}
        </p>
        <p className="text-sm leading-6">{t('boundary')}</p>
      </header>
      {reviewPanel}
      <div
        role="region"
        tabIndex={0}
        aria-label={t('title')}
        className="overflow-x-auto rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-1/2" />
            <col className="w-1/4" />
          </colgroup>
          <thead>
            <tr>
              <th colSpan={3} className="bg-muted p-3 text-sm font-bold">
                {tCommon('draftTitle')}
              </th>
            </tr>
            <tr>
              <th scope="col" className="w-1/4 p-3 text-sm">
                {t('requirement')}
              </th>
              <th scope="col" className="w-1/2 p-3 text-sm">
                {t('details')}
              </th>
              <th scope="col" className="w-1/4 p-3 text-sm">
                {t('localReview')}
              </th>
            </tr>
          </thead>
          {outputs.roomSetup.map((group) => (
            <Rows key={group.key} group={group} />
          ))}
        </table>
      </div>
      {outputs.suppressedItems.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t('includedInKit')}</h2>
          <p className="text-xs">{t('kitNote')}</p>
          <ul className="list-inside list-disc space-y-2 text-sm">
            {outputs.suppressedItems.map((item) => (
              <li key={item.itemId}>
                <strong>{item.label}</strong> · {item.reason ?? tCommon('notRecorded')}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs">{t('remainingReview')}</p>
      <p className="text-xs [overflow-wrap:anywhere]">
        {t('source')}: /{locale}/procedures/{procedureCode} · {workspace.releaseBundleId}
      </p>
    </div>
  )

  function Rows({ group }: { group: NonNullable<typeof outputs>['roomSetup'][number] }) {
    return (
      <tbody>
        <tr>
          <th scope="rowgroup" colSpan={3} className="border-t bg-muted/50 p-3 text-sm">
            {tWorkspace(`setupZones.${group.key}` as 'setupZones.unassigned')}
          </th>
        </tr>
        {group.lines.map((line) => (
          <tr key={line.itemId}>
            <th scope="row" className={cellClass}>
              {line.label}
              <p className="mt-1 text-xs font-normal">
                {requirednessLabels[line.effectiveRequiredness] ?? tCommon('notRecorded')} ·{' '}
                {openHoldLabels[line.openHoldStatus] ?? tCommon('notRecorded')}
              </p>
            </th>
            <td className={cellClass}>
              <p lang="en">{line.genericRequirement}</p>
              {line.dependencyRule ? (
                <p lang="en" className="mt-1 text-xs">
                  {t('dependency')}: {line.dependencyRule}
                </p>
              ) : null}
              {line.requiresCurrentIfu ? (
                <p className="mt-1 text-xs font-semibold">{t('ifu')}</p>
              ) : null}
              <p className="mt-1 text-xs">
                {t('role')}: {line.responsibleRole ?? tCommon('notRecorded')}
              </p>
            </td>
            <td className={cellClass}>
              <span className="text-xs text-muted-foreground">{t('localPrompt')}</span>
            </td>
          </tr>
        ))}
      </tbody>
    )
  }
}
