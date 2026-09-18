import type { Metadata, Route } from 'next'
import { SaveDeviceButton } from '@/features/device-intelligence/components/SavedDevicesProvider'
import { PhysicianReviewPanel } from '@/features/device-intelligence/components/PhysicianReviewPanel'
import { MarketEvidencePanel } from '@/features/device-intelligence/components/MarketEvidencePanel'
import { getPhysicianProductReview } from '@/features/device-intelligence/server/physician-review.server'
import {
  getCompareLabels,
  getSaveDeviceLabels,
} from '@/features/device-intelligence/server/reference-labels.server'
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
  D2dEnrichmentStatusCard,
  ProductProfilePanel,
  RegulatoryEvidencePanel,
} from '@/features/device-intelligence/components/D2dEvidencePanels'
import {
  MarketSafetyPanel,
  ProductStatusBadges,
} from '@/features/device-intelligence/components/ProductStatus'
import { AtlasResultsTable } from '@/features/device-intelligence/components/AtlasResultsTable'
import { CompareButton } from '@/features/device-intelligence/components/CompareSelection'
import {
  deviceDetailHref,
  parseReturnContext,
  returnToResultsHref,
} from '@/features/device-intelligence/domain/atlas-query'
import {
  ATLAS_SPEC_FIELDS,
  modelSpecSummary,
  type AtlasSpecFieldKey,
} from '@/features/device-intelligence/domain/device-display-config'
import { statusNeedsAttention } from '@/features/device-intelligence/domain/product-status'
import { PRODUCT_ID_PATTERN } from '@/features/device-intelligence/domain/atlas-cohort'
import { isExemplarProcedureCode } from '@/features/device-intelligence/domain/exemplars'
import { getAtlasProductDetail } from '@/features/device-intelligence/server/atlas.server'
import { getD2dEvidenceLabels } from '@/features/device-intelligence/server/d2d-labels.server'
import { getTaxonomyLabels } from '@/features/device-intelligence/server/product-taxonomy.server'
import { getProductStatusLabels } from '@/features/device-intelligence/server/status-labels.server'
import { getSafetyEvidence } from '@/features/device-intelligence/server/safety-evidence.server'
import { safetyEvidenceFreshness } from '@/features/device-intelligence/domain/evidence-freshness'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; productId: string }>
  searchParams?: Promise<{ from?: string | string[] }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, productId } = await params
  const t = await getTranslations({ locale, namespace: 'deviceIntelligence.device' })
  const detail = PRODUCT_ID_PATTERN.test(productId) ? getAtlasProductDetail(productId) : null
  return {
    title: detail
      ? `${detail.product.product_name} — ${detail.product.manufacturerDisplay}`
      : t('notFound'),
    description: detail?.publicDescription?.text ?? t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function DeviceDetailPage({ params, searchParams }: PageProps) {
  const { locale, productId } = await params
  setRequestLocale(locale)
  // The search this page was opened from, validated back into a canonical atlas query. It is
  // never used as a URL itself, so a hostile value can only ever produce "no context".
  const returnContext = parseReturnContext((await searchParams)?.from)
  const t = await getTranslations('deviceIntelligence.device')
  const tDevices = await getTranslations('deviceIntelligence.devices')
  const tCommon = await getTranslations('deviceIntelligence.common')
  const tReference = await getTranslations('deviceIntelligence.reference')
  const tReview = await getTranslations('deviceIntelligence.physicianReview')
  const tMarketEvidence = await getTranslations('deviceIntelligence.marketEvidence')
  const tVerification = await getTranslations('preferenceCards.catalog.verification')

  if (!PRODUCT_ID_PATTERN.test(productId)) notFound()
  const detail = getAtlasProductDetail(productId)
  if (!detail) notFound()
  const { product } = detail
  const physicianReview = getPhysicianProductReview(productId)
  const safetyEvidence = getSafetyEvidence(productId)
  const safetyFreshness = safetyEvidenceFreshness(
    safetyEvidence,
    new Date().toISOString().slice(0, 10),
  )
  const d2dLabels = await getD2dEvidenceLabels(locale)
  const statusLabels = await getProductStatusLabels(locale)
  const taxonomyLabels = getTaxonomyLabels(locale)
  const deviceClassLabel = taxonomyLabels.classes[detail.taxonomy.deviceClassCode]
  const deviceSubtypeLabel = taxonomyLabels.subtypes[detail.taxonomy.deviceSubtypeCode]

  const verificationLabels = {
    verified: tCommon('badges.verifiedSource'),
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
    {
      label: t('fields.gtin'),
      value:
        (product.gtin ??
          physicianReview?.udi_records
            .filter((record) => record.scope === 'exact')
            .map((record) => `${record.primary_di} (${record.model})`)
            .join('; ')) ||
        null,
      mono: true,
    },
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

  const compareLabels = await getCompareLabels(locale)
  const saveLabels = await getSaveDeviceLabels(locale)
  // Category-aware key specifications: the recorded columns the display config lists for
  // this device class, in its order. Only recorded values appear; nothing is derived.
  const keySpecs = modelSpecSummary(detail.taxonomy.deviceClassCode, detail.specs, 6)
  const specLabels = Object.fromEntries(
    (Object.keys(ATLAS_SPEC_FIELDS) as AtlasSpecFieldKey[]).map((key) => [
      key,
      tDevices(`specs.${key}`),
    ]),
  )
  // Placement only: a matched safety action or a lifecycle question lifts the full status
  // panel above the routine evidence. It is never collapsed and never removed.
  const statusFirst = statusNeedsAttention(detail.status)
  const statusPanel = (
    <MarketSafetyPanel
      status={detail.status}
      labels={statusLabels}
      evidence={safetyEvidence}
      freshness={safetyFreshness}
    />
  )
  const reviewedConfiguration =
    detail.profile?.runtime_state === 'reviewed' ? detail.profile.exact_configuration_summary : null
  // The catalog's minimum-working-channel column is a TOOL requirement. On a bronchoscope
  // record the same column holds the scope's own channel, so it is not restated here.
  const recordedMinChannel =
    detail.taxonomy.deviceClassCode !== 'bronchoscope' ? product.min_working_channel_mm : null
  const hasConfigurationData =
    Boolean(reviewedConfiguration) ||
    Boolean(product.compatibility_text) ||
    detail.compatibilityTextWithheld ||
    recordedMinChannel !== null ||
    detail.typedRuleConditions.length > 0 ||
    detail.rawCompatibilityStatements.length > 0
  const sectionLinks = [
    { href: '#device-overview', label: t('sections.overview') },
    { href: '#device-specifications', label: t('sections.specifications') },
    { href: '#device-configuration', label: t('sections.configuration') },
    { href: '#device-safety', label: t('sections.safety') },
    { href: '#device-sources', label: t('sections.sources') },
  ]

  return (
    <div className="container space-y-8 py-8 md:py-10">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={returnToResultsHref(locale, returnContext) as Route} data-back-to-results>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {returnContext ? t('backToResults') : t('back')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-4">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-primary">{product.manufacturerDisplay}</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
            {product.product_name}
          </h1>
          {/* D2C: the normalized physical taxonomy is the primary product-type answer, stated
              in words rather than badges. Canonical category fields live in the labeled
              provenance area below. */}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {`${t('taxonomy.subtypeLabel')}: ${deviceSubtypeLabel}`}
            </span>
            <span>{`${t('taxonomy.classLabel')}: ${deviceClassLabel}`}</span>
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {product.catalog_number ? (
              <span>
                {t('fields.catalogNumber')}:{' '}
                <span className="font-mono text-foreground">{product.catalog_number}</span>
              </span>
            ) : null}
            {product.size_display ? <span>{product.size_display}</span> : null}
          </p>
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
        {detail.publicDescription ? (
          <div className="space-y-1" data-description-origin={detail.publicDescription.origin}>
            <p lang="en" className="text-base leading-7 text-muted-foreground">
              {detail.publicDescription.text}
            </p>
            {detail.publicDescription.origin === 'reviewed' ? (
              <a
                href="#d2d-profile-heading"
                className="text-xs font-medium text-primary underline underline-offset-2"
              >
                {d2dLabels.profile.heading} ·{' '}
                {d2dLabels.profile.scope[detail.profile!.description_scope]} ·{' '}
                {detail.profile!.as_of_date}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">{t('catalogDescriptionLabel')}</p>
            )}
          </div>
        ) : null}

        {keySpecs.length > 0 ? (
          <div data-key-specs>
            <h2
              id="device-key-specs-heading"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {t('keySpecsHeading')}
            </h2>
            <dl className="mt-2 grid gap-x-8 gap-y-2 rounded-2xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
              {keySpecs.map((entry) => (
                <div key={entry.key}>
                  <dt className="text-xs text-muted-foreground">{specLabels[entry.key]}</dt>
                  <dd className="text-base font-semibold [overflow-wrap:anywhere]">
                    {entry.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <VerificationBadge
            tier={product.verificationTier}
            usStatusPending={product.usStatusPending && !detail.status.researched}
            distributionStatus={detail.status.researched ? null : detail.distributionStatus}
            catalogLifecycleContext={product.catalogLifecycleContext}
            lifecycleNote={product.lifecycleNote}
            regulatoryStatus={product.regulatoryStatus}
            regulatoryNote={product.regulatoryNote}
            labels={verificationLabels}
          />
          {/* D2B: compact market/safety marks in the header; the full statement, its
              snapshot date, and the required disclaimers live in the status panel. */}
          <ProductStatusBadges status={detail.status} labels={statusLabels} />
          {detail.status.safetyReferenceCodes.length > 0 ? (
            <a
              href="#device-safety"
              className="text-xs font-semibold text-primary underline underline-offset-2"
            >
              {t('reviewSafetyNotices')}
            </a>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SaveDeviceButton
            productId={product.product_id}
            productName={product.product_name}
            catalogNumber={product.catalog_number}
            labels={saveLabels}
          />
          <CompareButton
            productId={product.product_id}
            productName={product.product_name}
            catalogNumber={product.catalog_number}
            labels={compareLabels}
          />
          {detail.sameManufacturerLine.length > 0 ? (
            <a
              href="#device-other-models"
              className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('otherModelsAction', { count: detail.sameManufacturerLine.length })}
            </a>
          ) : null}
          <Link
            href={`/${locale}/devices/saved` as Route}
            className="inline-flex min-h-11 items-center px-1 text-sm underline underline-offset-2"
          >
            {tReference('savedDevices')}
          </Link>
        </div>
      </header>

      {statusFirst ? statusPanel : null}

      <nav
        aria-label={t('sectionNavLabel')}
        className="-mx-1 overflow-x-auto border-y border-border/70 bg-background/95 px-1 py-1 backdrop-blur print:hidden lg:sticky lg:top-16 lg:z-20"
      >
        <ul className="flex min-w-max gap-1 text-sm font-medium">
          {sectionLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div id="device-overview" className="scroll-mt-32 space-y-8">
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
      </div>

      <div id="device-specifications" className="scroll-mt-32 space-y-8">
        {/* Owner-review F-16: present facts render as rows; absent fields collapse into one
            honest sentence per card that still names every unrecorded field. */}
        <div className="grid gap-6 lg:grid-cols-2">
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
        </div>

        {detail.profile ? (
          <ProductProfilePanel
            profile={detail.profile}
            labels={d2dLabels}
            showEnglishContentNotice={locale !== 'en'}
          />
        ) : null}

        {detail.sameManufacturerLine.length > 0 ? (
          <section
            id="device-other-models"
            className="scroll-mt-32 space-y-3"
            aria-label={t('sameLineHeading')}
          >
            <h2 className="text-2xl font-semibold tracking-tight">{t('sameLineHeading')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('otherModelsNote')} {t('displayOnlyGroupingNote')}
            </p>
            {/* Same line AND same normalized subtype (see `getAtlasProductDetail`). Each row
                carries that model's own recorded specs and its own status. */}
            <AtlasResultsTable
              locale={locale}
              idPrefix="other-models"
              hideLineColumns
              items={detail.sameManufacturerLine}
              statusByProductId={Object.fromEntries(
                detail.sameManufacturerLine.map((sibling) => [sibling.productId, sibling.status]),
              )}
              deviceTypeByProductId={{}}
              statusLabels={statusLabels}
              compareLabels={compareLabels}
              specLabels={specLabels}
              specSummaryByProductId={Object.fromEntries(
                detail.sameManufacturerLine.map((sibling) => [
                  sibling.productId,
                  modelSpecSummary(detail.taxonomy.deviceClassCode, sibling.specs),
                ]),
              )}
              returnContext={returnContext}
              labels={{
                product: tDevices('table.product'),
                manufacturer: tDevices('table.manufacturer'),
                deviceType: tDevices('table.deviceType'),
                catalogNumber: tDevices('table.catalogNumber'),
                size: tDevices('table.size'),
                keySpecs: tDevices('table.keySpecs'),
                status: tDevices('table.status'),
                notRecorded: tCommon('notRecorded'),
                region: t('otherModelsRegionLabel'),
                exactMatch: tDevices('exactIdentifierMatch'),
                asOf: tDevices('statusAsOf'),
              }}
            />
          </section>
        ) : null}
      </div>

      <section
        id="device-configuration"
        className="scroll-mt-32 space-y-3"
        aria-label={t('compatibilityHeading')}
      >
        <h2 className="text-2xl font-semibold tracking-tight">{t('compatibilityHeading')}</h2>
        {reviewedConfiguration ? (
          // The reviewed, human-readable statement leads. It is quoted, never paraphrased.
          <Card data-reviewed-configuration>
            <CardContent className="space-y-1.5 p-5">
              <h3 className="text-sm font-bold tracking-tight">
                {t('reviewedConfigurationHeading')}
              </h3>
              <p lang="en" className="text-sm leading-6 text-foreground">
                {reviewedConfiguration.text}
              </p>
              <a
                href="#d2d-profile-heading"
                className="inline-block text-xs font-medium text-primary underline underline-offset-2"
              >
                {d2dLabels.profile.heading} · {detail.profile!.as_of_date}
              </a>
            </CardContent>
          </Card>
        ) : null}
        {recordedMinChannel !== null ? (
          <Card data-recorded-min-channel>
            <CardContent className="space-y-1 p-5">
              <p className="text-sm leading-6">
                {t('recordedMinChannel', { value: recordedMinChannel })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('compatibilitySource')}{' '}
                <span className="font-mono">
                  {product.primary_source_id ?? tCommon('notRecorded')}
                </span>
                {' · '}
                {t('recordedValueBoundary')}
              </p>
            </CardContent>
          </Card>
        ) : null}
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
              // The authored message leads; the internal rule id and expression stay
              // available, one disclosure away, exactly as recorded.
              <li key={rule.id} className="rounded-xl border border-border/70 p-3 text-sm">
                <p>{rule.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t('ruleConditionNote')}</p>
                <details className="mt-1">
                  <summary className="cursor-pointer rounded text-xs font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t('ruleDetails')}
                  </summary>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{rule.id}</p>
                  <p className="mt-1 font-mono text-xs">
                    {rule.sourceRoleCode}.{rule.sourceAttribute} {rule.operator}{' '}
                    {rule.targetRoleCode
                      ? `${rule.targetRoleCode}.${rule.targetAttribute}`
                      : String(rule.unit ?? '')}
                    {rule.unit ? ` (${rule.unit})` : null}
                  </p>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
        {detail.rawCompatibilityStatements.length > 0 ? (
          <ul className="space-y-2">
            {detail.rawCompatibilityStatements.map((statement) => (
              <li key={statement.ruleId} className="rounded-xl border border-border/70 p-3 text-sm">
                {statement.withheld ? (
                  // C-03: one referenced product is outside the public atlas cohort, so the
                  // statement text is withheld; provenance stays because it cannot identify
                  // the hidden product.
                  <p className="text-xs italic text-muted-foreground">
                    {tCommon('compatibilityWithheldNote')}
                  </p>
                ) : (
                  <>
                    <p>
                      {statement.sourceText} — {statement.relationship ?? ''} —{' '}
                      {statement.targetText}
                    </p>
                    {statement.ruleText ? (
                      <p className="mt-1 text-muted-foreground">“{statement.ruleText}”</p>
                    ) : null}
                  </>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  <span className="text-xs text-muted-foreground">
                    {t('rawStatementSource')}{' '}
                    <span className="font-mono">
                      {statement.sourceId ?? tCommon('notRecorded')}
                    </span>
                    {' · '}
                    <span className="font-mono">{statement.ruleId}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {!hasConfigurationData ? (
          <p className="text-sm italic text-muted-foreground">{t('noCompatibilityData')}</p>
        ) : null}
      </section>

      {statusFirst ? null : statusPanel}

      <MarketEvidencePanel productId={productId} translate={tMarketEvidence} />

      <PhysicianReviewPanel productId={productId} translate={tReview} />

      {detail.regulatoryEvidence ? (
        <RegulatoryEvidencePanel evidence={detail.regulatoryEvidence} labels={d2dLabels} />
      ) : null}

      {!detail.profile && !detail.regulatoryEvidence ? (
        <D2dEnrichmentStatusCard labels={d2dLabels} />
      ) : null}

      <section
        id="device-sources"
        className="scroll-mt-32 space-y-3"
        aria-label={t('sourcesHeading')}
      >
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
                href={deviceDetailHref(locale, item.productId, returnContext) as Route}
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

      {/* D2C: the explicitly labeled provenance/debug area for the canonical catalog
          classification. Never the primary product type — that is the normalized class
          and subtype in the header. */}
      <section className="space-y-2" aria-label={t('provenanceHeading')}>
        <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
          {t('provenanceHeading')}
        </h2>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <dl className="grid gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-medium">{t('fields.sourcePrimaryCategory')}:</dt>
                <dd>{product.primary_category ?? tCommon('notRecorded')}</dd>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-medium">{t('fields.sourceSubcategory')}:</dt>
                <dd>{product.subcategory ?? tCommon('notRecorded')}</dd>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <dt className="font-medium">{t('fields.productKind')}:</dt>
                <dd>{product.product_kind ?? tCommon('notRecorded')}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('provenanceNote')}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t('taxonomy.discoveryNote')}
            </p>
          </CardContent>
        </Card>
      </section>

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {tCommon('unlistedNote')} {tCommon('noEquivalenceNote')}
      </p>
    </div>
  )
}
