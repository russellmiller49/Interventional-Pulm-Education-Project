import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VerificationBadge } from '@/features/preference-cards/components/VerificationBadge'
import { getProductDetail } from '@/features/preference-cards/server/catalog'
import { deviceIntelligenceEnabled } from '@/features/device-intelligence/feature'
import { getAtlasProductDetail } from '@/features/device-intelligence/server/atlas.server'

export const dynamic = 'force-dynamic'

const PRODUCT_ID_PATTERN = /^PRD-[A-Z0-9]{6,20}$/

interface PageProps {
  params: Promise<{ locale: string; productId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, productId } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards.catalog' })
  const detail = PRODUCT_ID_PATTERN.test(productId) ? getProductDetail(productId) : null
  return {
    title: detail
      ? `${detail.product.product_name} — ${detail.product.manufacturerDisplay}`
      : t('product.notFound'),
    description: detail?.product.description ?? t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

function DefinitionRow({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-56 sm:shrink-0">{term}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function prettifySpecKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export default async function CatalogProductPage({ params }: PageProps) {
  const { locale, productId } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards.catalog')
  const tCrossLinks = await getTranslations('deviceIntelligence.common.crossLinks')

  if (!PRODUCT_ID_PATTERN.test(productId)) notFound()
  const detail = getProductDetail(productId)
  if (!detail) notFound()

  // Cross-link to the D1 atlas only when the feature is on AND the product is inside the
  // D1-visible cohort; nothing else about this preserved page changes.
  const atlasVisible = deviceIntelligenceEnabled() && getAtlasProductDetail(productId) !== null

  const { product } = detail
  const verificationLabels = {
    verified: t('verification.verified'),
    candidate: t('verification.candidate'),
    unknown: t('verification.unknown'),
    usPending: t('verification.usPending'),
    notDistributed: t('verification.notDistributed'),
    conflictingDistribution: t('verification.conflictingDistribution'),
    legacyInstalledBase: t('verification.legacyInstalledBase'),
    legacyInstalledBaseHelp: t('verification.legacyInstalledBaseHelp'),
    regulatoryCleared510k: t('verification.regulatoryCleared510k'),
    regulatoryApprovedPma: t('verification.regulatoryApprovedPma'),
    regulatoryGrantedDeNovo: t('verification.regulatoryGrantedDeNovo'),
    regulatoryBreakthroughInvestigational: t('verification.regulatoryBreakthroughInvestigational'),
    regulatoryBreakthroughPremarketReview: t('verification.regulatoryBreakthroughPremarketReview'),
    regulatoryNotUsAuthorized: t('verification.regulatoryNotUsAuthorized'),
    regulatoryHelp: t('verification.regulatoryHelp'),
  }

  const identifiers: { label: string; value: string | null }[] = [
    { label: t('product.catalogNumber'), value: product.catalog_number },
    { label: t('product.gtin'), value: product.gtin },
    { label: t('product.globalPartNumber'), value: product.global_part_number },
    { label: t('product.referencePartNumber'), value: product.reference_part_number },
    { label: t('product.alternateIds'), value: product.alternate_ids },
    { label: t('product.packageUom'), value: product.package_uom },
  ]

  const specs: { label: string; value: string | number | null }[] = [
    { label: t('specs.diameter_mm'), value: product.diameter_mm },
    { label: t('specs.length_mm'), value: product.length_mm },
    { label: t('specs.french_size'), value: product.french_size },
    { label: t('specs.gauge'), value: product.gauge },
    { label: t('specs.working_length_cm'), value: product.working_length_cm },
    { label: t('specs.min_working_channel_mm'), value: product.min_working_channel_mm },
    { label: t('specs.delivery_system_od_mm'), value: product.delivery_system_od_mm },
    { label: t('specs.material'), value: product.material },
    { label: t('specs.coverage'), value: product.coverage },
    { label: t('product.placementMethod'), value: product.placement_method },
    { label: t('product.sizeDisplay'), value: product.size_display },
    { label: t('product.adultPeds'), value: product.adult_peds },
  ]
  const extraSpecs = Object.entries(product.spec_json ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  )

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${locale}/preference-cards/catalog` as Route}>
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            {t('product.back')}
          </Link>
        </Button>
        {atlasVisible ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/devices/${product.product_id}` as Route}>
              {tCrossLinks('atlasDevicePage')}
            </Link>
          </Button>
        ) : null}
      </div>

