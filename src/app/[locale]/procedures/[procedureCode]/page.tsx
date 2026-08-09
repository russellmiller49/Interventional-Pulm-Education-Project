import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EvidenceBadge } from '@/features/device-intelligence/components/EvidenceBadge'
import {
  OutputsPanel,
  type OutputTab,
} from '@/features/device-intelligence/components/OutputsPanel'
import {
  DIVERGENT_PATHWAY_SECTION,
  RequirementBrowser,
  type RequirementView,
} from '@/features/device-intelligence/components/RequirementBrowser'
import { DraftWatermark } from '@/features/device-intelligence/components/Watermarks'
import { getProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import {
  getProcedureWorkspace,
  type ModifierEffectSummary,
} from '@/features/device-intelligence/server/procedures.server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; procedureCode: string }>
  searchParams?: Promise<{ view?: string; output?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, procedureCode } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.workspace' })
  const workspace = getProcedureWorkspace(procedureCode)
  return {
    title: workspace ? `${workspace.procedureName} — ${t('metadataTitle')}` : t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function ProcedureWorkspacePage({ params, searchParams }: PageProps) {
  const { locale, procedureCode } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.workspace')
  const tCommon = await getTranslations('deviceIntelligence.common')

  const workspace = getProcedureWorkspace(procedureCode)
  if (!workspace) notFound()

  const search = (await searchParams) ?? {}
  const view: RequirementView = search.view === 'phases' ? 'phases' : 'zones'
  const outputTab: OutputTab = (['card', 'room', 'nursing', 'training', 'gaps'] as const).includes(
    search.output as OutputTab,
  )
    ? (search.output as OutputTab)
    : 'card'

  const outputs = getProcedureOutputPreviews(
    workspace.procedureCode,
    workspace.scenarioId,
    workspace.formularySummary,
  )
  if (!outputs) notFound()

  const actingModifiers = workspace.modifiers.filter((modifier) => modifier.hasStructuralEffect)
  const inertModifiers = workspace.modifiers.filter((modifier) => !modifier.hasStructuralEffect)

  const renderModifier = (modifier: ModifierEffectSummary) => (
    <Card key={modifier.code}>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-xs text-muted-foreground">
            {modifier.code} · {modifier.releaseState}
          </p>
          <p className="text-sm font-bold">{modifier.name}</p>
          {workspace.defaultModifierCodes.includes(modifier.code) ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {t('modifierDefault')}
            </span>
          ) : null}
          {!modifier.hasStructuralEffect ? (
            <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {t('modifierInertBadge')}
            </span>
          ) : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{modifier.description}</p>
        {modifier.conflictsWith.length > 0 ? (
          <p className="text-xs text-rose-700 dark:text-rose-300">
            {t('modifierConflicts', { codes: modifier.conflictsWith.join(', ') })}
          </p>
        ) : null}
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {modifier.effects.addedRequirements.length > 0 ? (
            <li>
              {t('effects.adds', { count: modifier.effects.addedRequirements.length })}:{' '}
              {modifier.effects.addedRequirements
                .map((requirement) => requirement.label)
                .join('; ')}
            </li>
          ) : null}
          {modifier.effects.removedRequirements.length > 0 ? (
            <li>
              {t('effects.removes', {
                count: modifier.effects.removedRequirements.length,
              })}
              :{' '}
              {modifier.effects.removedRequirements
                .map((requirement) => requirement.label)
                .join('; ')}
            </li>
          ) : null}
          {modifier.effects.requirednessChanges.map((change) => (
            <li key={`${modifier.code}-${change.id}`}>
              {t('effects.requiredness', {
                label: change.label,
                from: change.from,
                to: change.to,
              })}
            </li>
          ))}
          {modifier.effects.roleReplacements.map((replacement) => (
            <li key={`${modifier.code}-${replacement.id}`}>
              {t('effects.roleReplacement', {
                label: replacement.label,
                from: replacement.fromRole,
                to: replacement.toRole,
              })}
            </li>
          ))}
          {modifier.effects.rescueModulesAdded.map((code) => (
            <li key={`${modifier.code}-rescue-${code}`}>{t('effects.rescueModule', { code })}</li>
          ))}
          {modifier.effects.requiredCapabilities.map((capability) => (
            <li key={`${modifier.code}-capability-${capability}`}>
              {t('effects.capability', { capability })}
            </li>
          ))}
          {!modifier.hasStructuralEffect ? <li className="italic">{t('effects.none')}</li> : null}
        </ul>
      </CardContent>
    </Card>
  )

  // Awaited here rather than embedded as async elements so the page resolves to a plain
  // element tree — renderable by the jsdom test renderer as well as the RSC pipeline.
  const requirementBrowser = await RequirementBrowser({ locale, workspace, view })
  const outputsPanel = await OutputsPanel({
    locale,
    procedureCode: workspace.procedureCode,
    scenarioId: workspace.scenarioId,
    outputs,
    tab: outputTab,
    formularySummary: workspace.formularySummary,
  })

  return (
    <div className="container space-y-8 py-8 md:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/procedures` as Route}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t('back')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-3">
        <p className="font-mono text-xs text-muted-foreground">{workspace.procedureCode}</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {workspace.procedureName}
        </h1>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('overview.templateVersion')}</dt>
            <dd className="font-mono text-xs">
              {workspace.templateVersion ?? tCommon('notRecorded')}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('overview.releaseBundle')}</dt>
            <dd className="break-all font-mono text-xs">
              {workspace.releaseBundleId ?? tCommon('notRecorded')}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('overview.scenario')}</dt>
            <dd>{workspace.scenarioTitle}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t('overview.governanceState')}</dt>
            <dd>{workspace.governanceState}</dd>
          </div>
        </dl>
      </header>

      <DraftWatermark
        title={tCommon('draftTitle')}
        status={workspace.status}
        disclaimer={
          workspace.clinicalOwner === null
            ? `${tCommon('draftDisclaimer')} ${t('overview.noClinicalOwner')}`
            : tCommon('draftDisclaimer')
        }
      />

      <section aria-label={t('ladderHeading')} className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t('ladderHeading')}</h2>
        <p className="text-sm text-muted-foreground">{t('ladderNote')}</p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <LadderTile
            label={t('coverage.selectableAuthored')}
            count={workspace.ladder.summary.selectableAuthored}
          />
          <LadderTile
            label={t('coverage.nonSelectableAuthoredOnly')}
            count={workspace.ladder.summary.nonSelectableAuthoredOnly}
          />
          <LadderTile
            label={t('coverage.proposalsOnly')}
            count={workspace.ladder.summary.proposalsOnly}
          />
          <LadderTile
            label={t('coverage.noOptionRoleMapped')}
            count={workspace.ladder.summary.noOptionNoProposalRoleMapped}
          />
          <LadderTile
            label={t('coverage.noOptionUnmapped')}
            count={workspace.ladder.summary.noOptionNoProposalUnmapped}
          />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t('proposalsTotal', { count: workspace.proposalTotal })} {t('proposalsNeverSelectable')}
        </p>
        {workspace.procedureCode === 'THERAPEUTIC_BRONCH' ? (
          // Owner-review F-07: an authored statement, deliberately independent of the ladder
          // badges. Its release-wide truth is pinned by the mechanisms.test.ts assertion
          // covering every LASER* role across ALL procedure slots, not just this page's.
          <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm leading-6">
            {t('laserPathwayNote')}
          </p>
        ) : null}
        {workspace.sectionOrder.includes(DIVERGENT_PATHWAY_SECTION) ? (
          // Owner-review F-06 (interim display fix): name the coverage imbalance between the
          // divergent IPC pathway and the chest-tube pathway itself. Gated on the section's
          // presence in the composition — if a data pass moves the IPC roles out, the note
          // disappears with them; its coverage claims are pinned in mechanisms.test.ts.
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
            {t('longTermDrainageNote')}
          </p>
        ) : null}
      </section>

      {requirementBrowser}

      <section aria-label={t('modifiersHeading')} className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t('modifiersHeading')}</h2>
        <p className="text-sm text-muted-foreground">{t('modifiersNote')}</p>
        <p className="text-sm font-medium">
          {t('modifiersActingSummary', {
            acting: actingModifiers.length,
            total: workspace.modifiers.length,
          })}
        </p>
        <div className="grid gap-3 lg:grid-cols-2">{actingModifiers.map(renderModifier)}</div>
        {inertModifiers.length > 0 ? (
          <details className="rounded-xl border border-border/70 p-3">
            <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t('inertModifiersDisclosure', { count: inertModifiers.length })}
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {inertModifiers.map(renderModifier)}
            </div>
          </details>
        ) : null}
      </section>

      <section aria-label={t('rescueHeading')} className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t('rescueHeading')}</h2>
        {workspace.noRescueModuleReachable ? (
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6">
            {t('noRescueFact', { count: workspace.rescueSectionSlotCount })}{' '}
            {tCommon('rescueAuthoringGapNote', {
              modules: workspace.authoredRescueModuleNames.join(', '),
            })}
          </p>
        ) : (
          workspace.rescueModules.map((rescueModule) => (
            <Card key={rescueModule.code}>
              <CardContent className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs text-muted-foreground">{rescueModule.code}</p>
                  <p className="text-sm font-bold">{rescueModule.name}</p>
                </div>
                {/* The module's own scope disclaimer ("equipment readiness, not a clinical
                    management protocol") carries body-size bordered weight (F-12): the slot
                    list below is what a reader will screenshot. */}
                <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm leading-6">
                  {rescueModule.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('rescueReachableVia', {
                    codes: rescueModule.reachableViaModifierCodes.join(', '),
                  })}
                </p>
                <ul className="space-y-1 border-t border-border/60 pt-2 text-sm">
                  {rescueModule.slots.map((slot) => (
                    <li key={slot.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{slot.label}</span>
                      <span className="text-xs text-muted-foreground">{slot.roleName}</span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {slot.requiredness}
                      </span>
                      <span className="text-xs text-muted-foreground">{slot.openHoldStatus}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section aria-label={t('compatibilityHeading')} className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t('compatibilityHeading')}</h2>
        {workspace.typedRuleConditions.length > 0 ? (
          <ul className="space-y-2">
            {workspace.typedRuleConditions.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-border/70 p-3 text-sm">
                <p className="font-mono text-xs text-muted-foreground">
                  {rule.id} · {rule.severity}
                </p>
                <p className="mt-1">
                  {rule.sourceRoleCode}.{rule.sourceAttribute} {rule.operator}{' '}
                  {rule.targetRoleCode ? `${rule.targetRoleCode}.${rule.targetAttribute}` : ''}
                  {rule.unit ? ` (${rule.unit})` : null}
                </p>
                <p className="mt-1 text-muted-foreground">{rule.message}</p>
                <p className="mt-1 text-xs italic text-muted-foreground">
                  {t('missingValueBehavior')}: {rule.missingValueMessage}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-muted-foreground">{t('noTypedRules')}</p>
        )}
        {workspace.rawCompatibilityStatements.length > 0 ? (
          <details className="rounded-xl border border-border/70 p-3">
            <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {t('rawStatements', { count: workspace.rawCompatibilityStatements.length })}
            </summary>
            <ul className="mt-2 space-y-2">
              {workspace.rawCompatibilityStatements.map((statement) => (
                <li key={statement.ruleId} className="border-t border-border/50 pt-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-xs text-muted-foreground">{statement.ruleId}</p>
                    {statement.verificationGrade === 'verified_source' ? (
                      <EvidenceBadge state="verified_source_fact">
                        {tCommon('badges.verifiedSource')}
                      </EvidenceBadge>
                    ) : statement.verificationGrade === 'candidate' ? (
                      <EvidenceBadge state="candidate_fact">
                        {tCommon('badges.candidate')}
                      </EvidenceBadge>
                    ) : (
                      <EvidenceBadge state="unknown">{tCommon('badges.unknown')}</EvidenceBadge>
                    )}
                  </div>
                  {statement.ruleText ? (
                    <p className="mt-1 text-muted-foreground">“{statement.ruleText}”</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div id="outputs">{outputsPanel}</div>

      <div className="flex flex-wrap gap-2 border-t border-border/70 pt-5">
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/procedures/${workspace.procedureCode}/readiness` as Route}>
            {t('openReadiness')}
          </Link>
        </Button>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
      </p>
    </div>
  )
}

function LadderTile({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-2xl font-black tabular-nums">{count}</p>
      <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{label}</p>
    </div>
  )
}
