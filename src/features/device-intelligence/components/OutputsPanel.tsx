import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ProcedureOutputPreviews } from '@/features/device-intelligence/server/outputs.server'
import type { RealFormularySummary } from '@/features/device-intelligence/server/procedures.server'
import { EvidenceBadge } from './EvidenceBadge'
import { LinkTabs } from './LinkTabs'

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
        </div>
      ) : null}

      {tab === 'nursing' ? (
        <div className="space-y-3">
          {outputs.nursing.map((group) => (
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
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === 'training' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{t('training.authoredOnlyNote')}</p>
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
                      {line.requiresCurrentIfu ? (
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
