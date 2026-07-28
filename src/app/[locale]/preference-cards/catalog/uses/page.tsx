import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { getCatalogFacets, getUseIndex } from '@/features/preference-cards/server/catalog'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
  searchParams?: Promise<{ procedure?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards.catalog' })
  return {
    title: t('uses.metadataTitle'),
    description: t('uses.metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function CatalogUsesPage({ params, searchParams }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards.catalog')

  const facets = getCatalogFacets()
  const requestedProcedure = (await searchParams)?.procedure
  const procedure = facets.procedures.find((entry) => entry.code === requestedProcedure)
  const groups = getUseIndex(procedure ? { procedureCode: procedure.code } : {})

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <header className="max-w-4xl space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
          {t('uses.heading')}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{t('uses.description')}</p>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/preference-cards/catalog` as Route}>
            <Search aria-hidden="true" className="h-4 w-4" />
            {t('uses.searchAllProducts')}
          </Link>
        </Button>
      </header>

      <section aria-label={t('uses.filterByProcedure')} className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t('uses.filterByProcedure')}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${locale}/preference-cards/catalog/uses` as Route}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition',
              procedure
                ? 'border-border hover:border-primary hover:text-primary'
                : 'border-primary bg-primary/10 text-primary',
            )}
          >
            {t('uses.allProcedures')}
          </Link>
          {facets.procedures.map((entry) => (
            <Link
              key={entry.code}
              href={
                `/${locale}/preference-cards/catalog/uses?procedure=${encodeURIComponent(entry.code)}` as Route
              }
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                procedure?.code === entry.code
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary hover:text-primary',
              )}
            >
              {entry.name}
            </Link>
          ))}
        </div>
      </section>

      {groups.map((group) => (
        <section key={group.category} className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {procedure ? procedure.name : group.category}
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.entries.map((entry) => {
              const isEmpty = entry.productCount === 0
              const card = (
                <Card
                  className={cn(
                    'h-full transition',
                    isEmpty ? 'border-dashed bg-muted/20' : 'hover:border-primary hover:shadow-sm',
                  )}
                >
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-foreground">{entry.roleName}</span>
                      {entry.requiredness ? (
                        <Badge
                          variant={entry.requiredness === 'required' ? 'default' : 'outline'}
                          size="sm"
                          className="shrink-0 normal-case tracking-normal"
                        >
                          {t(
                            `uses.requiredness.${entry.requiredness}` as 'uses.requiredness.required',
                          )}
                        </Badge>
                      ) : null}
                    </div>
                    {entry.slotLabel && entry.slotLabel !== entry.roleName ? (
                      <p className="text-xs text-muted-foreground">{entry.slotLabel}</p>
                    ) : null}
                    <p className="font-mono text-[11px] text-muted-foreground">{entry.roleCode}</p>
                    {isEmpty ? (
                      <p className="text-xs text-muted-foreground">{t('uses.emptyRole')}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t('uses.countsLine', {
                          products: entry.productCount,
                          manufacturers: entry.manufacturerCount,
                          unverified: entry.productCount - entry.verifiedCount,
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )

              return isEmpty ? (
                <div key={entry.roleCode}>{card}</div>
              ) : (
                <Link
                  key={entry.roleCode}
                  href={
                    `/${locale}/preference-cards/catalog/uses/${encodeURIComponent(entry.roleCode)}` as Route
                  }
                  className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {card}
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('dataLanguageNote')} {t('disclaimer')}
      </p>
    </div>
  )
}
