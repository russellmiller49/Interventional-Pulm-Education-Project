import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Button } from '@/components/ui/button'
import { EquipmentSetManager } from '@/features/preference-cards/components/EquipmentSetManager'
import { getCatalogFacets } from '@/features/preference-cards/server/catalog'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'preferenceCards.sets' })
  return {
    title: t('metadataTitle'),
    description: t('metadataDescription'),
    robots: { index: false, follow: false, noarchive: true },
  }
}

export default async function EquipmentSetsPage({ params }: PageProps) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('preferenceCards.sets')
  const tCatalog = await getTranslations('preferenceCards.catalog')

  const facets = getCatalogFacets()

  return (
    <div className="container space-y-8 py-8 md:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/${locale}/preference-cards` as Route}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          {t('back')}
        </Link>
      </Button>

      <header className="max-w-4xl space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{t('eyebrow')}</p>
        <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
          {t('title')}
        </h1>
        <p className="text-base leading-7 text-muted-foreground">{t('subtitle')}</p>
      </header>

      <EquipmentSetManager
        roles={facets.roles}
        labels={{
          heading: t('heading'),
          description: t('description'),
          newSet: t('newSet'),
          setName: t('setName'),
          setNamePlaceholder: t('setNamePlaceholder'),
          setDescription: t('setDescription'),
          setDescriptionPlaceholder: t('setDescriptionPlaceholder'),
          members: t('members'),
          noMembers: t('noMembers'),
          addFor: t('addFor'),
          chooseRole: t('chooseRole'),
          coveredRoles: t('coveredRoles'),
          coveredRolesHelp: t('coveredRolesHelp'),
          alsoCovers: t('alsoCovers'),
          alsoCoversHelp: t('alsoCoversHelp'),
          save: t('save'),
          cancel: t('cancel'),
          edit: t('edit'),
          duplicate: t('duplicate'),
          remove: t('remove'),
          empty: t('empty'),
          emptyHelp: t('emptyHelp'),
          addMember: t('addMember'),
        }}
      />

      <p className="border-t border-border/70 pt-6 text-xs leading-5 text-muted-foreground">
        {t('storageNote')} {tCatalog('disclaimer')}
      </p>
    </div>
  )
}
