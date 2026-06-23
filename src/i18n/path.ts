import { activeLocales, defaultLocale, isActiveLocale, type ActiveLocale } from './locale'

export interface LocalePathResult {
  locale: ActiveLocale | null
  pathname: string
}

export function stripLocalePrefix(pathname: string): LocalePathResult {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const segments = normalizedPath.split('/')
  const possibleLocale = segments[1]

  if (!isActiveLocale(possibleLocale)) {
    return {
      locale: null,
      pathname: normalizedPath,
    }
  }

  const stripped = `/${segments.slice(2).join('/')}`.replace(/\/+$/, '')

  return {
    locale: possibleLocale,
    pathname: stripped === '' ? '/' : stripped,
  }
}

export function getPathLocale(pathname: string): ActiveLocale {
  return stripLocalePrefix(pathname).locale ?? defaultLocale
}

export function hasLocalePrefix(pathname: string) {
  return stripLocalePrefix(pathname).locale !== null
}

export function localizePath(path: string, locale: ActiveLocale = defaultLocale) {
  const [rawPathname, rawSearch = ''] = path.split('?')
  const { pathname } = stripLocalePrefix(rawPathname || '/')
  const normalizedPath = pathname === '/' ? '' : pathname
  const search = rawSearch ? `?${rawSearch}` : ''

  return `/${locale}${normalizedPath}${search}`
}

export function unlocalizedPathname(pathname: string) {
  return stripLocalePrefix(pathname).pathname
}

export function replaceLocaleInPath(pathname: string, locale: ActiveLocale) {
  const { pathname: strippedPathname } = stripLocalePrefix(pathname)
  return localizePath(strippedPathname, locale)
}

export function pathShouldBypassLocaleRedirect(pathname: string) {
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/health') ||
    pathname.startsWith('/pocus') ||
    pathname.startsWith('/socal-ebus-course/app') ||
    pathname.startsWith('/bronch-navigation-trainer/app') ||
    pathname.startsWith('/module-assets/') ||
    pathname.startsWith('/airway-anatomy/') ||
    pathname.startsWith('/draco/') ||
    pathname.startsWith('/fluoroview/') ||
    pathname.startsWith('/models/')
  ) {
    return true
  }

  return /\.[A-Za-z0-9]+$/.test(pathname)
}

export function localeStaticParams() {
  return activeLocales.map((locale) => ({ locale }))
}
