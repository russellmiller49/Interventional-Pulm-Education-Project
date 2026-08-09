import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  canonicalRoleCode,
  isDeprecatedRoleCode,
} from '@/features/preference-cards/domain/role-taxonomy'
import { EvidenceBadge } from '@/features/device-intelligence/components/EvidenceBadge'
import { isExemplarProcedureCode } from '@/features/device-intelligence/domain/exemplars'
import { getAtlasUseDetail } from '@/features/device-intelligence/server/atlas.server'
import { getRoleSlotUsage } from '@/features/device-intelligence/server/procedures.server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; roleCode: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, roleCode } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.role' })
  const use = getAtlasUseDetail(canonicalRoleCode(decodeURIComponent(roleCode)))
  return {
    title: use ? `${use.detail.role.role_name} — ${t('metadataTitle')}` : t('metadataTitle'),
    description: use?.detail.role.description ?? t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

const OPTION_STATUS_EVIDENCE = {
  selectable_authored: 'authored_selectable',
  non_selectable_authored_only: 'authored_non_selectable',
  proposals_only: 'unreviewed_proposal',
  no_authored_option: 'unknown',
} as const

export default async function ClinicalRolePage({ params }: PageProps) {
  const { locale, roleCode } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.role')
  const tCommon = await getTranslations('deviceIntelligence.common')

  // A legacy role alias is resolved, then redirected — the canonical code is the only URL
  // this route owns, matching the existing preference-card canonicalization behavior.
  const requestedRoleCode = decodeURIComponent(roleCode)
  if (isDeprecatedRoleCode(requestedRoleCode)) {
    redirect(
      `/${locale}/clinical-roles/${encodeURIComponent(canonicalRoleCode(requestedRoleCode))}` as Route,
    )
  }

  const use = getAtlasUseDetail(requestedRoleCode)
  if (!use) notFound()
  const { detail } = use
  const slotUsage = getRoleSlotUsage(detail.role.role_code)

  const optionStatusLabels: Record<string, string> = {
    selectable_authored: tCommon('badges.authoredSelectable'),
    non_selectable_authored_only: tCommon('badges.authoredNonSelectable'),
    proposals_only: tCommon('badges.unreviewedProposal'),
    no_authored_option: t('noAuthoredOption'),
  }

  return (
    <div className="container space-y-8 py-8 md:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/devices` as Route}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t('back')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-3">
        <p className="font-mono text-xs text-muted-foreground">{detail.role.role_code}</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {detail.role.role_name}
        </h1>
        {detail.role.category ? (
          <Badge variant="outline" size="sm" className="normal-case tracking-normal">
            {detail.role.category}
          </Badge>
        ) : null}
        {detail.role.description ? (
          <p className="text-base leading-7 text-muted-foreground">{detail.role.description}</p>
        ) : null}
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {t('membershipNote')}
        </p>
      </header>

      {detail.role.selection_guidance ? (
        <section className="space-y-2" aria-label={t('guidanceHeading')}>
          <h2 className="text-2xl font-semibold tracking-tight">{t('guidanceHeading')}</h2>
          <Card>
            <CardContent className="p-5">
              <blockquote className="border-l-2 border-primary pl-4 text-sm leading-6">
                “{detail.role.selection_guidance}”
              </blockquote>
              <p className="mt-2 text-xs text-muted-foreground">{t('guidanceVerbatim')}</p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {detail.role.requires_current_ifu ? (
        <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm leading-6">
          {t('currentIfuAdvisory')}
        </p>
      ) : null}

      <section
        className="space-y-3"
        aria-label={t('productsHeading', { count: detail.totalProducts })}
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('productsHeading', { count: detail.totalProducts })}
        </h2>
        <p className="text-sm text-muted-foreground">{t('cohortNote')}</p>
        {detail.manufacturerGroups.length > 0 ? (
          <div className="space-y-4">
            {detail.manufacturerGroups.map((group) => (
              <Card key={group.manufacturerGroupId}>
                <CardContent className="p-5">
                  <h3 className="text-base font-bold">
                    {group.manufacturerDisplay}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      {t('manufacturerProducts', { count: group.items.length })}
                    </span>
                  </h3>
                  <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <li key={item.productId}>
                        <Link
                          href={`/${locale}/devices/${item.productId}` as Route}
                          className="block rounded-xl border border-border px-3 py-2 text-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="font-medium">{item.productName}</span>
                          {item.sizeDisplay ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {item.sizeDisplay}
                            </span>
                          ) : null}
                          {item.roleFit ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              · {item.roleFit}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">{t('noCohortProducts')}</p>
        )}
      </section>

      <section className="space-y-3" aria-label={t('proceduresHeading')}>
        <h2 className="text-2xl font-semibold tracking-tight">{t('proceduresHeading')}</h2>
        <p className="text-sm text-muted-foreground">{t('proceduresNote')}</p>
        {slotUsage.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('table.procedure')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('table.slot')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('table.requiredness')}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {t('table.optionStatus')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {slotUsage.map((usage) => (
                  <tr key={usage.slotId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      {isExemplarProcedureCode(usage.procedureCode) ? (
                        <Link
                          href={`/${locale}/procedures/${usage.procedureCode}` as Route}
                          className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {usage.procedureName}
                        </Link>
                      ) : (
                        <span className="font-medium">{usage.procedureName}</span>
                      )}
                      {usage.procedureStatus ? (
                        <span className="ml-2">
                          <EvidenceBadge state="draft_procedure">
                            {usage.procedureStatus}
                          </EvidenceBadge>
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{usage.slotLabel}</td>
                    <td className="px-3 py-2">{usage.requiredness}</td>
                    <td className="px-3 py-2">
                      <EvidenceBadge state={OPTION_STATUS_EVIDENCE[usage.optionStatus]}>
                        {optionStatusLabels[usage.optionStatus]}
                      </EvidenceBadge>
                      {usage.proposalCount > 0 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {t('proposalCount', { count: usage.proposalCount })}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">{t('noProcedures')}</p>
        )}
      </section>

      <section className="space-y-2" aria-label={t('evidenceHeading')}>
        <h2 className="text-2xl font-semibold tracking-tight">{t('evidenceHeading')}</h2>
        <ul className="space-y-1.5 text-sm leading-6 text-muted-foreground">
          <li>
            <EvidenceBadge state="verified_source_fact">
              {tCommon('badges.verifiedSource')}
            </EvidenceBadge>{' '}
            {t('evidence.verifiedSource')}
          </li>
          <li>
            <EvidenceBadge state="authored_selectable">
              {tCommon('badges.authoredSelectable')}
            </EvidenceBadge>{' '}
            {t('evidence.authoredSelectable')}
          </li>
          <li>
            <EvidenceBadge state="authored_non_selectable">
              {tCommon('badges.authoredNonSelectable')}
            </EvidenceBadge>{' '}
            {t('evidence.authoredNonSelectable')}
          </li>
          <li>
            <EvidenceBadge state="unreviewed_proposal">
              {tCommon('badges.unreviewedProposal')}
            </EvidenceBadge>{' '}
            {t('evidence.unreviewedProposal')}
          </li>
        </ul>
      </section>

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
      </p>
    </div>
  )
}
