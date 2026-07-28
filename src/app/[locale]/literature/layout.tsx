import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

import { Badge } from '@/components/ui/badge'
import { requireLiteratureSiteAdminPage } from '@/features/literature/server/access'
import { isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { Link } from '@/i18n/navigation'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

interface LiteratureLayoutProps {
  children: ReactNode
  params: Promise<{ locale: string }>
}

function resolveLocale(locale: string): ActiveLocale {
  return isActiveLocale(locale) ? locale : 'en'
}

export default async function LiteratureLayout({ children, params }: LiteratureLayoutProps) {
  const { locale: rawLocale } = await params
  const locale = resolveLocale(rawLocale)
  setRequestLocale(locale)
  await requireLiteratureSiteAdminPage(locale, '/literature')
  const t = await getTranslations('literature')

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/35 via-background to-background">
      <header className="border-b border-border/70 bg-background/90">
        <div className="container flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/literature"
              className="text-lg font-semibold tracking-tight hover:text-primary"
            >
              {t('title')}
            </Link>
            <Badge variant="outline">{t('draftBadge')}</Badge>
          </div>
          <nav
            aria-label={t('navigation.label')}
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium"
          >
            <Link href="/literature" className="hover:text-primary">
              {t('navigation.search')}
            </Link>
            <Link href="/literature/methods" className="hover:text-primary">
              {t('navigation.methods')}
            </Link>
            <Link href="/admin/literature" className="hover:text-primary">
              {t('navigation.review')}
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