      <header className="max-w-4xl space-y-3">
        <p className="text-sm font-semibold text-primary">{product.manufacturerDisplay}</p>
        {product.manufacturer && product.manufacturer !== product.manufacturerDisplay ? (
          <p className="text-xs text-muted-foreground">
            {t('product.listedAs', { name: product.manufacturer })}
          </p>
        ) : null}
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {product.product_name}
        </h1>
        {product.brand_family ? (
          <p className="text-sm text-muted-foreground">{product.brand_family}</p>
        ) : null}
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
          {[
            product.product_kind,
            product.reuse_status,
            product.sterile_status,
            product.primary_category,
          ]
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
          {product.implantable ? (
            <Badge variant="secondary" size="sm" className="normal-case tracking-normal">
              {t('product.implantable')}
            </Badge>
          ) : null}
        </div>
        {product.description && product.description !== product.product_name ? (
          <p className="text-base leading-7 text-muted-foreground">{product.description}</p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-bold tracking-tight">{t('product.identifiers')}</h2>
            <dl className="mt-3">
              {identifiers
                .filter((row) => row.value)
                .map((row) => (
                  <DefinitionRow key={row.label} term={row.label}>
                    <span className="font-mono text-xs">{row.value}</span>
                  </DefinitionRow>
                ))}
              {product.gtin_raw && product.gtin_raw !== product.gtin ? (
                <DefinitionRow term={t('product.gtinRaw')}>
                  <span className="font-mono text-xs">{product.gtin_raw}</span>
                </DefinitionRow>
              ) : null}
              {product.distributor ? (
                <DefinitionRow term={t('product.distributor')}>{product.distributor}</DefinitionRow>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-bold tracking-tight">{t('product.specifications')}</h2>
            <dl className="mt-3">
              {specs
                .filter((row) => row.value !== null && row.value !== undefined && row.value !== '')
                .map((row) => (
                  <DefinitionRow key={row.label} term={row.label}>
                    {String(row.value)}
                  </DefinitionRow>
                ))}
              {extraSpecs.map(([key, value]) => (
                <DefinitionRow key={key} term={prettifySpecKey(key)}>
                  {String(value)}
                </DefinitionRow>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {detail.roles.length > 0 || detail.slots.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t('product.usesHeading')}</h2>
          <div className="flex flex-wrap gap-2">
            {detail.roles.map((role) => (
              <Link
                key={role.roleCode}
                href={
                  `/${locale}/preference-cards/catalog/uses/${encodeURIComponent(role.roleCode)}` as Route
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary"
              >
                {role.roleName}
                {role.roleFit ? (
                  <span className="ml-1.5 text-muted-foreground">· {role.roleFit}</span>
                ) : null}
              </Link>
            ))}
          </div>
          {detail.slots.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {detail.slots.map((slot) => (
                <li key={`${slot.procedureCode}-${slot.slotLabel}`}>
                  {slot.procedureName} › {slot.slotLabel} ·{' '}
                  {t(`uses.requiredness.${slot.requiredness}` as 'uses.requiredness.required')}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {product.compatibility_text ? (
        <section className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('product.compatibilityHeading')}
          </h2>
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-5">
              <p className="text-sm leading-6 text-foreground">{product.compatibility_text}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t('product.compatibilityDisclaimer')}
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t('product.sourcesHeading')}</h2>
        <Card>
          <CardContent className="space-y-4 p-5">
            <dl>
              <DefinitionRow term={t('product.verificationStatus')}>
                {product.verification_status ?? t('missingValue')}
              </DefinitionRow>
              {product.availability_note ? (
                <DefinitionRow term={t('product.availabilityNote')}>
                  {product.availability_note}
                </DefinitionRow>
              ) : null}
              {product.source_as_of ? (
                <DefinitionRow term={t('product.asOf')}>{product.source_as_of}</DefinitionRow>
              ) : null}
              {product.notes ? (
                <DefinitionRow term={t('product.notes')}>{product.notes}</DefinitionRow>
              ) : null}
            </dl>

            {detail.sources.length > 0 ? (
              <ul className="space-y-3 border-t border-border/50 pt-4">
                {detail.sources.map((source) => (
                  <li key={`${source.sourceId}-${source.sourceLocation ?? ''}`} className="text-sm">
                    <p className="font-medium text-foreground">{source.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        source.publisher,
                        source.filename,
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
                    {source.usePolicy ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {t('product.sourceUsePolicy')}:
                        </span>{' '}
                        {source.usePolicy}
                      </p>
                    ) : null}
                    {source.linkNotes || source.sourceNotes ? (
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {t('product.sourceNotes')}:
                        </span>{' '}
                        {[source.linkNotes, source.sourceNotes].filter(Boolean).join(' ')}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border/50 pt-4 text-sm text-muted-foreground">
                {t('product.noSources')}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {detail.otherManufacturers.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('product.otherManufacturers')}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {detail.otherManufacturers.map((item) => (
              <Link
                key={item.productId}
                href={`/${locale}/preference-cards/catalog/product/${item.productId}` as Route}
                className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition hover:border-primary hover:shadow-sm">
                  <CardContent className="space-y-1.5 p-4">
                    <p className="text-xs font-semibold text-primary">{item.manufacturerDisplay}</p>
                    <p className="font-medium text-foreground">{item.productName}</p>
                    {item.sizeDisplay ? (
                      <p className="text-xs text-muted-foreground">{item.sizeDisplay}</p>
                    ) : null}
                    <VerificationBadge
                      tier={item.verificationTier}
                      usStatusPending={item.usStatusPending}
                      distributionStatus={item.distributionStatus}
                      catalogLifecycleContext={item.catalogLifecycleContext}
                      lifecycleNote={item.lifecycleNote}
                      regulatoryStatus={item.regulatoryStatus}
                      regulatoryNote={item.regulatoryNote}
                      labels={verificationLabels}
                    />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('dataLanguageNote')} {t('disclaimer')}
      </p>
    </div>
  )
}
