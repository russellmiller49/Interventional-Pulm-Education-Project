import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProductFamilyTable } from '@/features/preference-cards/components/ProductFamilyTable'
import { RoleComparisonTable } from '@/features/preference-cards/components/RoleComparisonTable'
import { VerificationLegend } from '@/features/preference-cards/components/VerificationBadge'
import { getUseDetail, specColumnPriority } from '@/features/preference-cards/server/catalog'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; roleCode: string }>
  searchParams?: Promise<{ view?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, roleCode } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards.catalog' })
  const detail = getUseDetail(decodeURIComponent(roleCode))
  return {
    title: detail
      ? `${detail.role.role_name} — ${t('uses.metadataTitle')}`
      : t('uses.metadataTitle'),
    description: detail?.role.description ?? t('uses.metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function CatalogUseDetailPage({ params, searchParams }: PageProps) {
  const { locale, roleCode } = await params
  const showAllVariants = (await searchParams)?.view === 'all'
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards.catalog')

  const detail = getUseDetail(decodeURIComponent(roleCode))
  if (!detail) notFound()

  const specLabels = Object.fromEntries(
    specColumnPriority.map((key) => [key, t(`specs.${key}` as 'specs.diameter_mm')]),
  ) as Record<(typeof specColumnPriority)[number], string>

  const verificationLabels = {
    verified: t('verification.verified'),
    candidate: t('verification.candidate'),
    unknown: t('verification.unknown'),
    usPending: t('verification.usPending'),
    notDistributed: t('verification.notDistributed'),
    legendTitle: t('verification.legendTitle'),
    verifiedHelp: t('verification.verifiedHelp'),
    candidateHelp: t('verification.candidateHelp'),
    usPendingHelp: t('verification.usPendingHelp'),
    notDistributedHelp: t('verification.notDistributedHelp'),
  }

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/preference-cards/catalog/uses` as Route}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t('uses.backToUses')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-4">
        <p className="font-mono text-xs text-muted-foreground">{detail.role.role_code}</p>
        <h1 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {detail.role.role_name}
        </h1>
        {detail.role.description ? (
          <p className="text-base leading-7 text-muted-foreground">{detail.role.description}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" size="lg" className="normal-case tracking-normal">
            {t('uses.countsLine', {
              products: detail.totalProducts,
              manufacturers: detail.manufacturerGroups.length,
              unverified: detail.totalProducts - detail.verifiedCount,
            })}
          </Badge>
          {detail.role.category ? (
            <Badge variant="outline" size="lg" className="normal-case tracking-normal">
              {detail.role.category}
            </Badge>
          ) : null}
        </div>
      </header>

      {detail.role.selection_guidance ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
              {t('uses.selectionGuidance')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {detail.role.selection_guidance}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {detail.procedures.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('uses.usedInProcedures')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {detail.procedures.map((procedure) => (
              <Link
                key={`${procedure.procedureCode}-${procedure.slotLabel}`}
                href={
                  `/${locale}/preference-cards/catalog/uses?procedure=${encodeURIComponent(procedure.procedureCode)}` as Route
                }
                className="rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary"
              >
                {procedure.procedureName}
                <span className="ml-1.5 text-muted-foreground">
                  ·{' '}
                  {t(`uses.requiredness.${procedure.requiredness}` as 'uses.requiredness.required')}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{t('uses.comparisonHeading')}</h2>
          {detail.totalProducts > detail.families.length ? (
            <Link
              href={
                `/${locale}/preference-cards/catalog/uses/${encodeURIComponent(detail.role.role_code)}${showAllVariants ? '' : '?view=all'}` as Route
              }
              className="text-sm font-medium text-primary hover:underline"
            >
              {showAllVariants
                ? t('uses.groupByFamily', { families: detail.families.length })
                : t('uses.showEveryVariant', { count: detail.totalProducts })}
            </Link>
          ) : null}
        </div>
        {detail.totalProducts > 0 && !showAllVariants ? (
          <ProductFamilyTable
            families={detail.families}
            variantCounts={Object.fromEntries(
              detail.families.map((family) => [
                family.familyKey,
                t('uses.variantCount', { count: family.variants.length }),
              ]),
            )}
            specLabels={specLabels}
            locale={locale}
            labels={{
              family: t('uses.family'),
              sizes: t('uses.sizes'),
              showSizes: t('uses.showSizes'),
              product: t('columns.product'),
              catalogNumber: t('columns.catalogNumber'),
              size: t('columns.size'),
              verification: t('columns.verification'),
              missingValue: t('missingValue'),
              verified: t('verification.verified'),
              candidate: t('verification.candidate'),
              unknown: t('verification.unknown'),
              usPending: t('verification.usPending'),
              notDistributed: t('verification.notDistributed'),
            }}
          />
        ) : detail.totalProducts > 0 ? (
          <RoleComparisonTable
            groups={detail.manufacturerGroups}
            specColumns={detail.specColumns}
            specLabels={specLabels}
            locale={locale}
            groupSummaries={Object.fromEntries(
              detail.manufacturerGroups.map((group) => [
                group.manufacturerGroupId,
                t('uses.manufacturerProducts', {
                  count: group.items.length,
                  verified: group.verifiedCount,
                }),
              ]),
            )}
            labels={{
              product: t('columns.product'),
              catalogNumber: t('columns.catalogNumber'),
              size: t('columns.size'),
              fit: t('columns.fit'),
              verification: t('columns.verification'),
              missingValue: t('missingValue'),
              verified: t('verification.verified'),
              candidate: t('verification.candidate'),
              unknown: t('verification.unknown'),
              usPending: t('verification.usPending'),
              notDistributed: t('verification.notDistributed'),
            }}
          />
        ) : (
          <Card className="border-dashed bg-muted/30">
            <CardContent className="p-8 text-center">
              <h3 className="font-semibold">{t('uses.emptyRoleTitle')}</h3>
              <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
                {t('uses.emptyRoleBody')}
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      <VerificationLegend labels={verificationLabels} />

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('uses.fitNote')} {t('dataLanguageNote')} {t('disclaimer')}
      </p>
    </div>
  )
}
