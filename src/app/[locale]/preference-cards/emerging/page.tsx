import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { PrototypeBanner } from '@/features/preference-cards/components/PrototypeBanner'
import { VerificationBadge } from '@/features/preference-cards/components/VerificationBadge'
import { getEmergingDevices } from '@/features/preference-cards/server/catalog'

/**
 * The breakthrough-designated cohort.
 *
 * A preference card is a pull list: everything on one is meant to be in the room. These
 * devices are not, and several may never be. Giving them a page of their own is what lets the
 * catalog answer "what about microwave ablation?" honestly instead of either inventing a
 * stockable line item or saying nothing at all.
 */

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards.emerging' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function EmergingDevicesPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards.emerging')
  const tCard = await getTranslations('preferenceCards')
  const tVerification = await getTranslations('preferenceCards.catalog.verification')

  const verificationLabels = {
    verified: tVerification('verified'),
    candidate: tVerification('candidate'),
    unknown: tVerification('unknown'),
    usPending: tVerification('usPending'),
    notDistributed: tVerification('notDistributed'),
    conflictingDistribution: tVerification('conflictingDistribution'),
    legacyInstalledBase: tVerification('legacyInstalledBase'),
    legacyInstalledBaseHelp: tVerification('legacyInstalledBaseHelp'),
    regulatoryCleared510k: tVerification('regulatoryCleared510k'),
    regulatoryApprovedPma: tVerification('regulatoryApprovedPma'),
    regulatoryGrantedDeNovo: tVerification('regulatoryGrantedDeNovo'),
    regulatoryBreakthroughInvestigational: tVerification('regulatoryBreakthroughInvestigational'),
    regulatoryBreakthroughPremarketReview: tVerification('regulatoryBreakthroughPremarketReview'),
    regulatoryNotUsAuthorized: tVerification('regulatoryNotUsAuthorized'),
    regulatoryHelp: tVerification('regulatoryHelp'),
  }

  const groups = getEmergingDevices()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <PrototypeBanner title={tCard('prototypeBanner')} disclaimer={tCard('disclaimer')} />

      <header className="max-w-4xl space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
          {t('heading')}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{t('description')}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/preference-cards/catalog` as Route}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('backToCatalog')}
          </Link>
        </Button>
      </header>

      <p className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
        {t('evidenceCaveat')}
      </p>

      {groups.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty')}</p> : null}

      {groups.map((group) => (
        <section key={group.theme} className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">{group.theme}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {group.devices.map((device) => (
              <Card key={device.productId} className="h-full">
                <CardContent className="space-y-3 p-5">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {device.manufacturerDisplay}
                    </p>
                    <h3 className="text-lg font-bold tracking-tight text-foreground">
                      {device.productName}
                    </h3>
                  </div>

                  <VerificationBadge
                    tier="candidate"
                    regulatoryStatus={device.regulatoryStatus}
                    regulatoryNote={device.regulatoryNote}
                    labels={verificationLabels}
                  />

                  <p className="text-xs font-medium text-muted-foreground">
                    {device.breakthroughDesignatedOn
                      ? t('designatedOn', { date: device.breakthroughDesignatedOn })
                      : t('designationDateUnknown')}
                  </p>

                  {device.description ? (
                    <p className="text-sm leading-6 text-muted-foreground">{device.description}</p>
                  ) : null}

                  {device.regulatoryNote ? (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">
                        {t('regulatoryStatusLabel')}
                      </p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {device.regulatoryNote}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">{t('wouldServeLabel')}</p>
                    {device.roleNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {device.roleNames.map((roleName) => (
                          <Badge
                            key={roleName}
                            variant="outline"
                            size="sm"
                            className="normal-case tracking-normal"
                          >
                            {roleName}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('noRoles')}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{t('excludedNotice')}</p>
                  </div>

                  {device.sources.length > 0 ? (
                    <div className="space-y-1 border-t border-border/70 pt-3">
                      <p className="text-xs font-semibold text-foreground">{t('evidenceLabel')}</p>
                      <ul className="space-y-1">
                        {device.sources.map((source) => (
                          <li key={source.sourceId} className="text-xs text-muted-foreground">
                            {source.title}
                            {source.reliabilityTier ? ` — ${source.reliabilityTier}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {tCard('disclaimer')}
      </p>
    </div>
  )
}
