import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VerificationBadge } from '@/features/preference-cards/components/VerificationBadge'
import { EvidenceBadge, FactRow } from '@/features/device-intelligence/components/EvidenceBadge'
import {
  MarketSafetyPanel,
  ProductStatusBadges,
} from '@/features/device-intelligence/components/ProductStatus'
import { PRODUCT_ID_PATTERN } from '@/features/device-intelligence/domain/atlas-cohort'
import { isExemplarProcedureCode } from '@/features/device-intelligence/domain/exemplars'
import { getAtlasProductDetail } from '@/features/device-intelligence/server/atlas.server'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; productId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, productId } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.device' })
  const detail = PRODUCT_ID_PATTERN.test(productId) ? getAtlasProductDetail(productId) : null
  return {
    title: detail
      ? `${detail.product.product_name} — ${detail.product.manufacturerDisplay}`
      : t('notFound'),
    description: detail?.product.description ?? t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function DeviceDetailPage({ params }: PageProps) {
  const { locale, productId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('deviceIntelligence.device')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const tVerification = await getTranslations('preferenceCards.catalog.verification')

  if (!PRODUCT_ID_PATTERN.test(productId)) notFound()
  const detail = getAtlasProductDetail(productId)
  if (!detail) notFound()
  const { product } = detail
  const statusLabels = await getProductStatusLabels(locale)

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

  const identifiers: { label: string; value: string | null; mono?: boolean }[] = [
    { label: t('fields.catalogNumber'), value: product.catalog_number, mono: true },
    { label: t('fields.gtin'), value: product.gtin, mono: true },
    { label: t('fields.globalPartNumber'), value: product.global_part_number, mono: true },
    { label: t('fields.referencePartNumber'), value: product.reference_part_number, mono: true },
    { label: t('fields.alternateIds'), value: product.alternate_ids, mono: true },
    { label: t('fields.packageUom'), value: product.package_uom },
    { label: t('fields.sterileStatus'), value: product.sterile_status },
    { label: t('fields.reuseStatus'), value: product.reuse_status },
  ]

  const specs: { label: string; value: string | number | null }[] = [
    { label: t('fields.diameterMm'), value: product.diameter_mm },
    { label: t('fields.lengthMm'), value: product.length_mm },
    { label: t('fields.frenchSize'), value: product.french_size },
    { label: t('fields.gauge'), value: product.gauge },
    { label: t('fields.workingLengthCm'), value: product.working_length_cm },
    { label: t('fields.minWorkingChannelMm'), value: product.min_working_channel_mm },
    { label: t('fields.deliverySystemOdMm'), value: product.delivery_system_od_mm },
    { label: t('fields.material'), value: product.material },
    { label: t('fields.sizeDisplay'), value: product.size_display },
  ]

  const hasValue = (row: { value: string | number | null }) =>
    row.value !== null && row.value !== undefined && String(row.value).trim() !== ''
  const presentIdentifiers = identifiers.filter(hasValue)
  const missingIdentifiers = identifiers.filter((row) => !hasValue(row))
  const presentSpecs = specs.filter(hasValue)
  const missingSpecs = specs.filter((row) => !hasValue(row))

  return (
    <div className="container space-y-8 py-8 md:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/devices` as Route}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t('back')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-3">
        <p className="text-sm font-semibold text-primary">{product.manufacturerDisplay}</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {product.product_name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge
            tier={product.verificationTier}
            usStatusPending={product.usStatusPending}
            distributionStatus={detail.distributionStatus}
            catalogLifecycleContext={product.catalogLifecycleContext}
            lifecycleNote={product.lifecycleNote}
            regulatoryStatus={product.regulatoryStatus}
            regulatoryNote={product.regulatoryNote}
            labels={verificationLabels}
          />
          {/* D2B: compact market/safety marks in the header; the full statement, its
              snapshot date, and the required disclaimers live in the panel below. */}
          <ProductStatusBadges status={detail.status} labels={statusLabels} />
          {[product.product_kind, product.primary_category, product.subcategory]
            .filter((value): value is string => Boolean(value))
            .map((value) => (
              <Badge
                key={value}
                variant="outline"
                size="sm"
                className="normal-case tracking-normal"
              >
                {value}
              </Badge>
            ))}
        </div>
        {detail.primaryRole ? (
          // Owner-review F-17: the functional orientation — what this device is FOR — leads
          // the page, before any identifier or dimension.
          <p className="text-base leading-7">
            <Link
              href={
                `/${locale}/clinical-roles/${encodeURIComponent(detail.primaryRole.roleCode)}` as Route
              }
              className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {detail.primaryRole.roleName}
            </Link>
            {detail.primaryRole.description ? (
              <span className="text-muted-foreground"> — {detail.primaryRole.description}</span>
            ) : null}
          </p>
        ) : null}
        {product.description && product.description !== product.product_name ? (
          <p className="text-base leading-7 text-muted-foreground">{product.description}</p>
        ) : null}
      </header>

      {/* Owner-review F-16: present facts render as rows; absent fields collapse into one
          honest sentence per card that still names every unrecorded field. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-bold tracking-tight">{t('identifiersHeading')}</h2>
            <dl className="mt-3">
              {presentIdentifiers.map((row) => (
                <FactRow
                  key={row.label}
                  term={row.label}
                  value={row.value}
                  missingLabel={tCommon('notRecorded')}
                  mono={row.mono}
                />
              ))}
            </dl>
            {missingIdentifiers.length > 0 ? (
              <p className="mt-3 text-sm italic text-muted-foreground">
                {t('notRecordedFields', {
                  fields: missingIdentifiers.map((row) => row.label).join(', '),
                })}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-bold tracking-tight">{t('specsHeading')}</h2>
            <dl className="mt-3">
              {presentSpecs.map((row) => (
                <FactRow
                  key={row.label}
                  term={row.label}
                  value={row.value}
                  missingLabel={tCommon('notRecorded')}
                />
              ))}
            </dl>
            {missingSpecs.length > 0 ? (
              <p className="mt-3 text-sm italic text-muted-foreground">
                {t('notRecordedFields', {
                  fields: missingSpecs.map((row) => row.label).join(', '),
                })}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">{t('specsMissingNote')}</p>
          </CardContent>
        </Card>
      </div>

      <MarketSafetyPanel status={detail.status} labels={statusLabels} />

      <section className="space-y-3" aria-label={t('rolesHeading')}>
        <h2 className="text-2xl font-semibold tracking-tight">{t('rolesHeading')}</h2>
        <p className="text-sm text-muted-foreground">{t('rolesDiscoveryNote')}</p>
        {detail.roles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {detail.roles.map((role) => (
              <Link
                key={role.roleCode}
                href={`/${locale}/clinical-roles/${encodeURIComponent(role.roleCode)}` as Route}
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {role.roleName}
                {role.roleFit ? (
                  <span className="ml-1.5 text-muted-foreground">· {role.roleFit}</span>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-muted-foreground">{t('noRoles')}</p>
        )}
      </section>

      {detail.slots.length > 0 ? (
        <section className="space-y-3" aria-label={t('proceduresHeading')}>
          <h2 className="text-2xl font-semibold tracking-tight">{t('proceduresHeading')}</h2>
          <p className="text-sm text-muted-foreground">{t('proceduresNote')}</p>
          <ul className="space-y-2">
            {detail.slots.map((slot) => (
              <li
                key={`${slot.slotId}`}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm"
              >
                {isExemplarProcedureCode(slot.procedureCode) ? (
                  <Link
                    href={`/${locale}/procedures/${slot.procedureCode}` as Route}
                    className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {slot.procedureName}
                  </Link>
                ) : (
                  <span className="font-medium">{slot.procedureName}</span>
                )}
                <span className="text-muted-foreground">› {slot.slotLabel}</span>
                <Badge variant="outline" size="sm" className="normal-case tracking-normal">
                  {slot.requiredness}
                </Badge>
                {slot.selectable === true ? (
                  <EvidenceBadge state="authored_selectable">
                    {tCommon('badges.authoredSelectable')}
                  </EvidenceBadge>
                ) : (
                  <EvidenceBadge state="authored_non_selectable">
                    {tCommon('badges.authoredNonSelectable')}
                  </EvidenceBadge>
                )}
                {detail.procedureStatusByCode[slot.procedureCode] ? (
                  <EvidenceBadge state="draft_procedure">
                    {detail.procedureStatusByCode[slot.procedureCode]}
                  </EvidenceBadge>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3" aria-label={t('compatibilityHeading')}>
        <h2 className="text-2xl font-semibold tracking-tight">{t('compatibilityHeading')}</h2>
        {product.compatibility_text ? (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-5">
              <p className="text-sm leading-6 text-foreground">{product.compatibility_text}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t('compatibilitySource')}{' '}
                <span className="font-mono">
                  {product.primary_source_id ?? tCommon('notRecorded')}
                </span>
              </p>
            </CardContent>
          </Card>
        ) : detail.compatibilityTextWithheld ? (
          // C-03: the record carries a free-text compatibility note, but it names a product
          // outside the D1 cohort, so the server view model withheld it. Say so honestly
          // rather than pretending no note exists.
          <Card className="border-border/70">
            <CardContent className="p-5">
              <p className="text-sm italic leading-6 text-muted-foreground">
                {tCommon('compatibilityWithheldNote')}
              </p>
            </CardContent>
          </Card>
        ) : null}
        {detail.typedRuleConditions.length > 0 ? (
          <ul className="space-y-2">
            {detail.typedRuleConditions.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-border/70 p-3 text-sm">
                <p className="font-mono text-xs text-muted-foreground">{rule.id}</p>
                <p className="mt-1">
                  {rule.sourceRoleCode}.{rule.sourceAttribute} {rule.operator}{' '}
                  {rule.targetRoleCode
                    ? `${rule.targetRoleCode}.${rule.targetAttribute}`
                    : String(rule.unit ?? '')}
                  {rule.unit ? ` (${rule.unit})` : null}
                </p>
                <p className="mt-1 text-muted-foreground">{rule.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('ruleConditionNote')}</p>
              </li>
            ))}
          </ul>
        ) : null}
        {detail.rawCompatibilityStatements.length > 0 ? (
          <ul className="space-y-2">
            {detail.rawCompatibilityStatements.map((statement) => (
              <li key={statement.ruleId} className="rounded-xl border border-border/70 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs text-muted-foreground">{statement.ruleId}</p>
                  {!statement.withheld && statement.unresolved ? (
                    <EvidenceBadge state="unresolved_statement">
                      {tCommon('badges.unresolvedStatement')}
                    </EvidenceBadge>
                  ) : null}
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
                {statement.withheld ? (
                  // C-03: one referenced product is outside the public atlas cohort, so the
                  // statement text is withheld; provenance stays because it cannot identify
                  // the hidden product.
                  <p className="mt-1 text-xs italic text-muted-foreground">
                    {tCommon('compatibilityWithheldNote')}
                  </p>
                ) : (
                  <>
                    <p className="mt-1">
                      {statement.sourceText} — {statement.relationship ?? ''} —{' '}
                      {statement.targetText}
                    </p>
                    {statement.ruleText ? (
                      <p className="mt-1 text-muted-foreground">“{statement.ruleText}”</p>
                    ) : null}
                  </>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('rawStatementSource')}{' '}
                  <span className="font-mono">{statement.sourceId ?? tCommon('notRecorded')}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {!product.compatibility_text &&
        !detail.compatibilityTextWithheld &&
        detail.typedRuleConditions.length === 0 &&
        detail.rawCompatibilityStatements.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">{t('noCompatibilityData')}</p>
        ) : null}
      </section>

      <section className="space-y-3" aria-label={t('sourcesHeading')}>
        <h2 className="text-2xl font-semibold tracking-tight">{t('sourcesHeading')}</h2>
        {detail.sources.length > 0 ? (
          <Card>
            <CardContent className="p-5">
              <ul className="space-y-3">
                {detail.sources.map((source) => (
                  <li
                    key={`${source.sourceId}-${source.sourceLocation ?? ''}`}
                    className="border-b border-border/50 pb-3 text-sm last:border-0 last:pb-0"
                  >
                    <p className="font-medium text-foreground">{source.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        source.sourceId,
                        source.publisher,
                        source.sourceLocation,
                        source.revisionDate,
                        source.asOfDate,
                        source.reliabilityTier,
                        source.claimType,
                        source.verificationStatus,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm italic text-muted-foreground">{t('noSources')}</p>
        )}
      </section>

      {detail.sameManufacturerLine.length > 0 ? (
        <section className="space-y-3" aria-label={t('sameLineHeading')}>
          <h2 className="text-2xl font-semibold tracking-tight">{t('sameLineHeading')}</h2>
          <p className="text-sm text-muted-foreground">{t('displayOnlyGroupingNote')}</p>
          <ul className="flex flex-wrap gap-2">
            {detail.sameManufacturerLine.map((sibling) => (
              <li key={sibling.productId}>
                <Link
                  href={`/${locale}/devices/${sibling.productId}` as Route}
                  className="inline-block rounded-xl border border-border px-3 py-2 text-sm transition hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-medium">{sibling.productName}</span>
                  {sibling.sizeDisplay ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {sibling.sizeDisplay}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.otherManufacturers.length > 0 ? (
        <section className="space-y-3" aria-label={t('otherManufacturersHeading')}>
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('otherManufacturersHeading')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('roleDiscoveryCaption')}</p>
          {/* Owner-review F-18: the honest selection rule and denominators, so a tidy card
              grid cannot be read as "the alternatives". */}
          <p className="text-sm text-muted-foreground">
            {t('otherManufacturersSelectionNote', {
              shown: detail.otherManufacturers.length,
              manufacturerCount: detail.otherManufacturersTotalManufacturers,
              productCount: detail.otherManufacturersTotalProducts,
            })}{' '}
            {detail.primaryRole ? (
              <Link
                href={
                  `/${locale}/clinical-roles/${encodeURIComponent(detail.primaryRole.roleCode)}` as Route
                }
                className="font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t('otherManufacturersViewRole')}
              </Link>
            ) : null}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {detail.otherManufacturers.map((item) => (
              <Link
                key={item.productId}
                href={`/${locale}/devices/${item.productId}` as Route}
                className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition hover:border-primary hover:shadow-sm">
                  <CardContent className="space-y-1.5 p-4">
                    <p className="text-xs font-semibold text-primary">{item.manufacturerDisplay}</p>
                    <p className="font-medium text-foreground">{item.productName}</p>
                    {item.sizeDisplay ? (
                      <p className="text-xs text-muted-foreground">{item.sizeDisplay}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
      </p>
    </div>
  )
}
