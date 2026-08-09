import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import type { RealFormularySummary } from '@/features/device-intelligence/server/procedures.server'
import { EvidenceBadge } from './EvidenceBadge'
import { LinkTabs } from './LinkTabs'
import { DemoWatermark } from './Watermarks'

/**
 * Read-only output previews (spec §5, outputs 2–5) plus the link into the EXISTING
 * preference-card builder (output 1 — never duplicated here). All four previews project the
 * single resolved demo card passed in; nothing is saved, exported, or written.
 */

export type OutputTab = 'card' | 'room' | 'nursing' | 'training' | 'gaps'

export async function OutputsPanel({
  locale,
  procedureCode,
  scenarioId,
  outputs,
  tab,
  formularySummary,
}: {
  locale: string
  procedureCode: string
  scenarioId: string
  outputs: ProcedureOutputPreviews
  tab: OutputTab
  formularySummary: RealFormularySummary
}) {
  const t = await getTranslations('deviceIntelligence.outputs')
  const tWorkspace = await getTranslations('deviceIntelligence.workspace')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const tReadiness = await getTranslations('deviceIntelligence.readiness')

  const basePath = `/${locale}/procedures/${procedureCode}`
  const tabs: { key: OutputTab; label: string }[] = [
    { key: 'card', label: t('tabs.card') },
    { key: 'room', label: t('tabs.room') },
    { key: 'nursing', label: t('tabs.nursing') },
    { key: 'training', label: t('tabs.training') },
    { key: 'gaps', label: t('tabs.gaps') },
  ]

  const zoneLabel = (zone: string) => tWorkspace(`setupZones.${zone}` as 'setupZones.unassigned')
  const phaseLabel = (phase: string) =>
    tWorkspace(`proceduralPhases.${phase}` as 'proceduralPhases.unassigned')

  // Owner-review F-02: kit-suppressed requirements render as their own group in the room
  // and nursing previews — computed by the resolver, shown with its own suppression reason,
  // never silently dropped.
  const suppressedGroup =
    outputs.suppressedItems.length > 0 ? (
      <Card className="border-dashed">
        <CardContent className="p-5">
          <h3 className="text-base font-bold">{t('suppressed.heading')}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('suppressed.note')}</p>
          <ul className="mt-2 space-y-1.5">
            {outputs.suppressedItems.map((item) => (
              <li key={item.itemId} className="text-sm">
                <span className="font-medium">{item.label}</span>{' '}
                <span className="font-mono text-xs text-muted-foreground">{item.roleCode}</span>
                {item.reason ? (
                  <p className="text-xs italic text-muted-foreground">“{item.reason}”</p>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    ) : null

  // Owner-review F-30: with no responsible role authored anywhere, this preview cannot
  // group by role — say so instead of presenting the phase partition as a distinct view.
  const allNursingUnassigned =
    outputs.nursing.length === 1 && outputs.nursing[0].responsibleRole === 'unassigned'

  const trainingLines = outputs.training.flatMap((group) => group.lines)
  // Owner-review F-24: when the IFU flag is universal across this preview it is stated once,
  // not repeated per line; per-line advisories remain for the discriminating case.
  const ifuUniversal =
    trainingLines.length > 0 && trainingLines.every((line) => line.requiresCurrentIfu)

  return (
    <section aria-label={t('heading')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t('heading')}</h2>
        <LinkTabs
          label={t('tabsLabel')}
          tabs={tabs.map((entry) => ({
            key: entry.key,
            label: entry.label,
            href: (entry.key === 'card'
              ? `${basePath}#outputs`
              : `${basePath}?output=${entry.key}#outputs`) as Route,
            active: tab === entry.key,
          }))}
        />
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{t('readOnlyNote')}</p>

      <DemoWatermark title={tReadiness('demoTitle')} disclaimer={t('demoDisclaimer')} />

      {tab === 'card' ? (
        <Card>
          <CardContent className="space-y-3 p-5">
            <h3 className="text-lg font-bold">{t('card.heading')}</h3>
            <p className="text-sm leading-6 text-muted-foreground">{t('card.body')}</p>
            <Button asChild size="sm">
              <Link
                href={
                  `/${locale}/preference-cards/new?scenario=${encodeURIComponent(scenarioId)}` as Route
                }
              >
                {t('card.openBuilder')}
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">{t('card.builderNote')}</p>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'room' ? (
        <div className="space-y-3">
          {outputs.roomSetup.map((group) => (
            <Card key={group.key}>
              <CardContent className="p-5">
                <h3 className="text-base font-bold">{zoneLabel(group.key)}</h3>
                <ul className="mt-2 space-y-1.5">
                  {group.lines.map((line) => (
                    <li
                      key={line.itemId}
                      className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-1.5 text-sm last:border-0 last:pb-0"
                    >
                      <span className="font-medium">{line.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {t('room.quantity')}: {line.quantityDisplay}
                      </span>
                      <span className="text-xs text-muted-foreground">{line.openHoldStatus}</span>
                      {line.sterileStatus ? (
                        <span className="text-xs text-muted-foreground">{line.sterileStatus}</span>
                      ) : null}
                      {line.verificationState === 'demo_only' ? (
                        <EvidenceBadge state="demo_stand_in">
                          {tCommon('badges.demoStandIn')}
                        </EvidenceBadge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
          {suppressedGroup}
        </div>
      ) : null}

      {tab === 'nursing' ? (
        <div className="space-y-3">
          {allNursingUnassigned ? (
            <>
              <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
                {t('nursing.allUnassignedNote')}
              </p>
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-base font-bold">{t('nursing.unassignedRole')}</h3>
                  <ul className="mt-2 space-y-1">
                    {outputs.nursing[0].phases
                      .flatMap((phase) => phase.lines)
                      .map((line) => (
                        <li key={line.itemId} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{line.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {line.openHoldStatus}
                          </span>
                          {line.selectedDescription ? (
                            <span className="text-xs text-muted-foreground">
                              — {line.selectedDescription}
                            </span>
                          ) : null}
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          ) : (
            outputs.nursing.map((group) => (
              <Card key={group.responsibleRole}>
                <CardContent className="p-5">
                  <h3 className="text-base font-bold">
                    {group.responsibleRole === 'unassigned'
                      ? t('nursing.unassignedRole')
                      : group.responsibleRole}
                  </h3>
                  {group.phases.map((phase) => (
                    <div key={phase.key} className="mt-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        {phaseLabel(phase.key)}
                      </h4>
                      <ul className="mt-1 space-y-1">
                        {phase.lines.map((line) => (
                          <li
                            key={line.itemId}
                            className="flex flex-wrap items-center gap-2 text-sm"
                          >
                            <span className="font-medium">{line.label}</span>
                            <span className="text-xs text-muted-foreground">
                              {line.openHoldStatus}
                            </span>
                            {line.selectedDescription ? (
                              <span className="text-xs text-muted-foreground">
                                — {line.selectedDescription}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))
          )}
          {suppressedGroup}
        </div>
      ) : null}

      {tab === 'training' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('training.authoredOnlyNote')}</p>
          {ifuUniversal ? (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
              {t('training.currentIfuUniversalNote')}
            </p>
          ) : null}
          {outputs.training.map((group) => (
            <Card key={group.key}>
              <CardContent className="p-5">
                <h3 className="text-base font-bold">{phaseLabel(group.key)}</h3>
                <ul className="mt-2 space-y-3">
                  {group.lines.map((line) => (
                    <li
                      key={line.itemId}
                      className="border-b border-border/50 pb-2 text-sm last:border-0"
                    >
                      <p className="font-medium">{line.label}</p>
                      <blockquote className="mt-1 border-l-2 border-border pl-3 text-muted-foreground">
                        “{line.genericRequirement}”
                      </blockquote>
                      {line.selectionGuidance ? (
                        <blockquote className="mt-1 border-l-2 border-primary/50 pl-3 text-muted-foreground">
                          “{line.selectionGuidance}”
                        </blockquote>
                      ) : null}
                      {line.dependencyRule ? (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {t('training.dependencyRule')}: “{line.dependencyRule}”
                        </p>
                      ) : null}
                      {line.requiresCurrentIfu && !ifuUniversal ? (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          {t('training.currentIfuAdvisory')}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'gaps' ? (
        <div className="space-y-3">
          <p className="rounded-xl border border-violet-500/50 bg-violet-500/10 px-4 py-3 text-sm leading-6">
            {t('gaps.demoOnlyNote')}
          </p>
          <Card>
            <CardContent className="space-y-3 p-5">
              <div>
                <h3 className="text-sm font-bold">{t('gaps.proposalsOnlyRoles')}</h3>
                <RoleList roles={outputs.gaps.proposalsOnlyRoles} empty={t('gaps.none')} />
                <p className="mt-1 text-xs text-muted-foreground">{t('gaps.proposalsNote')}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold">{t('gaps.unmappedRoles')}</h3>
                <RoleList roles={outputs.gaps.unmappedRoles} empty={t('gaps.none')} />
              </div>
              <div>
                <h3 className="text-sm font-bold">{t('gaps.nonSelectableRoles')}</h3>
                <RoleList roles={outputs.gaps.nonSelectableOnlyRoles} empty={t('gaps.none')} />
              </div>
              <div>
                <h3 className="text-sm font-bold">{t('gaps.demoStandInRoles')}</h3>
                <RoleList roles={outputs.gaps.demoStandInRoles} empty={t('gaps.none')} />
              </div>
              <div>
                <h3 className="text-sm font-bold">{t('gaps.dimensionGaps')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('gaps.dimensionGapCount', { count: outputs.gaps.dimensionGapCount })}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-bold">{t('gaps.formularyHeading')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('gaps.formularyBody', {
                    rows: formularySummary.rowsIntersectingProcedureRoles,
                    carried: formularySummary.carriedRows,
                    preferred: formularySummary.preferredRows,
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  )
}

function RoleList({ roles, empty }: { roles: string[]; empty: string }) {
  if (roles.length === 0) {
    return <p className="text-sm italic text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <li key={role} className="rounded-full border border-border px-2 py-0.5 font-mono text-xs">
          {role}
        </li>
      ))}
    </ul>
  )
}
