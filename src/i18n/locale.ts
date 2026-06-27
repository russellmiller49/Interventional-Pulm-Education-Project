export const defaultLocale = 'en'

export const activeLocales = ['en', 'es', 'zh-CN'] as const
export const plannedLocales = ['ko', 'ja', 'ar', 'fr', 'de', 'hi'] as const
export const allLocales = [...activeLocales, ...plannedLocales] as const

export type ActiveLocale = (typeof activeLocales)[number]
export type PlannedLocale = (typeof plannedLocales)[number]
export type Locale = ActiveLocale | PlannedLocale

export const localeCookieName = 'ip_site_locale'

export const localeLabels: Record<ActiveLocale, string> = {
  en: 'English',
  es: 'Español',
  'zh-CN': '简体中文',
}

export const localeNativeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  'zh-CN': '简体中文',
  ko: '한국어',
  ja: '日本語',
  ar: 'العربية',
  fr: 'Français',
  de: 'Deutsch',
  hi: 'हिन्दी',
}

export const translationStatus: Record<Locale, 'active' | 'planned'> = {
  en: 'active',
  es: 'active',
  'zh-CN': 'active',
  ko: 'planned',
  ja: 'planned',
  ar: 'planned',
  fr: 'planned',
  de: 'planned',
  hi: 'planned',
}

export function isActiveLocale(locale: string | null | undefined): locale is ActiveLocale {
  return activeLocales.includes(locale as ActiveLocale)
}

export function isKnownLocale(locale: string | null | undefined): locale is Locale {
  return allLocales.includes(locale as Locale)
}

export function getLocaleDirection(locale: Locale | string) {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

export function getLocaleFromAcceptLanguage(header: string | null | undefined): ActiveLocale {
  if (!header) {
    return defaultLocale
  }

  const requested = header
    .split(',')
    .map((part) => {
      const [tag, quality] = part.trim().split(';q=')
      return {
        tag: tag.toLowerCase(),
        quality: quality ? Number.parseFloat(quality) : 1,
      }
    })
    .filter((part) => part.tag)
    .sort((a, b) => b.quality - a.quality)

  for (const { tag } of requested) {
    if (tag === 'es' || tag.startsWith('es-')) {
      return 'es'
    }

    if (
      tag === 'zh' ||
      tag === 'zh-cn' ||
      tag === 'zh-hans' ||
      tag.startsWith('zh-cn-') ||
      tag.startsWith('zh-hans-')
    ) {
      return 'zh-CN'
    }

    if (tag === 'en' || tag.startsWith('en-')) {
      return 'en'
    }
  }

  return defaultLocale
}
