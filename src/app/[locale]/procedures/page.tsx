import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DeviceTaskNav } from '@/features/device-intelligence/components/DeviceTaskNav'
import { DraftWatermark } from '@/features/device-intelligence/components/Watermarks'
import { EvidenceBadge } from '@/features/device-intelligence/components/EvidenceBadge'
import { getExemplarProcedureIndex } from '@/features/device-intelligence/server/procedures.server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.procedures' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function ProceduresIndexPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.procedures')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const tDevices = await getTranslations('deviceIntelligence.devices')
  const tReference = await getTranslations('deviceIntelligence.reference')
  const tCompare = await getTranslations('deviceIntelligence.compareSelection')

  const entries = getExemplarProcedureIndex()

  return (
    <div className="container space-y-6 py-8 md:py-10">
      <DeviceTaskNav
        locale={locale}
        active="procedures"
        labels={{
          navigation: tDevices('navigationLabel'),
          find: tDevices('findDevice'),
          procedures: tDevices('prepareProcedure'),
          saved: tReference('savedDevices'),
          compare: tCompare('navCompare'),
        }}
      />
      <header className="max-w-4xl space-y-3">
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {t('title')}
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">{t('exemplarNote')}</p>
      </header>

      <DraftWatermark
        title={tCommon('draftTitle')}
        status={t('allDraftStatus')}
        disclaimer={tCommon('draftDisclaimer')}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {entries.map((entry) => (
          <Card key={entry.procedureCode} className="flex flex-col">
            <CardContent className="flex flex-1 flex-col gap-4 p-5">
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-tight">{entry.procedureName}</h2>
                <EvidenceBadge state="draft_procedure">{entry.status}</EvidenceBadge>
              </div>

              {entry.equipmentGroups.length > 0 ? (
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {t('equipmentGroups')}
                  </h3>
                  {/* The template's own authored section names, verbatim and in authored order. */}
                  <ul lang="en" className="flex flex-wrap gap-1.5">
                    {entry.equipmentGroups.map((group) => (
                      <li
                        key={group.section}
                        className="rounded-full border border-border px-2.5 py-1 text-xs"
                      >
                        {group.section}{' '}
                        <span className="text-muted-foreground">{group.slotCount}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-sm text-muted-foreground">
                {t('requirementSummary', {
                  count: entry.slotCount,
                  required: entry.requiredness.required,
                  contingency: entry.requiredness.contingency,
                  optional: entry.requiredness.optional,
                })}
              </p>

              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm">
                  <Link
                    href={`/${locale}/procedures/${entry.procedureCode}?view=sections` as Route}
                  >
                    {t('openWorkspace')}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/procedures/${entry.procedureCode}/readiness` as Route}>
                    {t('openReadiness')}
                  </Link>
                </Button>
              </div>

              {/* Implementation bookkeeping: kept in full, one disclosure away. */}
              <details className="border-t border-border/60 pt-2 text-sm">
                <summary className="inline-flex min-h-9 cursor-pointer items-center rounded text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t('templateDetails')}
                </summary>
                <dl className="mt-2 space-y-1">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('procedureCode')}</dt>
                    <dd className="font-mono text-xs">{entry.procedureCode}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('templateVersion')}</dt>
                    <dd className="font-mono text-xs">
                      {entry.templateVersion ?? tCommon('notRecorded')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('releaseBundle')}</dt>
                    <dd className="break-all text-right font-mono text-xs">
                      {entry.releaseBundleId ?? tCommon('notRecorded')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('slotCount')}</dt>
                    <dd>{entry.slotCount}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('requiredness')}</dt>
                    <dd>
                      {t('requirednessValue', {
                        required: entry.requiredness.required,
                        contingency: entry.requiredness.contingency,
                        optional: entry.requiredness.optional,
                      })}
                    </dd>
                  </div>
                </dl>
                <div className="mt-2 space-y-1 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs leading-5">
                  <p className="font-semibold text-foreground">{t('ladderHeading')}</p>
                  <p>{t('ladder.selectable', { count: entry.ladderSummary.selectableAuthored })}</p>
                  <p>
                    {t('ladder.nonSelectable', {
                      count: entry.ladderSummary.nonSelectableAuthoredOnly,
                    })}
                  </p>
                  <p>{t('ladder.proposalsOnly', { count: entry.ladderSummary.proposalsOnly })}</p>
                  <p>
                    {t('ladder.noCoverage', {
                      count:
                        entry.ladderSummary.noOptionNoProposalRoleMapped +
                        entry.ladderSummary.noOptionNoProposalUnmapped,
                    })}
                  </p>
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="border-t border-border/70 pt-5 text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {t('otherProceduresNote')}
      </p>
    </div>
  )
}
