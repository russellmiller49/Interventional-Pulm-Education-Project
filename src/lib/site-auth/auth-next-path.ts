import { defaultLocale, isActiveLocale, type ActiveLocale } from '@/i18n/locale'
import { localizePath, stripLocalePrefix } from '@/i18n/path'

export const DEFAULT_POST_AUTH_PATH = '/dashboard'

const AUTH_DESTINATION_PATHS = new Set([
  '/auth/update-password',
  '/forgot-password',
  '/login',
  '/signup',
  '/verify-email',
])

function resolveActiveLocale(locale: string | null | undefined): ActiveLocale {
  return isActiveLocale(locale) ? locale : defaultLocale
}

function localizePathWithSearchAndHash(target: URL, locale: ActiveLocale) {
  const pathWithSearch = `${target.pathname}${target.search}`
  const hasLocale = stripLocalePrefix(target.pathname).locale !== null
  const localizedPath = hasLocale ? pathWithSearch : localizePath(pathWithSearch, locale)
  return `${localizedPath}${target.hash}`
}

export function normalizePostAuthNextPath(
  value: string | null,
  locale: string | null | undefined,
  fallbackPath = DEFAULT_POST_AUTH_PATH,
) {
  const activeLocale = resolveActiveLocale(locale)
  const fallback = localizePath(fallbackPath, activeLocale)

  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  try {
    const target = new URL(value, 'https://interventionalpulm.local')
    const normalizedTargetPath = stripLocalePrefix(target.pathname).pathname

    if (
      AUTH_DESTINATION_PATHS.has(normalizedTargetPath) ||
      normalizedTargetPath.startsWith('/auth/callback')
    ) {
      return fallback
    }

    return localizePathWithSearchAndHash(target, activeLocale)
  } catch {
    return fallback
  }
}
