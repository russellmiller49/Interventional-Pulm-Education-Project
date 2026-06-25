'use client'

import type { Route } from 'next'
import { useLocale, useTranslations } from 'next-intl'
import { Globe2 } from 'lucide-react'

import { activeLocales, isActiveLocale, localeLabels, type ActiveLocale } from '@/i18n/locale'
import { usePathname, useRouter } from '@/i18n/navigation'
import { cn } from '@/lib/cn'
import { HandoffContent } from '@/i18n/handoff'

interface LanguageSelectorProps {
  className?: string
  compact?: boolean
}

export function LanguageSelector({ className, compact = false }: LanguageSelectorProps) {
  const locale = useLocale()
  const t = useTranslations('language')
  const pathname = usePathname()
  const router = useRouter()
  const activeLocale = isActiveLocale(locale) ? locale : 'en'

  function handleLocaleChange(nextLocale: ActiveLocale) {
    if (nextLocale === activeLocale) {
      return
    }

    const nextHref = `${pathname}${window.location.search}${window.location.hash}`
    router.replace(nextHref as Route, { locale: nextLocale, scroll: false })
  }

  return (
    <HandoffContent>
      {
        <label className={cn('inline-flex items-center gap-2 text-sm', className)}>
          <span className={compact ? 'sr-only' : 'text-muted-foreground'}>
            {compact ? t('choose') : t('label')}
          </span>
          <span className="relative inline-flex items-center">
            <Globe2
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
              aria-hidden
            />
            <select
              value={activeLocale}
              onChange={(event) => handleLocaleChange(event.target.value as ActiveLocale)}
              className={cn(
                'h-9 rounded-full border border-border bg-background py-1 pl-9 pr-8 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                compact ? 'w-[7.5rem]' : 'w-full min-w-36',
              )}
              aria-label={t('choose')}
            >
              {activeLocales.map((item) => (
                <option key={item} value={item}>
                  {localeLabels[item]}
                </option>
              ))}
            </select>
          </span>
        </label>
      }
    </HandoffContent>
  )
}
