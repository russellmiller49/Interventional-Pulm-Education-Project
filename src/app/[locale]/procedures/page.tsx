import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

  const entries = getExemplarProcedureIndex()

  return (
    <div className="container space-y-6 py-8 md:py-10">
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
            <CardContent className="flex flex-1 flex-col gap-3 p-5">
              <div className="space-y-1.5">
                <p className="font-mono text-xs text-muted-foreground">{entry.procedureCode}</p>
                <h2 className="text-xl font-bold tracking-tight">{entry.procedureName}</h2>
                <EvidenceBadge state="draft_procedure">{entry.status}</EvidenceBadge>
              </div>
              <dl className="space-y-1 text-sm">
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
              <div className="space-y-1 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs leading-5">
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
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm">
                  <Link href={`/${locale}/procedures/${entry.procedureCode}` as Route}>
                    {t('openWorkspace')}
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/${locale}/procedures/${entry.procedureCode}/readiness` as Route}>
                    {t('openReadiness')}
                  </Link>
                </Button>
              </div>
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
