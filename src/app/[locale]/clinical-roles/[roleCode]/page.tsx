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
import { ProductStatusBadges } from '@/features/device-intelligence/components/ProductStatus'
import { isExemplarProcedureCode } from '@/features/device-intelligence/domain/exemplars'
import { UNRESEARCHED_PRODUCT_STATUS } from '@/features/device-intelligence/domain/product-status'
import { getAtlasUseDetail } from '@/features/device-intelligence/server/atlas.server'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'
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

/**
 * Owner-review F-21: most `selection_guidance` entries are short filter instructions, not
 * teaching prose. Below this length the text renders inline as "Selection criteria"; at or
 * above it, as the blockquoted "Authored selection guidance". A crude but workable
 * discriminator until the governed role table splits the field (deferred to data review).
 */
const GUIDANCE_PROSE_MIN_LENGTH = 200

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
  const { detail, statusByProductId } = use
  const slotUsage = getRoleSlotUsage(detail.role.role_code)
  const statusLabels = await getProductStatusLabels(locale)

  // Owner-review F-22: the availability fact, hoisted above the product listing and derived
  // from the same rung classifier the workspace uses.
  const proceduresWithSelectableOption = new Set(
    slotUsage
      .filter((usage) => usage.optionStatus === 'selectable_authored')
      .map((usage) => usage.procedureCode),
  ).size

  const guidance = detail.role.selection_guidance
  const guidanceIsProse = (guidance?.length ?? 0) >= GUIDANCE_PROSE_MIN_LENGTH

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
        {/* Owner-review F-22: the availability fact reads before any product listing, so
            named products cannot be mistaken for selectable options. */}
        <p className="text-sm font-medium">
          {proceduresWithSelectableOption > 0
            ? t('availabilitySome', { count: proceduresWithSelectableOption })
            : t('availabilityNone')}
        </p>
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {t('membershipNote')}
        </p>
      </header>

      {guidance ? (
        guidanceIsProse ? (
          <section className="space-y-2" aria-label={t('guidanceHeading')}>
            <h2 className="text-2xl font-semibold tracking-tight">{t('guidanceHeading')}</h2>
            <Card>
              <CardContent className="p-5">
                <blockquote className="border-l-2 border-primary pl-4 text-sm leading-6">
                  “{guidance}”
                </blockquote>
                <p className="mt-2 text-xs text-muted-foreground">{t('guidanceVerbatim')}</p>
                {/* Codex C-05: a global qualifier on EVERY role page, adjacent to the
                    governed text it qualifies — some authored guidance uses formulary-like
                    phrasing, and no role page may imply a real institution behind it. */}
                <p className="mt-1 text-xs text-muted-foreground">{t('guidanceGenericNote')}</p>
              </CardContent>
            </Card>
          </section>
        ) : (
          // Owner-review F-21: short filter-style text is a selection criterion, not
          // teaching prose — same verbatim quoting, lighter frame.
          <section className="space-y-1" aria-label={t('criteriaHeading')}>
            <h2 className="text-2xl font-semibold tracking-tight">{t('criteriaHeading')}</h2>
            <p className="text-sm leading-6">
              “{guidance}”{' '}
              <span className="text-xs text-muted-foreground">{t('guidanceVerbatim')}</span>
            </p>
            {/* Codex C-05: same global qualifier, same adjacency, for the short branch. */}
            <p className="text-xs text-muted-foreground">{t('guidanceGenericNote')}</p>
          </section>
        )
      ) : null}

      <section
        className="space-y-3"
        aria-label={t('productsHeading', { count: detail.totalProducts })}
      >
        <h2 className="text-2xl font-semibold tracking-tight">
          {t('productsHeading', { count: detail.totalProducts })}
        </h2>
        <p className="text-sm text-muted-foreground">{t('cohortNote')}</p>
        {/* Owner-review F-23: a single-vendor listing drops the redundant per-group heading
            and says so plainly instead, naming the one manufacturer. */}
        {detail.manufacturerGroups.length === 1 ? (
          <p className="text-sm font-medium">
            {t('singleManufacturerNote', {
              manufacturer: detail.manufacturerGroups[0].manufacturerDisplay,
            })}
          </p>
        ) : null}
        {detail.manufacturerGroups.length > 0 ? (
          <div className="space-y-4">
            {detail.manufacturerGroups.map((group) => (
              <Card key={group.manufacturerGroupId}>
                <CardContent className="p-5">
                  {detail.manufacturerGroups.length > 1 ? (
                    <h3 className="text-base font-bold">
                      {group.manufacturerDisplay}{' '}
                      <span className="text-sm font-normal text-muted-foreground">
                        {t('manufacturerProducts', { count: group.items.length })}
                      </span>
                    </h3>
                  ) : null}
                  <ul className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <li
                        key={item.productId}
                        className="rounded-xl border border-border px-3 py-2 text-sm transition focus-within:border-primary hover:border-primary"
                      >
                        <Link
                          href={`/${locale}/devices/${item.productId}` as Route}
                          className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        {/* D2B: role discovery lists now include products whose current
                            availability is unestablished, so each entry carries its own
                            compact market/safety marks rather than reading as "current".
                            Kept OUTSIDE the link so the link's accessible name stays the
                            product identity. */}
                        <div className="mt-1.5">
                          <ProductStatusBadges
                            status={
                              statusByProductId[item.productId] ?? UNRESEARCHED_PRODUCT_STATUS
                            }
                            labels={statusLabels}
                          />
                        </div>
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
          <div
            // Keyboard-scrollable region (WCAG 2.1.1, owner-review F-32).
            tabIndex={0}
            role="region"
            aria-label={t('tableRegionLabel')}
            className="overflow-x-auto rounded-2xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
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
        {/* Owner-review F-24: the IFU statement is a near-universal property of the atlas
            (134 of 135 roles), so it reads once here instead of as a per-role banner. */}
        {detail.role.requires_current_ifu ? <>{t('currentIfuFooter')} </> : null}
        {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
      </p>
    </div>
  )
}
