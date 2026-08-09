import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { EvidenceBadge } from '@/features/device-intelligence/components/EvidenceBadge'
import { DemoWatermark, DraftWatermark } from '@/features/device-intelligence/components/Watermarks'
import type {
  ReadinessDiagnostic,
  RequirementReadinessState,
} from '@/features/device-intelligence/domain/readiness'
import { getProcedureReadinessView } from '@/features/device-intelligence/server/procedures.server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; procedureCode: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, procedureCode } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.readiness' })
  const view = getProcedureReadinessView(procedureCode)
  return {
    title: view ? `${view.procedureName} — ${t('metadataTitle')}` : t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

const STATE_STYLES: Record<RequirementReadinessState, string> = {
  ready: 'border-emerald-600/50 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  ready_with_limitations: 'border-amber-600/50 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  not_ready: 'border-rose-600/50 bg-rose-500/10 text-rose-900 dark:text-rose-200',
}

export default async function ProcedureReadinessPage({ params }: PageProps) {
  const { locale, procedureCode } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.readiness')
  const tCommon = await getTranslations('deviceIntelligence.common')

  const view = getProcedureReadinessView(procedureCode)
  if (!view) notFound()

  const stateLabel = (state: RequirementReadinessState) => t(`states.${state}` as 'states.ready')
  const diagnosticLabel = (diagnostic: ReadinessDiagnostic) =>
    t(`diagnostics.${diagnostic.code}` as 'diagnostics.missing_required_product_role')

  const stateCounts = view.projection.requirements.reduce(
    (counts, requirement) => {
      counts[requirement.state] += 1
      return counts
    },
    { ready: 0, ready_with_limitations: 0, not_ready: 0 } as Record<
      RequirementReadinessState,
      number
    >,
  )

  return (
    <div className="container space-y-6 py-8 md:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/procedures/${view.procedureCode}` as Route}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t('back')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-3">
        <p className="font-mono text-xs text-muted-foreground">{view.procedureCode}</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {t('title', { procedure: view.procedureName })}
        </h1>
      </header>

      <DemoWatermark title={t('demoTitle')} disclaimer={t('demoDisclaimer')} />
      <DraftWatermark
        title={tCommon('draftTitle')}
        status={view.status}
        disclaimer={tCommon('draftDisclaimer')}
      />

      <section aria-label={t('realFormularyHeading')} className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('realFormularyHeading')}</h2>
        <Card className="border-rose-500/40">
          <CardContent className="p-5">
            <p className="text-sm font-semibold">
              {view.formularySummary.carriedRows === 0 && view.formularySummary.preferredRows === 0
                ? t('realFormularyHeadline')
                : t('realFormularyHeadlineNonEmpty')}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('realFormularyBody', {
                rows: view.formularySummary.rowsIntersectingProcedureRoles,
                carried: view.formularySummary.carriedRows,
                preferred: view.formularySummary.preferredRows,
              })}
            </p>
            {view.formularySummary.rowsWithAnyLocalField > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('realFormularyLocalFields', {
                  count: view.formularySummary.rowsWithAnyLocalField,
                })}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">{t('realFormularyNote')}</p>
          </CardContent>
        </Card>
      </section>

      <section aria-label={t('demoProjectionHeading')} className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t('demoProjectionHeading')}</h2>
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-sm font-bold',
              STATE_STYLES[view.projection.headline],
            )}
          >
            {stateLabel(view.projection.headline)}
          </span>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {t('demoProjectionNote', {
            organization: view.demoContextName.organization,
            location: view.demoContextName.location,
            modifiers: view.modifierCodes.join(', '),
          })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('capabilities', { capabilities: view.demoLocationCapabilities.join(', ') })}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(stateCounts) as RequirementReadinessState[]).map((state) => (
            <div key={state} className={cn('rounded-xl border p-3', STATE_STYLES[state])}>
              <p className="text-2xl font-black tabular-nums">{stateCounts[state]}</p>
              <p className="mt-0.5 text-xs font-semibold">{stateLabel(state)}</p>
            </div>
          ))}
        </div>

        {view.projection.blockingWarnings.length > 0 ? (
          <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm">
            <p className="font-semibold">{t('blockingHeading')}</p>
            <ul className="mt-1 space-y-1">
              {view.projection.blockingWarnings.map((warning) => (
                <li key={`${warning.code}-${warning.sourceId ?? ''}`}>
                  <span className="font-mono text-xs">{warning.code}</span> — {warning.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {view.projection.cardDiagnostics.length > 0 ? (
          <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold">{t('cardDiagnosticsHeading')}</p>
            <ul className="mt-1 space-y-1">
              {view.projection.cardDiagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${diagnostic.sourceId}-${index}`}>
                  <span className="font-semibold">{diagnosticLabel(diagnostic)}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">
                    [{diagnostic.sourceKind}: {diagnostic.sourceId}]
                  </span>{' '}
                  — {diagnostic.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          // Keyboard users must be able to scroll this region to reach every column
          // (WCAG 2.1.1, owner-review F-32).
          tabIndex={0}
          role="region"
          aria-label={t('tableRegionLabel')}
          className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('table.requirement')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('table.requiredness')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('table.state')}
                </th>
                <th scope="col" className="px-3 py-2 font-semibold">
                  {t('table.evidence')}
                </th>
              </tr>
            </thead>
            <tbody>
              {view.projection.requirements.map((requirement) => (
                <tr key={requirement.itemId} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 align-top">
                    <p className="font-medium">{requirement.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {requirement.sourceSlotId ?? requirement.itemId} ·{' '}
                      <Link
                        href={
                          `/${locale}/clinical-roles/${encodeURIComponent(requirement.roleCode)}` as Route
                        }
                        className="underline-offset-2 hover:underline"
                      >
                        {requirement.roleCode}
                      </Link>
                    </p>
                  </td>
                  <td className="px-3 py-2 align-top">{requirement.effectiveRequiredness}</td>
                  <td className="px-3 py-2 align-top">
                    <span
                      className={cn(
                        'inline-block rounded-full border px-2 py-0.5 text-xs font-semibold',
                        STATE_STYLES[requirement.state],
                      )}
                    >
                      {stateLabel(requirement.state)}
                      {requirement.resolverAdvisories.length > 0
                        ? ` — ${t('seeAdvisorySuffix')}`
                        : null}
                    </span>
                    {/* The advisory renders in the SAME cell as the state chip (F-26), so a
                        screenshot of the chip cannot omit its qualification. */}
                    {requirement.resolverAdvisories.map((advisory, index) => (
                      <p
                        key={`${advisory.code}-${index}`}
                        className="mt-1 text-xs italic text-muted-foreground"
                      >
                        {t('evidence.resolverAdvisory')}: “{advisory.message}”
                      </p>
                    ))}
                    {requirement.diagnostics.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                        {requirement.diagnostics.map((diagnostic, index) => (
                          <li key={`${diagnostic.code}-${index}`}>
                            {diagnosticLabel(diagnostic)}{' '}
                            <span className="font-mono">
                              [{diagnostic.sourceKind}: {diagnostic.sourceId}]
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    {requirement.evidence.selectedHospitalItemId ? (
                      <>
                        <p>
                          {t('evidence.mapping')}:{' '}
                          <span className="font-mono">
                            {requirement.evidence.selectedHospitalItemId}
                          </span>
                        </p>
                        <p>
                          {t('evidence.verificationState')}:{' '}
                          {requirement.evidence.verificationState ?? tCommon('notRecorded')}
                        </p>
                      </>
                    ) : (
                      <p className="italic">{t('evidence.noMapping')}</p>
                    )}
                    {requirement.evidence.selectedCatalogProductId ? (
                      <p>
                        {t('evidence.product')}:{' '}
                        <span className="font-mono">
                          {requirement.evidence.selectedCatalogProductId}
                        </span>{' '}
                        ({requirement.evidence.productVerificationGrade ?? tCommon('notRecorded')})
                      </p>
                    ) : null}
                    {requirement.evidence.demoStandIn ? (
                      <EvidenceBadge state="demo_stand_in">
                        {tCommon('badges.demoStandIn')}
                      </EvidenceBadge>
                    ) : null}
                    {requirement.evidence.coverage ? (
                      <p>
                        {t('evidence.coverage')}: {requirement.evidence.coverage}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {view.projection.otherWarnings.length > 0 ? (
          <details className="rounded-xl border border-border/70 p-3">
            <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t('otherWarnings', { count: view.projection.otherWarnings.length })}
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {view.projection.otherWarnings.map((warning, index) => (
                <li key={`${warning.code}-${index}`}>
                  <span className="font-mono text-xs">{warning.code}</span> — {warning.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {view.noRescueModuleReachable ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
            {t('noRescueDefinedFact')}{' '}
            {tCommon('rescueAuthoringGapNote', {
              modules: view.authoredRescueModuleNames.join(', '),
            })}
          </p>
        ) : null}
      </section>

      <section aria-label={t('legendHeading')} className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{t('legendHeading')}</h2>
        <ul className="grid gap-1.5 text-sm leading-6 text-muted-foreground md:grid-cols-2">
          <li>
            <span className="font-semibold text-foreground">{t('states.ready')}</span> —{' '}
            {t('legend.ready')}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {t('states.ready_with_limitations')}
            </span>{' '}
            — {t('legend.ready_with_limitations')}
          </li>
          <li>
            <span className="font-semibold text-foreground">{t('states.not_ready')}</span> —{' '}
            {t('legend.not_ready')}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {t('diagnostics.missing_required_product_role')}
            </span>{' '}
            — {t('legend.missing_required_product_role')}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {t('diagnostics.missing_room_capability')}
            </span>{' '}
            — {t('legend.missing_room_capability')}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {t('diagnostics.missing_rescue_pathway')}
            </span>{' '}
            — {t('legend.missing_rescue_pathway')}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {t('diagnostics.available_but_unverified')}
            </span>{' '}
            — {t('legend.available_but_unverified')}
          </li>
          <li>
            <span className="font-semibold text-foreground">
              {t('diagnostics.inventory_formulary_mismatch')}
            </span>{' '}
            — {t('legend.inventory_formulary_mismatch')}
          </li>
        </ul>
        <p className="text-xs leading-5 text-muted-foreground">{t('legendSafetyNote')}</p>
      </section>

      <p className="border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {t('noProcurementNote')}
      </p>
    </div>
  )
}
