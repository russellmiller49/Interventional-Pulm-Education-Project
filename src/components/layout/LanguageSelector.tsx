'use client'

import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Globe2 } from 'lucide-react'

import {
  activeLocales,
  isActiveLocale,
  localeCookieName,
  localeLabels,
  type ActiveLocale,
} from '@/i18n/locale'
import { localizePath, unlocalizedPathname } from '@/i18n/path'
import { cn } from '@/lib/cn'

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
    const queryString = window.location.search.replace(/^\?/, '')
    const nextPath = localizePath(
      `${unlocalizedPathname(pathname)}${queryString ? `?${queryString}` : ''}`,
      nextLocale,
    )
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`
    router.replace(`${nextPath}${window.location.hash}` as Route)
  }

  return (
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
  )
}
