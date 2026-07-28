import type { Route } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'

export async function AdminPreferenceCardNav({ locale }: { locale: string }) {
  const t = await getTranslations('preferenceCards.admin')
  const links = [
    ['recipes', t('recipesLink')],
    ['formulary', t('formularyLink')],
    ['catalog-qa', t('catalogQaLink')],
  ] as const

  return (
    <nav aria-label={t('adminDescription')} className="flex flex-wrap gap-2">
      {links.map(([path, label]) => (
        <Button key={path} asChild variant="outline" size="sm">
          <Link href={`/${locale}/admin/preference-cards/${path}` as Route}>{label}</Link>
        </Button>
      ))}
    </nav>
  )
}
